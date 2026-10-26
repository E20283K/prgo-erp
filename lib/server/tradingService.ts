import { db } from "@/db";
import {
  tradingYttEntities,
  tradingSales,
  tradingSaleItems,
  tradingOrders,
  tradingOrderItems,
  tradingImportBatches,
  tradingImportItems,
  tradingCatalog,
  tradingSettlements,
  companies,
  clients,
} from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import type {
  TradingSaleRecord,
  TradingSaleItem,
  YttTurnoverLimitRecord,
  TradingImportBatchRecord,
  ImportBatchItem,
  TradingCatalogItemRecord,
  TradingSettlementLedgerEntry,
  TradingOrderRecord,
  TradingOrderItem,
} from "@/components/documents/trading/types";
import {
  INITIAL_YTT_ENTITIES,
  INITIAL_TRADING_SALES,
  INITIAL_IMPORT_BATCHES,
  INITIAL_SETTLEMENT_LEDGERS,
  INITIAL_TRADING_CATALOG,
} from "@/components/documents/trading/data";

// ─── Company Resolver ──────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(id?: string | null): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

async function resolveCompanyId(companyCode = "PRINTGOO"): Promise<string> {
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.code, companyCode))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(companies)
    .values({
      code: companyCode,
      name: "PrintGoo Industrial Packaging & Trading",
      baseCurrency: "UZS",
    })
    .returning({ id: companies.id });

  return created.id;
}

// ─── 1. YTT & Legal Entities (YTT Limit Registri) ─────────────────────────────

export async function getYttEntities(companyCode = "PRINTGOO"): Promise<YttTurnoverLimitRecord[]> {
  const companyId = await resolveCompanyId(companyCode);

  const rows = await db
    .select()
    .from(tradingYttEntities)
    .where(eq(tradingYttEntities.companyId, companyId))
    .orderBy(asc(tradingYttEntities.code));

  if (rows.length === 0) {
    await seedYttEntities(companyId);
    return getYttEntities(companyCode);
  }

  return rows.map((r) => {
    const limit = Number(r.annualLimitUzs) || 1_000_000_000;
    const current = Number(r.currentTurnoverUzs) || 0;
    const pct = limit > 0 ? Number(((current / limit) * 100).toFixed(2)) : 0;
    let status: "Safe" | "Warning" | "Critical" | "Unlimited" = "Safe";
    if (r.legalType === "MChJ" || limit > 10_000_000_000) {
      status = "Unlimited";
    } else if (pct >= 95) {
      status = "Critical";
    } else if (pct >= 80) {
      status = "Warning";
    }

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      legalType: r.legalType as "YTT" | "MChJ",
      inn: r.inn,
      bankName: r.bankName || "",
      bankAccount: r.bankAccount || "",
      annualLimit: limit,
      currentTurnover: current,
      currency: "UZS",
      turnoverPercent: pct,
      status,
      isRecommended: r.isRecommended,
      activeContractsCount: r.activeContractsCount || 0,
      notes: r.notes || "",
    };
  });
}

export async function upsertYttEntity(
  payload: Partial<YttTurnoverLimitRecord>,
  companyCode = "PRINTGOO"
): Promise<YttTurnoverLimitRecord> {
  const companyId = await resolveCompanyId(companyCode);

  const values = {
    companyId,
    code: payload.code || `YTT-${Date.now().toString().slice(-4)}`,
    name: payload.name || "Noma'lum YTT",
    legalType: (payload.legalType || "YTT") as "YTT" | "MChJ",
    inn: payload.inn || "",
    bankName: payload.bankName || "",
    bankAccount: payload.bankAccount || "",
    annualLimitUzs: String(payload.annualLimit || 1_000_000_000),
    currentTurnoverUzs: String(payload.currentTurnover || 0),
    currency: "UZS",
    status: (payload.status || "Safe") as any,
    isRecommended: Boolean(payload.isRecommended),
    activeContractsCount: payload.activeContractsCount || 0,
    notes: payload.notes || "",
    updatedAt: new Date(),
  };

  if (isValidUuid(payload.id)) {
    const [updated] = await db
      .update(tradingYttEntities)
      .set(values)
      .where(and(eq(tradingYttEntities.id, payload.id!), eq(tradingYttEntities.companyId, companyId)))
      .returning();
    if (updated) {
      return {
        ...payload,
        id: updated.id,
      } as YttTurnoverLimitRecord;
    }
  }

  const [inserted] = await db
    .insert(tradingYttEntities)
    .values({ ...values, id: isValidUuid(payload.id) ? payload.id : undefined })
    .returning();

  return {
    ...payload,
    id: inserted.id,
  } as YttTurnoverLimitRecord;
}

// ─── 2. Trading Catalog (Aksessuarlar Zaxirasi) ───────────────────────────────

export async function getTradingCatalog(companyCode = "PRINTGOO"): Promise<TradingCatalogItemRecord[]> {
  const companyId = await resolveCompanyId(companyCode);

  const rows = await db
    .select()
    .from(tradingCatalog)
    .where(eq(tradingCatalog.companyId, companyId))
    .orderBy(asc(tradingCatalog.sku));

  if (rows.length === 0) {
    await seedCatalog(companyId);
    return getTradingCatalog(companyCode);
  }

  return rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category as any,
    unit: r.unit,
    priceUZS: Number(r.priceUzs) || 0,
    priceUSD: Number(r.priceUsd) || 0,
    wholesalePriceUZS: Number(r.wholesalePriceUzs) || 0,
    retailPriceUZS: Number(r.retailPriceUzs) || 0,
    stockQty: Number(r.stockQty) || 0,
    minStockLevel: Number(r.minStockLevel) || 0,
    origin: r.origin || "",
    material: r.material || "",
    colorCode: r.colorCode || "",
    dimensions: r.dimensions || "",
    supplier: r.supplier || "",
    notes: r.notes || "",
  }));
}

export async function upsertTradingCatalogItem(
  payload: Partial<TradingCatalogItemRecord>,
  companyCode = "PRINTGOO"
): Promise<TradingCatalogItemRecord> {
  const companyId = await resolveCompanyId(companyCode);

  const values = {
    companyId,
    sku: payload.sku || `SKU-${Date.now().toString().slice(-6)}`,
    name: payload.name || "Yangi Furnitura",
    category: (payload.category || "Tugmalar") as any,
    unit: payload.unit || "dona",
    priceUzs: String(payload.priceUZS || 0),
    priceUsd: String(payload.priceUSD || 0),
    wholesalePriceUzs: String(payload.wholesalePriceUZS || 0),
    retailPriceUzs: String(payload.retailPriceUZS || 0),
    stockQty: String(payload.stockQty || 0),
    minStockLevel: String(payload.minStockLevel || 0),
    origin: payload.origin || "Xitoy",
    material: payload.material || "",
    colorCode: payload.colorCode || "",
    dimensions: payload.dimensions || "",
    supplier: payload.supplier || "",
    notes: payload.notes || "",
    updatedAt: new Date(),
  };

  if (isValidUuid(payload.id)) {
    const [updated] = await db
      .update(tradingCatalog)
      .set(values)
      .where(and(eq(tradingCatalog.id, payload.id!), eq(tradingCatalog.companyId, companyId)))
      .returning();
    if (updated) {
      return {
        ...payload,
        id: updated.id,
      } as TradingCatalogItemRecord;
    }
  }

  const [inserted] = await db
    .insert(tradingCatalog)
    .values({ ...values, id: isValidUuid(payload.id) ? payload.id : undefined })
    .returning();

  return {
    ...payload,
    id: inserted.id,
  } as TradingCatalogItemRecord;
}

export async function deleteTradingCatalogItem(id: string, companyCode = "PRINTGOO"): Promise<boolean> {
  const companyId = await resolveCompanyId(companyCode);
  const res = await db
    .delete(tradingCatalog)
    .where(and(eq(tradingCatalog.id, id), eq(tradingCatalog.companyId, companyId)))
    .returning({ id: tradingCatalog.id });
  return res.length > 0;
}

// ─── 3. Trading Sales (Sotuv Hujjatlari) ───────────────────────────────────────

export async function getTradingSales(companyCode = "PRINTGOO"): Promise<TradingSaleRecord[]> {
  const companyId = await resolveCompanyId(companyCode);

  const sales = await db
    .select()
    .from(tradingSales)
    .where(eq(tradingSales.companyId, companyId))
    .orderBy(desc(tradingSales.date), desc(tradingSales.createdAt));

  if (sales.length === 0) {
    await seedSales(companyId);
    return getTradingSales(companyCode);
  }

  const saleIds = sales.map((s) => s.id);
  const items = await db
    .select()
    .from(tradingSaleItems)
    .where(sql`${tradingSaleItems.saleId} IN ${saleIds}`)
    .orderBy(asc(tradingSaleItems.sortOrder));

  const itemsBySale = new Map<string, TradingSaleItem[]>();
  for (const item of items) {
    const list = itemsBySale.get(item.saleId) || [];
    list.push({
      id: item.id,
      sku: item.sku || "",
      name: item.name,
      category: item.category as any,
      unit: item.unit,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      unitPriceUZS: Number(item.unitPriceUzs) || 0,
      unitPriceUSD: Number(item.unitPriceUsd) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      totalUSD: Number(item.totalUsd) || 0,
      isSelfProduced: item.isSelfProduced || false,
    });
    itemsBySale.set(item.saleId, list);
  }

  return sales.map((s) => ({
    id: s.id,
    docNo: s.docNo,
    date: s.date,
    sellerEntityId: (s.sellerEntityId || "ytt-qodirov") as any,
    sellerEntityName: s.sellerEntityName || "",
    sellerEntityInn: s.sellerEntityInn || "",
    customer: s.customer,
    customerTin: s.customerTin || "",
    contractNo: s.contractNo || "",
    currency: (s.currency || "UZS") as any,
    exchangeRate: Number(s.exchangeRate) || 12850,
    totalAmount: Number(s.totalAmount) || 0,
    totalUSD: Number(s.totalUsd) || 0,
    totalUZS: Number(s.totalUzs) || 0,
    paymentMethod: s.paymentMethod === "bank_wire" ? "Bank Wire (Hisob-raqam)" : s.paymentMethod === "corporate_card" ? "Corporate Card" : "Cash / Cash Register",
    status: s.status as any,
    items: itemsBySale.get(s.id) || [],
    notes: s.notes || "",
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function upsertTradingSale(
  payload: Partial<TradingSaleRecord>,
  companyCode = "PRINTGOO"
): Promise<TradingSaleRecord> {
  const companyId = await resolveCompanyId(companyCode);

  let targetYttId: string | null = null;
  if (payload.sellerEntityId) {
    const ytt = await db
      .select({ id: tradingYttEntities.id, name: tradingYttEntities.name, inn: tradingYttEntities.inn })
      .from(tradingYttEntities)
      .where(orEq(tradingYttEntities.id, payload.sellerEntityId, tradingYttEntities.code, payload.sellerEntityId))
      .limit(1);
    if (ytt.length > 0) {
      targetYttId = ytt[0].id;
      if (!payload.sellerEntityName) payload.sellerEntityName = ytt[0].name;
      if (!payload.sellerEntityInn) payload.sellerEntityInn = ytt[0].inn;
    }
  }

  let clientId: string | null = null;
  if (payload.customer) {
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.name, payload.customer))
      .limit(1);
    if (client.length > 0) clientId = client[0].id;
  }

  const paymentMethodDb =
    payload.paymentMethod === "Corporate Card"
      ? "corporate_card"
      : payload.paymentMethod === "Cash / Cash Register"
      ? "cash"
      : "bank_wire";

  const totalAmount = Number(payload.totalAmount) || 0;
  const exchangeRate = Number(payload.exchangeRate) || 12850;
  const totalUsd = payload.currency === "USD" ? totalAmount : totalAmount / exchangeRate;
  const totalUzs = payload.currency === "UZS" ? totalAmount : totalAmount * exchangeRate;

  const saleValues = {
    companyId,
    docNo: payload.docNo || `TRD-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
    date: payload.date || new Date().toISOString().split("T")[0],
    sellerEntityId: targetYttId,
    sellerEntityName: payload.sellerEntityName || "",
    sellerEntityInn: payload.sellerEntityInn || "",
    clientId,
    customer: payload.customer || "Noma'lum Xaridor",
    customerTin: payload.customerTin || "",
    contractNo: payload.contractNo || "",
    currency: payload.currency || "UZS",
    exchangeRate: String(exchangeRate),
    totalAmount: String(totalAmount),
    totalUsd: String(totalUsd),
    totalUzs: String(totalUzs),
    paymentMethod: paymentMethodDb as any,
    status: (payload.status || "Draft") as any,
    notes: payload.notes || "",
    updatedAt: new Date(),
  };

  let savedSaleId = payload.id;
  let isExisting = false;

  if (isValidUuid(payload.id)) {
    const [updated] = await db
      .update(tradingSales)
      .set(saleValues)
      .where(and(eq(tradingSales.id, payload.id!), eq(tradingSales.companyId, companyId)))
      .returning();
    if (updated) {
      savedSaleId = updated.id;
      isExisting = true;
    }
  }

  if (!isExisting) {
    const [inserted] = await db
      .insert(tradingSales)
      .values({ ...saleValues, id: isValidUuid(payload.id) ? payload.id : undefined })
      .returning();
    savedSaleId = inserted.id;
  }

  // Handle Items
  if (savedSaleId && Array.isArray(payload.items)) {
    await db.delete(tradingSaleItems).where(eq(tradingSaleItems.saleId, savedSaleId));

    if (payload.items.length > 0) {
      const itemsToInsert = payload.items.map((it, idx) => ({
        saleId: savedSaleId!,
        sku: it.sku || "",
        name: it.name,
        category: (it.category || "Tugmalar") as any,
        unit: it.unit || "dona",
        quantity: String(it.quantity || 0),
        unitPrice: String(it.unitPrice || 0),
        unitPriceUzs: String(it.unitPriceUZS || (payload.currency === "UZS" ? it.unitPrice : it.unitPrice * exchangeRate)),
        unitPriceUsd: String(it.unitPriceUSD || (payload.currency === "USD" ? it.unitPrice : it.unitPrice / exchangeRate)),
        totalAmount: String(it.totalAmount || 0),
        totalUsd: String(it.totalUSD || (payload.currency === "USD" ? it.totalAmount : it.totalAmount / exchangeRate)),
        isSelfProduced: Boolean(it.isSelfProduced),
        sortOrder: idx,
      }));

      await db.insert(tradingSaleItems).values(itemsToInsert);
    }
  }

  // If status is "Posted" -> perform real ERP side effects:
  // 1. Deduct quantities from trading_catalog
  // 2. Increase YTT turnover
  // 3. Record debit in trading_settlements
  if (payload.status === "Posted") {
    await applySalePostedEffects(companyId, savedSaleId!, saleValues, payload.items || []);
  }

  const all = await getTradingSales(companyCode);
  return all.find((s) => s.id === savedSaleId) || (payload as TradingSaleRecord);
}

async function applySalePostedEffects(
  companyId: string,
  saleId: string,
  sale: any,
  items: TradingSaleItem[]
) {
  // 1. Deduct stock from trading_catalog
  for (const it of items) {
    if (it.sku && it.quantity > 0) {
      await db
        .update(tradingCatalog)
        .set({
          stockQty: sql`GREATEST(0, ${tradingCatalog.stockQty} - ${it.quantity})`,
          updatedAt: new Date(),
        })
        .where(and(eq(tradingCatalog.companyId, companyId), eq(tradingCatalog.sku, it.sku)));
    }
  }

  // 2. Increase YTT turnover
  if (sale.sellerEntityId) {
    const saleUzs = Number(sale.totalUzs) || 0;
    await db
      .update(tradingYttEntities)
      .set({
        currentTurnoverUzs: sql`${tradingYttEntities.currentTurnoverUzs} + ${saleUzs}`,
        activeContractsCount: sql`${tradingYttEntities.activeContractsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tradingYttEntities.id, sale.sellerEntityId));
  }

  // 3. Add to trading_settlements
  const existingStl = await db
    .select({ id: tradingSettlements.id })
    .from(tradingSettlements)
    .where(and(eq(tradingSettlements.companyId, companyId), eq(tradingSettlements.docNo, sale.docNo)))
    .limit(1);

  if (existingStl.length === 0) {
    await db.insert(tradingSettlements).values({
      companyId,
      docNo: sale.docNo,
      date: sale.date,
      docType: "Sotuv Hujjati",
      sellerEntityId: sale.sellerEntityId,
      sellerEntityName: sale.sellerEntityName,
      clientId: sale.clientId,
      customer: sale.customer,
      debit: sale.totalAmount,
      credit: "0.00",
      currency: sale.currency,
      balance: sale.totalAmount, // Customer debt increases
      notes: `Sotuv hujjati bo'yicha mahsulot topshirildi (${items.length} xil pozitsiya)`,
    });
  }
}

export async function deleteTradingSale(id: string, companyCode = "PRINTGOO"): Promise<boolean> {
  const companyId = await resolveCompanyId(companyCode);
  const res = await db
    .delete(tradingSales)
    .where(and(eq(tradingSales.id, id), eq(tradingSales.companyId, companyId)))
    .returning({ id: tradingSales.id });
  return res.length > 0;
}

// ─── 4. Trading Orders (Oldindan Buyurtmalar / Forward Pre-Orders) ─────────────

export async function getTradingOrders(companyCode = "PRINTGOO"): Promise<TradingOrderRecord[]> {
  const companyId = await resolveCompanyId(companyCode);

  const orders = await db
    .select()
    .from(tradingOrders)
    .where(eq(tradingOrders.companyId, companyId))
    .orderBy(desc(tradingOrders.date), desc(tradingOrders.createdAt));

  if (orders.length === 0) {
    await seedOrders(companyId);
    return getTradingOrders(companyCode);
  }

  const orderIds = orders.map((o) => o.id);
  const items = await db
    .select()
    .from(tradingOrderItems)
    .where(sql`${tradingOrderItems.orderId} IN ${orderIds}`)
    .orderBy(asc(tradingOrderItems.sortOrder));

  const itemsByOrder = new Map<string, TradingOrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push({
      id: item.id,
      sku: item.sku || "",
      name: item.name,
      spec: item.spec || "",
      unit: item.unit,
      quantity: Number(item.quantity) || 0,
      unitPriceUSD: Number(item.unitPriceUsd) || 0,
      totalUSD: Number(item.totalUsd) || 0,
      chinaFactoryStatus: item.chinaFactoryStatus as any,
    });
    itemsByOrder.set(item.orderId, list);
  }

  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    date: o.date,
    customer: o.customer,
    customerTin: o.customerTin || "",
    contractNo: o.contractNo || "",
    category: o.category || "Aksessuarlar",
    deliveryDate: o.deliveryDate || "",
    chinaStatus: o.chinaStatus as any,
    advanceStatus: o.advanceStatus as any,
    advancePercent: Number(o.advancePercent) || 0,
    advanceAmountUSD: Number(o.advanceAmountUsd) || 0,
    totalUSD: Number(o.totalUsd) || 0,
    exchangeRate: Number(o.exchangeRate) || 12850,
    shippingMethod: (o.shippingMethod || "Avto Fura Kargo (12-16 kun)") as any,
    trackingNo: o.trackingNo || "",
    notes: o.notes || "",
    items: itemsByOrder.get(o.id) || [],
  }));
}

export async function upsertTradingOrder(
  payload: Partial<TradingOrderRecord>,
  companyCode = "PRINTGOO"
): Promise<TradingOrderRecord> {
  const companyId = await resolveCompanyId(companyCode);

  let clientId: string | null = null;
  if (payload.customer) {
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.name, payload.customer))
      .limit(1);
    if (client.length > 0) clientId = client[0].id;
  }

  const exchangeRate = Number(payload.exchangeRate) || 12850;
  const totalUsd = Number(payload.totalUSD) || 0;
  const totalUzs = totalUsd * exchangeRate;
  const advancePercent = Number(payload.advancePercent) || 0;
  const advanceAmountUsd = Number(payload.advanceAmountUSD) || (totalUsd * advancePercent) / 100;

  const orderValues = {
    companyId,
    orderNo: payload.orderNo || `ORD-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
    date: payload.date || new Date().toISOString().split("T")[0],
    clientId,
    customer: payload.customer || "Noma'lum Xaridor",
    customerTin: payload.customerTin || "",
    contractNo: payload.contractNo || "",
    category: payload.category || "Tekstil Furnitura",
    deliveryDate: payload.deliveryDate || "",
    chinaStatus: payload.chinaStatus || "Navbatda",
    advanceStatus: payload.advanceStatus || "0% Kutilmoqda",
    advancePercent: String(advancePercent),
    advanceAmountUsd: String(advanceAmountUsd),
    totalUsd: String(totalUsd),
    totalUzs: String(totalUzs),
    exchangeRate: String(exchangeRate),
    shippingMethod: payload.shippingMethod || "Avto Fura Kargo (12-16 kun)",
    trackingNo: payload.trackingNo || "",
    notes: payload.notes || "",
    updatedAt: new Date(),
  };

  let savedOrderId = payload.id;
  let isExisting = false;

  if (isValidUuid(payload.id)) {
    const [updated] = await db
      .update(tradingOrders)
      .set(orderValues)
      .where(and(eq(tradingOrders.id, payload.id!), eq(tradingOrders.companyId, companyId)))
      .returning();
    if (updated) {
      savedOrderId = updated.id;
      isExisting = true;
    }
  }

  if (!isExisting) {
    const [inserted] = await db
      .insert(tradingOrders)
      .values({ ...orderValues, id: isValidUuid(payload.id) ? payload.id : undefined })
      .returning();
    savedOrderId = inserted.id;
  }

  if (savedOrderId && Array.isArray(payload.items)) {
    await db.delete(tradingOrderItems).where(eq(tradingOrderItems.orderId, savedOrderId));

    if (payload.items.length > 0) {
      const itemsToInsert = payload.items.map((it, idx) => ({
        orderId: savedOrderId!,
        sku: it.sku || "",
        name: it.name,
        spec: it.spec || "",
        unit: it.unit || "dona",
        quantity: String(it.quantity || 0),
        unitPriceUsd: String(it.unitPriceUSD || 0),
        totalUsd: String(it.totalUSD || 0),
        chinaFactoryStatus: it.chinaFactoryStatus || "Navbatda",
        sortOrder: idx,
      }));

      await db.insert(tradingOrderItems).values(itemsToInsert);
    }
  }

  const all = await getTradingOrders(companyCode);
  return all.find((o) => o.id === savedOrderId) || (payload as TradingOrderRecord);
}

export async function deleteTradingOrder(id: string, companyCode = "PRINTGOO"): Promise<boolean> {
  const companyId = await resolveCompanyId(companyCode);
  const res = await db
    .delete(tradingOrders)
    .where(and(eq(tradingOrders.id, id), eq(tradingOrders.companyId, companyId)))
    .returning({ id: tradingOrders.id });
  return res.length > 0;
}

/** Convert Pre-Order into a Trading Sale (1-Click Pipeline) */
export async function convertOrderToSale(
  orderId: string,
  companyCode = "PRINTGOO"
): Promise<{ saleId: string; docNo: string }> {
  const companyId = await resolveCompanyId(companyCode);

  const [order] = await db
    .select()
    .from(tradingOrders)
    .where(and(eq(tradingOrders.id, orderId), eq(tradingOrders.companyId, companyId)))
    .limit(1);

  if (!order) throw new Error("Order not found");

  const orderItems = await db
    .select()
    .from(tradingOrderItems)
    .where(eq(tradingOrderItems.orderId, order.id))
    .orderBy(asc(tradingOrderItems.sortOrder));

  // Find lowest turnover recommended YTT
  const ytts = await getYttEntities(companyCode);
  const bestYtt = ytts.find((y) => y.isRecommended) || ytts[0];

  const docNo = `TRD-2026-F${order.orderNo.replace(/\D/g, "").slice(-4) || Math.floor(Math.random() * 9000 + 1000)}`;
  const rate = Number(order.exchangeRate) || 12850;
  const totalUsd = Number(order.totalUsd) || 0;
  const totalUzs = totalUsd * rate;

  const salePayload: Partial<TradingSaleRecord> = {
    docNo,
    date: new Date().toISOString().split("T")[0],
    sellerEntityId: (bestYtt?.id || "ytt-qodirov") as any,
    sellerEntityName: bestYtt?.name || "YTT Qodirov Baxtiyor Shavkatovich",
    sellerEntityInn: bestYtt?.inn || "498213002",
    customer: order.customer,
    customerTin: order.customerTin || "",
    contractNo: order.contractNo || "",
    currency: "USD",
    exchangeRate: rate,
    totalAmount: totalUsd,
    totalUSD: totalUsd,
    totalUZS: totalUzs,
    paymentMethod: "Bank Wire (Hisob-raqam)",
    status: "Draft",
    notes: `Oldindan buyurtma ${order.orderNo} asosida shakllantirilgan sotuv hujjati.`,
    items: orderItems.map((it) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sku: it.sku || "",
      name: it.name,
      category: "Furnitura",
      unit: it.unit,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPriceUsd) || 0,
      unitPriceUZS: (Number(it.unitPriceUsd) || 0) * rate,
      unitPriceUSD: Number(it.unitPriceUsd) || 0,
      totalAmount: Number(it.totalUsd) || 0,
      totalUSD: Number(it.totalUsd) || 0,
      isSelfProduced: false,
    })),
  };

  const createdSale = await upsertTradingSale(salePayload, companyCode);

  // Link order
  await db
    .update(tradingOrders)
    .set({
      linkedSaleId: createdSale.id,
      chinaStatus: "Ombordan Zaxiradan Ajratildi",
      updatedAt: new Date(),
    })
    .where(eq(tradingOrders.id, order.id));

  return { saleId: createdSale.id, docNo };
}

// ─── 5. Trading Import Batches (Xitoy / Xorij Partiyalari & Landed Cost) ──────

export async function getTradingImports(companyCode = "PRINTGOO"): Promise<TradingImportBatchRecord[]> {
  const companyId = await resolveCompanyId(companyCode);

  const batches = await db
    .select()
    .from(tradingImportBatches)
    .where(eq(tradingImportBatches.companyId, companyId))
    .orderBy(desc(tradingImportBatches.date), desc(tradingImportBatches.createdAt));

  if (batches.length === 0) {
    await seedImports(companyId);
    return getTradingImports(companyCode);
  }

  const batchIds = batches.map((b) => b.id);
  const items = await db
    .select()
    .from(tradingImportItems)
    .where(sql`${tradingImportItems.batchId} IN ${batchIds}`)
    .orderBy(asc(tradingImportItems.sortOrder));

  const itemsByBatch = new Map<string, ImportBatchItem[]>();
  for (const item of items) {
    const list = itemsByBatch.get(item.batchId) || [];
    list.push({
      id: item.id,
      sku: item.sku || "",
      name: item.name,
      category: item.category || "Furnitura",
      unit: item.unit,
      quantity: Number(item.quantity) || 0,
      fobPriceUSD: Number(item.fobPriceUsd) || 0,
      fobTotalUSD: Number(item.fobTotalUsd) || 0,
      landedCostUZS: Number(item.landedCostUzs) || 0,
      suggestedSalePriceUZS: Number(item.suggestedSalePriceUzs) || 0,
    });
    itemsByBatch.set(item.batchId, list);
  }

  return batches.map((b) => {
    let statusLabel: "In Transit" | "Customs Clearance" | "Arrived & Calculated" | "Allocated to Stock" = "In Transit";
    if (b.status === "customs_clearance") statusLabel = "Customs Clearance";
    else if (b.status === "arrived_calculated") statusLabel = "Arrived & Calculated";
    else if (b.status === "allocated_to_stock") statusLabel = "Allocated to Stock";

    const bItems = itemsByBatch.get(b.id) || [];
    return {
      id: b.id,
      batchNo: b.batchNo,
      date: b.date,
      origin: (b.origin || "Guangzhou, Xitoy") as any,
      supplier: b.supplier,
      fobAmountUSD: Number(b.fobAmountUsd) || 0,
      internationalCargoUSD: Number(b.internationalCargoUsd) || 0,
      grossWeightKg: Number(b.grossWeightKg) || 0,
      customsDutyUZS: Number(b.customsDutyUzs) || 0,
      exchangeRate: Number(b.exchangeRate) || 12850,
      totalLandedCostUZS: Number(b.totalLandedCostUzs) || 0,
      landedCostMarkupPercent: Number(b.landedCostMarkupPercent) || 0,
      status: statusLabel,
      containerNo: b.containerNo || "",
      itemsCount: bItems.length,
      items: bItems,
      notes: b.notes || "",
    };
  });
}

export async function upsertTradingImport(
  payload: Partial<TradingImportBatchRecord>,
  companyCode = "PRINTGOO"
): Promise<TradingImportBatchRecord> {
  const companyId = await resolveCompanyId(companyCode);

  let statusDb = "in_transit";
  if (payload.status === "Customs Clearance") statusDb = "customs_clearance";
  else if (payload.status === "Arrived & Calculated") statusDb = "arrived_calculated";
  else if (payload.status === "Allocated to Stock") statusDb = "allocated_to_stock";

  const rate = Number(payload.exchangeRate) || 12850;
  const fobAmountUsd = Number(payload.fobAmountUSD) || 0;
  const cargoUsd = Number(payload.internationalCargoUSD) || 0;
  const customsUzs = Number(payload.customsDutyUZS) || 0;
  const totalLandedCostUzs = (fobAmountUsd + cargoUsd) * rate + customsUzs;
  const landedCostMarkupPercent = fobAmountUsd > 0 ? ((totalLandedCostUzs - fobAmountUsd * rate) / (fobAmountUsd * rate)) * 100 : 0;

  const batchValues = {
    companyId,
    batchNo: payload.batchNo || `IMP-2026-${Date.now().toString().slice(-4)}`,
    date: payload.date || new Date().toISOString().split("T")[0],
    origin: payload.origin || "Guangzhou, Xitoy",
    supplier: payload.supplier || "Zhejiang Accessories Factory",
    containerNo: payload.containerNo || "",
    fobAmountUsd: String(fobAmountUsd),
    internationalCargoUsd: String(cargoUsd),
    grossWeightKg: String(payload.grossWeightKg || 0),
    customsDutyUzs: String(customsUzs),
    exchangeRate: String(rate),
    totalLandedCostUzs: String(totalLandedCostUzs),
    landedCostMarkupPercent: String(Number(landedCostMarkupPercent.toFixed(2))),
    status: statusDb as any,
    notes: payload.notes || "",
    updatedAt: new Date(),
  };

  let savedBatchId = payload.id;
  let isExisting = false;

  if (isValidUuid(payload.id)) {
    const [updated] = await db
      .update(tradingImportBatches)
      .set(batchValues)
      .where(and(eq(tradingImportBatches.id, payload.id!), eq(tradingImportBatches.companyId, companyId)))
      .returning();
    if (updated) {
      savedBatchId = updated.id;
      isExisting = true;
    }
  }

  if (!isExisting) {
    const [inserted] = await db
      .insert(tradingImportBatches)
      .values({ ...batchValues, id: isValidUuid(payload.id) ? payload.id : undefined })
      .returning();
    savedBatchId = inserted.id;
  }

  if (savedBatchId && Array.isArray(payload.items)) {
    await db.delete(tradingImportItems).where(eq(tradingImportItems.batchId, savedBatchId));

    if (payload.items.length > 0) {
      const itemsToInsert = payload.items.map((it, idx) => ({
        batchId: savedBatchId!,
        sku: it.sku || "",
        name: it.name,
        category: it.category || "Furnitura",
        unit: it.unit || "dona",
        quantity: String(it.quantity || 0),
        fobPriceUsd: String(it.fobPriceUSD || 0),
        fobTotalUsd: String(it.fobTotalUSD || 0),
        landedCostUzs: String(it.landedCostUZS || 0),
        suggestedSalePriceUzs: String(it.suggestedSalePriceUZS || 0),
        sortOrder: idx,
      }));

      await db.insert(tradingImportItems).values(itemsToInsert);
    }
  }

  // If status is "Allocated to Stock" -> auto-populate trading_catalog
  if (statusDb === "allocated_to_stock" && savedBatchId) {
    await allocateImportToStock(savedBatchId, companyCode);
  }

  const all = await getTradingImports(companyCode);
  return all.find((b) => b.id === savedBatchId) || (payload as TradingImportBatchRecord);
}

/** Allocate Landed Cost to Trading Catalog Stock */
export async function allocateImportToStock(
  batchId: string,
  companyCode = "PRINTGOO"
): Promise<{ success: boolean; itemsUpdated: number }> {
  const companyId = await resolveCompanyId(companyCode);

  const [batch] = await db
    .select()
    .from(tradingImportBatches)
    .where(and(eq(tradingImportBatches.id, batchId), eq(tradingImportBatches.companyId, companyId)))
    .limit(1);

  if (!batch) throw new Error("Batch not found");

  const items = await db
    .select()
    .from(tradingImportItems)
    .where(eq(tradingImportItems.batchId, batch.id));

  const rate = Number(batch.exchangeRate) || 12850;
  const fobAmountUsd = Number(batch.fobAmountUsd) || 1;
  const cargoUsd = Number(batch.internationalCargoUsd) || 0;
  const customsUzs = Number(batch.customsDutyUzs) || 0;

  let itemsUpdated = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const itemFobUsd = Number(item.fobTotalUsd) || 0;
    const ratio = fobAmountUsd > 0 ? itemFobUsd / fobAmountUsd : 1 / items.length;

    // Landed cost calculation per item
    const itemCargoUzs = cargoUsd * rate * ratio;
    const itemCustomsUzs = customsUzs * ratio;
    const itemTotalLandedUzs = itemFobUsd * rate + itemCargoUzs + itemCustomsUzs;
    const unitLandedCostUzs = qty > 0 ? itemTotalLandedUzs / qty : 0;
    const suggestedSalePriceUzs = unitLandedCostUzs * 1.35; // 35% standard wholesale markup

    await db
      .update(tradingImportItems)
      .set({
        landedCostUzs: String(Number(unitLandedCostUzs.toFixed(2))),
        suggestedSalePriceUzs: String(Number(suggestedSalePriceUzs.toFixed(2))),
      })
      .where(eq(tradingImportItems.id, item.id));

    // Upsert to trading_catalog
    if (item.sku) {
      const existing = await db
        .select({ id: tradingCatalog.id })
        .from(tradingCatalog)
        .where(and(eq(tradingCatalog.companyId, companyId), eq(tradingCatalog.sku, item.sku)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(tradingCatalog)
          .set({
            stockQty: sql`${tradingCatalog.stockQty} + ${qty}`,
            wholesalePriceUzs: String(Number(suggestedSalePriceUzs.toFixed(2))),
            priceUzs: String(Number(suggestedSalePriceUzs.toFixed(2))),
            priceUsd: String(Number((suggestedSalePriceUzs / rate).toFixed(4))),
            updatedAt: new Date(),
          })
          .where(eq(tradingCatalog.id, existing[0].id));
      } else {
        await db.insert(tradingCatalog).values({
          companyId,
          sku: item.sku,
          name: item.name,
          category: (item.category || "Furnitura") as any,
          unit: item.unit,
          priceUzs: String(Number(suggestedSalePriceUzs.toFixed(2))),
          priceUsd: String(Number((suggestedSalePriceUzs / rate).toFixed(4))),
          wholesalePriceUzs: String(Number(suggestedSalePriceUzs.toFixed(2))),
          retailPriceUzs: String(Number((suggestedSalePriceUzs * 1.2).toFixed(2))),
          stockQty: String(qty),
          minStockLevel: "100",
          origin: batch.origin || "Xitoy",
          supplier: batch.supplier || "",
        });
      }
      itemsUpdated++;
    }
  }

  // Update batch status
  await db
    .update(tradingImportBatches)
    .set({
      status: "allocated_to_stock",
      updatedAt: new Date(),
    })
    .where(eq(tradingImportBatches.id, batch.id));

  return { success: true, itemsUpdated };
}

// ─── 6. Trading Settlements (YTT/MChJ Kesimidagi Akt-sverka) ───────────────────

export async function getTradingSettlements(
  companyCode = "PRINTGOO",
  sellerEntityId?: string,
  customerName?: string
): Promise<TradingSettlementLedgerEntry[]> {
  const companyId = await resolveCompanyId(companyCode);

  let query = db
    .select()
    .from(tradingSettlements)
    .where(eq(tradingSettlements.companyId, companyId))
    .orderBy(desc(tradingSettlements.date), desc(tradingSettlements.createdAt));

  const rows = await query;

  if (rows.length === 0) {
    await seedSettlements(companyId);
    return getTradingSettlements(companyCode, sellerEntityId, customerName);
  }

  let filtered = rows;
  if (sellerEntityId && sellerEntityId !== "all") {
    filtered = filtered.filter((r) => r.sellerEntityId === sellerEntityId || r.sellerEntityName?.toLowerCase().includes(sellerEntityId.toLowerCase()));
  }
  if (customerName && customerName.trim()) {
    filtered = filtered.filter((r) => r.customer.toLowerCase().includes(customerName.toLowerCase()));
  }

  return filtered.map((r) => ({
    id: r.id,
    date: r.date,
    docNo: r.docNo,
    docType: r.docType as any,
    sellerEntityName: r.sellerEntityName || "",
    customer: r.customer,
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
    currency: (r.currency || "UZS") as any,
    balance: Number(r.balance) || 0,
  }));
}

export async function recordTradingPayment(
  payload: {
    docNo?: string;
    date?: string;
    sellerEntityId?: string;
    sellerEntityName?: string;
    customer: string;
    amount: number;
    currency?: string;
    notes?: string;
  },
  companyCode = "PRINTGOO"
): Promise<TradingSettlementLedgerEntry> {
  const companyId = await resolveCompanyId(companyCode);

  let targetYttName = payload.sellerEntityName || "";
  let targetYttId: string | null = payload.sellerEntityId || null;

  if (payload.sellerEntityId) {
    const ytt = await db
      .select({ id: tradingYttEntities.id, name: tradingYttEntities.name })
      .from(tradingYttEntities)
      .where(orEq(tradingYttEntities.id, payload.sellerEntityId, tradingYttEntities.code, payload.sellerEntityId))
      .limit(1);
    if (ytt.length > 0) {
      targetYttId = ytt[0].id;
      targetYttName = ytt[0].name;
    }
  }

  const [inserted] = await db
    .insert(tradingSettlements)
    .values({
      companyId,
      docNo: payload.docNo || `PAY-TRD-${Math.floor(Math.random() * 9000 + 1000)}`,
      date: payload.date || new Date().toISOString().split("T")[0],
      docType: "Bank To'lovi",
      sellerEntityId: targetYttId,
      sellerEntityName: targetYttName,
      customer: payload.customer,
      debit: "0.00",
      credit: String(payload.amount),
      currency: payload.currency || "UZS",
      balance: String(-Number(payload.amount)),
      notes: payload.notes || "Aksessuarlar uchun to'lov qabul qilindi",
    })
    .returning();

  return {
    id: inserted.id,
    date: inserted.date,
    docNo: inserted.docNo,
    docType: "Bank To'lovi",
    sellerEntityName: inserted.sellerEntityName || "",
    customer: inserted.customer,
    debit: 0,
    credit: Number(inserted.credit) || 0,
    currency: (inserted.currency || "UZS") as any,
    balance: Number(inserted.balance) || 0,
  };
}

// ─── Helpers & Seed Data ──────────────────────────────────────────────────────

function orEq(col1: any, val1: any, col2: any, val2: any) {
  return sql`(${col1} = ${val1} OR ${col2} = ${val2})`;
}

async function seedYttEntities(companyId: string) {
  for (const ytt of INITIAL_YTT_ENTITIES) {
    await db.insert(tradingYttEntities).values({
      companyId,
      code: ytt.code,
      name: ytt.name,
      legalType: ytt.legalType,
      inn: ytt.inn,
      bankName: ytt.bankName,
      bankAccount: ytt.bankAccount,
      annualLimitUzs: String(ytt.annualLimit),
      currentTurnoverUzs: String(ytt.currentTurnover),
      currency: "UZS",
      status: ytt.status as any,
      isRecommended: Boolean(ytt.isRecommended),
      activeContractsCount: ytt.activeContractsCount,
      notes: ytt.notes,
    });
  }
}

async function seedCatalog(companyId: string) {
  for (const cat of INITIAL_TRADING_CATALOG) {
    await db.insert(tradingCatalog).values({
      companyId,
      sku: cat.sku,
      name: cat.name,
      category: cat.category as any,
      unit: cat.unit,
      priceUzs: String(cat.priceUZS),
      priceUsd: String(cat.priceUSD),
      wholesalePriceUzs: String(cat.wholesalePriceUZS),
      retailPriceUzs: String(cat.retailPriceUZS),
      stockQty: String(cat.stockQty),
      minStockLevel: String(cat.minStockLevel),
      origin: cat.origin,
      material: cat.material || "",
      colorCode: cat.colorCode || "",
      dimensions: cat.dimensions || "",
      supplier: cat.supplier || "",
      notes: cat.notes || "",
    });
  }
}

async function seedSales(companyId: string) {
  for (const s of INITIAL_TRADING_SALES) {
    const [inserted] = await db
      .insert(tradingSales)
      .values({
        companyId,
        docNo: s.docNo,
        date: s.date,
        sellerEntityName: s.sellerEntityName,
        sellerEntityInn: s.sellerEntityInn,
        customer: s.customer,
        customerTin: s.customerTin,
        contractNo: s.contractNo,
        currency: s.currency,
        exchangeRate: String(s.exchangeRate),
        totalAmount: String(s.totalAmount),
        totalUsd: String(s.totalUSD),
        totalUzs: String(s.totalUZS),
        paymentMethod: s.paymentMethod === "Bank Wire (Hisob-raqam)" ? "bank_wire" : "cash",
        status: s.status as any,
        notes: s.notes,
      })
      .returning();

    if (s.items && s.items.length > 0) {
      await db.insert(tradingSaleItems).values(
        s.items.map((it, idx) => ({
          saleId: inserted.id,
          sku: it.sku,
          name: it.name,
          category: it.category as any,
          unit: it.unit,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
          unitPriceUzs: String(it.unitPriceUZS),
          unitPriceUsd: String(it.unitPriceUSD),
          totalAmount: String(it.totalAmount),
          totalUsd: String(it.totalUSD),
          isSelfProduced: Boolean(it.isSelfProduced),
          sortOrder: idx,
        }))
      );
    }
  }
}

async function seedOrders(companyId: string) {
  const seedList: Omit<TradingOrderRecord, "id">[] = [
    {
      orderNo: "ORD-2026-OCT-101",
      date: "2026-10-20",
      customer: "'OSIYO TEKSTIL SANOAT' MChJ",
      customerTin: "305112233",
      contractNo: "PO-ACC-2026/18",
      category: "Maxsus Jakkard va Tugmalar",
      deliveryDate: "2026-11-05",
      chinaStatus: "Guangzhou Zavodida Ishlab Chiqarilmoqda",
      advanceStatus: "30% Avans Olingan",
      advancePercent: 30,
      advanceAmountUSD: 2400,
      totalUSD: 8000,
      exchangeRate: 12850,
      shippingMethod: "Avto Fura Kargo (12-16 kun)",
      trackingNo: "CN-TASH-99812",
      notes: "Mijoz logotipi tushirilgan metall gravirovkali tugmalar.",
      items: [
        {
          id: "item-ord-1",
          sku: "TRD-BTN-001",
          name: "Metall jinsi tugmasi (Gravirovka: Osiyo)",
          spec: "Diametr: 18mm, Bronza qoplamali",
          unit: "dona",
          quantity: 50000,
          unitPriceUSD: 0.12,
          totalUSD: 6000,
          chinaFactoryStatus: "Ishlab chiqarilmoqda",
        },
        {
          id: "item-ord-2",
          sku: "TRD-LBL-001",
          name: "Jakkard to'qilgan yoqa yorlig'i (Woven label)",
          spec: "O'lcham: 25x60mm, 5 rangli to'qima",
          unit: "dona",
          quantity: 20000,
          unitPriceUSD: 0.1,
          totalUSD: 2000,
          chinaFactoryStatus: "Sifat nazoratida",
        },
      ],
    },
    {
      orderNo: "ORD-2026-OCT-102",
      date: "2026-10-22",
      customer: "'SAMARKAND APPAREL' QK MChJ",
      customerTin: "302889900",
      contractNo: "SA-2026/89",
      category: "YKK Tipi Fermuarlar",
      deliveryDate: "2026-11-10",
      chinaStatus: "Kargo Avto Yo'lda (CN-2026-OCT-14)",
      advanceStatus: "50% To'langan",
      advancePercent: 50,
      advanceAmountUSD: 4500,
      totalUSD: 9000,
      exchangeRate: 12850,
      shippingMethod: "Avto Fura Kargo (12-16 kun)",
      trackingNo: "CN-KRG-44102",
      notes: "Yevropa eksporti uchun bolalar kiyimlari fermuari.",
      items: [
        {
          id: "item-ord-3",
          sku: "TRD-ZIP-001",
          name: "Yashirin fermuar (Invisible zipper, 20cm)",
          spec: "Rang: Pantone 19-4052, Neylon #3",
          unit: "dona",
          quantity: 30000,
          unitPriceUSD: 0.3,
          totalUSD: 9000,
          chinaFactoryStatus: "Kargoga topshirildi",
        },
      ],
    },
  ];

  for (const o of seedList) {
    const [inserted] = await db
      .insert(tradingOrders)
      .values({
        companyId,
        orderNo: o.orderNo,
        date: o.date,
        customer: o.customer,
        customerTin: o.customerTin,
        contractNo: o.contractNo,
        category: o.category,
        deliveryDate: o.deliveryDate,
        chinaStatus: o.chinaStatus,
        advanceStatus: o.advanceStatus,
        advancePercent: String(o.advancePercent),
        advanceAmountUsd: String(o.advanceAmountUSD),
        totalUsd: String(o.totalUSD),
        totalUzs: String(o.totalUSD * o.exchangeRate),
        exchangeRate: String(o.exchangeRate),
        shippingMethod: o.shippingMethod,
        trackingNo: o.trackingNo,
        notes: o.notes,
      })
      .returning();

    if (o.items && o.items.length > 0) {
      await db.insert(tradingOrderItems).values(
        o.items.map((it, idx) => ({
          orderId: inserted.id,
          sku: it.sku,
          name: it.name,
          spec: it.spec,
          unit: it.unit,
          quantity: String(it.quantity),
          unitPriceUsd: String(it.unitPriceUSD),
          totalUsd: String(it.totalUSD),
          chinaFactoryStatus: it.chinaFactoryStatus,
          sortOrder: idx,
        }))
      );
    }
  }
}

async function seedImports(companyId: string) {
  for (const b of INITIAL_IMPORT_BATCHES) {
    let statusDb = "in_transit";
    if (b.status === "Customs Clearance") statusDb = "customs_clearance";
    else if (b.status === "Arrived & Calculated") statusDb = "arrived_calculated";
    else if (b.status === "Allocated to Stock") statusDb = "allocated_to_stock";

    const [inserted] = await db
      .insert(tradingImportBatches)
      .values({
        companyId,
        batchNo: b.batchNo,
        date: b.date,
        origin: b.origin,
        supplier: b.supplier,
        containerNo: b.containerNo,
        fobAmountUsd: String(b.fobAmountUSD),
        internationalCargoUsd: String(b.internationalCargoUSD),
        grossWeightKg: String(b.grossWeightKg),
        customsDutyUzs: String(b.customsDutyUZS),
        exchangeRate: String(b.exchangeRate),
        totalLandedCostUzs: String(b.totalLandedCostUZS),
        landedCostMarkupPercent: String(b.landedCostMarkupPercent),
        status: statusDb as any,
        notes: b.notes,
      })
      .returning();

    if (b.items && b.items.length > 0) {
      await db.insert(tradingImportItems).values(
        b.items.map((it, idx) => ({
          batchId: inserted.id,
          sku: it.sku,
          name: it.name,
          category: it.category,
          unit: it.unit,
          quantity: String(it.quantity),
          fobPriceUsd: String(it.fobPriceUSD),
          fobTotalUsd: String(it.fobTotalUSD),
          landedCostUzs: String(it.landedCostUZS),
          suggestedSalePriceUzs: String(it.suggestedSalePriceUZS),
          sortOrder: idx,
        }))
      );
    }
  }
}

async function seedSettlements(companyId: string) {
  for (const stl of INITIAL_SETTLEMENT_LEDGERS) {
    await db.insert(tradingSettlements).values({
      companyId,
      docNo: stl.docNo,
      date: stl.date,
      docType: stl.docType,
      sellerEntityName: stl.sellerEntityName,
      customer: stl.customer,
      debit: String(stl.debit),
      credit: String(stl.credit),
      currency: stl.currency,
      balance: String(stl.balance),
      notes: "Dastlabki hisob-kitob qoldig'i",
    });
  }
}
