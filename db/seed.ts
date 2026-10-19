import "dotenv/config";
import { db, pgClient, writeAuditLog } from "./index";
import {
  companies,
  branches,
  unitsOfMeasure,
  items,
  pantoneColors,
  flexoMachines,
  flexoCylinders,
  diesTooling,
} from "./schema";
import { ensureStorageBuckets } from "../lib/server/storage";
import { JR_1521_CYLINDERS, FLEXO_MACHINES, FLEXO_MATERIALS } from "../lib/flexo/masterData";
import { ALL_PANTONE_COLORS } from "../lib/pantone-catalog";

async function seedDatabase() {
  console.log("🌱 [Seed] Baza master ma'lumotlarini yuklash boshlandi...");

  // 0. S3 MinIO Bucketlarni tekshirish
  const buckets = await ensureStorageBuckets();
  console.log("📦 MinIO S3 Buckets tayyor:", buckets);

  // 1. Asosiy korxonalar (Companies)
  const [printgooCompany] = await db
    .insert(companies)
    .values({
      code: "PRINTGOO",
      name: "PrintGoo Label & Packaging",
      legalName: "OOO «PRINTGOO INDUSTRIES»",
      industryType: "printing",
      inn: "309841205",
      baseCurrency: "UZS",
      settings: {
        timezone: "Asia/Tashkent",
        defaultTaxPercent: 12,
        allowNegativeStock: false,
        workOrderPrefix: "WO-PG",
      },
    })
    .onConflictDoUpdate({
      target: companies.code,
      set: {
        name: "PrintGoo Label & Packaging",
        updatedAt: new Date(),
      },
    })
    .returning();

  const [textileCompany] = await db
    .insert(companies)
    .values({
      code: "APPAREL",
      name: "PrintGoo Textile & Garments",
      legalName: "OOO «PRINTGOO TEXTILE»",
      industryType: "textile",
      inn: "309841999",
      baseCurrency: "UZS",
      settings: {
        timezone: "Asia/Tashkent",
        defaultTaxPercent: 12,
        allowNegativeStock: false,
        workOrderPrefix: "WO-TX",
      },
    })
    .onConflictDoUpdate({
      target: companies.code,
      set: {
        name: "PrintGoo Textile & Garments",
        updatedAt: new Date(),
      },
    })
    .returning();

  // 2. Filiallar (Branches)
  const [flexoBranch] = await db
    .insert(branches)
    .values([
      {
        companyId: printgooCompany.id,
        code: "HQ-FLEXO",
        name: "Bosh Bosmaxona (Flexo & Prepress Sexi)",
        address: "Toshkent sh., Sanoat zonasi",
        isMain: true,
      },
      {
        companyId: textileCompany.id,
        code: "HQ-SEWING",
        name: "Bosh Tikuvchilik Fabrikasi",
        address: "Toshkent sh.",
        isMain: true,
      },
    ])
    .onConflictDoNothing()
    .returning();

  const branchId = flexoBranch?.id;

  // 3. O'lchov birliklari (Units of Measure - 1C Klassifikator)
  console.log("📏 1. O'lchov birliklari yuklanmoqda...");
  const rawUnits = [
    { code: "pcs", name: "Dona (Штука)", shortName: "dona", internationalCode: "PCE", precision: 0 },
    { code: "m", name: "Pogonomentr (Погонный метр)", shortName: "m", internationalCode: "MTR", precision: 2 },
    { code: "sqm", name: "Kvadrat metr (Квадратный метр)", shortName: "m²", internationalCode: "MTK", precision: 2 },
    { code: "kg", name: "Kilogramm (Килограмм)", shortName: "kg", internationalCode: "KGM", precision: 3 },
    { code: "roll", name: "Rulon (Рулон)", shortName: "rulon", internationalCode: "NPL", precision: 0 },
    { code: "sheet", name: "List (Лист)", shortName: "list", internationalCode: "LEF", precision: 0 },
    { code: "set", name: "Komplekt (Комплект)", shortName: "kompl", internationalCode: "SET", precision: 0 },
    { code: "hour", name: "Ish soati (Нормо-час)", shortName: "soat", internationalCode: "HUR", precision: 1 },
  ];

  await db.insert(unitsOfMeasure).values(rawUnits).onConflictDoNothing();
  const allUnits = await db.select().from(unitsOfMeasure);
  const unitMap = new Map(allUnits.map((u) => [u.code, u.id]));

  const pcsUnitId = unitMap.get("pcs")!;
  const meterUnitId = unitMap.get("m")!;
  const kgUnitId = unitMap.get("kg")!;
  const rollUnitId = unitMap.get("roll")!;
  const sheetUnitId = unitMap.get("sheet")!;
  const hourUnitId = unitMap.get("hour")!;

  // 4. Pantone Ranglar Katalogi (900+ ta rang)
  console.log(`🎨 2. Pantone katalogi yuklanmoqda (${ALL_PANTONE_COLORS.length} ta rang)...`);
  const pantoneBatches: Array<typeof ALL_PANTONE_COLORS> = [];
  const batchSize = 250;
  for (let i = 0; i < ALL_PANTONE_COLORS.length; i += batchSize) {
    pantoneBatches.push(ALL_PANTONE_COLORS.slice(i, i + batchSize));
  }

  for (const batch of pantoneBatches) {
    await db
      .insert(pantoneColors)
      .values(
        batch.map((p) => ({
          code: p.code,
          name: p.name,
          hex: p.hex,
          category: p.category,
        }))
      )
      .onConflictDoNothing();
  }

  // 5. Flexo Stanoklar (Flexo Machines)
  console.log("🖨️  3. Fleksografik stanoklar yuklanmoqda...");
  const machinesData = [
    {
      companyId: printgooCompany.id,
      branchId: branchId ?? null,
      code: "JR-1521",
      name: "JR-1521 Narrow Web Flexo Press",
      model: "JR-1521",
      gearSystem: "JR-1521 Pitch 2.7107mm",
      gearPitch: "2.7107",
      minWebWidth: "10.00",
      maxWebWidth: "150.00",
      maxPrintWidth: "140.00",
      standardPlateThickness: "1.700",
      colorStations: 4,
      speedMpm: "80.00",
      status: "active" as const,
      hourlyRate: "120000.00",
    },
    {
      companyId: printgooCompany.id,
      branchId: branchId ?? null,
      code: "GALLUS-EM280",
      name: "Gallus EM 280 Flexo Press",
      model: "EM 280",
      gearSystem: "1/8 CP (3.175mm)",
      gearPitch: "3.1750",
      minWebWidth: "50.00",
      maxWebWidth: "282.00",
      maxPrintWidth: "280.00",
      standardPlateThickness: "1.700",
      colorStations: 6,
      speedMpm: "150.00",
      status: "active" as const,
      hourlyRate: "250000.00",
    },
    {
      companyId: printgooCompany.id,
      branchId: branchId ?? null,
      code: "MARK-ANDY-2200",
      name: "Mark Andy 2200 Flexo Press",
      model: "2200-10",
      gearSystem: "1/8 CP (3.175mm)",
      gearPitch: "3.1750",
      minWebWidth: "50.00",
      maxWebWidth: "254.00",
      maxPrintWidth: "250.00",
      standardPlateThickness: "1.700",
      colorStations: 6,
      speedMpm: "120.00",
      status: "active" as const,
      hourlyRate: "220000.00",
    },
  ];

  for (const m of machinesData) {
    await db
      .insert(flexoMachines)
      .values(m)
      .onConflictDoUpdate({
        target: [flexoMachines.companyId, flexoMachines.code],
        set: {
          name: m.name,
          gearSystem: m.gearSystem,
          gearPitch: m.gearPitch,
          minWebWidth: m.minWebWidth,
          maxWebWidth: m.maxWebWidth,
          maxPrintWidth: m.maxPrintWidth,
          speedMpm: m.speedMpm,
          updatedAt: new Date(),
        },
      });
  }

  const allMachines = await db.select().from(flexoMachines);
  const jr1521 = allMachines.find((m) => m.code === "JR-1521");

  // 6. Flexo Silindrlar (110 ta silindr: 40T dan 149T gacha)
  if (jr1521) {
    console.log(`⚙️  4. JR-1521 silindrlari yuklanmoqda (${JR_1521_CYLINDERS.length} ta val)...`);
    const cylinderValues = JR_1521_CYLINDERS.map((c) => ({
      companyId: printgooCompany.id,
      machineId: jr1521.id,
      teeth: c.teeth,
      pitchCircleDiameter: c.pitchCircleDiameter.toFixed(3),
      plateThickness: c.plateThickness.toFixed(3),
      cylinderDiameter: c.cylinderDiameter.toFixed(3),
      filmLength: c.filmLength.toFixed(3),
      printingLength: c.printingLength.toFixed(3),
      quantity: 1,
      location: `CYL-RACK-JR-${Math.floor(c.teeth / 10) * 10}`,
      status: "ready",
      needsVerification: !!c.needsVerification,
      verificationNote: c.verificationNote ?? null,
    }));

    // Batch insert
    for (let i = 0; i < cylinderValues.length; i += 50) {
      await db
        .insert(flexoCylinders)
        .values(cylinderValues.slice(i, i + 50))
        .onConflictDoNothing();
    }
  }

  // 7. Pichoqlar va Shtamplar (Dies & Tooling)
  console.log("🔪 5. Qoliplar va pichoqlar (Dies & Tooling) yuklanmoqda...");
  const toolingData = [
    {
      companyId: printgooCompany.id,
      code: "DIE-RECT-50x90-R3",
      name: "Hangtag Die 50×90 mm (R3)",
      dieType: "rotary_magnetic" as const,
      shape: "rounded_rect" as const,
      widthMm: "50.00",
      heightMm: "90.00",
      cornerRadiusMm: "3.00",
      acrossCount: 2,
      aroundCount: 1,
      gapXMm: "3.00",
      gapYMm: "3.00",
      repeatLengthMm: "93.000",
      cylinderTeeth: 70,
      location: "SHELF-DIE-A1",
      status: "available" as const,
      notes: "Standart kiyim yorliqlari uchun egiluvchan magnit pichoq",
    },
    {
      companyId: printgooCompany.id,
      code: "DIE-CIRC-40",
      name: "Round Sticker Die Ø 40 mm",
      dieType: "rotary_magnetic" as const,
      shape: "circle" as const,
      widthMm: "40.00",
      heightMm: "40.00",
      cornerRadiusMm: "20.00",
      acrossCount: 3,
      aroundCount: 2,
      gapXMm: "3.00",
      gapYMm: "3.00",
      repeatLengthMm: "86.000",
      cylinderTeeth: 64,
      location: "SHELF-DIE-B2",
      status: "available" as const,
      notes: "Doira stikerlar va qadoq plombasi uchun",
    },
    {
      companyId: printgooCompany.id,
      code: "DIE-LABEL-30x70",
      name: "Textile Care Label Die 30×70 mm",
      dieType: "solid_rotary" as const,
      shape: "rectangle" as const,
      widthMm: "30.00",
      heightMm: "70.00",
      cornerRadiusMm: "0.00",
      acrossCount: 1,
      aroundCount: 1,
      gapXMm: "0.00",
      gapYMm: "2.00",
      repeatLengthMm: "72.000",
      cylinderTeeth: 53,
      location: "SHELF-DIE-C1",
      status: "available" as const,
      notes: "Satin va neylon tasmalar uchun issiq/sovuq qirquvchi pichoq",
    },
    {
      companyId: printgooCompany.id,
      code: "DIE-CARD-85x55",
      name: "Business Card Die 85×55 mm",
      dieType: "flatbed" as const,
      shape: "rectangle" as const,
      widthMm: "85.00",
      heightMm: "55.00",
      cornerRadiusMm: "0.00",
      acrossCount: 4,
      aroundCount: 2,
      gapXMm: "4.00",
      gapYMm: "4.00",
      repeatLengthMm: "118.000",
      location: "SHELF-FLAT-01",
      status: "available" as const,
      notes: "Tigel stanogi uchun po'lat pichoqli qolip",
    },
    {
      companyId: printgooCompany.id,
      code: "DIE-STICKER-50x50-R2",
      name: "Square Sticker Die 50×50 mm (R2)",
      dieType: "rotary_magnetic" as const,
      shape: "rounded_rect" as const,
      widthMm: "50.00",
      heightMm: "50.00",
      cornerRadiusMm: "2.00",
      acrossCount: 2,
      aroundCount: 2,
      gapXMm: "3.00",
      gapYMm: "3.00",
      repeatLengthMm: "106.000",
      cylinderTeeth: 78,
      location: "SHELF-DIE-A3",
      status: "available" as const,
      notes: "Kvadrat samokleyka stikerlar uchun",
    },
  ];

  for (const t of toolingData) {
    await db
      .insert(diesTooling)
      .values(t)
      .onConflictDoUpdate({
        target: [diesTooling.companyId, diesTooling.code],
        set: {
          name: t.name,
          widthMm: t.widthMm,
          heightMm: t.heightMm,
          acrossCount: t.acrossCount,
          aroundCount: t.aroundCount,
          updatedAt: new Date(),
        },
      });
  }

  // 8. Xomashyo va Nomenklatura (Items / Materials)
  console.log("📦 6. Xomashyo va Nomenklatura (Items & Materials) yuklanmoqda...");
  const itemsData = [
    // Lentalar va Tasmalar
    ...FLEXO_MATERIALS.map((m) => ({
      companyId: printgooCompany.id,
      code: `MAT-${m.id.toUpperCase()}`,
      name: m.name,
      itemType: "raw_material" as const,
      category: m.category,
      unitId: meterUnitId,
      description: m.description,
      minStock: "500.000",
      standardCost: "1500.00",
      sellingPrice: "2400.00",
      currency: "UZS",
      properties: {
        webWidth: m.defaultWebWidth,
        standardWidths: m.standardWidths,
        color: m.color,
      },
    })),
    // Qog'oz va Kartonlar
    {
      companyId: printgooCompany.id,
      code: "MAT-CARD-300GSM",
      name: "Coated Cardboard 300g/m² (Solid Bleached Board)",
      itemType: "raw_material" as const,
      category: "Board",
      unitId: sheetUnitId,
      description: "Yuqori sifatli oq karton kiyim yorliqlari va qadoq uchun",
      minStock: "1000.000",
      standardCost: "3200.00",
      sellingPrice: "4800.00",
      currency: "UZS",
      properties: {
        densityGsm: 300,
        color: "#ffffff",
        surfaceFinish: "Double-coated Semi-gloss",
      },
    },
    {
      companyId: printgooCompany.id,
      code: "MAT-KRAFT-280GSM",
      name: "Kraft Board Brown 280g/m² (Eco Natural)",
      itemType: "raw_material" as const,
      category: "Kraft",
      unitId: sheetUnitId,
      description: "Tabiiy jigarrang eko kraft karton",
      minStock: "800.000",
      standardCost: "2800.00",
      sellingPrice: "4200.00",
      currency: "UZS",
      properties: {
        densityGsm: 280,
        color: "#92714a",
        surfaceFinish: "Uncoated Raw",
      },
    },
    {
      companyId: printgooCompany.id,
      code: "MAT-ART-SILK-150GSM",
      name: "Galerie Art Silk 150g/m² Paper",
      itemType: "raw_material" as const,
      category: "Paper",
      unitId: sheetUnitId,
      description: "Ipakdek silliq yarim mot bo'rli qog'oz",
      minStock: "2000.000",
      standardCost: "1600.00",
      sellingPrice: "2500.00",
      currency: "UZS",
      properties: {
        densityGsm: 150,
        color: "#fcfcfc",
        surfaceFinish: "Silk Matte",
      },
    },
    // Bo'yoqlar (Inks)
    {
      companyId: printgooCompany.id,
      code: "INK-PANTONE-021C",
      name: "Pantone 021 C (Neon Orange Ink)",
      itemType: "raw_material" as const,
      category: "Ink",
      unitId: kgUnitId,
      description: "UB-qotuvchi yuqori pigmentli to'q sariq bo'yoq",
      minStock: "5.000",
      standardCost: "450000.00",
      sellingPrice: "650000.00",
      currency: "UZS",
      properties: {
        color: "#FE5000",
        pantoneCode: "021 C",
      },
    },
    {
      companyId: printgooCompany.id,
      code: "INK-PANTONE-871C",
      name: "Pantone 871 C (Metallic Gold Ink)",
      itemType: "raw_material" as const,
      category: "Ink",
      unitId: kgUnitId,
      description: "Oltin yaltiroq metallik bo'yoq",
      minStock: "3.000",
      standardCost: "580000.00",
      sellingPrice: "850000.00",
      currency: "UZS",
      properties: {
        color: "#86734C",
        pantoneCode: "871 C",
      },
    },
    // Xizmatlar (Services)
    {
      companyId: printgooCompany.id,
      code: "SRV-HOT-FOIL",
      name: "Hot Stamping Foil Service (Oltin/Kumush Zar Zarb Urish)",
      itemType: "service" as const,
      category: "Finishing",
      unitId: pcsUnitId,
      description: "Issiq shtamp yordamida folga tushirish xizmati",
      minStock: "0.000",
      standardCost: "150.00",
      sellingPrice: "350.00",
      currency: "UZS",
      properties: {},
    },
    {
      companyId: printgooCompany.id,
      code: "SRV-SPOT-UV",
      name: "Selective Spot UV Varnish Service (Tanlab Uf-Lak Bosish)",
      itemType: "service" as const,
      category: "Finishing",
      unitId: pcsUnitId,
      description: "Relefli yaltiroq lak tushirish",
      minStock: "0.000",
      standardCost: "120.00",
      sellingPrice: "280.00",
      currency: "UZS",
      properties: {},
    },
  ];

  for (const item of itemsData) {
    await db
      .insert(items)
      .values(item)
      .onConflictDoUpdate({
        target: [items.companyId, items.code],
        set: {
          name: item.name,
          category: item.category,
          standardCost: item.standardCost,
          sellingPrice: item.sellingPrice,
          properties: item.properties,
          updatedAt: new Date(),
        },
      });
  }

  // 9. Audit Log
  await writeAuditLog({
    companyId: printgooCompany.id,
    userId: "system",
    userName: "System Seed Master Data",
    entityType: "master_data",
    entityId: printgooCompany.id,
    action: "create",
    newData: {
      unitsCount: rawUnits.length,
      machinesCount: machinesData.length,
      cylindersCount: JR_1521_CYLINDERS.length,
      toolingCount: toolingData.length,
      pantoneCount: ALL_PANTONE_COLORS.length,
      itemsCount: itemsData.length,
    },
  });

  console.log("✅ [2-Bosqich Seed] Master ma'lumotlar to'liq va muvaffaqiyatli bazaga yuklandi!");
  console.log({
    units: rawUnits.length,
    pantoneColors: ALL_PANTONE_COLORS.length,
    machines: machinesData.length,
    cylinders: JR_1521_CYLINDERS.length,
    diesTooling: toolingData.length,
    items: itemsData.length,
  });
}

seedDatabase()
  .catch((err) => {
    console.error("❌ Seed xatosi:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pgClient.end();
  });
