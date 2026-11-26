"use client";

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { Loader2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface FgOpeningBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = {
  customerName: "",
  productName: "",
  sku: "",
  quantity: "",
  unit: "pcs",
  costPricePerUnit: "",
  locationName: "",
  locationShelf: "",
  batchNo: "",
  notes: "",
};

const UNIT_OPTIONS = [
  { value: "pcs", label: "dona" },
  { value: "kg", label: "kg" },
  { value: "rolls", label: "rulon" },
  { value: "m²", label: "m²" },
];

/** Ishlab chiqarish siklisiz, avvaldan mavjud tayyor mahsulotni omborga to'g'ridan-to'g'ri kirim qilish */
export function FgOpeningBalanceDialog({ open, onOpenChange }: FgOpeningBalanceDialogProps) {
  const { crmCustomers, warehousesList, upsertFinishedGoodAsync, loadFinishedGoods } = useWorkspaceStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const customerOptions = useMemo(
    () => (crmCustomers || []).map((c: any) => ({ value: c.name, label: c.name })),
    [crmCustomers]
  );
  const warehouseOptions = useMemo(
    () =>
      (warehousesList || [])
        .filter((w: any) => !w.type || w.type === "finished_goods" || w.type === "general")
        .map((w: any) => ({ value: w.name, label: w.name })),
    [warehousesList]
  );

  const set = (key: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleClose = (next: boolean) => {
    if (!next) {
      setForm(EMPTY_FORM);
      setError("");
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    const qty = Number(form.quantity);
    if (!form.productName.trim()) return setError("Mahsulot nomini kiriting.");
    if (!form.customerName.trim()) return setError("Mijozni tanlang.");
    if (!(qty > 0)) return setError("Miqdor noldan katta bo'lishi kerak.");

    setSaving(true);
    setError("");
    try {
      const customer = (crmCustomers || []).find((c: any) => c.name === form.customerName.trim());
      const warehouse = (warehousesList || []).find((w: any) => w.name === form.locationName);
      const sku = form.sku.trim() || `FG-OB-${Date.now().toString().slice(-6)}`;
      const unitCost = Number(form.costPricePerUnit) || 0;

      const ok = await upsertFinishedGoodAsync({
        sku,
        // Boshlang'ich qoldiq SKU bo'yicha yagona: qayta kiritilsa o'sha yozuv yangilanadi
        workOrderId: `OB-${sku}`,
        productName: form.productName.trim(),
        customerName: form.customerName.trim(),
        clientId: customer?.dbId || null,
        quantity: qty,
        unit: form.unit,
        batchNo: form.batchNo.trim() || null,
        locationName: form.locationName || null,
        warehouseId: warehouse?.id || null,
        locationShelf: form.locationShelf.trim() || null,
        notes: form.notes.trim() || "Boshlang'ich qoldiq",
        receiptStatus: "Received",
        allocationStatus: "Dedicated",
        status: "In Stock",
        costPricePerUnit: unitCost,
        totalStockValue: unitCost * qty,
      });
      if (!ok) {
        setError("Saqlab bo'lmadi. Qayta urinib ko'ring.");
        return;
      }
      await loadFinishedGoods();
      handleClose(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 border-border bg-card">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/30">
          <DialogTitle className="text-sm font-semibold text-foreground">Boshlang&apos;ich qoldiq</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Mijoz</Label>
            <FieldCombobox
              value={form.customerName}
              onChange={(v) => set("customerName", v)}
              options={customerOptions}
              allowCustom
              placeholder="Tanlang"
              searchPlaceholder="Qidirish"
              emptyText="Topilmadi"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mahsulot nomi</Label>
            <Input className="h-8 text-xs" value={form.productName} onChange={(e) => set("productName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SKU</Label>
            <Input
              className="h-8 text-xs font-mono"
              placeholder="Avto"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Partiya</Label>
            <Input className="h-8 text-xs" value={form.batchNo} onChange={(e) => set("batchNo", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Miqdor</Label>
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Birlik</Label>
            <FieldCombobox
              value={form.unit}
              onChange={(v) => set("unit", v)}
              options={UNIT_OPTIONS}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tannarx (1 birlik)</Label>
            <Input
              type="number"
              min={0}
              className="h-8 text-xs font-mono"
              value={form.costPricePerUnit}
              onChange={(e) => set("costPricePerUnit", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ombor</Label>
            <FieldCombobox
              value={form.locationName}
              onChange={(v) => set("locationName", v)}
              options={warehouseOptions}
              placeholder="Tanlang"
              searchPlaceholder="Qidirish"
              emptyText="Topilmadi"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Javon</Label>
            <Input className="h-8 text-xs" value={form.locationShelf} onChange={(e) => set("locationShelf", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Izoh</Label>
            <Input className="h-8 text-xs" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          {error && <div className="col-span-2 text-xs text-destructive">{error}</div>}
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border bg-muted/20">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClose(false)} disabled={saving}>
            Bekor
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
