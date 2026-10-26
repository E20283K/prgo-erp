"use client";

import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { DocumentHeader } from "@/components/documents/common/DocumentShell";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import {
  Ship,
  Save,
  Check,
  Boxes,
  Truck,
  Calculator,
  Download,
  Plus,
  Trash2,
} from "lucide-react";
import { TradingImportBatchRecord, ImportBatchItem, TRADING_UNITS } from "./types";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function TradingImportDetail({ tab }: { tab: DocumentTab }) {
  const {
    setTabUnsaved,
    closeTab,
    addNotification,
    theme,
    openTab,
    upsertTradingImportAsync,
    allocateTradingImportToStockAsync,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<TradingImportBatchRecord> = tab.documentData || {};

  // Form State
  const [batchNo] = useState<string>(rawData.batchNo || tab.id);
  const [date, setDate] = useState<string>(
    rawData.date || new Date().toISOString().split("T")[0]
  );
  const [origin, setOrigin] = useState<string>(
    rawData.origin || "Guangzhou, Xitoy"
  );
  const [supplier, setSupplier] = useState<string>(
    rawData.supplier || ""
  );
  const [containerNo, setContainerNo] = useState<string>(
    rawData.containerNo || ""
  );
  const [status, setStatus] = useState<
    "In Transit" | "Customs Clearance" | "Arrived & Calculated" | "Allocated to Stock"
  >(rawData.status || "In Transit");
  const [exchangeRate, setExchangeRate] = useState<number>(
    rawData.exchangeRate || 12850
  );

  // Financial components for Landed Cost
  const [fobAmountUSD, setFobAmountUSD] = useState<number>(rawData.fobAmountUSD || 0);
  const [internationalCargoUSD, setInternationalCargoUSD] = useState<number>(
    rawData.internationalCargoUSD || 0
  );
  const [customsDutyUZS, setCustomsDutyUZS] = useState<number>(
    rawData.customsDutyUZS || 0
  );
  const [grossWeightKg, setGrossWeightKg] = useState<number>(
    rawData.grossWeightKg || 0
  );
  const [notes, setNotes] = useState<string>(rawData.notes || "");

  // High volume items
  const [items, setItems] = useState<ImportBatchItem[]>(
    rawData.items && rawData.items.length > 0 ? rawData.items : []
  );

  const handleQuickAddItem = () => {
    const newItem: ImportBatchItem = {
      id: `imp-item-${Date.now()}`,
      sku: "IMP-ACC-01",
      name: "Yangi import furniturasi",
      category: "Furnitura",
      unit: "dona",
      quantity: 10000,
      fobPriceUSD: 0.1,
      fobTotalUSD: 1000,
      landedCostUZS: 1500,
      suggestedSalePriceUZS: 1800,
    };
    setItems((prev) => [...prev, newItem]);
    setTabUnsaved(tab.id, true);
  };

  // Calculations
  const { totalFobUZS, totalCargoUZS, grandLandedCostUZS, landedMarkupPercent } = useMemo(() => {
    const fobUZS = fobAmountUSD * exchangeRate;
    const cargoUZS = internationalCargoUSD * exchangeRate;
    const grandUZS = fobUZS + cargoUZS + customsDutyUZS;
    const markup = fobUZS > 0 ? ((grandUZS - fobUZS) / fobUZS) * 100 : 0;
    return {
      totalFobUZS: fobUZS,
      totalCargoUZS: cargoUZS,
      grandLandedCostUZS: grandUZS,
      landedMarkupPercent: markup,
    };
  }, [fobAmountUSD, internationalCargoUSD, customsDutyUZS, exchangeRate]);

  // Glide Data Grid for Items
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "sku", title: "Artikul", width: 130, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Nomenklatura Nomi", width: 320, icon: GridColumnIcon.HeaderString },
      { id: "category", title: "Kategoriya", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      { id: "unit", title: "Birlik", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Miqdor", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "fobPriceUSD", title: "FOB Narx ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "fobTotalUSD", title: "Jami FOB ($)", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "landedCostUZS", title: "Landed Tannarx (UZS)", width: 160, icon: GridColumnIcon.HeaderNumber },
      { id: "suggestedSalePriceUZS", title: "Tavsiya Sotuv (UZS)", width: 160, icon: GridColumnIcon.HeaderNumber },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const item = items[rowIndex];
      const col = columns[colIndex];
      if (!item || !col) return { kind: GridCellKind.Loading, allowOverlay: false };

      if (col.id === "sku" || col.id === "name" || col.id === "category" || col.id === "unit") {
        const val = String((item as any)[col.id] || "");
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: false,
          readonly: true,
          themeOverride: col.id === "sku" ? { baseFontStyle: "bold 11px monospace" } : undefined,
        };
      }

      if (col.id === "quantity") {
        return {
          kind: GridCellKind.Number,
          data: item.quantity,
          displayData: item.quantity.toLocaleString(),
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: { baseFontStyle: "600 11px monospace" },
        };
      }

      if (col.id === "fobPriceUSD") {
        return {
          kind: GridCellKind.Number,
          data: item.fobPriceUSD,
          displayData: `$${item.fobPriceUSD.toFixed(3)}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
        };
      }

      if (col.id === "fobTotalUSD") {
        return {
          kind: GridCellKind.Number,
          data: item.fobTotalUSD,
          displayData: `$${item.fobTotalUSD.toLocaleString()}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: { baseFontStyle: "600 11px monospace" },
        };
      }

      if (col.id === "landedCostUZS") {
        return {
          kind: GridCellKind.Number,
          data: item.landedCostUZS,
          displayData: `${item.landedCostUZS.toLocaleString()} UZS`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#1d4ed8",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "suggestedSalePriceUZS") {
        return {
          kind: GridCellKind.Number,
          data: item.suggestedSalePriceUZS,
          displayData: `${item.suggestedSalePriceUZS.toLocaleString()} UZS`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#34d399" : "#059669",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [columns, items, isDark]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const row = items[rowIndex];
      if (!row) return;

      openTab({
        id: row.sku,
        title: `${row.sku}: ${row.name}`,
        type: "trading-catalog",
        module: "trading",
        documentData: {
          id: row.sku,
          sku: row.sku,
          name: row.name,
          category: row.category,
          unit: row.unit,
          priceUZS: row.suggestedSalePriceUZS,
          priceUSD: row.suggestedSalePriceUZS / exchangeRate,
          stockQty: row.quantity,
          origin: `${origin} (Import: ${batchNo})`,
        },
      });
    },
    [items, openTab, batchNo, origin, exchangeRate]
  );

  const handleSave = async () => {
    const payload: Partial<TradingImportBatchRecord> = {
      id: rawData.id && !rawData.id.startsWith("draft-") ? rawData.id : undefined,
      batchNo,
      date,
      origin,
      supplier,
      containerNo,
      fobAmountUSD,
      internationalCargoUSD,
      grossWeightKg,
      customsDutyUZS,
      exchangeRate,
      totalLandedCostUZS: grandLandedCostUZS,
      landedCostMarkupPercent: Number(landedMarkupPercent.toFixed(1)),
      status,
      items,
      notes,
    };
    await upsertTradingImportAsync(payload);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Partiya saqlandi",
      description: `${batchNo} import partiyasi ma'lumotlari bazaga muvaffaqiyatli saqlandi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-imports" },
    });
  };

  const handleAllocateToStock = async () => {
    try {
      const payload: Partial<TradingImportBatchRecord> = {
        id: rawData.id && !rawData.id.startsWith("draft-") ? rawData.id : undefined,
        batchNo,
        date,
        origin,
        supplier,
        containerNo,
        fobAmountUSD,
        internationalCargoUSD,
        grossWeightKg,
        customsDutyUZS,
        exchangeRate,
        totalLandedCostUZS: grandLandedCostUZS,
        landedCostMarkupPercent: Number(landedMarkupPercent.toFixed(1)),
        status: "Allocated to Stock",
        items,
        notes,
      };
      const saved = await upsertTradingImportAsync(payload);
      if (saved && saved.id) {
        await allocateTradingImportToStockAsync(saved.id);
      }
      setStatus("Allocated to Stock");
      setTabUnsaved(tab.id, false);
      addNotification({
        title: "Omborga kirim qilindi",
        description: `${batchNo} partiyasidagi ${items.length} ta pozitsiya markaziy savdo ombor zaxirasiga kirim qilindi.`,
        severity: "success",
        link: { module: "trading", subModule: "trading-catalog" },
      });
      closeTab(tab.id);
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err.message || "Omborga kirim qilib bo'lmadi",
        severity: "error",
      });
    }
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Standard Document Header */}
      <DocumentHeader
        icon={Ship}
        title={`Import Partiyasi: ${batchNo}`}
        docNo={batchNo}
        date={date}
        status={status === "Allocated to Stock" ? "Completed" : "Active"}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Saqlash</span>
            </Button>

            <Button
              size="sm"
              onClick={handleAllocateToStock}
              disabled={status === "Allocated to Stock"}
              className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Omborga kirim qilish</span>
            </Button>
          </>
        }
      />

      {/* SINGLE UNIFIED PAGE BODY */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ALL TOP FORM FIELDS & FINANCIAL METRICS (NO SUB-TABS) */}
        <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5 overflow-y-auto max-h-[38vh]">
          {/* TOP METRIC TILES */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">FOB Xarid (Xitoy):</span>
              <div className="text-sm font-mono font-bold text-foreground">${fobAmountUSD.toLocaleString()}</div>
              <span className="text-[10px] text-muted-foreground font-mono">{(totalFobUZS / 1_000_000).toFixed(1)} mln UZS</span>
            </div>

            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Xalqaro Kargo / Fura:</span>
              <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">${internationalCargoUSD.toLocaleString()}</div>
              <span className="text-[10px] text-muted-foreground font-mono">{(totalCargoUZS / 1_000_000).toFixed(1)} mln UZS</span>
            </div>

            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Bojxona To&apos;lovi (UZS):</span>
              <div className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">{(customsDutyUZS / 1_000_000).toFixed(1)} mln</div>
              <span className="text-[10px] text-muted-foreground">Rastamojka xarajati</span>
            </div>

            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Toshkent Omboridagi Tannarx:</span>
              <div className="text-sm font-mono font-bold text-primary">{(grandLandedCostUZS / 1_000_000).toFixed(1)} mln UZS</div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">+{landedMarkupPercent.toFixed(1)}% umumiy ustama</span>
            </div>
          </div>

          {/* EDITABLE PARAMETERS ROW 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Xitoy Yetkazib Beruvchi:</Label>
              <div className="mt-0.5">
                <SmartCombobox
                  value={supplier}
                  onChange={(val) => {
                    setSupplier(val);
                    setTabUnsaved(tab.id, true);
                  }}
                  onAddNew={(newVal) => {
                    setSupplier(newVal);
                    setTabUnsaved(tab.id, true);
                  }}
                  options={[
                    "Yiwu Accessories Industrial Group Ltd",
                    "Zhejiang Zipper & Button Factory",
                    "Guangzhou Hardware & Accessories Ltd",
                    "Shanghai Sewing Thread Co.",
                    "Ningbo Textile Trimmings Co.",
                  ]}
                  placeholder="Yetkazib beruvchini tanlang..."
                  searchPlaceholder="Kompaniya nomi..."
                  allowCustom={true}
                  className="h-7 text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Konteyner / Fura №:</Label>
              <Input
                value={containerNo}
                onChange={(e) => {
                  setContainerNo(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Jo&apos;natilgan Shahar / Port:</Label>
              <div className="mt-0.5">
                <SmartCombobox
                  value={origin}
                  onChange={(val) => {
                    setOrigin(val);
                    setTabUnsaved(tab.id, true);
                  }}
                  onAddNew={(newVal) => {
                    setOrigin(newVal);
                    setTabUnsaved(tab.id, true);
                  }}
                  options={[
                    "Guangzhou, Xitoy",
                    "Yiwu, Xitoy",
                    "Shanghai, Xitoy",
                    "Ningbo, Xitoy",
                    "Shenzhen, Xitoy",
                    "Urumqi, Xitoy",
                    "Istanbul, Turkiya",
                  ]}
                  placeholder="Shahar / Port..."
                  searchPlaceholder="Shahar qidiruvi..."
                  allowCustom={true}
                  className="h-7 text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">MB Valyuta Kursi ($1):</Label>
              <MoneyInput
                thousandSeparator=" "
                decimalScale={0}
                value={exchangeRate}
                onValueChange={(values) => {
                  setExchangeRate(values.floatValue ?? 12850);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono text-right mt-0.5"
              />
            </div>
          </div>

          {/* EDITABLE PARAMETERS ROW 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">FOB Qiymati ($):</Label>
              <MoneyInput
                thousandSeparator=" "
                decimalScale={2}
                value={fobAmountUSD}
                onValueChange={(values) => {
                  setFobAmountUSD(values.floatValue ?? 0);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Kargo / Transport ($):</Label>
              <MoneyInput
                thousandSeparator=" "
                decimalScale={2}
                value={internationalCargoUSD}
                onValueChange={(values) => {
                  setInternationalCargoUSD(values.floatValue ?? 0);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Bojxona To&apos;lovi (UZS):</Label>
              <MoneyInput
                thousandSeparator=" "
                decimalScale={0}
                value={customsDutyUZS}
                onValueChange={(values) => {
                  setCustomsDutyUZS(values.floatValue ?? 0);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Brutto Og&apos;irligi (kg):</Label>
              <Input
                type="number"
                value={grossWeightKg}
                onChange={(e) => {
                  setGrossWeightKg(Number(e.target.value) || 0);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM REAL DATA: GLIDE DATA GRID LIST */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* TOOLBAR */}
          <div className="px-3 h-8 border-b border-border bg-card shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold text-xs text-foreground">
                Partiya Tarkibidagi Nomenklaturalar va Tannarx
              </span>
              <Badge variant="secondary" className="font-mono text-[10px] h-4.5 px-1.5">
                {items.length} ta yozuv
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleQuickAddItem}
                className="h-6 px-2 text-[11px] gap-1 cursor-pointer ml-2"
              >
                <Plus className="w-3 h-3 text-primary" />
                <span>Qator qo&apos;shish</span>
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Ikkita marta bosing (F12) — Katalog kartochkasini ochish
            </div>
          </div>

          {/* GLIDE CANVAS */}
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0">
              <DataEditor
                columns={columns}
                rows={items.length}
                getCellContent={getCellContent}
                onCellActivated={handleCellActivated}
                gridSelection={gridSelection}
                onGridSelectionChange={setGridSelection}
                rowMarkers="both"
                freezeColumns={1}
                smoothScrollX
                smoothScrollY
                theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                width="100%"
                height="100%"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
