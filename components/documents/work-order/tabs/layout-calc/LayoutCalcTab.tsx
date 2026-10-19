"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Calculator, RotateCw, Sparkles, Factory, FlaskConical, Layers, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LayoutCalcTabProps } from "./types";
import { useLayoutCalc } from "./useLayoutCalc";
import { OverproductionSection } from "./panels/OverproductionSection";
import { DimensionsSection } from "./panels/DimensionsSection";
import { PlateTabs } from "./panels/PlateTabs";
import { SlotAssignmentTable } from "./panels/SlotAssignmentTable";
import { ProductionSummary } from "./panels/ProductionSummary";
import { SampleConfigSection } from "./panels/SampleConfigSection";
import { PreviewToolbar } from "./preview/PreviewToolbar";
import { SheetPreview } from "./preview/SheetPreview";
import { PrintPlanningCard } from "./panels/PrintPlanningCard";

export function LayoutCalcTab(props: LayoutCalcTabProps) {
  const t = useTranslations("ClientOrder");
  const calc = useLayoutCalc(props);

  return (
    <div className="flex flex-col gap-3 h-full text-xs overflow-y-auto no-scrollbar">
      {/* ── TOP: PRINT PLANNING & TURN ENGINE CARD (COLLAPSIBLE) ── */}
      <div className="shrink-0">
        <PrintPlanningCard
          plan={calc.printPlan}
          onPrintMethodChange={calc.handlePrintMethodChange}
          onApplyRouteToOperations={calc.onApplyRouteToOperations}
          frontColors={calc.frontColors}
          backColors={calc.backColors}
          spotColors={calc.spotColors}
          targetQuantity={calc.baseQuantity}
          pressMachine={calc.pressMachine}
          lamination={calc.lamination}
          embellishment={calc.embellishment}
          isOperator={calc.isOperator}
          onSwitchTab={calc.onSwitchTab}
        />
      </div>

      {/* ── SPLIT VIEW: CONTROLS & SHEET CANVAS ── */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-[580px]">
        {/* ─────────────────────────────────────────────────────────────
            LEFT PANEL: CONTROLS & DISTRIBUTIONS
        ───────────────────────────────────────────────────────────── */}
        <div className="w-full md:w-[350px] shrink-0 bg-card border border-border rounded-lg flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="p-2.5 border-b border-border bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span>Layout Engine</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={calc.switchOrientation}
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2"
            >
              <RotateCw className="w-3 h-3" /> {calc.orientation === "A" ? "Port" : "Land"}
            </Button>
            {calc.calcMode === "production" && (
              <Button
                onClick={() => calc.handleAutoPartitionPlates()}
                variant="secondary"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" /> Auto-Split
              </Button>
            )}
          </div>
        </div>

        {/* Mode Switcher Tabs: Production vs Sample */}
        <div className="p-2 bg-zinc-100/80 dark:bg-zinc-900/80 border-b border-border shrink-0">
          <div className="grid grid-cols-2 gap-1 bg-zinc-200/70 dark:bg-zinc-950 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => calc.setCalcMode("production")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                calc.calcMode === "production"
                  ? "bg-white dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Factory className="w-3.5 h-3.5 text-blue-600" />
              <span>Production Run</span>
            </button>
            <button
              type="button"
              onClick={() => calc.setCalcMode("sample")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                calc.calcMode === "sample"
                  ? "bg-amber-500 text-white font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Sample Proof</span>
            </button>
          </div>
        </div>

        {/* Scrollable Configuration Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {calc.calcMode === "sample" ? (
            /* ──── SAMPLE PROOF MODE CONTROLS ──── */
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

              {/* Product Geometry (Read-Only SSOT from Specs) + Gap adjustment for sample */}
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

              {/* Slot Assignment for Sample */}
              <SlotAssignmentTable
                activePlate={calc.activePlate}
                layoutPieces={calc.effectivePieces}
                onManualSlotChange={calc.handleManualSlotChange}
              />
            </div>
          ) : (
            /* ──── MASS PRODUCTION MODE CONTROLS ──── */
            <>
              {/* Kashirovka Imposition Strategy (Only shown when Kashirovka is enabled in Specs & Drawing) */}
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

                  {/* Imposition Strategy Selector Cards (Specific to Layout / Imposition) */}
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

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                      <span>
                        Yield:{" "}
                        <strong className="font-mono text-foreground">
                          {calc.effectivePieces} cards/sheet
                        </strong>
                      </span>
                      <span>
                        Glue:{" "}
                        <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                          {calc.kashirovkaSummary.glueKgRequired} kg
                        </strong>
                      </span>
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

              {/* Sheet & Imposition Margins (with Read-Only Product Specs SSOT) */}
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
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Material Consumed</span>
              <span className="font-medium text-foreground">
                {calc.sampleStockSource === "precut_stock"
                  ? `${calc.activePlate.requiredSheets} × Pre-cut (${calc.sheetW}×${calc.sheetH})`
                  : `${calc.parentCutResult.parentSheetsNeeded} × Parent Sheet (Yield: ${calc.parentCutResult.cuts})`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Billing Status</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {calc.sampleBillingMode === "billable" ? `Billable (+$${calc.samplePrice})` : "Complimentary"}
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

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: SVG VISUALIZATION & PAGINATION / EXPORT
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col overflow-hidden relative">
        {/* Top Control Bar with Pagination & Download Actions */}
        <PreviewToolbar
          activePlateIndex={calc.activePlateIndex}
          totalPlates={calc.plates.length}
          requiredSheets={calc.activePlate.requiredSheets}
          onPrevPlate={() => calc.setActivePlateIndex((prev) => Math.max(0, prev - 1))}
          onNextPlate={() => calc.setActivePlateIndex((prev) => Math.min(calc.plates.length - 1, prev + 1))}
          onExportSVG={calc.handleExportSVG}
          onExportPDFCurrent={() => calc.handleExportPDF(false)}
          onExportPDFAll={calc.plates.length > 1 ? () => calc.handleExportPDF(true) : undefined}
        />

        {/* SVG Drawing Canvas Container */}
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
        />
      </div>
    </div>
  </div>
  );
}

export default LayoutCalcTab;
