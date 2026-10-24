"use client";

import React from "react";
import { PlantRecord } from "../types";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  User,
  MapPin,
  Clock,
  FileText,
  ShieldCheck,
} from "lucide-react";

interface PlantOverviewTabProps {
  plant: PlantRecord;
  onUpdate: (updated: Partial<PlantRecord>) => void;
}

export function PlantOverviewTab({ plant, onUpdate }: PlantOverviewTabProps) {
  return (
    <div className="space-y-4 p-4 max-w-6xl">
      {/* 1. Basic Enterprise Identifiers */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <Building className="w-4 h-4 text-primary" />
          <span>Asosiy Identifikatorlar va Tashkilot / Korxona Ma&apos;lumotlari</span>
          <Badge variant="outline" className="ml-auto text-[10px] font-mono">
            {plant.code}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tashkilot / Korxona / Sex To&apos;liq Nomi *
            </Label>
            <Input
              value={plant.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-8 text-xs font-medium"
              placeholder="Masalan: ProMaxZangiota yoki PrintGoo Bosh Bosmaxona"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Qisqa Nomi (Teglar va hisobotlar uchun)
            </Label>
            <Input
              value={plant.shortName}
              onChange={(e) => onUpdate({ shortName: e.target.value })}
              className="h-8 text-xs"
              placeholder="Masalan: ProMax Zangiota"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tizimdagi Ichki Kod (Prefiks)
            </Label>
            <Input
              value={plant.code}
              onChange={(e) => onUpdate({ code: e.target.value.toUpperCase() })}
              className="h-8 text-xs font-mono"
              placeholder="BRN-06"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tashkiliy Maqomi va Faoliyat Yo&apos;nalishi *
            </Label>
            <Select
              value={plant.branchType}
              onValueChange={(val: string | null) => {
                if (val) onUpdate({ branchType: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tashkiliy maqomini tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mustaqil Ishlab Chiqaruvchi Tashkilot">
                  Mustaqil Ishlab Chiqaruvchi Tashkilot (Alohida korxona / zavod)
                </SelectItem>
                <SelectItem value="Bosh Korxona (HQ / Asosiy korpus)">
                  Bosh Korxona (HQ / Asosiy ishlab chiqarish korpusi)
                </SelectItem>
                <SelectItem value="Ofset va Qadoqlash Korxonasi">
                  Ofset va Qadoqlash Korxonasi (Offset & Packaging Plant)
                </SelectItem>
                <SelectItem value="Flekso va Yorliqlar Sexi">
                  Flekso va Yorliqlar Sexi (Narrow-Web Flexo & Labels)
                </SelectItem>
                <SelectItem value="To'qimachilik va Jakard Fabrikasi">
                  To&apos;qimachilik va Jakard Fabrikasi (Textile & Weaving)
                </SelectItem>
                <SelectItem value="Post-press va Kashirovka Uchastkasi">
                  Post-press va Kashirovka Uchastkasi (Finishing & Post-press)
                </SelectItem>
                <SelectItem value="Prepress va Repro Markazi">
                  Prepress va Repro Markazi (Prepress & Design Lab)
                </SelectItem>
                <SelectItem value="Mintaqaviy Filial va Logistika Majmuasi">
                  Mintaqaviy Xab va Logistika Majmuasi (Distribution & Hub)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Operatsion Holati
            </Label>
            <Select
              value={plant.status}
              onValueChange={(val: PlantRecord["status"] | null) => {
                if (val) onUpdate({ status: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">
                  <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Faol (Active)
                  </div>
                </SelectItem>
                <SelectItem value="Maintenance">
                  <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Texnik To&apos;xtalish / Ta&apos;mir
                  </div>
                </SelectItem>
                <SelectItem value="Inactive">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    Nofaol (Inactive)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Umumiy Ishlab Chiqarish Maydoni (m²)
            </Label>
            <Input
              type="number"
              value={plant.totalFloorAreaM2 || ""}
              onChange={(e) => onUpdate({ totalFloorAreaM2: Number(e.target.value) || 0 })}
              className="h-8 text-xs font-mono"
              placeholder="8500"
            />
          </div>

          {/* Is Main HQ Flag */}
          <div className="pt-1 md:col-span-3">
            <label className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border cursor-pointer hover:bg-muted/70 transition-colors">
              <input
                type="checkbox"
                checked={!!plant.isMain}
                onChange={(e) => onUpdate({ isMain: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground">Asosiy bosh korxona (HQ / Markaziy tashkilot)</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ushbu tashkilot butun kompaniyalar guruhi bo&apos;yicha bosh operatsion korxona sifatida qayd etiladi
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Management & Key Contacts */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <User className="w-4 h-4 text-primary" />
          <span>Rahbariyat va Asosiy Aloqa Shaxslari</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tashkilot Rahbari / Bosh Mas&apos;ul
            </Label>
            <Input
              value={plant.director}
              onChange={(e) => onUpdate({ director: e.target.value })}
              className="h-8 text-xs"
              placeholder="F.I.Sh."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Direktor Telefoni
            </Label>
            <PhoneInput
              value={plant.directorPhone || ""}
              onChange={(e) => onUpdate({ directorPhone: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="+998 90 123-45-67"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Umumiy Rasmiy Email
            </Label>
            <Input
              type="email"
              value={plant.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="hq@printgoo.uz"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Bosh Buxgalter
            </Label>
            <Input
              value={plant.chiefAccountant}
              onChange={(e) => onUpdate({ chiefAccountant: e.target.value })}
              className="h-8 text-xs"
              placeholder="F.I.Sh."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Bosh Buxgalter Telefoni
            </Label>
            <PhoneInput
              value={plant.chiefAccountantPhone || ""}
              onChange={(e) => onUpdate({ chiefAccountantPhone: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="+998 90 987-65-43"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Ishlab Chiqarish Boshlig&apos;i (Production Head)
            </Label>
            <Input
              value={plant.productionHead || ""}
              onChange={(e) => onUpdate({ productionHead: e.target.value })}
              className="h-8 text-xs"
              placeholder="F.I.Sh."
            />
          </div>
        </div>
      </div>

      {/* 3. Address & Location */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span>Jismoniy Manzil va Joylashuv</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Faktik Manzili (Yetkazish va logistika uchun)
            </Label>
            <Input
              value={plant.address}
              onChange={(e) => onUpdate({ address: e.target.value })}
              className="h-8 text-xs"
              placeholder="12 Amir Temur ko'chasi, Toshkent"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Mo&apos;ljal (Landmark / Kirish darvozasi)
            </Label>
            <Input
              value={plant.landmark || ""}
              onChange={(e) => onUpdate({ landmark: e.target.value })}
              className="h-8 text-xs"
              placeholder="2-darvoza, yuk qabul qilish rampasi"
            />
          </div>
        </div>
      </div>

      {/* 4. Shift & Working Schedule */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <Clock className="w-4 h-4 text-primary" />
          <span>Ish Tartibi va Smena Rejimi</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Smena Tartibi
            </Label>
            <Select
              value={plant.shiftRegime}
              onValueChange={(val: string | null) => {
                if (val) onUpdate({ shiftRegime: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Smena tartibini tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24/7 (2×12h Shifts)">
                  24/7 (2 smena × 12 soatlik)
                </SelectItem>
                <SelectItem value="24/7 (3×8h Shifts)">
                  24/7 (3 smena × 8 soatlik)
                </SelectItem>
                <SelectItem value="1×8h Standart (08:00–17:00)">
                  1×8h Standart kunduzgi (08:00–17:00)
                </SelectItem>
                <SelectItem value="2×8h Ikki smena (08:00–00:00)">
                  2×8h Ikki smena (08:00–00:00)
                </SelectItem>
                <SelectItem value="Moslashuvchan (Flexible)">
                  Moslashuvchan / Maxsus tartib
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Kunduzgi / Tungi Smena Soatlari
            </Label>
            <Input
              value={plant.workingHours}
              onChange={(e) => onUpdate({ workingHours: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="08:00 – 20:00 / 20:00 – 08:00"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Hafta Kunlari
            </Label>
            <Select
              value={plant.daysOfWeek}
              onValueChange={(val: string | null) => {
                if (val) onUpdate({ daysOfWeek: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Ish kunlarini tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Dushanba – Shanba">
                  Dushanba – Shanba (6 kunlik ish haftasi)
                </SelectItem>
                <SelectItem value="Dushanba – Juma">
                  Dushanba – Juma (5 kunlik ish haftasi)
                </SelectItem>
                <SelectItem value="Dushanba – Yakshanba (Uzluksiz)">
                  Dushanba – Yakshanba (Uzluksiz 24/7)
                </SelectItem>
                <SelectItem value="Maxsus grafik bo'yicha">
                  Maxsus navbatchilik grafigi
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 5. Notes & Operational Instructions */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <FileText className="w-4 h-4 text-primary" />
          <span>Operatsion Izohlar va Maxsus Ko&apos;rsatmalar</span>
        </div>
        <Textarea
          value={plant.notes || ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={3}
          className="text-xs resize-none"
          placeholder="Tashkilot / korxona faoliyatiga doir ichki qoidalar va maxsus qaydlar..."
        />
      </div>
    </div>
  );
}
