/**
 * Buyurtma zanjiri tekshiruvi: CRM → Production → Warehouse → Finance → HR.
 * Har bir ssenariy alohida tranzaksiyada ishlaydi va oxirida ROLLBACK qilinadi —
 * bazada hech qanday ma'lumot qolmaydi.
 *
 *   npx tsx scripts/verify-order-chain.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pgClient, type DbExec } from "@/db";
import {
  clients,
  clientPayments,
  clientSettlements,
  deliveryActs,
  deliveryActItems,
  employees,
  payrollRecords,
  pieceworkLogs,
  warehouseFinishedGoods,
  workOrders,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import {
  getAvailableFinishedGoodsForShipment,
  lookupBoxOrWorkOrderBarcode,
  upsertWarehouseShipmentTx,
  type ShipmentTxContext,
} from "@/lib/server/warehouseService";
import { recordPayment, syncClientSettlement, upsertDeliveryAct } from "@/lib/server/financeService";
import { getNextDeliveryActNumber, getCurrentYearSuffix } from "@/lib/server/numberingService";
import { calculatePeriodPayroll } from "@/lib/server/hrService";
import { ShipmentError } from "@/lib/server/shipmentEngine";

class Rollback extends Error {}

const results: { name: string; ok: boolean; error?: string }[] = [];

async function scenario(name: string, fn: (tx: DbExec) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
    results.push({ name, ok: true });
  } catch (e) {
    if (e instanceof Rollback) results.push({ name, ok: true });
    else results.push({ name, ok: false, error: e instanceof Error ? e.stack || e.message : String(e) });
  }
}

/** Kutilgan xato: savepoint ichida bajariladi, tashqi tranzaksiya buzilmaydi */
async function expectError(tx: DbExec, fn: (sp: DbExec) => Promise<unknown>, pattern: RegExp) {
  let caught: unknown = null;
  try {
    await tx.transaction(async (sp) => {
      await fn(sp);
    });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof Error, `Xato kutilgan edi, keldi: ${String(caught)}`);
  assert.match((caught as Error).message, pattern);
  return caught as Error;
}

const ctx = (): ShipmentTxContext => ({ afterCommit: [], actor: { id: "test", name: "Test runner" } });
const tagOf = () => randomUUID().slice(0, 8).toUpperCase();

interface OrderFixture {
  companyId: string;
  clientId: string;
  clientName: string;
  woNo: string;
  fgId: string;
  fgSku: string;
  boxCode: string;
}

/** Mijoz + narxlangan buyurtma + omborga qabul qilingan tayyor mahsulot (tannarxi sotuv narxidan past). */
async function seedOrder(
  tx: DbExec,
  currency: "USD" | "UZS",
  priceTotal: number,
  qty: number,
  unitCost: number
): Promise<OrderFixture> {
  const companyId = await getCompanyIdByCode("PRINTGOO");
  const tag = tagOf();
  const clientName = `TEST MIJOZ ${tag}`;
  const [client] = await tx
    .insert(clients)
    .values({ companyId, code: `TST-${tag}`, name: clientName, currency })
    .returning();
  const woNo = `WO-TST-${tag}`;
  const boxCode = `BX-TST-${tag}-01`;
  await tx.insert(workOrders).values({
    companyId,
    clientId: client.id,
    docNo: woNo,
    customerName: clientName,
    productName: "Test etiketka",
    quantity: String(qty),
    priceTotal: String(priceTotal),
    currency,
    status: "Active",
    stage: "Completed",
    packagingData: {
      boxes: [{ id: "b1", boxNumber: 1, boxCode, barcode: boxCode, quantity: qty, status: "in_stock" }],
    },
  });
  const fgSku = `FG-${woNo}`;
  const [fg] = await tx
    .insert(warehouseFinishedGoods)
    .values({
      companyId,
      clientId: client.id,
      customerName: clientName,
      workOrderId: woNo,
      productName: "Test etiketka",
      sku: fgSku,
      quantity: String(qty),
      costPricePerUnit: String(unitCost),
      receiptStatus: "Received",
      locationName: "Tayyor mahsulotlar ombori",
    })
    .returning();
  return { companyId, clientId: client.id, clientName, woNo, fgId: fg.id, fgSku, boxCode };
}

async function main() {
  // ── A1: narx — sotuv narxi, tannarx emas ──
  await scenario("A1 quti skaneri: narx buyurtmaning sotuv narxi, tannarx alohida", async (tx) => {
    const f = await seedOrder(tx, "USD", 1000, 100, 3);
    const byBox = await lookupBoxOrWorkOrderBarcode(f.boxCode, f.companyId, tx);
    assert.equal(byBox.found, true);
    assert.equal(byBox.unitPrice, 10, "narx = 1000 / 100");
    assert.equal(byBox.unitCost, 3);
    assert.equal(byBox.currency, "USD");
    const byOrder = await lookupBoxOrWorkOrderBarcode(f.woNo, f.companyId, tx);
    assert.equal(byOrder.unitPrice, 10);
    assert.equal(byOrder.currency, "USD");
  });

  await scenario("A1 tayyor mahsulot tanlash: narx buyurtmadan", async (tx) => {
    const f = await seedOrder(tx, "UZS", 500_000, 100, 3000);
    const list = await getAvailableFinishedGoodsForShipment(f.companyId, tx);
    const row = list.find((r) => r.id === f.fgId);
    assert.ok(row, "FG ro'yxatda bo'lishi kerak");
    assert.equal(row.unitPrice, 5000);
    assert.equal(row.unitCost, 3000);
    assert.equal(row.currency, "UZS");
  });

  // ── A2 + A3: akt valyutasi va QQS ──
  await scenario("A2/A3 chiqim → akt: buyurtma valyutasi, QQS 0 saqlanadi", async (tx) => {
    const f = await seedOrder(tx, "USD", 1000, 100, 3);
    const res = await upsertWarehouseShipmentTx(
      tx,
      {
        companyId: f.companyId,
        shipmentNumber: `TST-SHP-${f.woNo}`,
        status: "Dispatched",
        shipmentType: "CustomerDelivery",
        customerName: f.clientName,
        workOrderId: f.woNo,
        fromLocationName: "Tayyor mahsulotlar ombori",
        items: [
          { sku: f.fgSku, name: "Test etiketka", quantity: 40, unitPrice: 10, finishedGoodId: f.fgId, accountCode: "2810" },
        ],
      },
      f.companyId,
      ctx()
    );
    const [act] = await tx
      .select()
      .from(deliveryActs)
      .where(and(eq(deliveryActs.companyId, f.companyId), eq(deliveryActs.docNo, res.deliveryActId!)));
    assert.equal(act.currency, "USD", "akt buyurtma valyutasida");
    assert.equal(Number(act.totalAmountUsd), 400);
    assert.equal(Number(act.vatRate), 0, "QQS 0 → 12 bo'lib ketmasligi kerak");
    assert.equal(act.clientId, f.clientId);
    const items = await tx.select().from(deliveryActItems).where(eq(deliveryActItems.actId, act.id));
    assert.equal(Number(items[0].vatRate), 0);
    assert.equal(Number(items[0].unitPriceUsd), 10);
  });

  await scenario("A2 turli valyutali buyurtmalar bitta chiqimga tushmaydi", async (tx) => {
    const a = await seedOrder(tx, "USD", 1000, 100, 3);
    const b = await seedOrder(tx, "UZS", 500_000, 100, 3000);
    const err = await expectError(
      tx,
      (sp) =>
        upsertWarehouseShipmentTx(
          sp,
          {
            companyId: a.companyId,
            shipmentNumber: `TST-MIX-${a.woNo}`,
            status: "Dispatched",
            shipmentType: "CustomerDelivery",
            customerName: a.clientName,
            fromLocationName: "Tayyor mahsulotlar ombori",
            items: [
              { sku: a.fgSku, name: "A", quantity: 10, unitPrice: 10, finishedGoodId: a.fgId, accountCode: "2810", sourceWorkOrderId: a.woNo },
              { sku: b.fgSku, name: "B", quantity: 10, unitPrice: 5000, finishedGoodId: b.fgId, accountCode: "2810", sourceWorkOrderId: b.woNo },
            ],
          },
          a.companyId,
          ctx()
        ),
      /turli valyutada/
    );
    assert.ok(err instanceof ShipmentError);
  });

  // ── A4: akt raqami ──
  await scenario("A4 akt raqami: qo'lda yaratilgan akt hisobga olinadi, ustidan yozilmaydi", async (tx) => {
    const f = await seedOrder(tx, "UZS", 500_000, 100, 3000);
    const yy = getCurrentYearSuffix();
    const manualNo = `SF-${yy}-9000`;
    await upsertDeliveryAct(
      { id: manualNo, customer: f.clientName, clientId: f.clientId, totalAmount: 111_000, subtotal: 111_000, vatRate: 0, currency: "UZS" },
      f.companyId,
      { exec: tx, afterCommit: [] }
    );
    assert.equal(await getNextDeliveryActNumber(f.companyId, tx), `SF-${yy}-9001`);
    const created = await upsertDeliveryAct(
      { customer: f.clientName, clientId: f.clientId, totalAmount: 222_000, subtotal: 222_000, vatRate: 0, currency: "UZS" },
      f.companyId,
      { exec: tx, afterCommit: [] }
    );
    assert.equal(created.docNo, `SF-${yy}-9001`);
    const [manual] = await tx
      .select()
      .from(deliveryActs)
      .where(and(eq(deliveryActs.companyId, f.companyId), eq(deliveryActs.docNo, manualNo)));
    assert.equal(Number(manual.totalAmountUzs), 111_000, "birinchi akt o'zgarmagan bo'lishi kerak");
  });

  // ── A6 + A7: to'lov va balans ──
  await scenario("A6 to'lov: mijoz valyutasida, aktga bog'lanadi, noma'lum mijoz rad etiladi", async (tx) => {
    const f = await seedOrder(tx, "UZS", 500_000, 100, 3000);
    const act = await upsertDeliveryAct(
      { customer: f.clientName, clientId: f.clientId, totalAmount: 500_000, subtotal: 500_000, vatRate: 0, currency: "UZS" },
      f.companyId,
      { exec: tx, afterCommit: [] }
    );
    const before = await tx.select().from(clients).where(eq(clients.companyId, f.companyId));
    await expectError(
      tx,
      (sp) => recordPayment({ customer: `YO'Q MIJOZ ${tagOf()}`, amount: 1000 }, f.companyId, sp),
      /CRM bazasida topilmadi/
    );
    const after = await tx.select().from(clients).where(eq(clients.companyId, f.companyId));
    assert.equal(after.length, before.length, "yangi mijoz yaratilmasligi kerak");

    const res = await recordPayment(
      { customer: `  ${f.clientName.toLowerCase()} `, amount: 200_000, deliveryActId: act.docNo },
      f.companyId,
      tx
    );
    assert.equal(res.payment.currency, "UZS", "valyuta berilmasa mijoz valyutasi");
    assert.equal(Number(res.payment.amountUzs), 200_000);
    assert.equal(res.payment.deliveryActId, act.id);
    assert.equal(res.payment.clientId, f.clientId);

    const [st] = await tx.select().from(clientSettlements).where(eq(clientSettlements.clientId, f.clientId));
    assert.equal(Number(st.closingBalanceUzs), 300_000);
    assert.equal(st.status, "debt");
  });

  await scenario("A7 balans: boshlang'ich qoldiq va bekor qilingan to'lov", async (tx) => {
    const f = await seedOrder(tx, "UZS", 500_000, 100, 3000);
    await tx.insert(clientSettlements).values({
      companyId: f.companyId,
      clientId: f.clientId,
      customer: f.clientName,
      openingBalanceUzs: "100000",
      currency: "UZS",
    });
    const paid = await recordPayment({ customer: f.clientName, amount: 100_000 }, f.companyId, tx);
    let [st] = await tx.select().from(clientSettlements).where(eq(clientSettlements.clientId, f.clientId));
    assert.equal(Number(st.closingBalanceUzs), 0, "100 000 qarz − 100 000 to'lov");
    assert.equal(st.status, "settled");

    await tx.update(clientPayments).set({ status: "cancelled" }).where(eq(clientPayments.id, paid.payment.id));
    await syncClientSettlement(f.companyId, f.clientId, f.clientName, undefined, undefined, tx);
    [st] = await tx.select().from(clientSettlements).where(eq(clientSettlements.clientId, f.clientId));
    assert.equal(Number(st.closingBalanceUzs), 100_000, "bekor qilingan to'lov hisobga kirmaydi");
    assert.equal(st.status, "debt");
  });

  // ── A5: oylik ──
  await scenario("A5 oylik: faqat tasdiqlangan ishbay, to'langan oylik qayta ochilmaydi", async (tx) => {
    const companyId = await getCompanyIdByCode("PRINTGOO");
    const tag = tagOf();
    const period = "2019-03";
    const mkEmp = async (n: number) =>
      (
        await tx
          .insert(employees)
          .values({
            companyId,
            badgeNumber: `TST-${tag}-${n}`,
            firstName: "Test",
            lastName: `Xodim ${n}`,
            fullName: `Test Xodim ${n} ${tag}`,
            phone: "+998000000000",
            wageType: "piecework",
            baseSalary: "0",
            hireDate: "2019-01-01",
          })
          .returning()
      )[0];
    const worker = await mkEmp(1);
    const paidWorker = await mkEmp(2);
    const pw = (employeeId: string, amount: number, status: "draft" | "verified") => ({
      companyId,
      employeeId,
      workOrderId: `WO-TST-${tag}`,
      workDate: "2019-03-10",
      operationCode: "TST",
      operationName: "Test",
      completedQuantity: "1",
      pieceRate: String(amount),
      totalAmount: String(amount),
      status,
    });
    await tx
      .insert(pieceworkLogs)
      .values([pw(worker.id, 100_000, "verified"), pw(worker.id, 999_000, "draft"), pw(paidWorker.id, 50_000, "verified")]);
    await tx.insert(payrollRecords).values({
      companyId,
      period,
      employeeId: paidWorker.id,
      grossPay: "777",
      totalDeductions: "0",
      netPay: "777",
      status: "paid",
    });

    const res = await calculatePeriodPayroll(period, companyId, tx);
    assert.equal(res.success, true, res.error);
    const [rec] = await tx
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.employeeId, worker.id), eq(payrollRecords.period, period)));
    assert.equal(Number(rec.pieceworkAmount), 100_000, "qoralama ishbay oylikka kirmaydi");
    const [paidRec] = await tx
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.employeeId, paidWorker.id), eq(payrollRecords.period, period)));
    assert.equal(paidRec.status, "paid");
    assert.equal(Number(paidRec.grossPay), 777, "to'langan oylik o'zgarmaydi");
  });

  // ── Hisobot ──
  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
    if (!r.ok) {
      failed++;
      console.log(`      ${r.error}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} o'tdi`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
