"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  EditableGridCell,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Plus,
  Trash2,
  Copy,
  Boxes,
  FileSpreadsheet,
  Layers,
  ExternalLink,
  Check,
  ChevronsUpDown,
  Warehouse,
  AlertCircle,
  Search,
  BookmarkPlus,
  MoreHorizontal,
  Edit3,
} from "lucide-react";

import { useWorkspaceStore, WarehouseStockRecord } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { toast } from "@/components/ui/toast";
import { MASTER_SPECIFICATIONS, MasterSpecification } from "./work-order/types";
import { getMaterialImage } from "@/lib/materialImages";
import { MaterialImageModal, type MaterialImagePreviewData } from "@/components/documents/MaterialImageModal";

export type MaterialIssueType = "standard" | "remake" | "client_change" | "press_waste";
export type FaultParty = "none" | "prepress" | "production" | "client" | "supplier";

export interface BomItem {
  id: string;
  name: string;
  spec: string;
  planQty: number; // Rejali norma
  actualQty: number; // Faktik haqiqiy sarf
  wasteQty?: number; // Farq / Brak (actualQty - planQty)
  qty: number; // Backward compatibility (= actualQty)
  unit: string;
  unitPrice: number;
  totalPrice: number; // actualQty * unitPrice
  supplier: string;
  availability: "In Stock" | "Reserved" | "Low Stock" | "On Order";
  issueType?: MaterialIssueType;
  faultParty?: FaultParty;
  notes?: string;
  imageUrl?: string;
}

export function normalizeBomItem(item: any): BomItem {
  const planQty = item.planQty !== undefined ? Number(item.planQty) : (item.qty !== undefined ? Number(item.qty) : 0);
  const actualQty = item.actualQty !== undefined ? Number(item.actualQty) : planQty;
  const wasteQty = item.wasteQty !== undefined ? Number(item.wasteQty) : Math.max(0, actualQty - planQty);
  const unitPrice = Number(item.unitPrice) || 0;
  const totalPrice = item.totalPrice !== undefined ? Number(item.totalPrice) : Number((actualQty * unitPrice).toFixed(2));
  return {
    id: item.id || `MAT-${Math.floor(100 + Math.random() * 900)}`,
    name: item.name || "",
    spec: item.spec || "",
    planQty,
    actualQty,
    wasteQty,
    qty: actualQty,
    unit: item.unit || "pcs",
    unitPrice,
    totalPrice,
    supplier: item.supplier || "Warehouse",
    availability: item.availability || "In Stock",
    issueType: item.issueType || "standard",
    faultParty: item.faultParty || "none",
    notes: item.notes || "",
    imageUrl: item.imageUrl || getMaterialImage(item),
  };
}

const OFFSET_BOM_ITEMS: BomItem[] = [
  { id: "MAT-PAP-014", name: "Galerie Art Silk Paper", spec: "150 g/m², 700x1000mm", planQty: 12500, actualQty: 12850, wasteQty: 350, qty: 12850, unit: "Sheets", unitPrice: 0.42, totalPrice: 5397.00, supplier: "Sappi Paper Mill", availability: "In Stock", issueType: "standard", faultParty: "none", notes: "Makeready over-run (+350)" },
  { id: "MAT-INK-CMYK", name: "Hubergroup Eco-Offset Ink", spec: "Process CMYK", planQty: 36, actualQty: 36, wasteQty: 0, qty: 36, unit: "kg", unitPrice: 24.00, totalPrice: 864.00, supplier: "Hubergroup", availability: "In Stock", issueType: "standard", faultParty: "none" },
  { id: "MAT-PLT-CTP", name: "Agfa CTP Thermal Plates", spec: "1030x790mm", planQty: 8, actualQty: 8, wasteQty: 0, qty: 8, unit: "pcs", unitPrice: 18.50, totalPrice: 148.00, supplier: "Agfa", availability: "In Stock", issueType: "standard", faultParty: "none", notes: "4+4 Asosiy forma komplekti" },
  { id: "MAT-PLT-RMK1", name: "Agfa CTP Plates (Magenta Remake)", spec: "1030x790mm Thermal", planQty: 0, actualQty: 1, wasteQty: 1, qty: 1, unit: "pcs", unitPrice: 18.50, totalPrice: 18.50, supplier: "Agfa", availability: "In Stock", issueType: "remake", faultParty: "prepress", notes: "Matn xatosi sababli Magenta qayta chiqarildi" },
  { id: "MAT-LAM-M01", name: "Soft-Touch Matte Film", spec: "BOPP 32 micron", planQty: 2400, actualQty: 2400, wasteQty: 0, qty: 2400, unit: "m", unitPrice: 0.32, totalPrice: 768.00, supplier: "Dunmore", availability: "In Stock", issueType: "standard", faultParty: "none" },
];

const FLEXO_BOM_ITEMS: BomItem[] = [
  { id: "MAT-FLX-NYL", name: "Nylon Taffeta Tape Roll", spec: "30mm width, 200m", planQty: 45, actualQty: 48, wasteQty: 3, qty: 48, unit: "Rolls", unitPrice: 12.50, totalPrice: 600.00, supplier: "Avery Dennison", availability: "In Stock", issueType: "standard", faultParty: "none", notes: "Chiqindi: +3 rulon" },
  { id: "MAT-FLX-INK", name: "Wash-Resistant Flexo Ink", spec: "Black, 5kg", planQty: 2, actualQty: 2, wasteQty: 0, qty: 2, unit: "kg", unitPrice: 45.00, totalPrice: 90.00, supplier: "Flint Group", availability: "Low Stock", issueType: "standard", faultParty: "none" },
  { id: "MAT-FLX-PLT", name: "Photopolymer Flexo Plate", spec: "Digital Plate 1.14mm", planQty: 2, actualQty: 2, wasteQty: 0, qty: 2, unit: "pcs", unitPrice: 120.00, totalPrice: 240.00, supplier: "MacDermid", availability: "In Stock", issueType: "standard", faultParty: "none", notes: "2 rangli polimer" },
  { id: "MAT-FLX-RMK", name: "Photopolymer Flexo Plate (Remake)", spec: "Digital Plate 1.14mm", planQty: 0, actualQty: 1, wasteQty: 1, qty: 1, unit: "pcs", unitPrice: 120.00, totalPrice: 120.00, supplier: "MacDermid", availability: "In Stock", issueType: "remake", faultParty: "prepress", notes: "Rastr nuqsoni tufayli qayta tayyorlandi" },
];

const JACQUARD_BOM_ITEMS: BomItem[] = [
  { id: "MAT-YRN-WARP", name: "Polyester Warp Yarn", spec: "Black, 50D", planQty: 120, actualQty: 124, wasteQty: 4, qty: 124, unit: "kg", unitPrice: 5.20, totalPrice: 644.80, supplier: "Shenghong Corp", availability: "In Stock", issueType: "standard", faultParty: "none" },
  { id: "MAT-YRN-WEFT", name: "Polyester Weft Yarn", spec: "White, 75D", planQty: 85, actualQty: 85, wasteQty: 0, qty: 85, unit: "kg", unitPrice: 4.80, totalPrice: 408.00, supplier: "Shenghong Corp", availability: "In Stock", issueType: "standard", faultParty: "none" },
  { id: "MAT-YRN-GLD", name: "Metallic Lurex Yarn", spec: "Gold, 30D", planQty: 15, actualQty: 15, wasteQty: 0, qty: 15, unit: "kg", unitPrice: 18.50, totalPrice: 277.50, supplier: "Lurex Co", availability: "Reserved", issueType: "standard", faultParty: "none" },
];

const RECIPE_BOM_MAP: Record<string, BomItem[]> = {
  OFFSET_STD_V1: OFFSET_BOM_ITEMS,
  OFFSET_KASHIROVKA_V1: [
    { id: "MAT-CRD-300F", name: "Layer 1: Coated Cardboard 300g/m²", spec: "Face Sheet 4+0, 700x1000mm", planQty: 1100, actualQty: 1150, wasteQty: 50, qty: 1150, unit: "Sheets", unitPrice: 0.68, totalPrice: 782.00, supplier: "Stora Enso", availability: "In Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-CRD-300B", name: "Layer 2: Coated Cardboard 300g/m²", spec: "Back Sheet 4+0, 700x1000mm", planQty: 1100, actualQty: 1150, wasteQty: 50, qty: 1150, unit: "Sheets", unitPrice: 0.68, totalPrice: 782.00, supplier: "Stora Enso", availability: "In Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-GLU-PVA", name: "PVA Dispersion Mounting Glue", spec: "25 g/m² Kashirovka Adhesive", planQty: 19.25, actualQty: 20, wasteQty: 0.75, qty: 20, unit: "kg", unitPrice: 4.20, totalPrice: 84.00, supplier: "Henkel Adhesive", availability: "In Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-LAM-SFT", name: "Soft-Touch Matte Lamination Film", spec: "BOPP 32 micron", planQty: 1540, actualQty: 1540, wasteQty: 0, qty: 1540, unit: "m²", unitPrice: 0.32, totalPrice: 492.80, supplier: "Dunmore", availability: "In Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-PLT-CTP4", name: "Agfa CTP Plates (Split-Mount Set)", spec: "1030x790mm Thermal", planQty: 4, actualQty: 4, wasteQty: 0, qty: 4, unit: "pcs", unitPrice: 18.50, totalPrice: 74.00, supplier: "Agfa", availability: "In Stock", issueType: "standard", faultParty: "none" },
  ],
  OFFSET_PREM_V2: [
    { id: "MAT-PAP-250", name: "LumiForte Premium Board", spec: "250 g/m², 700x1000mm", planQty: 5000, actualQty: 5150, wasteQty: 150, qty: 5150, unit: "Sheets", unitPrice: 0.58, totalPrice: 2987.00, supplier: "Stora Enso", availability: "Low Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-VRN-SUV", name: "Spot UV High-Build Varnish", spec: "UV Curable Gloss", planQty: 15, actualQty: 15, wasteQty: 0, qty: 15, unit: "kg", unitPrice: 32.00, totalPrice: 480.00, supplier: "Actega", availability: "In Stock", issueType: "standard", faultParty: "none" },
  ],
  FLEXO_NYLON_V1: FLEXO_BOM_ITEMS,
  FLEXO_SATIN_V2: [
    { id: "MAT-FLX-SAT", name: "Premium Satin Ribbon Roll", spec: "40mm width, 200m, Woven Edge", planQty: 30, actualQty: 31, wasteQty: 1, qty: 31, unit: "Rolls", unitPrice: 18.00, totalPrice: 558.00, supplier: "Avery Dennison", availability: "In Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-FLX-GLD", name: "Metallic Gold Flexo Ink", spec: "Wash-Fast Metallic", planQty: 1.5, actualQty: 1.5, wasteQty: 0, qty: 1.5, unit: "kg", unitPrice: 68.00, totalPrice: 102.00, supplier: "Flint Group", availability: "In Stock", issueType: "standard", faultParty: "none" },
  ],
  JACQ_WOVEN_V1: JACQUARD_BOM_ITEMS,
  JACQ_TAFFETA_V2: [
    { id: "MAT-YRN-HDT", name: "High-Density Taffeta Yarn", spec: "50D Micro-Polyester", planQty: 200, actualQty: 205, wasteQty: 5, qty: 205, unit: "kg", unitPrice: 6.40, totalPrice: 1312.00, supplier: "Shenghong Corp", availability: "Low Stock", issueType: "standard", faultParty: "none" },
  ],
  POST_GENERIC_V1: [
    { id: "MAT-PKG-STR", name: "PP Packaging Straps", spec: "12mm Heavy Duty", planQty: 10, actualQty: 10, wasteQty: 0, qty: 10, unit: "Rolls", unitPrice: 14.00, totalPrice: 140.00, supplier: "Local Pack", availability: "In Stock", issueType: "standard", faultParty: "none" },
    { id: "MAT-PKG-BOX", name: "Corrugated Carton Boxes", spec: "Double-Wall 5-Ply", planQty: 100, actualQty: 100, wasteQty: 0, qty: 100, unit: "pcs", unitPrice: 1.45, totalPrice: 145.00, supplier: "Local Pack", availability: "In Stock", issueType: "standard", faultParty: "none" },
  ],
};

interface BomMaterialsGridProps {
  tabId: string;
  department?: string;
  initialItems?: BomItem[];
  onTotalCostChange?: (total: number) => void;
  recipe?: string;
  activeSpec?: MasterSpecification;
  onRecipeChange?: (code: string, department: string) => void;
  onOpenTab?: (tab: any) => void;
  isOperator?: boolean;
  onSaveAsSpec?: (items: BomItem[]) => void;
  onItemsChange?: (items: BomItem[]) => void;
}

export function BomMaterialsGrid({
  tabId,
  department,
  initialItems,
  onTotalCostChange,
  recipe,
  activeSpec,
  onRecipeChange,
  onOpenTab,
  isOperator,
  onSaveAsSpec,
  onItemsChange,
}: BomMaterialsGridProps) {
  const t = useTranslations("BOM");
  const { theme, setTabUnsaved, updateGridStats, warehouseStock, masterSpecifications } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [isSpecComboboxOpen, setIsSpecComboboxOpen] = useState(false);
  const [isWarehousePickerOpen, setIsWarehousePickerOpen] = useState(false);

  const defaultItems = (initialItems || (
    (recipe && RECIPE_BOM_MAP[recipe]) ? RECIPE_BOM_MAP[recipe] :
    department === "Flexo" ? FLEXO_BOM_ITEMS :
    department === "Jacquard" ? JACQUARD_BOM_ITEMS :
    OFFSET_BOM_ITEMS
  )).map(normalizeBomItem);

  const [items, setItems] = useState<BomItem[]>(defaultItems);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialImagePreviewData | null>(null);

  // Add / Edit form state
  const [formState, setFormState] = useState<BomItem>({
    id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
    name: "",
    spec: "",
    planQty: 100,
    actualQty: 100,
    wasteQty: 0,
    qty: 100,
    unit: "pcs",
    unitPrice: 1.0,
    totalPrice: 100,
    supplier: "Approved Supplier",
    availability: "In Stock",
    issueType: "standard",
    faultParty: "none",
    notes: "",
    imageUrl: "",
  });

  const selectedStockItem = useMemo(() => {
    if (!formState.id && !formState.name) return undefined;
    return warehouseStock.find(
      (s) =>
        s.sku.toLowerCase() === formState.id.toLowerCase() ||
        (formState.name && s.name.toLowerCase() === formState.name.toLowerCase())
    );
  }, [formState.id, formState.name, warehouseStock]);

  const stockCategories = useMemo(() => {
    const set = new Set<string>();
    warehouseStock.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [warehouseStock]);

  const handleSelectWarehouseStock = (stock: WarehouseStockRecord) => {
    setFormState((prev) => {
      const unitPrice = stock.unitPriceUsd !== undefined ? stock.unitPriceUsd : (prev.unitPrice || 1.0);
      const actualQty = prev.actualQty || 1;
      const spec = stock.sheetFormat
        ? `${stock.sheetFormat} mm · ${stock.category}`
        : stock.category;
      return {
        ...prev,
        id: stock.sku,
        name: stock.name,
        spec,
        unit: stock.unit,
        unitPrice,
        totalPrice: Number((actualQty * unitPrice).toFixed(2)),
        supplier: stock.supplier || `Asosiy Ombor (${stock.location})`,
        availability:
          stock.status === "In Stock"
            ? "In Stock"
            : stock.status === "Low Stock"
            ? "Low Stock"
            : "On Order",
        imageUrl: stock.imageUrl || getMaterialImage(stock),
      };
    });
    setIsWarehousePickerOpen(false);
  };

  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "image", title: t("image"), width: 56, icon: GridColumnIcon.HeaderImage },
    { id: "id", title: t("itemCode"), width: 110, icon: GridColumnIcon.HeaderReference },
    { id: "name", title: t("materialName"), width: 230, icon: GridColumnIcon.HeaderString },
    { id: "issueType", title: t("issueType"), width: 140, icon: GridColumnIcon.HeaderSingleValue },
    { id: "planQty", title: t("planQty"), width: 100, icon: GridColumnIcon.HeaderNumber },
    { id: "actualQty", title: t("actualQty"), width: 100, icon: GridColumnIcon.HeaderNumber },
    { id: "wasteQty", title: t("wasteQty"), width: 95, icon: GridColumnIcon.HeaderNumber },
    { id: "unit", title: t("unit"), width: 75, icon: GridColumnIcon.HeaderLookup },
    { id: "unitPrice", title: t("unitPrice"), width: 95, icon: GridColumnIcon.HeaderMath },
    { id: "totalPrice", title: t("totalPrice"), width: 115, icon: GridColumnIcon.HeaderMath },
    { id: "faultParty", title: t("faultParty"), width: 135, icon: GridColumnIcon.HeaderLookup },
    { id: "notes", title: t("notes"), width: 190, icon: GridColumnIcon.HeaderTextTemplate },
    { id: "supplier", title: t("supplier"), width: 150, icon: GridColumnIcon.HeaderLookup },
    { id: "availability", title: t("availability"), width: 115, icon: GridColumnIcon.HeaderSingleValue },
  ]);

  // Keep column titles aligned with translations
  useEffect(() => {
    setColumns((prev) => [
      { ...prev[0], title: t("image") },
      { ...prev[1], title: t("itemCode") },
      { ...prev[2], title: t("materialName") },
      { ...prev[3], title: t("issueType") },
      { ...prev[4], title: t("planQty") },
      { ...prev[5], title: t("actualQty") },
      { ...prev[6], title: t("wasteQty") },
      { ...prev[7], title: t("unit") },
      { ...prev[8], title: t("unitPrice") },
      { ...prev[9], title: t("totalPrice") },
      { ...prev[10], title: t("faultParty") },
      { ...prev[11], title: t("notes") },
      { ...prev[12], title: t("supplier") },
      { ...prev[13], title: t("availability") },
    ]);
  }, [t]);

  // Active items list
  const filteredItems = items;

  const selectedRowIndex = selection.rows.toArray()[0];
  const hasSelectedRow = selectedRowIndex !== undefined && items[selectedRowIndex] !== undefined;

  // Compute total BOM costs (Plan vs Fact vs Waste)
  const { planTotalCost, actualTotalCost, wasteTotalCost, remakeCount } = useMemo(() => {
    let plan = 0;
    let actual = 0;
    let waste = 0;
    let remakes = 0;
    items.forEach((item) => {
      const pQty = item.planQty !== undefined ? Number(item.planQty) : (Number(item.qty) || 0);
      const aQty = item.actualQty !== undefined ? Number(item.actualQty) : pQty;
      const wQty = item.wasteQty !== undefined ? Number(item.wasteQty) : Math.max(0, aQty - pQty);
      const price = Number(item.unitPrice) || 0;
      plan += pQty * price;
      actual += aQty * price;
      waste += wQty * price;
      if (item.issueType === "remake" || item.issueType === "press_waste" || wQty > 0) {
        remakes++;
      }
    });
    return {
      planTotalCost: Number(plan.toFixed(2)),
      actualTotalCost: Number(actual.toFixed(2)),
      wasteTotalCost: Number(waste.toFixed(2)),
      remakeCount: remakes,
    };
  }, [items]);

  useEffect(() => {
    if (onTotalCostChange) {
      onTotalCostChange(actualTotalCost);
    }
  }, [actualTotalCost, onTotalCostChange]);

  // Glide Data Grid cell content provider
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const column = columns[col];
      const item = filteredItems[row];

      if (!item || !column) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
        };
      }

      switch (column.id) {
        case "image": {
          const img = item.imageUrl || getMaterialImage(item);
          return {
            kind: GridCellKind.Image,
            data: [img],
            displayData: [img],
            allowOverlay: true,
          };
        }
        case "id":
          return {
            kind: GridCellKind.Text,
            data: item.id,
            displayData: item.id,
            allowOverlay: true,
            themeOverride: {
              textDark: isDark ? "#93c5fd" : "#1d4ed8",
              baseFontStyle: "bold 12px monospace",
            },
          };
        case "name":
          return {
            kind: GridCellKind.Text,
            data: item.name,
            displayData: item.name,
            allowOverlay: true,
            themeOverride: {
              baseFontStyle: item.issueType === "remake" ? "bold 12px sans-serif" : "500 12px sans-serif",
              textDark: item.issueType === "remake"
                ? (isDark ? "#fca5a5" : "#b91c1c")
                : (isDark ? "#f4f4f5" : "#0f172a"),
            },
          };
        case "issueType": {
          const type = item.issueType || "standard";
          const label =
            type === "remake"
              ? "⚠️ Qayta (Remake)"
              : type === "client_change"
              ? "Mijoz tuzatishi"
              : type === "press_waste"
              ? "Bosma chiqindisi"
              : "Standart reja";

          const color =
            type === "remake"
              ? (isDark ? "#fca5a5" : "#b91c1c")
              : type === "client_change"
              ? (isDark ? "#93c5fd" : "#1d4ed8")
              : type === "press_waste"
              ? (isDark ? "#fbbf24" : "#b45309")
              : (isDark ? "#9ca3af" : "#4b5563");

          return {
            kind: GridCellKind.Text,
            data: type,
            displayData: label,
            allowOverlay: true,
            themeOverride: {
              textDark: color,
              baseFontStyle: type === "remake" ? "bold 11px sans-serif" : "500 11px sans-serif",
            },
          };
        }
        case "planQty": {
          const p = item.planQty !== undefined ? item.planQty : (item.qty || 0);
          return {
            kind: GridCellKind.Number,
            data: p,
            displayData: p.toLocaleString("en-US"),
            allowOverlay: true,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "12px monospace",
              textDark: isDark ? "#9ca3af" : "#64748b",
            },
          };
        }
        case "actualQty": {
          const a = item.actualQty !== undefined ? item.actualQty : (item.qty || 0);
          const p = item.planQty !== undefined ? item.planQty : a;
          const hasOverrun = a > p;
          return {
            kind: GridCellKind.Number,
            data: a,
            displayData: a.toLocaleString("en-US"),
            allowOverlay: true,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "600 12px monospace",
              textDark: hasOverrun ? (isDark ? "#f87171" : "#dc2626") : undefined,
            },
          };
        }
        case "wasteQty": {
          const a = item.actualQty !== undefined ? item.actualQty : (item.qty || 0);
          const p = item.planQty !== undefined ? item.planQty : a;
          const w = item.wasteQty !== undefined ? item.wasteQty : Math.max(0, a - p);
          return {
            kind: GridCellKind.Number,
            data: w,
            displayData: w > 0 ? `+${w.toLocaleString("en-US")}` : "0",
            allowOverlay: true,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: w > 0 ? "bold 12px monospace" : "12px monospace",
              textDark: w > 0 ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#6b7280" : "#94a3b8"),
            },
          };
        }
        case "unit":
          return {
            kind: GridCellKind.Text,
            data: item.unit,
            displayData: item.unit,
            allowOverlay: true,
            contentAlign: "center",
            themeOverride: {
              textDark: isDark ? "#d4d4d8" : "#3f3f46",
            },
          };
        case "unitPrice":
          return {
            kind: GridCellKind.Number,
            data: item.unitPrice,
            displayData: `$${item.unitPrice.toFixed(2)}`,
            allowOverlay: true,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "12px monospace",
              textDark: isDark ? "#d4d4d8" : "#3f3f46",
            },
          };
        case "totalPrice": {
          const a = item.actualQty !== undefined ? item.actualQty : (item.qty || 0);
          const total = a * item.unitPrice;
          return {
            kind: GridCellKind.Number,
            data: total,
            displayData: `$${total.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            allowOverlay: false,
            contentAlign: "right",
            themeOverride: {
              textDark: isDark ? "#60a5fa" : "#2563eb",
              baseFontStyle: "bold 12px monospace",
            },
          };
        }
        case "faultParty": {
          const party = item.faultParty || "none";
          const label =
            party === "prepress"
              ? "Prepress / Dizayn"
              : party === "production"
              ? "Sex / Stanok"
              : party === "client"
              ? "Mijoz (Pullik)"
              : party === "supplier"
              ? "Ta'minotchi"
              : "—";

          return {
            kind: GridCellKind.Text,
            data: party,
            displayData: label,
            allowOverlay: true,
            themeOverride: {
              textDark:
                party === "prepress"
                  ? (isDark ? "#fca5a5" : "#b91c1c")
                  : party === "client"
                  ? (isDark ? "#93c5fd" : "#1d4ed8")
                  : (isDark ? "#71717a" : "#94a3b8"),
            },
          };
        }
        case "notes":
          return {
            kind: GridCellKind.Text,
            data: item.notes || item.spec || "",
            displayData: item.notes || item.spec || "—",
            allowOverlay: true,
            themeOverride: {
              textDark: isDark ? "#a1a1aa" : "#475569",
            },
          };
        case "supplier":
          return {
            kind: GridCellKind.Text,
            data: item.supplier,
            displayData: item.supplier,
            allowOverlay: true,
            themeOverride: {
              textDark: isDark ? "#e4e4e7" : "#18181b",
            },
          };
        case "availability": {
          const isStock = item.availability === "In Stock";
          const isReserved = item.availability === "Reserved";
          const isLow = item.availability === "Low Stock";
          const statusColor = isStock
            ? (isDark ? "#4ade80" : "#16a34a")
            : isReserved
            ? (isDark ? "#60a5fa" : "#2563eb")
            : isLow
            ? (isDark ? "#fbbf24" : "#d97706")
            : (isDark ? "#f87171" : "#dc2626");

          return {
            kind: GridCellKind.Text,
            data: item.availability,
            displayData: item.availability,
            allowOverlay: true,
            themeOverride: {
              textDark: statusColor,
              baseFontStyle: "600 11px sans-serif",
            },
          };
        }
        default:
          return {
            kind: GridCellKind.Text,
            data: "",
            displayData: "",
            allowOverlay: false,
          };
      }
    },
    [columns, filteredItems, isDark]
  );

  // Support cell editing
  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = columns[col];
      const targetItem = filteredItems[row];
      if (!targetItem || !column) return;

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === targetItem.id) {
            const updated = { ...item };
            if (column.id === "actualQty") {
              const val =
                typeof newValue.data === "number"
                  ? newValue.data
                  : parseFloat(String(newValue.data)) || 0;
              updated.actualQty = Math.max(0, val);
              updated.qty = updated.actualQty;
              updated.wasteQty = Math.max(0, updated.actualQty - (updated.planQty || 0));
              updated.totalPrice = Number((updated.actualQty * updated.unitPrice).toFixed(2));
            } else if (column.id === "planQty") {
              const val =
                typeof newValue.data === "number"
                  ? newValue.data
                  : parseFloat(String(newValue.data)) || 0;
              updated.planQty = Math.max(0, val);
              updated.wasteQty = Math.max(0, (updated.actualQty || 0) - updated.planQty);
            } else if (column.id === "wasteQty") {
              const val =
                typeof newValue.data === "number"
                  ? newValue.data
                  : parseFloat(String(newValue.data)) || 0;
              updated.wasteQty = Math.max(0, val);
            } else if (column.id === "unitPrice") {
              const val =
                typeof newValue.data === "number"
                  ? newValue.data
                  : parseFloat(String(newValue.data)) || 0;
              updated.unitPrice = Math.max(0, val);
              updated.totalPrice = Number((updated.actualQty * updated.unitPrice).toFixed(2));
            } else if (column.id === "name") {
              updated.name = String(newValue.data ?? "");
            } else if (column.id === "spec") {
              updated.spec = String(newValue.data ?? "");
            } else if (column.id === "notes") {
              updated.notes = String(newValue.data ?? "");
            } else if (column.id === "unit") {
              updated.unit = String(newValue.data ?? "");
            } else if (column.id === "supplier") {
              updated.supplier = String(newValue.data ?? "");
            } else if (column.id === "availability") {
              updated.availability = String(newValue.data ?? "") as any;
            } else if (column.id === "issueType") {
              updated.issueType = String(newValue.data ?? "") as any;
            } else if (column.id === "faultParty") {
              updated.faultParty = String(newValue.data ?? "") as any;
            } else if (column.id === "id") {
              updated.id = String(newValue.data ?? "");
            }
            return updated;
          }
          return item;
        })
      );

      if (tabId) {
        setTabUnsaved(tabId, true);
      }
    },
    [columns, filteredItems, tabId, setTabUnsaved]
  );

  // Support column resizing
  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === column.id ? { ...col, width: newSize } : col))
    );
  }, []);

  // Update selection & 1C status coordinates
  const handleSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      setSelection(newSelection);
      let coords = "R1:C1";
      if (newSelection.current) {
        const [c, r] = newSelection.current.cell;
        coords = `R${r + 1}:C${c + 1}`;
      }
      updateGridStats(newSelection.rows.length, filteredItems.length, coords);
    },
    [updateGridStats, filteredItems.length]
  );

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingIndex(null);
    setFormState({
      id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      spec: "",
      planQty: 100,
      actualQty: 100,
      wasteQty: 0,
      qty: 100,
      unit: "pcs",
      unitPrice: 1.0,
      totalPrice: 100,
      supplier: "Approved Supplier",
      availability: "In Stock",
      issueType: "standard",
      faultParty: "none",
      notes: "",
      imageUrl: "",
    });
    setIsDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (index: number) => {
    const item = items[index];
    if (!item) return;
    setEditingIndex(index);
    setFormState(normalizeBomItem(item));
    setIsDialogOpen(true);
  };

  // Save Add/Edit Material handler
  const handleSaveMaterial = () => {
    if (!formState.name.trim()) return;

    const planQty = Number(formState.planQty) || 0;
    const actualQty = Number(formState.actualQty) || 0;
    const wasteQty = formState.wasteQty !== undefined ? Number(formState.wasteQty) : Math.max(0, actualQty - planQty);
    const unitPrice = Number(formState.unitPrice) || 0;
    const itemToSave: BomItem = {
      ...formState,
      name: formState.name.trim(),
      spec: formState.spec.trim() || "Standard Industry Spec",
      planQty,
      actualQty,
      wasteQty,
      qty: actualQty,
      unitPrice,
      totalPrice: Number((actualQty * unitPrice).toFixed(2)),
      supplier: formState.supplier.trim() || "Approved Supplier",
      issueType: formState.issueType || "standard",
      faultParty: formState.faultParty || "none",
      notes: formState.notes?.trim() || "",
      imageUrl: formState.imageUrl || getMaterialImage(formState),
    };

    if (editingIndex !== null) {
      setItems((prev) => {
        const next = [...prev];
        next[editingIndex] = itemToSave;
        return next;
      });
      toast.add({
        title: "Material Updated",
        description: `Updated ${itemToSave.id} (${itemToSave.name})`,
        type: "success",
      });
    } else {
      setItems((prev) => [...prev, itemToSave]);
      toast.add({
        title: itemToSave.issueType === "remake" ? "CTP / Brak qo'shildi" : t("addMaterial"),
        description: t("toastAdded", { code: itemToSave.id }),
        type: "success",
      });
    }

    if (tabId) setTabUnsaved(tabId, true);
    setIsDialogOpen(false);
  };

  // Delete Selected rows
  const handleDeleteSelected = useCallback(() => {
    const selectedRowIndices = selection.rows.toArray();
    if (selectedRowIndices.length === 0) return;

    const idsToDelete = new Set(
      selectedRowIndices.map((idx) => filteredItems[idx]?.id).filter(Boolean)
    );

    setItems((prev) => prev.filter((m) => !idsToDelete.has(m.id)));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    if (tabId) setTabUnsaved(tabId, true);

    toast.add({
      title: t("deleteMaterial"),
      description: t("toastDeleted", { count: idsToDelete.size }),
      type: "info",
    });
  }, [selection, filteredItems, tabId, setTabUnsaved, t]);

  // Duplicate Selected Row
  const handleDuplicateRow = useCallback(() => {
    const selectedRowIndices = selection.rows.toArray();
    const targetIdx = selectedRowIndices.length > 0 ? selectedRowIndices[0] : 0;
    const target = filteredItems[targetIdx];
    if (!target) return;

    const duplicated: BomItem = {
      ...target,
      id: `${target.id}-DUP`,
      name: `${target.name} (Copy)`,
    };

    setItems((prev) => [...prev, duplicated]);
    if (tabId) setTabUnsaved(tabId, true);

    toast.add({
      title: t("duplicate"),
      description: t("toastAdded", { code: duplicated.id }),
      type: "success",
    });
  }, [selection, filteredItems, tabId, setTabUnsaved, t]);

  // Copy Cell / Row
  const handleCopySelection = useCallback(() => {
    const selectedRowIndices = selection.rows.toArray();
    if (selectedRowIndices.length === 0) return;
    const rowsToCopy = selectedRowIndices
      .map((idx) => filteredItems[idx])
      .filter(Boolean)
      .map((m) => `${m.id}\t${m.name}\t${m.issueType || "standard"}\t${m.planQty}\t${m.actualQty}\t${m.wasteQty}\t${m.unit}\t$${m.unitPrice}\t$${m.totalPrice}\t${m.faultParty || "none"}\t${m.notes || ""}\t${m.supplier}\t${m.availability}`)
      .join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(rowsToCopy);
      toast.add({
        title: t("copy"),
        description: `${selectedRowIndices.length} row(s) copied to clipboard.`,
        type: "success",
      });
    }
  }, [selection, filteredItems, t]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = [
      t("itemCode"),
      t("materialName"),
      t("issueType"),
      t("planQty"),
      t("actualQty"),
      t("wasteQty"),
      t("unit"),
      t("unitPrice"),
      t("totalPrice"),
      t("faultParty"),
      t("notes"),
      t("supplier"),
      t("availability"),
    ];

    const csvRows = items.map((m) => [
      `"${m.id}"`,
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.issueType || "standard"}"`,
      m.planQty !== undefined ? m.planQty : m.qty,
      m.actualQty !== undefined ? m.actualQty : m.qty,
      m.wasteQty || 0,
      `"${m.unit}"`,
      m.unitPrice,
      (m.actualQty !== undefined ? m.actualQty * m.unitPrice : m.qty * m.unitPrice).toFixed(2),
      `"${m.faultParty || "none"}"`,
      `"${(m.notes || m.spec || "").replace(/"/g, '""')}"`,
      `"${m.supplier.replace(/"/g, '""')}"`,
      `"${m.availability}"`,
    ]);

    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BOM_Spec_${tabId || "export"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [items, t, tabId]);

  return (
    <div className="w-full h-full flex flex-col bg-background select-none overflow-hidden">
      {/* 1. Optimized Unified BOM Toolbar */}
      <div className="h-9 border-b border-border bg-card px-2.5 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        {/* Left Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Master BOM Specification Selector & Action Menu */}
          {onRecipeChange && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-medium text-muted-foreground hidden xl:inline shrink-0">
                Texkarta:
              </span>

              {/* Combobox Trigger */}
              <Popover open={!isOperator && isSpecComboboxOpen} onOpenChange={isOperator ? undefined : setIsSpecComboboxOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={isOperator}
                      aria-expanded={isSpecComboboxOpen}
                      className={cn(
                        "h-6.5 w-[150px] sm:w-[185px] lg:w-[210px] justify-between px-2 text-xs bg-muted/30 font-normal shadow-none border-border transition-colors cursor-pointer",
                        isOperator ? "opacity-85 cursor-not-allowed" : "hover:border-primary/50"
                      )}
                    />
                  }
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                    <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                      {activeSpec?.code || recipe}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground flex-1 min-w-0">
                      {activeSpec?.name || recipe}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </PopoverTrigger>

                <PopoverContent className="w-[380px] p-0 shadow-xl border border-border bg-popover" align="start">
                  <Command className="w-full">
                    <CommandInput placeholder="Texkarta kodi yoki nomi..." className="h-8 text-xs" />
                    <CommandList className="max-h-72">
                      <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                        Mos texkarta topilmadi.
                      </CommandEmpty>

                      {(["Offset", "Flexo", "Jacquard", "Post-press"] as const).map((dept) => {
                        const allAvailable = masterSpecifications || MASTER_SPECIFICATIONS;
                        const deptSpecs = allAvailable.filter((s) => s.department === dept);
                        if (deptSpecs.length === 0) return null;

                        return (
                          <CommandGroup key={dept} heading={`${dept} Technology Specifications`}>
                            {deptSpecs.map((spec) => {
                              const isSelected = recipe === spec.code;
                              return (
                                <CommandItem
                                  key={spec.code}
                                  value={`${spec.code} ${spec.name} ${spec.department} ${spec.description}`}
                                  onSelect={() => {
                                    onRecipeChange(spec.code, spec.department);
                                    if (RECIPE_BOM_MAP[spec.code]) {
                                      setItems(RECIPE_BOM_MAP[spec.code]);
                                    }
                                    if (tabId) setTabUnsaved(tabId, true);
                                    setIsSpecComboboxOpen(false);
                                  }}
                                  className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5"
                                >
                                  <div className="mt-0.5 shrink-0">
                                    <Check className={cn("h-4 w-4 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-semibold text-[11px] text-primary">
                                        {spec.code}
                                      </span>
                                      <span className="font-medium text-foreground truncate">
                                        {spec.name}
                                      </span>
                                      <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 shrink-0 font-normal">
                                        {spec.department}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                                      {spec.description}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5 font-mono">
                                      <span>{spec.materialsCount} xomashyo</span>
                                      <span>•</span>
                                      <span>{spec.estimatedCost}</span>
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Compact Unified Spec Action Dropdown */}
              {(onOpenTab || onSaveAsSpec) && (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="h-6.5 w-6.5 p-0 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          }
                        />
                      }
                    />
                    <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                      Texkarta amallari
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenuContent align="start" className="w-56 text-xs">
                    {onOpenTab && (
                      <DropdownMenuItem
                        onClick={() => {
                          const specToOpen = activeSpec || MASTER_SPECIFICATIONS[0];
                          onOpenTab({
                            id: specToOpen.id,
                            title: `${specToOpen.id}: ${specToOpen.name}`,
                            type: "product-spec",
                            module: "production",
                            documentData: {
                              id: specToOpen.id,
                              name: specToOpen.name,
                              code: specToOpen.code,
                              department: specToOpen.department,
                              desc: specToOpen.description,
                              materials: items,
                            },
                          });
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Spetsifikatsiya kartasini ochish</span>
                      </DropdownMenuItem>
                    )}

                    {onSaveAsSpec && (
                      <DropdownMenuItem
                        onClick={() => onSaveAsSpec(items)}
                        className="gap-2 cursor-pointer font-medium text-violet-700 dark:text-violet-400"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        <span>Yangi spetsifikatsiya qilib saqlash</span>
                      </DropdownMenuItem>
                    )}

                    {recipe && RECIPE_BOM_MAP[recipe] && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setItems(RECIPE_BOM_MAP[recipe]);
                            if (tabId) setTabUnsaved(tabId, true);
                            toast.add({
                              title: "Texkarta tiklandi",
                              description: "Standart me'yorlariga muvaffaqiyatli qaytarildi",
                              type: "success",
                            });
                          }}
                          className="gap-2 cursor-pointer text-muted-foreground"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                          <span>Standart me&apos;yorga qaytarish</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Separator orientation="vertical" className="h-4 mx-0.5" />
            </div>
          )}

          {/* Add Material Primary Action */}
          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("addMaterial")}</span>
          </Button>

          {/* Row Actions (Compact when selected) */}
          {hasSelectedRow && (
            <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => handleOpenEdit(selectedRowIndex)}
                      variant="outline"
                      size="sm"
                      className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span className="hidden sm:inline">Tahrirlash</span>
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  Materialni tahrirlash
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={handleDuplicateRow}
                      variant="outline"
                      size="icon-sm"
                      className="h-6.5 w-6.5 p-0 rounded cursor-pointer shrink-0 text-indigo-600 dark:text-indigo-400"
                    >
                      <Layers className="w-3 h-3" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  {t("duplicate")}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={handleDeleteSelected}
                      variant="ghost"
                      size="icon-sm"
                      className="h-6.5 w-6.5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  Tanlanganni o&apos;chirish
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Export CSV Icon Button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={handleExportCSV}
                  variant="ghost"
                  size="icon-sm"
                  className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground rounded cursor-pointer shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </Button>
              }
            />
            <TooltipContent side="bottom" sideOffset={4} className="text-xs">
              {t("exportCsv")} (CSV yuklab olish)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right Financial & Variance Summary */}
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0 pl-2 ml-auto whitespace-nowrap">
          <span className="text-muted-foreground">
            Reja: <strong className="text-foreground">${planTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Fakt: <strong className="text-primary font-bold">${actualTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          {wasteTotalCost > 0 && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 whitespace-nowrap">
              +{wasteTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({remakeCount} ta)
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Full-bleed Glide Data Grid with ContextMenu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            className="flex-1 w-full h-full relative" 
            id="glide-bom-grid-root"
            onKeyDown={(e) => {
              if (e.key === "Insert") {
                e.preventDefault();
                handleOpenAdd();
              } else if (e.key === "Delete" && hasSelectedRow) {
                e.preventDefault();
                handleDeleteSelected();
              } else if (e.key === "Enter" && hasSelectedRow) {
                e.preventDefault();
                handleOpenEdit(selectedRowIndex);
              }
            }}
          >
            <DataEditor
              getCellContent={getCellContent}
              columns={columns}
              rows={filteredItems.length}
              rowMarkers="both"
              freezeColumns={2}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={handleSelectionChange}
              onCellContextMenu={(cell) => {
                const [, row] = cell;
                setSelection({
                  columns: CompactSelection.empty(),
                  rows: CompactSelection.fromSingleSelection(row),
                });
              }}
              onCellActivated={(cell) => {
                const [col, row] = cell;
                const column = columns[col];
                const item = filteredItems[row];
                if (column?.id === "image" && item) {
                  setPreviewMaterial({
                    imageUrl: item.imageUrl || getMaterialImage(item),
                    title: item.name,
                    sku: item.id,
                    spec: item.spec,
                    stock: item.actualQty,
                    unit: item.unit,
                    supplier: item.supplier,
                    notes: item.notes,
                    status: item.availability,
                  });
                  return;
                }
                handleOpenEdit(row);
              }}
              onCellEdited={onCellEdited}
              onColumnResize={onColumnResize}
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={handleOpenAdd} className="gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            <span>{t("addMaterial")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
          </ContextMenuItem>

          {hasSelectedRow && (
            <ContextMenuItem onClick={() => handleOpenEdit(selectedRowIndex)} className="gap-2 cursor-pointer">
              <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
              <span>Edit Material Details</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
            </ContextMenuItem>
          )}

          {hasSelectedRow && (
            <ContextMenuItem onClick={handleDuplicateRow} className="gap-2 cursor-pointer">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t("duplicate")}</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">F9</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {hasSelectedRow && (
            <ContextMenuItem onClick={handleCopySelection} className="gap-2 cursor-pointer">
              <Copy className="w-3.5 h-3.5" />
              <span>{t("copy")}</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ctrl+C</span>
            </ContextMenuItem>
          )}

          <ContextMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t("exportCsv")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">F12</span>
          </ContextMenuItem>

          {hasSelectedRow && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={handleDeleteSelected}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("deleteMaterial")}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Add / Edit Material Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>{editingIndex !== null ? "Edit Material" : t("dialogAddTitle")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingIndex !== null ? "Update item specification and consumption values." : t("dialogAddDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            {/* Sarf turi (Issue Type) */}
            <div className="col-span-1">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("issueType")} *
              </label>
              <Select
                value={formState.issueType || "standard"}
                onValueChange={(val: any) =>
                  setFormState((p) => ({
                    ...p,
                    issueType: val,
                    faultParty: val === "standard" ? "none" : (p.faultParty === "none" ? "prepress" : p.faultParty),
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standart reja (Standard BOM)</SelectItem>
                  <SelectItem value="remake">⚠️ Qayta chiqarish (Remake / Defect)</SelectItem>
                  <SelectItem value="client_change">Mijoz o&apos;zgartirishi (Client Revision)</SelectItem>
                  <SelectItem value="press_waste">Bosma chiqindisi (Press Spoilage)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aybdor tomon / Manba (Fault Party) */}
            <div className="col-span-1">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("faultParty")}
              </label>
              <Select
                value={formState.faultParty || "none"}
                onValueChange={(val: any) => setFormState((p) => ({ ...p, faultParty: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Norma (Aybdor yo&apos;q)</SelectItem>
                  <SelectItem value="prepress">Prepress / Dizayn xatosi</SelectItem>
                  <SelectItem value="production">Sex / Stanok xatosi</SelectItem>
                  <SelectItem value="client">Mijoz (Qo&apos;shimcha to&apos;lov)</SelectItem>
                  <SelectItem value="supplier">Ta&apos;minotchi nuqsoni</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 1C-style Warehouse Nomenklatura Picker */}
            <div className="col-span-2 p-2.5 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Ombor nomenklaturasidan tanlash
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {warehouseStock.length} ta material mavjud
                </span>
              </div>

              <Popover open={isWarehousePickerOpen} onOpenChange={setIsWarehousePickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isWarehousePickerOpen}
                      className="w-full justify-between h-9 text-xs bg-background font-normal"
                    />
                  }
                >
                  <span className="truncate flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {formState.name ? (
                      <span className="font-medium text-foreground">
                        {formState.id} — {formState.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Ombordan materialni qidirish (qog&apos;oz, CTP plastina, bo&apos;yoq, lenta...)...
                      </span>
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Material nomi yoki SKU bo'yicha qidirish..." className="h-9 text-xs" />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty className="text-xs p-3 text-center text-muted-foreground">
                        Omborda bunday material topilmadi.
                      </CommandEmpty>
                      {stockCategories.map((cat) => {
                        const itemsInCat = warehouseStock.filter((s) => s.category === cat);
                        if (itemsInCat.length === 0) return null;
                        return (
                          <CommandGroup key={cat} heading={cat} className="text-xs">
                            {itemsInCat.map((stock) => {
                              const isSelected = formState.id === stock.sku;
                              return (
                                <CommandItem
                                  key={stock.sku}
                                  value={`${stock.sku} ${stock.name} ${stock.category}`}
                                  onSelect={() => handleSelectWarehouseStock(stock)}
                                  className="text-xs flex items-center justify-between py-1.5 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 max-w-[310px]">
                                    <div className="size-8 rounded border border-border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={stock.imageUrl || getMaterialImage(stock)}
                                        alt={stock.name}
                                        className="size-full object-contain select-none"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-0.5 truncate">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
                                          {stock.sku}
                                        </span>
                                        <span className="font-medium truncate">{stock.name}</span>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                        <span>{stock.sheetFormat ? `${stock.sheetFormat} mm` : stock.unit}</span>
                                        <span>•</span>
                                        <span>Joy: {stock.location}</span>
                                        <span>•</span>
                                        <span>${stock.unitPriceUsd} / {stock.unit}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <Badge
                                      variant={stock.status === "In Stock" ? "secondary" : "outline"}
                                      className={cn(
                                        "text-[10px] font-mono px-1.5 py-0",
                                        stock.available > 0
                                          ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                          : "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                                      )}
                                    >
                                      {stock.available.toLocaleString()} {stock.unit}
                                    </Badge>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected Stock Real-time Info & Deficit Warning */}
              {selectedStockItem && (
                <div className="mt-1 pt-1.5 border-t border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                    <span className="font-medium">Ombor qoldig&apos;i:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedStockItem.available.toLocaleString()} {selectedStockItem.unit}
                    </span>
                    <span className="text-muted-foreground">({selectedStockItem.location})</span>
                  </div>

                  {formState.actualQty > selectedStockItem.available ? (
                    <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium text-[10px]">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>
                        Yetishmovchilik: {(formState.actualQty - selectedStockItem.available).toLocaleString()} {selectedStockItem.unit}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Yetarli zaxira mavjud
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Material Image Preview & URL */}
            <div className="col-span-2 p-2.5 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
              <div
                className="size-14 rounded-lg border border-border overflow-hidden bg-background shrink-0 flex items-center justify-center p-1 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all"
                onClick={() => {
                  const img = formState.imageUrl || getMaterialImage(formState);
                  setPreviewMaterial({
                    imageUrl: img,
                    title: formState.name || formState.id,
                    sku: formState.id,
                    spec: formState.spec,
                    unit: formState.unit,
                    supplier: formState.supplier,
                    status: formState.availability,
                  });
                }}
                title={t("imagePreview")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formState.imageUrl || getMaterialImage(formState)}
                  alt={formState.name || "Material"}
                  className="size-full object-contain select-none"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-[11px] font-semibold text-foreground">
                  {t("image")} (Ombor nomenklaturasidan)
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {formState.imageUrl?.startsWith("data:")
                    ? "Ombor kartochkasida biriktirilgan maxsus grafik rasm"
                    : formState.imageUrl?.startsWith("http")
                    ? "Omborga havola orqali biriktirilgan rasm"
                    : "Standart avtomatik tizim shabloni"}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                  Kattalashtirish uchun rasm ustiga bosing
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("itemCode")}
              </label>
              <Input
                value={formState.id}
                onChange={(e) => setFormState((p) => ({ ...p, id: e.target.value }))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("unit")}
              </label>
              <Input
                value={formState.unit}
                onChange={(e) => setFormState((p) => ({ ...p, unit: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Sheets, kg, pcs, m..."
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("materialName")} *
              </label>
              <Input
                value={formState.name}
                onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                className="h-8 text-xs font-medium"
                placeholder="masalan: Agfa CTP, Magniy klishe, Shtamp pichoq, Qog'oz, Bo'yoq..."
                autoFocus
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("specification")}
              </label>
              <Input
                value={formState.spec}
                onChange={(e) => setFormState((p) => ({ ...p, spec: e.target.value }))}
                className="h-8 text-xs"
                placeholder="e.g. 1030x790mm, 2-sided coated"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("planQty")} (Reja normasi)
              </label>
              <Input
                type="number"
                min={0}
                value={formState.planQty}
                onChange={(e) => {
                  const pVal = parseFloat(e.target.value) || 0;
                  setFormState((p) => ({
                    ...p,
                    planQty: pVal,
                    wasteQty: Math.max(0, (p.actualQty || 0) - pVal),
                  }));
                }}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("actualQty")} (Faktik sarf) *
                </label>
                {formState.actualQty > formState.planQty && (
                  <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                    +{formState.actualQty - formState.planQty} {formState.unit} brak
                  </span>
                )}
              </div>
              <Input
                type="number"
                min={0}
                value={formState.actualQty}
                onChange={(e) => {
                  const aVal = parseFloat(e.target.value) || 0;
                  setFormState((p) => ({
                    ...p,
                    actualQty: aVal,
                    qty: aVal,
                    wasteQty: Math.max(0, aVal - (p.planQty || 0)),
                    totalPrice: Number((aVal * (p.unitPrice || 0)).toFixed(2)),
                  }));
                }}
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("unitPrice")} ($)
              </label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={formState.unitPrice}
                onChange={(e) => {
                  const uVal = parseFloat(e.target.value) || 0;
                  setFormState((p) => ({
                    ...p,
                    unitPrice: uVal,
                    totalPrice: Number(((p.actualQty || 0) * uVal).toFixed(2)),
                  }));
                }}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("totalPrice")} ($)
              </label>
              <Input
                disabled
                value={`$${Number((formState.actualQty * formState.unitPrice).toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                className="h-8 text-xs font-mono font-bold bg-muted/40 text-primary"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("notes")} (Sabab / Izoh)
              </label>
              <Input
                value={formState.notes || ""}
                onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))}
                className="h-8 text-xs"
                placeholder="masalan: Qolip/klishe yorildi, matn xatosi, kashirovka yoki qog'oz braki..."
              />
            </div>

            <div className="col-span-1">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("supplier")}
              </label>
              <Input
                value={formState.supplier}
                onChange={(e) => setFormState((p) => ({ ...p, supplier: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Vendor or supplier"
              />
            </div>

            <div className="col-span-1">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("availability")}
              </label>
              <Select
                value={formState.availability}
                onValueChange={(val: any) => val && setFormState((p) => ({ ...p, availability: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Stock">In Stock</SelectItem>
                  <SelectItem value="Reserved">Reserved</SelectItem>
                  <SelectItem value="Low Stock">Low Stock</SelectItem>
                  <SelectItem value="On Order">On Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="text-xs h-8"
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveMaterial}
              disabled={!formState.name.trim()}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingIndex !== null ? "Save Changes" : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaterialImageModal
        data={previewMaterial}
        isOpen={!!previewMaterial}
        onClose={() => setPreviewMaterial(null)}
      />
    </div>
  );
}
