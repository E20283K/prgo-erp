"use client";

import React, { useState, useMemo } from "react";
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RotateCw,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Table as TableIcon,
  Printer,
  Download,
  FileDown,
  Plus,
  Minus,
  Scissors,
  Warehouse,
  Check,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutCalcTabProps, CtpSideRelation, GripperEdge } from "../types";
import { useLayoutCalc, COLOR_PALETTE } from "../useLayoutCalc";
import { SheetPreview } from "../preview/SheetPreview";
import { MasterPlanningMatrix } from "./MasterPlanningMatrix";
import { doesSheetFitMachine, computeTotalCtpPlatesForConfig } from "../engine";

interface PhoenixWorkspaceProps {
  calc: ReturnType<typeof useLayoutCalc>;
  props: LayoutCalcTabProps;
}

export function PhoenixWorkspace({ calc, props }: PhoenixWorkspaceProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<"min_waste" | "min_plates" | "by_model">(
    calc.partitionStrategy === "by_model"
      ? "by_model"
      : calc.optimizerGoal === "min_plates"
      ? "min_plates"
      : "min_waste"
  );
  const [justApplied, setJustApplied] = useState(false);

  const handleSelectPlan = (plan: "min_waste" | "min_plates" | "by_model") => {
    setSelectedPlanId(plan);
    if (plan === "min_waste") {
      calc.handleAutoPartitionPlates("smart_gang_optimizer", "min_waste");
    } else if (plan === "min_plates") {
      calc.handleAutoPartitionPlates("smart_gang_optimizer", "min_plates");
    } else if (plan === "by_model") {
      calc.handleAutoPartitionPlates("by_model");
    }
  };

  // Filter warehouse stock for paper & board + offcuts
  const paperStockItems = useMemo(() => {
    return (calc.warehouseStock || []).filter((item) => {
      const cat = (item.category || "").toLowerCase();
      return (
        cat.includes("paper") ||
        cat.includes("board") ||
        cat.includes("offcut") ||
        cat.includes("qog'oz") ||
        cat.includes("karton") ||
        Boolean(item.sheetFormat || item.cutDimensions || item.isOffcut)
      );
    });
  }, [calc.warehouseStock]);

  const fullSheetStock = useMemo(
    () => paperStockItems.filter((i) => !i.isOffcut),
    [paperStockItems]
  );
  const offcutStock = useMemo(
    () => paperStockItems.filter((i) => i.isOffcut),
    [paperStockItems]
  );

  const parentFitsDirectly = useMemo(
    () =>
      doesSheetFitMachine(
        calc.parentSheetW,
        calc.parentSheetH,
        calc.machineConstraints
      ),
    [calc.parentSheetW, calc.parentSheetH, calc.machineConstraints]
  );

  const currentPressFits = useMemo(
    () =>
      doesSheetFitMachine(
        calc.sheetW,
        calc.sheetH,
        calc.machineConstraints
      ),
    [calc.sheetW, calc.sheetH, calc.machineConstraints]
  );

  // Dynamic CTP counts for each side relation option
  const ctpCountsByRelation = useMemo(() => {
    const n = calc.plates.length;
    const f = calc.frontColorsCount;
    const b = calc.backColorsCount;
    return {
      single_sided: computeTotalCtpPlatesForConfig(n, "single_sided", f, b),
      shared_front_variable_back: computeTotalCtpPlatesForConfig(n, "shared_front_variable_back", f, b),
      independent_per_plate: computeTotalCtpPlatesForConfig(n, "independent_per_plate", f, b),
      work_and_turn: computeTotalCtpPlatesForConfig(n, "work_and_turn", f, b),
    };
  }, [calc.plates.length, calc.frontColorsCount, calc.backColorsCount]);

  const allocatedSlotsInActivePlate = useMemo(
    () => calc.activePlate.assignments.reduce((sum, a) => sum + a.slots, 0),
    [calc.activePlate.assignments]
  );

  const totalOrderQtyInActivePlate = useMemo(
    () => calc.activePlate.assignments.reduce((sum, a) => sum + a.targetQuantity, 0),
    [calc.activePlate.assignments]
  );

  const onTriggerApply = () => {
    calc.handleApplyToOrder();
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2200);
  };

  return (
    <div className="flex flex-col gap-1.5 h-full text-xs overflow-hidden select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. COMPACT TOP CONTROL BAR (1 ROW, ZERO EMOJIS, HIGH DENSITY)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md shrink-0">
        {/* Left Group: Paper & Offcut Picker -> Press Cut Selector -> Plan Selector -> CTP Relation */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1A. Warehouse Paper & Offcut Picker Popover */}
          <Popover>
            <PopoverTrigger
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
              title="Ombordagi to'liq qog'oz yoki kesilgan qoldiq (delovoy otxod) tanlash"
            >
              <Warehouse className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[145px]">
                {calc.selectedPaperName || "Xom qog'oz"}
              </span>
              <Badge variant="outline" className="h-4.5 px-1 text-[10px] font-mono bg-muted/50">
                {calc.parentSheetW}×{calc.parentSheetH}
              </Badge>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-2.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <span className="font-semibold text-foreground">
                  Xom qog&apos;oz va qoldiqlar (Ombor)
                </span>
                {calc.onSwitchTab && (
                  <button
                    type="button"
                    onClick={() => calc.onSwitchTab?.("specs")}
                    className="text-[10px] text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Spetsifikatsiya
                  </button>
                )}
              </div>

              {/* Manual Parent Dimensions */}
              <div className="grid grid-cols-2 gap-1.5 bg-muted/40 p-2 rounded border border-border">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">
                    Xom list eni (W mm)
                  </label>
                  <Input
                    type="number"
                    value={calc.parentSheetW}
                    onChange={(e) =>
                      calc.handleParentSheetDimChange(Number(e.target.value), calc.parentSheetH)
                    }
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">
                    Xom list bo&apos;yi (H mm)
                  </label>
                  <Input
                    type="number"
                    value={calc.parentSheetH}
                    onChange={(e) =>
                      calc.handleParentSheetDimChange(calc.parentSheetW, Number(e.target.value))
                    }
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
              </div>

              {/* Leftover Offcuts (Delovoy Otxod) */}
              {offcutStock.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
                    <span>Kesilgan qoldiqlar (Delovoy otxod)</span>
                    <span className="font-mono">{offcutStock.length} tur</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
                    {offcutStock.map((st, idx) => {
                      const fmt = st.cutDimensions || st.sheetFormat || "—";
                      const isSel = calc.selectedPaperName === st.name;
                      return (
                        <button
                          key={st.sku || `off-${idx}`}
                          type="button"
                          onClick={() => calc.handleSelectWarehousePaper(st)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-2 py-1 rounded border text-left transition-colors cursor-pointer",
                            isSel
                              ? "bg-blue-50 dark:bg-blue-950/50 border-blue-400 text-foreground"
                              : "bg-background hover:bg-muted border-border"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-[11px] truncate">{st.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {fmt} mm · {(st.available ?? st.stockLevel ?? 0).toLocaleString()} list
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shrink-0"
                          >
                            Qoldiq
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Format Warehouse Papers */}
              {fullSheetStock.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>To&apos;liq formatli qog&apos;ozlar</span>
                    <span className="font-mono">{fullSheetStock.length} tur</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                    {fullSheetStock.map((st, idx) => {
                      const fmt = st.sheetFormat || "1000×700";
                      const isSel = calc.selectedPaperName === st.name;
                      return (
                        <button
                          key={st.sku || `full-${idx}`}
                          type="button"
                          onClick={() => calc.handleSelectWarehousePaper(st)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-2 py-1 rounded border text-left transition-colors cursor-pointer",
                            isSel
                              ? "bg-blue-50 dark:bg-blue-950/50 border-blue-400 text-foreground"
                              : "bg-background hover:bg-muted border-border"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-[11px] truncate">{st.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {fmt} mm · {(st.available ?? st.stockLevel ?? 0).toLocaleString()} list
                            </div>
                          </div>
                          {st.grammage && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {st.grammage}g
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* 1B. Press Sheet Cut Selector (Auto Parent -> Press Sheet Division) */}
          <Popover>
            <PopoverTrigger
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded border text-xs font-mono font-medium transition-colors cursor-pointer",
                !currentPressFits
                  ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : calc.cutDivisor > 1
                  ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-border bg-background hover:bg-muted text-foreground"
              )}
              title={`Bosma mashinasi (${calc.machineConstraints.machineName}) uchun kesim o'lchami`}
            >
              <Scissors className="w-3.5 h-3.5 shrink-0" />
              <span>
                {calc.cutDivisor > 1 ? `1/${calc.cutDivisor} · ` : ""}
                {calc.sheetW}×{calc.sheetH} mm
              </span>
              {!parentFitsDirectly && calc.cutDivisor > 1 && (
                <span className="text-[9px] px-1 rounded bg-blue-600 text-white font-sans font-semibold">
                  Avto
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2.5 space-y-2 text-xs">
              <div className="pb-1.5 border-b border-border space-y-0.5">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Bosma list kesimi (Stanok formati)</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {calc.machineConstraints.machineName} · Max:{" "}
                  <strong className="text-foreground">
                    {calc.machineConstraints.maxW}×{calc.machineConstraints.maxH} mm
                  </strong>
                </div>
              </div>

              <div className="space-y-1">
                {calc.sheetCutOptions.map((opt) => {
                  const isCurrent =
                    calc.cutDivisor === opt.divisor &&
                    calc.sheetW === opt.pressW &&
                    calc.sheetH === opt.pressH;
                  return (
                    <button
                      key={opt.divisor}
                      type="button"
                      onClick={() => calc.handleSelectCutOption(opt)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded border text-left transition-colors cursor-pointer",
                        isCurrent
                          ? "bg-blue-600 text-white border-blue-600"
                          : opt.fitsMachine
                          ? "bg-background hover:bg-muted border-border text-foreground"
                          : "bg-muted/30 border-border/50 text-muted-foreground opacity-60"
                      )}
                    >
                      <div>
                        <div className="font-semibold text-[11px] font-mono">{opt.label}</div>
                        <div
                          className={cn(
                            "text-[10px] font-mono",
                            isCurrent ? "text-blue-100" : "text-muted-foreground"
                          )}
                        >
                          {opt.piecesPerPressSheet} joy/list ({opt.piecesPerParentSheet} joy/xom list)
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-mono h-4.5 px-1",
                          isCurrent
                            ? "border-white/40 text-white bg-white/15"
                            : opt.fitsMachine
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                        )}
                      >
                        {opt.fitsMachine ? "Mos" : "Sig'maydi"}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Custom Press Sheet Size Override */}
              <div className="pt-1.5 border-t border-border grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">
                    Bosma eni (W mm)
                  </label>
                  <Input
                    type="number"
                    value={calc.sheetW}
                    onChange={(e) => calc.setSheetW(Math.max(50, Number(e.target.value)))}
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">
                    Bosma bo&apos;yi (H mm)
                  </label>
                  <Input
                    type="number"
                    value={calc.sheetH}
                    onChange={(e) => calc.setSheetH(Math.max(50, Number(e.target.value)))}
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 1C. Compact Plan Selector (with real pre-calculated numbers for every option) */}
          <Select
            value={selectedPlanId}
            onValueChange={(val) => {
              if (val) handleSelectPlan(val as "min_waste" | "min_plates" | "by_model");
            }}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[230px] bg-background font-medium px-2.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              {calc.planComparisonOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs font-mono">
                  <span className="font-sans font-semibold">{opt.label}:</span>{" "}
                  <span>
                    {opt.platesCount} forma · {opt.totalPressSheets.toLocaleString()} list ·{" "}
                    {opt.totalCtpPlates} CTP (+{opt.overproductionPct}%)
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 1D. CTP Side Relation Selector */}
          <Select
            value={calc.ctpSideRelation}
            onValueChange={(val) => {
              if (val) calc.setCtpSideRelation(val as CtpSideRelation);
            }}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[185px] bg-background px-2.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              {calc.backColorsCount <= 0 ? (
                <SelectItem value="single_sided">
                  Bir tomonlama {calc.frontColorsCount}+0 ({ctpCountsByRelation.single_sided} CTP)
                </SelectItem>
              ) : (
                <>
                  <SelectItem value="shared_front_variable_back">
                    Oldi umumiy + Orqa alohida ({ctpCountsByRelation.shared_front_variable_back} CTP)
                  </SelectItem>
                  <SelectItem value="independent_per_plate">
                    Har forma mustaqil {calc.frontColorsCount}+{calc.backColorsCount} ({ctpCountsByRelation.independent_per_plate} CTP)
                  </SelectItem>
                  <SelectItem value="work_and_turn">
                    Work-and-Turn / Qaytarma ({ctpCountsByRelation.work_and_turn} CTP)
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Right Group: Prepress Settings Popover, Export / Job Ticket Dropdown, Apply to Order Button */}
        <div className="flex items-center gap-1.5">
          {/* Technical Settings Popover */}
          <Popover>
            <PopoverTrigger
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
              title="Texnik hoshiyalar, klapan va pichoq oralig'i"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Sozlamalar</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <span className="font-semibold text-foreground">
                  Texnik Prepress Parametrlari
                </span>
                {calc.onSwitchTab && (
                  <button
                    type="button"
                    onClick={() => calc.onSwitchTab?.("specs")}
                    className="text-[10px] text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Mahsulot: {calc.prodW}×{calc.prodH}mm
                  </button>
                )}
              </div>

              {/* Gap & Gripper */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    Pichoq oralig&apos;i / Gap (mm)
                  </label>
                  <Input
                    type="number"
                    value={calc.gap}
                    onChange={(e) => calc.setGap(Math.max(0, Number(e.target.value)))}
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    Klapan / Gripper (mm)
                  </label>
                  <div className="flex gap-1">
                    <Select
                      value={calc.gripperEdge}
                      onValueChange={(v) => v && calc.setGripperEdge(v as GripperEdge)}
                    >
                      <SelectTrigger className="h-7 text-xs px-1.5 w-[72px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="Auto">Auto</SelectItem>
                        <SelectItem value="Bottom">Past</SelectItem>
                        <SelectItem value="Top">Yuqori</SelectItem>
                        <SelectItem value="Left">Chap</SelectItem>
                        <SelectItem value="Right">O&apos;ng</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={calc.gripper}
                      onChange={(e) => calc.setGripper(Math.max(0, Number(e.target.value)))}
                      className="h-7 text-xs font-mono text-center bg-background px-1 flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Margins T / B / L / R */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Hoshiyalar (T / B / L / R mm)
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Bleed: {calc.bleed}mm
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <Input
                    type="number"
                    value={calc.marginTop}
                    onChange={(e) => calc.setMarginTop(Math.max(0, Number(e.target.value)))}
                    className="h-7 text-xs font-mono text-center bg-background px-1"
                    title="Yuqori hoshiya (Top)"
                  />
                  <Input
                    type="number"
                    value={calc.marginBottom}
                    onChange={(e) => calc.setMarginBottom(Math.max(0, Number(e.target.value)))}
                    className="h-7 text-xs font-mono text-center bg-background px-1"
                    title="Pastki hoshiya (Bottom)"
                  />
                  <Input
                    type="number"
                    value={calc.marginLeft}
                    onChange={(e) => calc.setMarginLeft(Math.max(0, Number(e.target.value)))}
                    className="h-7 text-xs font-mono text-center bg-background px-1"
                    title="Chap hoshiya (Left)"
                  />
                  <Input
                    type="number"
                    value={calc.marginRight}
                    onChange={(e) => calc.setMarginRight(Math.max(0, Number(e.target.value)))}
                    className="h-7 text-xs font-mono text-center bg-background px-1"
                    title="O'ng hoshiya (Right)"
                  />
                </div>
              </div>

              {/* Overproduction & Target Plate Count */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    Zaxira / Ortiqcha bosma
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      value={calc.overproductionValue}
                      onChange={(e) =>
                        calc.setOverproductionValue(Math.max(0, Number(e.target.value)))
                      }
                      className="h-7 text-xs font-mono text-center bg-background px-1 flex-1"
                    />
                    <div className="flex bg-muted p-0.5 rounded border border-border font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => calc.setOverproductionMode("percent")}
                        className={cn(
                          "px-1.5 py-0.5 rounded cursor-pointer",
                          calc.overproductionMode === "percent"
                            ? "bg-background text-foreground font-bold shadow-2xs"
                            : "text-muted-foreground"
                        )}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => calc.setOverproductionMode("exact")}
                        className={cn(
                          "px-1.5 py-0.5 rounded cursor-pointer",
                          calc.overproductionMode === "exact"
                            ? "bg-background text-foreground font-bold shadow-2xs"
                            : "text-muted-foreground"
                        )}
                      >
                        dona
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    Maqsadli forma soni
                  </label>
                  <Select
                    value={
                      calc.targetPlateCount === undefined
                        ? "auto"
                        : String(calc.targetPlateCount)
                    }
                    onValueChange={(val) => {
                      const nextCount = !val || val === "auto" ? undefined : Number(val);
                      calc.handleAutoPartitionPlates("smart_gang_optimizer", undefined, nextCount);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="auto">Avtomatik</SelectItem>
                      <SelectItem value="1">1 ta forma</SelectItem>
                      <SelectItem value="2">2 ta forma</SelectItem>
                      <SelectItem value="3">3 ta forma</SelectItem>
                      <SelectItem value="4">4 ta forma</SelectItem>
                      <SelectItem value="5">5 ta forma</SelectItem>
                      <SelectItem value="6">6 ta forma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Kashirovka strategy switch if enabled in Specs */}
              {calc.kashMode !== "none" && (
                <div className="pt-1.5 border-t border-border space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-foreground">
                      Kashirovka ({calc.kashMode === "triplex" ? "Triplex" : "Duplex"})
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {calc.kashirovkaSummary.totalMountedGsm}g/m²
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => calc.setKashStrategy("split_half_sheet")}
                      className={cn(
                        "py-1 px-2 rounded border text-[10px] font-medium cursor-pointer",
                        calc.kashStrategy === "split_half_sheet"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-background border-border text-muted-foreground"
                      )}
                    >
                      Yarim list (Oldi|Orqa)
                    </button>
                    <button
                      type="button"
                      onClick={() => calc.setKashStrategy("separate_sheets")}
                      className={cn(
                        "py-1 px-2 rounded border text-[10px] font-medium cursor-pointer",
                        calc.kashStrategy === "separate_sheets"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-background border-border text-muted-foreground"
                      )}
                    >
                      Alohida listlarda
                    </button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Unified Export & CTP Tech Card Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Eksport / Tex-Karta</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <DropdownMenuItem
                onClick={() => calc.setIsJobTicketOpen(true)}
                className="cursor-pointer font-semibold text-blue-600 dark:text-blue-400"
              >
                <FileText className="w-3.5 h-3.5 mr-2" />
                <span>CTP Tex-Karta (Job Ticket)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => calc.handleExportPDF(false)}
                className="cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 mr-2 text-rose-600" />
                <span>Montaj PDF ({calc.activePlate.name})</span>
              </DropdownMenuItem>
              {calc.plates.length > 1 && (
                <DropdownMenuItem
                  onClick={() => calc.handleExportPDF(true)}
                  className="cursor-pointer font-medium"
                >
                  <FileDown className="w-3.5 h-3.5 mr-2 text-blue-600" />
                  <span>Barcha {calc.plates.length} ta forma PDF</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={calc.handleExportSVG} className="cursor-pointer">
                <Download className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <span>Vektor SVG chizma</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Primary Action: Apply Imposition to Order (BOM + Tooling + Specs) */}
          {props.onApplyToOrder && (
            <Button
              type="button"
              size="sm"
              onClick={onTriggerApply}
              className={cn(
                "h-7 px-3 text-xs font-semibold gap-1.5 cursor-pointer transition-all",
                justApplied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : calc.hasUnappliedChanges
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
              )}
              title="Hisoblangan qog'oz listlari va CTP plastinalar sonini buyurtmaning Materiallar (BOM) va Qoliplar bo'limiga yozish"
            >
              {justApplied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Qo&apos;llandi</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Buyurtmaga qo&apos;llash</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. COMPACT KPI SUMMARY STRIP (1 ROW, ALL CRITICAL PREPRESS METRICS)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 bg-muted/40 border border-border rounded-md shrink-0 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Machine & Plate Format */}
          <span className="flex items-center gap-1 text-muted-foreground">
            <Printer className="w-3 h-3 text-blue-600 shrink-0" />
            <strong className="text-foreground font-medium">
              {calc.machineConstraints.machineName.replace("Heidelberg Speedmaster ", "Heidelberg ")}
            </strong>
            <span className="font-mono text-[10px]">
              (Qolip: {calc.machineConstraints.plateW}×{calc.machineConstraints.plateH}mm)
            </span>
          </span>

          <span className="text-border">|</span>

          {/* Grid & Effective Slots */}
          <span className="text-muted-foreground">
            Joylashuv:{" "}
            <strong className="font-mono text-foreground">
              {calc.layout.cols}×{calc.layout.rows} = {calc.effectivePieces} joy
            </strong>
            {calc.isSplitSheetLayout && (
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 ml-1">
                (2×{calc.effectivePieces})
              </span>
            )}
          </span>

          <span className="text-border">|</span>

          {/* Sheet Utilization */}
          <span className="text-muted-foreground">
            Foydalanish:{" "}
            <strong
              className={cn(
                "font-mono",
                calc.layout.utilization >= 70
                  ? "text-emerald-700 dark:text-emerald-400"
                  : calc.layout.utilization >= 50
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-rose-700 dark:text-rose-400"
              )}
            >
              {calc.layout.utilization.toFixed(1)}%
            </strong>
          </span>

          <span className="text-border">|</span>

          {/* Press Sheets & Parent Sheets */}
          <span className="text-muted-foreground">
            Tiraj:{" "}
            <strong className="font-mono text-foreground">
              {calc.totalSheetsRun.toLocaleString()} bosma list
            </strong>
            {calc.cutDivisor > 1 && (
              <span className="font-mono text-blue-700 dark:text-blue-300 ml-1">
                ({calc.totalParentSheetsNeeded.toLocaleString()} xom list · 1/{calc.cutDivisor})
              </span>
            )}
          </span>

          <span className="text-border">|</span>

          {/* Total CTP Plates */}
          <span className="text-muted-foreground">
            CTP:{" "}
            <strong className="font-mono text-blue-700 dark:text-blue-300">
              {calc.totalCtpPlates} dona
            </strong>{" "}
            <span className="font-mono text-[10px]">
              ({calc.frontColorsCount}+{calc.backColorsCount})
            </span>
          </span>

          <span className="text-border">|</span>

          {/* Direct Cost Pill (Links to Financials tab) */}
          <button
            type="button"
            onClick={() => calc.onSwitchTab?.("financials")}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Moliya va tannarx bo'limiga o'tish"
          >
            <span>Bosma:</span>
            <strong className="font-mono text-foreground underline decoration-dotted">
              ${calc.printPlan.totalDirectProductionCost.toLocaleString()}
            </strong>
          </button>
        </div>

        {/* Right: Collapsible Matrix Drawer Toggle */}
        <button
          type="button"
          onClick={() => calc.setIsMatrixOpen(!calc.isMatrixOpen)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition-colors cursor-pointer",
            calc.isMatrixOpen
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-background hover:bg-muted text-foreground border-border"
          )}
        >
          <TableIcon className="w-3 h-3" />
          <span>Matritsa jadvali ({calc.plates.length} forma)</span>
          {calc.isMatrixOpen ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Machine Format Warning Banner (only if manual sheet size violates press constraints) */}
      {!currentPressFits && (
        <div className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded text-[11px] text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Bosma list ({calc.sheetW}×{calc.sheetH} mm){" "}
              <strong>{calc.machineConstraints.machineName}</strong> formatiga (max{" "}
              {calc.machineConstraints.maxW}×{calc.machineConstraints.maxH} mm) mos emas!
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => calc.handleSelectCutOption(calc.optimalCutOption)}
            className="h-6 text-[10px] px-2 border-rose-400 text-rose-700 dark:text-rose-300 cursor-pointer"
          >
            Avto kesim: {calc.optimalCutOption.label}
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MAIN WORKSPACE: COMPACT SKU TABLE (LEFT) + VISUAL SHEET (CENTER)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0 overflow-hidden">
        {/* ── LEFT DOCK: HIGH-DENSITY 28PX SKU TABLE ── */}
        <div className="w-full md:w-[310px] shrink-0 bg-card border border-border rounded-md flex flex-col overflow-hidden">
          {/* Table Header Bar */}
          <div className="h-7 px-2.5 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
            <span className="font-semibold text-[11px] text-foreground">
              O&apos;lchamlar ({calc.adjustedSizes.length} SKU)
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {calc.activePlate.name} ({allocatedSlotsInActivePlate}/{calc.effectivePieces} joy)
            </span>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[1fr_54px_76px_46px_44px] items-center px-2 py-1 border-b border-border bg-muted/20 text-[10px] font-semibold text-muted-foreground shrink-0">
            <span>SKU</span>
            <span className="text-right">Tiraj</span>
            <span className="text-center">Joy</span>
            <span className="text-right">List</span>
            <span className="text-right">+Farq</span>
          </div>

          {/* Dense 28px Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50 no-scrollbar">
            {calc.adjustedSizes.length > 0 ? (
              calc.adjustedSizes.map((size, idx) => {
                const assignment = calc.activePlate.assignments.find((a) => a.sizeId === size.id);
                const currentSlots = assignment ? assignment.slots : 0;
                const sheetsNeeded =
                  currentSlots > 0 ? Math.ceil(size.quantity / currentSlots) : 0;
                const isBottleneck =
                  currentSlots > 0 &&
                  sheetsNeeded === calc.activePlate.requiredSheets &&
                  calc.activePlate.requiredSheets > 0;
                const overQty = assignment?.overproduction ?? 0;
                const dotColor = COLOR_PALETTE[idx % COLOR_PALETTE.length];

                return (
                  <div
                    key={size.id}
                    className={cn(
                      "grid grid-cols-[1fr_54px_76px_46px_44px] items-center px-2 h-7 text-[11px] transition-colors",
                      currentSlots > 0
                        ? "bg-background hover:bg-muted/40"
                        : "bg-muted/20 text-muted-foreground opacity-65 hover:opacity-100"
                    )}
                  >
                    {/* Color Dot + SKU Label */}
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span
                        className="w-2.5 h-2.5 rounded-xs border border-zinc-400/60 shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span
                        className={cn(
                          "truncate font-medium",
                          isBottleneck ? "font-bold text-foreground" : "text-foreground"
                        )}
                        title={size.size}
                      >
                        {size.size}
                      </span>
                    </div>

                    {/* Target Quantity */}
                    <span className="text-right font-mono text-[11px] text-foreground">
                      {size.quantity.toLocaleString()}
                    </span>

                    {/* [- Slot +] Stepper */}
                    <div className="flex items-center justify-center">
                      <div className="inline-flex items-center h-5 rounded border border-border bg-muted/40 font-mono">
                        <button
                          type="button"
                          onClick={() =>
                            calc.handleManualSlotChange(size.id, Math.max(0, currentSlots - 1))
                          }
                          className="w-4 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          title="Joyni kamaytirish"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={calc.effectivePieces}
                          value={currentSlots}
                          onChange={(e) =>
                            calc.handleManualSlotChange(
                              size.id,
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          className="w-7 h-full text-center bg-transparent text-[11px] font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            calc.handleManualSlotChange(size.id, currentSlots + 1)
                          }
                          className="w-4 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          title="Joyni ko'paytirish"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sheets Needed for this SKU */}
                    <span
                      className={cn(
                        "text-right font-mono text-[11px]",
                        isBottleneck
                          ? "font-bold text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                      )}
                      title={isBottleneck ? "Ushbu formaning tirajini belgilovchi o'lcham" : undefined}
                    >
                      {currentSlots > 0 ? sheetsNeeded.toLocaleString() : "—"}
                    </span>

                    {/* Overproduction (+Farq) */}
                    <span className="text-right font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                      {currentSlots > 0 ? `+${overQty}` : "—"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-muted-foreground text-xs">
                Yagona mahsulot ({calc.baseQuantity.toLocaleString()} dona · {calc.effectivePieces} joy/list)
              </div>
            )}
          </div>

          {/* Sticky Totals Footer */}
          <div className="h-7 px-2 border-t border-border bg-muted/40 grid grid-cols-[1fr_54px_76px_46px_44px] items-center font-mono text-[11px] font-semibold shrink-0">
            <span className="font-sans text-foreground">Jami</span>
            <span className="text-right text-foreground">
              {totalOrderQtyInActivePlate.toLocaleString()}
            </span>
            <span
              className={cn(
                "text-center",
                allocatedSlotsInActivePlate === calc.effectivePieces
                  ? "text-emerald-600 dark:text-emerald-400"
                  : allocatedSlotsInActivePlate > calc.effectivePieces
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400"
              )}
            >
              {allocatedSlotsInActivePlate}/{calc.effectivePieces}
            </span>
            <span className="text-right text-blue-600 dark:text-blue-400">
              {calc.activePlate.requiredSheets.toLocaleString()}
            </span>
            <span className="text-right text-[10px] text-emerald-600 dark:text-emerald-400">
              +{calc.activePlate.totalOverproduction || 0}
            </span>
          </div>
        </div>

        {/* ── CENTER: LARGE VISUAL SHEET CANVAS ── */}
        <div className="flex-1 flex flex-col gap-1.5 min-h-0 bg-card border border-border rounded-md p-1.5 overflow-hidden">
          {/* Single-Row Canvas Mini-Header */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded shrink-0">
            {/* Left: Forma Pager + Add Forma */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-background border border-border rounded h-6 px-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 cursor-pointer"
                  disabled={calc.activePlateIndex <= 0}
                  onClick={() => calc.setActivePlateIndex((prev) => Math.max(0, prev - 1))}
                  title="Oldingi forma"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2 font-semibold text-xs text-foreground font-mono">
                  Forma {calc.activePlateIndex + 1} / {calc.plates.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 cursor-pointer"
                  disabled={calc.activePlateIndex >= calc.plates.length - 1}
                  onClick={() =>
                    calc.setActivePlateIndex((prev) => Math.min(calc.plates.length - 1, prev + 1))
                  }
                  title="Keyingi forma"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={calc.handleAddPlate}
                className="h-6 px-1.5 text-[11px] gap-1 bg-background cursor-pointer"
                title="Yangi forma qo'shish"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Forma</span>
              </Button>

              <Badge variant="outline" className="h-6 px-2 text-[11px] font-mono bg-background font-semibold">
                {calc.activePlate.requiredSheets.toLocaleString()} list bosiladi
              </Badge>
            </div>

            {/* Center: Unified Blue Side Switcher (Oldi / Orqa) */}
            <div className="flex items-center bg-muted p-0.5 rounded border border-border text-[11px]">
              <button
                type="button"
                onClick={() => calc.setActiveSide("front")}
                className={cn(
                  "px-2.5 py-0.5 rounded font-semibold transition-all cursor-pointer",
                  calc.activeSide === "front"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Oldi ({calc.frontColorsCount} rang)
              </button>
              <button
                type="button"
                onClick={() => calc.setActiveSide("back")}
                disabled={calc.backColorsCount <= 0 && !calc.isSplitSheetLayout}
                className={cn(
                  "px-2.5 py-0.5 rounded font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  calc.activeSide === "back"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Orqa ({calc.backColorsCount} rang)
              </button>
            </div>

            {/* Right: Orientation Toggle */}
            <div className="flex items-center gap-1.5">
              <Button
                onClick={calc.switchOrientation}
                variant="outline"
                size="sm"
                className="h-6 text-[11px] gap-1 px-2 bg-background cursor-pointer"
                title="Mahsulotni 90° aylantirish (Portret / Albom)"
              >
                <RotateCw className="w-3 h-3" />
                <span>{calc.orientation === "A" ? "Portret" : "Albom"}</span>
              </Button>
            </div>
          </div>

          {/* SheetPreview SVG Canvas */}
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
            splitCutAxisX={calc.splitCutAxisX}
            isWorkAndTurn={calc.isWorkAndTurn}
            shapeType={props.shapeType}
            customShape={props.customShape}
            customSvgPath={props.customSvgPath}
            cornerType={props.cornerType}
            artworkFront={calc.effectiveArtworkFront || props.artworkFront}
            artworkBack={calc.effectiveArtworkBack || props.artworkBack}
            activeSide={calc.activeSide}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. COLLAPSIBLE BOTTOM MATRIX DRAWER (FOR MULTI-PLATE SPREADSHEET EDITING)
      ───────────────────────────────────────────────────────────── */}
      {calc.isMatrixOpen && (
        <div className="h-[260px] shrink-0 bg-card border border-border rounded-md overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 duration-150">
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
            onSwitchToVisualizer={() => calc.setIsMatrixOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export default PhoenixWorkspace;
