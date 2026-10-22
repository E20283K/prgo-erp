"use client";

import React, { useState } from "react";
import {
  Printer,
  Sparkles,
  FlaskConical,
  CheckCircle2,
  Check,
  Layers,
  Clock,
  Boxes,
  FileCheck,
  TrendingUp,
  Percent,
  Weight,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PrintMethod,
  PrintPlanningResult,
  generateRouteStepsFromPlan,
} from "@/components/documents/work-order/planningEngine";
import {
  SideColorConfig,
  SpotColorItem,
  RouteStep,
} from "@/components/documents/work-order/types";
import { InfoTooltip } from "../components/InfoTooltip";

interface PrintEconomicsPanelProps {
  plan: PrintPlanningResult;
  onPrintMethodChange: (method: PrintMethod) => void;
  onApplyRouteToOperations?: (steps: RouteStep[]) => void;
  frontColors: SideColorConfig;
  backColors: SideColorConfig;
  spotColors: SpotColorItem[];
  pressMachine?: string;
  lamination?: string;
  embellishment?: string;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
}

export function PrintEconomicsPanel({
  plan,
  onPrintMethodChange,
  onApplyRouteToOperations,
  frontColors,
  backColors,
  spotColors,
  pressMachine = "Heidelberg Speedmaster XL 106",
  lamination,
  embellishment,
  isOperator = false,
  onSwitchTab,
}: PrintEconomicsPanelProps) {
  const [isApplied, setIsApplied] = useState(false);

  const handleApplyRoute = () => {
    if (!onApplyRouteToOperations) return;
    const generatedSteps = generateRouteStepsFromPlan(
      plan,
      pressMachine,
      lamination,
      embellishment
    );
    onApplyRouteToOperations(generatedSteps);
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 3000);
  };

  const frontSpots = spotColors.filter(
    (s) => s.side === "front" || s.side === "both"
  );
  const backSpots = spotColors.filter(
    (s) => s.side === "back" || s.side === "both"
  );

  return (
    <div className="flex-1 overflow-y-auto space-y-4 max-w-5xl mx-auto w-full p-1 text-xs">
      {/* ── TOP BANNER: MACHINE & ROUTE ACTIONS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border border-border rounded-lg shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span>{pressMachine}</span>
              <Badge variant="outline" className="font-mono text-xs font-bold">
                {plan.colorNotation} ({plan.totalUniqueInks} rang)
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Bosma usuli va smeta hisob-kitoblari
            </p>
          </div>
        </div>

        {/* Action Button: Apply to operations OR Simulation indicator */}
        {!isOperator && onApplyRouteToOperations ? (
          <Button
            type="button"
            size="sm"
            onClick={handleApplyRoute}
            className={cn(
              "h-8 px-3.5 text-xs gap-1.5 font-medium transition-all cursor-pointer shadow-xs",
              isApplied
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
          >
            {isApplied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Marshrut operatsiyalariga tatbiq etildi!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Marshrut operatsiyalariga tatbiq etish</span>
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
            <span>Faqat reja &amp; simulyatsiya (Real hisobga ta&apos;sir qilmaydi)</span>
          </div>
        )}
      </div>

      {/* ── SECTION 1: BOSMA USULI VA MONTAJI (TURN SCHEME) ── */}
      <div className="bg-card border border-border rounded-lg p-3.5 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            <span>Bosma Usuli va Montaji (Turn Scheme)</span>
            <InfoTooltip
              title="Bosma usuli va montaji (Turn Scheme)"
              description="Chop etish tartibini tanlash: bir tomonli (4+0), alohida formalardan (4+4) yoki o'ziga aylanma (Work & Turn). Bu CTP formalar soni va bosma passlariga bevosita ta'sir qiladi."
            />
          </span>
          {plan.savedPlatesFromWorkAndTurn > 0 && (
            <Badge
              variant="outline"
              className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-medium"
            >
              +{plan.savedPlatesFromWorkAndTurn} CTP tejab qolindi (O&apos;ziga aylanma)
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Option 1: Single Sided */}
          <button
            type="button"
            disabled={isOperator || plan.backTotalColors > 0}
            onClick={() => onPrintMethodChange("single_sided")}
            className={cn(
              "p-3 rounded-lg border text-left transition-all cursor-pointer space-y-1.5",
              plan.activeMethod === "single_sided"
                ? "bg-primary/5 border-primary ring-1 ring-primary/20 text-foreground"
                : "bg-muted/10 border-border hover:bg-muted/30 text-muted-foreground",
              plan.backTotalColors > 0 && "opacity-40 cursor-not-allowed"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                <span>Bir tomonlama (4+0 / 1+0)</span>
                <InfoTooltip
                  title="Bir tomonlama chop etish"
                  description="Faqat qog'ozning bir tomoniga chop etiladi. Orqa tomoni toza oq qoladi. 1 ta bosma pass talab qilinadi."
                />
              </span>
              {plan.activeMethod === "single_sided" && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Faqat old tomon bosiladi. 1 ta bosma pass, {plan.frontTotalColors} ta CTP forma.
            </p>
          </button>

          {/* Option 2: Sheetwise */}
          <button
            type="button"
            disabled={isOperator}
            onClick={() => onPrintMethodChange("sheetwise")}
            className={cn(
              "p-3 rounded-lg border text-left transition-all cursor-pointer space-y-1.5",
              plan.activeMethod === "sheetwise"
                ? "bg-primary/5 border-primary ring-1 ring-primary/20 text-foreground"
                : "bg-muted/10 border-border hover:bg-muted/30 text-muted-foreground"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                <span>Alohida formalardan (4+4)</span>
                <InfoTooltip
                  title="Alohida formalardan chop etish (Sheetwise)"
                  description="Oldi va orqasi mutlaqo mustaqil dizaynga ega bo'lganda, ikkita alohida CTP to'plami bilan ikki bosqichda chop etiladi."
                />
              </span>
              {plan.activeMethod === "sheetwise" && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Oldi va orqasi alohida formalar. 2 pass, jami{" "}
              {plan.frontTotalColors + plan.backTotalColors} ta CTP forma.
            </p>
          </button>

          {/* Option 3: Work & Turn */}
          <button
            type="button"
            disabled={isOperator}
            onClick={() => onPrintMethodChange("work_and_turn")}
            className={cn(
              "p-3 rounded-lg border text-left transition-all cursor-pointer space-y-1.5",
              plan.activeMethod === "work_and_turn"
                ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/20 text-foreground"
                : "bg-muted/10 border-border hover:bg-muted/30 text-muted-foreground"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <span>O&apos;ziga aylanma (Work & Turn)</span>
                <span className="text-[9px] px-1 py-0.2 bg-emerald-500 text-white rounded font-bold font-mono">
                  TEJAM
                </span>
                <InfoTooltip
                  title="O'ziga aylanma (Work & Turn / Свой оборот)"
                  description="Bitta qolipda oldi va orqa tomon yonma-yon joylashtiriladi. List bir tomoni bosilib, so'ng teskari aylantirilib ikkinchi tomoni o'sha qolipdan bosiladi. CTP formalar sonini 2 barobar tejaydi!"
                />
              </span>
              {plan.activeMethod === "work_and_turn" && (
                <Check className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              1 komplekt forma ({plan.totalCtpPlates} ta CTP). Varaq aylanib 2 marta bosiladi va o&apos;rtasidan kesiladi.
            </p>
          </button>
        </div>
      </div>

      {/* ── SECTION 2: RANGLAR STANSIYALARI (INK STATIONS) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Old tomon (Front) */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-foreground">
              Old tomon (Front / Лицо)
            </span>
            <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
              {plan.frontPlates} ta CTP
            </Badge>
          </div>

          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Process:</span>
              {frontColors.c && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-white font-mono font-bold text-xs">
                  C
                </span>
              )}
              {frontColors.m && (
                <span className="px-1.5 py-0.5 rounded bg-pink-500 text-white font-mono font-bold text-xs">
                  M
                </span>
              )}
              {frontColors.y && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-mono font-bold text-xs">
                  Y
                </span>
              )}
              {frontColors.k && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono font-bold text-xs">
                  K
                </span>
              )}
              {plan.frontProcessCount === 0 && (
                <span className="text-muted-foreground text-xs italic">0 CMYK</span>
              )}
            </div>

            {frontSpots.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Pantone:</span>
                {frontSpots.map((spot) => (
                  <span
                    key={spot.id}
                    className="px-2 py-0.5 rounded border border-border font-mono text-xs font-medium flex items-center gap-1.5 bg-background"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: spot.hex }}
                    />
                    <span>{spot.code || spot.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Orqa tomon (Back) */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-foreground">
              Orqa tomon (Back / Оборот)
            </span>
            <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
              {plan.activeMethod === "work_and_turn"
                ? "0 (Aylanma)"
                : `${plan.backPlates} ta CTP`}
            </Badge>
          </div>

          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Process:</span>
              {backColors.c && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-white font-mono font-bold text-xs">
                  C
                </span>
              )}
              {backColors.m && (
                <span className="px-1.5 py-0.5 rounded bg-pink-500 text-white font-mono font-bold text-xs">
                  M
                </span>
              )}
              {backColors.y && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-mono font-bold text-xs">
                  Y
                </span>
              )}
              {backColors.k && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono font-bold text-xs">
                  K
                </span>
              )}
              {plan.backProcessCount === 0 && (
                <span className="text-muted-foreground text-xs italic">0 CMYK</span>
              )}
            </div>

            {backSpots.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Pantone:</span>
                {backSpots.map((spot) => (
                  <span
                    key={spot.id}
                    className="px-2 py-0.5 rounded border border-border font-mono text-xs font-medium flex items-center gap-1.5 bg-background"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: spot.hex }}
                    />
                    <span>{spot.code || spot.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: ASOSIY HISOB-KITOB STATISTIKALARI (PRODUCTION KPIS) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* CTP Formalar */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
            <span>CTP Formalar</span>
            <InfoTooltip
              title="CTP Formalar va Plastinalar"
              description="Chop etish uchun CTP apparatida ochiladigan metall alyuminiy plastinalar soni. Bir tomonlama (4+0) bo'lsa 4 ta, ikki tomonlama (4+4) bo'lsa 8 ta CTP talab qilinadi."
            />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground font-mono">
              {plan.totalCtpPlates}
            </span>
            <span className="text-xs text-muted-foreground">ta qolip</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {plan.activeMethod === "work_and_turn"
              ? "1 ta komplekt (Front+Back)"
              : `${plan.frontPlates} oldi + ${plan.backPlates} orqa`}
          </p>
        </div>

        {/* Bosma varaqlari */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
            <span>Bosma Varaqlari (Brutto)</span>
            <InfoTooltip
              title="Jami Bosma Varaqlari (Brutto)"
              description="Buyurtmani to'liq chiqarish uchun mashinaga kiritiladigan jami qog'oz varaqlari soni (sof tiraj + priladka va texnik chiqindi)."
              formula="Brutto = Netto listlar + Chiqindi varaqlari"
            />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-primary font-mono">
              {plan.grossPressSheets.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">varaq</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Netto: {plan.netPressSheets.toLocaleString()} (+{plan.totalWasteSheets} chiqindi)
          </p>
        </div>

        {/* Stanok progoni va vaqti */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
            <span>Stanok Progon & Vaqt</span>
            <InfoTooltip
              title="Mashina Progonlari va Vaqti"
              description="Bosma sektsiyalaridan varaqlar o'tishlarining umumiy soni (impressions) va tayyorgarlik (priladka) bilan birga mashinaning umumiy ish soati."
            />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground font-mono">
              {plan.totalImpressions.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">progon</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ~{plan.totalPressHours} soat ({plan.pressPasses} pass)
          </p>
        </div>

        {/* Ombor xomashyosi */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-1 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
            <span>Ombor Xomashyosi</span>
            <InfoTooltip
              title="Ombor Katta Varaqlari (Parent Sheets)"
              description="Standart xom qog'oz listlaridan (masalan, 700×1000 mm) kesib olinadigan umumiy listlar soni va ularning umumiy sof og'irligi (kg)."
            />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-foreground font-mono">
              {plan.requiredParentSheets.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">katta varaq</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {plan.totalPaperWeightKg} kg (1 varaqdan {plan.pressSheetsPerParent} ta)
          </p>
        </div>
      </div>

      {/* ── SECTION 4: SMETA VA TANNARX HISOBI (FINANCIAL ESTIMATE) ── */}
      <div className="p-3.5 rounded-lg bg-card border border-border flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span>Priladka & Texnik Chiqindi:</span>
              <InfoTooltip
                title="Priladka va Texnik Chiqindi"
                description="Bo'yoqni tenglashtirish, qoliplarni registratsiya qilish (krestlarni to'g'rilash) va mashinani sozlash uchun ketadigan texnik chiqindi qog'ozlar soni va foizi."
              />
            </span>
            <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
              +{plan.totalWasteSheets} varaq ({plan.totalWastePercent}%)
            </span>
          </div>
          <div className="h-8 w-px bg-border/80" />
          <div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span>Qog&apos;oz og&apos;irligi:</span>
              <InfoTooltip
                title="Xomashyo Qog'oz Og'irligi (kg)"
                description="Buyurtma uchun kerak bo'lgan umumiy qog'oz xomashyosining fizik og'irligi (zichlik va maydon bo'yicha hisoblangan)."
              />
            </span>
            <span className="font-mono font-semibold text-sm text-foreground">
              {plan.totalPaperWeightKg} kg
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
              <span>Rejali to&apos;g&apos;ri tannarx:</span>
              <InfoTooltip
                title="To'g'ridan-to'g'ri ishlab chiqarish xarajati"
                description="Qog'oz sarfi, CTP qoliplari va mashina soati xarajatlarining umumiy summasi."
              />
            </span>
            <span className="font-bold text-base text-foreground font-mono">
              ${plan.totalDirectProductionCost.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="font-mono text-xs px-2 py-1">
              ${plan.costPerFinishedUnit}/dona
            </Badge>
            <InfoTooltip
              title="1 dona mahsulotning tannarxi"
              description="Jami to'g'ridan-to'g'ri xarajatning tayyor olinadigan sof mahsulotlar soniga nisbati."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
