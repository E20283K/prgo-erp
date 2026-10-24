import { db } from "@/db";
import { tariffs, companies } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import type { TariffRecord, TariffVolumeTier, TariffPricingRules } from "@/components/documents/tariff/types";

export const INITIAL_INDUSTRY_TARIFFS: Omit<TariffRecord, "id">[] = [
  {
    code: "TRF-001",
    category: "Prepress / CTP",
    operationName: "CTP Thermal Plate Output (B1 / 790×1030)",
    department: "Prepress",
    machineOrDept: "Kodak Trendsetter Q800",
    unit: "1 plate",
    unitDivisor: 1,
    currency: "USD",
    rateUsd: 12.5,
    setupFeeUsd: 0,
    minChargeUsd: 12.5,
    vatRate: 12,
    pieceworkRateUsd: 2.0,
    helperPieceworkRateUsd: 0,
    normOutputPerShift: 60,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 8, rateUsd: 12.5, note: "Standart buyurtma" },
      { id: "t2", minQty: 9, maxQty: null, rateUsd: 10.5, note: "Katta partiyalar" },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 30 },
    status: "Active",
    notes: "Kodak termal lazer CTP plastina ishlab chiqarish me'yori.",
  },
  {
    code: "TRF-002",
    category: "Prepress / CTP",
    operationName: "CTP Thermal Plate Output (B2 / 500×707)",
    department: "Prepress",
    machineOrDept: "Kodak Trendsetter Q800",
    unit: "1 plate",
    unitDivisor: 1,
    currency: "USD",
    rateUsd: 8.5,
    setupFeeUsd: 0,
    minChargeUsd: 8.5,
    vatRate: 12,
    pieceworkRateUsd: 1.5,
    helperPieceworkRateUsd: 0,
    normOutputPerShift: 80,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 12, rateUsd: 8.5, note: "Standart B2" },
      { id: "t2", minQty: 13, maxQty: null, rateUsd: 7.2, note: "Ulgurji B2" },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 25 },
    status: "Active",
    notes: "B2 formatdagi ofset bosma mashinalari uchun CTP plastina.",
  },
  {
    code: "TRF-003",
    category: "Offset Printing",
    operationName: "Sheetfed Offset Run (4+0 CMYK)",
    department: "Offset",
    machineOrDept: "Heidelberg Speedmaster XL 106",
    unit: "1,000 impressions",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 24.0,
    setupFeeUsd: 45.0,
    minChargeUsd: 69.0,
    vatRate: 12,
    pieceworkRateUsd: 4.8,
    helperPieceworkRateUsd: 2.4,
    normOutputPerShift: 35000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 5000, rateUsd: 26.0, setupFeeUsd: 45.0, note: "Kichik tiraj" },
      { id: "t2", minQty: 5001, maxQty: 25000, rateUsd: 24.0, setupFeeUsd: 40.0, note: "Standart tiraj" },
      { id: "t3", minQty: 25001, maxQty: null, rateUsd: 19.5, setupFeeUsd: 30.0, note: "Katta tiraj (25k+)" },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 35 },
    status: "Active",
    notes: "4 rangli to'liq rangli ofset bosma operatsiyasi (pripravka + 1000 ottisk).",
  },
  {
    code: "TRF-004",
    category: "Offset Printing",
    operationName: "Sheetfed Offset Run (1+0 Black / Spot)",
    department: "Offset",
    machineOrDept: "Heidelberg Speedmaster XL 106",
    unit: "1,000 impressions",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 12.0,
    setupFeeUsd: 20.0,
    minChargeUsd: 32.0,
    vatRate: 12,
    pieceworkRateUsd: 2.5,
    helperPieceworkRateUsd: 1.2,
    normOutputPerShift: 45000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 10000, rateUsd: 12.0, setupFeeUsd: 20.0 },
      { id: "t2", minQty: 10001, maxQty: null, rateUsd: 9.5, setupFeeUsd: 15.0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 20 },
    status: "Active",
    notes: "1 rangli matnli yoki monoxrom bosma.",
  },
  {
    code: "TRF-005",
    category: "Flexo Roll Label",
    operationName: "Narrow-Web Rotary Flexo Run (4 Color + UV)",
    department: "Flexo",
    machineOrDept: "JR-1521 Narrow Web Flexo Press",
    unit: "1,000 linear meters",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 28.0,
    setupFeeUsd: 35.0,
    minChargeUsd: 60.0,
    vatRate: 12,
    pieceworkRateUsd: 5.5,
    helperPieceworkRateUsd: 2.2,
    normOutputPerShift: 20000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 3000, rateUsd: 32.0, setupFeeUsd: 35.0 },
      { id: "t2", minQty: 3001, maxQty: 15000, rateUsd: 28.0, setupFeeUsd: 30.0 },
      { id: "t3", minQty: 15001, maxQty: null, rateUsd: 22.0, setupFeeUsd: 20.0 },
    ],
    pricingRules: { vipDiscountPct: 12, wholesaleDiscountPct: 18, urgentSurchargePct: 30 },
    status: "Active",
    notes: "Rulonli o'ziyopishqoq etiketkalar uchun 4 seksiyali fleksografik bosma.",
  },
  {
    code: "TRF-006",
    category: "Surface Coating",
    operationName: "Soft-Touch Matte Lamination (BOPP 28 mic)",
    department: "Post-press",
    machineOrDept: "Autobond Mini 76 UV",
    unit: "1,000 sheets",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 42.0,
    setupFeeUsd: 15.0,
    minChargeUsd: 50.0,
    vatRate: 12,
    pieceworkRateUsd: 6.0,
    helperPieceworkRateUsd: 2.5,
    normOutputPerShift: 18000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 5000, rateUsd: 42.0, setupFeeUsd: 15.0 },
      { id: "t2", minQty: 5001, maxQty: 20000, rateUsd: 36.0, setupFeeUsd: 10.0 },
      { id: "t3", minQty: 20001, maxQty: null, rateUsd: 31.0, setupFeeUsd: 0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 25 },
    status: "Active",
    notes: "Yuqori sifatli baxmalsimon yumshoq (velvet) matoviy laminatsiya.",
  },
  {
    code: "TRF-007",
    category: "Surface Coating",
    operationName: "Spot UV Varnish (Selective Screen / Digital)",
    department: "Post-press",
    machineOrDept: "Sakurai Maestro / Scodix",
    unit: "1,000 sheets",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 55.0,
    setupFeeUsd: 30.0,
    minChargeUsd: 75.0,
    vatRate: 12,
    pieceworkRateUsd: 8.0,
    helperPieceworkRateUsd: 3.0,
    normOutputPerShift: 12000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 3000, rateUsd: 58.0, setupFeeUsd: 30.0 },
      { id: "t2", minQty: 3001, maxQty: 15000, rateUsd: 52.0, setupFeeUsd: 25.0 },
      { id: "t3", minQty: 15001, maxQty: null, rateUsd: 44.0, setupFeeUsd: 15.0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 30 },
    status: "Active",
    notes: "Tanlab qo'llaniluvchi UV lak (relyefli va yaltiroq effektlar uchun).",
  },
  {
    code: "TRF-008",
    category: "Kashirovka (Mounting)",
    operationName: "Duplex Sheet-to-Sheet Mounting + Press Cure",
    department: "Post-press",
    machineOrDept: "Stock Laminator + Hydraulic Press",
    unit: "1,000 glue passes",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 28.0,
    setupFeeUsd: 25.0,
    minChargeUsd: 45.0,
    vatRate: 12,
    pieceworkRateUsd: 5.0,
    helperPieceworkRateUsd: 2.0,
    normOutputPerShift: 14000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 5000, rateUsd: 28.0, setupFeeUsd: 25.0 },
      { id: "t2", minQty: 5001, maxQty: null, rateUsd: 23.0, setupFeeUsd: 15.0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 20 },
    status: "Active",
    notes: "Ikki qatlamli qog'oz/kartonni yelimlab birlashtirish (Duplex 300g+300g).",
  },
  {
    code: "TRF-009",
    category: "Die-Cutting & Finishing",
    operationName: "Flatbed Die-Cutting & Creasing (Высечка)",
    department: "Post-press",
    machineOrDept: "Bobst Novacut 106 E",
    unit: "1,000 strokes",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 18.0,
    setupFeeUsd: 35.0,
    minChargeUsd: 48.0,
    vatRate: 12,
    pieceworkRateUsd: 3.5,
    helperPieceworkRateUsd: 1.5,
    normOutputPerShift: 28000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 10000, rateUsd: 18.0, setupFeeUsd: 35.0 },
      { id: "t2", minQty: 10001, maxQty: 50000, rateUsd: 15.0, setupFeeUsd: 25.0 },
      { id: "t3", minQty: 50001, maxQty: null, rateUsd: 12.0, setupFeeUsd: 15.0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 25 },
    status: "Active",
    notes: "Shtansforma bilan figuraviy qirqish, bigovka va perferatsiya.",
  },
  {
    code: "TRF-010",
    category: "Bindery & Guillotine",
    operationName: "Polar High-Speed Guillotine Trimming & Packing",
    department: "Post-press",
    machineOrDept: "Polar N 115 Plus",
    unit: "1,000 finished pcs",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 4.5,
    setupFeeUsd: 10.0,
    minChargeUsd: 15.0,
    vatRate: 12,
    pieceworkRateUsd: 1.2,
    helperPieceworkRateUsd: 0.6,
    normOutputPerShift: 80000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 20000, rateUsd: 4.5, setupFeeUsd: 10.0 },
      { id: "t2", minQty: 20001, maxQty: null, rateUsd: 3.2, setupFeeUsd: 5.0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 20 },
    status: "Active",
    notes: "Tayyor yorliq va varaqlarni to'rt tomonlama aniq qirqish va o'rash.",
  },
  {
    code: "TRF-011",
    category: "Jacquard Weaving",
    operationName: "High-Definition Jacquard Label Weaving (Damask)",
    department: "Jacquard",
    machineOrDept: "Muller Jacquard MBJ6",
    unit: "1,000 linear meters",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 48.0,
    setupFeeUsd: 50.0,
    minChargeUsd: 90.0,
    vatRate: 12,
    pieceworkRateUsd: 9.0,
    helperPieceworkRateUsd: 3.5,
    normOutputPerShift: 8000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 5000, rateUsd: 48.0, setupFeeUsd: 50.0 },
      { id: "t2", minQty: 5001, maxQty: 25000, rateUsd: 42.0, setupFeeUsd: 35.0 },
      { id: "t3", minQty: 25001, maxQty: null, rateUsd: 35.0, setupFeeUsd: 20.0 },
    ],
    pricingRules: { vipDiscountPct: 10, wholesaleDiscountPct: 15, urgentSurchargePct: 30 },
    status: "Active",
    notes: "Tekstil kiyimlari uchun jakkard to'qilgan brend yorliqlar (damask zichlikda).",
  },
  {
    code: "TRF-012",
    category: "Handwork & Packaging",
    operationName: "Manual Eyelet Punching & Cord Stringing (Lyvers)",
    department: "Post-press",
    machineOrDept: "Manual Assembly Line",
    unit: "1,000 finished pcs",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 25.0,
    setupFeeUsd: 0,
    minChargeUsd: 20.0,
    vatRate: 12,
    pieceworkRateUsd: 15.0,
    helperPieceworkRateUsd: 0,
    normOutputPerShift: 10000,
    volumeTiers: [
      { id: "t1", minQty: 1, maxQty: 5000, rateUsd: 25.0 },
      { id: "t2", minQty: 5001, maxQty: null, rateUsd: 20.0 },
    ],
    pricingRules: { vipDiscountPct: 5, wholesaleDiscountPct: 10, urgentSurchargePct: 25 },
    status: "Active",
    notes: "Kiyim osma yorliqlariga metall lyuvers qadash va qo'lda elastik shnur taqish.",
  },
];

async function getCompanyIdByCode(companyCode: string = "PRINTGOO"): Promise<string> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.code, companyCode),
  });
  if (company) return company.id;

  const first = await db.query.companies.findFirst();
  if (first) return first.id;

  const [created] = await db
    .insert(companies)
    .values({
      code: companyCode,
      name: "PrintGoo Label & Packaging",
      industryType: "printing",
    })
    .returning();
  return created.id;
}

export async function getTariffs(companyCode: string = "PRINTGOO"): Promise<TariffRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  let rows = await db.query.tariffs.findMany({
    where: eq(tariffs.companyId, companyId),
    orderBy: [asc(tariffs.code)],
  });

  // Seed default industry tariffs if table is empty
  if (rows.length === 0) {
    const seedValues = INITIAL_INDUSTRY_TARIFFS.map((t) => ({
      companyId,
      code: t.code,
      category: t.category,
      operationName: t.operationName,
      department: t.department,
      machineOrDept: t.machineOrDept || null,
      unit: t.unit,
      unitDivisor: t.unitDivisor || 1000,
      currency: t.currency || "USD",
      rateUsd: t.rateUsd.toString(),
      setupFeeUsd: t.setupFeeUsd.toString(),
      minChargeUsd: t.minChargeUsd.toString(),
      vatRate: t.vatRate.toString(),
      pieceworkRateUsd: t.pieceworkRateUsd.toString(),
      helperPieceworkRateUsd: t.helperPieceworkRateUsd.toString(),
      normOutputPerShift: t.normOutputPerShift,
      volumeTiers: t.volumeTiers,
      pricingRules: t.pricingRules,
      status: t.status,
      notes: t.notes || null,
    }));

    await db.insert(tariffs).values(seedValues).onConflictDoNothing();

    rows = await db.query.tariffs.findMany({
      where: eq(tariffs.companyId, companyId),
      orderBy: [asc(tariffs.code)],
    });
  }

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    category: r.category,
    operationName: r.operationName,
    department: r.department,
    machineOrDept: r.machineOrDept || "",
    unit: r.unit,
    unitDivisor: r.unitDivisor,
    currency: r.currency,
    rateUsd: Number(r.rateUsd),
    setupFeeUsd: Number(r.setupFeeUsd),
    minChargeUsd: Number(r.minChargeUsd),
    vatRate: Number(r.vatRate),
    pieceworkRateUsd: Number(r.pieceworkRateUsd),
    helperPieceworkRateUsd: Number(r.helperPieceworkRateUsd),
    normOutputPerShift: r.normOutputPerShift,
    volumeTiers: (r.volumeTiers as TariffVolumeTier[]) || [],
    pricingRules: (r.pricingRules as TariffPricingRules) || {
      vipDiscountPct: 10,
      wholesaleDiscountPct: 15,
      urgentSurchargePct: 25,
    },
    techNorms: r.techNorms || {
      makeReadyMinutes: 20,
      makeReadyWasteSheets: 50,
      runningWastePercent: 1.5,
      ratedSpeedPerHour: 10000,
      effectiveSpeedPerHour: 7500,
    },
    costBreakdown: r.costBreakdown || {
      depreciationHourlyUsd: 5.0,
      powerKwPerHour: 15.0,
      powerCostPerKwh: 0.08,
      auxiliaryMaterialsPerUnit: 1.0,
      overheadPercent: 15.0,
      targetMarginPercent: 25.0,
    },
    pricingMatrix: r.pricingMatrix || [],
    operatorGrid: r.operatorGrid || {
      baseGrade: 3,
      gradeMultipliers: { "3": 1.0, "4": 1.15, "5": 1.3, "6": 1.5 },
      nightShiftSurchargePct: 15,
      overtimeMultiplier: 1.5,
      helperSharePct: 35,
    },
    lifecycle: r.lifecycle || {
      version: "v1.0",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      approvedBy: "Bosh Texnolog",
      approvedAt: "2026-01-01T08:00:00Z",
      approvalStatus: "Approved",
      auditLog: [],
    },
    status: r.status as TariffRecord["status"],
    notes: r.notes || "",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function upsertTariff(
  data: Partial<TariffRecord>,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; tariff: TariffRecord }> {
  const companyId = await getCompanyIdByCode(companyCode);

  let targetCode = data.code?.trim();
  if (!targetCode || targetCode.startsWith("TRF-NEW") || targetCode === "NEW") {
    const existingTariffs = await db.query.tariffs.findMany({
      where: eq(tariffs.companyId, companyId),
      orderBy: [desc(tariffs.code)],
    });
    const maxNum = existingTariffs.reduce((max, t) => {
      const match = t.code.match(/TRF-(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    targetCode = `TRF-${String(maxNum + 1).padStart(3, "0")}`;
  }

  // Check if exists by ID or code
  let existing = null;
  if (data.id && data.id.length > 20) {
    existing = await db.query.tariffs.findFirst({
      where: and(eq(tariffs.companyId, companyId), eq(tariffs.id, data.id)),
    });
  }
  if (!existing) {
    existing = await db.query.tariffs.findFirst({
      where: and(eq(tariffs.companyId, companyId), eq(tariffs.code, targetCode)),
    });
  }

  const payload = {
    companyId,
    code: targetCode,
    category: data.category || "Offset Printing",
    operationName: data.operationName?.trim() || "Standart Operatsiya",
    department: data.department || "Offset",
    machineOrDept: data.machineOrDept || null,
    unit: data.unit || "1,000 impressions",
    unitDivisor: data.unitDivisor || 1000,
    currency: data.currency || "USD",
    rateUsd: (data.rateUsd !== undefined ? data.rateUsd : 20.0).toString(),
    setupFeeUsd: (data.setupFeeUsd !== undefined ? data.setupFeeUsd : 30.0).toString(),
    minChargeUsd: (data.minChargeUsd !== undefined ? data.minChargeUsd : 0.0).toString(),
    vatRate: (data.vatRate !== undefined ? data.vatRate : 12.0).toString(),
    pieceworkRateUsd: (data.pieceworkRateUsd !== undefined ? data.pieceworkRateUsd : 0.0).toString(),
    helperPieceworkRateUsd: (data.helperPieceworkRateUsd !== undefined ? data.helperPieceworkRateUsd : 0.0).toString(),
    normOutputPerShift: data.normOutputPerShift || 0,
    volumeTiers: data.volumeTiers || [],
    pricingRules: data.pricingRules || {
      vipDiscountPct: 10,
      wholesaleDiscountPct: 15,
      urgentSurchargePct: 25,
    },
    techNorms: data.techNorms || {
      makeReadyMinutes: 20,
      makeReadyWasteSheets: 50,
      runningWastePercent: 1.5,
      ratedSpeedPerHour: 10000,
      effectiveSpeedPerHour: 7500,
    },
    costBreakdown: data.costBreakdown || {
      depreciationHourlyUsd: 5.0,
      powerKwPerHour: 15.0,
      powerCostPerKwh: 0.08,
      auxiliaryMaterialsPerUnit: 1.0,
      overheadPercent: 15.0,
      targetMarginPercent: 25.0,
    },
    pricingMatrix: data.pricingMatrix || [],
    operatorGrid: data.operatorGrid || {
      baseGrade: 3,
      gradeMultipliers: { "3": 1.0, "4": 1.15, "5": 1.3, "6": 1.5 },
      nightShiftSurchargePct: 15,
      overtimeMultiplier: 1.5,
      helperSharePct: 35,
    },
    lifecycle: data.lifecycle || {
      version: "v1.0",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      approvedBy: "Bosh Texnolog",
      approvedAt: "2026-01-01T08:00:00Z",
      approvalStatus: "Approved",
      auditLog: [],
    },
    status: data.status || "Active",
    notes: data.notes || null,
    updatedAt: new Date(),
  };

  let record;
  if (existing) {
    const [updated] = await db
      .update(tariffs)
      .set(payload)
      .where(eq(tariffs.id, existing.id))
      .returning();
    record = updated;
  } else {
    const [created] = await db
      .insert(tariffs)
      .values(payload)
      .returning();
    record = created;
  }

  return {
    success: true,
    tariff: {
      id: record.id,
      code: record.code,
      category: record.category,
      operationName: record.operationName,
      department: record.department,
      machineOrDept: record.machineOrDept || "",
      unit: record.unit,
      unitDivisor: record.unitDivisor,
      currency: record.currency,
      rateUsd: Number(record.rateUsd),
      setupFeeUsd: Number(record.setupFeeUsd),
      minChargeUsd: Number(record.minChargeUsd),
      vatRate: Number(record.vatRate),
      pieceworkRateUsd: Number(record.pieceworkRateUsd),
      helperPieceworkRateUsd: Number(record.helperPieceworkRateUsd),
      normOutputPerShift: record.normOutputPerShift,
      volumeTiers: (record.volumeTiers as TariffVolumeTier[]) || [],
      pricingRules: (record.pricingRules as TariffPricingRules) || {
        vipDiscountPct: 10,
        wholesaleDiscountPct: 15,
        urgentSurchargePct: 25,
      },
      techNorms: record.techNorms || {
        makeReadyMinutes: 20,
        makeReadyWasteSheets: 50,
        runningWastePercent: 1.5,
        ratedSpeedPerHour: 10000,
        effectiveSpeedPerHour: 7500,
      },
      costBreakdown: record.costBreakdown || {
        depreciationHourlyUsd: 5.0,
        powerKwPerHour: 15.0,
        powerCostPerKwh: 0.08,
        auxiliaryMaterialsPerUnit: 1.0,
        overheadPercent: 15.0,
        targetMarginPercent: 25.0,
      },
      pricingMatrix: record.pricingMatrix || [],
      operatorGrid: record.operatorGrid || {
        baseGrade: 3,
        gradeMultipliers: { "3": 1.0, "4": 1.15, "5": 1.3, "6": 1.5 },
        nightShiftSurchargePct: 15,
        overtimeMultiplier: 1.5,
        helperSharePct: 35,
      },
      lifecycle: record.lifecycle || {
        version: "v1.0",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        approvedBy: "Bosh Texnolog",
        approvedAt: "2026-01-01T08:00:00Z",
        approvalStatus: "Approved",
        auditLog: [],
      },
      status: record.status as TariffRecord["status"],
      notes: record.notes || "",
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
  };
}

export async function deleteTariff(
  idOrCode: string,
  companyCode: string = "PRINTGOO"
): Promise<boolean> {
  const companyId = await getCompanyIdByCode(companyCode);

  const existing = await db.query.tariffs.findFirst({
    where: and(
      eq(tariffs.companyId, companyId),
      idOrCode.includes("-") && idOrCode.length > 25
        ? eq(tariffs.id, idOrCode)
        : eq(tariffs.code, idOrCode)
    ),
  });

  if (!existing) return false;

  await db.delete(tariffs).where(eq(tariffs.id, existing.id));
  return true;
}
