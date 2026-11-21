import crypto from "crypto";
import { db } from "@/db";
import {
  employees,
  telegramPayoutDrafts,
  users,
  type PayoutDraftItem,
  type TelegramPayoutDraft,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { parsePayoutLocally, parsePayoutMessage } from "@/lib/ai/payoutParser";
import {
  createPayoutTx,
  getEmployeeDirectory,
  getAdvanceLimitCheck,
  getPeriodSummary,
  matchEmployees,
  todayIso,
  type DirectoryEmployee,
} from "./employeePayoutService";

const TG = "https://api.telegram.org";
const DRAFT_TTL_MS = 24 * 3600_000;
const LINK_TTL_MS = 15 * 60_000;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

type BotUser = typeof users.$inferSelect;

interface TgFrom {
  id: number;
  is_bot?: boolean;
}
interface TgMedia {
  file_id: string;
  duration?: number;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgFrom;
  text?: string;
  caption?: string;
  voice?: TgMedia;
  audio?: TgMedia;
}
interface TgCallbackQuery {
  id: string;
  data?: string;
  from?: TgFrom;
  message?: { message_id: number; chat: { id: number }; text?: string };
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function tg(token: string, method: string, body: Record<string, unknown>) {
  if (!token || token.includes("mock")) return null;
  try {
    const res = await fetch(`${TG}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`[PayoutBot] ${method} failed:`, err);
    return null;
  }
}

async function tgMultipart(token: string, method: string, form: FormData) {
  if (!token || token.includes("mock")) return null;
  try {
    const res = await fetch(`${TG}/bot${token}/${method}`, { method: "POST", body: form });
    const json = await res.json();
    if (!json?.ok) console.warn(`[PayoutBot] ${method}:`, json?.description);
    return json;
  } catch (err) {
    console.error(`[PayoutBot] ${method} failed:`, err);
    return null;
  }
}

// ─── Employee photos on the confirmation card ───────────────────────────────

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Avatar bytes from a data: URL, a file under public/, or an http(s) URL. */
async function loadAvatar(url: string | null): Promise<{ buf: Buffer; mime: string } | null> {
  if (!url) return null;
  try {
    const data = url.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
    if (data) {
      const buf = Buffer.from(data[2], "base64");
      return buf.length <= MAX_PHOTO_BYTES ? { buf, mime: data[1] } : null;
    }
    if (url.startsWith("/")) {
      const { readFile } = await import("fs/promises");
      const path = await import("path");
      const publicDir = path.join(process.cwd(), "public");
      const abs = path.resolve(publicDir, "." + decodeURIComponent(url.split("?")[0]));
      if (!abs.startsWith(publicDir + path.sep)) return null;
      const buf = await readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return buf.length <= MAX_PHOTO_BYTES ? { buf, mime } : null;
    }
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length <= MAX_PHOTO_BYTES ? { buf, mime: res.headers.get("content-type") || "image/jpeg" } : null;
    }
  } catch (err) {
    console.warn("[PayoutBot] avatar load failed:", err instanceof Error ? err.message : err);
  }
  return null;
}

interface CardPerson {
  employeeId: string;
  caption: string;
}

/** Everyone the card mentions: resolved employees and, for ambiguous lines, each candidate — numbered like the card. */
function draftPeople(items: PayoutDraftItem[], directory: DirectoryEmployee[]): CardPerson[] {
  const byId = new Map(directory.map((e) => [e.id, e]));
  const out: CardPerson[] = [];
  const seen = new Set<string>();
  const add = (i: number, id: string) => {
    const e = byId.get(id);
    if (!e || seen.has(id)) return;
    seen.add(id);
    out.push({ employeeId: id, caption: `${i + 1}. ${e.fullName}${e.position ? ` · ${e.position}` : ""}` });
  };
  items.forEach((it, i) => {
    if (it.employeeId) add(i, it.employeeId);
    else it.candidates.forEach((c) => add(i, c.id));
  });
  return out;
}

/** One photo → sendPhoto; 2–10 → an album. Employees without an avatar are simply left out. */
async function sendEmployeePhotos(token: string, chatId: string, replyTo: number, people: CardPerson[]) {
  if (people.length === 0) return;
  const rows = await db
    .select({ id: employees.id, avatarUrl: employees.avatarUrl })
    .from(employees)
    .where(inArray(employees.id, people.map((p) => p.employeeId)));
  const avatarById = new Map(rows.map((r) => [r.id, r.avatarUrl]));

  const photos: { caption: string; buf: Buffer; mime: string }[] = [];
  for (const p of people.slice(0, 10)) {
    const img = await loadAvatar(avatarById.get(p.employeeId) ?? null);
    if (img) photos.push({ caption: p.caption, ...img });
  }
  if (photos.length === 0) return;

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("reply_to_message_id", String(replyTo));
  const blob = (ph: (typeof photos)[number]) => new Blob([new Uint8Array(ph.buf)], { type: ph.mime });

  if (photos.length === 1) {
    form.append("caption", photos[0].caption);
    form.append("photo", blob(photos[0]), "employee.jpg");
    await tgMultipart(token, "sendPhoto", form);
    return;
  }
  form.append(
    "media",
    JSON.stringify(photos.map((ph, n) => ({ type: "photo", media: `attach://p${n}`, caption: ph.caption })))
  );
  photos.forEach((ph, n) => form.append(`p${n}`, blob(ph), `employee${n}.jpg`));
  await tgMultipart(token, "sendMediaGroup", form);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n: number, currency = "UZS"): string {
  const v = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v} ${currency}`;
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const KIND_LABEL = { advance: "Avans", settlement: "Raschot" } as const;

// ─── Account linking (signed deep link, no storage) ──────────────────────────

function linkSecret(): string {
  return process.env.BETTER_AUTH_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_BOT_TOKEN || "printgoo-dev";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", linkSecret()).update(payload).digest("base64url").slice(0, 16);
}

/** `start` parameter for t.me/<bot>?start=… (≤ 64 chars, [A-Za-z0-9_-]). */
export function createTelegramLinkToken(userId: string): string {
  const uid = Buffer.from(userId.replace(/-/g, ""), "hex").toString("base64url"); // 22 chars
  const exp = Math.floor((Date.now() + LINK_TTL_MS) / 1000).toString(36);
  return `L${uid}_${exp}_${sign(`${uid}.${exp}`)}`;
}

function verifyLinkToken(token: string): string | null {
  const m = token.match(/^L([A-Za-z0-9_-]{22})_([0-9a-z]+)_([A-Za-z0-9_-]{16})$/);
  if (!m) return null;
  const [, uid, exp, sig] = m;
  const expected = sign(`${uid}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (parseInt(exp, 36) * 1000 < Date.now()) return null;
  const hex = Buffer.from(uid, "base64url").toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canRecordPayouts(user: BotUser): boolean {
  if (user.status !== "Active") return false;
  if (user.role === "admin") return true;
  const hr = (user.permissions as Record<string, { create?: boolean }> | null)?.hr;
  return hr?.create === true;
}

// ─── Entry point from processTelegramWebhookUpdate ───────────────────────────

/**
 * Returns true when the update belongs to the payout bot and was handled here,
 * so the CRM inbox flow must skip it. Unlinked users fall through unchanged.
 */
export async function tryHandlePayoutBotUpdate(update: TgUpdate, companyId: string, token: string): Promise<boolean> {
  const cq = update.callback_query;
  if (cq && String(cq.data || "").startsWith("pay:")) {
    await handleCallback(cq, companyId, token);
    return true;
  }

  const message = update.message;
  if (!message || message.chat?.type !== "private" || !message.from || message.from.is_bot) return false;
  const tgUserId = String(message.from.id);
  const text: string = message.text || message.caption || "";

  // /start L… — link this Telegram account to an ERP user
  const startArg = text.match(/^\/start\s+(L\S+)/)?.[1];
  if (startArg) {
    await handleLink(startArg, tgUserId, message.chat.id, token);
    return true;
  }

  const user = await db.query.users.findFirst({ where: eq(users.telegramUserId, tgUserId) });
  // Users without a company (global admins) act for the webhook's company.
  if (!user || (user.companyId && user.companyId !== companyId)) return false;

  if (!canRecordPayouts(user)) {
    await tg(token, "sendMessage", { chat_id: message.chat.id, text: "Avans yozish uchun HR ruxsati kerak." });
    return true;
  }

  if (text.startsWith("/start") || text.startsWith("/help")) {
    await tg(token, "sendMessage", {
      chat_id: message.chat.id,
      parse_mode: "HTML",
      text:
        `<b>${esc(user.fullName)}</b>, hodimga berilgan pulni yozing yoki ovozli xabar yuboring:\n\n` +
        `<code>Vali Aliyevga 500 ming avans</code>\n<code>Sardor 300, Jasur 200 ming avans</code>\n<code>Dilshodga oktyabr raschoti 2,4 mln kartaga</code>\n<code>Valining avansi qancha?</code>`,
    });
    return true;
  }

  await handleMessage(message, user, companyId, token);
  return true;
}

async function handleLink(arg: string, tgUserId: string, chatId: number, token: string) {
  const userId = verifyLinkToken(arg);
  if (!userId) {
    await tg(token, "sendMessage", { chat_id: chatId, text: "Havola eskirgan yoki noto'g'ri. ERP'dan yangisini oling." });
    return;
  }
  await db.update(users).set({ telegramUserId: null }).where(eq(users.telegramUserId, tgUserId));
  const [u] = await db
    .update(users)
    .set({ telegramUserId: tgUserId, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ fullName: users.fullName });
  await tg(token, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text: u
      ? `Telegram <b>${esc(u.fullName)}</b> profiliga bog'landi. Endi hodimlarga berilgan avans va raschotni shu yerga yozishingiz mumkin.`
      : "Foydalanuvchi topilmadi.",
  });
}

// ─── Message → AI → draft card ───────────────────────────────────────────────

async function downloadVoice(token: string, fileId: string): Promise<{ base64: string; mime: string } | null> {
  const info = await tg(token, "getFile", { file_id: fileId });
  const filePath = info?.result?.file_path;
  if (!filePath || (info.result.file_size ?? 0) > MAX_AUDIO_BYTES) return null;
  const res = await fetch(`${TG}/file/bot${token}/${filePath}`);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = filePath.endsWith(".mp3") ? "audio/mp3" : filePath.endsWith(".m4a") ? "audio/mp4" : "audio/ogg";
  return { base64: buf.toString("base64"), mime };
}

async function handleMessage(message: TgMessage, user: BotUser, companyId: string, token: string) {
  const chatId = String(message.chat.id);
  const voice = message.voice || message.audio;
  const text: string = message.text || message.caption || "";
  if (!voice && !text.trim()) return;

  // Telegram re-delivers the update if we answer slowly — one draft per source message.
  const existing = await db.query.telegramPayoutDrafts.findFirst({
    where: and(eq(telegramPayoutDrafts.tgChatId, chatId), eq(telegramPayoutDrafts.sourceMessageId, message.message_id)),
  });
  if (existing) return;

  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  let audio: { base64: string; mime: string } | null = null;
  if (voice) {
    if ((voice.duration ?? 0) > 90) {
      await tg(token, "sendMessage", { chat_id: chatId, text: "Ovozli xabar 1.5 daqiqadan oshmasin." });
      return;
    }
    audio = await downloadVoice(token, voice.file_id);
    if (!audio) {
      await tg(token, "sendMessage", { chat_id: chatId, text: "Ovozli xabarni yuklab bo'lmadi." });
      return;
    }
  }

  const directory = await getEmployeeDirectory(companyId);
  const today = todayIso();
  let parsed;
  try {
    parsed = await parsePayoutMessage({ text, audio, employees: directory, today });
  } catch (err) {
    console.error("[PayoutBot] AI parse failed:", err instanceof Error ? err.message : err);
    // Text can still be handled by the rule-based parser; the confirm card guards against mistakes.
    parsed = audio ? null : parsePayoutLocally(text);
    if (!parsed || parsed.items.length === 0) {
      await tg(token, "sendMessage", {
        chat_id: chatId,
        text: audio
          ? "AI hozir ishlamayapti, ovozli xabarni o'qib bo'lmadi. Matn bilan yozing."
          : "AI hozir ishlamayapti. Oddiy shaklda yozing: \"Vali Aliyev 500 ming avans\".",
      });
      return;
    }
  }

  if (parsed.intent === "balance_query") {
    await replyBalance(parsed.queryNames.length ? parsed.queryNames : [parsed.transcript], directory, chatId, token);
    return;
  }

  if (parsed.intent !== "payout" || parsed.items.length === 0) {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      reply_to_message_id: message.message_id,
      text: "Pul berish yozuvini topa olmadim. Masalan: \"Vali Aliyevga 500 ming avans\".",
    });
    return;
  }

  const byId = new Map(directory.map((e) => [e.id, e]));
  const items: PayoutDraftItem[] = parsed.items.map((it) => {
    const emp = it.employeeId ? byId.get(it.employeeId) : undefined;
    const candidates = emp ? [] : matchEmployees(it.nameAsWritten, directory);
    const resolved = emp ?? (candidates.length === 1 ? candidates[0] : undefined);
    const advanceDate = it.date ?? today;
    return {
      nameAsWritten: it.nameAsWritten,
      employeeId: resolved?.id ?? null,
      candidates: resolved ? [] : candidates.map((c) => ({ id: c.id, fullName: c.fullName, position: c.position })),
      amount: it.amount,
      currency: it.currency,
      kind: it.kind,
      period: it.period ?? advanceDate.slice(0, 7),
      advanceDate,
      note: it.note,
    };
  });

  const [draft] = await db
    .insert(telegramPayoutDrafts)
    .values({
      companyId,
      userId: user.id,
      tgChatId: chatId,
      sourceMessageId: message.message_id,
      transcript: audio ? parsed.transcript : null,
      items,
    })
    .onConflictDoNothing()
    .returning();
  if (!draft) return;

  // Photos first, so the card with the buttons ends up right under the faces it refers to.
  await sendEmployeePhotos(token, chatId, message.message_id, draftPeople(items, directory));

  const card = await renderDraftCard(draft, directory);
  const sent = await tg(token, "sendMessage", {
    chat_id: chatId,
    reply_to_message_id: message.message_id,
    parse_mode: "HTML",
    text: card.text,
    reply_markup: card.keyboard,
  });
  const botMessageId = sent?.result?.message_id;
  if (botMessageId) {
    await db.update(telegramPayoutDrafts).set({ botMessageId }).where(eq(telegramPayoutDrafts.id, draft.id));
  }
}

async function replyBalance(names: string[], directory: DirectoryEmployee[], chatId: string, token: string) {
  const period = todayIso().slice(0, 7);
  const lines: string[] = [];
  for (const name of names.slice(0, 5)) {
    const matches = matchEmployees(name, directory, 3);
    if (matches.length === 0) {
      lines.push(`"${esc(name)}" — topilmadi`);
      continue;
    }
    for (const emp of matches) {
      const s = await getPeriodSummary(emp.id, period);
      lines.push(
        `<b>${esc(emp.fullName)}</b> · ${period}\n` +
          `Avans: ${money(s.advances, emp.currency)}` +
          (s.settlements ? `\nRaschot: ${money(s.settlements, emp.currency)}` : "") +
          (s.accrued != null ? `\nHisoblangan: ${money(s.accrued, emp.currency)}\nQoldiq: ${money(s.balance ?? 0, emp.currency)}` : "")
      );
    }
  }
  await tg(token, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text: lines.join("\n\n") || "Topilmadi" });
}

async function renderDraftCard(draft: TelegramPayoutDraft, directory?: DirectoryEmployee[]) {
  const dir = directory ?? (await getEmployeeDirectory(draft.companyId));
  const byId = new Map(dir.map((e) => [e.id, e]));
  const items = draft.items;
  const lines: string[] = [];
  const keyboard: { text: string; callback_data: string }[][] = [];
  const draftAdvanced = new Map<string, number>(); // employee|period -> advances already counted from this draft

  if (draft.transcript) lines.push(`<i>«${esc(draft.transcript)}»</i>\n`);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const emp = it.employeeId ? byId.get(it.employeeId) : undefined;
    const head = `${i + 1}. ${KIND_LABEL[it.kind]} · ${dmy(it.advanceDate)}${it.period !== it.advanceDate.slice(0, 7) ? ` · ${it.period} uchun` : ""}`;
    if (emp) {
      const s = await getPeriodSummary(emp.id, it.period);

      // Limit control before saving: earlier advances + this and the draft's earlier rows for the same month.
      let limitLine = "";
      if (it.kind === "advance" && it.currency.toUpperCase() === emp.currency.toUpperCase()) {
        const key = `${emp.id}|${it.period}`;
        const inDraft = draftAdvanced.get(key) ?? 0;
        draftAdvanced.set(key, inDraft + it.amount);
        const check = await getAdvanceLimitCheck(db, emp.id, it.period, inDraft + it.amount);
        if (check) {
          limitLine =
            `\n${check.basis === "payroll" ? "Hisoblangan" : "Oklad"}: ${money(check.limit, it.currency)}, bu bilan jami avans: ${money(check.total, it.currency)}` +
            (check.over > 0
              ? `\n<b>Oylikdan ${money(check.over, it.currency)} oshadi, keyingi oyga qarz bo'ladi</b>`
              : `\nQoladi: ${money(check.limit - check.total, it.currency)}`);
        }
      }

      lines.push(
        `${head}\n<b>${esc(emp.fullName)}</b>${emp.position ? ` (${esc(emp.position)})` : ""} — <b>${money(it.amount, it.currency)}</b>` +
          `\nShu oy berilgan: ${money(s.advances + s.settlements, it.currency)}` +
          limitLine +
          (it.note ? `\nIzoh: ${esc(it.note)}` : "")
      );
    } else if (it.candidates.length > 0) {
      lines.push(`${head}\n"${esc(it.nameAsWritten)}" — <b>${money(it.amount, it.currency)}</b>\n${it.candidates.length} ta mos hodim, tanlang:`);
      it.candidates.forEach((c, n) => {
        keyboard.push([
          { text: `${i + 1}. ${c.fullName}${c.position ? ` · ${c.position}` : ""}`, callback_data: `pay:e:${draft.id}:${i}:${n}` },
        ]);
      });
    } else {
      lines.push(`${head}\n"${esc(it.nameAsWritten)}" — ${money(it.amount, it.currency)}\nHodim topilmadi, saqlanmaydi.`);
    }
  }

  const unresolved = items.some((it) => !it.employeeId && it.candidates.length > 0);
  const savable = items.some((it) => it.employeeId);
  const actions: { text: string; callback_data: string }[] = [];
  if (!unresolved && savable) actions.push({ text: "Tasdiqlash", callback_data: `pay:ok:${draft.id}` });
  actions.push({ text: "Bekor", callback_data: `pay:no:${draft.id}` });
  keyboard.push(actions);

  return { text: lines.join("\n\n"), keyboard: { inline_keyboard: keyboard } };
}

// ─── Callback buttons ────────────────────────────────────────────────────────

async function handleCallback(cq: TgCallbackQuery, companyId: string, token: string) {
  const answer = (text: string, alert = false) =>
    tg(token, "answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });

  const [, action, draftId, a, b] = String(cq.data).split(":");
  const user = await db.query.users.findFirst({ where: eq(users.telegramUserId, String(cq.from?.id ?? "")) });
  const draft = draftId
    ? await db.query.telegramPayoutDrafts.findFirst({
        where: and(eq(telegramPayoutDrafts.id, draftId), eq(telegramPayoutDrafts.companyId, companyId)),
      })
    : undefined;

  if (!draft || !user || draft.userId !== user.id || !canRecordPayouts(user)) {
    await answer("Bu karta sizniki emas", true);
    return;
  }
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const edit = (text: string, keyboard?: unknown) =>
    tg(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      text,
      reply_markup: keyboard ?? { inline_keyboard: [] },
    });

  if (draft.status !== "pending" || Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MS) {
    if (draft.status === "pending") {
      await db.update(telegramPayoutDrafts).set({ status: "expired", updatedAt: new Date() }).where(eq(telegramPayoutDrafts.id, draft.id));
    }
    await answer("Karta muddati o'tgan yoki allaqachon yopilgan", true);
    return;
  }

  if (action === "no") {
    await db.update(telegramPayoutDrafts).set({ status: "cancelled", updatedAt: new Date() }).where(eq(telegramPayoutDrafts.id, draft.id));
    await answer("Bekor qilindi");
    await edit(`${cq.message?.text ? esc(cq.message.text) : ""}\n\n<b>Bekor qilindi</b>`);
    return;
  }

  if (action === "e") {
    const i = Number(a);
    const n = Number(b);
    const items = [...draft.items];
    const pick = items[i]?.candidates[n];
    if (!pick) {
      await answer("Topilmadi", true);
      return;
    }
    items[i] = { ...items[i], employeeId: pick.id, candidates: [] };
    const [updated] = await db
      .update(telegramPayoutDrafts)
      .set({ items, updatedAt: new Date() })
      .where(eq(telegramPayoutDrafts.id, draft.id))
      .returning();
    const card = await renderDraftCard(updated);
    await answer(pick.fullName);
    await edit(card.text, card.keyboard);
    return;
  }

  if (action === "ok") {
    const toSave = draft.items.filter((it) => it.employeeId);
    let results: { item: PayoutDraftItem; warning?: string }[] = [];
    try {
      results = await db.transaction(async (tx) => {
        const out: { item: PayoutDraftItem; warning?: string }[] = [];
        for (const item of toSave) {
          const r = await createPayoutTx(tx, {
            companyId,
            employeeId: item.employeeId!,
            amount: item.amount,
            kind: item.kind,
            advanceDate: item.advanceDate,
            period: item.period,
            currency: item.currency,
            paymentMethod: /karta|card|карт/i.test(item.note ?? "") ? "card" : "cash",
            note: item.note,
            source: "telegram",
            createdByUserId: user.id,
            telegram: { chatId: draft.tgChatId, messageId: draft.sourceMessageId },
          });
          out.push({ item, warning: r.warning });
        }
        await tx
          .update(telegramPayoutDrafts)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(telegramPayoutDrafts.id, draft.id));
        return out;
      });
    } catch (err) {
      await answer(err instanceof Error ? err.message : "Saqlanmadi", true);
      return;
    }

    const dir = await getEmployeeDirectory(companyId);
    const byId = new Map(dir.map((e) => [e.id, e]));
    const lines: string[] = ["<b>Saqlandi</b>"];
    for (const { item, warning } of results) {
      const emp = byId.get(item.employeeId!);
      const s = await getPeriodSummary(item.employeeId!, item.period);
      lines.push(
        `${KIND_LABEL[item.kind]} · <b>${esc(emp?.fullName ?? item.nameAsWritten)}</b> — ${money(item.amount, item.currency)}` +
          `\n${item.period}: avans ${money(s.advances, item.currency)}` +
          (s.settlements ? `, raschot ${money(s.settlements, item.currency)}` : "") +
          (s.balance != null ? `, qoldiq ${money(s.balance, item.currency)}` : "") +
          (warning ? `\n${esc(warning)}` : "")
      );
    }
    await answer("Saqlandi");
    await edit(lines.join("\n\n"));
  }
}
