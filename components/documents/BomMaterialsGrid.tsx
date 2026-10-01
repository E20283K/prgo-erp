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

const OFFSET_BOM_ITEMS: BomItem[] = [
  { id: "MAT-PAP-014", name: "Galerie Art Silk Paper", spec: "150 g/m², 700x1000mm", qty: 12500, unit: "Sheets", unitPrice: 0.42, totalPrice: 5250.00, supplier: "Sappi Paper Mill", availability: "In Stock" },
  { id: "MAT-INK-CMYK", name: "Hubergroup Eco-Offset Ink", spec: "Process CMYK", qty: 36, unit: "kg", unitPrice: 24.00, totalPrice: 864.00, supplier: "Hubergroup", availability: "In Stock" },
  { id: "MAT-PLT-CTP", name: "Agfa CTP Thermal Plates", spec: "1030x790mm", qty: 24, unit: "pcs", unitPrice: 18.50, totalPrice: 444.00, supplier: "Agfa", availability: "In Stock" },
  { id: "MAT-LAM-M01", name: "Soft-Touch Matte Film", spec: "BOPP 32 micron", qty: 2400, unit: "m", unitPrice: 0.32, totalPrice: 768.00, supplier: "Dunmore", availability: "In Stock" },
];

const FLEXO_BOM_ITEMS: BomItem[] = [
  { id: "MAT-FLX-NYL", name: "Nylon Taffeta Tape Roll", spec: "30mm width, 200m", qty: 45, unit: "Rolls", unitPrice: 12.50, totalPrice: 562.50, supplier: "Avery Dennison", availability: "In Stock" },
  { id: "MAT-FLX-INK", name: "Wash-Resistant Flexo Ink", spec: "Black, 5kg", qty: 2, unit: "kg", unitPrice: 45.00, totalPrice: 90.00, supplier: "Flint Group", availability: "Low Stock" },
  { id: "MAT-FLX-PLT", name: "Photopolymer Flexo Plate", spec: "Digital Plate 1.14mm", qty: 1, unit: "pcs", unitPrice: 120.00, totalPrice: 120.00, supplier: "MacDermid", availability: "In Stock" },
];

const JACQUARD_BOM_ITEMS: BomItem[] = [
  { id: "MAT-YRN-WARP", name: "Polyester Warp Yarn", spec: "Black, 50D", qty: 120, unit: "kg", unitPrice: 5.20, totalPrice: 624.00, supplier: "Shenghong Corp", availability: "In Stock" },
  { id: "MAT-YRN-WEFT", name: "Polyester Weft Yarn", spec: "White, 75D", qty: 85, unit: "kg", unitPrice: 4.80, totalPrice: 408.00, supplier: "Shenghong Corp", availability: "In Stock" },
  { id: "MAT-YRN-GLD", name: "Metallic Lurex Yarn", spec: "Gold, 30D", qty: 15, unit: "kg", unitPrice: 18.50, totalPrice: 277.50, supplier: "Lurex Co", availability: "Reserved" },
];

interface BomMaterialsGridProps {
  tabId: string;
  department?: string;
  initialItems?: BomItem[];
  onTotalCostChange?: (total: number) => void;
}

export function BomMaterialsGrid({
  tabId,
  department,
  initialItems,
  onTotalCostChange,
}: BomMaterialsGridProps) {
  const t = useTranslations("BOM");
  const { theme, setTabUnsaved, updateGridStats } = useWorkspaceStore();
  const isDark = theme === "dark";

  const defaultItems = initialItems || (
    department === "Flexo" ? FLEXO_BOM_ITEMS :
    department === "Jacquard" ? JACQUARD_BOM_ITEMS :
    OFFSET_BOM_ITEMS
  );

  const [items, setItems] = useState<BomItem[]>(defaultItems);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Add / Edit form state
  const [formState, setFormState] = useState<BomItem>({
    id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
    name: "",
    spec: "",
    qty: 100,
    unit: "pcs",
    unitPrice: 1.0,
    totalPrice: 100,
    supplier: "Local Distributor",
    availability: "In Stock",
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

  // Active items list
  const filteredItems = items;

  const selectedRowIndex = selection.rows.toArray()[0];
  const hasSelectedRow = selectedRowIndex !== undefined && items[selectedRowIndex] !== undefined;

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

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingIndex(null);
    setFormState({
      id: `MAT-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      spec: "",
      qty: 100,
      unit: "pcs",
      unitPrice: 1.0,
      totalPrice: 100,
      supplier: "Local Distributor",
      availability: "In Stock",
    });
    setIsDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (index: number) => {
    const item = items[index];
    if (!item) return;
    setEditingIndex(index);
    setFormState({ ...item });
    setIsDialogOpen(true);
  };

  // Save Add/Edit Material handler
  const handleSaveMaterial = () => {
    if (!formState.name.trim()) return;

    const qty = Number(formState.qty) || 0;
    const unitPrice = Number(formState.unitPrice) || 0;
    const itemToSave: BomItem = {
      ...formState,
      name: formState.name.trim(),
      spec: formState.spec.trim() || "Standard Industry Spec",
      qty,
      unitPrice,
      totalPrice: qty * unitPrice,
      supplier: formState.supplier.trim() || "Approved Supplier",
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
        title: t("addMaterial"),
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
      {/* Full-bleed Glide Data Grid with ContextMenu */}
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
              freezeColumns={1}
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
                const [, row] = cell;
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
        <DialogContent className="sm:max-w-md text-xs">
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
                value={formState.spec}
                onChange={(e) => setFormState((p) => ({ ...p, spec: e.target.value }))}
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
                value={formState.qty}
                onChange={(e) => setFormState((p) => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
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
                value={formState.unitPrice}
                onChange={(e) => setFormState((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {t("supplier")}
              </label>
              <Input
                value={formState.supplier}
                onChange={(e) => setFormState((p) => ({ ...p, supplier: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Vendor or manufacturer name"
              />
            </div>

            <div className="col-span-2">
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
    </div>
  );
}
