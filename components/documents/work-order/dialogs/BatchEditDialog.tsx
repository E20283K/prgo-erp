"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Calendar,
  Layers,
  MapPin,
  FileText,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WorkOrderDeliveryBatch,
  DeliveryBatchStatus,
  DeliveryBatchSizeItem,
  SizeDistribution,
} from "../types";

interface BatchEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  batch: WorkOrderDeliveryBatch | null;
  orderTotalQty: number;
  orderUnit: string;
  existingBatches: WorkOrderDeliveryBatch[];
  sizes?: SizeDistribution[];
  onSave: (batch: WorkOrderDeliveryBatch) => void;
}

const STATUS_OPTIONS: { value: DeliveryBatchStatus; label: string }[] = [
  { value: "scheduled", label: "Rejalashtirilgan" },
  { value: "in_production", label: "Ishlab chiqarilmoqda" },
  { value: "ready", label: "Tayyor (Omborda)" },
  { value: "dispatched", label: "Jo'natilgan" },
  { value: "delivered", label: "Yetkazib berildi" },
];

export function BatchEditDialog({
  isOpen,
  onOpenChange,
  batch,
  orderTotalQty,
  orderUnit,
  existingBatches,
  sizes = [],
  onSave,
}: BatchEditDialogProps) {
  const isEditing = !!batch;

  const [batchNo, setBatchNo] = useState<number>(1);
  const [title, setTitle] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(0);
  const [status, setStatus] = useState<DeliveryBatchStatus>("scheduled");
  const [destination, setDestination] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [sizeItems, setSizeItems] = useState<DeliveryBatchSizeItem[]>([]);

  // Other batches total quantity (excluding current if editing)
  const otherBatchesQty = useMemo(() => {
    return existingBatches
      .filter((b) => !isEditing || b.id !== batch?.id)
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [existingBatches, isEditing, batch]);

  const remainingOrderQty = Math.max(0, orderTotalQty - otherBatchesQty);

  useEffect(() => {
    if (!isOpen) return;

    if (batch) {
      setBatchNo(batch.batchNo);
      setTitle(batch.title || `Partiya #${batch.batchNo}`);
      setTargetDate(batch.targetDate || new Date().toISOString().split("T")[0]);
      setQuantity(batch.quantity || 0);
      setStatus(batch.status || "scheduled");
      setDestination(batch.destination || "");
      setNotes(batch.notes || "");

      if (sizes.length > 0) {
        const initialSizeItems = sizes.map((s) => {
          const found = (batch.sizeItems || []).find((si) => si.sizeId === s.id);
          return {
            sizeId: s.id,
            sizeName: s.size,
            quantity: found ? found.quantity : 0,
          };
        });
        setSizeItems(initialSizeItems);
      } else {
        setSizeItems([]);
      }
    } else {
      const nextNo =
        existingBatches.length > 0
          ? Math.max(...existingBatches.map((b) => b.batchNo || 0)) + 1
          : 1;
      setBatchNo(nextNo);
      setTitle(`Partiya #${nextNo}`);
      setTargetDate(new Date().toISOString().split("T")[0]);
      setQuantity(remainingOrderQty);
      setStatus("scheduled");
      setDestination("");
      setNotes("");

      if (sizes.length > 0) {
        // Proportionally suggest size quantities based on remaining order qty
        const totalSizesQty = sizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        const ratio = totalSizesQty > 0 ? remainingOrderQty / totalSizesQty : 0;
        const initialSizeItems = sizes.map((s) => ({
          sizeId: s.id,
          sizeName: s.size,
          quantity: Math.round((Number(s.quantity) || 0) * ratio),
        }));
        setSizeItems(initialSizeItems);
      } else {
        setSizeItems([]);
      }
    }
  }, [isOpen, batch, sizes, existingBatches, remainingOrderQty]);

  const handleSizeQtyChange = (sizeId: string, val: number) => {
    const updated = sizeItems.map((si) =>
      si.sizeId === sizeId ? { ...si, quantity: Math.max(0, val) } : si
    );
    setSizeItems(updated);
    const sum = updated.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    setQuantity(sum);
  };

  const handleProportionalSizes = () => {
    if (!sizes.length || quantity <= 0) return;
    const totalSizesOriginal = sizes.reduce(
      (sum, s) => sum + (Number(s.quantity) || 0),
      0
    );
    if (totalSizesOriginal <= 0) return;

    let distributed = 0;
    const updated = sizes.map((s, idx) => {
      if (idx === sizes.length - 1) {
        const lastQty = Math.max(0, quantity - distributed);
        return { sizeId: s.id, sizeName: s.size, quantity: lastQty };
      }
      const q = Math.round(((Number(s.quantity) || 0) / totalSizesOriginal) * quantity);
      distributed += q;
      return { sizeId: s.id, sizeName: s.size, quantity: q };
    });
    setSizeItems(updated);
  };

  const handleSave = () => {
    const finalBatch: WorkOrderDeliveryBatch = {
      id: batch?.id || `batch-${Date.now()}-${batchNo}`,
      batchNo,
      title: title.trim() || `Partiya #${batchNo}`,
      targetDate: targetDate || new Date().toISOString().split("T")[0],
      quantity: Number(quantity) || 0,
      status,
      sizeItems: sizes.length > 0 ? sizeItems : undefined,
      destination: destination.trim() || undefined,
      notes: notes.trim() || undefined,
      linkedShipmentId: batch?.linkedShipmentId,
      linkedShipmentNo: batch?.linkedShipmentNo,
      dispatchedAt: batch?.dispatchedAt,
      dispatchedQty: batch?.dispatchedQty,
    };

    onSave(finalBatch);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 gap-3 bg-card border-border">
        <DialogHeader className="p-0 space-y-1">
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-semibold">
              {isEditing ? "Partiyani tahrirlash" : "Yangi partiya qo'shish"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          {/* Row 1: Batch No & Title */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Partiya #</Label>
              <Input
                type="number"
                min={1}
                value={batchNo}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setBatchNo(val);
                  if (!isEditing || title.startsWith("Partiya #")) {
                    setTitle(`Partiya #${val}`);
                  }
                }}
                className="h-8 text-xs font-mono font-semibold"
              />
            </div>
            <div className="col-span-8 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nomi</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Partiya #1"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Row 2: Target Date & Status */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6 space-y-1">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground" />
                Muddati
              </Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-6 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Holati</Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as DeliveryBatchStatus)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Quantity */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Layers className="size-3 text-muted-foreground" />
                Miqdor ({orderUnit})
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Buyurtma qoldig&apos;i: {remainingOrderQty.toLocaleString()} {orderUnit}
              </span>
            </div>
            <Input
              type="number"
              min={1}
              value={quantity || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setQuantity(val);
              }}
              className="h-8 text-xs font-mono font-semibold"
              placeholder="0"
            />
          </div>

          {/* Optional Size Matrix Breakdown */}
          {sizes.length > 0 && (
            <div className="space-y-1.5 p-2 rounded border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground">
                  Razmerlar taqsimoti
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleProportionalSizes}
                  className="h-6 px-1.5 text-[10px] text-primary gap-1"
                >
                  <Percent className="size-3" />
                  Proporsional
                </Button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1">
                <div className="grid grid-cols-12 text-[10px] font-medium text-muted-foreground px-1">
                  <span className="col-span-5">Razmer</span>
                  <span className="col-span-3 text-right">Jami</span>
                  <span className="col-span-4 text-right">Ushbu partiya</span>
                </div>
                {sizes.map((s) => {
                  const currentSizeVal =
                    sizeItems.find((si) => si.sizeId === s.id)?.quantity || 0;
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-12 items-center gap-1 px-1 py-0.5 rounded bg-card border border-border/50 text-[11px]"
                    >
                      <span className="col-span-5 font-mono truncate">{s.size}</span>
                      <span className="col-span-3 text-right font-mono text-muted-foreground">
                        {(Number(s.quantity) || 0).toLocaleString()}
                      </span>
                      <div className="col-span-4 flex justify-end">
                        <Input
                          type="number"
                          min={0}
                          value={currentSizeVal || ""}
                          onChange={(e) =>
                            handleSizeQtyChange(s.id, parseInt(e.target.value) || 0)
                          }
                          className="h-6 w-20 text-[11px] font-mono text-right p-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destination */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3 text-muted-foreground" />
              Yetkazib berish manzili
            </Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Masalan: Asosiy ombor / Manzil"
              className="h-8 text-xs"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <FileText className="size-3 text-muted-foreground" />
              Izoh
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Partiya bo'yicha qo'shimcha shartlar..."
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="p-0 gap-2 mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Bekor qilish
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={quantity <= 0}
            className="h-8 text-xs"
          >
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
