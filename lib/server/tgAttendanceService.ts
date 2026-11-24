import { and, asc, eq, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { companies } from "@/db/schema/core";
import { attendanceLogs, employees, payrollRecords } from "@/db/schema/hr";
import { getCompanyIdByCode } from "./crmService";

/**
 * Daily roll call from the Telegram Mini App: a shift master marks who came,
 * which shift they worked and their overtime hours, for every employee of the
 * organisation the master's ERP user belongs to.
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
  /** "manual" = marked by a person, anything else = turnstile / device. */
  source: string | null;
  /** Month already approved in payroll: the mark cannot change. */
  locked: boolean;
}

export interface RollCallSheet {
  date: string;
  company: { id: string; name: string };
  rows: RollCallRow[];
}

export interface RollCallEntry {
  employeeId: string;
  /** null clears a mark made by a person. */
  status: RollCallStatus | null;
  shiftType: RollCallShift;
  overtimeHours: number;
}

function toShift(value: string | null | undefined): RollCallShift {
  return value?.toLowerCase().startsWith("night") ? "night" : "day";
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

  return { date, company, rows };
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

      const worked = e.status === "present" || e.status === "late";
      const values = {
        status: e.status,
        shiftType,
        sourceDevice: "manual",
        overtimeHours: String(worked ? overtime : 0),
        notes: note,
      };
      if (existing) {
        await tx
          .update(attendanceLogs)
          .set({
            ...values,
            workedHours: worked ? (Number(existing.workedHours) > 0 ? existing.workedHours : "8") : "0",
          })
          .where(eq(attendanceLogs.id, existing.id));
      } else {
        await tx.insert(attendanceLogs).values({
          companyId: company.id,
          employeeId: emp.id,
          workDate: date,
          workedHours: worked ? "8" : "0",
          ...values,
        });
      }
      saved++;
    }
  });

  return { saved, skipped };
}
