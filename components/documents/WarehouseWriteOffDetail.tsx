"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
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
  AlertOctagon,
  Trash2,
  Boxes,
  Plus,
  Save,
  Check,
  Lock,
  Edit3,
  Search,
  DollarSign,
} from "lucide-react";
import { WarehouseSelect } from "@/components/common/WarehouseSelect";
import { FieldCombobox, type ComboboxOption } from "@/components/ui/field-combobox";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export type WriteOffReason =
  | "SetupWaste"       // Priladka / Sozlash isrofi
  | "ProductionDefect"  // Bosma / Sex braki
  | "StorageDamage"     // Ombor shikasti (namlik, urilish)
  | "ExpiredMaterial";  // Muddati o'tgan (bo'yoq, lak, ximiya)

export const WRITE_OFF_REASON_LABELS: Record<WriteOffReason, string> = {
  SetupWaste: "Priladka / Sozlash isrofi (Standart me'yordan ortiq)",
  ProductionDefect: "Bosma va ishlov berish braki (Texnologik nuqson)",
  StorageDamage: "Ombor shikasti (Nam tortish, cheti urilish)",
  ExpiredMaterial: "Yaroqlilik muddati o'tgan (Bo'yoq, lak, yelim)",
};

export interface WriteOffLineItem extends MovementLineItem {
  unitPriceUsd?: number;
  totalLossUsd?: number;
}

export interface WriteOffDoc {
  id: string;
  date: string;
  warehouse: string;
  reasonCategory: WriteOffReason;
  workOrderId?: string;
  pressMachine?: string;
  operator: string;
  reasonNotes: string;
  status: "Completed" | "Pending";
  items: WriteOffLineItem[];
}

export function WarehouseWriteOffDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    loadWarehouseStock,
    productionQueue,
    loadProductionQueue,
    warehousesList,
    loadWarehouses,
    machines,
    loadMachines,
    employees,
    loadEmployees,
    upsertWarehouseStock,
    upsertWarehouseMovementAsync,
    replaceTabId,
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const initialDoc = useMemo<WriteOffDoc>(() => {
    const d = tab.documentData || {};
    let initialItems: WriteOffLineItem[] = [];

    if (Array.isArray(d.items) && d.items.length > 0) {
      initialItems = d.items.map((i: any) => ({
        ...i,
        unitPriceUsd: Number(i.unitPriceUsd) || 0,
        totalLossUsd: Number(i.totalLossUsd) || (Number(i.quantity) || 0) * (Number(i.unitPriceUsd) || 0),
      }));
    } else if (d.material || d.materialName) {
      const q = Number(d.quantity) || 100;
      const p = 0.12;
      initialItems = [
        {
          id: `item-${Date.now()}`,
          sku: d.materialSku || `MAT-${Date.now().toString().slice(-4)}`,
          name: d.material || d.materialName || "Brak qilingan material",
          sheetFormat: d.sheetFormat || "",
          quantity: q,
          receivedQty: q,
          unit: d.unit || "sheets",
          unitPriceUsd: p,
          totalLossUsd: q * p,
          notes: d.reason || "",
        },
      ];
    }

    return {
      id: d.id || tab.id,
      date: d.date || d.movementDate || new Date().toISOString().split("T")[0],
      warehouse: d.warehouse || d.from || d.fromLocationName || (warehousesList[0]?.name || "Asosiy ombor"),
      reasonCategory: (d.reasonCategory as WriteOffReason) || "SetupWaste",
      workOrderId: d.workOrderId || "",
      pressMachine: d.pressMachine || "",
      operator: d.operator || (employees[0]?.fullName || "Komissiya a'zosi"),
      reasonNotes: d.reasonNotes || d.reason || "",
      status: d.status === "Completed" ? "Completed" : "Pending",
      items: initialItems,
    };
  }, [tab.documentData, tab.id, warehousesList, employees]);

  const [doc, setDoc] = useState<WriteOffDoc>(initialDoc);
  const isLocked = doc.status === "Completed";
  const isDraft =
    !doc.id ||
    doc.id.startsWith("draft-") ||
    doc.id.startsWith("new-") ||
    doc.id.startsWith("WOFF-NEW-") ||
    doc.id.startsWith("tab-");

  useEffect(() => {
    if (warehousesList.length === 0 && loadWarehouses) {
      loadWarehouses("PRINTGOO");
    }
    if (productionQueue.length === 0 && loadProductionQueue) {
      loadProductionQueue("PRINTGOO");
    }
    if (machines.length === 0 && loadMachines) {
      loadMachines();
    }
    if (employees.length === 0 && loadEmployees) {
      loadEmployees("PRINTGOO");
    }
    if (warehouseStock.length === 0 && loadWarehouseStock) {
      loadWarehouseStock("PRINTGOO");
    }
  }, [
    warehousesList.length,
    loadWarehouses,
    productionQueue.length,
    loadProductionQueue,
    machines.length,
    loadMachines,
    employees.length,
    loadEmployees,
    warehouseStock.length,
    loadWarehouseStock,
  ]);

  // Searchable Work Order options
  const workOrderOptions = useMemo<ComboboxOption[]>(() => {
    return productionQueue.map((wo) => ({
      value: wo.id,
      label: `${wo.id} — ${wo.product}${wo.customer ? ` (${wo.customer})` : ""}`,
    }));
  }, [productionQueue]);

  // Searchable Machine options
  const machineOptions = useMemo<ComboboxOption[]>(() => {
    return machines.map((m) => ({
      value: m.name,
      label: m.department ? `${m.name} (${m.department})` : m.name,
    }));
  }, [machines]);

  // Searchable Employee options
  const employeeOptions = useMemo<ComboboxOption[]>(() => {
    return employees.map((e) => ({
      value: e.fullName,
      label: e.position ? `${e.fullName} (${e.position})` : e.fullName,
    }));
  }, [employees]);

  const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [selectedStockSku, setSelectedStockSku] = useState<string>("");
  const [pickerQuantity, setPickerQuantity] = useState<number>(50);

  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineFormData, setLineFormData] = useState<WriteOffLineItem | null>(null);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const selectedRows = selection.rows.toArray();
  const hasSelectedRow = selectedRows.length > 0;
  const selectedRowIndex = selectedRows[0];

  const handleFieldChange = useCallback(
    (field: keyof WriteOffDoc, val: any) => {
      if (isLocked) return;
      setDoc((prev) => ({ ...prev, [field]: val }));
      setTabUnsaved(tab.id, true);
    },
    [isLocked, setTabUnsaved, tab.id]
  );

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

  const handleAddFromStock = () => {
    if (isLocked || !selectedStockSku) return;
    const stockItem = warehouseStock.find((s) => s.sku === selectedStockSku);
    if (!stockItem) return;

    const qty = Number(pickerQuantity) || 1;
    const unitPrice = stockItem.unitPriceUsd || 0.15;
    const newLine: WriteOffLineItem = {
      id: `item-${Date.now()}-${doc.items.length}`,
      sku: stockItem.sku,
      name: stockItem.name,
      category: stockItem.category,
      sheetFormat: stockItem.sheetFormat || "",
      grammage: stockItem.grammage,
      quantity: qty,
      receivedQty: qty,
      unit: stockItem.unit || "sheets",
      unitPriceUsd: unitPrice,
      totalLossUsd: Number((qty * unitPrice).toFixed(2)),
      notes: "",
    };

    setDoc((prev) => ({ ...prev, items: [...prev.items, newLine] }));
    setTabUnsaved(tab.id, true);
    setIsStockPickerOpen(false);
    setSelectedStockSku("");
    setPickerQuantity(50);
  };

  const handleAddEmptyLine = () => {
    if (isLocked) return;
    const newLine: WriteOffLineItem = {
      id: `item-${Date.now()}-${doc.items.length}`,
      sku: `MAT-${Date.now().toString().slice(-4)}`,
      name: "",
      category: "Paper & Board",
      sheetFormat: "",
      grammage: 0,
      quantity: 50,
      receivedQty: 50,
      unit: "sheets",
      unitPriceUsd: 0.15,
      totalLossUsd: 7.5,
      notes: "",
    };
    setDoc((prev) => ({ ...prev, items: [...prev.items, newLine] }));
    setTabUnsaved(tab.id, true);
    setEditingLineIndex(doc.items.length);
    setLineFormData(newLine);
  };

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
    const q = Number(lineFormData.quantity) || 0;
    const p = Number(lineFormData.unitPriceUsd) || 0;
    setDoc((prev) => {
      const next = [...prev.items];
      next[editingLineIndex] = {
        ...lineFormData,
        quantity: q,
        receivedQty: q,
        unitPriceUsd: p,
        totalLossUsd: Number((q * p).toFixed(2)),
      };
      return { ...prev, items: next };
    });
    setTabUnsaved(tab.id, true);
    setEditingLineIndex(null);
    setLineFormData(null);
  };

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

  const totalLoss = useMemo(() => {
    return doc.items.reduce((acc, i) => acc + (Number(i.totalLossUsd) || 0), 0);
  }, [doc.items]);

  const totalQuantity = useMemo(() => {
    return doc.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  }, [doc.items]);

  const handleSaveDraft = async () => {
    const payload = {
      ...doc,
      movementNumber: isDraft ? "" : doc.id,
      movementType: "WriteOff",
      from: doc.warehouse,
      to: "Brak / Chiqindi (Yo'qotish)",
      status: "Pending",
      quantity: totalQuantity,
      material: doc.items.map((i) => i.name).join(", ") || "Material",
    };

    const res: any = await upsertWarehouseMovementAsync(payload);
    let realId = res?.movementNumber || (isDraft ? "WOF-26-0001" : doc.id);
    if (realId.startsWith("draft-") || realId.startsWith("new-") || realId.startsWith("tab-")) {
      realId = "WOF-26-0001";
    }

    setDoc((prev) => ({ ...prev, id: realId }));
    replaceTabId(tab.id, realId, `${realId}: Hisobdan chiqarish`, { ...doc, id: realId });
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Brak dalolatnomasi saqlandi",
      description: `${realId} qoralamasi muvaffaqiyatli saqlandi.`,
      severity: "info",
    });
  };

  const handlePostDocument = async () => {
    if (isLocked) return;
    if (!doc.warehouse?.trim()) {
      alert("Hisobdan chiqaruvchi omborni tanlang!");
      return;
    }
    if (doc.items.length === 0) {
      alert("Kamida bitta brak qatori kiritilishi shart!");
      return;
    }

    // Ombor zaxirasidan yechish
    doc.items.forEach((line) => {
      const qty = Number(line.quantity) || 0;
      const targetItem = warehouseStock.find(
        (s) => (s.sku === line.sku || s.name === line.name) && s.location === doc.warehouse
      );
      if (targetItem) {
        upsertWarehouseStock({
          ...targetItem,
          stockLevel: Math.max(0, targetItem.stockLevel - qty),
          available: Math.max(0, targetItem.available - qty),
        });
      }
    });

    const payload = {
      ...doc,
      movementNumber: isDraft ? "" : doc.id,
      movementType: "WriteOff",
      from: doc.warehouse,
      to: "Brak / Chiqindi",
      status: "Completed",
      quantity: totalQuantity,
      material: doc.items.map((i) => i.name).join(", ") || "Material",
    };

    const res: any = await upsertWarehouseMovementAsync(payload);
    let realId = res?.movementNumber || (isDraft ? "WOF-26-0001" : doc.id);
    if (realId.startsWith("draft-") || realId.startsWith("new-") || realId.startsWith("tab-")) {
      realId = "WOF-26-0001";
    }

    setDoc((prev) => ({ ...prev, id: realId, status: "Completed" }));
    replaceTabId(tab.id, realId, `${realId}: Hisobdan chiqarildi`, {
      ...doc,
      id: realId,
      status: "Completed",
    });
    setTabUnsaved(tab.id, false);

    addNotification({
      title: `Brak dalolatnomasi tasdiqlandi: ${realId}`,
      description: `${doc.items.length} ta pozitsiya (${totalLoss.toFixed(2)}) hisobdan chiqarildi.`,
      severity: "warning",
    });

    closeTab(realId);
    closeTab(tab.id);
  };

  const columns = useMemo<GridColumn[]>(() => {
    return [
      { id: "index", title: "№", width: 45, icon: GridColumnIcon.HeaderRowID },
      { id: "sku", title: "SKU Kodi", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Material Nomi", width: 280, icon: GridColumnIcon.HeaderString },
      { id: "sheetFormat", title: "Format", width: 110, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Hisobdan chiqarish", width: 125, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "unitPriceUsd", title: "Tannarx ($)", width: 95, icon: GridColumnIcon.HeaderNumber },
      { id: "totalLossUsd", title: "Zarar summasi ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "notes", title: "Nuqson sababi", width: 220, icon: GridColumnIcon.HeaderTextTemplate },
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
          themeOverride: {
            textDark: isDark ? "#f87171" : "#dc2626",
            baseFontStyle: "600 12px monospace",
          },
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
      if (colId === "unitPriceUsd") {
        const val = Number(item.unitPriceUsd) || 0;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: `$${val.toFixed(2)}`,
          allowOverlay: !isLocked,
          contentAlign: "right",
        };
      }
      if (colId === "totalLossUsd") {
        const val = Number(item.totalLossUsd) || 0;
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: `$${val.toFixed(2)}`,
          allowOverlay: !isLocked,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#f87171" : "#b91c1c",
            baseFontStyle: "bold 12px monospace",
          },
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
    [doc.items, columns, isLocked, isDark]
  );

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1. Header Toolbar */}
      <div className="px-3 py-2 bg-card border-b border-border flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <AlertOctagon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground truncate">
                {isDraft ? "Yangi: Hisobdan chiqarish (Brak dalolatnomasi)" : `${doc.id}: Brak dalolatnomasi`}
              </span>
              {isLocked ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 font-medium">
                  <Lock className="size-3" />
                  <span>Hisobdan chiqarildi</span>
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
                onClick={handlePostDocument}
                className="h-7 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Hisobdan chiqarish (Tasdiqlash)</span>
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

      {/* 2. Requisites Grid */}
      <div className="p-3 bg-card border-b border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 shrink-0">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Dalolatnoma № va sana</Label>
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

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Hisobdan chiqaruvchi ombor *</Label>
          <WarehouseSelect
            value={doc.warehouse}
            disabled={isLocked}
            onValueChange={(val) => handleFieldChange("warehouse", val.warehouseName)}
            placeholder="Omborni tanlang..."
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-3">
          <Label className="text-[11px] text-muted-foreground">Brak / Chiqindi sababi toifasi</Label>
          <Select
            value={doc.reasonCategory}
            disabled={isLocked}
            onValueChange={(val: any) => { if (val) handleFieldChange("reasonCategory", val as WriteOffReason); }}
          >
            <SelectTrigger className="h-7 w-full text-xs bg-background">
              <SelectValue>
                {WRITE_OFF_REASON_LABELS[doc.reasonCategory] || doc.reasonCategory}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SetupWaste" className="text-xs">
                Priladka / Sozlash isrofi (Standart me'yordan ortiq)
              </SelectItem>
              <SelectItem value="ProductionDefect" className="text-xs">
                Bosma va ishlov berish braki (Texnologik nuqson)
              </SelectItem>
              <SelectItem value="StorageDamage" className="text-xs">
                Ombor shikasti (Nam tortish, cheti urilish)
              </SelectItem>
              <SelectItem value="ExpiredMaterial" className="text-xs">
                Yaroqlilik muddati o'tgan (Bo'yoq, lak, yelim)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Bog'liq buyurtma (ixtiyoriy)</Label>
          <FieldCombobox
            value={doc.workOrderId || ""}
            onChange={(val) => handleFieldChange("workOrderId", val)}
            options={workOrderOptions}
            placeholder="Buyurtmani tanlang..."
            searchPlaceholder="Naryad №, mahsulot..."
            disabled={isLocked}
            allowCustom={true}
            className="h-7 text-xs bg-background font-mono"
          />
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Uskuna / Stanok (ixtiyoriy)</Label>
          <FieldCombobox
            value={doc.pressMachine || ""}
            onChange={(val) => handleFieldChange("pressMachine", val)}
            options={machineOptions}
            placeholder="Stanokni tanlang yoki yozing..."
            searchPlaceholder="Stanok nomi..."
            disabled={isLocked}
            allowCustom={true}
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Komissiya a'zosi / Mas'ul</Label>
          <FieldCombobox
            value={doc.operator || ""}
            onChange={(val) => handleFieldChange("operator", val)}
            options={employeeOptions}
            placeholder="Xodimni tanlang yoki yozing..."
            searchPlaceholder="Ism yoki lavozim..."
            disabled={isLocked}
            allowCustom={true}
            className="h-7 text-xs bg-background"
          />
        </div>
      </div>

      {/* 3. Items Toolbar */}
      <div className="px-3 bg-muted/40 border-b border-border flex items-center justify-between h-9 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Boxes className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-semibold text-xs whitespace-nowrap">
            Hisobdan chiqariladigan materiallar
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
                className="h-7 px-2.5 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-none cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Zaxiradan tanlash</span>
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

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-muted-foreground">Jami miqdor: <b className="text-foreground">{totalQuantity.toLocaleString()}</b></span>
          <span className="text-muted-foreground">Jami zarar: <b className="text-rose-600 dark:text-rose-400 font-bold">${totalLoss.toFixed(2)} USD</b></span>
        </div>
      </div>

      {/* 4. Tabular Data Editor */}
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

      {/* Stock picker modal */}
      <Dialog open={isStockPickerOpen} onOpenChange={setIsStockPickerOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border border-border shadow-xl bg-card">
          <DialogHeader className="p-4 bg-muted/30 border-b border-border">
            <DialogTitle className="text-sm font-semibold">Ombor zaxirasidan tanlash</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {doc.warehouse ? `${doc.warehouse} omboridagi mavjud xomashyolar` : "Zaxiralar"}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 px-2.5 h-8 rounded border border-input bg-background text-xs">
              <Search className="size-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Material nomi yoki SKU bo'yicha qidirish..."
                className="w-full bg-transparent outline-none text-xs"
              />
            </div>

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
                      className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors cursor-pointer border ${
                        isSelected
                          ? "bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-medium"
                          : "hover:bg-muted/50 text-foreground border-transparent"
                      }`}
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

            <div className="space-y-1">
              <Label className="text-xs">Brak qilinadigan miqdor</Label>
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
              className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              Hujjatga qo'shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Line edit modal */}
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
                  onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                  placeholder="Material nomi..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Hisobdan chiqarish miqdori *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={lineFormData.quantity}
                    onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, quantity: Number(e.target.value) || 0 } : null))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Tannarx ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={lineFormData.unitPriceUsd}
                    onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, unitPriceUsd: Number(e.target.value) || 0 } : null))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Nuqson sababi yoki izoh</Label>
                <Input
                  value={lineFormData.notes || ""}
                  onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, notes: e.target.value } : null))}
                  placeholder="Brak tafsilotlari..."
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
