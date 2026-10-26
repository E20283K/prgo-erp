"use client";

import React, { useState, useMemo, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Plus,
  ExternalLink,
  PackageCheck,
  Truck,
  ClipboardList,
  RotateCw,
  Loader2,
} from "lucide-react";
import {
  useWorkspaceStore,
  CrmCustomerRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

function normalizeCompanyName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(llc|mchj|ooo|xk|qk|aj|chj|ltd|inc)\b/gi, "")
    .replace(/["'«».,]/g, "")
    .trim();
}

function isSameCustomer(
  customer: { id?: string; dbId?: string; name?: string; tin?: string },
  target: {
    clientId?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    customer?: string | null;
    customerTin?: string | null;
  }
): boolean {
  const custIds = [customer.id, customer.dbId].filter(
    (id): id is string =>
      Boolean(id && !id.startsWith("draft-") && !id.startsWith("new-") && !id.startsWith("CUST-NEW-"))
  );
  const targetIds = [target.clientId, target.customerId].filter((id): id is string => Boolean(id));
  if (custIds.length > 0 && targetIds.some((tid) => custIds.includes(tid))) {
    return true;
  }

  const custTin = (customer.tin || "").trim();
  const targetTin = (target.customerTin || "").trim();
  if (custTin.length >= 4 && targetTin.length >= 4 && custTin === targetTin) {
    return true;
  }

  const cleanCust = normalizeCompanyName(customer.name);
  const cleanTarget = normalizeCompanyName(target.customerName ?? target.customer);
  if (!cleanCust || !cleanTarget) return false;
  if (cleanCust === cleanTarget) return true;
  if (cleanCust.length >= 3 && cleanTarget.length >= 3) {
    return cleanCust.includes(cleanTarget) || cleanTarget.includes(cleanCust);
  }
  return false;
}

interface CustomerOrdersTabProps {
  customer: CrmCustomerRecord;
  onCreateClientOrder: () => void;
  onOpenWorkOrder: (order: any) => void;
  onReorderWorkOrder?: (order: any) => void;
  onOpenDeliveryAct: (docNo: string, amount?: number) => void;
}

export function CustomerOrdersTab({
  customer,
  onCreateClientOrder,
  onOpenWorkOrder,
  onReorderWorkOrder,
  onOpenDeliveryAct,
}: CustomerOrdersTabProps) {
  const {
    productionQueue,
    isProductionQueueLoading,
    deliveryActs,
    isFinanceLoading,
    finishedGoods,
    isFinishedGoodsLoading,
    warehouseShipments,
    openTab,
    theme,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const isLoading = Boolean(isProductionQueueLoading || isFinishedGoodsLoading || isFinanceLoading);

  // Match dedicated customer finished goods stock (Tayyor mahsulot zaxirasi)
  const customerFinishedGoods = useMemo(() => {
    return finishedGoods.filter((fg) =>
      isSameCustomer(customer, {
        customerId: fg.customerId,
        clientId: (fg as any).clientId,
        customerName: fg.customerName,
        customerTin: fg.customerTin,
      })
    );
  }, [customer, finishedGoods]);

  const totalRemainingStock = useMemo(() => {
    return customerFinishedGoods.reduce(
      (sum, item) => sum + (Number(item.stockQty ?? (item as any).quantity) || 0),
      0
    );
  }, [customerFinishedGoods]);

  const totalStockValue = useMemo(() => {
    return customerFinishedGoods.reduce((sum, item) => sum + (Number(item.totalStockValue) || 0), 0);
  }, [customerFinishedGoods]);

  // Match live orders from production queue & delivery acts + finished goods
  const customerOrders = useMemo(() => {
    // 1. Delivery Acts (SF)
    const matchedActs = deliveryActs
      .filter((a) =>
        isSameCustomer(customer, {
          customer: a.customer,
          customerTin: a.customerTin,
        })
      )
      .map((a) => {
        const linkedFg = customerFinishedGoods.find(
          (fg) =>
            (a.workOrderId && fg.workOrderId === a.workOrderId) ||
            (a.product && fg.productName === a.product)
        );
        const fgStock = linkedFg ? Number(linkedFg.stockQty ?? (linkedFg as any).quantity) || 0 : 0;
        return {
          docId: a.id,
          docType: "Schet-faktura (SF)",
          date: a.date || "—",
          pressMachine: "Realizatsiya",
          workOrderRef: a.workOrderId || a.orderId,
          product: a.product,
          orderedQty: linkedFg ? Number(linkedFg.orderedQty || a.quantity || 0) : Number(a.quantity || 0),
          producedQty: linkedFg ? Number(linkedFg.producedQty || a.quantity || 0) : Number(a.quantity || 0),
          shippedQty: Number(a.quantity || 0),
          remainingStock: fgStock,
          location: linkedFg
            ? linkedFg.location || (linkedFg as any).locationName || "Tayyor Mahsulot Ombori"
            : "Topshirilgan",
          unit: a.unit || "pcs",
          amountUsd: Number(a.totalAmount || 0),
          status: a.status,
        };
      });

    // 2. Production Queue Work Orders (WO)
    const matchedQueue = productionQueue
      .filter((q) =>
        isSameCustomer(customer, {
          clientId: q.clientId,
          customer: q.customer,
        })
      )
      .map((q) => {
        const linkedFg = customerFinishedGoods.find(
          (fg) => fg.workOrderId === q.id || (q.product && fg.productName === q.product)
        );
        const ordered = Number(linkedFg?.orderedQty || q.quantity || 0);

        const shippedFromActs = deliveryActs
          .filter((a) => a.workOrderId && a.workOrderId === q.id)
          .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        const shippedFromShipments = (warehouseShipments || [])
          .filter(
            (s) =>
              s.workOrder === q.id &&
              (s.status === "Dispatched" || s.status === "Delivered")
          )
          .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

        const shipped = linkedFg
          ? Number(linkedFg.shippedQty || 0)
          : Math.max(shippedFromActs, shippedFromShipments, 0);

        const remaining = linkedFg
          ? Number(linkedFg.stockQty ?? (linkedFg as any).quantity ?? 0)
          : 0;

        const isCompleted = q.stage === "Completed" || q.status === "Completed";
        const produced = linkedFg
          ? Number(linkedFg.producedQty ?? remaining + shipped)
          : isCompleted
          ? Math.max(ordered, shipped)
          : shipped;

        const displayStatus =
          q.status === "Draft" || q.status === "Cancelled"
            ? q.status
            : q.stage || q.status || "Queue";

        const location = linkedFg
          ? linkedFg.location || (linkedFg as any).locationName || "Tayyor Mahsulot Ombori"
          : q.status === "Draft"
          ? "Prepress"
          : q.pressMachine || q.department || "Navbatda";

        const amountUsd = Number(q.priceTotal || (q as any).financials?.totalPrice || 0);

        return {
          docId: q.id,
          docType: "Work Order (WO)",
          date: q.deadline || q.startDate || "—",
          pressMachine: q.pressMachine || q.department || "—",
          workOrderRef: q.clientOrderId || q.id,
          product: q.product,
          orderedQty: ordered,
          producedQty: produced,
          shippedQty: shipped,
          remainingStock: remaining,
          location,
          unit: q.unit || "pcs",
          amountUsd,
          status: displayStatus,
        };
      });

    // 3. Any customer finished goods not yet linked to queue or acts
    const standaloneFg = customerFinishedGoods
      .filter(
        (fg) =>
          !matchedQueue.some((q) => q.docId === fg.workOrderId) &&
          !matchedActs.some((a) => a.workOrderRef === fg.workOrderId)
      )
      .map((fg) => {
        const stockQty = Number(fg.stockQty ?? (fg as any).quantity ?? 0);
        const shippedQty = Number(fg.shippedQty ?? (fg as any).reservedQuantity ?? 0);
        const producedQty = Number(fg.producedQty ?? stockQty + shippedQty);
        const orderedQty = Number(fg.orderedQty ?? producedQty);
        return {
          docId: fg.workOrderId || fg.id,
          docType: "Zaxira Partiyasi (FG)",
          date:
            fg.completionDate ||
            ((fg as any).producedAt
              ? new Date((fg as any).producedAt).toISOString().split("T")[0]
              : "—"),
          pressMachine: "Tayyor Mahsulot Ombori",
          workOrderRef: fg.clientOrderId || (fg as any).orderNo || fg.workOrderId,
          product: fg.productName,
          orderedQty,
          producedQty,
          shippedQty,
          remainingStock: stockQty,
          location:
            fg.location ||
            [(fg as any).locationName, (fg as any).locationShelf].filter(Boolean).join(" — ") ||
            "Tayyor Mahsulot Ombori",
          unit: fg.unit || "pcs",
          amountUsd: Number(fg.totalStockValue || 0),
          status: fg.status || "In Stock",
        };
      });

    return [...matchedActs, ...matchedQueue, ...standaloneFg];
  }, [customer, deliveryActs, productionQueue, warehouseShipments, customerFinishedGoods]);

  // Resizable columns
  const [columns, setColumns] = useState<GridColumn[]>([
    { id: "docId", title: "Hujjat №", width: 120, icon: GridColumnIcon.HeaderReference },
    { id: "docType", title: "Hujjat Turi", width: 135, icon: GridColumnIcon.HeaderSingleValue },
    { id: "date", title: "Sana / Muddat", width: 105, icon: GridColumnIcon.HeaderDate },
    { id: "product", title: "Bosma mahsulot nomi", width: 280, icon: GridColumnIcon.HeaderString },
    { id: "orderedQty", title: "Tiraj (Zakaz)", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "producedQty", title: "Chiqarildi (Fakt)", width: 115, icon: GridColumnIcon.HeaderNumber },
    { id: "shippedQty", title: "Yuklandi (SF)", width: 105, icon: GridColumnIcon.HeaderNumber },
    { id: "remainingStock", title: "Omborda Qoldiq (Zaxira)", width: 155, icon: GridColumnIcon.HeaderNumber },
    { id: "location", title: "Ombor / Joylashuv", width: 210, icon: GridColumnIcon.HeaderString },
    { id: "amountUsd", title: "Summa ($)", width: 115, icon: GridColumnIcon.HeaderNumber },
    { id: "status", title: "Bosqich / Holati", width: 130, icon: GridColumnIcon.HeaderSingleValue },
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
      const item = customerOrders[row];
      const column = columns[col];
      if (!item || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "remainingStock") {
        const num = Number(item.remainingStock || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: num > 0 ? `${num.toLocaleString()} ${item.unit || "dona"}` : "0",
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: num > 0 ? {
            textDark: isDark ? "#4ade80" : "#15803d",
            baseFontStyle: "bold 12px monospace",
          } : {
            textDark: isDark ? "#71717a" : "#a1a1aa",
            baseFontStyle: "12px monospace",
          },
        };
      }

      if (column.id && ["orderedQty", "producedQty", "shippedQty"].includes(column.id)) {
        const num = Number((item as any)[column.id] || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: `${num.toLocaleString()} ${item.unit || "dona"}`,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "12px monospace",
          },
        };
      }

      if (column.id === "amountUsd") {
        const num = Number(item.amountUsd || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: num > 0 ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 12px monospace",
          },
        };
      }

      if (column.id === "status") {
        let color: string | undefined = undefined;
        if (item.status === "Completed" || item.status === "Posted" || item.status === "In Stock") {
          color = isDark ? "#4ade80" : "#15803d";
        } else if (item.status === "In Production" || item.status === "Ready for Dispatch") {
          color = isDark ? "#60a5fa" : "#1d4ed8";
        } else if (item.status === "Ready to Print" || item.status === "Partially Shipped") {
          color = isDark ? "#facc15" : "#b45309";
        }

        return {
          kind: GridCellKind.Text,
          data: item.status,
          displayData: item.status,
          allowOverlay: false,
          themeOverride: color ? { textDark: color, baseFontStyle: "600 12px sans-serif" } : undefined,
        };
      }

      const val = String((item as any)[String(column.id)] ?? "");
      return {
        kind: GridCellKind.Text,
        data: val,
        displayData: val,
        allowOverlay: false,
      };
    },
    [customerOrders, columns, isDark]
  );

  const handleRowActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const item = customerOrders[row];
      if (!item) return;

      if (
        item.docId.startsWith("SF-") ||
        item.docId.startsWith("ACT-") ||
        item.docType === "Schet-faktura (SF)"
      ) {
        onOpenDeliveryAct(item.docId, item.amountUsd);
      } else {
        onOpenWorkOrder(item);
      }
    },
    [customerOrders, onOpenDeliveryAct, onOpenWorkOrder]
  );

  const handleCreateShipmentFromStock = (selectedItem?: any) => {
    const draftId = `draft-shp-${Date.now()}`;
    const targetProduct =
      selectedItem?.product ||
      customerFinishedGoods[0]?.productName ||
      customerOrders[0]?.product ||
      "";
    const targetQty =
      selectedItem?.remainingStock ||
      (totalRemainingStock > 0 ? totalRemainingStock : selectedItem?.orderedQty || 0);

    openTab({
      id: draftId,
      title: `Yangi Chiqim: ${customer.name}`,
      type: "warehouse-shipment",
      module: "warehouse",
      isUnsaved: false,
      documentData: {
        id: draftId,
        shipmentNumber: "",
        date: new Date().toISOString().split("T")[0],
        customer: customer.name,
        customerTin: customer.tin,
        workOrder: selectedItem?.docId || customerFinishedGoods[0]?.workOrderId || "",
        product: targetProduct,
        quantity: targetQty,
        unit: selectedItem?.unit || customerFinishedGoods[0]?.unit || "pcs",
        from: "Asosiy ombor",
        carrier: "",
        status: "Draft",
        shipmentType: "CustomerDelivery",
        notes: targetQty > 0 ? `Tayyor mahsulot zaxirasidan chiqarildi (${targetQty} dona).` : "",
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* ── KPI Strip: Total Orders & Customer Dedicated Warehouse Stock ── */}
      <div className="px-4 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* Total Orders Counter */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-border bg-muted/40">
            <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-muted-foreground">
                Jami buyurtmalar
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                {customerOrders.length.toLocaleString()} ta
              </span>
            </div>
          </div>

          {/* Dedicated Customer Stock KPI Box */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30">
            <div className="w-7 h-7 rounded bg-emerald-500/15 flex items-center justify-center shrink-0">
              <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Tayyor zaxira
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-emerald-400 text-emerald-700 bg-emerald-100/70 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/70 font-semibold"
                >
                  Mas&apos;ul saqlov
                </Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {totalRemainingStock.toLocaleString()} dona
                </span>
                {totalStockValue > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    (${totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {totalRemainingStock > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateShipmentFromStock()}
              className="h-7 px-2.5 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50 cursor-pointer shadow-xs font-medium"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Yuk xati tuzish</span>
            </Button>
          )}

          {selection.rows.toArray().length > 0 && onReorderWorkOrder && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const rows = selection.rows.toArray();
                const selectedItem = rows.length > 0 ? customerOrders[rows[0]] : undefined;
                if (selectedItem) onReorderWorkOrder(selectedItem);
              }}
              className="h-7 px-2.5 text-xs gap-1.5 border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50 cursor-pointer shadow-xs font-medium"
              title="Tanlangan buyurtma asosida takroriy buyurtma ochish"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Qayta buyurtma</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={onCreateClientOrder}
            className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 cursor-pointer shadow-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yangi buyurtma</span>
          </Button>
        </div>
      </div>

      {/* Main Glide Grid */}
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 w-full h-full relative overflow-hidden">
          <DataEditor
            getCellContent={getCellContent}
            onCellActivated={handleRowActivated}
            columns={columns}
            onColumnResize={handleColumnResize}
            rows={customerOrders.length}
            rowMarkers="both"
            freezeColumns={1}
            smoothScrollX={true}
            smoothScrollY={true}
            width="100%"
            height="100%"
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            headerHeight={28}
            rowHeight={32}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          />
          {customerOrders.length === 0 && (
            <div className="absolute inset-0 top-7 flex flex-col items-center justify-center gap-2 bg-background/60 pointer-events-none">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Yuklanmoqda...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 pointer-events-auto">
                  <ClipboardList className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Buyurtmalar va zaxira mavjud emas
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCreateClientOrder}
                    className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Yangi buyurtma</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64 text-xs">
          <ContextMenuItem
            onClick={() => {
              const rows = selection.rows.toArray();
              if (rows.length > 0) {
                handleRowActivated([0, rows[0]]);
              }
            }}
            className="gap-2 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Hujjatni ochish (F12)</span>
          </ContextMenuItem>

          {onReorderWorkOrder && (
            <ContextMenuItem
              onClick={() => {
                const rows = selection.rows.toArray();
                const selectedItem = rows.length > 0 ? customerOrders[rows[0]] : undefined;
                if (selectedItem) onReorderWorkOrder(selectedItem);
              }}
              className="gap-2 cursor-pointer text-blue-700 dark:text-blue-400 font-medium"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Qayta buyurtma (Reorder) ochish</span>
            </ContextMenuItem>
          )}

          <ContextMenuItem
            onClick={() => {
              const rows = selection.rows.toArray();
              const selectedItem = rows.length > 0 ? customerOrders[rows[0]] : undefined;
              handleCreateShipmentFromStock(selectedItem);
            }}
            className="gap-2 cursor-pointer text-emerald-700 dark:text-emerald-400 font-medium"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Ushbu qoldiqdan yuk xati (Chiqim) tuzish</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={onCreateClientOrder} className="gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>+ Yangi Buyurtma ochish (Ins)</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
