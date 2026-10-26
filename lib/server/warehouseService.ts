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
  carriers,
  companies,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getNextReceiptNumber, getNextShipmentNumber } from "./numberingService";
import { emitNotification } from "./notificationService";

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

// ─── 1. Warehouses (Omborlar Katalogi) ────────────────────────────────────────

export async function getWarehouses(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.warehouses.findMany({
    where: eq(warehouses.companyId, companyId),
    orderBy: [desc(warehouses.createdAt)],
  });
}

export async function upsertWarehouse(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const values = {
    companyId,
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
      .where(and(eq(warehouses.id, payload.id), eq(warehouses.companyId, companyId)))
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
    companyId,
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

  const values = {
    companyId,
    warehouseId: payload.warehouseId || null,
    locationName: payload.locationName || payload.location || "Asosiy ombor",
    itemId: payload.itemId || null,
    sku: payload.sku || `SKU-${Date.now().toString().slice(-4)}`,
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

export async function getWarehouseShipments(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.warehouseShipments.findMany({
    where: eq(warehouseShipments.companyId, companyId),
    with: {
      items: true,
      warehouse: true,
    },
    orderBy: [desc(warehouseShipments.shipmentDate)],
  });
}

export async function upsertWarehouseShipment(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rawNo = (payload.shipmentNumber || payload.id || "").trim();
  const isDraft = !rawNo || rawNo.startsWith("draft-") || rawNo.startsWith("SHP-NEW-") || rawNo.startsWith("tab-") || rawNo === "NEW" || rawNo.includes("Qoralama") || rawNo.includes("Yangi");
  const shipmentNumber = isDraft ? await getNextShipmentNumber(companyCode) : rawNo;
  const status = payload.status || "Draft";
  const fromLocationName = payload.fromLocationName || payload.from || "Asosiy ombor";

  const shipmentValues = {
    companyId,
    warehouseId: payload.warehouseId || null,
    shipmentNumber,
    shipmentDate: payload.shipmentDate || payload.date ? new Date(payload.shipmentDate || payload.date) : new Date(),
    shipmentType: payload.shipmentType || "CustomerDelivery",
    clientId: payload.clientId || null,
    customerName: payload.customerName || payload.customer || "Mijoz",
    workOrderId: payload.workOrderId || payload.workOrder || null,
    deliveryActId: payload.deliveryActId || null,
    fromLocationName,
    status: status as any,
    carrier: payload.carrier || null,
    driverName: payload.driverName || null,
    trackingNo: payload.trackingNo || null,
    shippedBy: payload.shippedBy || null,
    notes: payload.notes || null,
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
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const totalPrice = qty * unitPrice;

      await db.insert(warehouseShipmentItems).values({
        shipmentId: shipmentRecord.id,
        itemId: item.itemId || null,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        name: item.name || item.product || "Mahsulot",
        quantity: qty.toString(),
        unit: item.unit || "pcs",
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
        notes: item.notes || null,
      });

      // 1C Jamg'arish Registri: Agar jo'natilgan bo'lsa (Dispatched/Delivered), qoldiqni kamaytirish
      if (status === "Dispatched" || status === "Delivered") {
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

  const allShipments = await getWarehouseShipments(companyCode);
  return {
    success: true,
    shipment: shipmentRecord,
    shipmentNumber: shipmentRecord.shipmentNumber,
    allShipments,
  };
}

// ─── 5. Warehouse Movements (Ichki Ko'chirishlar) ──────────────────────────────

export async function getWarehouseMovements(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.warehouseMovements.findMany({
    where: eq(warehouseMovements.companyId, companyId),
    orderBy: [desc(warehouseMovements.movementDate)],
  });
}

export async function upsertWarehouseMovement(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const movementNumber = payload.movementNumber || payload.id || `MOV-${Date.now().toString().slice(-4)}`;
  const status = payload.status || "Pending";
  const qty = Number(payload.quantity) || 0;
  const receivedQty = Number(payload.receivedQty) || (status === "Completed" ? qty : 0);

  const values = {
    companyId,
    movementNumber,
    movementDate: payload.movementDate || payload.date ? new Date(payload.movementDate || payload.date) : new Date(),
    fromWarehouseId: payload.fromWarehouseId || null,
    toWarehouseId: payload.toWarehouseId || null,
    fromLocationName: payload.fromLocationName || payload.from || "A ombor",
    toLocationName: payload.toLocationName || payload.to || "B ombor",
    itemId: payload.itemId || null,
    materialSku: payload.materialSku || null,
    materialName: payload.materialName || payload.material || "Material",
    sheetFormat: payload.sheetFormat || null,
    quantity: qty.toString(),
    receivedQty: receivedQty.toString(),
    unit: payload.unit || "sheets",
    reason: payload.reason || null,
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

  // Agar yakunlangan bo'lsa (Completed), A ombordan ayirish va B omborga qo'shish
  if (status === "Completed" && values.materialSku) {
    await applyStockBalanceDelta({
      companyId,
      locationName: values.fromLocationName,
      sku: values.materialSku,
      name: values.materialName,
      deltaQty: -qty,
      unit: values.unit,
    });
    await applyStockBalanceDelta({
      companyId,
      locationName: values.toLocationName,
      sku: values.materialSku,
      name: values.materialName,
      deltaQty: receivedQty,
      unit: values.unit,
      sheetFormat: values.sheetFormat,
    });
  }

  return movementRecord;
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

  let computedStatus: "Matched" | "Surplus" | "Shortage" = "Matched";
  if (variance > 0) computedStatus = "Surplus";
  else if (variance < 0) computedStatus = "Shortage";

  const values = {
    companyId,
    warehouseId: payload.warehouseId || null,
    locationName: payload.locationName || payload.location || "Asosiy ombor",
    countNumber,
    countDate: payload.countDate || payload.date ? new Date(payload.countDate || payload.date) : new Date(),
    itemId: payload.itemId || null,
    materialSku: payload.materialSku || null,
    materialName: payload.materialName || payload.material || "Material",
    systemQty: systemQty.toString(),
    actualQty: actualQty.toString(),
    variance: variance.toString(),
    unit: payload.unit || "sheets",
    status: (payload.status as any) || computedStatus,
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

export async function getCarriers(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const list = await db.query.carriers.findMany({
    where: eq(carriers.companyId, companyId),
    orderBy: [desc(carriers.createdAt)],
  });

  if (list.length === 0) {
    const initialCarriers = [
      {
        companyId,
        name: "PrintGoo Fleet #1 (ISUZU)",
        vehicleModel: "ISUZU Furgon 3.5t",
        vehicleNo: "01 A 772 BB",
        driverName: "Rustam Ismoilov",
        driverPhone: "+998 90 123-45-67",
        type: "fleet",
        isActive: true,
      },
      {
        companyId,
        name: "PrintGoo Fleet #2 (Labo)",
        vehicleModel: "Labo 0.7t (Furgon)",
        vehicleNo: "01 B 334 CC",
        driverName: "Anvar Xalilov",
        driverPhone: "+998 90 987-65-43",
        type: "fleet",
        isActive: true,
      },
      {
        companyId,
        name: "PrintGoo Fleet #3 (Gazelle)",
        vehicleModel: "Gazelle Next 1.5t",
        vehicleNo: "01 F 550 AA",
        driverName: "Jamshid Saidov",
        driverPhone: "+998 93 456-78-90",
        type: "fleet",
        isActive: true,
      },
      {
        companyId,
        name: "Express Logistics UZ",
        vehicleModel: "Ford Transit Express",
        vehicleNo: "01 E 100 EX",
        driverName: "Navbatchi kuryer",
        driverPhone: "+998 71 200-11-22",
        type: "courier",
        isActive: true,
      },
      {
        companyId,
        name: "BTS Express Pochta",
        vehicleModel: "BTS Logistics Van",
        vehicleNo: "01 B 707 TS",
        driverName: "BTS Kuryer",
        driverPhone: "+998 71 123-00-00",
        type: "courier",
        isActive: true,
      },
      {
        companyId,
        name: "Yandex Delivery Cargo",
        vehicleModel: "Yandex Cargo Furgon",
        vehicleNo: "Ilovada belgilanadi",
        driverName: "Ilovadagi haydovchi",
        driverPhone: "+998 71 200-00-00",
        type: "courier",
        isActive: true,
      },
      {
        companyId,
        name: "Mijoz o'zi olib ketadi (Samovyvoz)",
        vehicleModel: "Mijoz transporti",
        vehicleNo: "—",
        driverName: "Mijoz vakili",
        driverPhone: "—",
        type: "self",
        isActive: true,
      },
    ];
    return db.insert(carriers).values(initialCarriers).returning();
  }

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
