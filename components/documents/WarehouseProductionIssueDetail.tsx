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
  PlayCircle,
  Undo2,
  Boxes,
  Plus,
  Trash2,
  Save,
  Check,
  Lock,
  Edit3,
  Search,
  Sparkles,
  Scissors,
  ArrowRight,
} from "lucide-react";
import { WarehouseSelect } from "@/components/common/WarehouseSelect";
import { FieldCombobox, type ComboboxOption } from "@/components/ui/field-combobox";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export type IssueOperationType = "ProductionIssue" | "ProductionReturn" | "CuttingReturn";

export const OPERATION_TYPE_LABELS: Record<IssueOperationType, string> = {
  ProductionIssue: "Sexga xomashyo berish (Talabnoma)",
  ProductionReturn: "Sexdan xomashyo qaytarish (Ortiqcha va qoldiq material)",
  CuttingReturn: "Delovoy otxod (Kesim qoldig'i) qaytarish",
};

export interface ProductionIssueDoc {
  id: string;
  date: string;
  operationType: IssueOperationType;
  warehouse: string; // Chiquvchi yoki qabul qiluvchi ombor
  workOrderId: string;
  pressMachine: string;
  operator: string;
  reason: string;
  status: "Completed" | "Pending";
  items: MovementLineItem[];
}

export function WarehouseProductionIssueDetail({ tab }: { tab: DocumentTab }) {
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
    toggleReadinessCheck,
    replaceTabId,
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  const initialDoc = useMemo<ProductionIssueDoc>(() => {
    const d = tab.documentData || {};
    let initialItems: MovementLineItem[] = [];

    if (Array.isArray(d.items) && d.items.length > 0) {
      initialItems = d.items;
    } else if (d.material || d.materialName) {
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

    const initialOpType: IssueOperationType =
      d.operationType ||
      (d.movementType === "CuttingReturn"
        ? "CuttingReturn"
        : d.movementType === "ProductionReturn"
        ? "ProductionReturn"
        : "ProductionIssue");

    return {
      id: d.id || tab.id,
      date: d.date || d.movementDate || new Date().toISOString().split("T")[0],
      operationType: initialOpType,
      warehouse: d.warehouse || d.from || d.fromLocationName || (warehousesList[0]?.name || "Asosiy ombor"),
      workOrderId: d.workOrderId || "",
      pressMachine: d.pressMachine || "",
      operator: d.operator || (employees[0]?.fullName || "Ombor mudiri"),
      reason: d.reason || "",
      status: d.status === "Completed" ? "Completed" : "Pending",
      items: initialItems,
    };
  }, [tab.documentData, tab.id, warehousesList, employees]);

  const [doc, setDoc] = useState<ProductionIssueDoc>(initialDoc);
  const isLocked = doc.status === "Completed";
  const isDraft =
    !doc.id ||
    doc.id.startsWith("draft-") ||
    doc.id.startsWith("new-") ||
    doc.id.startsWith("ISSUE-NEW-") ||
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
  const [pickerQuantity, setPickerQuantity] = useState<number>(100);

  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineFormData, setLineFormData] = useState<MovementLineItem | null>(null);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const selectedRows = selection.rows.toArray();
  const hasSelectedRow = selectedRows.length > 0;
  const selectedRowIndex = selectedRows[0];

  const handleFieldChange = useCallback(
    (field: keyof ProductionIssueDoc, val: any) => {
      if (isLocked) return;
      setDoc((prev) => ({ ...prev, [field]: val }));
      setTabUnsaved(tab.id, true);
    },
    [isLocked, setTabUnsaved, tab.id]
  );

  // Buyurtmaga biriktirilgan barcha xomashyolarni (qog'oz, plyonka, lak/bo'yoq) aniqlash
  const getMaterialsForWorkOrder = useCallback((wo: any): MovementLineItem[] => {
    const items: MovementLineItem[] = [];

    // 1. Agar wo.materials massivida aniq materiallar ro'yxati berilgan bo'lsa
    if (Array.isArray(wo.materials) && wo.materials.length > 0) {
      wo.materials.forEach((mat: any, idx: number) => {
        const matched = warehouseStock.find(
          (s) => (mat.sku && s.sku === mat.sku) || s.name.toLowerCase() === (mat.name || "").toLowerCase()
        );
        const qty = Number(mat.quantity) || 100;
        items.push({
          id: `item-${Date.now()}-${idx}`,
          sku: mat.sku || matched?.sku || `MAT-${wo.id.slice(-4)}-${idx + 1}`,
          name: mat.name || matched?.name || "Xomashyo",
          category: matched?.category || mat.category || "Paper & Board",
          sheetFormat: mat.sheetFormat || matched?.sheetFormat || "",
          grammage: mat.grammage || matched?.grammage || 0,
          quantity: qty,
          receivedQty: qty,
          unit: mat.unit || matched?.unit || "sheets",
          notes: `${wo.id} texnologik xaritasi bo'yicha`,
        });
      });
    }

    // 2. Asosiy qog'oz / Substrat (PaperStock)
    const plannedQty = Number(wo.plannedSheets) || Number(wo.quantity) || 1000;
    const hasPaper = items.some((i) => i.category === "Paper & Board" || i.unit === "sheets" || i.unit === "rolls");

    if (!hasPaper) {
      const matchedStock =
        warehouseStock.find(
          (s) =>
            (wo.paperStock && s.name.toLowerCase().includes(wo.paperStock.toLowerCase())) ||
            (wo.product && s.name.toLowerCase().includes(wo.product.toLowerCase())) ||
            (wo.product && wo.product.toLowerCase().includes(s.name.toLowerCase()))
        ) || warehouseStock.find((s) => s.category === "Paper & Board");

      items.push({
        id: `item-${Date.now()}-paper`,
        sku: matchedStock?.sku || `PAP-${wo.id.replace(/\D/g, "").slice(-4) || "REQ"}`,
        name: matchedStock?.name || wo.paperStock || `${wo.product} Qog'ozi`,
        category: matchedStock?.category || "Paper & Board",
        sheetFormat: matchedStock?.sheetFormat || "700×1000",
        grammage: matchedStock?.grammage || wo.grammage || wo.paperDensity || 250,
        quantity: plannedQty,
        receivedQty: plannedQty,
        unit: matchedStock?.unit || "sheets",
        notes: `${wo.id} rejalashtirilgan xomashyosi`,
      });
    }

    // 3. Agar Laminatsiya plyonkasi bo'lsa
    if (
      wo.lamination &&
      typeof wo.lamination === "string" &&
      !wo.lamination.toLowerCase().includes("yo'q") &&
      !wo.lamination.toLowerCase().includes("none")
    ) {
      const matchedLam = warehouseStock.find(
        (s) =>
          s.category === "Foil & Film" ||
          s.name.toLowerCase().includes("laminat") ||
          s.name.toLowerCase().includes("film")
      );
      const lamQty = Math.ceil(plannedQty * 0.7);
      items.push({
        id: `item-${Date.now()}-lam`,
        sku: matchedLam?.sku || `FLM-${wo.id.replace(/\D/g, "").slice(-3) || "LAM"}`,
        name: matchedLam?.name || `${wo.lamination} Plyonkasi`,
        category: "Foil & Film",
        sheetFormat: matchedLam?.sheetFormat || "",
        grammage: 0,
        quantity: lamQty,
        receivedQty: lamQty,
        unit: matchedLam?.unit || "m²",
        notes: `${wo.id} laminatsiya plyonkasi`,
      });
    }

    // 4. Agar Lak / Qoplama (Coating) bo'lsa
    if (
      wo.coating &&
      typeof wo.coating === "string" &&
      !wo.coating.toLowerCase().includes("yo'q") &&
      !wo.coating.toLowerCase().includes("none")
    ) {
      const matchedCoating = warehouseStock.find(
        (s) =>
          s.category === "Inks & Plates" ||
          s.name.toLowerCase().includes("lak") ||
          s.name.toLowerCase().includes("varnish")
      );
      const varnishKg = Math.max(1, Math.ceil(plannedQty * 0.003));
      items.push({
        id: `item-${Date.now()}-coat`,
        sku: matchedCoating?.sku || `INK-LAK-${wo.id.replace(/\D/g, "").slice(-3) || "LAK"}`,
        name: matchedCoating?.name || `${wo.coating} Laki`,
        category: "Inks & Plates",
        sheetFormat: "",
        grammage: 0,
        quantity: varnishKg,
        receivedQty: varnishKg,
        unit: matchedCoating?.unit || "kg",
        notes: `${wo.id} qoplama laki`,
      });
    }

    return items;
  }, [warehouseStock]);

  // Buyurtma tanlanganda avtomatik stanok, sabab va BARCHA materiallarni jadvalga tushirish
  const handleSelectWorkOrder = (woId: string) => {
    if (isLocked) return;
    const wo = productionQueue.find((q) => q.id === woId);
    if (!wo) {
      handleFieldChange("workOrderId", woId);
      return;
    }

    const autoItems = getMaterialsForWorkOrder(wo);

    setDoc((prev) => ({
      ...prev,
      workOrderId: wo.id,
      pressMachine: wo.pressMachine || prev.pressMachine,
      reason: prev.reason || `${wo.id} (${wo.product}) buyurtmasi uchun xomashyo`,
      items: autoItems.length > 0 ? autoItems : prev.items,
    }));
    setTabUnsaved(tab.id, true);

    if (autoItems.length > 0) {
      addNotification({
        title: "Buyurtma materiallari yuklandi",
        description: `${wo.id} bo'yicha ${autoItems.length} ta xomashyo avtomatik ro'yxatga tushirildi.`,
        severity: "info",
      });
    }
  };

  // Buyurtmadan xomashyo talabini qo'lda qayta to'ldirish
  const handleFillFromWorkOrder = () => {
    if (isLocked || !doc.workOrderId) return;
    const wo = productionQueue.find((q) => q.id === doc.workOrderId);
    if (!wo) {
      alert("Tanlangan buyurtma topilmadi!");
      return;
    }

    const autoItems = getMaterialsForWorkOrder(wo);
    setDoc((prev) => ({
      ...prev,
      pressMachine: wo.pressMachine || prev.pressMachine,
      items: autoItems,
    }));
    setTabUnsaved(tab.id, true);

    addNotification({
      title: "Buyurtmadan to'ldirildi",
      description: `${wo.id} rejasidagi ${autoItems.length} ta xomashyo ro'yxatga kiritildi.`,
      severity: "info",
    });
  };

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

  const handleSaveDraft = async () => {
    const payload = {
      ...doc,
      movementNumber: isDraft ? "" : doc.id,
      movementType: doc.operationType,
      from: doc.warehouse,
      to: doc.pressMachine || "Sex (Bosma mashinasi)",
      status: "Pending",
      quantity: doc.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0),
      material: doc.items.map((i) => i.name).join(", ") || "Material",
    };

    const res: any = await upsertWarehouseMovementAsync(payload);
    let realId = res?.movementNumber || (isDraft ? `${doc.operationType === "ProductionIssue" ? "ISS" : "RET"}-26-0001` : doc.id);
    if (realId.startsWith("draft-") || realId.startsWith("new-") || realId.startsWith("tab-")) {
      realId = `${doc.operationType === "ProductionIssue" ? "ISS" : "RET"}-26-0001`;
    }

    setDoc((prev) => ({ ...prev, id: realId }));
    replaceTabId(tab.id, realId, `${realId}: ${doc.operationType === "ProductionIssue" ? "Sexga berish" : "Sexdan qaytarish"}`, { ...doc, id: realId });
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Hujjat qoralamasi saqlandi",
      description: `${realId} muvaffaqiyatli saqlandi.`,
      severity: "info",
    });
  };

  const handlePostDocument = async () => {
    if (isLocked) return;
    if (!doc.warehouse?.trim()) {
      alert("Omborni tanlash shart!");
      return;
    }
    if (doc.items.length === 0) {
      alert("Kamida bitta material qatori kiritilishi shart!");
      return;
    }

    const isIssue = doc.operationType === "ProductionIssue";

    // Ombor balansini yangilash
    doc.items.forEach((line) => {
      const qty = Number(line.quantity) || 0;
      const targetItem = warehouseStock.find(
        (s) => (s.sku === line.sku || s.name === line.name) && s.location === doc.warehouse
      );

      if (isIssue) {
        // Sexga berilganda: ombordan ayirish
        if (targetItem) {
          upsertWarehouseStock({
            ...targetItem,
            stockLevel: Math.max(0, targetItem.stockLevel - qty),
            available: Math.max(0, targetItem.available - qty),
          });
        }
      } else if (doc.operationType === "ProductionReturn") {
        // Butun qog'oz qaytganida: omborga qayta qo'shish
        if (targetItem) {
          upsertWarehouseStock({
            ...targetItem,
            stockLevel: targetItem.stockLevel + qty,
            available: targetItem.available + qty,
          });
        }
      }
      // CuttingReturn: the server receives the offcut into its own "-OFF" card and values it;
      // the stock list is reloaded after the document is posted.
    });



    const payload = {
      ...doc,
      movementNumber: isDraft ? "" : doc.id,
      movementType: doc.operationType,
      from: isIssue ? doc.warehouse : (doc.pressMachine || "Sex"),
      to: isIssue ? (doc.pressMachine || "Sex") : doc.warehouse,
      status: "Completed",
      quantity: doc.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0),
      material: doc.items.map((i) => i.name).join(", ") || "Material",
    };

    const res: any = await upsertWarehouseMovementAsync(payload);
    let realId = res?.movementNumber || (isDraft ? `${isIssue ? "ISS" : "RET"}-26-0001` : doc.id);
    if (realId.startsWith("draft-") || realId.startsWith("new-") || realId.startsWith("tab-")) {
      realId = `${isIssue ? "ISS" : "RET"}-26-0001`;
    }

    // Buyurtma tayyorlik darvozasini yangilash (Paper ready)
    if (isIssue && doc.workOrderId) {
      toggleReadinessCheck(doc.workOrderId, "paperReady", {
        verifiedBy: doc.operator || "Omborchi",
        note: `${realId} orqali xomashyo sexga berildi`,
        forceStatus: "ready",
      });
    }

    setDoc((prev) => ({ ...prev, id: realId, status: "Completed" }));
    replaceTabId(tab.id, realId, `${realId}: ${isIssue ? "Sexga berildi" : "Sexdan qaytdi"}`, {
      ...doc,
      id: realId,
      status: "Completed",
    });
    setTabUnsaved(tab.id, false);

    addNotification({
      title: `${isIssue ? "Sexga berish" : "Sexdan qaytarish"} tasdiqlandi: ${realId}`,
      description: `${doc.items.length} ta xomashyo muvaffaqiyatli hisobdan o'tkazildi.`,
      severity: "success",
    });

    closeTab(realId);
    closeTab(tab.id);
  };

  const columns = useMemo<GridColumn[]>(() => {
    return [
      { id: "index", title: "№", width: 45, icon: GridColumnIcon.HeaderRowID },
      { id: "sku", title: "SKU Kodi", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Material Nomi", width: 280, icon: GridColumnIcon.HeaderString },
      { id: "category", title: "Kategoriya", width: 140, icon: GridColumnIcon.HeaderLookup },
      { id: "sheetFormat", title: "Format / O'lcham", width: 120, icon: GridColumnIcon.HeaderString },
      {
        id: "quantity",
        title: doc.operationType === "ProductionIssue" ? "Berilgan miqdor" : "Qaytarilgan miqdor",
        width: 130,
        icon: GridColumnIcon.HeaderNumber,
      },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "notes", title: "Izoh / Eslatma", width: 220, icon: GridColumnIcon.HeaderTextTemplate },
    ];
  }, [doc.operationType]);

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
      {/* 1. Header Toolbar */}
      <div className="px-3 py-2 bg-card border-b border-border flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            {doc.operationType === "ProductionIssue" ? (
              <PlayCircle className="size-3.5" />
            ) : (
              <Undo2 className="size-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground truncate">
                {isDraft
                  ? doc.operationType === "ProductionIssue"
                    ? "Yangi: Sexga xomashyo berish"
                    : "Yangi: Sexdan xomashyo qaytarish"
                  : `${doc.id}: ${doc.operationType === "ProductionIssue" ? "Sexga berish" : "Sexdan qaytarish"}`}
              </span>
              {isLocked ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
                  <Lock className="size-3" />
                  <span>Tasdiqlangan</span>
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
              {doc.workOrderId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFillFromWorkOrder}
                  className="h-7 px-2.5 text-xs gap-1.5 font-medium border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                >
                  <Sparkles className="size-3" />
                  <span>Buyurtmadan to'ldirish</span>
                </Button>
              )}

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
        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Hujjat № va sana</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={isDraft ? "Yangi" : doc.id}
              readOnly
              className="h-8 text-xs font-mono bg-muted/40 w-24 text-muted-foreground font-medium"
            />
            <DatePicker
              value={doc.date}
              disabled={isLocked}
              onChange={(val) => handleFieldChange("date", val)}
              className="h-8 text-xs font-mono bg-background flex-1"
            />
          </div>
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Amaliyot turi</Label>
          <Select
            value={doc.operationType}
            disabled={isLocked}
            onValueChange={(val: any) => { if (val) handleFieldChange("operationType", val as IssueOperationType); }}
          >
            <SelectTrigger className="h-8 w-full text-xs bg-background">
              <SelectValue>
                {OPERATION_TYPE_LABELS[doc.operationType] || doc.operationType}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-(--anchor-width) min-w-[280px]">
              <SelectItem value="ProductionIssue" className="text-xs py-1.5 cursor-pointer">
                Sexga xomashyo berish (Talabnoma)
              </SelectItem>
              <SelectItem value="ProductionReturn" className="text-xs py-1.5 cursor-pointer">
                Sexdan xomashyo qaytarish (Ortiqcha va qoldiq material)
              </SelectItem>
              <SelectItem value="CuttingReturn" className="text-xs py-1.5 cursor-pointer">
                Delovoy otxod (Kesim qoldig'i) qaytarish
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">
            {doc.operationType === "ProductionIssue" ? "Chiquvchi ombor *" : "Qabul qiluvchi ombor *"}
          </Label>
          <WarehouseSelect
            value={doc.warehouse}
            disabled={isLocked}
            onValueChange={(val) => handleFieldChange("warehouse", val.warehouseName)}
            placeholder="Omborni tanlang..."
            className="h-8 text-xs bg-background"
          />
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Ishlab chiqarish buyurtmasi (Work Order)</Label>
          <FieldCombobox
            value={doc.workOrderId}
            onChange={(val) => handleSelectWorkOrder(val)}
            options={workOrderOptions}
            placeholder="Buyurtmani tanlang..."
            searchPlaceholder="Naryad №, mahsulot yoki mijoz..."
            disabled={isLocked}
            allowCustom={true}
            className="h-8 text-xs bg-background font-mono"
          />
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Uskuna / Stanok</Label>
          <FieldCombobox
            value={doc.pressMachine}
            onChange={(val) => handleFieldChange("pressMachine", val)}
            options={machineOptions}
            placeholder="Stanokni tanlang yoki yozing..."
            searchPlaceholder="Stanok nomi yoki bo'lim..."
            disabled={isLocked}
            allowCustom={true}
            className="h-8 text-xs bg-background"
          />
        </div>

        <div className="space-y-1 sm:col-span-1 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground">Mas'ul shaxs (Omborchi / Usta)</Label>
          <FieldCombobox
            value={doc.operator}
            onChange={(val) => handleFieldChange("operator", val)}
            options={employeeOptions}
            placeholder="Xodimni tanlang yoki yozing..."
            searchPlaceholder="Ism yoki lavozim..."
            disabled={isLocked}
            allowCustom={true}
            className="h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* 3. Items Toolbar */}
      <div className="px-3 bg-muted/40 border-b border-border flex items-center justify-between h-9 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Boxes className="size-3.5 text-primary shrink-0" />
          <span className="font-semibold text-xs whitespace-nowrap">
            {doc.operationType === "ProductionIssue" ? "Sexga berilayotgan xomashyolar" : "Qaytarilayotgan qoldiqlar"}
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>Jami miqdor:</span>
          <span className="font-semibold text-foreground">{totalQuantity.toLocaleString()} birlik</span>
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
            <DialogTitle className="text-sm font-semibold">Ombor zaxirasidan material tanlash</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {doc.warehouse ? `${doc.warehouse} omboridagi xomashyo` : "Mavjud zaxiralar"}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
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
                          ? "bg-primary/10 border-primary text-primary font-medium"
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
              <Label className="text-xs">Beriladigan / Qaytariladigan miqdor</Label>
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

      {/* Line item edit modal */}
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
                  placeholder="Material nomini kiriting..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">SKU Kodi</Label>
                  <Input
                    value={lineFormData.sku}
                    onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, sku: e.target.value } : null))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Format / O'lcham</Label>
                  <Input
                    value={lineFormData.sheetFormat || ""}
                    onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, sheetFormat: e.target.value } : null))}
                    placeholder="700×1000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {doc.operationType === "CuttingReturn" && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Qoldiq bahosi, %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={lineFormData.valuationPercent ?? 100}
                    onChange={(e) => {
                      const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                      setLineFormData((prev) => (prev ? { ...prev, valuationPercent: v } : null));
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Miqdor *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={lineFormData.quantity}
                    onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, quantity: Number(e.target.value) || 0 } : null))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">O'lchov birligi</Label>
                  <Select
                    value={lineFormData.unit}
                    onValueChange={(val) => setLineFormData((prev) => (prev ? { ...prev, unit: val || "sheets" } : null))}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue>
                        {lineFormData.unit === "sheets"
                          ? "varaq (sheets)"
                          : lineFormData.unit === "rolls"
                          ? "rulon (rolls)"
                          : lineFormData.unit === "kg"
                          ? "kg"
                          : lineFormData.unit === "pcs"
                          ? "dona (pcs)"
                          : lineFormData.unit === "m²"
                          ? "m²"
                          : lineFormData.unit || "varaq (sheets)"}
                      </SelectValue>
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
                <Label className="text-[11px] text-muted-foreground">Qator izohi</Label>
                <Input
                  value={lineFormData.notes || ""}
                  onChange={(e) => setLineFormData((prev) => (prev ? { ...prev, notes: e.target.value } : null))}
                  placeholder="Qo'shimcha eslatma..."
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
