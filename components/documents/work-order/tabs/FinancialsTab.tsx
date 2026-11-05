"use client";

import React, { useState, useMemo, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { formatMoney } from "../../common/DocumentShell";
import { BomItem } from "../../BomMaterialsGrid";

interface FinancialsTabProps {
  shiftEvents: ShiftEvent[];
  formData?: WorkOrderFormData;
  printPlan?: PrintPlanningResult;
  operations?: RouteStep[];
  materials?: BomItem[];
  docNo?: string;
  onPriceChange?: (newPrice: number, financials?: any) => void;
}

interface CostBreakdownRow {
  id: string;
  category: string;
  name: string;
  quantity: string;
  unitRate: string;
  totalCost: number;
  share: number;
  type: string;
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
}: FinancialsTabProps) {
  const { warehouseStock, theme, machines } = useWorkspaceStore(
    useShallow((s) => ({
      warehouseStock: s.warehouseStock,
      theme: s.theme,
      machines: s.machines,
    }))
  );
  const addNotification = useWorkspaceStore((s) => s.addNotification);
  const isDark = theme === "dark";

  const targetQty = formData?.quantity || 0;
  const currentSellingPrice = formData?.priceTotal || 0;
  const currency = formData?.currency || "UZS";
  const exchangeRate = Number(formData?.exchangeRate) || 12850;
  const isUsd = currency.toUpperCase() === "USD";
  const hasQty = targetQty > 0;

  // ─── 1. REAL MACHINE FLEET LOOKUP & RATES ──────────────────────────────────
  const getMachineHourlyRate = useCallback((machineName?: string): { machineRate: number; operatorRate: number } => {
    if (!machineName) return { machineRate: 35.0, operatorRate: 12.0 };
    const cleanName = machineName.toLowerCase();
    const matched = (machines || []).find((m) => {
      const mName = m.name?.toLowerCase() || "";
      const mCode = (m as any).code?.toLowerCase() || "";
      return mName.includes(cleanName) || cleanName.includes(mName) || (mCode && mCode.includes(cleanName));
    });

    const machineRate = matched?.costing?.standardHourlyRateUsd ||
      ((matched as any)?.hourlyRate ? Number((matched as any).hourlyRate) : 35.0);
    const operatorRate = matched?.costing?.operatorHourlyWageUsd || 12.0;

    return {
      machineRate: Number(machineRate) || 35.0,
      operatorRate: Number(operatorRate) || 12.0,
    };
  }, [machines]);

  const toolingItems = formData?.toolingItems || [];
  const wasteEvents = (shiftEvents || []).filter((ev) => ev.type === "Waste" && ev.wasteQty);
  const totalWasteQty = wasteEvents.reduce((sum, ev) => sum + (ev.wasteQty || 0), 0);

  // ─── 3. BUILD GRANULAR 100% REAL COST BREAKDOWN ROWS ────────────────────────
  const { rawCostRows, totalBaseCost, unitBaseCost, wasteLossCost } = useMemo(() => {
    const rows: CostBreakdownRow[] = [];

    // ──────────────────────────────────────────────────────────────────────────
    // A. XOMASHYO VA MATERIALLAR (BOM TABIDAGI REAL HAR BIR MODDA)
    // ──────────────────────────────────────────────────────────────────────────
    if (materials && materials.length > 0) {
      materials.forEach((mat, idx) => {
        const qty = Number(mat.actualQty !== undefined ? mat.actualQty : (mat.qty !== undefined ? mat.qty : mat.planQty || 0));
        const matCur = ((mat as any).originalCurrency || ((mat as any).currency === "UZS" ? "UZS" : "USD")).toUpperCase();
        const origPrice = Number((mat as any).originalUnitPrice !== undefined ? (mat as any).originalUnitPrice : mat.unitPrice || 0);

        let unitP = Number(mat.unitPrice || 0);
        if ((mat as any).originalUnitPrice !== undefined || (mat as any).originalCurrency) {
          if (matCur === "USD" && currency === "UZS") {
            unitP = Number((origPrice * exchangeRate).toFixed(2));
          } else if (matCur === "UZS" && currency === "USD") {
            unitP = Number((origPrice / exchangeRate).toFixed(4));
          } else {
            unitP = origPrice;
          }
        }
        const lineTotal = Number(((mat as any).totalPrice !== undefined && (mat as any).totalPrice > 0 ? (mat as any).totalPrice : (qty * unitP)).toFixed(2));

        let catLabel = "Xomashyo";
        const catClean = (mat.category || "").toLowerCase();
        if (catClean.includes("paper") || catClean.includes("board") || catClean.includes("roll")) {
          catLabel = "Xomashyo (Qog'oz)";
        } else if (catClean.includes("ink") || catClean.includes("plate") || catClean.includes("chemical")) {
          catLabel = "Kraska & Kimyo";
        } else if (catClean.includes("pack") || catClean.includes("box")) {
          catLabel = "Qadoqlash";
        } else {
          catLabel = "Yordamchi xomashyo";
        }

        const origDisplay = (mat as any).originalUnitPrice !== undefined && matCur !== currency
          ? ` [${matCur === "UZS" ? `${(mat as any).originalUnitPrice.toLocaleString()} UZS` : `$${(mat as any).originalUnitPrice}`}]`
          : "";

        rows.push({
          id: `bom-${mat.id || idx}`,
          category: catLabel,
          name: `${mat.name}${mat.spec ? ` (${mat.spec})` : ""}${origDisplay}`,
          quantity: `${qty.toLocaleString()} ${mat.unit || "birlik"}`,
          unitRate: unitP > 0 ? `${formatMoney(unitP, currency, currency === "UZS" ? 0 : 3)}/${mat.unit || "birlik"}` : "—",
          totalCost: lineTotal,
          share: 0,
          type: "BOM (Fakt)",
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // B. TEXNOLOGIK JIHOZLAR (PRE-PRESS TABIDAGI REAL SHTANS-QOLIPLAR VA CTP)
    // ──────────────────────────────────────────────────────────────────────────
    if (toolingItems && toolingItems.length > 0) {
      toolingItems.forEach((tool, idx) => {
        const rawCost = Number(tool.actualCost !== undefined ? tool.actualCost : tool.estimatedCost || 0);
        const toolCur = (tool.currency || (isUsd ? "USD" : "UZS")).toUpperCase();
        let cost = rawCost;
        if (toolCur === "USD" && currency === "UZS") {
          cost = Number((rawCost * exchangeRate).toFixed(2));
        } else if (toolCur === "UZS" && currency === "USD") {
          cost = Number((rawCost / exchangeRate).toFixed(2));
        }
        const qty = Number(tool.quantity || 1);
        const unitP = qty > 0 ? Number((cost / qty).toFixed(2)) : cost;

        rows.push({
          id: `tool-${tool.id || idx}`,
          category: "Jihozlar & Qoliplar",
          name: `${tool.name}${tool.category ? ` [${tool.category}]` : ""}`,
          quantity: `${qty} ${tool.unit || "dona"}`,
          unitRate: unitP > 0 ? `${formatMoney(unitP, currency, currency === "UZS" ? 0 : 2)}/${tool.unit || "dona"}` : "—",
          totalCost: cost,
          share: 0,
          type: tool.actualCost !== undefined ? "Jihoz (Fakt)" : "Jihoz (Reja)",
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // C. USKUNALAR VA MEHNAT HAQI (OPERATIONSTAB REAL BOSQICHLAR BO'YICHA)
    // ──────────────────────────────────────────────────────────────────────────
    if (operations && operations.length > 0) {
      operations.forEach((op, idx) => {
        const duration = Number(op.duration) || 0;
        const rates = getMachineHourlyRate(op.machine);

        // Stanok / Operatsiya qiymati (Tarif bo'yicha yoki soatlik me'yor)
        if (op.machine && op.machine !== "Manual" && op.machine !== "—") {
          const hasTariffCost = op.plannedCostUsd !== undefined && op.plannedCostUsd > 0;
          const rawMachCost = hasTariffCost
            ? Number(op.plannedCostUsd!.toFixed(2))
            : Number((duration * rates.machineRate).toFixed(2));
          const machineCost = isUsd ? rawMachCost : Number((rawMachCost * exchangeRate).toFixed(2));

          const rawMachRate = hasTariffCost && op.rateUsd !== undefined ? op.rateUsd : rates.machineRate;
          const machRateConv = isUsd ? rawMachRate : rawMachRate * exchangeRate;
          const unitRateDisplay = duration > 0 || hasTariffCost
            ? `${formatMoney(machRateConv, currency, currency === "UZS" ? 0 : 2)}/${hasTariffCost ? (op.calcUnit || "birlik") : "soat"}`
            : "—";

          rows.push({
            id: `op-mach-${op.id || idx}`,
            category: "Uskuna & Mashina",
            name: `${op.name} (${op.machine})`,
            quantity: hasTariffCost ? (formData?.quantity ? `${formData.quantity.toLocaleString()} dona` : `${duration} soat`) : `${duration} soat`,
            unitRate: unitRateDisplay,
            totalCost: machineCost,
            share: 0,
            type: op.tariffCode ? `Tarif (${op.tariffCode})` : `Stanok (#${op.stepNumber})`,
          });
        }

        // Ishchilar mehnati / FOT (Sdelka yoki soatbay stavka)
        const hasPiecework = op.pieceworkTotalUsd !== undefined && op.pieceworkTotalUsd > 0;
        const rawLabCost = hasPiecework
          ? Number(op.pieceworkTotalUsd!.toFixed(2))
          : Number((duration * rates.operatorRate).toFixed(2));
        const laborCost = isUsd ? rawLabCost : Number((rawLabCost * exchangeRate).toFixed(2));

        const rawLabRate = hasPiecework && op.pieceworkRateUsd !== undefined ? op.pieceworkRateUsd : rates.operatorRate;
        const labRateConv = isUsd ? rawLabRate : rawLabRate * exchangeRate;
        const laborRateDisplay = duration > 0 || hasPiecework
          ? `${formatMoney(labRateConv, currency, currency === "UZS" ? 0 : 2)}/${hasPiecework ? (op.calcUnit || "birlik") : "soat"}`
          : "—";

        rows.push({
          id: `op-lab-${op.id || idx}`,
          category: "Mehnat haqi (FOT)",
          name: `${op.name} — ${op.operator || "Navbatchi usta"}`,
          quantity: hasPiecework ? (formData?.quantity ? `${formData.quantity.toLocaleString()} dona` : `${duration} soat`) : `${duration} soat`,
          unitRate: laborRateDisplay,
          totalCost: laborCost,
          share: 0,
          type: op.tariffCode ? `Sdelka (${op.tariffCode})` : `Ishchi (#${op.stepNumber})`,
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // D. SIFAT NUQSONLARI VA BRAK ZIYONLARI (SMENA JURNALI REAL VOQELIKLARI)
    // ──────────────────────────────────────────────────────────────────────────
    const preWasteSubtotal = rows.reduce((s, r) => s + r.totalCost, 0);
    const approxUnitCost = (hasQty && preWasteSubtotal > 0) ? preWasteSubtotal / targetQty : 0;
    let computedWasteCost = 0;

    if (wasteEvents && wasteEvents.length > 0 && approxUnitCost > 0) {
      wasteEvents.forEach((we, idx) => {
        const wasteQty = Number(we.wasteQty || 0);
        const lineWasteCost = Number((wasteQty * approxUnitCost).toFixed(2));
        computedWasteCost += lineWasteCost;

        rows.push({
          id: `waste-${we.id || idx}`,
          category: "Nuqson & Brak (COPQ)",
          name: `${we.note || "Brak listlar"} [${we.wasteReason || "Texnologik chiqindi"}]`,
          quantity: `${wasteQty} dona list`,
          unitRate: `${formatMoney(approxUnitCost, currency, currency === "UZS" ? 0 : 3)}/list`,
          totalCost: lineWasteCost,
          share: 0,
          type: `Smena (${we.shift || we.time})`,
        });
      });
    }

    const grandTotal = Number((preWasteSubtotal + computedWasteCost).toFixed(2));
    const unitCost = hasQty && grandTotal > 0 ? Number((grandTotal / targetQty).toFixed(4)) : 0;

    // Ulush foizlarini hisoblash
    rows.forEach((r) => {
      r.share = grandTotal > 0 ? Number(((r.totalCost / grandTotal) * 100).toFixed(1)) : 0;
    });

    return {
      rawCostRows: rows,
      totalBaseCost: grandTotal,
      unitBaseCost: unitCost,
      wasteLossCost: computedWasteCost,
    };
  }, [
    materials,
    currency,
    exchangeRate,
    isUsd,
    toolingItems,
    operations,
    getMachineHourlyRate,
    formData?.quantity,
    hasQty,
    targetQty,
    wasteEvents,
  ]);

  // ─── 4. PRICING & MARKUP CALCULATOR STATE ────────────────────────────────────
  const [markupPercent, setMarkupPercent] = useState<number>(() => {
    if (totalBaseCost <= 0) return 30;
    const currentMarkup = ((currentSellingPrice - totalBaseCost) / totalBaseCost) * 100;
    return Number(Math.max(5, currentMarkup).toFixed(1));
  });

  const [customPriceInput, setCustomPriceInput] = useState<string>(String(currentSellingPrice));

  const calculatedSellingPrice = useMemo(() => {
    if (totalBaseCost <= 0) return 0;
    return Number((totalBaseCost * (1 + markupPercent / 100)).toFixed(2));
  }, [totalBaseCost, markupPercent]);

  const activeSellingPrice = Number(customPriceInput) > 0 ? Number(customPriceInput) : (totalBaseCost > 0 ? calculatedSellingPrice : 0);
  const unitSellingPrice = targetQty > 0 && activeSellingPrice > 0 ? Number((activeSellingPrice / targetQty).toFixed(4)) : 0;
  const grossProfit = (activeSellingPrice > 0 && totalBaseCost > 0) ? Number((activeSellingPrice - totalBaseCost).toFixed(2)) : 0;
  const profitMarginPercent = (activeSellingPrice > 0 && totalBaseCost > 0) ? Number(((grossProfit / activeSellingPrice) * 100).toFixed(1)) : 0;
  const unitGrossProfit = (activeSellingPrice > 0 && totalBaseCost > 0 && unitSellingPrice > 0) ? Number((unitSellingPrice - unitBaseCost).toFixed(4)) : 0;

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
      const materialCost = rawCostRows
        .filter((r) => r.category.includes("Xomashyo") || r.category.includes("Kraska") || r.category.includes("Qadoq"))
        .reduce((s, r) => s + r.totalCost, 0);
      const toolingCost = rawCostRows
        .filter((r) => r.category.includes("Jihoz"))
        .reduce((s, r) => s + r.totalCost, 0);
      const machineCost = rawCostRows
        .filter((r) => r.category.includes("Uskuna"))
        .reduce((s, r) => s + r.totalCost, 0);
      const laborCost = rawCostRows
        .filter((r) => r.category.includes("Mehnat"))
        .reduce((s, r) => s + r.totalCost, 0);
      const wasteCost = rawCostRows
        .filter((r) => r.category.includes("Nuqson") || r.category.includes("Brak"))
        .reduce((s, r) => s + r.totalCost, 0);

      onPriceChange(activeSellingPrice, {
        plannedMaterialCost: materialCost,
        actualMaterialCost: materialCost + wasteCost,
        plannedMachineCost: machineCost,
        actualMachineCost: machineCost,
        toolingCost: toolingCost,
        laborCost: laborCost,
        baseCost: totalBaseCost,
        wasteCost: wasteCost,
        margin: profitMarginPercent,
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
      const item = rawCostRows[row];
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

      const isWaste = item.category.includes("Nuqson") || item.category.includes("Brak");
      const isLabor = item.category.includes("Mehnat");
      const isMachine = item.category.includes("Uskuna");
      const isTooling = item.category.includes("Jihoz");
      const isMaterial = item.category.includes("Xomashyo") || item.category.includes("Kraska");

      if (column.id === "category") {
        return {
          kind: GridCellKind.Text,
          data: item.category,
          displayData: item.category,
          allowOverlay: false,
          readonly: true,
          themeOverride: isWaste
            ? { textDark: isDark ? "#f87171" : "#dc2626", baseFontStyle: "600 12px sans-serif" }
            : isLabor
            ? { textDark: isDark ? "#34d399" : "#059669", baseFontStyle: "600 12px sans-serif" }
            : isMachine
            ? { textDark: isDark ? "#fbbf24" : "#d97706", baseFontStyle: "600 12px sans-serif" }
            : isTooling
            ? { textDark: isDark ? "#c084fc" : "#7c3aed", baseFontStyle: "600 12px sans-serif" }
            : isMaterial
            ? { textDark: isDark ? "#60a5fa" : "#2563eb", baseFontStyle: "600 12px sans-serif" }
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
              : (isDark ? "#f4f4f5" : "#0f172a"),
          },
        };
      }

      if (column.id === "share") {
        return {
          kind: GridCellKind.Number,
          data: item.share,
          displayData: `${item.share}%`,
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
    [rawCostRows, costColumns, currency, isDark]
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
        </div>

        {/* Right: Manual Price Input & Apply Button */}
        <div className="flex items-center gap-2">
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
          <span className="font-semibold text-xs text-foreground">
            Ishlab Chiqarish Haqiqiy Xarajatlar Tarkibi (Real Cost Breakdown)
          </span>
          <Badge variant="outline" className="text-[10px] font-mono h-4.5 px-1.5 py-0">
            {docNo}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Tiraj: <strong className="text-foreground font-mono">{targetQty.toLocaleString()} {formData?.unit || "dona"}</strong></span>
          <Separator orientation="vertical" className="h-3" />
          <span>Moddalar: <strong className="text-foreground">{rawCostRows.length} ta</strong></span>
        </div>
      </div>

      {/* 4. Full-Bleed Glide Data Grid (OperationsTab structure) */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            className="flex-1 w-full h-full relative" 
            id="glide-financials-grid-root"
          >
            <DataEditor
              getCellContent={getCellContent}
              columns={costColumns}
              rows={rawCostRows.length}
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
            {rawCostRows.length === 0 && (
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

      {/* 5. Footer Summary Bar */}
      <div className="h-8 border-t border-border bg-card px-3 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="text-[11px] text-muted-foreground flex items-center gap-3">
          <span>
            1 dona bazaviy tannarxi: <strong className="font-mono text-foreground">{formatMoney(unitBaseCost, currency, 3)}</strong>
          </span>
          {wasteLossCost > 0 && (
            <Badge variant="outline" className="text-[9.5px] h-4.5 px-1.5 py-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 font-mono">
              <AlertCircle className="size-2.5" />
              Brak ziyonlari: +{formatMoney(wasteLossCost, currency)}
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
