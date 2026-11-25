import { db, writeAuditLog, type DbExec } from "@/db";
import {
  warehouses,
  warehouseReceipts,
  warehouseReceiptItems,
  warehouseShipments,
  warehouseShipmentItems,
  warehouseMovements,
  warehouseInventoryCounts,
  warehouseStockBalances,
  warehouseFinishedGoods,
  warehouseDispatchManifests,
  workOrders,
  carriers,
  wmsBins,
  wmsBinItems,
  tradingCatalog,
  tradingSales,
  clients,
  clientContacts,
  deliveryActs,
} from "@/db/schema";
import { eq, desc, and, or, sql, inArray, isNull } from "drizzle-orm";
import { getNextReceiptNumber, getNextShipmentNumber, getNextMaterialSku, getNextMovementNumber, getNextInventoryCountNumber, getNextManifestNumber, lockNumbering } from "./numberingService";
import { emitNotification } from "./notificationService";
import { upsertDeliveryAct, cancelDeliveryAct, getCompanyVatRate } from "./financeService";
import { applySalePostedEffects, reverseSalePostedEffects } from "./tradingService";
import { getCompanyIdByCode as resolveCompanyId, resolveClient, unknownClientMessage } from "./crmService";
import {
  UUID_RE,
  ShipmentError,
  type ShipmentStatus,
  normalizeStatus,
  assertTransition,
  phaseOf,
  resolveShipmentAccount,
  normalizeShipmentLines,
  assertLinesValid,
  reserveLines,
  postLines,
} from "./shipmentEngine";

export { ShipmentError };

/**
 * Korxona kodi yoki UUID bo'yicha korxona ID sini olish.
 * crmService dagi yagona implementatsiyadan foydalanadi (UUID ni ham qabul qiladi).
 */
export async function getCompanyIdByCode(code: string = "PRINTGOO"): Promise<string> {
  return resolveCompanyId(code);
}

/** Chiqim qoldiqqa ta'sir qiladigan (o'tkazilgan) statuslar */
const SHIPMENT_POSTED_STATUSES = new Set(["Dispatched", "In Transit", "Delivered"]);

// ─── 1. Warehouses (Omborlar Katalogi & Ierarxiya) ────────────────────────────

/**
 * Har bir kompaniyada kamida bitta ombor bo'lishini ta'minlaydi: omborsiz
 * kompaniyaga bitta standart ombor yaratadi. Filiallar bo'yicha ombor
 * yaratilmaydi.
 */
export async function ensureDefaultWarehouses() {
  const allCompanies = await db.query.companies.findMany();
  const existingWarehouses = await db.query.warehouses.findMany();

  for (const comp of allCompanies) {
    const compWhs = existingWarehouses.filter((w) => w.companyId === comp.id);
    if (compWhs.length > 0) continue;

    const isYtt = comp.legalType === "YTT";
    await db.insert(warehouses).values({
      companyId: comp.id,
      branchId: null,
      code: `WH-${isYtt ? "STORE" : "MAIN"}-${comp.code || Date.now().toString().slice(-4)}`,
      name: isYtt ? "Savdo ombori" : "Asosiy ombor",
      type: "general",
      capacity: "1000 m2",
      zones: 1,
      isActive: true,
    });
  }
}

export async function getWarehouses(companyCode: string = "PRINTGOO", all: boolean = false) {
  await ensureDefaultWarehouses();

  let whereClause = undefined;
  if (!all && companyCode) {
    const companyId = await getCompanyIdByCode(companyCode);
    whereClause = eq(warehouses.companyId, companyId);
  }

  return db.query.warehouses.findMany({
    where: whereClause,
    with: {
      branch: true,
      company: true,
    },
    orderBy: [desc(warehouses.createdAt)],
  });
}

export async function upsertWarehouse(payload: any, companyCode: string = "PRINTGOO") {
  let targetCompanyId = payload.companyId;

  if (!targetCompanyId) {
    targetCompanyId = await getCompanyIdByCode(companyCode);
  }

  const values = {
    companyId: targetCompanyId,
    branchId: null,
    code: payload.code || `WH-${Date.now().toString().slice(-4)}`,
    name: payload.name || "Yangi Ombor",
    type: payload.type || "raw_materials",
    address: payload.address || null,
    zones: Number(payload.zones) || 1,
    capacity: payload.capacity || "100%",
    managerName: payload.managerName || payload.manager || null,
    managerPhone: payload.managerPhone || payload.phone || null,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    updatedAt: new Date(),
  };

  let record;
  if (payload.id && !payload.id.startsWith("LOC-NEW-") && !payload.id.startsWith("WAR-")) {
    const [updated] = await db
      .update(warehouses)
      .set(values)
      .where(and(eq(warehouses.id, payload.id), eq(warehouses.companyId, targetCompanyId)))
      .returning();
    record = updated;
  } else {
    // Har bir tashkilotda faqat bitta ombor bo'ladi.
    const existing = await db.query.warehouses.findFirst({
      where: eq(warehouses.companyId, targetCompanyId),
    });
    if (existing) {
      throw new Error("Tashkilotda allaqachon ombor mavjud: bitta tashkilotga bitta ombor.");
    }
    const [inserted] = await db
      .insert(warehouses)
      .values(values)
      .returning();
    record = inserted;
  }

  await writeAuditLog({
    companyId: targetCompanyId,
    userId: "system",
    userName: "Warehouse Manager",
    entityType: "warehouse",
    entityId: record?.id || "unknown",
    action: payload.id ? "update" : "create",
    newData: record,
  });

  return record;
}

export async function deleteWarehouse(id: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const [deleted] = await db
    .delete(warehouses)
    .where(and(eq(warehouses.id, id), eq(warehouses.companyId, companyId)))
    .returning();
  return deleted;
}

// ─── 2. Stock Balances (Joriy Qoldiqlar Registri) ───────────────────────────────

const numOrUndef = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));

// numeric ustunlar Postgres'dan matn bo'lib keladi — kartochka sonlar bilan ishlaydi
function mapStockBalanceRow(r: typeof warehouseStockBalances.$inferSelect) {
  return {
    ...r,
    stockLevel: Number(r.stockLevel) || 0,
    reserved: Number(r.reserved) || 0,
    available: Number(r.available) || 0,
    reorder: Number(r.reorder) || 0,
    unitPriceUsd: Number(r.unitPriceUsd) || 0,
    unitPriceUzs: numOrUndef(r.unitPriceUzs),
    unitPrice: r.currency === "UZS" ? Number(r.unitPriceUzs) || 0 : Number(r.unitPriceUsd) || 0,
    rollWidthMm: numOrUndef(r.rollWidthMm),
    rollLengthM: numOrUndef(r.rollLengthM),
    location: r.locationName,
    supplier: r.supplier || "",
    batchNo: r.batchNo || "",
    grainDirection: r.grainDirection || undefined,
    expiryDate: r.expiryDate ? r.expiryDate.toISOString().split("T")[0] : undefined,
    paperSpec: (r.paperSpec as Record<string, unknown> | null) || undefined,
  };
}

export async function getStockBalances(companyCode: string = "PRINTGOO", locationName?: string) {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.warehouseStockBalances.findMany({
    where: locationName
      ? and(
          eq(warehouseStockBalances.companyId, companyId),
          eq(warehouseStockBalances.locationName, locationName)
        )
      : eq(warehouseStockBalances.companyId, companyId),
    orderBy: [desc(warehouseStockBalances.updatedAt)],
  });
  return rows.map(mapStockBalanceRow);
}

export async function upsertStockBalance(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const stockLevel = Number(payload.stockLevel) || 0;
  const reserved = Number(payload.reserved) || 0;
  const available = Math.max(0, stockLevel - reserved);
  const reorder =
    payload.reorder === undefined || payload.reorder === null || payload.reorder === ""
      ? 1000
      : Math.max(0, Number(payload.reorder) || 0);

  let computedStatus: "In Stock" | "Low Stock" | "Critical" | "Out of Stock" = "In Stock";
  if (stockLevel <= 0) computedStatus = "Out of Stock";
  else if (available <= reorder * 0.3) computedStatus = "Critical";
  else if (available <= reorder) computedStatus = "Low Stock";

  let resolvedWarehouseId = payload.warehouseId || null;
  if (!resolvedWarehouseId && (payload.locationName || payload.location)) {
    const locName = payload.locationName || payload.location;
    const foundWh = await db.query.warehouses.findFirst({
      where: and(
        eq(warehouses.companyId, companyId),
        eq(warehouses.name, locName)
      ),
    });
    if (foundWh) {
      resolvedWarehouseId = foundWh.id;
    }
  }

  const values = {
    companyId,
    warehouseId: resolvedWarehouseId,
    locationName: payload.locationName || payload.location || "Asosiy ombor",
    itemId: payload.itemId || null,
    sku: payload.sku && !payload.sku.startsWith("tab-") ? payload.sku : await getNextMaterialSku(companyCode),
    name: payload.name || "Material",
    category: payload.category || "Paper & Board",
    sheetFormat: payload.sheetFormat || null,
    grammage: payload.grammage ? Number(payload.grammage) : null,
    stockLevel: stockLevel.toString(),
    reserved: reserved.toString(),
    available: available.toString(),
    unit: payload.unit || "sheets",
    reorder: reorder.toString(),
    unitPriceUsd: (Number(payload.unitPriceUsd) || 0).toString(),
    unitPriceUzs: payload.unitPriceUzs ? String(Number(payload.unitPriceUzs) || 0) : null,
    currency: payload.currency === "UZS" ? "UZS" : "USD",
    supplier: payload.supplier || null,
    batchNo: payload.batchNo || null,
    grainDirection: payload.grainDirection || null,
    rollWidthMm: payload.rollWidthMm ? String(Number(payload.rollWidthMm) || 0) : null,
    rollLengthM: payload.rollLengthM ? String(Number(payload.rollLengthM) || 0) : null,
    expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
    paperSpec: payload.paperSpec && typeof payload.paperSpec === "object" ? payload.paperSpec : null,
    locationShelf: payload.locationShelf || null,
    imageUrl: payload.imageUrl || null,
    lastReceived: payload.lastReceived ? new Date(payload.lastReceived) : new Date(),
    // Holat har doim qoldiq va chegaradan hisoblanadi — klient yuborgan eski holat qabul qilinmaydi
    status: computedStatus,
    updatedAt: new Date(),
  };

  const [record] = await db
    .insert(warehouseStockBalances)
    .values(values)
    .onConflictDoUpdate({
      target: [
        warehouseStockBalances.companyId,
        warehouseStockBalances.locationName,
        warehouseStockBalances.sku,
      ],
      set: values,
    })
    .returning();

  // Agar WMS saqlash katagi (locationShelf) ko'rsatilgan bo'lsa, wms_bin_items bilan sinxronlash
  // Agar WMS saqlash katagi bo'shatilgan bo'lsa, eski birikmani o'chirish
  if (record && !record.locationShelf) {
    try {
      await db.delete(wmsBinItems).where(eq(wmsBinItems.stockBalanceId, record.id));
    } catch (err) {
      console.error("WMS bin items clearing error:", err);
    }
  }

  // Agar WMS saqlash katagi (locationShelf) ko'rsatilgan bo'lsa, wms_bin_items bilan sinxronlash
  if (record && record.locationShelf) {
    try {
      const targetBin = await db.query.wmsBins.findFirst({
        where: and(
          eq(wmsBins.companyId, companyId),
          resolvedWarehouseId ? eq(wmsBins.warehouseId, resolvedWarehouseId) : undefined,
          eq(wmsBins.code, record.locationShelf)
        ),
      });
      if (targetBin) {
        const existingBinItem = await db.query.wmsBinItems.findFirst({
          where: and(
            eq(wmsBinItems.binId, targetBin.id),
            eq(wmsBinItems.sku, record.sku)
          ),
        });
        if (existingBinItem) {
          await db
            .update(wmsBinItems)
            .set({
              stockBalanceId: record.id,
              quantity: record.available,
              unit: record.unit,
              name: record.name,
              updatedAt: new Date(),
            })
            .where(eq(wmsBinItems.id, existingBinItem.id));
        } else {
          await db.insert(wmsBinItems).values({
            companyId,
            warehouseId: targetBin.warehouseId,
            rackId: targetBin.rackId,
            binId: targetBin.id,
            stockBalanceId: record.id,
            sku: record.sku,
            name: record.name,
            category: record.category,
            quantity: record.available,
            unit: record.unit,
            weightKg: "150",
            containerType: "pallet",
            color: "#2563eb",
          });
        }
        await db
          .update(wmsBins)
          .set({
            status: "partial",
            occupancyPct: 70,
            updatedAt: new Date(),
          })
          .where(eq(wmsBins.id, targetBin.id));
      }
    } catch (err) {
      console.error("WMS bin item sync error:", err);
    }
  }

  return record ? mapStockBalanceRow(record) : record;
}

// ─── 3. Warehouse Receipts (Kirim Orderlari) ───────────────────────────────────

export async function getWarehouseReceipts(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.warehouseReceipts.findMany({
    where: eq(warehouseReceipts.companyId, companyId),
    with: {
      items: true,
      warehouse: true,
    },
    orderBy: [desc(warehouseReceipts.receiptDate)],
  });
  return rows.map(mapReceiptRow);
}

// Reyestr va hujjat formasi kutadigan shakl: id = hujjat raqami (RCV-...), UUID alohida saqlanadi
function mapReceiptRow(r: any) {
  const items = (r.items || []).map((i: any) => ({
    id: i.id,
    workOrderId: i.sourceWorkOrderId || undefined,
    itemId: i.itemId,
    finishedGoodId: i.finishedGoodId,
    sourceWorkOrderId: i.sourceWorkOrderId,
    sku: i.sku,
    name: i.name,
    category: i.category,
    sheetFormat: i.sheetFormat || "",
    grammage: i.grammage ?? 0,
    quantity: Number(i.quantity) || 0,
    unit: i.unit,
    unitPriceUsd: Number(i.unitPrice) || 0,
    batchNumber: i.batchNumber,
    notes: i.notes,
  }));
  const units = new Set(items.map((i: any) => i.unit));
  const sameUnit = units.size === 1;
  const material =
    items.length === 0 ? "" : items.length === 1 ? items[0].name : `${items[0].name} +${items.length - 1}`;
  return {
    ...r,
    uuid: r.id,
    id: r.receiptNumber,
    date: r.receiptDate ? new Date(r.receiptDate).toISOString().split("T")[0] : "",
    supplier: r.supplierName,
    material,
    quantity: sameUnit ? items.reduce((s: number, i: any) => s + i.quantity, 0) : null,
    unit: sameUnit ? items[0].unit : "",
    location: r.locationName || r.warehouse?.name || "",
    items,
  };
}

export async function upsertWarehouseReceipt(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawNo = String(payload.receiptNumber || payload.id || "").trim();
  const isDraft = isDraftDocNumber(rawNo);
  const status = payload.status || "Draft";
  const locationName = String(payload.locationName || payload.location || "").trim();
  if (status === "Accepted" && !locationName) throw new Error("Qabul qiluvchi ombor tanlanmagan.");

  const itemsList: any[] = (Array.isArray(payload.items) ? payload.items : []).map((i: any) => ({
    ...i,
    sku: String(i?.sku || "").trim(),
    name: String(i?.name || "").trim(),
  }));
  const badSku = itemsList.find((i) => isPlaceholderSku(i.sku));
  if (badSku) {
    throw new Error(`"${badSku.name || badSku.sku}" qatori uchun material katalogdan tanlanmagan (SKU: ${badSku.sku}).`);
  }
  if (status === "Accepted") {
    if (itemsList.length === 0) throw new Error("Qabul qilish uchun kamida bitta qator bo'lishi kerak.");
    const bad = itemsList.filter((i) => (!i.sku && !i.name) || !(Number(i.quantity) > 0));
    if (bad.length > 0) {
      throw new Error(`Qabul qilish uchun har bir qatorda material va 0 dan katta miqdor bo'lishi kerak: ${bad.map((b) => b.name || "?").join(", ")}`);
    }
  }

  const { receiptRecord, posted } = await db.transaction(async (tx) => {
    // Raqam tranzaksiya ichida, seriya qulfi ostida beriladi: parallel saqlashlar bir xil raqam olmaydi
    let receiptNumber = rawNo;
    if (isDraft) {
      await lockNumbering(tx, companyId, "RCV");
      receiptNumber = await getNextReceiptNumber(companyId, tx);
    }

    // Hujjat qatori qulflanadi: parallel "Qabul qilish" qoldiqni ikki marta oshira olmaydi
    const [existingReceipt] = !isDraft
      ? await tx
          .select()
          .from(warehouseReceipts)
          .where(and(eq(warehouseReceipts.companyId, companyId), eq(warehouseReceipts.receiptNumber, receiptNumber)))
          .for("update")
          .limit(1)
      : [];
    if (!isDraft && !existingReceipt) {
      throw new Error(`${receiptNumber} raqamli kirim hujjati topilmadi.`);
    }
    const wasAccepted = existingReceipt?.status === "Accepted";
    if (wasAccepted && status !== "Accepted") {
      throw new Error(`${receiptNumber} kirimi allaqachon qabul qilingan va qoldiqqa o'tkazilgan. Uni qoralamaga qaytarib bo'lmaydi.`);
    }

    // Qabul qilingan hujjatning qatorlari qoldiq bilan bog'langan — faqat izohlar yangilanadi
    if (wasAccepted) {
      const [updated] = await tx
        .update(warehouseReceipts)
        .set({
          notes: payload.notes ?? existingReceipt.notes,
          receivedBy: payload.receivedBy ?? existingReceipt.receivedBy,
          updatedAt: new Date(),
        })
        .where(eq(warehouseReceipts.id, existingReceipt.id))
        .returning();
      return { receiptRecord: updated, posted: false };
    }

    let totalAmount = 0;
    for (const item of itemsList) {
      totalAmount += (Number(item.quantity) || 0) * (Number(item.unitPrice || item.unitPriceUsd) || 0);
    }

    const receiptValues = {
      companyId,
      warehouseId: payload.warehouseId || null,
      receiptNumber,
      receiptDate: payload.receiptDate || payload.date ? new Date(payload.receiptDate || payload.date) : new Date(),
      supplierName: payload.supplierName || payload.supplier || "Noma'lum yetkazib beruvchi",
      poNumber: payload.poNumber || null,
      locationName: locationName || null,
      status: status as any,
      receivedBy: payload.receivedBy || null,
      notes: payload.notes || null,
      totalAmount: totalAmount.toFixed(2),
      // Xomashyo qatorlari narxi USD da kiritiladi (unitPriceUsd); valyuta aniq berilmasa shunga qarab
      currency: payload.currency || (itemsList.some((i) => i.unitPriceUsd !== undefined) ? "USD" : "UZS"),
      updatedAt: new Date(),
    };

    const [record] = existingReceipt
      ? await tx.update(warehouseReceipts).set(receiptValues).where(eq(warehouseReceipts.id, existingReceipt.id)).returning()
      : await tx
          .insert(warehouseReceipts)
          .values(receiptValues)
          .onConflictDoUpdate({
            target: [warehouseReceipts.companyId, warehouseReceipts.receiptNumber],
            set: receiptValues,
          })
          .returning();

    const shouldPostStock = status === "Accepted";
    // Qoralamada qatorlar o'chirilgan bo'lsa ham eski qatorlar qolib ketmasin
    await tx.delete(warehouseReceiptItems).where(eq(warehouseReceiptItems.receiptId, record.id));
    // SKU siz yangi material: tasdiqlashda nomi bo'yicha mavjud kartaga bog'lanadi yoki MAT-XXXX beriladi
    const resolveSku = shouldPostStock ? await createReceiptSkuResolver(tx, companyId) : null;
    {
      for (const item of itemsList) {
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice || item.unitPriceUsd) || 0;
        const sku = item.sku || (resolveSku ? await resolveSku(item.name) : "");

        await tx.insert(warehouseReceiptItems).values({
          receiptId: record.id,
          itemId: item.itemId || null,
          finishedGoodId: item.finishedGoodId && UUID_RE.test(item.finishedGoodId) ? item.finishedGoodId : null,
          sourceWorkOrderId: item.sourceWorkOrderId || null,
          sku,
          name: item.name || "Noma'lum tovar",
          category: item.category || "Paper & Board",
          quantity: qty.toString(),
          unit: item.unit || "sheets",
          unitPrice: unitPrice.toString(),
          totalPrice: (qty * unitPrice).toFixed(2),
          sheetFormat: item.sheetFormat || null,
          grammage: item.grammage ? Number(item.grammage) : null,
          batchNumber: item.batchNumber || null,
          notes: item.notes || null,
        });

        // 1C Jamg'arish Registri: hujjat birinchi marta tasdiqlanganda (Accepted) qoldiqni oshirish
        if (shouldPostStock) {
          await applyStockBalanceDelta({
            exec: tx,
            companyId,
            locationName,
            sku,
            name: item.name,
            category: item.category,
            deltaQty: qty,
            unit: item.unit,
            unitPriceUsd: unitPrice,
            sheetFormat: item.sheetFormat,
            grammage: item.grammage ? Number(item.grammage) : undefined,
          });
        }
      }
    }

    return { receiptRecord: record, posted: shouldPostStock };
  });

  // Biznes bildirishnoma triggeri (Ombor kirimi) — tranzaksiya muvaffaqiyatli yakunlangandan keyin
  if (posted) {
    try {
      await emitNotification(
        {
          dedupKey: `receipt-posted:${receiptRecord.receiptNumber}`,
          severity: "info",
          category: "warehouse",
          eventType: "stock_receipt:posted",
          entityCode: receiptRecord.receiptNumber,
          title: `Ombor kirimi o'tkazildi: ${receiptRecord.receiptNumber}`,
          description: `${payload.supplierName || payload.supplier || "Yetkazib beruvchi"} dan xomashyo kirim qilindi (${locationName}).`,
          link: { module: "warehouse", subModule: "receipts" },
          targetTab: {
            id: `doc-receipt-${receiptRecord.receiptNumber}`,
            title: `${receiptRecord.receiptNumber} (Kirim)`,
            type: "warehouse-receipt",
            module: "warehouse",
          },
        },
        companyCode
      );
    } catch (_) {}
  }

  const allReceipts = await getWarehouseReceipts(companyCode);
  return {
    success: true,
    receipt: receiptRecord,
    receiptNumber: receiptRecord.receiptNumber,
    allReceipts,
  };
}

// ─── 4. Warehouse Shipments (Chiqim Orderlari) ─────────────────────────────────

export async function getWarehouseShipments(companyCode: string = "ALL") {
  let whereClause = undefined;
  if (companyCode && companyCode !== "ALL") {
    const companyId = await getCompanyIdByCode(companyCode);
    whereClause = eq(warehouseShipments.companyId, companyId);
  }

  const rows = await db.query.warehouseShipments.findMany({
    where: whereClause,
    with: {
      items: true,
      warehouse: true,
      manifest: true,
      company: true,
    },
    orderBy: [desc(warehouseShipments.shipmentDate)],
  });

  return rows.map((s) => {
    const items = (s.items || []).map((it) => ({
      ...it,
      id: it.id,
      sku: it.sku,
      name: it.name,
      quantity: Number(it.quantity) || 0,
      orderQty: Number(it.quantity) || 0,
      shippedQty: Number(it.quantity) || 0,
      unit: it.unit || "pcs",
      unitPrice: Number(it.unitPrice) || 0,
      totalPrice: Number(it.totalPrice) || 0,
      finishedGoodId: it.finishedGoodId || undefined,
      tradingCatalogId: (it as any).tradingCatalogId || undefined,
      accountCode: ((it as any).accountCode as "2810" | "2910" | "1010") || "2810",
      sourceWorkOrderId: it.sourceWorkOrderId || undefined,
      notes: it.notes || "",
    }));
    const totalQty = items.reduce((sum, it) => sum + it.shippedQty, 0);
    const productSummary =
      items.length > 0
        ? items.map((it) => it.name).join(", ")
        : "Bosma mahsulot";

    return {
      ...s,
      id: s.shipmentNumber || s.id,
      dbId: s.id,
      companyId: s.companyId,
      companyName: (s as any).company?.name || undefined,
      warehouseId: s.warehouseId || undefined,
      date: s.shipmentDate ? new Date(s.shipmentDate).toISOString().split("T")[0] : "",
      customer: s.customerName || "Mijoz",
      workOrder: s.workOrderId || "-",
      tradingSaleId: s.tradingSaleId || undefined,
      product: productSummary,
      quantity: totalQty,
      unit: items[0]?.unit || "pcs",
      from: s.fromLocationName || "Asosiy ombor",
      carrier: s.carrier || "PrintGoo Fleet #1",
      trackingNo: s.trackingNo || "",
      manifestId: s.manifestId || undefined,
      manifestNumber: (s as any).manifest?.manifestNumber || undefined,
      items,
    };
  });
}

// ─── 4b. Chiqimni saqlash: holat mashinasi + rezerv + tranzaksiya ──────────────

export interface ShipmentActor {
  id: string;
  name: string;
}

export interface ShipmentTxContext {
  /** Commit'dan keyin bajariladigan tashqi effektlar (bildirishnomalar) */
  afterCommit: Array<() => Promise<void>>;
  actor?: ShipmentActor | null;
}

/** Mijozni aniqlash: payload.clientId > mavjud > nom (registrsiz) > savdo hujjati > ishlab chiqarish buyurtmasi */
async function resolveShipmentClientId(
  tx: DbExec,
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  existing: { clientId: string | null; customerName: string | null; tradingSaleId: string | null; workOrderId: string | null } | null
): Promise<string | null> {
  for (const candidate of [payload.clientId, existing?.clientId]) {
    const row = await resolveClient(tx, companyId, { id: candidate ? String(candidate) : null });
    if (row) return row.id;
  }

  const name = String(payload.customerName || payload.customer || existing?.customerName || "").trim();
  if (name && !name.startsWith("—")) {
    const byName = await resolveClient(tx, companyId, { name });
    if (byName) return byName.id;
  }

  const saleKey = payload.tradingSaleId || existing?.tradingSaleId;
  if (saleKey) {
    const sale = await tx.query.tradingSales.findFirst({
      where: and(
        eq(tradingSales.companyId, companyId),
        UUID_RE.test(String(saleKey))
          ? or(eq(tradingSales.id, String(saleKey)), eq(tradingSales.docNo, String(saleKey)))
          : eq(tradingSales.docNo, String(saleKey))
      ),
    });
    if (sale?.clientId) return sale.clientId;
  }

  const woKey = payload.workOrderId || payload.workOrder || existing?.workOrderId;
  if (woKey && !String(woKey).startsWith("—")) {
    const wo = await tx.query.workOrders.findFirst({
      where: and(eq(workOrders.companyId, companyId), eq(workOrders.docNo, String(woKey))),
    });
    if (wo?.clientId) return wo.clientId;
  }
  return null;
}

/**
 * Currency the shipment is invoiced in: the currency its lines were priced in, i.e. that of the
 * work orders being shipped. Lines from orders in different currencies cannot share one invoice.
 * Without an order the client's own currency applies (undefined → upsertDeliveryAct decides).
 */
async function resolveShipmentCurrency(
  tx: DbExec,
  companyId: string,
  workOrderNo: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]
): Promise<string | undefined> {
  const woNos = [
    ...new Set(
      [workOrderNo, ...items.map((it) => it?.sourceWorkOrderId)]
        .map((v) => String(v || "").trim())
        .filter((v) => v && !v.startsWith("—"))
    ),
  ];
  if (woNos.length === 0) return undefined;
  const orders = await tx.query.workOrders.findMany({
    where: and(eq(workOrders.companyId, companyId), inArray(workOrders.docNo, woNos)),
    columns: { docNo: true, currency: true },
  });
  const currencies = [...new Set(orders.map((o) => (o.currency || "UZS").toUpperCase()))];
  if (currencies.length > 1) {
    throw new ShipmentError(
      `Chiqimdagi buyurtmalar turli valyutada narxlangan (${currencies.join(", ")}). Har bir valyuta uchun alohida chiqim rasmiylashtiring.`
    );
  }
  return currencies[0];
}

/**
 * Who receives the goods and where. The payer is the client; the consignee may be its branch or
 * warehouse, so these are kept on the shipment. An empty field falls back to what was saved before,
 * then to the client card (delivery address, else legal address; the primary contact).
 */
async function resolveShipmentRecipient(
  tx: DbExec,
  clientId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  existing: { recipientName?: string | null; recipientPhone?: string | null; deliveryAddress?: string | null } | null | undefined
) {
  const pick = (key: "recipientName" | "recipientPhone" | "deliveryAddress") => {
    const v = payload?.[key];
    return (typeof v === "string" ? v.trim() : "") || existing?.[key] || null;
  };
  let recipientName = pick("recipientName");
  let recipientPhone = pick("recipientPhone");
  let deliveryAddress = pick("deliveryAddress");
  if (clientId && (!recipientName || !deliveryAddress)) {
    const client = await tx.query.clients.findFirst({ where: eq(clients.id, clientId) });
    const contacts = await tx.query.clientContacts.findMany({ where: eq(clientContacts.clientId, clientId) });
    const contact = contacts.find((c) => c.isPrimary) || contacts[0];
    if (!deliveryAddress) deliveryAddress = client?.deliveryAddress || client?.legalAddress || null;
    if (!recipientName && contact) {
      recipientName = contact.name;
      recipientPhone = recipientPhone || contact.phone || null;
    }
  }
  return { recipientName, recipientPhone, deliveryAddress };
}

async function findDeliveryActByKey(tx: DbExec, companyId: string, key: string | null | undefined) {
  if (!key) return null;
  return (
    (await tx.query.deliveryActs.findFirst({
      where: and(
        eq(deliveryActs.companyId, companyId),
        UUID_RE.test(key) ? or(eq(deliveryActs.id, key), eq(deliveryActs.docNo, key)) : eq(deliveryActs.docNo, key)
      ),
    })) || null
  );
}

/** Shu chiqim bilan bog'liq WO qutilarining holatini o'zgartirish */
async function updateWorkOrderBoxes(
  tx: DbExec,
  companyId: string,
  shipmentNumber: string,
  mode: "dispatch" | "reset",
  scannedCodes: Set<string>
) {
  if (mode === "dispatch" && scannedCodes.size === 0) return;
  // Only orders whose boxes mention the shipment (storno) or one of the scanned codes are loaded,
  // not every order of the company; the exact match is still made box by box below.
  const needles = mode === "reset" ? [shipmentNumber] : [...scannedCodes];
  const likeOf = (v: string) => `%${v.toUpperCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const allWos = await tx.query.workOrders.findMany({
    where: and(
      eq(workOrders.companyId, companyId),
      or(...needles.filter(Boolean).map((n) => sql`upper(${workOrders.packagingData}::text) like ${likeOf(n)}`))
    ),
  });
  for (const wo of allWos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkg = wo.packagingData as any;
    if (!pkg || !Array.isArray(pkg.boxes)) continue;
    let changed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boxes = pkg.boxes.map((box: any) => {
      if (mode === "reset") {
        if (box.shipmentId === shipmentNumber && box.status === "dispatched") {
          changed = true;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { shipmentId: _omit, ...rest } = box;
          // Storno: the box goes back to the FG warehouse, not to the shop.
          return { ...rest, status: "in_stock" };
        }
        return box;
      }
      const bCode = String(box.barcode || "").trim().toUpperCase();
      const bxCode = String(box.boxCode || "").trim().toUpperCase();
      if (scannedCodes.has(bCode) || scannedCodes.has(bxCode)) {
        changed = true;
        return { ...box, status: "dispatched", shipmentId: shipmentNumber };
      }
      return box;
    });
    if (changed) {
      await tx
        .update(workOrders)
        .set({ packagingData: { ...pkg, boxes }, updatedAt: new Date() })
        .where(eq(workOrders.id, wo.id));
    }
  }
}

/**
 * Boxes the shop handed over become "in_stock" up to the quantity the warehouse confirmed;
 * on a shortage the boxes left over go back to "ready" so the shop can recount and hand them over again.
 */
async function receiveWorkOrderBoxes(tx: DbExec, companyId: string, workOrderNo: string, confirmedQty: number) {
  const wo = await tx.query.workOrders.findFirst({
    where: and(eq(workOrders.companyId, companyId), eq(workOrders.docNo, workOrderNo)),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = wo?.packagingData as any;
  if (!wo || !pkg || !Array.isArray(pkg.boxes)) return;
  let left = confirmedQty;
  const now = new Date().toISOString();
  let changed = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boxes = pkg.boxes.map((box: any) => {
    if (box.status !== "handed") return box;
    changed = true;
    const qty = Number(box.quantity) || 0;
    if (left + 1e-9 >= qty) {
      left -= qty;
      return { ...box, status: "in_stock", receivedAt: now };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { handedOverAt: _h, ...rest } = box;
    return { ...rest, status: "ready" };
  });
  if (changed) {
    await tx
      .update(workOrders)
      .set({ packagingData: { ...pkg, boxes }, updatedAt: new Date() })
      .where(eq(workOrders.id, wo.id));
  }
}

/**
 * Chiqimni saqlash va holat o'tishini tranzaksiya ichida bajarish.
 * Effektlar tartibi: (1) eski rezervni bo'shatish → (2) storno → (3) o'tkazish → (4) yangi rezerv.
 * Har qanday xatoda butun tranzaksiya bekor bo'ladi.
 */
export async function upsertWarehouseShipmentTx(
  tx: DbExec,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  companyCode: string,
  ctx: ShipmentTxContext
) {
  const effectiveCompanyCode = companyCode && companyCode !== "ALL" ? companyCode : "PRINTGOO";
  const companyId =
    payload.companyId && UUID_RE.test(String(payload.companyId))
      ? String(payload.companyId)
      : await getCompanyIdByCode(effectiveCompanyCode);

  const rawNo = String(payload.shipmentNumber || payload.id || "").trim();
  const isDraftNo =
    !rawNo ||
    rawNo.startsWith("draft-") ||
    rawNo.startsWith("SHP-NEW-") ||
    rawNo.startsWith("tab-") ||
    rawNo === "NEW" ||
    rawNo.includes("Qoralama") ||
    rawNo.includes("Yangi");
  const shipmentNumber = isDraftNo ? await getNextShipmentNumber(companyId) : rawNo;

  // Mavjud hujjatni qulflab o'qish (parallel o'tishlarga qarshi)
  const [existing] = isDraftNo
    ? []
    : await tx
        .select()
        .from(warehouseShipments)
        .where(and(eq(warehouseShipments.companyId, companyId), eq(warehouseShipments.shipmentNumber, shipmentNumber)))
        .for("update")
        .limit(1);
  const existingItems = existing
    ? await tx.query.warehouseShipmentItems.findMany({ where: eq(warehouseShipmentItems.shipmentId, existing.id) })
    : [];

  const prevStatus: ShipmentStatus = existing ? normalizeStatus(existing.status) : "Draft";
  const nextStatus: ShipmentStatus = normalizeStatus(payload.status || existing?.status || "Draft");
  assertTransition(prevStatus, nextStatus);
  const prevPhase = phaseOf(prevStatus);
  const nextPhase = phaseOf(nextStatus);
  const isPosting = nextPhase === "posted" && prevPhase !== "posted";
  const isStorno = prevPhase === "posted" && nextPhase !== "posted";

  // O'tkazilgan hujjat qatorlari va ombori muzlatilgan
  const frozen = prevPhase === "posted" && nextPhase === "posted";
  const shipmentType = frozen
    ? existing!.shipmentType
    : payload.shipmentType || existing?.shipmentType || "CustomerDelivery";
  const fromLocationName = frozen
    ? existing!.fromLocationName || "Asosiy ombor"
    : payload.fromLocationName || payload.from || existing?.fromLocationName || "Asosiy ombor";
  const workOrderId = payload.workOrderId || payload.workOrder || existing?.workOrderId || null;

  const incomingItems: unknown[] | null = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : null;
  const existingItemsNum = existingItems.map((it) => ({ ...it, quantity: Number(it.quantity) || 0 }));
  const effectiveItems = frozen ? existingItemsNum : incomingItems ?? existingItemsNum;

  const oldLines = normalizeShipmentLines(existingItemsNum, { workOrderId: existing?.workOrderId });
  const newLines = normalizeShipmentLines(effectiveItems, { workOrderId });
  const oldCtx = {
    companyId,
    fromLocationName: existing?.fromLocationName || fromLocationName,
    shipmentType: existing?.shipmentType || shipmentType,
  };
  const newCtx = { companyId, fromLocationName, shipmentType };

  const customerName = String(payload.customerName || payload.customer || existing?.customerName || "").trim();
  const clientId = await resolveShipmentClientId(tx, companyId, payload, existing || null);

  if (nextPhase !== "free" && !frozen) {
    assertLinesValid(newLines);
    if (shipmentType === "CustomerDelivery") {
      if (!customerName || customerName.startsWith("—")) {
        throw new ShipmentError("Qabul qiluvchi (mijoz) ko'rsatilmagan.");
      }
      if (!clientId) {
        throw new ShipmentError(unknownClientMessage(customerName));
      }
    }
  }

  // ── Qoldiq effektlari ──
  if (prevPhase === "holding") await reserveLines(tx, oldCtx, oldLines, -1);
  if (isStorno) {
    if (prevStatus === "Delivered") {
      throw new ShipmentError("Yetkazilgan chiqimni bekor qilib bo'lmaydi. Qaytarish hujjatini rasmiylashtiring.", 409);
    }
    await postLines(tx, oldCtx, oldLines, 1);
  }
  if (isPosting) await postLines(tx, newCtx, newLines, -1);
  if (nextPhase === "holding") await reserveLines(tx, newCtx, newLines, 1);

  // ── Yuk oluvchi: kiritilgani, avval saqlangani, bo'lmasa mijoz kartasidan (yetkazish manzili, asosiy kontakt) ──
  const recipient = await resolveShipmentRecipient(tx, clientId, payload, existing);

  // ── Hujjat yozuvi ──
  const now = new Date();
  const shipmentValues = {
    ...recipient,
    companyId,
    warehouseId: payload.warehouseId || existing?.warehouseId || null,
    manifestId: payload.manifestId || existing?.manifestId || null,
    originSource: payload.originSource || existing?.originSource || "direct",
    shipmentNumber,
    shipmentDate:
      payload.shipmentDate || payload.date
        ? new Date(payload.shipmentDate || payload.date)
        : existing?.shipmentDate || now,
    shipmentType,
    clientId,
    customerName: customerName || "Mijoz",
    workOrderId,
    deliveryActId: payload.deliveryActId || existing?.deliveryActId || null,
    tradingSaleId: payload.tradingSaleId || existing?.tradingSaleId || null,
    fromLocationName,
    status: nextStatus,
    carrier: payload.carrier || existing?.carrier || null,
    driverName: payload.driverName || existing?.driverName || null,
    trackingNo: payload.trackingNo || existing?.trackingNo || null,
    shippedBy: payload.shippedBy || existing?.shippedBy || ctx.actor?.name || null,
    notes: payload.notes || existing?.notes || null,
    reservedAt: nextPhase === "holding" ? existing?.reservedAt || now : null,
    dispatchedAt: nextPhase === "posted" ? existing?.dispatchedAt || now : null,
    deliveredAt: nextStatus === "Delivered" ? existing?.deliveredAt || now : null,
    cancelledAt: nextStatus === "Cancelled" ? now : null,
    updatedAt: now,
  };

  const [shipmentRecord] = await tx
    .insert(warehouseShipments)
    .values(shipmentValues)
    .onConflictDoUpdate({
      target: [warehouseShipments.companyId, warehouseShipments.shipmentNumber],
      set: shipmentValues,
    })
    .returning();

  if (!frozen && incomingItems) {
    await tx.delete(warehouseShipmentItems).where(eq(warehouseShipmentItems.shipmentId, shipmentRecord.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of incomingItems as any[]) {
      const qty = Number(item.quantity ?? item.shippedQty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      await tx.insert(warehouseShipmentItems).values({
        shipmentId: shipmentRecord.id,
        itemId: item.itemId && UUID_RE.test(String(item.itemId)) ? item.itemId : null,
        finishedGoodId: item.finishedGoodId || null,
        tradingCatalogId: item.tradingCatalogId || null,
        accountCode: resolveShipmentAccount(item, shipmentType),
        sourceWorkOrderId: item.sourceWorkOrderId || workOrderId || null,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        name: item.name || item.product || "Mahsulot",
        quantity: qty.toString(),
        unit: item.unit || "pcs",
        unitPrice: unitPrice.toString(),
        totalPrice: (qty * unitPrice).toString(),
        notes: item.notes || null,
      });
    }
  }

  // ── Qutilar (WO packagingData) ──
  if (isStorno) {
    await updateWorkOrderBoxes(tx, companyId, shipmentNumber, "reset", new Set());
  }
  if (isPosting && Array.isArray(payload.scannedBoxes) && payload.scannedBoxes.length > 0) {
    const codes = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload.scannedBoxes.map((b: any) => String(typeof b === "string" ? b : b.barcode || b.boxCode || "").trim().toUpperCase())
    );
    await updateWorkOrderBoxes(tx, companyId, shipmentNumber, "dispatch", codes);
  }

  // ── Savdo hujjati (2910) ──
  const saleKey = shipmentValues.tradingSaleId;
  if (saleKey) {
    const isUuidSale = UUID_RE.test(String(saleKey).trim());
    const [sale] = await tx
      .update(tradingSales)
      .set({
        linkedShipmentId: shipmentRecord.shipmentNumber,
        ...(isPosting ? { status: "Posted" as const } : {}),
        updatedAt: now,
      })
      .where(
        and(
          eq(tradingSales.companyId, companyId),
          isUuidSale
            ? or(eq(tradingSales.docNo, saleKey), eq(tradingSales.id, saleKey))
            : eq(tradingSales.docNo, saleKey)
        )
      )
      .returning();
    if (sale && isPosting) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await applySalePostedEffects(companyId, sale.id, sale, effectiveItems as any, tx);
    }
    if (sale && isStorno) {
      await reverseSalePostedEffects(companyId, sale, tx);
    }
  }

  // ── Schet-faktura (SF) ──
  let deliveryActDocNo: string | null = null;
  const linkedAct = await findDeliveryActByKey(tx, companyId, shipmentRecord.deliveryActId);
  if (linkedAct) deliveryActDocNo = linkedAct.docNo;

  if (isStorno && linkedAct) {
    try {
      await cancelDeliveryAct(companyId, linkedAct.docNo, tx);
    } catch (e) {
      throw new ShipmentError(e instanceof Error ? e.message : String(e), 409);
    }
  }

  const invoiceable = shipmentType === "CustomerDelivery" || shipmentType === "MaterialSale";
  // Accessories of a linked trading sale are sold by its seller (a YTT entity) and billed by the sale:
  // the company's invoice leaves them out, or the client would owe them twice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyInvoiceLines = (effectiveItems as any[]).filter(
    (it) => !(saleKey && resolveShipmentAccount(it, shipmentType) === "2910")
  );
  if (isPosting && invoiceable && companyInvoiceLines.length > 0 && (!linkedAct || linkedAct.status === "cancelled")) {
    // The order's selling price includes VAT: the invoice keeps that total and carries the company's
    // VAT inside it. Lines are stored net of VAT, as the SF screen adds each line's VAT on top.
    const vatRate = await getCompanyVatRate(tx, companyId);
    const vatFactor = 1 + vatRate / 100;
    const invoiceItems = companyInvoiceLines.map((it, idx) => {
      const q = Number(it.quantity ?? it.shippedQty) || 0;
      const gross = Number(it.unitPrice) || 0;
      const net = Number((gross / vatFactor).toFixed(4));
      const lineGross = q * gross;
      const lineNet = Number((lineGross / vatFactor).toFixed(2));
      return {
        id: `act-item-${idx + 1}`,
        sku: it.sku || `SKU-${idx + 1}`,
        name: it.name || it.product || "Mahsulot",
        unit: it.unit || "dona",
        quantity: q,
        unitPrice: net,
        totalPrice: lineNet,
        grossTotal: lineGross,
        vatRate,
        vatAmount: Number((lineGross - lineNet).toFixed(2)),
      };
    });
    const total = Number(invoiceItems.reduce((acc, it) => acc + it.grossTotal, 0).toFixed(2));
    const subtotal = Number((total / vatFactor).toFixed(2));
    const actCurrency = await resolveShipmentCurrency(tx, companyId, workOrderId, companyInvoiceLines);
    const act = await upsertDeliveryAct(
      {
        // Bekor qilingan SF bo'lsa — o'sha raqam qayta faollashtiriladi
        id: linkedAct?.docNo,
        date: new Date(shipmentValues.shipmentDate).toISOString().split("T")[0],
        workOrderId: workOrderId || undefined,
        clientId,
        customer: shipmentValues.customerName,
        product: invoiceItems.map((i) => i.name).join(", "),
        quantity: invoiceItems.reduce((acc, i) => acc + i.quantity, 0),
        unit: invoiceItems[0]?.unit || "dona",
        subtotal,
        vatRate,
        vatAmount: Number((total - subtotal).toFixed(2)),
        totalAmount: total,
        currency: actCurrency,
        warehouse: fromLocationName,
        carrier: shipmentValues.carrier || undefined,
        driverName: shipmentValues.driverName || undefined,
        status: "Pending Signature",
        linkedShipmentId: shipmentRecord.shipmentNumber,
        linkedShipmentUuid: shipmentRecord.id,
        notes: `Ombor chiqimi ${shipmentRecord.shipmentNumber} asosida avtomatik shakllantirildi`,
        items: invoiceItems,
      },
      companyId,
      { exec: tx, afterCommit: ctx.afterCommit }
    );
    deliveryActDocNo = act.docNo;
  }

  if (deliveryActDocNo && shipmentRecord.deliveryActId !== deliveryActDocNo) {
    // UI aktni docNo (SF-YY-NNNN) bo'yicha topadi — UUID emas, docNo saqlaymiz
    await tx
      .update(warehouseShipments)
      .set({ deliveryActId: deliveryActDocNo, updatedAt: now })
      .where(eq(warehouseShipments.id, shipmentRecord.id));
    shipmentRecord.deliveryActId = deliveryActDocNo;
  }

  // ── Audit ──
  if (prevStatus !== nextStatus || !existing) {
    await writeAuditLog(
      {
        companyId,
        userId: ctx.actor?.id || "system",
        userName: ctx.actor?.name || "Warehouse",
        entityType: "warehouse_shipment",
        entityId: shipmentRecord.shipmentNumber,
        action: isPosting ? "post" : isStorno ? "unpost" : existing ? "update" : "create",
        oldData: existing ? { status: prevStatus } : null,
        newData: { status: nextStatus, items: newLines.length, deliveryActId: shipmentRecord.deliveryActId },
      },
      tx as typeof db
    );
  }

  return {
    shipment: shipmentRecord,
    shipmentNumber: shipmentRecord.shipmentNumber,
    deliveryActId: shipmentRecord.deliveryActId || null,
    prevStatus,
    nextStatus,
  };
}

/** Ommaviy API: chiqimni bitta tranzaksiyada saqlaydi, commit'dan keyin bildirishnomalarni yuboradi */
export async function upsertWarehouseShipment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  companyCode: string = "ALL",
  actor?: ShipmentActor | null
) {
  const ctx: ShipmentTxContext = { afterCommit: [], actor };
  const result = await db.transaction((tx) => upsertWarehouseShipmentTx(tx, payload, companyCode, ctx));
  await runAfterCommit(ctx);

  const allShipments = await getWarehouseShipments(companyCode);
  return { success: true, ...result, allShipments };
}

async function runAfterCommit(ctx: ShipmentTxContext) {
  for (const fn of ctx.afterCommit) {
    try {
      await fn();
    } catch (e) {
      console.warn("[shipment] afterCommit effect failed:", e);
    }
  }
}


// ─── 5. Warehouse Movements (Ichki Ko'chirishlar) ──────────────────────────────

export async function getWarehouseMovements(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.warehouseMovements.findMany({
    where: eq(warehouseMovements.companyId, companyId),
    orderBy: [desc(warehouseMovements.movementDate)],
  });

  return rows.map((r) => {
    let parsedNote = r.reason || "";
    let movementType = "Transfer";
    let pressMachine = "";
    let items: any[] = [];

    if (r.reason && r.reason.startsWith("{") && r.reason.endsWith("}")) {
      try {
        const meta = JSON.parse(r.reason);
        parsedNote = meta.note || "";
        movementType = meta.movementType || movementType;
        pressMachine = meta.pressMachine || "";
        if (Array.isArray(meta.items) && meta.items.length > 0) {
          items = meta.items;
        }
      } catch (_) {}
    }

    if (movementType === "Transfer") {
      if (r.movementNumber.startsWith("ISS-")) movementType = "ProductionIssue";
      else if (r.movementNumber.startsWith("RET-")) movementType = "ProductionReturn";
      else if (r.movementNumber.startsWith("CUT-")) movementType = "CuttingReturn";
      else if (r.movementNumber.startsWith("WOF-")) movementType = "WriteOff";
    }

    if (items.length === 0 && r.materialName) {
      items = [
        {
          id: `item-${r.id}`,
          sku: r.materialSku || "",
          name: r.materialName || "Material",
          sheetFormat: r.sheetFormat || "",
          quantity: Number(r.quantity) || 0,
          receivedQty: Number(r.receivedQty) || Number(r.quantity) || 0,
          unit: r.unit || "sheets",
          notes: parsedNote,
        },
      ];
    }

    return {
      ...r,
      id: r.movementNumber || r.id,
      date: r.movementDate ? new Date(r.movementDate).toISOString().split("T")[0] : "",
      from: r.fromLocationName,
      to: r.toLocationName,
      material: r.materialName,
      reason: parsedNote,
      movementType,
      pressMachine: pressMachine || (movementType === "ProductionIssue" ? r.toLocationName : r.fromLocationName),
      items,
    };
  });
}

/** "700×1000", "700x1000 mm", "70*100" → maydon; o'qib bo'lmasa 0. */
function parseSheetArea(format?: string | null): number {
  const m = (format || "").match(/(\d+(?:[.,]\d+)?)\s*[x×х*]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return 0;
  return Number(m[1].replace(",", ".")) * Number(m[2].replace(",", "."));
}

export async function upsertWarehouseMovement(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rawCandidate = String(payload.movementNumber || payload.id || "").trim();
  const isDraft = isDraftDocNumber(rawCandidate);

  const movementType = payload.movementType || "Transfer";
  let prefix: "ISS" | "RET" | "WOF" | "MOV" = "MOV";
  if (movementType === "ProductionIssue") prefix = "ISS";
  else if (movementType === "ProductionReturn" || movementType === "CuttingReturn") prefix = "RET";
  else if (movementType === "WriteOff") prefix = "WOF";

  const status = payload.status || "Pending";

  const qty = Number(payload.quantity) || 0;
  const receivedQty = Number(payload.receivedQty) || (status === "Completed" ? qty : 0);
  const itemsList: any[] = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : [
    {
      sku: payload.materialSku,
      name: payload.materialName || payload.material || "Material",
      sheetFormat: payload.sheetFormat,
      quantity: qty,
      receivedQty: receivedQty,
      unit: payload.unit || "sheets",
    }
  ];

  const values = {
    companyId,
    movementNumber: rawCandidate,
    movementDate: payload.movementDate || payload.date ? new Date(payload.movementDate || payload.date) : new Date(),
    fromWarehouseId: payload.fromWarehouseId || null,
    toWarehouseId: payload.toWarehouseId || null,
    fromLocationName: String(payload.fromLocationName || payload.from || "").trim(),
    toLocationName: String(payload.toLocationName || payload.to || "").trim(),
    itemId: payload.itemId || null,
    materialSku: payload.materialSku || itemsList[0]?.sku || null,
    materialName: payload.materialName || payload.material || itemsList.map((i: any) => i.name).join(", ") || "Material",
    sheetFormat: payload.sheetFormat || itemsList[0]?.sheetFormat || null,
    quantity: qty.toString(),
    receivedQty: receivedQty.toString(),
    unit: payload.unit || itemsList[0]?.unit || "sheets",
    reason: JSON.stringify({
      note: typeof payload.reason === "string" ? payload.reason : "",
      movementType,
      pressMachine: payload.pressMachine || "",
      items: itemsList,
    }),
    status: status as any,
    operator: payload.operator || null,
    workOrderId: payload.workOrderId || null,
    updatedAt: new Date(),
  };

  const badSku = itemsList.find((l) => isPlaceholderSku(l?.sku));
  if (badSku) {
    throw new Error(`"${badSku.name || badSku.sku}" qatori uchun material katalogdan tanlanmagan (SKU: ${badSku.sku}).`);
  }
  const isOutgoing = movementType === "Transfer" || movementType === "ProductionIssue" || movementType === "WriteOff";
  const isIncoming = movementType === "Transfer" || movementType === "ProductionReturn" || movementType === "CuttingReturn";
  if (status === "Completed") {
    if (isOutgoing && !values.fromLocationName) throw new Error("Chiqim qilinadigan ombor tanlanmagan.");
    if (isIncoming && !values.toLocationName) throw new Error("Qabul qiluvchi ombor tanlanmagan.");
  }
  if (movementType === "Transfer" && status === "Completed" && values.fromLocationName === values.toLocationName) {
    throw new Error("Ko'chirishda jo'natuvchi va qabul qiluvchi ombor bir xil bo'lishi mumkin emas.");
  }

  const movementRecord = await db.transaction(async (tx) => {
    // Raqam tranzaksiya ichida, seriya qulfi ostida beriladi: parallel saqlashlar bir xil raqam olmaydi
    let movementNumber = rawCandidate;
    if (isDraft) {
      await lockNumbering(tx, companyId, prefix);
      movementNumber = await getNextMovementNumber(prefix, companyId, tx);
    }
    values.movementNumber = movementNumber;

    // Hujjat qatorini qulflash: parallel "Yakunlash" qoldiqni ikki marta o'zgartira olmaydi
    const [existingMovement] = !isDraft
      ? await tx
          .select()
          .from(warehouseMovements)
          .where(and(eq(warehouseMovements.companyId, companyId), eq(warehouseMovements.movementNumber, movementNumber)))
          .for("update")
          .limit(1)
      : [];
    if (!isDraft && !existingMovement) {
      throw new Error(`${movementNumber} raqamli ombor harakati topilmadi.`);
    }
    if (existingMovement?.status === "Completed") {
      if (status !== "Completed") {
        throw new Error(`${movementNumber} harakati allaqachon yakunlangan va qoldiqqa o'tkazilgan. Uni o'zgartirib bo'lmaydi.`);
      }
      // Yakunlangan hujjat qayta yuborilsa — qoldiqqa takroran ta'sir qilmasdan qaytaramiz
      return existingMovement;
    }

    const [record] = await tx
      .insert(warehouseMovements)
      .values(values)
      .onConflictDoUpdate({
        target: [warehouseMovements.companyId, warehouseMovements.movementNumber],
        set: values,
      })
      .returning();

    if (status !== "Completed") return record;

    const lines = itemsList
      .map((line, sourceIndex) => {
        const lineQty = Number(line.quantity) || 0;
        const hasRcv = line.receivedQty !== undefined && line.receivedQty !== null && line.receivedQty !== "";
        const rcv = Number(line.receivedQty);
        return {
          sourceIndex,
          valuationPercent: line.valuationPercent,
          sku: String(line.sku || values.materialSku || ""),
          name: line.name || values.materialName,
          unit: line.unit || values.unit,
          sheetFormat: line.sheetFormat,
          qty: lineQty,
          // receivedQty berilmagan bo'lsa — to'liq qabul qilingan deb hisoblanadi
          rcvQty: hasRcv && Number.isFinite(rcv) ? rcv : lineQty,
        };
      })
      .filter((l) => l.sku && (l.qty > 0 || l.rcvQty > 0));

    if (lines.length === 0) {
      throw new Error("Hujjatda yakunlash uchun SKU va miqdori ko'rsatilgan qator yo'q.");
    }
    if (movementType === "Transfer" && lines.some((l) => l.rcvQty > l.qty + 1e-9)) {
      throw new Error("Qabul qilingan miqdor jo'natilgan miqdordan ko'p bo'lishi mumkin emas.");
    }
    const unmatched = itemsList.filter((l) => !String(l?.sku || "").trim() && (Number(l?.quantity) > 0 || Number(l?.receivedQty) > 0));
    if (unmatched.length > 0) {
      throw new Error(`Qatorda SKU yo'q (katalogdan tanlanmagan): ${unmatched.map((l) => l?.name || "?").join(", ")}`);
    }

    // Sexdan qaytarish va otxod faqat katalogdagi materialga; qaytarish sexga berilganidan oshmaydi
    if (movementType === "ProductionReturn" || movementType === "CuttingReturn") {
      await assertSkusInCatalog(tx, companyId, lines.map((l) => l.sku.replace(/-OFF$/i, "")));
    }
    if (movementType === "ProductionReturn") {
      await assertReturnWithinIssued(
        tx,
        companyId,
        values.workOrderId,
        movementNumber,
        sumBySku(lines, (l) => l.rcvQty)
      );
    }

    // Chiqim tomonida bo'sh qoldiq (stock - reserved) yetarliligini oldindan tekshirish
    if (isOutgoing) {
      await assertStockAvailable(tx, companyId, values.fromLocationName, sumBySku(lines, (l) => l.qty));
    }

    // Delovoy otxod: asl materialga emas, alohida "-OFF" kartasiga, asl narx × kesim nisbati × baho bilan kiradi
    if (movementType === "CuttingReturn") {
      const valuedItems = [...itemsList];
      for (const line of lines) {
        if (line.rcvQty <= 0) continue;
        const parentSku = line.sku.replace(/-OFF$/i, "");
        const offcutSku = `${parentSku}-OFF`;
        const parentRows = await tx
          .select({ p: warehouseStockBalances.unitPriceUsd, f: warehouseStockBalances.sheetFormat })
          .from(warehouseStockBalances)
          .where(and(eq(warehouseStockBalances.companyId, companyId), eq(warehouseStockBalances.sku, parentSku)));
        const parent = parentRows.find((r) => Number(r.p) > 0) || parentRows[0];
        const parentPrice = Number(parent?.p) || 0;

        // Varaqli materialda qoldiq narxi maydon nisbatiga qarab; boshqa birliklarda (kg, m) narx o'zgarmaydi
        let areaRatio = 1;
        const parentArea = parseSheetArea(parent?.f);
        if (parentArea > 0) {
          const offcutArea = parseSheetArea(line.sheetFormat);
          if (offcutArea <= 0) {
            throw new Error(
              `"${line.name}" qoldig'i uchun kesim formati kiritilmagan (masalan 500×700). Asl format: ${parent?.f}.`
            );
          }
          if (offcutArea > parentArea + 1e-6) {
            throw new Error(
              `"${line.name}" qoldig'i formati (${line.sheetFormat}) asl formatdan (${parent?.f}) katta bo'lishi mumkin emas.`
            );
          }
          areaRatio = offcutArea / parentArea;
        }

        const rawValuation = Number(line.valuationPercent);
        const valuationPercent = Number.isFinite(rawValuation) && line.valuationPercent !== undefined && line.valuationPercent !== ""
          ? Math.min(100, Math.max(0, rawValuation))
          : 100;
        const unitPriceUsd = parentPrice * areaRatio * (valuationPercent / 100);
        const creditUsd = Number((unitPriceUsd * line.rcvQty).toFixed(2));

        await applyStockBalanceDelta({
          exec: tx,
          companyId,
          locationName: values.toLocationName,
          sku: offcutSku,
          name: /delovoy otxod/i.test(line.name) ? line.name : `${line.name} (${line.sheetFormat || "Kesim"}) [Delovoy otxod]`,
          deltaQty: line.rcvQty,
          category: "Offcuts & Scraps",
          unit: line.unit,
          sheetFormat: line.sheetFormat,
          unitPriceUsd: unitPriceUsd > 0 ? unitPriceUsd : undefined,
        });

        valuedItems[line.sourceIndex] = {
          ...valuedItems[line.sourceIndex],
          parentSku,
          offcutSku,
          areaRatio: Number(areaRatio.toFixed(4)),
          valuationPercent,
          unitPriceUsd: Number(unitPriceUsd.toFixed(4)),
          creditUsd,
        };
      }

      // Baholangan qatorlar hujjatda saqlanadi — buyurtma tannarxi shu summaga kamayadi
      const [valued] = await tx
        .update(warehouseMovements)
        .set({ reason: JSON.stringify({ ...JSON.parse(values.reason), items: valuedItems }) })
        .where(eq(warehouseMovements.id, record.id))
        .returning();
      return valued || record;
    }

    for (const line of lines) {
      if (isOutgoing && line.qty > 0) {
        await applyStockBalanceDelta({
          exec: tx,
          companyId,
          locationName: values.fromLocationName,
          sku: line.sku,
          name: line.name,
          deltaQty: -line.qty,
          unit: line.unit,
        });
      }
      if (isIncoming && line.rcvQty > 0) {
        // Ko'chirishda manba ombordagi tannarx qabul qiluvchi omborga o'tadi
        let unitPriceUsd: number | undefined;
        if (movementType === "Transfer") {
          const [src] = await tx
            .select({ p: warehouseStockBalances.unitPriceUsd })
            .from(warehouseStockBalances)
            .where(
              and(
                eq(warehouseStockBalances.companyId, companyId),
                eq(warehouseStockBalances.locationName, values.fromLocationName),
                eq(warehouseStockBalances.sku, line.sku)
              )
            )
            .limit(1);
          unitPriceUsd = Number(src?.p) || undefined;
        }
        await applyStockBalanceDelta({
          exec: tx,
          companyId,
          locationName: values.toLocationName,
          sku: line.sku,
          name: line.name,
          deltaQty: line.rcvQty,
          unit: line.unit,
          sheetFormat: line.sheetFormat,
          unitPriceUsd,
        });
      }
    }
    return record;
  });

  return {
    ...movementRecord,
    movementNumber: movementRecord.movementNumber,
  };
}

// ─── 6. Inventory Counts (Inventarizatsiya) ────────────────────────────────────

export async function getInventoryCounts(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.warehouseInventoryCounts.findMany({
    where: eq(warehouseInventoryCounts.companyId, companyId),
    orderBy: [desc(warehouseInventoryCounts.countDate)],
  });
}

export async function upsertInventoryCount(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rawCount = String(payload.countNumber || payload.id || "").trim();
  const isDraftCount =
    !rawCount || /^(draft-|new-|tab-|IC-NEW)/i.test(rawCount) || rawCount.includes("NEW") || rawCount.includes("Yangi");
  let countNumber = rawCount;

  const systemQty = Number(payload.systemQty) || 0;
  const actualQty = Number(payload.actualQty) || 0;
  const variance = actualQty - systemQty;
  const status = payload.status || (variance === 0 ? "Matched" : variance > 0 ? "Surplus" : "Shortage");
  const itemsList: any[] = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : [
    {
      sku: payload.materialSku,
      name: payload.materialName || payload.material || "Material",
      systemQty: systemQty,
      actualQty: actualQty,
      variance: variance,
      unit: payload.unit || "sheets",
    }
  ];

  const values = {
    companyId,
    warehouseId: payload.warehouseId || null,
    locationName: payload.locationName || payload.location || "Asosiy ombor",
    countNumber,
    countDate: payload.countDate || payload.date ? new Date(payload.countDate || payload.date) : new Date(),
    itemId: payload.itemId || null,
    materialSku: payload.materialSku || itemsList[0]?.sku || null,
    materialName: payload.materialName || payload.material || itemsList.map((i: any) => i.name).join(", ") || "Material",
    systemQty: systemQty.toString(),
    actualQty: actualQty.toString(),
    variance: variance.toString(),
    unit: payload.unit || itemsList[0]?.unit || "sheets",
    status: status as any,
    countedBy: payload.countedBy || null,
    notes: payload.notes || null,
    updatedAt: new Date(),
  };

  return db.transaction(async (tx) => {
    // Raqam tranzaksiya ichida, seriya qulfi ostida beriladi
    if (isDraftCount) {
      await lockNumbering(tx, companyId, "INV");
      countNumber = await getNextInventoryCountNumber(companyId, tx);
      values.countNumber = countNumber;
    }
    const [existingCount] = !isDraftCount
      ? await tx
          .select()
          .from(warehouseInventoryCounts)
          .where(and(eq(warehouseInventoryCounts.companyId, companyId), eq(warehouseInventoryCounts.countNumber, countNumber)))
          .for("update")
          .limit(1)
      : [];
    if (existingCount?.status === "Completed") {
      throw new Error(`${countNumber} inventarizatsiyasi yakunlangan va qoldiqqa o'tkazilgan. Uni o'zgartirib bo'lmaydi.`);
    }

    // Yakunlashda registrdagi JORIY qoldiq haqiqiy sanoqqa tenglashtiriladi.
    // Farq = haqiqiy - joriy registr qoldig'i (mijoz yuborgan, eskirgan bo'lishi mumkin bo'lgan systemQty emas).
    let postedSystem = systemQty;
    let postedVariance = variance;
    if (status === "Completed") {
      const lines = itemsList
        .map((item) => ({
          sku: String(item.sku || values.materialSku || ""),
          name: item.name || values.materialName,
          unit: item.unit || values.unit,
          actual: Number(item.actualQty),
        }))
        .filter((l) => l.sku && Number.isFinite(l.actual) && l.actual >= 0);
      if (lines.length === 0) {
        throw new Error("Yakunlash uchun SKU va haqiqiy miqdori kiritilgan qator yo'q.");
      }
      const badSku = lines.find((l) => isPlaceholderSku(l.sku));
      if (badSku) throw new Error(`Noto'g'ri SKU "${badSku.sku}" — material katalogdan tanlanmagan.`);

      postedSystem = 0;
      postedVariance = 0;
      for (const line of lines) {
        const [row] = await tx
          .select()
          .from(warehouseStockBalances)
          .where(
            and(
              eq(warehouseStockBalances.companyId, companyId),
              eq(warehouseStockBalances.locationName, values.locationName),
              eq(warehouseStockBalances.sku, line.sku)
            )
          )
          .for("update")
          .limit(1);
        const current = row ? Number(row.stockLevel) : 0;
        const reservedQty = row ? Number(row.reserved) : 0;
        if (line.actual + 1e-9 < reservedQty) {
          throw new Error(
            `${line.sku}: haqiqiy qoldiq (${fmtQty(line.actual)}) chiqim hujjatlari band qilgan miqdordan (${fmtQty(reservedQty)}) kam. Avval rezervlarni bekor qiling.`
          );
        }
        const delta = line.actual - current;
        postedSystem += current;
        postedVariance += delta;
        if (Math.abs(delta) > 1e-9) {
          await applyStockBalanceDelta({
            exec: tx,
            companyId,
            locationName: values.locationName,
            sku: line.sku,
            name: line.name,
            deltaQty: delta,
            unit: line.unit,
          });
        }
      }
    }

    const finalValues =
      status === "Completed"
        ? {
            ...values,
            systemQty: postedSystem.toString(),
            actualQty: (postedSystem + postedVariance).toString(),
            variance: postedVariance.toString(),
          }
        : values;

    const [record] = await tx
      .insert(warehouseInventoryCounts)
      .values(finalValues)
      .onConflictDoUpdate({
        target: [warehouseInventoryCounts.companyId, warehouseInventoryCounts.countNumber],
        set: finalValues,
      })
      .returning();
    return record;
  });
}

// ─── 7. Finished Goods (Tayyor Mahsulot Zaxirasi) ──────────────────────────────

export async function getFinishedGoods(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.warehouseFinishedGoods.findMany({
    where: eq(warehouseFinishedGoods.companyId, companyId),
    orderBy: [desc(warehouseFinishedGoods.producedAt)],
  });

  return rows.map((fg) => {
    const qty = Number(fg.quantity) || 0;
    const reservedQty = Number(fg.reservedQuantity) || 0;
    const stockQty = Math.max(0, qty - reservedQty);
    const completionDate = fg.producedAt
      ? new Date(fg.producedAt).toISOString().split("T")[0]
      : "";
    const orderDate = fg.createdAt
      ? new Date(fg.createdAt).toISOString().split("T")[0]
      : completionDate;
    const daysInStock = fg.producedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(fg.producedAt).getTime()) / 86400000))
      : 0;
    const location =
      [fg.locationName, fg.locationShelf].filter(Boolean).join(" — ") ||
      "Tayyor Mahsulot Ombori";

    return {
      ...fg,
      id: fg.sku || fg.id,
      dbId: fg.id,
      workOrderId: fg.workOrderId || "",
      clientOrderId: fg.orderNo || undefined,
      customerId: fg.clientId || "",
      customerName: fg.customerName || "",
      productName: fg.productName || "",
      batchNo: fg.batchNo || "",
      orderDate,
      completionDate,
      orderedQty: qty,
      producedQty: qty,
      shippedQty: reservedQty,
      reservedQty,
      stockQty,
      pendingQty: Number(fg.pendingQuantity) || 0,
      unit: fg.unit || "pcs",
      costPricePerUnit: Number(fg.costPricePerUnit) || 0,
      totalStockValue: Number(fg.totalStockValue) || qty * (Number(fg.costPricePerUnit) || 0),
      location,
      daysInStock,
      status: (fg.status as any) || "In Stock",
      notes: fg.notes || undefined,
    };
  });
}

export async function upsertFinishedGood(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const qty = Number(payload.quantity) || 0;
  const resQty = Number(payload.reservedQuantity) || 0;

  const values = {
    companyId,
    warehouseId: payload.warehouseId || null,
    locationName: payload.locationName || null,
    clientId: payload.clientId || null,
    customerName: payload.customerName || payload.customer || "Mijoz",
    workOrderId: payload.workOrderId || payload.orderNo || `WO-${Date.now().toString().slice(-4)}`,
    orderNo: payload.orderNo || null,
    productName: payload.productName || payload.name || "Tayyor Mahsulot",
    sku: payload.sku || `FG-${Date.now().toString().slice(-4)}`,
    quantity: qty.toString(),
    reservedQuantity: resQty.toString(),
    unit: payload.unit || "pcs",
    batchNo: payload.batchNo || null,
    producedAt: payload.producedAt ? new Date(payload.producedAt) : new Date(),
    status: (payload.status as any) || "In Stock",
    locationShelf: payload.locationShelf || null,
    notes: payload.notes || null,
    // Ixtiyoriy maydonlar: payload'da berilgan bo'lsagina yoziladi (mavjud qiymat default bilan ustidan yozilmasin)
    ...(payload.receiptStatus ? { receiptStatus: String(payload.receiptStatus) } : {}),
    ...(payload.allocationStatus ? { allocationStatus: String(payload.allocationStatus) } : {}),
    ...(payload.costPricePerUnit !== undefined && payload.costPricePerUnit !== null
      ? { costPricePerUnit: (Number(payload.costPricePerUnit) || 0).toString() }
      : {}),
    ...(payload.totalStockValue !== undefined && payload.totalStockValue !== null
      ? { totalStockValue: (Number(payload.totalStockValue) || 0).toString() }
      : {}),
    updatedAt: new Date(),
  };

  // reserved_quantity faqat chiqim dvigateli (shipmentEngine) tomonidan boshqariladi —
  // mavjud yozuvni tahrirlashda UI dan kelgan qiymat bilan rezervni ustidan yozmaymiz.
  const { reservedQuantity: _ignoredReserved, ...updateValues } = values;
  void _ignoredReserved;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(warehouseFinishedGoods)
      .where(
        and(
          eq(warehouseFinishedGoods.companyId, companyId),
          eq(warehouseFinishedGoods.sku, values.sku),
          eq(warehouseFinishedGoods.workOrderId, values.workOrderId)
        )
      )
      .for("update")
      .limit(1);
    if (current && qty + 1e-9 < Number(current.reservedQuantity)) {
      throw new Error(
        `${values.sku}: miqdor (${fmtQty(qty)}) chiqim hujjatlarida band qilingan miqdordan (${fmtQty(Number(current.reservedQuantity))}) kam bo'lishi mumkin emas.`
      );
    }

    const [record] = await tx
      .insert(warehouseFinishedGoods)
      .values(values)
      .onConflictDoUpdate({
        target: [
          warehouseFinishedGoods.companyId,
          warehouseFinishedGoods.sku,
          warehouseFinishedGoods.workOrderId,
        ],
        set: updateValues,
      })
      .returning();
    return record;
  });
}

// ─── Helper: 1C Qoldiqlar Registri Deltasi (Accumulation Register Updater) ──────

/** Vaqtinchalik UI identifikatorlari (tab-*, draft-*) SKU sifatida registrga tushmasligi kerak */
const isPlaceholderSku = (sku: unknown) => /^(tab-|draft-|new-)/i.test(String(sku || ""));

/**
 * Klient hali raqam olmagan hujjatni qanday belgilaydi: bo'sh, `draft-…`, `tab-…`, `RCV-NEW-…`, "Yangi".
 * Bunday hujjatga raqamni faqat server beradi.
 */
function isDraftDocNumber(raw: string): boolean {
  const v = (raw || "").trim();
  return (
    !v ||
    /^(draft-|new-|tab-)/i.test(v) ||
    /-NEW(-|$)/i.test(v) ||
    v.toUpperCase() === "NEW" ||
    v.includes("Qoralama") ||
    v.includes("Yangi")
  );
}

/**
 * Kirimda SKU siz kelgan yangi material uchun: nomi bo'yicha mavjud kartaga bog'laydi,
 * topilmasa navbatdagi MAT-XXXX ni beradi. "MAT" seriyasi tranzaksiya oxirigacha qulflanadi.
 */
async function createReceiptSkuResolver(tx: DbExec, companyId: string) {
  await lockNumbering(tx, companyId, "MAT");
  const rows = await tx
    .select({ sku: warehouseStockBalances.sku, name: warehouseStockBalances.name })
    .from(warehouseStockBalances)
    .where(eq(warehouseStockBalances.companyId, companyId));
  const byName = new Map<string, string>();
  let maxNum = 0;
  for (const r of rows) {
    if (r.name && !byName.has(r.name.trim().toLowerCase())) byName.set(r.name.trim().toLowerCase(), r.sku);
    const m = (r.sku || "").trim().match(/^MAT-(\d+)$/i);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
  }
  return async (name: string): Promise<string> => {
    const key = (name || "").trim().toLowerCase();
    if (!key) throw new Error("Qatorda material nomi ham, SKU ham ko'rsatilmagan.");
    const found = byName.get(key);
    if (found) return found;
    maxNum += 1;
    const sku = `MAT-${String(maxNum).padStart(4, "0")}`;
    byName.set(key, sku);
    return sku;
  };
}

/** Kirim turidagi harakatlar (sexdan qaytarish, otxod) faqat katalogda bor materialga yoziladi. */
async function assertSkusInCatalog(exec: DbExec, companyId: string, skus: string[]) {
  const unique = Array.from(new Set(skus.filter(Boolean)));
  if (unique.length === 0) return;
  const rows = await exec
    .select({ sku: warehouseStockBalances.sku })
    .from(warehouseStockBalances)
    .where(and(eq(warehouseStockBalances.companyId, companyId), inArray(warehouseStockBalances.sku, unique)));
  const known = new Set(rows.map((r) => r.sku));
  const missing = unique.filter((s) => !known.has(s));
  if (missing.length > 0) {
    throw new Error(`Katalogda yo'q material(lar): ${missing.join(", ")}. Avval xomashyo pasportini oching yoki kirim qiling.`);
  }
}

/**
 * Sexdan qaytariladigan miqdor shu buyurtma bo'yicha sexga berilgan (va hali qaytarilmagan)
 * miqdordan oshmasligi kerak.
 */
async function assertReturnWithinIssued(
  exec: DbExec,
  companyId: string,
  workOrderId: string | null,
  excludeMovementNumber: string,
  required: Map<string, number>
) {
  const rows = await exec
    .select()
    .from(warehouseMovements)
    .where(
      and(
        eq(warehouseMovements.companyId, companyId),
        eq(warehouseMovements.status, "Completed"),
        workOrderId ? eq(warehouseMovements.workOrderId, workOrderId) : isNull(warehouseMovements.workOrderId)
      )
    );
  const issued = new Map<string, number>();
  const returned = new Map<string, number>();
  for (const r of rows) {
    if (r.movementNumber === excludeMovementNumber) continue;
    let type = "";
    let items: any[] = [];
    try {
      const meta = r.reason && r.reason.startsWith("{") ? JSON.parse(r.reason) : null;
      type = meta?.movementType || "";
      items = Array.isArray(meta?.items) ? meta.items : [];
    } catch (_) {}
    if (!type) type = r.movementNumber.startsWith("ISS-") ? "ProductionIssue" : r.movementNumber.startsWith("RET-") ? "ProductionReturn" : "";
    if (type !== "ProductionIssue" && type !== "ProductionReturn") continue;
    if (items.length === 0 && r.materialSku) {
      items = [{ sku: r.materialSku, quantity: r.quantity, receivedQty: r.receivedQty }];
    }
    for (const it of items) {
      const sku = String(it?.sku || "");
      if (!sku) continue;
      if (type === "ProductionIssue") {
        issued.set(sku, (issued.get(sku) || 0) + (Number(it.quantity) || 0));
      } else {
        const q = it.receivedQty !== undefined && it.receivedQty !== "" ? Number(it.receivedQty) : Number(it.quantity);
        returned.set(sku, (returned.get(sku) || 0) + (Number(q) || 0));
      }
    }
  }
  const problems: string[] = [];
  for (const [sku, qty] of required) {
    const left = (issued.get(sku) || 0) - (returned.get(sku) || 0);
    if (qty > left + 1e-9) problems.push(`${sku}: qaytarilmoqda ${fmtQty(qty)}, sexda ${fmtQty(Math.max(0, left))}`);
  }
  if (problems.length > 0) {
    throw new Error(
      `Qaytarish miqdori ${workOrderId ? `${workOrderId} buyurtmasi bo'yicha ` : ""}sexga berilganidan ko'p. ${problems.join("; ")}`
    );
  }
}

const fmtQty = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/** Hujjatdagi SKU larni bir xil joy bo'yicha yig'ish (bir hujjatda bir SKU ikki qatorda bo'lsa) */
function sumBySku<T extends { sku?: string }>(lines: T[], qtyOf: (l: T) => number) {
  const out = new Map<string, number>();
  for (const l of lines) {
    if (!l.sku) continue;
    out.set(l.sku, (out.get(l.sku) || 0) + qtyOf(l));
  }
  return out;
}

/**
 * Chiqim turidagi hujjatlar (sexga berish, hisobdan chiqarish, ko'chirish) uchun bo'sh qoldiqni tekshirish.
 * Bo'sh qoldiq = stock_level - reserved (chiqim hujjatlari band qilgan miqdorga tegilmaydi).
 */
async function assertStockAvailable(
  exec: DbExec,
  companyId: string,
  locationName: string,
  required: Map<string, number>
) {
  const problems: string[] = [];
  for (const [sku, qty] of required) {
    if (!(qty > 0)) continue;
    const [row] = await exec
      .select()
      .from(warehouseStockBalances)
      .where(
        and(
          eq(warehouseStockBalances.companyId, companyId),
          eq(warehouseStockBalances.locationName, locationName),
          eq(warehouseStockBalances.sku, sku)
        )
      )
      .for("update")
      .limit(1);
    const free = row ? Number(row.stockLevel) - Number(row.reserved) : 0;
    if (qty > free + 1e-9) {
      problems.push(`${sku}${row ? ` — ${row.name}` : ""}: kerak ${fmtQty(qty)}, bo'sh qoldiq ${fmtQty(Math.max(0, free))}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`"${locationName}" omborida qoldiq yetarli emas. ${problems.join("; ")}`);
  }
}

async function applyStockBalanceDelta(params: {
  companyId: string;
  locationName: string;
  sku: string;
  name: string;
  deltaQty: number;
  category?: string;
  unit?: string;
  unitPriceUsd?: number;
  sheetFormat?: string;
  grammage?: number;
  /** true bo'lsa, registrda qator bo'lmasa hech narsa yaratilmaydi */
  onlyIfExists?: boolean;
  /** Tranzaksiya ichida chaqirilganda `tx` */
  exec?: DbExec;
}) {
  const { companyId, locationName, sku, name, deltaQty } = params;
  const exec = params.exec ?? db;
  if (!sku || !deltaQty) return;
  if (isPlaceholderSku(sku)) {
    throw new Error(`Noto'g'ri SKU "${sku}" — material katalogdan tanlanmagan.`);
  }

  // Qatorni qulflab o'qiymiz: parallel hujjatlar bir-birining o'zgarishini yo'qotmasin
  const [existing] = await exec
    .select()
    .from(warehouseStockBalances)
    .where(
      and(
        eq(warehouseStockBalances.companyId, companyId),
        eq(warehouseStockBalances.locationName, locationName),
        eq(warehouseStockBalances.sku, sku)
      )
    )
    .for("update")
    .limit(1);
  if (!existing && params.onlyIfExists) return;
  if (!existing && deltaQty < 0) {
    throw new Error(`"${locationName}" omborida ${sku} qoldig'i yo'q — ${fmtQty(-deltaQty)} birlikni yechib bo'lmaydi.`);
  }

  const currentLevel = existing ? Number(existing.stockLevel) : 0;
  const currentReserved = existing ? Number(existing.reserved) : 0;
  if (deltaQty < 0 && currentLevel + deltaQty < -1e-9) {
    throw new Error(
      `"${locationName}" omborida ${sku} qoldig'i yetarli emas: mavjud ${fmtQty(currentLevel)}, yechilmoqda ${fmtQty(-deltaQty)}.`
    );
  }
  const newLevel = Math.max(0, currentLevel + deltaQty);
  const newAvailable = Math.max(0, newLevel - currentReserved);
  const reorder = existing ? Number(existing.reorder) : 1000;

  // Kirimda o'rtacha tannarx (o'rtacha tortilgan narx); chiqimda narx o'zgarmaydi
  const currentPrice = Number(existing?.unitPriceUsd) || 0;
  let nextPrice = currentPrice;
  if (deltaQty > 0 && params.unitPriceUsd !== undefined && params.unitPriceUsd > 0) {
    nextPrice =
      currentLevel > 0 && currentPrice > 0
        ? (currentLevel * currentPrice + deltaQty * params.unitPriceUsd) / (currentLevel + deltaQty)
        : params.unitPriceUsd;
  }

  let computedStatus: "In Stock" | "Low Stock" | "Critical" | "Out of Stock" = "In Stock";
  if (newLevel <= 0) computedStatus = "Out of Stock";
  else if (newAvailable <= reorder * 0.3) computedStatus = "Critical";
  else if (newAvailable <= reorder) computedStatus = "Low Stock";

  const values = {
    companyId,
    locationName,
    sku,
    name: name || (existing?.name ?? "Material"),
    category: params.category || existing?.category || "Paper & Board",
    sheetFormat: params.sheetFormat || existing?.sheetFormat || null,
    grammage: params.grammage || existing?.grammage || null,
    stockLevel: newLevel.toString(),
    reserved: currentReserved.toString(),
    available: newAvailable.toString(),
    unit: params.unit || existing?.unit || "sheets",
    reorder: reorder.toString(),
    unitPriceUsd: nextPrice.toFixed(2),
    status: computedStatus,
    lastReceived: deltaQty > 0 ? new Date() : (existing?.lastReceived || new Date()),
    updatedAt: new Date(),
  };

  await exec
    .insert(warehouseStockBalances)
    .values(values)
    .onConflictDoUpdate({
      target: [
        warehouseStockBalances.companyId,
        warehouseStockBalances.locationName,
        warehouseStockBalances.sku,
      ],
      set: values,
    });
}

// ─── 8. Carriers (Tashuvchilar va Avtopark Katalogi) ──────────────────────────

export async function getCarriers(companyCode: string = "ALL") {
  let whereClause = undefined;
  if (companyCode && companyCode !== "ALL") {
    const companyId = await getCompanyIdByCode(companyCode);
    whereClause = eq(carriers.companyId, companyId);
  }
  const list = await db.query.carriers.findMany({
    where: whereClause,
    orderBy: [desc(carriers.createdAt)],
  });

  return list;
}

export async function upsertCarrier(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const values = {
    companyId,
    name: payload.name || "Kompaniya transporti",
    type: payload.type || "fleet",
    vehicleModel: payload.vehicleModel || null,
    vehicleNo: payload.vehicleNo || null,
    driverName: payload.driverName || null,
    driverPhone: payload.driverPhone || null,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    notes: payload.notes || null,
    updatedAt: new Date(),
  };

  let record;
  if (payload.id && !payload.id.startsWith("carrier-") && !payload.id.startsWith("new-")) {
    const [updated] = await db
      .update(carriers)
      .set(values)
      .where(and(eq(carriers.id, payload.id), eq(carriers.companyId, companyId)))
      .returning();
    record = updated;
  } else {
    const [inserted] = await db
      .insert(carriers)
      .values({ ...values, createdAt: new Date() })
      .returning();
    record = inserted;
  }

  await writeAuditLog({
    companyId,
    userId: "system",
    userName: "Carrier Manager",
    entityType: "carrier",
    entityId: record?.id || "unknown",
    action: payload.id ? "update" : "create",
    newData: record,
  });

  return record;
}

export async function deleteCarrier(id: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const [deleted] = await db
    .delete(carriers)
    .where(and(eq(carriers.id, id), eq(carriers.companyId, companyId)))
    .returning();
  return deleted;
}

// ─── 8. Pending Finished Goods Receipts (Ishlab chiqarishdan qabul) ───────────

export async function getPendingFinishedGoodsReceipts(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.warehouseFinishedGoods.findMany({
    where: and(
      eq(warehouseFinishedGoods.companyId, companyId),
      sql`${warehouseFinishedGoods.pendingQuantity} > 0`
    ),
    orderBy: [desc(warehouseFinishedGoods.updatedAt)],
  });

  // "quantity" here is what waits for confirmation; what is already in stock is "stockQuantity".
  return rows.map((fg) => ({
    ...fg,
    id: fg.id,
    quantity: Number(fg.pendingQuantity) || 0,
    stockQuantity: Number(fg.quantity) || 0,
    costPricePerUnit: Number(fg.costPricePerUnit) || 0,
    totalStockValue: Number(fg.totalStockValue) || 0,
    createdDate: fg.createdAt ? new Date(fg.createdAt).toISOString().split("T")[0] : "",
  }));
}

/** Allowed overrun of a print run (business rules §3): ±7% up to 1 000, ±5% up to 10 000, ±3% above. */
function runTolerance(orderQty: number): number {
  if (orderQty <= 1000) return 0.07;
  if (orderQty <= 10_000) return 0.05;
  return 0.03;
}

/**
 * The shop hands packed boxes over to the FG warehouse: the quantity waits as "pending"
 * until the warehouse confirms it, and is not in stock (cannot be shipped) before that.
 */
export async function handOverFinishedGoods(
  payload: {
    workOrderId: string;
    quantity: number;
    productName?: string;
    customerName?: string;
    clientId?: string | null;
    orderNo?: string | null;
    unit?: string;
    costPricePerUnit?: number;
    locationName?: string;
    boxCount?: number;
  },
  companyCode: string = "PRINTGOO",
  exec: DbExec = db
) {
  const companyId = await getCompanyIdByCode(companyCode);
  const qty = Number(payload.quantity) || 0;
  if (!payload.workOrderId) throw new Error("Buyurtma raqami kerak.");
  if (!(qty > 0)) throw new Error("Topshiriladigan miqdor 0 dan katta bo'lishi kerak.");
  const sku = `FG-${payload.workOrderId}`;
  const unitCost = Number(payload.costPricePerUnit) || 0;
  const unit = payload.unit || "pcs";
  const note = `${payload.boxCount ? `${payload.boxCount} quti, ` : ""}${fmtQty(qty)} ${unit} topshirildi`;

  return exec.transaction(async (tx) => {
    // Goods are handed over for an order that exists and is still alive.
    const order = await tx.query.workOrders.findFirst({
      where: and(eq(workOrders.companyId, companyId), eq(workOrders.docNo, payload.workOrderId)),
      with: { operations: true },
    });
    if (!order) throw new Error(`${payload.workOrderId} buyurtmasi topilmadi.`);
    if (order.status === "Cancelled") throw new Error(`${order.docNo} buyurtmasi bekor qilingan.`);

    const [current] = await tx
      .select()
      .from(warehouseFinishedGoods)
      .where(
        and(
          eq(warehouseFinishedGoods.companyId, companyId),
          eq(warehouseFinishedGoods.sku, sku),
          eq(warehouseFinishedGoods.workOrderId, payload.workOrderId)
        )
      )
      .for("update")
      .limit(1);

    // Everything handed over so far (in stock, waiting, already shipped) plus this hand-over
    // may not exceed what was made: the ordered run with its allowed overrun, or the final
    // step's reported good output when that is higher.
    const [shipped] = current
      ? await tx
          .select({ qty: sql<string>`coalesce(sum(${warehouseShipmentItems.quantity}), 0)` })
          .from(warehouseShipmentItems)
          .innerJoin(warehouseShipments, eq(warehouseShipments.id, warehouseShipmentItems.shipmentId))
          .where(
            and(
              eq(warehouseShipmentItems.finishedGoodId, current.id),
              inArray(warehouseShipments.status, ["Dispatched", "In Transit", "Delivered"])
            )
          )
      : [{ qty: "0" }];
    const handedSoFar =
      (Number(current?.quantity) || 0) + (Number(current?.pendingQuantity) || 0) + (Number(shipped?.qty) || 0);
    const orderQty = Number(order.quantity) || 0;
    const lastStep = [...(order.operations || [])].sort((a, b) => b.sequence - a.sequence)[0];
    const limit = Math.max(orderQty * (1 + runTolerance(orderQty)), Number(lastStep?.completedQty) || 0);
    if (handedSoFar + qty > limit + 1e-6) {
      throw new Error(
        `${order.docNo}: topshirilgan miqdor (${fmtQty(handedSoFar + qty)}) ishlab chiqarilgandan ko'p. ` +
          `Buyurtma ${fmtQty(orderQty)}, ruxsat etilgan chegara ${fmtQty(Math.floor(limit))}.`
      );
    }

    if (current) {
      const [updated] = await tx
        .update(warehouseFinishedGoods)
        .set({
          pendingQuantity: ((Number(current.pendingQuantity) || 0) + qty).toString(),
          receiptStatus: "PendingReceipt",
          ...(unitCost > 0 ? { costPricePerUnit: unitCost.toString() } : {}),
          notes: note,
          updatedAt: new Date(),
        })
        .where(eq(warehouseFinishedGoods.id, current.id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(warehouseFinishedGoods)
      .values({
        companyId,
        clientId: order.clientId || payload.clientId || null,
        customerName: order.customerName || payload.customerName || "Mijoz",
        workOrderId: payload.workOrderId,
        orderNo: payload.orderNo || null,
        productName: payload.productName || "Tayyor mahsulot",
        sku,
        quantity: "0",
        reservedQuantity: "0",
        pendingQuantity: qty.toString(),
        unit,
        status: "In Stock",
        allocationStatus: "Dedicated",
        receiptStatus: "PendingReceipt",
        locationName: payload.locationName || "Tayyor mahsulotlar ombori",
        locationShelf: "FG-Staging",
        costPricePerUnit: unitCost.toString(),
        totalStockValue: "0",
        notes: note,
      })
      .returning();
    return created;
  });
}

/**
 * The warehouse confirms a hand-over (fully or partly): the confirmed quantity goes into stock,
 * a shortage is noted and dropped from pending, and the order's handed boxes become in_stock.
 */
export async function confirmFinishedGoodsReceipt(
  fgId: string,
  confirmedQty?: number,
  locationShelf?: string,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(warehouseFinishedGoods)
      .where(and(eq(warehouseFinishedGoods.companyId, companyId), eq(warehouseFinishedGoods.id, fgId)))
      .for("update")
      .limit(1);

    if (!existing) {
      throw new Error("Kutilayotgan tayyor mahsulot topilmadi");
    }
    const pending = Number(existing.pendingQuantity) || 0;
    if (!(pending > 0)) {
      throw new Error(`${existing.sku}: qabul kutilayotgan miqdor yo'q.`);
    }

    const finalQty = confirmedQty !== undefined && confirmedQty !== null ? Number(confirmedQty) : pending;
    if (!Number.isFinite(finalQty) || finalQty <= 0) {
      throw new Error("Qabul qilinadigan miqdor 0 dan katta bo'lishi kerak.");
    }
    if (finalQty > pending + 1e-9) {
      throw new Error(`${existing.sku}: topshirilgan ${fmtQty(pending)} dan ko'p qabul qilib bo'lmaydi.`);
    }
    const shortage = pending - finalQty;
    const shelf = locationShelf || existing.locationShelf || "FG-01";
    const unitCost = Number(existing.costPricePerUnit) || 0;
    const onHand = (Number(existing.quantity) || 0) + finalQty;
    const unit = existing.unit || "pcs";

    const [updated] = await tx
      .update(warehouseFinishedGoods)
      .set({
        quantity: onHand.toString(),
        pendingQuantity: "0",
        receiptStatus: "Received",
        status: "In Stock",
        locationShelf: shelf,
        totalStockValue: (onHand * unitCost).toFixed(2),
        notes:
          shortage > 1e-9
            ? `Qabulda kamomad: ${fmtQty(shortage)} ${unit} (topshirilgan ${fmtQty(pending)}, qabul ${fmtQty(finalQty)})`
            : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(warehouseFinishedGoods.id, fgId))
      .returning();

    // 1C Jamg'arish Registrida qoldiqni oshirish (shipmentEngine shu ko'zgu qatorini sinxronlaydi)
    await applyStockBalanceDelta({
      exec: tx,
      companyId,
      locationName: existing.locationName || "Tayyor mahsulotlar ombori",
      sku: existing.sku,
      name: existing.productName,
      category: "Finished Goods",
      deltaQty: finalQty,
      unit,
      unitPriceUsd: unitCost || undefined,
    });

    if (existing.workOrderId) {
      await receiveWorkOrderBoxes(tx, companyId, existing.workOrderId, finalQty);
    }

    return updated;
  });
}

// ─── 9. Available Finished Goods Stock for Multi-customer Shipment ─────────────

export async function getAvailableFinishedGoodsForShipment(companyCode: string = "PRINTGOO", exec: DbExec = db) {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await exec.query.warehouseFinishedGoods.findMany({
    // Stock on hand, even when another hand-over of the same order still waits for confirmation.
    where: and(eq(warehouseFinishedGoods.companyId, companyId), sql`${warehouseFinishedGoods.quantity} > 0`),
    orderBy: [desc(warehouseFinishedGoods.producedAt)],
  });

  const woNos = [...new Set(rows.map((fg) => fg.workOrderId).filter((v): v is string => !!v))];
  const orders = woNos.length
    ? await exec.query.workOrders.findMany({
        where: and(eq(workOrders.companyId, companyId), inArray(workOrders.docNo, woNos)),
        columns: { docNo: true, priceTotal: true, quantity: true, currency: true },
      })
    : [];
  const orderByNo = new Map(orders.map((o) => [o.docNo, o]));

  return rows
    .map((fg) => {
      const order = fg.workOrderId ? orderByNo.get(fg.workOrderId) : undefined;
      const totalQty = Number(fg.quantity) || 0;
      const reserved = Number(fg.reservedQuantity) || 0;
      const availableQty = Math.max(0, totalQty - reserved);
      return {
        id: fg.id,
        dbId: fg.id,
        sku: fg.sku,
        productName: fg.productName,
        customerName: fg.customerName,
        clientId: fg.clientId,
        workOrderId: fg.workOrderId,
        batchNo: fg.batchNo,
        totalQty,
        reservedQty: reserved,
        availableQty,
        unit: fg.unit,
        unitCost: Number(fg.costPricePerUnit) || 0,
        // Selling price of the order the goods were made for; 0 when there is none to take it from.
        unitPrice: saleUnitPriceOf(order),
        currency: order?.currency || "UZS",
        location: [fg.locationName, fg.locationShelf].filter(Boolean).join(" — ") || "Tayyor Mahsulot Ombori",
        allocationStatus: fg.allocationStatus,
        status: fg.status,
      };
    })
    .filter((item) => item.availableQty > 0);
}

// ─── 10. Inter-Customer Stock Re-allocation & Auto-Reorder Trigger ────────────

export async function checkAndTriggerReorder(params: {
  originalWorkOrderId: string;
  divertedQty: number;
  buyerCustomerName: string;
  notes?: string;
  companyCode?: string;
}) {
  const companyCode = params.companyCode || "PRINTGOO";
  const companyId = await getCompanyIdByCode(companyCode);

  // Asl buyurtmani topish
  const originalWo = await db.query.workOrders.findFirst({
    where: and(
      eq(workOrders.companyId, companyId),
      eq(workOrders.docNo, params.originalWorkOrderId)
    ),
  });

  if (!originalWo) {
    return {
      triggered: false,
      message: "Asl ishlab chiqarish buyrug'i topilmadi.",
    };
  }

  // Agar xaridor mijoz asl mijoz bilan bir xil bo'lsa, reorder talab qilinmaydi
  if (originalWo.customerName.trim().toLowerCase() === params.buyerCustomerName.trim().toLowerCase()) {
    return {
      triggered: false,
      message: "Mijozlar bir xil. Reorder talab etilmaydi.",
    };
  }

  // Yangi Reorder Work Order qoralamasini yaratish
  const today = new Date().toISOString().split("T")[0];
  const newDocNo = `WO-REORDER-${Date.now().toString().slice(-4)}`;

  const [newReorder] = await db
    .insert(workOrders)
    .values({
      companyId,
      clientId: originalWo.clientId,
      docNo: newDocNo,
      clientOrderId: originalWo.clientOrderId || null,
      customerName: originalWo.customerName,
      productName: originalWo.productName,
      department: originalWo.department,
      site: originalWo.site,
      pressMachine: originalWo.pressMachine,
      recipeCode: originalWo.recipeCode,
      quantity: params.divertedQty.toString(),
      unit: originalWo.unit,
      status: "Draft",
      priority: "High",
      stage: "Queue",
      orderType: "Production",
      orderDate: today,
      paperStock: originalWo.paperStock,
      coating: originalWo.coating,
      lamination: originalWo.lamination,
      embellishment: originalWo.embellishment,
      dimensions: originalWo.dimensions,
      colorsConfig: originalWo.colorsConfig,
      priceTotal: (Number(originalWo.priceTotal) * (params.divertedQty / (Number(originalWo.quantity) || 1))).toFixed(2),
      currency: originalWo.currency,
      operator: null,
    })
    .returning();

  await emitNotification({
    category: "production",
    eventType: "wo_reorder_created",
    severity: "warning",
    title: `Reorder yaratildi: ${originalWo.customerName}`,
    description: `${params.divertedQty} dona ${originalWo.productName} mahsuloti ${params.buyerCustomerName} ga o'tkazilgani sababli yangi ${newDocNo} buyurtmasi shakllantirildi.`,
  }, companyCode);

  return {
    triggered: true,
    reorderDocNo: newDocNo,
    reorderId: newReorder.id,
    originalCustomer: originalWo.customerName,
    divertedQty: params.divertedQty,
    message: `${originalWo.customerName} uchun ${params.divertedQty} dona yangi qayta ishlab chiqarish buyrug'i (${newDocNo}) qoralamasi yaratildi.`,
  };
}

// ─── 11. Warehouse Dispatch Manifests (Yuk Marshruti / Reys Manifesti) ──────────

export async function getDispatchManifests(companyCode: string = "ALL") {
  let whereClause = undefined;
  if (companyCode && companyCode !== "ALL") {
    const companyId = await getCompanyIdByCode(companyCode);
    whereClause = eq(warehouseDispatchManifests.companyId, companyId);
  }
  const rows = await db.query.warehouseDispatchManifests.findMany({
    where: whereClause,
    with: {
      shipments: true,
      company: true,
    },
    orderBy: [desc(warehouseDispatchManifests.manifestDate)],
  });

  return rows.map((m) => ({
    ...m,
    id: m.manifestNumber || m.id,
    dbId: m.id,
    date: m.manifestDate ? new Date(m.manifestDate).toISOString().split("T")[0] : "",
    companyName: m.company?.name || undefined,
    shipments: m.shipments || [],
    totalShipmentsCount: m.shipments ? m.shipments.length : m.totalShipmentsCount,
  }));
}

export async function upsertDispatchManifest(payload: any, companyCode: string = "ALL", actor?: ShipmentActor | null) {
  let companyId = payload.companyId;
  if (!companyId && Array.isArray(payload.shipmentIds) && payload.shipmentIds.length > 0) {
    const firstShpId = String(payload.shipmentIds[0]);
    const isFirstUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstShpId);
    const firstShp = await db.query.warehouseShipments.findFirst({
      where: isFirstUuid
        ? or(eq(warehouseShipments.id, firstShpId), eq(warehouseShipments.shipmentNumber, firstShpId))
        : eq(warehouseShipments.shipmentNumber, firstShpId),
    });
    if (firstShp) {
      companyId = firstShp.companyId;
    }
  }
  if (!companyId) {
    companyId = await getCompanyIdByCode(companyCode && companyCode !== "ALL" ? companyCode : "PRINTGOO");
  }

  const rawNumber = (payload.manifestNumber || payload.id || "").trim();
  let isDraft = !rawNumber || rawNumber.startsWith("draft-") || rawNumber.startsWith("new-") || rawNumber.startsWith("MNF-NEW");

  // Yangi reys yaratilayotganda (payload.id va payload.dbId yo'q bo'lsa), raqam to'qnashuvini oldini olish
  const isNew = !payload.id && !payload.dbId;
  if (isNew && !isDraft) {
    const existing = await db.query.warehouseDispatchManifests.findFirst({
      where: and(
        eq(warehouseDispatchManifests.companyId, companyId),
        eq(warehouseDispatchManifests.manifestNumber, rawNumber)
      ),
    });
    if (existing) {
      isDraft = true;
    }
  }

  const manifestNumber = isDraft ? await getNextManifestNumber(companyId) : rawNumber;

  const manifestValues = {
    companyId,
    manifestNumber,
    manifestDate: payload.manifestDate || payload.date ? new Date(payload.manifestDate || payload.date) : new Date(),
    vehiclePlate: payload.vehiclePlate || null,
    vehicleModel: payload.vehicleModel || null,
    driverName: payload.driverName || null,
    driverPhone: payload.driverPhone || null,
    destinationRoute: payload.destinationRoute || null,
    status: (payload.status as any) || "Draft",
    totalShipmentsCount: Number(payload.totalShipmentsCount) || (Array.isArray(payload.shipmentIds) ? payload.shipmentIds.length : 0),
    totalPackages: Number(payload.totalPackages) || 0,
    totalWeightKg: (Number(payload.totalWeightKg) || 0).toString(),
    departureTime: payload.departureTime || null,
    notes: payload.notes || null,
    updatedAt: new Date(),
  };

  // Reys va unga biriktirilgan chiqimlarning holat o'tishlari — bitta tranzaksiyada.
  // Biror chiqimda qoldiq yoki validatsiya xatosi bo'lsa, reys ham, boshqa chiqimlar ham o'zgarmaydi.
  const ctx: ShipmentTxContext = { afterCommit: [], actor };
  const shipmentIds: string[] = Array.isArray(payload.shipmentIds) ? payload.shipmentIds.map(String) : [];
  const cascadeStatus: ShipmentStatus | undefined =
    manifestValues.status === "Dispatched" ? "Dispatched" : manifestValues.status === "Delivered" ? "Delivered" : undefined;

  const manifestRecord = await db.transaction(async (tx) => {
    const [record] = await tx
      .insert(warehouseDispatchManifests)
      .values(manifestValues)
      .onConflictDoUpdate({
        target: [warehouseDispatchManifests.companyId, warehouseDispatchManifests.manifestNumber],
        set: manifestValues,
      })
      .returning();

    const carrierSummary = [
      manifestValues.vehicleModel || "Reys transporti",
      manifestValues.vehiclePlate ? `(${manifestValues.vehiclePlate})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const problems: string[] = [];
    for (const shpId of shipmentIds) {
      const targetShp = await tx.query.warehouseShipments.findFirst({
        where: UUID_RE.test(shpId)
          ? or(eq(warehouseShipments.id, shpId), eq(warehouseShipments.shipmentNumber, shpId))
          : eq(warehouseShipments.shipmentNumber, shpId),
      });
      if (!targetShp) continue;

      if (cascadeStatus && targetShp.status !== cascadeStatus) {
        try {
          await upsertWarehouseShipmentTx(
            tx,
            {
              companyId: targetShp.companyId,
              shipmentNumber: targetShp.shipmentNumber,
              manifestId: record.id,
              carrier: carrierSummary,
              driverName: manifestValues.driverName || targetShp.driverName,
              trackingNo: manifestNumber,
              status: cascadeStatus,
              // items berilmaydi — dvigatel bazadagi qatorlardan foydalanadi
            },
            companyCode,
            ctx
          );
        } catch (e) {
          // Faqat biznes xatolarini yig'amiz; SQL xatosi tranzaksiyani buzadi — darhol chiqamiz
          if (e instanceof ShipmentError) {
            problems.push(`${targetShp.shipmentNumber}: ${e.message}`);
            continue;
          }
          throw e;
        }
      } else {
        await tx
          .update(warehouseShipments)
          .set({
            manifestId: record.id,
            carrier: carrierSummary,
            driverName: manifestValues.driverName || null,
            trackingNo: manifestNumber,
            updatedAt: new Date(),
          })
          .where(eq(warehouseShipments.id, targetShp.id));
      }
    }
    if (problems.length > 0) {
      throw new ShipmentError(`Reysni jo'natib bo'lmaydi. ${problems.join(" | ")}`, 409);
    }

    // Reysdan olib tashlangan chiqimlarni bo'shatish
    const allLinked = await tx.query.warehouseShipments.findMany({
      where: eq(warehouseShipments.manifestId, record.id),
    });
    for (const linked of allLinked) {
      const stillSelected = shipmentIds.some((id) => id === linked.id || id === linked.shipmentNumber);
      if (!stillSelected) {
        await tx
          .update(warehouseShipments)
          .set({ manifestId: null, trackingNo: null, updatedAt: new Date() })
          .where(eq(warehouseShipments.id, linked.id));
      }
    }
    return record;
  });
  await runAfterCommit(ctx);


  const allManifests = await getDispatchManifests(companyCode);
  return {
    success: true,
    manifest: manifestRecord,
    manifestNumber: manifestRecord.manifestNumber,
    allManifests,
  };
}

// ─── 12. Box Barcode & Product Passport Scanner Lookup ─────────────────────────

/** What the customer pays per unit: the order's selling price, never the cost price. */
function saleUnitPriceOf(wo: { priceTotal: unknown; quantity: unknown } | null | undefined): number {
  if (!wo) return 0;
  const qty = Number(wo.quantity) || 0;
  if (!(qty > 0)) return 0;
  return Number(((Number(wo.priceTotal) || 0) / qty).toFixed(4)) || 0;
}

export async function lookupBoxOrWorkOrderBarcode(rawCode: string, companyCode: string = "PRINTGOO", exec: DbExec = db) {
  const companyId = await getCompanyIdByCode(companyCode);
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) {
    throw new Error("Shtrix-kod kiritilmadi");
  }

  const allWos = await exec.query.workOrders.findMany({
    where: eq(workOrders.companyId, companyId),
  });
  const allFg = await exec.query.warehouseFinishedGoods.findMany({
    where: eq(warehouseFinishedGoods.companyId, companyId),
  });

  // Helper: find matching FG record for a work order
  const findFgForWo = (docNo: string) =>
    allFg.find(
      (fg) =>
        (fg.workOrderId && fg.workOrderId.trim().toUpperCase() === docNo.trim().toUpperCase()) ||
        (fg.sku && fg.sku.trim().toUpperCase() === code) ||
        (fg.batchNo && fg.batchNo.trim().toUpperCase() === code)
    );

  // 1) Check exact box barcode or boxCode inside workOrders.packagingData.boxes
  for (const wo of allWos) {
    const pkg = wo.packagingData as any;
    if (pkg && Array.isArray(pkg.boxes)) {
      const matchedBox = pkg.boxes.find(
        (b: any) =>
          String(b.barcode || "").trim().toUpperCase() === code ||
          String(b.boxCode || "").trim().toUpperCase() === code
      );
      if (matchedBox) {
        const fg = findFgForWo(wo.docNo);
        const unitPrice = saleUnitPriceOf(wo);
        const unitWeightGrams = Number(pkg.unitWeightGrams) || Number(matchedBox.unitWeightGrams) || 15;
        const boxQty = Number(matchedBox.quantity) || 500;
        const boxWeightKg =
          Number(matchedBox.grossWeightKg) ||
          Number(((boxQty * unitWeightGrams) / 1000).toFixed(2));

        return {
          found: true,
          mode: "single_box" as const,
          alreadyDispatched: matchedBox.status === "dispatched",
          // Packed in the shop or handed over but not yet received: not in the FG warehouse.
          notInStock: !matchedBox.status || matchedBox.status === "ready" || matchedBox.status === "handed",
          dispatchedShipmentId: matchedBox.shipmentId || null,
          workOrderNo: wo.docNo,
          customerName: wo.customerName,
          clientId: wo.clientId,
          productName: wo.productName,
          sku: fg?.sku || `FG-${wo.docNo}`,
          finishedGoodId: fg?.id || null,
          unit: wo.unit || fg?.unit || "pcs",
          unitPrice,
          unitCost: Number(fg?.costPricePerUnit) || 0,
          currency: wo.currency || "UZS",
          boxes: [
            {
              id: matchedBox.id || `box-${matchedBox.boxNumber || 1}`,
              boxNumber: Number(matchedBox.boxNumber) || 1,
              boxCode: matchedBox.boxCode || `BX-${wo.docNo}-01`,
              barcode: matchedBox.barcode || code,
              quantity: boxQty,
              grossWeightKg: boxWeightKg,
              sizeCode: matchedBox.sizeCode || undefined,
              model: matchedBox.model || undefined,
            },
          ],
        };
      }
    }
  }

  // 2) Check if code is a synthesized box pattern like "WO-OF-26-0001-B01", "WOOF260001-B01", or "BX-WOOF260001-01"
  const boxSuffixMatch = code.match(/^(?:BX-)?(.+?)-(?:B)?(\d{1,3})$/);
  if (boxSuffixMatch) {
    const rawWoPart = boxSuffixMatch[1].replace(/[^A-Z0-9]/g, "");
    const boxNum = parseInt(boxSuffixMatch[2], 10) || 1;

    const matchedWo = allWos.find(
      (wo) => wo.docNo.toUpperCase().replace(/[^A-Z0-9]/g, "") === rawWoPart
    );
    const matchedFg =
      (matchedWo ? findFgForWo(matchedWo.docNo) : undefined) ||
      allFg.find(
        (fg) =>
          (fg.workOrderId || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === rawWoPart ||
          (fg.sku || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === rawWoPart
      );

    if (matchedWo || matchedFg) {
      const woNo = matchedWo?.docNo || matchedFg?.workOrderId || rawWoPart;
      const customerName = matchedWo?.customerName || matchedFg?.customerName || "Mijoz";
      const productName = matchedWo?.productName || matchedFg?.productName || "Tayyor mahsulot";
      const totalQty = Number(matchedFg?.quantity) || Number(matchedWo?.quantity) || 5000;
      const stdCap = Number((matchedWo?.packagingData as any)?.standardBoxCapacity) || Math.min(5000, totalQty);
      const totalBoxes = Math.max(1, Math.ceil(totalQty / stdCap));
      const boxQty = boxNum === totalBoxes ? totalQty - (totalBoxes - 1) * stdCap : stdCap;
      const unitPrice = saleUnitPriceOf(matchedWo);

      const cleanWo = woNo.replace(/[^A-Z0-9_-]/gi, "");
      const padNum = String(boxNum).padStart(2, "0");

      return {
        found: true,
        mode: "single_box" as const,
        alreadyDispatched: false,
        dispatchedShipmentId: null,
        workOrderNo: woNo,
        customerName,
        clientId: matchedWo?.clientId || matchedFg?.clientId || null,
        productName,
        sku: matchedFg?.sku || `FG-${woNo}`,
        finishedGoodId: matchedFg?.id || null,
        unit: matchedWo?.unit || matchedFg?.unit || "pcs",
        unitPrice,
        unitCost: Number(matchedFg?.costPricePerUnit) || 0,
        currency: matchedWo?.currency || "UZS",
        boxes: [
          {
            id: `box-${cleanWo}-${padNum}`,
            boxNumber: boxNum,
            boxCode: `BX-${cleanWo}-${padNum}`,
            barcode: `${cleanWo}-B${padNum}`,
            quantity: Math.max(1, boxQty),
            grossWeightKg: Number((Math.max(1, boxQty) * 0.008).toFixed(2)),
          },
        ],
      };
    }
  }

  // 3) Check if code matches a whole Work Order (WO-...) or Finished Good SKU / BatchNo
  const cleanTarget = code.replace(/[^A-Z0-9]/g, "");
  const matchedWo = allWos.find(
    (wo) =>
      wo.docNo.toUpperCase() === code ||
      wo.docNo.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget
  );
  const matchedFg =
    (matchedWo ? findFgForWo(matchedWo.docNo) : undefined) ||
    allFg.find(
      (fg) =>
        (fg.sku || "").toUpperCase() === code ||
        (fg.batchNo || "").toUpperCase() === code ||
        (fg.workOrderId || "").toUpperCase() === code ||
        (fg.workOrderId || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget
    );

  if (matchedWo || matchedFg) {
    const woNo = matchedWo?.docNo || matchedFg?.workOrderId || code;
    const customerName = matchedWo?.customerName || matchedFg?.customerName || "Mijoz";
    const productName = matchedWo?.productName || matchedFg?.productName || "Tayyor mahsulot";
    const unitPrice = saleUnitPriceOf(matchedWo);

    const pkg = matchedWo?.packagingData as any;
    let readyBoxes: any[] = [];

    if (pkg && Array.isArray(pkg.boxes) && pkg.boxes.length > 0) {
      readyBoxes = pkg.boxes
        .filter((b: any) => b.status !== "dispatched")
        .map((b: any, idx: number) => ({
          id: b.id || `box-${idx + 1}`,
          boxNumber: Number(b.boxNumber) || idx + 1,
          boxCode: b.boxCode || `BX-${woNo}-${String(idx + 1).padStart(2, "0")}`,
          barcode: b.barcode || `${woNo}-B${String(idx + 1).padStart(2, "0")}`,
          quantity: Number(b.quantity) || 500,
          grossWeightKg: Number(b.grossWeightKg) || Number(((Number(b.quantity) || 500) * 0.008).toFixed(2)),
          sizeCode: b.sizeCode,
          model: b.model,
        }));
    } else {
      const availQty =
        Math.max(0, (Number(matchedFg?.quantity) || 0) - (Number(matchedFg?.reservedQuantity) || 0)) ||
        Number(matchedWo?.quantity) ||
        1000;
      const cap = Math.min(5000, Math.max(500, Math.ceil(availQty / 4)));
      const boxCount = Math.max(1, Math.ceil(availQty / cap));
      const cleanWo = woNo.replace(/[^A-Z0-9_-]/gi, "");

      for (let i = 1; i <= boxCount; i++) {
        const bQty = i === boxCount ? availQty - (boxCount - 1) * cap : cap;
        const pad = String(i).padStart(2, "0");
        readyBoxes.push({
          id: `box-${cleanWo}-${pad}`,
          boxNumber: i,
          boxCode: `BX-${cleanWo}-${pad}`,
          barcode: `${cleanWo}-B${pad}`,
          quantity: Math.max(1, bQty),
          grossWeightKg: Number((Math.max(1, bQty) * 0.008).toFixed(2)),
        });
      }
    }

    return {
      found: true,
      mode: "work_order_batch" as const,
      alreadyDispatched: readyBoxes.length === 0,
      dispatchedShipmentId: null,
      workOrderNo: woNo,
      customerName,
      clientId: matchedWo?.clientId || matchedFg?.clientId || null,
      productName,
      sku: matchedFg?.sku || `FG-${woNo}`,
      finishedGoodId: matchedFg?.id || null,
      unit: matchedWo?.unit || matchedFg?.unit || "pcs",
      unitPrice,
      unitCost: Number(matchedFg?.costPricePerUnit) || 0,
      currency: matchedWo?.currency || "UZS",
      boxes: readyBoxes,
    };
  }

  // 4) Check if code matches a Trading Sale sticker / package (TRD-..., TR-SALE-..., TRD-BOX-...)
  const allSales = await exec.query.tradingSales.findMany({
    where: eq(tradingSales.companyId, companyId),
    with: { items: true },
  });

  const matchedSale = allSales.find((s) => {
    const sDoc = (s.docNo || "").toUpperCase();
    const cleanSDoc = sDoc.replace(/[^A-Z0-9]/g, "");
    return (
      sDoc === code ||
      cleanSDoc === cleanTarget ||
      code.startsWith(sDoc) ||
      code.startsWith(cleanSDoc) ||
      (s.id && s.id.toUpperCase() === code)
    );
  });

  if (matchedSale) {
    const saleItems = (matchedSale.items || []).map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPriceUzs) || Number(it.unitPrice) || 0;
      return {
        id: it.id,
        sku: it.sku || "",
        name: it.name,
        category: it.category,
        quantity: qty,
        unit: it.unit || "dona",
        unitPrice: price,
        totalPrice: Number(it.totalAmount) || qty * price,
        accountCode: "2910" as const,
        tradingCatalogId: it.sku,
        notes: `Savdo hujjati ${matchedSale.docNo} stikeri orqali skanerlandi`,
      };
    });

    const totalQty = saleItems.reduce((acc, it) => acc + it.quantity, 0);
    const totalWeightKg = Number((totalQty * 0.005).toFixed(2)) || 5;

    // Savdo qoralama chiqimga biriktirilgan bo'lishi mumkin — faqat o'tkazilgan chiqim "jo'natilgan" hisoblanadi
    let saleAlreadyDispatched = false;
    if (matchedSale.linkedShipmentId) {
      const linkedShp = await exec.query.warehouseShipments.findFirst({
        where: and(
          eq(warehouseShipments.companyId, companyId),
          eq(warehouseShipments.shipmentNumber, matchedSale.linkedShipmentId)
        ),
      });
      saleAlreadyDispatched = !!linkedShp && SHIPMENT_POSTED_STATUSES.has(linkedShp.status);
    }

    return {
      found: true,
      mode: "trading_sale_package" as const,
      accountCode: "2910" as const,
      alreadyDispatched: saleAlreadyDispatched,
      dispatchedShipmentId: saleAlreadyDispatched ? matchedSale.linkedShipmentId : null,
      workOrderNo: matchedSale.docNo,
      docNo: matchedSale.docNo,
      customerName: matchedSale.customer,
      clientId: matchedSale.clientId || null,
      productName: saleItems.length > 0 ? saleItems.map((it) => it.name).join(", ") : "Savdo aksessuarlari",
      sku: saleItems[0]?.sku || `TRD-${matchedSale.docNo}`,
      unit: saleItems[0]?.unit || "dona",
      unitPrice: saleItems[0]?.unitPrice || 0,
      tradingSaleId: matchedSale.docNo,
      items: saleItems,
      boxes: [
        {
          id: `trd-box-${matchedSale.docNo}`,
          boxNumber: 1,
          boxCode: `BX-${matchedSale.docNo}`,
          barcode: matchedSale.docNo,
          quantity: totalQty,
          grossWeightKg: totalWeightKg,
          productName: "Savdo aksessuarlari to'plami (2910)",
          customerName: matchedSale.customer,
          workOrderNo: matchedSale.docNo,
        },
      ],
    };
  }

  // 5) Check if code matches an individual Trading Catalog item SKU / Barcode (2910)
  const allCatalog = await exec.query.tradingCatalog.findMany({
    where: eq(tradingCatalog.companyId, companyId),
  });

  const matchedCatalogItem = allCatalog.find(
    (c) =>
      (c.sku || "").toUpperCase() === code ||
      (c.sku || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget
  );

  if (matchedCatalogItem) {
    // Bitta skan = 1 birlik (POS/WMS standarti). Ko'proq kerak bo'lsa qayta skanerlanadi yoki jadvalda tahrirlanadi.
    const stdQty = 1;
    const price = Number(matchedCatalogItem.wholesalePriceUzs) || Number(matchedCatalogItem.priceUzs) || 0;

    return {
      found: true,
      mode: "trading_catalog_item" as const,
      accountCode: "2910" as const,
      alreadyDispatched: false,
      dispatchedShipmentId: null,
      workOrderNo: "",
      customerName: "",
      productName: matchedCatalogItem.name,
      sku: matchedCatalogItem.sku,
      finishedGoodId: null,
      tradingCatalogId: matchedCatalogItem.id,
      unit: matchedCatalogItem.unit || "dona",
      unitPrice: price,
      items: [
        {
          id: `item-${matchedCatalogItem.sku}-${Date.now()}`,
          sku: matchedCatalogItem.sku,
          name: matchedCatalogItem.name,
          quantity: stdQty,
          unit: matchedCatalogItem.unit || "dona",
          unitPrice: price,
          totalPrice: stdQty * price,
          accountCode: "2910" as const,
          tradingCatalogId: matchedCatalogItem.id,
          notes: `Savdo katalogi (${matchedCatalogItem.category}) shtrix-kodi skanerlandi`,
        },
      ],
      boxes: [
        {
          id: `cat-box-${matchedCatalogItem.sku}`,
          boxNumber: 1,
          boxCode: `BX-${matchedCatalogItem.sku}`,
          barcode: matchedCatalogItem.sku,
          quantity: stdQty,
          grossWeightKg: Number((stdQty * 0.005).toFixed(2)),
          productName: matchedCatalogItem.name,
          customerName: "",
          workOrderNo: "",
        },
      ],
    };
  }

  return {
    found: false,
    message: `"${code}" shtrix-kodi bo'yicha quti yoki buyurtma topilmadi.`,
  };
}
