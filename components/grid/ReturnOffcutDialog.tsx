"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Scissors, Check, PackagePlus, AlertCircle, ArrowRight } from "lucide-react";

interface ReturnOffcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMON_OFFCUT_SIZES = ["470×700", "350×700", "500×700", "320×450", "250×700"];

export function ReturnOffcutDialog({ open, onOpenChange }: ReturnOffcutDialogProps) {
  const { warehouseStock, productionQueue, returnOffcutToStock } = useWorkspaceStore();

  // Filter paper substrates that can be cut
  const paperSubstrates = useMemo(() => {
    return warehouseStock.filter(
      (s) => s.category === "Paper & Board" && !s.isOffcut
    );
  }, [warehouseStock]);

  const [selectedParentSku, setSelectedParentSku] = useState<string>(
    paperSubstrates[0]?.sku || "MAT-1010"
  );
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>(
    productionQueue[0]?.id || "WO-00351"
  );
  const [cutDimensions, setCutDimensions] = useState<string>("470×700");
  const [quantity, setQuantity] = useState<string>("850");
  const [location, setLocation] = useState<string>("Rack A-01-B (Offcuts / Qoldiqlar zonasi)");
  const [operator, setOperator] = useState<string>("D. Karimov (Ombor mudiri)");

  const parentMaterial = useMemo(() => {
    return warehouseStock.find((s) => s.sku === selectedParentSku);
  }, [warehouseStock, selectedParentSku]);

  // Estimate unit price based on area proportion if parent sheetFormat is known
  const estimatedUnitPrice = useMemo(() => {
    if (!parentMaterial?.unitPriceUsd) return 0.12;
    const parentDims = parentMaterial.sheetFormat?.split("×") || ["700", "1000"];
    const parentArea = (parseFloat(parentDims[0]) || 700) * (parseFloat(parentDims[1]) || 1000);
    const cutDims = cutDimensions.split("×");
    const cutArea = (parseFloat(cutDims[0]) || 470) * (parseFloat(cutDims[1]) || 700);
    const ratio = Math.min(1, Math.max(0.1, cutArea / Math.max(1, parentArea)));
    return Number((parentMaterial.unitPriceUsd * ratio).toFixed(3));
  }, [parentMaterial, cutDimensions]);

  const offcutSku = `${selectedParentSku}-OFF`;
  const offcutName = `${parentMaterial?.name || "Paper Substrate"} (${cutDimensions}) [Delovoy otxod]`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0 || !parentMaterial) return;

    returnOffcutToStock({
      parentSku: parentMaterial.sku,
      parentName: parentMaterial.name,
      cutDimensions: cutDimensions.trim(),
      quantity: qty,
      unit: parentMaterial.unit || "sheets",
      location: location.trim(),
      workOrderId: selectedWorkOrder,
      operator: operator.trim(),
      unitPriceUsd: estimatedUnitPrice,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border border-border shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <DialogHeader className="p-4 bg-muted/40 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Scissors className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold tracking-tight">
                  Kesimdan qolgan qog'ozni kirim qilish (Delovoy Otxod)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Katta formatli qog'ozdan kesilgandan keyingi yaroqli qoldiqlarni omborga kirim qilish
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Form Content */}
          <div className="p-4 space-y-3.5 text-xs">
            {/* Parent substrate selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  Asosiy kesilgan qog'oz (Parent Substrate):
                </Label>
                {parentMaterial && (
                  <span className="text-[11px] text-muted-foreground">
                    Zaxirada: <b className="text-foreground">{parentMaterial.available.toLocaleString()}</b> {parentMaterial.unit}
                  </span>
                )}
              </div>
              <Select
                value={selectedParentSku}
                onValueChange={(val) => {
                  if (val) setSelectedParentSku(val);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Qog'oz xomashyosini tanlang..." />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {paperSubstrates.map((s) => (
                    <SelectItem key={s.sku} value={s.sku} className="text-xs">
                      {s.sku} — {s.name} ({s.sheetFormat || "700×1000"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Work order and dimensions grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Buyurtma (Work Order):
                </Label>
                <Select
                  value={selectedWorkOrder}
                  onValueChange={(val) => {
                    if (val) setSelectedWorkOrder(val);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Buyurtmani tanlang..." />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {productionQueue.map((wo) => (
                      <SelectItem key={wo.id} value={wo.id} className="text-xs">
                        {wo.id} — {wo.product}
                      </SelectItem>
                    ))}
                    <SelectItem value="WO-DIRECT" className="text-xs">
                      Boshqa / Sexning to'g'ridan-to'g'ri kesimi
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Qoldiq o'lchami (Format / mm):
                </Label>
                <Input
                  value={cutDimensions}
                  onChange={(e) => setCutDimensions(e.target.value)}
                  placeholder="masalan: 470×700"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Quick Dimension Presets */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-muted-foreground">Tezkor formatlar:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {COMMON_OFFCUT_SIZES.map((size) => (
                  <button
                    type="button"
                    key={size}
                    onClick={() => setCutDimensions(size)}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-mono border transition-colors ${
                      cutDimensions === size
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="my-1" />

            {/* Quantity and Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Kirim miqdori (Qoldiq soni):
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-8 text-xs font-mono pr-12"
                    required
                  />
                  <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">
                    {parentMaterial?.unit || "varaq"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Ombordagi saqlash joyi:
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            {/* Operator & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Mas'ul shaxs (Gilotina ustasi / Operator):
                </Label>
                <Input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Hisoblangan tannarx (1 varaq):
                </Label>
                <div className="h-8 px-2.5 rounded border border-border bg-muted/40 flex items-center justify-between font-mono text-xs text-foreground">
                  <span>${estimatedUnitPrice} USD</span>
                  <span className="text-[10px] text-muted-foreground">
                    Jami: ${(estimatedUnitPrice * (parseInt(quantity, 10) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Registration Preview Card */}
            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/25 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <PackagePlus className="size-3.5" />
                  Kirim qilinadigan Nomenklatura:
                </span>
                <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                  {offcutSku}
                </Badge>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 font-mono truncate">
                {offcutName}
              </p>
              <p className="text-[10px] text-muted-foreground pt-0.5">
                Ushbu qoldiq avtomatik ravishda <b>"Delovoy Otxodlar"</b> toifasiga o'tkaziladi. Kelgusi buyurtmalarda hisobchilar yangi qog'oz kesmasdan shu o'lchamdan foydalanishlari mumkin.
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-3 bg-muted/40 border-t border-border flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs gap-1.5 shadow-none"
            >
              <Check className="size-3.5" />
              <span>Omborga kirim qilish (Post & Receive)</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
