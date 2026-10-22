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
    <div className="bg-card border border-border rounded-md shadow-2xs overflow-hidden space-y-0 text-xs shrink-0 transition-all">
      {/* ── COMPACT COLLAPSIBLE HEADER BAR ── */}
      <div
        className={cn(
          "px-2 py-1 bg-muted/40 flex items-center justify-between transition-colors text-xs",
          isExpanded && "border-b border-border bg-muted/60"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none flex-1">
          <div className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Printer className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="font-semibold text-foreground text-[11px]">
              Bosma Rejasi:
            </span>
            <Badge variant="outline" className="font-mono text-[9px] font-bold h-4 px-1">
              {plan.colorNotation} ({plan.totalUniqueInks} rang)
            </Badge>
          </div>

          {/* Active Turn Scheme Pill */}
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] font-medium h-4 px-1 shrink-0 hidden sm:inline-flex",
              plan.activeMethod === "work_and_turn" &&
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
            )}
          >
            {plan.activeMethod === "work_and_turn"
              ? "O'ziga aylanma"
              : plan.activeMethod === "sheetwise"
              ? "Alohida (4+4)"
              : "Bir tomonlama (4+0)"}
          </Badge>

          {/* Quick Metrics Summary Strip */}
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground shrink-0">
            <span>·</span>
            <span><strong className="text-foreground">{plan.totalCtpPlates}</strong> CTP</span>
            <span>·</span>
            <span><strong className="text-primary">{plan.grossPressSheets.toLocaleString()}</strong> varaq</span>
            <span>·</span>
            <span><strong className="text-foreground">{plan.totalImpressions.toLocaleString()}</strong> progon (~{plan.totalPressHours}s)</span>
            <span>·</span>
            <span><strong className="text-foreground">{plan.totalPaperWeightKg}</strong> kg</span>
            <span>·</span>
            <span className="text-foreground font-semibold">${plan.totalDirectProductionCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {!isOperator && onApplyRouteToOperations && (
            <Button
              type="button"
              size="sm"
              onClick={handleApplyRoute}
              className={cn(
                "h-6 px-2 text-[10px] gap-1 font-medium transition-all cursor-pointer shadow-none",
                isApplied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              {isApplied ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Tatbiq etildi!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden sm:inline">Operatsiyalarga tatbiq</span>
                </>
              )}
            </Button>
          )}

          {/* Accordion Expand / Collapse Toggle Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-1.5 text-[10px] gap-0.5 text-foreground hover:bg-muted cursor-pointer"
            title={isExpanded ? "Yig'ish" : "Tafsilotlar"}
          >
            <span className="hidden sm:inline">{isExpanded ? "Yashirish" : "Tafsilot"}</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* ── EXPANDABLE DETAILED PLANNING ACCORDION (ULTRA-COMPACT) ── */}
      {isExpanded && (
        <div className="p-2 space-y-1.5 text-[11px] animate-in fade-in-50 duration-150 bg-background/50 border-t border-border">
          {/* Row 1: Front vs Back Color Breakdown in a Single Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {/* Old Taraf (Front Side) */}
            <div className="px-2 py-1 rounded border border-border bg-muted/20 flex items-center justify-between gap-1 text-[10px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-foreground">Oldi (Front):</span>
                <span className="text-muted-foreground font-mono">{plan.frontTotalColors} rang</span>
                <div className="flex items-center gap-0.5">
                  {frontColors.c && <span className="px-1 py-0.2 rounded bg-cyan-500 text-white font-mono font-bold text-[9px]">C</span>}
                  {frontColors.m && <span className="px-1 py-0.2 rounded bg-pink-500 text-white font-mono font-bold text-[9px]">M</span>}
                  {frontColors.y && <span className="px-1 py-0.2 rounded bg-amber-400 text-black font-mono font-bold text-[9px]">Y</span>}
                  {frontColors.k && <span className="px-1 py-0.2 rounded bg-zinc-900 text-white font-mono font-bold text-[9px]">K</span>}
                  {plan.frontProcessCount === 0 && <span className="text-muted-foreground italic text-[9px]">0 CMYK</span>}
                </div>
                {frontSpots.length > 0 && (
                  <div className="flex items-center gap-1 truncate">
                    {frontSpots.map((spot) => (
                      <span key={spot.id} className="px-1 py-0.2 rounded border border-border font-mono text-[9px] bg-background">
                        {spot.code || spot.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="font-mono font-bold text-primary shrink-0">
                {plan.frontPlates} CTP
              </span>
            </div>

            {/* Orqa Taraf (Back Side) */}
            <div className="px-2 py-1 rounded border border-border bg-muted/20 flex items-center justify-between gap-1 text-[10px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-foreground">Orqa (Back):</span>
                <span className="text-muted-foreground font-mono">{plan.backTotalColors} rang</span>
                <div className="flex items-center gap-0.5">
                  {backColors.c && <span className="px-1 py-0.2 rounded bg-cyan-500 text-white font-mono font-bold text-[9px]">C</span>}
                  {backColors.m && <span className="px-1 py-0.2 rounded bg-pink-500 text-white font-mono font-bold text-[9px]">M</span>}
                  {backColors.y && <span className="px-1 py-0.2 rounded bg-amber-400 text-black font-mono font-bold text-[9px]">Y</span>}
                  {backColors.k && <span className="px-1 py-0.2 rounded bg-zinc-900 text-white font-mono font-bold text-[9px]">K</span>}
                  {plan.backProcessCount === 0 && <span className="text-muted-foreground italic text-[9px]">0 CMYK</span>}
                </div>
                {backSpots.length > 0 && (
                  <div className="flex items-center gap-1 truncate">
                    {backSpots.map((spot) => (
                      <span key={spot.id} className="px-1 py-0.2 rounded border border-border font-mono text-[9px] bg-background">
                        {spot.code || spot.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="font-mono font-bold text-primary shrink-0">
                {plan.activeMethod === "work_and_turn" ? "0 (Aylanma)" : `${plan.backPlates} CTP`}
              </span>
            </div>
          </div>

          {/* Row 2: Turn Scheme Segmented Buttons (Height 26px instead of 80px cards!) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1 p-1 rounded border border-border bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground px-1 uppercase tracking-wide shrink-0">
              Bosma Usuli:
            </span>
            <div className="grid grid-cols-3 gap-1 flex-1">
              <button
                type="button"
                disabled={isOperator || plan.backTotalColors > 0}
                onClick={() => onPrintMethodChange("single_sided")}
                className={cn(
                  "h-6 px-1.5 rounded text-[10px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1 border",
                  plan.activeMethod === "single_sided"
                    ? "bg-primary text-primary-foreground font-semibold border-primary shadow-2xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground",
                  plan.backTotalColors > 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                <span>Bir tomonlama (4+0)</span>
              </button>

              <button
                type="button"
                disabled={isOperator}
                onClick={() => onPrintMethodChange("sheetwise")}
                className={cn(
                  "h-6 px-1.5 rounded text-[10px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1 border",
                  plan.activeMethod === "sheetwise"
                    ? "bg-primary text-primary-foreground font-semibold border-primary shadow-2xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Alohida (4+4)</span>
              </button>

              <button
                type="button"
                disabled={isOperator}
                onClick={() => onPrintMethodChange("work_and_turn")}
                className={cn(
                  "h-6 px-1.5 rounded text-[10px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1 border",
                  plan.activeMethod === "work_and_turn"
                    ? "bg-emerald-600 text-white font-semibold border-emerald-600 shadow-2xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span>O&apos;ziga aylanma (W&T)</span>
                <span className="text-[8px] px-1 bg-emerald-500 text-white rounded font-bold">TEJAM</span>
              </button>
            </div>
          </div>

          {/* Row 3: Key Calculations KPI Matrix in a Single 24px Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-[10px]">
            <div className="px-2 py-1 rounded bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-muted-foreground font-sans">CTP:</span>
              <strong className="text-foreground">{plan.totalCtpPlates} ta forma</strong>
            </div>
            <div className="px-2 py-1 rounded bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-muted-foreground font-sans">Varaq:</span>
              <strong className="text-primary">{plan.grossPressSheets.toLocaleString()} ({plan.netPressSheets}+ {plan.totalWasteSheets})</strong>
            </div>
            <div className="px-2 py-1 rounded bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-muted-foreground font-sans">Progon:</span>
              <strong className="text-foreground">{plan.totalImpressions.toLocaleString()} (~{plan.totalPressHours}s)</strong>
            </div>
            <div className="px-2 py-1 rounded bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-muted-foreground font-sans">Xomashyo:</span>
              <strong className="text-foreground">{plan.requiredParentSheets.toLocaleString()} v ({plan.totalPaperWeightKg}kg)</strong>
            </div>
          </div>

          {/* Row 4: Waste and Direct Smetasi (Cost Estimation Bar) */}
          <div className="px-2 py-0.5 rounded bg-muted/20 border border-border flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-sans">Chiqindi:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                +{plan.totalWasteSheets} v ({plan.totalWastePercent}%)
              </span>
              <span>·</span>
              <span className="text-muted-foreground font-sans">Qog&apos;oz:</span>
              <span className="text-foreground">{plan.totalPaperWeightKg} kg</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-sans">Tannarx:</span>
              <strong className="text-foreground text-[11px]">${plan.totalDirectProductionCost.toLocaleString()}</strong>
              <span className="text-muted-foreground">(${plan.costPerFinishedUnit}/dona)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
