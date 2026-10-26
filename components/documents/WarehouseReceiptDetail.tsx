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
  EditableGridCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useWorkspaceStore,
  DocumentTab,
  WarehouseStockRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldCombobox, type ComboboxOption } from "@/components/ui/field-combobox";
import {
  ArrowDownToLine,
  Plus,
  Trash2,
  Printer,
  Save,
  Check,
  Lock,
  Boxes,
  ExternalLink,
  ClipboardList,
  ChevronDown,
  Search,
  Edit3,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export interface ReceiptLineItem {
  id: string;
  workOrderId?: string;
  sku: string;
  name: string;
  category: string;
  sheetFormat: string;
  grammage: number;
  quantity: number;
  unit: string;
  unitPriceUsd: number;
}

export interface WarehouseReceiptDoc {
  id: string;
  date: string;
  supplier: string;
  poNumber: string;
  location: string;
  receivedBy: string;
  status: "Draft" | "Accepted";
  notes: string;
  items: ReceiptLineItem[];
}

export function WarehouseReceiptDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    warehousesList,
    loadWarehouses,
    plants,
    fetchPlants,
    employees,
    suppliers,
    loadSuppliers,
    warehouseReceipts,
    productionQueue,
    upsertWarehouseStock,
    upsertWarehouseReceiptAsync,
    replaceTabId,
    openTab,
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  // Clean initial document state without hardcoded mock defaults
  const initialDoc = useMemo<WarehouseReceiptDoc>(() => {
    const d = tab.documentData || {};
    return {
      id: d.id || tab.id,
      date: d.date || new Date().toISOString().split("T")[0],
      supplier: d.supplier || "",
      poNumber: d.poNumber || "",
      location: d.location || (warehousesList[0]?.name || "Asosiy ombor"),
      receivedBy: d.receivedBy || (employees[0]?.fullName || ""),
      status: d.status === "Accepted" || d.status === "Received" || d.status === "Completed" ? "Accepted" : "Draft",
      notes: d.notes || "",
      items: Array.isArray(d.items) ? d.items : [],
    };
  }, [tab.documentData, tab.id, warehousesList, employees]);

  const [doc, setDoc] = useState<WarehouseReceiptDoc>(initialDoc);
  const isPosted = doc.status === "Accepted";

  // Dialog states for modal pickers
  const [isWoDialogOpen, setIsWoDialogOpen] = useState(false);
  const [selectedWoIds, setSelectedWoIds] = useState<string[]>([]);
  const [woSearch, setWoSearch] = useState("");
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const filteredWorkOrders = useMemo(() => {
    if (!woSearch.trim()) return productionQueue;
    const q = woSearch.toLowerCase();
    return productionQueue.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.customer.toLowerCase().includes(q) ||
        item.product.toLowerCase().includes(q)
    );
  }, [productionQueue, woSearch]);

  // Fetch suppliers, warehouses and plants if not loaded yet
  useEffect(() => {
    if (suppliers.length === 0 && loadSuppliers) {
      loadSuppliers();
    }
    if (warehousesList.length === 0 && loadWarehouses) {
      loadWarehouses();
    }
    if (plants.length === 0 && fetchPlants) {
      fetchPlants();
    }
  }, [suppliers.length, loadSuppliers, warehousesList.length, loadWarehouses, plants.length, fetchPlants]);

  // Collect known suppliers for combobox
  const supplierOptions = useMemo<ComboboxOption[]>(() => {
    const list = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name) list.add(s.name);
    });
    warehouseReceipts.forEach((r) => {
      if (r.supplier) list.add(r.supplier);
    });
    warehouseStock.forEach((s) => {
      if (s.supplier) list.add(s.supplier);
    });
    if (list.size === 0) {
      list.add("Tashkent Paper Trade LLC");
      list.add("Sappi Paper Mill");
      list.add("Hubergroup Eco-Inks");
      list.add("Avery Dennison Central Asia");
    }
    return Array.from(list).map((name) => ({ value: name, label: name }));
  }, [suppliers, warehouseReceipts, warehouseStock]);

  // Employee options for ReceivedBy
  const employeeOptions = useMemo<ComboboxOption[]>(() => {
    if (employees && employees.length > 0) {
      return employees.map((e) => ({
        value: e.fullName,
        label: `${e.fullName} (${e.position || "Xodim"})`,
      }));
    }
    return [
      { value: "Aziz Rahimov", label: "Aziz Rahimov (Bosh omborchi)" },
      { value: "Farrux Saidov", label: "Farrux Saidov (Katta klodovshik)" },
      { value: "Jamshid Aliyev", label: "Jamshid Aliyev (Smena ustasi)" },
    ];
  }, [employees]);

  // Warehouse location options from plants and postgres warehouses table
  const warehouseOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];

    // 1. From plant records (each branch/plant has its own warehouses)
    plants.forEach((p) => {
      if (Array.isArray(p.warehouses) && p.warehouses.length > 0) {
        p.warehouses.forEach((w) => {
          const displayName = plants.length > 1 ? `${p.name} — ${w.name}` : w.name;
          list.push({
            id: w.id || `${p.id}-${w.name}`,
            name: displayName,
          });
        });
      }
    });

    // 2. From postgres warehouses catalog
    (warehousesList || []).forEach((wh: any) => {
      const exists = list.some(
        (item) => item.name.toLowerCase() === wh.name.toLowerCase() || item.id === wh.id
      );
      if (!exists) {
        list.push({
          id: wh.id || wh.name,
          name: wh.name,
        });
      }
    });

    if (list.length === 0) {
      return [
        { id: "wh-1", name: "Asosiy xomashyo ombori" },
        { id: "wh-2", name: "Yordamchi materiallar ombori" },
        { id: "wh-3", name: "Tayyor mahsulotlar ombori" },
      ];
    }
    return list;
  }, [plants, warehousesList]);

  const totalAmountUsd = useMemo(
    () =>
      Number(
        doc.items
          .reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPriceUsd) || 0), 0)
          .toFixed(2)
      ),
    [doc.items]
  );

  const totalQty = useMemo(
    () => doc.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0),
    [doc.items]
  );

  const handleFieldChange = (field: keyof WarehouseReceiptDoc, val: any) => {
    if (isPosted) return;
    setDoc((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const selectedRows = useMemo(() => selection.rows.toArray(), [selection.rows]);
  const selectedRowIndex = selectedRows.length > 0 ? selectedRows[0] : -1;
  const hasSelectedRow = selectedRowIndex >= 0 && selectedRowIndex < doc.items.length;

  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineFormData, setLineFormData] = useState<ReceiptLineItem | null>(null);

  const materialOptions = useMemo<ComboboxOption[]>(() => {
    return warehouseStock.map((s) => ({
      value: s.name,
      label: `[${s.sku}] ${s.name}${s.category ? ` (${s.category})` : ""}${s.sheetFormat ? ` • ${s.sheetFormat}` : ""}`,
    }));
  }, [warehouseStock]);

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "workOrderId", title: "Buyurtma №", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "sku", title: "SKU / Kod", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Xomashyo nomi", width: 290, icon: GridColumnIcon.HeaderString },
      { id: "category", title: "Toifa", width: 130, icon: GridColumnIcon.HeaderSingleValue },
      { id: "sheetFormat", title: "Format", width: 95, icon: GridColumnIcon.HeaderString },
      { id: "grammage", title: "Zichlik", width: 85, icon: GridColumnIcon.HeaderNumber },
      { id: "quantity", title: "Miqdori", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "unitPriceUsd", title: "Narxi ($)", width: 115, icon: GridColumnIcon.HeaderNumber },
      { id: "lineTotal", title: "Summasi ($)", width: 130, icon: GridColumnIcon.HeaderNumber },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = doc.items[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "workOrderId") {
        return {
          kind: GridCellKind.Text,
          data: item.workOrderId || "",
          displayData: item.workOrderId || "—",
          allowOverlay: !isPosted,
          readonly: isPosted,
          themeOverride: item.workOrderId
            ? { textDark: isDark ? "#60a5fa" : "#2563eb", baseFontStyle: "bold 12px monospace" }
            : undefined,
        };
      }

      if (column.id === "name") {
        return {
          kind: GridCellKind.Text,
          data: item.name || "",
          displayData: item.name || "— (Nomsiz xomashyo)",
          allowOverlay: !isPosted,
          readonly: isPosted,
          themeOverride: !item.name
            ? { textDark: isDark ? "#71717a" : "#a1a1aa", baseFontStyle: "italic 12px sans-serif" }
            : undefined,
        };
      }

      if (column.id === "lineTotal") {
        const total = Number(((Number(item.quantity) || 0) * (Number(item.unitPriceUsd) || 0)).toFixed(2));
        return {
          kind: GridCellKind.Number,
          data: total,
          displayData: `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "700 12px monospace",
            textDark: isDark ? "#4ade80" : "#15803d",
          },
        };
      }

      if (column.id === "quantity" || column.id === "unitPriceUsd" || column.id === "grammage") {
        const num = Number((item as any)[column.id] || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData:
            column.id === "unitPriceUsd"
              ? `$${num.toFixed(3)}`
              : column.id === "grammage"
              ? num > 0
                ? `${num} g/m²`
                : "—"
              : num.toLocaleString(),
          allowOverlay: !isPosted,
          readonly: isPosted,
          contentAlign: "right",
        };
      }

      const strVal = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: strVal,
        displayData: strVal || "—",
        allowOverlay: !isPosted,
        readonly: isPosted,
      };
    },
    [doc.items, columns, isPosted, isDark]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (isPosted) return;
      const [col, row] = cell;
      const column = columns[col];
      if (!column) return;

      setDoc((prev) => {
        const nextItems = [...prev.items];
        const target = { ...nextItems[row] };
        if (!target) return prev;

        const colId = column.id as keyof ReceiptLineItem;
        if (colId === "quantity" || colId === "unitPriceUsd" || colId === "grammage") {
          const raw = newValue.data;
          const val =
            typeof raw === "number"
              ? raw
              : parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, "")) || 0;
          (target as any)[colId] = Math.max(0, val);
        } else if (colId) {
          (target as any)[colId] = String(newValue.data ?? "").trim();
        }

        nextItems[row] = target;
        return { ...prev, items: nextItems };
      });
      setTabUnsaved(tab.id, true);
    },
    [isPosted, columns, setTabUnsaved, tab.id]
  );

  // Open line item edit dialog
  const handleOpenEditLine = useCallback(
    (index: number) => {
      if (isPosted) return;
      const item = doc.items[index];
      if (!item) return;
      setEditingLineIndex(index);
      setLineFormData({ ...item });
    },
    [isPosted, doc.items]
  );

  // Save changes from line item edit dialog
  const handleSaveLineForm = useCallback(() => {
    if (editingLineIndex === null || !lineFormData) return;
    if (!lineFormData.name.trim()) {
      alert("Material nomini kiritish shart!");
      return;
    }
    setDoc((prev) => {
      const nextItems = [...prev.items];
      nextItems[editingLineIndex] = {
        ...lineFormData,
        name: lineFormData.name.trim(),
        sku: lineFormData.sku.trim() || `MAT-${Date.now().toString().slice(-4)}`,
        quantity: Number(lineFormData.quantity) || 0,
        unitPriceUsd: Number(lineFormData.unitPriceUsd) || 0,
        grammage: Number(lineFormData.grammage) || 0,
      };
      return { ...prev, items: nextItems };
    });
    setTabUnsaved(tab.id, true);
    setEditingLineIndex(null);
    setLineFormData(null);
  }, [editingLineIndex, lineFormData, setTabUnsaved, tab.id]);

  // Add line from catalog (Auto-opens edit dialog to set incoming quantity and price!)
  const handleAddLineFromCatalog = (stockItem: WarehouseStockRecord) => {
    if (isPosted) return;
    const newLine: ReceiptLineItem = {
      id: `line-${Date.now()}-${doc.items.length}`,
      workOrderId: "",
      sku: stockItem.sku,
      name: stockItem.name,
      category: stockItem.category || "Paper & Board",
      sheetFormat: stockItem.sheetFormat || "",
      grammage: stockItem.grammage || 0,
      quantity: 0,
      unit: stockItem.unit || "sheets",
      unitPriceUsd: stockItem.unitPriceUsd || 0,
    };
    const newItems = [...doc.items, newLine];
    const newIndex = newItems.length - 1;
    setDoc((prev) => ({ ...prev, items: newItems }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.fromSingleSelection(newIndex),
    });
    setTabUnsaved(tab.id, true);
    setIsCatalogDialogOpen(false);

    // Open line edit dialog immediately to set received quantity and confirm price
    setEditingLineIndex(newIndex);
    setLineFormData({ ...newLine });
  };

  // Add clean blank line and immediately open line dialog for easy data entry
  const handleAddEmptyLine = () => {
    if (isPosted) return;
    const nextIdx = doc.items.length + 1;
    const newLine: ReceiptLineItem = {
      id: `line-${Date.now()}-${nextIdx}`,
      workOrderId: "",
      sku: `MAT-${100 + nextIdx}`,
      name: "",
      category: "Paper & Board",
      sheetFormat: "",
      grammage: 0,
      quantity: 0,
      unit: "sheets",
      unitPriceUsd: 0,
    };
    const newItems = [...doc.items, newLine];
    const newIndex = newItems.length - 1;
    setDoc((prev) => ({ ...prev, items: newItems }));
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.fromSingleSelection(newIndex),
    });
    setTabUnsaved(tab.id, true);

    // Open line edit dialog directly so the user can easily select or type material name and quantities
    setEditingLineIndex(newIndex);
    setLineFormData({ ...newLine });
  };

  // Open Full Material Passport Tab via WarehouseStockDetail
  const handleOpenFullStockPassport = () => {
    const newSku = `MAT-${Date.now().toString().slice(-4)}`;
    openTab({
      id: `stock-${newSku}`,
      title: `Yangi Xomashyo Pasporti: ${newSku}`,
      type: "warehouse-stock",
      module: "warehouse",
      isUnsaved: false,
      documentData: {
        sku: newSku,
        name: "",
        category: "Paper & Board",
        unit: "sheets",
        location: doc.location || "Asosiy ombor",
        stockLevel: 0,
        available: 0,
        reserved: 0,
        reorder: 1000,
        unitPriceUsd: 0,
        status: "Out of Stock",
      },
    });
  };

  // Add items from active Work Orders
  const handleAddFromWorkOrders = () => {
    if (selectedWoIds.length === 0) return;
    const itemsToAdd: ReceiptLineItem[] = [];

    selectedWoIds.forEach((woId) => {
      const q = productionQueue.find((item) => item.id === woId);
      if (!q) return;

      const matchedStock = warehouseStock.find(
        (s) =>
          s.name.toLowerCase().includes(q.product.toLowerCase()) ||
          q.product.toLowerCase().includes(s.name.toLowerCase()) ||
          s.category === "Paper & Board"
      );

      const neededQty = q.plannedSheets || q.quantity || 1000;
      const avail = matchedStock?.available || 0;
      const deficit = Math.max(0, neededQty - avail);

      itemsToAdd.push({
        id: `line-${Date.now()}-${Math.random().toString().slice(-4)}`,
        workOrderId: q.id,
        sku: matchedStock?.sku || `PAP-${q.id.replace(/\D/g, "").slice(-3)}`,
        name: matchedStock?.name || `${q.product} Xomashyosi`,
        category: matchedStock?.category || "Paper & Board",
        sheetFormat: matchedStock?.sheetFormat || "700×1000",
        grammage: matchedStock?.grammage || 250,
        quantity: deficit > 0 ? deficit : neededQty,
        unit: matchedStock?.unit || (q.unit as any) || "sheets",
        unitPriceUsd: matchedStock?.unitPriceUsd || 0,
      });
    });

    setDoc((prev) => ({ ...prev, items: [...prev.items, ...itemsToAdd] }));
    setTabUnsaved(tab.id, true);
    setIsWoDialogOpen(false);
    setSelectedWoIds([]);
  };

  const handleDeleteSelected = () => {
    if (isPosted) return;
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0) return;
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

  const isDraft = !doc.id || doc.id.startsWith("draft-") || doc.id.startsWith("new-") || doc.id.startsWith("RCV-NEW-");

  const handleSaveDraft = async () => {
    const res = await upsertWarehouseReceiptAsync({
      ...doc,
      receiptNumber: isDraft ? "" : doc.id,
      status: "Draft",
    });
    if (res && res.receiptNumber) {
      const realId = res.receiptNumber;
      setDoc((prev) => ({ ...prev, id: realId }));
      replaceTabId(tab.id, realId, `${realId}: ${doc.supplier || "Kirim Hujjati"}`, { ...doc, id: realId });
    }
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Ombor kirimi saqlandi",
      description: "Qoralama hujjat muvaffaqiyatli saqlandi.",
      severity: "info",
    });
  };

  const handlePostReceipt = async () => {
    if (isPosted) return;
    if (doc.items.length === 0) {
      alert("Kirim qilish uchun kamida bitta xomashyo qatori kiritilishi shart!");
      return;
    }

    doc.items.forEach((line) => {
      const existing = warehouseStock.find(
        (s) =>
          s.sku.toLowerCase() === line.sku.toLowerCase() ||
          s.name.toLowerCase() === line.name.toLowerCase()
      );
      if (existing) {
        upsertWarehouseStock({
          ...existing,
          stockLevel: existing.stockLevel + (line.quantity || 0),
          available: existing.available + (line.quantity || 0),
          unitPriceUsd: line.unitPriceUsd || existing.unitPriceUsd,
          lastReceived: doc.date,
        });
      } else {
        upsertWarehouseStock({
          sku: line.sku,
          name: line.name || "Noma'lum Xomashyo",
          category: (line.category as any) || "Paper & Board",
          grammage: line.grammage,
          sheetFormat: line.sheetFormat,
          unit: (line.unit as any) || "sheets",
          location: doc.location,
          stockLevel: line.quantity || 0,
          reserved: 0,
          available: line.quantity || 0,
          reorder: 1000,
          unitPriceUsd: line.unitPriceUsd || 0,
          lastReceived: doc.date,
          status: "In Stock",
        });
      }
    });

    const res = await upsertWarehouseReceiptAsync({
      ...doc,
      receiptNumber: isDraft ? "" : doc.id,
      status: "Accepted",
    });
    const finalId = res?.receiptNumber || doc.id;
    setDoc((prev) => ({ ...prev, id: finalId, status: "Accepted" }));
    if (isDraft && res?.receiptNumber) {
      replaceTabId(tab.id, finalId, `${finalId}: ${doc.supplier || "Kirim Hujjati"}`, { ...doc, id: finalId, status: "Accepted" });
    }
    setTabUnsaved(tab.id, false);
    addNotification({
      title: `Ombor kirimi tasdiqlandi: ${finalId}`,
      description: `${doc.items.length} turdagi xomashyo (${totalQty.toLocaleString()} birlik, $${totalAmountUsd.toLocaleString()}) ombor qoldig'iga kiritildi.`,
      severity: "success",
    });
  };

  // Filtered catalog list for modal picker
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return warehouseStock;
    const q = catalogSearch.toLowerCase();
    return warehouseStock.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q) ||
        (s.sheetFormat && s.sheetFormat.toLowerCase().includes(q))
    );
  }, [warehouseStock, catalogSearch]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Top Document Action Bar */}
      <div className="px-3 bg-muted/60 border-b border-border shrink-0 flex items-center justify-between h-9 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowDownToLine className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-xs truncate flex items-center gap-1.5">
            <span>Ombor kirim hujjati:</span>
            <span className={cn(isDraft && "font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded")}>
              {isDraft ? "Yangi" : doc.id}
            </span>
          </span>
          <Separator orientation="vertical" className="h-4 mx-1" />
          {isPosted ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[11px] gap-1">
              <Lock className="w-3 h-3" />
              <span>Tasdiqlangan</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px]">
              Qoralama
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => typeof window !== "undefined" && window.print()}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Chop etish</span>
          </Button>
          {!isPosted && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                className="h-7 px-2.5 text-xs gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Saqlash</span>
              </Button>
              <Button
                size="sm"
                onClick={handlePostReceipt}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Kirim qilish</span>
              </Button>
            </>
          )}
          {isPosted && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => closeTab(tab.id)}
              className="h-7 px-3 text-xs"
            >
              Yopish
            </Button>
          )}
        </div>
      </div>

      {/* Document Header Requisites: Bound to Directories */}
      <div className="p-3 bg-card border-b border-border grid grid-cols-1 md:grid-cols-5 gap-3 shrink-0">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Hujjat № va sana</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={isDraft ? "Yangi" : doc.id}
              readOnly
              className="h-7 text-xs font-mono bg-muted/50 w-28 text-muted-foreground font-medium"
            />
            <DatePicker
              value={doc.date}
              disabled={isPosted}
              onChange={(val) => handleFieldChange("date", val)}
              className="h-7 text-xs font-mono bg-background flex-1"
            />
          </div>
        </div>

        {/* Supplier Field with Combobox & Custom Add */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Yetkazib beruvchi</Label>
          <FieldCombobox
            value={doc.supplier}
            onChange={(val) => handleFieldChange("supplier", val)}
            allowCustom={true}
            options={supplierOptions}
            disabled={isPosted}
            placeholder="Yetkazib beruvchini tanlang yoki yozing..."
            className="h-7 text-xs bg-background"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Shartnoma / Invoice №</Label>
          <Input
            value={doc.poNumber}
            readOnly={isPosted}
            placeholder="INV-2026-..."
            onChange={(e) => handleFieldChange("poNumber", e.target.value)}
            className="h-7 text-xs font-mono bg-background"
          />
        </div>

        {/* Warehouse Location Selector */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Qabul qiluvchi ombor</Label>
          <Select
            value={doc.location}
            disabled={isPosted}
            onValueChange={(val) => handleFieldChange("location", val)}
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue placeholder="Omborni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {warehouseOptions.map((wh) => (
                <SelectItem key={wh.id} value={wh.name}>
                  {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Received By Employee Combobox */}
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Qabul qildi</Label>
          <FieldCombobox
            value={doc.receivedBy}
            onChange={(val) => handleFieldChange("receivedBy", val)}
            allowCustom={true}
            options={employeeOptions}
            disabled={isPosted}
            placeholder="Omborchini tanlang..."
            className="h-7 text-xs bg-background"
          />
        </div>
      </div>

      {/* Tabular Section Toolbar — Clean, Single-Line, Never Wraps */}
      <div className="px-3 bg-muted/40 border-b border-border flex items-center justify-between h-9 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Boxes className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-xs whitespace-nowrap">
            Kirim qilinayotgan xomashyolar
          </span>

          {!isPosted && (
            <>
              <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

              {/* Compact Unified Dropdown Menu for Adding Lines */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Qator qo&apos;shish</span>
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-60 text-xs">
                  <DropdownMenuItem
                    onClick={() => setIsWoDialogOpen(true)}
                    className="gap-2 cursor-pointer py-1.5"
                  >
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    <span>Buyurtmadan to&apos;ldirish</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsCatalogDialogOpen(true)}
                    className="gap-2 cursor-pointer py-1.5"
                  >
                    <Boxes className="w-4 h-4 text-amber-600" />
                    <span>Katalogdan tanlab qo&apos;shish...</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleOpenFullStockPassport}
                    className="gap-2 cursor-pointer py-1.5"
                  >
                    <ExternalLink className="w-4 h-4 text-purple-600" />
                    <span>Yangi xomashyo pasporti ochish</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleAddEmptyLine}
                    className="gap-2 cursor-pointer py-1.5"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>Bo&apos;sh qator kiritish</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Edit Selected Button */}
              {hasSelectedRow && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEditLine(selectedRowIndex)}
                  className="h-7 px-2.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1.5 cursor-pointer font-medium"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Tahrirlash</span>
                </Button>
              )}

              {/* Delete Selected Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteSelected}
                disabled={!hasSelectedRow}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O&apos;chirish</span>
              </Button>
            </>
          )}
        </div>

        {/* Right side summary totals */}
        <div className="flex items-center gap-3 font-mono text-[11px] whitespace-nowrap shrink-0">
          <span>
            Qatorlar: <strong>{doc.items.length}</strong>
          </span>
          <span>
            Jami: <strong>{totalQty.toLocaleString()}</strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            Summa: ${totalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Glide Data Grid wrapped in Table ContextMenu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 w-full h-full relative outline-none"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hasSelectedRow && !isPosted) {
                e.preventDefault();
                handleOpenEditLine(selectedRowIndex);
              } else if (e.key === "Delete" && hasSelectedRow && !isPosted) {
                e.preventDefault();
                handleDeleteSelected();
              }
            }}
          >
            <DataEditor
              getCellContent={getCellContent}
              onCellEdited={handleCellEdited}
              columns={columns}
              rows={doc.items.length}
              rowMarkers="both"
              freezeColumns={2}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellContextMenu={(cell) => {
                const [, row] = cell;
                setSelection({
                  columns: CompactSelection.empty(),
                  rows: CompactSelection.fromSingleSelection(row),
                });
              }}
              onCellActivated={(cell) => {
                const [, row] = cell;
                handleOpenEditLine(row);
              }}
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
          </div>
        </ContextMenuTrigger>

        {/* Right-click Context Menu directly on the Grid */}
        <ContextMenuContent className="w-56 text-xs">
          {!isPosted ? (
            <>
              {hasSelectedRow && (
                <ContextMenuItem
                  onClick={() => handleOpenEditLine(selectedRowIndex)}
                  className="gap-2 cursor-pointer font-medium text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Qatorni tahrirlash</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
                </ContextMenuItem>
              )}
              <ContextMenuItem onClick={handleAddEmptyLine} className="gap-2 cursor-pointer">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bo&apos;sh qator qo&apos;shish</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setIsWoDialogOpen(true)} className="gap-2 cursor-pointer">
                <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                <span>Work Orderdan to&apos;ldirish...</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setIsCatalogDialogOpen(true)} className="gap-2 cursor-pointer">
                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                <span>Katalogdan tanlab qo&apos;shish...</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={handleOpenFullStockPassport} className="gap-2 cursor-pointer">
                <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                <span>Yangi xomashyo pasporti ochish</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={handleDeleteSelected}
                disabled={!hasSelectedRow}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tanlangan qatorni o&apos;chirish</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onClick={() => typeof window !== "undefined" && window.print()} className="gap-2">
              <Printer className="w-3.5 h-3.5" />
              <span>Jadvalni chop etish</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Modal 1: Select Deficit Materials from Active Work Orders (Compact with Search) */}
      <Dialog open={isWoDialogOpen} onOpenChange={setIsWoDialogOpen}>
        <DialogContent className="sm:max-w-md p-3.5 text-xs">
          <DialogHeader className="gap-0.5 pb-1">
            <DialogTitle className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                <span>Work Orderdan to&apos;ldirish</span>
              </span>
              <span className="text-[10px] font-normal text-muted-foreground font-mono">
                {selectedWoIds.length}/{productionQueue.length} tanlandi
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
              <Input
                value={woSearch}
                onChange={(e) => setWoSearch(e.target.value)}
                placeholder="Buyurtma №, mijoz yoki mahsulot qidirish..."
                className="h-7 text-xs pl-8 pr-2 bg-background"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
              <span>Topildi: {filteredWorkOrders.length} ta buyurtma</span>
              {filteredWorkOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const visibleIds = filteredWorkOrders.map((i) => i.id);
                    const allSelected = visibleIds.every((id) => selectedWoIds.includes(id));
                    if (allSelected) {
                      setSelectedWoIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                    } else {
                      setSelectedWoIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                    }
                  }}
                  className="text-primary hover:underline font-medium cursor-pointer"
                >
                  {filteredWorkOrders.every((i) => selectedWoIds.includes(i.id))
                    ? "Barchasini bekor qilish"
                    : "Barchasini tanlash"}
                </button>
              )}
            </div>

            {/* Compact Work Order List */}
            <div className="max-h-60 overflow-y-auto space-y-1 border rounded p-1 bg-muted/20">
              {filteredWorkOrders.length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-[11px]">
                  Mos buyurtmalar topilmadi.
                </div>
              ) : (
                filteredWorkOrders.map((item) => {
                  const isChecked = selectedWoIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedWoIds((prev) =>
                          isChecked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className={cn(
                        "flex items-center justify-between py-1 px-1.5 rounded border text-xs cursor-pointer transition-colors select-none",
                        isChecked
                          ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
                          : "bg-card hover:bg-muted/40 border-border"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          id={`wo-${item.id}`}
                          checked={isChecked}
                          onCheckedChange={() => {}}
                          className="pointer-events-none shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                              {item.id}
                            </span>
                            <span className="font-medium text-foreground truncate max-w-[150px]">
                              {item.customer}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[210px]">
                            {item.product} ({(item.plannedSheets || item.quantity || 0).toLocaleString()} {item.unit})
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 pl-1">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {item.deadline}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center pt-1.5 gap-2">
            <span className="text-[11px] text-muted-foreground">
              Tanlandi: <strong>{selectedWoIds.length}</strong> ta
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWoDialogOpen(false)}
                className="h-7 text-xs px-2.5"
              >
                Bekor qilish
              </Button>
              <Button
                size="sm"
                onClick={handleAddFromWorkOrders}
                disabled={selectedWoIds.length === 0}
                className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Jadvalga qo&apos;shish
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Catalog Selector Modal with Instant Search (Compact) */}
      <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
        <DialogContent className="sm:max-w-md p-3.5 text-xs">
          <DialogHeader className="gap-0.5 pb-1">
            <DialogTitle className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                <span>Katalogdan xomashyo tanlash</span>
              </span>
              <span className="text-[10px] font-normal text-muted-foreground font-mono">
                {filteredCatalog.length}/{warehouseStock.length} ta
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Xomashyo nomi, SKU yoki formati qidirish..."
                className="h-7 text-xs pl-7 pr-2 bg-background"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 border rounded p-1 bg-muted/20">
              {filteredCatalog.length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-[11px]">
                  Bunday material topilmadi.
                </div>
              ) : (
                filteredCatalog.map((stock) => (
                  <div
                    key={stock.sku}
                    onClick={() => handleAddLineFromCatalog(stock)}
                    className="flex items-center justify-between py-1 px-1.5 rounded border bg-card hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 dark:hover:border-blue-800 text-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                          [{stock.sku}]
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[200px]">{stock.name}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span>{stock.category}</span>
                        {stock.sheetFormat && <span>• {stock.sheetFormat} mm</span>}
                        {stock.grammage && <span>• {stock.grammage} g/m²</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 shrink-0 font-mono text-[10px] pl-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {stock.available.toLocaleString()} {stock.unit}
                      </span>
                      <span className="text-muted-foreground">
                        ${stock.unitPriceUsd}/{stock.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center pt-1.5 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenFullStockPassport}
              className="h-7 text-xs px-2 text-purple-600 dark:text-purple-400 gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>+ Yangi pasport</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCatalogDialogOpen(false)}
              className="h-7 text-xs px-2.5"
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Receipt Line Edit Dialog (Compact, Full-Featured Form) */}
      <Dialog
        open={editingLineIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingLineIndex(null);
            setLineFormData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md p-4 text-xs">
          <DialogHeader className="gap-0.5 pb-1">
            <DialogTitle className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-primary" />
                <span>Xomashyo qatorini tahrirlash</span>
              </span>
              {lineFormData?.sku && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {lineFormData.sku}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Kirim qilinayotgan material parametrlarini kiriting yoki katalogdan tanlang.
            </DialogDescription>
          </DialogHeader>

          {lineFormData && (
            <div className="space-y-3 py-1">
              {/* Material Name / Picker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">
                    Material / Xomashyo nomi *
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    (Katalogdan tanlang yoki yangi yozing)
                  </span>
                </div>
                <FieldCombobox
                  value={lineFormData.name}
                  onChange={(val) => {
                    const matched = warehouseStock.find(
                      (s) =>
                        s.name.toLowerCase() === val.toLowerCase() ||
                        s.sku.toLowerCase() === val.toLowerCase()
                    );
                    if (matched) {
                      setLineFormData((prev) =>
                        prev
                          ? {
                              ...prev,
                              name: matched.name,
                              sku: matched.sku,
                              category: matched.category || prev.category,
                              sheetFormat: matched.sheetFormat || prev.sheetFormat,
                              grammage: matched.grammage || prev.grammage,
                              unit: matched.unit || prev.unit,
                              unitPriceUsd:
                                prev.unitPriceUsd > 0
                                  ? prev.unitPriceUsd
                                  : matched.unitPriceUsd || 0,
                            }
                          : null
                      );
                    } else {
                      setLineFormData((prev) => (prev ? { ...prev, name: val } : null));
                    }
                  }}
                  allowCustom={true}
                  options={materialOptions}
                  placeholder="Material nomini tanlang yoki yozing..."
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">SKU / Xomashyo Kodi</Label>
                  <Input
                    value={lineFormData.sku}
                    onChange={(e) =>
                      setLineFormData((prev) => (prev ? { ...prev, sku: e.target.value } : null))
                    }
                    placeholder="MAT-101"
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Toifa</Label>
                  <Select
                    value={lineFormData.category || "Paper & Board"}
                    onValueChange={(val) =>
                      setLineFormData((prev) => (prev ? { ...prev, category: val || "Paper & Board" } : null))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paper & Board">Qog&apos;oz va karton</SelectItem>
                      <SelectItem value="Inks">Bo&apos;yoqlar</SelectItem>
                      <SelectItem value="Plates">Qoliplar</SelectItem>
                      <SelectItem value="Foils">Folga</SelectItem>
                      <SelectItem value="Chemicals">Kimyoviy moddalar</SelectItem>
                      <SelectItem value="Packaging">Qadoqlash</SelectItem>
                      <SelectItem value="Other">Boshqa xomashyolar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Format & Grammage */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Format (mm)</Label>
                  <Input
                    value={lineFormData.sheetFormat || ""}
                    onChange={(e) =>
                      setLineFormData((prev) =>
                        prev ? { ...prev, sheetFormat: e.target.value } : null
                      )
                    }
                    placeholder="Masalan: 700×1000"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Zichlik (g/m²)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={lineFormData.grammage || ""}
                    onChange={(e) =>
                      setLineFormData((prev) =>
                        prev
                          ? { ...prev, grammage: parseFloat(e.target.value) || 0 }
                          : null
                      )
                    }
                    placeholder="250"
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Quantity, Unit & Price */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Miqdori *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={lineFormData.quantity || ""}
                    onChange={(e) =>
                      setLineFormData((prev) =>
                        prev
                          ? { ...prev, quantity: Math.max(0, parseFloat(e.target.value) || 0) }
                          : null
                      )
                    }
                    placeholder="0"
                    className="h-7 text-xs font-mono font-bold"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Birlik</Label>
                  <Select
                    value={lineFormData.unit || "sheets"}
                    onValueChange={(val) =>
                      setLineFormData((prev) => (prev ? { ...prev, unit: val || "sheets" } : null))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sheets">List</SelectItem>
                      <SelectItem value="kg">Kilogramm (kg)</SelectItem>
                      <SelectItem value="roll">Rulon</SelectItem>
                      <SelectItem value="pcs">Dona</SelectItem>
                      <SelectItem value="pack">Pachka</SelectItem>
                      <SelectItem value="m2">m²</SelectItem>
                      <SelectItem value="liter">Litr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Narxi ($)
                  </Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={3}
                    value={lineFormData.unitPriceUsd || ""}
                    onValueChange={(values) =>
                      setLineFormData((prev) =>
                        prev
                          ? { ...prev, unitPriceUsd: Math.max(0, values.floatValue ?? 0) }
                          : null
                      )
                    }
                    placeholder="0.00"
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Work Order Link (Optional) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Bog&apos;langan buyurtma</span>
                  <span className="text-[10px] text-muted-foreground">(Ixtiyoriy)</span>
                </Label>
                <Select
                  value={lineFormData.workOrderId || "none"}
                  onValueChange={(val) =>
                    setLineFormData((prev) =>
                      prev ? { ...prev, workOrderId: !val || val === "none" ? undefined : val } : null
                    )
                  }
                >
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue placeholder="Umumiy ombor (bog'lanmagan)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Umumiy ombor (bog&apos;lanmagan)</SelectItem>
                    {productionQueue.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.id} — {q.product} ({q.customer})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Calculation Preview Banner */}
              <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground font-sans text-[11px]">Qator summasi:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ${((Number(lineFormData.quantity) || 0) * (Number(lineFormData.unitPriceUsd) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingLineIndex(null);
                setLineFormData(null);
              }}
              className="h-7 text-xs px-2.5"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveLineForm}
              className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
