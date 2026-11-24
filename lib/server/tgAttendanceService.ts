import { and, asc, eq, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { companies } from "@/db/schema/core";
import { attendanceLogs, employees, payrollRecords, shifts } from "@/db/schema/hr";
import { getCompanyIdByCode } from "./crmService";
import {
  DEFAULT_SHIFT_WINDOWS,
  LATE_THRESHOLD_MIN,
  isClockTime,
  plantTime,
  shiftTimeFacts,
  timelineToDate,
  type ShiftWindow,
} from "@/lib/rollCallTime";

/**
 * Daily roll call from the Telegram Mini App: a shift master marks who came,
 * which shift they worked and their overtime hours, for every employee of the
 * organisation the master's ERP user belongs to. Arrival and departure times are
 * recorded only: they do not change salaried pay (see lib/rollCallTime.ts).
 */

export type RollCallStatus = "present" | "late" | "absent" | "sick_leave" | "vacation" | "day_off";
export type RollCallShift = "day" | "night";

const STATUSES: RollCallStatus[] = ["present", "late", "absent", "sick_leave", "vacation", "day_off"];
const MAX_OVERTIME_HOURS = 16;

export interface RollCallRow {
  employeeId: string;
  fullName: string;
  badgeNumber: string;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
  defaultShift: RollCallShift;
  /** Current mark for the day, null when nobody marked the employee yet. */
  status: RollCallStatus | null;
  shiftType: RollCallShift | null;
  overtimeHours: number;
  /** Plant wall-clock "HH:MM", null when not recorded. */
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  delayMinutes: number;
  /** "manual" = marked by a person, anything else = turnstile / device. */
  source: string | null;
  /** Month already approved in payroll: the mark cannot change. */
  locked: boolean;
}

export interface RollCallSheet {
  date: string;
  company: { id: string; name: string };
  shifts: Record<RollCallShift, ShiftWindow>;
  rows: RollCallRow[];
}

export interface RollCallEntry {
  employeeId: string;
  /** null clears a mark made by a person. */
  status: RollCallStatus | null;
  shiftType: RollCallShift;
  overtimeHours: number;
  /** "HH:MM" sets the time, null clears it, omitted keeps what is stored. */
  checkIn?: string | null;
  checkOut?: string | null;
}

function toShift(value: string | null | undefined): RollCallShift {
  return value?.toLowerCase().startsWith("night") ? "night" : "day";
}

/** Working hours of the company's day and night shifts (first active one of each type). */
export async function getShiftWindows(companyId: string): Promise<Record<RollCallShift, ShiftWindow>> {
  const rows = await db.query.shifts.findMany({
    where: and(eq(shifts.companyId, companyId), eq(shifts.isActive, true)),
    orderBy: [asc(shifts.startTime)],
  });
  const pick = (type: RollCallShift): ShiftWindow => {
    const row = rows.find((r) => r.shiftType === type && isClockTime(r.startTime) && isClockTime(r.endTime));
    return row ? { start: row.startTime, end: row.endTime } : DEFAULT_SHIFT_WINDOWS[type];
  };
  return { day: pick("day"), night: pick("night") };
}

/** Organisation the user is attached to; users without one (global admins) act for the default company. */
export async function resolveUserCompany(userId: string): Promise<{ id: string; name: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { companyId: true } });
  const companyId = user?.companyId ?? (await getCompanyIdByCode("PRINTGOO"));
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
    columns: { id: true, name: true },
  });
  return { id: companyId, name: company?.name ?? "" };
}

async function lockedEmployees(employeeIds: string[], period: string): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set();
  const rows = await db
    .select({ employeeId: payrollRecords.employeeId, status: payrollRecords.status })
    .from(payrollRecords)
    .where(and(inArray(payrollRecords.employeeId, employeeIds), eq(payrollRecords.period, period)));
  return new Set(rows.filter((r) => r.status === "approved" || r.status === "paid").map((r) => r.employeeId));
}

export async function getRollCallSheet(userId: string, date: string): Promise<RollCallSheet> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Sana noto'g'ri");
  const company = await resolveUserCompany(userId);

  const staff = await db.query.employees.findMany({
    where: and(
      eq(employees.companyId, company.id),
      ne(employees.status, "terminated"),
      lte(employees.hireDate, date)
    ),
    with: { department: true, position: true },
    orderBy: [asc(employees.fullName)],
  });
  const active = staff.filter((e) => !e.terminationDate || e.terminationDate >= date);
  const ids = active.map((e) => e.id);

  const logs = ids.length
    ? await db.query.attendanceLogs.findMany({
        where: and(eq(attendanceLogs.companyId, company.id), eq(attendanceLogs.workDate, date), inArray(attendanceLogs.employeeId, ids)),
      })
    : [];
  const logByEmployee = new Map(logs.map((l) => [l.employeeId, l]));
  const locked = await lockedEmployees(ids, date.slice(0, 7));
  const shiftWindows = await getShiftWindows(company.id);

  const rows: RollCallRow[] = active.map((e) => {
    const log = logByEmployee.get(e.id);
    return {
      employeeId: e.id,
      fullName: e.fullName,
      badgeNumber: e.badgeNumber,
      position: e.position?.title ?? null,
      department: e.department?.name ?? null,
      avatarUrl: e.avatarUrl ?? null,
      defaultShift: toShift(e.currentShift),
      status: (log?.status as RollCallStatus | undefined) ?? null,
      shiftType: log ? toShift(log.shiftType) : null,
      overtimeHours: Number(log?.overtimeHours) || 0,
      checkIn: log?.checkIn ? plantTime(log.checkIn) : null,
      checkOut: log?.checkOut ? plantTime(log.checkOut) : null,
      workedHours: Number(log?.workedHours) || 0,
      delayMinutes: log?.delayMinutes ?? 0,
      source: log?.sourceDevice ?? null,
      locked: locked.has(e.id),
    };
  });
  // By department (employees without one last), then by name.
  rows.sort(
    (a, b) =>
      Number(!a.department) - Number(!b.department) ||
      (a.department ?? "").localeCompare(b.department ?? "") ||
      a.fullName.localeCompare(b.fullName)
  );

  return { date, company, shifts: shiftWindows, rows };
}

export async function saveRollCall(
  userId: string,
  actorName: string,
  date: string,
  entries: RollCallEntry[]
): Promise<{ saved: number; skipped: { employeeId: string; reason: string }[] }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Sana noto'g'ri");
  const company = await resolveUserCompany(userId);
  const skipped: { employeeId: string; reason: string }[] = [];
  let saved = 0;

  const ids = [...new Set(entries.map((e) => e.employeeId))];
  const locked = await lockedEmployees(ids, date.slice(0, 7));
  const shiftWindows = await getShiftWindows(company.id);
  const note = `Telegram orqali belgilandi (${actorName})`;

  await db.transaction(async (tx) => {
    for (const e of entries) {
      const skip = (reason: string) => skipped.push({ employeeId: e.employeeId, reason });
      if (e.status !== null && !STATUSES.includes(e.status)) { skip("Holat noto'g'ri"); continue; }
      const shiftType: RollCallShift = e.shiftType === "night" ? "night" : "day";
      const overtime = Math.round(Math.min(Math.max(Number(e.overtimeHours) || 0, 0), MAX_OVERTIME_HOURS) * 2) / 2;

      const emp = await tx.query.employees.findFirst({
        where: and(eq(employees.id, e.employeeId), eq(employees.companyId, company.id)),
      });
      if (!emp) { skip("Hodim topilmadi"); continue; }
      if (date < emp.hireDate) { skip("Ishga kirishdan oldingi sana"); continue; }
      if (locked.has(emp.id)) { skip(`${date.slice(0, 7)} oyi tasdiqlangan`); continue; }

      const existing = await tx.query.attendanceLogs.findFirst({
        where: and(eq(attendanceLogs.employeeId, emp.id), eq(attendanceLogs.workDate, date)),
      });

      if (e.status === null) {
        if (existing?.sourceDevice === "manual") {
          await tx.delete(attendanceLogs).where(eq(attendanceLogs.id, existing.id));
          saved++;
        } else if (existing) {
          skip("Turniket yozuvini o'chirib bo'lmaydi");
        }
        continue;
      }

      if ((e.checkIn != null && !isClockTime(e.checkIn)) || (e.checkOut != null && !isClockTime(e.checkOut))) {
        skip("Vaqt noto'g'ri");
        continue;
      }
      const worked = e.status === "present" || e.status === "late";
      let status: RollCallStatus = e.status;

      // Times: a new value is placed on the shift timeline; omitted keeps the stored one.
      const timeGiven = e.checkIn !== undefined || e.checkOut !== undefined;
      const nextIn = e.checkIn !== undefined ? e.checkIn : existing?.checkIn ? plantTime(existing.checkIn) : null;
      const nextOut = e.checkOut !== undefined ? e.checkOut : existing?.checkOut ? plantTime(existing.checkOut) : null;
      let timeValues: Partial<typeof attendanceLogs.$inferInsert> = {};
      let timedHours: string | null = null;
      if (worked && timeGiven) {
        if (nextIn || nextOut) {
          const facts = shiftTimeFacts(shiftWindows[shiftType], nextIn, nextOut);
          timeValues = {
            checkIn: nextIn ? timelineToDate(date, facts.inMin) : null,
            checkOut: nextOut ? timelineToDate(date, facts.outMin) : null,
            delayMinutes: facts.delayMinutes,
          };
          timedHours = String(facts.workedHours);
          if (status === "present" && facts.delayMinutes > LATE_THRESHOLD_MIN) status = "late";
        } else {
          timeValues = { checkIn: null, checkOut: null, delayMinutes: 0 };
          timedHours = "8";
        }
      } else if (!worked) {
        timeValues = { checkIn: null, checkOut: null, delayMinutes: 0 };
      }

      const values = {
        status,
        shiftType,
        sourceDevice: "manual",
        overtimeHours: String(worked ? overtime : 0),
        notes: note,
        ...timeValues,
      };
      if (existing) {
        const keptHours = Number(existing.workedHours) > 0 ? existing.workedHours : "8";
        await tx
          .update(attendanceLogs)
          .set({ ...values, workedHours: worked ? (timedHours ?? keptHours) : "0" })
          .where(eq(attendanceLogs.id, existing.id));
      } else {
        await tx.insert(attendanceLogs).values({
          companyId: company.id,
          employeeId: emp.id,
          workDate: date,
          workedHours: worked ? (timedHours ?? "8") : "0",
          ...values,
        });
      }
      saved++;
    }
  });

  return { saved, skipped };
}
