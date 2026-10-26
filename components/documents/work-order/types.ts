export {
  type WorkOrderDepartment,
  WO_DEPT_PREFIXES,
  WO_PREFIX_TO_DEPT,
  getCurrentYearSuffix,
  normalizeDepartment,
  formatWorkOrderNo,
  getNextWorkOrderNo,
  parseWorkOrderNo,
  migrateLegacyWorkOrderNo,
} from "./utils/workOrderNumbering";
import type { WorkOrderDepartment } from "./utils/workOrderNumbering";

export type KashirovkaMode = "none" | "duplex" | "triplex";
export type KashirovkaImpositionStrategy = "split_half_sheet" | "separate_sheets";

export interface SubstrateLayer {
  id: string;
  role: "top_liner" | "core_board" | "bottom_liner";
  label: string;
  paperStock: string;
  grammage: number;
  colors: "4+0" | "1+0" | "0+0" | "4+4";
  coating: string;
}

export function parseGrammageFromStock(stock?: string, fallback = 300): number {
  if (!stock) return fallback;
  const match = stock.match(/(\d{2,4})\s*g/i);
  return match ? Number(match[1]) : fallback;
}

export function getDefaultKashirovkaLayers(
  mode: KashirovkaMode,
  baseStock = "Coated Cardboard 300g/m²",
  baseCoating = "Soft-Touch Matte + Spot UV"
): SubstrateLayer[] {
  if (mode === "none") return [];
  const baseGsm = parseGrammageFromStock(baseStock, 300);
  const topLayer: SubstrateLayer = {
    id: "layer-top",
    role: "top_liner",
    label: "Face Liner (Front / Лицо)",
    paperStock: baseGsm >= 250 ? baseStock : "Coated Cardboard 300g/m²",
    grammage: baseGsm >= 250 ? baseGsm : 300,
    colors: "4+0",
    coating: baseCoating || "Matte Lamination (1S)",
  };
  const bottomLayer: SubstrateLayer = {
    id: "layer-bottom",
    role: "bottom_liner",
    label: "Back Liner (Reverse / Оборот)",
    paperStock: baseGsm >= 250 ? baseStock : "Coated Cardboard 300g/m²",
    grammage: baseGsm >= 250 ? baseGsm : 300,
    colors: "4+0",
    coating: "Matte Lamination (1S)",
  };
  if (mode === "triplex") {
    const coreLayer: SubstrateLayer = {
      id: "layer-core",
      role: "core_board",
      label: "Inner Core Filler (Вставка)",
      paperStock: "Colorplan Ebony Black Core 300g/m²",
      grammage: 300,
      colors: "0+0",
      coating: "None / Uncoated",
    };
    return [topLayer, coreLayer, bottomLayer];
  }
  return [topLayer, bottomLayer];
}

export function calculateKashirovkaTotals(
  mode: KashirovkaMode = "none",
  layers: SubstrateLayer[] = [],
  glueGsmPerBond = 25
) {
  if (mode === "none" || layers.length === 0) {
    return {
      netPaperGsm: 0,
      glueBonds: 0,
      totalGlueGsm: 0,
      totalMountedGsm: 0,
      estimatedCaliperMm: 0,
    };
  }
  const netPaperGsm = layers.reduce((sum, l) => sum + (Number(l.grammage) || 0), 0);
  const glueBonds = Math.max(0, layers.length - 1);
  const totalGlueGsm = glueBonds * (Number(glueGsmPerBond) || 25);
  const totalMountedGsm = netPaperGsm + totalGlueGsm;
  // ~1.32 microns per gsm for coated board + glue bond film
  const estimatedCaliperMm = Number(((totalMountedGsm * 1.32) / 1000).toFixed(2));
  return {
    netPaperGsm,
    glueBonds,
    totalGlueGsm,
    totalMountedGsm,
    estimatedCaliperMm,
  };
}

export type SampleTestPurpose =
  | "color_proof"
  | "dieline_structure"
  | "full_finished"
  | "substrate_test";

export interface SampleRevisionRecord {
  id: string;
  revisionNumber: number;
  date: string;
  reasonCategory: "color_shift" | "geometry_dieline" | "text_error" | "coating_finish" | "client_change";
  notes: string;
  reportedBy: string;
}

export interface WorkOrderSampleData {
  isRequired: boolean;
  sampleQty: number;
  testPurpose: SampleTestPurpose;
  testMachine: string;
  substrateSource?: "precut" | "parent_sheet";
  technicalNotes?: string;
  isProduced: boolean;
  producedAt?: string;
  producedBy?: string;
  qcPassed: boolean;
  qcNotes?: string;
  approvalStatus: "pending_production" | "awaiting_approval" | "approved" | "revision_requested";
  approvedAt?: string;
  approvedBy?: string;
  revisions: SampleRevisionRecord[];
  sampleTargetSize?: string;
  
  // Legacy compatibility fields if any older code references them
  dispatchDate?: string;
  deliveryMethod?: string;
  isDispatched?: boolean;
}

export type ClientOrderSampleData = WorkOrderSampleData;

/**
 * Per-SKU artwork attachment (front + back PDF/SVG).
 * skuId must match the corresponding SizeDistribution.id.
 * Files are stored at /public/artwork/{workOrderId}/{skuId}-{side}.{ext}
 */
export interface SkuArtwork {
  /** Must match SizeDistribution.id for the corresponding SKU */
  skuId: string;
  model?: string;
  sizeCode: string;
  /** Server-relative URL, e.g. /artwork/WO-26-0001/sku-abc-front.pdf */
  frontArtworkUrl?: string;
  backArtworkUrl?: string;
  /** Original file name shown in the UI */
  frontArtworkName?: string;
  backArtworkName?: string;
  /** Base64-encoded PNG thumbnail (first page) for quick preview */
  frontArtworkThumb?: string;
  backArtworkThumb?: string;
}

export interface SizeDistribution {
  id: string;
  size: string;
  quantity: number;
  model?: string;
  sizeCode?: string;
}

export interface SizeScalePreset {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  sizes: string[];
}

export const SIZE_SCALE_PRESETS: SizeScalePreset[] = [
  {
    id: "alpha_ext",
    label: "Harf kengaytirilgan (X – 3XL)",
    shortLabel: "X..3XL",
    description: "X, XS, S, M, XL, XXL, 3XL",
    sizes: ["X", "XS", "S", "M", "XL", "XXL", "3XL"],
  },
  {
    id: "alpha_std",
    label: "Harf standart (XS – 3XL)",
    shortLabel: "XS..3XL",
    description: "XS, S, M, L, XL, 2XL, 3XL",
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
  },
  {
    id: "kids_height",
    label: "Bolalar bo'y o'lchami (110 – 158)",
    shortLabel: "110..158",
    description: "110, 112, 116, 122, 128, 134, 140, 146, 152, 158",
    sizes: ["110", "112", "116", "122", "128", "134", "140", "146", "152", "158"],
  },
  {
    id: "eu_numeric",
    label: "Raqamli standart (36 – 54)",
    shortLabel: "36..54",
    description: "36, 38, 40, 42, 44, 46, 48, 50, 52, 54",
    sizes: ["36", "38", "40", "42", "44", "46", "48", "50", "52", "54"],
  },
  {
    id: "baby_age",
    label: "Yosh bo'yicha (0-3M – 4Y)",
    shortLabel: "0-3M..4Y",
    description: "0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M, 2Y, 3Y, 4Y",
    sizes: ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M", "2Y", "3Y", "4Y"],
  },
];

export function parseModelAndSize(item: SizeDistribution): { model: string; sizeCode: string } {
  if (item.model !== undefined && item.sizeCode !== undefined) {
    return { model: item.model, sizeCode: item.sizeCode };
  }
  const raw = (item.size || "").trim();
  const sepMatch = raw.match(/^(.+?)\s*(?:·|\/|\||—|-|:)\s*(.+)$/);
  if (sepMatch) {
    return {
      model: item.model ?? sepMatch[1].trim(),
      sizeCode: item.sizeCode ?? sepMatch[2].trim(),
    };
  }
  return {
    model: item.model ?? "",
    sizeCode: item.sizeCode ?? raw,
  };
}

export function formatModelAndSize(model: string, sizeCode: string): string {
  const m = model.trim();
  const s = sizeCode.trim();
  if (!m) return s;
  if (!s) return m;
  return `${m} · ${s}`;
}

export interface PackagingBoxItem {
  id: string;
  boxNumber: number;
  boxCode: string;
  model?: string;
  sizeCode?: string;
  quantity: number;
  grossWeightKg?: number;
  packerName: string;
  packedAt: string;
  barcode: string;
  notes?: string;
}

export interface WorkOrderPackagingSummary {
  standardBoxCapacity: number;
  boxType: string;
  totalBoxes: number;
  totalPackedQty: number;
  targetQty: number;
  isCompleted: boolean;
  completedAt?: string;
  boxes: PackagingBoxItem[];
}

export function autoGeneratePackagingBoxes(params: {
  workOrderNo: string;
  targetQuantity: number;
  standardCapacity: number;
  sizes?: SizeDistribution[];
  defaultPacker?: string;
}): PackagingBoxItem[] {
  const { workOrderNo, targetQuantity, standardCapacity, sizes, defaultPacker = "Qadoqlash bo'limi" } = params;
  const capacity = Math.max(1, standardCapacity || 500);
  const now = new Date().toISOString();
  const cleanWo = (workOrderNo || "WOOF-26-0001").replace(/[^a-zA-Z0-9_-]/g, "");

  const validSizes = (sizes || []).filter((s) => Number(s.quantity) > 0);

  if (validSizes.length > 0) {
    const generated: PackagingBoxItem[] = [];
    let boxNum = 1;

    for (const item of validSizes) {
      const { model, sizeCode } = parseModelAndSize(item);
      let remaining = Number(item.quantity);

      while (remaining > 0) {
        const boxQty = Math.min(remaining, capacity);
        const boxCode = `BX-${cleanWo}-${String(boxNum).padStart(2, "0")}`;
        generated.push({
          id: `box-${Date.now()}-${boxNum}`,
          boxNumber: boxNum,
          boxCode,
          model: model || undefined,
          sizeCode: sizeCode || undefined,
          quantity: boxQty,
          packerName: defaultPacker,
          packedAt: now,
          barcode: `${cleanWo}-B${String(boxNum).padStart(2, "0")}`,
        });
        boxNum++;
        remaining -= boxQty;
      }
    }
    return generated;
  }

  // Non-size matrix (monotype / regular order)
  const total = Math.max(1, targetQuantity || 1);
  const boxCount = Math.ceil(total / capacity);
  const generated: PackagingBoxItem[] = [];

  for (let i = 1; i <= boxCount; i++) {
    const isLast = i === boxCount;
    const boxQty = isLast ? total - (boxCount - 1) * capacity : capacity;
    const boxCode = `BX-${cleanWo}-${String(i).padStart(2, "0")}`;
    generated.push({
      id: `box-${Date.now()}-${i}`,
      boxNumber: i,
      boxCode,
      quantity: Math.max(1, boxQty),
      packerName: defaultPacker,
      packedAt: now,
      barcode: `${cleanWo}-B${String(i).padStart(2, "0")}`,
    });
  }

  return generated;
}

export type ClientOrderFormData = WorkOrderFormData;

export interface MasterSpecification {
  id: string;
  code: string;
  name: string;
  department: WorkOrderDepartment;
  description: string;
  materialsCount: number;
  estimatedCost: string;
  unit: string;
}

export interface SiteOption {
  id: string;
  name: string;
  label: string;
  location: string;
  facilities: string;
  status: string;
}

export interface TechOption {
  id: WorkOrderDepartment | 'Post-press';
  name: string;
  code: string;
  description: string;
  badgeClass: string;
  equipmentCount: number;
}

export interface MachineOption {
  code: string;
  name: string;
  department: WorkOrderDepartment;
  speed: string;
  format: string;
  features: string;
  status: string;
  isAvailable: boolean;
}

export interface RouteStep {
  id: string;
  stepNumber: number;
  name: string;
  machine: string;
  operator: string;
  operators?: string[];
  countingMode?: "theoretical" | "counter" | "multipiece";
  multiplier?: number;
  duration: number;
  qtyCompleted: string;
  status: "Queued" | "In Progress" | "Paused" | "Finished";
  toolingId?: string;
  toolingName?: string;
  department?: string;
  tariffId?: string;
  tariffCode?: string;
  calcUnit?: string;
  unitDivisor?: number;
  rateUsd?: number;
  setupFeeUsd?: number;
  pieceworkRateUsd?: number;
  plannedCostUsd?: number;
  pieceworkTotalUsd?: number;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  actualDurationMinutes?: number;
  downtimeMinutes?: number;
  curingRequiredHours?: number;
  curingStartedAt?: string;
}

export interface ShiftEvent {
  id: string;
  opId: string;
  time: string;
  shift?: "1-smena" | "2-smena";
  batchLabel?: string;
  type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC" | "Waste";
  note: string;
  operator: string;
  inputQty?: number;
  makeReadyQty?: number;
  defectQty?: number;
  goodQty?: number;
  outputPiecesQty?: number;
  wasteQty?: number;
  wasteReason?: string;
  downtimeReason?: string;
  downtimeDurationMinutes?: number;
  palletCode?: string;
  palletNumber?: number;
  status?: "Draft" | "Confirmed" | "Inspected";
}

export interface DowntimeReasonOption {
  code: string;
  label: string;
  category: "mechanical" | "process" | "material" | "personnel";
  defaultDurationMinutes: number;
}

export const DOWNTIME_REASONS: DowntimeReasonOption[] = [
  { code: "MACHINE_BREAKDOWN", label: "Stanok nosozligi (Avariya)", category: "mechanical", defaultDurationMinutes: 45 },
  { code: "COLOR_WASH", label: "Kraska yuvish va almashtirish", category: "process", defaultDurationMinutes: 20 },
  { code: "PLATE_CHANGE", label: "Qolip almashtirish / Sozlash", category: "process", defaultDurationMinutes: 15 },
  { code: "DIE_ADJUSTMENT", label: "Shtamp / Pichoq moslash", category: "process", defaultDurationMinutes: 25 },
  { code: "PAPER_WAIT", label: "Qog'oz / Xomashyo kutish", category: "material", defaultDurationMinutes: 30 },
  { code: "DRYING_WAIT", label: "Oldingi bosqich qurishini kutish", category: "process", defaultDurationMinutes: 60 },
  { code: "PREVENTIVE_MAINTENANCE", label: "Profilaktika va moylash", category: "mechanical", defaultDurationMinutes: 20 },
  { code: "POWER_OUTAGE", label: "Elektr / Kompressor uzilishi", category: "mechanical", defaultDurationMinutes: 30 },
  { code: "SHIFT_CHANGEOVER", label: "Smena topshirish (Пересменка)", category: "personnel", defaultDurationMinutes: 15 },
  { code: "PLANNED_BREAK", label: "Rejali texnik tanaffus", category: "personnel", defaultDurationMinutes: 15 },
];

export interface OrderAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  isImage?: boolean;
  category?: "proofs" | "artwork" | "dieline" | "docs";
  storagePath?: string;
  uploadedBy?: string;
  /** Public or blob URL of the file contents (used for preview & download) */
  url?: string;
}

export interface ProductionMilestone {
  id: string;
  name: string;
  department: string;
  status: "Pending" | "In Progress" | "Done" | "Issue";
  assignedTo?: string;
  dueDate?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ShiftNote {
  id: string;
  author: string;
  shift: string;
  time: string;
  text: string;
}

export type HistoryEventCategory = "status" | "spec" | "material" | "planning" | "system";

export interface HistoryDiffItem {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
}

export interface WorkOrderHistoryEntry {
  id: string;
  timestamp: string;
  author: {
    name: string;
    role: string;
    initials?: string;
  };
  category: HistoryEventCategory;
  action: string;
  details?: string;
  diffs?: HistoryDiffItem[];
  badgeText?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
}

export interface SpotColorItem {
  id: string;
  name: string;
  code: string;
  hex: string;
  side: "front" | "back" | "both";
}

export interface SideColorConfig {
  c: boolean;
  m: boolean;
  y: boolean;
  k: boolean;
}

export type ProductShapeType = "rectangle" | "circle" | "oval" | "folded" | "carton_box" | "custom_die";
export type ProductFoldType = "half_vertical" | "half_horizontal" | "tri_c" | "tri_z" | "gate";
export type ProductBoxType = "tuck_end" | "snap_lock" | "auto_bottom" | "sleeve";
export type ProductCustomShape = "arch" | "star" | "hexagon" | "pillow" | "vector_svg";

export type ToolingCategory =
  | "ctp_plates"
  | "die_cutting"
  | "foil_cliche"
  | "emboss_cliche"
  | "varnish_plate"
  | "flexo_polymer";

export type ToolingStatus =
  | "Draft"
  | "Ordered"
  | "In_Production"
  | "Ready"
  | "Delivered"
  | "Mounted";

export interface WorkOrderToolingItem {
  id: string;
  category: ToolingCategory;
  name: string;
  specDetails: string;
  quantity: number;
  unit: string;
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
  purchaseOrderNo?: string;
  estimatedCost: number;
  actualCost?: number;
  currency: string;
  status: ToolingStatus;
  isRemake?: boolean;
  remakeReason?: string;
  faultParty?: "none" | "prepress" | "production" | "client" | "supplier";
  jobTicketPrinted?: boolean;
  notes?: string;
  createdAt: string;
}

export interface WorkOrderFormData {
  customer: string;
  product: string;
  department: WorkOrderDepartment;
  site: string;
  recipe: string;
  quantity: number;
  unit: string;
  status: string;
  priority: string;
  orderType?: string;
  responsible?: string;
  linkedWoId?: string;
  parentWorkOrderId?: string;
  isReorder?: boolean;
  linkedOrderId?: string;
  pressMachine: string;
  startDate: string;
  deadline: string;
  paperStock: string;
  coating: string;
  lamination?: string;
  laminationSides?: "1s" | "2s";
  laminationMicron?: number;
  embellishment?: string;
  priceTotal: number;
  currency: string;
  photoUrl: string;
  photoUrls?: string[];
  milestones: ProductionMilestone[];
  financials?: {
    plannedMaterialCost: number;
    actualMaterialCost: number;
    plannedMachineCost: number;
    actualMachineCost: number;
    wasteCost: number;
    margin: number;
  };
  // Physical Item Specifications from planned Client Order
  itemCategory?: string;
  width?: number;
  height?: number;
  dimensionUnit?: string;
  cornerType?: string;
  bleed?: number;
  shapeType?: ProductShapeType;
  foldType?: ProductFoldType;
  boxType?: ProductBoxType;
  boxDepth?: number;
  customShape?: ProductCustomShape;
  customSvgPath?: string;
  selectedToolingId?: string;
  selectedToolingName?: string;
  toolingProcurementNeeded?: boolean;
  toolingProcurementCost?: number;
  attachments?: OrderAttachment[];
  sizes?: SizeDistribution[];
  // Multi-Layer / Kashirovka (Duplex / Triplex Mounting)
  kashirovkaMode?: KashirovkaMode;
  kashirovkaStrategy?: KashirovkaImpositionStrategy;
  kashirovkaLayers?: SubstrateLayer[];
  kashirovkaGlueGsm?: number;
  kashirovkaMakeReadySheets?: number;
  kashirovkaCuringHours?: number;
  colorsConfig?: string;
  spotColors?: string[];
  spotColorItems?: SpotColorItem[];
  frontColors?: SideColorConfig;
  backColors?: SideColorConfig;
  artworkFront?: string;
  artworkBack?: string;
  artworkBleedIncluded?: boolean;
  artworkDielineOpacity?: number;
  artworkRotation?: number;
  holeSize?: number;
  holePosition?: "top-center" | "top-left" | "top-right" | "left-center" | "right-center" | "both-sides-fold" | "none";
  holeOffset?: number;
  printMethod?: "single_sided" | "sheetwise" | "work_and_turn" | "work_and_tumble" | "kashirovka";
  parentSheetW?: number;
  parentSheetH?: number;
  pressSheetW?: number;
  pressSheetH?: number;
  makeReadyPerPlate?: number;
  runWastePercent?: number;
  shiftNotes?: ShiftNote[];
  flexoMachineId?: string;
  flexoMaterialId?: string;
  flexoWebWidth?: number;
  flexoCylinderTeeth?: number;
  flexoPlateThickness?: number;
  flexoOrientation?: string;
  flexoGapX?: number;
  flexoGapY?: number;
  flexoColors?: number;
  // Textile & Flexo / Jacquard Ribbon Label Specifics
  labelFoldType?: "straight_cut" | "center_fold" | "end_fold" | "mitre_fold" | "manhattan_fold" | "roll";
  labelCutType?: "ultrasonic" | "hot_knife" | "cold_knife" | "laser";
  labelMaterialType?: string;
  labelEdgeType?: "woven_edge" | "hot_slit" | "ultrasonic_slit";
  labelWashResistance?: "40c" | "60c" | "90c_boil" | "dry_clean";
  labelSewingMarginMm?: number;
  labelPrintSides?: "1s" | "2s";
  // Jacquard Woven Specs
  weaveQuality?: "damask_50d" | "damask_100d" | "woven_satin" | "taffeta" | "hd_microfiber";
  weaveGroundColor?: string;
  weaveThreadCount?: number;
  hasLurexThread?: boolean;
  lurexColor?: "gold" | "silver" | "copper" | "none";
  sampleTargetSize?: string;
  sampleQty?: number;
  /** Per-SKU artwork files (front + back PDF/SVG). Key: SizeDistribution.id */
  skuArtworks?: SkuArtwork[];
  packagingData?: WorkOrderPackagingSummary;
  toolingItems?: WorkOrderToolingItem[];
  plannedSheets?: number;
  impositionState?: PersistedImpositionState;
}

export interface PersistedImpositionState {
  sheetW: number;
  sheetH: number;
  parentSheetW: number;
  parentSheetH: number;
  cutDivisor: number;
  orientation: "A" | "B";
  gap: number;
  gripper: number;
  gripperEdge: "Auto" | "Bottom" | "Top" | "Left" | "Right";
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  overproductionMode: "percent" | "exact";
  overproductionValue: number;
  ctpSideRelation: "single_sided" | "shared_front_variable_back" | "independent_per_plate" | "work_and_turn";
  optimizerGoal: "min_waste" | "min_plates";
  plates: {
    id: string;
    name: string;
    manualSlots: Record<string, number>;
    assignedSizeIds?: string[];
    customSheetRun?: number;
  }[];
  plateCalculations?: any[];
}

export const FLOOR_OPERATORS: string[] = [];

export const MOCK_CUSTOMERS: string[] = [];

export const MACHINE_MAP: Record<string, string[]> = {
  Offset: ["Heidelberg XL 106", "Komori Lithrone G40", "Heidelberg SX 74"],
  Flexo: ["Mark Andy Performance", "Nilpeter FA-Line", "Gallus ECS 340"],
  Jacquard: ["Staubli Jacquard Loom", "Muller Martini Loom", "Dornier PTV"],
  "Post-press": ["Meiguang Sheet Laminator", "Kolbus BF 513", "Bobst Novacut 106"]
};

export const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; stock: number }[]> = {};

export const RECIPE_ROUTES: Record<string, { name: string; machineStr: string }[]> = {
  "OFFSET_STD_V1": [
    { name: "Prepress va CTP qolip tayyorlash", machineStr: "Screen PlateRite 8600" },
    { name: "4+0 Ofset bosma", machineStr: "PRESS_MACHINE" },
    { name: "Tigel kesish", machineStr: "Bobst Novacut 106" }
  ],
  "OFFSET_KASHIROVKA_V1": [
    { name: "Prepress va CTP qolip tayyorlash", machineStr: "Screen PlateRite 8600" },
    { name: "4+0 Ofset bosma (Old va orqa qatlam)", machineStr: "PRESS_MACHINE" },
    { name: "1+0 Termo-laminatsiya", machineStr: "Autobond Mini 76" },
    { name: "Kashirovka (Dupleks yelimlash)", machineStr: "Meiguang Sheet Laminator" },
    { name: "Gidravlik pressda quritish (12 soat)", machineStr: "Gidravlik press" },
    { name: "Tigel kesish (600g+ karton)", machineStr: "Bobst Novacut 106" }
  ],
  "OFFSET_PREM_V2": [
    { name: "Prepress va CTP qolip tayyorlash", machineStr: "Screen PlateRite 8600" },
    { name: "4+4 Ofset bosma", machineStr: "PRESS_MACHINE" },
    { name: "Tanlangan UF-laklash", machineStr: "Steinemann Hibis 104" },
    { name: "Tigel kesish", machineStr: "Bobst Novacut 106" },
    { name: "Yelimlash va yig'ish", machineStr: "Bobst Visionfold" }
  ],
  "FLEXO_NYLON_V1": [
    { name: "Flekso-polimer qolip tayyorlash", machineStr: "Esko CDI Crystal" },
    { name: "Flekso bosma", machineStr: "PRESS_MACHINE" },
    { name: "Bo'ylama kesish va o'rash", machineStr: "Rotoflex Slitter" }
  ],
  "FLEXO_SATIN_V2": [
    { name: "Flekso-polimer qolip tayyorlash", machineStr: "Esko CDI Crystal" },
    { name: "Ko'p rangli flekso bosma", machineStr: "PRESS_MACHINE" },
    { name: "Issiq zarhal bosish", machineStr: "Pantec Rhino" },
    { name: "Bo'ylama kesish va o'rash", machineStr: "Rotoflex Slitter" }
  ],
  "JACQ_WOVEN_V1": [
    { name: "Asos ipini tayyorlash", machineStr: "Karl Mayer Warper" },
    { name: "Jakkard to'qish", machineStr: "PRESS_MACHINE" },
    { name: "Ultrasonik kesish va buklash", machineStr: "Focus Label Cut/Fold" }
  ],
  "JACQ_TAFFETA_V2": [
    { name: "Asos ipini tayyorlash", machineStr: "Karl Mayer Warper" },
    { name: "Yuqori zichlikdagi to'qish", machineStr: "PRESS_MACHINE" },
    { name: "Lazerli kesish va buklash", machineStr: "Focus Label Laser" }
  ],
  "POST_GENERIC_V1": [
    { name: "Buklash va yelimlash", machineStr: "Bobst Visionfold" },
    { name: "Qadoqlash va OTK", machineStr: "Qadoqlash liniyasi" }
  ]
};

export const MASTER_SPECIFICATIONS: MasterSpecification[] = [
  {
    id: "SPEC-OFF-01",
    code: "OFFSET_STD_V1",
    name: "Standart CMYK quti va poligrafiya",
    department: "Offset",
    description: "4 rangli ofset bosma va tigel kesish",
    materialsCount: 3,
    estimatedCost: "$5,250",
    unit: "pcs",
  },
  {
    id: "SPEC-OFF-KASH",
    code: "OFFSET_KASHIROVKA_V1",
    name: "Dupleks/Tripleks Kashirovka 600g+ qattiq karton",
    department: "Offset",
    description: "2×300g bo'rlangan karton 4+0 bosma, kashirovka va tigel kesish",
    materialsCount: 5,
    estimatedCost: "$2,480",
    unit: "pcs",
  },
  {
    id: "SPEC-OFF-02",
    code: "OFFSET_PREM_V2",
    name: "Premium UF-lakli buklet va quti",
    department: "Offset",
    description: "Ko'p rangli ofset, Soft-Touch laminatsiya va tanlangan UF-lak",
    materialsCount: 2,
    estimatedCost: "$3,800",
    unit: "pcs",
  },
  {
    id: "SPEC-FLX-01",
    code: "FLEXO_NYLON_V1",
    name: "Neylon taffeta yorliq",
    department: "Flexo",
    description: "Yuvishga chidamli neylon lenta 30mm, rulonli kesim",
    materialsCount: 2,
    estimatedCost: "$652",
    unit: "rolls",
  },
  {
    id: "SPEC-FLX-02",
    code: "FLEXO_SATIN_V2",
    name: "Premium satin lenta",
    department: "Flexo",
    description: "Satin 40mm lentada zarhal va qora flekso bosma",
    materialsCount: 2,
    estimatedCost: "$890",
    unit: "rolls",
  },
  {
    id: "SPEC-FLX-03",
    code: "FLEXO_TYVEK_V3",
    name: "Yirtilmas Tyvek yorliq",
    department: "Flexo",
    description: "DuPont Tyvek 1073D namga chidamli yorliq bosma",
    materialsCount: 2,
    estimatedCost: "$1,120",
    unit: "rolls",
  },
  {
    id: "SPEC-JCQ-01",
    code: "JACQ_WOVEN_V1",
    name: "Standart Damask to'qima yorliq",
    department: "Jacquard",
    description: "Qora/oq poliester damask to'qima, ultrasonik kesim",
    materialsCount: 2,
    estimatedCost: "$1,032",
    unit: "pcs",
  },
  {
    id: "SPEC-JCQ-02",
    code: "JACQ_TAFFETA_V2",
    name: "Yuqori zichlikdagi brend yorliq",
    department: "Jacquard",
    description: "Mikro-ip taffeta, lazerli kesim va buklama",
    materialsCount: 1,
    estimatedCost: "$1,450",
    unit: "pcs",
  },
  {
    id: "SPEC-PST-01",
    code: "POST_GENERIC_V1",
    name: "Standart tigel kesish va yelimlash",
    department: "Offset",
    description: "Avtomatik tigel kesish va quti yelimlash liniyasi",
    materialsCount: 2,
    estimatedCost: "$580",
    unit: "sets",
  },
];

export const SITE_OPTIONS: SiteOption[] = [
  {
    id: "Building 1",
    name: "1-bino (Bosh korpus)",
    label: "Asosiy bosma sexi",
    location: "Shimoliy hudud • 12,000 m²",
    facilities: "Ofset bosma, Post-press, CTP Prepress",
    status: "Faol",
  },
  {
    id: "Building 2",
    name: "2-bino (Flekso va Jakkard)",
    label: "Qadoqlash va flekso sexi",
    location: "Janubiy hudud • 6,500 m²",
    facilities: "Rulonli flekso, Jakkard dastgohlar, Pardozlash",
    status: "Faol",
  },
];

export const TECHNOLOGY_OPTIONS: TechOption[] = [
  {
    id: "Offset",
    name: "Ofset varaqali bosma",
    code: "TECH-OFF",
    description: "Yuqori tezlikdagi varaqali ofset, katalog va qutilar",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200",
    equipmentCount: 3,
  },
  {
    id: "Flexo",
    name: "Fleksografik rulonli bosma",
    code: "TECH-FLX",
    description: "Rulondan-rulonga etiketka va tekstil lentalar bosmasi",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    equipmentCount: 3,
  },
  {
    id: "Jacquard",
    name: "Jakkard to'quv dastgohlari",
    code: "TECH-JCQ",
    description: "Yuqori zichlikdagi damask, satin va taffeta to'qima yorliqlar",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200",
    equipmentCount: 3,
  },
  {
    id: "Post-press",
    name: "Post-press va yig'uv liniyalari",
    code: "TECH-PST",
    description: "Avtomatik tigel kesish, buklash, yelimlash va zarhal bosish",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    equipmentCount: 3,
  },
];

export const MACHINE_OPTIONS: MachineOption[] = [];

export const getInitialOperations = (
  recipeId: string,
  pressMachine: string,
  department: string,
  quantity: number = 0
): RouteStep[] => {
  const targetQty = Math.max(0, Number(quantity) || 0);
  const qtyLabel = `0 / ${targetQty.toLocaleString()}`;
  const route = RECIPE_ROUTES[recipeId];
  if (route) {
    return route.map((step, index) => ({
      id: `op-init-${index + 1}`,
      stepNumber: (index + 1) * 10,
      name: step.name,
      department,
      machine: step.machineStr === "PRESS_MACHINE" ? (pressMachine || "") : step.machineStr,
      operator: "",
      duration: [0.5, 2.0, 1.0, 1.5, 1.0][index % 5],
      qtyCompleted: qtyLabel,
      status: "Queued",
    }));
  }
  if (department === "Flexo") {
    return [
      { id: "op-init-1", stepNumber: 10, name: "Flekso-polimer qolip tayyorlash", department: "Flexo", machine: "Esko CDI Crystal", operator: "", duration: 0.5, qtyCompleted: qtyLabel, status: "Queued" },
      { id: "op-init-2", stepNumber: 20, name: "Rulonli flekso bosma", department: "Flexo", machine: pressMachine || "", operator: "", duration: 2.5, qtyCompleted: qtyLabel, status: "Queued" },
      { id: "op-init-3", stepNumber: 30, name: "Bo'ylama kesish va o'rash", department: "Flexo", machine: "Rotoflex Slitter", operator: "", duration: 1.0, qtyCompleted: qtyLabel, status: "Queued" },
    ];
  }
  if (department === "Jacquard") {
    return [
      { id: "op-init-1", stepNumber: 10, name: "Jakkard to'qish", department: "Jacquard", machine: pressMachine || "", operator: "", duration: 3.0, qtyCompleted: qtyLabel, status: "Queued" },
      { id: "op-init-2", stepNumber: 20, name: "Ultrasonik kesish va buklash", department: "Jacquard", machine: "Focus Label Cut/Fold", operator: "", duration: 1.5, qtyCompleted: qtyLabel, status: "Queued" },
    ];
  }
  return [
    { id: "op-init-1", stepNumber: 10, name: "Prepress va CTP qolip tayyorlash", department: "Offset", machine: "Screen PlateRite 8600", operator: "", duration: 0.5, qtyCompleted: qtyLabel, status: "Queued" },
    { id: "op-init-2", stepNumber: 20, name: "Ofset bosma", department: "Offset", machine: pressMachine || "", operator: "", duration: 2.0, qtyCompleted: qtyLabel, status: "Queued" },
    { id: "op-init-3", stepNumber: 30, name: "Tigel kesish", department: "Offset", machine: "Bobst Novacut 106", operator: "", duration: 1.2, qtyCompleted: qtyLabel, status: "Queued" },
  ];
};

export type ProductNameNamingPreset = "standard" | "compact" | "technical" | "clean";

/**
 * Generates an industrial-standard product description string based on ERP order parameters.
 * Formula: [Customer], [Item Category (Subtype)], [Dimensions], [Stock & Finishes] - [Optional Brand/Note]
 */
export function generateSuggestedProductName(
  formData: Partial<WorkOrderFormData>,
  preset: ProductNameNamingPreset = "standard",
  extraNote?: string
): string {
  const parts: string[] = [];

  // 1. Customer (for standard, compact, clean)
  const customer = formData.customer?.trim();
  if (customer && preset !== "technical") {
    parts.push(customer);
  }

  // 2. Product Category / Subtype
  let categoryLabel = "";
  const cat = formData.itemCategory;
  if (cat === "Hangtag") {
    categoryLabel = "Yorliq (Hangtag)";
  } else if (cat === "Carton") {
    const boxTypeNames: Record<string, string> = {
      auto_bottom: "Avto-tag",
      snap_lock: "Qulfli tub",
      tuck_end: "Tuck-end",
      sleeve: "Shuber",
    };
    const bType = formData.boxType && boxTypeNames[formData.boxType] ? ` (${boxTypeNames[formData.boxType]})` : "";
    categoryLabel = `Quti${bType}`;
  } else if (cat === "Label") {
    categoryLabel = "Etiketka";
  } else if (cat === "Card") {
    categoryLabel = "Vizitka / Karta";
  } else if (cat === "Flyer") {
    const foldNames: Record<string, string> = {
      half_vertical: "1 buklama",
      half_horizontal: "Gorizontal",
      tri_c: "C-buklama",
      tri_z: "Z-buklama",
      gate: "Darvoza",
    };
    const fType = formData.foldType && foldNames[formData.foldType] ? ` (${foldNames[formData.foldType]})` : "";
    categoryLabel = `Buklet${fType}`;
  } else if (cat === "Other") {
    categoryLabel = "Maxsus mahsulot";
  } else if (formData.department === "Jacquard") {
    categoryLabel = "To'qilgan yorliq";
  } else if (formData.department === "Flexo") {
    categoryLabel = "Rulonli etiketka";
  } else {
    categoryLabel = "Mahsulot";
  }

  parts.push(categoryLabel);

  // 3. Dimensions
  if (formData.width && formData.height) {
    const unit = formData.dimensionUnit || "mm";
    if (cat === "Carton" && formData.boxDepth) {
      parts.push(`${formData.width}×${formData.height}×${formData.boxDepth} ${unit}`);
    } else {
      parts.push(`${formData.width}×${formData.height} ${unit}`);
    }
  }

  // 4. Technical specifications (Materials, Colors, Finishing)
  if (preset === "standard" || preset === "technical") {
    const techDetails: string[] = [];

    // Paper Stock / Substrate
    if (formData.paperStock) {
      const gsmMatch = formData.paperStock.match(/(\d{2,4}\s*g(?:[\/m²]*))/i);
      if (gsmMatch) {
        techDetails.push(gsmMatch[1].replace(/\/m²/i, ""));
      } else {
        const words = formData.paperStock.split(" ").slice(0, 2).join(" ");
        techDetails.push(words);
      }
    }

    // Color notation e.g. "4+0"
    if (formData.colorsConfig) {
      const colorMatch = formData.colorsConfig.match(/^\d\+\d/);
      if (colorMatch) {
        techDetails.push(colorMatch[0]);
      }
    }

    // Coating / Lamination
    if (formData.lamination && formData.lamination !== "None" && formData.lamination !== "none") {
      const lamLower = formData.lamination.toLowerCase();
      if (lamLower.includes("soft-touch")) {
        techDetails.push("Soft-Touch");
      } else if (lamLower.includes("matte") || lamLower.includes("mat")) {
        techDetails.push("Mat lam");
      } else if (lamLower.includes("gloss") || lamLower.includes("yaltiroq")) {
        techDetails.push("Yaltiroq lam");
      }
    } else if (formData.coating && formData.coating !== "None" && formData.coating !== "none") {
      const coatLower = formData.coating.toLowerCase();
      if (coatLower.includes("uv")) {
        techDetails.push("UV lak");
      }
    }

    if (techDetails.length > 0) {
      parts.push(techDetails.join(" "));
    }
  }

  let finalName = parts.filter(Boolean).join(", ");

  if (extraNote?.trim()) {
    finalName += ` - "${extraNote.trim()}"`;
  }

  return finalName;
}

