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
  branches,
  wmsBins,
  wmsBinItems,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getNextReceiptNumber, getNextShipmentNumber, getNextMaterialSku, getNextMovementNumber, getNextInventoryCountNumber } from "./numberingService";
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

export async function getCarriers(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const list = await db.query.carriers.findMany({
    where: eq(carriers.companyId, companyId),
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
