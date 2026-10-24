export interface TariffVolumeTier {
  id: string;
  minQty: number;
  maxQty: number | null; // null means and above (e.g. 50,000+)
  rateUsd: number;
  setupFeeUsd?: number;
  discountPct?: number;
  note?: string;
}

export interface TariffPricingRules {
  vipDiscountPct: number;
  wholesaleDiscountPct: number;
  urgentSurchargePct: number;
}

// 1. Texnologik me'yorlar (Tech Norms & Machine Speeds)
export interface TariffTechNorms {
  makeReadyMinutes: number; // Pripravka vaqti (daqiqalarda)
  makeReadyWasteSheets: number; // Pripravka chiqindi varaqlari (list)
  runningWastePercent: number; // Tirajdagi tabiiy yo'qotish / texnik chiqindi (%)
  ratedSpeedPerHour: number; // Pasport tezligi (ottisk/soat yoki metr/soat)
  effectiveSpeedPerHour: number; // Haqiqiy me'yoriy ish tezligi (ottisk/soat)
}

// 2. Tannarx kalkulyatsiyasi (Cost Breakdown / Калькуляция)
export interface TariffCostBreakdown {
  depreciationHourlyUsd: number; // Stanok amortizatsiyasi ($/soat)
  powerKwPerHour: number; // Elektr quvvati (kW/soat)
  powerCostPerKwh: number; // 1 kW elektr narxi ($)
  auxiliaryMaterialsPerUnit: number; // Yordamchi kimyoviy moddalar ($ / unitDivisor)
  overheadPercent: number; // Sex va umumkorxona ustamasi (%)
  targetMarginPercent: number; // Rejaviy rentabellik marjasi (%)
}

// 3. Ko'p parametrli tarif matritsasi (Matrix Cell / Row)
export interface TariffMatrixItem {
  id: string;
  format: string; // "B1 (700×1000)", "B2 (500×700)", "B3 (350×500)", "A3", "Custom"
  colors: string; // "1+0", "1+1", "4+0", "4+4", "5+0", "4+L"
  weightBand: "light" | "standard" | "heavy" | "microflute"; // <120g, 120-300g, >300g, gofr
  rateUsd: number;
  setupFeeUsd: number;
  speedFactor: number; // 1.0, 0.85, 0.70 va h.k.
  note?: string;
}

// 4. Operator tarif setkasi va razryadlari (Operator Grade Surcharges)
export interface TariffOperatorGrid {
  baseGrade: number; // 3-razryad
  gradeMultipliers: Record<string, number>; // { "3": 1.0, "4": 1.15, "5": 1.30, "6": 1.50 }
  nightShiftSurchargePct: number; // 15%
  overtimeMultiplier: number; // 1.5x
  helperSharePct: number; // 35%
}

// 5. Amal qilish davri, versiyalash va audit
export interface TariffAuditEntry {
  date: string;
  user: string;
  action: string;
  details: string;
}

export interface TariffLifecycle {
  version: string; // "v2.0"
  effectiveFrom: string; // "2026-01-01"
  effectiveTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalStatus: "Draft" | "Pending" | "Approved" | "Archived";
  auditLog: TariffAuditEntry[];
}

export interface TariffRecord {
  id: string;
  code: string;
  category: string;
  operationName: string;
  department: string;
  machineOrDept?: string;
  unit: string;
  unitDivisor: number; // e.g. 1000 for per 1,000 units, 1 for per piece/sheet/plate
  currency: string;
  rateUsd: number;
  setupFeeUsd: number;
  minChargeUsd: number;
  vatRate: number;
  pieceworkRateUsd: number; // Sdelka per unitDivisor for head operator
  helperPieceworkRateUsd: number; // Sdelka per unitDivisor for assistant/helper
  normOutputPerShift: number; // Standard output units per 8h/12h shift
  volumeTiers: TariffVolumeTier[];
  pricingRules: TariffPricingRules;
  techNorms?: TariffTechNorms;
  costBreakdown?: TariffCostBreakdown;
  pricingMatrix?: TariffMatrixItem[];
  operatorGrid?: TariffOperatorGrid;
  lifecycle?: TariffLifecycle;
  status: "Active" | "Review" | "Archived";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const TARIFF_CATEGORIES = [
  "Prepress / CTP",
  "Offset Printing",
  "Flexo Roll Label",
  "Jacquard Weaving",
  "Surface Coating",
  "Kashirovka (Mounting)",
  "Die-Cutting & Finishing",
  "Bindery & Guillotine",
  "Handwork & Packaging",
  "Silk Screen Printing",
] as const;

export const TARIFF_CALC_UNITS = [
  { value: "1,000 impressions", label: "1,000 ottisk (impressions)", divisor: 1000 },
  { value: "1,000 sheets", label: "1,000 varaq (sheets)", divisor: 1000 },
  { value: "1,000 strokes", label: "1,000 zarba / pichoq (strokes)", divisor: 1000 },
  { value: "1,000 linear meters", label: "1,000 pogonometr (meters)", divisor: 1000 },
  { value: "1,000 glue passes", label: "1,000 kashirovka varaq", divisor: 1000 },
  { value: "1,000 finished pcs", label: "1,000 tayyor mahsulot (pcs)", divisor: 1000 },
  { value: "1 plate", label: "1 dona CTP forma (plate)", divisor: 1 },
  { value: "1 kg", label: "1 kg yelim / kimyo", divisor: 1 },
  { value: "1 hour", label: "1 soat ish vaqti (normo-soat)", divisor: 1 },
  { value: "1 piece", label: "1 dona (pcs)", divisor: 1 },
] as const;

export interface TariffCalculationResult {
  matchedTier: TariffVolumeTier | null;
  baseRate: number;
  effectiveRate: number;
  effectiveSetup: number;
  operationQty: number;
  chargeableUnits: number;
  runCost: number;
  setupCost: number;
  subtotalCost: number;
  discountAmount: number;
  surchargeAmount: number;
  netCost: number;
  vatAmount: number;
  totalWithVat: number;
  pieceworkTotal: number;
  helperPieceworkTotal: number;
  unitCost: number;

  // Rich Industrial Calculation Metrics
  machineRunHours: number;
  machineSetupHours: number;
  totalMachineHours: number;
  makeReadyScrapSheets: number;
  runningScrapSheets: number;
  totalWasteSheets: number;
  depreciationCost: number;
  powerCost: number;
  auxMaterialCost: number;
  directFactoryCost: number;
  overheadCost: number;
  totalFactoryCost: number;
  recommendedPrice: number;
  profitMarginAmount: number;
  actualMarginPct: number;
}

export function computeTariffEstimate(
  tariff: TariffRecord,
  quantity: number,
  options?: {
    customerTier?: "standard" | "vip" | "wholesale";
    isUrgent?: boolean;
    customSetupFee?: number;
    customRate?: number;
    operatorGrade?: number; // 3, 4, 5, 6
    isNightShift?: boolean;
    isOvertime?: boolean;
    matrixFormat?: string;
    matrixColors?: string;
  }
): TariffCalculationResult {
  const qty = Math.max(0, quantity);
  const divisor = tariff.unitDivisor > 0 ? tariff.unitDivisor : 1;
  const chargeableUnits = qty / divisor;

  // 1. Matrix matching if provided
  let matrixMatch: TariffMatrixItem | null = null;
  if (options?.matrixFormat || options?.matrixColors) {
    matrixMatch = (tariff.pricingMatrix || []).find((m) => {
      const formatMatch = !options.matrixFormat || m.format.toLowerCase().includes(options.matrixFormat.toLowerCase());
      const colorsMatch = !options.matrixColors || m.colors === options.matrixColors;
      return formatMatch && colorsMatch;
    }) || null;
  }

  // 2. Find matching volume tier
  let matchedTier: TariffVolumeTier | null = null;
  if (Array.isArray(tariff.volumeTiers) && tariff.volumeTiers.length > 0) {
    matchedTier = tariff.volumeTiers.find((t) => {
      const minMatch = qty >= t.minQty;
      const maxMatch = t.maxQty === null || t.maxQty === undefined || qty <= t.maxQty;
      return minMatch && maxMatch;
    }) || null;
  }

  // 3. Base rate & setup resolution
  let baseRate = options?.customRate !== undefined
    ? options.customRate
    : matrixMatch
    ? matrixMatch.rateUsd
    : (matchedTier ? matchedTier.rateUsd : tariff.rateUsd);

  let effectiveSetup = options?.customSetupFee !== undefined
    ? options.customSetupFee
    : matrixMatch?.setupFeeUsd !== undefined
    ? matrixMatch.setupFeeUsd
    : (matchedTier?.setupFeeUsd !== undefined ? matchedTier.setupFeeUsd : tariff.setupFeeUsd);

  const effectiveRate = baseRate;

  // 4. Customer Tier discounts
  let discountPct = 0;
  if (options?.customerTier === "vip") {
    discountPct = tariff.pricingRules?.vipDiscountPct || 0;
  } else if (options?.customerTier === "wholesale") {
    discountPct = tariff.pricingRules?.wholesaleDiscountPct || 0;
  }

  let surchargePct = 0;
  if (options?.isUrgent) {
    surchargePct = tariff.pricingRules?.urgentSurchargePct || 0;
  }

  const runCost = chargeableUnits * effectiveRate;
  const setupCost = effectiveSetup;
  let subtotalCost = runCost + setupCost;

  // Apply min charge constraint
  if (tariff.minChargeUsd > 0 && subtotalCost < tariff.minChargeUsd && qty > 0) {
    subtotalCost = tariff.minChargeUsd;
  }

  const discountAmount = Number(((subtotalCost * discountPct) / 100).toFixed(2));
  const afterDiscount = subtotalCost - discountAmount;
  const surchargeAmount = Number(((afterDiscount * surchargePct) / 100).toFixed(2));
  const netCost = Number((afterDiscount + surchargeAmount).toFixed(2));

  const vatAmount = Number(((netCost * (tariff.vatRate || 0)) / 100).toFixed(2));
  const totalWithVat = Number((netCost + vatAmount).toFixed(2));

  // Operator grade & shift multiplier
  const gradeKey = String(options?.operatorGrade || 3);
  const gradeMultiplier = (tariff.operatorGrid?.gradeMultipliers && tariff.operatorGrid.gradeMultipliers[gradeKey]) || 1.0;
  const nightMultiplier = options?.isNightShift ? 1 + (tariff.operatorGrid?.nightShiftSurchargePct || 15) / 100 : 1.0;
  const overtimeMultiplier = options?.isOvertime ? tariff.operatorGrid?.overtimeMultiplier || 1.5 : 1.0;
  const laborMultiplier = gradeMultiplier * nightMultiplier * overtimeMultiplier;

  // Piecework (Sdelka) calculation for operators
  const pieceworkTotal = Number((chargeableUnits * (tariff.pieceworkRateUsd || 0) * laborMultiplier).toFixed(2));
  const helperPieceworkTotal = Number((chargeableUnits * (tariff.helperPieceworkRateUsd || 0) * laborMultiplier).toFixed(2));
  const unitCost = qty > 0 ? Number((netCost / qty).toFixed(4)) : 0;

  // Tech Norms calculation (Machine time & Waste)
  const effectiveSpeed = tariff.techNorms?.effectiveSpeedPerHour || 7500;
  const makeReadyMin = tariff.techNorms?.makeReadyMinutes || 20;
  const machineRunHours = effectiveSpeed > 0 ? Number((qty / effectiveSpeed).toFixed(2)) : 0;
  const machineSetupHours = Number((makeReadyMin / 60).toFixed(2));
  const totalMachineHours = Number((machineRunHours + machineSetupHours).toFixed(2));

  const makeReadyScrapSheets = tariff.techNorms?.makeReadyWasteSheets || 50;
  const runningScrapSheets = Math.ceil(qty * ((tariff.techNorms?.runningWastePercent || 1.5) / 100));
  const totalWasteSheets = makeReadyScrapSheets + runningScrapSheets;

  // Cost Breakdown calculation
  const depreciationCost = Number((totalMachineHours * (tariff.costBreakdown?.depreciationHourlyUsd || 5)).toFixed(2));
  const powerCost = Number(
    (totalMachineHours * (tariff.costBreakdown?.powerKwPerHour || 15) * (tariff.costBreakdown?.powerCostPerKwh || 0.08)).toFixed(2)
  );
  const auxMaterialCost = Number((chargeableUnits * (tariff.costBreakdown?.auxiliaryMaterialsPerUnit || 1.0)).toFixed(2));
  const directFactoryCost = Number((depreciationCost + powerCost + auxMaterialCost + pieceworkTotal + helperPieceworkTotal).toFixed(2));
  const overheadCost = Number((directFactoryCost * ((tariff.costBreakdown?.overheadPercent || 15) / 100)).toFixed(2));
  const totalFactoryCost = Number((directFactoryCost + overheadCost).toFixed(2));
  const targetMarginPct = tariff.costBreakdown?.targetMarginPercent || 25;
  const recommendedPrice = Number((totalFactoryCost * (1 + targetMarginPct / 100)).toFixed(2));
  const profitMarginAmount = Number((netCost - totalFactoryCost).toFixed(2));
  const actualMarginPct = totalFactoryCost > 0 ? Number(((profitMarginAmount / totalFactoryCost) * 100).toFixed(1)) : 0;

  return {
    matchedTier,
    baseRate,
    effectiveRate,
    effectiveSetup,
    operationQty: qty,
    chargeableUnits,
    runCost: Number(runCost.toFixed(2)),
    setupCost: Number(setupCost.toFixed(2)),
    subtotalCost: Number(subtotalCost.toFixed(2)),
    discountAmount,
    surchargeAmount,
    netCost,
    vatAmount,
    totalWithVat,
    pieceworkTotal,
    helperPieceworkTotal,
    unitCost,
    machineRunHours,
    machineSetupHours,
    totalMachineHours,
    makeReadyScrapSheets,
    runningScrapSheets,
    totalWasteSheets,
    depreciationCost,
    powerCost,
    auxMaterialCost,
    directFactoryCost,
    overheadCost,
    totalFactoryCost,
    recommendedPrice,
    profitMarginAmount,
    actualMarginPct,
  };
}

export function createEmptyTariff(id?: string, code = "TRF-NEW"): TariffRecord {
  return {
    id: id || `TRF-${Date.now().toString().slice(-4)}`,
    code,
    category: "Offset Printing",
    operationName: "",
    department: "Offset",
    machineOrDept: "",
    unit: "1,000 sheets",
    unitDivisor: 1000,
    currency: "USD",
    rateUsd: 20.0,
    setupFeeUsd: 30.0,
    minChargeUsd: 50.0,
    vatRate: 12.0,
    pieceworkRateUsd: 4.5,
    helperPieceworkRateUsd: 2.0,
    normOutputPerShift: 15000,
    volumeTiers: [
      { id: "tier-1", minQty: 1, maxQty: 10000, rateUsd: 24.0, setupFeeUsd: 45.0, note: "Kichik tirajlar" },
      { id: "tier-2", minQty: 10001, maxQty: 50000, rateUsd: 20.0, setupFeeUsd: 35.0, discountPct: 15, note: "O'rta standart tiraj" },
      { id: "tier-3", minQty: 50001, maxQty: null, rateUsd: 16.0, setupFeeUsd: 25.0, discountPct: 30, note: "Katta ulgurji tiraj" },
    ],
    pricingRules: {
      vipDiscountPct: 10,
      wholesaleDiscountPct: 15,
      urgentSurchargePct: 25,
    },
    techNorms: {
      makeReadyMinutes: 25,
      makeReadyWasteSheets: 60,
      runningWastePercent: 1.5,
      ratedSpeedPerHour: 12000,
      effectiveSpeedPerHour: 8500,
    },
    costBreakdown: {
      depreciationHourlyUsd: 6.5,
      powerKwPerHour: 18.0,
      powerCostPerKwh: 0.08,
      auxiliaryMaterialsPerUnit: 1.2,
      overheadPercent: 15.0,
      targetMarginPercent: 25.0,
    },
    pricingMatrix: [
      { id: "m-1", format: "B1 (700×1000)", colors: "4+0", weightBand: "standard", rateUsd: 22.0, setupFeeUsd: 35.0, speedFactor: 1.0, note: "Standart B1 4+0" },
      { id: "m-2", format: "B1 (700×1000)", colors: "4+4", weightBand: "standard", rateUsd: 38.0, setupFeeUsd: 60.0, speedFactor: 0.9, note: "Perfektor B1 4+4" },
      { id: "m-3", format: "B2 (500×700)", colors: "4+0", weightBand: "standard", rateUsd: 16.0, setupFeeUsd: 25.0, speedFactor: 1.0, note: "Standart B2 4+0" },
      { id: "m-4", format: "B2 (500×700)", colors: "4+4", weightBand: "standard", rateUsd: 28.0, setupFeeUsd: 45.0, speedFactor: 0.9, note: "Perfektor B2 4+4" },
      { id: "m-5", format: "B1 (700×1000)", colors: "1+0", weightBand: "standard", rateUsd: 11.0, setupFeeUsd: 18.0, speedFactor: 1.1, note: "1 rangli ofset" },
      { id: "m-6", format: "B1 (700×1000)", colors: "4+L", weightBand: "heavy", rateUsd: 26.0, setupFeeUsd: 45.0, speedFactor: 0.8, note: "4 rang + Lak sektsiyasi" },
    ],
    operatorGrid: {
      baseGrade: 3,
      gradeMultipliers: { "3": 1.0, "4": 1.15, "5": 1.3, "6": 1.5 },
      nightShiftSurchargePct: 15,
      overtimeMultiplier: 1.5,
      helperSharePct: 35,
    },
    lifecycle: {
      version: "v1.0",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      approvedBy: "Bosh Texnolog",
      approvedAt: "2026-01-01T08:00:00Z",
      approvalStatus: "Approved",
      auditLog: [
        {
          date: "2026-01-01T08:00:00Z",
          user: "Bosh Texnolog",
          action: "INITIAL_APPROVAL",
          details: "Dastlabki korxona me'yoriy tarifi tasdiqlandi.",
        },
      ],
    },
    status: "Active",
    notes: "",
  };
}
