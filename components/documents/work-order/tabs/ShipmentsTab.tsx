"use client";

import React, { useMemo, useEffect } from "react";
import { Truck, ExternalLink, Printer, FileText, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { WorkOrderFormData, RouteStep, ShiftEvent } from "../types";
import { useWorkspaceStore, WarehouseShipmentRecord } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";
import { getProducedOutputQty, sumBoxQty } from "../utils/productionOutput";

/**
 * Shipments tab = what the warehouse has shipped of this order, read from the warehouse shipments
 * whose lines come from it. There is no plan of its own: the shipment documents are the record.
 * Goods are prepared in the order (boxes + box labels) and handed over to the FG warehouse; a
 * shipment takes what the warehouse holds, so an early partial delivery is just a smaller shipment.
 */
interface ShipmentsTabProps {
  formData: WorkOrderFormData;
  docNo: string;
  operations?: RouteStep[];
  shiftEvents?: ShiftEvent[];
  onCreateShipment: () => void;
  onOpenShipment: (shipmentId: string) => void;
  onOpenDeliveryAct?: (actId: string) => void;
  onOpenPrintLabels?: () => void;
  /** Hands the packed boxes over to the FG warehouse. */
  onHandOver?: () => void;
}

const STATUS_LABEL: Record<WarehouseShipmentRecord["status"], { label: string; className: string }> = {
  Draft: { label: "Qoralama", className: "text-muted-foreground" },
  Reserved: { label: "Band", className: "text-amber-600 dark:text-amber-400" },
  Picking: { label: "Terilmoqda", className: "text-amber-600 dark:text-amber-400" },
  Packed: { label: "Tayyor yuk", className: "text-amber-700 dark:text-amber-300" },
  Dispatched: { label: "Jo'natildi", className: "text-emerald-600 dark:text-emerald-400" },
  "In Transit": { label: "Yo'lda", className: "text-emerald-600 dark:text-emerald-400" },
  Delivered: { label: "Yetkazildi", className: "text-emerald-700 dark:text-emerald-300" },
  Cancelled: { label: "Bekor", className: "text-muted-foreground line-through" },
};

const SHIPPED_STATUSES = new Set<WarehouseShipmentRecord["status"]>(["Dispatched", "In Transit", "Delivered"]);

const sameNo = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** This order's quantity on a shipment: its finished-goods lines (accessories and materials are not the order's product). */
function orderQtyOf(s: WarehouseShipmentRecord, docNo: string): number {
  const lines = s.items || [];
  if (lines.length === 0) return sameNo(s.workOrder, docNo) ? Number(s.quantity) || 0 : 0;
  return lines
    .filter((l) => l.accountCode !== "2910" && l.accountCode !== "1010")
    .filter((l) => sameNo(l.sourceWorkOrderId || s.workOrder, docNo))
    .reduce((sum, l) => sum + (Number(l.shippedQty) || 0), 0);
}

export function ShipmentsTab({
  formData,
  docNo,
  operations = [],
  shiftEvents = [],
  onCreateShipment,
  onOpenShipment,
  onOpenDeliveryAct,
  onOpenPrintLabels,
  onHandOver,
}: ShipmentsTabProps) {
  const warehouseShipments = useWorkspaceStore((state) => state.warehouseShipments);
  const finishedGoods = useWorkspaceStore((state) => state.finishedGoods);
  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.loadWarehouseShipments) s.loadWarehouseShipments();
    if (s.loadFinishedGoods) s.loadFinishedGoods();
  }, []);

  const totalOrderQty = Number(formData.quantity) || 0;
  const orderUnit = formData.unit || "dona";

  // Shipments carrying this order's goods, newest first; cancelled ones stay at the bottom.
  const rows = useMemo(
    () =>
      warehouseShipments
        .map((s) => ({ shipment: s, qty: orderQtyOf(s, docNo) }))
        .filter((r) => r.qty > 0 || sameNo(r.shipment.workOrder, docNo))
        .sort((a, b) => {
          const ca = a.shipment.status === "Cancelled" ? 1 : 0;
          const cb = b.shipment.status === "Cancelled" ? 1 : 0;
          return ca - cb || (b.shipment.date || "").localeCompare(a.shipment.date || "");
        }),
    [warehouseShipments, docNo]
  );

  const producedQty = useMemo(() => getProducedOutputQty(operations, shiftEvents), [operations, shiftEvents]);

  const boxes = useMemo(() => formData.packagingData?.boxes || [], [formData.packagingData?.boxes]);
  const packedQty = sumBoxQty(boxes);
  const readyToHandQty = sumBoxQty(boxes, "ready");

  // The FG warehouse record of this order: what waits for receipt and what is free to ship.
  const fg = useMemo(() => finishedGoods.find((f) => f.id === `FG-${docNo}`), [finishedGoods, docNo]);
  const handedQty = fg?.pendingQty ?? sumBoxQty(boxes, "handed");
  const inStockFreeQty = Math.max(0, Number(fg?.stockQty) || 0);

  const shippedQty = rows.filter((r) => SHIPPED_STATUSES.has(r.shipment.status)).reduce((s, r) => s + r.qty, 0);
  const remainingQty = Math.max(0, totalOrderQty - shippedQty);
  const pct = (v: number) => (totalOrderQty > 0 ? Math.min(100, Math.round((v / totalOrderQty) * 100)) : 0);

  const fmt = (v: number) => v.toLocaleString();

  return (
    <TabsContent
      value="shipments"
      className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-y-auto p-4 space-y-3 focus-visible:outline-none data-[state=inactive]:hidden"
    >
      <div className="border border-border rounded-lg bg-card px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          {[
            { label: "Tiraj", value: totalOrderQty, className: "text-foreground" },
            { label: "Ishlab chiqarildi", value: producedQty, className: "text-blue-600 dark:text-blue-400" },
            { label: "Qadoqlandi", value: packedQty, className: "text-foreground" },
            { label: "Topshirildi", value: handedQty, className: "text-amber-600 dark:text-amber-400" },
            { label: "Omborda", value: inStockFreeQty, className: "text-amber-700 dark:text-amber-300" },
            { label: "Jo'natildi", value: shippedQty, className: "text-emerald-600 dark:text-emerald-400" },
            { label: "Qoldiq", value: remainingQty, className: "text-foreground" },
          ].map((k) => (
            <span key={k.label} className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">{k.label}</span>
              <strong className={cn("font-mono font-semibold", k.className)}>{fmt(k.value)}</strong>
            </span>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">{orderUnit}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex">
          <div className="bg-emerald-600 h-full" style={{ width: `${pct(shippedQty)}%` }} />
          <div
            className="bg-amber-500 h-full"
            style={{ width: `${Math.max(0, Math.min(100 - pct(shippedQty), pct(inStockFreeQty)))}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onCreateShipment}
          disabled={inStockFreeQty <= 0}
          title={inStockFreeQty > 0 ? `Omborda: ${fmt(inStockFreeQty)} ${orderUnit}` : "Omborda tayyor mahsulot yo'q"}
          className="h-7 text-xs gap-1.5"
        >
          <Truck className="size-3.5" />
          <span>Chiqim yaratish</span>
        </Button>
        <div className="flex items-center gap-2">
          {onHandOver && readyToHandQty > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={onHandOver} className="h-7 text-xs gap-1.5">
              <PackageCheck className="size-3.5" />
              <span>Omborga topshirish ({fmt(readyToHandQty)})</span>
            </Button>
          )}
          {onOpenPrintLabels && boxes.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenPrintLabels} className="h-7 text-xs gap-1.5">
              <Printer className="size-3.5" />
              <span>Yorliqlar</span>
            </Button>
          )}
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="h-7 border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground">
              <th className="px-3">Chiqim</th>
              <th className="px-3">Sana</th>
              <th className="px-3">Oluvchi</th>
              <th className="px-3 text-right">Miqdor</th>
              <th className="px-3">Holat</th>
              <th className="px-3">Schet-faktura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr className="h-8">
                <td className="px-3 text-muted-foreground" colSpan={6}>
                  Chiqim yo&apos;q
                </td>
              </tr>
            )}
            {rows.map(({ shipment: s, qty }) => {
              const st = STATUS_LABEL[s.status] || STATUS_LABEL.Draft;
              return (
                <tr key={s.id} className={cn("h-7 hover:bg-muted/20", s.status === "Cancelled" && "opacity-60")}>
                  <td className="px-3">
                    <button
                      type="button"
                      onClick={() => onOpenShipment(s.id)}
                      className="flex items-center gap-1 font-mono text-primary hover:underline text-[11px]"
                    >
                      <span>{s.id}</span>
                      <ExternalLink className="size-2.5" />
                    </button>
                  </td>
                  <td className="px-3 font-mono text-[11px]">{s.date || "—"}</td>
                  <td className="px-3 truncate max-w-[220px]">{s.recipientName || s.customer || "—"}</td>
                  <td className="px-3 text-right font-mono font-semibold">{fmt(qty)}</td>
                  <td className={cn("px-3 font-medium", st.className)}>{st.label}</td>
                  <td className="px-3">
                    {s.deliveryActId && onOpenDeliveryAct ? (
                      <button
                        type="button"
                        onClick={() => onOpenDeliveryAct(s.deliveryActId)}
                        className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
                      >
                        <FileText className="size-3" />
                        <span>{s.deliveryActId}</span>
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TabsContent>
  );
}
