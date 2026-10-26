"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  RefreshCw,
  ExternalLink,
  Filter,
  Copy,
  CheckCircle2,
  Clock,
  Truck,
  Layers,
  Sparkles,
} from "lucide-react";
import type { SupplierRecord, SupplierOrderRecord } from "@/lib/server/supplierService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface SupplierOrdersTabProps {
  supplier: SupplierRecord;
  onRefreshOrders?: () => void;
  onOrderCreated?: () => void;
  isCreateOpen?: boolean;
  setIsCreateOpen?: (open: boolean) => void;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  die_tooling: "Shtamp & Pichoq Qolipi",
  ctp_plates: "CTP Metall Forma (4 rang)",
  cliche: "Folga / Klishe",
  raw_materials: "Qog'oz / Karton / Bo'yoq",
  outsourcing: "Autsorsing xizmati",
  service: "Texnik servis",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  Draft: "Qoralama",
  Ordered: "Buyurtma berildi",
  In_Production: "Ishlab chiqarilmoqda",
  Ready: "Tayyor",
  Delivered: "Yetkazib berildi",
  Cancelled: "Bekor qilindi",
};

export function SupplierOrdersTab({
  supplier,
  onRefreshOrders,
  onOrderCreated,
  isCreateOpen,
  setIsCreateOpen,
}: SupplierOrdersTabProps) {
  const { openTab, theme, addNotification } = useWorkspaceStore();
  const isDark = theme === "dark";

  const [orders, setOrders] = useState<SupplierOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const effectiveModalOpen = isCreateOpen !== undefined ? isCreateOpen : modalOpen;
  const setEffectiveModalOpen = setIsCreateOpen || setModalOpen;

  const [newOrder, setNewOrder] = useState<Partial<SupplierOrderRecord>>({
    orderType:
      supplier.category === "ctp_prepress"
        ? "ctp_plates"
        : supplier.category === "die_tooling"
        ? "die_tooling"
        : "raw_materials",
    title: "",
    workOrderNo: "",
    quantity: 1,
    unit: "dona",
    amount: 0,
    currency: supplier.currency || "UZS",
    status: "Ordered",
    deliveryDeadline: "",
    specDetails: "",
  });

  const fetchOrders = useCallback(async () => {
    if (!supplier.id || supplier.id.startsWith("draft-")) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/orders`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setOrders(json.data);
        }
      }
    } catch (e) {
      console.error("Failed to load supplier orders:", e);
    } finally {
      setIsLoading(false);
    }
  }, [supplier.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCreateOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supplier.id || supplier.id.startsWith("draft-") || supplier.id.startsWith("new-")) {
      alert("Iltimos, buyurtma berishdan oldin ta'minotchi rekvizitlarini saqlang!");
      return;
    }
    if (supplier.status === "Blocked") {
      alert("Diqqat: Ushbu ta'minotchi BLOKLANGAN (Stop-List)! Yangi buyurtma berish to'xtatilgan.");
      return;
    }
    if (!newOrder.title?.trim()) {
      alert("Iltimos, buyurtma nomini kiriting!");
      return;
    }

    try {
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder),
      });
      if (res.ok) {
        setEffectiveModalOpen(false);
        setNewOrder({
          orderType:
            supplier.category === "ctp_prepress"
              ? "ctp_plates"
              : supplier.category === "die_tooling"
              ? "die_tooling"
              : "raw_materials",
          title: "",
          workOrderNo: "",
          quantity: 1,
          unit: "dona",
          amount: 0,
          currency: supplier.currency || "UZS",
          status: "Ordered",
          deliveryDeadline: "",
          specDetails: "",
        });
        fetchOrders();
        if (onOrderCreated) onOrderCreated();
        if (onRefreshOrders) onRefreshOrders();
        addNotification({
          title: "Buyurtma shakllantirildi",
          description: `Ta'minotchi ${supplier.name} nomiga yangi xarid buyurtmasi yuborildi.`,
          severity: "success",
        });
      }
    } catch (e) {
      console.error("Order creation failed:", e);
    }
  };

  const handleUpdateStatus = async (
    order: SupplierOrderRecord,
    nextStatus: "Ready" | "Delivered" | "Cancelled"
  ) => {
    try {
      await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(supplier.id)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...order,
          status: nextStatus,
        }),
      });
      fetchOrders();
      if (onOrderCreated) onOrderCreated();
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  // Filtered rows
  const filteredOrders = useMemo(() => {
    if (filterStatus === "all") return orders;
    return orders.filter((o) => o.status === filterStatus);
  }, [orders, filterStatus]);

  // Statistics for KPI
  const stats = useMemo(() => {
    const total = orders.length;
    const active = orders.filter((o) => o.status === "Ordered" || o.status === "In_Production").length;
    const ready = orders.filter((o) => o.status === "Ready" || o.status === "Delivered").length;
    const totalAmount = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    return { total, active, ready, totalAmount };
  }, [orders]);

  // Columns definition
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "idx", title: "№", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "orderNo", title: "Buyurtma №", width: 125, icon: GridColumnIcon.HeaderReference },
    { id: "orderDate", title: "Sana", width: 105, icon: GridColumnIcon.HeaderDate },
    { id: "orderType", title: "Turi", width: 180, icon: GridColumnIcon.HeaderSingleValue },
    { id: "title", title: "Buyurtma nomi / Vazifasi", width: 320, icon: GridColumnIcon.HeaderString },
    { id: "workOrderNo", title: "Ishlab chiqarish (WO)", width: 140, icon: GridColumnIcon.HeaderReference },
    { id: "amount", title: `Summasi (${supplier.currency || "UZS"})`, width: 150, icon: GridColumnIcon.HeaderNumber },
    { id: "status", title: "Holati", width: 140, icon: GridColumnIcon.HeaderSingleValue },
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
      const item = filteredOrders[row];
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

      if (column.id === "orderNo") {
        return {
          kind: GridCellKind.Text,
          data: item.orderNo,
          displayData: item.orderNo,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#2563eb",
            baseFontStyle: "bold 12px monospace",
          },
        };
      }

      if (column.id === "orderType") {
        const lbl = ORDER_TYPE_LABELS[item.orderType] || item.orderType;
        return {
          kind: GridCellKind.Text,
          data: lbl,
          displayData: lbl,
          allowOverlay: false,
        };
      }

      if (column.id === "amount") {
        const val = Number(item.amount) || 0;
        const display = `${val.toLocaleString("uz-UZ")} ${item.currency || "UZS"}`;
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
        const label = ORDER_STATUS_LABELS[item.status] || item.status;
        let color = isDark ? "#a1a1aa" : "#71717a";
        if (item.status === "Ready" || item.status === "Delivered") color = isDark ? "#4ade80" : "#15803d";
        if (item.status === "Ordered" || item.status === "In_Production") color = isDark ? "#60a5fa" : "#2563eb";
        if (item.status === "Cancelled") color = isDark ? "#f87171" : "#b91c1c";

        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
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
    [filteredOrders, columns, isDark]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const order = filteredOrders[row];
      if (!order) return;

      if (order.workOrderNo) {
        openTab({
          id: order.workOrderNo,
          title: order.workOrderNo,
          type: "work-order",
          module: "production",
        });
      }
    },
    [filteredOrders, openTab]
  );

  const selectedOrder = useMemo(() => {
    const selectedRows = selection.rows.toArray();
    if (selectedRows.length === 0) return null;
    return filteredOrders[selectedRows[0]] || null;
  }, [selection, filteredOrders]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* 1. Header Toolbar & Quick KPI Strip */}
      <div className="px-4 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Buyurtmalar (PO)
            </div>
            <div className="text-xs font-bold">
              {stats.total} ta hujjat
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Faol / Ishlanmoqda
            </div>
            <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
              {stats.active} ta
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Tayyor / Qabul qilingan
            </div>
            <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {stats.ready} ta
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
              Jami Buyurtma Hajmi
            </div>
            <div className="font-mono text-xs font-bold text-foreground">
              {stats.totalAmount.toLocaleString("uz-UZ")} {supplier.currency || "UZS"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
              <SelectTrigger className="h-7 text-[11px] w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha holatlar</SelectItem>
                <SelectItem value="Ordered">Buyurtma berilgan</SelectItem>
                <SelectItem value="In_Production">Ishlab chiqarilmoqda</SelectItem>
                <SelectItem value="Ready">Tayyor bo'lgan</SelectItem>
                <SelectItem value="Delivered">Yetkazib berilgan</SelectItem>
                <SelectItem value="Draft">Qoralama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            onClick={() => setEffectiveModalOpen(true)}
            className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-none cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Yangi buyurtma (PO)</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOrders}
            disabled={isLoading}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title="Jurnalni yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 2. Glide Data Grid Body */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 min-h-0 w-full relative">
          <DataEditor
            columns={columns}
            rows={filteredOrders.length}
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
        <ContextMenuContent className="text-xs">
          {selectedOrder?.workOrderNo && (
            <ContextMenuItem
              onClick={() => {
                openTab({
                  id: selectedOrder.workOrderNo!,
                  title: selectedOrder.workOrderNo!,
                  type: "work-order",
                  module: "production",
                });
              }}
              className="gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Work Orderni ochish ({selectedOrder.workOrderNo})</span>
            </ContextMenuItem>
          )}

          {selectedOrder && selectedOrder.status === "Ordered" && (
            <ContextMenuItem
              onClick={() => handleUpdateStatus(selectedOrder, "Ready")}
              className="gap-2 text-emerald-600"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Holatni &apos;Tayyor bo&apos;ldi&apos; ga o&apos;tkazish</span>
            </ContextMenuItem>
          )}

          {selectedOrder && selectedOrder.status === "Ready" && (
            <ContextMenuItem
              onClick={() => handleUpdateStatus(selectedOrder, "Delivered")}
              className="gap-2 text-purple-600"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Holatni &apos;Qabul qilindi (Yetkazildi)&apos; ga o&apos;tkazish</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => {
              if (selectedOrder) {
                navigator.clipboard.writeText(selectedOrder.orderNo);
              }
            }}
            className="gap-2"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Buyurtma raqamini nusxalash</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 3. New Purchase Order Dialog */}
      <Dialog open={effectiveModalOpen} onOpenChange={setEffectiveModalOpen}>
        <DialogContent className="max-w-lg p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <span>Ta&apos;minotchiga Yangi Buyurtma (PO) berish</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Buyurtma turi *
                </Label>
                <Select
                  value={newOrder.orderType}
                  onValueChange={(val: any) => setNewOrder({ ...newOrder, orderType: val })}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Tegishli Work Order (WO №)
                </Label>
                <Input
                  value={newOrder.workOrderNo || ""}
                  onChange={(e) => setNewOrder({ ...newOrder, workOrderNo: e.target.value })}
                  placeholder="WO-00351 (ixtiyoriy)"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">
                Buyurtma nomi / Qolip yoki material nomi *
              </Label>
              <Input
                value={newOrder.title || ""}
                onChange={(e) => setNewOrder({ ...newOrder, title: e.target.value })}
                placeholder="Masalan: Shokolad qutisi shtampi (50x70) yoki 4 ta CTP metall forma"
                className="h-8 text-xs bg-background"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">Miqdori</Label>
                <Input
                  value={newOrder.quantity || 1}
                  onChange={(e) =>
                    setNewOrder({
                      ...newOrder,
                      quantity: Number(e.target.value.replace(/[^0-9]/g, "")) || 1,
                    })
                  }
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">O&apos;lchov birligi</Label>
                <Input
                  value={newOrder.unit || "dona"}
                  onChange={(e) => setNewOrder({ ...newOrder, unit: e.target.value })}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Taxminiy summasi ({supplier.currency || "UZS"})
                </Label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={(supplier.currency || "UZS") === "UZS" ? 0 : 2}
                  value={newOrder.amount || 0}
                  onValueChange={(values) =>
                    setNewOrder({
                      ...newOrder,
                      amount: values.floatValue ?? 0,
                    })
                  }
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">
                Texnik spetsifikatsiya / Qo&apos;shimcha parametrlar
              </Label>
              <Textarea
                value={newOrder.specDetails || ""}
                onChange={(e) => setNewOrder({ ...newOrder, specDetails: e.target.value })}
                placeholder="Pichoq qalinligi 2pt, rezina balandligi 8mm, kontur fayli biriktirilgan..."
                rows={2}
                className="text-xs bg-background resize-none min-h-[50px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEffectiveModalOpen(false)}
                className="h-7 text-xs"
              >
                Bekor qilish
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs bg-primary text-primary-foreground">
                Buyurtmani tasdiqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
