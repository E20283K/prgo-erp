export interface SizeDistribution {
  id: string;
  size: string;
  quantity: number;
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

export interface OrderAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  isImage?: boolean;
  /** Public or blob URL of the file contents (used for preview & download) */
  url?: string;
}

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

export interface SideColorConfig {
  c: boolean;
  m: boolean;
  y: boolean;
  k: boolean;
}

export interface SpotColorItem {
  id: string;
  name: string;
  code: string;
  hex: string;
  side: "front" | "back" | "both";
}

export interface ClientOrderFormData {
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  recipe: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press" | string;
  site: string;
  deadline: string;
  responsible: string;
  orderType: string; // "Sample" | "Production"
  linkedWoId: string;
  status: string;
  priority?: string;
  pressMachine?: string;
  paperStock?: string;
  coating?: string;
  lamination?: string;
  laminationSides?: "1s" | "2s";
  laminationMicron?: number;
  embellishment?: string;
  priceTotal?: number;
  currency?: string;
  photoUrl?: string;
  photoUrls?: string[];
  attachments?: OrderAttachment[];
  // Physical Item Specifications
  itemCategory?: "Label" | "Hangtag" | "Card" | "Sticker" | "Jacquard Ribbon" | "Carton" | "Other" | string;
  width?: number;
  height?: number;
  dimensionUnit?: "mm" | "cm" | "in" | string;
  cornerType?: "Square" | "Rounded (R3)" | "Rounded (R5)" | "Die-cut" | "Center Fold" | "End Fold" | string;
  bleed?: number;
  milestones?: ProductionMilestone[];
  sizes?: SizeDistribution[];
  // Color Stations & Inks
  colorsConfig?: string;
  spotColors?: string[];
  spotColorItems?: SpotColorItem[];
  frontColors?: SideColorConfig;
  backColors?: SideColorConfig;
  // Finishing & Drill Hole
  holeSize?: number;
  holePosition?: "top-center" | "top-left" | "top-right" | "left-center" | "right-center" | "none";
  holeOffset?: number;
  // Multi-Layer / Kashirovka (Duplex / Triplex Mounting)
  kashirovkaMode?: KashirovkaMode;
  kashirovkaStrategy?: KashirovkaImpositionStrategy;
  kashirovkaLayers?: SubstrateLayer[];
  kashirovkaGlueGsm?: number;
  kashirovkaMakeReadySheets?: number;
  kashirovkaCuringHours?: number;
  // Flexo Specific Parameters
  flexoMachineId?: string;
  flexoMaterialId?: string;
  flexoWebWidth?: number;
  flexoCylinderTeeth?: number;
  flexoGapX?: number;
  flexoGapY?: number;
  flexoColors?: number;
  flexoPlateThickness?: number;
  flexoOrientation?: "normal" | "rotated";
}

export interface AuditLogItem {
  id: string;
  action: string;
  detail: string;
  user: string;
  timestamp: string;
}

export interface ClientOrderSampleData {
  dispatchDate: string;
  deliveryMethod: string;
  courierName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  trackingNumber: string;
  sampleQty: number;
  packingNotes: string;
  isDispatched: boolean;
  approvalStatus: string; // "Pending" | "Approved" | "Revision Requested"
  approvalNotes: string;
}

export const MOCK_CUSTOMERS = [
  "Alpha Media Group",
  "Nordic Print Co",
  "Baltic Press LLC",
  "Apex Packaging",
  "Global Apparel Brand",
  "Zenith Publishing",
  "Vanguard Fashion",
  "Metropolis Books",
  "Urban Outfit Labels",
  "Pacific Craft Goods",
];

