/**
 * Supplier group reminders for purchase orders sent to Telegram (pure rules, no IO).
 *
 * The bot nudges the supplier group when a status button has not been pressed in time:
 *  - Ordered / Draft: not accepted 3h after sending, then every 3h;
 *  - In_Production: the day before the deadline, on the day, then daily while overdue
 *    (no deadline: every 24h);
 *  - Ready: not dispatched 4h after it was marked ready, then every 4h.
 * At most PO_REMINDER_MAX reminders per status; after that the managers get one ERP alert.
 * Reminders go out only in plant working hours (Mon–Sat, 09:00–18:00 Asia/Tashkent).
 */

import { plantClock } from "@/lib/shiftSchedule";

export type PoStatus = "Draft" | "Ordered" | "In_Production" | "Ready" | "Delivered" | "Cancelled";

export interface InlineButton {
  text: string;
  callback_data: string;
}
export type InlineKeyboard = InlineButton[][];

export const PO_REMINDER_MAX = 3;
/** Orders sent longer ago than this are considered abandoned and never reminded. */
export const PO_REMINDER_MAX_AGE_DAYS = 30;
export const PO_WORK_START = "09:00";
export const PO_WORK_END = "18:00";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const INTERVAL_MS: Partial<Record<PoStatus, number>> = {
  Draft: 3 * HOUR,
  Ordered: 3 * HOUR,
  In_Production: DAY,
  Ready: 4 * HOUR,
};

export const REMINDABLE_PO_STATUSES: PoStatus[] = ["Draft", "Ordered", "In_Production", "Ready"];

// ─── Buttons ────────────────────────────────────────────────────────────────

/** The status buttons for an order in `status`; `prefix` (order no.) labels rows in a list. */
export function purchaseOrderKeyboard(orderId: string, status: string, prefix?: string): InlineKeyboard {
  const label = (text: string) => (prefix ? `${prefix} · ${text}` : text);
  const btn = (text: string, next: PoStatus): InlineButton => ({
    text: label(text),
    callback_data: `po_status:${orderId}:${next}`,
  });

  if (status === "In_Production") return [[btn("✅ Tayyor bo'ldi", "Ready")]];
  if (status === "Ready") return [[btn("🚚 Yo'lga chiqdi / Kuryerda", "Delivered")]];
  if (status === "Delivered" || status === "Cancelled") return [];
  return [[btn("🟢 Qabul qilish", "In_Production"), btn("❌ Rad etish", "Cancelled")]];
}

/** Drops every row that belongs to `orderId` (a reminder list keeps the other orders' rows). */
export function withoutOrderRows(keyboard: InlineKeyboard | undefined, orderId: string): InlineKeyboard {
  const marker = `:${orderId}:`;
  return (keyboard || []).filter((row) => !row.some((b) => b.callback_data?.includes(marker)));
}

const ALLOWED_FROM: Record<string, PoStatus[]> = {
  In_Production: ["Draft", "Ordered"],
  Cancelled: ["Draft", "Ordered"],
  Ready: ["In_Production"],
  Delivered: ["Ready"],
};

/** Whether a button press may move the order from `current` to `next` (stale buttons may not). */
export function canApplyPoStatus(current: string, next: string): boolean {
  return (ALLOWED_FROM[next] || []).includes(current as PoStatus);
}

// ─── Timing ─────────────────────────────────────────────────────────────────

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function dayNumber(isoDay: string): number {
  return Math.round(Date.parse(`${isoDay}T00:00:00Z`) / DAY);
}

/** Plant working hours: Monday–Saturday, PO_WORK_START–PO_WORK_END. */
export function isReminderWorkTime(now: Date): boolean {
  const clock = plantClock(now);
  if (new Date(`${clock.day}T00:00:00Z`).getUTCDay() === 0) return false;
  const t = toMin(clock.time);
  return t >= toMin(PO_WORK_START) && t < toMin(PO_WORK_END);
}

export type ReminderReason =
  | "not_accepted"
  | "due_tomorrow"
  | "due_monday"
  | "due_today"
  | "overdue"
  | "no_deadline"
  | "not_dispatched";

export type ReminderDecision = { kind: "remind"; reason: ReminderReason } | { kind: "escalate" } | null;

export interface ReminderOrderFacts {
  status: string;
  statusChangedAt: Date | null;
  telegramSentAt: Date | null;
  deliveryDeadline: string | null;
  reminderCount: number;
  lastReminderAt: Date | null;
}

/** What to do with one order right now: remind the group, alert the managers, or nothing. */
export function reminderDecision(o: ReminderOrderFacts, now: Date): ReminderDecision {
  if (!o.telegramSentAt || !isReminderWorkTime(now)) return null;
  if (now.getTime() - o.telegramSentAt.getTime() > PO_REMINDER_MAX_AGE_DAYS * DAY) return null;
  if (o.reminderCount > PO_REMINDER_MAX) return null;

  const status = o.status as PoStatus;
  const interval = INTERVAL_MS[status];
  if (!interval) return null;

  const exhausted = o.reminderCount >= PO_REMINDER_MAX;
  const nowMs = now.getTime();

  if (status === "In_Production" && o.deliveryDeadline && /^\d{4}-\d{2}-\d{2}/.test(o.deliveryDeadline)) {
    const today = plantClock(now).day;
    const daysLeft = dayNumber(o.deliveryDeadline.slice(0, 10)) - dayNumber(today);
    // Sunday is off, so a Monday deadline is announced on Saturday
    const isSaturday = new Date(`${today}T00:00:00Z`).getUTCDay() === 6;
    const lead = isSaturday ? 2 : 1;
    if (daysLeft > lead) return null;
    // Once per plant day
    if (o.lastReminderAt && plantClock(o.lastReminderAt).day === today) return null;
    if (exhausted) return daysLeft < 0 ? { kind: "escalate" } : null;
    const reason: ReminderReason =
      daysLeft < 0 ? "overdue" : daysLeft === 0 ? "due_today" : daysLeft === 1 ? "due_tomorrow" : "due_monday";
    return { kind: "remind", reason };
  }

  // Ordered counts from the moment the group saw it, not from when it was drafted
  const changed = o.statusChangedAt?.getTime() ?? o.telegramSentAt.getTime();
  const since =
    status === "Ordered" || status === "Draft" ? Math.max(changed, o.telegramSentAt.getTime()) : changed;
  const last = Math.max(since, o.lastReminderAt?.getTime() ?? 0);
  if (nowMs - last < interval) return null;
  if (exhausted) return { kind: "escalate" };

  const reason: ReminderReason =
    status === "Ready" ? "not_dispatched" : status === "In_Production" ? "no_deadline" : "not_accepted";
  return { kind: "remind", reason };
}

export function reminderLine(reason: ReminderReason, deadline: string | null): string {
  switch (reason) {
    case "not_accepted":
      return "Buyurtma hali qabul qilinmagan.";
    case "due_tomorrow":
      return `Muddat ertaga (${deadline}).`;
    case "due_monday":
      return `Muddat dushanba (${deadline}).`;
    case "due_today":
      return "Muddat bugun.";
    case "overdue":
      return `Muddat o'tdi (${deadline}).`;
    case "no_deadline":
      return "Tayyor bo'lsa, belgilang.";
    case "not_dispatched":
      return "Tayyor, lekin yo'lga chiqqani belgilanmagan.";
  }
}
