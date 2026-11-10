"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SmartCombobox, type ComboboxItem } from "@/components/ui/smart-combobox";
import {
  Truck,
  Building2,
  Phone,
  Mail,
  User,
  CreditCard,
  FileText,
  Trash2,
  Save,
  Tag,
  Upload,
  Loader2,
} from "lucide-react";
import type { SupplierRecord, SupplierCategory } from "@/lib/server/supplierService";

export const SUPPLIER_CATEGORY_LABELS: Record<
  SupplierCategory,
  { label: string; dot: string; badge: string }
> = {
  raw_materials: {
    label: "Qog'oz & Karton",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  cmyk_inks: {
    label: "Bo'yoq, Lak & Kimyo",
    dot: "bg-cyan-500",
    badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
  ctp_prepress: {
    label: "CTP Metall Forma",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  die_tooling: {
    label: "Shtamp & Pichoq Qoliplari",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  cliche_stamping: {
    label: "Folga & Kongrev Klishe",
    dot: "bg-purple-500",
    badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  outsourcing: {
    label: "Autsorsing (Pardozlash)",
    dot: "bg-orange-500",
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  logistics: {
    label: "Logistika & Kuryer",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  },
  spare_parts: {
    label: "Ehtiyot qismlar & Servis",
    dot: "bg-zinc-500",
    badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  },
  other: {
    label: "Boshqa ta'minot",
    dot: "bg-slate-500",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
};

interface SupplierDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierRecord | null;
  onSave: (supplier: Partial<SupplierRecord>) => void;
  onDelete?: (id: string) => void;
}

export function SupplierDetailModal({
  open,
  onOpenChange,
  supplier,
  onSave,
  onDelete,
}: SupplierDetailModalProps) {
  const [form, setForm] = useState<Partial<SupplierRecord>>({
    code: "",
    name: "",
    legalName: "",
    category: "raw_materials",
    tin: "",
    contactPerson: "",
    phone: "",
    email: "",
    bankName: "",
    bankAccount: "",
    mfo: "",
    paymentTerms: "",
    address: "",
    notes: "",
    logoUrl: "",
    status: "Active",
  });

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (supplier) {
      setForm(supplier);
    } else {
      setForm({
        code: "",
        name: "",
        legalName: "",
        category: "raw_materials",
        tin: "",
        contactPerson: "",
        phone: "",
        email: "",
        bankName: "",
        bankAccount: "",
        mfo: "",
        paymentTerms: "100% Shartnoma bo'yicha",
        address: "",
        notes: "",
        logoUrl: "",
        status: "Active",
      });
    }
  }, [supplier, open]);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", form.id || "");

      const res = await fetch("/api/v1/crm/suppliers/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setForm((prev) => ({ ...prev, logoUrl: data.url }));
      } else {
        alert(data.error || "Rasm yuklashda xatolik yuz berdi");
      }
    } catch {
      alert("Rasm yuklashda xatolik yuz berdi");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isNew = !supplier || !supplier.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  const catConfig =
    SUPPLIER_CATEGORY_LABELS[form.category as SupplierCategory] ||
    SUPPLIER_CATEGORY_LABELS.raw_materials;

  const categoryOptions: ComboboxItem[] = Object.entries(SUPPLIER_CATEGORY_LABELS).map(
    ([k, v]) => ({
      value: k,
      label: v.label,
      dot: v.dot,
    })
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:border-primary/60 transition-colors relative group"
                title="Rasm yuklash yoki almashtirish"
              >
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt={form.name || "Ta'minotchi"}
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : (
                  <Truck className="w-5 h-5 text-primary" />
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {isNew ? "Yangi ta'minotchi / Hamkor qo'shish" : form.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {form.code || "Yangi ta'minotchi"}
                  </span>
                  <Badge variant="outline" className={catConfig.badge}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${catConfig.dot}`} />
                    {catConfig.label}
                  </Badge>
                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logoUrl: "" }))}
                      className="text-[10px] text-destructive hover:underline ml-1 cursor-pointer"
                    >
                      Rasmni o&apos;chirish
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Asosiy ma'lumotlar */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Korxona nomi (Qisqa / Brend)*</Label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm"
                  placeholder="Masalan: LaserDie Formats MChJ"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Faoliyat toifasi*</Label>
              <SmartCombobox
                value={form.category}
                onChange={(val) =>
                  setForm({ ...form, category: val as SupplierCategory })
                }
                options={categoryOptions}
                placeholder="Toifani tanlang..."
                searchPlaceholder="Toifa bo'yicha qidirish..."
                allowCustom={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">STIR (INN)</Label>
              <Input
                className="font-mono text-sm"
                placeholder="Masalan: 308112233"
                value={form.tin || ""}
                onChange={(e) => setForm({ ...form, tin: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rasmiy yuridik nomi</Label>
              <Input
                className="text-sm"
                placeholder="OOO «LASER DIE FORMATS»"
                value={form.legalName || ""}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              />
            </div>
          </div>

          {/* Aloqa */}
          <div className="border-t pt-3 grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mas'ul shaxs (Menejer)</Label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm"
                  placeholder="Masalan: Nodirbek"
                  value={form.contactPerson || ""}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Telefon raqami</Label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <PhoneInput
                  className="h-8 pl-8 text-xs font-mono"
                  placeholder="+998 90 123-45-67"
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email manzili</Label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm"
                  placeholder="info@laserdie.uz"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Bank va shartlar */}
          <div className="border-t pt-3 grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bank nomi</Label>
              <Input
                className="text-sm"
                placeholder="Kapitalbank ATB"
                value={form.bankName || ""}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hisob-raqam (R/s)</Label>
              <Input
                className="font-mono text-sm"
                placeholder="20208000..."
                value={form.bankAccount || ""}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To'lov shartlari</Label>
              <Input
                className="text-sm"
                placeholder="50% Avans / 50% Qabulda"
                value={form.paymentTerms || ""}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              />
            </div>
          </div>

          {/* Izohlar */}
          <div className="space-y-1.5">
            <Label className="text-xs">Manzil va qo'shimcha izohlar</Label>
            <Textarea
              className="text-sm"
              rows={2}
              placeholder="Ustaxona manzili, CTP plastinalar o'lchami yoki yetkazib berish shartlari..."
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
            {!isNew && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Ushbu ta'minotchini o'chirmoqchimisiz?")) {
                    onDelete(form.id!);
                    onOpenChange(false);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                O'chirish
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" size="sm">
                <Save className="w-4 h-4 mr-1.5" />
                Saqlash
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
