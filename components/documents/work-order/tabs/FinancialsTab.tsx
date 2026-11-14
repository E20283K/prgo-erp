"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridColumnIcon,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { MoneyInput } from "@/components/ui/money-input";
import { Separator } from "@/components/ui/separator";
import { cn } from "cn";
import {
  DollarSign,
  TrendingUp,
  Calculator,
  Check,
  AlertCircle,
  Layers,
  Boxes,
  Percent,
} from "lucide-react";
import { ShiftEvent, WorkOrderFormData, RouteStep } from "../types";
import { PrintPlanningResult } from "../planningEngine";
import { RouteEconomicsTable } from "./RouteEconomicsTable";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { formatMoney } from "../../common/DocumentShell";
import { BomItem } from "../../BomMaterialsGrid";
import {
  calculateWorkOrderFinancials,
  DEFAULT_OVERHEAD_PERCENT,
  getWorkOrderMaterialReturns,
  type CostGroup,
  type FinancialCostResult,
} from "../utils/financialsEngine";

const GROUP_COLORS: Partial<Record<CostGroup, { dark: string; light: string }>> = {
  material: { dark: "#60a5fa", light: "#2563eb" },
  packaging: { dark: "#22d3ee", light: "#0891b2" },
  tooling: { dark: "#c084fc", light: "#7c3aed" },
  sample: { dark: "#c084fc", light: "#7c3aed" },
  machine: { dark: "#fbbf24", light: "#d97706" },
  labor: { dark: "#34d399", light: "#059669" },
  defect: { dark: "#f87171", light: "#dc2626" },
  recharge: { dark: "#a1a1aa", light: "#64748b" },
  claim: { dark: "#a1a1aa", light: "#64748b" },
};

interface FinancialsTabProps {
  shiftEvents: ShiftEvent[];
  formData?: WorkOrderFormData;
  printPlan?: PrintPlanningResult;
  operations?: RouteStep[];
  materials?: BomItem[];
  docNo?: string;
  onPriceChange?: (newPrice: number, financials?: Record<string, unknown>) => void;
  onFinancialsChange?: (financials: NonNullable<WorkOrderFormData["financials"]>) => void;
}


const MARKUP_PRESETS = [15, 25, 35, 50, 75, 100];

export function FinancialsTab({
  shiftEvents,
  formData,
  printPlan,
  operations = [],
  materials = [],
  docNo = "WOOF-26-0001",
  onPriceChange,
  onFinancialsChange,
}: FinancialsTabProps) {
  const { theme, machines, employees, warehouseMovements } = useWorkspaceStore(
    useShallow((s) => ({
      theme: s.theme,
      machines: s.machines,
      employees: s.employees,
      warehouseMovements: s.warehouseMovements,
    }))
  );
  // Offcut returns (RET documents) reduce the order cost, so they must be loaded.
  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.warehouseMovements.length === 0) s.loadWarehouseMovements();
    // Operators' wages drive hourly labor cost.
    if (s.employees.length === 0 && s.loadEmployees) s.loadEmployees();
  }, []);
  const materialReturns = useMemo(
    () => getWorkOrderMaterialReturns(warehouseMovements, docNo),
    [warehouseMovements, docNo]
  );
  const addNotification = useWorkspaceStore((s) => s.addNotification);
  const isDark = theme === "dark";

  const targetQty = formData?.quantity || 0;
  const currentSellingPrice = formData?.priceTotal || 0;
  const currency = formData?.currency || "UZS";
  const exchangeRate = Number(formData?.exchangeRate) || 12850;
  const isUsd = currency.toUpperCase() === "USD";


  // ─── 3. COST BREAKDOWN VIA UNIFIED ENGINE ────────────────────────────────────
  const [overheadPercent, setOverheadPercent] = useState<number>(
    formData?.financials?.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT
  );

  const computeCosts = useCallback(
    (pct: number) =>
      calculateWorkOrderFinancials({
        quantity: targetQty,
        currency,
        exchangeRate,
        materials,
        toolingItems: formData?.toolingItems,
        operations,
        shiftEvents,
        machines,
        employees,
        overheadPercent: pct,
        packagingData: formData?.packagingData,
        materialReturns,
      }),
    [
      materialReturns,
      targetQty,
      currency,
      exchangeRate,
      materials,
      formData?.toolingItems,
      formData?.packagingData,
      operations,
      shiftEvents,
      machines,
      employees,
    ]
  );

  const costs = useMemo(() => computeCosts(overheadPercent), [computeCosts, overheadPercent]);
  const {
    rawCostRows,
    nonCogsRows,
    totalBaseCost,
    unitBaseCost,
    costBasisQty,
    wasteInfoCost,
    returnedMaterialValue,
    rechargeToClient,
    supplierClaim,
  } = costs;
  const gridRows = useMemo(() => [...rawCostRows, ...nonCogsRows], [rawCostRows, nonCogsRows]);
  const [view, setView] = useState<"costs" | "route">("costs");

  const toFinancials = useCallback(
    (c: FinancialCostResult, margin: number): NonNullable<WorkOrderFormData["financials"]> => ({
      plannedMaterialCost: c.plannedMaterialCost,
      actualMaterialCost: c.materialCost,
      // Route = machine + labor of every step; finished steps at fact, the rest at plan.
      plannedMachineCost: c.plannedRouteCost,
      actualMachineCost: Number(c.routeLines.reduce((s, l) => s + (l.actualCost ?? l.plannedCost), 0).toFixed(2)),
      toolingCost: c.toolingCost,
      laborCost: c.laborCost,
      baseCost: c.totalBaseCost,
      unitBaseCost: c.unitBaseCost,
      totalBaseCost: c.totalBaseCost,
      wasteCost: c.wasteInfoCost,
      margin,
      overheadPercent: c.overheadPercent,
      overheadCost: c.overheadCost,
      packagingCost: c.packagingCost,
      sampleCost: c.sampleCost,
      defectCost: c.defectCost,
      rechargeToClient: c.rechargeToClient,
      supplierClaim: c.supplierClaim,
      costBasisQty: c.costBasisQty,
    }),
    []
  );

  const handleOverheadChange = (valStr: string) => {
    const pct = Math.min(100, Math.max(0, parseFloat(valStr) || 0));
    setOverheadPercent(pct);
    onFinancialsChange?.(toFinancials(computeCosts(pct), formData?.financials?.margin ?? 25));
  };

  // ─── 4. PRICING & MARKUP CALCULATOR STATE ────────────────────────────────────
  const [markupPercent, setMarkupPercent] = useState<number>(() => {
    if (totalBaseCost <= 0) return 30;
    const currentMarkup = ((currentSellingPrice - totalBaseCost) / totalBaseCost) * 100;
    return Number(Math.max(5, currentMarkup).toFixed(1));
  });

  // Cost data can arrive after mount: derive the markup from the saved price once it does.
  const [markupSynced, setMarkupSynced] = useState(totalBaseCost > 0);
  if (!markupSynced && totalBaseCost > 0) {
    setMarkupSynced(true);
    if (currentSellingPrice > totalBaseCost) {
      setMarkupPercent(Number((((currentSellingPrice - totalBaseCost) / totalBaseCost) * 100).toFixed(1)));
    }
  }

  const [customPriceInput, setCustomPriceInput] = useState<string>(String(currentSellingPrice));

  const calculatedSellingPrice = useMemo(() => {
    if (totalBaseCost <= 0) return 0;
    return Number((totalBaseCost * (1 + markupPercent / 100)).toFixed(2));
  }, [totalBaseCost, markupPercent]);

  const activeSellingPrice = Number(customPriceInput) > 0 ? Number(customPriceInput) : (totalBaseCost > 0 ? calculatedSellingPrice : 0);
  const unitSellingPrice = targetQty > 0 && activeSellingPrice > 0 ? Number((activeSellingPrice / targetQty).toFixed(4)) : 0;
  const grossProfit = (activeSellingPrice > 0 && totalBaseCost > 0) ? Number((activeSellingPrice - totalBaseCost).toFixed(2)) : 0;
  const profitMarginPercent = (activeSellingPrice > 0 && totalBaseCost > 0) ? Number(((grossProfit / activeSellingPrice) * 100).toFixed(1)) : 0;

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
        ...toFinancials(costs, profitMarginPercent),
        itemsCount: rawCostRows.length,
        calculatedAt: new Date().toISOString(),
      });

      addNotification({
        title: "Tijoriy narx buyurtmaga tatbiq etildi",
        description: `${docNo}: Yangi sotuv narxi ${formatMoney(activeSellingPrice, currency)} qilib belgilandi (Marja: ${profitMarginPercent}%).`,
        severity: "success",
      });
    }
  };

  // ─── 5. GLIDE DATA GRID CONFIGURATION ───────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    category: 180,
    name: 320,
    quantity: 160,
    unitRate: 130,
    totalCost: 130,
    share: 90,
    type: 130,
  });

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const costColumns = useMemo<GridColumn[]>(() => [
    { id: "category", title: "Xarajat guruhi", width: columnWidths.category || 180, icon: GridColumnIcon.HeaderLookup, grow: 1 },
    { id: "name", title: "Xarajat elementi / Tavsif", width: columnWidths.name || 320, icon: GridColumnIcon.HeaderString, grow: 2 },
    { id: "quantity", title: "Norma / Sarf / Vaqt", width: columnWidths.quantity || 160, icon: GridColumnIcon.HeaderNumber, grow: 1 },
    { id: "unitRate", title: "Birlik stavkasi", width: columnWidths.unitRate || 130, icon: GridColumnIcon.HeaderNumber },
    { id: "totalCost", title: `Jami summa (${currency})`, width: columnWidths.totalCost || 130, icon: GridColumnIcon.HeaderNumber },
    { id: "share", title: "Ulush (%)", width: columnWidths.share || 90, icon: GridColumnIcon.HeaderNumber },
    { id: "type", title: "Manba / Hujjat", width: columnWidths.type || 130, icon: GridColumnIcon.HeaderString },
  ], [columnWidths, currency]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id) {
      setColumnWidths((prev) => ({
        ...prev,
        [column.id!]: newSize,
      }));
    }
  }, []);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = gridRows[row];
      const column = costColumns[col];

      if (!item || !column) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
        };
      }

      const isWaste = item.group === "defect";
      const isExcluded = item.group === "recharge" || item.group === "claim";
      const groupColor = GROUP_COLORS[item.group];

      if (column.id === "category") {
        return {
          kind: GridCellKind.Text,
          data: item.category,
          displayData: item.category,
          allowOverlay: false,
          readonly: true,
          themeOverride: groupColor
            ? { textDark: isDark ? groupColor.dark : groupColor.light, baseFontStyle: "600 12px sans-serif" }
            : undefined,
        };
      }

      if (column.id === "name") {
        return {
          kind: GridCellKind.Text,
          data: item.name,
          displayData: item.name,
          allowOverlay: false,
          readonly: true,
        };
      }

      if (column.id === "quantity") {
        return {
          kind: GridCellKind.Text,
          data: item.quantity,
          displayData: item.quantity,
          allowOverlay: false,
          readonly: true,
        };
      }

      if (column.id === "unitRate") {
        return {
          kind: GridCellKind.Text,
          data: item.unitRate,
          displayData: item.unitRate,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "11px monospace",
          },
        };
      }

      if (column.id === "totalCost") {
        return {
          kind: GridCellKind.Number,
          data: item.totalCost,
          displayData: formatMoney(item.totalCost, currency),
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "700 12px monospace",
            textDark: isWaste
              ? (isDark ? "#f87171" : "#dc2626")
              : isExcluded
              ? (isDark ? "#a1a1aa" : "#64748b")
              : (isDark ? "#f4f4f5" : "#0f172a"),
          },
        };
      }

      if (column.id === "share") {
        return {
          kind: GridCellKind.Number,
          data: item.share,
          displayData: isExcluded ? "—" : `${item.share}%`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 11px monospace",
            textDark: isDark ? "#a1a1aa" : "#64748b",
          },
        };
      }

      if (column.id === "type") {
        return {
          kind: GridCellKind.Text,
          data: item.type,
          displayData: item.type,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            baseFontStyle: "11px sans-serif",
            textDark: isDark ? "#a1a1aa" : "#64748b",
          },
        };
      }

      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: false,
        readonly: true,
      };
    },
    [gridRows, costColumns, currency, isDark]
  );

  return (
    <TabsContent
      value="financials"
      className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background select-none"
    >
      {/* 1. Top Section: 4 Compact KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-3 py-1.5 border-b border-border bg-card/40 shrink-0">
        {/* Card 1: Base Cost */}
        <div className="rounded border border-border bg-card px-2.5 py-1.5 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium tracking-wide uppercase">Tannarx</span>
            <Boxes className="size-3 text-muted-foreground" />
          </div>
          <div className="text-sm font-bold font-mono text-foreground tracking-tight">
            {totalBaseCost > 0 ? formatMoney(totalBaseCost, currency) : "—"}
          </div>
          <div className="text-[9.5px] text-muted-foreground font-mono truncate">
            1 dona: <strong className="text-foreground">{unitBaseCost > 0 ? formatMoney(unitBaseCost, currency, 3) : "—"}</strong>
            <span className="ml-1 opacity-75">
              (~{formatMoney(isUsd ? totalBaseCost * exchangeRate : (exchangeRate > 0 ? totalBaseCost / exchangeRate : 0), isUsd ? "UZS" : "USD", 0)})
            </span>
          </div>
        </div>

        {/* Card 2: Markup */}
        <div className="rounded border border-border bg-blue-500/5 px-2.5 py-1.5 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
            <span className="text-[10px] font-medium tracking-wide uppercase">Ustama</span>
            <Percent className="size-3 text-blue-500" />
          </div>
          <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 tracking-tight">
            {totalBaseCost > 0 ? `+${markupPercent.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[9.5px] text-muted-foreground font-mono truncate">
            Foyda: <strong className="text-blue-700 dark:text-blue-300">{grossProfit > 0 ? `+${formatMoney(grossProfit, currency)}` : "—"}</strong>
          </div>
        </div>

        {/* Card 3: Selling Price */}
        <div className="rounded border border-border bg-emerald-500/5 px-2.5 py-1.5 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-[10px] font-medium tracking-wide uppercase">Sotuv narxi</span>
            <DollarSign className="size-3 text-emerald-500" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            {activeSellingPrice > 0 ? formatMoney(activeSellingPrice, currency) : "—"}
          </div>
          <div className="text-[9.5px] text-muted-foreground font-mono truncate">
            1 dona: <strong className="text-emerald-700 dark:text-emerald-300">{unitSellingPrice > 0 ? formatMoney(unitSellingPrice, currency, 3) : "—"}</strong>
            <span className="ml-1 opacity-75">
              (~{formatMoney(isUsd ? activeSellingPrice * exchangeRate : (exchangeRate > 0 ? activeSellingPrice / exchangeRate : 0), isUsd ? "UZS" : "USD", 0)})
            </span>
          </div>
        </div>

        {/* Card 4: Profit Margin */}
        <div className="rounded border border-border bg-card px-2.5 py-1.5 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium tracking-wide uppercase">Sof marja</span>
            <TrendingUp className="size-3 text-emerald-500" />
          </div>
          <div className="text-sm font-bold font-mono text-foreground tracking-tight">
            {profitMarginPercent > 0 ? `${profitMarginPercent.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[9.5px] text-muted-foreground font-mono truncate">
            Kurs: <strong className="font-mono text-foreground">1 USD = {exchangeRate.toLocaleString()} UZS</strong>
          </div>
        </div>
      </div>

      {/* 2. Compact Pricing & Markup Action Bar */}
      <div className="px-3 py-1.5 border-b border-border bg-muted/20 shrink-0 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Quick Markup Pills */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mr-1">
            <Calculator className="size-3.5 text-primary" />
            <span>Ustama:</span>
          </div>
          <div className="flex items-center gap-1">
            {MARKUP_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleSelectMarkupPreset(pct)}
                className={cn(
                  "h-6 px-2 text-[11px] font-medium rounded border transition-all cursor-pointer flex items-center justify-center",
                  markupPercent === pct
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                )}
              >
                +{pct}%
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Umumzavod:</span>
          <div className="relative w-16">
            <MoneyInput
              decimalScale={1}
              value={overheadPercent}
              onValueChange={(values) => handleOverheadChange(values.value)}
              className="h-6.5 text-xs font-mono font-bold pl-1.5 pr-5 bg-background"
            />
            <Percent className="size-3 text-muted-foreground absolute right-1.5 top-2 pointer-events-none" />
          </div>
        </div>

        {/* Right: Manual Price Input & Apply Button */}
        <div className="flex items-center gap-2">
          {rechargeToClient > 0 && (
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 py-0 font-mono">
              Mijozga hisob: +{formatMoney(rechargeToClient, currency)}
            </Badge>
          )}
          {supplierClaim > 0 && (
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 py-0 font-mono">
              Da&apos;vo: {formatMoney(supplierClaim, currency)}
            </Badge>
          )}
          {activeSellingPrice !== currentSellingPrice && (
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono">
              Farq: {formatMoney(activeSellingPrice - currentSellingPrice, currency)}
            </Badge>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
              Sotuv narxi:
            </span>
            <div className="relative w-32">
              <MoneyInput
                thousandSeparator=" "
                decimalScale={currency === "UZS" ? 0 : 2}
                value={customPriceInput}
                onValueChange={(values) => handleCustomPriceChange(values.value)}
                className="h-6.5 text-xs font-mono font-bold pl-5.5 pr-1.5 bg-background"
              />
              <DollarSign className="size-3 text-muted-foreground absolute left-1.5 top-2 pointer-events-none" />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleApplyPriceToOrder}
            className="h-6.5 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-2xs cursor-pointer"
          >
            <Check className="size-3" />
            <span>Narxni Saqlash</span>
          </Button>
        </div>
      </div>

      {/* 3. Grid Header Toolbar (OperationsTab style) */}
      <div className="h-8 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-primary" />
          <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            {([
              ["costs", "Xarajatlar tarkibi"],
              ["route", "Marshrut: reja va fakt"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "h-5.5 px-2 rounded text-[11px] font-medium cursor-pointer",
                  view === id ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Badge variant="outline" className="text-[10px] font-mono h-4.5 px-1.5 py-0">
            {docNo}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Tiraj: <strong className="text-foreground font-mono">{targetQty.toLocaleString()} {formData?.unit || "dona"}</strong></span>
          {costBasisQty !== targetQty && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span>Qadoqlangan: <strong className="text-foreground font-mono">{costBasisQty.toLocaleString()}</strong></span>
            </>
          )}
          <Separator orientation="vertical" className="h-3" />
          <span>Moddalar: <strong className="text-foreground">{gridRows.length} ta</strong></span>
        </div>
      </div>

      {view === "route" && <RouteEconomicsTable lines={costs.routeLines} currency={currency} />}

      {/* 4. Full-Bleed Glide Data Grid (OperationsTab structure) */}
      {view === "costs" && (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            className="flex-1 w-full h-full relative" 
            id="glide-financials-grid-root"
          >
            <DataEditor
              getCellContent={getCellContent}
              columns={costColumns}
              rows={gridRows.length}
              gridSelection={selection}
              onGridSelectionChange={setSelection}
              onColumnResize={handleColumnResize}
              rowMarkers="both"
              freezeColumns={1}
              smoothScrollX={true}
              smoothScrollY={true}
              width="100%"
              height="100%"
              headerHeight={28}
              rowHeight={32}
              theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
            />
            {gridRows.length === 0 && (
              <div className="absolute inset-0 top-7 flex flex-col items-center justify-center bg-background/60 z-10 select-none gap-2">
                <Layers className="size-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Xarajatlar kiritilmagan (BOM yoki marshrut operatsiyalarini kiriting)</span>
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={handleApplyPriceToOrder} className="gap-2 cursor-pointer">
            <Check className="size-3.5 text-emerald-500" />
            <span>Narxni Buyurtmaga Saqlash</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleSelectMarkupPreset(15)} className="gap-2 cursor-pointer">
            <Percent className="size-3.5 text-blue-500" />
            <span>+15% Minimal Ustama</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleSelectMarkupPreset(25)} className="gap-2 cursor-pointer">
            <Percent className="size-3.5 text-blue-500" />
            <span>+25% Standart Ustama</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleSelectMarkupPreset(35)} className="gap-2 cursor-pointer">
            <Percent className="size-3.5 text-blue-500" />
            <span>+35% O&apos;rtacha Ustama</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleSelectMarkupPreset(50)} className="gap-2 cursor-pointer">
            <Percent className="size-3.5 text-blue-500" />
            <span>+50% Yuqori Ustama</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      )}

      {/* 5. Footer Summary Bar */}
      <div className="h-8 border-t border-border bg-card px-3 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="text-[11px] text-muted-foreground flex items-center gap-3">
          <span>
            1 dona bazaviy tannarxi: <strong className="font-mono text-foreground">{formatMoney(unitBaseCost, currency, 3)}</strong>
          </span>
          {wasteInfoCost > 0 && (
            <Badge variant="outline" className="text-[9.5px] h-4.5 px-1.5 py-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 font-mono">
              <AlertCircle className="size-2.5" />
              Shundan brak: {formatMoney(wasteInfoCost, currency)}
            </Badge>
          )}
          {returnedMaterialValue > 0 && (
            <Badge variant="outline" className="text-[9.5px] h-4.5 px-1.5 py-0 font-mono">
              Omborga qaytim: −{formatMoney(returnedMaterialValue, currency)}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-sans font-medium text-[11px]">JAMI BAZA TANNARX (TOTAL COGS):</span>
          <span className="font-bold text-xs text-foreground">
            {formatMoney(totalBaseCost, currency)}
          </span>
        </div>
      </div>
    </TabsContent>
  );
}
