import { db, writeAuditLog } from "@/db";
import {
  warehouses,
  wmsZones,
  wmsRacks,
  wmsBins,
  wmsBinItems,
  warehouseStockBalances,
  warehouseFinishedGoods,
  companies,
} from "@/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

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

/**
 * WMS Qisqa sanoat standarti bo'yicha katak kodi va shtrix-kodini generatsiya qilish
 * Format: Sektor-Stelaj-Qavat-Katak (masalan: A-01-2-3)
 * Shtrix-kod: BIN-A0123
 */
export function generateCleanBinCode(zoneCode: string, rackCode: string, level: number, bay: number) {
  const cleanZone = (zoneCode || "A").trim().toUpperCase();
  const rawRack = (rackCode || "01").trim();
  const digitsMatch = rawRack.match(/\d+/);
  const cleanRack = digitsMatch ? digitsMatch[0] : rawRack.replace(/^[a-zA-Z]+-?/, "") || "01";
  const rackPad = cleanRack.length === 1 ? `0${cleanRack}` : cleanRack;
  const code = `${cleanZone}-${rackPad}-${level}-${bay}`;
  const barcode = `BIN-${cleanZone}${rackPad}${level}${bay}`;
  return { code, barcode };
}

/**
 * Boshlang'ich demo WMS topologiyasini yaratish (Zonalar, Rampa, Yo'laklar, Stelajlar va Kataklar)
 */
export async function ensureDefaultWmsTopology(warehouseId: string, companyId: string) {
  const existingZones = await db.query.wmsZones.findMany({
    where: eq(wmsZones.warehouseId, warehouseId),
  });

  if (existingZones.length > 0) {
    return;
  }

  const wh = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, warehouseId),
  });
  const whCode = wh?.code || "WH1";

  // 1. Zonalarni yaratish
  const [zoneA] = await db
    .insert(wmsZones)
    .values({
      companyId,
      warehouseId,
      code: "A",
      name: "A Sektor — Qog'oz va Xomashyo",
      type: "storage",
      color: "#2563eb",
      x: 30,
      y: 30,
      width: 760,
      height: 440,
    })
    .returning();

  const [zoneB] = await db
    .insert(wmsZones)
    .values({
      companyId,
      warehouseId,
      code: "B",
      name: "B Sektor — Tayyor Mahsulot & Rampa",
      type: "shipping",
      color: "#059669",
      x: 820,
      y: 30,
      width: 480,
      height: 440,
    })
    .returning();

  // 2. Maxsus xarita obyektlari (Rampa, Yo'lak, Ustun)
  await db.insert(wmsRacks).values([
    {
      companyId,
      warehouseId,
      zoneId: zoneB.id,
      code: "GATE-01",
      name: "Rampa 1 (Kirim/Yuklash)",
      type: "gate",
      x: 850,
      y: 40,
      width: 140,
      depth: 45,
      levelsCount: 1,
      baysCount: 1,
      status: "active",
    },
    {
      companyId,
      warehouseId,
      zoneId: zoneB.id,
      code: "GATE-02",
      name: "Rampa 2 (Chiqim/Ekspeditor)",
      type: "gate",
      x: 1040,
      y: 40,
      width: 140,
      depth: 45,
      levelsCount: 1,
      baysCount: 1,
      status: "active",
    },
    {
      companyId,
      warehouseId,
      zoneId: zoneA.id,
      code: "AISLE-1",
      name: "Asosiy Texnologik Yo'lak",
      type: "floor_stack",
      x: 40,
      y: 220,
      width: 740,
      depth: 60,
      levelsCount: 1,
      baysCount: 1,
      status: "active",
    },
    {
      companyId,
      warehouseId,
      zoneId: zoneA.id,
      code: "PIL-01",
      name: "Konstruktiv Beton Ustun",
      type: "obstacle",
      x: 395,
      y: 235,
      width: 30,
      depth: 30,
      levelsCount: 1,
      baysCount: 1,
      status: "active",
    },
  ]);

  // 3. Asosiy Stelajlar
  const rackConfigs = [
    {
      code: "R01",
      name: "Stelaj A-01 (Karton va Bo'rli)",
      zoneId: zoneA.id,
      zoneCode: "A",
      type: "pallet" as const,
      x: 70,
      y: 80,
      width: 300,
      depth: 85,
      levelsCount: 4,
      baysCount: 4,
      maxWeightKg: "12000",
    },
    {
      code: "R02",
      name: "Stelaj A-02 (Ofset va Samokleyka)",
      zoneId: zoneA.id,
      zoneCode: "A",
      type: "pallet" as const,
      x: 430,
      y: 80,
      width: 300,
      depth: 85,
      levelsCount: 4,
      baysCount: 4,
      maxWeightKg: "12000",
    },
    {
      code: "R03",
      name: "Stelaj A-03 (Bo'yoq & Laklar)",
      zoneId: zoneA.id,
      zoneCode: "A",
      type: "shelf" as const,
      x: 70,
      y: 330,
      width: 300,
      depth: 85,
      levelsCount: 3,
      baysCount: 5,
      maxWeightKg: "8000",
    },
    {
      code: "R04",
      name: "Stelaj A-04 (Plyonka va Bobinalar)",
      zoneId: zoneA.id,
      zoneCode: "A",
      type: "roll_stand" as const,
      x: 430,
      y: 330,
      width: 300,
      depth: 85,
      levelsCount: 3,
      baysCount: 4,
      maxWeightKg: "10000",
    },
    {
      code: "R05",
      name: "Stelaj B-01 (Tayyor Mahsulot Zaxirasi)",
      zoneId: zoneB.id,
      zoneCode: "B",
      type: "pallet" as const,
      x: 870,
      y: 150,
      width: 340,
      depth: 95,
      levelsCount: 4,
      baysCount: 4,
      maxWeightKg: "15000",
    },
  ];

  const createdRacks: any[] = [];
  for (const rc of rackConfigs) {
    const [rack] = await db
      .insert(wmsRacks)
      .values({
        companyId,
        warehouseId,
        zoneId: rc.zoneId,
        code: rc.code,
        name: rc.name,
        type: rc.type,
        x: rc.x,
        y: rc.y,
        width: rc.width,
        depth: rc.depth,
        levelsCount: rc.levelsCount,
        baysCount: rc.baysCount,
        maxWeightKg: rc.maxWeightKg,
      })
      .returning();

    createdRacks.push({ ...rack, zoneCode: rc.zoneCode });

    // Kataklarni avtomatik generatsiya qilish
    const binsToInsert: any[] = [];
    for (let lvl = 1; lvl <= rc.levelsCount; lvl++) {
      for (let bay = 1; bay <= rc.baysCount; bay++) {
        const { code: binCode, barcode } = generateCleanBinCode(rc.zoneCode, rc.code, lvl, bay);
        binsToInsert.push({
          companyId,
          warehouseId,
          rackId: rack.id,
          zoneId: rc.zoneId,
          code: binCode,
          barcode,
          level: lvl,
          bay: bay,
          rowSpan: 1,
          colSpan: 1,
          widthCm: "120",
          heightCm: "140",
          depthCm: "100",
          maxWeightKg: "1000",
          currentWeightKg: "0",
          occupancyPct: 0,
          status: "empty" as const,
        });
      }
    }
    if (binsToInsert.length > 0) {
      await db.insert(wmsBins).values(binsToInsert);
    }
  }

  // 4. Boshlang'ich namunaviy mahsulotlarni kataklarga taqsimlash
  const allCreatedBins = await db.query.wmsBins.findMany({
    where: eq(wmsBins.warehouseId, warehouseId),
  });

  const stocks = await db.query.warehouseStockBalances.findMany({
    where: eq(warehouseStockBalances.companyId, companyId),
    limit: 10,
  });

  const fgs = await db.query.warehouseFinishedGoods.findMany({
    where: eq(warehouseFinishedGoods.companyId, companyId),
    limit: 6,
  });

  const binItemsToInsert: any[] = [];
  let binIndex = 0;

  for (const st of stocks) {
    if (binIndex >= allCreatedBins.length) break;
    const targetBin = allCreatedBins[binIndex];
    binItemsToInsert.push({
      companyId,
      warehouseId,
      rackId: targetBin.rackId,
      binId: targetBin.id,
      stockBalanceId: st.id,
      sku: st.sku,
      name: st.name,
      category: st.category || "Paper & Board",
      batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
      quantity: st.stockLevel || "5000",
      reservedQty: st.reserved || "0",
      unit: st.unit || "sheets",
      weightKg: "650",
      containerType: (st.category === "Inks & Chemicals" ? "drum" : "pallet") as any,
      posX: 15,
      posY: 15,
      widthPx: 90,
      heightPx: 90,
      color: st.category === "Inks & Chemicals" ? "#e11d48" : "#2563eb",
      notes: "Asosiy partiya qoldig'i",
    });

    // Katakni band deb belgilash
    await db
      .update(wmsBins)
      .set({
        status: "full",
        occupancyPct: 85,
        currentWeightKg: "650",
      })
      .where(eq(wmsBins.id, targetBin.id));

    // Asosiy zaxiraga shelf manzilini biriktirish
    await db
      .update(warehouseStockBalances)
      .set({ locationShelf: targetBin.code })
      .where(eq(warehouseStockBalances.id, st.id));

    binIndex += 2; // Har 2-katakka bitta narsa qo'yamiz
  }

  // Tayyor mahsulotlarni R05 stelaj kataklariga qo'yish
  const r05 = createdRacks.find((r) => r.code === "R05");
  if (r05) {
    const r05Bins = allCreatedBins.filter((b) => b.rackId === r05.id);
    let fgBinIdx = 0;
    for (const fg of fgs) {
      if (fgBinIdx >= r05Bins.length) break;
      const targetBin = r05Bins[fgBinIdx];
      binItemsToInsert.push({
        companyId,
        warehouseId,
        rackId: targetBin.rackId,
        binId: targetBin.id,
        finishedGoodId: fg.id,
        sku: fg.sku,
        name: fg.productName,
        category: "Finished Goods",
        batchNumber: fg.batchNo || "FG-BATCH",
        workOrderId: fg.workOrderId,
        quantity: fg.quantity || "1000",
        reservedQty: fg.reservedQuantity || "0",
        unit: fg.unit || "pcs",
        weightKg: "420",
        containerType: "box" as any,
        posX: 20,
        posY: 20,
        widthPx: 80,
        heightPx: 80,
        color: "#059669",
        notes: `Buyurtmachi: ${fg.customerName}`,
      });

      await db
        .update(wmsBins)
        .set({
          status: "partial",
          occupancyPct: 60,
          currentWeightKg: "420",
        })
        .where(eq(wmsBins.id, targetBin.id));

      await db
        .update(warehouseFinishedGoods)
        .set({ locationShelf: targetBin.code })
        .where(eq(warehouseFinishedGoods.id, fg.id));

      fgBinIdx++;
    }
  }

  if (binItemsToInsert.length > 0) {
    await db.insert(wmsBinItems).values(binItemsToInsert);
  }
}

/**
 * 1. Omborning to'liq WMS topologiyasini olish (Xarita, Stelajlar, Kataklar, Mahsulotlar)
 */
export async function getWarehouseWmsLayout(
  targetWarehouseId?: string,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  let warehouseId = targetWarehouseId;
  if (!warehouseId) {
    const firstWh = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.companyId, companyId), eq(warehouses.isActive, true)),
    });
    if (!firstWh) {
      throw new Error("Tizimda faol ombor topilmadi!");
    }
    warehouseId = firstWh.id;
  }

  // Boshlang'ich topologiya mavjudligini ta'minlash
  await ensureDefaultWmsTopology(warehouseId, companyId);

  const [warehouse, zones, racks, bins, binItems] = await Promise.all([
    db.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    }),
    db.query.wmsZones.findMany({
      where: eq(wmsZones.warehouseId, warehouseId),
      orderBy: [desc(wmsZones.createdAt)],
    }),
    db.query.wmsRacks.findMany({
      where: eq(wmsRacks.warehouseId, warehouseId),
      orderBy: [wmsRacks.code],
    }),
    db.query.wmsBins.findMany({
      where: eq(wmsBins.warehouseId, warehouseId),
      orderBy: [wmsBins.level, wmsBins.bay],
    }),
    db.query.wmsBinItems.findMany({
      where: eq(wmsBinItems.warehouseId, warehouseId),
      orderBy: [desc(wmsBinItems.createdAt)],
    }),
  ]);

  // Kataklar kodini yangi qisqa A-01-2-3 formatiga avtomatik normallashtirish (Self-healing migration)
  const legacyBins = bins.filter((b) => b.code.startsWith("WH") || b.code.includes("-L0") || b.code.includes("-B0"));
  if (legacyBins.length > 0) {
    const rackMap = new Map(racks.map((r) => [r.id, r]));
    const zoneMap = new Map(zones.map((z) => [z.id, z]));
    for (const b of legacyBins) {
      const rack = rackMap.get(b.rackId);
      const zone = rack?.zoneId ? zoneMap.get(rack.zoneId) : undefined;
      const { code, barcode } = generateCleanBinCode(zone?.code || "A", rack?.code || "01", b.level, b.bay);
      await db.update(wmsBins).set({ code, barcode }).where(eq(wmsBins.id, b.id));
      b.code = code;
      b.barcode = barcode;
    }
  }

  // Statistik hisob-kitoblar
  const totalRacks = racks.filter((r) => r.type !== "gate" && r.type !== "floor_stack" && r.type !== "obstacle").length;
  const totalBins = bins.length;
  const occupiedBins = bins.filter((b) => b.status === "full" || b.status === "partial").length;
  const emptyBins = bins.filter((b) => b.status === "empty").length;
  const avgOccupancy = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0;
  const totalItemsCount = binItems.length;

  return {
    warehouse,
    zones,
    racks,
    bins,
    binItems,
    stats: {
      totalRacks,
      totalBins,
      occupiedBins,
      emptyBins,
      avgOccupancy,
      totalItemsCount,
    },
  };
}

/**
 * 2. Stelaj yaratish yoki tahrirlash (Unified Rack Creation)
 */
export async function upsertWmsRack(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const warehouseId = payload.warehouseId;
  if (!warehouseId) throw new Error("warehouseId majburiy!");

  const wh = await db.query.warehouses.findFirst({
    where: eq(warehouses.id, warehouseId),
  });
  const whCode = wh?.code || "WH1";

  // Agar koordinata berilmagan bo'lsa, xaritada avtomatik bo'sh joy hisoblash
  const existingRacks = await db.query.wmsRacks.findMany({
    where: eq(wmsRacks.warehouseId, warehouseId),
  });

  let x = payload.x !== undefined ? Number(payload.x) : 80;
  let y = payload.y !== undefined ? Number(payload.y) : 80;
  if (payload.x === undefined || payload.y === undefined) {
    const index = existingRacks.length;
    x = 80 + (index % 4) * 320;
    y = 80 + Math.floor(index / 4) * 240;
  }

  const rawType = payload.type || "pallet";
  const dbType = rawType === "aisle" ? "floor_stack" : rawType;
  const isStructural = dbType === "gate" || dbType === "obstacle" || dbType === "floor_stack";
  const levelsCount = isStructural ? 1 : Math.max(1, Number(payload.levelsCount) || 4);
  const baysCount = isStructural ? 1 : Math.max(1, Number(payload.baysCount) || 4);
  const code = (payload.code || `R${String(existingRacks.length + 1).padStart(2, "0")}`).toUpperCase().trim();

  const values = {
    companyId,
    warehouseId,
    zoneId: payload.zoneId || null,
    code,
    name: payload.name || (isStructural ? code : `Stelaj ${code}`),
    type: dbType,
    x,
    y,
    width: Number(payload.width) || (dbType === "obstacle" ? 40 : dbType === "gate" ? 140 : 280),
    depth: Number(payload.depth) || (dbType === "obstacle" ? 40 : dbType === "gate" ? 50 : 85),
    rotation: Number(payload.rotation) || 0,
    levelsCount,
    baysCount,
    maxWeightKg: (Number(payload.maxWeightKg) || 10000).toString(),
    status: payload.status || "active",
    visualConfig: payload.visualConfig || null,
    updatedAt: new Date(),
  };

  let rackRecord;
  let isNew = false;

  if (payload.id && !payload.id.startsWith("new-") && !payload.id.startsWith("draft-")) {
    const [updated] = await db
      .update(wmsRacks)
      .set(values)
      .where(and(eq(wmsRacks.id, payload.id), eq(wmsRacks.warehouseId, warehouseId)))
      .returning();
    rackRecord = updated;
  } else {
    isNew = true;
    const [inserted] = await db.insert(wmsRacks).values(values).returning();
    rackRecord = inserted;
  }

  // Faqat saqlash stelajlari uchun kataklar (wms_bins) yaratish (to'siq/rampa/yo'lak uchun emas)
  if (isNew && rackRecord && !isStructural) {
    // Zona kodini topish
    let zoneCode = "A";
    if (payload.zoneId) {
      const z = await db.query.wmsZones.findFirst({
        where: eq(wmsZones.id, payload.zoneId),
      });
      if (z) zoneCode = z.code;
    }

    const binsToInsert: any[] = [];
    for (let lvl = 1; lvl <= levelsCount; lvl++) {
      for (let bay = 1; bay <= baysCount; bay++) {
        const { code: binCode, barcode } = generateCleanBinCode(zoneCode, rackRecord.code, lvl, bay);
        binsToInsert.push({
          companyId,
          warehouseId,
          rackId: rackRecord.id,
          zoneId: payload.zoneId || null,
          code: binCode,
          barcode,
          level: lvl,
          bay: bay,
          rowSpan: 1,
          colSpan: 1,
          widthCm: "120",
          heightCm: "140",
          depthCm: "100",
          maxWeightKg: "1000",
          currentWeightKg: "0",
          occupancyPct: 0,
          status: "empty" as const,
        });
      }
    }
    if (binsToInsert.length > 0) {
      await db.insert(wmsBins).values(binsToInsert);
    }
  }

  await writeAuditLog({
    companyId,
    userId: "system",
    userName: "WMS Manager",
    entityType: "wms_rack",
    entityId: rackRecord?.id || "unknown",
    action: isNew ? "create" : "update",
    newData: rackRecord,
  });

  return rackRecord;
}

/**
 * 3. Stelaj yoki konstruktiv obyektni o'chirish
 */
export async function deleteWmsRack(rackId: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const [deleted] = await db
    .delete(wmsRacks)
    .where(and(eq(wmsRacks.id, rackId), eq(wmsRacks.companyId, companyId)))
    .returning();
  return deleted;
}

/**
 * 3.1. Zonani yaratish yoki yangilash (Upsert Zone)
 */
export async function upsertWmsZone(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const warehouseId = payload.warehouseId;
  if (!warehouseId) throw new Error("Ombor ID ko'rsatilishi shart!");

  const existingZones = await db.query.wmsZones.findMany({
    where: eq(wmsZones.warehouseId, warehouseId),
  });

  const code = (payload.code || `Z${existingZones.length + 1}`).trim().toUpperCase();
  const name = payload.name || `Sektor ${code}`;
  const color = payload.color || "#2563eb";
  const type = payload.type || "storage";

  const values = {
    companyId,
    warehouseId,
    code,
    name,
    type,
    color,
    x: payload.x !== undefined ? Number(payload.x) : 50,
    y: payload.y !== undefined ? Number(payload.y) : 50,
    width: Math.max(80, Number(payload.width) || 400),
    height: Math.max(60, Number(payload.height) || 300),
    rotation: Number(payload.rotation) || 0,
    notes: payload.notes || null,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    updatedAt: new Date(),
  };

  let zoneRecord;
  let isNew = false;

  if (payload.id && !payload.id.startsWith("new-") && !payload.id.startsWith("draft-")) {
    const [updated] = await db
      .update(wmsZones)
      .set(values)
      .where(and(eq(wmsZones.id, payload.id), eq(wmsZones.warehouseId, warehouseId)))
      .returning();
    zoneRecord = updated;
  } else {
    isNew = true;
    const [inserted] = await db.insert(wmsZones).values(values).returning();
    zoneRecord = inserted;
  }

  await writeAuditLog({
    companyId,
    userId: "system",
    userName: "WMS Manager",
    entityType: "wms_zone",
    entityId: zoneRecord?.id || "unknown",
    action: isNew ? "create" : "update",
    newData: zoneRecord,
  });

  return zoneRecord;
}

/**
 * 3.2. Zonani o'chirish (Delete Zone)
 */
export async function deleteWmsZone(zoneId: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  if (!zoneId) throw new Error("Zona ID ko'rsatilishi shart!");

  // Zonaga biriktirilgan stelajlarni ajratish
  await db
    .update(wmsRacks)
    .set({ zoneId: null, updatedAt: new Date() })
    .where(eq(wmsRacks.zoneId, zoneId));

  await db
    .update(wmsBins)
    .set({ zoneId: null, updatedAt: new Date() })
    .where(eq(wmsBins.zoneId, zoneId));

  const [deleted] = await db
    .delete(wmsZones)
    .where(and(eq(wmsZones.id, zoneId), eq(wmsZones.companyId, companyId)))
    .returning();

  await writeAuditLog({
    companyId,
    userId: "system",
    userName: "WMS Manager",
    entityType: "wms_zone",
    entityId: zoneId,
    action: "delete",
    newData: { deletedId: zoneId },
  });

  return deleted;
}

/**
 * 4. Xarita elementlarining (Stelaj/Zona/Konstruktiv) pozitsiyalarini batch yangilash
 */
export async function updateWmsElementsPositions(
  updates: Array<{ id: string; x: number; y: number; width?: number; depth?: number; height?: number; rotation?: number; isZone?: boolean }>,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);
  for (const item of updates) {
    if (item.isZone) {
      await db
        .update(wmsZones)
        .set({
          x: item.x,
          y: item.y,
          ...(item.width !== undefined ? { width: item.width } : {}),
          ...(item.height !== undefined ? { height: item.height } : {}),
          ...(item.depth !== undefined ? { height: item.depth } : {}),
          ...(item.rotation !== undefined ? { rotation: item.rotation } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(wmsZones.id, item.id), eq(wmsZones.companyId, companyId)));
    } else {
      await db
        .update(wmsRacks)
        .set({
          x: item.x,
          y: item.y,
          ...(item.width !== undefined ? { width: item.width } : {}),
          ...(item.depth !== undefined ? { depth: item.depth } : {}),
          ...(item.rotation !== undefined ? { rotation: item.rotation } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(wmsRacks.id, item.id), eq(wmsRacks.companyId, companyId)));
    }
  }
  return { success: true, count: updates.length };
}

/**
 * 5. Kataklar strukturasini o'zgartirish (Merge, Split, Update)
 */
export async function modifyWmsBinStructure(
  action: "merge" | "split" | "update",
  payload: any,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  if (action === "merge") {
    // 2 ta katakni birlashtirish (masalan: primaryBin va secondaryBin)
    const { primaryBinId, secondaryBinId, colSpan = 2 } = payload;
    if (!primaryBinId || !secondaryBinId) throw new Error("primaryBinId va secondaryBinId zarur!");

    // Asosiy katak kengaytiriladi
    await db
      .update(wmsBins)
      .set({
        colSpan,
        widthCm: "240",
        maxWeightKg: "2000",
        notes: "Birlashtirilgan keng katak (Double Bay)",
        updatedAt: new Date(),
      })
      .where(and(eq(wmsBins.id, primaryBinId), eq(wmsBins.companyId, companyId)));

    // Ikkinchi katak esa bloklanadi yoki bo'shatiladi
    await db
      .update(wmsBins)
      .set({
        status: "blocked",
        notes: "Katak chapdagi yacheykaga birlashtirilgan",
        updatedAt: new Date(),
      })
      .where(and(eq(wmsBins.id, secondaryBinId), eq(wmsBins.companyId, companyId)));

    return { success: true, mergedId: primaryBinId };
  }

  if (action === "split") {
    const { binId, secondaryBinId } = payload;
    await db
      .update(wmsBins)
      .set({
        colSpan: 1,
        rowSpan: 1,
        widthCm: "120",
        maxWeightKg: "1000",
        notes: null,
        updatedAt: new Date(),
      })
      .where(and(eq(wmsBins.id, binId), eq(wmsBins.companyId, companyId)));

    if (secondaryBinId) {
      await db
        .update(wmsBins)
        .set({
          status: "empty",
          notes: null,
          updatedAt: new Date(),
        })
        .where(and(eq(wmsBins.id, secondaryBinId), eq(wmsBins.companyId, companyId)));
    }
    return { success: true, splitId: binId };
  }

  if (action === "update") {
    const { id, maxWeightKg, widthCm, heightCm, depthCm, status, notes } = payload;
    const [updated] = await db
      .update(wmsBins)
      .set({
        ...(maxWeightKg !== undefined ? { maxWeightKg: maxWeightKg.toString() } : {}),
        ...(widthCm !== undefined ? { widthCm: widthCm.toString() } : {}),
        ...(heightCm !== undefined ? { heightCm: heightCm.toString() } : {}),
        ...(depthCm !== undefined ? { depthCm: depthCm.toString() } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(wmsBins.id, id), eq(wmsBins.companyId, companyId)))
      .returning();
    return updated;
  }

  throw new Error("Noma'lum amal: " + action);
}

/**
 * 6. Katakka mahsulot kiritish (Putaway / Joylashtirish)
 */
export async function upsertWmsBinItem(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const { binId, warehouseId, rackId } = payload;

  if (!binId || !warehouseId || !rackId) {
    throw new Error("binId, warehouseId va rackId talab qilinadi!");
  }

  const quantity = Number(payload.quantity) || 1;
  const weightKg = Number(payload.weightKg) || 100;

  const values = {
    companyId,
    warehouseId,
    rackId,
    binId,
    stockBalanceId: payload.stockBalanceId || null,
    finishedGoodId: payload.finishedGoodId || null,
    itemId: payload.itemId || null,
    sku: payload.sku || "SKU-ITEM",
    name: payload.name || "Mahsulot",
    category: payload.category || "Paper & Board",
    batchNumber: payload.batchNumber || null,
    workOrderId: payload.workOrderId || null,
    quantity: quantity.toString(),
    reservedQty: (Number(payload.reservedQty) || 0).toString(),
    unit: payload.unit || "sheets",
    weightKg: weightKg.toString(),
    containerType: payload.containerType || "pallet",
    posX: Number(payload.posX) || 15,
    posY: Number(payload.posY) || 15,
    widthPx: Number(payload.widthPx) || 80,
    heightPx: Number(payload.heightPx) || 80,
    color: payload.color || "#2563eb",
    notes: payload.notes || null,
    updatedAt: new Date(),
  };

  let itemRecord;
  if (payload.id && !payload.id.startsWith("new-")) {
    const [updated] = await db
      .update(wmsBinItems)
      .set(values)
      .where(and(eq(wmsBinItems.id, payload.id), eq(wmsBinItems.companyId, companyId)))
      .returning();
    itemRecord = updated;
  } else {
    const [inserted] = await db.insert(wmsBinItems).values(values).returning();
    itemRecord = inserted;
  }

  // Katakning to'lish ko'rsatkichini yangilash
  const targetBin = await db.query.wmsBins.findFirst({
    where: eq(wmsBins.id, binId),
  });
  if (targetBin) {
    const currentWeight = Number(targetBin.currentWeightKg) + weightKg;
    const maxWeight = Number(targetBin.maxWeightKg) || 1000;
    const occupancy = Math.min(100, Math.round((currentWeight / maxWeight) * 100));

    await db
      .update(wmsBins)
      .set({
        currentWeightKg: currentWeight.toString(),
        occupancyPct: Math.max(occupancy, 50),
        status: occupancy >= 95 ? "full" : "partial",
        updatedAt: new Date(),
      })
      .where(eq(wmsBins.id, binId));

    // Asosiy zaxiraga ham saqlash katagi manzilini yozish
    if (payload.stockBalanceId) {
      await db
        .update(warehouseStockBalances)
        .set({ locationShelf: targetBin.code })
        .where(eq(warehouseStockBalances.id, payload.stockBalanceId));
    }
  }

  return itemRecord;
}

/**
 * 7. Mahsulotni boshqa katakka ko'chirish (Bin-to-Bin Transfer)
 */
export async function moveWmsBinItem(payload: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const { itemId, targetBinId } = payload;
  if (!itemId || !targetBinId) throw new Error("itemId va targetBinId zarur!");

  const item = await db.query.wmsBinItems.findFirst({
    where: and(eq(wmsBinItems.id, itemId), eq(wmsBinItems.companyId, companyId)),
  });
  if (!item) throw new Error("Mahsulot topilmadi!");

  const targetBin = await db.query.wmsBins.findFirst({
    where: eq(wmsBins.id, targetBinId),
  });
  if (!targetBin) throw new Error("Maqsadli katak topilmadi!");

  const oldBinId = item.binId;

  // Mahsulotni yangi katakka o'tkazamiz
  const [updatedItem] = await db
    .update(wmsBinItems)
    .set({
      binId: targetBin.id,
      rackId: targetBin.rackId,
      warehouseId: targetBin.warehouseId,
      posX: 15,
      posY: 15,
      updatedAt: new Date(),
    })
    .where(eq(wmsBinItems.id, itemId))
    .returning();

  // Eski katakni qayta hisoblash
  const oldRemainingItems = await db.query.wmsBinItems.findMany({
    where: eq(wmsBinItems.binId, oldBinId),
  });
  if (oldRemainingItems.length === 0) {
    await db
      .update(wmsBins)
      .set({ status: "empty", occupancyPct: 0, currentWeightKg: "0" })
      .where(eq(wmsBins.id, oldBinId));
  } else {
    const totalW = oldRemainingItems.reduce((acc, it) => acc + Number(it.weightKg), 0);
    await db
      .update(wmsBins)
      .set({ status: "partial", occupancyPct: 50, currentWeightKg: totalW.toString() })
      .where(eq(wmsBins.id, oldBinId));
  }

  // Yangi katakni yangilash
  await db
    .update(wmsBins)
    .set({
      status: "partial",
      occupancyPct: 75,
      currentWeightKg: (Number(targetBin.currentWeightKg) + Number(item.weightKg)).toString(),
    })
    .where(eq(wmsBins.id, targetBin.id));

  // Asosiy zaxirani ham yangilash
  if (item.stockBalanceId) {
    await db
      .update(warehouseStockBalances)
      .set({ locationShelf: targetBin.code })
      .where(eq(warehouseStockBalances.id, item.stockBalanceId));
  }

  return updatedItem;
}

/**
 * 8. Mahsulotni katakdan chiqarish (Pick / Chiqim)
 */
export async function removeWmsBinItem(itemId: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const item = await db.query.wmsBinItems.findFirst({
    where: and(eq(wmsBinItems.id, itemId), eq(wmsBinItems.companyId, companyId)),
  });
  if (!item) return null;

  const binId = item.binId;
  const [deleted] = await db.delete(wmsBinItems).where(eq(wmsBinItems.id, itemId)).returning();

  // Katakni tekshirib yangilash
  const remaining = await db.query.wmsBinItems.findMany({
    where: eq(wmsBinItems.binId, binId),
  });
  if (remaining.length === 0) {
    await db
      .update(wmsBins)
      .set({ status: "empty", occupancyPct: 0, currentWeightKg: "0" })
      .where(eq(wmsBins.id, binId));
  } else {
    const totalW = remaining.reduce((acc, it) => acc + Number(it.weightKg), 0);
    await db
      .update(wmsBins)
      .set({ status: "partial", occupancyPct: 40, currentWeightKg: totalW.toString() })
      .where(eq(wmsBins.id, binId));
  }

  return deleted;
}
