"use client";

import React, { useState } from "react";
import {
  Printer,
  Layers,
  Cpu,
  Clock,
  Sparkles,
  Boxes,
  RotateCw,
  Check,
  CheckCircle2,
  FileCheck,
  ArrowRight,
  TrendingUp,
  Percent,
  FileText,
  Weight,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  PrintMethod,
  PrintPlanningResult,
  generateRouteStepsFromPlan,
} from "@/components/documents/work-order/planningEngine";
import { SideColorConfig, SpotColorItem, RouteStep } from "@/components/documents/work-order/types";

interface PrintPlanningCardProps {
  plan: PrintPlanningResult;
  onPrintMethodChange: (method: PrintMethod) => void;
  onApplyRouteToOperations?: (steps: RouteStep[]) => void;
  frontColors: SideColorConfig;
  backColors: SideColorConfig;
  spotColors: SpotColorItem[];
  targetQuantity: number;
  pressMachine?: string;
  lamination?: string;
  embellishment?: string;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
}

export function PrintPlanningCard({
  plan,
  onPrintMethodChange,
  onApplyRouteToOperations,
  frontColors,
  backColors,
  spotColors,
  targetQuantity,
  pressMachine = "Heidelberg Speedmaster XL 106",
  lamination,
  embellishment,
  isOperator = false,
  onSwitchTab,
}: PrintPlanningCardProps) {
  const [isApplied, setIsApplied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const frontSpots = spotColors.filter((s) => s.side === "front" || s.side === "both");
  const backSpots = spotColors.filter((s) => s.side === "back" || s.side === "both");

  return (
    <div className="bg-card border border-border rounded-lg shadow-2xs overflow-hidden space-y-0 text-xs shrink-0 transition-all">
      {/* ── COMPACT COLLAPSIBLE HEADER BAR ── */}
      <div
        className={cn(
          "p-2.5 bg-muted/40 flex items-center justify-between transition-colors",
          isExpanded && "border-b border-border bg-muted/60"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-foreground text-xs">
              Bosma & Rejalashtirish Markazi
            </span>
            <Badge variant="outline" className="font-mono text-[10px] font-bold h-5 px-1.5">
              {plan.colorNotation} ({plan.totalUniqueInks} rang)
            </Badge>
          </div>

          {/* Active Turn Scheme Pill */}
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-medium h-5 px-1.5 shrink-0 hidden sm:inline-flex",
              plan.activeMethod === "work_and_turn" &&
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
            )}
          >
            {plan.activeMethod === "work_and_turn"
              ? "O'ziga aylanma (Work & Turn)"
              : plan.activeMethod === "sheetwise"
              ? "Alohida formalardan (4+4)"
              : "Bir tomonlama (4+0)"}
          </Badge>

          {/* Quick Metrics Summary Strip (Visible when collapsed or expanded) */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground shrink-0">
            <span className="text-border">|</span>
            <span>
              <strong className="text-foreground">{plan.totalCtpPlates}</strong> CTP
            </span>
            <span>•</span>
            <span>
              <strong className="text-primary">{plan.grossPressSheets.toLocaleString()}</strong> varaq
            </span>
            <span>•</span>
            <span>
              <strong className="text-foreground">{plan.totalImpressions.toLocaleString()}</strong> progon (~{plan.totalPressHours}s)
            </span>
            <span>•</span>
            <span>
              <strong className="text-foreground">{plan.totalPaperWeightKg}</strong> kg
            </span>
            <span>•</span>
            <span className="text-foreground font-semibold">
              ${plan.totalDirectProductionCost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!isOperator && onApplyRouteToOperations && (
            <Button
              type="button"
              size="sm"
              onClick={handleApplyRoute}
              className={cn(
                "h-7 px-2.5 text-xs gap-1.5 font-medium transition-all cursor-pointer shadow-none",
                isApplied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              {isApplied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Marshrutga yuborildi!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Operatsiyalarga tatbiq etish</span>
                </>
              )}
            </Button>
          )}

          {/* Accordion Expand / Collapse Toggle Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2 text-xs gap-1 text-foreground hover:bg-muted cursor-pointer"
            title={isExpanded ? "Yig'ish" : "Tafsilotlarni ochish"}
          >
            <span className="text-[11px] font-medium hidden sm:inline">
              {isExpanded ? "Yashirish" : "Tafsilotlar"}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* ── EXPANDABLE DETAILED PLANNING ACCORDION ── */}
      {isExpanded && (
        <div className="p-3 space-y-3 animate-in fade-in-50 duration-150">
        {/* Row 1: Front vs Back Color Breakdown Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Old Taraf (Front Side) */}
          <div className="p-2.5 rounded-md border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground text-xs">Old tomon (Front / Лицо)</span>
                <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                  {plan.frontTotalColors} ta rang
                </Badge>
              </div>
              <span className="font-mono text-[11px] font-bold text-primary">
                {plan.frontPlates} ta CTP
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1">
                {frontColors.c && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-white font-mono font-bold text-[10px]">
                    C
                  </span>
                )}
                {frontColors.m && (
                  <span className="px-1.5 py-0.5 rounded bg-pink-500 text-white font-mono font-bold text-[10px]">
                    M
                  </span>
                )}
                {frontColors.y && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-mono font-bold text-[10px]">
                    Y
                  </span>
                )}
                {frontColors.k && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono font-bold text-[10px]">
                    K
                  </span>
                )}
                {plan.frontProcessCount === 0 && (
                  <span className="text-muted-foreground text-[10px] italic">0 CMYK</span>
                )}
              </div>

              {frontSpots.length > 0 && (
                <div className="flex items-center gap-1">
                  {frontSpots.map((spot) => (
                    <span
                      key={spot.id}
                      className="px-1.5 py-0.5 rounded border border-border font-mono text-[10px] font-medium flex items-center gap-1 bg-background"
                      title={spot.name}
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: spot.hex }}
                      />
                      <span className="truncate max-w-[65px]">{spot.code || spot.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Orqa Taraf (Back Side) */}
          <div className="p-2.5 rounded-md border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground text-xs">Orqa tomon (Back / Оборот)</span>
                <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                  {plan.backTotalColors} ta rang
                </Badge>
              </div>
              <span className="font-mono text-[11px] font-bold text-primary">
                {plan.activeMethod === "work_and_turn"
                  ? "0 (Aylanma)"
                  : `${plan.backPlates} ta CTP`}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1">
                {backColors.c && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-white font-mono font-bold text-[10px]">
                    C
                  </span>
                )}
                {backColors.m && (
                  <span className="px-1.5 py-0.5 rounded bg-pink-500 text-white font-mono font-bold text-[10px]">
                    M
                  </span>
                )}
                {backColors.y && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-mono font-bold text-[10px]">
                    Y
                  </span>
                )}
                {backColors.k && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono font-bold text-[10px]">
                    K
                  </span>
                )}
                {plan.backProcessCount === 0 && (
                  <span className="text-muted-foreground text-[10px] italic">0 CMYK</span>
                )}
              </div>

              {backSpots.length > 0 && (
                <div className="flex items-center gap-1">
                  {backSpots.map((spot) => (
                    <span
                      key={spot.id}
                      className="px-1.5 py-0.5 rounded border border-border font-mono text-[10px] font-medium flex items-center gap-1 bg-background"
                      title={spot.name}
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: spot.hex }}
                      />
                      <span className="truncate max-w-[65px]">{spot.code || spot.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Print Method Selector */}
        <div className="p-2.5 rounded-md border border-border bg-background space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Bosma Usuli va Forma Montaji (Turn Scheme)
            </span>
            {plan.savedPlatesFromWorkAndTurn > 0 && (
              <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-medium">
                +{plan.savedPlatesFromWorkAndTurn} CTP tejab qolindi (O&apos;ziga aylanma)
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Option 1: Single Sided */}
            <button
              type="button"
              disabled={isOperator || plan.backTotalColors > 0}
              onClick={() => onPrintMethodChange("single_sided")}
              className={cn(
                "p-2 rounded-md border text-left transition-all cursor-pointer space-y-1",
                plan.activeMethod === "single_sided"
                  ? "bg-primary/5 border-primary ring-1 ring-primary/20 text-foreground"
                  : "bg-muted/10 border-border hover:bg-muted/30 text-muted-foreground",
                plan.backTotalColors > 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground">Bir tomonlama (4+0 / 1+0)</span>
                {plan.activeMethod === "single_sided" && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Faqat old tomon bosiladi. 1 ta bosma pass, {plan.frontTotalColors} ta CTP forma.
              </p>
            </button>

            {/* Option 2: Sheetwise */}
            <button
              type="button"
              disabled={isOperator}
              onClick={() => onPrintMethodChange("sheetwise")}
              className={cn(
                "p-2 rounded-md border text-left transition-all cursor-pointer space-y-1",
                plan.activeMethod === "sheetwise"
                  ? "bg-primary/5 border-primary ring-1 ring-primary/20 text-foreground"
                  : "bg-muted/10 border-border hover:bg-muted/30 text-muted-foreground"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground">Alohida formalardan (4+4)</span>
                {plan.activeMethod === "sheetwise" && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Oldi va orqasi alohida formalar. 2 pass, jami {plan.frontTotalColors + plan.backTotalColors} ta CTP forma.
              </p>
            </button>

            {/* Option 3: Work & Turn */}
            <button
              type="button"
              disabled={isOperator}
              onClick={() => onPrintMethodChange("work_and_turn")}
              className={cn(
                "p-2 rounded-md border text-left transition-all cursor-pointer space-y-1",
                plan.activeMethod === "work_and_turn"
                  ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/20 text-foreground"
                  : "bg-muted/10 border-border hover:bg-muted/30 text-muted-foreground"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                  <span>O&apos;ziga aylanma (Work & Turn)</span>
                  <span className="text-[9px] px-1 py-0.2 bg-emerald-500 text-white rounded font-bold font-mono">
                    TEJAM
                  </span>
                </span>
                {plan.activeMethod === "work_and_turn" && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                1 komplekt forma ({plan.totalCtpPlates} ta CTP). Varaq aylanib 2 marta bosiladi va kesiladi.
              </p>
            </button>
          </div>
        </div>

        {/* Row 3: Key Calculations KPI Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
          {/* CTP Plates */}
          <div className="p-2 rounded-md bg-muted/30 border border-border space-y-0.5">
            <span className="text-[10px] font-sans uppercase font-semibold text-muted-foreground block">
              CTP Formalar
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-foreground">{plan.totalCtpPlates}</span>
              <span className="text-[10px] font-sans text-muted-foreground">ta forma</span>
            </div>
            <p className="text-[10px] font-sans text-muted-foreground truncate">
              {plan.activeMethod === "work_and_turn"
                ? "1 ta komplekt (Front+Back)"
                : `${plan.frontPlates} oldi + ${plan.backPlates} orqa`}
            </p>
          </div>

          {/* Press Sheets (Gross) */}
          <div className="p-2 rounded-md bg-muted/30 border border-border space-y-0.5">
            <span className="text-[10px] font-sans uppercase font-semibold text-muted-foreground block">
              Bosma Varaqlari (Brutto)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-primary">
                {plan.grossPressSheets.toLocaleString()}
              </span>
              <span className="text-[10px] font-sans text-muted-foreground">varaq</span>
            </div>
            <p className="text-[10px] font-sans text-muted-foreground truncate">
              Netto: {plan.netPressSheets.toLocaleString()} (+{plan.totalWasteSheets} chiqindi)
            </p>
          </div>

          {/* Machine Passes & Time */}
          <div className="p-2 rounded-md bg-muted/30 border border-border space-y-0.5">
            <span className="text-[10px] font-sans uppercase font-semibold text-muted-foreground block">
              Stanok Progon & Vaqt
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-foreground">
                {plan.totalImpressions.toLocaleString()}
              </span>
              <span className="text-[10px] font-sans text-muted-foreground">progon</span>
            </div>
            <p className="text-[10px] font-sans text-muted-foreground truncate">
              ~{plan.totalPressHours} soat ({plan.pressPasses} pass)
            </p>
          </div>

          {/* Raw Parent Stock Needed */}
          <div className="p-2 rounded-md bg-muted/30 border border-border space-y-0.5">
            <span className="text-[10px] font-sans uppercase font-semibold text-muted-foreground block">
              Ombor Xomashyosi
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-foreground">
                {plan.requiredParentSheets.toLocaleString()}
              </span>
              <span className="text-[10px] font-sans text-muted-foreground">katta varaq</span>
            </div>
            <p className="text-[10px] font-sans text-muted-foreground truncate">
              {plan.totalPaperWeightKg} kg (1 varaqdan {plan.pressSheetsPerParent} ta)
            </p>
          </div>
        </div>

        {/* Row 4: Waste and Direct Smetasi (Cost Estimation Bar) */}
        <div className="p-2 rounded-md bg-muted/20 border border-border flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Priladka & Chiqindi:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                +{plan.totalWasteSheets} varaq ({plan.totalWastePercent}%)
              </span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Qog&apos;oz og&apos;irligi:</span>
              <span className="font-mono font-semibold text-foreground">
                {plan.totalPaperWeightKg} kg
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-muted-foreground font-sans">Rejali to&apos;g&apos;ri tannarx:</span>
            <span className="font-bold text-foreground text-xs">
              ${plan.totalDirectProductionCost.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">
              (${plan.costPerFinishedUnit}/dona)
            </span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
