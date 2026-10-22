"use client";

import React from "react";
import { MachineRecord, MachineCategory } from "../types";
import { getDefaultCounterUnit, getDefaultDepartmentForCategory } from "../cleanBlankMachine";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  Gauge,
  Clock,
  Zap,
  DollarSign,
  Building,
  Activity,
  Sliders,
} from "lucide-react";

interface MachineOverviewTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineOverviewTab({ machine, onUpdate }: MachineOverviewTabProps) {
  const getSpeedLabel = () => {
    switch (machine.category) {
      case "flexo":
        return machine.flexoSpecs?.practicalSpeedMpm
          ? `${machine.flexoSpecs.practicalSpeedMpm} m/min`
          : "—";
      case "lamination":
        return machine.laminationSpecs?.practicalSpeedMpm
          ? `${machine.laminationSpecs.practicalSpeedMpm} m/min`
          : "—";
      case "jacquard":
        return machine.jacquardSpecs?.practicalRpm
          ? `${machine.jacquardSpecs.practicalRpm} RPM`
          : "—";
      case "die-cutting":
        return machine.dieCuttingSpecs?.practicalSpeedSph
          ? `${machine.dieCuttingSpecs.practicalSpeedSph.toLocaleString()} varaq/soat`
          : "—";
      case "offset":
        return machine.offsetSpecs?.practicalSpeedSph
          ? `${machine.offsetSpecs.practicalSpeedSph.toLocaleString()} varaq/soat`
          : "—";
      case "mounting":
        return machine.mountingSpecs?.practicalSpeedSph
          ? `${machine.mountingSpecs.practicalSpeedSph.toLocaleString()} varaq/soat`
          : "—";
      case "guillotine":
        return machine.guillotineSpecs?.cycleTimeSec
          ? `${machine.guillotineSpecs.cycleTimeSec} soniya / kesim`
          : "—";
      case "casing-in":
        return machine.casingInSpecs?.speedCyclesPerHour
          ? `${machine.casingInSpecs.speedCyclesPerHour.toLocaleString()} kitob/soat`
          : "—";
      default:
        return "—";
    }
  };

  const getFormatLabel = () => {
    switch (machine.category) {
      case "offset":
        return machine.offsetSpecs?.maxSheetMm || "—";
      case "flexo":
        return machine.flexoSpecs?.maxWebWidthMm ? `${machine.flexoSpecs.maxWebWidthMm} mm Web` : "—";
      case "die-cutting":
        return machine.dieCuttingSpecs?.maxSheetMm || "—";
      case "lamination":
        return machine.laminationSpecs?.maxSheetMm || "—";
      case "guillotine":
        return machine.guillotineSpecs?.cuttingWidthMm ? `${machine.guillotineSpecs.cuttingWidthMm} mm kesim` : "—";
      case "jacquard":
        return machine.jacquardSpecs?.reedWidthMm ? `${machine.jacquardSpecs.reedWidthMm} mm` : "—";
      case "mounting":
        return machine.mountingSpecs?.maxSheetMm || "—";
      case "casing-in":
        return machine.casingInSpecs?.maxBookFormatMm || "—";
      default:
        return "—";
    }
  };

  const getMakeReadyLabel = () => {
    switch (machine.category) {
      case "offset":
        return machine.offsetSpecs?.makeReadyMinutes
          ? `${machine.offsetSpecs.makeReadyMinutes} daq (${machine.offsetSpecs.makeReadyWasteSheets || 0} varaq)`
          : "—";
      case "flexo":
        return machine.flexoSpecs?.makeReadyMinutes
          ? `${machine.flexoSpecs.makeReadyMinutes} daq (${machine.flexoSpecs.makeReadyWasteMeters || 0} m)`
          : "—";
      case "die-cutting":
        return machine.dieCuttingSpecs?.makeReadyMinutes
          ? `${machine.dieCuttingSpecs.makeReadyMinutes} daq (${machine.dieCuttingSpecs.makeReadyWasteSheets || 0} varaq)`
          : "—";
      case "lamination":
        return machine.laminationSpecs?.makeReadyMinutes
          ? `${machine.laminationSpecs.makeReadyMinutes} daq (${machine.laminationSpecs.makeReadyWasteSheets || 0} varaq)`
          : "—";
      case "jacquard":
        return machine.jacquardSpecs?.makeReadyMinutes
          ? `${machine.jacquardSpecs.makeReadyMinutes} daq (${machine.jacquardSpecs.wasteMeters || 0} m)`
          : "—";
      default:
        return "—";
    }
  };

  const handleCategoryChange = (newCat: MachineCategory) => {
    const nextDept = getDefaultDepartmentForCategory(newCat);
    const nextUnit = getDefaultCounterUnit(newCat);
    onUpdate({
      category: newCat,
      department: nextDept,
      counterUnit: nextUnit,
    });
  };

  return (
    <div className="space-y-4">
      {/* 4 Top Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ishlab Chiqarish Stavkasi
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ${(machine.costing?.standardHourlyRateUsd || 0).toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">/ soat</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Tannarx: ${(machine.costing?.totalBaseCostPerHourUsd || 0).toFixed(2)}/soat
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ish Tezligi
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {getSpeedLabel()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              OEE Samaradorlik: {machine.overallEfficiency ?? 90}%
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Elektr Quvvati
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {machine.energy?.activePowerKw || 0} kW
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Soatiga: ${(machine.energy?.hourlyElectricityCostUsd || 0).toFixed(2)}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Priladka / Chiqindi
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-foreground">
                {getMakeReadyLabel()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              Format: {getFormatLabel()}
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Specifications 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* General Hardware Specs */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Umumiy Uskuna Pasporti
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {machine.code || "KODSIZ"}
            </Badge>
          </div>

          <div className="p-3.5 space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Uskuna Nomi & Modeli *
                </Label>
                <Input
                  value={machine.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="Uskuna nomini kiriting"
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Ichki ERP Koding *
                </Label>
                <Input
                  value={machine.code}
                  onChange={(e) => onUpdate({ code: e.target.value.toUpperCase() })}
                  placeholder="Masalan: MAC-0001"
                  className="h-8 text-xs font-mono font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Texnologik Kategoriya *
                </Label>
                <Select
                  value={machine.category}
                  onValueChange={(val: any) => {
                    if (val) handleCategoryChange(val);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offset">Ofset chop etish (Offset)</SelectItem>
                    <SelectItem value="flexo">Ruloli flekso chop etish (Flexo)</SelectItem>
                    <SelectItem value="die-cutting">Shtampli qirqish (Die-cutting)</SelectItem>
                    <SelectItem value="guillotine">Gilotinli qog'oz kesish (Guillotine)</SelectItem>
                    <SelectItem value="lamination">Laminatsiya va laklash (Lamination)</SelectItem>
                    <SelectItem value="mounting">Kashirovka qilish (Mounting)</SelectItem>
                    <SelectItem value="casing-in">Muqovalash & tikish (Casing-in)</SelectItem>
                    <SelectItem value="jacquard">To'qimachilik / Jakkard (Jacquard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Bo'lim / Sex
                </Label>
                <Select
                  value={machine.department}
                  onValueChange={(val: any) => onUpdate({ department: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Offset">Offset (Ofset Sexi)</SelectItem>
                    <SelectItem value="Flexo">Flexo (Flekso Sexi)</SelectItem>
                    <SelectItem value="Post-press">Post-press (Kesim & Pardozlash)</SelectItem>
                    <SelectItem value="Packaging">Packaging (Qadoqlash)</SelectItem>
                    <SelectItem value="Jacquard">Jacquard (Jakkard Sexi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Ishlab Chiqaruvchi Zavod (Brend)
                </Label>
                <Input
                  value={machine.manufacturer}
                  onChange={(e) => onUpdate({ manufacturer: e.target.value })}
                  placeholder="Ishlab chiqaruvchi nomi"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Ishlab Chiqarilgan Davlat
                </Label>
                <Input
                  value={machine.country}
                  onChange={(e) => onUpdate({ country: e.target.value })}
                  placeholder="Mamlakat"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Ishlab Chiqarilgan Yili
                </Label>
                <Input
                  type="number"
                  value={machine.year || ""}
                  onChange={(e) => onUpdate({ year: Number(e.target.value) || new Date().getFullYear() })}
                  placeholder="Yil"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Zavod Seriya Raqami
                </Label>
                <Input
                  value={machine.serialNo}
                  onChange={(e) => onUpdate({ serialNo: e.target.value })}
                  placeholder="Seriya raqami"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Sex / Joylashuvi
                </Label>
                <Input
                  value={machine.location}
                  onChange={(e) => onUpdate({ location: e.target.value })}
                  placeholder="Joylashuv manzili"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Smena Tartibi
                </Label>
                <Input
                  value={machine.shiftPattern}
                  onChange={(e) => onUpdate({ shiftPattern: e.target.value })}
                  placeholder="Masalan: 2 smena"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Mas'ul Bosh Operator
                </Label>
                <Input
                  value={machine.leadOperator}
                  onChange={(e) => onUpdate({ leadOperator: e.target.value })}
                  placeholder="Operator F.I.Sh."
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Yordamchi Operator
                </Label>
                <Input
                  value={machine.assistantOperator}
                  onChange={(e) => onUpdate({ assistantOperator: e.target.value })}
                  placeholder="Yordamchi F.I.Sh."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-border/50">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  OEE Samaradorlik (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={machine.overallEfficiency ?? 90}
                  onChange={(e) => onUpdate({ overallEfficiency: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Odometer Hisoblagich
                </Label>
                <Input
                  type="number"
                  value={machine.totalLifetimeCounter ?? 0}
                  onChange={(e) => onUpdate({ totalLifetimeCounter: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Hisoblagich Birligi
                </Label>
                <Select
                  value={machine.counterUnit || "sheets"}
                  onValueChange={(val: any) => onUpdate({ counterUnit: val })}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sheets">varaq (sheets)</SelectItem>
                    <SelectItem value="meters">metr (meters)</SelectItem>
                    <SelectItem value="cuts">kesim (cuts)</SelectItem>
                    <SelectItem value="picks">zarb (picks)</SelectItem>
                    <SelectItem value="books">kitob (books)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Polymorphic Technology Specific Parameters */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Texnologik Parametrlar ({machine.category.toUpperCase()})
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase font-mono">
              {machine.category}
            </Badge>
          </div>

          <div className="p-3.5 space-y-3 text-xs">
            {/* 1. OFFSET PRESS SPECIFIC */}
            {machine.category === "offset" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Maksimal Varaq Formati (mm)
                    </Label>
                    <Input
                      value={machine.offsetSpecs?.maxSheetMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            maxSheetMm: e.target.value,
                          },
                        })
                      }
                      placeholder="Masalan: 750 × 1060 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Minimal Varaq Formati (mm)
                    </Label>
                    <Input
                      value={machine.offsetSpecs?.minSheetMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            minSheetMm: e.target.value,
                          },
                        })
                      }
                      placeholder="Masalan: 340 × 480 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Sektsiyalar Soni
                    </Label>
                    <Input
                      type="number"
                      value={machine.offsetSpecs?.printingUnits || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            printingUnits: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="4, 5, 8..."
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Qog'oz Grammaji Diapazoni
                    </Label>
                    <Input
                      value={machine.offsetSpecs?.grammageRange || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            grammageRange: e.target.value,
                          },
                        })
                      }
                      placeholder="60 - 450 g/m²"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      CTP Forma O'lchami (mm)
                    </Label>
                    <Input
                      value={machine.offsetSpecs?.plateSizeMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            plateSizeMm: e.target.value,
                          },
                        })
                      }
                      placeholder="Masalan: 790 × 1030 mm"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Quritish Turi
                    </Label>
                    <Input
                      value={machine.offsetSpecs?.dryerType || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            dryerType: e.target.value,
                          },
                        })
                      }
                      placeholder="IR / Hot Air / UV"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Amaliy Tezlik (varaq/soat)
                    </Label>
                    <Input
                      type="number"
                      value={machine.offsetSpecs?.practicalSpeedSph || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            practicalSpeedSph: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="11000"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Priladka Chiqindisi (varaq)
                    </Label>
                    <Input
                      type="number"
                      value={machine.offsetSpecs?.makeReadyWasteSheets || ""}
                      onChange={(e) =>
                        onUpdate({
                          offsetSpecs: {
                            ...(machine.offsetSpecs || ({} as any)),
                            makeReadyWasteSheets: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="100"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 2. FLEXO PRESS SPECIFIC */}
            {machine.category === "flexo" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Maksimal Polotno Kengligi (mm)
                    </Label>
                    <Input
                      type="number"
                      value={machine.flexoSpecs?.maxWebWidthMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          flexoSpecs: {
                            ...(machine.flexoSpecs || ({} as any)),
                            maxWebWidthMm: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="Masalan: 430"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Shesternya Qadami (Gear pitch)
                    </Label>
                    <Input
                      value={machine.flexoSpecs?.gearPitch || ""}
                      onChange={(e) =>
                        onUpdate({
                          flexoSpecs: {
                            ...(machine.flexoSpecs || ({} as any)),
                            gearPitch: e.target.value,
                          },
                        })
                      }
                      placeholder="1/8 in CP"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Bosma Sektsiyalari Soni
                    </Label>
                    <Input
                      type="number"
                      value={machine.flexoSpecs?.printingStations || ""}
                      onChange={(e) =>
                        onUpdate({
                          flexoSpecs: {
                            ...(machine.flexoSpecs || ({} as any)),
                            printingStations: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="6, 8..."
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Aylanma Shtamplar (Rotary Die) Soni
                    </Label>
                    <Input
                      type="number"
                      value={machine.flexoSpecs?.rotaryDieStations || ""}
                      onChange={(e) =>
                        onUpdate({
                          flexoSpecs: {
                            ...(machine.flexoSpecs || ({} as any)),
                            rotaryDieStations: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="1, 2..."
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Ish Tezligi (m/min)
                    </Label>
                    <Input
                      type="number"
                      value={machine.flexoSpecs?.practicalSpeedMpm || ""}
                      onChange={(e) =>
                        onUpdate({
                          flexoSpecs: {
                            ...(machine.flexoSpecs || ({} as any)),
                            practicalSpeedMpm: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="120"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Priladka Chiqindisi (metr)
                    </Label>
                    <Input
                      type="number"
                      value={machine.flexoSpecs?.makeReadyWasteMeters || ""}
                      onChange={(e) =>
                        onUpdate({
                          flexoSpecs: {
                            ...(machine.flexoSpecs || ({} as any)),
                            makeReadyWasteMeters: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="50"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 3. DIE-CUTTING SPECIFIC */}
            {machine.category === "die-cutting" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Maksimal Varaq Formati (mm)
                    </Label>
                    <Input
                      value={machine.dieCuttingSpecs?.maxSheetMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          dieCuttingSpecs: {
                            ...(machine.dieCuttingSpecs || ({} as any)),
                            maxSheetMm: e.target.value,
                          },
                        })
                      }
                      placeholder="760 × 1060 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Bosim Kuchi (Tonna)
                    </Label>
                    <Input
                      type="number"
                      value={machine.dieCuttingSpecs?.maxPressureTons || ""}
                      onChange={(e) =>
                        onUpdate({
                          dieCuttingSpecs: {
                            ...(machine.dieCuttingSpecs || ({} as any)),
                            maxPressureTons: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="260"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Ish Tezligi (varaq/soat)
                    </Label>
                    <Input
                      type="number"
                      value={machine.dieCuttingSpecs?.practicalSpeedSph || ""}
                      onChange={(e) =>
                        onUpdate({
                          dieCuttingSpecs: {
                            ...(machine.dieCuttingSpecs || ({} as any)),
                            practicalSpeedSph: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="6500"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Priladka Chiqindisi (varaq)
                    </Label>
                    <Input
                      type="number"
                      value={machine.dieCuttingSpecs?.makeReadyWasteSheets || ""}
                      onChange={(e) =>
                        onUpdate({
                          dieCuttingSpecs: {
                            ...(machine.dieCuttingSpecs || ({} as any)),
                            makeReadyWasteSheets: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="30"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 4. GUILLOTINE SPECIFIC */}
            {machine.category === "guillotine" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Kesish Kengligi (mm)
                    </Label>
                    <Input
                      type="number"
                      value={machine.guillotineSpecs?.cuttingWidthMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          guillotineSpecs: {
                            ...(machine.guillotineSpecs || ({} as any)),
                            cuttingWidthMm: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="1150"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Sikl Vaqti (soniya / kesim)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={machine.guillotineSpecs?.cycleTimeSec || ""}
                      onChange={(e) =>
                        onUpdate({
                          guillotineSpecs: {
                            ...(machine.guillotineSpecs || ({} as any)),
                            cycleTimeSec: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="1.8"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Pichoq Turi & Resursi
                  </Label>
                  <Input
                    value={machine.guillotineSpecs?.knifeType || ""}
                    onChange={(e) =>
                      onUpdate({
                        guillotineSpecs: {
                          ...(machine.guillotineSpecs || ({} as any)),
                          knifeType: e.target.value,
                        },
                      })
                    }
                    placeholder="Qotishma pichoq turi"
                    className="h-8 text-xs"
                  />
                </div>
              </>
            )}

            {/* 5. LAMINATION SPECIFIC */}
            {machine.category === "lamination" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Maksimal Format (mm)
                    </Label>
                    <Input
                      value={machine.laminationSpecs?.maxSheetMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          laminationSpecs: {
                            ...(machine.laminationSpecs || ({} as any)),
                            maxSheetMm: e.target.value,
                          },
                        })
                      }
                      placeholder="760 × 1020 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Tezlik (m/min)
                    </Label>
                    <Input
                      type="number"
                      value={machine.laminationSpecs?.practicalSpeedMpm || ""}
                      onChange={(e) =>
                        onUpdate({
                          laminationSpecs: {
                            ...(machine.laminationSpecs || ({} as any)),
                            practicalSpeedMpm: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="45"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Qo'llab-quvvatlanadigan Plyonkalar
                  </Label>
                  <Input
                    value={machine.laminationSpecs?.supportedFilms || ""}
                    onChange={(e) =>
                      onUpdate({
                        laminationSpecs: {
                          ...(machine.laminationSpecs || ({} as any)),
                          supportedFilms: e.target.value,
                        },
                      })
                    }
                    placeholder="BOPP Gloss / Matt / Soft-Touch / PET"
                    className="h-8 text-xs"
                  />
                </div>
              </>
            )}

            {/* 6. MOUNTING / KASHIROVKA SPECIFIC */}
            {machine.category === "mounting" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Kashirovka Formati (mm)
                    </Label>
                    <Input
                      value={machine.mountingSpecs?.maxSheetMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          mountingSpecs: {
                            ...(machine.mountingSpecs || ({} as any)),
                            maxSheetMm: e.target.value,
                          },
                        })
                      }
                      placeholder="1000 × 1400 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Yelimlash Turi
                    </Label>
                    <Input
                      value={machine.mountingSpecs?.glueType || ""}
                      onChange={(e) =>
                        onUpdate({
                          mountingSpecs: {
                            ...(machine.mountingSpecs || ({} as any)),
                            glueType: e.target.value,
                          },
                        })
                      }
                      placeholder="PVA / Kraxmal dispersiya"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Tezlik (varaq/soat)
                    </Label>
                    <Input
                      type="number"
                      value={machine.mountingSpecs?.practicalSpeedSph || ""}
                      onChange={(e) =>
                        onUpdate({
                          mountingSpecs: {
                            ...(machine.mountingSpecs || ({} as any)),
                            practicalSpeedSph: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="4000"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Qo'shish Aniqligi
                    </Label>
                    <Input
                      value={machine.mountingSpecs?.accuracyMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          mountingSpecs: {
                            ...(machine.mountingSpecs || ({} as any)),
                            accuracyMm: e.target.value,
                          },
                        })
                      }
                      placeholder="±0.5 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 7. CASING-IN / MUQOVA SPECIFIC */}
            {machine.category === "casing-in" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Kitob Blok Formati (mm)
                    </Label>
                    <Input
                      value={machine.casingInSpecs?.maxBookFormatMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          casingInSpecs: {
                            ...(machine.casingInSpecs || ({} as any)),
                            maxBookFormatMm: e.target.value,
                          },
                        })
                      }
                      placeholder="310 × 380 × 80 mm"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Tezlik (kitob/soat)
                    </Label>
                    <Input
                      type="number"
                      value={machine.casingInSpecs?.speedCyclesPerHour || ""}
                      onChange={(e) =>
                        onUpdate({
                          casingInSpecs: {
                            ...(machine.casingInSpecs || ({} as any)),
                            speedCyclesPerHour: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="2000"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 8. JACQUARD SPECIFIC */}
            {machine.category === "jacquard" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Berdo Kengligi (mm)
                    </Label>
                    <Input
                      type="number"
                      value={machine.jacquardSpecs?.reedWidthMm || ""}
                      onChange={(e) =>
                        onUpdate({
                          jacquardSpecs: {
                            ...(machine.jacquardSpecs || ({} as any)),
                            reedWidthMm: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="2400"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Ilgaklar Soni (Hooks)
                    </Label>
                    <Input
                      type="number"
                      value={machine.jacquardSpecs?.hooksCount || ""}
                      onChange={(e) =>
                        onUpdate({
                          jacquardSpecs: {
                            ...(machine.jacquardSpecs || ({} as any)),
                            hooksCount: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="6144"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Aylanma Tezligi (RPM)
                    </Label>
                    <Input
                      type="number"
                      value={machine.jacquardSpecs?.practicalRpm || ""}
                      onChange={(e) =>
                        onUpdate({
                          jacquardSpecs: {
                            ...(machine.jacquardSpecs || ({} as any)),
                            practicalRpm: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="720"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Bir Vaqtdagi Lentalar Soni
                    </Label>
                    <Input
                      type="number"
                      value={machine.jacquardSpecs?.simultaneousRibbons || ""}
                      onChange={(e) =>
                        onUpdate({
                          jacquardSpecs: {
                            ...(machine.jacquardSpecs || ({} as any)),
                            simultaneousRibbons: Number(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="16"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Production Notes Alert / Banner */}
      <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-xs">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary" />
          Texnologik Ko'rsatma / Uskuna Izohi
        </Label>
        <Textarea
          value={machine.notes || ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Uskunaning texnik holati, texnologik talablar yoki qo'shimcha eslatmalar..."
          className="text-xs min-h-[60px] resize-y"
        />
      </div>
    </div>
  );
}
