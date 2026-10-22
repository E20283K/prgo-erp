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
import { Plus, ExternalLink, PackageCheck, Truck, Layers, Info, RotateCw } from "lucide-react";
import {
  useWorkspaceStore,
  CrmCustomerRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

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
  const { productionQueue, deliveryActs, finishedGoods, warehouseShipments, openTab, theme } =
    useWorkspaceStore();
  const isDark = theme === "dark";

  // Match dedicated customer finished goods stock (Ortiqcha yoki saqlanayotgan tayyor mahsulot)
  const customerFinishedGoods = useMemo(() => {
    const cleanCustomer = customer.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();
    return finishedGoods.filter((fg) => {
      if (fg.customerId && fg.customerId === customer.id) return true;
      if (customer.tin && fg.customerTin === customer.tin) return true;
      const fgCust = fg.customerName.toLowerCase();
      return (
        fgCust === cleanCustomer ||
        fgCust.includes(cleanCustomer) ||
        cleanCustomer.includes(fgCust)
      );
    });
  }, [customer.name, customer.id, customer.tin, finishedGoods]);

  const totalRemainingStock = useMemo(() => {
    return customerFinishedGoods.reduce((sum, item) => sum + (item.stockQty || 0), 0);
  }, [customerFinishedGoods]);

  const totalStockValue = useMemo(() => {
    return customerFinishedGoods.reduce((sum, item) => sum + (item.totalStockValue || 0), 0);
  }, [customerFinishedGoods]);

  // Match live orders from production queue & delivery acts + finished goods
  const customerOrders = useMemo(() => {
    const cleanCustomer = customer.name.replace(" LLC", "").replace(" MCHJ", "").trim().toLowerCase();

    // 1. Delivery Acts (SF)
    const matchedActs = deliveryActs
      .filter((a) => {
        const actName = a.customer.toLowerCase();
        return (
          actName === cleanCustomer ||
          actName.includes(cleanCustomer) ||
          cleanCustomer.includes(actName) ||
          (customer.tin && a.customerTin === customer.tin)
        );
      })
      .map((a) => {
        // Find matching finished goods record if any
        const linkedFg = customerFinishedGoods.find(
          (fg) => fg.workOrderId === a.workOrderId || fg.productName === a.product
        );
        return {
          docId: a.id,
          docType: "Schet-faktura (SF)",
          date: a.date,
          pressMachine: "Buxgalteriya / Realizatsiya",
          workOrderRef: a.workOrderId || a.orderId,
          product: a.product,
          orderedQty: linkedFg ? linkedFg.orderedQty : a.quantity,
          producedQty: linkedFg ? linkedFg.producedQty : a.quantity,
          shippedQty: a.quantity,
          remainingStock: linkedFg ? linkedFg.stockQty : 0,
          location: linkedFg ? linkedFg.location : "Topshirilgan (Mijozda)",
          unit: a.unit || "pcs",
          amountUsd: a.totalAmount,
          status: a.status,
        };
      });

    // 2. Production Queue Work Orders (WO)
    const matchedQueue = productionQueue
      .filter((q) => {
        const qName = q.customer.toLowerCase();
        return (
          qName === cleanCustomer ||
          qName.includes(cleanCustomer) ||
          cleanCustomer.includes(qName)
        );
      })
      .map((q) => {
        const linkedFg = customerFinishedGoods.find(
          (fg) => fg.workOrderId === q.id || fg.productName === q.product
        );
        const ordered = linkedFg ? linkedFg.orderedQty : q.quantity;
        const produced = linkedFg ? linkedFg.producedQty : q.quantity;
        const shipped = linkedFg ? linkedFg.shippedQty : 0;
        const remaining = linkedFg ? linkedFg.stockQty : Math.max(0, produced - shipped);

        return {
          docId: q.id,
          docType: "Work Order (WO)",
          date: q.deadline || "2026-10-20",
          pressMachine: q.pressMachine || "Heidelberg Speedmaster XL 106",
          workOrderRef: q.clientOrderId || q.id,
          product: q.product,
          orderedQty: ordered,
          producedQty: produced,
          shippedQty: shipped,
          remainingStock: remaining,
          location: linkedFg ? linkedFg.location : "Sex / Chiqarish liniyasi",
          unit: q.unit || "pcs",
          amountUsd: 0,
          status: q.stage,
        };
      });

    // 3. Any customer finished goods not yet in queue or acts
    const standaloneFg = customerFinishedGoods
      .filter(
        (fg) =>
          !matchedQueue.some((q) => q.docId === fg.workOrderId) &&
          !matchedActs.some((a) => a.workOrderRef === fg.workOrderId)
      )
      .map((fg) => ({
        docId: fg.workOrderId || fg.id,
        docType: "Zaxira Partiyasi (FG)",
        date: fg.completionDate,
        pressMachine: "Tayyor Mahsulot Ombori",
        workOrderRef: fg.clientOrderId || fg.workOrderId,
        product: fg.productName,
        orderedQty: fg.orderedQty,
        producedQty: fg.producedQty,
        shippedQty: fg.shippedQty,
        remainingStock: fg.stockQty,
        location: fg.location,
        unit: fg.unit,
        amountUsd: fg.totalStockValue,
        status: fg.status,
      }));

    const all = [...matchedActs, ...matchedQueue, ...standaloneFg];

    // Fallback if empty so the customer history isn't completely blank
    if (all.length === 0) {
      return [
        {
          docId: `WOOF-26-${customer.id.replace("CUST-", "").padStart(4, "0")}`,
          docType: "Work Order (WO)",
          date: "2026-10-15",
          pressMachine: "Heidelberg Speedmaster XL 106-8P",
          workOrderRef: `CO-00${customer.id.replace("CUST-", "4")}`,
          product: `${customer.name} — Standart Korporativ Qadoq`,
          orderedQty: 10000,
          producedQty: 12500,
          shippedQty: 10000,
          remainingStock: 2500,
          location: "Tayyor Mahsulot Ombori — Rampa 2, Pallet P-04",
          unit: "pcs",
          amountUsd: 4850,
          status: "Ready to Print",
        },
      ];
    }

    return all;
  }, [customer.name, customer.tin, customer.id, deliveryActs, productionQueue, customerFinishedGoods]);

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

      if (item.docId.startsWith("SF-")) {
        onOpenDeliveryAct(item.docId, item.amountUsd);
      } else {
        onOpenWorkOrder(item);
      }
    },
    [customerOrders, onOpenDeliveryAct, onOpenWorkOrder]
  );

  const handleCreateShipmentFromStock = (selectedItem?: any) => {
    const draftId = `draft-shp-${Date.now()}`;
    const targetProduct = selectedItem?.product || (customerFinishedGoods[0]?.productName ?? `${customer.name} Mahsuloti`);
    const targetQty = selectedItem?.remainingStock || (totalRemainingStock > 0 ? totalRemainingStock : 1000);

    openTab({
      id: draftId,
      title: `Yangi Chiqim: ${customer.name} (Qoralama)`,
      type: "warehouse-shipment",
      module: "warehouse",
      isUnsaved: true,
      documentData: {
        id: draftId,
        shipmentNumber: "",
        date: new Date().toISOString().split("T")[0],
        customer: customer.name,
        customerTin: customer.tin,
        workOrder: selectedItem?.docId || customerFinishedGoods[0]?.workOrderId || "WOOF-26-0351",
        product: targetProduct,
        quantity: targetQty,
        unit: "pcs",
        from: "Main Factory — Tashkent",
        carrier: "PrintGoo Fleet #1",
        status: "Draft",
        shipmentType: "CustomerDelivery",
        notes: `Tayyor mahsulot zaxirasidan chiqarildi (${targetQty} dona).`,
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* ── KPI Strip: Total Orders & Customer Dedicated Warehouse Stock ── */}
      <div className="px-4 py-2.5 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* Dedicated Customer Stock KPI Box */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30">
            <div className="w-8 h-8 rounded bg-emerald-500/15 flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Ombordagi Tayyor Mahsulot Zaxirasi:
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
                    (${totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} qiymatda)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground border-l border-border pl-3">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              Tirajdan ortgan yoki navbatdagi jo&apos;natish uchun omborda saqlanayotgan mahsulotlar.
            </span>
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
              <span>+ Zaxiradan Yuk Xati (Chiqim) tuzish</span>
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
            <span>+ Yangi Buyurtma (CO / WO)</span>
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
