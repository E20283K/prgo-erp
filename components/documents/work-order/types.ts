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
import type { FrozenCostRates } from "./utils/operationCost";
import type { ProductionQueueStage, ProductionReadinessChecks } from "@/store/workspaceStore";

export type KashirovkaMode = "none" | "duplex" | "triplex";
export type KashirovkaImpositionStrategy = "split_half_sheet" | "separate_sheets";

export interface SubstrateLayer {
  id: string;
  role: "top_liner" | "core_board" | "bottom_liner";
  label: string;
  paperStock: string;
  grammage: number;
  /** Print scheme "front+back", e.g. "5+0"; derived from the order colours by syncKashirovkaLayerColors. */
  colors: string;
  coating: string;
}

export const KASHIROVKA_LAYER_LABELS: Record<SubstrateLayer["role"], string> = {
  top_liner: "Old qatlam",
  core_board: "O'rta qatlam",
  bottom_liner: "Orqa qatlam",
};

const KASHIROVKA_DEFAULT_GLUE_GSM = 25;

export function resolveKashirovkaGlueGsm(glueGsm?: number): number {
  const value = Number(glueGsm);
  return Number.isFinite(value) && value > 0 ? value : KASHIROVKA_DEFAULT_GLUE_GSM;
}

/** Approximate caliper in microns per 1 g/m², by material family. */
function caliperFactorForStock(stock: string, grammage: number): number {
  const name = (stock || "").toLowerCase();
  if (/xrom|erzats|chip|grey|gray|kulrang|gofr|duplex board|triplex board/.test(name)) return 1.6;
  if (/ofset|offset|uncoated|bo'rsiz|bo‘rsiz|kraft/.test(name)) return 1.25;
  if (grammage > 0 && grammage < 200 && /bo'r|bo‘r|coated|mel|gloss|matt|silk/.test(name)) return 0.9;
  return 1.32;
}

export function parseGrammageFromStock(stock?: string, fallback = 300): number {
  if (!stock) return fallback;
  const match = stock.match(/(\d{2,4})\s*g/i);
  return match ? Number(match[1]) : fallback;
}

export function getDefaultKashirovkaLayers(
  mode: KashirovkaMode,
  baseStock = "",
  baseCoating = "",
  explicitBaseGsm?: number
): SubstrateLayer[] {
  if (mode === "none") return [];
  const stock = baseStock || "";
  const baseGsm =
    explicitBaseGsm && explicitBaseGsm > 0 ? explicitBaseGsm : parseGrammageFromStock(stock, 0);
  const topLayer: SubstrateLayer = {
    id: "layer-top",
    role: "top_liner",
    label: KASHIROVKA_LAYER_LABELS.top_liner,
    paperStock: stock,
    grammage: baseGsm,
    colors: "4+0",
    coating: baseCoating || "",
  };
  const bottomLayer: SubstrateLayer = {
    id: "layer-bottom",
    role: "bottom_liner",
    label: KASHIROVKA_LAYER_LABELS.bottom_liner,
    paperStock: stock,
    grammage: baseGsm,
    colors: "4+0",
    coating: "",
  };
  if (mode === "triplex") {
    const coreLayer: SubstrateLayer = {
      id: "layer-core",
      role: "core_board",
      label: KASHIROVKA_LAYER_LABELS.core_board,
      paperStock: stock,
      grammage: baseGsm,
      colors: "0+0",
      coating: "",
    };
    return [topLayer, coreLayer, bottomLayer];
  }
  return [topLayer, bottomLayer];
}

/**
 * Rebuilds the layer list for a mode while keeping what the user already set
 * per role (colors, coating, a layer-specific paper). Layers that still follow
 * the previous base stock are moved to the new base stock.
 */
export function rebuildKashirovkaLayers(
  mode: KashirovkaMode,
  previousLayers: SubstrateLayer[] | undefined,
  baseStock: string,
  baseCoating: string,
  baseGsm: number | undefined,
  previousBaseStock?: string
): SubstrateLayer[] {
  const defaults = getDefaultKashirovkaLayers(mode, baseStock, baseCoating, baseGsm);
  const previous = previousLayers || [];
  if (previous.length === 0) return defaults;
  const prevBase = (previousBaseStock || "").trim().toLowerCase();
  return defaults.map((def) => {
    const existing = previous.find((l) => l.role === def.role);
    if (!existing) return def;
    const existingStock = (existing.paperStock || "").trim().toLowerCase();
    const followsBase = !existingStock || existingStock === prevBase;
    return {
      ...existing,
      id: def.id,
      label: def.label,
      paperStock: followsBase ? def.paperStock : existing.paperStock,
      grammage: followsBase ? def.grammage : existing.grammage,
    };
  });
}

/** Inks in a layer's print scheme: "4+0" → 4, "5+0" → 5, "4+4" → 8, "0+0" → 0. */
export function kashirovkaLayerInks(colors?: string): number {
  if (!colors) return 0;
  return colors
    .split("+")
    .reduce((sum, part) => sum + (Number.parseInt(part, 10) || 0), 0);
}

/**
 * CTP plates per plate set for a kashirovka order, from the layers' print schemes.
 * 1-CTP (half sheet): the liners share one plate set, so it needs as many plates
 * as the most colourful liner. 2-CTP (separate sheets): each liner has its own set.
 * Returns null when the order is not kashirovka, so callers keep their own count.
 */
export function kashirovkaPlatesPerForm(
  mode: KashirovkaMode | undefined,
  layers: SubstrateLayer[] | undefined,
  strategy: KashirovkaImpositionStrategy | undefined
): number | null {
  if (!mode || mode === "none" || !layers || layers.length === 0) return null;
  const inks = layers
    .filter((l) => l.role !== "core_board")
    .map((l) => kashirovkaLayerInks(l.colors))
    .filter((n) => n > 0);
  if (inks.length === 0) return 0;
  return (strategy || "split_half_sheet") === "separate_sheets"
    ? inks.reduce((sum, n) => sum + n, 0)
    : Math.max(...inks);
}

/** Inks on one side of the order: ticked CMYK channels plus Pantone colours on that side. */
function orderSideInks(
  side: "front" | "back",
  process: { c: boolean; m: boolean; y: boolean; k: boolean } | undefined,
  spots: { side: "front" | "back" | "both" }[] | undefined
): number {
  const proc = process ? [process.c, process.m, process.y, process.k].filter(Boolean).length : 0;
  const spot = (spots || []).filter((s) => s.side === side || s.side === "both").length;
  return proc + spot;
}

/**
 * Sets each layer's print scheme from the order colours: the face liner carries the
 * order's front, the back liner its reverse, and the core board is never printed.
 * Orders that only carry the "4+0" colorsConfig string (no ticked channels) fall back to it.
 * Returns the same array when nothing changes, so callers can skip a state update.
 */
export function syncKashirovkaLayerColors(
  layers: SubstrateLayer[] | undefined,
  frontColors: { c: boolean; m: boolean; y: boolean; k: boolean } | undefined,
  backColors: { c: boolean; m: boolean; y: boolean; k: boolean } | undefined,
  spotColors: { side: "front" | "back" | "both" }[] | undefined,
  colorsConfig?: string
): SubstrateLayer[] {
  if (!layers || layers.length === 0) return layers || [];
  let frontInks = orderSideInks("front", frontColors, spotColors);
  let backInks = orderSideInks("back", backColors, spotColors);
  const legacy = (colorsConfig || "").match(/^\s*(\d+)\s*\+\s*(\d+)\s*$/);
  if (frontInks + backInks === 0 && legacy) {
    frontInks = Number(legacy[1]);
    backInks = Number(legacy[2]);
  }
  const front = `${frontInks}+0`;
  const back = `${backInks}+0`;
  let changed = false;
  const next = layers.map((l) => {
    const colors = l.role === "top_liner" ? front : l.role === "bottom_liner" ? back : "0+0";
    if (l.colors === colors) return l;
    changed = true;
    return { ...l, colors };
  });
  return changed ? next : layers;
}

/** Returns the form with its kashirovka layer colours derived from the order colours. */
export function withSyncedKashirovkaColors<
  T extends {
    kashirovkaLayers?: SubstrateLayer[];
    frontColors?: { c: boolean; m: boolean; y: boolean; k: boolean };
    backColors?: { c: boolean; m: boolean; y: boolean; k: boolean };
    spotColorItems?: { side: "front" | "back" | "both" }[];
    colorsConfig?: string;
  },
>(form: T): T {
  const layers = syncKashirovkaLayerColors(
    form.kashirovkaLayers,
    form.frontColors,
    form.backColors,
    form.spotColorItems,
    form.colorsConfig
  );
  return layers === form.kashirovkaLayers ? form : { ...form, kashirovkaLayers: layers };
}

export function calculateKashirovkaTotals(
  mode: KashirovkaMode = "none",
  layers: SubstrateLayer[] = [],
  glueGsmPerBond: number = KASHIROVKA_DEFAULT_GLUE_GSM
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
  const totalGlueGsm = glueBonds * resolveKashirovkaGlueGsm(glueGsmPerBond);
  const totalMountedGsm = netPaperGsm + totalGlueGsm;
  // Paper caliper depends on the material family; a dried glue film is ~1 µm per g/m².
  const paperCaliperUm = layers.reduce((sum, l) => {
    const gsm = Number(l.grammage) || 0;
    return sum + gsm * caliperFactorForStock(l.paperStock, gsm);
  }, 0);
  const estimatedCaliperMm = Number(((paperCaliperUm + totalGlueGsm) / 1000).toFixed(2));
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
  /** Warehouse paper the sample is printed on (often the mass-run paper, sometimes a test stock). */
  paperStock?: string;
  /** Sheets issued for the sample run, make-ready included. */
  paperSheets?: number;
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
  /** Moment the mass run was released: journal entries up to it belong to the sample run. */
  releasedAt?: string;
  /** The sample run of each step (hours, good output), kept at release for the sample cost. */
  runSteps?: RouteStep[];

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
  width?: number;
  height?: number;
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
  width?: number;
  height?: number;
  quantity: number;
  grossWeightKg?: number;
  packerName: string;
  packedAt: string;
  barcode: string;
  notes?: string;
  batchId?: string;
  batchNo?: number;
  shipmentId?: string;
  /** ready = packed in the shop; handed = given to the FG warehouse; in_stock = received there; dispatched = shipped. */
  status?: "ready" | "handed" | "in_stock" | "dispatched";
  handedOverAt?: string;
  receivedAt?: string;
  unitWeightGrams?: number;
  isWeighed?: boolean;
  countDeviation?: number;
}

export interface WorkOrderPackagingSummary {
  standardBoxCapacity: number;
  boxType: string;
  totalBoxes: number;
  totalPackedQty: number;
  targetQty: number;
  isCompleted: boolean;
  completedAt?: string;
  unitWeightGrams?: number;
  calibrationMethod?: "theoretical" | "scale_sample";
  samplePcs?: number;
  sampleWeightGrams?: number;
  /** Quti (tara) og'irligi, kg: tarozi ko'rsatkichidan ayiriladi */
  tareKg?: number;
  /** Mahsulot ishlab chiqarish jurnalisiz, oldindan tayyor bo'lgan (eski zaxira) */
  preProduced?: boolean;
  boxes: PackagingBoxItem[];
}

export function autoGeneratePackagingBoxes(params: {
  workOrderNo: string;
  targetQuantity: number;
  standardCapacity: number;
  sizes?: SizeDistribution[];
  defaultPacker?: string;
}): PackagingBoxItem[] {
  const { workOrderNo, targetQuantity, standardCapacity, sizes, defaultPacker = "" } = params;
  const capacity = Math.max(1, standardCapacity || 500);
  const now = new Date().toISOString();
  const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");

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

// ─── Partial Shipments & Delivery Batches (Bo'lib jo'natish jadvali) ─────────

export type DeliveryBatchStatus = "scheduled" | "in_production" | "ready" | "dispatched" | "delivered";

export interface DeliveryBatchSizeItem {
  sizeId: string;
  sizeName: string;
  quantity: number;
}

export interface WorkOrderDeliveryBatch {
  id: string;
  batchNo: number; // 1, 2, 3...
  title: string; // Masalan: "Partiya #1"
  targetDate: string; // YYYY-MM-DD
  quantity: number;
  status: DeliveryBatchStatus;
  sizeItems?: DeliveryBatchSizeItem[];
  destination?: string;
  notes?: string;
  linkedShipmentId?: string;
  linkedShipmentNo?: string;
  linkedDeliveryActId?: string;
  linkedDeliveryActNo?: string;
  dispatchedAt?: string;
  dispatchedQty?: number;
  boxIds?: string[];
  packedQty?: number;
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
  /** Registry id of the machine; `machine` keeps the display name (and free-text names). */
  machineId?: string;
  operator: string;
  operators?: string[];
  /** auto = computed from machine + operators; outsourced / manual = `manualCostUsd`. */
  costMode?: "auto" | "outsourced" | "manual";
  manualCostUsd?: number;
  /** Supplier name for outsourced steps, or the reason for a manual cost. */
  costNote?: string;
  countingMode?: "theoretical" | "counter" | "multipiece";
  multiplier?: number;
  duration: number;
  qtyCompleted: string;
  status: "Queued" | "In Progress" | "Paused" | "Finished";
  /** While "In Progress": make-ready or the production run (derived from the shift journal). */
  phase?: "setup" | "run";
  toolingId?: string;
  toolingName?: string;
  department?: string;
  tariffId?: string;
  tariffCode?: string;
  /** Work type from the work-rate list; drives the piecework fund. */
  workRateId?: string;
  calcUnit?: string;
  unitDivisor?: number;
  rateUsd?: number;
  setupFeeUsd?: number;
  pieceworkRateUsd?: number;
  plannedCostUsd?: number;
  pieceworkTotalUsd?: number;
  /** Machine rates frozen when the step was first saved with its machine. */
  costRates?: FrozenCostRates | null;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  actualDurationMinutes?: number;
  downtimeMinutes?: number;
  curingRequiredHours?: number;
  curingStartedAt?: string;
  kind?: RouteStepKind;
}

export type RouteStepKind = "prepress" | "print" | "finishing" | "packaging";

const PACKAGING_STEP_NAME_RE = /qadoq|upakov|pack/i;

/**
 * Guarantees the route ends with exactly one typed packaging step.
 * Legacy steps are migrated by name once; returns the same array when nothing changes.
 */
export function ensurePackagingStep(ops: RouteStep[], quantity = 0): RouteStep[] {
  if (!ops || ops.length === 0) return ops;

  let packIdx = -1;
  for (let i = ops.length - 1; i >= 0; i--) {
    if (ops[i].kind === "packaging") {
      packIdx = i;
      break;
    }
  }
  if (packIdx === ops.length - 1) return ops;

  let next = [...ops];
  if (packIdx === -1) {
    let legacyIdx = -1;
    for (let i = next.length - 1; i >= 0; i--) {
      if (PACKAGING_STEP_NAME_RE.test(next[i].name || "")) {
        legacyIdx = i;
        break;
      }
    }
    if (legacyIdx >= 0) {
      const [legacy] = next.splice(legacyIdx, 1);
      next.push({ ...legacy, kind: "packaging" });
    } else {
      next.push({
        id: `op-pack-${Date.now()}`,
        stepNumber: 0,
        name: "Qadoqlash",
        machine: "Manual",
        operator: "",
        duration: 1,
        qtyCompleted: `0 / ${Math.max(0, Number(quantity) || 0).toLocaleString()}`,
        status: "Queued",
        kind: "packaging",
      });
    }
  } else {
    const [pack] = next.splice(packIdx, 1);
    next.push(pack);
  }

  next = next.map((op, idx) => ({ ...op, stepNumber: (idx + 1) * 10 }));
  return next;
}

export type QtySource = "counter" | "counted" | "estimated" | "derived";

export interface ShiftEvent {
  id: string;
  opId: string;
  /** "HH:MM" label on the plant clock; the full moment is occurredAt. */
  time: string;
  /** ISO date-time the event happened (set by the server when not given). */
  occurredAt?: string;
  shift?: "1-smena" | "2-smena" | "3-smena";
  createdBy?: string;
  updatedBy?: string;
  batchLabel?: string;
  /**
   * Run = output report, Delay/Maintenance = downtime (open while it has no duration),
   * SetupStart/RunStart/Finish = step transitions, Correction = a manager's status fix (toStatus, reason in note).
   */
  type:
    | "Setup"
    | "Run"
    | "Delay"
    | "Maintenance"
    | "QC"
    | "Waste"
    | "SetupStart"
    | "RunStart"
    | "Finish"
    | "Correction";
  /** Correction: the status the step was set to. */
  toStatus?: RouteStep["status"];
  note: string;
  operator: string;
  /** Shared kiosk: signed proof of the operator who identified with a PIN or badge (write-only). */
  operatorToken?: string;
  inputQty?: number;
  /** Where the quantities come from; "estimated" and "derived" are not counted facts. */
  qtySource?: QtySource;
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
  note?: string;
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

export type ToolingDeliveryMethod = "included" | "supplier" | "pickup";

export type ToolingStatus =
  | "Draft"
  | "Ordered"
  | "In_Production"
  | "Ready"
  | "Delivered"
  | "Mounted";

/** Which print side a plate set is for; "set" is one set for both sides (work-and-turn) or a single kit. */
export type ToolingSide = "front" | "back" | "set";

export interface WorkOrderToolingItem {
  id: string;
  category: ToolingCategory;
  side?: ToolingSide;
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
  /** How the item reaches us: supplier ships it, delivery is in the price, or we pick it up */
  deliveryMethod?: ToolingDeliveryMethod;
  /** Delivery / pickup cost in the item's currency; part of the tooling landed cost */
  deliveryCost?: number;
  currency: string;
  status: ToolingStatus;
  isRemake?: boolean;
  remakeReason?: string;
  faultParty?: "none" | "prepress" | "production" | "client" | "supplier";
  phase?: "sample" | "production";
  jobTicketPrinted?: boolean;
  location?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  notes?: string;
  createdAt: string;
}

/** Qo'shimcha chop etish: asl buyurtma kamomadi, kimning aybi bilan va nima sababdan. */
export interface WorkOrderReprintInfo {
  faultParty: "production" | "prepress" | "supplier" | "client";
  reason: string;
  /** Asl buyurtma tiraji */
  parentOrderedQty: number;
  /** Asl buyurtmada chiqqan yaroqli mahsulot */
  parentProducedQty: number;
}

export interface WorkOrderFormData {
  customer: string;
  product: string;
  /** Buxgalteriya uchun mahsulot turi, masalan "Satin etiketka". */
  productType?: string;
  department: WorkOrderDepartment;
  site: string;
  recipe: string;
  quantity: number;
  unit: string;
  status: string;
  stage?: ProductionQueueStage | string;
  checks?: ProductionReadinessChecks;
  priority: string;
  orderType?: string;
  responsible?: string;
  linkedWoId?: string;
  parentWorkOrderId?: string;
  isReorder?: boolean;
  /** Qo'shimcha chop etish (orderType "Reprint") tafsilotlari */
  reprint?: WorkOrderReprintInfo;
  /** Shu buyurtma kamomadi uchun ochilgan qo'shimcha buyurtmalar */
  reprintDocNos?: string[];
  notes?: string;
  linkedOrderId?: string;
  pressMachine: string;
  orderDate?: string;
  startDate: string;
  deadline: string;
  actualEndDate?: string;
  paperStock: string;
  paperDensity?: number;
  targetGsm?: number;
  targetPaperType?: string;
  grammage?: number;
  coating: string;
  coatingZone?: string;
  coatingStockSku?: string;
  coatingStockName?: string;
  lamination?: string;
  laminationSides?: "1s" | "2s";
  laminationMicron?: number;
  laminationStockSku?: string;
  laminationStockName?: string;
  embellishment?: string;
  embellishmentZone?: string;
  embellishmentStockSku?: string;
  embellishmentStockName?: string;
  priceTotal: number;
  currency: string;
  exchangeRate?: number;
  photoUrl: string;
  photoUrls?: string[];
  milestones: ProductionMilestone[];
  financials?: {
    plannedMaterialCost: number;
    actualMaterialCost: number;
    plannedMachineCost: number;
    actualMachineCost: number;
    toolingCost?: number;
    laborCost?: number;
    baseCost?: number;
    wasteCost: number;
    margin: number;
    unitBaseCost?: number;
    totalBaseCost?: number;
    overheadPercent?: number;
    overheadCost?: number;
    packagingCost?: number;
    sampleCost?: number;
    defectCost?: number;
    rechargeToClient?: number;
    supplierClaim?: number;
    costBasisQty?: number;
    /** "manual": the hand-entered manualTotalCost replaces the computed cost. Missing = "auto". */
    costMode?: "auto" | "manual";
    /** Hand-entered cost of the whole run, in the order currency. */
    manualTotalCost?: number;
    /** Computed cost at save time, kept for comparison when the manual cost is in use. */
    autoTotalCost?: number;
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
  /** Warehouse glue for kashirovka; the BOM glue row exists only when this is set. */
  kashirovkaGlueStockSku?: string;
  kashirovkaGlueStockName?: string;
  /** Auto BOM rows (BomItem.autoSource) the user deleted; the spec sync does not re-add them. */
  bomDismissedAutoSources?: string[];
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
  termoCornerRadius?: number;
  termoDieSource?: "size" | "file";
  termoDieMarginMm?: number;
  termoDieRows?: number;
  flexoLanes?: number;
  flexoRollsCount?: number;
  flexoLabelsPerRoll?: number;
  flexoCoreDiameter?: number;
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
  contractNo?: string;
  customerTin?: string;
  clientId?: string;
  impositionState?: PersistedImpositionState;
  flexoImpositionState?: PersistedFlexoImpositionState;
  /** Single source of the die-cut contour (noj), shared by Specifications and Imposition */
  dieline?: OrderDieline;
  deliveryBatches?: WorkOrderDeliveryBatch[];
  materialsReserved?: boolean;
  materialsReservedAt?: string;
  materialsConsumed?: boolean;
  materialsConsumedAt?: string;
  materialIssueDocNo?: string;
}

/**
 * Where the order's die-cut contour (noj) comes from.
 * - spec: generated from the Specifications shape fields (utils/dielineGeometry.ts)
 * - file: a PDF/SVG uploaded to the order or attached to a die-cutting tooling item
 * - none: guillotine job, no die
 */
export interface OrderDieline {
  source: "spec" | "file" | "none";
  fileUrl?: string;
  fileName?: string;
  origin?: "upload" | "tooling" | "attachment";
}

/**
 * Sheet-fed imposition settings saved on the work order (dimensions.impositionState).
 * Produced by the layout tab backed by doc-service /sheet-imposition. Older saved
 * shapes (no `version`) are ignored on load.
 */
export interface PersistedImpositionState {
  version: 2;
  paperName?: string;
  /** Specification paper the layout last synced to; a different spec value re-picks the paper. */
  specPaperStock?: string;
  parentSheetW: number;
  parentSheetH: number;
  cutDivisor: number;
  sheetW: number;
  sheetH: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  /** Gripper (klapan) on the bottom edge; undefined = on (older saved layouts) */
  gripper?: boolean;
  alignment: "center" | "gripper";
  trimW: number;
  trimH: number;
  bleed: number;
  innerBleed: number;
  outerBleed: number;
  gutterX: number;
  gutterY: number;
  cropGap: number;
  /** Crop mark stroke, mm; undefined = 0.12 */
  cropLineWidth?: number;
  rotation: "auto" | 0 | 90;
  manualCols?: number;
  manualRows?: number;
  mode: "single_sided" | "sheetwise" | "work_and_turn";
  strategy: "smart_no_split" | "max_economy_split" | "single_form" | "manual";
  maxOverprintPct: number;
  /** Extra run on top of each variant's order quantity, % (10 000 + 5% = 10 500) */
  allowancePct?: number;
  fillDirection: "col" | "row";
  wasteSheets: number;
  /** Manual slot counts keyed by variant key (SizeDistribution.id or "main") */
  manualSlots: Record<string, number>;
  category: "guillotine" | "diecut";
  cutStyle: "single" | "double";
  templateStyle: "standard" | "compact" | "packaging" | "offset_standard" | "digital_compact";
  exportSeparate: boolean;
  jobId?: string;
  pdfUrl?: string;
  /** First page preview (PNG) of the generated montaj, doc-service cache URL */
  previewUrl?: string;
  generatedAt?: string;
  /** Permanent storage copies made when the montaj was applied to the order */
  storedPdfUrl?: string;
  storedPreviewUrl?: string;
  summary?: {
    forms: number;
    itemsPerSheet: number;
    pressSheets: number;
    parentSheets: number;
    ctpPlates: number;
  };
}

/**
 * Flexo cylinder imposition settings saved on the work order (dimensions.flexoImpositionState).
 * Keeps the Flexo tab's inputs across tab switches and saves.
 */
export interface PersistedFlexoImpositionState {
  version: 1;
  /** Attachment id or "ALL_ATTACHMENTS" the designs were analyzed from */
  sourceAttachmentId?: string;
  /** design item_key -> gear teeth */
  gearOverrides: Record<string, number>;
  /** design item_key -> copies around the cylinder */
  copiesOverrides: Record<string, number>;
  removeOuterBorder: boolean;
  separateColors: boolean;
  colorOutputMode: "side_by_side" | "separate_files";
  combineSameGear: boolean;
  columnGapMm: number;
  maxCylinderWidthMm: number;
  regmarkEnabled: boolean;
  regmarkStrokeMm: number;
  regmarkTickMm: number;
  regmarkWidthMm: number;
  orderQty: number;
  allowancePercent: number;
}

export const FLOOR_OPERATORS: string[] = [];

export const MOCK_CUSTOMERS: string[] = [];

export const MACHINE_MAP: Record<string, string[]> = {
  Offset: ["Heidelberg XL 106", "Komori Lithrone G40", "Heidelberg SX 74"],
  Flexo: ["Mark Andy Performance", "Nilpeter FA-Line", "Gallus ECS 340"],
  Jacquard: ["Staubli Jacquard Loom", "Muller Martini Loom", "Dornier PTV"],
  "Post-press": ["Meiguang Sheet Laminator", "Kolbus BF 513", "Bobst Novacut 106"],
  Termo: ["Yassi pichoqli kesish stanogi"]
};

export const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; stock: number }[]> = {};

export const RECIPE_ROUTES: Record<string, { name: string; machineStr: string }[]> = {
  "TERMO_ROLL_CUT_V1": [
    { name: "Jumbo rulonni ombordan berish", machineStr: "Ombor" },
    { name: "Yassi pichoq bilan kesish", machineStr: "PRESS_MACHINE" },
    { name: "Rulonlarga o'rash", machineStr: "PRESS_MACHINE" },
    { name: "OTK va qadoqlash", machineStr: "Qadoqlash liniyasi" }
  ],
  "OFFSET_STD_V1": [
    { name: "4+0 Ofset bosma", machineStr: "PRESS_MACHINE" },
    { name: "Tigel kesish", machineStr: "Bobst Novacut 106" }
  ],
  "OFFSET_KASHIROVKA_V1": [
    { name: "4+0 Ofset bosma (Old va orqa qatlam)", machineStr: "PRESS_MACHINE" },
    { name: "1+0 Termo-laminatsiya", machineStr: "Autobond Mini 76" },
    { name: "Kashirovka (Dupleks yelimlash)", machineStr: "Meiguang Sheet Laminator" },
    { name: "Gidravlik pressda quritish (12 soat)", machineStr: "Gidravlik press" },
    { name: "Tigel kesish (600g+ karton)", machineStr: "Bobst Novacut 106" }
  ],
  "OFFSET_PREM_V2": [
    { name: "4+4 Ofset bosma", machineStr: "PRESS_MACHINE" },
    { name: "Tanlangan UF-laklash", machineStr: "Steinemann Hibis 104" },
    { name: "Tigel kesish", machineStr: "Bobst Novacut 106" },
    { name: "Yelimlash va yig'ish", machineStr: "Bobst Visionfold" }
  ],
  "FLEXO_NYLON_V1": [
    { name: "Flekso bosma", machineStr: "PRESS_MACHINE" },
    { name: "Bo'ylama kesish va o'rash", machineStr: "Rotoflex Slitter" }
  ],
  "FLEXO_SATIN_V2": [
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
    equipmentCount: 0,
  },
  {
    id: "Flexo",
    name: "Fleksografik rulonli bosma",
    code: "TECH-FLX",
    description: "Rulondan-rulonga etiketka va tekstil lentalar bosmasi",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    equipmentCount: 0,
  },
  {
    id: "Jacquard",
    name: "Jakkard to'quv dastgohlari",
    code: "TECH-JCQ",
    description: "Yuqori zichlikdagi damask, satin va taffeta to'qima yorliqlar",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200",
    equipmentCount: 0,
  },
  {
    id: "Termo",
    name: "Termo stiker kesish",
    code: "TECH-TRM",
    description: "Termo rulonni yassi pichoq bilan kesish va qayta o'rash",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200",
    equipmentCount: 0,
  },
  {
    id: "Post-press",
    name: "Post-press va yig'uv liniyalari",
    code: "TECH-PST",
    description: "Avtomatik tigel kesish, buklash, yelimlash va zarhal bosish",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    equipmentCount: 0,
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
  const route = RECIPE_ROUTES[recipeId] || (department === "Termo" ? RECIPE_ROUTES["TERMO_ROLL_CUT_V1"] : undefined);
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
  return [];
};

/**
 * Product name presets:
 * - standard: full nomenclature name, "Hangtag 50×90 mm, Mel 350 g, 4+4 +1 Pantone, mat lam., zarhal"
 * - compact:  type and size only, "Hangtag 50×90 mm"
 * - client:   customer in front, for lists without a customer column, "KGAWL — Hangtag 50×90 mm"
 * - code:     SKU-like article, "HT-50x90-350G-4/4"
 * The customer stays out of the standard name: the order already carries it.
 */
export type ProductNameNamingPreset = "standard" | "compact" | "client" | "code";

const CATEGORY_NAMES: Record<string, string> = {
  Hangtag: "Hangtag",
  Label: "Etiketka",
  Card: "Karta",
  Carton: "Quti",
  Flyer: "Buklet",
};

const CATEGORY_CODES: Record<string, string> = {
  Hangtag: "HT",
  Label: "ET",
  Card: "KR",
  Carton: "QT",
  Flyer: "BK",
};

const DEPARTMENT_NAMES: Record<string, string> = {
  Offset: "Ofset mahsulot",
  Flexo: "Etiketka",
  Jacquard: "To'qima yorliq",
  Termo: "Termo etiketka",
};

const DEPARTMENT_CODES: Record<string, string> = {
  Offset: "OF",
  Flexo: "ET",
  Jacquard: "TY",
  Termo: "TE",
};

const BOX_TYPE_NAMES: Record<string, string> = {
  auto_bottom: "avtotub",
  snap_lock: "qulfli tub",
  tuck_end: "tuck-end",
  sleeve: "shuber",
};

const FOLD_NAMES: Record<string, string> = {
  half_vertical: "1 buklama",
  half_horizontal: "1 buklama",
  tri_c: "C-buklama",
  tri_z: "Z-buklama",
  tri_fold: "Z-buklama",
  gate: "darvoza",
  gate_fold: "darvoza",
};

const WEAVE_NAMES: Record<string, string> = {
  damask_50d: "damask 50D",
  damask_100d: "damask 100D",
  woven_satin: "satin",
  taffeta: "taffeta",
  hd_microfiber: "HD mikrofibra",
};

const LABEL_FOLD_NAMES: Record<string, string> = {
  center_fold: "markaziy buklama",
  end_fold: "uchlari buklangan",
  mitre_fold: "burchakli buklama",
  manhattan_fold: "manhattan buklama",
  roll: "rulonda",
};

const LUREX_NAMES: Record<string, string> = {
  gold: "oltin lyureks",
  silver: "kumush lyureks",
  copper: "mis lyureks",
};

const isSet = (v?: string | null) => {
  const s = v?.trim();
  return !!s && !/^(none|no|yo'q|-)$/i.test(s);
};

const num = (n: number) => String(Math.round(n * 100) / 100);

/** "Hangtag" + its subtype: box type, fold, weave quality or textile fold */
function buildTypeLabel(f: Partial<WorkOrderFormData>): string {
  const cat = f.itemCategory || "";
  const base = f.productType?.trim() || CATEGORY_NAMES[cat] || DEPARTMENT_NAMES[f.department || ""] || "Mahsulot";
  const variant: string[] = [];
  if (cat === "Carton" && f.boxType) variant.push(BOX_TYPE_NAMES[f.boxType] || "");
  if (cat === "Flyer" && f.foldType) variant.push(FOLD_NAMES[f.foldType] || "");
  if (f.department === "Jacquard" && f.weaveQuality) variant.push(WEAVE_NAMES[f.weaveQuality] || "");
  if ((f.department === "Jacquard" || f.department === "Flexo") && f.labelFoldType) {
    variant.push(LABEL_FOLD_NAMES[f.labelFoldType] || "");
  }
  const lowerBase = base.toLowerCase();
  const extra = variant.filter((v) => v && !lowerBase.includes(v.toLowerCase()));
  return [base, ...extra].join(" ");
}

function buildSize(f: Partial<WorkOrderFormData>, sep = "×", withUnit = true): string {
  const w = Number(f.width) || 0;
  const h = Number(f.height) || 0;
  if (!w || !h) return "";
  const dims = [w, h];
  const d = Number(f.boxDepth) || 0;
  if (f.itemCategory === "Carton" && d) dims.push(d);
  const unit = f.dimensionUnit || "mm";
  return dims.map(num).join(sep) + (withUnit ? ` ${unit}` : "");
}

function extractGsm(f: Partial<WorkOrderFormData>): number {
  const fromStock = f.paperStock?.match(/(\d{2,4})\s*(?:gsm|gr|g\/m²|g\/m2|g|г)(?![a-z])/i);
  if (fromStock) return Number(fromStock[1]);
  return Number(f.grammage || f.targetGsm || f.paperDensity) || 0;
}

/** "SSS 200gsm" -> "SSS 200 g"; "BOPP oq yopishqoq etiketka materiali 100 mm" -> "BOPP oq" */
function buildMaterial(f: Partial<WorkOrderFormData>): string {
  const gsm = extractGsm(f);
  let name = (f.paperStock || "")
    .replace(/(\d{2,4})\s*(?:gsm|gr|g\/m²|g\/m2|g|г)(?![a-z])/gi, "")
    .replace(/\d+([.,]\d+)?\s*(mm|sm|cm|m)\b/gi, "")
    .replace(/\b(material[a-z]*|yopishqoq|etiketka|qog'ozi)\b/gi, "")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  name = name.split(" ").slice(0, 2).join(" ");
  if (!name) name = f.labelMaterialType?.trim() || f.targetPaperType?.trim() || "";
  return [name, gsm ? `${gsm} g` : ""].filter(Boolean).join(" ");
}

function colorFormula(f: Partial<WorkOrderFormData>): string {
  const m = f.colorsConfig?.match(/\d\s*\+\s*\d/);
  const formula = m ? m[0].replace(/\s/g, "") : "";
  return formula === "0+0" ? "" : formula;
}

function buildPrint(f: Partial<WorkOrderFormData>): string {
  const formula = colorFormula(f);
  const spots = f.spotColorItems?.length || f.spotColors?.length || 0;
  const spotLabel = spots ? `+${spots} Pantone` : "";
  return [formula, spotLabel].filter(Boolean).join(" ");
}

function buildFinishing(f: Partial<WorkOrderFormData>): string[] {
  const out: string[] = [];
  if (isSet(f.lamination)) {
    const raw = f.lamination!.trim();
    const lower = raw.toLowerCase();
    let lam = /lam|ламин/.test(lower) ? raw : `${raw} lam.`;
    if (lower.includes("soft")) lam = "soft-touch lam.";
    else if (/\bmat|матов/.test(lower)) lam = "mat lam.";
    else if (/gloss|glossiy|yaltiroq|глянц/.test(lower)) lam = "glyanets lam.";
    if (f.laminationSides === "2s") lam += " 2 tomon";
    out.push(lam);
  }
  if (isSet(f.coating)) out.push(f.coating!.trim());
  if (isSet(f.embellishment)) out.push(f.embellishment!.trim());
  if (f.kashirovkaMode && f.kashirovkaMode !== "none") out.push("kashirovka");
  if (f.department === "Jacquard" && f.hasLurexThread && f.lurexColor && f.lurexColor !== "none") {
    out.push(LUREX_NAMES[f.lurexColor] || "lyureks");
  }
  return out;
}

function typeCode(f: Partial<WorkOrderFormData>): string {
  const pt = f.productType?.trim();
  if (pt) {
    const words = pt.split(/\s+/).filter(Boolean);
    const code = words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 3) : pt.slice(0, 2);
    return code.toUpperCase();
  }
  return CATEGORY_CODES[f.itemCategory || ""] || DEPARTMENT_CODES[f.department || ""] || "MH";
}

/**
 * Builds a product name from the order's specification fields.
 * extraNote is a trailing brand/note kept from the current name: ` - "Note"`.
 */
export function generateSuggestedProductName(
  formData: Partial<WorkOrderFormData>,
  preset: ProductNameNamingPreset = "standard",
  extraNote?: string
): string {
  const f = formData;
  let name: string;

  if (preset === "code") {
    const gsm = extractGsm(f);
    const formula = colorFormula(f);
    name = [
      typeCode(f),
      buildSize(f, "x", false),
      gsm ? `${gsm}G` : "",
      formula ? formula.replace("+", "/") : "",
    ]
      .filter(Boolean)
      .join("-");
  } else {
    const head = [buildTypeLabel(f), buildSize(f)].filter(Boolean).join(" ");
    if (preset === "compact") {
      name = head;
    } else if (preset === "client") {
      const customer = f.customer?.trim();
      name = customer ? `${customer} — ${head}` : head;
    } else {
      name = [head, buildMaterial(f), buildPrint(f), ...buildFinishing(f)].filter(Boolean).join(", ");
    }
  }

  if (extraNote?.trim()) name += ` - "${extraNote.trim()}"`;
  return name;
}
