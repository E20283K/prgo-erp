"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
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
  Stamp,
  Layers,
  Printer,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Trash2,
  Edit2,
  Edit3,
  Wrench,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Copy,
  MousePointerClick,
  Warehouse,
  Search,
  Check,
} from "lucide-react";
import {
  WorkOrderToolingItem,
  ToolingCategory,
  ToolingStatus,
  WorkOrderFormData,
} from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface PrepressToolingTabProps {
  formData: WorkOrderFormData;
  docNo: string;
  isOperator?: boolean;
  onUpdateTooling: (items: WorkOrderToolingItem[]) => void;
  onMarkUnsaved: () => void;
}

const CATEGORY_CONFIG: Record<
  ToolingCategory,
  { label: string; orderType: string }
> = {
  ctp_plates: {
    label: "CTP Metall Forma",
    orderType: "ctp_plates",
  },
  die_cutting: {
    label: "Kesish Shtansformasi",
    orderType: "die_tooling",
  },
  foil_cliche: {
    label: "Folga Klishesi (Jez)",
    orderType: "cliche",
  },
  emboss_cliche: {
    label: "Kongrev Klishesi (Magniy)",
    orderType: "cliche",
  },
  varnish_plate: {
    label: "Lak Trafareti / Polimer",
    orderType: "outsourcing",
  },
  flexo_polymer: {
    label: "Flexo Polimer Forma",
    orderType: "ctp_plates",
  },
};

const STATUS_CONFIG: Record<
  ToolingStatus,
  { label: string }
> = {
  Draft: { label: "Kutilmoqda" },
  Ordered: { label: "Buyurtma berilgan" },
  Ready: { label: "Tayyor" },
  In_Production: { label: "Buyurtma berilgan" },
  Delivered: { label: "Tayyor" },
  Mounted: { label: "Tayyor" },
};

const FAULT_PARTY_CONFIG: Record<string, string> = {
  prepress: "Prepress xatosi (Dizayn/Spusk)",
  production: "Ishlab chiqarish (Sexdagi brak)",
  client: "Mijoz o'zgartirishi",
  supplier: "Ta'minotchi / Pudratchi defekti",
};

const FALLBACK_CATALOG_DIES = [
  { id: "die-01", code: "DIE-BX-180x240", name: "Standart quti shtampi (FEFCO 0427)", dieType: "flatbed", widthMm: 180, heightMm: 240, location: "SHELF-A1", status: "available" },
  { id: "die-02", code: "DIE-RECT-50x90", name: "Vizitka / Birka shtampi (To'g'ri to'rtburchak)", dieType: "flatbed", widthMm: 50, heightMm: 90, location: "SHELF-B3", status: "available" },
  { id: "die-03", code: "DIE-ROTR-75x120", name: "Aylanma yorliq pichog'i (Z=96)", dieType: "rotary_magnetic", widthMm: 75, heightMm: 120, location: "RACK-CYL-04", status: "available" },
  { id: "die-04", code: "KL-FOIL-LOGO-01", name: "Zarhal (Hot Foil) Logo Jez Klishesi", dieType: "hot_stamp", widthMm: 60, heightMm: 40, location: "BOX-FOIL-02", status: "available" },
  { id: "die-05", code: "KL-EMB-MEDAL-02", name: "Kongrev Bo'rtma Magniy Klishesi", dieType: "embossing", widthMm: 50, heightMm: 50, location: "BOX-EMB-01", status: "available" },
];

export function PrepressToolingTab({
  formData,
  docNo,
  isOperator,
  onUpdateTooling,
  onMarkUnsaved,
}: PrepressToolingTabProps) {
  const {
    suppliers,
    diesTooling,
    theme,
  } = useWorkspaceStore(
    useShallow((s) => ({
      suppliers: s.suppliers,
      diesTooling: s.diesTooling,
      theme: s.theme,
    }))
  );
  const {
    loadSuppliers,
    loadDiesToolingAsync,
    addNotification,
    openTab,
  } = useWorkspaceStore.getState();
  const isDark = theme === "dark";

  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.suppliers.length === 0 && s.loadSuppliers) s.loadSuppliers();
    if (s.diesTooling.length === 0 && s.loadDiesToolingAsync) s.loadDiesToolingAsync();
  }, []);

  const items = useMemo(() => formData.toolingItems || [], [formData.toolingItems]);
  const filteredItems = items;

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<WorkOrderToolingItem> | null>(null);

  // Catalog Picker state
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");

  const catalogDies = useMemo(() => {
    return diesTooling && diesTooling.length > 0 ? diesTooling : FALLBACK_CATALOG_DIES;
  }, [diesTooling]);

  const filteredCatalogDies = useMemo(() => {
    const list = catalogDies;
    const search = catalogSearch.toLowerCase().trim();
    return list.filter((tool: any) => {
      const matchCat =
        catalogCategoryFilter === "ALL" ||
        (catalogCategoryFilter === "die_cutting" &&
          (tool.dieType === "flatbed" ||
            tool.dieType === "rotary_magnetic" ||
            tool.dieType === "solid_rotary")) ||
        (catalogCategoryFilter === "foil_cliche" && tool.dieType === "hot_stamp") ||
        (catalogCategoryFilter === "emboss_cliche" && tool.dieType === "embossing");

      const matchSearch =
        !search ||
        (tool.code && tool.code.toLowerCase().includes(search)) ||
        (tool.name && tool.name.toLowerCase().includes(search)) ||
        (tool.location && tool.location.toLowerCase().includes(search)) ||
        (tool.customerName && tool.customerName.toLowerCase().includes(search));

      return matchCat && matchSearch;
    });
  }, [catalogDies, catalogSearch, catalogCategoryFilter]);

  const handleAttachCatalogDie = (tool: any) => {
    const category: ToolingCategory =
      tool.dieType === "hot_stamp"
        ? "foil_cliche"
        : tool.dieType === "embossing"
        ? "emboss_cliche"
        : "die_cutting";

    const newItem: WorkOrderToolingItem = {
      id: `TL-EXIST-${tool.id || Date.now()}`,
      category,
      name: `${tool.code} — ${tool.name}`,
      specDetails: `Razmer: ${tool.widthMm || 0}×${tool.heightMm || 0} mm, Joyi: ${tool.location || "Ombor stellaji"}`,
      quantity: 1,
      unit: "dona",
      estimatedCost: 0,
      actualCost: 0,
      currency: formData.currency || "UZS",
      status: "Ready",
      supplierName: tool.customerName ? `Mijoz (${tool.customerName})` : "Mavjud inventar (Ombor)",
      notes: `Katalogdan biriktirildi. Kodi: ${tool.code}, Shakli: ${tool.shape || "standart"}`,
      createdAt: new Date().toISOString(),
    };

    onUpdateTooling([...items, newItem]);
    onMarkUnsaved();
    setIsCatalogPickerOpen(false);

    addNotification({
      title: "Mavjud jihoz biriktirildi",
      description: `${tool.code}: ${tool.name} buyurtmaga 0 so'm bilan 'Tayyor' holatida biriktirildi.`,
      severity: "success",
    });
  };

  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [targetPoItem, setTargetPoItem] = useState<WorkOrderToolingItem | null>(null);
  const [poForm, setPoForm] = useState({
    supplierId: "",
    amount: 0,
    currency: formData.currency || "UZS",
    deliveryDeadline: formData.deadline || "",
    notes: "",
  });
  const [poSubmitting, setPoSubmitting] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = items.length;
    const ctpCount = items
      .filter((i) => i.category === "ctp_plates")
      .reduce((sum, i) => sum + i.quantity, 0);
    const dieCount = items.filter((i) => i.category === "die_cutting").length;
    const clicheCount = items.filter(
      (i) => i.category === "foil_cliche" || i.category === "emboss_cliche"
    ).length;
    const readyCount = items.filter(
      (i) => i.status === "Ready" || i.status === "Delivered" || i.status === "Mounted"
    ).length;
    const totalCost = items.reduce(
      (sum, i) => sum + (i.actualCost !== undefined ? i.actualCost : i.estimatedCost || 0),
      0
    );

    return { totalCount, ctpCount, dieCount, clicheCount, readyCount, totalCost };
  }, [items]);

  // Columns definition
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "category", title: "Toifasi", width: 180, icon: GridColumnIcon.HeaderSingleValue },
    { id: "name", title: "Jihoz / Qolip Nomi", width: 290, icon: GridColumnIcon.HeaderString },
    { id: "specDetails", title: "Spetsifikatsiya / Format", width: 310, icon: GridColumnIcon.HeaderString },
    { id: "quantity", title: "Miqdori", width: 95, icon: GridColumnIcon.HeaderNumber },
    { id: "supplierName", title: "Pudratchi / Ta'minotchi", width: 180, icon: GridColumnIcon.HeaderReference },
    { id: "purchaseOrderNo", title: "Xarid PO №", width: 130, icon: GridColumnIcon.HeaderReference },
    { id: "cost", title: `Summasi (${formData.currency || "UZS"})`, width: 150, icon: GridColumnIcon.HeaderNumber },
    { id: "status", title: "Holati", width: 155, icon: GridColumnIcon.HeaderSingleValue },
  ]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === column.id ? { ...c, width: newSize } : c))
    );
  }, []);

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = filteredItems[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "category") {
        const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.ctp_plates;
        return {
          kind: GridCellKind.Text,
          data: cat.label,
          displayData: cat.label,
          allowOverlay: false,
          themeOverride: {
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      if (column.id === "name") {
        const nameDisplay = item.isRemake ? `[Remake] ${item.name}` : item.name;
        return {
          kind: GridCellKind.Text,
          data: nameDisplay,
          displayData: nameDisplay,
          allowOverlay: false,
          themeOverride: {
            textDark: item.isRemake
              ? isDark ? "#f87171" : "#b91c1c"
              : isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px sans-serif",
          },
        };
      }

      if (column.id === "quantity") {
        const qtyDisplay = `${item.quantity} ${item.unit || "dona"}`;
        return {
          kind: GridCellKind.Text,
          data: qtyDisplay,
          displayData: qtyDisplay,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            baseFontStyle: "600 11px monospace",
          },
        };
      }

      if (column.id === "supplierName") {
        const sName = item.supplierName || "—";
        return {
          kind: GridCellKind.Text,
          data: sName,
          displayData: sName,
          allowOverlay: false,
        };
      }

      if (column.id === "purchaseOrderNo") {
        const po = item.purchaseOrderNo || "—";
        return {
          kind: GridCellKind.Text,
          data: po,
          displayData: po,
          allowOverlay: false,
          themeOverride: po !== "—"
            ? { textDark: isDark ? "#4ade80" : "#15803d", baseFontStyle: "bold 11px monospace" }
            : undefined,
        };
      }

      if (column.id === "cost") {
        const val = item.actualCost !== undefined ? item.actualCost : item.estimatedCost || 0;
        const display = `${val.toLocaleString("uz-UZ")} ${item.currency || formData.currency || "UZS"}`;
        return {
          kind: GridCellKind.Text,
          data: display,
          displayData: display,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (column.id === "status") {
        const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.Draft;
        let color = isDark ? "#a1a1aa" : "#71717a";
        if (item.status === "Ready" || item.status === "Delivered" || item.status === "Mounted") {
          color = isDark ? "#4ade80" : "#15803d";
        } else if (item.status === "Ordered" || item.status === "In_Production") {
          color = isDark ? "#60a5fa" : "#2563eb";
        }

        return {
          kind: GridCellKind.Text,
          data: st.label,
          displayData: st.label,
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: {
            textDark: color,
            baseFontStyle: "bold 11px sans-serif",
          },
        };
      }

      const strVal = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: strVal,
        displayData: strVal,
        allowOverlay: false,
      };
    },
    [filteredItems, columns, isDark, formData.currency]
  );

  const selectedItem = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0) return null;
    return filteredItems[selectedRows[0]] || null;
  }, [selection, filteredItems]);

  // Handle open PO modal
  const handleOpenPoModal = (item: WorkOrderToolingItem) => {
    setTargetPoItem(item);
    const matchingSuppliers = suppliers.filter((s) => {
      if (item.category === "ctp_plates") return s.category === "ctp_prepress";
      if (item.category === "die_cutting") return s.category === "die_tooling";
      if (item.category === "foil_cliche" || item.category === "emboss_cliche")
        return s.category === "cliche_stamping";
      return true;
    });

    const defaultSupplier = matchingSuppliers[0] || suppliers[0];
    setPoForm({
      supplierId: item.supplierId || defaultSupplier?.id || "",
      amount: item.estimatedCost || 0,
      currency: defaultSupplier?.currency || item.currency || formData.currency || "UZS",
      deliveryDeadline: formData.deadline || "",
      notes: `${docNo}: ${item.name} (${item.specDetails}) tayyorlash xaridi`,
    });
    setIsPoModalOpen(true);
  };

  // Submit PO to backend
  const handleSubmitPo = async () => {
    if (!targetPoItem || !poForm.supplierId) {
      alert("Iltimos, ta'minotchini tanlang!");
      return;
    }

    setPoSubmitting(true);
    try {
      const selectedSupp = suppliers.find((s) => s.id === poForm.supplierId);
      const catConfig = CATEGORY_CONFIG[targetPoItem.category];

      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(poForm.supplierId)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: catConfig.orderType,
          title: targetPoItem.name,
          workOrderNo: docNo,
          quantity: targetPoItem.quantity,
          unit: targetPoItem.unit || "dona",
          amount: Number(poForm.amount) || 0,
          currency: poForm.currency,
          status: "Ordered",
          deliveryDeadline: poForm.deliveryDeadline,
          specDetails: targetPoItem.specDetails,
          notes: poForm.notes,
        }),
      });

      const json = await res.json();
      if (json.success && json.order) {
        const updatedList = items.map((it) => {
          if (it.id === targetPoItem.id) {
            return {
              ...it,
              status: "Ordered" as ToolingStatus,
              supplierId: poForm.supplierId,
              supplierName: selectedSupp?.name || "Ta'minotchi",
              purchaseOrderId: json.order.id,
              purchaseOrderNo: json.order.orderNo,
              actualCost: Number(poForm.amount) || it.estimatedCost,
              currency: poForm.currency,
            };
          }
          return it;
        });

        onUpdateTooling(updatedList);
        onMarkUnsaved();
        setIsPoModalOpen(false);
        addNotification({
          title: "Ta'minotchiga buyurtma yuborildi",
          description: `${json.order.orderNo}: ${targetPoItem.name} ta'minotchi (${selectedSupp?.name}) profilida qayd etildi.`,
          severity: "success",
          link: { module: "crm", subModule: "suppliers" },
        });
      } else {
        alert(json.error || "Xarid buyurtmasini yaratishda xatolik yuz berdi");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Server bilan bog'lanishda xatolik");
    } finally {
      setPoSubmitting(false);
    }
  };

  // Add / Edit tooling save
  const handleSaveToolingItem = () => {
    if (!editingItem?.name?.trim()) {
      alert("Iltimos, jihoz nomini kiriting!");
      return;
    }

    let updatedList: WorkOrderToolingItem[];
    if (editingItem.id) {
      updatedList = items.map((it) => (it.id === editingItem.id ? ({ ...it, ...editingItem } as WorkOrderToolingItem) : it));
    } else {
      const newItem: WorkOrderToolingItem = {
        id: `TL-${Date.now()}`,
        category: editingItem.category || "ctp_plates",
        name: editingItem.name,
        specDetails: editingItem.specDetails || "",
        quantity: Number(editingItem.quantity) || 1,
        unit: editingItem.unit || "dona",
        estimatedCost: Number(editingItem.estimatedCost) || 0,
        currency: editingItem.currency || formData.currency || "UZS",
        status: (editingItem.status as ToolingStatus) || "Draft",
        isRemake: editingItem.isRemake || false,
        remakeReason: editingItem.remakeReason,
        faultParty: editingItem.faultParty || "none",
        createdAt: new Date().toISOString(),
      };
      updatedList = [...items, newItem];
    }

    onUpdateTooling(updatedList);
    onMarkUnsaved();
    setIsAddEditOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm("Haqiqatan ham ushbu jihozni o'chirmoqchimisiz?")) {
      const updated = items.filter((it) => it.id !== id);
      onUpdateTooling(updated);
      onMarkUnsaved();
    }
  };

  const handleUpdateItemStatus = (item: WorkOrderToolingItem, newStatus: ToolingStatus) => {
    const updated = items.map((it) => (it.id === item.id ? { ...it, status: newStatus } : it));
    onUpdateTooling(updated);
    onMarkUnsaved();
  };

  // Cell activated (double-click) opens editor
  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const target = filteredItems[row];
      if (target) {
        setEditingItem(target);
        setIsAddEditOpen(true);
      }
    },
    [filteredItems]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-background select-text">
      {/* 1. Header Toolbar (Matches BomMaterialsGrid style) */}
      <div className="h-9 px-3 py-1 bg-card border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Add Tooling Primary Action */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  className="h-6.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Jihoz qo&apos;shish</span>
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-56 text-xs">
              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "ctp_plates",
                    name: `${docNo} CTP Metall Forma Komplekti`,
                    specDetails: `Format: ${formData.pressSheetW || 700}×${formData.pressSheetH || 1000} mm, CMYK 4 rang`,
                    quantity: 4,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>CTP metall forma</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "die_cutting",
                    name: `${formData.product || "Mahsulot"} Kesish Shtampi`,
                    specDetails: `Format: ${formData.width || 700}×${formData.height || 1000} mm (Flatbed Die)`,
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 65 : 800000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-amber-600" />
                <span>Kesish shtampi (Die)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "foil_cliche",
                    name: `${formData.product || "Mahsulot"} Zarhal Klishesi`,
                    specDetails: "Material: Latun (Jez 3mm), Termo-folga",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 30 : 350000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span>Folga klishesi (Jez)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "emboss_cliche",
                    name: `${formData.product || "Mahsulot"} Kongrev Klishesi`,
                    specDetails: "Material: Magniy 4mm (Kongrev/Bo'rtma)",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-purple-600" />
                <span>Kongrev klishesi (Magniy)</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setIsCatalogPickerOpen(true)}
                className="gap-2 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Mavjud katalogdan tanlash...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Catalog Picker Button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => setIsCatalogPickerOpen(true)}
                  variant="outline"
                  size="sm"
                  className="h-6.5 px-2 text-xs font-medium gap-1 rounded cursor-pointer shrink-0 text-blue-600 dark:text-blue-400 border-blue-500/30"
                >
                  <Warehouse className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Katalogdan biriktirish</span>
                </Button>
              }
            />
            <TooltipContent side="bottom" sideOffset={4} className="text-xs">
              Mavjud shtamp &amp; klishelar bazasidan biriktirish (0 so&apos;m)
            </TooltipContent>
          </Tooltip>

          {/* Row Actions when selected */}
          {selectedItem && (
            <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => {
                        setEditingItem(selectedItem);
                        setIsAddEditOpen(true);
                      }}
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
                  Jihozni tahrirlash
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => handleDeleteItem(selectedItem.id)}
                      variant="ghost"
                      size="icon-sm"
                      className="h-6.5 w-6.5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                  Tanlanganni o&apos;chirish (Del)
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Right Financial & Quantity Summary (Matches BomMaterialsGrid style without category breakdown) */}
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0 pl-2 ml-auto whitespace-nowrap">
          <span className="text-muted-foreground">
            Jami: <strong className="text-foreground">{stats.totalCount} ta talab</strong>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Tayyor: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.readyCount} ta</strong>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Qiymati: <strong className="text-primary font-bold">{stats.totalCost.toLocaleString("uz-UZ")} {formData.currency || "UZS"}</strong>
          </span>
        </div>
      </div>

      {/* 2. Glide Data Grid with Context Menu Wrapping */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-h-0 w-full relative">
          <div
            className="w-full h-full"
            onKeyDown={(e) => {
              if (e.key === "Delete" && selectedItem) {
                e.preventDefault();
                handleDeleteItem(selectedItem.id);
              }
            }}
          >
            <DataEditor
              columns={columns}
              rows={filteredItems.length}
              getCellContent={getCellContent}
              onColumnResize={handleColumnResize}
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onCellContextMenu={(cell) => {
                const [, row] = cell;
                setSelection({
                  columns: CompactSelection.empty(),
                  rows: CompactSelection.fromSingleSelection(row),
                });
              }}
              onCellActivated={handleCellActivated}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX
              smoothScrollY
              headerHeight={28}
              rowHeight={30}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
              width="100%"
              height="100%"
            />
          </div>
        </ContextMenuTrigger>

        {/* ─── Radix Context Menu: Add Tooling & Item Actions ─── */}
        <ContextMenuContent className="text-xs w-60">
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2 cursor-pointer font-semibold text-primary">
              <Plus className="w-3.5 h-3.5" />
              <span>Jihoz qo&apos;shish</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="text-xs w-56">
              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "ctp_plates",
                    name: `${docNo} CTP Metall Forma Komplekti`,
                    specDetails: `Format: ${formData.pressSheetW || 700}×${formData.pressSheetH || 1000} mm, CMYK`,
                    quantity: 4,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>CTP metall forma</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "die_cutting",
                    name: `${formData.product || "Mahsulot"} Kesish Shtampi`,
                    specDetails: `Format: ${formData.width || 700}×${formData.height || 1000} mm (Flatbed Die)`,
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 65 : 800000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-amber-600" />
                <span>Kesish shtampi (Die)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "foil_cliche",
                    name: `${formData.product || "Mahsulot"} Zarhal Klishesi`,
                    specDetails: "Material: Latun (Jez 3mm), Termo-folga",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 30 : 350000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span>Folga klishesi (Jez)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "emboss_cliche",
                    name: `${formData.product || "Mahsulot"} Kongrev Klishesi`,
                    specDetails: "Material: Magniy 4mm (Kongrev/Bo'rtma)",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 25 : 300000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-purple-600" />
                <span>Kongrev klishesi (Magniy)</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "ctp_plates",
                    name: `${docNo} CTP Remake (Qayta chiqarish)`,
                    specDetails: "Brak yoki matn xatosi sababli qayta chiqarish",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: (formData.currency || "UZS").toUpperCase() === "USD" ? 10 : 75000,
                    currency: formData.currency || "UZS",
                    status: "Draft",
                    isRemake: true,
                    faultParty: "prepress",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer text-rose-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Remake / Qayta chiqarish</span>
              </ContextMenuItem>
              <DropdownMenuSeparator />

              <ContextMenuItem
                onClick={() => setIsCatalogPickerOpen(true)}
                className="gap-2 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Mavjud katalogdan biriktirish...</span>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Selected Row Actions */}
          {selectedItem && (
            <>
              {selectedItem.status === "Draft" && (
                <ContextMenuItem
                  onClick={() => handleOpenPoModal(selectedItem)}
                  className="gap-2 cursor-pointer font-medium text-primary"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pudratchiga buyurtma berish (PO)</span>
                </ContextMenuItem>
              )}

              {selectedItem.status !== "Ready" && (
                <ContextMenuItem
                  onClick={() => handleUpdateItemStatus(selectedItem, "Ready")}
                  className="gap-2 cursor-pointer text-emerald-600 font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Holat: Tayyor bo&apos;ldi</span>
                </ContextMenuItem>
              )}

              {selectedItem.status === "Ready" && (
                <ContextMenuItem
                  onClick={() => handleUpdateItemStatus(selectedItem, "Draft")}
                  className="gap-2 cursor-pointer text-muted-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Holat: Kutilmoqda (Qaytarish)</span>
                </ContextMenuItem>
              )}

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => {
                  setEditingItem(selectedItem);
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Tahrirlash (F2 / Double-Click)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(selectedItem.name);
                }}
                className="gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Jihoz nomini nusxalash</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => handleDeleteItem(selectedItem.id)}
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yozuvni o&apos;chirish</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* 3. PO Creation Modal */}
      <Dialog open={isPoModalOpen} onOpenChange={setIsPoModalOpen}>
        <DialogContent className="sm:max-w-md w-full p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <span>Ta&apos;minotchiga Rasmiy Buyurtma (PO) berish</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ushbu jihoz bo&apos;yicha tanlangan pudratchiga xarid buyurtmasi shakllantiriladi va buyurtma tannarxiga kiritiladi.
            </DialogDescription>
          </DialogHeader>

          {targetPoItem && (
            <div className="space-y-3 py-2">
              <div className="p-2.5 rounded bg-muted/40 border border-border/60 space-y-1">
                <div className="font-semibold text-foreground text-xs">{targetPoItem.name}</div>
                <div className="text-[11px] text-muted-foreground">{targetPoItem.specDetails}</div>
                <div className="text-[11px] font-mono">
                  Miqdori: <strong>{targetPoItem.quantity} {targetPoItem.unit}</strong> | Work Order: <strong>{docNo}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Xizmat ko&apos;rsatuvchi Pudratchi / Ta&apos;minotchi *
                </Label>
                <Select
                  value={poForm.supplierId}
                  onValueChange={(val) => setPoForm((prev) => ({ ...prev, supplierId: val || "" }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Ta'minotchini tanlang">
                      {(val) => suppliers.find((s) => s.id === val)?.name || val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name} ({s.code}) — {s.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">
                    Kelishilgan summa
                  </Label>
                  <Input
                    type="number"
                    value={poForm.amount}
                    onChange={(e) => setPoForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Valyuta</Label>
                  <Select
                    value={poForm.currency}
                    onValueChange={(val) => setPoForm((prev) => ({ ...prev, currency: val || "UZS" }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>{(val) => (val === "USD" ? "USD ($)" : "UZS (So'm)")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS" className="text-xs">UZS (So&apos;m)</SelectItem>
                      <SelectItem value="USD" className="text-xs">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Yetkazish muddati (Deadline)
                </Label>
                <DatePicker
                  value={poForm.deliveryDeadline}
                  onChange={(val) => setPoForm((prev) => ({ ...prev, deliveryDeadline: val }))}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Izoh va texnik ko&apos;rsatmalar
                </Label>
                <Textarea
                  value={poForm.notes}
                  onChange={(e) => setPoForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="text-xs bg-background resize-none min-h-[48px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPoModalOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={poSubmitting}
              onClick={handleSubmitPo}
              className="h-7 text-xs bg-primary text-primary-foreground font-medium"
            >
              {poSubmitting ? "Yaratilmoqda..." : "Xarid Buyurtmasini (PO) Tasdiqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Add / Edit Tooling Item Modal */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="sm:max-w-[560px] w-full p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              <span>{editingItem?.id ? "Jihozni Tahrirlash" : "Yangi Texnologik Jihoz Qo'shish"}</span>
            </DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Jihoz Toifasi *</Label>
                <Select
                  value={editingItem.category}
                  onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, category: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue>
                      {(val) => CATEGORY_CONFIG[val as ToolingCategory]?.label || val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctp_plates" className="text-xs">CTP Metall Forma (Offset)</SelectItem>
                    <SelectItem value="die_cutting" className="text-xs">Kesish Shtansformasi (Die-cutting)</SelectItem>
                    <SelectItem value="foil_cliche" className="text-xs">Folga Klishesi (Jez / Latun)</SelectItem>
                    <SelectItem value="emboss_cliche" className="text-xs">Kongrev Klishesi (Magniy)</SelectItem>
                    <SelectItem value="varnish_plate" className="text-xs">Lak Trafareti / Polimer</SelectItem>
                    <SelectItem value="flexo_polymer" className="text-xs">Flexo Fotopolimer Forma</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Jihoz / Qolip Nomi *</Label>
                <Input
                  value={editingItem.name || ""}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Masalan: Shokolad qutisi shtampi FEFCO yoki 4 dona CTP forma"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Texnik Spetsifikatsiya & Format
                </Label>
                <Input
                  value={editingItem.specDetails || ""}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, specDetails: e.target.value }))}
                  placeholder="700x1000 mm, pichoq balandligi 23.8mm, latun 3mm..."
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Miqdori *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingItem.quantity ?? 1}
                    onChange={(e) => {
                      const qty = Math.max(1, parseInt(e.target.value) || 1);
                      const currentUnitPrice = (editingItem.estimatedCost || 0) / Math.max(1, editingItem.quantity || 1);
                      setEditingItem((prev) => ({
                        ...prev,
                        quantity: qty,
                        estimatedCost: Math.round(currentUnitPrice * qty),
                      }));
                    }}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Birligi *</Label>
                  <Select
                    value={editingItem.unit || "dona"}
                    onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, unit: val || "dona" }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>{(val) => val || "dona"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dona" className="text-xs">dona</SelectItem>
                      <SelectItem value="komplekt" className="text-xs">komplekt</SelectItem>
                      <SelectItem value="kv.m" className="text-xs">kv.m</SelectItem>
                      <SelectItem value="metr" className="text-xs">metr</SelectItem>
                      <SelectItem value="list" className="text-xs">list (varaq)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium truncate" title="1 birlik narxi">
                    Dona narxi
                  </Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={
                      editingItem.quantity && editingItem.quantity > 0
                        ? Math.round(((editingItem.estimatedCost || 0) / editingItem.quantity) * 100) / 100
                        : 0
                    }
                    onValueChange={(values) => {
                      const uPrice = values.floatValue ?? 0;
                      const qty = editingItem.quantity || 1;
                      setEditingItem((prev) => ({
                        ...prev,
                        estimatedCost: Math.round(uPrice * qty * 100) / 100,
                      }));
                    }}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="col-span-3 space-y-1.5">
                  <Label
                    className="text-[11px] text-muted-foreground font-medium truncate"
                    title={`Jami summa (${editingItem.currency || formData.currency || "UZS"})`}
                  >
                    Jami summa ({editingItem.currency || formData.currency || "UZS"})
                  </Label>
                  <MoneyInput
                    thousandSeparator=" "
                    decimalScale={2}
                    value={editingItem.estimatedCost || 0}
                    onValueChange={(values) =>
                      setEditingItem((prev) => ({
                        ...prev,
                        estimatedCost: values.floatValue ?? 0,
                      }))
                    }
                    className="h-8 text-xs font-mono bg-background font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Holati</Label>
                <Select
                  value={editingItem.status || "Draft"}
                  onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, status: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue>
                      {(val) => STATUS_CONFIG[val as ToolingStatus]?.label || val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft" className="text-xs">Kutilmoqda (Loyiha)</SelectItem>
                    <SelectItem value="Ordered" className="text-xs">Buyurtma berilgan</SelectItem>
                    <SelectItem value="Ready" className="text-xs">Tayyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingItem.isRemake && (
                <div className="space-y-1.5 p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200">
                  <Label className="text-[11px] font-medium text-rose-800 dark:text-rose-200">
                    Brak / Qayta chiqarish sababi va aybdor tomon
                  </Label>
                  <Select
                    value={editingItem.faultParty || "prepress"}
                    onValueChange={(val: any) => setEditingItem((prev) => ({ ...prev, faultParty: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue>
                        {(val) => FAULT_PARTY_CONFIG[val] || val}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepress" className="text-xs">Prepress xatosi (Dizayn/Spusk)</SelectItem>
                      <SelectItem value="production" className="text-xs">Ishlab chiqarish (Sexdagi brak)</SelectItem>
                      <SelectItem value="client" className="text-xs">Mijoz o&apos;zgartirishi</SelectItem>
                      <SelectItem value="supplier" className="text-xs">Ta&apos;minotchi / Pudratchi defekti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddEditOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveToolingItem}
              className="h-7 text-xs bg-primary text-primary-foreground font-medium"
            >
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Catalog Tooling Picker Modal */}
      <Dialog open={isCatalogPickerOpen} onOpenChange={setIsCatalogPickerOpen}>
        <DialogContent className="sm:max-w-[660px] w-full p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Mavjud Shtamp, Klishe va Qoliplar Katalogi</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Korxona ombori yoki stellajida tayyor turgan shtamplar va klishelarni buyurtmaga biriktirish (Xarid xarajatisiz, 0 so&apos;m).
            </DialogDescription>
          </DialogHeader>

          {/* 1. Search Bar on Top */}
          <div className="space-y-2.5 py-1">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Shtamp kodi, nomi, o'lchami yoki stellaj joyi bo'yicha qidirish..."
                className="h-8.5 pl-9 text-xs bg-background w-full"
                autoFocus
              />
            </div>

            {/* 2. Filter Buttons Row Below Search */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "ALL", label: "Barchasi" },
                { id: "die_cutting", label: "Kesish shtamplari" },
                { id: "foil_cliche", label: "Folga klishelari" },
                { id: "emboss_cliche", label: "Kongrev klishelari" },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant={catalogCategoryFilter === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCatalogCategoryFilter(tab.id)}
                  className={cn(
                    "h-7 px-3 text-xs font-medium cursor-pointer rounded shadow-none",
                    catalogCategoryFilter === tab.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground border-border"
                  )}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 3. Clean Items List (No emojis, no useless badges, no redundant status text) */}
            <div className="border border-border rounded-md overflow-hidden max-h-[380px] overflow-y-auto divide-y divide-border bg-card mt-1">
              {filteredCatalogDies.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-1">
                  <div className="font-medium text-xs">Mavjud katalogda bunday jihoz topilmadi.</div>
                  <div className="text-[11px]">Qidiruv so&apos;zini o&apos;zgartiring yoki filterni tozalang.</div>
                </div>
              ) : (
                filteredCatalogDies.map((tool: any) => (
                  <div
                    key={tool.id}
                    className="p-3 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-foreground">
                          {tool.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {tool.widthMm || 0} × {tool.heightMm || 0} mm
                        </span>
                        {tool.location && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            [{tool.location}]
                          </span>
                        )}
                        {tool.customerName && (
                          <span className="text-[11px] text-muted-foreground">
                            • Mijoz: {tool.customerName}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-foreground font-medium truncate">
                        {tool.name}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAttachCatalogDie(tool)}
                      className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0 cursor-pointer shadow-none rounded"
                    >
                      Biriktirish
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              Jami <strong>{filteredCatalogDies.length}</strong> ta mos jihoz topildi
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCatalogPickerOpen(false)}
              className="h-7 text-xs"
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
