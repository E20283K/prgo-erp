import { db, writeAuditLog } from "@/db";
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
  companies,
  branches,
  wmsBins,
  wmsBinItems,
  tradingCatalog,
  tradingSales,
} from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { getNextReceiptNumber, getNextShipmentNumber, getNextMaterialSku, getNextMovementNumber, getNextInventoryCountNumber, getNextManifestNumber } from "./numberingService";
import { emitNotification } from "./notificationService";
import { upsertDeliveryAct } from "./financeService";
import { applySalePostedEffects } from "./tradingService";

/**
 * Korxona kodi bo'yicha korxona ID sini olish
 */
export async function getCompanyIdByCode(code: string = "PRINTGOO"): Promise<string> {
  const comp = await db.query.companies.findFirst({
    where: eq(companies.code, code),
  });
  if (!comp) {
    const firstComp = await db.query.companies.findFirst();
    if (!firstComp) throw new Error("Tizimda korxona (Company) topilmadi!");
    return firstComp.id;
  }
  return comp.id;
}

// ─── 1. Warehouses (Omborlar Katalogi & Ierarxiya) ────────────────────────────

/**
 * Filiallar va YTT lar uchun standart omborlar (Xomashyo va Tayyor mahsulot)
 * mavjudligini tekshiradi va agar yo'q bo'lsa avtomatik yaratadi.
 */
export async function ensureDefaultWarehouses() {
  const allBranches = await db.query.branches.findMany();
  const allCompanies = await db.query.companies.findMany();
  const existingWarehouses = await db.query.warehouses.findMany();

  for (const branch of allBranches) {
    const branchWhs = existingWarehouses.filter((w) => w.branchId === branch.id);
    if (branchWhs.length === 0) {
      await db.insert(warehouses).values({
        companyId: branch.companyId,
        branchId: branch.id,
        code: `WH-RAW-${branch.code || Date.now().toString().slice(-4)}`,
        name: "Xomashyo ombori",
        type: "raw_materials",
        capacity: "5000 m2",
        zones: 3,
        isActive: true,
      });

      await db.insert(warehouses).values({
        companyId: branch.companyId,
        branchId: branch.id,
        code: `WH-FG-${branch.code || Date.now().toString().slice(-4)}`,
        name: "Tayyor mahsulotlar ombori",
        type: "finished_goods",
        capacity: "3000 m2",
        zones: 2,
        isActive: true,
      });
    }
  }

  for (const comp of allCompanies) {
    if (comp.legalType === "YTT") {
      const compWhs = existingWarehouses.filter((w) => w.companyId === comp.id);
      if (compWhs.length === 0) {
        await db.insert(warehouses).values({
          companyId: comp.id,
          branchId: null,
          code: `WH-STORE-${comp.code || Date.now().toString().slice(-4)}`,
          name: "Savdo ombori",
          type: "general",
          capacity: "1000 m2",
          zones: 1,
          isActive: true,
        });
      }
    }
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

  if (payload.branchId && !targetCompanyId) {
    const br = await db.query.branches.findFirst({
      where: eq(branches.id, payload.branchId),
    });
    if (br) targetCompanyId = br.companyId;
  }

  if (!targetCompanyId) {
    targetCompanyId = await getCompanyIdByCode(companyCode);
  }

  const values = {
    companyId: targetCompanyId,
    branchId: payload.branchId || null,
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

export async function getStockBalances(companyCode: string = "PRINTGOO", locationName?: string) {
  const companyId = await getCompanyIdByCode(companyCode);
  if (locationName) {
    return db.query.warehouseStockBalances.findMany({
      where: and(
        eq(warehouseStockBalances.companyId, companyId),
        eq(warehouseStockBalances.locationName, locationName)
      ),
      orderBy: [desc(warehouseStockBalances.updatedAt)],
    });
  }
  return db.query.warehouseStockBalances.findMany({
    where: eq(warehouseStockBalances.companyId, companyId),
    orderBy: [desc(warehouseStockBalances.updatedAt)],
  });
}

export async function upsertStockBalance(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const stockLevel = Number(payload.stockLevel) || 0;
  const reserved = Number(payload.reserved) || 0;
  const available = Math.max(0, stockLevel - reserved);
  const reorder = Number(payload.reorder) || 1000;

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
    locationShelf: payload.locationShelf || null,
    imageUrl: payload.imageUrl || null,
    lastReceived: payload.lastReceived ? new Date(payload.lastReceived) : new Date(),
    status: (payload.status as any) || computedStatus,
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

  return record;
}

// ─── 3. Warehouse Receipts (Kirim Orderlari) ───────────────────────────────────

export async function getWarehouseReceipts(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.warehouseReceipts.findMany({
    where: eq(warehouseReceipts.companyId, companyId),
    with: {
      items: true,
      warehouse: true,
    },
    orderBy: [desc(warehouseReceipts.receiptDate)],
  });
}

export async function upsertWarehouseReceipt(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawNo = (payload.receiptNumber || payload.id || "").trim();
  const isDraft = !rawNo || rawNo.startsWith("draft-") || rawNo.startsWith("RCV-NEW-") || rawNo.startsWith("tab-") || rawNo === "NEW" || rawNo.includes("Qoralama") || rawNo.includes("Yangi");
  const receiptNumber = isDraft ? await getNextReceiptNumber(companyCode) : rawNo;
  const status = payload.status || "Draft";
  const locationName = payload.locationName || payload.location || "Asosiy ombor";

  // Calculate total amount from items
  const itemsList = Array.isArray(payload.items) ? payload.items : [];
  let totalAmount = 0;
  for (const item of itemsList) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice || item.unitPriceUsd) || 0;
    totalAmount += qty * price;
  }

  const receiptValues = {
    companyId,
    warehouseId: payload.warehouseId || null,
    receiptNumber,
    receiptDate: payload.receiptDate || payload.date ? new Date(payload.receiptDate || payload.date) : new Date(),
    supplierName: payload.supplierName || payload.supplier || "Noma'lum yetkazib beruvchi",
    poNumber: payload.poNumber || null,
    locationName,
    status: status as any,
    receivedBy: payload.receivedBy || null,
    notes: payload.notes || null,
    totalAmount: totalAmount.toString(),
    currency: payload.currency || "UZS",
    updatedAt: new Date(),
  };

  let receiptRecord;
  if (!isDraft && payload.id && !payload.id.startsWith("RCV-NEW-") && !payload.id.startsWith("tab-")) {
    const [existing] = await db
      .update(warehouseReceipts)
      .set(receiptValues)
      .where(and(eq(warehouseReceipts.receiptNumber, receiptNumber), eq(warehouseReceipts.companyId, companyId)))
      .returning();
    receiptRecord = existing;
  }

  if (!receiptRecord) {
    const [inserted] = await db
      .insert(warehouseReceipts)
      .values(receiptValues)
      .onConflictDoUpdate({
        target: [warehouseReceipts.companyId, warehouseReceipts.receiptNumber],
        set: receiptValues,
      })
      .returning();
    receiptRecord = inserted;
  }

  // Insert or update line items
  if (itemsList.length > 0) {
    await db.delete(warehouseReceiptItems).where(eq(warehouseReceiptItems.receiptId, receiptRecord.id));

    for (const item of itemsList) {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice || item.unitPriceUsd) || 0;
      const totalPrice = qty * unitPrice;

      await db.insert(warehouseReceiptItems).values({
        receiptId: receiptRecord.id,
        itemId: item.itemId || null,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        name: item.name || "Noma'lum tovar",
        category: item.category || "Paper & Board",
        quantity: qty.toString(),
        unit: item.unit || "sheets",
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
        sheetFormat: item.sheetFormat || null,
        grammage: item.grammage ? Number(item.grammage) : null,
        batchNumber: item.batchNumber || null,
        notes: item.notes || null,
      });

      // 1C Jamg'arish Registri: Agar hujjat tasdiqlangan bo'lsa (Accepted), qoldiqni oshirish
      if (status === "Accepted") {
        await applyStockBalanceDelta({
          companyId,
          locationName,
          sku: item.sku,
          name: item.name,
          category: item.category,
          deltaQty: qty,
          unit: item.unit,
          unitPriceUsd: unitPrice,
          sheetFormat: item.sheetFormat,
          grammage: item.grammage,
        });
      }
    }
  }

  // Biznes bildirishnoma triggeri (Ombor kirimi)
  try {
    if (status === "Posted") {
      await emitNotification(
        {
          dedupKey: `receipt-posted:${receiptNumber}`,
          severity: "info",
          category: "warehouse",
          eventType: "stock_receipt:posted",
          entityCode: receiptNumber,
          title: `Ombor kirimi o'tkazildi: ${receiptNumber}`,
          description: `${payload.supplierName || "Yetkazib beruvchi"} dan xomashyo kirim qilindi (${locationName}).`,
          link: { module: "warehouse", subModule: "receipts" },
          targetTab: {
            id: `doc-receipt-${receiptNumber}`,
            title: `${receiptNumber} (Kirim)`,
            type: "warehouse-receipt",
            module: "warehouse",
          },
        },
        companyCode
      );
    }
  } catch (_) {}

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

export async function upsertWarehouseShipment(payload: any, companyCode: string = "ALL") {
  const effectiveCompanyCode = companyCode && companyCode !== "ALL" ? companyCode : "PRINTGOO";
  const companyId = payload.companyId || (await getCompanyIdByCode(effectiveCompanyCode));
  const rawNo = (payload.shipmentNumber || payload.id || "").trim();
  const isDraft = !rawNo || rawNo.startsWith("draft-") || rawNo.startsWith("SHP-NEW-") || rawNo.startsWith("tab-") || rawNo === "NEW" || rawNo.includes("Qoralama") || rawNo.includes("Yangi");
  const shipmentNumber = isDraft ? await getNextShipmentNumber(effectiveCompanyCode) : rawNo;
  const status = payload.status || "Draft";
  const fromLocationName = payload.fromLocationName || payload.from || "Asosiy ombor";

  // Oldin bazada ushbu chiqim "Dispatched" yoki "Delivered" bo'lganligini tekshiramiz (qoldiq ikki marta yechilmasligi uchun)
  const existingShipment = !isDraft
    ? await db.query.warehouseShipments.findFirst({
        where: and(
          eq(warehouseShipments.companyId, companyId),
          eq(warehouseShipments.shipmentNumber, shipmentNumber)
        ),
      })
    : null;
  const wasAlreadyDispatched =
    existingShipment?.status === "Dispatched" || existingShipment?.status === "Delivered";
  const isNowDispatched = status === "Dispatched" || status === "Delivered";
  const shouldTriggerDispatchEffects = isNowDispatched && !wasAlreadyDispatched;

  const shipmentValues = {
    companyId,
    warehouseId: payload.warehouseId || null,
    manifestId: payload.manifestId || existingShipment?.manifestId || null,
    originSource: payload.originSource || existingShipment?.originSource || "direct",
    shipmentNumber,
    shipmentDate: payload.shipmentDate || payload.date ? new Date(payload.shipmentDate || payload.date) : new Date(),
    shipmentType: payload.shipmentType || existingShipment?.shipmentType || "CustomerDelivery",
    clientId: payload.clientId || existingShipment?.clientId || null,
    customerName: payload.customerName || payload.customer || existingShipment?.customerName || "Mijoz",
    workOrderId: payload.workOrderId || payload.workOrder || existingShipment?.workOrderId || null,
    deliveryActId: payload.deliveryActId || existingShipment?.deliveryActId || null,
    tradingSaleId: payload.tradingSaleId || existingShipment?.tradingSaleId || null,
    fromLocationName,
    status: status as any,
    carrier: payload.carrier || existingShipment?.carrier || null,
    driverName: payload.driverName || existingShipment?.driverName || null,
    trackingNo: payload.trackingNo || existingShipment?.trackingNo || null,
    shippedBy: payload.shippedBy || existingShipment?.shippedBy || null,
    notes: payload.notes || existingShipment?.notes || null,
    updatedAt: new Date(),
  };

  const [shipmentRecord] = await db
    .insert(warehouseShipments)
    .values(shipmentValues)
    .onConflictDoUpdate({
      target: [warehouseShipments.companyId, warehouseShipments.shipmentNumber],
      set: shipmentValues,
    })
    .returning();

  const itemsList = Array.isArray(payload.items) ? payload.items : [];
  if (itemsList.length > 0) {
    await db.delete(warehouseShipmentItems).where(eq(warehouseShipmentItems.shipmentId, shipmentRecord.id));

    for (const item of itemsList) {
      const qty = Number(item.quantity ?? item.shippedQty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const totalPrice = qty * unitPrice;

      await db.insert(warehouseShipmentItems).values({
        shipmentId: shipmentRecord.id,
        itemId: item.itemId || null,
        finishedGoodId: item.finishedGoodId || null,
        tradingCatalogId: item.tradingCatalogId || null,
        accountCode: item.accountCode || (item.tradingCatalogId ? "2910" : "2810"),
        sourceWorkOrderId: item.sourceWorkOrderId || payload.workOrderId || payload.workOrder || null,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        name: item.name || item.product || "Mahsulot",
        quantity: qty.toString(),
        unit: item.unit || "pcs",
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
        notes: item.notes || null,
      });

      // 1C Jamg'arish Registri: Faqat ilk marta Dispatched/Delivered bo'lganda tegishli ombordan 1 marta qoldiqni kamaytirish
      if (shouldTriggerDispatchEffects) {
        const itemAccount = item.accountCode || (item.tradingCatalogId ? "2910" : "2810");

        if (itemAccount === "2910" || item.tradingCatalogId) {
          // 2910 Savdo tovarlari (aksessuarlar) omboridan kamaytirish
          let catRow = null;
          if (item.tradingCatalogId) {
            catRow = await db.query.tradingCatalog.findFirst({
              where: and(
                eq(tradingCatalog.companyId, companyId),
                eq(tradingCatalog.id, item.tradingCatalogId)
              ),
            });
          }
          if (!catRow && item.sku) {
            catRow = await db.query.tradingCatalog.findFirst({
              where: and(
                eq(tradingCatalog.companyId, companyId),
                eq(tradingCatalog.sku, item.sku)
              ),
            });
          }
          if (catRow) {
            const currentCatQty = Number(catRow.stockQty) || 0;
            const newCatQty = Math.max(0, currentCatQty - qty);
            await db
              .update(tradingCatalog)
              .set({
                stockQty: newCatQty.toString(),
                updatedAt: new Date(),
              })
              .where(eq(tradingCatalog.id, catRow.id));
          }
        } else if (itemAccount === "2810") {
          // 2810 Tayyor mahsulot zaxirasidan kamaytirish
          if (item.finishedGoodId) {
            const fgRow = await db.query.warehouseFinishedGoods.findFirst({
              where: and(
                eq(warehouseFinishedGoods.companyId, companyId),
                eq(warehouseFinishedGoods.id, item.finishedGoodId)
              ),
            });
            if (fgRow) {
              const newFgQty = Math.max(0, (Number(fgRow.quantity) || 0) - qty);
              await db
                .update(warehouseFinishedGoods)
                .set({
                  quantity: newFgQty.toString(),
                  status: newFgQty <= 0 ? ("Out of Stock" as any) : ("In Stock" as any),
                  updatedAt: new Date(),
                })
                .where(eq(warehouseFinishedGoods.id, fgRow.id));
            }
          }
        } else if (itemAccount === "1010") {
          // 1010 Xomashyo omboridan kamaytirish
          await applyStockBalanceDelta({
            companyId,
            locationName: fromLocationName,
            sku: item.sku,
            name: item.name || item.product,
            deltaQty: -qty,
            unit: item.unit,
          });
        }
      }
    }
  }

  // Agar shtrix-kod skaneri orqali qutilar biriktirilgan bo'lsa va chiqim qilinsa, qutilar statusini yangilash
  if ((status === "Dispatched" || status === "Delivered") && Array.isArray(payload.scannedBoxes) && payload.scannedBoxes.length > 0) {
    const scannedBarcodes = new Set(
      payload.scannedBoxes.map((b: any) => (typeof b === "string" ? b : b.barcode || b.boxCode || "").trim().toUpperCase())
    );
    const allWos = await db.query.workOrders.findMany({
      where: eq(workOrders.companyId, companyId),
    });
    for (const wo of allWos) {
      const pkg = wo.packagingData as any;
      if (pkg && Array.isArray(pkg.boxes)) {
        let changed = false;
        const updatedBoxes = pkg.boxes.map((box: any) => {
          const bCode = String(box.barcode || "").trim().toUpperCase();
          const bxCode = String(box.boxCode || "").trim().toUpperCase();
          if (scannedBarcodes.has(bCode) || scannedBarcodes.has(bxCode)) {
            changed = true;
            return {
              ...box,
              status: "dispatched",
              shipmentId: shipmentNumber,
            };
          }
          return box;
        });
        if (changed) {
          await db
            .update(workOrders)
            .set({
              packagingData: { ...pkg, boxes: updatedBoxes },
              updatedAt: new Date(),
            })
            .where(eq(workOrders.id, wo.id));
        }
      }
    }
  }

  const linkedTradingSaleKey = shipmentValues.tradingSaleId;
  if (linkedTradingSaleKey) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(linkedTradingSaleKey).trim());
      const [updatedSale] = await db
        .update(tradingSales)
        .set({
          linkedShipmentId: shipmentRecord.shipmentNumber,
          ...(isNowDispatched ? { status: "Posted" as const } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tradingSales.companyId, companyId),
            isUuid
              ? or(
                  eq(tradingSales.docNo, linkedTradingSaleKey),
                  eq(tradingSales.id, linkedTradingSaleKey)
                )
              : eq(tradingSales.docNo, linkedTradingSaleKey)
          )
        )
        .returning();

      if (isNowDispatched && updatedSale) {
        await applySalePostedEffects(companyId, updatedSale.id, updatedSale, itemsList as any);
      }
    } catch (e) {
      console.warn("Failed to back-sync trading sale linkedShipmentId:", e);
    }
  }

  // Avtomatik yagona Schet-faktura (Delivery Act / SF-...) yaratish (CustomerDelivery yoki MaterialSale Dispatched bo'lganda)
  let finalDeliveryActId = shipmentRecord.deliveryActId || null;
  if (
    isNowDispatched &&
    !finalDeliveryActId &&
    itemsList.length > 0 &&
    (shipmentValues.shipmentType === "CustomerDelivery" || shipmentValues.shipmentType === "MaterialSale")
  ) {
    try {
      const invoiceItems = itemsList.map((it: any, idx: number) => {
        const q = Number(it.quantity ?? it.shippedQty) || 0;
        const p = Number(it.unitPrice) || 0;
        return {
          id: `act-item-${idx + 1}`,
          sku: it.sku || `SKU-${idx + 1}`,
          name: it.name || it.product || "Mahsulot",
          unit: it.unit || "dona",
          quantity: q,
          unitPrice: p,
          totalPrice: q * p,
          vatRate: 0,
          vatAmount: 0,
        };
      });
      const totalInvoiceAmount = invoiceItems.reduce((acc: number, it: any) => acc + it.totalPrice, 0);

      const generatedAct = await upsertDeliveryAct(
        {
          date: new Date(shipmentValues.shipmentDate).toISOString().split("T")[0],
          workOrderId: shipmentValues.workOrderId || undefined,
          customer: shipmentValues.customerName,
          product: invoiceItems.map((i: any) => i.name).join(", "),
          quantity: invoiceItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
          unit: invoiceItems[0]?.unit || "dona",
          subtotal: totalInvoiceAmount,
          vatRate: 0,
          vatAmount: 0,
          totalAmount: totalInvoiceAmount,
          currency: "UZS",
          warehouse: shipmentValues.fromLocationName,
          carrier: shipmentValues.carrier || undefined,
          driverName: shipmentValues.driverName || undefined,
          status: "Pending Signature",
          linkedShipmentId: shipmentRecord.shipmentNumber,
          notes: `Ombor chiqimi ${shipmentRecord.shipmentNumber} asosida avtomatik shakllantirildi`,
          items: invoiceItems,
        },
        effectiveCompanyCode
      );

      if (generatedAct && generatedAct.id) {
        finalDeliveryActId = generatedAct.id;
        await db
          .update(warehouseShipments)
          .set({ deliveryActId: finalDeliveryActId, updatedAt: new Date() })
          .where(eq(warehouseShipments.id, shipmentRecord.id));
        shipmentRecord.deliveryActId = finalDeliveryActId;
      }
    } catch (e) {
      console.warn("Failed to auto-generate DeliveryAct for shipment:", e);
    }
  }

  const allShipments = await getWarehouseShipments(companyCode);
  return {
    success: true,
    shipment: shipmentRecord,
    shipmentNumber: shipmentRecord.shipmentNumber,
    deliveryActId: finalDeliveryActId,
    allShipments,
  };
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

export async function upsertWarehouseMovement(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rawCandidate = (payload.movementNumber || payload.id || "").trim();
  const isDraft =
    !rawCandidate ||
    rawCandidate.startsWith("draft-") ||
    rawCandidate.startsWith("new-") ||
    rawCandidate.startsWith("tab-") ||
    rawCandidate.startsWith("ISSUE-NEW-") ||
    rawCandidate.startsWith("WOFF-NEW-") ||
    rawCandidate.includes("NEW") ||
    rawCandidate.includes("Qoralama") ||
    rawCandidate.includes("Yangi") ||
    rawCandidate === "NEW";

  const movementType = payload.movementType || "Transfer";
  let prefix: "ISS" | "RET" | "WOF" | "MOV" = "MOV";
  if (movementType === "ProductionIssue") prefix = "ISS";
  else if (movementType === "ProductionReturn" || movementType === "CuttingReturn") prefix = "RET";
  else if (movementType === "WriteOff") prefix = "WOF";

  const movementNumber = isDraft ? await getNextMovementNumber(prefix, companyCode) : rawCandidate;
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
    movementNumber,
    movementDate: payload.movementDate || payload.date ? new Date(payload.movementDate || payload.date) : new Date(),
    fromWarehouseId: payload.fromWarehouseId || null,
    toWarehouseId: payload.toWarehouseId || null,
    fromLocationName: payload.fromLocationName || payload.from || "A ombor",
    toLocationName: payload.toLocationName || payload.to || "B ombor",
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

  const [movementRecord] = await db
    .insert(warehouseMovements)
    .values(values)
    .onConflictDoUpdate({
      target: [warehouseMovements.companyId, warehouseMovements.movementNumber],
      set: values,
    })
    .returning();

  // Ombor balansi deltalarini hisoblash
  if (status === "Completed") {
    for (const line of itemsList) {
      const lineQty = Number(line.quantity) || 0;
      const lineRcvQty = Number(line.receivedQty) || lineQty;
      const sku = line.sku || values.materialSku;
      const name = line.name || values.materialName;
      const unit = line.unit || values.unit;

      if (!sku) continue;

      if (movementType === "Transfer") {
        await applyStockBalanceDelta({
          companyId,
          locationName: values.fromLocationName,
          sku,
          name,
          deltaQty: -lineQty,
          unit,
        });
        await applyStockBalanceDelta({
          companyId,
          locationName: values.toLocationName,
          sku,
          name,
          deltaQty: lineRcvQty,
          unit,
          sheetFormat: line.sheetFormat,
        });
      } else if (movementType === "ProductionIssue" || movementType === "WriteOff") {
        await applyStockBalanceDelta({
          companyId,
          locationName: values.fromLocationName,
          sku,
          name,
          deltaQty: -lineQty,
          unit,
        });
      } else if (movementType === "ProductionReturn" || movementType === "CuttingReturn") {
        await applyStockBalanceDelta({
          companyId,
          locationName: values.toLocationName,
          sku,
          name,
          deltaQty: lineRcvQty,
          unit,
          sheetFormat: line.sheetFormat,
        });
      }
    }
  }

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
  const countNumber = payload.countNumber || payload.id || `IC-${Date.now().toString().slice(-4)}`;
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

  const [record] = await db
    .insert(warehouseInventoryCounts)
    .values(values)
    .onConflictDoUpdate({
      target: [warehouseInventoryCounts.companyId, warehouseInventoryCounts.countNumber],
      set: values,
    })
    .returning();

  // Agar yakunlangan bo'lsa (Completed), ombor balansini haqiqiy qoldiqqa tenglashtirish (applyStockBalanceDelta)
  if (status === "Completed") {
    for (const item of itemsList) {
      const itemVariance = Number(item.variance) || (Number(item.actualQty) - Number(item.systemQty)) || 0;
      const sku = item.sku || values.materialSku;
      const name = item.name || values.materialName;
      const unit = item.unit || values.unit;

      if (sku && itemVariance !== 0) {
        await applyStockBalanceDelta({
          companyId,
          locationName: values.locationName,
          sku,
          name,
          deltaQty: itemVariance,
          unit,
        });
      }
    }
  }

  return record;
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
      stockQty,
      unit: fg.unit || "pcs",
      costPricePerUnit: 0,
      totalStockValue: 0,
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
    updatedAt: new Date(),
  };

  const [record] = await db
    .insert(warehouseFinishedGoods)
    .values(values)
    .onConflictDoUpdate({
      target: [
        warehouseFinishedGoods.companyId,
        warehouseFinishedGoods.sku,
        warehouseFinishedGoods.workOrderId,
      ],
      set: values,
    })
    .returning();

  return record;
}

// ─── Helper: 1C Qoldiqlar Registri Deltasi (Accumulation Register Updater) ──────

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
}) {
  const { companyId, locationName, sku, name, deltaQty } = params;
  if (!sku) return;

  const existing = await db.query.warehouseStockBalances.findFirst({
    where: and(
      eq(warehouseStockBalances.companyId, companyId),
      eq(warehouseStockBalances.locationName, locationName),
      eq(warehouseStockBalances.sku, sku)
    ),
  });

  const currentLevel = existing ? Number(existing.stockLevel) : 0;
  const currentReserved = existing ? Number(existing.reserved) : 0;
  const newLevel = Math.max(0, currentLevel + deltaQty);
  const newAvailable = Math.max(0, newLevel - currentReserved);
  const reorder = existing ? Number(existing.reorder) : 1000;

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
    unitPriceUsd: (params.unitPriceUsd !== undefined ? params.unitPriceUsd : (Number(existing?.unitPriceUsd) || 0)).toString(),
    status: computedStatus,
    lastReceived: deltaQty > 0 ? new Date() : (existing?.lastReceived || new Date()),
    updatedAt: new Date(),
  };

  await db
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
      eq(warehouseFinishedGoods.receiptStatus, "PendingReceipt")
    ),
    orderBy: [desc(warehouseFinishedGoods.createdAt)],
  });

  return rows.map((fg) => ({
    ...fg,
    id: fg.id,
    quantity: Number(fg.quantity) || 0,
    costPricePerUnit: Number(fg.costPricePerUnit) || 0,
    totalStockValue: Number(fg.totalStockValue) || 0,
    createdDate: fg.createdAt ? new Date(fg.createdAt).toISOString().split("T")[0] : "",
  }));
}

export async function confirmFinishedGoodsReceipt(
  fgId: string,
  confirmedQty?: number,
  locationShelf?: string,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);
  const existing = await db.query.warehouseFinishedGoods.findFirst({
    where: and(
      eq(warehouseFinishedGoods.companyId, companyId),
      eq(warehouseFinishedGoods.id, fgId)
    ),
  });

  if (!existing) {
    throw new Error("Kutilayotgan tayyor mahsulot topilmadi");
  }

  const finalQty = confirmedQty !== undefined ? confirmedQty : Number(existing.quantity);
  const shelf = locationShelf || existing.locationShelf || "FG-01";

  const [updated] = await db
    .update(warehouseFinishedGoods)
    .set({
      quantity: finalQty.toString(),
      receiptStatus: "Received",
      status: "In Stock",
      locationShelf: shelf,
      updatedAt: new Date(),
    })
    .where(eq(warehouseFinishedGoods.id, fgId))
    .returning();

  // 1C Jamg'arish Registrida qoldiqni oshirish
  await applyStockBalanceDelta({
    companyId,
    locationName: existing.locationName || "Tayyor mahsulotlar ombori",
    sku: existing.sku,
    name: existing.productName,
    deltaQty: finalQty,
    unit: existing.unit,
  });

  return updated;
}

// ─── 9. Available Finished Goods Stock for Multi-customer Shipment ─────────────

export async function getAvailableFinishedGoodsForShipment(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.warehouseFinishedGoods.findMany({
    where: and(
      eq(warehouseFinishedGoods.companyId, companyId),
      eq(warehouseFinishedGoods.receiptStatus, "Received")
    ),
    orderBy: [desc(warehouseFinishedGoods.producedAt)],
  });

  return rows
    .map((fg) => {
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
    shipments: m.shipments || [],
    totalShipmentsCount: m.shipments ? m.shipments.length : m.totalShipmentsCount,
  }));
}

export async function upsertDispatchManifest(payload: any, companyCode: string = "ALL") {
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

  const [manifestRecord] = await db
    .insert(warehouseDispatchManifests)
    .values(manifestValues)
    .onConflictDoUpdate({
      target: [warehouseDispatchManifests.companyId, warehouseDispatchManifests.manifestNumber],
      set: manifestValues,
    })
    .returning();

  // Chiqim hujjatlarini ushbu manifestga biriktirish va mashina/haydovchi ma'lumotlarini tushirish
  if (Array.isArray(payload.shipmentIds) && payload.shipmentIds.length > 0) {
    const carrierSummary = [
      manifestValues.vehicleModel || "Reys transporti",
      manifestValues.vehiclePlate ? `(${manifestValues.vehiclePlate})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    for (const shpId of payload.shipmentIds) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(shpId));
      const targetShp = await db.query.warehouseShipments.findFirst({
        where: isUuid
          ? or(eq(warehouseShipments.id, shpId), eq(warehouseShipments.shipmentNumber, shpId))
          : eq(warehouseShipments.shipmentNumber, shpId),
        with: {
          items: true,
        },
      });

      const nextStatus =
        manifestValues.status === "InTransit" || manifestValues.status === "Dispatched"
          ? "Dispatched"
          : manifestValues.status === "Delivered"
          ? "Delivered"
          : undefined;

      if (targetShp && nextStatus && targetShp.status !== "Dispatched" && targetShp.status !== "Delivered") {
        // Reys jo'natilganda unga biriktirilgan chiqimlarni rasmiy ravishda o'tkazamiz (qoldiq kamayishi + SF- faktura yaratilishi)
        await upsertWarehouseShipment(
          {
            companyId: targetShp.companyId,
            shipmentNumber: targetShp.shipmentNumber,
            shipmentDate: targetShp.shipmentDate,
            shipmentType: targetShp.shipmentType,
            clientId: targetShp.clientId,
            customerName: targetShp.customerName,
            workOrderId: targetShp.workOrderId,
            deliveryActId: targetShp.deliveryActId,
            tradingSaleId: targetShp.tradingSaleId,
            fromLocationName: targetShp.fromLocationName,
            manifestId: manifestRecord.id,
            carrier: carrierSummary,
            driverName: manifestValues.driverName || targetShp.driverName,
            trackingNo: manifestNumber,
            status: nextStatus,
            notes: targetShp.notes,
            items: (targetShp.items || []).map((it: any) => ({
              itemId: it.itemId,
              finishedGoodId: it.finishedGoodId,
              tradingCatalogId: it.tradingCatalogId,
              accountCode: it.accountCode,
              sourceWorkOrderId: it.sourceWorkOrderId,
              sku: it.sku,
              name: it.name,
              quantity: Number(it.quantity) || 0,
              unit: it.unit,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice: Number(it.totalPrice) || 0,
              notes: it.notes,
            })),
          },
          companyCode
        );
      } else {
        const updateFields: Record<string, any> = {
          manifestId: manifestRecord.id,
          carrier: carrierSummary,
          driverName: manifestValues.driverName || null,
          trackingNo: manifestNumber,
          updatedAt: new Date(),
        };
        if (nextStatus) {
          updateFields.status = nextStatus;
        }
        await db
          .update(warehouseShipments)
          .set(updateFields)
          .where(
            isUuid
              ? or(eq(warehouseShipments.id, shpId), eq(warehouseShipments.shipmentNumber, shpId))
              : eq(warehouseShipments.shipmentNumber, shpId)
          );
      }
    }
  }

  // Agar mavjud reysdan ayrim chiqimlar olib tashlangan bo'lsa, ularni reysdan bo'shatamiz
  const allLinked = await db.query.warehouseShipments.findMany({
    where: eq(warehouseShipments.manifestId, manifestRecord.id),
  });
  for (const linked of allLinked) {
    const stillSelected = Array.isArray(payload.shipmentIds) && payload.shipmentIds.some(
      (id: string) => id === linked.id || id === linked.shipmentNumber
    );
    if (!stillSelected) {
      await db
        .update(warehouseShipments)
        .set({ manifestId: null, trackingNo: null, updatedAt: new Date() })
        .where(eq(warehouseShipments.id, linked.id));
    }
  }

  const allManifests = await getDispatchManifests(companyCode);
  return {
    success: true,
    manifest: manifestRecord,
    manifestNumber: manifestRecord.manifestNumber,
    allManifests,
  };
}

// ─── 12. Box Barcode & Product Passport Scanner Lookup ─────────────────────────

export async function lookupBoxOrWorkOrderBarcode(rawCode: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) {
    throw new Error("Shtrix-kod kiritilmadi");
  }

  const allWos = await db.query.workOrders.findMany({
    where: eq(workOrders.companyId, companyId),
  });
  const allFg = await db.query.warehouseFinishedGoods.findMany({
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
        const totalWoQty = Math.max(1, Number(wo.quantity) || 1);
        const unitPrice =
          Number(fg?.costPricePerUnit) ||
          Number(((Number(wo.priceTotal) || 0) / totalWoQty).toFixed(4)) ||
          0;
        const unitWeightGrams = Number(pkg.unitWeightGrams) || Number(matchedBox.unitWeightGrams) || 15;
        const boxQty = Number(matchedBox.quantity) || 500;
        const boxWeightKg =
          Number(matchedBox.grossWeightKg) ||
          Number(((boxQty * unitWeightGrams) / 1000).toFixed(2));

        return {
          found: true,
          mode: "single_box" as const,
          alreadyDispatched: matchedBox.status === "dispatched",
          dispatchedShipmentId: matchedBox.shipmentId || null,
          workOrderNo: wo.docNo,
          customerName: wo.customerName,
          clientId: wo.clientId,
          productName: wo.productName,
          sku: fg?.sku || `FG-${wo.docNo}`,
          finishedGoodId: fg?.id || null,
          unit: wo.unit || fg?.unit || "pcs",
          unitPrice,
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
  const boxSuffixMatch = code.match(/^(?:BX-)?(.+?)-(?:B)?(d{1,3})$/);
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
      const unitPrice =
        Number(matchedFg?.costPricePerUnit) ||
        (matchedWo ? Number(((Number(matchedWo.priceTotal) || 0) / Math.max(1, Number(matchedWo.quantity) || 1)).toFixed(4)) : 0);

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
    const unitPrice =
      Number(matchedFg?.costPricePerUnit) ||
      (matchedWo ? Number(((Number(matchedWo.priceTotal) || 0) / Math.max(1, Number(matchedWo.quantity) || 1)).toFixed(4)) : 0);

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
      boxes: readyBoxes,
    };
  }

  // 4) Check if code matches a Trading Sale sticker / package (TRD-..., TR-SALE-..., TRD-BOX-...)
  const allSales = await db.query.tradingSales.findMany({
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

    return {
      found: true,
      mode: "trading_sale_package" as const,
      accountCode: "2910" as const,
      alreadyDispatched: !!matchedSale.linkedShipmentId,
      dispatchedShipmentId: matchedSale.linkedShipmentId || null,
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
  const allCatalog = await db.query.tradingCatalog.findMany({
    where: eq(tradingCatalog.companyId, companyId),
  });

  const matchedCatalogItem = allCatalog.find(
    (c) =>
      (c.sku || "").toUpperCase() === code ||
      (c.sku || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanTarget
  );

  if (matchedCatalogItem) {
    const stdQty = Math.min(1000, Math.max(1, Number(matchedCatalogItem.stockQty) || 100));
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
