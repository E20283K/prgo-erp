"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Truck, Plus, Split, ExternalLink, Edit2, Trash2, Printer, FileText, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkOrderFormData, WorkOrderDeliveryBatch, DeliveryBatchStatus, RouteStep, ShiftEvent } from "../types";
import { BatchEditDialog } from "../dialogs/BatchEditDialog";
import { useWorkspaceStore, WarehouseShipmentRecord } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";
import { getProducedOutputQty, sumBoxQty } from "../utils/productionOutput";

/**
 * Shipments tab = the delivery PLAN of the order (batches: date, quantity, sizes).
 * The FACT (status, shipped quantity, invoice) is read from the warehouse shipment linked to each batch.
 * A batch ships only from the FG warehouse: produced -> packed -> handed over -> received -> shipped.
 */
interface ShipmentsTabProps {
  formData: WorkOrderFormData;
  docNo: string;
  operations?: RouteStep[];
  shiftEvents?: ShiftEvent[];
  onUpdateBatches: (batches: WorkOrderDeliveryBatch[]) => void;
  onCreateShipment: (batch: WorkOrderDeliveryBatch) => void;
  onOpenShipment: (shipmentId: string) => void;
  onOpenDeliveryAct?: (actId: string) => void;
  onOpenPrintLabels?: () => void;
  /** Hands the packed boxes over to the FG warehouse. */
  onHandOver?: () => void;
}

type FactState = "plan" | "overdue" | "warehouse" | "shipped" | "delivered";

const FACT_LABEL: Record<FactState, { label: string; className: string }> = {
  plan: { label: "Reja", className: "text-muted-foreground" },
  overdue: { label: "Muddati o'tdi", className: "text-destructive" },
  warehouse: { label: "Omborda", className: "text-amber-600 dark:text-amber-400" },
  shipped: { label: "Jo'natildi", className: "text-emerald-600 dark:text-emerald-400" },
  delivered: { label: "Yetkazildi", className: "text-emerald-700 dark:text-emerald-300" },
};

const SHIPPED_STATUSES = new Set<WarehouseShipmentRecord["status"]>(["Dispatched", "In Transit", "Delivered"]);

const sameNo = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

const today = () => new Date().toISOString().split("T")[0];

function factFromBatchStatus(status: DeliveryBatchStatus): FactState {
  if (status === "delivered") return "delivered";
  if (status === "dispatched") return "shipped";
  return "plan";
}

export function ShipmentsTab({
  formData,
  docNo,
  operations = [],
  shiftEvents = [],
  onUpdateBatches,
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

  const batches = useMemo(() => formData.deliveryBatches || [], [formData.deliveryBatches]);
  const totalOrderQty = Number(formData.quantity) || 0;
  const orderUnit = formData.unit || "dona";

  // Warehouse shipments of this order that are not cancelled.
  const orderShipments = useMemo(
    () => warehouseShipments.filter((s) => sameNo(s.workOrder, docNo) && s.status !== "Cancelled"),
    [warehouseShipments, docNo]
  );

  const findShipment = useCallback(
    (b: WorkOrderDeliveryBatch) =>
      b.linkedShipmentId
        ? warehouseShipments.find((s) => s.id === b.linkedShipmentId || s.dbId === b.linkedShipmentId) || null
        : orderShipments.find((s) => s.batchId === b.id) || null,
    [warehouseShipments, orderShipments]
  );

  const rows = useMemo(
    () =>
      batches.map((b) => {
        const shipment = findShipment(b);
        const active = shipment && shipment.status !== "Cancelled" ? shipment : null;
        let fact: FactState;
        if (active) {
          fact =
            active.status === "Delivered" ? "delivered" : SHIPPED_STATUSES.has(active.status) ? "shipped" : "warehouse";
        } else if (b.linkedShipmentId && !shipment) {
          // Linked document not loaded yet: trust the last status the warehouse wrote on the batch.
          fact = factFromBatchStatus(b.status);
        } else {
          fact = "plan";
        }
        if (fact === "plan" && b.targetDate && b.targetDate < today()) fact = "overdue";
        const shippedQty =
          fact === "shipped" || fact === "delivered" ? Number(active?.quantity ?? b.dispatchedQty ?? b.quantity) || 0 : 0;
        return { batch: b, shipment: active, fact, shippedQty };
      }),
    [batches, findShipment]
  );

  // Shipments made in the warehouse for this order without a batch of the plan.
  const unplannedShipments = useMemo(() => {
    const linked = new Set(rows.map((r) => r.shipment?.id).filter(Boolean));
    return orderShipments.filter((s) => !linked.has(s.id));
  }, [orderShipments, rows]);

  const producedQty = useMemo(() => getProducedOutputQty(operations, shiftEvents), [operations, shiftEvents]);

  const boxes = useMemo(() => formData.packagingData?.boxes || [], [formData.packagingData?.boxes]);
  const packedQty = sumBoxQty(boxes);
  const readyToHandQty = sumBoxQty(boxes, "ready");

  // The FG warehouse record of this order: what waits for receipt and what is free to ship.
  const fg = useMemo(() => finishedGoods.find((f) => f.id === `FG-${docNo}`), [finishedGoods, docNo]);
  const handedQty = fg?.pendingQty ?? sumBoxQty(boxes, "handed");
  const inStockFreeQty = Math.max(0, Number(fg?.stockQty) || 0);

  const shippedQty =
    rows.reduce((s, r) => s + r.shippedQty, 0) +
    unplannedShipments.filter((s) => SHIPPED_STATUSES.has(s.status)).reduce((s, sh) => s + (Number(sh.quantity) || 0), 0);
  const plannedQty = batches.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
  const remainingQty = Math.max(0, totalOrderQty - shippedQty);
  const pct = (v: number) => (totalOrderQty > 0 ? Math.min(100, Math.round((v / totalOrderQty) * 100)) : 0);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<WorkOrderDeliveryBatch | null>(null);

  const handleSaveBatch = (saved: WorkOrderDeliveryBatch) => {
    const exists = batches.some((b) => b.id === saved.id);
    const next = exists ? batches.map((b) => (b.id === saved.id ? saved : b)) : [...batches, saved];
    onUpdateBatches([...next].sort((a, b) => a.batchNo - b.batchNo));
  };

  const handleSplitEqually = useCallback(
    (parts: number) => {
      if (totalOrderQty <= 0 || parts < 2) return;
      const base = Math.floor(totalOrderQty / parts);
      const sizes = formData.sizes || [];
      const sizesTotal = sizes.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
      const start = new Date();
      const next: WorkOrderDeliveryBatch[] = [];
      for (let i = 1; i <= parts; i++) {
        const qty = i === parts ? totalOrderQty - base * (parts - 1) : base;
        let running = 0;
        const sizeItems =
          sizesTotal > 0
            ? sizes.map((s, idx) => {
                const q =
                  idx === sizes.length - 1
                    ? Math.max(0, qty - running)
                    : Math.round(((Number(s.quantity) || 0) / sizesTotal) * qty);
                running += q;
                return { sizeId: s.id, sizeName: s.size, quantity: q };
              })
            : undefined;
        next.push({
          id: `batch-${Date.now()}-${i}`,
          batchNo: i,
          title: `Partiya #${i}`,
          targetDate: new Date(start.getTime() + (i - 1) * 7 * 86400000).toISOString().split("T")[0],
          quantity: qty,
          status: "scheduled",
          sizeItems,
        });
      }
      onUpdateBatches(next);
    },
    [totalOrderQty, formData.sizes, onUpdateBatches]
  );

  // No plan yet: the whole order goes as one shipment.
  const handleShipWholeOrder = () => {
    const single: WorkOrderDeliveryBatch = {
      id: `batch-${Date.now()}-1`,
      batchNo: 1,
      title: "Partiya #1",
      targetDate: formData.deadline || today(),
      quantity: remainingQty || totalOrderQty,
      status: "scheduled",
    };
    onUpdateBatches([single]);
    onCreateShipment(single);
  };

  const splitMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={totalOrderQty <= 0}>
            <Split className="size-3.5" />
            <span>Teng bo&apos;lish</span>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="text-xs">
        {[2, 3, 4, 6].map((n) => (
          <DropdownMenuItem key={n} onClick={() => handleSplitEqually(n)}>
            {n} partiya
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const fmt = (v: number) => v.toLocaleString();

  return (
    <TabsContent
      value="shipments"
      className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-y-auto p-4 space-y-3 focus-visible:outline-none data-[state=inactive]:hidden"
    >
      {/* Summary: plan vs fact in one line */}
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

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingBatch(null);
              setIsDialogOpen(true);
            }}
            className="h-7 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Partiya qo&apos;shish</span>
          </Button>
          {splitMenu}
        </div>
        <div className="flex items-center gap-2">
          {onHandOver && readyToHandQty > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={onHandOver} className="h-7 text-xs gap-1.5">
              <PackageCheck className="size-3.5" />
              <span>Omborga topshirish ({fmt(readyToHandQty)})</span>
            </Button>
          )}
          {onOpenPrintLabels && (formData.packagingData?.boxes?.length || 0) > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenPrintLabels} className="h-7 text-xs gap-1.5">
              <Printer className="size-3.5" />
              <span>Yorliqlar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Plan table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="h-7 border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground">
              <th className="px-3 w-10 text-center">#</th>
              <th className="px-3">Partiya</th>
              <th className="px-3">Muddat</th>
              <th className="px-3 text-right">Reja</th>
              <th className="px-3">Razmerlar</th>
              <th className="px-3">Holat</th>
              <th className="px-3 text-right">Fakt</th>
              <th className="px-3">Chiqim</th>
              <th className="px-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr className="h-8">
                <td className="px-3 text-center font-mono text-muted-foreground">1</td>
                <td className="px-3 text-foreground">Bitta jo&apos;natma</td>
                <td className="px-3 font-mono text-[11px]">{formData.deadline || "—"}</td>
                <td className="px-3 text-right font-mono font-semibold">{fmt(totalOrderQty)}</td>
                <td className="px-3 text-muted-foreground">—</td>
                <td className={cn("px-3", FACT_LABEL.plan.className)}>{FACT_LABEL.plan.label}</td>
                <td className="px-3 text-right font-mono text-muted-foreground">—</td>
                <td className="px-3" colSpan={2}>
                  {inStockFreeQty > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleShipWholeOrder}
                      className="h-6 px-2 text-[11px] gap-1"
                      title={`Omborda: ${fmt(inStockFreeQty)}`}
                    >
                      <Truck className="size-3" />
                      <span>Chiqim yaratish</span>
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Omborda yo&apos;q</span>
                  )}
                </td>
              </tr>
            )}

            {rows.map(({ batch, shipment, fact, shippedQty: rowShipped }) => {
              const factCfg = FACT_LABEL[fact];
              const locked = Boolean(shipment) || fact === "shipped" || fact === "delivered";
              const shipmentNo = shipment?.id || batch.linkedShipmentId;
              const actId = shipment?.deliveryActId || batch.linkedDeliveryActId;
              return (
                <tr key={batch.id} className="h-8 hover:bg-muted/20">
                  <td className="px-3 text-center font-mono text-muted-foreground">{batch.batchNo}</td>
                  <td className="px-3">
                    <div className="text-foreground truncate max-w-[220px]">{batch.title}</div>
                    {batch.destination && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{batch.destination}</div>
                    )}
                  </td>
                  <td className="px-3 font-mono text-[11px]">{batch.targetDate || "—"}</td>
                  <td className="px-3 text-right font-mono font-semibold">{fmt(Number(batch.quantity) || 0)}</td>
                  <td className="px-3">
                    {batch.sizeItems?.some((si) => si.quantity > 0) ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {batch.sizeItems
                          .filter((si) => si.quantity > 0)
                          .map((si) => (
                            <span key={si.sizeId} className="px-1 rounded bg-muted text-[10px] font-mono border border-border">
                              {si.sizeName}: {fmt(si.quantity)}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn("px-3 font-medium", factCfg.className)}>{factCfg.label}</td>
                  <td className="px-3 text-right font-mono">
                    {rowShipped > 0 ? fmt(rowShipped) : shipment ? fmt(Number(shipment.quantity) || 0) : "—"}
                  </td>
                  <td className="px-3">
                    {shipmentNo ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenShipment(shipmentNo)}
                          className="flex items-center gap-1 font-mono text-primary hover:underline text-[11px]"
                        >
                          <span>{shipmentNo}</span>
                          <ExternalLink className="size-2.5" />
                        </button>
                        {actId && onOpenDeliveryAct && (
                          <button
                            type="button"
                            onClick={() => onOpenDeliveryAct(actId)}
                            className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
                            title="Schet-faktura"
                          >
                            <FileText className="size-3" />
                            <span>{actId}</span>
                          </button>
                        )}
                      </div>
                    ) : inStockFreeQty > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateShipment(batch)}
                        className="h-6 px-2 text-[11px] gap-1"
                        title={
                          inStockFreeQty < (Number(batch.quantity) || 0)
                            ? `Omborda ${fmt(inStockFreeQty)}: shu miqdor chiqim qilinadi`
                            : undefined
                        }
                      >
                        <Truck className="size-3" />
                        <span>
                          Chiqim yaratish
                          {inStockFreeQty < (Number(batch.quantity) || 0) ? ` (${fmt(inStockFreeQty)})` : ""}
                        </span>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Omborda yo&apos;q</span>
                    )}
                  </td>
                  <td className="px-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBatch(batch);
                          setIsDialogOpen(true);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Tahrirlash"
                      >
                        <Edit2 className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() => onUpdateBatches(batches.filter((b) => b.id !== batch.id))}
                        className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive disabled:opacity-30"
                        title={locked ? "Chiqim hujjati bor" : "O'chirish"}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {unplannedShipments.map((s) => {
              const fact: FactState =
                s.status === "Delivered" ? "delivered" : SHIPPED_STATUSES.has(s.status) ? "shipped" : "warehouse";
              return (
                <tr key={s.id} className="h-8 bg-muted/10">
                  <td className="px-3 text-center text-muted-foreground">—</td>
                  <td className="px-3 text-muted-foreground" colSpan={2}>
                    Rejadan tashqari
                  </td>
                  <td className="px-3 text-right font-mono text-muted-foreground">—</td>
                  <td className="px-3 text-muted-foreground">—</td>
                  <td className={cn("px-3 font-medium", FACT_LABEL[fact].className)}>{FACT_LABEL[fact].label}</td>
                  <td className="px-3 text-right font-mono">{fmt(Number(s.quantity) || 0)}</td>
                  <td className="px-3" colSpan={2}>
                    <button
                      type="button"
                      onClick={() => onOpenShipment(s.id)}
                      className="flex items-center gap-1 font-mono text-primary hover:underline text-[11px]"
                    >
                      <span>{s.id}</span>
                      <ExternalLink className="size-2.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="h-7 border-t border-border bg-muted/20 text-[11px]">
                <td className="px-3" colSpan={3}>
                  <span className="text-muted-foreground">Rejada</span>
                </td>
                <td
                  className={cn(
                    "px-3 text-right font-mono font-semibold",
                    plannedQty > totalOrderQty ? "text-destructive" : "text-foreground"
                  )}
                >
                  {fmt(plannedQty)}
                </td>
                <td className="px-3 text-muted-foreground" colSpan={5}>
                  {plannedQty < totalOrderQty
                    ? `Rejaga kiritilmagan: ${fmt(totalOrderQty - plannedQty)} ${orderUnit}`
                    : plannedQty > totalOrderQty
                    ? `Tirajdan ortiq: ${fmt(plannedQty - totalOrderQty)} ${orderUnit}`
                    : `Tiraj to'liq taqsimlangan`}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {isDialogOpen && (
        <BatchEditDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          batch={editingBatch}
          orderTotalQty={totalOrderQty}
          orderUnit={orderUnit}
          existingBatches={batches}
          sizes={formData.sizes}
          onSave={handleSaveBatch}
        />
      )}
    </TabsContent>
  );
}
