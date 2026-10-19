import React from "react";
import { FlaskConical, Scissors, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SampleStockSource, PRECUT_STOCK_PRESETS, PrecutStockPreset, ParentCutResult } from "../types";

interface Props {
  sampleQty: number;
  onSampleQtyChange: (qty: number) => void;
  stockSource: SampleStockSource;
  onStockSourceChange: (src: SampleStockSource) => void;
  selectedPrecutId: string;
  onSelectPrecutPreset: (preset: PrecutStockPreset) => void;
  parentSheetW: number;
  setParentSheetW: (v: number) => void;
  parentSheetH: number;
  setParentSheetH: (v: number) => void;
  sampleCutW: number;
  setSampleCutW: (v: number) => void;
  sampleCutH: number;
  setSampleCutH: (v: number) => void;
  parentCutResult: ParentCutResult;
  onSwitchTab?: (tabKey: string) => void;
}

export function SampleConfigSection({
  sampleQty,
  onSampleQtyChange,
  stockSource,
  onStockSourceChange,
  selectedPrecutId,
  onSelectPrecutPreset,
  parentSheetW,
  setParentSheetW,
  parentSheetH,
  setParentSheetH,
  sampleCutW,
  setSampleCutW,
  sampleCutH,
  setSampleCutH,
  parentCutResult,
  onSwitchTab,
}: Props) {
  const samplePills = [1, 3, 5, 10, 20];

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <FlaskConical className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[11px] text-amber-900 dark:text-amber-300 truncate">
              Sample Proof Imposition
            </div>
            <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 truncate">
              Synced with Sample Proof tab ({sampleQty} pcs)
            </div>
          </div>
        </div>
        {onSwitchTab ? (
          <button
            type="button"
            onClick={() => onSwitchTab("sample")}
            className="text-[10px] font-medium text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer"
          >
            <span>Sample Passport</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        ) : (
          <Badge variant="outline" className="text-[9px] bg-amber-100/50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800">
            Digital / Pre-cut
          </Badge>
        )}
      </div>

      {/* Target Sample Quantity (Synced SSOT with Sample Proof Tab) */}
      <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-md border border-border">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-semibold text-zinc-500">
            Sample Quantity (SSOT)
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {sampleQty} pcs needed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 flex-1">
            {samplePills.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSampleQtyChange(n)}
                className={`flex-1 py-1 text-[10px] font-medium rounded border transition-colors cursor-pointer ${
                  sampleQty === n
                    ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                    : "bg-white dark:bg-zinc-950 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            max={500}
            value={sampleQty}
            onChange={(e) => onSampleQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 h-7 text-xs text-center bg-white dark:bg-zinc-950 font-mono"
          />
        </div>
      </div>

      {/* Material Sourcing Options */}
      <div className="space-y-2 border border-border p-2.5 rounded-md bg-white dark:bg-zinc-950">
        <label className="text-[10px] uppercase font-semibold text-zinc-500 block">
          Material Sourcing Strategy
        </label>
        
        {/* Source Toggle */}
        <div className="grid grid-cols-2 gap-1.5 bg-muted p-0.5 rounded-md text-[10px]">
          <button
            type="button"
            onClick={() => onStockSourceChange("precut_stock")}
            className={`flex items-center justify-center gap-1.5 py-1 rounded font-medium transition-all cursor-pointer ${
              stockSource === "precut_stock"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3 h-3 text-blue-500" />
            <span>Pre-cut Stock</span>
          </button>
          <button
            type="button"
            onClick={() => onStockSourceChange("cut_from_parent")}
            className={`flex items-center justify-center gap-1.5 py-1 rounded font-medium transition-all cursor-pointer ${
              stockSource === "cut_from_parent"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scissors className="w-3 h-3 text-amber-500" />
            <span>Cut from Parent</span>
          </button>
        </div>

        {/* Source A: Pre-cut Stock Options */}
        {stockSource === "precut_stock" && (
          <div className="space-y-2 pt-1">
            <div className="text-[10px] text-muted-foreground">
              Select existing cut-sheet paper from inventory (no parent sheet waste):
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRECUT_STOCK_PRESETS.map((preset) => {
                const isSelected = selectedPrecutId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPrecutPreset(preset)}
                    className={`p-2 rounded border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500"
                        : "border-border bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-400 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px]">{preset.name}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {preset.width} × {preset.height} mm
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Source B: Cut from Full Parent Sheet */}
        {stockSource === "cut_from_parent" && (
          <div className="space-y-2.5 pt-1">
            <div className="text-[10px] text-muted-foreground">
              Takes full parent sheet and guillotines into smaller test press sheets:
            </div>
            
            <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-border">
              <div>
                <label className="text-[9px] uppercase font-semibold text-zinc-500 block mb-0.5">Parent Sheet (W×H)</label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={parentSheetW}
                    onChange={(e) => setParentSheetW(Number(e.target.value))}
                    className="h-6 text-[10px] text-center bg-white dark:bg-zinc-950 px-1 font-mono"
                    placeholder="W"
                  />
                  <span className="text-zinc-400 self-center">×</span>
                  <Input
                    type="number"
                    value={parentSheetH}
                    onChange={(e) => setParentSheetH(Number(e.target.value))}
                    className="h-6 text-[10px] text-center bg-white dark:bg-zinc-950 px-1 font-mono"
                    placeholder="H"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase font-semibold text-zinc-500 block mb-0.5">Cut Press Sheet (W×H)</label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={sampleCutW}
                    onChange={(e) => setSampleCutW(Number(e.target.value))}
                    className="h-6 text-[10px] text-center bg-white dark:bg-zinc-950 px-1 font-mono"
                    placeholder="W"
                  />
                  <span className="text-zinc-400 self-center">×</span>
                  <Input
                    type="number"
                    value={sampleCutH}
                    onChange={(e) => setSampleCutH(Number(e.target.value))}
                    className="h-6 text-[10px] text-center bg-white dark:bg-zinc-950 px-1 font-mono"
                    placeholder="H"
                  />
                </div>
              </div>
            </div>

            {/* Cutting Yield Summary */}
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] space-y-1">
              <div className="flex justify-between items-center text-amber-950 dark:text-amber-200 font-medium">
                <span>1 Parent Sheet Yield:</span>
                <span className="font-mono font-semibold">{parentCutResult.cuts} cut sheets</span>
              </div>
              <div className="flex justify-between items-center text-amber-900 dark:text-amber-300">
                <span>Parent Sheets Consumed:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {parentCutResult.parentSheetsNeeded} full sheet ({parentCutResult.wastePercent.toFixed(1)}% offcut)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
