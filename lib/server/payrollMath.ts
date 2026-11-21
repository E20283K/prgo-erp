/** Pure payroll arithmetic: no database, so it can be tested in isolation. */

/** Statuses that count as a paid working day on the timesheet. */
export const PAID_ATTENDANCE_STATUSES = ["present", "late", "vacation", "sick_leave"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Last calendar day of a "YYYY-MM" period as a day number (28..31). */
export function daysInPeriod(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Working days of a month for one employee: six-day week (Sunday off),
 * clipped to the employment window (hire date .. termination date).
 */
export function workingDaysInPeriod(period: string, hireDate?: string | null, terminationDate?: string | null): number {
  const [y, m] = period.split("-").map(Number);
  const last = daysInPeriod(period);
  const from = hireDate && DATE_RE.test(hireDate) && hireDate.slice(0, 7) === period ? Number(hireDate.slice(8, 10)) : 1;
  const to =
    terminationDate && DATE_RE.test(terminationDate) && terminationDate.slice(0, 7) === period
      ? Number(terminationDate.slice(8, 10))
      : last;
  // Employed outside this month entirely.
  if (hireDate && hireDate.slice(0, 7) > period) return 0;
  if (terminationDate && terminationDate.slice(0, 7) < period) return 0;
  let count = 0;
  for (let d = from; d <= to; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) count++;
  }
  return count;
}

export interface SalaryProration {
  amount: number;
  workedDays: number | null;
  workingDays: number;
}

/**
 * Salary prorated by the timesheet. `paidDates` is the set of distinct dates with a paid status.
 * Without any timesheet rows for the month the salary is paid in full (workedDays = null),
 * because an employee who is not tracked must not silently drop to zero.
 */
export function prorateSalary(baseSalary: number, workingDays: number, paidDates: string[], hasTimesheet: boolean): SalaryProration {
  if (!hasTimesheet || workingDays <= 0) {
    return { amount: Math.round(baseSalary), workedDays: null, workingDays };
  }
  const worked = Math.min(new Set(paidDates).size, workingDays);
  return { amount: Math.round((baseSalary * worked) / workingDays), workedDays: worked, workingDays };
}

export interface PayrollTotals {
  grossPay: number;
  /** Cash still owed to the employee after advances; never negative. */
  netPay: number;
  /** Advances beyond the month's pay: becomes debt in the next month. */
  carriedDebtOut: number;
  totalDeductions: number;
}

/**
 * gross = pay earned in the month. Deductions: penalties, advances already handed out and the debt
 * carried in from the previous month. A negative remainder is not lost — it moves on as debt.
 */
export function computeTotals(input: {
  gross: number;
  penalty: number;
  advances: number;
  carriedDebtIn: number;
  tax?: number;
}): PayrollTotals {
  const tax = input.tax ?? 0;
  const gross = Math.round(input.gross);
  const totalDeductions = Math.round(input.penalty + input.advances + input.carriedDebtIn + tax);
  const remainder = gross - totalDeductions;
  return {
    grossPay: gross,
    netPay: Math.max(0, remainder),
    carriedDebtOut: Math.max(0, -remainder),
    totalDeductions,
  };
}

/** Previous "YYYY-MM". */
export function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
