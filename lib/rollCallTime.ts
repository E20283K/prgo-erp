/**
 * Arrival / departure maths for the roll call (shared by the Mini App and the server).
 * Times are plant wall-clock "HH:MM" (Asia/Tashkent, fixed +05:00); a shift may cross midnight.
 * Recording only: salaried pay still counts days, so a late or early-leaving day stays paid.
 */

export interface ShiftWindow {
  start: string; // "08:00"
  end: string; // "20:00"
}

export const DEFAULT_SHIFT_WINDOWS: Record<"day" | "night", ShiftWindow> = {
  day: { start: "08:00", end: "20:00" },
  night: { start: "20:00", end: "08:00" },
};

/** Arriving later than this counts as late. */
export const LATE_THRESHOLD_MIN = 10;

const DAY = 24 * 60;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface TimeFacts {
  /** Minutes from the shift's start day 00:00 (may exceed 24h for the next morning). */
  inMin: number;
  outMin: number;
  /** Hours worked inside the shift window, in quarter hours. */
  workedHours: number;
  delayMinutes: number;
  earlyLeaveMinutes: number;
}

/**
 * Places arrival and departure on the shift's timeline. A missing value defaults to the shift
 * boundary; a departure at or before the arrival is read as the next day.
 */
export function shiftTimeFacts(shift: ShiftWindow, checkIn: string | null, checkOut: string | null): TimeFacts {
  const start = toMin(shift.start);
  let end = toMin(shift.end);
  if (end <= start) end += DAY;

  let inMin = checkIn ? toMin(checkIn) : start;
  // Night shift: an arrival in the small hours belongs to the next calendar day.
  if (inMin < start - 12 * 60) inMin += DAY;
  let outMin = checkOut ? toMin(checkOut) : end;
  while (outMin <= inMin) outMin += DAY;

  const inside = Math.max(0, Math.min(outMin, end) - Math.max(inMin, start));
  return {
    inMin,
    outMin,
    workedHours: Math.round((inside / 60) * 4) / 4,
    delayMinutes: Math.max(0, inMin - start),
    earlyLeaveMinutes: Math.max(0, end - outMin),
  };
}

/** UTC instant of a timeline minute counted from `workDate` 00:00 plant time. */
export function timelineToDate(workDate: string, minutes: number): Date {
  return new Date(Date.parse(`${workDate}T00:00:00+05:00`) + minutes * 60_000);
}

/** Plant wall-clock "HH:MM" of an instant. */
export function plantTime(date: Date): string {
  const local = new Date(date.getTime() + 5 * 3_600_000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

/** "4 s 30 d" / "45 d" for a minute count. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} s ${m} d`;
  return h ? `${h} s` : `${m} d`;
}
