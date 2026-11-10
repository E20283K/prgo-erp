"use client";

import React, { useMemo, useState, useRef } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SmartCombobox, type ComboboxItem } from "@/components/ui/smart-combobox";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Phone,
  Mail,
  User,
  CreditCard,
  MapPin,
  Scale,
  Landmark,
  UserCheck,
  ShieldAlert,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  SUPPLIER_CATEGORY_LABELS,
} from "@/components/crm/SupplierDetailModal";
import type { SupplierRecord, SupplierCategory } from "@/lib/server/supplierService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { LinkedTelegramGroupCard } from "@/components/documents/common/LinkedTelegramGroupCard";

const SUPPLIER_CATEGORY_DESCRIPTIONS: Record<SupplierCategory, string> = {
  raw_materials: "Melovanniy qog'oz, karton, o'z-o'zidan yopishqoq va rulon xomashyo",
  cmyk_inks: "CMYK/Pantone bo'yoqlar, UF/suvli lak va bosma kimyosi",
  ctp_prepress: "Ofset bosma uchun CTP alyuminiy formalar",
  die_tooling: "Kesish shtamplari, bigovka chizg'ichlari va pichoq qoliplari",
  cliche_stamping: "Issiq folga bosish va kongrev bo'rttirma klishelari",
  outsourcing: "Tashqi laminatsiya, UF laklash, muqovalash va tikish",
  logistics: "Yuk tashish, ekspeditorlik va kuryerlik xizmati",
  spare_parts: "Poligrafiya dastgohlari ehtiyot qismlari va texnik servis",
  other: "Yordamchi materiallar va umumiy ta'minot",
};

const SUPPLIER_STATUS_OPTIONS: ComboboxItem[] = [
  {
    value: "Active",
    label: "Faol",
    dot: "bg-emerald-500",
    description: "Doimiy hamkorlikdagi ta'minotchi",
  },
  {
    value: "Blocked",
    label: "Bloklangan",
    dot: "bg-rose-500",
    description: "Stop-list — buyurtma va to'lovlar cheklangan",
  },
  {
    value: "Archived",
    label: "Arxiv",
    dot: "bg-zinc-400",
    description: "Faoliyati to'xtatilgan ta'minotchi",
  },
];

const SUPPLIER_CURRENCY_OPTIONS: ComboboxItem[] = [
  {
    value: "UZS",
    label: "O'zbekiston so'mi",
    code: "UZS",
  },
  {
    value: "USD",
    label: "AQSH dollari",
    code: "USD",
  },
];

interface SupplierOverviewTabProps {
  supplier: SupplierRecord;
  onChange: (updated: Partial<SupplierRecord>) => void;
  financials?: {
    openingBalance?: number;
    totalCredit: number; // Jami Kirim / Yetkazilgan (+Kt)
    totalDebit: number;  // Jami To'langan (-Dt)
    closingBalance: number;
  };
  onNavigateTab?: (tabId: string) => void;
  onOpenPaymentModal?: () => void;
}

export function SupplierOverviewTab({
  supplier,
  onChange,
  financials,
  onNavigateTab,
  onOpenPaymentModal,
}: SupplierOverviewTabProps) {
  const { addNotification } = useWorkspaceStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      "image/gif",
    ];
    if (!allowed.includes(file.type)) {
      addNotification({
        title: "Xatolik",
        description: "Faqat PNG, JPG, WebP yoki SVG rasmlari qabul qilinadi.",
        severity: "error",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addNotification({
        title: "Xatolik",
        description: "Rasm hajmi 5MB dan oshmasligi kerak.",
        severity: "error",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", supplier.id || "");

      const res = await fetch("/api/v1/crm/suppliers/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Rasmni yuklab bo'lmadi");
      }

      onChange({ logoUrl: data.url });
      addNotification({
        title: "Rasm yuklandi",
        description: "Ta'minotchi rasmi muvaffaqiyatli saqlandi.",
        severity: "success",
      });
    } catch (err: any) {
      addNotification({
        title: "Yuklashda xatolik",
        description: err.message || "Rasmni serverga yuklashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    const currentLogo = supplier.logoUrl;
    setIsUploadingLogo(true);
    try {
      onChange({ logoUrl: "" });
      if (currentLogo) {
        await fetch(
          `/api/v1/crm/suppliers/logo?supplierId=${encodeURIComponent(supplier.id || "")}&logoUrl=${encodeURIComponent(currentLogo)}`,
          { method: "DELETE" }
        );
      }
      addNotification({
        title: "Rasm o'chirildi",
        severity: "info",
      });
    } catch (err: any) {
      console.warn("Failed to delete supplier logo on server:", err);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const catConfig =
    SUPPLIER_CATEGORY_LABELS[supplier.category as SupplierCategory] ||
    SUPPLIER_CATEGORY_LABELS.raw_materials;

  const categoryOptions = useMemo<ComboboxItem[]>(() => {
    return (Object.entries(SUPPLIER_CATEGORY_LABELS) as [
      SupplierCategory,
      { label: string; dot: string; badge: string }
    ][]).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
      dot: cfg.dot,
      description: SUPPLIER_CATEGORY_DESCRIPTIONS[key],
    }));
  }, []);

  const curr = supplier.currency || "UZS";
  const fmtMoney = (val: number) => new Intl.NumberFormat("uz-UZ").format(val);

  const openingBalance = financials?.openingBalance ?? (supplier.openingBalance || 0);
  const totalCredit = financials?.totalCredit ?? 0;
  const totalDebit = financials?.totalDebit ?? 0;
  const closingBalance = financials?.closingBalance ?? (supplier.currentBalance || 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Blocked / Warning Banner if applicable */}
      {supplier.status === "Blocked" && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-bold">DIQQAT: Ushbu ta&apos;minotchi BLOKLANGAN!</span>{" "}
            <span>
              Yangi buyurtmalar va to&apos;lovlar to&apos;xtatilgan. Rahbariyat ruxsatisiz xarid amalga oshirilmaydi.
            </span>
          </div>
        </div>
      )}

      {/* 1. Live Financial KPI Strip (1C Standard) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Boshlang&apos;ich qoldiq
            </div>
            <div className="font-mono text-base font-bold mt-0.5">
              {fmtMoney(openingBalance)} {curr}
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {curr}
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Jami yetkazilgan (+Kt)
            </div>
            <div className="font-mono text-base font-bold text-primary mt-0.5">
              +{fmtMoney(totalCredit)} {curr}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Fakturalar
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Jami to&apos;langan (-Dt)
            </div>
            <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              -{fmtMoney(totalDebit)} {curr}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Bank / Naqd
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-md p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Yakuniy saldo
            </div>
            <div
              className={`font-mono text-base font-bold mt-0.5 ${
                closingBalance > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : closingBalance < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {fmtMoney(Math.abs(closingBalance))} {curr}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {closingBalance > 0
                ? "Bizning qarzimiz"
                : closingBalance < 0
                ? "Bizning avansimiz"
                : "Hisob yopilgan"}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {onNavigateTab && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigateTab("settlements")}
                className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
              >
                <Scale className="w-3 h-3 text-primary" />
                <span>Akt sverka</span>
              </Button>
            )}
            {onOpenPaymentModal && (
              <Button
                size="sm"
                onClick={onOpenPaymentModal}
                className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer"
              >
                <CreditCard className="w-3 h-3" />
                <span>To&apos;lov</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. High-Density 3-Column Enterprise Form Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Column 1: Yuridik va Identifikatsiya */}
        <div className="bg-card border border-border rounded-md p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-xs text-foreground">
                Korxona rekvizitlari
              </span>
            </div>
            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${catConfig.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${catConfig.dot}`} />
              {catConfig.label}
            </Badge>
          </div>

          {/* Ta'minotchi rasmi / Logotipi (Upload Box) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingLogo(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingLogo(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingLogo(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleLogoUpload(file);
            }}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-md border bg-muted/30 transition-colors",
              isDraggingLogo ? "border-primary bg-primary/5" : "border-border"
            )}
          >
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
              className="relative w-14 h-14 rounded-md border border-border bg-background flex items-center justify-center shrink-0 cursor-pointer overflow-hidden group hover:border-primary/60 transition-colors"
              title="Rasm yuklash yoki almashtirish"
            >
              {supplier.logoUrl ? (
                <img
                  src={supplier.logoUrl}
                  alt={supplier.name || "Ta'minotchi rasmi"}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Building2 className="w-6 h-6 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
              )}
              {isUploadingLogo && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Ta&apos;minotchi rasmi
                </span>
                {supplier.logoUrl && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1.5 text-emerald-600 dark:text-emerald-400 font-normal"
                  >
                    Yuklangan
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                PNG, JPG, WebP yoki SVG (maks. 5MB)
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-primary" />
                  <span>{supplier.logoUrl ? "O'zgartirish" : "Rasm yuklash"}</span>
                </Button>
                {supplier.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isUploadingLogo}
                    onClick={handleDeleteLogo}
                    className="h-6 px-1.5 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>O&apos;chirish</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Ta&apos;minotchi nomi *
            </Label>
            <Input
              value={supplier.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="h-8 text-xs font-medium bg-background"
              placeholder="Masalan: LaserDie Formats MChJ"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Faoliyat toifasi *
            </Label>
            <SmartCombobox
              value={supplier.category}
              onChange={(val) => {
                if (val) onChange({ category: val as SupplierCategory });
              }}
              options={categoryOptions}
              placeholder="Toifani tanlang..."
              searchPlaceholder="Toifa bo'yicha qidirish..."
              allowCustom={false}
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              STIR raqami
            </Label>
            <Input
              value={supplier.tin || ""}
              onChange={(e) => onChange({ tin: e.target.value })}
              className="h-8 text-xs font-mono bg-background"
              placeholder="308112233"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Rasmiy yuridik nomi
            </Label>
            <Input
              value={supplier.legalName || ""}
              onChange={(e) => onChange({ legalName: e.target.value })}
              className="h-8 text-xs bg-background"
              placeholder="OOO «LASER DIE FORMATS»"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Ta&apos;minotchi maqomi
            </Label>
            <SmartCombobox
              value={supplier.status}
              onChange={(val) => {
                if (val) onChange({ status: val as SupplierRecord["status"] });
              }}
              options={SUPPLIER_STATUS_OPTIONS}
              placeholder="Maqomni tanlang"
              searchable={false}
              allowCustom={false}
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Column 2: Bank va Hisob-kitob */}
        <div className="bg-card border border-border rounded-md p-3.5 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              Bank va moliya
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Xizmat ko&apos;rsatuvchi bank
            </Label>
            <div className="relative">
              <Landmark className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={supplier.bankName || ""}
                onChange={(e) => onChange({ bankName: e.target.value })}
                className="h-8 pl-8 text-xs bg-background"
                placeholder="Kapitalbank ATB Toshkent sh."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Hisob raqami (20 xonali)
            </Label>
            <Input
              value={supplier.bankAccount || ""}
              onChange={(e) => onChange({ bankAccount: e.target.value })}
              className="h-8 text-xs font-mono bg-background"
              placeholder="20208000405501234001"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              MFO kodi
            </Label>
            <Input
              value={supplier.mfo || ""}
              onChange={(e) => onChange({ mfo: e.target.value })}
              className="h-8 text-xs font-mono bg-background"
              placeholder="00440"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Hisob-kitob valyutasi
            </Label>
            <SmartCombobox
              value={supplier.currency || "UZS"}
              onChange={(val) => {
                if (val) onChange({ currency: val });
              }}
              options={SUPPLIER_CURRENCY_OPTIONS}
              placeholder="Valyuta"
              searchable={false}
              allowCustom={false}
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Boshlang&apos;ich qoldiq
            </Label>
            <Input
              type="number"
              value={supplier.openingBalance ?? 0}
              onChange={(e) => onChange({ openingBalance: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs font-mono bg-background"
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              To&apos;lov shartlari
            </Label>
            <Input
              value={supplier.paymentTerms || ""}
              onChange={(e) => onChange({ paymentTerms: e.target.value })}
              className="h-8 text-xs bg-background"
              placeholder="50% Avans / 50% Ish topshirilgach"
            />
          </div>
        </div>

        {/* Column 3: Mas'ul Shaxslar & Manzil */}
        <div className="bg-card border border-border rounded-md p-3.5 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              Aloqa va manzil
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Mas&apos;ul shaxs
            </Label>
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={supplier.contactPerson || ""}
                onChange={(e) => onChange({ contactPerson: e.target.value })}
                className="h-8 pl-8 text-xs bg-background"
                placeholder="Nodirbek (Qolip bo'yicha usta)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Telefon raqami
            </Label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <PhoneInput
                value={supplier.phone || ""}
                onChange={(e) => onChange({ phone: e.target.value })}
                className="h-8 pl-8 text-xs font-mono bg-background"
                placeholder="+998 90 123-45-67"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Email / Telegram
            </Label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={supplier.email || ""}
                onChange={(e) => onChange({ email: e.target.value })}
                className="h-8 pl-8 text-xs bg-background"
                placeholder="info@laserdie.uz / @manager"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Manzil
            </Label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={supplier.address || ""}
                onChange={(e) => onChange({ address: e.target.value })}
                className="h-8 pl-8 text-xs bg-background"
                placeholder="Toshkent sh., Chilonzor tumani, 2-mavze"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Qo&apos;shimcha izohlar
            </Label>
            <Textarea
              value={supplier.notes || ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={2}
              placeholder="CTP parametrlar, pichoq balandliklari, yetkazib berish vaqtlari..."
              className="text-xs bg-background resize-none min-h-[58px]"
            />
          </div>
        </div>
      </div>

      {/* Telegram Guruh Bloki */}
      <LinkedTelegramGroupCard
        entityType="supplier"
        entityId={supplier.id}
        entityName={supplier.name}
      />
    </div>
  );
}
