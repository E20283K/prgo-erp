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
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "@/components/documents/common/DocumentShell";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  Building2,
  Boxes,
  Coins,
  Warehouse,
  Barcode,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  History,
  FileSpreadsheet,
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
  const { setTabUnsaved, closeTab, setLevel3Tab, addNotification, openTab, theme } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<TradingCatalogItemRecord> = tab.documentData || {};

  const activeTab = tab.activeLevel3Tab || "pricing";

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
          title: `Sotuv: ${row.docNo}`,
          type: "trading-sale",
          module: "trading",
          documentData: { id: row.docNo, docNo: row.docNo, customer: row.partner },
        });
      } else if (row.type.includes("Import")) {
        openTab({
          id: row.docNo,
          title: `Import: ${row.docNo}`,
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
      title: `${newDocId} (Sotuv: ${sku})`,
      type: "trading-sale",
      module: "trading",
      isUnsaved: true,
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

  const navItems: DocumentNavItem[] = [
    {
      id: "pricing",
      label: "Narxlar & Valyuta",
      icon: Coins,
    },
    {
      id: "stock",
      label: "Ombor Zaxirasi & Partiyalar",
      icon: Warehouse,
      badge: `${stockQty.toLocaleString()} ${unit}`,
      badgeClassName: stockQty < minStockLevel ? "text-destructive font-bold" : undefined,
    },
    {
      id: "specs",
      label: "Texnik Xususiyatlar",
      icon: Layers,
    },
  ];

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Document Header */}
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

        {/* Workspace Body */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel="Bo'limlar"
            items={navItems}
            activeId={activeTab}
            onSelect={(id) => setLevel3Tab(tab.id, id)}
            summary={
              <SidebarSummaryCard
                icon={Tag}
                title={name}
                subtitle={`${sku} • ${category}`}
              >
                <InfoRow label="Asosiy Narx:">
                  <span className="font-mono font-bold text-xs text-primary">
                    {priceUZS.toLocaleString()} UZS
                  </span>
                </InfoRow>

                <InfoRow label="Ekvivalent ($):">
                  <span className="font-mono text-xs">
                    ${priceUSD.toFixed(3)} USD
                  </span>
                </InfoRow>

                <InfoRow label="Zaxira Holati:">
                  <span className="font-mono font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                    {stockQty.toLocaleString()} {unit}
                  </span>
                </InfoRow>
              </SidebarSummaryCard>
            }
            footer={
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kategoriya:</span>
                  <Badge variant="secondary" className="text-[9px]">{category}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Manba:</span>
                  <span className="text-[10px] text-foreground truncate max-w-[120px]" title={origin}>
                    {origin}
                  </span>
                </div>
              </div>
            }
          />

          {/* Right Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            {/* TAB 1: PRICING */}
            <TabsContent value="pricing" className="flex-1 overflow-y-auto m-0 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">B2B Standart Sotuv Narxi:</span>
                  <strong className="text-base font-mono block text-primary">{priceUZS.toLocaleString()} UZS</strong>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ~${priceUSD.toFixed(3)} USD (1$ = {exchangeRate} UZS)
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Yirik Ulgurji Narx (50k+):</span>
                  <strong className="text-base font-mono block text-emerald-600 dark:text-emerald-400">
                    {wholesalePriceUZS.toLocaleString()} UZS
                  </strong>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Muntazam tekstil fabrikalari uchun
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Chakana / Kichik Tiraj:</span>
                  <strong className="text-base font-mono block text-foreground">
                    {retailPriceUZS.toLocaleString()} UZS
                  </strong>
                  <span className="text-[10px] text-muted-foreground">10,000 donagacha bo'lgan partiyalar</span>
                </div>
              </div>

              {/* EDITABLE PRICING FORM */}
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Narx Siyosati va Kurs O&apos;zgarishlari
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">B2B Standart Narx (UZS):</Label>
                    <Input
                      type="number"
                      value={priceUZS}
                      onChange={(e) => {
                        setPriceUZS(Number(e.target.value) || 0);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Ulgurji Narx (UZS):</Label>
                    <Input
                      type="number"
                      value={wholesalePriceUZS}
                      onChange={(e) => {
                        setWholesalePriceUZS(Number(e.target.value) || 0);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Markaziy Bank Kursi (USD):</Label>
                    <Input
                      type="number"
                      value={exchangeRate}
                      onChange={(e) => {
                        setExchangeRate(Number(e.target.value) || 12850);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: STOCK & GLIDE DATA GRID MOVEMENTS */}
            <TabsContent value="stock" className="flex-1 flex flex-col overflow-hidden m-0">
              {/* TOP SUMMARY BAR */}
              <div className="p-3 bg-muted/30 border-b border-border shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-card border border-border">
                  <span className="text-[11px] text-muted-foreground">Joriy Ombor Zaxirasi:</span>
                  <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                    {stockQty.toLocaleString()} {unit}
                  </strong>
                </div>

                <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-card border border-border">
                  <span className="text-[11px] text-muted-foreground">Minimal Xavfsiz Chegara:</span>
                  <strong className="text-sm font-mono text-foreground">
                    {minStockLevel.toLocaleString()} {unit}
                  </strong>
                </div>

                <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-card border border-border">
                  <span className="text-[11px] text-muted-foreground">Manba:</span>
                  <span className="text-xs font-medium text-foreground truncate max-w-[150px]" title={origin}>
                    {origin}
                  </span>
                </div>
              </div>

              {/* GLIDE DATA GRID WORKSPACE */}
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
            </TabsContent>

            {/* TAB 3: SPECS */}
            <TabsContent value="specs" className="flex-1 overflow-y-auto m-0 p-4 space-y-4">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Texnik Xususiyatlar va Material Parametrlari
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Xomashyo / Material:</Label>
                    <Input
                      value={material}
                      onChange={(e) => {
                        setMaterial(e.target.value);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Rang va qoplama kodi:</Label>
                    <Input
                      value={colorCode}
                      onChange={(e) => {
                        setColorCode(e.target.value);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">O&apos;lchamlari:</Label>
                    <Input
                      value={dimensions}
                      onChange={(e) => {
                        setDimensions(e.target.value);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <Label className="text-[11px] text-muted-foreground">Texnik tavsif va qo&apos;llanilishi:</Label>
                  <Input
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setTabUnsaved(tab.id, true);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
