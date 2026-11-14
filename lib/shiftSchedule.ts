/**
 * Shift schedule of a plant, read from its working hours string ("08:00 – 17:00 / 17:00 – 02:00").
 * Shared by the server (stamps events) and the client (dialog defaults).
 */

export interface ShiftInterval {
  /** "1-smena", "2-smena", ... in the order the plant lists them. */
  name: string;
  start: string;
  end: string;
}

/** Plants work in Uzbekistan time; the floor clock, not the server clock, decides the shift. */
export const PLANT_TIME_ZONE = "Asia/Tashkent";

export const DEFAULT_SHIFTS: ShiftInterval[] = [{ name: "1-smena", start: "08:00", end: "17:00" }];

export function parseShiftSchedule(workingHours?: string | null): ShiftInterval[] {
  const parts = String(workingHours || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const pad = (t: string) => (t.length === 4 ? `0${t}` : t);
  const out: ShiftInterval[] = [];
  for (const part of parts) {
    const m = part.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (m) out.push({ name: `${out.length + 1}-smena`, start: pad(m[1]), end: pad(m[2]) });
  }
  return out.length > 0 ? out : DEFAULT_SHIFTS;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Wall-clock "HH:MM" and "YYYY-MM-DD" of a moment on the plant's clock. */
export function plantClock(date: Date): { time: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PLANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return { time: `${get("hour")}:${get("minute")}`, day: `${get("year")}-${get("month")}-${get("day")}` };
}

/**
 * The shift a wall-clock time falls in (intervals may cross midnight).
 * Outside every shift (overtime, a break) the nearest shift that started before it is used.
 */
export function shiftAt(time: string, schedule: ShiftInterval[]): string {
  const t = toMinutes(time);
  for (const s of schedule) {
    const a = toMinutes(s.start);
    const b = toMinutes(s.end);
    const inside = a < b ? t >= a && t < b : t >= a || t < b;
    if (inside) return s.name;
  }
  let best = schedule[0];
  let bestGap = Infinity;
  for (const s of schedule) {
    const gap = (t - toMinutes(s.start) + 1440) % 1440;
    if (gap < bestGap) {
      bestGap = gap;
      best = s;
    }
  }
  return best?.name || "1-smena";
}

/** Same plant-clock day as `baseIso`, at another "HH:MM" (correcting the time of an entry). */
export function atPlantTime(baseIso: string, time: string): string {
  const base = new Date(baseIso);
  if (Number.isNaN(base.getTime()) || !/^\d{1,2}:\d{2}$/.test(time || "")) return baseIso;
  const { day } = plantClock(base);
  return new Date(`${day}T${time.length === 4 ? `0${time}` : time}:00+05:00`).toISOString();
}

/**
 * The moment a "HH:MM" entered on the floor refers to: today on the plant clock,
 * or yesterday when that time is still ahead (a night-shift entry made after midnight).
 */
export function occurredAtFromTime(time: string, now: Date = new Date()): string {
  if (!/^\d{1,2}:\d{2}$/.test(time || "")) return now.toISOString();
  const clock = plantClock(now);
  // Asia/Tashkent has a fixed +05:00 offset (no daylight saving).
  const candidate = new Date(`${clock.day}T${time.length === 4 ? `0${time}` : time}:00+05:00`);
  if (candidate.getTime() - now.getTime() > 5 * 60 * 1000) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return candidate.toISOString();
}
