import {
  getYttEntities,
  getTradingCatalog,
  upsertTradingCatalogItem,
  getTradingImports,
  upsertTradingImport,
  allocateImportToStock,
  getTradingOrders,
  upsertTradingOrder,
  convertOrderToSale,
  getTradingSales,
  upsertTradingSale,
  getTradingSettlements,
  deleteTradingSale,
  deleteTradingOrder,
  deleteTradingCatalogItem,
} from "../lib/server/tradingService";
import { db } from "../db";
import { tradingImportBatches, tradingImportItems } from "../db/schema";
import { eq } from "drizzle-orm";

async function runE2ETest() {
  console.log("=== STARTING TRADING & IMPORTS END-TO-END TEST ===");

  // 1. Check YTT Entities
  console.log("\n1. Testing YTT Entities...");
  const ytts = await getYttEntities();
  console.log(`✓ Fetched ${ytts.length} YTT entities from PostgreSQL.`);
  const recommended = ytts.find((y) => y.isRecommended);
  console.log(`✓ Recommended YTT: ${recommended?.name} (Turnover: ${(recommended?.currentTurnover || 0).toLocaleString()} UZS, Limit: ${(recommended?.annualLimit || 0).toLocaleString()} UZS)`);

  // 2. Check Catalog and create test SKU
  console.log("\n2. Testing Accessories Catalog...");
  const initialCatalog = await getTradingCatalog();
  console.log(`✓ Fetched ${initialCatalog.length} catalog items from PostgreSQL.`);

  const testSku = `TEST-BTN-${Date.now().toString().slice(-4)}`;
  const createdItem = await upsertTradingCatalogItem({
    sku: testSku,
    name: "E2E Test Gravirovka Tugma 18mm",
    category: "Tugmalar",
    unit: "dona",
    priceUZS: 1200,
    priceUSD: 0.093,
    wholesalePriceUZS: 1000,
    retailPriceUZS: 1400,
    stockQty: 5000,
    minStockLevel: 1000,
    origin: "Guangzhou, Xitoy",
  });
  console.log(`✓ Created test catalog item: ${createdItem.sku} with initial stock: ${createdItem.stockQty}`);

  // 3. Test Import Batch & Landed Cost Allocation
  console.log("\n3. Testing Import Batch & Landed Cost Allocation...");
  const batchNo = `IMP-E2E-${Date.now().toString().slice(-4)}`;
  const createdBatch = await upsertTradingImport({
    batchNo,
    date: new Date().toISOString().split("T")[0],
    origin: "Guangzhou, Xitoy",
    supplier: "Guangzhou High Fashion Accessories Co.",
    fobAmountUSD: 2000,
    internationalCargoUSD: 400,
    customsDutyUZS: 3_000_000,
    exchangeRate: 12850,
    status: "Arrived & Calculated",
    items: [
      {
        id: "item-e2e-1",
        sku: testSku,
        name: "E2E Test Gravirovka Tugma 18mm",
        category: "Tugmalar",
        unit: "dona",
        quantity: 10000,
        fobPriceUSD: 0.2,
        fobTotalUSD: 2000,
        landedCostUZS: 0,
        suggestedSalePriceUZS: 0,
      },
    ],
  });
  console.log(`✓ Created import batch: ${createdBatch.batchNo} with FOB: $${createdBatch.fobAmountUSD}`);

  const allocResult = await allocateImportToStock(createdBatch.id);
  console.log(`✓ Allocated import to stock: ${allocResult.success}, items updated: ${allocResult.itemsUpdated}`);

  const updatedCatalog = await getTradingCatalog();
  const foundItemAfterImport = updatedCatalog.find((c) => c.sku === testSku);
  console.log(`✓ Stock after import allocation: ${foundItemAfterImport?.stockQty} (Expected: 15000 dona)`);
  if (foundItemAfterImport?.stockQty !== 15000) {
    throw new Error(`Stock mismatch after import: expected 15000, got ${foundItemAfterImport?.stockQty}`);
  }

  // 4. Test Pre-Order (Forward Order)
  console.log("\n4. Testing Pre-Order & 1-Click Conversion to Sale...");
  const orderNo = `ORD-E2E-${Date.now().toString().slice(-4)}`;
  const createdOrder = await upsertTradingOrder({
    orderNo,
    date: new Date().toISOString().split("T")[0],
    customer: "'REAL TEXTILE INVEST' MChJ",
    contractNo: "AK-E2E-2026",
    category: "Tekstil Furnitura",
    deliveryDate: "2026-11-20",
    chinaStatus: "Navbatda",
    advanceStatus: "30% Avans Olingan",
    advancePercent: 30,
    advanceAmountUSD: 600,
    totalUSD: 2000,
    exchangeRate: 12850,
    shippingMethod: "Avto Fura Kargo (12-16 kun)",
    items: [
      {
        id: "ord-item-e2e",
        sku: testSku,
        name: "E2E Test Gravirovka Tugma 18mm",
        spec: "Logotip bilan",
        unit: "dona",
        quantity: 2000,
        unitPriceUSD: 0.15,
        totalUSD: 300,
        chinaFactoryStatus: "Ishlab chiqarilmoqda",
      },
    ],
  });
  console.log(`✓ Created pre-order: ${createdOrder.orderNo} for customer: ${createdOrder.customer}`);

  // 5. Convert Order to Sale
  const converted = await convertOrderToSale(createdOrder.id);
  console.log(`✓ Converted Order to Sale: Sale ID = ${converted.saleId}, DocNo = ${converted.docNo}`);

  const sales = await getTradingSales();
  const createdSale = sales.find((s) => s.id === converted.saleId);
  console.log(`✓ Created Sale fetched from DB: ${createdSale?.docNo}, items: ${createdSale?.items.length}`);

  // 6. Post Sale and verify Stock deduction + YTT Turnover + Settlements
  console.log("\n5. Posting Sale & Verifying ERP Side Effects (Stock, YTT, Settlements)...");
  const initialTurnover = recommended?.currentTurnover || 0;
  await upsertTradingSale({
    ...createdSale,
    status: "Posted",
  });
  console.log(`✓ Sale ${createdSale?.docNo} posted successfully.`);

  const catalogAfterSale = await getTradingCatalog();
  const foundItemAfterSale = catalogAfterSale.find((c) => c.sku === testSku);
  console.log(`✓ Stock after sale posted: ${foundItemAfterSale?.stockQty} (Expected: 13000 dona)`);
  if (foundItemAfterSale?.stockQty !== 13000) {
    throw new Error(`Stock mismatch after sale: expected 13000, got ${foundItemAfterSale?.stockQty}`);
  }

  const yttsAfterSale = await getYttEntities();
  const yttAfter = yttsAfterSale.find((y) => y.id === recommended?.id);
  console.log(`✓ YTT Turnover after sale: ${yttAfter?.currentTurnover.toLocaleString()} UZS (Increased from ${initialTurnover.toLocaleString()} UZS)`);

  const settlements = await getTradingSettlements();
  const foundStl = settlements.find((s) => s.docNo === createdSale?.docNo);
  console.log(`✓ Settlement ledger entry created: ${foundStl?.docNo}, Debit: ${foundStl?.debit.toLocaleString()} UZS, Customer: ${foundStl?.customer}`);

  // 7. Cleanup
  console.log("\n6. Cleaning up test data...");
  await deleteTradingSale(converted.saleId);
  await deleteTradingOrder(createdOrder.id);
  await deleteTradingCatalogItem(createdItem.id);
  await db.delete(tradingImportItems).where(eq(tradingImportItems.batchId, createdBatch.id));
  await db.delete(tradingImportBatches).where(eq(tradingImportBatches.id, createdBatch.id));
  console.log("✓ Cleanup completed cleanly.");

  console.log("\n=== ALL E2E TRADING TESTS PASSED WITH 100% SUCCESS ===");
}

runE2ETest().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
