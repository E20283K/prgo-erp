import {
  SizeDistribution,
  KashirovkaMode,
  KashirovkaImpositionStrategy,
  SubstrateLayer,
  SideColorConfig,
  SpotColorItem,
  RouteStep,
  ProductShapeType,
  ProductCustomShape,
  SkuArtwork,
  PersistedImpositionState,
} from "../../types";
import { PrintMethod, PrintPlanningResult } from "../../planningEngine";
import { WarehouseStockRecord } from "@/store/workspaceStore";

export interface MachineFormatConstraints {
  machineName: string;
  maxW: number;
  maxH: number;
  minW: number;
  minH: number;
  plateW: number;
  plateH: number;
  defaultGripper: number;
  printingUnits: number;
}

export interface SheetCutOption {
  divisor: number; // 1, 2, 3, 4, 6, 8, 9
  label: string;
  pressW: number;
  pressH: number;
  fitsMachine: boolean;
  wastePercent: number;
  piecesPerPressSheet: number;
  piecesPerParentSheet: number;
}

export interface ImpositionPlanSummary {
  id: "min_waste" | "min_plates" | "by_model";
  label: string;
  platesCount: number;
  totalPressSheets: number;
  totalParentSheets: number;
  totalCtpPlates: number;
  overproductionPct: number;
}

export interface ApplyImpositionPayload {
  paperStock?: string;
  parentSheetW: number;
  parentSheetH: number;
  pressSheetW: number;
  pressSheetH: number;
  plannedParentSheets: number;
  plannedPressSheets: number;
  totalCtpPlates: number;
  ctpSpecDetails: string;
  printMethod?: PrintMethod;
}

export interface LayoutCalcTabProps {
  sizes?: SizeDistribution[];
  defaultQuantity: number;
  docNo?: string;
  orderName?: string;
  customer?: string;
  defaultProdW?: number;
  defaultProdH?: number;
  defaultBleed?: number;
  shapeType?: ProductShapeType;
  customShape?: ProductCustomShape;
  customSvgPath?: string;
  cornerType?: string;
  holeSize?: number;
  holePosition?: string;
  holeOffset?: number;
  artworkFront?: string;
  artworkBack?: string;
  skuArtworks?: SkuArtwork[];
  frontColors?: SideColorConfig;
  backColors?: SideColorConfig;
  spotColors?: SpotColorItem[];
  printMethod?: PrintMethod;
  onPrintMethodChange?: (method: PrintMethod) => void;
  onApplyRouteToOperations?: (steps: RouteStep[]) => void;
  pressMachine?: string;
  activeMachine?: any;
  paperStock?: string;
  warehouseStock?: WarehouseStockRecord[];
  parentSheetW?: number;
  parentSheetH?: number;
  pressSheetW?: number;
  pressSheetH?: number;
  plannedSheets?: number;
  lamination?: string;
  embellishment?: string;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
  kashirovkaMode?: KashirovkaMode;
  kashirovkaStrategy?: KashirovkaImpositionStrategy;
  kashirovkaLayers?: SubstrateLayer[];
  kashirovkaGlueGsm?: number;
  kashirovkaMakeReadySheets?: number;
  onKashirovkaChange?: (patch: {
    kashirovkaMode?: KashirovkaMode;
    kashirovkaStrategy?: KashirovkaImpositionStrategy;
    kashirovkaMakeReadySheets?: number;
  }) => void;
  sampleQty?: number;
  onSampleQtyChange?: (qty: number) => void;
  impositionState?: PersistedImpositionState;
  onImpositionStateChange?: (state: PersistedImpositionState) => void;
  onApplyToOrder?: (payload: ApplyImpositionPayload) => void;
}

export interface KashirovkaSummary {
  enabled: boolean;
  mode: KashirovkaMode;
  strategy: KashirovkaImpositionStrategy;
  netPaperGsm: number;
  totalMountedGsm: number;
  estimatedCaliperMm: number;
  effectiveCardsPerPressSheet: number;
  mountedSheetsRequired: number;
  makeReadySheets: number;
  rawPrintedLinerSheets: number;
  rawCoreSheets: number;
  totalRawBoardSheets: number;
  totalCtpPlates: number;
  glueKgRequired: number;
  splitCutAxisX?: number;
}

export type PlatePartitionStrategy =
  | "gang_capacity"
  | "by_model"
  | "by_volume"
  | "smart_gang_optimizer";

export type CtpSideRelation =
  | "single_sided"
  | "shared_front_variable_back"
  | "independent_per_plate"
  | "work_and_turn";

export type OptimizerGoal = "min_waste" | "min_plates";

export type LayoutCalcViewMode =
  | "phoenix"
  | "planning"
  | "visualizer"
  | "print_economics"
  | "matrix"
  | "split";

export type ActivePlateSide = "front" | "back";

export interface SmartOptimizerParams {
  capacity: number;
  goal: OptimizerGoal;
  targetPlateCount?: number;
  maxSlotsPerItem?: number;
}

export interface SlotAssignment {
  sizeId: string;
  sizeLabel: string;
  model?: string;
  sizeCode?: string;
  targetQuantity: number;
  slots: number;
  yieldQuantity?: number;
  overproduction?: number;
  overproductionPercent?: number;
  sheetsNeeded?: number;
}

export interface PlateConfig {
  id: string;
  name: string;
  manualSlots: Record<string, number>;
  assignedSizeIds?: string[];
  customSheetRun?: number;
}

export interface CalculatedPlate extends PlateConfig {
  assignments: SlotAssignment[];
  requiredSheets: number;
  unassignedSlots: number;
  overflowSkusCount?: number;
  totalTarget?: number;
  totalYield?: number;
  totalOverproduction?: number;
  totalOverproductionPercent?: number;
  ctpFrontPlates?: number;
  ctpBackPlates?: number;
  totalCtpPlates?: number;
}

export interface PrepressMargins {
  effMarginTop: number;
  effMarginBottom: number;
  effMarginLeft: number;
  effMarginRight: number;
  gTop: number;
  gBottom: number;
  gLeft: number;
  gRight: number;
  gridLeft: number;
  gridTop: number;
}

export interface ImpositionLayout {
  cols: number;
  rows: number;
  pieces: number;
  utilization: number;
  itemW: number;
  itemH: number;
  offsetX: number;
  offsetY: number;
}

export interface GridCell {
  label: string;
  model?: string;
  sizeCode?: string;
  color: string;
  sizeId: string;
  slotsCount?: number;
  sideBadge?: "FRONT" | "BACK";
  artworkUrl?: string;
  rawArtworkUrl?: string;
}

export interface TrimMarkSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type GripperEdge = "Auto" | "Bottom" | "Top" | "Left" | "Right";
export type Orientation = "A" | "B";
export type OverproductionMode = "percent" | "exact";

export type LayoutCalcMode = "production" | "sample";
export type SampleStockSource = "precut_stock" | "cut_from_parent";

export interface PrecutStockPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  description: string;
}

export const PRECUT_STOCK_PRESETS: PrecutStockPreset[] = [
  { id: "sra3", name: "SRA3", width: 450, height: 320, description: "Standard digital press sheet (450×320 mm)" },
  { id: "a3_plus", name: "Super A3 / A3+", width: 483, height: 329, description: "Extended digital format (483×329 mm)" },
  { id: "a3", name: "A3", width: 420, height: 297, description: "Standard A3 cut sheet (420×297 mm)" },
  { id: "b3", name: "B3", width: 500, height: 353, description: "Small offset / digital B3 (500×353 mm)" },
  { id: "sra4", name: "SRA4", width: 320, height: 225, description: "Half SRA3 cut sheet (320×225 mm)" },
  { id: "a4", name: "A4", width: 297, height: 210, description: "Standard A4 cut sheet (297×210 mm)" },
];

export interface ParentCutResult {
  cuts: number;
  orientation: "direct" | "rotated";
  wastePercent: number;
  parentSheetsNeeded: number;
}
