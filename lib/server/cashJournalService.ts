import { db, type DbExec } from "@/db";
import { bankAccounts, cashCategories, cashTransactions, supplierOrders } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { CASH_CATEGORY, DEFAULT_CASH_CATEGORIES, type CashDirection } from "@/lib/finance/cashCategories";
import { getCompanyExchangeRate } from "./financeService";

export const DEFAULT_CASH_DESK_NAME = "Asosiy kassa";

export type CashMethod = "bank_transfer" | "cash" | "corporate_card" | "offset";
export type CashSourceType =
  | "employee_advance"
  | "payroll_settlement"
  | "supplier_payment"
  | "client_payment"
  | "supplier_order_delivery"
  | "expense"
  | "manual";

/**
 * Creates the built-in categories a company is missing. Existing rows are left as they are,
 * so a renamed category keeps its name. Returns category ids keyed by code.
 */
export async function ensureCashCategories(
  companyId: string,
  exec: DbExec = db
): Promise<Map<string, string>> {
  await exec
    .insert(cashCategories)
    .values(
      DEFAULT_CASH_CATEGORIES.map((c, i) => ({
        companyId,
        code: c.code,
        name: c.name,
        group: c.group,
        direction: c.direction,
        pnlType: c.pnlType,
        isSystem: c.isSystem,
        sortOrder: (i + 1) * 10,
      }))
    )
    .onConflictDoNothing({ target: [cashCategories.companyId, cashCategories.code] });

  const rows = await exec
    .select({ id: cashCategories.id, code: cashCategories.code })
    .from(cashCategories)
    .where(eq(cashCategories.companyId, companyId));
  return new Map(rows.map((r) => [r.code, r.id]));
}

/** Returns the company's cash desk, creating "Asosiy kassa" when it has none. */
export async function ensureDefaultCashDesk(companyId: string, exec: DbExec = db): Promise<string> {
  const [existing] = await exec
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.companyId, companyId), eq(bankAccounts.kind, "cash"), eq(bankAccounts.isActive, true)))
    .orderBy(desc(bankAccounts.isDefault), bankAccounts.createdAt)
    .limit(1);
  if (existing) return existing.id;

  const [created] = await exec
    .insert(bankAccounts)
    .values({ companyId, kind: "cash", name: DEFAULT_CASH_DESK_NAME, currency: "UZS" })
    .returning({ id: bankAccounts.id });
  return created.id;
}

/**
 * The money account a payment moves through. An explicit account must belong to the company;
 * otherwise cash goes to the cash desk, a card to the first card account (else the default bank),
 * a transfer to the default bank account. Offsets move no money and get no account.
 */
export async function resolveMoneyAccount(
  exec: DbExec,
  companyId: string,
  method: CashMethod,
  explicitId?: string | null
): Promise<string | null> {
  if (explicitId) {
    const acc = await exec.query.bankAccounts.findFirst({
      where: and(eq(bankAccounts.id, explicitId), eq(bankAccounts.companyId, companyId)),
      columns: { id: true, isActive: true, name: true },
    });
    if (!acc) throw new Error("Pul hisobi topilmadi");
    if (!acc.isActive) throw new Error(`${acc.name} hisobi yopilgan`);
    return acc.id;
  }
  if (method === "offset") return null;
  if (method === "cash") return ensureDefaultCashDesk(companyId, exec);

  const pick = async (kind: "bank" | "card") => {
    const [row] = await exec
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.companyId, companyId), eq(bankAccounts.kind, kind), eq(bankAccounts.isActive, true)))
      .orderBy(desc(bankAccounts.isDefault), bankAccounts.createdAt)
      .limit(1);
    return row?.id ?? null;
  };
  if (method === "corporate_card") return (await pick("card")) ?? (await pick("bank"));
  return pick("bank");
}

export interface PostCashInput {
  companyId: string;
  date: string; // YYYY-MM-DD
  direction: CashDirection;
  categoryCode: string;
  amount: number;
  currency?: string;
  exchangeRate?: number | null;
  /** Base-currency equivalent when the caller already knows it. */
  amountUzs?: number | null;
  accountId: string | null;
  method: CashMethod;
  counterparty?: {
    type: "employee" | "supplier" | "client" | "other";
    employeeId?: string | null;
    supplierId?: string | null;
    clientId?: string | null;
    name?: string | null;
  };
  workOrderId?: string | null;
  sourceType: CashSourceType;
  sourceId?: string | null;
  sourceDocNo?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
}

/** Moves the cached balance of an account, when the posting is in the account's currency. */
async function applyToBalance(exec: DbExec, accountId: string, currency: string, signed: number) {
  await exec
    .update(bankAccounts)
    .set({ balance: sql`${bankAccounts.balance} + ${signed.toFixed(2)}`, updatedAt: new Date() })
    .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.currency, currency)));
}

/**
 * Writes one movement of money. Call it inside the transaction that saves the source document.
 * A source that already has a live posting is left as it is (returns that posting's id).
 */
export async function postCashTransaction(exec: DbExec, input: PostCashInput): Promise<string> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Pul harakati summasi noto'g'ri");

  let cats = await exec
    .select({ id: cashCategories.id })
    .from(cashCategories)
    .where(and(eq(cashCategories.companyId, input.companyId), eq(cashCategories.code, input.categoryCode)))
    .limit(1);
  if (!cats.length) {
    const all = await ensureCashCategories(input.companyId, exec);
    const id = all.get(input.categoryCode);
    if (!id) throw new Error(`Modda topilmadi: ${input.categoryCode}`);
    cats = [{ id }];
  }

  const currency = (input.currency || "UZS").toUpperCase();
  const rate =
    currency === "UZS" ? null : Number(input.exchangeRate) || (await getCompanyExchangeRate(exec, input.companyId));
  const amountUzs = input.amountUzs ?? (rate ? amount * rate : amount);
  const cp = input.counterparty;

  const [row] = await exec
    .insert(cashTransactions)
    .values({
      companyId: input.companyId,
      date: input.date,
      direction: input.direction,
      accountId: input.accountId,
      categoryId: cats[0].id,
      amount: amount.toFixed(2),
      currency,
      exchangeRate: rate ? rate.toFixed(2) : null,
      amountUzs: Number(amountUzs).toFixed(2),
      method: input.method,
      counterpartyType: cp?.type ?? "other",
      employeeId: cp?.employeeId ?? null,
      supplierId: cp?.supplierId ?? null,
      clientId: cp?.clientId ?? null,
      counterpartyName: cp?.name ?? null,
      workOrderId: input.workOrderId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      sourceDocNo: input.sourceDocNo ?? null,
      note: input.note ?? null,
      createdByUserId: input.createdByUserId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: cashTransactions.id });

  if (!row) {
    const live = await findLivePosting(exec, input.companyId, input.sourceType, input.sourceId ?? null);
    if (!live) throw new Error("Pul harakatini yozib bo'lmadi");
    return live.id;
  }

  if (input.accountId) {
    await applyToBalance(exec, input.accountId, currency, input.direction === "in" ? amount : -amount);
  }
  return row.id;
}

async function findLivePosting(
  exec: DbExec,
  companyId: string,
  sourceType: string,
  sourceId: string | null
) {
  if (!sourceId) return null;
  return exec.query.cashTransactions.findFirst({
    where: and(
      eq(cashTransactions.companyId, companyId),
      eq(cashTransactions.sourceType, sourceType),
      eq(cashTransactions.sourceId, sourceId),
      eq(cashTransactions.status, "posted"),
      isNull(cashTransactions.reversalOfId)
    ),
  });
}

/** The live posting of a source document, if any. */
export function getLivePosting(exec: DbExec, companyId: string, sourceType: CashSourceType, sourceId: string) {
  return findLivePosting(exec, companyId, sourceType, sourceId);
}

/**
 * Cancels the live posting of a source document with a storno row (opposite direction, same
 * category and account) and marks the original reversed. No-op when nothing is posted.
 */
export async function reverseCashTransaction(
  exec: DbExec,
  companyId: string,
  sourceType: CashSourceType,
  sourceId: string,
  opts: { date?: string; userId?: string | null; reason?: string | null } = {}
): Promise<string | null> {
  const orig = await findLivePosting(exec, companyId, sourceType, sourceId);
  if (!orig) return null;

  const direction: CashDirection = orig.direction === "in" ? "out" : "in";
  const [storno] = await exec
    .insert(cashTransactions)
    .values({
      companyId,
      date: opts.date || new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10),
      direction,
      accountId: orig.accountId,
      categoryId: orig.categoryId,
      amount: orig.amount,
      currency: orig.currency,
      exchangeRate: orig.exchangeRate,
      amountUzs: orig.amountUzs,
      method: orig.method,
      counterpartyType: orig.counterpartyType,
      employeeId: orig.employeeId,
      supplierId: orig.supplierId,
      clientId: orig.clientId,
      counterpartyName: orig.counterpartyName,
      workOrderId: orig.workOrderId,
      sourceType: orig.sourceType,
      sourceId: orig.sourceId,
      sourceDocNo: orig.sourceDocNo,
      status: "posted",
      reversalOfId: orig.id,
      note: opts.reason?.trim() || "Storno",
      createdByUserId: opts.userId ?? null,
    })
    .returning({ id: cashTransactions.id });

  await exec.update(cashTransactions).set({ status: "reversed" }).where(eq(cashTransactions.id, orig.id));

  if (orig.accountId) {
    const amount = Number(orig.amount);
    await applyToBalance(exec, orig.accountId, orig.currency, direction === "in" ? amount : -amount);
  }
  return storno.id;
}

/**
 * Delivery we paid for ourselves (pickup) is not part of the supplier's debt, so it leaves the
 * cash desk as its own movement. Keeps that movement in line with the order: posted while the
 * order is Delivered with a pickup cost, re-posted when the cost changes, reversed otherwise.
 */
export async function syncPickupDeliveryCash(
  exec: DbExec,
  order: typeof supplierOrders.$inferSelect
): Promise<void> {
  const cost = Math.round((Number(order.deliveryCost) || 0) * 100) / 100;
  const currency = (order.currency || "UZS").toUpperCase();
  const wanted = order.status === "Delivered" && order.deliveryMethod === "pickup" && cost > 0;
  const live = await getLivePosting(exec, order.companyId, "supplier_order_delivery", order.id);

  if (live && wanted && Number(live.amount) === cost && live.currency === currency) return;
  if (live) {
    await reverseCashTransaction(exec, order.companyId, "supplier_order_delivery", order.id, {
      reason: wanted ? "Dostavka summasi o'zgardi" : "Dostavka bekor qilindi",
    });
  }
  if (!wanted) return;

  const received = order.receivedAt ?? new Date();
  await postCashTransaction(exec, {
    companyId: order.companyId,
    date: new Date(received.getTime() + 5 * 3600_000).toISOString().slice(0, 10),
    direction: "out",
    categoryCode: CASH_CATEGORY.DELIVERY_INBOUND,
    amount: cost,
    currency,
    accountId: await resolveMoneyAccount(exec, order.companyId, "cash"),
    method: "cash",
    counterparty: { type: "other", name: `Dostavka: ${order.orderNo}` },
    workOrderId: order.workOrderId,
    sourceType: "supplier_order_delivery",
    sourceId: order.id,
    sourceDocNo: order.orderNo,
  });
}
