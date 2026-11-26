"use client";

import React, { useMemo, useRef, useState } from "react";
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
import { Loader2, Image as ImageIcon, Upload, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { pickFgWarehouses } from "@/components/documents/warehouse/utils/fgImport";

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

/** Rasmni brauzerda kichraytiradi (maks. 800px, JPEG) — bazada katta fayl saqlanmasligi uchun */
function compressImage(file: File, maxSide = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Rasm formati noto'g'ri"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas mavjud emas"));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const UNIT_OPTIONS = [
  { value: "pcs", label: "dona" },
  { value: "kg", label: "kg" },
  { value: "rolls", label: "rulon" },
  { value: "m²", label: "m²" },
];

/** Ishlab chiqarish siklisiz, avvaldan mavjud tayyor mahsulotni omborga to'g'ridan-to'g'ri kirim qilish */
export function FgOpeningBalanceDialog({ open, onOpenChange }: FgOpeningBalanceDialogProps) {
  const { crmCustomers, warehousesList, finishedGoods, upsertFinishedGoodAsync, loadFinishedGoods } = useWorkspaceStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const customerOptions = useMemo(
    () => (crmCustomers || []).map((c: any) => ({ value: c.name, label: c.name })),
    [crmCustomers]
  );
  const warehouseOptions = useMemo(
    () => pickFgWarehouses<any>(warehousesList || []).map((w: any) => ({ value: w.name, label: w.name })),
    [warehousesList]
  );

  const totalValue = (Number(form.quantity) || 0) * (Number(form.costPricePerUnit) || 0);
  const skuTaken = useMemo(
    () => !!form.sku.trim() && (finishedGoods || []).some((g: any) => g.sku === form.sku.trim()),
    [finishedGoods, form.sku]
  );

  const set = (key: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleClose = (next: boolean) => {
    if (!next) {
      setForm(EMPTY_FORM);
      setImageUrl("");
      setError("");
    }
    onOpenChange(next);
  };

  const handleFile = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setImageUrl(await compressImage(file));
      setError("");
    } catch (e: any) {
      setError(e?.message || "Rasmni yuklab bo'lmadi.");
    }
  };

  const handleSave = async () => {
    const qty = Number(form.quantity);
    if (!form.productName.trim()) return setError("Mahsulot nomini kiriting.");
    if (!form.customerName.trim()) return setError("Mijozni tanlang.");
    if (!(qty > 0)) return setError("Miqdor noldan katta bo'lishi kerak.");
    if (Number(form.costPricePerUnit) < 0) return setError("Tannarx manfiy bo'lishi mumkin emas.");

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
        imageUrl: imageUrl || null,
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/30">
          <DialogTitle className="text-sm font-semibold text-foreground">Boshlang&apos;ich qoldiq</DialogTitle>
        </DialogHeader>

        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) void handleSave();
          }}
        >
          <div className="sm:col-span-2 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className="size-16 shrink-0 rounded border border-dashed border-border bg-muted/30 hover:bg-muted/50 flex items-center justify-center overflow-hidden cursor-pointer"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-contain" />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground/50" />
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" />
                <span>Rasm yuklash</span>
              </Button>
              {imageUrl && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setImageUrl("")}>
                  <X className="size-3.5" />
                  <span>O&apos;chirish</span>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mijoz <span className="text-destructive">*</span></Label>
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
            <Label className="text-xs">Mahsulot nomi <span className="text-destructive">*</span></Label>
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
            <Label className="text-xs">Miqdor <span className="text-destructive">*</span></Label>
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
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Izoh</Label>
            <Input className="h-8 text-xs" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          {skuTaken && (
            <div className="sm:col-span-2 text-xs text-amber-600">
              Bu SKU omborda bor: saqlasangiz mavjud qoldiq shu miqdor bilan almashtiriladi.
            </div>
          )}
          {error && <div className="sm:col-span-2 text-xs text-destructive">{error}</div>}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>

        <DialogFooter className="px-4 py-3 border-t border-border bg-muted/20 sm:items-center">
          {totalValue > 0 && (
            <span className="mr-auto text-xs text-muted-foreground font-mono">
              Jami: {totalValue.toLocaleString()}
            </span>
          )}
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
