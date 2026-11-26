import { db, type DbExec } from "@/db";
import { employeeAdvances, employees, payrollRecords, positions, users } from "@/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type {
  EmployeeAdvanceRecord,
  EmployeeLedger,
  EmployeeLedgerPeriod,
  PayoutKind,
  PayoutMethod,
  PayoutSource,
} from "@/components/documents/hr/types";
import { getCompanyIdByCode } from "./crmService";
import { postCashTransaction, resolveMoneyAccount, reverseCashTransaction } from "./cashJournalService";
import { CASH_CATEGORY } from "@/lib/finance/cashCategories";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreatePayoutInput {
  companyId: string;
  employeeId: string;
  amount: number;
  kind: PayoutKind;
  advanceDate: string; // YYYY-MM-DD
  period?: string; // YYYY-MM, defaults to the month of advanceDate
  paymentMethod?: PayoutMethod;
  /** Money account the payout leaves from; by default the cash desk (cash) or the card/bank account (card). */
  accountId?: string | null;
  currency?: string;
  note?: string | null;
  source: PayoutSource;
  createdByUserId?: string | null;
  telegram?: { chatId: string; messageId: number };
}

export interface CreatePayoutResult {
  id: string;
  warning?: string;
  payrollPaid?: boolean;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

export interface AdvanceLimitCheck {
  /** What the employee earns for the month: calculated pay (before advances) or, until then, the salary. */
  limit: number;
  /** Advances already recorded for the month plus `extra`. */
  total: number;
  /** How much the advances exceed the limit (0 when within). */
  over: number;
  currency: string;
  basis: "payroll" | "salary";
}

/** Advance control for one employee/month; `extra` is an amount not recorded yet (a draft). Null when no limit is known. */
export async function getAdvanceLimitCheck(
  exec: DbExec,
  employeeId: string,
  period: string,
  extra: number
): Promise<AdvanceLimitCheck | null> {
  const emp = await exec.query.employees.findFirst({ where: eq(employees.id, employeeId) });
  if (!emp) return null;
  const payroll = await exec.query.payrollRecords.findFirst({
    where: and(eq(payrollRecords.employeeId, emp.id), eq(payrollRecords.period, period)),
  });
  const [{ total }] = await exec
    .select({ total: sql<string>`coalesce(sum(${employeeAdvances.amount}), 0)` })
    .from(employeeAdvances)
    .where(
      and(
        eq(employeeAdvances.employeeId, emp.id),
        eq(employeeAdvances.period, period),
        eq(employeeAdvances.kind, "advance"),
        ne(employeeAdvances.status, "cancelled")
      )
    );
  const limit = payroll
    ? Number(payroll.grossPay) - Number(payroll.penaltyDeduction) - Number(payroll.carriedDebtIn)
    : Number(emp.baseSalary) || 0;
  if (!(limit > 0)) return null;
  const sum = Number(total) + extra;
  return {
    limit,
    total: sum,
    over: Math.max(0, sum - limit),
    currency: (emp.currency || "UZS").toUpperCase(),
    basis: payroll ? "payroll" : "salary",
  };
}

export function todayIso(): string {
  // Tashkent business day (UTC+5) — payouts are recorded in local time.
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

/** Inserts one payout inside an existing transaction (used by UI and the bot's batch confirm). */
export async function createPayoutTx(tx: Tx, input: CreatePayoutInput): Promise<CreatePayoutResult> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Summa noto'g'ri");
  if (!DATE_RE.test(input.advanceDate)) throw new Error("Sana noto'g'ri");
  const period = input.period || input.advanceDate.slice(0, 7);
  if (!PERIOD_RE.test(period)) throw new Error("Davr noto'g'ri");
  if (input.kind !== "advance" && input.kind !== "settlement") throw new Error("Tur noto'g'ri");

  const emp = await tx.query.employees.findFirst({
    where: and(eq(employees.id, input.employeeId), eq(employees.companyId, input.companyId)),
  });
  if (!emp) throw new Error("Hodim topilmadi");
  if (emp.status === "terminated" && input.kind === "advance") throw new Error(`${emp.fullName} ishdan bo'shatilgan`);

  const payroll = await tx.query.payrollRecords.findFirst({
    where: and(eq(payrollRecords.employeeId, emp.id), eq(payrollRecords.period, period)),
  });
  if (input.kind === "advance" && payroll?.status === "paid") {
    throw new Error(`${emp.fullName}: ${period} oyligi to'liq to'langan, avans yozib bo'lmaydi`);
  }
  if (input.kind === "advance" && payroll?.status === "approved") {
    throw new Error(`${emp.fullName}: ${period} oyi tasdiqlangan, avans yozib bo'lmaydi (faqat raschot)`);
  }

  const [row] = await tx
    .insert(employeeAdvances)
    .values({
      companyId: input.companyId,
      employeeId: emp.id,
      amount: String(amount),
      advanceDate: input.advanceDate,
      period,
      kind: input.kind,
      currency: (input.currency || emp.currency || "UZS").toUpperCase(),
      paymentMethod: input.paymentMethod || "cash",
      source: input.source,
      createdByUserId: input.createdByUserId ?? null,
      telegramChatId: input.telegram?.chatId ?? null,
      telegramMessageId: input.telegram?.messageId ?? null,
      notes: input.note?.trim() || null,
      status: "pending",
    })
    .returning({ id: employeeAdvances.id });

  // The money leaves the cash desk or a card in the same transaction as the payout itself.
  const isSettlement = input.kind === "settlement";
  const method = (input.paymentMethod || "cash") === "card" ? "corporate_card" : "cash";
  await postCashTransaction(tx, {
    companyId: input.companyId,
    date: input.advanceDate,
    direction: "out",
    categoryCode: isSettlement ? CASH_CATEGORY.PAYROLL_SETTLEMENT : CASH_CATEGORY.PAYROLL_ADVANCE,
    amount,
    currency: (input.currency || emp.currency || "UZS").toUpperCase(),
    accountId: await resolveMoneyAccount(tx, input.companyId, method, input.accountId),
    method,
    counterparty: { type: "employee", employeeId: emp.id, name: emp.fullName },
    sourceType: isSettlement ? "payroll_settlement" : "employee_advance",
    sourceId: row.id,
    sourceDocNo: period,
    note: input.note?.trim() || null,
    createdByUserId: input.createdByUserId ?? null,
  });

  const result: CreatePayoutResult = { id: row.id };

  if (input.kind === "advance") {
    // Control: advances of the month must not exceed what the employee earns (carried debt moves on otherwise).
    const check = await getAdvanceLimitCheck(tx, emp.id, period, 0);
    if (check && check.over > 0 && check.currency === (input.currency || emp.currency || "UZS").toUpperCase()) {
      result.warning = `${emp.fullName}: ${period} avanslari ${fmtMoney(check.total)} — oylikdan ${fmtMoney(check.over)} oshdi, keyingi oyga qarz bo'ladi`;
    }
  }

  if (input.kind === "settlement") {
    if (!payroll) {
      result.warning = `${emp.fullName}: ${period} oyligi hali hisoblanmagan`;
    } else {
      const [{ total }] = await tx
        .select({ total: sql<string>`coalesce(sum(${employeeAdvances.amount}), 0)` })
        .from(employeeAdvances)
        .where(
          and(
            eq(employeeAdvances.employeeId, emp.id),
            eq(employeeAdvances.period, period),
            eq(employeeAdvances.kind, "settlement"),
            ne(employeeAdvances.status, "cancelled")
          )
        );
      if (Number(total) >= Number(payroll.netPay) && payroll.status !== "paid") {
        await tx
          .update(payrollRecords)
          .set({
            status: "paid",
            paymentDate: input.advanceDate,
            paymentMethod: input.paymentMethod === "card" ? "bank_card" : "cash",
            updatedAt: new Date(),
          })
          .where(eq(payrollRecords.id, payroll.id));
        result.payrollPaid = true;
      }
    }
  }

  return result;
}

export async function createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
  return db.transaction((tx) => createPayoutTx(tx, input));
}

export async function cancelPayout(
  companyId: string,
  id: string,
  userId: string | null,
  reason?: string | null
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx.query.employeeAdvances.findFirst({
      where: and(eq(employeeAdvances.id, id), eq(employeeAdvances.companyId, companyId)),
    });
    if (!row) throw new Error("Yozuv topilmadi");
    if (row.status === "cancelled") return;

    await tx
      .update(employeeAdvances)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: userId,
        cancelReason: reason?.trim() || null,
      })
      .where(eq(employeeAdvances.id, id));

    await reverseCashTransaction(
      tx,
      companyId,
      row.kind === "settlement" ? "payroll_settlement" : "employee_advance",
      row.id,
      { userId, reason: reason?.trim() || "Bekor qilindi" }
    );

    // A cancelled raschot means the month is no longer fully paid out.
    if (row.kind === "settlement") {
      await tx
        .update(payrollRecords)
        .set({ status: "approved", paymentDate: null, updatedAt: new Date() })
        .where(
          and(
            eq(payrollRecords.employeeId, row.employeeId),
            eq(payrollRecords.period, row.period),
            eq(payrollRecords.status, "paid")
          )
        );
    }
  });
}

export async function listPayouts(filters: {
  companyCode?: string;
  companyId?: string;
  period?: string;
  employeeId?: string;
  kind?: PayoutKind;
}): Promise<EmployeeAdvanceRecord[]> {
  const companyId = filters.companyId ?? (await getCompanyIdByCode(filters.companyCode ?? "PRINTGOO"));

  const list = await db.query.employeeAdvances.findMany({
    where: and(
      eq(employeeAdvances.companyId, companyId),
      filters.period ? eq(employeeAdvances.period, filters.period) : undefined,
      filters.employeeId ? eq(employeeAdvances.employeeId, filters.employeeId) : undefined,
      filters.kind ? eq(employeeAdvances.kind, filters.kind) : undefined
    ),
    with: { employee: true },
    orderBy: [desc(employeeAdvances.advanceDate), desc(employeeAdvances.createdAt)],
  });

  const creatorIds = Array.from(new Set(list.map((a) => a.createdByUserId).filter((x): x is string => !!x)));
  const creators = creatorIds.length
    ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, creatorIds))
    : [];
  const creatorName = new Map(creators.map((u) => [u.id, u.fullName]));

  return list.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    employeeName: a.employee?.fullName || "",
    badgeNumber: a.employee?.badgeNumber || "",
    amount: Number(a.amount) || 0,
    advanceDate: a.advanceDate,
    period: a.period,
    status: a.status as EmployeeAdvanceRecord["status"],
    notes: a.notes,
    kind: a.kind as PayoutKind,
    currency: a.currency,
    paymentMethod: a.paymentMethod as PayoutMethod,
    source: a.source as PayoutSource,
    createdByName: a.createdByUserId ? creatorName.get(a.createdByUserId) ?? null : null,
    createdAt: a.createdAt.toISOString(),
    cancelledAt: a.cancelledAt ? a.cancelledAt.toISOString() : null,
    cancelReason: a.cancelReason,
  }));
}

/** Month-by-month pay account: accrued (payroll) vs. advances and raschot handed out. */
export async function getEmployeeLedger(employeeId: string, months = 12): Promise<EmployeeLedger> {
  const emp = await db.query.employees.findFirst({ where: eq(employees.id, employeeId) });
  if (!emp) throw new Error("Hodim topilmadi");

  const entries = await listPayouts({ companyId: emp.companyId, employeeId });
  const payrolls = await db.query.payrollRecords.findMany({
    where: eq(payrollRecords.employeeId, employeeId),
    orderBy: [desc(payrollRecords.period)],
  });

  const map = new Map<string, EmployeeLedgerPeriod>();
  const ensure = (period: string) => {
    let p = map.get(period);
    if (!p) {
      p = { period, accrued: null, advances: 0, settlements: 0, balance: null, carriedDebtIn: 0, payrollStatus: null };
      map.set(period, p);
    }
    return p;
  };
  ensure(todayIso().slice(0, 7));

  for (const pr of payrolls) {
    const p = ensure(pr.period);
    p.carriedDebtIn = Number(pr.carriedDebtIn) || 0;
    p.accrued = Number(pr.grossPay) - Number(pr.taxDeduction) - Number(pr.penaltyDeduction) - p.carriedDebtIn;
    p.payrollStatus = pr.status;
  }
  for (const e of entries) {
    if (e.status === "cancelled") continue;
    const p = ensure(e.period);
    if (e.kind === "settlement") p.settlements += e.amount;
    else p.advances += e.amount;
  }

  const periods = Array.from(map.values())
    .map((p) => ({ ...p, balance: p.accrued == null ? null : p.accrued - p.advances - p.settlements }))
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, months);

  return { employeeId, currency: emp.currency, periods, entries };
}

/** Totals for one employee/month — used by the bot to echo the new running total. */
export async function getPeriodSummary(employeeId: string, period: string) {
  const ledger = await getEmployeeLedger(employeeId, 36);
  return (
    ledger.periods.find((p) => p.period === period) ?? {
      period,
      accrued: null,
      advances: 0,
      settlements: 0,
      balance: null,
      carriedDebtIn: 0,
      payrollStatus: null,
    }
  );
}

export interface DirectoryEmployee {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  badgeNumber: string;
  position: string | null;
  currency: string;
}

const directoryCache = new Map<string, { at: number; list: DirectoryEmployee[] }>();

/** Non-terminated employees, compact enough to hand to the AI parser. Cached for 5 minutes. */
export async function getEmployeeDirectory(companyId: string): Promise<DirectoryEmployee[]> {
  const hit = directoryCache.get(companyId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.list;

  const rows = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      firstName: employees.firstName,
      lastName: employees.lastName,
      badgeNumber: employees.badgeNumber,
      position: positions.title,
      currency: employees.currency,
    })
    .from(employees)
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(and(eq(employees.companyId, companyId), ne(employees.status, "terminated")));

  directoryCache.set(companyId, { at: Date.now(), list: rows });
  return rows;
}

// ─── Name matching (lotin ↔ kirill, apostrophe variants) ─────────────────────

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", ў: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "x", ҳ: "h", ц: "s", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((c) => CYR_TO_LAT[c] ?? c)
    .join("")
    .replace(/[`'ʻʼ’‘]/g, "")
    .replace(/kh/g, "x")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best local matches for a name as the user wrote it (used when the AI is unsure). */
export function matchEmployees(query: string, directory: DirectoryEmployee[], limit = 4): DirectoryEmployee[] {
  const q = normalizeName(query);
  if (!q) return [];
  const tokens = q.split(" ").filter((t) => t.length >= 2);
  const scored = directory
    .map((e) => {
      const full = normalizeName(e.fullName);
      const words = full.split(" ");
      let score = 0;
      if (normalizeName(e.badgeNumber) === q) score += 100;
      if (full === q) score += 50;
      for (const t of tokens) {
        if (words.includes(t)) score += 10;
        // Uzbek suffixes: "Valiga", "Alidan" → stem prefix match
        else if (words.some((w) => w.length >= 3 && (t.startsWith(w) || w.startsWith(t)))) score += 6;
      }
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const top = scored[0].score;
  return scored.filter((x) => x.score >= top - 4).slice(0, limit).map((x) => x.e);
}
