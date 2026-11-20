"use client";

import React, { useMemo, useState } from "react";
import { Truck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ToolingOrderRecord, SupplierOrderDeliveryMethod } from "@/lib/server/supplierService";

export const DELIVERY_METHOD_LABELS: Record<SupplierOrderDeliveryMethod, string> = {
  included: "Narxga kiritilgan",
  supplier: "Ta'minotchi yetkazdi",
  pickup: "O'zimiz olib keldik",
};

type AllocationMode = "amount" | "equal";

const ALLOCATION_LABELS: Record<AllocationMode, string> = {
  amount: "Summaga ko'ra",
  equal: "Teng",
};

export interface ToolingReceipt {
  order: ToolingOrderRecord;
  deliveryMethod: SupplierOrderDeliveryMethod;
  deliveryCost: number;
}

/**
 * Splits one delivery bill across the received orders (by order amount or equally).
 * Rounded to 2 decimals; the last order takes the rounding remainder so shares add up exactly.
 */
export function allocateDelivery(orders: ToolingOrderRecord[], total: number, mode: AllocationMode): number[] {
  if (orders.length === 0) return [];
  const amountSum = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const weights =
    mode === "amount" && amountSum > 0
      ? orders.map((o) => (Number(o.amount) || 0) / amountSum)
      : orders.map(() => 1 / orders.length);
  const shares = weights.map((w) => Math.round(total * w * 100) / 100);
  const drift = Math.round((total - shares.reduce((s, v) => s + v, 0)) * 100) / 100;
  shares[shares.length - 1] = Math.round((shares[shares.length - 1] + drift) * 100) / 100;
  return shares;
}

interface ToolingReceiveDialogProps {
  orders: ToolingOrderRecord[] | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (receipts: ToolingReceipt[]) => Promise<void>;
}

export function ToolingReceiveDialog({ orders, onOpenChange, onConfirm }: ToolingReceiveDialogProps) {
  const list = useMemo(() => orders || [], [orders]);
  const [method, setMethod] = useState<SupplierOrderDeliveryMethod>("included");
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<AllocationMode>("amount");
  // Form state resets per opening: the parent keys this component by the selected order ids
  const [saving, setSaving] = useState(false);

  const currency = list[0]?.currency || "UZS";
  const mixedCurrency = list.some((o) => (o.currency || "UZS") !== currency);
  const mixedSupplier = new Set(list.map((o) => o.supplierId)).size > 1;
  const costed = method !== "included";
  const effectiveTotal = costed ? total : 0;
  const shares = useMemo(() => allocateDelivery(list, effectiveTotal, mode), [list, effectiveTotal, mode]);

  const error =
    costed && mixedCurrency
      ? "Valyutalar har xil"
      : method === "supplier" && mixedSupplier
      ? "Ta'minotchilar har xil"
      : null;

  const fmt = (v: number) => v.toLocaleString("uz-UZ", { maximumFractionDigits: 2 });

  const handleConfirm = async () => {
    if (error || list.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(
        list.map((order, i) => ({ order, deliveryMethod: method, deliveryCost: costed ? shares[i] || 0 : 0 }))
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(orders)} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            <span>Qabul qilish · {list.length} ta</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-5 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Yetkazib berish</Label>
              <Select
                value={method}
                onValueChange={(val) => setMethod(((val as SupplierOrderDeliveryMethod) || "included"))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue>{(val) => DELIVERY_METHOD_LABELS[(val as SupplierOrderDeliveryMethod) || "included"]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DELIVERY_METHOD_LABELS) as SupplierOrderDeliveryMethod[]).map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {DELIVERY_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-4 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Dostavka ({currency})</Label>
              <MoneyInput
                thousandSeparator=" "
                decimalScale={2}
                disabled={!costed}
                value={effectiveTotal}
                onValueChange={(values) => setTotal(values.floatValue ?? 0)}
                className="h-8 text-xs font-mono bg-background"
              />
            </div>

            <div className="col-span-3 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Taqsimlash</Label>
              <Select
                value={mode}
                disabled={!costed || list.length < 2}
                onValueChange={(val) => setMode(((val as AllocationMode) || "amount"))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue>{(val) => ALLOCATION_LABELS[(val as AllocationMode) || "amount"]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ALLOCATION_LABELS) as AllocationMode[]).map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {ALLOCATION_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                <tr className="h-7">
                  <th className="px-2 text-left font-medium">PO №</th>
                  <th className="px-2 text-left font-medium">Jihoz</th>
                  <th className="px-2 text-right font-medium">Summa</th>
                  <th className="px-2 text-right font-medium">Dostavka</th>
                  <th className="px-2 text-right font-medium">Tannarx</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o, i) => {
                  const share = costed ? shares[i] || 0 : 0;
                  return (
                    <tr key={o.id} className="h-7 border-t border-border">
                      <td className="px-2 font-mono text-[11px]">{o.orderNo}</td>
                      <td className="px-2 truncate max-w-[220px]" title={o.title}>
                        {o.title}
                      </td>
                      <td className="px-2 text-right font-mono">{fmt(o.amount || 0)}</td>
                      <td className="px-2 text-right font-mono text-muted-foreground">{fmt(share)}</td>
                      <td className="px-2 text-right font-mono font-semibold">{fmt((o.amount || 0) + share)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-destructive">
              <AlertTriangle className="size-3.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={saving} onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" disabled={saving || Boolean(error)} onClick={handleConfirm}>
            <Truck className="size-3.5" />
            <span>Qabul qilish</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
