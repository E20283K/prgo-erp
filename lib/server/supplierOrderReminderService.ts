import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema/core";
import { supplierOrders } from "@/db/schema";
import {
  PO_REMINDER_MAX,
  REMINDABLE_PO_STATUSES,
  isReminderWorkTime,
  purchaseOrderKeyboard,
  reminderDecision,
  reminderLine,
  type InlineKeyboard,
  type ReminderReason,
} from "@/lib/supplierOrderReminders";
import { emitNotification } from "./notificationService";
import { escapeTelegramHtml, getEffectiveTelegramBotToken } from "./telegramService";

/** Orders per reminder message; keeps the text and keyboard well under Telegram's limits. */
const LIST_CHUNK = 10;

type OrderRow = typeof supplierOrders.$inferSelect & { supplier: { name: string } | null };
interface Due {
  order: OrderRow;
  reason: ReminderReason;
}

async function tg(token: string, method: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok: boolean; description?: string };
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : "network" };
  }
}

function reminderMessage(items: Due[]): { text: string; keyboard: InlineKeyboard } {
  if (items.length === 1) {
    const { order, reason } = items[0];
    return {
      text: [
        `<b>Eslatma · ${escapeTelegramHtml(order.orderNo)}</b>`,
        escapeTelegramHtml(order.title),
        reminderLine(reason, order.deliveryDeadline),
        "",
        "<i>Iltimos, holatni tugma orqali belgilang.</i>",
      ].join("\n"),
      keyboard: purchaseOrderKeyboard(order.id, order.status),
    };
  }
  const blocks = items.map(
    ({ order, reason }) =>
      `<b>${escapeTelegramHtml(order.orderNo)}</b> — ${escapeTelegramHtml(order.title)}\n${reminderLine(reason, order.deliveryDeadline)}`
  );
  return {
    text: [
      `<b>Eslatma · ${items.length} ta buyurtma</b>`,
      "",
      blocks.join("\n\n"),
      "",
      "<i>Iltimos, holatni tugmalar orqali belgilang.</i>",
    ].join("\n"),
    keyboard: items.flatMap(({ order }) => purchaseOrderKeyboard(order.id, order.status, order.orderNo)),
  };
}

/** Takes the reminder slot so two workers never send the same one; false if someone else did. */
async function claim(order: OrderRow, now: Date, nextCount: number): Promise<boolean> {
  const rows = await db
    .update(supplierOrders)
    .set({ reminderCount: nextCount, lastReminderAt: now })
    .where(and(eq(supplierOrders.id, order.id), eq(supplierOrders.reminderCount, order.reminderCount)))
    .returning({ id: supplierOrders.id });
  return rows.length > 0;
}

async function sendGroupReminder(token: string, chatId: string, items: Due[], now: Date) {
  const claimed: Due[] = [];
  for (const item of items) {
    if (await claim(item.order, now, item.order.reminderCount + 1)) claimed.push(item);
  }
  if (claimed.length === 0) return;

  const { text, keyboard } = reminderMessage(claimed);
  const single = claimed.length === 1 ? claimed[0].order : null;
  const sent = await tg(token, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text,
    reply_markup: { inline_keyboard: keyboard },
    ...(single?.telegramMessageId
      ? { reply_parameters: { message_id: single.telegramMessageId, allow_sending_without_reply: true } }
      : {}),
  });

  if (!sent.ok) {
    console.warn(`[poReminder] chat ${chatId}: ${sent.description}`);
    // Keep lastReminderAt so the retry waits a full interval, but do not spend a reminder
    for (const { order } of claimed) {
      await db
        .update(supplierOrders)
        .set({ reminderCount: order.reminderCount })
        .where(eq(supplierOrders.id, order.id));
    }
  }
}

async function escalate(order: OrderRow, companyCode: string, now: Date) {
  if (!(await claim(order, now, PO_REMINDER_MAX + 1))) return;
  await emitNotification(
    {
      dedupKey: `po-noreply-${order.id}-${order.status}`,
      severity: "warning",
      category: "production",
      eventType: "po_no_reply",
      entityCode: order.orderNo,
      title: "Ta'minotchi javob bermayapti",
      description: `${order.orderNo} (${order.title}) — ${order.supplier?.name || "ta'minotchi"} ${PO_REMINDER_MAX} ta eslatmadan keyin ham holatni belgilamadi.`,
      link: { module: "production", subModule: "tooling-orders" },
      targetTab: {
        id: "tab-production-tooling-orders",
        title: "Tooling & CTP Orders",
        type: "registry",
        module: "production",
      },
    },
    companyCode
  );
}

/** Called by the worker every few minutes: reminds supplier groups about unanswered order buttons. */
export async function runSupplierOrderReminders(now: Date = new Date()): Promise<void> {
  if (!isReminderWorkTime(now)) return;

  const orders = (await db.query.supplierOrders.findMany({
    where: and(
      inArray(supplierOrders.status, REMINDABLE_PO_STATUSES),
      isNotNull(supplierOrders.telegramChatId),
      isNotNull(supplierOrders.telegramMessageId),
      lte(supplierOrders.reminderCount, PO_REMINDER_MAX)
    ),
    with: { supplier: { columns: { name: true } } },
  })) as OrderRow[];
  if (orders.length === 0) return;

  const byCompany = new Map<string, OrderRow[]>();
  for (const o of orders) byCompany.set(o.companyId, [...(byCompany.get(o.companyId) || []), o]);

  for (const [companyId, list] of byCompany) {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      columns: { code: true },
    });
    if (!company) continue;
    const token = await getEffectiveTelegramBotToken(company.code);
    if (!token || token.includes("mock") || token.includes("test")) continue;

    const byChat = new Map<string, Due[]>();
    for (const order of list) {
      const decision = reminderDecision(order, now);
      if (!decision) continue;
      if (decision.kind === "escalate") {
        try {
          await escalate(order, company.code, now);
        } catch (err) {
          console.warn("[poReminder] escalate failed:", err);
        }
        continue;
      }
      const chatId = order.telegramChatId!;
      byChat.set(chatId, [...(byChat.get(chatId) || []), { order, reason: decision.reason }]);
    }

    for (const [chatId, due] of byChat) {
      for (let i = 0; i < due.length; i += LIST_CHUNK) {
        try {
          await sendGroupReminder(token, chatId, due.slice(i, i + LIST_CHUNK), now);
        } catch (err) {
          console.warn("[poReminder] send failed:", err);
        }
      }
    }
  }
}
