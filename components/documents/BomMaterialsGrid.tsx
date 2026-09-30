"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Download,
  Search,
  Copy,
  Boxes,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { toast } from "@/components/ui/toast";

export interface BomItem {
  id: string;
  name: string;
  spec: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  supplier: string;
  availability: "In Stock" | "Reserved" | "Low Stock" | "On Order";
}

const DEFAULT_BOM_ITEMS: BomItem[] = [
  {
    id: "MAT-PAP-014",
    name: "Galerie Art Silk Paper",
    spec: "150 g/m², 700x1000mm",
    qty: 12500,
    unit: "Sheets",
    unitPrice: 0.42,
    totalPrice: 5250.00,
    supplier: "Sappi Paper Mill",
    availability: "In Stock",
  },
  {
    id: "MAT-INK-CMYK",
    name: "Hubergroup Eco-Offset Ink Set",
    spec: "Process CMYK (4x2.5kg)",
    qty: 36,
    unit: "kg",
    unitPrice: 24.00,
    totalPrice: 864.00,
    supplier: "Hubergroup Print",
    availability: "In Stock",
  },
  {
    id: "MAT-PLT-CTP",
    name: "Agfa CTP Thermal Plates",
    spec: "1030x790mm 0.3mm",
    qty: 24,
    unit: "pcs",
    unitPrice: 18.50,
    totalPrice: 444.00,
    supplier: "Agfa Graphics",
    availability: "In Stock",
  },
  {
    id: "MAT-LAM-M01",
    name: "Soft-Touch Matte Thermal Film",
    spec: "BOPP 32 micron 700mm",
    qty: 2400,
    unit: "m",
    unitPrice: 0.32,
    totalPrice: 768.00,
    supplier: "Dunmore Films",
    availability: "In Stock",
  },
  {
    id: "MAT-GLU-HOT",
    name: "Henkel Technomelt Hotmelt Adhesive",
    spec: "PUR binding polymer granulate",
    qty: 15,
    unit: "kg",
    unitPrice: 32.00,
    totalPrice: 480.00,
    supplier: "Henkel Industrial",
    availability: "In Stock",
  },
  {
    id: "MAT-BOX-CRG",
    name: "Corrugated Shipping Cartons",
    spec: "Double-wall 400x300x250mm",
    qty: 120,
    unit: "pcs",
    unitPrice: 1.45,
    totalPrice: 174.00,
    supplier: "Smurfit Kappa",
    availability: "Reserved",
  },
];

interface BomMaterialsGridProps {
  tabId: string;
  initialItems?: BomItem[];
  onTotalCostChange?: (total: number) => void;
}

export function BomMaterialsGrid({
  tabId,
  initialItems = DEFAULT_BOM_ITEMS,
  onTotalCostChange,
}: BomMaterialsGridProps) {
  const t = useTranslations("BOM");
  const { theme, setTabUnsaved, updateGridStats } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [items, setItems] = useState<BomItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New item form state
  const [newItem, setNewItem] = useState({
    id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
    name: "",
    spec: "",
    qty: 100,
    unit: "pcs",
    unitPrice: 1.0,
    supplier: "Local Distributor",
    availability: "In Stock" as BomItem["availability"],
  });

  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "id", title: t("itemCode"), width: 130, icon: GridColumnIcon.HeaderReference },
    { id: "name", title: t("materialName"), width: 230, icon: GridColumnIcon.HeaderString },
    { id: "spec", title: t("specification"), width: 240, icon: GridColumnIcon.HeaderTextTemplate },
    { id: "qty", title: t("requiredQty"), width: 120, icon: GridColumnIcon.HeaderNumber },
    { id: "unit", title: t("unit"), width: 90, icon: GridColumnIcon.HeaderLookup },
    { id: "unitPrice", title: t("unitPrice"), width: 110, icon: GridColumnIcon.HeaderMath },
    { id: "totalPrice", title: t("totalPrice"), width: 130, icon: GridColumnIcon.HeaderMath },
    { id: "supplier", title: t("supplier"), width: 170, icon: GridColumnIcon.HeaderLookup },
    { id: "availability", title: t("availability"), width: 140, icon: GridColumnIcon.HeaderSingleValue },
  ]);

  // Keep column titles aligned with translations
  useEffect(() => {
    setColumns((prev) => [
      { ...prev[0], title: t("itemCode") },
      { ...prev[1], title: t("materialName") },
      { ...prev[2], title: t("specification") },
      { ...prev[3], title: t("requiredQty") },
      { ...prev[4], title: t("unit") },
      { ...prev[5], title: t("unitPrice") },
      { ...prev[6], title: t("totalPrice") },
      { ...prev[7], title: t("supplier") },
      { ...prev[8], title: t("availability") },
    ]);
  }, [t]);

  // Filtered rows
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.spec.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Compute total BOM cost
  const totalBOMCost = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.qty * curr.unitPrice, 0);
  }, [items]);

  useEffect(() => {
    if (onTotalCostChange) {
      onTotalCostChange(totalBOMCost);
    }
  }, [totalBOMCost, onTotalCostChange]);

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
              baseFontStyle: "500 12px sans-serif",
            },
          };
        case "spec":
          return {
            kind: GridCellKind.Text,
            data: item.spec,
            displayData: item.spec,
            allowOverlay: true,
            themeOverride: {
              textDark: isDark ? "#a1a1aa" : "#475569",
            },
          };
        case "qty":
          return {
            kind: GridCellKind.Number,
            data: item.qty,
            displayData: item.qty.toLocaleString("en-US"),
            allowOverlay: true,
            contentAlign: "right",
            themeOverride: {
              baseFontStyle: "600 12px monospace",
            },
          };
        case "unit":
          return {
            kind: GridCellKind.Text,
            data: item.unit,
            displayData: item.unit,
            allowOverlay: true,
            contentAlign: "center",
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
            },
          };
        case "totalPrice": {
          const total = item.qty * item.unitPrice;
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
        case "supplier":
          return {
            kind: GridCellKind.Text,
            data: item.supplier,
            displayData: item.supplier,
            allowOverlay: true,
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
            if (column.id === "qty") {
              const val =
                typeof newValue.data === "number"
                  ? newValue.data
                  : parseFloat(String(newValue.data)) || 0;
              updated.qty = Math.max(0, val);
              updated.totalPrice = updated.qty * updated.unitPrice;
            } else if (column.id === "unitPrice") {
              const val =
                typeof newValue.data === "number"
                  ? newValue.data
                  : parseFloat(String(newValue.data)) || 0;
              updated.unitPrice = Math.max(0, val);
              updated.totalPrice = updated.qty * updated.unitPrice;
            } else if (column.id === "name") {
              updated.name = String(newValue.data ?? "");
            } else if (column.id === "spec") {
              updated.spec = String(newValue.data ?? "");
            } else if (column.id === "unit") {
              updated.unit = String(newValue.data ?? "");
            } else if (column.id === "supplier") {
              updated.supplier = String(newValue.data ?? "");
            } else if (column.id === "availability") {
              updated.availability = String(newValue.data ?? "") as any;
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

  // Add Material handler
  const handleAddMaterial = () => {
    if (!newItem.name.trim()) return;
    const created: BomItem = {
      id: newItem.id.trim() || `MAT-${Math.floor(100 + Math.random() * 900)}`,
      name: newItem.name.trim(),
      spec: newItem.spec.trim() || "Standard Industry Spec",
      qty: Number(newItem.qty) || 1,
      unit: newItem.unit.trim() || "pcs",
      unitPrice: Number(newItem.unitPrice) || 0,
      totalPrice: (Number(newItem.qty) || 1) * (Number(newItem.unitPrice) || 0),
      supplier: newItem.supplier.trim() || "Approved Supplier",
      availability: newItem.availability,
    };

    setItems((prev) => [...prev, created]);
    if (tabId) setTabUnsaved(tabId, true);
    setIsAddOpen(false);

    // Reset new item template
    setNewItem({
      id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      spec: "",
      qty: 100,
      unit: "pcs",
      unitPrice: 1.0,
      supplier: "Local Distributor",
      availability: "In Stock",
    });

    toast.add({
      title: t("addMaterial"),
      description: t("toastAdded", { code: created.id }),
      type: "success",
    });
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
      .map((m) => `${m.id}\t${m.name}\t${m.spec}\t${m.qty}\t${m.unit}\t$${m.unitPrice}\t$${m.totalPrice}\t${m.supplier}\t${m.availability}`)
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
      t("specification"),
      t("requiredQty"),
      t("unit"),
      t("unitPrice"),
      t("totalPrice"),
      t("supplier"),
      t("availability"),
    ];

    const csvRows = items.map((m) => [
      `"${m.id}"`,
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.spec.replace(/"/g, '""')}"`,
      m.qty,
      `"${m.unit}"`,
      m.unitPrice,
      (m.qty * m.unitPrice).toFixed(2),
      `"${m.supplier.replace(/"/g, '""')}"`,
      `"${m.availability}"`,
    ]);

    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BOM-Specification-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [items, t]);

  return (
    <div className="w-full h-full flex flex-col bg-background select-none overflow-hidden">
      {/* 1C Enterprise Industrial Toolbar for BOM */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0 gap-2">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("addMaterial")}</span>
          </Button>

          <Button
            onClick={handleDeleteSelected}
            disabled={selection.rows.length === 0}
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("deleteMaterial")}</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 rounded"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("exportCsv")}</span>
          </Button>
        </div>

        {/* Right Search & Summary KPI Badges */}
        <div className="flex items-center gap-2">
          <div className="relative w-44 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs bg-background/50 border-input"
            />
          </div>

          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          <div className="hidden md:flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-6 px-2 text-[11px] font-mono font-medium bg-muted/40 text-foreground border-border/60"
            >
              <Boxes className="w-3 h-3 mr-1 text-blue-500" />
              {t("totalItems", { count: items.length })}
            </Badge>

            <Badge
              variant="outline"
              className="h-6 px-2 text-[11px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              ${totalBOMCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </Badge>
          </div>
        </div>
      </div>

      {/* Glide Data Grid wrapped in ContextMenu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 w-full h-full relative" id="glide-bom-grid-root">
            <DataEditor
              getCellContent={getCellContent}
              columns={columns}
              rows={filteredItems.length}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={handleSelectionChange}
              onCellEdited={onCellEdited}
              onColumnResize={onColumnResize}
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={() => setIsAddOpen(true)} className="gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            <span>{t("addMaterial")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleDuplicateRow} className="gap-2 cursor-pointer">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t("duplicate")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">F9</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={handleCopySelection} className="gap-2 cursor-pointer">
            <Copy className="w-3.5 h-3.5" />
            <span>{t("copy")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ctrl+C</span>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t("exportCsv")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">F12</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={handleDeleteSelected}
            disabled={selection.rows.length === 0}
            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t("deleteMaterial")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Add New Material Dialog Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>{t("dialogAddTitle")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("dialogAddDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("itemCode")}
              </label>
              <Input
                value={newItem.id}
                onChange={(e) => setNewItem((p) => ({ ...p, id: e.target.value }))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("unit")}
              </label>
              <Input
                value={newItem.unit}
                onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Sheets, kg, pcs, m..."
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("materialName")} *
              </label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                className="h-8 text-xs"
                placeholder="e.g. Sappi Magno Gloss 130g"
                autoFocus
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("specification")}
              </label>
              <Input
                value={newItem.spec}
                onChange={(e) => setNewItem((p) => ({ ...p, spec: e.target.value }))}
                className="h-8 text-xs"
                placeholder="e.g. 700x1000mm, 2-sided coated"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("requiredQty")} *
              </label>
              <Input
                type="number"
                value={newItem.qty}
                onChange={(e) => setNewItem((p) => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("unitPrice")}
              </label>
              <Input
                type="number"
                step="0.01"
                value={newItem.unitPrice}
                onChange={(e) => setNewItem((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("supplier")}
              </label>
              <Input
                value={newItem.supplier}
                onChange={(e) => setNewItem((p) => ({ ...p, supplier: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Vendor or manufacturer name"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(false)}
              className="text-xs h-8"
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleAddMaterial}
              disabled={!newItem.name.trim()}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
