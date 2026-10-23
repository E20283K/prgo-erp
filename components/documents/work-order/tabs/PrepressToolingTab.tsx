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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  Wrench,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Copy,
  MousePointerClick,
} from "lucide-react";
import {
  WorkOrderToolingItem,
  ToolingCategory,
  ToolingStatus,
  WorkOrderFormData,
} from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { CtpJobTicketModal } from "./layout-calc/panels/CtpJobTicketModal";

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
    label: "⚙️ CTP Metall Forma",
    orderType: "ctp_plates",
  },
  die_cutting: {
    label: "✂️ Kesish Shtansformasi",
    orderType: "die_tooling",
  },
  foil_cliche: {
    label: "✨ Folga Klishesi (Jez)",
    orderType: "cliche",
  },
  emboss_cliche: {
    label: "🔲 Kongrev Klishesi (Magniy)",
    orderType: "cliche",
  },
  varnish_plate: {
    label: "💧 Lak Trafareti / Polimer",
    orderType: "outsourcing",
  },
  flexo_polymer: {
    label: "🌀 Flexo Polimer Forma",
    orderType: "ctp_plates",
  },
};

const STATUS_CONFIG: Record<
  ToolingStatus,
  { label: string }
> = {
  Draft: { label: "Loyiha (Kutilmoqda)" },
  Ordered: { label: "Pudratga buyurtma berilgan" },
  In_Production: { label: "Tayyorlanmoqda (Sexda)" },
  Ready: { label: "Tayyor (Omborda)" },
  Delivered: { label: "Yetkazib berilgan" },
  Mounted: { label: "Mashinaga o'rnatilgan" },
};

export function PrepressToolingTab({
  formData,
  docNo,
  isOperator,
  onUpdateTooling,
  onMarkUnsaved,
}: PrepressToolingTabProps) {
  const { suppliers, loadSuppliers, addNotification, openTab, theme } = useWorkspaceStore();
  const isDark = theme === "dark";

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const items = useMemo(() => formData.toolingItems || [], [formData.toolingItems]);
  const filteredItems = items;

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<WorkOrderToolingItem> | null>(null);

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

  // Ctp Job ticket modal
  const [isCtpModalOpen, setIsCtpModalOpen] = useState(false);

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
    { id: "idx", title: "№", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "category", title: "Toifasi", width: 175, icon: GridColumnIcon.HeaderSingleValue },
    { id: "name", title: "Jihoz / Qolip Nomi", width: 280, icon: GridColumnIcon.HeaderString },
    { id: "specDetails", title: "Spetsifikatsiya / Format", width: 300, icon: GridColumnIcon.HeaderString },
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

      if (column.id === "idx") {
        return {
          kind: GridCellKind.Number,
          data: row + 1,
          displayData: String(row + 1),
          allowOverlay: false,
          contentAlign: "center",
        };
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
      {/* 1. Header Toolbar & Quick KPI Strip */}
      <div className="px-4 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami Jihozlar
            </div>
            <div className="text-xs font-bold">
              {stats.totalCount} ta talab ({stats.readyCount} tayyor)
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              CTP Metall Formalar
            </div>
            <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
              {stats.ctpCount} ta plastina
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Kesish Shtamplari
            </div>
            <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
              {stats.dieCount} ta qolip
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Zarhal / Kongrev Klishe
            </div>
            <div className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
              {stats.clicheCount} ta klishe
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami Xarid Qiymati
            </div>
            <div className="font-mono text-xs font-bold text-foreground">
              {stats.totalCost.toLocaleString("uz-UZ")} {formData.currency || "UZS"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Glide Data Grid with Context Menu Wrapping */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-h-0 w-full relative">
          <DataEditor
            columns={columns}
            rows={filteredItems.length}
            getCellContent={getCellContent}
            onColumnResize={handleColumnResize}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onCellActivated={handleCellActivated}
            rowMarkers="both"
            freezeColumns={2}
            smoothScrollX
            smoothScrollY
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            width="100%"
            height="100%"
          />
        </ContextMenuTrigger>

        {/* ─── Radix Context Menu: Add Tooling & Item Actions ─── */}
        <ContextMenuContent className="text-xs w-60">
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2 cursor-pointer font-semibold text-primary">
              <Plus className="w-3.5 h-3.5" />
              <span>+ Yangi Jihoz Qo&apos;shish</span>
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
                    estimatedCost: 300000,
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>+ CTP Metall Forma</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "die_cutting",
                    name: `${formData.product || "Mahsulot"} Kesish Shtampi`,
                    specDetails: `Format: ${formData.width || 700}×${formData.height || 1000} mm (Flatbed Die)`,
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: 800000,
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-amber-600" />
                <span>+ Kesish Shtampi (Die)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "foil_cliche",
                    name: `${formData.product || "Mahsulot"} Zarhal Klishesi`,
                    specDetails: "Material: Latun (Jez 3mm), Termo-folga",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: 350000,
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span>+ Folga Klishesi (Jez)</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setEditingItem({
                    category: "emboss_cliche",
                    name: `${formData.product || "Mahsulot"} Kongrev Klishesi`,
                    specDetails: "Material: Magniy 4mm (Kongrev/Bo'rtma)",
                    quantity: 1,
                    unit: "dona",
                    estimatedCost: 300000,
                    status: "Draft",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer"
              >
                <Stamp className="w-3.5 h-3.5 text-purple-600" />
                <span>+ Kongrev Klishesi (Magniy)</span>
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
                    estimatedCost: 75000,
                    status: "Draft",
                    isRemake: true,
                    faultParty: "prepress",
                  });
                  setIsAddEditOpen(true);
                }}
                className="gap-2 cursor-pointer text-rose-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>+ Remake / Brak</span>
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

              {selectedItem.status === "Ordered" && (
                <ContextMenuItem
                  onClick={() => handleUpdateItemStatus(selectedItem, "Ready")}
                  className="gap-2 cursor-pointer text-emerald-600 font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Holat: Tayyor bo&apos;ldi (Omborda)</span>
                </ContextMenuItem>
              )}

              {selectedItem.status === "Ready" && (
                <ContextMenuItem
                  onClick={() => handleUpdateItemStatus(selectedItem, "Mounted")}
                  className="gap-2 cursor-pointer text-teal-600 font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mashinaga o&apos;rnatildi (Mounted)</span>
                </ContextMenuItem>
              )}

              {selectedItem.category === "ctp_plates" && (
                <ContextMenuItem
                  onClick={() => setIsCtpModalOpen(true)}
                  className="gap-2 cursor-pointer text-blue-600"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>CTP Job Ticket chop etish</span>
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
                className="gap-2 cursor-pointer text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>O&apos;chirish (Del)</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* 3. PO Creation Modal */}
      <Dialog open={isPoModalOpen} onOpenChange={setIsPoModalOpen}>
        <DialogContent className="max-w-md p-5 text-xs">
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
                    <SelectValue placeholder="Ta'minotchini tanlang" />
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
                      <SelectValue />
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
                <Input
                  type="date"
                  value={poForm.deliveryDeadline}
                  onChange={(e) => setPoForm((prev) => ({ ...prev, deliveryDeadline: e.target.value }))}
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
        <DialogContent className="max-w-md p-5 text-xs">
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctp_plates" className="text-xs">⚙️ CTP Metall Forma (Offset)</SelectItem>
                    <SelectItem value="die_cutting" className="text-xs">✂️ Kesish Shtansformasi (Die-cutting)</SelectItem>
                    <SelectItem value="foil_cliche" className="text-xs">✨ Folga Klishesi (Jez / Latun)</SelectItem>
                    <SelectItem value="emboss_cliche" className="text-xs">🔲 Kongrev Klishesi (Magniy)</SelectItem>
                    <SelectItem value="varnish_plate" className="text-xs">💧 Lak Trafareti / Polimer</SelectItem>
                    <SelectItem value="flexo_polymer" className="text-xs">🌀 Flexo Fotopolimer Forma</SelectItem>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Miqdori</Label>
                  <Input
                    type="number"
                    value={editingItem.quantity || 1}
                    onChange={(e) => setEditingItem((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Birligi</Label>
                  <Input
                    value={editingItem.unit || "dona"}
                    onChange={(e) => setEditingItem((prev) => ({ ...prev, unit: e.target.value }))}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-medium">Taxminiy Narxi</Label>
                  <Input
                    type="number"
                    value={editingItem.estimatedCost || 0}
                    onChange={(e) => setEditingItem((prev) => ({ ...prev, estimatedCost: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono bg-background"
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft" className="text-xs">Loyiha (Kutilmoqda)</SelectItem>
                    <SelectItem value="Ordered" className="text-xs">Pudratga buyurtma berildi</SelectItem>
                    <SelectItem value="In_Production" className="text-xs">Ishlab chiqarilmoqda</SelectItem>
                    <SelectItem value="Ready" className="text-xs">Tayyor (Omborda)</SelectItem>
                    <SelectItem value="Delivered" className="text-xs">Yetkazib berildi</SelectItem>
                    <SelectItem value="Mounted" className="text-xs">Mashinaga o&apos;rnatildi</SelectItem>
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
                      <SelectValue />
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

      {/* 5. CTP Job Ticket Modal */}
      <CtpJobTicketModal
        isOpen={isCtpModalOpen}
        onClose={() => setIsCtpModalOpen(false)}
        docNo={docNo}
        orderName={`${formData.customer || ""} - ${formData.product || ""}`}
        pressMachine={formData.pressMachine}
        paperStock={formData.paperStock}
        sheetW={formData.pressSheetW || 700}
        sheetH={formData.pressSheetH || 1000}
        prodW={formData.width || 100}
        prodH={formData.height || 150}
        plates={[]}
        effectivePieces={1}
        ctpSideRelation="shared_front_variable_back"
        frontColorsCount={4}
        backColorsCount={0}
        totalCtpPlates={stats.ctpCount || 4}
        totalSheetsRun={formData.quantity || 1000}
        totalProducedYield={formData.quantity || 1000}
        totalOverproduction={0}
      />
    </div>
  );
}
