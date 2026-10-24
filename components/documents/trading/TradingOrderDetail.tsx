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
  EditableGridCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { DocumentHeader } from "@/components/documents/common/DocumentShell";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  PackageCheck,
  Save,
  Check,
  Plus,
  Trash2,
  Printer,
  Factory,
  Truck,
  CreditCard,
  Calendar,
  Globe2,
  Layers,
  ArrowRight,
} from "lucide-react";
import { TradingOrderRecord, TradingOrderItem } from "./types";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function TradingOrderDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, addNotification, theme, openTab } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<TradingOrderRecord> = tab.documentData || {};

  // Form State
  const [orderNo] = useState<string>(rawData.orderNo || tab.id);
  const [date, setDate] = useState<string>(
    rawData.date || new Date().toISOString().split("T")[0]
  );
  const [customer, setCustomer] = useState<string>(
    rawData.customer || "'REAL TEXTILE INVEST' MChJ"
  );
  const [contractNo, setContractNo] = useState<string>(
    rawData.contractNo || "AK-2026/04"
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    rawData.deliveryDate || "2026-11-05"
  );
  const [chinaStatus, setChinaStatus] = useState<
    "Navbatda" | "Guangzhou Zavodida Ishlab Chiqarilmoqda" | "Kargo Avto Yo'lda (CN-2026-OCT-14)" | "Ombordan Zaxiradan Ajratildi" | "Yetkazib Berildi"
  >(rawData.chinaStatus || "Guangzhou Zavodida Ishlab Chiqarilmoqda");
  const [advanceStatus, setAdvanceStatus] = useState<
    "0% Kutilmoqda" | "30% Avans Olingan" | "50% To'langan" | "100% To'langan" | "Shartnoma Bo'yicha"
  >(rawData.advanceStatus || "30% Avans Olingan");
  const [shippingMethod, setShippingMethod] = useState<
    "Avto Fura Kargo (12-16 kun)" | "Avia Ekspress (4-6 kun)" | "Temir yo'l Konteyner (20-25 kun)"
  >(rawData.shippingMethod || "Avto Fura Kargo (12-16 kun)");
  const [trackingNo, setTrackingNo] = useState<string>(
    rawData.trackingNo || "CN-UZ-994812"
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    rawData.exchangeRate || 12850
  );
  const [notes, setNotes] = useState<string>(
    rawData.notes || "Mijoz maxsus gravyurali metall tugma va rangli zamok buyurtma berdi. Xitoy zavodiga 30% avans o'tkazildi."
  );

  // Items
  const [items, setItems] = useState<TradingOrderItem[]>(
    rawData.items && rawData.items.length > 0
      ? rawData.items
      : [
          {
            id: "ord-item-1",
            sku: "BTN-MET-18MM",
            name: "Metall Gravirovka Tugma 18mm",
            spec: "Lazer logotip: 'Real Denim', Rang: Antik Bronza, 18mm",
            unit: "dona",
            quantity: 50000,
            unitPriceUSD: 0.032,
            totalUSD: 1600,
            chinaFactoryStatus: "Ishlab chiqarilmoqda",
          },
          {
            id: "ord-item-2",
            sku: "ZIP-NYL-N5-45",
            name: "Neylon Fermuar N5, 45sm",
            spec: "Tish rangi: Qora emal, Slider: #5 Avtolok, Uzunlik: 45sm",
            unit: "dona",
            quantity: 30000,
            unitPriceUSD: 0.185,
            totalUSD: 5550,
            chinaFactoryStatus: "Ishlab chiqarilmoqda",
          },
        ]
  );

  const grandTotalUSD = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPriceUSD, 0);
  }, [items]);

  const grandTotalUZS = grandTotalUSD * exchangeRate;
  const advanceAmountUSD = grandTotalUSD * 0.3; // 30% avans
  const remainingUSD = grandTotalUSD - advanceAmountUSD;

  // ─── Glide Data Grid for Order Items ─────────────────────────────────────────
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "sku", title: "Artikul", width: 140, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Nomenklatura Nomi", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "spec", title: "Maxsus Spetsifikatsiya / Xususiyatlari", width: 340, icon: GridColumnIcon.HeaderString },
      { id: "unit", title: "Birlik", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Buyurtma Miqdori", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "unitPriceUSD", title: "Xitoy Narxi ($)", width: 120, icon: GridColumnIcon.HeaderNumber },
      { id: "totalUSD", title: "Jami ($)", width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "totalUZS", title: "Jami (UZS)", width: 160, icon: GridColumnIcon.HeaderNumber },
      { id: "chinaFactoryStatus", title: "Zavod Bosqichi", width: 160, icon: GridColumnIcon.HeaderLookup },
    ],
    []
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const item = items[rowIndex];
      const col = columns[colIndex];
      if (!item || !col) return { kind: GridCellKind.Loading, allowOverlay: false };

      if (col.id === "sku" || col.id === "name" || col.id === "spec" || col.id === "unit") {
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
          allowOverlay: true,
          contentAlign: "right",
          themeOverride: { baseFontStyle: "600 11px monospace" },
        };
      }

      if (col.id === "unitPriceUSD") {
        return {
          kind: GridCellKind.Number,
          data: item.unitPriceUSD,
          displayData: `$${item.unitPriceUSD.toFixed(3)}`,
          allowOverlay: true,
          contentAlign: "right",
        };
      }

      if (col.id === "totalUSD") {
        const tot = item.quantity * item.unitPriceUSD;
        return {
          kind: GridCellKind.Number,
          data: tot,
          displayData: `$${tot.toFixed(2)}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#38bdf8" : "#0284c7",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "totalUZS") {
        const totUZS = item.quantity * item.unitPriceUSD * exchangeRate;
        return {
          kind: GridCellKind.Number,
          data: totUZS,
          displayData: `${totUZS.toLocaleString()} UZS`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#94a3b8" : "#64748b",
            baseFontStyle: "11px monospace",
          },
        };
      }

      if (col.id === "chinaFactoryStatus") {
        return {
          kind: GridCellKind.Text,
          data: item.chinaFactoryStatus,
          displayData: item.chinaFactoryStatus,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: isDark ? "#f59e0b" : "#d97706",
            baseFontStyle: "600 11px sans-serif",
          },
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [columns, items, exchangeRate, isDark]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [colIndex, rowIndex] = cell;
      const col = columns[colIndex];
      if (!col) return;

      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[rowIndex] };

        if (col.id === "quantity") {
          item.quantity = Number(newValue.data) || 0;
          item.totalUSD = item.quantity * item.unitPriceUSD;
        } else if (col.id === "unitPriceUSD") {
          item.unitPriceUSD = Number(newValue.data) || 0;
          item.totalUSD = item.quantity * item.unitPriceUSD;
        }

        next[rowIndex] = item;
        return next;
      });
      setTabUnsaved(tab.id, true);
    },
    [columns, setTabUnsaved, tab.id]
  );

  const handleQuickAddRow = () => {
    const newItem: TradingOrderItem = {
      id: `ord-item-${Date.now()}`,
      sku: "ACC-CUSTOM-NEW",
      name: "Yangi buyurtma qatori",
      spec: "Xitoy namunasi bo'yicha maxsus qolip",
      unit: "dona",
      quantity: 10000,
      unitPriceUSD: 0.05,
      totalUSD: 500,
      chinaFactoryStatus: "Navbatda",
    };
    setItems((prev) => [...prev, newItem]);
    setTabUnsaved(tab.id, true);
  };

  const handleRemoveSelectedRows = () => {
    const selectedRows = gridSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    setItems((prev) => prev.filter((_, idx) => !selectedRows.includes(idx)));
    setGridSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
    setTabUnsaved(tab.id, true);
  };

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Buyurtma saqlandi",
      description: `${orderNo} mijoz buyurtmasi muvaffaqiyatli saqlandi.`,
      severity: "success",
    });
  };

  const handleConvertToSale = () => {
    // Convert this back-to-back order directly into a Trading Sale (Hisob-faktura)
    const saleId = `TRD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    openTab({
      id: saleId,
      title: `${saleId} (${customer})`,
      type: "trading-sale",
      module: "trading",
      isUnsaved: false,
      documentData: {
        id: saleId,
        docNo: saleId,
        date: new Date().toISOString().split("T")[0],
        sellerEntityId: "ytt-qodirov",
        sellerEntityName: "YTT Qodirov Baxtiyor",
        customer: customer,
        contractNo: contractNo,
        currency: "USD",
        exchangeRate: exchangeRate,
        totalAmount: grandTotalUSD,
        totalUSD: grandTotalUSD,
        totalUZS: grandTotalUZS,
        status: "Draft",
        items: items.map((i) => ({
          id: `item-${Date.now()}-${i.id}`,
          sku: i.sku,
          name: i.name,
          category: "Furnitura",
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPriceUSD,
          unitPriceUSD: i.unitPriceUSD,
          unitPriceUZS: i.unitPriceUSD * exchangeRate,
          totalAmount: i.totalUSD,
          totalUSD: i.totalUSD,
        })),
      },
    });
    addNotification({
      title: "Sotuv hujjati yaratildi",
      description: `Buyurtma ${orderNo} asosida yangi Sotuv hujjati (${saleId}) ochildi.`,
      severity: "success",
    });
  };

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Standard Document Header (Order / Cyan-Sky Theme) */}
      <DocumentHeader
        icon={PackageCheck}
        title={`Mijoz Furnitura Buyurtmasi (Back-to-Back China Order): ${customer}`}
        docNo={orderNo}
        date={date}
        status="Active"
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addNotification({
                  title: "Buyurtma Spetsifikatsiyasi PDF",
                  description: `${orderNo} spetsifikatsiyasi va texnik talablar chop etilmoqda.`,
                  severity: "info",
                });
              }}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">Spetsifikatsiya (PDF)</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Saqlash</span>
            </Button>

            <Button
              size="sm"
              onClick={handleConvertToSale}
              className="h-7 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Sotuv Hujjatiga Aylantirish</span>
            </Button>
          </>
        }
      />

      {/* SINGLE-PAGE ORDER PARAMETERS AT TOP */}
      <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5">
        {/* TOP SUMMARY CARDS (ORDER SPECIFIC: XITOY PROGRESS, AVANS, ETA) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Card 1: Jami Buyurtma Qiymati */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Jami Buyurtma ($):</span>
            <div className="text-sm font-mono font-bold text-sky-600 dark:text-sky-400">
              ${grandTotalUSD.toLocaleString()}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {(grandTotalUZS / 1_000_000).toFixed(1)} mln UZS ekvivalenti
            </span>
          </div>

          {/* Card 2: Xitoy Zavodi Holati */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Xitoy Zanjiri:</span>
              <Badge variant="outline" className="text-[9px] px-1 h-3.5 bg-amber-50 text-amber-700 border-amber-300">
                Back-to-back
              </Badge>
            </div>
            <div className="text-xs font-semibold text-foreground truncate" title={chinaStatus}>
              {chinaStatus}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Trek: {trackingNo}</span>
          </div>

          {/* Card 3: Avans To'lovi */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Avans Holati:</span>
              <Badge variant="outline" className="text-[9px] px-1 h-3.5 bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
                {advanceStatus}
              </Badge>
            </div>
            <div className="text-xs font-mono font-bold text-foreground">
              ${advanceAmountUSD.toFixed(0)} olingan / qoldiq ${remainingUSD.toFixed(0)}
            </div>
            <span className="text-[10px] text-muted-foreground">Yuk kelganda to'liq yopiladi</span>
          </div>

          {/* Card 4: Yetkazish Muddati (ETA) */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Yetkazish Muddati (ETA):</span>
            <div className="text-sm font-mono font-bold text-foreground">
              {deliveryDate}
            </div>
            <span className="text-[10px] text-muted-foreground truncate block" title={shippingMethod}>
              {shippingMethod}
            </span>
          </div>
        </div>

        {/* EDITABLE PARAMETERS: 4 COMPACT COLUMNS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {/* Col 1: Customer */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Buyurtmachi Tekstil Fabrikasi:</Label>
            <Select
              value={customer}
              onValueChange={(val) => {
                setCustomer(val || "");
                setTabUnsaved(tab.id, true);
              }}
            >
              <SelectTrigger className="h-7 text-xs font-medium mt-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="'REAL TEXTILE INVEST' MChJ">&quot;REAL TEXTILE INVEST&quot; MChJ</SelectItem>
                <SelectItem value="'BUKHARA COTTON WEAVE' XK">&quot;BUKHARA COTTON WEAVE&quot; XK</SelectItem>
                <SelectItem value="'SAMARKAND APPAREL' MChJ">&quot;SAMARKAND APPAREL&quot; MChJ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Col 2: China Status */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Xitoy Zanjiridagi Bosqich:</Label>
            <Select
              value={chinaStatus}
              onValueChange={(val: any) => {
                setChinaStatus(val);
                setTabUnsaved(tab.id, true);
              }}
            >
              <SelectTrigger className="h-7 text-xs font-medium mt-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="Navbatda">Navbatda (Kutilmoqda)</SelectItem>
                <SelectItem value="Guangzhou Zavodida Ishlab Chiqarilmoqda">Guangzhou Zavodida Ishlab Chiqarilmoqda</SelectItem>
                <SelectItem value="Kargo Avto Yo'lda (CN-2026-OCT-14)">Kargo Avto Yo&apos;lda (CN-2026-OCT-14)</SelectItem>
                <SelectItem value="Ombordan Zaxiradan Ajratildi">Ombordan Zaxiradan Ajratildi</SelectItem>
                <SelectItem value="Yetkazib Berildi">Yetkazib Berildi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Col 3: Advance Status */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Mijoz Avansi:</Label>
            <Select
              value={advanceStatus}
              onValueChange={(val: any) => {
                setAdvanceStatus(val);
                setTabUnsaved(tab.id, true);
              }}
            >
              <SelectTrigger className="h-7 text-xs font-medium mt-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="0% Kutilmoqda">0% Kutilmoqda</SelectItem>
                <SelectItem value="30% Avans Olingan">30% Avans Olingan</SelectItem>
                <SelectItem value="50% To'langan">50% To&apos;langan</SelectItem>
                <SelectItem value="100% To'langan">100% To&apos;langan</SelectItem>
                <SelectItem value="Shartnoma Bo'yicha">Shartnoma Bo&apos;yicha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Col 4: Delivery Date & Logistics */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Muddati (ETA):</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => {
                  setDeliveryDate(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div className="w-24">
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Kurs:</Label>
              <Input
                type="number"
                value={exchangeRate}
                onChange={(e) => {
                  setExchangeRate(Number(e.target.value) || 12850);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono text-right mt-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* INDUSTRIAL ACTION TOOLBAR FOR ORDER SPECIFICATION GRID */}
      <div className="px-3 h-9 border-b border-border bg-card shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleQuickAddRow}
            className="h-7 px-2.5 text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Spetsifikatsiya qatori qo&apos;shish</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemoveSelectedRows}
            disabled={gridSelection.rows.length === 0}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>O&apos;chirish</span>
          </Button>

          <Separator orientation="vertical" className="h-4 bg-border mx-1" />

          <Badge variant="secondary" className="font-mono text-[10px] h-5">
            {items.length} ta spetsifikatsiya
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-mono">
            Jami: <strong className="text-foreground">${grandTotalUSD.toFixed(2)} USD</strong>
          </span>
          <span className="text-[11px] text-muted-foreground font-mono hidden md:inline">
            (Miqdor va narxni to&apos;g&apos;ridan-to&apos;g&apos;ri tahrirlashingiz mumkin)
          </span>
        </div>
      </div>

      {/* GLIDE DATA GRID: ENTIRE LOWER VIEWPORT */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <DataEditor
            columns={columns}
            rows={items.length}
            getCellContent={getCellContent}
            onCellEdited={handleCellEdited}
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
  );
}
