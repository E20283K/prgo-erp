export type WmsMode = "map" | "rack" | "bin";
export type WmsDrawTool = "select" | "rack" | "zone" | "aisle" | "gate" | "obstacle";

export interface WmsZone {
  id: string;
  companyId: string;
  warehouseId: string;
  code: string;
  name: string;
  type: "storage" | "receiving" | "shipping" | "staging" | "quarantine";
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  notes?: string | null;
  isActive?: boolean;
}

export interface WmsRack {
  id: string;
  companyId: string;
  warehouseId: string;
  zoneId?: string | null;
  code: string;
  name: string;
  type: "pallet" | "shelf" | "cantilever" | "roll_stand" | "floor_stack" | "obstacle" | "gate" | "aisle";
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  levelsCount: number;
  baysCount: number;
  maxWeightKg: string | number;
  status: string;
  visualConfig?: any;
}

export interface WmsBin {
  id: string;
  companyId: string;
  warehouseId: string;
  rackId: string;
  zoneId?: string | null;
  code: string;
  barcode?: string | null;
  level: number;
  bay: number;
  rowSpan: number;
  colSpan: number;
  widthCm: string | number;
  heightCm: string | number;
  depthCm: string | number;
  maxWeightKg: string | number;
  currentWeightKg: string | number;
  occupancyPct: number;
  status: "empty" | "partial" | "full" | "reserved" | "blocked";
  notes?: string | null;
}

export interface WmsBinItem {
  id: string;
  companyId: string;
  warehouseId: string;
  rackId: string;
  binId: string;
  stockBalanceId?: string | null;
  finishedGoodId?: string | null;
  itemId?: string | null;
  sku: string;
  name: string;
  category: string;
  batchNumber?: string | null;
  workOrderId?: string | null;
  quantity: string | number;
  reservedQty: string | number;
  unit: string;
  weightKg: string | number;
  containerType: "pallet" | "box" | "roll" | "drum" | "bundle";
  posX: number;
  posY: number;
  widthPx: number;
  heightPx: number;
  color?: string | null;
  notes?: string | null;
}

export interface WmsStats {
  totalRacks: number;
  totalBins: number;
  occupiedBins: number;
  emptyBins: number;
  avgOccupancy: number;
  totalItemsCount: number;
}

export interface WmsLayoutData {
  warehouse: any;
  zones: WmsZone[];
  racks: WmsRack[];
  bins: WmsBin[];
  binItems: WmsBinItem[];
  stats: WmsStats;
}
