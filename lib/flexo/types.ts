export interface FlexoCylinderData {
  teeth: number;
  pitchCircleDiameter: number;
  plateThickness: number;
  cylinderDiameter: number;
  filmLength: number;
  printingLength: number;
  needsVerification?: boolean;
  verificationNote?: string;
}

export interface FlexoMachine {
  id: string;
  name: string;
  model: string;
  gearSystem: string;
  minWebWidth: number;
  maxWebWidth: number;
  maxPrintWidth: number;
  standardPlateThickness: number;
  availableCylinders: FlexoCylinderData[];
}

export interface FlexoMaterial {
  id: string;
  name: string;
  category: "Satin" | "Nylon" | "Textile" | "Self-Adhesive" | "Thermal" | "Paper" | string;
  defaultWebWidth: number;
  standardWidths: number[];
  color: string;
  description?: string;
}

export interface FlexoDieTooling {
  id: string;
  code: string;
  name: string;
  dieType: "rotary_magnetic" | "solid_rotary" | "flatbed" | "hot_stamp" | "embossing";
  shape: "rectangle" | "rounded_rect" | "circle" | "oval" | "custom";
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  acrossCount: number;
  aroundCount: number;
  gapXMm: number;
  gapYMm: number;
  repeatLengthMm?: number;
  cylinderTeeth?: number;
  location?: string;
  status: "available" | "in_use" | "sharpening" | "retired";
  totalImpressions: number;
  maxImpressions?: number;
  notes?: string;
}

export interface FlexoInputs {
  machineId: string;
  materialId: string;
  webWidth: number;
  sideMarginLeft: number;
  sideMarginRight: number;
  productWidth: number;
  productHeight: number;
  orientation: "normal" | "rotated";
  bleedX: number;
  bleedY: number;
  gapX: number;
  gapY: number;
  cylinderTeeth: number;
  plateThickness: number;
  colors: number;
  colorNames?: string[];
  requiredQuantity: number;
  overproductionMode: "percent" | "exact";
  overproductionValue: number;
}

export interface FlexoLayoutPosition {
  id: string;
  acrossIndex: number;
  aroundIndex: number;
  x: number; // mm from web edge
  y: number; // mm from repeat start
  width: number; // placed product width in mm
  height: number; // placed product height in mm
  bleedX: number;
  bleedY: number;
  label: string;
  orientation: "normal" | "rotated";
}

export interface FlexoLayoutDimensions {
  webWidth: number;
  usablePrintWidth: number;
  occupiedWidth: number;
  sideMarginLeft: number;
  sideMarginRight: number;
  sideWasteTotal: number;
  productWidth: number;
  productHeight: number;
  placedWidth: number;
  placedHeight: number;
  gapX: number;
  gapY: number;
  repeatPrintingLength: number;
  repeatFilmLength: number;
  cylinderDiameter: number;
  gearTeeth: number;
  plateThickness: number;
}

export interface FlexoMark {
  type: "eyemark" | "crosshair" | "colorbar" | "centerline";
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
}

export interface FlexoColorSeparation {
  name: string;
  colorCode: string;
  plateIndex: number;
}

export interface FlexoLayoutWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  field?: string;
}

export interface FlexoLayoutResult {
  machineId: string;
  machineName: string;
  materialId: string;
  materialName: string;

  webWidth: number;
  usablePrintWidth: number;
  sideMarginLeft: number;
  sideMarginRight: number;

  productWidth: number;
  productHeight: number;

  bleedX: number;
  bleedY: number;

  gapX: number;
  gapY: number;

  orientation: "normal" | "rotated";

  gearTeeth: number;
  cylinderDiameter: number;
  pitchCircleDiameter: number;
  filmLength: number;
  printingLength: number;
  plateThickness: number;

  acrossCount: number;
  aroundCount: number;
  totalPerRepeat: number;

  requiredQuantity: number;
  overproductionMode: "percent" | "exact";
  overproductionValue: number;
  productionTargetQuantity: number;

  repeatCount: number;
  actualYieldQuantity: number;

  materialConsumptionMeters: number;
  materialConsumptionSqM: number;
  wasteSqM: number;
  usedWidth: number;
  sideWasteWidth: number;
  yieldPercent: number;

  positions: FlexoLayoutPosition[];
  dimensions: FlexoLayoutDimensions;
  marks: FlexoMark[];
  colors: FlexoColorSeparation[];
  warnings: FlexoLayoutWarning[];
}

export interface FlexoCylinderRecommendation {
  cylinder: FlexoCylinderData;
  aroundCount: number;
  verticalFitEfficiency: number; // 0-100%
  residualSpace: number; // mm unused around circumference
  suitabilityScore: number; // 0-100
  recommended: boolean;
}

export interface FlexoRenderOptions {
  view: "production" | "plate" | "technical";
  previewType?: "flat" | "cylinder";
  displayOrientation?: "horizontal" | "vertical";
  cylinderRotation?: number; // 0 - 360 degrees
  repeatMode: "single" | "run";
  previewRepeats: number;
  showDimensions: boolean;
  showMarks: boolean;
  showGaps: boolean;
  showPlate: boolean;
  activeColorSeparation?: string | "all";
}
