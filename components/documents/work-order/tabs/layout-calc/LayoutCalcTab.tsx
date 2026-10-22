"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Calculator,
  Factory,
  FlaskConical,
  Layers,
  ArrowRight,
  Table as TableIcon,
  Eye,
  Printer,
  FileText,
  Sparkles,
  Settings2,
  RotateCw,
  SlidersHorizontal,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutCalcTabProps, CtpSideRelation } from "./types";
import { useLayoutCalc } from "./useLayoutCalc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "./components/InfoTooltip";
import { OverproductionSection } from "./panels/OverproductionSection";
import { DimensionsSection } from "./panels/DimensionsSection";
import { PlateTabs } from "./panels/PlateTabs";
import { SlotAssignmentTable } from "./panels/SlotAssignmentTable";
import { ProductionSummary } from "./panels/ProductionSummary";
import { SampleConfigSection } from "./panels/SampleConfigSection";
import { PreviewToolbar } from "./preview/PreviewToolbar";
import { SheetPreview } from "./preview/SheetPreview";
import { MasterPlanningMatrix } from "./panels/MasterPlanningMatrix";
import { CtpJobTicketModal } from "./panels/CtpJobTicketModal";
import { PrintEconomicsPanel } from "./panels/PrintEconomicsPanel";
import { PhoenixWorkspace } from "./panels/PhoenixWorkspace";

export function LayoutCalcTab(props: LayoutCalcTabProps) {
  const t = useTranslations("ClientOrder");
  const calc = useLayoutCalc(props);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Normalize viewMode: default "phoenix"
  const currentTab =
    calc.viewMode === "print_economics"
      ? "print_economics"
      : calc.viewMode === "matrix" || calc.viewMode === "planning"
      ? "matrix"
      : calc.viewMode === "visualizer"
      ? "visualizer"
      : "phoenix";

  return (
    <TooltipProvider delay={100}>
      <div className="flex flex-col gap-2.5 h-full text-xs overflow-y-auto no-scrollbar">
        {/* ─────────────────────────────────────────────────────────────
            1. TOP PRIMARY TABS BAR: 3 FOCUSED WORKFLOWS
        ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-card border border-border rounded-lg shadow-2xs shrink-0 text-xs">
          {/* 3 Main Workflow Tabs */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md border border-border">
            {/* Tab 1: Phoenix AI Montaj (Default) */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => calc.setViewMode("phoenix")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  currentTab === "phoenix"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>1. 🎯 Montaj & Reja (Visual)</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1.5 text-[10px] font-mono border-white/30 text-inherit",
                    currentTab === "phoenix" ? "bg-white/15" : "bg-background"
                  )}
                >
                  {calc.plates.length} forma
                </Badge>
              </button>
              <InfoTooltip
                title="1. Vizual Montaj va AI Reja (Tilia Phoenix modeli)"
                description="Katta vizual montaj varag'i, buyurtma mahsulotlari ro'yxati va bir marta bosish bilan ishlaydigan optimal AI rejalari."
                className="ml-0.5"
              />
            </div>

            {/* Tab 2: Matritsa Jadvali */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => calc.setViewMode("matrix")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  currentTab === "matrix"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>2. 📋 Matritsa Jadvali</span>
              </button>
              <InfoTooltip
                title="2. Matritsa Jadvali"
                description="Barcha formalar, o'lchamlar va slot ko'paytirgichlarining to'liq jadval ko'rinishi (1C / Excel uslubida)."
                className="ml-0.5"
              />
            </div>

            {/* Tab 3: Bosma & Xarajatlar */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => calc.setViewMode("print_economics")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  currentTab === "print_economics"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>3. 💰 Bosma & Xarajatlar</span>
                <span className="text-[11px] font-mono opacity-80">
                  (${calc.printPlan.totalDirectProductionCost.toLocaleString()})
                </span>
              </button>
              <InfoTooltip
                title="3. Bosma va Xarajatlar"
                description="Bosma mashinasi, bo'yoqlar stansiyasi (CMYK + Pantone), qog'oz sarfi (kg), tayyorgarlik vaqti (priladka) va mahsulot tannarxi hisob-kitoblari."
                className="ml-0.5"
              />
            </div>
          </div>

          {/* Planning mode notice & CTP Tex-Karta Dialog Trigger (SSOT) */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-medium h-7 px-2 flex items-center gap-1.5"
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">Rejalashtirish rejimi</span>
              <span className="md:hidden">Reja</span>
              <InfoTooltip
                title="Faqat rejalashtirish va simulyatsiya"
                description="Ushbu montaj va CTP qoliplari bo'limi hozircha dizayn, montaj chizmasi va qoliplarni rejalashtirish/sinovdan o'tkazish uchun xizmat qiladi. U buyurtmaning haqiqiy hisob-kitoblariga (moliya, materiallar sarfi va marshrutga) avtomatik ta'sir o'tkazmaydi."
              />
            </Badge>

            <div className="flex items-center gap-1">
              <Button
                onClick={() => calc.setIsJobTicketOpen(true)}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 px-3 bg-background cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
              >
                <FileText className="w-4 h-4" />
                <span>CTP Tex-Karta</span>
              </Button>
              <InfoTooltip
                title="CTP Texnologik Xaritasi (Job Ticket)"
                description="CTP bo'limi va bosmaxona ustasi uchun montaj jadvallari, qoliplar va plastinalar ro'yxatini chop etish yoki PDF chiqarish."
              />
            </div>
          </div>
        </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TAB 1: PHOENIX VISUAL WORKSPACE (DEFAULT USER EXPERIENCE)
      ───────────────────────────────────────────────────────────── */}
      {currentTab === "phoenix" && (
        <PhoenixWorkspace calc={calc} props={props} />
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. TAB 2: MATRITSA JADVALI (DETAILED 1C SPREADSHEET TABLE)
      ───────────────────────────────────────────────────────────── */}
      {currentTab === "matrix" && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Focused Top Planning Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-card border border-border rounded-lg shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground text-sm">
                Qoliplar va O&apos;lchamlar Matritsasi
              </span>
              <span className="text-muted-foreground font-mono hidden sm:inline">
                ({calc.effectivePieces} joy · {calc.plates.length} forma · {calc.totalSheetsRun.toLocaleString()} list)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Smart Gang Optimizer Popover */}
              <Popover>
                <PopoverTrigger
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Aqlli taqsimlash (Smart Auto)</span>
                  <Settings2 className="w-3 h-3 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-3 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Smart Gang Optimizer</span>
                      <InfoTooltip
                        title="Aqlli guruhlash (Smart Gang Optimizer)"
                        description="Simulyatsiya qilingan tavlanish (Simulated Annealing) algoritmi orqali barcha o'lchamlar va tirajlarni formalar bo'yicha avtomatik, eng tejamkor variantda taqsimlaydi."
                      />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono h-4 px-1">
                      Annealing
                    </Badge>
                  </div>

                  {/* Goal */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Optimizatsiya maqsadi:</span>
                        <InfoTooltip
                          title="Optimizatsiya maqsadi"
                          description="Minimal chiqindi: qimmat qog'oz va ortiqcha bosma (overproduction) sarfini kamaytiradi. Minimal formalar: CTP plastinalari soni va mashina sozlash (priladka) xarajatlarini tejaydi."
                        />
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded border border-border">
                      <button
                        type="button"
                        onClick={() => calc.setOptimizerGoal("min_waste")}
                        className={`py-1 text-[11px] rounded transition-all cursor-pointer ${
                          calc.optimizerGoal === "min_waste"
                            ? "bg-background text-foreground font-semibold shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Minimal chiqindi
                      </button>
                      <button
                        type="button"
                        onClick={() => calc.setOptimizerGoal("min_plates")}
                        className={`py-1 text-[11px] rounded transition-all cursor-pointer ${
                          calc.optimizerGoal === "min_plates"
                            ? "bg-background text-foreground font-semibold shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Minimal formalar
                      </button>
                    </div>
                  </div>

                  {/* Target Plate Count */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                        <span>Forma soni (Qoliplar):</span>
                        <InfoTooltip
                          title="Maqsadli formalar soni"
                          description="Avtomatik tanlansa, algoritm iqtisodiy jihatdan eng arzon tannarx beradigan forma sonini o'zi hisoblaydi. Qo'lda tanlasangiz, belgilangan sondagi formalarga majburan taqsimlaydi."
                        />
                      </label>
                      <span className="text-[10px] font-mono font-semibold text-foreground">
                        {calc.targetPlateCount === undefined
                          ? "Avtomatik"
                          : `${calc.targetPlateCount} ta`}
                      </span>
                    </div>
                    <Select
                      value={
                        calc.targetPlateCount === undefined
                          ? "auto"
                          : String(calc.targetPlateCount)
                      }
                      onValueChange={(val) => {
                        if (!val || val === "auto") {
                          calc.setTargetPlateCount(undefined);
                        } else {
                          calc.setTargetPlateCount(Number(val));
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-full bg-background">
                        <SelectValue placeholder="Avtomatik (eng maqbul)" />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="auto">Avtomatik (eng maqbul)</SelectItem>
                        <SelectItem value="2">2 ta forma</SelectItem>
                        <SelectItem value="3">3 ta forma</SelectItem>
                        <SelectItem value="4">4 ta forma (Tavsiya)</SelectItem>
                        <SelectItem value="5">5 ta forma</SelectItem>
                        <SelectItem value="6">6 ta forma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CTP Side Relation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                      <span>CTP tomonlar bog&apos;liqligi:</span>
                      <InfoTooltip
                        title="CTP tomonlar bog'liqligi"
                        description="Oldi umumiy + Orqa alohida: old tomoni barcha o'lchamlar uchun bir xil bo'lsa, oldi uchun 1 ta CTP to'plami olinadi, CTP narxi 50% gacha tejaladi! Mustaqil: har bir formaning oldi ham, orqasi ham alohida ochiladi. Work-and-Turn: bitta qolipda oldi-orqasi yonma-yon bosiladi."
                      />
                    </label>
                    <Select
                      value={calc.ctpSideRelation}
                      onValueChange={(val) => {
                        if (val) calc.setCtpSideRelation(val as CtpSideRelation);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-full bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="shared_front_variable_back">
                          Oldi umumiy + Orqa alohida ({calc.plates.length * 4 + 4} CTP)
                        </SelectItem>
                        <SelectItem value="independent_per_plate">
                          Har forma mustaqil Oldi/Orqa ({calc.plates.length * 8} CTP)
                        </SelectItem>
                        <SelectItem value="work_and_turn">
                          Work-and-Turn / Qaytarma ({calc.plates.length * 4} CTP)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Button */}
                  <Button
                    type="button"
                    onClick={() => calc.handleAutoPartitionPlates("smart_gang_optimizer")}
                    className="w-full h-7 text-xs font-medium gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer mt-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Qayta hisoblash va taqsimlash</span>
                  </Button>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => calc.setViewMode("phoenix")}
                className="h-7 text-xs gap-1.5 px-3 bg-background cursor-pointer text-foreground"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Chizmada ko&apos;rish</span>
              </Button>
            </div>
          </div>

          {/* Full-Width Master Planning Matrix */}
          <div className="flex-1 min-h-[500px]">
            <MasterPlanningMatrix
              plates={calc.plateCalculations}
              activePlateIndex={calc.activePlateIndex}
              effectivePieces={calc.effectivePieces}
              activeSide={calc.activeSide}
              onToggleSide={calc.setActiveSide}
              ctpSideRelation={calc.ctpSideRelation}
              totalCtpPlates={calc.totalCtpPlates}
              totalSheetsRun={calc.totalSheetsRun}
              totalProducedYield={calc.totalProducedYield}
              totalOverproduction={calc.totalOverproduction}
              overallOverproductionPercent={calc.overallOverproductionPercent}
              onSelectPlate={(idx) => calc.setActivePlateIndex(idx)}
              onAddPlate={calc.handleAddPlate}
              onRemovePlate={calc.handleRemovePlate}
              onRenamePlate={calc.handleRenamePlate}
              onDuplicatePlate={calc.handleDuplicatePlate}
              onReassignSkuPlate={calc.handleReassignSkuPlate}
              onSetSkuSlots={calc.handleSetSkuSlots}
              onSwitchToVisualizer={() => calc.setViewMode("phoenix")}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. TAB 2: LIST MONTAJ CHIZMASI (FULL VISUAL CANVAS)
      ───────────────────────────────────────────────────────────── */}
      {currentTab === "visualizer" && (
        <div className="flex-1 flex flex-col gap-2 min-h-[580px]">
          {/* Visualizer Top Bar: Plate Navigation & Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-card border border-border rounded-lg shrink-0">
            <PreviewToolbar
              activePlateIndex={calc.activePlateIndex}
              totalPlates={calc.plates.length}
              requiredSheets={calc.activePlate.requiredSheets}
              activeSide={calc.activeSide}
              onToggleSide={calc.setActiveSide}
              onPrevPlate={() => calc.setActivePlateIndex((prev) => Math.max(0, prev - 1))}
              onNextPlate={() => calc.setActivePlateIndex((prev) => Math.min(calc.plates.length - 1, prev + 1))}
              onExportSVG={calc.handleExportSVG}
              onExportPDFCurrent={() => calc.handleExportPDF(false)}
              onExportPDFAll={calc.plates.length > 1 ? () => calc.handleExportPDF(true) : undefined}
            />

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <Button
                  onClick={calc.switchOrientation}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2.5 bg-background cursor-pointer"
                  title="Qolip orientatsiyasi (Portret / Albom)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{calc.orientation === "A" ? "Portret" : "Albom"}</span>
                </Button>
                <InfoTooltip
                  title="Qolip orientatsiyasi"
                  description="Mahsulotlarni list bo'ylab vertikal (Portret) yoki gorizontal (Albom) joylashtirish. Bu listdan foydalanish samaradorligini (utilization) oshiradi."
                />
              </div>

              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  variant={isSettingsOpen ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-3 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{isSettingsOpen ? "Sozlamalarni yopish" : "Qolip sozlamalari"}</span>
                </Button>
                <InfoTooltip
                  title="Qolip sozlamalari paneli"
                  description="Qog'oz listi o'lchami, hoshiyalar (margins), pichoq oraliqlari (gap) va mashina klapanini (gripper) sozlash oynasi."
                />
              </div>
            </div>
          </div>

          {/* Visualizer Body: Settings Drawer (if open) + Full Sheet Canvas */}
          <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0">
            {isSettingsOpen && (
              <div className="w-full md:w-[290px] shrink-0 bg-card border border-border rounded-lg flex flex-col overflow-hidden text-xs animate-in slide-in-from-left-2 duration-150">
                {/* Header Bar */}
                <div className="p-2 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                    <Calculator className="w-3.5 h-3.5 text-blue-600" />
                    <span>Qolip Sozlamalari</span>
                    <InfoTooltip
                      title="Qolip Sozlamalari"
                      description="Ushbu paneldan qog'oz listi o'lchami, pichoq oraliqlari, klapan va hoshiyalar o'zgartiriladi. Chizma real vaqt rejimida yangilanadi."
                    />
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] h-5 bg-background">
                    {calc.sheetW} × {calc.sheetH} mm
                  </Badge>
                </div>

                {/* Mode Switcher Tabs: Production vs Sample */}
                <div className="p-1.5 bg-muted/20 border-b border-border shrink-0">
                  <div className="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded text-xs">
                    <button
                      type="button"
                      onClick={() => calc.setCalcMode("production")}
                      className={`flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium transition-all ${
                        calc.calcMode === "production"
                          ? "bg-background text-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Factory className="w-3.5 h-3.5 text-blue-600" />
                      <span>Production</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => calc.setCalcMode("sample")}
                      className={`flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium transition-all ${
                        calc.calcMode === "sample"
                          ? "bg-amber-500 text-white font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Sample</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Configuration Body */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {calc.calcMode === "sample" ? (
                    <div className="space-y-3">
                      <SampleConfigSection
                        sampleQty={calc.sampleQty}
                        onSampleQtyChange={calc.handleSampleQtyChange}
                        stockSource={calc.sampleStockSource}
                        onStockSourceChange={calc.handleStockSourceChange}
                        selectedPrecutId={calc.selectedPrecutId}
                        onSelectPrecutPreset={calc.handleSelectPrecutPreset}
                        parentSheetW={calc.parentSheetW}
                        setParentSheetW={calc.setParentSheetW}
                        parentSheetH={calc.parentSheetH}
                        setParentSheetH={calc.setParentSheetH}
                        sampleCutW={calc.sampleCutW}
                        setSampleCutW={(w) => calc.handleSampleCutDimChange(w, calc.sampleCutH)}
                        sampleCutH={calc.sampleCutH}
                        setSampleCutH={(h) => calc.handleSampleCutDimChange(calc.sampleCutW, h)}
                        parentCutResult={calc.parentCutResult}
                        onSwitchTab={calc.onSwitchTab}
                      />

                      <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-md border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold text-zinc-500">
                            Product Geometry (SSOT)
                          </span>
                          {calc.onSwitchTab && (
                            <button
                              type="button"
                              onClick={() => calc.onSwitchTab?.("specs")}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                            >
                              <span>Edit in Specs</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono bg-background">
                              {calc.prodW} × {calc.prodH} mm
                            </Badge>
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono bg-background">
                              Bleed: {calc.bleed} mm
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-[10px] font-semibold text-zinc-500">Gap (mm):</label>
                            <Input
                              type="number"
                              value={calc.gap}
                              onChange={(e) => calc.setGap(Number(e.target.value))}
                              className="h-6 w-14 text-xs text-center bg-white dark:bg-zinc-950 font-mono px-1"
                            />
                          </div>
                        </div>
                      </div>

                      <SlotAssignmentTable
                        activePlate={calc.activePlate}
                        layoutPieces={calc.effectivePieces}
                        onManualSlotChange={calc.handleManualSlotChange}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Kashirovka Imposition Strategy */}
                      {calc.kashMode !== "none" && (
                        <div className="bg-muted/40 p-2.5 rounded-md border border-border space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground min-w-0">
                              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="truncate">
                                {t("kashirovkaTitle")} ({calc.kashMode === "triplex" ? "Triplex 3-Ply" : "Duplex 2-Ply"})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 px-1.5 h-5"
                              >
                                {calc.kashirovkaSummary.totalMountedGsm}g/m²
                              </Badge>
                              {calc.onSwitchTab && (
                                <button
                                  type="button"
                                  onClick={() => calc.onSwitchTab?.("specs")}
                                  className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
                                >
                                  Specs
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1 border-t border-border/60">
                            <label className="text-[10px] text-muted-foreground block">
                              {t("kashirovkaStrategyLabel")}
                            </label>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => calc.setKashStrategy("split_half_sheet")}
                                className={`p-1.5 rounded border text-left transition-all cursor-pointer ${
                                  calc.kashStrategy === "split_half_sheet"
                                    ? "bg-background border-blue-500 text-foreground font-semibold"
                                    : "bg-background/50 border-border text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <div className="text-[10px] leading-tight">
                                  {t("kashirovkaStrategySplitShort")}
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => calc.setKashStrategy("separate_sheets")}
                                className={`p-1.5 rounded border text-left transition-all cursor-pointer ${
                                  calc.kashStrategy === "separate_sheets"
                                    ? "bg-background border-blue-500 text-foreground font-semibold"
                                    : "bg-background/50 border-border text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <div className="text-[10px] leading-tight">
                                  {t("kashirovkaStrategySeparateShort")}
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Overproduction Section */}
                      <OverproductionSection
                        mode={calc.overproductionMode}
                        onModeChange={calc.setOverproductionMode}
                        value={calc.overproductionValue}
                        onValueChange={calc.setOverproductionValue}
                      />

                      {/* Sheet & Imposition Margins */}
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

                      {/* Plates Selector / Tabs */}
                      <PlateTabs
                        plates={calc.plates}
                        activePlateIndex={calc.activePlateIndex}
                        partitionStrategy={calc.partitionStrategy}
                        hasMultipleModels={calc.hasMultipleModels}
                        uniqueModelsCount={calc.uniqueModelsCount}
                        onSelectPlate={calc.setActivePlateIndex}
                        onAddPlate={calc.handleAddPlate}
                        onRemovePlate={calc.handleRemovePlate}
                        onAutoPartition={(strat) => calc.handleAutoPartitionPlates(strat)}
                      />

                      {/* Active Plate Slot Assignment Table */}
                      <SlotAssignmentTable
                        activePlate={calc.activePlate}
                        layoutPieces={calc.effectivePieces}
                        onManualSlotChange={calc.handleManualSlotChange}
                        onAutoPartition={(strat) => calc.handleAutoPartitionPlates(strat)}
                      />
                    </>
                  )}
                </div>

                {/* Bottom Production Summary Footer */}
                {calc.calcMode === "sample" ? (
                  <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1.5 shrink-0 border-t border-amber-200 dark:border-amber-900/60 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Sample Print Run</span>
                      <span className="font-semibold text-sm text-foreground font-mono">
                        {calc.activePlate.requiredSheets} sheet{calc.activePlate.requiredSheets > 1 ? "s" : ""} ({calc.sampleQty} pcs)
                      </span>
                    </div>
                  </div>
                ) : (
                  <ProductionSummary
                    totalSheetsRun={calc.totalSheetsRun}
                    totalPlates={calc.plates.length}
                    totalCtpPlates={calc.totalCtpPlates}
                    cmykColors={calc.cmykColors}
                    paperAreaWastePercent={calc.paperAreaWastePercent}
                    utilization={calc.layout.utilization}
                    kashirovkaSummary={calc.kashirovkaSummary}
                  />
                )}
              </div>
            )}

            {/* Large Visual Press Sheet Canvas */}
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col overflow-hidden relative">
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
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. TAB 3: BOSMA & XARAJATLAR (PRINT ECONOMICS & MACHINE TECH)
      ───────────────────────────────────────────────────────────── */}
      {currentTab === "print_economics" && (
        <div className="flex-1 overflow-y-auto">
          <PrintEconomicsPanel
            plan={calc.printPlan}
            onPrintMethodChange={calc.handlePrintMethodChange}
            onApplyRouteToOperations={calc.onApplyRouteToOperations}
            frontColors={calc.frontColors}
            backColors={calc.backColors}
            spotColors={calc.spotColors}
            pressMachine={calc.pressMachine}
            lamination={calc.lamination}
            embellishment={calc.embellishment}
            isOperator={calc.isOperator}
            onSwitchTab={calc.onSwitchTab}
          />
        </div>
      )}

      {/* ── CTP JOB TICKET / TECH CARD PRINT MODAL ── */}
      <CtpJobTicketModal
        isOpen={calc.isJobTicketOpen}
        onClose={() => calc.setIsJobTicketOpen(false)}
        docNo={props.docNo || "WOOF-26-0001"}
        orderName={props.orderName || "Client Order"}
        pressMachine={calc.pressMachine}
        paperStock={calc.paperStock}
        sheetW={calc.sheetW}
        sheetH={calc.sheetH}
        prodW={calc.prodW}
        prodH={calc.prodH}
        plates={calc.plateCalculations}
        effectivePieces={calc.effectivePieces}
        ctpSideRelation={calc.ctpSideRelation}
        frontColorsCount={calc.frontColorsCount}
        backColorsCount={calc.backColorsCount}
        totalCtpPlates={calc.totalCtpPlates}
        totalSheetsRun={calc.totalSheetsRun}
        totalProducedYield={calc.totalProducedYield}
        totalOverproduction={calc.totalOverproduction}
      />
      </div>
    </TooltipProvider>
  );
}

export default LayoutCalcTab;
