/**
 * Chiqim dvigateli integratsion testlari (P1).
 * Har bir ssenariy alohida tranzaksiyada ishlaydi va oxirida ROLLBACK qilinadi —
 * bazada hech qanday ma'lumot qolmaydi. Bildirishnomalar afterCommit'da bo'lgani uchun yuborilmaydi.
 *
 *   npx tsx scripts/test-shipment-flow.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pgClient, type DbExec } from "@/db";
import {
  clients,
  tradingCatalog,
  warehouseFinishedGoods,
  warehouseStockBalances,
  deliveryActs,
  warehouseShipments,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import { upsertWarehouseShipmentTx, type ShipmentTxContext } from "@/lib/server/warehouseService";
import { ShipmentError, assertTransition, phaseOf, resolveShipmentAccount } from "@/lib/server/shipmentEngine";

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

function unit(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Kutilgan xato: savepoint ichida bajariladi, tashqi tranzaksiya buzilmaydi */
async function expectShipmentError(tx: DbExec, fn: (sp: DbExec) => Promise<unknown>, pattern: RegExp, httpStatus?: number) {
  let caught: unknown = null;
  try {
    await tx.transaction(async (sp) => {
      await fn(sp);
    });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof ShipmentError, `ShipmentError kutilgan edi, keldi: ${String(caught)}`);
  assert.match((caught as ShipmentError).message, pattern);
  if (httpStatus) assert.equal((caught as ShipmentError).httpStatus, httpStatus);
}

interface Fixture {
  companyId: string;
  clientName: string;
  catalogId: string;
  catalogSku: string;
  fgId: string;
  fgSku: string;
  balanceId: string;
  matSku: string;
  location: string;
}

async function seed(tx: DbExec): Promise<Fixture> {
  const companyId = await getCompanyIdByCode("PRINTGOO");
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const clientName = `TEST MIJOZ ${tag}`;
  await tx.insert(clients).values({ companyId, code: `TST-${tag}`, name: clientName });
  const [cat] = await tx
    .insert(tradingCatalog)
    .values({ companyId, sku: `TST-ACC-${tag}`, name: "Test tugma", stockQty: "10" })
    .returning();
  const [fg] = await tx
    .insert(warehouseFinishedGoods)
    .values({
      companyId,
      customerName: clientName,
      workOrderId: `WO-TST-${tag}`,
      productName: "Test etiketka",
      sku: `TST-FG-${tag}`,
      quantity: "100",
      receiptStatus: "Received",
      locationName: "Tayyor mahsulotlar ombori",
    })
    .returning();
  const location = `TEST-WH-${tag}`;
  const [bal] = await tx
    .insert(warehouseStockBalances)
    .values({
      companyId,
      locationName: location,
      sku: `TST-MAT-${tag}`,
      name: "Test qog'oz",
      stockLevel: "50",
      available: "50",
      reorder: "1",
    })
    .returning();
  return {
    companyId,
    clientName,
    catalogId: cat.id,
    catalogSku: cat.sku,
    fgId: fg.id,
    fgSku: fg.sku,
    balanceId: bal.id,
    matSku: bal.sku,
    location,
  };
}

const ctx = (): ShipmentTxContext => ({ afterCommit: [], actor: { id: "test", name: "Test runner" } });

function shipment(f: Fixture, no: string, status: string, lines: { acc?: number; fg?: number; mat?: number }, extra: Record<string, unknown> = {}) {
  const items: Record<string, unknown>[] = [];
  if (lines.acc) items.push({ sku: f.catalogSku, name: "Test tugma", quantity: lines.acc, unitPrice: 1000, tradingCatalogId: f.catalogId, accountCode: "2910" });
  if (lines.fg) items.push({ sku: f.fgSku, name: "Test etiketka", quantity: lines.fg, unitPrice: 500, finishedGoodId: f.fgId, accountCode: "2810" });
  if (lines.mat) items.push({ sku: f.matSku, name: "Test qog'oz", quantity: lines.mat, unitPrice: 100, accountCode: "1010" });
  return {
    companyId: f.companyId,
    shipmentNumber: no,
    shipmentType: "CustomerDelivery",
    customer: f.clientName,
    fromLocationName: f.location,
    status,
    items,
    ...extra,
  };
}

async function catalogRow(tx: DbExec, id: string) {
  const [r] = await tx.select().from(tradingCatalog).where(eq(tradingCatalog.id, id));
  return { stock: Number(r.stockQty), reserved: Number(r.reservedQty) };
}
async function fgRow(tx: DbExec, id: string) {
  const [r] = await tx.select().from(warehouseFinishedGoods).where(eq(warehouseFinishedGoods.id, id));
  return { qty: Number(r.quantity), reserved: Number(r.reservedQuantity), status: r.status };
}
async function balRow(tx: DbExec, id: string) {
  const [r] = await tx.select().from(warehouseStockBalances).where(eq(warehouseStockBalances.id, id));
  return { level: Number(r.stockLevel), reserved: Number(r.reserved), available: Number(r.available) };
}

async function main() {
  // ── Unit: holat mashinasi ──
  unit("holat: Delivered yakuniy", () => {
    assert.throws(() => assertTransition("Delivered", "Packed"), ShipmentError);
  });
  unit("holat: Draft → Dispatched ruxsat", () => assertTransition("Draft", "Dispatched"));
  unit("holat: Cancelled → Draft ruxsat, Cancelled → Dispatched taqiq", () => {
    assertTransition("Cancelled", "Draft");
    assert.throws(() => assertTransition("Cancelled", "Dispatched"), ShipmentError);
  });
  unit("fazalar", () => {
    assert.equal(phaseOf("Reserved"), "holding");
    assert.equal(phaseOf("In Transit"), "posted");
    assert.equal(phaseOf("Cancelled"), "free");
  });
  unit("hisob tasnifi", () => {
    assert.equal(resolveShipmentAccount({ tradingCatalogId: "x" }, "CustomerDelivery"), "2910");
    assert.equal(resolveShipmentAccount({}, "MaterialSale"), "1010");
    assert.equal(resolveShipmentAccount({ accountCode: "1010", tradingCatalogId: "x" }, "CustomerDelivery"), "1010");
  });

  // ── Integratsion ──
  await scenario("rezerv: band qilish va ikkinchi chiqim rad etiladi", async (tx) => {
    const f = await seed(tx);
    await upsertWarehouseShipmentTx(tx, shipment(f, `TST-A-${f.catalogSku}`, "Reserved", { acc: 6, fg: 30, mat: 20 }), f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 10, reserved: 6 });
    assert.equal((await fgRow(tx, f.fgId)).reserved, 30);
    assert.deepEqual(await balRow(tx, f.balanceId), { level: 50, reserved: 20, available: 30 });

    await expectShipmentError(
      tx,
      (sp) => upsertWarehouseShipmentTx(sp, shipment(f, `TST-B-${f.catalogSku}`, "Reserved", { acc: 5 }), f.companyId, ctx()),
      /band qilib bo'lmadi.*bo'sh qoldiq 4/,
      409
    );
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 10, reserved: 6 }, "rad etilgan rezerv qoldiqni o'zgartirmasligi kerak");
  });

  await scenario("o'tkazish: rezervdan jo'natish, SF yaratiladi", async (tx) => {
    const f = await seed(tx);
    const no = `TST-C-${f.catalogSku}`;
    await upsertWarehouseShipmentTx(tx, shipment(f, no, "Packed", { acc: 6, fg: 30, mat: 20 }), f.companyId, ctx());
    const res = await upsertWarehouseShipmentTx(tx, { companyId: f.companyId, shipmentNumber: no, status: "Dispatched" }, f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 4, reserved: 0 });
    assert.deepEqual(await fgRow(tx, f.fgId), { qty: 70, reserved: 0, status: "In Stock" });
    assert.deepEqual(await balRow(tx, f.balanceId), { level: 30, reserved: 0, available: 30 });
    assert.ok(res.deliveryActId && /^SF-/.test(res.deliveryActId), `SF docNo kutilgan, keldi: ${res.deliveryActId}`);
    const [act] = await tx.select().from(deliveryActs).where(and(eq(deliveryActs.companyId, f.companyId), eq(deliveryActs.docNo, res.deliveryActId!)));
    assert.equal(act.status, "pending_signature");
    assert.equal(act.linkedShipmentId, res.shipment.id, "SF shipment UUID ga bog'lanishi kerak");
    assert.ok(res.shipment.clientId, "clientId aniqlanishi kerak");
  });

  await scenario("storno va qayta jo'natish: qoldiq bir marta, SF bitta", async (tx) => {
    const f = await seed(tx);
    const no = `TST-D-${f.catalogSku}`;
    const first = await upsertWarehouseShipmentTx(tx, shipment(f, no, "Dispatched", { acc: 6 }), f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 4, reserved: 0 });

    await upsertWarehouseShipmentTx(tx, { companyId: f.companyId, shipmentNumber: no, status: "Packed" }, f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 10, reserved: 6 }, "storno: qoldiq qaytadi va rezervga o'tadi");
    const [cancelled] = await tx.select().from(deliveryActs).where(eq(deliveryActs.docNo, first.deliveryActId!));
    assert.equal(cancelled.status, "cancelled");

    const again = await upsertWarehouseShipmentTx(tx, { companyId: f.companyId, shipmentNumber: no, status: "Dispatched" }, f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 4, reserved: 0 });
    assert.equal(again.deliveryActId, first.deliveryActId, "o'sha SF qayta faollashishi kerak");
    const acts = await tx.select().from(deliveryActs).where(eq(deliveryActs.linkedShipmentId, first.shipment.id));
    assert.equal(acts.length, 1);
    assert.equal(acts[0].status, "pending_signature");
  });

  await scenario("yetishmovchilik: hech narsa yozilmaydi", async (tx) => {
    const f = await seed(tx);
    const no = `TST-E-${f.catalogSku}`;
    await expectShipmentError(
      tx,
      (sp) => upsertWarehouseShipmentTx(sp, shipment(f, no, "Dispatched", { acc: 11, fg: 10 }), f.companyId, ctx()),
      /Qoldiq yetarli emas.*kerak 11, mavjud 10/,
      409
    );
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 10, reserved: 0 });
    assert.equal((await fgRow(tx, f.fgId)).qty, 100);
    const rows = await tx.select().from(warehouseShipments).where(eq(warehouseShipments.shipmentNumber, no));
    assert.equal(rows.length, 0, "chiqim hujjati ham yozilmasligi kerak");
  });

  await scenario("yetkazilgan chiqim stornolanmaydi", async (tx) => {
    const f = await seed(tx);
    const no = `TST-F-${f.catalogSku}`;
    await upsertWarehouseShipmentTx(tx, shipment(f, no, "Dispatched", { acc: 2 }), f.companyId, ctx());
    await upsertWarehouseShipmentTx(tx, { companyId: f.companyId, shipmentNumber: no, status: "Delivered" }, f.companyId, ctx());
    await expectShipmentError(
      tx,
      (sp) => upsertWarehouseShipmentTx(sp, { companyId: f.companyId, shipmentNumber: no, status: "Packed" }, f.companyId, ctx()),
      /o'tib bo'lmaydi/,
      409
    );
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 8, reserved: 0 });
  });

  await scenario("CRM'da yo'q mijoz: band qilish rad etiladi, qoralama ruxsat", async (tx) => {
    const f = await seed(tx);
    const draft = shipment(f, `TST-G-${f.catalogSku}`, "Draft", { acc: 1 }, { customer: "Noma'lum Mijoz XYZ" });
    await upsertWarehouseShipmentTx(tx, draft, f.companyId, ctx());
    await expectShipmentError(
      tx,
      (sp) => upsertWarehouseShipmentTx(sp, { ...draft, status: "Reserved" }, f.companyId, ctx()),
      /CRM bazasida topilmadi/
    );
  });

  await scenario("bekor qilish rezervni bo'shatadi", async (tx) => {
    const f = await seed(tx);
    const no = `TST-H-${f.catalogSku}`;
    await upsertWarehouseShipmentTx(tx, shipment(f, no, "Reserved", { acc: 3, fg: 5 }), f.companyId, ctx());
    await upsertWarehouseShipmentTx(tx, { companyId: f.companyId, shipmentNumber: no, status: "Cancelled" }, f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 10, reserved: 0 });
    assert.equal((await fgRow(tx, f.fgId)).reserved, 0);
    const [row] = await tx.select().from(warehouseShipments).where(eq(warehouseShipments.shipmentNumber, no));
    assert.ok(row.cancelledAt);
  });

  await scenario("rezervdagi qatorlarni o'zgartirish: eski rezerv bo'shab, yangisi qo'yiladi", async (tx) => {
    const f = await seed(tx);
    const no = `TST-I-${f.catalogSku}`;
    await upsertWarehouseShipmentTx(tx, shipment(f, no, "Reserved", { acc: 3 }), f.companyId, ctx());
    await upsertWarehouseShipmentTx(tx, shipment(f, no, "Reserved", { acc: 7 }), f.companyId, ctx());
    assert.deepEqual(await catalogRow(tx, f.catalogId), { stock: 10, reserved: 7 });
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
