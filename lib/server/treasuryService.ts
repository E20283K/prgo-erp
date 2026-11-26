import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  bankAccounts,
  cashCategories,
  cashTransactions,
  deliveryActs,
  payrollRecords,
  supplierOrders,
} from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import type { CashDirection, CashCategoryGroup, PnlType } from "@/lib/finance/cashCategories";
import { ensureCashCategories, postCashTransaction, reverseCashTransaction, type CashMethod } from "./cashJournalService";
import { getCompanyExchangeRate } from "./financeService";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Documents posted by their own module; they are cancelled there, not from the journal. */
const MANUAL_SOURCES = new Set(["expense", "manual"]);

const num = (v: string | number | null | undefined) => Number(v) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Money accounts ───────────────────────────────────────────────────────────

export interface MoneyAccountRecord {
  id: string;
  kind: "bank" | "cash" | "card";
  name: string;
  bankName: string | null;
  accountNo: string | null;
  mfo: string | null;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  openingBalance: number;
  /** Opening balance + every journal movement on the account (in its currency). */
  balance: number;
  totalIn: number;
  totalOut: number;
  notes: string | null;
}

export async function listMoneyAccounts(companyId: string): Promise<MoneyAccountRecord[]> {
  const accounts = await db.query.bankAccounts.findMany({
    where: eq(bankAccounts.companyId, companyId),
    orderBy: [asc(bankAccounts.kind), desc(bankAccounts.isDefault), asc(bankAccounts.createdAt)],
  });
  const sums = await db
    .select({
      accountId: cashTransactions.accountId,
      currency: cashTransactions.currency,
      inSum: sql<string>`coalesce(sum(case when ${cashTransactions.direction} = 'in' then ${cashTransactions.amount} end), 0)`,
      outSum: sql<string>`coalesce(sum(case when ${cashTransactions.direction} = 'out' then ${cashTransactions.amount} end), 0)`,
    })
    .from(cashTransactions)
    .where(eq(cashTransactions.companyId, companyId))
    .groupBy(cashTransactions.accountId, cashTransactions.currency);

  return accounts.map((a) => {
    const own = sums.filter((s) => s.accountId === a.id && s.currency === a.currency);
    const totalIn = own.reduce((s, r) => s + num(r.inSum), 0);
    const totalOut = own.reduce((s, r) => s + num(r.outSum), 0);
    return {
      id: a.id,
      kind: a.kind,
      name: a.name,
      bankName: a.bankName,
      accountNo: a.accountNo,
      mfo: a.mfo,
      currency: a.currency,
      isDefault: a.isDefault,
      isActive: a.isActive,
      openingBalance: num(a.openingBalance),
      balance: round2(num(a.openingBalance) + totalIn - totalOut),
      totalIn: round2(totalIn),
      totalOut: round2(totalOut),
      notes: a.notes,
    };
  });
}

export interface MoneyAccountInput {
  id?: string;
  kind?: "bank" | "cash" | "card";
  name?: string;
  bankName?: string | null;
  accountNo?: string | null;
  mfo?: string | null;
  currency?: string;
  isDefault?: boolean;
  isActive?: boolean;
  openingBalance?: number;
  notes?: string | null;
}

export async function saveMoneyAccount(companyId: string, input: MoneyAccountInput): Promise<string> {
  return db.transaction(async (tx) => {
    const existing = input.id
      ? await tx.query.bankAccounts.findFirst({
          where: and(eq(bankAccounts.id, input.id), eq(bankAccounts.companyId, companyId)),
        })
      : null;
    if (input.id && !existing) throw new Error("Hisob topilmadi");

    const kind = input.kind ?? existing?.kind ?? "bank";
    const name = (input.name ?? existing?.name ?? "").trim();
    if (!name) throw new Error("Hisob nomi kiritilmagan");
    const accountNo = (input.accountNo ?? existing?.accountNo ?? "")?.trim() || null;
    if (kind === "bank" && !accountNo) throw new Error("Bank hisob raqami kiritilmagan");
    const currency = (input.currency ?? existing?.currency ?? "UZS").toUpperCase();
    if (existing && currency !== existing.currency) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(cashTransactions)
        .where(eq(cashTransactions.accountId, existing.id));
      if (n > 0) throw new Error("Harakat bo'lgan hisobning valyutasini o'zgartirib bo'lmaydi");
    }
    const opening = round2(Number(input.openingBalance ?? existing?.openingBalance ?? 0));
    if (!Number.isFinite(opening)) throw new Error("Boshlang'ich qoldiq noto'g'ri");

    const isDefault = input.isDefault ?? existing?.isDefault ?? false;
    if (isDefault) {
      // One default per kind and currency.
      await tx
        .update(bankAccounts)
        .set({ isDefault: false })
        .where(
          and(
            eq(bankAccounts.companyId, companyId),
            eq(bankAccounts.kind, kind),
            eq(bankAccounts.currency, currency),
            existing ? ne(bankAccounts.id, existing.id) : undefined
          )
        );
    }

    const values = {
      kind,
      name,
      bankName: kind === "bank" ? (input.bankName ?? existing?.bankName ?? null)?.trim() || null : null,
      accountNo,
      mfo: kind === "bank" ? (input.mfo ?? existing?.mfo ?? null)?.trim() || null : null,
      currency,
      isDefault,
      isActive: input.isActive ?? existing?.isActive ?? true,
      notes: input.notes !== undefined ? input.notes?.trim() || null : existing?.notes ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      const delta = opening - num(existing.openingBalance);
      await tx
        .update(bankAccounts)
        .set({
          ...values,
          openingBalance: opening.toFixed(2),
          balance: sql`${bankAccounts.balance} + ${delta.toFixed(2)}`,
        })
        .where(eq(bankAccounts.id, existing.id));
      return existing.id;
    }
    const [row] = await tx
      .insert(bankAccounts)
      .values({ companyId, ...values, openingBalance: opening.toFixed(2), balance: opening.toFixed(2) })
      .returning({ id: bankAccounts.id });
    return row.id;
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface CashCategoryRecord {
  id: string;
  code: string;
  name: string;
  group: string;
  direction: CashDirection;
  pnlType: PnlType;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export async function listCashCategories(companyId: string): Promise<CashCategoryRecord[]> {
  await ensureCashCategories(companyId);
  const rows = await db.query.cashCategories.findMany({
    where: eq(cashCategories.companyId, companyId),
    orderBy: [asc(cashCategories.direction), asc(cashCategories.sortOrder), asc(cashCategories.name)],
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    group: c.group,
    direction: c.direction,
    pnlType: c.pnlType,
    isSystem: c.isSystem,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
  }));
}

export interface CashCategoryInput {
  id?: string;
  name?: string;
  group?: CashCategoryGroup;
  direction?: CashDirection;
  pnlType?: PnlType;
  isActive?: boolean;
}

const MANUAL_PNL_TYPES: PnlType[] = ["revenue", "cogs", "expense", "capex"];

export async function saveCashCategory(companyId: string, input: CashCategoryInput): Promise<string> {
  const name = input.name?.trim();
  if (input.id) {
    const existing = await db.query.cashCategories.findFirst({
      where: and(eq(cashCategories.id, input.id), eq(cashCategories.companyId, companyId)),
    });
    if (!existing) throw new Error("Modda topilmadi");
    if (existing.isSystem && (input.direction || input.pnlType || input.isActive === false)) {
      throw new Error("Tizim moddasining turini o'zgartirib yoki o'chirib bo'lmaydi");
    }
    if (input.pnlType && !MANUAL_PNL_TYPES.includes(input.pnlType)) throw new Error("Modda turi noto'g'ri");
    await db
      .update(cashCategories)
      .set({
        name: name || existing.name,
        group: input.group ?? existing.group,
        direction: input.direction ?? existing.direction,
        pnlType: input.pnlType ?? existing.pnlType,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(cashCategories.id, existing.id));
    return existing.id;
  }

  if (!name) throw new Error("Modda nomi kiritilmagan");
  const direction = input.direction ?? "out";
  const pnlType = input.pnlType ?? (direction === "in" ? "revenue" : "expense");
  if (!MANUAL_PNL_TYPES.includes(pnlType)) throw new Error("Modda turi noto'g'ri");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cashCategories)
    .where(eq(cashCategories.companyId, companyId));
  const [row] = await db
    .insert(cashCategories)
    .values({
      companyId,
      code: `CUSTOM_${Date.now().toString(36).toUpperCase()}`,
      name,
      group: input.group ?? "other",
      direction,
      pnlType,
      isSystem: false,
      sortOrder: (n + 1) * 10 + 1000,
    })
    .returning({ id: cashCategories.id });
  return row.id;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export interface CashTransactionRecord {
  id: string;
  date: string;
  direction: CashDirection;
  accountId: string | null;
  accountName: string | null;
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  pnlType: PnlType;
  amount: number;
  currency: string;
  amountUzs: number;
  method: string;
  counterpartyType: string;
  counterpartyName: string | null;
  workOrderNo: string | null;
  sourceType: string;
  sourceDocNo: string | null;
  status: string;
  isReversal: boolean;
  /** Entered by hand in the journal: can be reversed from there. */
  isManual: boolean;
  note: string | null;
  createdAt: string;
}

export async function listCashTransactions(
  companyId: string,
  filters: { from?: string; to?: string; accountId?: string; direction?: CashDirection; categoryId?: string }
): Promise<CashTransactionRecord[]> {
  const rows = await db.query.cashTransactions.findMany({
    where: and(
      eq(cashTransactions.companyId, companyId),
      filters.from && DATE_RE.test(filters.from) ? gte(cashTransactions.date, filters.from) : undefined,
      filters.to && DATE_RE.test(filters.to) ? lte(cashTransactions.date, filters.to) : undefined,
      filters.accountId ? eq(cashTransactions.accountId, filters.accountId) : undefined,
      filters.direction ? eq(cashTransactions.direction, filters.direction) : undefined,
      filters.categoryId ? eq(cashTransactions.categoryId, filters.categoryId) : undefined
    ),
    with: {
      account: { columns: { name: true } },
      category: { columns: { name: true, code: true, pnlType: true } },
      workOrder: { columns: { docNo: true } },
    },
    orderBy: [desc(cashTransactions.date), desc(cashTransactions.createdAt)],
    limit: 5000,
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    direction: r.direction,
    accountId: r.accountId,
    accountName: r.account?.name ?? null,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    categoryCode: r.category.code,
    pnlType: r.category.pnlType,
    amount: num(r.amount),
    currency: r.currency,
    amountUzs: num(r.amountUzs),
    method: r.method,
    counterpartyType: r.counterpartyType,
    counterpartyName: r.counterpartyName,
    workOrderNo: r.workOrder?.docNo ?? null,
    sourceType: r.sourceType,
    sourceDocNo: r.sourceDocNo,
    status: r.status,
    isReversal: Boolean(r.reversalOfId),
    isManual: MANUAL_SOURCES.has(r.sourceType),
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface ManualCashEntryInput {
  date: string;
  categoryId: string;
  amount: number;
  currency?: string;
  exchangeRate?: number | null;
  accountId?: string | null;
  method?: CashMethod;
  counterpartyName?: string | null;
  supplierId?: string | null;
  workOrderId?: string | null;
  docNo?: string | null;
  note?: string | null;
}

/** A movement typed in by hand: an expense (rent, utilities, equipment...) or other income. */
export async function createManualCashEntry(
  companyId: string,
  input: ManualCashEntryInput,
  userId: string | null
): Promise<string> {
  if (!DATE_RE.test(input.date || "")) throw new Error("Sana noto'g'ri");
  const amount = round2(Number(input.amount));
  if (!(amount > 0)) throw new Error("Summa kiriting");
  const method: CashMethod = input.method ?? "cash";
  if (method === "offset") throw new Error("O'zaro hisob pul harakati emas");

  return db.transaction(async (tx) => {
    const cat = await tx.query.cashCategories.findFirst({
      where: and(eq(cashCategories.id, input.categoryId), eq(cashCategories.companyId, companyId)),
    });
    if (!cat) throw new Error("Modda topilmadi");
    if (cat.isSystem) throw new Error(`"${cat.name}" moddasi o'z modulidan yoziladi`);
    if (!cat.isActive) throw new Error(`"${cat.name}" moddasi o'chirilgan`);
    if (!input.accountId) throw new Error("Hisob tanlanmagan");

    const account = await tx.query.bankAccounts.findFirst({
      where: and(eq(bankAccounts.id, input.accountId), eq(bankAccounts.companyId, companyId)),
    });
    if (!account) throw new Error("Hisob topilmadi");
    if (!account.isActive) throw new Error(`${account.name} hisobi yopilgan`);

    let supplierName: string | null = null;
    if (input.supplierId) {
      const sup = await tx.query.suppliers.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, input.supplierId!), eq(t.companyId, companyId)),
        columns: { name: true },
      });
      if (!sup) throw new Error("Ta'minotchi topilmadi");
      supplierName = sup.name;
    }

    return postCashTransaction(tx, {
      companyId,
      date: input.date,
      direction: cat.direction,
      categoryCode: cat.code,
      amount,
      currency: input.currency || account.currency,
      exchangeRate: input.exchangeRate ?? null,
      accountId: account.id,
      method,
      counterparty: input.supplierId
        ? { type: "supplier", supplierId: input.supplierId, name: supplierName }
        : { type: "other", name: input.counterpartyName?.trim() || null },
      workOrderId: input.workOrderId || null,
      sourceType: cat.direction === "out" ? "expense" : "manual",
      // Own id, so the entry can be reversed through the same storno path as any document.
      sourceId: randomUUID(),
      sourceDocNo: input.docNo?.trim() || null,
      note: input.note?.trim() || null,
      createdByUserId: userId,
    });
  });
}

export async function reverseManualCashEntry(
  companyId: string,
  id: string,
  userId: string | null,
  reason?: string | null
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx.query.cashTransactions.findFirst({
      where: and(eq(cashTransactions.id, id), eq(cashTransactions.companyId, companyId)),
    });
    if (!row) throw new Error("Yozuv topilmadi");
    if (row.reversalOfId) throw new Error("Storno yozuvini qaytarib bo'lmaydi");
    if (row.status !== "posted") throw new Error("Yozuv allaqachon stornolangan");
    if (!MANUAL_SOURCES.has(row.sourceType) || !row.sourceId) {
      throw new Error("Bu yozuv o'z hujjatidan bekor qilinadi (avans, to'lov yoki buyurtma)");
    }
    await reverseCashTransaction(tx, companyId, row.sourceType as "expense" | "manual", row.sourceId, {
      userId,
      reason: reason?.trim() || "Storno",
    });
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface CashFlowRow {
  categoryId: string;
  categoryName: string;
  direction: CashDirection;
  pnlType: PnlType;
  /** Net amount in UZS per month "01".."12" (reversed postings and their storno cancel out). */
  months: Record<string, number>;
  total: number;
}

export interface CashFlowReport {
  year: number;
  rows: CashFlowRow[];
  inByMonth: Record<string, number>;
  outByMonth: Record<string, number>;
  /** Opening balance of all accounts (UZS) plus movements before the year. */
  openingUzs: number;
}

/** DDS (pul oqimlari): movements by category and month, in UZS. */
export async function getCashFlowReport(companyId: string, year: number): Promise<CashFlowReport> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const signed = sql<string>`sum(case when ${cashTransactions.direction} = 'in' then ${cashTransactions.amountUzs} else -${cashTransactions.amountUzs} end)`;

  const rows = await db
    .select({
      categoryId: cashTransactions.categoryId,
      month: sql<string>`to_char(${cashTransactions.date}, 'MM')`,
      total: signed,
    })
    .from(cashTransactions)
    .where(and(eq(cashTransactions.companyId, companyId), gte(cashTransactions.date, from), lte(cashTransactions.date, to)))
    .groupBy(cashTransactions.categoryId, sql`to_char(${cashTransactions.date}, 'MM')`);

  const [before] = await db
    .select({ total: signed })
    .from(cashTransactions)
    .where(and(eq(cashTransactions.companyId, companyId), sql`${cashTransactions.date} < ${from}`));
  const accounts = await db
    .select({ opening: bankAccounts.openingBalance, currency: bankAccounts.currency })
    .from(bankAccounts)
    .where(eq(bankAccounts.companyId, companyId));
  const openingUzs = accounts.filter((a) => a.currency === "UZS").reduce((s, a) => s + num(a.opening), 0) + num(before?.total);

  const cats = await listCashCategories(companyId);
  const byCat = new Map<string, CashFlowRow>();
  const inByMonth: Record<string, number> = {};
  const outByMonth: Record<string, number> = {};
  for (const r of rows) {
    const cat = cats.find((c) => c.id === r.categoryId);
    if (!cat) continue;
    const v = num(r.total);
    let row = byCat.get(cat.id);
    if (!row) {
      row = { categoryId: cat.id, categoryName: cat.name, direction: cat.direction, pnlType: cat.pnlType, months: {}, total: 0 };
      byCat.set(cat.id, row);
    }
    // Rows show their natural sign: income positive, spending positive in the outflow block.
    const shown = cat.direction === "in" ? v : -v;
    row.months[r.month] = round2((row.months[r.month] || 0) + shown);
    row.total = round2(row.total + shown);
    const bucket = cat.direction === "in" ? inByMonth : outByMonth;
    bucket[r.month] = round2((bucket[r.month] || 0) + shown);
  }

  const order = new Map(cats.map((c, i) => [c.id, i]));
  return {
    year,
    rows: [...byCat.values()].sort((a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0)),
    inByMonth,
    outByMonth,
    openingUzs: round2(openingUzs),
  };
}

export interface PnlLine {
  key: string;
  label: string;
  amount: number;
}

export interface PnlReport {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  revenue: PnlLine[];
  cogs: PnlLine[];
  opex: PnlLine[];
  capex: PnlLine[];
  totals: { revenue: number; cogs: number; grossProfit: number; opex: number; netProfit: number; capex: number };
}

const SUPPLIER_COST_LABELS: Record<string, string> = {
  die_tooling: "Shtamp va pichoq",
  ctp_plates: "CTP formalar",
  cliche: "Klishe",
  outsourcing: "Autsorsing",
  service: "Servis va ta'mirlash",
};

/**
 * Foyda va zarar (hisoblash asosida), UZS. Revenue: issued invoices without VAT. Costs: delivered
 * supplier orders (tooling, outsourcing, service), payroll accrued for the months, and journal
 * movements typed cogs/expense. Raw materials go to stock and are not a cost until consumed;
 * equipment is shown as capex, outside the profit line.
 */
export async function getPnlReport(companyId: string, fromMonth: string, toMonth: string): Promise<PnlReport> {
  if (!MONTH_RE.test(fromMonth) || !MONTH_RE.test(toMonth)) throw new Error("Davr noto'g'ri");
  if (fromMonth > toMonth) [fromMonth, toMonth] = [toMonth, fromMonth];
  const fromDate = `${fromMonth}-01`;
  const [ty, tm] = toMonth.split("-").map(Number);
  const toDate = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);
  const rate = await getCompanyExchangeRate(db, companyId);

  // 1. Daromad: schet-fakturalar (QQS'siz)
  const acts = await db
    .select({
      subtotalUzs: deliveryActs.subtotalUzs,
      subtotalUsd: deliveryActs.subtotalUsd,
      exchangeRate: deliveryActs.exchangeRate,
    })
    .from(deliveryActs)
    .where(
      and(
        eq(deliveryActs.companyId, companyId),
        ne(deliveryActs.status, "cancelled"),
        gte(deliveryActs.date, fromDate),
        lte(deliveryActs.date, toDate)
      )
    );
  const salesUzs = acts.reduce(
    (s, a) => s + (num(a.subtotalUzs) || num(a.subtotalUsd) * (num(a.exchangeRate) || rate)),
    0
  );

  // 2. Jurnaldagi daromad, tannarx, xarajat va kapital xarajat moddalari
  const journal = await db
    .select({
      name: cashCategories.name,
      code: cashCategories.code,
      pnlType: cashCategories.pnlType,
      total: sql<string>`sum(case when ${cashTransactions.direction} = 'in' then ${cashTransactions.amountUzs} else -${cashTransactions.amountUzs} end)`,
    })
    .from(cashTransactions)
    .innerJoin(cashCategories, eq(cashCategories.id, cashTransactions.categoryId))
    .where(
      and(
        eq(cashTransactions.companyId, companyId),
        gte(cashTransactions.date, fromDate),
        lte(cashTransactions.date, toDate),
        inArray(cashCategories.pnlType, ["revenue", "cogs", "expense", "capex"])
      )
    )
    .groupBy(cashCategories.name, cashCategories.code, cashCategories.pnlType, cashCategories.sortOrder)
    .orderBy(asc(cashCategories.sortOrder));

  // 3. Yetkazilgan ta'minotchi buyurtmalari (xizmat va qoliplar — tannarx, jihoz — kapital)
  const orders = await db
    .select({
      orderType: supplierOrders.orderType,
      amount: supplierOrders.amount,
      deliveryMethod: supplierOrders.deliveryMethod,
      deliveryCost: supplierOrders.deliveryCost,
      currency: supplierOrders.currency,
    })
    .from(supplierOrders)
    .where(
      and(
        eq(supplierOrders.companyId, companyId),
        eq(supplierOrders.status, "Delivered"),
        sql`(${supplierOrders.receivedAt} at time zone 'Asia/Tashkent')::date between ${fromDate} and ${toDate}`
      )
    );
  const supplierCost = new Map<string, number>();
  let equipmentUzs = 0;
  for (const o of orders) {
    if (o.orderType === "raw_materials") continue;
    const billedDelivery = o.deliveryMethod === "supplier" ? num(o.deliveryCost) : 0;
    const v = (num(o.amount) + billedDelivery) * (o.currency === "UZS" ? 1 : rate);
    if (o.orderType === "equipment") equipmentUzs += v;
    else supplierCost.set(o.orderType, (supplierCost.get(o.orderType) || 0) + v);
  }

  // 4. Ish haqi fondi: tasdiqlangan va to'langan oyliklar
  const [payroll] = await db
    .select({ gross: sql<string>`coalesce(sum(${payrollRecords.grossPay}), 0)` })
    .from(payrollRecords)
    .where(
      and(
        eq(payrollRecords.companyId, companyId),
        gte(payrollRecords.period, fromMonth),
        lte(payrollRecords.period, toMonth),
        inArray(payrollRecords.status, ["approved", "paid"])
      )
    );

  const revenue: PnlLine[] = [{ key: "sales", label: "Sotuv (schet-faktura)", amount: round2(salesUzs) }];
  const cogs: PnlLine[] = [...supplierCost.entries()].map(([k, v]) => ({
    key: `po_${k}`,
    label: SUPPLIER_COST_LABELS[k] ?? k,
    amount: round2(v),
  }));
  const opex: PnlLine[] = [{ key: "payroll", label: "Ish haqi fondi", amount: round2(num(payroll?.gross)) }];
  const capex: PnlLine[] = equipmentUzs ? [{ key: "po_equipment", label: "Jihoz (buyurtmalar)", amount: round2(equipmentUzs) }] : [];

  for (const j of journal) {
    const v = num(j.total);
    const line = { key: `cat_${j.code}`, label: j.name, amount: round2(j.pnlType === "revenue" ? v : -v) };
    if (!line.amount) continue;
    if (j.pnlType === "revenue") revenue.push(line);
    else if (j.pnlType === "cogs") cogs.push(line);
    else if (j.pnlType === "expense") opex.push(line);
    else capex.push(line);
  }

  const sum = (l: PnlLine[]) => round2(l.reduce((s, x) => s + x.amount, 0));
  const totals = {
    revenue: sum(revenue),
    cogs: sum(cogs),
    grossProfit: 0,
    opex: sum(opex),
    netProfit: 0,
    capex: sum(capex),
  };
  totals.grossProfit = round2(totals.revenue - totals.cogs);
  totals.netProfit = round2(totals.grossProfit - totals.opex);
  return { from: fromMonth, to: toMonth, revenue, cogs, opex, capex, totals };
}
