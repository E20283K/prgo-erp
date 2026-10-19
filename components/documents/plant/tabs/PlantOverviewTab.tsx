"use client";

import React from "react";
import { PlantRecord } from "../types";
import { Input } from "@/components/ui/input";
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
          <span>Asosiy Identifikatorlar va Filial Ma&apos;lumotlari</span>
          <Badge variant="outline" className="ml-auto text-[10px] font-mono">
            {plant.code}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Filial Koriq Nomi (ERP ichki nomi) *
            </Label>
            <Input
              value={plant.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-8 text-xs font-medium"
              placeholder="Masalan: Tashkent Main Factory (HQ)"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Qisqa Nomi (Hujjat va teglarda)
            </Label>
            <Input
              value={plant.shortName}
              onChange={(e) => onUpdate({ shortName: e.target.value })}
              className="h-8 text-xs"
              placeholder="Masalan: Toshkent Bosh Zavod"
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
              placeholder="TAS-HQ"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Filial Ixtisoslashuvi / Turi
            </Label>
            <Select
              value={plant.branchType}
              onValueChange={(val: string | null) => {
                if (val) onUpdate({ branchType: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Ixtisoslashuvni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Offset & Packaging Plant">
                  Offset & Packaging Plant (Bosh Ofset va Qadoqlash)
                </SelectItem>
                <SelectItem value="Narrow-Web Flexo & Thermal">
                  Narrow-Web Flexo & Thermal (Flekso va Yorliqlar)
                </SelectItem>
                <SelectItem value="Finishing & Mounting">
                  Finishing & Mounting (Kashirovka va Qirqish)
                </SelectItem>
                <SelectItem value="Climate-Controlled Storage">
                  Climate-Controlled Storage (Markaziy Xom-ashyo Ombori)
                </SelectItem>
                <SelectItem value="Regional Branch & Warehouse">
                  Regional Branch & Warehouse (Mintaqaviy Xab)
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
              Filial / Bosh Direktor
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
            <Input
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
            <Input
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
            <Input
              value={plant.shiftRegime}
              onChange={(e) => onUpdate({ shiftRegime: e.target.value })}
              className="h-8 text-xs"
              placeholder="24/7 (2×12h Shifts)"
            />
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
            <Input
              value={plant.daysOfWeek}
              onChange={(e) => onUpdate({ daysOfWeek: e.target.value })}
              className="h-8 text-xs"
              placeholder="Dushanba – Yakshanba (Uzluksiz)"
            />
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
          placeholder="Filial faoliyatiga doir ichki qoidalar va maxsus qaydlar..."
        />
      </div>
    </div>
  );
}
