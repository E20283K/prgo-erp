"use client";

import React, { useState, useMemo } from "react";
import { cn } from "cn";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  Printer,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Layers,
  Boxes,
  Users,
  Cpu,
  Sparkles,
  ArrowRight,
  Percent,
  Clock,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShiftEvent, WorkOrderFormData, RouteStep } from "../types";
import { PrintPlanningResult } from "../planningEngine";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { formatMoney } from "../../common/DocumentShell";

interface FinancialsTabProps {
  shiftEvents: ShiftEvent[];
  formData?: WorkOrderFormData;
  printPlan?: PrintPlanningResult;
  operations?: RouteStep[];
  docNo?: string;
  onPriceChange?: (newPrice: number, financials?: any) => void;
}

const MARKUP_PRESETS = [15, 25, 35, 50, 75, 100];

export function FinancialsTab({
  shiftEvents,
  formData,
  printPlan,
  operations = [],
  docNo = "WO-00000",
  onPriceChange,
}: FinancialsTabProps) {
  const { warehouseStock, addNotification } = useWorkspaceStore();

  const [viewMode, setViewMode] = useState<"internal" | "quotation">("internal");
  const [copied, setCopied] = useState(false);

  const targetQty = formData?.quantity || 5000;
  const currentSellingPrice = formData?.priceTotal || 14850;
  const currency = formData?.currency || "USD";

  // ─── 1. REAL COST DRIVERS (TANNARX MODELI) ───────────────────────────────────

  // A. Qog'oz xarajati (Paper Stock & Sheets)
  const paperStockItem = useMemo(() => {
    if (!formData?.paperStock) return undefined;
    const clean = formData.paperStock.toLowerCase();
    return warehouseStock.find((s) => clean.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(clean));
  }, [formData?.paperStock, warehouseStock]);

  const requiredSheets = printPlan?.requiredParentSheets || Math.ceil((targetQty * 1.1) / (formData?.sizes?.length || 10));
  const paperSheetPrice = paperStockItem?.unitPriceUsd || (printPlan ? printPlan.estimatedPaperCost / Math.max(1, requiredSheets) : 0.19);
  const paperTotalCost = Number((requiredSheets * paperSheetPrice).toFixed(2));
  const paperWeightKg = printPlan?.totalPaperWeightKg || Number(((requiredSheets * 0.7 * 150) / 1000).toFixed(1));

  // B. CTP Qoliplari (Plates & Prepress)
  const ctpPlatesCount = printPlan?.totalCtpPlates || 4;
  const plateStockItem = warehouseStock.find((s) => s.category === "Inks & Plates" && s.unit === "pcs");
  const plateUnitPrice = plateStockItem?.unitPriceUsd || 7.20;
  const platesTotalCost = Number((ctpPlatesCount * plateUnitPrice).toFixed(2));

  // C. Kraska va Kimyoviy materiallar (Inks & Chemistry)
  const totalInksCount = printPlan?.totalUniqueInks || 4;
  const inkStockItem = warehouseStock.find((s) => s.category === "Inks & Plates" && s.unit === "kg");
  const inkUnitPrice = inkStockItem?.unitPriceUsd || 11.50;
  // Approximating ink usage: ~1.2 kg per 5000 impressions per 4 colors
  const estimatedInkKg = Number((((printPlan?.totalImpressions || targetQty) / 5000) * (totalInksCount * 0.35)).toFixed(2));
  const inkTotalCost = Number((estimatedInkKg * inkUnitPrice).toFixed(2));

  // D. Bosma Mashinasi va Uskunalar Amortizatsiyasi (Machine Runtime & Depreciation)
  // Base machine hourly rate without labor
  const machineHourRate = 40.0;
  const totalMachineHours = printPlan?.totalPressHours || 2.5;
  const machineTotalCost = Number((totalMachineHours * machineHourRate).toFixed(2));

  // E. Ishchilar Oyligi / Mehnat haqi fondi (Direct Labor Cost)
  // Press operator ($15/hr) + Post-press staff ($10/hr)
  const operatorHourRate = 15.0;
  const pressLaborCost = Number((totalMachineHours * operatorHourRate).toFixed(2));
  const postPressHours = Math.max(1.0, operations.length * 0.5);
  const postPressLaborCost = Number((postPressHours * 10.0).toFixed(2));
  const totalLaborCost = Number((pressLaborCost + postPressLaborCost).toFixed(2));

  // F. Pardozlash va Qadoqlash (Lamination, Die-cut, Packing)
  const isLaminated = formData?.lamination && formData.lamination.toLowerCase() !== "none";
  const laminationCost = isLaminated ? Number((targetQty * 0.025).toFixed(2)) : 0;
  const packagingCost = Number((Math.ceil(targetQty / 500) * 2.5).toFixed(2)); // $2.5 per box of 500
  const finishingTotalCost = Number((laminationCost + packagingCost).toFixed(2));

  // G. Sifat Nuqsoni va Brak (Cost of Poor Quality - COPQ)
  const wasteEvents = shiftEvents.filter((ev) => ev.type === "Waste" && ev.wasteQty);
  const totalWasteQty = wasteEvents.reduce((sum, ev) => sum + (ev.wasteQty || 0), 0);
  const approxUnitBaseCost = (paperTotalCost + platesTotalCost + inkTotalCost + machineTotalCost + totalLaborCost + finishingTotalCost) / targetQty;
  const wasteLossCost = Number((totalWasteQty * approxUnitBaseCost).toFixed(2));

  // ─── 2. TOTAL PRODUCTION BASE COST (JAMI ISHLAB CHIQARISH TANNARXI) ──────────
  const totalBaseCost = Number(
    (
      paperTotalCost +
      platesTotalCost +
      inkTotalCost +
      machineTotalCost +
      totalLaborCost +
      finishingTotalCost +
      wasteLossCost
    ).toFixed(2)
  );

  const unitBaseCost = Number((totalBaseCost / Math.max(1, targetQty)).toFixed(4));

  // ─── 3. PRICING & MARKUP CALCULATOR STATE ────────────────────────────────────
  const [markupPercent, setMarkupPercent] = useState<number>(() => {
    if (totalBaseCost <= 0) return 30;
    const currentMarkup = ((currentSellingPrice - totalBaseCost) / totalBaseCost) * 100;
    return Number(Math.max(5, currentMarkup).toFixed(1));
  });

  const [customPriceInput, setCustomPriceInput] = useState<string>(String(currentSellingPrice));

  // Sync calculations whenever markup changes
  const calculatedSellingPrice = useMemo(() => {
    return Number((totalBaseCost * (1 + markupPercent / 100)).toFixed(2));
  }, [totalBaseCost, markupPercent]);

  const activeSellingPrice = Number(customPriceInput) > 0 ? Number(customPriceInput) : calculatedSellingPrice;
  const unitSellingPrice = Number((activeSellingPrice / Math.max(1, targetQty)).toFixed(4));
  const grossProfit = Number((activeSellingPrice - totalBaseCost).toFixed(2));
  const profitMarginPercent = activeSellingPrice > 0 ? Number(((grossProfit / activeSellingPrice) * 100).toFixed(1)) : 0;
  const unitGrossProfit = Number((unitSellingPrice - unitBaseCost).toFixed(4));

  // Handlers
  const handleSelectMarkupPreset = (pct: number) => {
    setMarkupPercent(pct);
    const newPrice = Number((totalBaseCost * (1 + pct / 100)).toFixed(2));
    setCustomPriceInput(String(newPrice));
  };

  const handleCustomPriceChange = (valStr: string) => {
    setCustomPriceInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > totalBaseCost && totalBaseCost > 0) {
      const derivedMarkup = Number((((val - totalBaseCost) / totalBaseCost) * 100).toFixed(1));
      setMarkupPercent(derivedMarkup);
    }
  };

  const handleApplyPriceToOrder = () => {
    if (onPriceChange) {
      onPriceChange(activeSellingPrice, {
        plannedMaterialCost: paperTotalCost + platesTotalCost + inkTotalCost,
        actualMaterialCost: paperTotalCost + platesTotalCost + inkTotalCost + wasteLossCost,
        plannedMachineCost: machineTotalCost,
        actualMachineCost: machineTotalCost,
        laborCost: totalLaborCost,
        baseCost: totalBaseCost,
        wasteCost: wasteLossCost,
        margin: profitMarginPercent,
      });

      addNotification({
        title: "Tijoriy narx buyurtmaga tatbiq etildi",
        description: `${docNo}: Yangi sotuv narxi ${formatMoney(activeSellingPrice, currency)} qilib belgilandi (Marja: ${profitMarginPercent}%).`,
        severity: "success",
      });
    }
  };

  const handleCopyQuoteText = () => {
    const text = `TIJORIY TAKLIF (QUOTATION)
Buyurtma №: ${docNo}
Mijoz: ${formData?.customer || "—"}
Mahsulot: ${formData?.product || "—"}
Tiraj: ${targetQty.toLocaleString()} ${formData?.unit || "dona"}
O'lcham: ${formData?.width || 50}×${formData?.height || 90} mm
Qog'oz: ${formData?.paperStock || "—"}
Ranglilik: ${formData?.colorsConfig || "4+0 (CMYK)"}
Pardozlash: ${formData?.lamination || "Mavjud emas"}
Yetkazish muddati: ${formData?.deadline || "—"}

1 dona narxi: ${formatMoney(unitSellingPrice, currency, 3)}
JAMI SUMMA: ${formatMoney(activeSellingPrice, currency)}
To'lov shartlari: 50% avans to'lovi, 50% mahsulot tayyor bo'lgach.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification({
      title: "Taklif nusxalandi",
      description: "Mijozga yuborish uchun tijoriy taklif matni nusxalandi.",
      severity: "info",
    });
  };

  return (
    <TabsContent value="financials" className="flex-1 p-4 m-0 overflow-y-auto space-y-4 text-xs">
      {/* ── TOP BAR: TITLE & VIEW MODE SWITCHER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span>Moliyaviy Hisob-Kitob & Narxlash</span>
              <Badge variant="outline" className="text-[10px] font-mono font-medium">
                {docNo}
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Real materiallar, CTP, uskuna va ishchilar oyligi asosida shakllangan tannarx
            </p>
          </div>
        </div>

        {/* View Switcher: Internal vs Customer Quotation */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setViewMode("internal")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "internal"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calculator className="w-3.5 h-3.5 text-blue-500" />
            <span>👔 Ichki Kalkulyatsiya & Marja</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("quotation")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              viewMode === "quotation"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            <span>📄 Mijoz uchun Tijoriy Taklif</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Base Cost */}
        <Card className="shadow-xs border-border">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Baza Tannarx (COGS)</span>
              <Boxes className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {formatMoney(totalBaseCost, currency)}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              1 dona: <strong>{formatMoney(unitBaseCost, currency, 3)}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Markup */}
        <Card className="shadow-xs border-border bg-blue-500/5">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
              <span className="text-[11px] font-medium">Ustama (Markup)</span>
              <Percent className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
              +{markupPercent.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">
              Tannarxdan ustama: <strong>+{formatMoney(grossProfit, currency)}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Selling Price */}
        <Card className="shadow-xs border-border bg-emerald-500/5">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
              <span className="text-[11px] font-medium">Sotuv Narxi (Price)</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatMoney(activeSellingPrice, currency)}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              1 dona: <strong>{formatMoney(unitSellingPrice, currency, 3)}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Profit Margin */}
        <Card className="shadow-xs border-border">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Sof Marja (Margin)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {profitMarginPercent.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              1 donadan sof: <strong>+{formatMoney(unitGrossProfit, currency, 3)}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── VIEW A: INTERNAL COSTING & PRICING CALCULATOR ── */}
      {viewMode === "internal" ? (
        <div className="space-y-4">
          {/* PRICING & MARKUP CONTROL PANEL */}
          <div className="bg-card border border-border rounded-lg p-3.5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-xs text-foreground">
                  Ustama & Tijoriy Narx Belgilash (Pricing Tool)
                </h4>
              </div>

              {activeSellingPrice !== currentSellingPrice && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  Saqlanmagan narx farqi: {formatMoney(activeSellingPrice - currentSellingPrice, currency)}
                </Badge>
              )}
            </div>

            {/* Presets and manual inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Left: Quick Markup Pills (6 cols) */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium block">
                  Tezkor ustama foizlari (Markup Presets):
                </label>
                <div className="flex items-center gap-1.5">
                  {MARKUP_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleSelectMarkupPreset(pct)}
                      className={cn(
                        "flex-1 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer",
                        markupPercent === pct
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                      )}
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Middle: Manual Markup / Price Input (4 cols) */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium block">
                  Jami Sotuv Narxi ({currency}):
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={customPriceInput}
                    onChange={(e) => handleCustomPriceChange(e.target.value)}
                    className="h-8 text-xs font-mono font-bold pl-7 pr-2 bg-background"
                  />
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Right: Apply Button (3 cols) */}
              <div className="md:col-span-3 flex items-end">
                <Button
                  type="button"
                  onClick={handleApplyPriceToOrder}
                  className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Narxni Buyurtmaga Saqlash</span>
                </Button>
              </div>
            </div>
          </div>

          {/* REAL PRODUCTION COST BREAKDOWN TABLE */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
            <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-xs text-foreground">
                  Ishlab Chiqarish Haqiqiy Xarajatlar Tarkibi (Cost Breakdown)
                </h4>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                Tiraj: {targetQty.toLocaleString()} {formData?.unit}
              </span>
            </div>

            <div className="divide-y divide-border text-xs">
              {/* 1. Qog'oz / Karton */}
              <div className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Qog'oz / Asosiy xomashyo</span>
                    <span className="text-muted-foreground font-normal">
                      ({formData?.paperStock || "Asosiy list"})
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {requiredSheets.toLocaleString()} varaq (flatsheet) • {paperWeightKg} kg • {formatMoney(paperSheetPrice, currency, 3)}/varaq
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground">
                    {formatMoney(paperTotalCost, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((paperTotalCost / totalBaseCost) * 100).toFixed(1)}% umumiy xarajat
                  </div>
                </div>
              </div>

              {/* 2. CTP Formalar */}
              <div className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>CTP Qoliplari (Thermal Plates)</span>
                    <span className="text-muted-foreground font-normal">
                      ({printPlan?.colorNotation || "4+0"} rang)
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {ctpPlatesCount} dona qolip • {formatMoney(plateUnitPrice, currency)}/dona
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground">
                    {formatMoney(platesTotalCost, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((platesTotalCost / totalBaseCost) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 3. Kraska va kimyoviy materiallar */}
              <div className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span>Bosma Kraskasi (CMYK & Pantone)</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    ~{estimatedInkKg} kg kraska sarfi • {formatMoney(inkUnitPrice, currency)}/kg
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground">
                    {formatMoney(inkTotalCost, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((inkTotalCost / totalBaseCost) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 4. Mashina va Uskuna Amortizatsiyasi */}
              <div className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Bosma Uskunasi Ish Vaqti & Amortizatsiya</span>
                    <span className="text-muted-foreground font-normal">
                      ({formData?.pressMachine?.replace("Speedmaster ", "") || "Ofset"})
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {totalMachineHours} soat mashina vaqti (Setup + Run) • {formatMoney(machineHourRate, currency)}/soat
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground">
                    {formatMoney(machineTotalCost, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((machineTotalCost / totalBaseCost) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 5. Ishchilar Oyligi / Mehnat haqi fondi */}
              <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-muted/10 hover:bg-muted/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold">Ishchilar Oyligi (Mehnat haqi fondi)</span>
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Oylik Fondi
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Bosmachi operatori ({totalMachineHours}h × {formatMoney(operatorHourRate, currency)}) + Pardozlash ustasi ({postPressHours}h × $10)
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {formatMoney(totalLaborCost, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((totalLaborCost / totalBaseCost) * 100).toFixed(1)}% umumiy tannarxdan
                  </div>
                </div>
              </div>

              {/* 6. Pardozlash & Qadoqlash */}
              <div className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Post-press Pardozlash & Qadoqlash</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {isLaminated ? `Laminatsiya (${formData?.lamination})` : "Laminatsiyasiz"} + Qadoqlash g'iloflari ({formatMoney(packagingCost, currency)})
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground">
                    {formatMoney(finishingTotalCost, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((finishingTotalCost / totalBaseCost) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 7. Brak va Sifat Ziyonlari (COPQ) */}
              {wasteLossCost > 0 && (
                <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                  <div className="space-y-0.5">
                    <div className="font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sifat Nuqsoni va Brak Ziyoni (COPQ)</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Smenada qayd etilgan {totalWasteQty} dona nuqsonli list
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      +{formatMoney(wasteLossCost, currency)}
                    </div>
                    <div className="text-[10px] text-rose-600/80">
                      Ziyon summasi
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Total Footer */}
            <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between font-semibold">
              <span className="text-xs text-foreground">JAMI BAZA TANNARX (TOTAL COGS):</span>
              <span className="text-sm font-mono font-bold text-foreground">
                {formatMoney(totalBaseCost, currency)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── VIEW B: CUSTOMER COMMERCIAL OFFER (TIJORIY TAKLIF) ── */
        <div className="space-y-3">
          {/* Actions toolbar */}
          <div className="flex items-center justify-between bg-card border border-border p-2.5 rounded-lg shadow-xs">
            <div className="text-xs text-muted-foreground">
              Ushbu ko'rinishda tannarx va ish haqi yashirilgan. Uni mijozga rasmiy tijoriy taklif sifatida taqdim etishingiz mumkin.
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyQuoteText}
                className="h-7 text-xs gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Nusxalandi!" : "Matndan Nusxa Olish"}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Chop etish (Ctrl+P)</span>
              </Button>
            </div>
          </div>

          {/* Quotation Document Card */}
          <div className="bg-card border border-border rounded-lg p-6 max-w-3xl mx-auto shadow-sm space-y-6 print:border-none print:shadow-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">TIJORIY TAKLIF / SMETA</h2>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Hujjat №: <strong className="text-foreground font-mono">{docNo}</strong>
                </div>
                <div className="text-xs text-muted-foreground">
                  Sana: {new Date().toISOString().split("T")[0]}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-foreground">PrintGoo ERP / Poligrafiya</div>
                <div className="text-xs text-muted-foreground">Ishlab chiqarish va qadoqlash korxonasi</div>
              </div>
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-3 rounded-md border border-border/60">
              <div>
                <span className="text-muted-foreground block text-[11px]">Buyurtmachi (Mijoz):</span>
                <strong className="text-sm text-foreground">{formData?.customer || "—"}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[11px]">Tayyor bo'lish muddati:</span>
                <strong className="text-foreground font-mono">{formData?.deadline || "—"}</strong>
              </div>
            </div>

            {/* Product Specifications Table */}
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Mahsulot tavsifi & Parametrlari</th>
                    <th className="p-2.5 text-center">Tiraj</th>
                    <th className="p-2.5 text-right">1 dona narxi</th>
                    <th className="p-2.5 text-right">Jami summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 space-y-1">
                      <div className="font-semibold text-foreground text-sm">
                        {formData?.product || "Poligrafiya mahsuloti"}
                      </div>
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        <div>• Format: {formData?.width || 50}×{formData?.height || 90} mm</div>
                        <div>• Qog'oz / Material: {formData?.paperStock || "Standart"}</div>
                        <div>• Ranglilik: {formData?.colorsConfig || "4+0 (CMYK)"}</div>
                        {formData?.lamination && formData.lamination.toLowerCase() !== "none" && (
                          <div>• Pardozlash: {formData.lamination}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-center font-mono font-medium text-foreground">
                      {targetQty.toLocaleString()} {formData?.unit || "dona"}
                    </td>
                    <td className="p-2.5 text-right font-mono font-medium text-foreground">
                      {formatMoney(unitSellingPrice, currency, 3)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-foreground text-sm">
                      {formatMoney(activeSellingPrice, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Commercial Terms & Total */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              <div className="text-[11px] text-muted-foreground space-y-1 max-w-sm">
                <div className="font-semibold text-foreground">To'lov va Yetkazib berish shartlari:</div>
                <div>1. To'lov sharti: 50% oldindan avans to'lovi, qolgan 50% mahsulot topshirilganda.</div>
                <div>2. Taklifning amal qilish muddati: 14 kalendar kuni.</div>
                <div>3. Mahsulot texnik talablar va namunaga to'liq muvofiq ishlab chiqariladi.</div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border text-right space-y-1 min-w-[200px]">
                <span className="text-[11px] text-muted-foreground block">Jami To'lov Summasi:</span>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatMoney(activeSellingPrice, currency)}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  ({currency} valyutasida, QQS hisobga olingan)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </TabsContent>
  );
}
