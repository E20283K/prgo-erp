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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tag,
  Save,
  Check,
  Warehouse,
  History,
} from "lucide-react";
import { TradingCatalogItemRecord } from "./types";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

interface StockMovementRow {
  id: string;
  date: string;
  type: "Kirim (Import)" | "Chiqim (Sotuv)" | "Rezerv";
  docNo: string;
  partner: string;
  qty: number;
  balanceAfter: number;
  priceFormatted: string;
}

export function TradingCatalogDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, addNotification, openTab, theme } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<TradingCatalogItemRecord> = tab.documentData || {};

  // Form State
  const [sku] = useState<string>(rawData.sku || "ACC-SKU-01");
  const [name, setName] = useState<string>(rawData.name || "Aksessuar Mahsuloti");
  const [category, setCategory] = useState<
    "Tugmalar" | "Fermuarlar" | "Jakkard" | "Iplar" | "Yorliqlar" | "Furnitura"
  >(rawData.category || "Tugmalar");
  const [unit, setUnit] = useState<string>(rawData.unit || "dona");

  // Pricing
  const [priceUZS, setPriceUZS] = useState<number>(rawData.priceUZS || 480);
  const [wholesalePriceUZS, setWholesalePriceUZS] = useState<number>(
    rawData.wholesalePriceUZS || 440
  );
  const [retailPriceUZS, setRetailPriceUZS] = useState<number>(
    rawData.retailPriceUZS || 520
  );
  const [exchangeRate, setExchangeRate] = useState<number>(12850);

  // Stock
  const [stockQty, setStockQty] = useState<number>(rawData.stockQty || 142000);
  const [minStockLevel, setMinStockLevel] = useState<number>(rawData.minStockLevel || 20000);
  const [origin, setOrigin] = useState<string>(rawData.origin || "Guangzhou, Xitoy (Import)");

  // Technical Specs
  const [material, setMaterial] = useState<string>(rawData.material || "Zamak metall qotishmasi");
  const [colorCode, setColorCode] = useState<string>(rawData.colorCode || "Antik bronza / Kumush");
  const [dimensions, setDimensions] = useState<string>(rawData.dimensions || "18mm diametr");
  const [supplier, setSupplier] = useState<string>(
    rawData.supplier || "Yiwu Accessories Industrial Group Ltd"
  );
  const [notes, setNotes] = useState<string>(
    rawData.notes || "Kurtka va qalin kiyimlar uchun maxsus gravirovkali tugma."
  );

  const priceUSD = priceUZS / exchangeRate;

  // Real-world warehouse stock movements for Glide Data Grid
  const stockMovements: StockMovementRow[] = useMemo(
    () => [
      {
        id: "mov-1",
        date: "2026-10-18",
        type: "Chiqim (Sotuv)",
        docNo: "TRD-2026-0842",
        partner: "'REAL TEXTILE INVEST' MChJ",
        qty: -25000,
        balanceAfter: 142000,
        priceFormatted: "480 UZS",
      },
      {
        id: "mov-2",
        date: "2026-10-14",
        type: "Kirim (Import)",
        docNo: "CN-2026-OCT-14",
        partner: "Yiwu Accessories Industrial Group",
        qty: 100000,
        balanceAfter: 167000,
        priceFormatted: "$0.025 FOB",
      },
      {
        id: "mov-3",
        date: "2026-10-10",
        type: "Chiqim (Sotuv)",
        docNo: "TRD-2026-0820",
        partner: "'BUKHARA COTTON WEAVE' XK",
        qty: -15000,
        balanceAfter: 67000,
        priceFormatted: "480 UZS",
      },
      {
        id: "mov-4",
        date: "2026-10-05",
        type: "Chiqim (Sotuv)",
        docNo: "TRD-2026-0795",
        partner: "'SAMARKAND APPAREL' MChJ",
        qty: -20000,
        balanceAfter: 82000,
        priceFormatted: "$0.037",
      },
      {
        id: "mov-5",
        date: "2026-09-28",
        type: "Kirim (Import)",
        docNo: "CN-2026-SEP-28",
        partner: "Zhejiang Zipper & Button Factory",
        qty: 50000,
        balanceAfter: 102000,
        priceFormatted: "$0.024 FOB",
      },
    ],
    []
  );

  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const movementColumns = useMemo<GridColumn[]>(
    () => [
      { id: "date", title: "Sana", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "type", title: "Operatsiya Turi", width: 150, icon: GridColumnIcon.HeaderSingleValue },
      { id: "docNo", title: "Hujjat №", width: 140, icon: GridColumnIcon.HeaderReference },
      { id: "partner", title: "Kontragent (Xaridor / Zavod)", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "qty", title: "Miqdor", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "balanceAfter", title: "Qoldiq Zaxira", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "priceFormatted", title: "Narx", width: 120, icon: GridColumnIcon.HeaderNumber },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const mov = stockMovements[rowIndex];
      const col = movementColumns[colIndex];
      if (!mov || !col) return { kind: GridCellKind.Loading, allowOverlay: false };

      if (col.id === "date" || col.id === "docNo" || col.id === "partner" || col.id === "priceFormatted") {
        const val = String((mov as any)[col.id] || "");
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: false,
          readonly: true,
          themeOverride: col.id === "docNo" ? { baseFontStyle: "bold 11px monospace" } : undefined,
        };
      }

      if (col.id === "type") {
        const isKirim = mov.type.includes("Kirim");
        return {
          kind: GridCellKind.Text,
          data: mov.type,
          displayData: mov.type,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: isKirim ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#38bdf8" : "#0284c7"),
            baseFontStyle: "600 11px sans-serif",
          },
        };
      }

      if (col.id === "qty") {
        const isNeg = mov.qty < 0;
        return {
          kind: GridCellKind.Number,
          data: mov.qty,
          displayData: `${mov.qty > 0 ? "+" : ""}${mov.qty.toLocaleString()}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isNeg ? (isDark ? "#fb7185" : "#e11d48") : (isDark ? "#4ade80" : "#15803d"),
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "balanceAfter") {
        return {
          kind: GridCellKind.Number,
          data: mov.balanceAfter,
          displayData: `${mov.balanceAfter.toLocaleString()} ${unit}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            baseFontStyle: "600 11px monospace",
          },
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [movementColumns, stockMovements, unit, isDark]
  );

  const handleCellActivated = useCallback(
    (cell: Item) => {
      const [, rowIndex] = cell;
      const row = stockMovements[rowIndex];
      if (!row) return;

      if (row.type.includes("Sotuv")) {
        openTab({
          id: row.docNo,
          title: `${row.docNo}`,
          type: "trading-sale",
          module: "trading",
          documentData: { id: row.docNo, docNo: row.docNo, customer: row.partner },
        });
      } else if (row.type.includes("Import")) {
        openTab({
          id: row.docNo,
          title: `${row.docNo}`,
          type: "trading-import",
          module: "trading",
          documentData: { id: row.docNo, batchNo: row.docNo },
        });
      }
    },
    [stockMovements, openTab]
  );

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Mahsulot saqlandi",
      description: `${sku}: ${name} narxlari va parametrlari yangilandi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-catalog" },
    });
  };

  const handleCreateSale = () => {
    const newDocId = `TRD-${Date.now().toString().slice(-4)}`;
    openTab({
      id: newDocId,
      title: `${newDocId} (${sku})`,
      type: "trading-sale",
      module: "trading",
      isUnsaved: false,
      documentData: {
        id: newDocId,
        docNo: newDocId,
        items: [
          {
            id: `item-${Date.now()}`,
            sku: sku,
            name: name,
            category: category,
            unit: unit,
            quantity: 10000,
            unitPrice: priceUZS,
            unitPriceUZS: priceUZS,
            unitPriceUSD: priceUSD,
            totalAmount: 10000 * priceUZS,
            totalUSD: (10000 * priceUZS) / exchangeRate,
          },
        ],
      },
    });
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Standard Document Header */}
      <DocumentHeader
        icon={Tag}
        title={`${sku}: ${name}`}
        docNo={sku}
        status={stockQty > minStockLevel ? "Active" : "Warning"}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateSale}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">+ Sotuv Hujjati</span>
            </Button>

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
              onClick={() => {
                handleSave();
                closeTab(tab.id);
              }}
              className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Saqlash va yopish</span>
            </Button>
          </>
        }
      />

      {/* SINGLE UNIFIED PAGE BODY */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ALL TOP FORM FIELDS, PRICING & SPECS (NO SUB-TABS) */}
        <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5 overflow-y-auto max-h-[38vh]">
          {/* TOP METRIC CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Standart Narx:</span>
              <div className="text-sm font-mono font-bold text-primary">{priceUZS.toLocaleString()} UZS</div>
              <span className="text-[10px] text-muted-foreground font-mono">~${priceUSD.toFixed(3)} USD</span>
            </div>

            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Ulgurji Narx (50k+):</span>
              <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{wholesalePriceUZS.toLocaleString()} UZS</div>
              <span className="text-[10px] text-muted-foreground font-mono">Muntazam fabrikalarga</span>
            </div>

            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Joriy Zaxira:</span>
              <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{stockQty.toLocaleString()} {unit}</div>
              <span className="text-[10px] text-muted-foreground">Toshkent Omborida</span>
            </div>

            <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Minimal Chegara:</span>
              <div className="text-sm font-mono font-bold text-foreground">{minStockLevel.toLocaleString()} {unit}</div>
              <span className="text-[10px] text-muted-foreground">Xavfsiz qoldiq</span>
            </div>
          </div>

          {/* EDITABLE PARAMETERS ROW 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Mahsulot Nomi:</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Kategoriya:</Label>
              <Select
                value={category}
                onValueChange={(val: any) => {
                  setCategory(val);
                  setTabUnsaved(tab.id, true);
                }}
              >
                <SelectTrigger className="h-7 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="Tugmalar">Tugmalar</SelectItem>
                  <SelectItem value="Fermuarlar">Fermuarlar</SelectItem>
                  <SelectItem value="Jakkard">Jakkard</SelectItem>
                  <SelectItem value="Iplar">Iplar</SelectItem>
                  <SelectItem value="Yorliqlar">Yorliqlar</SelectItem>
                  <SelectItem value="Furnitura">Furnitura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">B2B Standart Narx (UZS):</Label>
              <Input
                type="number"
                value={priceUZS}
                onChange={(e) => {
                  setPriceUZS(Number(e.target.value) || 0);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono text-right mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Ulgurji Narx (UZS):</Label>
              <Input
                type="number"
                value={wholesalePriceUZS}
                onChange={(e) => {
                  setWholesalePriceUZS(Number(e.target.value) || 0);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono text-right mt-0.5"
              />
            </div>
          </div>

          {/* EDITABLE PARAMETERS ROW 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Material / Xomashyo:</Label>
              <Input
                value={material}
                onChange={(e) => {
                  setMaterial(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Rang / Qoplama Kodi:</Label>
              <Input
                value={colorCode}
                onChange={(e) => {
                  setColorCode(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">O&apos;lchamlari:</Label>
              <Input
                value={dimensions}
                onChange={(e) => {
                  setDimensions(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs mt-0.5"
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Ishlab Chiqaruvchi Manba:</Label>
              <Input
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM REAL DATA: GLIDE DATA GRID MOVEMENTS LIST */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* TOOLBAR */}
          <div className="px-3 h-8 border-b border-border bg-card shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold text-xs text-foreground">
                Kirim-Chiqim Partiyalar Tarixi (Katalog Kartochkasi)
              </span>
              <Badge variant="secondary" className="font-mono text-[10px] h-4.5 px-1.5">
                {stockMovements.length} ta operatsiya
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Ikkita marta bosing (F12) — Asos hujjatni ochish
            </div>
          </div>

          {/* GLIDE CANVAS */}
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0">
              <DataEditor
                columns={movementColumns}
                rows={stockMovements.length}
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
