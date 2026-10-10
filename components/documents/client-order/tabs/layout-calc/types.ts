import { SizeDistribution } from "../../types";

export interface LayoutCalcTabProps {
  sizes?: SizeDistribution[];
  defaultQuantity: number;
  docNo?: string;
  orderName?: string;
  defaultProdW?: number;
  defaultProdH?: number;
  defaultBleed?: number;
}

export interface SlotAssignment {
  sizeId: string;
  sizeLabel: string;
  targetQuantity: number;
  slots: number;
}

export interface PlateConfig {
  id: string;
  name: string;
  manualSlots: Record<string, number>;
}

export interface CalculatedPlate extends PlateConfig {
  assignments: SlotAssignment[];
  requiredSheets: number;
  unassignedSlots: number;
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
  color: string;
  sizeId: string;
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
