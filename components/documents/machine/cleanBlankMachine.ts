import { MachineCategory, MachineRecord } from "./types";

export function getDefaultCounterUnit(category: MachineCategory): "sheets" | "meters" | "cuts" | "picks" | "books" {
  switch (category) {
    case "flexo":
    case "lamination":
      return "meters";
    case "guillotine":
      return "cuts";
    case "jacquard":
      return "picks";
    case "casing-in":
      return "books";
    case "offset":
    case "die-cutting":
    case "mounting":
    default:
      return "sheets";
  }
}

export function getDefaultDepartmentForCategory(
  category: MachineCategory
): "Offset" | "Flexo" | "Post-press" | "Jacquard" | "Packaging" {
  switch (category) {
    case "offset":
      return "Offset";
    case "flexo":
      return "Flexo";
    case "jacquard":
      return "Jacquard";
    case "mounting":
      return "Packaging";
    case "die-cutting":
    case "guillotine":
    case "lamination":
    case "casing-in":
    default:
      return "Post-press";
  }
}

export function getCleanBlankMachine(
  id?: string,
  initData?: Partial<MachineRecord>
): MachineRecord {
  const generatedId = id || `new-${Date.now()}`;
  const category: MachineCategory = (initData?.category as MachineCategory) || "offset";
  const department = initData?.department || getDefaultDepartmentForCategory(category);
  const counterUnit = initData?.counterUnit || getDefaultCounterUnit(category);

  return {
    id: generatedId,
    name: initData?.name || "",
    code: initData?.code || "MAC-0001",
    manufacturer: initData?.manufacturer || "",
    country: initData?.country || "",
    year: initData?.year || new Date().getFullYear(),
    serialNo: initData?.serialNo || "",
    department,
    category,
    location: initData?.location || "",
    status: initData?.status || "Idle",
    overallEfficiency: initData?.overallEfficiency ?? 90,
    totalLifetimeCounter: initData?.totalLifetimeCounter ?? 0,
    counterUnit,
    leadOperator: initData?.leadOperator || "",
    assistantOperator: initData?.assistantOperator || "",
    shiftPattern: initData?.shiftPattern || "",

    // Empty specs by default (no hardcoded offset or vendor data)
    offsetSpecs: category === "offset" ? {
      maxSheetMm: "",
      minSheetMm: "",
      maxPrintAreaMm: "",
      grammageRange: "",
      printingUnits: 0,
      perfectingMode: "Straight",
      plateSizeMm: "",
      blanketSizeMm: "",
      dampeningSystem: "",
      maxSpeedSph: 0,
      practicalSpeedSph: 0,
      makeReadyMinutes: 0,
      makeReadyWasteSheets: 0,
      dryerType: "",
      inkingRollersCount: 0,
      alcoholDosingPercent: "",
    } : undefined,

    flexoSpecs: category === "flexo" ? {
      maxWebWidthMm: 0,
      minWebWidthMm: 0,
      repeatMinMm: 0,
      repeatMaxMm: 0,
      gearPitch: "",
      maxUnwindDiamMm: 0,
      maxRewindDiamMm: 0,
      coreDiameterMm: 0,
      printingStations: 0,
      plateThicknessMm: 0,
      cushionTapeMm: 0,
      maxSpeedMpm: 0,
      practicalSpeedMpm: 0,
      makeReadyMinutes: 0,
      makeReadyWasteMeters: 0,
      curingSystem: "",
      aniloxCount: 0,
      rotaryDieStations: 0,
      coldFoilUnit: false,
      delamRelam: false,
    } : undefined,

    dieCuttingSpecs: category === "die-cutting" ? {
      maxSheetMm: "",
      minSheetMm: "",
      maxPressureTons: 0,
      substrateRange: "",
      gripperMarginMm: "",
      chaseFrameMm: "",
      cuttingRuleHeightMm: 0,
      strippingStation: false,
      centerlineSystem: false,
      maxSpeedSph: 0,
      practicalSpeedSph: 0,
      makeReadyMinutes: 0,
      makeReadyWasteSheets: 0,
    } : undefined,

    guillotineSpecs: category === "guillotine" ? {
      cuttingWidthMm: 0,
      feedDepthMm: 0,
      clampOpeningMm: 0,
      tableHeightMm: 0,
      clampingPressureRangeDaN: "",
      airCushionTable: true,
      opticalCutIndicator: true,
      knifeType: "",
      cutsPerKnifeChange: 0,
      cycleTimeSec: 0,
    } : undefined,

    laminationSpecs: category === "lamination" ? {
      maxSheetMm: "",
      minSheetMm: "",
      grammageRange: "",
      calenderDiameterMm: 0,
      calenderHeating: "",
      nipPressureBar: 0,
      supportedFilms: "",
      maxSpeedMpm: 0,
      practicalSpeedMpm: 0,
      makeReadyMinutes: 0,
      makeReadyWasteSheets: 0,
    } : undefined,

    mountingSpecs: category === "mounting" ? {
      maxSheetMm: "",
      minSheetMm: "",
      glueType: "",
      baseSubstrate: "",
      topSheetGrammage: "",
      accuracyMm: "",
      maxSpeedSph: 0,
      practicalSpeedSph: 0,
      makeReadyMinutes: 0,
      makeReadyWasteSheets: 0,
    } : undefined,

    casingInSpecs: category === "casing-in" ? {
      maxBookFormatMm: "",
      minBookFormatMm: "",
      speedCyclesPerHour: 0,
      jointFormingStations: 0,
      ribbonInserting: false,
      headBandAttachment: false,
      makeReadyMinutes: 0,
      makeReadyWasteBooks: 0,
    } : undefined,

    jacquardSpecs: category === "jacquard" ? {
      reedWidthMm: 0,
      hooksCount: 0,
      simultaneousRibbons: 0,
      weftInsertionType: "",
      maxRpm: 0,
      practicalRpm: 0,
      densityRangePicksCm: "",
      ultrasonicCutters: 0,
      warpBeamDiamMm: 0,
      makeReadyMinutes: 0,
      wasteMeters: 0,
    } : undefined,

    energy: {
      installedPowerKw: 0,
      activePowerKw: 0,
      standbyPowerKw: 0,
      dryerHeatingKw: 0,
      compressedAirBar: 0,
      compressedAirCfm: 0,
      chillerPowerKw: 0,
      electricityTariffUsd: 0.08,
      hourlyElectricityCostUsd: 0,
      monthlyHoursPlanned: 176,
      monthlyPowerCostUsd: 0,
    },

    costing: {
      investmentUsd: 0,
      depreciationYears: 8,
      annualWorkHours: 2000,
      hourlyDepreciationUsd: 0,
      hourlyElectricityUsd: 0,
      hourlyMaintenanceReserveUsd: 0,
      operatorHourlyWageUsd: 0,
      assistantHourlyWageUsd: 0,
      factoryOverheadUsd: 0,
      totalBaseCostPerHourUsd: 0,
      standardHourlyRateUsd: 0,
      markupPercent: 25,
    },

    telemetry: {
      temperatureC: 22,
      vibrationMmS: 0,
      oilPressureBar: 0,
    },

    maintenanceLogs: [],
    notes: initData?.notes || "",
  };
}
