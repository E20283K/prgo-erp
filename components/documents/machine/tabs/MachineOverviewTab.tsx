"use client";

import React from "react";
import { MachineRecord } from "../types";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Gauge,
  Clock,
  Layers,
  Wrench,
  Zap,
  DollarSign,
  MapPin,
  Calendar,
  Building,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Sliders,
  Sparkles,
} from "lucide-react";

interface MachineOverviewTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

export function MachineOverviewTab({ machine, onUpdate }: MachineOverviewTabProps) {
  const getSpeedLabel = () => {
    switch (machine.category) {
      case "flexo":
      case "lamination":
        return `${machine.flexoSpecs?.practicalSpeedMpm || machine.laminationSpecs?.practicalSpeedMpm || 100} m/min`;
      case "jacquard":
        return `${machine.jacquardSpecs?.practicalRpm || 720} RPM (picks/min)`;
      case "die-cutting":
      case "offset":
      case "mounting":
        return `${(
          machine.offsetSpecs?.practicalSpeedSph ||
          machine.dieCuttingSpecs?.practicalSpeedSph ||
          machine.mountingSpecs?.practicalSpeedSph ||
          10000
        ).toLocaleString()} varaq/soat`;
      case "guillotine":
        return `${machine.guillotineSpecs?.cycleTimeSec || 1.8} soniya / kesim`;
      case "casing-in":
        return `${(machine.casingInSpecs?.speedCyclesPerHour || 2400).toLocaleString()} kitob/soat`;
      default:
        return "10,000 / soat";
    }
  };

  const getFormatLabel = () => {
    switch (machine.category) {
      case "offset":
        return machine.offsetSpecs?.maxSheetMm || "750 × 1060 mm";
      case "flexo":
        return `${machine.flexoSpecs?.maxWebWidthMm} mm Web (Z=${machine.flexoSpecs?.gearPitch.slice(0, 10)})`;
      case "die-cutting":
        return machine.dieCuttingSpecs?.maxSheetMm || "760 × 1060 mm";
      case "lamination":
        return machine.laminationSpecs?.maxSheetMm || "760 × 1020 mm";
      case "guillotine":
        return `${machine.guillotineSpecs?.cuttingWidthMm} mm kesim kengligi`;
      case "jacquard":
        return `${machine.jacquardSpecs?.reedWidthMm} mm / ${machine.jacquardSpecs?.hooksCount} Hooks`;
      case "mounting":
        return machine.mountingSpecs?.maxSheetMm || "1000 × 1400 mm";
      case "casing-in":
        return machine.casingInSpecs?.maxBookFormatMm || "310 × 380 × 80 mm";
      default:
        return "Standart";
    }
  };

  const getMakeReadyLabel = () => {
    switch (machine.category) {
      case "offset":
        return `${machine.offsetSpecs?.makeReadyMinutes} daq (${machine.offsetSpecs?.makeReadyWasteSheets} varaq chiqindi)`;
      case "flexo":
        return `${machine.flexoSpecs?.makeReadyMinutes} daq (${machine.flexoSpecs?.makeReadyWasteMeters} m chiqindi)`;
      case "die-cutting":
        return `${machine.dieCuttingSpecs?.makeReadyMinutes} daq (${machine.dieCuttingSpecs?.makeReadyWasteSheets} varaq chiqindi)`;
      case "lamination":
        return `${machine.laminationSpecs?.makeReadyMinutes} daq (${machine.laminationSpecs?.makeReadyWasteSheets} varaq chiqindi)`;
      case "jacquard":
        return `${machine.jacquardSpecs?.makeReadyMinutes} daq (${machine.jacquardSpecs?.wasteMeters} m chiqindi)`;
      default:
        return "20-30 daqiqa";
    }
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
                ${machine.costing.standardHourlyRateUsd.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">/ soat</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Tannarx: ${machine.costing.totalBaseCostPerHourUsd.toFixed(2)}/soat
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              O'rtacha Ish Tezligi
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {getSpeedLabel()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              OEE Samaradorlik: {machine.overallEfficiency}%
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Elektr Quvvati & Sarfi
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {machine.energy.activePowerKw} kW
              </span>
              <span className="text-xs text-muted-foreground">faol</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Soatiga: ${machine.energy.hourlyElectricityCostUsd.toFixed(2)} (${machine.energy.electricityTariffUsd}/kWh)
            </p>
          </div>
          <div className="h-9 w-9 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Priladka & Chiqindi
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-foreground">
                {getMakeReadyLabel()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
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
          <div className="py-2.5 px-3.5 border-b border-border bg-muted/30 flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Umumiy Uskuna Ma'lumotlari
            </span>
          </div>
          <div className="p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Uskuna Nomi & Modeli:</span>
              <span className="font-semibold text-foreground">{machine.name}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Ichki ERP Koding:</span>
              <span className="font-mono font-medium text-foreground">{machine.code}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Ishlab Chiqaruvchi & Mamlakat:</span>
              <span className="font-medium text-foreground">{machine.manufacturer} ({machine.country})</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Ishlab Chiqarilgan Yili:</span>
              <span className="font-medium text-foreground">{machine.year}-yil</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Zavod Seriya Raqami:</span>
              <span className="font-mono text-muted-foreground">{machine.serialNo}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Tsex / Joylashuvi:</span>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                {machine.location}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Smena Tartibi:</span>
              <span className="font-medium text-foreground">{machine.shiftPattern}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Joriy Mas'ul Operator:</span>
              <div className="text-right">
                <span className="font-semibold text-foreground flex items-center justify-end gap-1">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  {machine.leadOperator}
                </span>
                {machine.assistantOperator && machine.assistantOperator !== "—" && (
                  <span className="text-[11px] text-muted-foreground block">
                    Yordamchi: {machine.assistantOperator}
                  </span>
                )}
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
                Texnologik Xususiyatlar ({machine.department})
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase font-mono">
              {machine.category}
            </Badge>
          </div>
          <div className="p-3.5 space-y-2 text-xs">
            {/* OFFSET PRESS SPECIFIC */}
            {machine.category === "offset" && machine.offsetSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Format Diapazoni (Min / Max):</span>
                  <span className="font-medium text-foreground">
                    {machine.offsetSpecs.minSheetMm} — {machine.offsetSpecs.maxSheetMm}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Maksimal Bosma Maydoni:</span>
                  <span className="font-medium text-foreground">{machine.offsetSpecs.maxPrintAreaMm}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Qog'oz Qalinligi / Grammaj:</span>
                  <span className="font-medium text-foreground">{machine.offsetSpecs.grammageRange}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Sektsiyalar Soni & Rejim:</span>
                  <span className="font-medium text-foreground">
                    {machine.offsetSpecs.printingUnits} ta sektsiya ({machine.offsetSpecs.perfectingMode})
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">CTP Forma O'lchami:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                    {machine.offsetSpecs.plateSizeMm}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Rezina Matosi (Blanket):</span>
                  <span className="font-mono text-muted-foreground">{machine.offsetSpecs.blanketSizeMm}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Namlovchi Sistema & Spirt:</span>
                  <span className="font-medium text-foreground">
                    {machine.offsetSpecs.dampeningSystem} ({machine.offsetSpecs.alcoholDosingPercent})
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Quritish / Fiksatsiya:</span>
                  <span className="font-medium text-foreground">{machine.offsetSpecs.dryerType}</span>
                </div>
              </>
            )}

            {/* FLEXO SPECIFIC */}
            {machine.category === "flexo" && machine.flexoSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Maksimal / Minimal Polotno Kengligi:</span>
                  <span className="font-medium text-foreground">
                    {machine.flexoSpecs.minWebWidthMm} mm — {machine.flexoSpecs.maxWebWidthMm} mm Web
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Takrorlanish Diapazoni (Repeat):</span>
                  <span className="font-medium text-foreground">
                    {machine.flexoSpecs.repeatMinMm} mm — {machine.flexoSpecs.repeatMaxMm} mm
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Shesternya Qadami & Tishlar:</span>
                  <span className="font-mono font-medium text-foreground">{machine.flexoSpecs.gearPitch}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Rulon Diametri (Unwind / Rewind):</span>
                  <span className="font-medium text-foreground">
                    Ø{machine.flexoSpecs.maxUnwindDiamMm} mm / Ø{machine.flexoSpecs.maxRewindDiamMm} mm (Vtulka: {machine.flexoSpecs.coreDiameterMm} mm)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Rangli Sektsiyalar Soni:</span>
                  <span className="font-semibold text-foreground">
                    {machine.flexoSpecs.printingStations} ta flexo sektsiya + {machine.flexoSpecs.rotaryDieStations} ta shtamp stansiyasi
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Klayshe Qalinligi & Skotch:</span>
                  <span className="font-mono text-foreground">
                    {machine.flexoSpecs.plateThicknessMm} mm photopolymer / {machine.flexoSpecs.cushionTapeMm} mm cushion
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Anilox Vallari Soni:</span>
                  <span className="font-medium text-foreground">{machine.flexoSpecs.aniloxCount} ta sopol anilox vallar</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Quritish Tizimi:</span>
                  <span className="font-medium text-foreground">{machine.flexoSpecs.curingSystem}</span>
                </div>
              </>
            )}

            {/* DIE-CUTTING SPECIFIC */}
            {machine.category === "die-cutting" && machine.dieCuttingSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Maksimal / Minimal Varaq:</span>
                  <span className="font-medium text-foreground">
                    {machine.dieCuttingSpecs.minSheetMm} — {machine.dieCuttingSpecs.maxSheetMm}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Maksimal Zarb Bosimi (Pressure):</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {machine.dieCuttingSpecs.maxPressureTons} tonna (2.6 MN)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Mos Materiallar Turi:</span>
                  <span className="font-medium text-foreground">{machine.dieCuttingSpecs.substrateRange}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Klapan / Tutqich Maydoni:</span>
                  <span className="font-mono text-foreground">{machine.dieCuttingSpecs.gripperMarginMm}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Shtanz Pichoq Standart Balandligi:</span>
                  <span className="font-mono text-foreground">{machine.dieCuttingSpecs.cuttingRuleHeightMm} mm</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Avtomatik Tozalash (Stripping):</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {machine.dieCuttingSpecs.strippingStation ? "Mavjud (Yuqori & Pastki ramkalar)" : "Yo'q"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Optik Centerline Tizimi:</span>
                  <span className="font-medium text-foreground">
                    {machine.dieCuttingSpecs.centerlineSystem ? "Ha (Mikrometrik sozlash)" : "Yo'q"}
                  </span>
                </div>
              </>
            )}

            {/* LAMINATION SPECIFIC */}
            {machine.category === "lamination" && machine.laminationSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Varaq Formati (Min / Max):</span>
                  <span className="font-medium text-foreground">
                    {machine.laminationSpecs.minSheetMm} — {machine.laminationSpecs.maxSheetMm}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Material Grammaji:</span>
                  <span className="font-medium text-foreground">{machine.laminationSpecs.grammageRange}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Xrom Kalandr Diametri:</span>
                  <span className="font-mono text-foreground">Ø{machine.laminationSpecs.calenderDiameterMm} mm ko'zgu silliqligida</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Isitish Tizimi:</span>
                  <span className="font-medium text-foreground">{machine.laminationSpecs.calenderHeating}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Gidravlik Siqish Bosimi:</span>
                  <span className="font-mono text-foreground">{machine.laminationSpecs.nipPressureBar} bar</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Qo'llab-quvvatlanadigan Plyonkalar:</span>
                  <span className="font-medium text-foreground">{machine.laminationSpecs.supportedFilms}</span>
                </div>
              </>
            )}

            {/* GUILLOTINE CUTTING SPECIFIC */}
            {machine.category === "guillotine" && machine.guillotineSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Maksimal Kesish Kengligi:</span>
                  <span className="font-bold text-foreground font-mono">{machine.guillotineSpecs.cuttingWidthMm} mm (45")</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Stol Chuqurligi & Balandligi:</span>
                  <span className="font-mono text-foreground">
                    {machine.guillotineSpecs.feedDepthMm} mm chuqurlik / {machine.guillotineSpecs.tableHeightMm} mm
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Pichoq Ostidagi Maksimal Balandlik:</span>
                  <span className="font-mono text-foreground">{machine.guillotineSpecs.clampOpeningMm} mm</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Gidravlik Siqish Bosimi Diapazoni:</span>
                  <span className="font-mono text-foreground">{machine.guillotineSpecs.clampingPressureRangeDaN}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Havo Yostiqchali Stol (Air bed):</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {machine.guillotineSpecs.airCushionTable ? "Mavjud (Yuqori hajm puflagich)" : "Yo'q"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Pichoq Turi & O'tkirlash Resursi:</span>
                  <span className="font-medium text-foreground">
                    {machine.guillotineSpecs.knifeType} (~{machine.guillotineSpecs.cutsPerKnifeChange.toLocaleString()} kesim)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Optik Kesish Ko'rsatkichi:</span>
                  <span className="font-medium text-foreground">LED Lazer chizig'i</span>
                </div>
              </>
            )}

            {/* JACQUARD SPECIFIC */}
            {machine.category === "jacquard" && machine.jacquardSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Dastgoh Berdo Kengligi:</span>
                  <span className="font-bold text-foreground font-mono">{machine.jacquardSpecs.reedWidthMm} mm (2.4 m)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Elektron Jakkard Ilgaklari (Hooks):</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                    {machine.jacquardSpecs.hooksCount} ta ilgak (Staubli elektron modullari)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Bir Vaqtda To'qiladigan Lentalar:</span>
                  <span className="font-medium text-foreground">{machine.jacquardSpecs.simultaneousRibbons} ta tasma</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tuxum / Urish Zichligi:</span>
                  <span className="font-mono text-foreground">{machine.jacquardSpecs.densityRangePicksCm}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Arqon Tashlash Mexanizmi:</span>
                  <span className="font-medium text-foreground">{machine.jacquardSpecs.weftInsertionType}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Ultratovushli Kesgichlar:</span>
                  <span className="font-medium text-foreground">{machine.jacquardSpecs.ultrasonicCutters} ta ultratovushli qirqish</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Ip O'rash Barabani (Warp beam):</span>
                  <span className="font-mono text-foreground">Ø{machine.jacquardSpecs.warpBeamDiamMm} mm</span>
                </div>
              </>
            )}

            {/* MOUNTING SPECIFIC */}
            {machine.category === "mounting" && machine.mountingSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Kashirovka Formati (Min / Max):</span>
                  <span className="font-medium text-foreground">
                    {machine.mountingSpecs.minSheetMm} — {machine.mountingSpecs.maxSheetMm}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Yelimlash Turi:</span>
                  <span className="font-medium text-foreground">{machine.mountingSpecs.glueType}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Asosiy Qatlam Materiali:</span>
                  <span className="font-medium text-foreground">{machine.mountingSpecs.baseSubstrate}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Ustki Layner Qog'ozi:</span>
                  <span className="font-medium text-foreground">{machine.mountingSpecs.topSheetGrammage}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Qo'shish Aniqligi (Accuracy):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {machine.mountingSpecs.accuracyMm}
                  </span>
                </div>
              </>
            )}

            {/* CASING-IN SPECIFIC */}
            {machine.category === "casing-in" && machine.casingInSpecs && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Kitob Blok Formati:</span>
                  <span className="font-medium text-foreground">{machine.casingInSpecs.maxBookFormatMm}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Kushatka Isitish Stansiyalari:</span>
                  <span className="font-medium text-foreground">{machine.casingInSpecs.jointFormingStations} ta isitiladigan press</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Lenta Qadash (Bookmark ribbon):</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {machine.casingInSpecs.ribbonInserting ? "Avtomatlashtirilgan" : "Qo'lda"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Kaptal Yopishtirish Mexanizmi:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {machine.casingInSpecs.headBandAttachment ? "Mavjud" : "Yo'q"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Production Notes Alert / Banner */}
      {machine.notes && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs flex items-start gap-2.5 shadow-xs">
          <Activity className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Texnologik Ko'rsatma / Izoh: </span>
            <span className="text-muted-foreground">{machine.notes}</span>
          </div>
        </div>
      )}
    </div>
  );
}
