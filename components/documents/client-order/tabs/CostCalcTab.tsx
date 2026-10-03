"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  EditableGridCell,
  GridColumnIcon,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  recipe: string;
  quantity: number;
  currency: string;
  setCurrency: (c: string) => void;
  isDark: boolean;
}

const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; price: number }[]> = {
  "OFFSET_STD_V1": [
    { name: "Galerie Art Silk Paper 150g", req: 12500, unit: "Sheets", price: 0.12 },
    { name: "Hubergroup CMYK Ink", req: 36, unit: "kg", price: 15.50 },
    { name: "Agfa CTP Plates", req: 24, unit: "pcs", price: 8.00 },
  ],
  "FLEXO_NYLON_V1": [
    { name: "Nylon Taffeta Tape 30mm", req: 45, unit: "Rolls", price: 12.00 },
    { name: "Wash-Resistant Ink Black", req: 2, unit: "kg", price: 45.00 },
  ],
  "JACQ_WOVEN_V1": [
    { name: "Polyester Warp Yarn Black", req: 120, unit: "kg", price: 4.50 },
    { name: "Polyester Weft Yarn White", req: 85, unit: "kg", price: 4.80 },
  ],
};

export function CostCalcTab({ recipe, quantity, currency, setCurrency, isDark }: Props) {
  const t = useTranslations("ClientOrder");
  const [calcMode, setCalcMode] = useState<"Auto" | "Manual">("Auto");
  
  const [materials, setMaterials] = useState(
    RECIPE_MATERIALS[recipe]?.map((m, i) => ({ id: `m-${i}`, ...m })) || []
  );
  
  const [services, setServices] = useState([
    { id: "s-1", name: "Machine Setup Fee", qty: 1, unit: "lump", price: 150 },
    { id: "s-2", name: "Press Run", qty: 8, unit: "hrs", price: 85 },
    { id: "s-3", name: "Pre-press / Plates", qty: 1, unit: "lump", price: 120 },
  ]);

  const [overheadPct, setOverheadPct] = useState(15);
  const [marginPct, setMarginPct] = useState(25);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  React.useEffect(() => {
    // When recipe changes, reset materials
    setMaterials(RECIPE_MATERIALS[recipe]?.map((m, i) => ({ id: `m-${i}`, ...m })) || []);
  }, [recipe]);

  const calcColumns = useMemo<GridColumn[]>(() => [
    { id: "name", title: t("materialName") || "Item Name", width: 260, icon: GridColumnIcon.HeaderString },
    { id: "qty", title: t("qty") || "Qty", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "unit", title: t("unit") || "Unit", width: 85, icon: GridColumnIcon.HeaderLookup },
    { id: "price", title: t("unitPrice") || "Unit Price", width: 110, icon: GridColumnIcon.HeaderMath },
    { id: "total", title: t("total") || "Total", width: 120, icon: GridColumnIcon.HeaderMath },
  ], [t]);

  const getCalcCell = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const isMaterial = row < materials.length;
    const item: any = isMaterial ? materials[row] : services[row - materials.length];
    if (!item) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    const isService = !isMaterial;
    const colId = calcColumns[col].id;

    if (colId === "name") {
      return {
        kind: GridCellKind.Text,
        data: item.name,
        displayData: item.name,
        allowOverlay: false,
        themeOverride: isService ? { 
          textDark: "#60a5fa", 
          textLight: "#2563eb",
          baseFontStyle: "600 12px sans-serif" 
        } : undefined
      };
    } else if (colId === "qty") {
      const qty = item.qty ?? item.req;
      return {
        kind: GridCellKind.Number,
        data: qty,
        displayData: String(qty),
        allowOverlay: true,
        readonly: false,
        contentAlign: "right",
      };
    } else if (colId === "unit") {
      return { 
        kind: GridCellKind.Text, 
        data: item.unit, 
        displayData: item.unit, 
        allowOverlay: false 
      };
    } else if (colId === "price") {
      return {
        kind: GridCellKind.Number,
        data: item.price,
        displayData: Number(item.price).toFixed(2),
        allowOverlay: true,
        readonly: false,
        contentAlign: "right",
      };
    } else if (colId === "total") {
      const qty = item.qty ?? item.req;
      const total = qty * item.price;
      return {
        kind: GridCellKind.Number,
        data: total,
        displayData: total.toFixed(2),
        allowOverlay: false,
        contentAlign: "right",
      };
    }
    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [materials, services, calcColumns]);

  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const isMaterial = row < materials.length;
    const colId = calcColumns[col].id;

    if (newValue.kind !== GridCellKind.Number) return;

    if (isMaterial) {
      const newM = [...materials];
      if (colId === "qty") newM[row].req = newValue.data as number;
      if (colId === "price") newM[row].price = newValue.data as number;
      setMaterials(newM);
    } else {
      const sIdx = row - materials.length;
      const newS = [...services];
      if (colId === "qty") newS[sIdx].qty = newValue.data as number;
      if (colId === "price") newS[sIdx].price = newValue.data as number;
      setServices(newS);
    }
  }, [materials, services, calcColumns]);

  // --- Calculations ---
  const materialsTotal = materials.reduce((acc, m) => acc + (m.req * m.price), 0);
  const servicesTotal = services.reduce((acc, s) => acc + (s.qty * s.price), 0);
  const subtotal = materialsTotal + servicesTotal;
  const overheadAmount = subtotal * (overheadPct / 100);
  const costBase = subtotal + overheadAmount;
  const marginAmount = costBase * (marginPct / 100);
  const grandTotal = (costBase + marginAmount) * exchangeRate;
  const unitPrice = quantity > 0 ? grandTotal / quantity : 0;

  return (
    <>
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between p-1.5 px-3 bg-card border border-border rounded-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-xs text-muted-foreground">{t("calcModeLabel") || "Mode"}:</span>
            <Select value={calcMode} onValueChange={(val: any) => setCalcMode(val)}>
              <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">{t("calcModeAuto") || "Auto"}</SelectItem>
                <SelectItem value="Manual">{t("calcModeManual") || "Manual"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-xs text-muted-foreground">{t("currency") || "Currency"}:</span>
            <Select value={currency} onValueChange={(val) => val && setCurrency(val)}>
              <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="UZS">UZS (so'm)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 bg-card border border-border rounded-md overflow-hidden relative min-h-[350px]">
          <DataEditor
            getCellContent={getCalcCell}
            columns={calcColumns}
            rows={materials.length + services.length}
            onCellEdited={onCellEdited}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            rowMarkers="both"
            freezeColumns={1}
            smoothScrollX={true}
            smoothScrollY={true}
            width="100%"
            height="100%"
            headerHeight={28}
            rowHeight={30}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          />
        </div>
      </div>

      <div className="w-[280px] shrink-0 bg-card border border-border rounded-md p-4 flex flex-col">
        <h3 className="font-semibold text-foreground pb-2 border-b border-border mb-3">Order Summary</h3>
        
        <div className="space-y-2 text-xs flex-1">
          <div className="flex justify-between text-zinc-600">
            <span>{t("subtotalMaterials") || "Materials"}</span>
            <span className="font-mono">{materialsTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>{t("subtotalServices") || "Services"}</span>
            <span className="font-mono">{servicesTotal.toFixed(2)}</span>
          </div>
          
          <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-600">Overhead</span>
              <Select value={String(overheadPct)} onValueChange={v => setOverheadPct(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-[60px] px-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between text-zinc-500 text-[11px] mb-2">
              <span>Amount</span>
              <span className="font-mono">+{overheadAmount.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-600">Margin</span>
              <Select value={String(marginPct)} onValueChange={v => setMarginPct(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-[60px] px-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="35">35%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between text-zinc-500 text-[11px]">
              <span>Amount</span>
              <span className="font-mono">+{marginAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 mt-3">
          <div className="flex justify-between items-end mb-1">
            <span className="text-sm font-semibold">{t("grandTotal") || "Total"}</span>
            <span className="text-lg font-bold font-mono text-blue-600">{grandTotal.toFixed(2)} {currency}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>Unit Price (÷{quantity})</span>
            <span className="font-mono font-medium">{unitPrice.toFixed(4)} {currency}</span>
          </div>
        </div>
      </div>
    </>
  );
}
