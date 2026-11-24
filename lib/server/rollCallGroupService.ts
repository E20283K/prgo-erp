import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, type TelegramCompanySettings } from "@/db/schema/core";
import { users } from "@/db/schema/users";
import { attendanceLogs, attendanceRollCalls } from "@/db/schema/hr";
import { plantClock } from "@/lib/shiftSchedule";
import { LATE_THRESHOLD_MIN, formatMinutes, isClockTime, plantTime, shiftTimeFacts } from "@/lib/rollCallTime";
import { getShiftWindows, type RollCallShift } from "./tgAttendanceService";
import { getEffectiveTelegramBotToken, saveTelegramSettings } from "./telegramService";

/**
 * Roll call in the company's Telegram group:
 *  - at the configured time the bot asks for the day / night shift roll call;
 *  - after the master saves in the Mini App the bot posts who came, with an edit button;
 *  - later edits update that summary message instead of posting a new one.
 */

const DEFAULT_REMINDER: Record<RollCallShift, string> = { day: "09:00", night: "21:00" };
/** A reminder missed by more than this (server down, deploy) is skipped, not sent late. */
const REMINDER_GRACE_MIN = 120;

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const SHIFT_TITLE: Record<RollCallShift, string> = { day: "Kunduzgi smena", night: "Tungi smena" };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function dayTitle(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}`;
}
function toShift(value: string | null | undefined): RollCallShift {
  return value?.toLowerCase().startsWith("night") ? "night" : "day";
}
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

async function tg<T = unknown>(token: string, method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : "network" };
  }
}

interface CompanyBot {
  companyId: string;
  code: string;
  token: string;
  settings: TelegramCompanySettings;
}

async function companyBot(companyId: string): Promise<CompanyBot | null> {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) return null;
  const token = await getEffectiveTelegramBotToken(company.code);
  if (!token) return null;
  return { companyId, code: company.code, token, settings: company.settings?.telegram ?? {} };
}

const usernameCache = new Map<string, string>();

async function botUsername(bot: CompanyBot): Promise<string | null> {
  if (bot.settings.botUsername) return bot.settings.botUsername.replace(/^@/, "");
  const cached = usernameCache.get(bot.token);
  if (cached) return cached;
  const me = await tg<{ username?: string }>(bot.token, "getMe", {});
  if (me.ok && me.result?.username) {
    usernameCache.set(bot.token, me.result.username);
    return me.result.username;
  }
  return null;
}

/** `startapp` value the Mini App turns into the roll call screen ([A-Za-z0-9_-], ≤ 64). */
export function rollCallStartParam(date: string, shift: RollCallShift): string {
  return `att_${shift === "night" ? "n" : "d"}_${date.replace(/-/g, "")}`;
}

/** Inline button opening the Mini App on this roll call (direct links work in groups). */
async function rollCallButton(bot: CompanyBot, date: string, shift: RollCallShift, text: string) {
  const username = await botUsername(bot);
  if (!username) return undefined;
  const app = bot.settings.miniAppName?.trim();
  const url = `https://t.me/${username}${app ? `/${app}` : ""}?startapp=${rollCallStartParam(date, shift)}`;
  return { inline_keyboard: [[{ text, url }]] };
}

async function rollCallRecord(companyId: string, date: string, shift: RollCallShift) {
  await db
    .insert(attendanceRollCalls)
    .values({ companyId, workDate: date, shiftType: shift })
    .onConflictDoNothing();
  const row = await db.query.attendanceRollCalls.findFirst({
    where: and(
      eq(attendanceRollCalls.companyId, companyId),
      eq(attendanceRollCalls.workDate, date),
      eq(attendanceRollCalls.shiftType, shift)
    ),
  });
  return row!;
}

// ─── Reminder ────────────────────────────────────────────────────────────────

export async function sendRollCallReminder(companyId: string, date: string, shift: RollCallShift): Promise<boolean> {
  const bot = await companyBot(companyId);
  const chatId = bot?.settings.attendanceChatId;
  if (!bot || !chatId) return false;

  const record = await rollCallRecord(companyId, date, shift);
  const reply_markup = await rollCallButton(bot, date, shift, "Yo'qlama qilish");
  const sent = await tg<{ message_id: number }>(bot.token, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text: `<b>${SHIFT_TITLE[shift]} · ${dayTitle(date)}</b>\nYo'qlama qilinmagan. Master, belgilab chiqing.`,
    ...(reply_markup ? { reply_markup } : {}),
  });
  if (!sent.ok) {
    console.warn("[rollCall] reminder failed:", sent.description);
    return false;
  }
  await db
    .update(attendanceRollCalls)
    .set({ chatId, reminderMessageId: sent.result!.message_id, reminderSentAt: new Date(), updatedAt: new Date() })
    .where(eq(attendanceRollCalls.id, record.id));
  return true;
}

/** Called every minute by the worker: sends each due, not yet done reminder exactly once. */
export async function runRollCallReminders(now: Date = new Date()): Promise<void> {
  const clock = plantClock(now);
  const nowMin = toMin(clock.time);
  const all = await db.select({ id: companies.id, settings: companies.settings }).from(companies);

  for (const c of all) {
    const tgs = c.settings?.telegram;
    if (!tgs?.attendanceChatId) continue;
    for (const shift of ["day", "night"] as const) {
      const configured = shift === "day" ? tgs.attendanceDayReminder : tgs.attendanceNightReminder;
      const at = isClockTime(configured) ? configured : DEFAULT_REMINDER[shift];
      const late = nowMin - toMin(at);
      if (late < 0 || late > REMINDER_GRACE_MIN) continue;

      await db
        .insert(attendanceRollCalls)
        .values({ companyId: c.id, workDate: clock.day, shiftType: shift })
        .onConflictDoNothing();
      // Claim the reminder atomically so two workers never both send it.
      const claimed = await db
        .update(attendanceRollCalls)
        .set({ reminderSentAt: now, updatedAt: now })
        .where(
          and(
            eq(attendanceRollCalls.companyId, c.id),
            eq(attendanceRollCalls.workDate, clock.day),
            eq(attendanceRollCalls.shiftType, shift),
            isNull(attendanceRollCalls.reminderSentAt),
            isNull(attendanceRollCalls.completedAt)
          )
        )
        .returning({ id: attendanceRollCalls.id });
      if (claimed.length === 0) continue;

      const ok = await sendRollCallReminder(c.id, clock.day, shift);
      if (!ok) {
        // Let the next tick retry.
        await db.update(attendanceRollCalls).set({ reminderSentAt: null }).where(eq(attendanceRollCalls.id, claimed[0].id));
      }
    }
  }
}

// ─── Summary after saving ────────────────────────────────────────────────────

const ABSENT_LABEL: Record<string, string> = {
  absent: "kelmadi",
  sick_leave: "kasal",
  vacation: "ta'til",
  day_off: "dam olish",
};

async function buildSummary(companyId: string, date: string, shift: RollCallShift, actorName: string): Promise<string | null> {
  const logs = await db.query.attendanceLogs.findMany({
    where: and(eq(attendanceLogs.companyId, companyId), eq(attendanceLogs.workDate, date)),
    with: { employee: { columns: { fullName: true } } },
  });
  const mine = logs.filter((l) => toShift(l.shiftType) === shift);
  if (mine.length === 0) return null;
  const window = (await getShiftWindows(companyId))[shift];
  const name = (l: (typeof mine)[number]) => esc(l.employee?.fullName ?? "—");
  const byName = (a: (typeof mine)[number], b: (typeof mine)[number]) => name(a).localeCompare(name(b));

  const came = mine.filter((l) => l.status === "present" || l.status === "late").sort(byName);
  const away = mine.filter((l) => l.status !== "present" && l.status !== "late").sort(byName);

  const lines: string[] = [`<b>${SHIFT_TITLE[shift]} · ${dayTitle(date)}</b>`];
  lines.push(`Keldi: ${came.length} · Kelmadi: ${away.length}`);

  if (came.length) {
    lines.push("", "<b>Keldi</b>");
    for (const l of came) {
      const notes: string[] = [];
      if (l.checkIn || l.checkOut) {
        const facts = shiftTimeFacts(window, l.checkIn ? plantTime(l.checkIn) : null, l.checkOut ? plantTime(l.checkOut) : null);
        if (l.checkIn && facts.delayMinutes > LATE_THRESHOLD_MIN) {
          notes.push(`${plantTime(l.checkIn)} da keldi (kech ${formatMinutes(facts.delayMinutes)})`);
        }
        if (l.checkOut && facts.earlyLeaveMinutes > 0) notes.push(`${plantTime(l.checkOut)} da ketdi`);
      } else if (l.status === "late") {
        notes.push("kechikdi");
      }
      const overtime = Number(l.overtimeHours) || 0;
      if (overtime > 0) notes.push(`+${overtime} s`);
      lines.push(`${name(l)}${notes.length ? ` — ${notes.join(", ")}` : ""}`);
    }
  }
  if (away.length) {
    lines.push("", "<b>Kelmadi</b>");
    for (const l of away) lines.push(`${name(l)} — ${ABSENT_LABEL[l.status] ?? l.status}`);
  }

  const totalOvertime = came.reduce((s, l) => s + (Number(l.overtimeHours) || 0), 0);
  if (totalOvertime > 0) lines.push("", `Ortiqcha jami: ${totalOvertime} s`);
  lines.push("", `<i>Belgiladi: ${esc(actorName)}, ${plantClock(new Date()).time}</i>`);

  let text = lines.join("\n");
  if (text.length > 4000) text = `${text.slice(0, 3990)}\n…`;
  return text;
}

/**
 * Posts (first save) or updates (later saves) the shift's summary in the attendance group.
 * Never throws: the roll call is already saved, a Telegram problem must not undo that.
 */
export async function publishRollCallSummary(companyId: string, date: string, shift: RollCallShift, actorName: string): Promise<void> {
  try {
    const bot = await companyBot(companyId);
    const chatId = bot?.settings.attendanceChatId;
    if (!bot || !chatId) return;
    const text = await buildSummary(companyId, date, shift, actorName);
    if (!text) return;

    const record = await rollCallRecord(companyId, date, shift);
    const reply_markup = await rollCallButton(bot, date, shift, "O'zgartirish");
    const payload = { chat_id: chatId, parse_mode: "HTML", text, ...(reply_markup ? { reply_markup } : {}) };

    let messageId = record.chatId === chatId ? record.summaryMessageId : null;
    if (messageId) {
      const edited = await tg(bot.token, "editMessageText", { ...payload, message_id: messageId });
      // "message is not modified" is fine; a deleted message gets a new one.
      if (!edited.ok && !/not modified/i.test(edited.description ?? "")) messageId = null;
    }
    if (!messageId) {
      const sent = await tg<{ message_id: number }>(bot.token, "sendMessage", payload);
      if (!sent.ok) {
        console.warn("[rollCall] summary failed:", sent.description);
        return;
      }
      messageId = sent.result!.message_id;
      // The reminder has done its job: keep the group tidy.
      if (record.reminderMessageId && record.chatId === chatId) {
        await tg(bot.token, "deleteMessage", { chat_id: chatId, message_id: record.reminderMessageId });
      }
    }

    await db
      .update(attendanceRollCalls)
      .set({
        chatId,
        summaryMessageId: messageId,
        completedAt: record.completedAt ?? new Date(),
        completedBy: actorName,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRollCalls.id, record.id));
  } catch (err) {
    console.warn("[rollCall] summary error:", err);
  }
}

/**
 * After a save: refreshes the summary of every shift the save touched, and of a shift
 * someone may have been moved out of (it already has a summary in the group).
 */
export async function publishRollCallSummaries(
  companyId: string,
  date: string,
  entries: { shiftType: string }[],
  actorName: string
): Promise<void> {
  const touched = new Set<RollCallShift>(entries.map((e) => toShift(e.shiftType)));
  const posted = await db.query.attendanceRollCalls.findMany({
    where: and(eq(attendanceRollCalls.companyId, companyId), eq(attendanceRollCalls.workDate, date)),
    columns: { shiftType: true, summaryMessageId: true },
  });
  for (const p of posted) if (p.summaryMessageId) touched.add(toShift(p.shiftType));
  for (const shift of touched) await publishRollCallSummary(companyId, date, shift, actorName);
}

// ─── Group commands ──────────────────────────────────────────────────────────

const HELP =
  "<b>Yo'qlama buyruqlari</b>\n" +
  "/yoqlama_ulash — shu guruhni yo'qlama guruhi qilish\n" +
  "/yoqlama_vaqt 09:00 21:00 — kunduzgi va tungi eslatma vaqti\n" +
  "/yoqlama — hozirgi smena yo'qlamasini so'rash";

function canManage(user: typeof users.$inferSelect): boolean {
  if (user.status !== "Active") return false;
  if (user.role === "admin") return true;
  const perms = (user.permissions || {}) as unknown as Record<string, Record<string, boolean> | undefined>;
  return ["hr", "production"].some((m) => perms[m]?.create === true || perms[m]?.edit === true);
}

interface TgGroupMessage {
  chat: { id: number; type: string; title?: string };
  from?: { id: number; is_bot?: boolean };
  text?: string;
  message_id: number;
}

/**
 * Handles /yoqlama* commands sent in a group. Returns true when the update was one of them,
 * so the CRM inbox does not record it.
 */
export async function tryHandleRollCallCommand(message: TgGroupMessage | undefined, companyId: string, token: string): Promise<boolean> {
  if (!message?.text || !message.from || message.from.is_bot) return false;
  if (message.chat.type !== "group" && message.chat.type !== "supergroup") return false;
  const m = message.text.trim().match(/^\/(yoqlama(?:_ulash|_vaqt|_yordam)?)(?:@\w+)?(?:\s+(.*))?$/i);
  if (!m) return false;
  const command = m[1].toLowerCase();
  const args = (m[2] ?? "").trim();
  const chatId = String(message.chat.id);
  const reply = (text: string, extra: Record<string, unknown> = {}) =>
    tg(token, "sendMessage", { chat_id: chatId, parse_mode: "HTML", text, reply_to_message_id: message.message_id, ...extra });

  const user = await db.query.users.findFirst({ where: eq(users.telegramUserId, String(message.from.id)) });
  if (!user || (user.companyId && user.companyId !== companyId) || !canManage(user)) {
    await reply("Bu buyruq faqat ERP'ga bog'langan master yoki HR uchun.");
    return true;
  }
  const bot = await companyBot(companyId);
  if (!bot) return true;
  const tgs = bot.settings;

  if (command === "yoqlama_yordam") {
    await reply(HELP);
    return true;
  }

  if (command === "yoqlama_ulash") {
    await saveTelegramSettings(bot.code, { attendanceChatId: chatId, attendanceChatTitle: message.chat.title ?? "" });
    const day = isClockTime(tgs.attendanceDayReminder) ? tgs.attendanceDayReminder : DEFAULT_REMINDER.day;
    const night = isClockTime(tgs.attendanceNightReminder) ? tgs.attendanceNightReminder : DEFAULT_REMINDER.night;
    await reply(
      `Shu guruh yo'qlama guruhi qilindi.\nEslatma: kunduzgi <b>${day}</b>, tungi <b>${night}</b>.\n` +
        `Vaqtni o'zgartirish: <code>/yoqlama_vaqt 09:00 21:00</code>`
    );
    return true;
  }

  if (command === "yoqlama_vaqt") {
    const [day, night] = args.split(/\s+/);
    if (!isClockTime(day) || (night !== undefined && !isClockTime(night))) {
      await reply("Format: <code>/yoqlama_vaqt 09:00 21:00</code>");
      return true;
    }
    await saveTelegramSettings(bot.code, {
      attendanceDayReminder: day,
      ...(night ? { attendanceNightReminder: night } : {}),
    });
    await reply(`Eslatma vaqti: kunduzgi <b>${day}</b>${night ? `, tungi <b>${night}</b>` : ""}.`);
    return true;
  }

  // /yoqlama — ask now for the shift running at this moment.
  if (tgs.attendanceChatId !== chatId) {
    await reply("Avval shu guruhni ulang: /yoqlama_ulash");
    return true;
  }
  const clock = plantClock(new Date());
  const windows = await getShiftWindows(companyId);
  const nightStart = toMin(windows.night.start);
  const nightEnd = toMin(windows.night.end);
  const t = toMin(clock.time);
  const inNight = nightEnd <= nightStart ? t >= nightStart || t < nightEnd : t >= nightStart && t < nightEnd;
  // After midnight the night shift still belongs to the previous day.
  let date = clock.day;
  if (inNight && nightEnd <= nightStart && t < nightEnd) {
    const d = new Date(`${clock.day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    date = d.toISOString().slice(0, 10);
  }
  await sendRollCallReminder(companyId, date, inNight ? "night" : "day");
  return true;
}
