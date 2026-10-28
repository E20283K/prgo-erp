"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useWorkspaceStore,
  DocumentTab,
  MovementLineItem,
  WarehouseMovementRecord,
  WarehouseStockRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ArrowRightLeft,
  Warehouse,
  Boxes,
  Plus,
  Trash2,
  Save,
  Check,
  Lock,
  Edit3,
  Search,
  ExternalLink,
} from "lucide-react";
import { WarehouseSelect } from "@/components/common/WarehouseSelect";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export interface WarehouseMovementDoc {
  id: string;
  date: string;
  from: string;
  fromWarehouseId?: string;
  to: string;
  toWarehouseId?: string;
  movementType: "Transfer" | "ProductionIssue" | "WriteOff" | "CuttingReturn";
  operator: string;
  reason: string;
  status: "Completed" | "Pending" | "In Transit";
  items: MovementLineItem[];
}

export function WarehouseMovementDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    warehousesList,
    loadWarehouses,
    employees,
    upsertWarehouseStock,
    upsertWarehouseMovementAsync,
    replaceTabId,
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  // Initialize document data
  const initialDoc = useMemo<WarehouseMovementDoc>(() => {
    const d = tab.documentData || {};
    let initialItems: MovementLineItem[] = [];

    if (Array.isArray(d.items) && d.items.length > 0) {
      initialItems = d.items;
    } else if (d.material || d.materialName) {
      // Single item backwards compatibility
      initialItems = [
        {
          id: `item-${Date.now()}`,
          sku: d.materialSku || `MAT-${Date.now().toString().slice(-4)}`,
          name: d.material || d.materialName || "Material",
          sheetFormat: d.sheetFormat || "",
          quantity: Number(d.quantity) || 100,
          receivedQty: Number(d.receivedQty) || Number(d.quantity) || 100,
          unit: d.unit || "sheets",
          notes: d.reason || "",
        },
      ];
    }

    return {
      id: d.id || tab.id,
      date: d.date || d.movementDate || new Date().toISOString().split("T")[0],
      from: d.from || d.fromLocationName || "",
      fromWarehouseId: d.fromWarehouseId,
      to: d.to || d.toLocationName || "",
      toWarehouseId: d.toWarehouseId,
      movementType: d.movementType || "Transfer",
      operator: d.operator || (employees[0]?.fullName || "Ombor mudiri"),
      reason: d.reason || "",
      status: d.status === "Completed" ? "Completed" : "Pending",
      items: initialItems,
    };
  }, [tab.documentData, tab.id, employees]);

  const [doc, setDoc] = useState<WarehouseMovementDoc>(initialDoc);
  const isLocked = doc.status === "Completed";
  const isDraft = !doc.id || doc.id.startsWith("draft-") || doc.id.startsWith("new-") || doc.id.startsWith("MOV-NEW-");

  // Load warehouses if empty
  useEffect(() => {
    if (warehousesList.length === 0 && loadWarehouses) {
      loadWarehouses("PRINTGOO");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dialog state for adding items from stock catalog
  const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [selectedStockSku, setSelectedStockSku] = useState<string>("");
  const [pickerQuantity, setPickerQuantity] = useState<number>(100);

  // Line item editing dialog state
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineFormData, setLineFormData] = useState<MovementLineItem | null>(null);

  // Glide Data Grid Selection State
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const selectedRows = selection.rows.toArray();
  const hasSelectedRow = selectedRows.length > 0;
  const selectedRowIndex = selectedRows[0];

  const handleFieldChange = useCallback(
    (field: keyof WarehouseMovementDoc, val: any) => {
      if (isLocked) return;
      setDoc((prev) => ({ ...prev, [field]: val }));
      setTabUnsaved(tab.id, true);
    },
    [isLocked, setTabUnsaved, tab.id]
  );

  // Available stock items for picker (filtered by search)
  const filteredStock = useMemo(() => {
    if (!stockSearch.trim()) return warehouseStock;
    const q = stockSearch.toLowerCase();
    return warehouseStock.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q) ||
        (s.location && s.location.toLowerCase().includes(q))
    );
  }, [warehouseStock, stockSearch]);

  // Add line item from stock picker
  const handleAddFromStock = () => {
    if (isLocked || !selectedStockSku) return;
    const stockItem = warehouseStock.find((s) => s.sku === selectedStockSku);
    if (!stockItem) return;

    const qty = Number(pickerQuantity) || 1;
    const newLine: MovementLineItem = {
      id: `item-${Date.now()}-${doc.items.length}`,
      sku: stockItem.sku,
      name: stockItem.name,
      category: stockItem.category,
      sheetFormat: stockItem.sheetFormat || "",
      grammage: stockItem.grammage,
      quantity: qty,
      receivedQty: qty,
      unit: stockItem.unit || "sheets",
      notes: "",
    };

    setDoc((prev) => ({ ...prev, items: [...prev.items, newLine] }));
    setTabUnsaved(tab.id, true);
    setIsStockPickerOpen(false);
    setSelectedStockSku("");
    setPickerQuantity(100);
  };

  // Add empty manual line
  const handleAddEmptyLine = () => {
    if (isLocked) return;
    const newLine: MovementLineItem = {
      id: `item-${Date.now()}-${doc.items.length}`,
      sku: `MAT-${Date.now().toString().slice(-4)}`,
      name: "",
      category: "Paper & Board",
      sheetFormat: "",
      grammage: 0,
      quantity: 100,
      receivedQty: 100,
      unit: "sheets",
      notes: "",
    };
    setDoc((prev) => ({ ...prev, items: [...prev.items, newLine] }));
    setTabUnsaved(tab.id, true);
    // Open edit dialog for this new line
    setEditingLineIndex(doc.items.length);
    setLineFormData(newLine);
  };

  // Edit selected line
  const handleOpenEditLine = (index: number) => {
    if (isLocked) return;
    const item = doc.items[index];
    if (!item) return;
    setEditingLineIndex(index);
    setLineFormData({ ...item });
  };

  const handleSaveLineForm = () => {
    if (editingLineIndex === null || !lineFormData) return;
    if (!lineFormData.name.trim()) {
      alert("Material nomini kiritish shart!");
      return;
    }
    setDoc((prev) => {
      const next = [...prev.items];
      next[editingLineIndex] = {
        ...lineFormData,
        quantity: Number(lineFormData.quantity) || 0,
        receivedQty: Number(lineFormData.receivedQty) || Number(lineFormData.quantity) || 0,
      };
      return { ...prev, items: next };
    });
    setTabUnsaved(tab.id, true);
    setEditingLineIndex(null);
    setLineFormData(null);
  };

  // Delete selected rows
  const handleDeleteSelected = () => {
    if (isLocked || selectedRows.length === 0) return;
    setDoc((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => !selectedRows.includes(idx)),
    }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // Save draft
  const handleSaveDraft = async () => {
    const payload = {
      ...doc,
      movementNumber: isDraft ? "" : doc.id,
      status: "Pending",
      quantity: doc.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0),
      material: doc.items.map((i) => i.name).join(", ") || "Material",
    };

    const res = await upsertWarehouseMovementAsync(payload);
    if (isDraft) {
      const realId = `MOV-${Date.now().toString().slice(-4)}`;
      setDoc((prev) => ({ ...prev, id: realId }));
      replaceTabId(tab.id, realId, `${realId}: Ichki ko'chirish`, { ...doc, id: realId });
    }
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Ko'chirish hujjati saqlandi",
      description: "Qoralama muvaffaqiyatli saqlandi.",
      severity: "info",
    });
  };

  // Post / Confirm movement
  const handlePostMovement = async () => {
    if (isLocked) return;
    if (!doc.from?.trim()) {
      alert("Chiquvchi omborni tanlash shart!");
      return;
    }
    if (!doc.to?.trim()) {
      alert("Qabul qiluvchi omborni tanlash shart!");
      return;
    }
    if (doc.from === doc.to) {
      alert("Chiquvchi va qabul qiluvchi omborlar bir xil bo'lishi mumkin emas!");
      return;
    }
    if (doc.items.length === 0) {
      alert("Kamida bitta material qatori kiritilishi shart!");
      return;
    }

    // Update stock balances: deduct from source warehouse, add to target warehouse
    doc.items.forEach((line) => {
      const qty = Number(line.quantity) || 0;

      // Source deduction
      const fromItem = warehouseStock.find(
        (s) => (s.sku === line.sku || s.name === line.name) && s.location === doc.from
      );
      if (fromItem) {
        upsertWarehouseStock({
          ...fromItem,
          stockLevel: Math.max(0, fromItem.stockLevel - qty),
          available: Math.max(0, fromItem.available - qty),
        });
      }

      // Target addition
      const toItem = warehouseStock.find(
        (s) => (s.sku === line.sku || s.name === line.name) && s.location === doc.to
      );
      if (toItem) {
        upsertWarehouseStock({
          ...toItem,
          stockLevel: toItem.stockLevel + qty,
          available: toItem.available + qty,
        });
      } else {
        // Create stock record in target warehouse
        upsertWarehouseStock({
          sku: line.sku,
          name: line.name,
          category: (line.category as any) || "Paper & Board",
          sheetFormat: line.sheetFormat,
          grammage: line.grammage !== undefined ? Number(line.grammage) : undefined,
          unit: (line.unit as any) || "sheets",
          location: doc.to,
          stockLevel: qty,
          reserved: 0,
          available: qty,
          reorder: 100,
          unitPriceUsd: 0,
          status: "In Stock",
          lastReceived: new Date().toISOString().split("T")[0],
        });
      }
    });

    const realId = isDraft ? `MOV-${Date.now().toString().slice(-4)}` : doc.id;
    const payload = {
      ...doc,
      id: realId,
      movementNumber: realId,
      status: "Completed",
      quantity: doc.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0),
      material: doc.items.map((i) => i.name).join(", ") || "Material",
    };

    await upsertWarehouseMovementAsync(payload);
    setDoc((prev) => ({ ...prev, id: realId, status: "Completed" }));
    if (isDraft) {
      replaceTabId(tab.id, realId, `${realId}: ${doc.from} → ${doc.to}`, { ...doc, id: realId, status: "Completed" });
    }
    setTabUnsaved(tab.id, false);
    addNotification({
      title: `Ko'chirish tasdiqlandi: ${realId}`,
      description: `${doc.items.length} turdagi material ${doc.from} omboridan ${doc.to} omboriga o'tkazildi.`,
      severity: "success",
    });
  };

  // ─── Glide Data Grid Setup ─────────────────────────────────────────────────
  const columns = useMemo<GridColumn[]>(() => {
    return [
      { id: "index", title: "№", width: 45, icon: GridColumnIcon.HeaderRowID },
      { id: "sku", title: "SKU Kodi", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Material Nomi", width: 280, icon: GridColumnIcon.HeaderString },
      { id: "category", title: "Kategoriya", width: 140, icon: GridColumnIcon.HeaderLookup },
      { id: "sheetFormat", title: "Format / O'lcham", width: 120, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Jo'natilgan", width: 100, icon: GridColumnIcon.HeaderNumber },
      { id: "receivedQty", title: "Qabul qilingan", width: 105, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh / Eslatma", width: 200, icon: GridColumnIcon.HeaderTextTemplate },
    ];
  }, []);

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = doc.items[row];
      if (!item) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

      const colId = columns[col]?.id;

      if (colId === "index") {
        return {
          kind: GridCellKind.Number,
          data: row + 1,
          displayData: String(row + 1),
          allowOverlay: false,
          contentAlign: "center",
        };
      }
      if (colId === "sku") {
        return {
          kind: GridCellKind.Text,
          data: item.sku || "",
          displayData: item.sku || "",
          allowOverlay: !isLocked,
        };
      }
      if (colId === "name") {
        return {
          kind: GridCellKind.Text,
          data: item.name || "",
          displayData: item.name || "",
          allowOverlay: !isLocked,
        };
      }
      if (colId === "category") {
        return {
          kind: GridCellKind.Text,
          data: item.category || "Paper & Board",
          displayData: item.category || "Paper & Board",
          allowOverlay: !isLocked,
        };
      }
      if (colId === "sheetFormat") {
        return {
          kind: GridCellKind.Text,
          data: item.sheetFormat || "",
          displayData: item.sheetFormat || "",
          allowOverlay: !isLocked,
        };
      }
      if (colId === "quantity") {
        const val = Number(item.quantity) || 0;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val.toLocaleString(),
          allowOverlay: !isLocked,
          contentAlign: "right",
        };
      }
      if (colId === "receivedQty") {
        const val = Number(item.receivedQty) || Number(item.quantity) || 0;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: val.toLocaleString(),
          allowOverlay: !isLocked,
          contentAlign: "right",
        };
      }
      if (colId === "unit") {
        return {
          kind: GridCellKind.Text,
          data: item.unit || "sheets",
          displayData: item.unit || "sheets",
          allowOverlay: !isLocked,
        };
      }
      if (colId === "notes") {
        return {
          kind: GridCellKind.Text,
          data: item.notes || "",
          displayData: item.notes || "",
          allowOverlay: !isLocked,
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [doc.items, columns, isLocked]
  );

  const totalQuantity = useMemo(() => {
    return doc.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  }, [doc.items]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1. Document Header Requisites Toolbar */}
      <div className="px-3 py-2 bg-card border-b border-border flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <ArrowRightLeft className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground truncate">
                {isDraft ? "Yangi ichki ko'chirish hujjati" : `Ko'chirish № ${doc.id}`}
              </span>
              {isLocked ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
                  <Lock className="size-3" />
                  <span>Bajarildi</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
                  Qoralama
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {!isLocked && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Saqlash</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePostMovement}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Tasdiqlash va o'tkazish</span>
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => closeTab(tab.id)}
            className="h-7 px-2.5 text-xs cursor-pointer"
          >
            Yopish
          </Button>
        </div>
      </div>

      {/* 2. Document Header Requisites Grid */}
      <div className="p-3 bg-card border-b border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 shrink-0">
        {/* Document Number and Date */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Hujjat № va sana</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={isDraft ? "Yangi" : doc.id}
              readOnly
              className="h-7 text-xs font-mono bg-muted/40 w-24 text-muted-foreground font-medium"
            />
            <DatePicker
              value={doc.date}
              disabled={isLocked}
              onChange={(val) => handleFieldChange("date", val)}
              className="h-7 text-xs font-mono bg-background flex-1"
            />
          </div>
        </div>

        {/* Origin Warehouse (Qayerdan) */}
        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Warehouse className="size-3 text-amber-600 dark:text-amber-400" />
            <span>Chiquvchi ombor (Qayerdan) *</span>
          </Label>
          <WarehouseSelect
            value={doc.from}
            disabled={isLocked}
            onValueChange={(val) => handleFieldChange("from", val.warehouseName)}
            placeholder="Chiqish omborini tanlang..."
            className="h-7 text-xs bg-background"
          />
        </div>

        {/* Destination Warehouse (Qayerga) */}
        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Warehouse className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>Qabul qiluvchi ombor (Qayerga) *</span>
          </Label>
          <WarehouseSelect
            value={doc.to}
            disabled={isLocked}
            onValueChange={(val) => handleFieldChange("to", val.warehouseName)}
            placeholder="Qabul omborini tanlang..."
            className="h-7 text-xs bg-background"
          />
        </div>

        {/* Operation Type */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Operatsiya turi</Label>
          <Select
            value={doc.movementType}
            disabled={isLocked}
            onValueChange={(val: any) => handleFieldChange("movementType", val)}
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Transfer" className="text-xs">Omborlararo ko'chirish</SelectItem>
              <SelectItem value="ProductionIssue" className="text-xs">Sexga sarf (Ishlab chiqarish)</SelectItem>
              <SelectItem value="WriteOff" className="text-xs">Spisaniye (Brak/Yaroqsiz)</SelectItem>
              <SelectItem value="CuttingReturn" className="text-xs">Qirqim qoldig'i (Otxod)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Operator and Reason Notes Row */}
      <div className="px-3 py-2 bg-muted/20 border-b border-border grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Mas'ul shaxs (Operator)</Label>
          <Input
            value={doc.operator}
            disabled={isLocked}
            onChange={(e) => handleFieldChange("operator", e.target.value)}
            placeholder="Omborchi / Operator ismi..."
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Izoh yoki Buyruq № (Sababi)</Label>
          <Input
            value={doc.reason}
            disabled={isLocked}
            onChange={(e) => handleFieldChange("reason", e.target.value)}
            placeholder="Masalan: Buyruq WO-26-0351 talabi bo'yicha yoki umumiy zaxira taqsimoti..."
            className="h-7 text-xs bg-background"
          />
        </div>
      </div>

      {/* 3. Tabular Section Toolbar */}
      <div className="px-3 bg-muted/40 border-b border-border flex items-center justify-between h-9 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Boxes className="size-3.5 text-primary shrink-0" />
          <span className="font-semibold text-xs whitespace-nowrap">
            Ko'chirilayotgan tovar va materiallar
          </span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
            {doc.items.length} ta pozitsiya
          </Badge>

          {!isLocked && (
            <>
              <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

              <Button
                size="sm"
                onClick={() => setIsStockPickerOpen(true)}
                className="h-7 px-2.5 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Zaxiradan qo'shish</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleAddEmptyLine}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Qator qo'shish</span>
              </Button>

              {hasSelectedRow && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEditLine(selectedRowIndex)}
                  className="h-7 px-2.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 cursor-pointer font-medium"
                >
                  <Edit3 className="size-3" />
                  <span>Tahrirlash</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteSelected}
                disabled={!hasSelectedRow}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="size-3" />
                <span>O'chirish</span>
              </Button>
            </>
          )}
        </div>

        {/* Summary info right side */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>Jami miqdor:</span>
          <span className="font-semibold text-foreground">{totalQuantity.toLocaleString()} birlik</span>
        </div>
      </div>

      {/* 4. Tabular Glide Data Grid */}
      <div className="flex-1 w-full min-h-0 relative">
        <DataEditor
          width="100%"
          height="100%"
          columns={columns}
          rows={doc.items.length}
          getCellContent={getContent}
          gridSelection={selection}
          onGridSelectionChange={setSelection}
          rowMarkers="number"
          smoothScrollX={true}
          smoothScrollY={true}
          theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          onCellActivated={(cell: Item) => {
            const [, row] = cell;
            if (!isLocked) {
              handleOpenEditLine(row);
            }
          }}
        />
      </div>

      {/* ── Modal: Stock Item Picker ────────────────────────────────────────── */}
      <Dialog open={isStockPickerOpen} onOpenChange={setIsStockPickerOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border border-border shadow-xl bg-card">
          <DialogHeader className="p-4 bg-muted/30 border-b border-border">
            <DialogTitle className="text-sm font-semibold">Ombor zaxirasidan material tanlash</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {doc.from ? `${doc.from} omboridagi xomashyo va tayyor mahsulotlar` : "Barcha mavjud zaxiralar"}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            {/* Search Input */}
            <div className="flex items-center gap-2 px-2.5 h-8 rounded border border-input bg-background text-xs">
              <Search className="size-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Nomi, SKU yoki ombor bo'yicha qidirish..."
                className="w-full bg-transparent outline-none text-xs"
              />
            </div>

            {/* Stock List Container */}
            <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded p-1 bg-background">
              {filteredStock.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Zaxira topilmadi</div>
              ) : (
                filteredStock.map((s) => {
                  const isSelected = selectedStockSku === s.sku;
                  return (
                    <button
                      key={`${s.sku}-${s.location}`}
                      type="button"
                      onClick={() => setSelectedStockSku(s.sku)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors cursor-pointer border border-transparent",
                        isSelected
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{s.sku}</span>
                          {s.location && <span>• {s.location}</span>}
                          {s.sheetFormat && <span>• {s.sheetFormat}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {s.stockLevel?.toLocaleString()} {s.unit}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Quantity Input */}
            <div className="space-y-1">
              <Label className="text-xs">Ko'chiriladigan miqdor</Label>
              <Input
                type="number"
                min="1"
                value={pickerQuantity}
                onChange={(e) => setPickerQuantity(Number(e.target.value) || 1)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="p-3 bg-muted/20 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsStockPickerOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedStockSku}
              onClick={handleAddFromStock}
              className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Hujjatga qo'shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Line Item Edit Dialog ────────────────────────────────────── */}
      <Dialog open={editingLineIndex !== null} onOpenChange={(open) => !open && setEditingLineIndex(null)}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border shadow-xl bg-card">
          <DialogHeader className="p-4 bg-muted/30 border-b border-border">
            <DialogTitle className="text-sm font-semibold">Qator ma'lumotlarini tahrirlash</DialogTitle>
          </DialogHeader>

          {lineFormData && (
            <div className="p-4 space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Material nomi *</Label>
                <Input
                  value={lineFormData.name}
                  onChange={(e) => setLineFormData((prev: MovementLineItem | null) => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Material nomini kiriting..."
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">SKU Kodi</Label>
                  <Input
                    value={lineFormData.sku}
                    onChange={(e) => setLineFormData((prev: MovementLineItem | null) => prev ? { ...prev, sku: e.target.value } : null)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Format / O'lcham</Label>
                  <Input
                    value={lineFormData.sheetFormat || ""}
                    onChange={(e) => setLineFormData((prev: MovementLineItem | null) => prev ? { ...prev, sheetFormat: e.target.value } : null)}
                    placeholder="700×1000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Ko'chirish miqdori *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={lineFormData.quantity}
                    onChange={(e) => setLineFormData((prev: MovementLineItem | null) => prev ? { ...prev, quantity: Number(e.target.value) || 0 } : null)}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">O'lchov birligi</Label>
                  <Select
                    value={lineFormData.unit}
                    onValueChange={(val) => setLineFormData((prev: MovementLineItem | null) => prev ? { ...prev, unit: val || "sheets" } : null)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sheets" className="text-xs">varaq (sheets)</SelectItem>
                      <SelectItem value="rolls" className="text-xs">rulon (rolls)</SelectItem>
                      <SelectItem value="kg" className="text-xs">kg</SelectItem>
                      <SelectItem value="pcs" className="text-xs">dona (pcs)</SelectItem>
                      <SelectItem value="m²" className="text-xs">m²</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Qator eslatmasi</Label>
                <Input
                  value={lineFormData.notes || ""}
                  onChange={(e) => setLineFormData((prev: MovementLineItem | null) => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Qo'shimcha izoh..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="p-3 bg-muted/20 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingLineIndex(null)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveLineForm}
              className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
