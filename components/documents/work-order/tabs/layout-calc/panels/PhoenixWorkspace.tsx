"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Zap,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Table as TableIcon,
  Printer,
  Download,
  FileDown,
  ChevronDown,
  Info,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutCalcTabProps, CtpSideRelation, ActivePlateSide } from "../types";
import { useLayoutCalc } from "../useLayoutCalc";
import { SheetPreview } from "../preview/SheetPreview";
import { DimensionsSection } from "./DimensionsSection";
import { OverproductionSection } from "./OverproductionSection";
import { InfoTooltip } from "../components/InfoTooltip";

interface PhoenixWorkspaceProps {
  calc: ReturnType<typeof useLayoutCalc>;
  props: LayoutCalcTabProps;
}

export function PhoenixWorkspace({ calc, props }: PhoenixWorkspaceProps) {
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<"min_waste" | "min_plates" | "by_model">("min_waste");

  // Handle Quick AI Solution Selection
  const handleSelectPlan = (plan: "min_waste" | "min_plates" | "by_model") => {
    setSelectedPlanId(plan);
    if (plan === "min_waste") {
      calc.setOptimizerGoal("min_waste");
      calc.handleAutoPartitionPlates("smart_gang_optimizer");
    } else if (plan === "min_plates") {
      calc.setOptimizerGoal("min_plates");
      calc.handleAutoPartitionPlates("smart_gang_optimizer");
    } else if (plan === "by_model") {
      calc.handleAutoPartitionPlates("by_model");
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full text-xs overflow-hidden select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP AI SOLUTIONS BAR (PHOENIX IMPOSITION AI CARDS)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-card border border-border rounded-lg shadow-2xs shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">AI Rejalar:</span>
          </span>

          {/* Option 1: Minimal Chiqindi (Recommended) */}
          <button
            type="button"
            onClick={() => handleSelectPlan("min_waste")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer shrink-0",
              selectedPlanId === "min_waste"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500"
                : "bg-muted/40 hover:bg-muted text-foreground border-border"
            )}
          >
            <Sparkles className={cn("w-3.5 h-3.5", selectedPlanId === "min_waste" ? "text-amber-300" : "text-amber-500")} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs leading-none">1. Minimal Chiqindi</span>
                <span className={cn(
                  "text-[9px] px-1 py-0.2 rounded font-bold uppercase",
                  selectedPlanId === "min_waste" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                )}>
                  Tavsiya
                </span>
              </div>
              <p className={cn("text-[10px] mt-0.5 font-mono", selectedPlanId === "min_waste" ? "text-blue-100" : "text-muted-foreground")}>
                {calc.plates.length} forma · {calc.totalSheetsRun.toLocaleString()} list (+{calc.overallOverproductionPercent.toFixed(1)}%)
              </p>
            </div>
          </button>

          {/* Option 2: Minimal Formalar (Fast / Lower CTP) */}
          <button
            type="button"
            onClick={() => handleSelectPlan("min_plates")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer shrink-0",
              selectedPlanId === "min_plates"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500"
                : "bg-muted/40 hover:bg-muted text-foreground border-border"
            )}
          >
            <Zap className={cn("w-3.5 h-3.5", selectedPlanId === "min_plates" ? "text-amber-300" : "text-amber-500")} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs leading-none">2. Kamroq Qolip</span>
                <span className={cn(
                  "text-[9px] px-1 py-0.2 rounded font-mono",
                  selectedPlanId === "min_plates" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  Tezkor
                </span>
              </div>
              <p className={cn("text-[10px] mt-0.5", selectedPlanId === "min_plates" ? "text-blue-100" : "text-muted-foreground")}>
                CTP va priladka tejaladi
              </p>
            </div>
          </button>

          {/* Option 3: By Model */}
          {calc.hasMultipleModels && (
            <button
              type="button"
              onClick={() => handleSelectPlan("by_model")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer shrink-0",
                selectedPlanId === "by_model"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500"
                  : "bg-muted/40 hover:bg-muted text-foreground border-border"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <div>
                <span className="font-semibold text-xs leading-none">3. Modellar Bo&apos;yicha</span>
                <p className={cn("text-[10px] mt-0.5", selectedPlanId === "by_model" ? "text-blue-100" : "text-muted-foreground")}>
                  {calc.uniqueModelsCount} xil model alohida
                </p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN STAGE: LEFT PRODUCT POOL + CENTER VISUAL CANVAS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-2.5 min-h-0 overflow-hidden">
        {/* ── LEFT DOCK: ORDER ITEMS POOL (BUYURTMA O'LCHAMLARI) ── */}
        <div className="w-full md:w-[300px] shrink-0 bg-card border border-border rounded-lg flex flex-col overflow-hidden shadow-2xs">
          {/* Header */}
          <div className="p-2.5 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <span>Buyurtma Mahsulotlari</span>
              <Badge variant="outline" className="font-mono text-[10px] h-4.5 px-1.5">
                {calc.adjustedSizes.length} ta
              </Badge>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Joriy: Forma {calc.activePlateIndex + 1}
            </span>
          </div>

          {/* Scrollable Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 divide-y divide-border/40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {calc.adjustedSizes.length > 0 ? (
              calc.adjustedSizes.map((size) => {
                // Find assignment in the active plate
                const assignment = calc.activePlate.assignments.find((a) => a.sizeId === size.id);
                const currentSlots = assignment ? assignment.slots : 0;
                const isBottleneck =
                  currentSlots > 0 &&
                  Math.ceil(size.quantity / currentSlots) === calc.activePlate.requiredSheets;

                // Total slots across all plates
                const totalAllocatedSlots = calc.plates.reduce((sum, p) => {
                  return sum + (p.manualSlots[size.id] ?? 0);
                }, 0);

                return (
                  <div
                    key={size.id}
                    className={cn(
                      "pt-2 first:pt-0 space-y-1.5 rounded p-1.5 transition-colors",
                      currentSlots > 0 ? "bg-muted/30" : "opacity-75 hover:opacity-100"
                    )}
                  >
                    {/* Item Title & Ordered Quantity */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {size.size}
                        </span>
                        {isBottleneck && (
                          <span
                            className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold"
                            title="Tirajni belgilovchi o'lcham"
                          >
                            Asosiy
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-semibold text-foreground shrink-0">
                        {size.quantity.toLocaleString()} ta
                      </span>
                    </div>

                    {/* Active Plate Slot Controls & Multiplier Pills */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          Forma {calc.activePlateIndex + 1} dagi joy:
                        </span>
                        <div className="flex items-center bg-muted p-0.5 rounded border border-border">
                          {[0, 1, 2, 4].map((slotVal) => (
                            <button
                              key={slotVal}
                              type="button"
                              onClick={() =>
                                calc.handleSetSkuSlots(size.id, slotVal, calc.activePlateIndex)
                              }
                              className={cn(
                                "h-4.5 px-1.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer",
                                currentSlots === slotVal
                                  ? "bg-blue-600 text-white shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {slotVal === 0 ? "0" : `${slotVal}x`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Yield info if assigned */}
                      {currentSlots > 0 && assignment && (
                        <div className="text-right font-mono text-[10px] text-muted-foreground shrink-0">
                          <span className="font-semibold text-foreground">
                            {assignment.yieldQuantity?.toLocaleString()}
                          </span>
                          {assignment.overproduction !== undefined && assignment.overproduction > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                              (+{assignment.overproduction})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-muted-foreground text-xs italic">
                O&apos;lcham topilmadi.
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: THE INTERACTIVE VISUAL CANVAS ── */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 bg-card border border-border rounded-lg p-2 overflow-hidden shadow-2xs">
          {/* Canvas Top Bar: Plate Switcher, Side Switcher & Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-muted/40 border border-border rounded-md shrink-0">
            {/* Left: Forma Pager */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-card border border-border rounded shadow-2xs p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={calc.activePlateIndex <= 0}
                  onClick={() => calc.setActivePlateIndex((prev) => Math.max(0, prev - 1))}
                  title="Oldingi forma"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <div className="px-2 font-semibold text-xs text-foreground font-mono flex items-center gap-1">
                  <span>Forma {calc.activePlateIndex + 1} / {calc.plates.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={calc.activePlateIndex >= calc.plates.length - 1}
                  onClick={() => calc.setActivePlateIndex((prev) => Math.min(calc.plates.length - 1, prev + 1))}
                  title="Keyingi forma"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              <Badge variant="outline" className="h-6 px-2 text-[11px] font-mono bg-background font-semibold">
                {calc.activePlate.requiredSheets.toLocaleString()} list bosiladi
              </Badge>
            </div>

            {/* Center: Side Toggle (Oldi / Orqa) */}
            <div className="flex items-center bg-muted p-0.5 rounded border border-border text-xs">
              <button
                type="button"
                onClick={() => calc.setActiveSide("front")}
                className={cn(
                  "px-2.5 py-1 rounded font-semibold transition-all cursor-pointer",
                  calc.activeSide === "front"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Oldi (Front)
              </button>
              <button
                type="button"
                onClick={() => calc.setActiveSide("back")}
                className={cn(
                  "px-2.5 py-1 rounded font-semibold transition-all cursor-pointer",
                  calc.activeSide === "back"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Orqa (Back)
              </button>
            </div>

            {/* Right: Tools & Settings Drawer Toggle */}
            <div className="flex items-center gap-1.5">
              <Button
                onClick={calc.switchOrientation}
                variant="outline"
                size="sm"
                className="h-6.5 text-xs gap-1 px-2.5 bg-background cursor-pointer"
                title="Qolip orientatsiyasi (Portret / Albom)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{calc.orientation === "A" ? "Portret" : "Albom"}</span>
              </Button>

              <Button
                onClick={() => setIsSettingsDrawerOpen(!isSettingsDrawerOpen)}
                variant={isSettingsDrawerOpen ? "secondary" : "outline"}
                size="sm"
                className="h-6.5 text-xs gap-1.5 px-2.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{isSettingsDrawerOpen ? "Yopish" : "Qolip sozlamalari"}</span>
              </Button>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className="inline-flex items-center gap-1 h-6.5 px-2 rounded text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Eksport</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={calc.handleExportSVG} className="cursor-pointer">
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    <span>SVG vektor fayl</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => calc.handleExportPDF(false)} className="cursor-pointer">
                    <FileDown className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                    <span>Joriy forma PDF</span>
                  </DropdownMenuItem>
                  {calc.plates.length > 1 && (
                    <DropdownMenuItem onClick={() => calc.handleExportPDF(true)} className="cursor-pointer font-semibold">
                      <FileDown className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      <span>Barcha {calc.plates.length} ta forma PDF</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Body: Full Screen SVG Canvas + Optional Settings Drawer */}
          <div className="flex-1 flex gap-2 min-h-0 relative overflow-hidden">
            {/* The Big Visual Sheet Canvas */}
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-md border border-border p-2 flex flex-col overflow-hidden relative">
              <SheetPreview
                svgRef={calc.svgRef}
                calcMode={calc.calcMode}
                sheetW={calc.sheetW}
                sheetH={calc.sheetH}
                prodW={calc.prodW}
                prodH={calc.prodH}
                bleed={calc.bleed}
                gap={calc.gap}
                gripper={calc.gripper}
                docNo={props.docNo || "CO-NEW"}
                orderName={props.orderName || "Client Order"}
                activePlate={calc.activePlate}
                activePlateIndex={calc.activePlateIndex}
                plates={calc.plates}
                prepressMargins={calc.prepressMargins}
                layout={calc.layout}
                gridCells={calc.gridCells}
                outerTrimMarks={calc.outerTrimMarks}
                kashirovkaSummary={calc.kashirovkaSummary}
                shapeType={props.shapeType}
                customShape={props.customShape}
                customSvgPath={props.customSvgPath}
                cornerType={props.cornerType}
                artworkFront={props.artworkFront}
                artworkBack={props.artworkBack}
                activeSide={calc.activeSide}
              />
            </div>

            {/* Slide-over Settings Drawer */}
            {isSettingsDrawerOpen && (
              <div className="w-[280px] shrink-0 bg-card border border-border rounded-md p-2.5 overflow-y-auto space-y-3 animate-in slide-in-from-right-2 duration-150 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <span className="font-semibold text-xs text-foreground">
                    Qolip va List Parametrlari
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSettingsDrawerOpen(false)}
                    className="text-muted-foreground hover:text-foreground text-xs cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                </div>

                <OverproductionSection
                  mode={calc.overproductionMode}
                  onModeChange={calc.setOverproductionMode}
                  value={calc.overproductionValue}
                  onValueChange={calc.setOverproductionValue}
                />

                <DimensionsSection
                  sheetW={calc.sheetW}
                  setSheetW={calc.setSheetW}
                  sheetH={calc.sheetH}
                  setSheetH={calc.setSheetH}
                  prodW={calc.prodW}
                  prodH={calc.prodH}
                  bleed={calc.bleed}
                  gap={calc.gap}
                  setGap={calc.setGap}
                  marginTop={calc.marginTop}
                  setMarginTop={calc.setMarginTop}
                  marginBottom={calc.marginBottom}
                  setMarginBottom={calc.setMarginBottom}
                  marginLeft={calc.marginLeft}
                  setMarginLeft={calc.setMarginLeft}
                  marginRight={calc.marginRight}
                  setMarginRight={calc.setMarginRight}
                  gripper={calc.gripper}
                  setGripper={calc.setGripper}
                  gripperEdge={calc.gripperEdge}
                  setGripperEdge={calc.setGripperEdge}
                  cmykColors={calc.cmykColors}
                  onSwitchTab={calc.onSwitchTab}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM PRODUCTION KPI BAR & NAVIGATION SHORTCUTS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-card border border-border rounded-lg shadow-2xs shrink-0 text-xs font-mono">
        <div className="flex items-center gap-3 text-muted-foreground font-sans">
          <span>
            Jami: <strong className="font-mono text-foreground font-bold">{calc.totalSheetsRun.toLocaleString()}</strong> list
          </span>
          <span>·</span>
          <span>
            Formalar: <strong className="font-mono text-foreground font-bold">{calc.plates.length}</strong> ta ({calc.totalCtpPlates} CTP)
          </span>
          <span>·</span>
          <span>
            Ortiqcha:{" "}
            <span className={cn(
              "font-mono font-semibold",
              calc.overallOverproductionPercent > 5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            )}>
              +{calc.totalOverproduction.toLocaleString()} ({calc.overallOverproductionPercent.toFixed(1)}%)
            </span>
          </span>
          <span>·</span>
          <span>
            Tannarx: <strong className="font-mono text-foreground font-bold">${calc.printPlan.totalDirectProductionCost.toLocaleString()}</strong> (${calc.printPlan.costPerFinishedUnit}/dona)
          </span>
        </div>
      </div>
    </div>
  );
}

export default PhoenixWorkspace;
