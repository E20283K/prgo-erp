"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Phone,
  Mail,
  User,
  CreditCard,
  MapPin,
  FileText,
  Scale,
  Landmark,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import {
  SUPPLIER_CATEGORY_LABELS,
} from "@/components/crm/SupplierDetailModal";
import type { SupplierRecord, SupplierCategory } from "@/lib/server/supplierService";

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
  const catConfig =
    SUPPLIER_CATEGORY_LABELS[supplier.category as SupplierCategory] ||
    SUPPLIER_CATEGORY_LABELS.raw_materials;

  const curr = supplier.currency || "UZS";
  const fmtMoney = (val: number) => new Intl.NumberFormat("uz-UZ").format(val);

  const openingBalance = financials?.openingBalance ?? 0;
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
            <span className="font-bold">DIQQAT: Ushbu ta&apos;minotchi BLOKLANGAN (Stop-List)!</span>{" "}
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
              Boshlang&apos;ich qoldiq (Opening)
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
              Jami Yetkazilgan (+Kt / Kirim)
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
              Jami To&apos;langan (-Dt / Chiqim)
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
              Yakuniy Saldo (Balance)
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
                <span>Akt Sverka</span>
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
                1. Korxona va Identifikatsiya
              </span>
            </div>
            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${catConfig.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${catConfig.dot}`} />
              {catConfig.label}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Ta&apos;minotchi / Brend nomi *
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
              Faoliyat yo&apos;nalishi / Toifasi *
            </Label>
            <Select
              value={supplier.category}
              onValueChange={(val) => {
                if (val) onChange({ category: val as SupplierCategory });
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Toifani tanlang" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                      <span>{v.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              STIR (INN) soliq raqami
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
              Ta&apos;minotchi maqomi (Status)
            </Label>
            <Select
              value={supplier.status}
              onValueChange={(val: any) => {
                if (val) onChange({ status: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active" className="text-xs">
                  Faol (Hamkorlikda)
                </SelectItem>
                <SelectItem value="Blocked" className="text-xs text-rose-600">
                  Bloklangan (Stop-List)
                </SelectItem>
                <SelectItem value="Archived" className="text-xs text-muted-foreground">
                  Arxiv / Faoliyatsiz
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Column 2: Bank va Hisob-kitob */}
        <div className="bg-card border border-border rounded-md p-3.5 space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs text-foreground">
              2. Bank va Hisob-kitob Rekvizitlari
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Xizmat ko&apos;rsatuvchi Bank
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
              MFO (Bank kodi)
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
              Asosiy hisob-kitob valyutasi
            </Label>
            <Select
              value={supplier.currency}
              onValueChange={(val) => {
                if (val) onChange({ currency: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Valyuta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UZS" className="text-xs">
                  UZS (O&apos;zbekiston so&apos;mi)
                </SelectItem>
                <SelectItem value="USD" className="text-xs">
                  USD (AQSH Dollari $)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              To&apos;lov shartlari & muddatlari
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
              3. Aloqa va Manzil Ma&apos;lumotlari
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground font-medium">
              Mas&apos;ul shaxs (Menejer / Usta)
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
              Email / Telegram username
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
              Ustaxona / Ofis manzili
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
              Qo&apos;shimcha izohlar va spetsifikatsiyalar
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
    </div>
  );
}
