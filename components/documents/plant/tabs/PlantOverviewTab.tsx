"use client";

import React, { useMemo } from "react";
import { PlantRecord } from "../types";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  Sun,
  Moon,
  Sunset,
  Plus,
  Trash2,
  CalendarDays,
} from "lucide-react";

interface PlantOverviewTabProps {
  plant: PlantRecord;
  onUpdate: (updated: Partial<PlantRecord>) => void;
}

interface ShiftInterval {
  start: string;
  end: string;
}

const SHIFT_PRESETS = [
  {
    id: "1x8",
    label: "1 smena (8s)",
    regime: "1×8h Standart (08:00–17:00)",
    hours: "08:00 – 17:00",
    days: "Dushanba – Shanba",
  },
  {
    id: "1x9",
    label: "1 smena (9s)",
    regime: "1×9h Standart (09:00–18:00)",
    hours: "09:00 – 18:00",
    days: "Dushanba – Shanba",
  },
  {
    id: "2x8",
    label: "2 smena (8s)",
    regime: "2×8h Ikki smena (08:00–00:00)",
    hours: "08:00 – 16:00 / 16:00 – 00:00",
    days: "Dushanba – Shanba",
  },
  {
    id: "2x12",
    label: "24/7 (2×12s)",
    regime: "24/7 (2×12h Shifts)",
    hours: "08:00 – 20:00 / 20:00 – 08:00",
    days: "Dushanba – Yakshanba (Uzluksiz)",
  },
  {
    id: "3x8",
    label: "24/7 (3×8s)",
    regime: "24/7 (3×8h Shifts)",
    hours: "08:00 – 16:00 / 16:00 – 00:00 / 00:00 – 08:00",
    days: "Dushanba – Yakshanba (Uzluksiz)",
  },
  {
    id: "flex",
    label: "Moslashuvchan",
    regime: "Moslashuvchan (Flexible)",
    hours: "",
    days: "Maxsus grafik bo'yicha",
  },
] as const;

const WEEK_DAYS = [
  { id: 0, short: "Du", full: "Dushanba" },
  { id: 1, short: "Se", full: "Seshanba" },
  { id: 2, short: "Ch", full: "Chorshanba" },
  { id: 3, short: "Pa", full: "Payshanba" },
  { id: 4, short: "Ju", full: "Juma" },
  { id: 5, short: "Sh", full: "Shanba" },
  { id: 6, short: "Ya", full: "Yakshanba" },
] as const;

function parseShiftIntervals(workingHours: string): ShiftInterval[] {
  if (!workingHours || !workingHours.trim()) {
    return [{ start: "08:00", end: "17:00" }];
  }
  const parts = workingHours
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed: ShiftInterval[] = [];

  for (const part of parts) {
    const match = part.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (match) {
      const pad = (t: string) => (t.length === 4 ? `0${t}` : t);
      parsed.push({ start: pad(match[1]), end: pad(match[2]) });
    }
  }

  return parsed.length > 0 ? parsed : [{ start: "08:00", end: "17:00" }];
}

function formatShiftIntervals(intervals: ShiftInterval[]): string {
  return intervals.map((i) => `${i.start} – ${i.end}`).join(" / ");
}

function calcShiftDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(eh)) return 0;
  let diff = eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
  if (diff <= 0) diff += 24;
  return Math.round(diff * 10) / 10;
}

function parseActiveDays(daysOfWeek: string): number[] {
  const val = (daysOfWeek || "").toLowerCase();
  if (!val) return [0, 1, 2, 3, 4, 5];
  if (val.includes("yakshanba") || val.includes("24/7") || val.includes("uzluksiz")) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (val.includes("dushanba") && val.includes("shanba") && (val.includes("–") || val.includes("-"))) {
    return [0, 1, 2, 3, 4, 5];
  }
  if (val.includes("dushanba") && val.includes("juma") && (val.includes("–") || val.includes("-"))) {
    return [0, 1, 2, 3, 4];
  }
  const matched: number[] = [];
  WEEK_DAYS.forEach((d) => {
    if (val.includes(d.full.toLowerCase()) || val.includes(d.short.toLowerCase())) {
      matched.push(d.id);
    }
  });
  return matched.length > 0 ? matched : [0, 1, 2, 3, 4, 5];
}

function formatActiveDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(",");
  if (key === "0,1,2,3,4") return "Dushanba – Juma";
  if (key === "0,1,2,3,4,5") return "Dushanba – Shanba";
  if (key === "0,1,2,3,4,5,6") return "Dushanba – Yakshanba (Uzluksiz)";
  if (sorted.length === 0) return "Maxsus grafik bo'yicha";
  return sorted.map((id) => WEEK_DAYS[id]?.short).filter(Boolean).join(", ");
}

export function PlantOverviewTab({ plant, onUpdate }: PlantOverviewTabProps) {
  const shifts = useMemo(
    () => parseShiftIntervals(plant.workingHours),
    [plant.workingHours]
  );

  const activeDays = useMemo(
    () => parseActiveDays(plant.daysOfWeek),
    [plant.daysOfWeek]
  );

  const dailyTotalHours = useMemo(
    () =>
      shifts.reduce(
        (acc, s) => acc + calcShiftDurationHours(s.start, s.end),
        0
      ),
    [shifts]
  );

  const weeklyTotalHours = useMemo(
    () => Math.round(dailyTotalHours * activeDays.length * 10) / 10,
    [dailyTotalHours, activeDays.length]
  );

  const handleShiftTimeChange = (
    idx: number,
    field: "start" | "end",
    val: string
  ) => {
    const next = shifts.map((s, i) => (i === idx ? { ...s, [field]: val } : s));
    onUpdate({ workingHours: formatShiftIntervals(next) });
  };

  const handleAddShift = () => {
    if (shifts.length >= 3) return;
    const lastEnd = shifts[shifts.length - 1]?.end || "17:00";
    const nextEnd =
      lastEnd === "16:00"
        ? "00:00"
        : lastEnd === "20:00"
        ? "08:00"
        : "00:00";
    const next = [...shifts, { start: lastEnd, end: nextEnd }];
    const count = next.length;
    const nextRegime =
      count === 2
        ? "2×8h Ikki smena (08:00–00:00)"
        : count === 3
        ? "24/7 (3×8h Shifts)"
        : plant.shiftRegime;
    onUpdate({
      workingHours: formatShiftIntervals(next),
      shiftRegime: nextRegime,
    });
  };

  const handleRemoveShift = (idx: number) => {
    if (shifts.length <= 1) return;
    const next = shifts.filter((_, i) => i !== idx);
    const count = next.length;
    const nextRegime =
      count === 1
        ? "1×8h Standart (08:00–17:00)"
        : count === 2
        ? "2×8h Ikki smena (08:00–00:00)"
        : plant.shiftRegime;
    onUpdate({
      workingHours: formatShiftIntervals(next),
      shiftRegime: nextRegime,
    });
  };

  const handleToggleDay = (dayId: number) => {
    const exists = activeDays.includes(dayId);
    if (exists && activeDays.length <= 1) return;
    const next = exists
      ? activeDays.filter((d) => d !== dayId)
      : [...activeDays, dayId];
    onUpdate({ daysOfWeek: formatActiveDays(next) });
  };

  return (
    <div className="space-y-3 p-3.5 max-w-6xl">
      {/* 1. Basic Enterprise Identifiers */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Building className="size-3.5 text-primary" />
            <span>Asosiy ma&apos;lumotlar</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                size="sm"
                checked={!!plant.isMain}
                onCheckedChange={(checked) => onUpdate({ isMain: checked })}
              />
              <ShieldCheck className="size-3.5 text-primary" />
              <span className="text-[11px] font-medium text-foreground">
                Bosh korxona
              </span>
            </label>
            {plant.code && (
              <Badge variant="outline" className="text-[10px] font-mono h-5">
                {plant.code}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Korxona to&apos;liq nomi *
            </Label>
            <Input
              value={plant.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-8 text-xs font-medium"
              placeholder="ProMaxZangiota"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Qisqa nomi
            </Label>
            <Input
              value={plant.shortName}
              onChange={(e) => onUpdate({ shortName: e.target.value })}
              className="h-8 text-xs"
              placeholder="ProMax Zangiota"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Ichki kod
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">
                Avto
              </span>
            </div>
            <Input
              value={plant.code}
              readOnly
              className="h-8 text-xs font-mono bg-muted/40 text-muted-foreground cursor-default"
              placeholder="Avtomatik"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Faoliyat yo&apos;nalishi *
            </Label>
            <Select
              value={plant.branchType}
              onValueChange={(val: string | null) => {
                if (val) onUpdate({ branchType: val });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Yo'nalishni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mustaqil Ishlab Chiqaruvchi Tashkilot">
                  Mustaqil ishlab chiqaruvchi korxona
                </SelectItem>
                <SelectItem value="Bosh Korxona (HQ / Asosiy korpus)">
                  Bosh korxona
                </SelectItem>
                <SelectItem value="Ofset va Qadoqlash Korxonasi">
                  Ofset va qadoqlash korxonasi
                </SelectItem>
                <SelectItem value="Flekso va Yorliqlar Sexi">
                  Flekso va yorliqlar sexi
                </SelectItem>
                <SelectItem value="To'qimachilik va Jakard Fabrikasi">
                  To&apos;qimachilik va jakard fabrikasi
                </SelectItem>
                <SelectItem value="Post-press va Kashirovka Uchastkasi">
                  Post-press va kashirovka uchastkasi
                </SelectItem>
                <SelectItem value="Prepress va Repro Markazi">
                  Prepress va repro markazi
                </SelectItem>
                <SelectItem value="Mintaqaviy Filial va Logistika Majmuasi">
                  Mintaqaviy filial va logistika
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Holati
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
                    Faol
                  </div>
                </SelectItem>
                <SelectItem value="Maintenance">
                  <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Ta&apos;mirda
                  </div>
                </SelectItem>
                <SelectItem value="Inactive">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    Nofaol
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Maydoni (m²)
            </Label>
            <Input
              type="number"
              value={plant.totalFloorAreaM2 || ""}
              onChange={(e) =>
                onUpdate({ totalFloorAreaM2: Number(e.target.value) || 0 })
              }
              className="h-8 text-xs font-mono"
              placeholder="8500"
            />
          </div>
        </div>
      </div>

      {/* 2. Shift & Working Schedule (Interactive & Ergonomic) */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Clock className="size-3.5 text-primary" />
            <span>Ish tartibi</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="h-5 px-2 text-[10px] font-mono font-medium"
            >
              {shifts.length} smena · {dailyTotalHours}s/kun · {weeklyTotalHours}s/hafta
            </Badge>
            {shifts.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddShift}
                className="h-6 px-2 text-[11px] gap-1"
              >
                <Plus className="size-3" />
                <span>Smena qo&apos;shish</span>
              </Button>
            )}
          </div>
        </div>

        {/* Row 1: Quick Regime Presets + Regime Select */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-end">
          <div className="lg:col-span-7 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tezkor rejim shablonlari
            </Label>
            <div className="flex flex-wrap items-center gap-1">
              {SHIFT_PRESETS.map((preset) => {
                const isSelected =
                  plant.shiftRegime === preset.regime ||
                  (preset.hours && plant.workingHours === preset.hours);
                return (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      onUpdate({
                        shiftRegime: preset.regime,
                        workingHours: preset.hours || plant.workingHours,
                        daysOfWeek: preset.days,
                      })
                    }
                    className="h-7 px-2.5 text-[11px] font-medium"
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Smena tartibi
            </Label>
            <Select
              value={plant.shiftRegime}
              onValueChange={(val: string | null) => {
                if (!val) return;
                const matched = SHIFT_PRESETS.find((p) => p.regime === val);
                if (matched && matched.hours) {
                  onUpdate({
                    shiftRegime: val,
                    workingHours: matched.hours,
                    daysOfWeek: matched.days,
                  });
                } else {
                  onUpdate({ shiftRegime: val });
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Smena tartibini tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1×8h Standart (08:00–17:00)">
                  1×8s Standart kunduzgi (08:00–17:00)
                </SelectItem>
                <SelectItem value="1×9h Standart (09:00–18:00)">
                  1×9s Standart kunduzgi (09:00–18:00)
                </SelectItem>
                <SelectItem value="2×8h Ikki smena (08:00–00:00)">
                  2×8s Ikki smena (08:00–00:00)
                </SelectItem>
                <SelectItem value="24/7 (2×12h Shifts)">
                  24/7 (2 smena × 12 soat)
                </SelectItem>
                <SelectItem value="24/7 (3×8h Shifts)">
                  24/7 (3 smena × 8 soat)
                </SelectItem>
                <SelectItem value="Moslashuvchan (Flexible)">
                  Moslashuvchan grafik
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Interactive Shift Time Slots */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Smena soatlari
            </Label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {plant.workingHours || "—"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {shifts.map((shift, idx) => {
              const duration = calcShiftDurationHours(shift.start, shift.end);
              const ShiftIcon =
                idx === 0 ? Sun : idx === 1 ? Sunset : Moon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-1 min-w-[68px]">
                    <ShiftIcon className="size-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-medium text-foreground">
                      {idx + 1}-smena
                    </span>
                  </div>

                  <Input
                    type="time"
                    value={shift.start}
                    onChange={(e) =>
                      handleShiftTimeChange(idx, "start", e.target.value)
                    }
                    className="h-7 px-1.5 text-xs font-mono w-[82px]"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="time"
                    value={shift.end}
                    onChange={(e) =>
                      handleShiftTimeChange(idx, "end", e.target.value)
                    }
                    className="h-7 px-1.5 text-xs font-mono w-[82px]"
                  />

                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] font-mono h-5 px-1.5 shrink-0"
                  >
                    {duration}s
                  </Badge>

                  {shifts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveShift(idx)}
                      className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3: Interactive Working Days Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-end pt-1 border-t border-border/60">
          <div className="lg:col-span-7 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="size-3 text-muted-foreground" />
              <span>Ish kunlari ({activeDays.length} kun/hafta)</span>
            </Label>
            <div className="flex flex-wrap items-center gap-1">
              {WEEK_DAYS.map((day) => {
                const active = activeDays.includes(day.id);
                return (
                  <Button
                    key={day.id}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleDay(day.id)}
                    title={day.full}
                    className="h-7 w-9 p-0 text-[11px] font-mono font-medium"
                  >
                    {day.short}
                  </Button>
                );
              })}

              <div className="h-4 w-px bg-border mx-1" />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onUpdate({ daysOfWeek: "Dushanba – Juma" })}
                className="h-7 px-2 text-[11px]"
              >
                5 kunlik
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onUpdate({ daysOfWeek: "Dushanba – Shanba" })}
                className="h-7 px-2 text-[11px]"
              >
                6 kunlik
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onUpdate({ daysOfWeek: "Dushanba – Yakshanba (Uzluksiz)" })
                }
                className="h-7 px-2 text-[11px]"
              >
                Har kuni
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Hafta jadvali
            </Label>
            <Select
              value={plant.daysOfWeek}
              onValueChange={(val: string | null) => {
                if (val) onUpdate({ daysOfWeek: val });
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Ish kunlarini tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Dushanba – Shanba">
                  Dushanba – Shanba (6 kunlik)
                </SelectItem>
                <SelectItem value="Dushanba – Juma">
                  Dushanba – Juma (5 kunlik)
                </SelectItem>
                <SelectItem value="Dushanba – Yakshanba (Uzluksiz)">
                  Dushanba – Yakshanba (Uzluksiz)
                </SelectItem>
                <SelectItem value="Maxsus grafik bo'yicha">
                  Maxsus navbatchilik grafigi
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3. Management & Key Contacts */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <User className="size-3.5 text-primary" />
          <span>Rahbariyat</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Tashkilot rahbari
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
              Rahbar telefoni
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
              Bosh buxgalter
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
              Buxgalter telefoni
            </Label>
            <PhoneInput
              value={plant.chiefAccountantPhone || ""}
              onChange={(e) =>
                onUpdate({ chiefAccountantPhone: e.target.value })
              }
              className="h-8 text-xs font-mono"
              placeholder="+998 90 987-65-43"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Ishlab chiqarish boshlig&apos;i
            </Label>
            <Input
              value={plant.productionHead || ""}
              onChange={(e) => onUpdate({ productionHead: e.target.value })}
              className="h-8 text-xs"
              placeholder="F.I.Sh."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Ishlab chiqarish telefoni
            </Label>
            <PhoneInput
              value={plant.productionHeadPhone || ""}
              onChange={(e) =>
                onUpdate({ productionHeadPhone: e.target.value })
              }
              className="h-8 text-xs font-mono"
              placeholder="+998 90 111-22-33"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Umumiy telefon
            </Label>
            <PhoneInput
              value={plant.phone || ""}
              onChange={(e) => onUpdate({ phone: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="+998 71 200-00-00"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Rasmiy email
            </Label>
            <Input
              type="email"
              value={plant.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="hq@printgoo.uz"
            />
          </div>
        </div>
      </div>

      {/* 4. Address & Location */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
          <MapPin className="size-3.5 text-primary" />
          <span>Manzil</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Faktik manzili
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
              Mo&apos;ljal
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

      {/* 5. Notes & Operational Instructions */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <FileText className="size-3.5 text-primary" />
          <span>Izohlar</span>
        </div>
        <Textarea
          value={plant.notes || ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={2}
          className="text-xs resize-none"
          placeholder="Ichki qoidalar va maxsus qaydlar..."
        />
      </div>
    </div>
  );
}
