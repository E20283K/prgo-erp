/**
 * Bir martalik to'ldirish: mavjud pul harakatlarini yangi `cash_transactions` jurnaliga yozadi
 * va ombor kirimlarini ta'minotchiga FK orqali bog'laydi.
 *
 *   - supplier_payments (confirmed)         → chiqim, SUPPLIER_PAYMENT
 *   - client_payments (confirmed, offset emas) → kirim, CLIENT_PAYMENT
 *   - employee_advances (bekor qilinmagan)   → chiqim, PAYROLL_ADVANCE | PAYROLL_SETTLEMENT
 *   - supplier_orders (Delivered, pickup, dostavka > 0) → chiqim, DELIVERY_INBOUND
 *   - warehouse_receipts.supplier_id / supplier_order_id ← nom va PO raqami bo'yicha (faqat aniq bitta moslik)
 *
 * Naqd to'lovlar "Asosiy kassa"ga yoziladi; hisobi noma'lum karta/bank to'lovlari hisobsiz qoladi.
 * Qayta ishga tushirish xavfsiz: manba hujjat jurnalga bir marta tushadi.
 *
 *   npx tsx scripts/backfill-cash-journal.ts            # ko'rib chiqish
 *   npx tsx scripts/backfill-cash-journal.ts --apply    # bazaga yozish
 */
import "dotenv/config";
import { db, pgClient, type DbExec } from "@/db";
import { cashTransactions, warehouseReceipts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { CASH_CATEGORY } from "@/lib/finance/cashCategories";
import { ensureCashCategories, ensureDefaultCashDesk } from "@/lib/server/cashJournalService";
import { getCompanyExchangeRate } from "@/lib/server/financeService";

const APPLY = process.argv.includes("--apply");

type CashRow = typeof cashTransactions.$inferInsert;

class DryRun extends Error {}

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
const money = (n: number) => n.toFixed(2);
const toDate = (d: Date | string | null | undefined, fallback: string) => {
  if (!d) return fallback;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
};

export async function backfillCompany(tx: DbExec, companyId: string, companyCode: string) {
  const cats = await ensureCashCategories(companyId, tx);
  const cashDeskId = await ensureDefaultCashDesk(companyId, tx);
  const rate = await getCompanyExchangeRate(tx, companyId);
  const cat = (code: string) => {
    const id = cats.get(code);
    if (!id) throw new Error(`Modda topilmadi: ${code}`);
    return id;
  };
  const uzs = (amount: number, currency: string, r = rate) => (currency === "UZS" ? amount : amount * r);

  const rows: CashRow[] = [];

  // 1. Ta'minotchiga to'lovlar
  const sPays = await tx.query.supplierPayments.findMany({
    where: (t, { and, eq }) => and(eq(t.companyId, companyId), eq(t.status, "confirmed")),
  });
  for (const p of sPays) {
    if (p.method === "offset") continue;
    const amount = Number(p.amount) || 0;
    if (amount <= 0) continue;
    rows.push({
      companyId,
      date: toDate(p.date, p.createdAt.toISOString().slice(0, 10)),
      direction: "out",
      accountId: p.bankAccountId ?? (p.method === "cash" ? cashDeskId : null),
      categoryId: cat(CASH_CATEGORY.SUPPLIER_PAYMENT),
      amount: money(amount),
      currency: p.currency,
      exchangeRate: p.currency === "UZS" ? null : money(rate),
      amountUzs: money(uzs(amount, p.currency)),
      method: p.method,
      counterpartyType: "supplier",
      supplierId: p.supplierId,
      counterpartyName: p.supplierName,
      sourceType: "supplier_payment",
      sourceId: p.id,
      sourceDocNo: p.docNo,
      note: p.note,
      createdAt: p.createdAt,
    });
  }

  // 2. Mijoz to'lovlari
  const cPays = await tx.query.clientPayments.findMany({
    where: (t, { and, eq }) => and(eq(t.companyId, companyId), eq(t.status, "confirmed")),
  });
  for (const p of cPays) {
    if (p.method === "offset") continue;
    const isUzs = p.currency === "UZS";
    const amount = isUzs ? Number(p.amountUzs) || 0 : Number(p.amountUsd) || 0;
    if (amount <= 0) continue;
    const pRate = Number(p.exchangeRate) || rate;
    rows.push({
      companyId,
      date: toDate(p.date, p.createdAt.toISOString().slice(0, 10)),
      direction: "in",
      accountId: p.bankAccountId ?? (p.method === "cash" ? cashDeskId : null),
      categoryId: cat(CASH_CATEGORY.CLIENT_PAYMENT),
      amount: money(amount),
      currency: p.currency,
      exchangeRate: isUzs ? null : money(pRate),
      amountUzs: money(isUzs ? amount : Number(p.amountUzs) || amount * pRate),
      method: p.method,
      counterpartyType: "client",
      clientId: p.clientId,
      counterpartyName: p.customer,
      sourceType: "client_payment",
      sourceId: p.id,
      sourceDocNo: p.docNo,
      note: p.note,
      createdAt: p.createdAt,
    });
  }

  // 3. Avans va oylik raschet
  const payouts = await tx.query.employeeAdvances.findMany({
    where: (t, { and, eq, ne }) => and(eq(t.companyId, companyId), ne(t.status, "cancelled")),
    with: { employee: { columns: { fullName: true } } },
  });
  for (const a of payouts) {
    const amount = Number(a.amount) || 0;
    if (amount <= 0) continue;
    const isSettlement = a.kind === "settlement";
    const isCash = a.paymentMethod === "cash";
    rows.push({
      companyId,
      date: toDate(a.advanceDate, a.createdAt.toISOString().slice(0, 10)),
      direction: "out",
      accountId: isCash ? cashDeskId : null,
      categoryId: cat(isSettlement ? CASH_CATEGORY.PAYROLL_SETTLEMENT : CASH_CATEGORY.PAYROLL_ADVANCE),
      amount: money(amount),
      currency: a.currency,
      exchangeRate: a.currency === "UZS" ? null : money(rate),
      amountUzs: money(uzs(amount, a.currency)),
      method: isCash ? "cash" : "corporate_card",
      counterpartyType: "employee",
      employeeId: a.employeeId,
      counterpartyName: a.employee?.fullName ?? null,
      sourceType: isSettlement ? "payroll_settlement" : "employee_advance",
      sourceId: a.id,
      sourceDocNo: a.period,
      note: a.notes,
      createdByUserId: a.createdByUserId,
      createdAt: a.createdAt,
    });
  }

  // 4. O'zimiz olib kelgan buyurtmalar dostavkasi (ta'minotchi qarziga kirmaydi)
  const pickups = await tx.query.supplierOrders.findMany({
    where: (t, { and, eq }) =>
      and(eq(t.companyId, companyId), eq(t.status, "Delivered"), eq(t.deliveryMethod, "pickup")),
  });
  for (const o of pickups) {
    const amount = Number(o.deliveryCost) || 0;
    if (amount <= 0) continue;
    rows.push({
      companyId,
      date: toDate(o.receivedAt, toDate(o.orderDate, o.createdAt.toISOString().slice(0, 10))),
      direction: "out",
      accountId: null,
      categoryId: cat(CASH_CATEGORY.DELIVERY_INBOUND),
      amount: money(amount),
      currency: o.currency,
      exchangeRate: o.currency === "UZS" ? null : money(rate),
      amountUzs: money(uzs(amount, o.currency)),
      method: "cash",
      counterpartyType: "other",
      counterpartyName: `Dostavka: ${o.orderNo}`,
      workOrderId: o.workOrderId,
      sourceType: "supplier_order_delivery",
      sourceId: o.id,
      sourceDocNo: o.orderNo,
      createdAt: o.receivedAt ?? o.createdAt,
    });
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const res = await tx
      .insert(cashTransactions)
      .values(rows.slice(i, i + 200))
      .onConflictDoNothing()
      .returning({ id: cashTransactions.id });
    inserted += res.length;
  }

  // 5. Ombor kirimlarini ta'minotchiga bog'lash
  const allSuppliers = await tx.query.suppliers.findMany({
    where: (t, { eq }) => eq(t.companyId, companyId),
    columns: { id: true, name: true, legalName: true },
  });
  const byName = new Map<string, string[]>();
  for (const s of allSuppliers) {
    for (const key of new Set([norm(s.name), norm(s.legalName)])) {
      if (!key) continue;
      byName.set(key, [...(byName.get(key) || []), s.id]);
    }
  }
  const orders = await tx.query.supplierOrders.findMany({
    where: (t, { eq }) => eq(t.companyId, companyId),
    columns: { id: true, orderNo: true, supplierId: true },
  });
  const orderByNo = new Map(orders.map((o) => [norm(o.orderNo), o]));

  const receipts = await tx.query.warehouseReceipts.findMany({
    where: and(eq(warehouseReceipts.companyId, companyId), isNull(warehouseReceipts.supplierId)),
    columns: { id: true, supplierName: true, poNumber: true },
  });
  let linked = 0;
  const unmatched: string[] = [];
  for (const r of receipts) {
    const order = r.poNumber ? orderByNo.get(norm(r.poNumber)) : undefined;
    const candidates = byName.get(norm(r.supplierName)) || [];
    const supplierId = order?.supplierId ?? (candidates.length === 1 ? candidates[0] : null);
    if (!supplierId) {
      if (norm(r.supplierName)) unmatched.push(r.supplierName);
      continue;
    }
    await tx
      .update(warehouseReceipts)
      .set({ supplierId, supplierOrderId: order?.id ?? null })
      .where(eq(warehouseReceipts.id, r.id));
    linked++;
  }

  const count = (t: string) => rows.filter((r) => r.sourceType === t).length;
  console.log(`\n[${companyCode}]`);
  console.log(`  ta'minotchi to'lovlari: ${count("supplier_payment")}`);
  console.log(`  mijoz to'lovlari:       ${count("client_payment")}`);
  console.log(`  avanslar:               ${count("employee_advance")}`);
  console.log(`  oylik raschetlar:       ${count("payroll_settlement")}`);
  console.log(`  dostavka (pickup):      ${count("supplier_order_delivery")}`);
  console.log(`  hisobsiz qatorlar:      ${rows.filter((r) => !r.accountId).length}`);
  console.log(`  jurnalga yangi yozildi: ${inserted} / ${rows.length}`);
  console.log(`  ombor kirimi bog'landi: ${linked} / ${receipts.length}`);
  if (unmatched.length) {
    console.log(`  bog'lanmagan ta'minotchi nomlari: ${[...new Set(unmatched)].join(", ")}`);
  }
}

async function main() {
  const companies = await db.query.companies.findMany({ columns: { id: true, code: true } });
  console.log(APPLY ? "Rejim: --apply (bazaga yoziladi)" : "Rejim: ko'rib chiqish (hech narsa saqlanmaydi)");

  for (const c of companies) {
    try {
      await db.transaction(async (tx) => {
        await backfillCompany(tx, c.id, c.code);
        if (!APPLY) throw new DryRun();
      });
    } catch (e) {
      if (!(e instanceof DryRun)) throw e;
    }
  }
}

// Run only as a script, so tests can import backfillCompany.
if (/backfill-cash-journal\.ts$/.test(process.argv[1] || "")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pgClient.end());
}
