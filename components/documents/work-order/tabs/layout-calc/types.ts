import type {
  SizeDistribution,
  SideColorConfig,
  SpotColorItem,
  ProductShapeType,
  SkuArtwork,
  PersistedImpositionState,
  OrderAttachment,
} from "../../types";
import type { PrintMethod } from "../../planningEngine";
import type { WarehouseStockRecord } from "@/store/workspaceStore";

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

/** The parts of a machine record (DB or custom) the imposition tab reads. */
export interface PressMachineLike {
  name?: string;
  offsetSpecs?: {
    maxSheetMm?: string;
    minSheetMm?: string;
    plateSizeMm?: string;
    printingUnits?: number;
  };
}

export interface SheetCutOption {
  divisor: number;
  label: string;
  pressW: number;
  pressH: number;
  fitsMachine: boolean;
  piecesPerPressSheet: number;
  piecesPerParentSheet: number;
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
  artworkFront?: string;
  artworkBack?: string;
  skuArtworks?: SkuArtwork[];
  frontColors?: SideColorConfig;
  backColors?: SideColorConfig;
  spotColors?: SpotColorItem[];
  printMethod?: PrintMethod;
  onPrintMethodChange?: (method: PrintMethod) => void;
  pressMachine?: string;
  activeMachine?: PressMachineLike | null;
  paperStock?: string;
  warehouseStock?: WarehouseStockRecord[];
  parentSheetW?: number;
  parentSheetH?: number;
  pressSheetW?: number;
  pressSheetH?: number;
  plannedSheets?: number;
  appliedCtpPlates?: number;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
  impositionState?: PersistedImpositionState;
  onImpositionStateChange?: (state: PersistedImpositionState) => void;
  onApplyToOrder?: (payload: ApplyImpositionPayload) => void;
  onAddAttachment?: (attachment: OrderAttachment) => void;
}

/** One design (SKU) placed on the sheet. */
export interface ImpositionVariant {
  key: string;
  name: string;
  skuId?: string;
  quantity: number;
  manualSlots?: number;
  frontUrl?: string;
  frontName?: string;
  backUrl?: string;
  backName?: string;
  /** Locally picked PDFs override the order artwork URLs */
  frontFile?: File;
  backFile?: File;
}

export type RotationMode = "auto" | 0 | 90;
