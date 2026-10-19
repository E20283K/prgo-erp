export type MachineCategory =
  | "offset"
  | "flexo"
  | "die-cutting"
  | "lamination"
  | "guillotine"
  | "casing-in"
  | "jacquard"
  | "mounting";

export type MachineStatus = "Running" | "Idle" | "Maintenance" | "Setup";

export interface MachineOffsetSpecs {
  maxSheetMm: string;
  minSheetMm: string;
  maxPrintAreaMm: string;
  grammageRange: string;
  printingUnits: number;
  perfectingMode: string;
  plateSizeMm: string;
  blanketSizeMm: string;
  dampeningSystem: string;
  maxSpeedSph: number;
  practicalSpeedSph: number;
  makeReadyMinutes: number;
  makeReadyWasteSheets: number;
  dryerType: string;
  inkingRollersCount: number;
  alcoholDosingPercent: string;
}

export interface MachineFlexoSpecs {
  maxWebWidthMm: number;
  minWebWidthMm: number;
  repeatMinMm: number;
  repeatMaxMm: number;
  gearPitch: string;
  maxUnwindDiamMm: number;
  maxRewindDiamMm: number;
  coreDiameterMm: number;
  printingStations: number;
  plateThicknessMm: number;
  cushionTapeMm: number;
  maxSpeedMpm: number;
  practicalSpeedMpm: number;
  makeReadyMinutes: number;
  makeReadyWasteMeters: number;
  curingSystem: string;
  aniloxCount: number;
  rotaryDieStations: number;
  coldFoilUnit: boolean;
  delamRelam: boolean;
}

export interface MachineDieCuttingSpecs {
  maxSheetMm: string;
  minSheetMm: string;
  maxPressureTons: number;
  substrateRange: string;
  gripperMarginMm: string;
  chaseFrameMm: string;
  cuttingRuleHeightMm: number;
  strippingStation: boolean;
  centerlineSystem: boolean;
  maxSpeedSph: number;
  practicalSpeedSph: number;
  makeReadyMinutes: number;
  makeReadyWasteSheets: number;
}

export interface MachineLaminationSpecs {
  maxSheetMm: string;
  minSheetMm: string;
  grammageRange: string;
  calenderDiameterMm: number;
  calenderHeating: string;
  nipPressureBar: number;
  supportedFilms: string;
  maxSpeedMpm: number;
  practicalSpeedMpm: number;
  makeReadyMinutes: number;
  makeReadyWasteSheets: number;
}

export interface MachineGuillotineSpecs {
  cuttingWidthMm: number;
  feedDepthMm: number;
  clampOpeningMm: number;
  tableHeightMm: number;
  clampingPressureRangeDaN: string;
  airCushionTable: boolean;
  opticalCutIndicator: boolean;
  knifeType: string;
  cutsPerKnifeChange: number;
  cycleTimeSec: number;
}

export interface MachineJacquardSpecs {
  reedWidthMm: number;
  hooksCount: number;
  simultaneousRibbons: number;
  weftInsertionType: string;
  maxRpm: number;
  practicalRpm: number;
  densityRangePicksCm: string;
  ultrasonicCutters: number;
  warpBeamDiamMm: number;
  makeReadyMinutes: number;
  wasteMeters: number;
}

export interface MachineMountingSpecs {
  maxSheetMm: string;
  minSheetMm: string;
  glueType: string;
  baseSubstrate: string;
  topSheetGrammage: string;
  accuracyMm: string;
  maxSpeedSph: number;
  practicalSpeedSph: number;
  makeReadyMinutes: number;
  makeReadyWasteSheets: number;
}

export interface MachineCasingInSpecs {
  maxBookFormatMm: string;
  minBookFormatMm: string;
  speedCyclesPerHour: number;
  jointFormingStations: number;
  ribbonInserting: boolean;
  headBandAttachment: boolean;
  makeReadyMinutes: number;
  makeReadyWasteBooks: number;
}

export interface MachineEnergySpecs {
  installedPowerKw: number;
  activePowerKw: number;
  standbyPowerKw: number;
  dryerHeatingKw: number;
  compressedAirBar: number;
  compressedAirCfm: number;
  chillerPowerKw: number;
  electricityTariffUsd: number;
  hourlyElectricityCostUsd: number;
  monthlyHoursPlanned: number;
  monthlyPowerCostUsd: number;
}

export interface MachineCostingSpecs {
  investmentUsd: number;
  depreciationYears: number;
  annualWorkHours: number;
  hourlyDepreciationUsd: number;
  hourlyElectricityUsd: number;
  hourlyMaintenanceReserveUsd: number;
  operatorHourlyWageUsd: number;
  assistantHourlyWageUsd: number;
  factoryOverheadUsd: number;
  totalBaseCostPerHourUsd: number;
  standardHourlyRateUsd: number;
  markupPercent: number;
}

export interface MachineMaintenanceRecord {
  id: string;
  date: string;
  type: "Routine Oil/Lube" | "Roller Replacement" | "UV Lamp Change" | "Blade Sharpening" | "Bearing/Sensor Repair" | "General Overhaul";
  meterReading: string;
  technician: string;
  costUsd: number;
  downtimeHours: number;
  description: string;
  nextDueAt: string;
}

export interface MachineRecord {
  id: string;
  name: string;
  code: string;
  manufacturer: string;
  country: string;
  year: number;
  serialNo: string;
  department: "Offset" | "Flexo" | "Post-press" | "Jacquard" | "Packaging";
  category: MachineCategory;
  location: string;
  status: MachineStatus;
  overallEfficiency: number;
  totalLifetimeCounter: number;
  counterUnit: "sheets" | "meters" | "cuts" | "picks" | "books";
  leadOperator: string;
  assistantOperator: string;
  shiftPattern: string;

  // Category polymorphic specs
  offsetSpecs?: MachineOffsetSpecs;
  flexoSpecs?: MachineFlexoSpecs;
  dieCuttingSpecs?: MachineDieCuttingSpecs;
  laminationSpecs?: MachineLaminationSpecs;
  guillotineSpecs?: MachineGuillotineSpecs;
  jacquardSpecs?: MachineJacquardSpecs;
  mountingSpecs?: MachineMountingSpecs;
  casingInSpecs?: MachineCasingInSpecs;

  // Energy & Financial costing
  energy: MachineEnergySpecs;
  costing: MachineCostingSpecs;

  // Maintenance & life telemetry
  telemetry: {
    temperatureC: number;
    vibrationMmS: number;
    oilPressureBar: number;
    uvLampHoursUsed?: number;
    uvLampMaxHours?: number;
    wearRollersPct?: number;
    bladeWearPct?: number;
  };
  maintenanceLogs: MachineMaintenanceRecord[];
  notes?: string;
}
