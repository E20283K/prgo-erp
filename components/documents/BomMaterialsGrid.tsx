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
import { MoneyInput } from "@/components/ui/money-input";
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
  ShoppingCart,
  Package,
  AlertTriangle,
  Info,
  Truck,
  CheckCircle2,
  Calendar,
  Clock,
  Tag,
  Scale,
  UserCheck,
} from "lucide-react";

import { useWorkspaceStore, WarehouseStockRecord } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { toast } from "@/components/ui/toast";
import { MASTER_SPECIFICATIONS, MasterSpecification } from "./work-order/types";
import { MaterialImageModal, type MaterialImagePreviewData } from "@/components/documents/MaterialImageModal";

export type MaterialIssueType = "standard" | "remake" | "client_change" | "press_waste";
export type FaultParty = "none" | "prepress" | "production" | "client" | "supplier";
export type AcquisitionSource = "warehouse" | "procurement" | "client";

export interface BomItem {
  id: string;
  name: string;
  spec: string;
  category?: string;
  sheetFormat?: string;
  grammage?: number;
  grainDirection?: "Long Grain" | "Short Grain";
  rollWidthMm?: number;
  rollLengthM?: number;
  colorOrPantone?: string;
  filmMicron?: number;
  batchNo?: string;
  leadTimeDays?: number;
  warehouseLocation?: string;
  warehouseStockLevel?: number;
  warehouseAvailable?: number;
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
  sourceType?: AcquisitionSource;
  acquisitionSource?: AcquisitionSource;
}

export interface BomFormState extends BomItem {
  acquisitionSource: AcquisitionSource;
}

export function buildMaterialSpec(form: Partial<BomItem>): string {
  const parts: string[] = [];
  const cat = form.category || "";

  if (cat === "Paper & Board") {
    if (form.grammage) parts.push(`${form.grammage} g/m²`);
    if (form.sheetFormat) parts.push(`${form.sheetFormat} mm`);
    if (form.grainDirection) parts.push(form.grainDirection === "Long Grain" ? "Bo'yiga tola" : "Eniga tola");
  } else if (cat === "Roll & Label") {
    if (form.rollWidthMm) parts.push(`Eni: ${form.rollWidthMm}mm`);
    if (form.rollLengthM) parts.push(`Uzunligi: ${form.rollLengthM}m`);
    if (form.spec && !form.spec.startsWith("Eni:")) parts.push(form.spec);
  } else if (cat === "Inks & Plates") {
    if (form.colorOrPantone) parts.push(form.colorOrPantone);
    if (form.sheetFormat) parts.push(`Format: ${form.sheetFormat} mm`);
    if (form.batchNo) parts.push(`Partiya: ${form.batchNo}`);
  } else if (cat === "Foil & Film") {
    if (form.filmMicron) parts.push(`${form.filmMicron} mikron`);
    if (form.rollWidthMm) parts.push(`Eni: ${form.rollWidthMm}mm`);
    if (form.rollLengthM) parts.push(`Uzunligi: ${form.rollLengthM}m`);
  } else if (cat === "Offcuts & Scraps") {
    if (form.sheetFormat) parts.push(`Otxod: ${form.sheetFormat} mm`);
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }
  return form.spec?.trim() || "Standart parametr";
}

export function normalizeBomItem(item: any): BomItem {
  const planQty = item.planQty !== undefined ? Number(item.planQty) : (item.quantity !== undefined ? Number(item.quantity) : (item.qty !== undefined ? Number(item.qty) : 0));
  const actualQty = item.actualQty !== undefined ? Number(item.actualQty) : planQty;
  const wasteQty = item.wasteQty !== undefined ? Number(item.wasteQty) : Math.max(0, actualQty - planQty);
  const unitPrice = Number(item.unitPrice) || 0;
  const totalPrice = item.totalPrice !== undefined ? Number(item.totalPrice) : Number((actualQty * unitPrice).toFixed(2));
  return {
    id: item.id || `MAT-${Math.floor(100 + Math.random() * 900)}`,
    name: item.name || "",
    spec: item.spec || "",
    category: item.category || "",
    sheetFormat: item.sheetFormat || "",
    grammage: item.grammage !== undefined ? Number(item.grammage) : undefined,
    grainDirection: item.grainDirection || undefined,
    rollWidthMm: item.rollWidthMm !== undefined ? Number(item.rollWidthMm) : undefined,
    rollLengthM: item.rollLengthM !== undefined ? Number(item.rollLengthM) : undefined,
    colorOrPantone: item.colorOrPantone || "",
    filmMicron: item.filmMicron !== undefined ? Number(item.filmMicron) : undefined,
    batchNo: item.batchNo || "",
    leadTimeDays: item.leadTimeDays !== undefined ? Number(item.leadTimeDays) : undefined,
    warehouseLocation: item.warehouseLocation || "",
    warehouseStockLevel: item.warehouseStockLevel,
    warehouseAvailable: item.warehouseAvailable,
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
    imageUrl:
      item.imageUrl &&
      typeof item.imageUrl === "string" &&
      !item.imageUrl.startsWith("data:image/svg+xml")
        ? item.imageUrl.trim()
        : undefined,
    acquisitionSource: item.acquisitionSource || (item.supplier?.toLowerCase().includes("mijoz") ? "client" : item.availability === "On Order" || item.sourceType === "procurement" ? "procurement" : "warehouse"),
    sourceType: item.sourceType || (item.supplier?.toLowerCase().includes("mijoz") ? "client" : item.availability === "On Order" ? "procurement" : "warehouse"),
  };
}

export const OFFSET_BOM_ITEMS: BomItem[] = [];
export const FLEXO_BOM_ITEMS: BomItem[] = [];
export const JACQUARD_BOM_ITEMS: BomItem[] = [];
export const RECIPE_BOM_MAP: Record<string, BomItem[]> = {};

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
  const {
    theme,
    setTabUnsaved,
    updateGridStats,
    warehouseStock,
    loadWarehouseStock,
    suppliers,
    loadSuppliers,
    masterSpecifications,
    loadSpecificationsAsync,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [isSpecPickerOpen, setIsSpecPickerOpen] = useState(false);
  const [isWarehousePickerOpen, setIsWarehousePickerOpen] = useState(false);

  useEffect(() => {
    if (warehouseStock.length === 0 && loadWarehouseStock) loadWarehouseStock();
    if (suppliers.length === 0 && loadSuppliers) loadSuppliers();
    if (masterSpecifications.length === 0 && loadSpecificationsAsync) loadSpecificationsAsync();
  }, [warehouseStock.length, loadWarehouseStock, suppliers.length, loadSuppliers, masterSpecifications.length, loadSpecificationsAsync]);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name) set.add(s.name);
      if ((s as any).legalName) set.add((s as any).legalName);
    });
    warehouseStock.forEach((ws) => {
      if (ws.supplier) set.add(ws.supplier);
    });
    return Array.from(set);
  }, [suppliers, warehouseStock]);

  const defaultItems = (initialItems || []).map(normalizeBomItem);

  const [items, setItems] = useState<BomItem[]>(defaultItems);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialImagePreviewData | null>(null);

  // Add / Edit form state
  const [formState, setFormState] = useState<BomFormState>({
    id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
    name: "",
    spec: "",
    category: "Paper & Board",
    acquisitionSource: "warehouse",
    sheetFormat: "700×1000",
    grammage: 150,
    grainDirection: "Long Grain",
    rollWidthMm: 100,
    rollLengthM: 1000,
    planQty: 100,
    actualQty: 100,
    wasteQty: 0,
    qty: 100,
    unit: "sheets",
    unitPrice: 1.0,
    totalPrice: 100,
    supplier: "Asosiy Ombor",
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
        ? `${stock.sheetFormat} mm${stock.grammage ? `, ${stock.grammage} g/m²` : ""} · ${stock.category}`
        : stock.category;
      return {
        ...prev,
        acquisitionSource: "warehouse",
        id: stock.sku,
        name: stock.name,
        category: stock.category,
        spec,
        sheetFormat: stock.sheetFormat || stock.cutDimensions || "",
        grammage: stock.grammage,
        grainDirection: stock.grainDirection,
        rollWidthMm: stock.rollWidthMm,
        rollLengthM: stock.rollLengthM,
        batchNo: stock.batchNo,
        warehouseLocation: stock.location,
        warehouseStockLevel: stock.stockLevel,
        warehouseAvailable: stock.available,
        unit: stock.unit,
        unitPrice,
        totalPrice: Number((actualQty * unitPrice).toFixed(2)),
        supplier: stock.supplier || `Asosiy Ombor (${stock.location})`,
        availability:
          stock.available > 0
            ? "In Stock"
            : stock.stockLevel > 0
            ? "Low Stock"
            : "On Order",
        imageUrl:
          stock.imageUrl &&
          typeof stock.imageUrl === "string" &&
          !stock.imageUrl.startsWith("data:image/svg+xml")
            ? stock.imageUrl.trim()
            : undefined,
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

  // Synchronize items when initialItems prop is updated from parent or activeSpec is populated
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems.map(normalizeBomItem));
      return;
    }
    if ((!items || items.length === 0) && activeSpec && (activeSpec as any).materials && Array.isArray((activeSpec as any).materials) && (activeSpec as any).materials.length > 0) {
      const specMats = (activeSpec as any).materials.map(normalizeBomItem);
      setItems(specMats);
      if (onItemsChange) onItemsChange(specMats);
    }
  }, [initialItems, activeSpec, onItemsChange]);

  // Compute Shortage Items (items out of stock or requiring procurement)
  const shortageItems = useMemo(() => {
    return items.filter((item) => {
      // Client supplied materials never have a shortage
      if (item.acquisitionSource === "client" || item.supplier?.toLowerCase().includes("mijoz")) {
        return false;
      }
      if (item.availability === "On Order") {
        return true;
      }
      const matched = warehouseStock.find(
        (ws) =>
          ws.sku.toLowerCase() === item.id.toLowerCase() ||
          ws.name.toLowerCase() === item.name.toLowerCase()
      );
      if (matched) {
        const required = item.actualQty !== undefined ? item.actualQty : (item.qty || 0);
        return required > matched.available;
      }
      return false;
    });
  }, [items, warehouseStock]);

  // Bulk 1-Click Action: Mark all shortage items as client supplied ($0, no warehouse deduction)
  const handleMarkAllShortageAsClient = useCallback(() => {
    if (shortageItems.length === 0) return;
    const shortageIds = new Set(shortageItems.map((s) => s.id));
    const next = items.map((it) => {
      if (shortageIds.has(it.id)) {
        return {
          ...it,
          acquisitionSource: "client" as const,
          supplier: "Mijoz xomashyosi (Davalcheskiy)",
          unitPrice: 0,
          totalPrice: 0,
          availability: "In Stock" as const,
        };
      }
      return it;
    });
    setItems(next);
    if (onItemsChange) onItemsChange(next);
    if (tabId) setTabUnsaved(tabId, true);
    toast.add({
      title: "Mijoz xomashyosi qilib belgilandi",
      description: `${shortageItems.length} ta yetishmayotgan material davalcheskiy ($0) deb belgilandi.`,
      type: "success",
    });
  }, [shortageItems, items, onItemsChange, tabId, setTabUnsaved]);

  // Bulk 1-Click Action: Request Purchase Order (PO) for all shortage items
  const handleCreateProcurementPO = useCallback(() => {
    if (shortageItems.length === 0) return;
    const shortageIds = new Set(shortageItems.map((s) => s.id));
    const next = items.map((it) => {
      if (shortageIds.has(it.id)) {
        return {
          ...it,
          acquisitionSource: "procurement" as const,
          availability: "On Order" as const,
          supplier: it.supplier && !it.supplier.includes("Ombor") ? it.supplier : "Approved Supplier",
        };
      }
      return it;
    });
    setItems(next);
    if (onItemsChange) onItemsChange(next);
    if (tabId) setTabUnsaved(tabId, true);
    toast.add({
      title: "Ta'minotga xarid so'rovi (PO) yuborildi",
      description: `${shortageItems.length} ta material xaridga buyurtma qilindi (On Order).`,
      type: "info",
    });
  }, [shortageItems, items, onItemsChange, tabId, setTabUnsaved]);

  // Toggle selected row between client material and warehouse material
  const handleMarkSelectedAsClient = useCallback(() => {
    if (!hasSelectedRow || selectedRowIndex === undefined) return;
    const target = items[selectedRowIndex];
    if (!target) return;
    const isCurrentlyClient = target.acquisitionSource === "client" || target.supplier?.toLowerCase().includes("mijoz");
    const next = [...items];
    if (isCurrentlyClient) {
      next[selectedRowIndex] = {
        ...target,
        acquisitionSource: "warehouse",
        supplier: "Asosiy Ombor",
        availability: "In Stock",
      };
      toast.add({
        title: "Ombor materialiga qaytarildi",
        description: `${target.name} korxona ombori hisobiga o'tkazildi.`,
        type: "info",
      });
    } else {
      next[selectedRowIndex] = {
        ...target,
        acquisitionSource: "client",
        supplier: "Mijoz xomashyosi (Davalcheskiy)",
        unitPrice: 0,
        totalPrice: 0,
        availability: "In Stock",
      };
      toast.add({
        title: "Mijoz xomashyosi qilib belgilandi",
        description: `${target.name} davalcheskiy ($0) deb belgilandi.`,
        type: "success",
      });
    }
    setItems(next);
    if (onItemsChange) onItemsChange(next);
    if (tabId) setTabUnsaved(tabId, true);
  }, [hasSelectedRow, selectedRowIndex, items, onItemsChange, tabId, setTabUnsaved]);

  const handleSelectSpecification = useCallback((spec: any) => {
    if (onRecipeChange) {
      onRecipeChange(spec.code, spec.department);
    }
    const specMaterials = spec.materials;
    if (specMaterials && Array.isArray(specMaterials) && specMaterials.length > 0) {
      const mapped = specMaterials.map(normalizeBomItem);
      setItems(mapped);
      if (onItemsChange) onItemsChange(mapped);
    }
    if (tabId) setTabUnsaved(tabId, true);
    toast.add({
      title: "Shablon biriktirildi",
      description: `${spec.code}: ${spec.name}`,
      type: "success",
    });
    setIsSpecPickerOpen(false);
  }, [onRecipeChange, onItemsChange, tabId, setTabUnsaved]);

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
          const img =
            item.imageUrl &&
            typeof item.imageUrl === "string" &&
            !item.imageUrl.startsWith("data:image/svg+xml")
              ? item.imageUrl.trim()
              : "";
          if (img) {
            return {
              kind: GridCellKind.Image,
              data: [img],
              displayData: [img],
              allowOverlay: true,
            };
          }
          return {
            kind: GridCellKind.Text,
            data: "",
            displayData: "—",
            allowOverlay: false,
            contentAlign: "center",
            themeOverride: {
              textDark: isDark ? "#64748b" : "#94a3b8",
              baseFontStyle: "11px monospace",
            },
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
              ? "Qayta (Remake)"
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
        case "supplier": {
          const isClient = item.acquisitionSource === "client" || item.supplier?.toLowerCase().includes("mijoz");
          return {
            kind: GridCellKind.Text,
            data: item.supplier,
            displayData: item.supplier,
            allowOverlay: true,
            themeOverride: {
              textDark: isClient
                ? (isDark ? "#34d399" : "#059669")
                : (isDark ? "#e4e4e7" : "#18181b"),
              baseFontStyle: isClient ? "600 11px sans-serif" : undefined,
            },
          };
        }
        case "availability": {
          const isClient = item.acquisitionSource === "client" || item.supplier?.toLowerCase().includes("mijoz");
          const isStock = item.availability === "In Stock";
          const isReserved = item.availability === "Reserved";
          const isLow = item.availability === "Low Stock";
          const statusColor = isClient
            ? (isDark ? "#34d399" : "#059669")
            : isStock
            ? (isDark ? "#4ade80" : "#16a34a")
            : isReserved
            ? (isDark ? "#60a5fa" : "#2563eb")
            : isLow
            ? (isDark ? "#fbbf24" : "#d97706")
            : (isDark ? "#f87171" : "#dc2626");

          const displayLabel = isClient ? "Mijozniki" : item.availability;

          return {
            kind: GridCellKind.Text,
            data: displayLabel,
            displayData: displayLabel,
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

      setItems((prev) => {
        const next = prev.map((item) => {
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
        });
        if (onItemsChange) onItemsChange(next);
        return next;
      });

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
      category: "Paper & Board",
      acquisitionSource: "warehouse",
      sheetFormat: "700×1000",
      grammage: 150,
      grainDirection: "Long Grain",
      rollWidthMm: 100,
      rollLengthM: 1000,
      planQty: 100,
      actualQty: 100,
      wasteQty: 0,
      qty: 100,
      unit: "sheets",
      unitPrice: 1.0,
      totalPrice: 100,
      supplier: "Asosiy Ombor",
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
    const normalized = normalizeBomItem(item);
    const isClient = normalized.acquisitionSource === "client" || normalized.supplier?.toLowerCase().includes("mijoz");
    const isProcurement = !isClient && (normalized.availability === "On Order" || normalized.sourceType === "procurement");

    // Auto-detect category if missing
    let detectedCategory = normalized.category || "Paper & Board";
    if (!normalized.category) {
      const lower = (normalized.name + " " + normalized.spec).toLowerCase();
      if (normalized.unit === "sheets" || lower.includes("paper") || lower.includes("qog'oz") || lower.includes("karton") || lower.includes("silk")) {
        detectedCategory = "Paper & Board";
      } else if (normalized.unit === "rolls" || lower.includes("roll") || lower.includes("rulon") || lower.includes("tape") || lower.includes("label")) {
        detectedCategory = "Roll & Label";
      } else if (normalized.unit === "kg" || lower.includes("ink") || lower.includes("bo'yoq") || lower.includes("plate") || lower.includes("ctp")) {
        detectedCategory = "Inks & Plates";
      } else if (lower.includes("film") || lower.includes("lam") || lower.includes("foil") || lower.includes("zar")) {
        detectedCategory = "Foil & Film";
      } else if (lower.includes("glue") || lower.includes("yelim") || lower.includes("wire") || lower.includes("ip")) {
        detectedCategory = "Adhesives & Binding";
      }
    }

    setFormState({
      ...normalized,
      acquisitionSource: isClient ? "client" : isProcurement ? "procurement" : "warehouse",
      category: detectedCategory,
      sheetFormat: normalized.sheetFormat || (normalized.spec?.match(/\d+x\d+|\d+×\d+/) ? normalized.spec.match(/\d+x\d+|\d+×\d+/)?.[0] : ""),
      grammage: normalized.grammage || (normalized.spec?.match(/(\d+)\s*g\/m²/) ? Number(normalized.spec.match(/(\d+)\s*g\/m²/)?.[1]) : undefined),
      grainDirection: normalized.grainDirection || "Long Grain",
      rollWidthMm: normalized.rollWidthMm || (normalized.spec?.match(/(\d+)\s*mm/) ? Number(normalized.spec.match(/(\d+)\s*mm/)?.[1]) : undefined),
      rollLengthM: normalized.rollLengthM || (normalized.spec?.match(/(\d+)\s*m\b/) ? Number(normalized.spec.match(/(\d+)\s*m\b/)?.[1]) : undefined),
      colorOrPantone: normalized.colorOrPantone || (normalized.spec?.includes("CMYK") ? "Process CMYK" : ""),
      batchNo: normalized.batchNo || "",
      leadTimeDays: normalized.leadTimeDays || 3,
    });
    setIsDialogOpen(true);
  };

  // Save Add/Edit Material handler
  const handleSaveMaterial = () => {
    if (!formState.name.trim()) {
      toast.add({
        title: "Xatolik",
        description: "Iltimos, material nomini kiriting yoki ombordan tanlang.",
        type: "danger",
      });
      return;
    }

    const planQty = Number(formState.planQty) || 0;
    const actualQty = Number(formState.actualQty) || 0;
    const wasteQty = formState.wasteQty !== undefined ? Number(formState.wasteQty) : Math.max(0, actualQty - planQty);

    const finalSpec = buildMaterialSpec(formState);
    const finalAvailability = formState.acquisitionSource === "client"
      ? "In Stock"
      : formState.acquisitionSource === "procurement"
      ? "On Order"
      : (formState.availability || "In Stock");

    const unitPrice = formState.acquisitionSource === "client" ? 0 : (Number(formState.unitPrice) || 0);
    const supplier = formState.supplier?.trim() || (
      formState.acquisitionSource === "client"
        ? "Mijoz xomashyosi (Davalcheskiy)"
        : formState.acquisitionSource === "warehouse"
        ? "Asosiy Ombor"
        : "Approved Supplier"
    );

    const itemToSave: BomItem = {
      ...formState,
      name: formState.name.trim(),
      spec: finalSpec,
      category: formState.category,
      sheetFormat: formState.sheetFormat,
      grammage: formState.grammage,
      grainDirection: formState.grainDirection,
      rollWidthMm: formState.rollWidthMm,
      rollLengthM: formState.rollLengthM,
      colorOrPantone: formState.colorOrPantone,
      batchNo: formState.batchNo,
      leadTimeDays: formState.leadTimeDays,
      planQty,
      actualQty,
      wasteQty,
      qty: actualQty,
      unit: formState.unit?.trim() || "pcs",
      unitPrice,
      totalPrice: Number((actualQty * unitPrice).toFixed(2)),
      supplier,
      availability: finalAvailability,
      issueType: formState.issueType || "standard",
      faultParty: formState.faultParty || "none",
      notes: formState.notes?.trim() || "",
      imageUrl:
        formState.imageUrl &&
        typeof formState.imageUrl === "string" &&
        !formState.imageUrl.startsWith("data:image/svg+xml")
          ? formState.imageUrl.trim()
          : undefined,
      sourceType: formState.acquisitionSource,
      acquisitionSource: formState.acquisitionSource,
    };

    if (editingIndex !== null) {
      setItems((prev) => {
        const next = [...prev];
        next[editingIndex] = itemToSave;
        if (onItemsChange) onItemsChange(next);
        return next;
      });
      toast.add({
        title: "Material yangilandi",
        description: `${itemToSave.id} (${itemToSave.name}) muvaffaqiyatli saqlandi.`,
        type: "success",
      });
    } else {
      setItems((prev) => {
        const next = [...prev, itemToSave];
        if (onItemsChange) onItemsChange(next);
        return next;
      });
      toast.add({
        title: formState.acquisitionSource === "client"
          ? "Mijoz xomashyosi qo'shildi"
          : formState.acquisitionSource === "procurement"
          ? "Xaridga buyurtma qo'shildi"
          : itemToSave.issueType === "remake"
          ? "CTP / Brak qayd etildi"
          : t("addMaterial"),
        description: `${itemToSave.name} (${itemToSave.actualQty} ${itemToSave.unit}) BOM ga kiritildi.`,
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

    setItems((prev) => {
      const next = prev.filter((m) => !idsToDelete.has(m.id));
      if (onItemsChange) onItemsChange(next);
      return next;
    });
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
  }, [selection, filteredItems, tabId, setTabUnsaved, t, onItemsChange]);

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

    setItems((prev) => {
      const next = [...prev, duplicated];
      if (onItemsChange) onItemsChange(next);
      return next;
    });
    if (tabId) setTabUnsaved(tabId, true);

    toast.add({
      title: t("duplicate"),
      description: t("toastAdded", { code: duplicated.id }),
      type: "success",
    });
  }, [selection, filteredItems, tabId, setTabUnsaved, t, onItemsChange]);

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
          {/* Master BOM Specification Indicator & Action Menu */}
          {(activeSpec || recipe) ? (
            <div className="flex items-center gap-1.5 shrink-0 bg-muted/40 hover:bg-muted/70 transition-colors border border-border/80 rounded px-2 py-0.5">
              <span className="text-[11px] font-medium text-muted-foreground hidden xl:inline shrink-0">
                Retsept:
              </span>
              <button
                type="button"
                onClick={() => setIsSpecPickerOpen(true)}
                title="Boshqa shablon tanlash uchun bosing"
                className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer hover:opacity-85"
              >
                <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                  {activeSpec?.code || recipe}
                </span>
                {activeSpec?.name && activeSpec.name !== (activeSpec.code || recipe) && (
                  <span className="truncate text-xs font-medium text-foreground max-w-[140px] sm:max-w-[200px]">
                    {activeSpec.name}
                  </span>
                )}
              </button>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-5 w-5 p-0 ml-1 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        }
                      />
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                    Spetsifikatsiya amallari
                  </TooltipContent>
                </Tooltip>

                <DropdownMenuContent align="start" className="w-60 text-xs">
                  <DropdownMenuItem
                    onClick={() => setIsSpecPickerOpen(true)}
                    className="gap-2 cursor-pointer font-medium text-foreground"
                  >
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>Shablonni almashtirish / tanlash</span>
                  </DropdownMenuItem>

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

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (onRecipeChange) onRecipeChange("", "");
                      setItems([]);
                      if (onItemsChange) onItemsChange([]);
                      if (tabId) setTabUnsaved(tabId, true);
                      toast.add({
                        title: "Shablon olib tashlandi",
                        description: "Buyruq erkin retseptsiz rejimga o'tkazildi",
                        type: "info",
                      });
                    }}
                    className="gap-2 cursor-pointer text-muted-foreground"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Shablonni olib tashlash (bo'shatish)</span>
                  </DropdownMenuItem>

                  {recipe && RECIPE_BOM_MAP[recipe] && (
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
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Separator orientation="vertical" className="h-4 mx-0.5" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0 bg-muted/40 border border-border/80 rounded px-2 py-0.5">
              <span className="text-[11px] font-medium text-muted-foreground hidden xl:inline shrink-0">
                Retsept:
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSpecPickerOpen(true)}
                className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground font-normal gap-1 cursor-pointer"
              >
                <Layers className="size-3 text-primary" />
                <span>Shablon biriktirish</span>
              </Button>
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
                      onClick={handleMarkSelectedAsClient}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0",
                        items[selectedRowIndex]?.acquisitionSource === "client" || items[selectedRowIndex]?.supplier?.toLowerCase().includes("mijoz")
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      <span className="hidden sm:inline">
                        {items[selectedRowIndex]?.acquisitionSource === "client" || items[selectedRowIndex]?.supplier?.toLowerCase().includes("mijoz") ? "Mijozniki" : "Mijozniki qilish"}
                      </span>
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  Mijoz xomashyosi (Davalcheskiy $0) deb belgilash yoki omborga qaytarish
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

      {/* Shortage & Procurement Alert Strip */}
      {shortageItems.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/25 text-xs shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-medium text-amber-950 dark:text-amber-200 truncate">
              {shortageItems.length} ta material omborda yetarli emas yoki xarid talab qiladi:
            </span>
            <div className="hidden lg:flex items-center gap-1 overflow-hidden">
              {shortageItems.slice(0, 2).map((si) => (
                <span key={si.id} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-300 font-medium">
                  {si.id}: {si.name}
                </span>
              ))}
              {shortageItems.length > 2 && (
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                  +{shortageItems.length - 2} ta
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkAllShortageAsClient}
              className="h-6 px-2 text-[11px] font-medium border-amber-500/35 text-amber-950 dark:text-amber-200 hover:bg-amber-500/20 gap-1 rounded cursor-pointer"
            >
              <UserCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>Mijoz xomashyosi deb belgilash</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateProcurementPO}
              className="h-6 px-2 text-[11px] font-medium bg-amber-600 hover:bg-amber-700 text-white gap-1 rounded cursor-pointer shadow-none"
            >
              <ShoppingCart className="size-3" />
              <span>Ta&apos;minotga xarid so&apos;rovi (PO)</span>
            </Button>
          </div>
        </div>
      )}

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
                  const img =
                    item.imageUrl &&
                    typeof item.imageUrl === "string" &&
                    !item.imageUrl.startsWith("data:image/svg+xml")
                      ? item.imageUrl.trim()
                      : "";
                  if (img) {
                    setPreviewMaterial({
                      imageUrl: img,
                      title: item.name,
                      sku: item.id,
                      spec: item.spec,
                      stock: item.actualQty,
                      unit: item.unit,
                      supplier: item.supplier,
                      notes: item.notes,
                      status: item.availability,
                    });
                  }
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
            {filteredItems.length === 0 && (
              <div className="absolute inset-0 top-7 flex flex-col items-center justify-center pointer-events-none text-muted-foreground z-10 select-none">
                <Package className="size-8 text-muted-foreground/30 mb-2" />
                <span className="text-xs font-medium">BOM ro&apos;yxatida materiallar mavjud emas</span>
                <span className="text-[11px] text-muted-foreground/70">Material kiritish yoki ombordan tanlash uchun yuqoridagi tugmalardan foydalaning</span>
              </div>
            )}
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

      {/* Compact & Elongated (Uzunroq) BOM Material Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[490px] min-h-[460px] p-0 overflow-hidden text-xs flex flex-col gap-0 max-h-[90vh]">
          {/* Header with Title and Mode Switcher in single row, with pr-10 to prevent colliding with close X button */}
          <DialogHeader className="px-4 py-2.5 pr-10 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Boxes className="size-4 text-primary" />
                <span>{editingIndex !== null ? "Materialni tahrirlash" : "Material kiritish (BOM)"}</span>
              </DialogTitle>

              {/* Segmented Source Switch */}
              <div className="inline-flex items-center p-0.5 rounded-md bg-muted border border-border text-[11px] mr-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      acquisitionSource: "warehouse",
                      availability: (selectedStockItem && selectedStockItem.available > 0) ? "In Stock" : "Low Stock",
                    }));
                  }}
                  className={cn(
                    "px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1",
                    formState.acquisitionSource === "warehouse"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Warehouse className="size-3 text-blue-600" />
                  <span>Ombordan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      acquisitionSource: "procurement",
                      availability: "On Order",
                      supplier: prev.supplier && !prev.supplier.includes("Ombor") ? prev.supplier : "Approved Supplier",
                    }));
                  }}
                  className={cn(
                    "px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1",
                    formState.acquisitionSource === "procurement"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ShoppingCart className="size-3 text-amber-600" />
                  <span>Xaridga</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      acquisitionSource: "client",
                      availability: "In Stock",
                      supplier: "Mijoz xomashyosi (Davalcheskiy)",
                      unitPrice: 0,
                      totalPrice: 0,
                    }));
                  }}
                  className={cn(
                    "px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1",
                    formState.acquisitionSource === "client"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <UserCheck className="size-3 text-emerald-600" />
                  <span>Mijozniki</span>
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Form Body - Compact & Clean */}
          <div className="p-4 space-y-3 text-xs bg-background overflow-y-auto flex-1">
            {/* ── 1. MATERIAL SOURCE SELECTION ── */}
            {formState.acquisitionSource === "warehouse" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Ombor xomashyosi *
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {warehouseStock.length} ta mavjud
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
                        className="w-full justify-between h-8 text-xs bg-background font-normal"
                      />
                    }
                  >
                    <span className="truncate flex items-center gap-2">
                      <Search className="size-3.5 text-muted-foreground shrink-0" />
                      {formState.name ? (
                        <span className="font-medium text-foreground">
                          {formState.id} — {formState.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Materialni qidirish va tanlash...
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Material nomi yoki SKU bo'yicha..." className="h-8 text-xs" />
                      <CommandList className="max-h-[240px]">
                        <CommandEmpty className="text-xs p-3 text-center text-muted-foreground">
                          Omborda material topilmadi.
                        </CommandEmpty>
                        {stockCategories.map((cat) => {
                          const itemsInCat = warehouseStock.filter((s) => s.category === cat);
                          if (itemsInCat.length === 0) return null;
                          return (
                            <CommandGroup key={cat} heading={cat} className="text-xs">
                              {itemsInCat.map((stock) => (
                                <CommandItem
                                  key={stock.sku}
                                  value={`${stock.sku} ${stock.name} ${stock.category}`}
                                  onSelect={() => handleSelectWarehouseStock(stock)}
                                  className="text-xs flex items-center justify-between py-1.5 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
                                      {stock.sku}
                                    </span>
                                    <span className="truncate">{stock.name}</span>
                                    {stock.sheetFormat && (
                                      <span className="text-[10px] text-muted-foreground">({stock.sheetFormat}mm)</span>
                                    )}
                                  </div>
                                  <Badge
                                    variant={stock.available > 0 ? "secondary" : "outline"}
                                    className={cn(
                                      "text-[10px] font-mono px-1 py-0 shrink-0",
                                      stock.available > 0
                                        ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                                    )}
                                  >
                                    {stock.available.toLocaleString()} {stock.unit}
                                  </Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Single-line Stock Status Strip */}
                {selectedStockItem && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-muted/40 border border-border text-[11px]">
                    <div className="flex items-center gap-2 text-muted-foreground truncate">
                      <span>Joy: <b className="text-foreground">{selectedStockItem.location || "Asosiy"}</b></span>
                      <span>•</span>
                      <span>Mavjud: <b className={cn("font-mono", selectedStockItem.available > 0 ? "text-emerald-600" : "text-rose-600")}>{selectedStockItem.available.toLocaleString()} {selectedStockItem.unit}</b></span>
                      <span>•</span>
                      <span>Narx: <b className="text-foreground font-mono">${selectedStockItem.unitPriceUsd}</b></span>
                    </div>
                    {formState.actualQty > selectedStockItem.available && (
                      <span className="text-[10px] font-mono font-semibold text-rose-600 shrink-0">
                        Yetishmovchilik: {formState.actualQty - selectedStockItem.available}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : formState.acquisitionSource === "client" ? (
              /* Client-Supplied Material Form: Compact & Clean */
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-[11px]">
                  <UserCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Mijoz tomonidan keltiriladigan davalcheskiy xomashyo. Tan narxi $0 hisoblanadi va korxona omboridan hisobdan chiqarilmaydi.</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Toifasi *
                    </label>
                    <Select
                      value={formState.category || "Paper & Board"}
                      onValueChange={(val) => {
                        let defaultUnit = "sheets";
                        if (val === "Roll & Label") defaultUnit = "rolls";
                        else if (val === "Inks & Plates") defaultUnit = "kg";
                        else if (val === "Foil & Film") defaultUnit = "m";
                        else if (val === "Adhesives & Binding") defaultUnit = "kg";
                        setFormState((p) => ({
                          ...p,
                          category: val || "Paper & Board",
                          unit: defaultUnit,
                        }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paper & Board">Paper & Board</SelectItem>
                        <SelectItem value="Roll & Label">Roll & Label</SelectItem>
                        <SelectItem value="Inks & Plates">Inks & Plates</SelectItem>
                        <SelectItem value="Foil & Film">Foil & Film</SelectItem>
                        <SelectItem value="Adhesives & Binding">Adhesives</SelectItem>
                        <SelectItem value="Offcuts & Scraps">Delovoy Otxod</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Mijoz xomashyosi nomi *
                    </label>
                    <Input
                      value={formState.name}
                      onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                      className="h-8 text-xs font-medium"
                      placeholder="masalan: Mijoz qog'ozi: Arctic Silk 170g..."
                      autoFocus
                    />
                  </div>
                </div>

                {/* Category parameters in 1 line */}
                {formState.category === "Paper & Board" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Format (mm)</label>
                      <Input
                        value={formState.sheetFormat || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, sheetFormat: e.target.value }))}
                        placeholder="700×1000"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Zichlik (g/m²)</label>
                      <Input
                        type="number"
                        value={formState.grammage || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, grammage: Number(e.target.value) || undefined }))}
                        placeholder="150"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Tola yo&apos;nalishi</label>
                      <Select
                        value={formState.grainDirection || "Long Grain"}
                        onValueChange={(val: any) => setFormState((p) => ({ ...p, grainDirection: val }))}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Long Grain">Long Grain</SelectItem>
                          <SelectItem value="Short Grain">Short Grain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {formState.category === "Roll & Label" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Rulon eni (mm)</label>
                      <Input
                        type="number"
                        value={formState.rollWidthMm || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, rollWidthMm: Number(e.target.value) || undefined }))}
                        placeholder="100"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Uzunligi (m)</label>
                      <Input
                        type="number"
                        value={formState.rollLengthM || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, rollLengthM: Number(e.target.value) || undefined }))}
                        placeholder="1000"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Procurement Form: Compact 2 rows */
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Toifasi *
                    </label>
                    <Select
                      value={formState.category || "Paper & Board"}
                      onValueChange={(val) => {
                        let defaultUnit = "sheets";
                        if (val === "Roll & Label") defaultUnit = "rolls";
                        else if (val === "Inks & Plates") defaultUnit = "kg";
                        else if (val === "Foil & Film") defaultUnit = "m";
                        else if (val === "Adhesives & Binding") defaultUnit = "kg";
                        setFormState((p) => ({
                          ...p,
                          category: val || "Paper & Board",
                          unit: defaultUnit,
                        }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paper & Board">Paper & Board</SelectItem>
                        <SelectItem value="Roll & Label">Roll & Label</SelectItem>
                        <SelectItem value="Inks & Plates">Inks & Plates</SelectItem>
                        <SelectItem value="Foil & Film">Foil & Film</SelectItem>
                        <SelectItem value="Adhesives & Binding">Adhesives</SelectItem>
                        <SelectItem value="Offcuts & Scraps">Delovoy Otxod</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Material nomi *
                    </label>
                    <Input
                      value={formState.name}
                      onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                      className="h-8 text-xs font-medium"
                      placeholder="masalan: Galerie Art Silk, Kurz Gold..."
                      autoFocus
                    />
                  </div>
                </div>

                {/* Category parameters in 1 line */}
                {formState.category === "Paper & Board" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Format (mm)</label>
                      <Input
                        value={formState.sheetFormat || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, sheetFormat: e.target.value }))}
                        placeholder="700×1000"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Zichlik (g/m²)</label>
                      <Input
                        type="number"
                        value={formState.grammage || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, grammage: Number(e.target.value) || undefined }))}
                        placeholder="150"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Tola yo&apos;nalishi</label>
                      <Select
                        value={formState.grainDirection || "Long Grain"}
                        onValueChange={(val: any) => setFormState((p) => ({ ...p, grainDirection: val }))}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Long Grain">Long Grain</SelectItem>
                          <SelectItem value="Short Grain">Short Grain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {formState.category === "Roll & Label" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Rulon eni (mm)</label>
                      <Input
                        type="number"
                        value={formState.rollWidthMm || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, rollWidthMm: Number(e.target.value) || undefined }))}
                        placeholder="100"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Uzunligi (m)</label>
                      <Input
                        type="number"
                        value={formState.rollLengthM || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, rollLengthM: Number(e.target.value) || undefined }))}
                        placeholder="1000"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {formState.category === "Inks & Plates" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Rang / Pantone / Format</label>
                      <Input
                        value={formState.colorOrPantone || formState.sheetFormat || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, colorOrPantone: e.target.value, sheetFormat: e.target.value }))}
                        placeholder="CMYK Cyan / 1030×790"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Yetkazib beruvchi</label>
                      <Input
                        list="supplier-options-list"
                        value={formState.supplier}
                        onChange={(e) => setFormState((p) => ({ ...p, supplier: e.target.value }))}
                        className="h-7 text-xs"
                        placeholder="Supplier..."
                      />
                      <datalist id="supplier-options-list">
                        {supplierOptions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                )}

                {formState.category !== "Paper & Board" && formState.category !== "Roll & Label" && formState.category !== "Inks & Plates" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Xususiyati / O&apos;lcham</label>
                      <Input
                        value={formState.spec || ""}
                        onChange={(e) => setFormState((p) => ({ ...p, spec: e.target.value }))}
                        placeholder="Standart o'lcham..."
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Yetkazib beruvchi</label>
                      <Input
                        value={formState.supplier}
                        onChange={(e) => setFormState((p) => ({ ...p, supplier: e.target.value }))}
                        className="h-7 text-xs"
                        placeholder="Supplier..."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 2. QUANTITIES & COSTING (4 compact inputs in 1 row) ── */}
            <div className="space-y-1.5 pt-1 border-t border-border/80">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Reja norma</label>
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
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Faktik sarf *</label>
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
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Birlik</label>
                  <Input
                    value={formState.unit}
                    onChange={(e) => setFormState((p) => ({ ...p, unit: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="sheets..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Narx ($)</label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={3}
                    min={0}
                    value={formState.unitPrice}
                    onValueChange={(values) => {
                      const uVal = values.floatValue ?? 0;
                      setFormState((p) => ({
                        ...p,
                        unitPrice: uVal,
                        totalPrice: Number(((p.actualQty || 0) * uVal).toFixed(2)),
                      }));
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Summary line */}
              <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Jami summa:</span>
                  <span className="font-mono font-bold text-foreground">
                    ${Number((formState.actualQty * formState.unitPrice).toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {formState.acquisitionSource === "client" ? (
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      Mijoz hisobidan ($0)
                    </Badge>
                  ) : (
                    <>
                      {formState.actualQty > formState.planQty && (
                        <span className="text-[10px] font-mono text-rose-600 font-semibold">
                          +{formState.actualQty - formState.planQty} brak
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1 py-0",
                          formState.availability === "On Order"
                            ? "border-amber-400 text-amber-600"
                            : "text-emerald-700 dark:text-emerald-400 border-emerald-300"
                        )}
                      >
                        {formState.availability}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── 3. ISSUE TYPE & NOTES (Compact 2 columns) ── */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/80">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Sarf turi</label>
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
                    <SelectItem value="standard">Standart reja (BOM)</SelectItem>
                    <SelectItem value="remake">Qayta chiqarish (Remake)</SelectItem>
                    <SelectItem value="client_change">Mijoz tuzatishi</SelectItem>
                    <SelectItem value="press_waste">Bosma chiqindisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Izoh / Sabab</label>
                <Input
                  value={formState.notes || ""}
                  onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Qisqa izoh..."
                />
              </div>
            </div>
          </div>

          {/* Compact Footer without negative margins */}
          <DialogFooter className="m-0 mx-0 mb-0 px-4 py-3 border-t border-border bg-card flex flex-row items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="text-xs h-8 px-3"
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveMaterial}
              disabled={!formState.name.trim()}
              className="text-xs h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white gap-1"
            >
              <Check className="size-3.5" />
              <span>{editingIndex !== null ? "Saqlash" : "Qo'shish"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaterialImageModal
        data={previewMaterial}
        isOpen={!!previewMaterial}
        onClose={() => setPreviewMaterial(null)}
      />

      {/* ── 3. SPECIFICATION / BOM TEMPLATE PICKER DIALOG ── */}
      <Dialog open={isSpecPickerOpen} onOpenChange={setIsSpecPickerOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border border-border">
          <DialogHeader className="px-4 py-3 border-b border-border bg-muted/20">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Spetsifikatsiya / Shablon tanlash</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Buyurtmaga biriktirish uchun texkarta va standart xomashyo normasini tanlang.
            </DialogDescription>
          </DialogHeader>

          <Command className="w-full">
            <CommandInput placeholder="Shablon yoki mahsulot nomi bo'yicha qidirish..." className="h-9 text-xs" />
            <CommandList className="max-h-80 p-2">
              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                Mos keluvchi spetsifikatsiya topilmadi.
              </CommandEmpty>

              {(["Offset", "Flexo", "Jacquard", "Post-press"] as const).map((dept) => {
                const deptSpecs = (masterSpecifications || []).filter((s) => s.department === dept);
                if (deptSpecs.length === 0) return null;

                return (
                  <CommandGroup key={dept} heading={`${dept} bo'limi`} className="mb-2">
                    {deptSpecs.map((spec) => {
                      const isSelected = (activeSpec?.code || recipe) === spec.code;
                      return (
                        <CommandItem
                          key={spec.code}
                          value={`${spec.code} ${spec.name} ${spec.department} ${spec.description || ""}`}
                          onSelect={() => handleSelectSpecification(spec)}
                          className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5 rounded hover:bg-muted"
                        >
                          <div className="mt-0.5 shrink-0">
                            <Check className={cn("size-3.5 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
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
                            {spec.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {spec.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5 font-mono">
                              <span>{(spec as any).materialsCount || (Array.isArray((spec as any).materials) ? (spec as any).materials.length : 0)} xomashyo</span>
                              {spec.estimatedCost && (
                                <>
                                  <span>•</span>
                                  <span>{spec.estimatedCost}</span>
                                </>
                              )}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
