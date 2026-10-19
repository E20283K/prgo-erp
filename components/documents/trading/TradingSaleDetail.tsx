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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  Save,
  Check,
  Plus,
  Trash2,
  Building2,
  Sparkles,
  Scale,
  Users,
  Coins,
  Receipt,
  Warehouse,
  Search,
  CheckCircle2,
} from "lucide-react";
import {
  TradingSaleRecord,
  TradingSaleItem,
  TradingCurrency,
  TradingCatalogItemRecord,
} from "./types";
import { INITIAL_YTT_ENTITIES, INITIAL_TRADING_CATALOG } from "./data";
import { AktSverkaPrintModal } from "../customer/components/AktSverkaPrintModal";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function TradingSaleDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, setLevel3Tab, addNotification, clientSettlements, theme, openTab } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<TradingSaleRecord> = tab.documentData || {};

  const activeTab = tab.activeLevel3Tab || "overview";

  // Form State
  const [docNo] = useState<string>(rawData.docNo || tab.id);
  const [date, setDate] = useState<string>(
    rawData.date || new Date().toISOString().split("T")[0]
  );
  const [sellerEntityId, setSellerEntityId] = useState<
    "ytt-qodirov" | "ytt-aliyev" | "ytt-toshmatov" | "mchj-printgoo"
  >(rawData.sellerEntityId || "ytt-qodirov");
  const [customer, setCustomer] = useState<string>(
    rawData.customer || "'REAL TEXTILE INVEST' MChJ"
  );
  const [customerTin, setCustomerTin] = useState<string>(
    rawData.customerTin || "304891234"
  );
  const [contractNo, setContractNo] = useState<string>(
    rawData.contractNo || "AK-2026/04"
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "Bank Wire (Hisob-raqam)" | "Corporate Card" | "Cash / Cash Register"
  >(rawData.paymentMethod || "Bank Wire (Hisob-raqam)");
  const [currency, setCurrency] = useState<TradingCurrency>(
    rawData.currency || "UZS"
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    rawData.exchangeRate || 12850
  );
  const [status, setStatus] = useState<"Draft" | "Posted" | "Cancelled">(
    rawData.status || "Draft"
  );
  const [notes, setNotes] = useState<string>(
    rawData.notes || "Tekstil fabrikasiga 1-partiya aksessuar va furnituralar."
  );

  const [items, setItems] = useState<TradingSaleItem[]>(
    rawData.items && rawData.items.length > 0
      ? rawData.items
      : [
          {
            id: "item-1",
            sku: "BTN-MET-18MM",
            name: "Metall Gravirovka Tugma 18mm",
            category: "Tugmalar",
            unit: "dona",
            quantity: 25000,
            unitPrice: 480,
            unitPriceUZS: 480,
            unitPriceUSD: 0.0374,
            totalAmount: 12_000_000,
            totalUSD: 933.85,
          },
          {
            id: "item-2",
            sku: "ZIP-NYL-N5-45",
            name: "Neylon Fermuar (Molniya) N5, 45sm, Qora",
            category: "Fermuarlar",
            unit: "dona",
            quantity: 10000,
            unitPrice: 3200,
            unitPriceUZS: 3200,
            unitPriceUSD: 0.249,
            totalAmount: 32_000_000,
            totalUSD: 2490.27,
          },
          {
            id: "item-3",
            sku: "LBL-JACQ-50X25",
            name: "Jakkard To'qima Yorliq 'Real Denim' 50x25mm",
            category: "Jakkard",
            unit: "dona",
            quantity: 15000,
            unitPrice: 220,
            unitPriceUZS: 220,
            unitPriceUSD: 0.0171,
            totalAmount: 3_300_000,
            totalUSD: 256.81,
            isSelfProduced: true,
          },
        ]
  );

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isWarehousePickerOpen, setIsWarehousePickerOpen] = useState(false);
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<TradingCatalogItemRecord | null>(null);
  const [pickerQuantity, setPickerQuantity] = useState<number>(10000);

  // Selected YTT entity calculations
  const selectedEntity = useMemo(() => {
    return (
      INITIAL_YTT_ENTITIES.find((e) => e.id === sellerEntityId) ||
      INITIAL_YTT_ENTITIES[0]
    );
  }, [sellerEntityId]);

  // Grand totals
  const { totalAmount, totalUZS, totalUSD } = useMemo(() => {
    let tAmount = 0;
    items.forEach((item) => {
      tAmount += item.quantity * item.unitPrice;
    });

    const tUZS = currency === "UZS" ? tAmount : tAmount * exchangeRate;
    const tUSD = currency === "USD" ? tAmount : tAmount / exchangeRate;

    return { totalAmount: tAmount, totalUZS: tUZS, totalUSD: tUSD };
  }, [items, currency, exchangeRate]);

  // Simulated YTT Limit after posting
  const simulatedTurnover = selectedEntity.currentTurnover + totalUZS;
  const simulatedPercent =
    selectedEntity.annualLimit > 0 && selectedEntity.legalType === "YTT"
      ? (simulatedTurnover / selectedEntity.annualLimit) * 100
      : 0;

  // ─── Glide Data Grid for Sale Items ──────────────────────────────────────────
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns = useMemo<GridColumn[]>(
    () => [
      { id: "sku", title: "Artikul", width: 130, icon: GridColumnIcon.HeaderReference },
      { id: "name", title: "Nomenklatura Nomi", width: 300, icon: GridColumnIcon.HeaderString },
      { id: "category", title: "Kategoriya", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      { id: "unit", title: "Birlik", width: 80, icon: GridColumnIcon.HeaderString },
      { id: "quantity", title: "Miqdor", width: 110, icon: GridColumnIcon.HeaderNumber },
      { id: "unitPrice", title: `Narxi (${currency})`, width: 130, icon: GridColumnIcon.HeaderNumber },
      { id: "totalAmount", title: `Jami (${currency})`, width: 150, icon: GridColumnIcon.HeaderNumber },
      { id: "equivalent", title: `Ekvivalent (${currency === "UZS" ? "USD" : "UZS"})`, width: 140, icon: GridColumnIcon.HeaderNumber },
      { id: "originType", title: "Ishlab Chiqarish", width: 140, icon: GridColumnIcon.HeaderLookup },
    ],
    [currency]
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
          allowOverlay: status !== "Posted",
          readonly: status === "Posted",
          contentAlign: "right",
          themeOverride: { baseFontStyle: "600 11px monospace" },
        };
      }

      if (col.id === "unitPrice") {
        return {
          kind: GridCellKind.Number,
          data: item.unitPrice,
          displayData:
            currency === "UZS"
              ? `${item.unitPrice.toLocaleString()} UZS`
              : `$${item.unitPrice.toFixed(3)}`,
          allowOverlay: status !== "Posted",
          readonly: status === "Posted",
          contentAlign: "right",
        };
      }

      if (col.id === "totalAmount") {
        return {
          kind: GridCellKind.Number,
          data: item.totalAmount,
          displayData:
            currency === "UZS"
              ? `${item.totalAmount.toLocaleString()} UZS`
              : `$${item.totalAmount.toFixed(2)}`,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#60a5fa" : "#1d4ed8",
            baseFontStyle: "bold 11px monospace",
          },
        };
      }

      if (col.id === "equivalent") {
        const equiv =
          currency === "UZS"
            ? `$${(item.totalAmount / exchangeRate).toFixed(2)}`
            : `${(item.totalAmount * exchangeRate).toLocaleString()} UZS`;
        return {
          kind: GridCellKind.Text,
          data: equiv,
          displayData: equiv,
          allowOverlay: false,
          readonly: true,
          contentAlign: "right",
          themeOverride: {
            textDark: isDark ? "#94a3b8" : "#64748b",
            baseFontStyle: "11px monospace",
          },
        };
      }

      if (col.id === "originType") {
        const label = item.isSelfProduced ? "O'z Seximiz (Bosmaxona)" : "Xitoy (Import)";
        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: item.isSelfProduced
              ? (isDark ? "#c084fc" : "#7e22ce")
              : (isDark ? "#38bdf8" : "#0284c7"),
            baseFontStyle: "600 10px sans-serif",
          },
        };
      }

      return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
    },
    [columns, items, currency, exchangeRate, isDark, status]
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (status === "Posted") return;
      const [colIndex, rowIndex] = cell;
      const col = columns[colIndex];
      if (!col) return;

      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[rowIndex] };

        if (col.id === "quantity") {
          const val = Number(newValue.data) || 0;
          item.quantity = val;
          item.totalAmount = item.quantity * item.unitPrice;
          if (currency === "UZS") {
            item.totalUSD = item.totalAmount / exchangeRate;
          } else {
            item.totalUSD = item.totalAmount;
          }
        } else if (col.id === "unitPrice") {
          const val = Number(newValue.data) || 0;
          item.unitPrice = val;
          item.totalAmount = item.quantity * item.unitPrice;
          if (currency === "UZS") {
            item.unitPriceUZS = val;
            item.unitPriceUSD = val / exchangeRate;
            item.totalUSD = item.totalAmount / exchangeRate;
          } else {
            item.unitPriceUSD = val;
            item.unitPriceUZS = val * exchangeRate;
            item.totalUSD = item.totalAmount;
          }
        }

        next[rowIndex] = item;
        return next;
      });
      setTabUnsaved(tab.id, true);
    },
    [columns, currency, exchangeRate, status, setTabUnsaved, tab.id]
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
          priceUZS: currency === "UZS" ? row.unitPrice : row.unitPrice * exchangeRate,
          stockQty: 50000,
        },
      });
    },
    [items, openTab, currency, exchangeRate]
  );

  const handleRemoveSelectedRows = () => {
    if (status === "Posted") return;
    const selectedRows = gridSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    setItems((prev) => prev.filter((_, idx) => !selectedRows.includes(idx)));
    setGridSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
    setTabUnsaved(tab.id, true);
  };

  const handleQuickAddRow = () => {
    if (status === "Posted") return;
    const newItem: TradingSaleItem = {
      id: `item-${Date.now()}`,
      sku: "ACC-CUSTOM-01",
      name: "Tekstil aksessuari (Yangi partiya)",
      category: "Furnitura",
      unit: "dona",
      quantity: 5000,
      unitPrice: currency === "UZS" ? 1500 : 0.116,
      unitPriceUZS: 1500,
      unitPriceUSD: 0.116,
      totalAmount: currency === "UZS" ? 7_500_000 : 580,
      totalUSD: 580,
    };
    setItems((prev) => [...prev, newItem]);
    setTabUnsaved(tab.id, true);
  };

  const handleAddFromWarehouse = () => {
    if (!selectedCatalogItem) return;
    const basePrice = currency === "UZS" ? selectedCatalogItem.priceUZS : selectedCatalogItem.priceUSD;
    const newItem: TradingSaleItem = {
      id: `item-${Date.now()}`,
      sku: selectedCatalogItem.sku,
      name: selectedCatalogItem.name,
      category: selectedCatalogItem.category,
      unit: selectedCatalogItem.unit,
      quantity: pickerQuantity,
      unitPrice: basePrice,
      unitPriceUZS: selectedCatalogItem.priceUZS,
      unitPriceUSD: selectedCatalogItem.priceUSD,
      totalAmount: pickerQuantity * basePrice,
      totalUSD: currency === "USD" ? pickerQuantity * basePrice : (pickerQuantity * basePrice) / exchangeRate,
      isSelfProduced: selectedCatalogItem.origin.includes("Seximiz"),
    };

    setItems((prev) => [...prev, newItem]);
    setTabUnsaved(tab.id, true);
    setIsWarehousePickerOpen(false);
    setSelectedCatalogItem(null);
    addNotification({
      title: "Ombordan tovar qo'shildi",
      description: `${selectedCatalogItem.sku} (${pickerQuantity.toLocaleString()} ${selectedCatalogItem.unit}) jadvaga kiritildi.`,
      severity: "success",
    });
  };

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Hujjat saqlandi",
      description: `${docNo} qoralama muvaffaqiyatli saqlandi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-sales" },
    });
  };

  const handlePostAndClose = () => {
    if (simulatedPercent > 100 && selectedEntity.legalType === "YTT") {
      alert(
        `Xatolik! Ushbu hujjat ${selectedEntity.name} yillik aylanma limitidan (1 mlrd UZS) oshib ketadi. Boshqa YTT ni tanlang!`
      );
      return;
    }
    setStatus("Posted");
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Sotuv o'tkazildi (Проведено)",
      description: `${docNo} muvaffaqiyatli o'tkazildi. Sotuvchi: ${selectedEntity.name}, Jami: ${totalUZS.toLocaleString()} UZS.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-sales" },
    });
    closeTab(tab.id);
  };

  const filteredCatalogItems = useMemo(() => {
    if (!warehouseSearch.trim()) return INITIAL_TRADING_CATALOG;
    const q = warehouseSearch.toLowerCase();
    return INITIAL_TRADING_CATALOG.filter(
      (c) =>
        c.sku.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [warehouseSearch]);

  const navItems: DocumentNavItem[] = [
    {
      id: "overview",
      label: "Asosiy & Mahsulotlar (Grid)",
      icon: Receipt,
      badge: items.length,
    },
    {
      id: "ytt-analysis",
      label: "YTT Soliq Limiti",
      icon: Scale,
      badge: `${simulatedPercent.toFixed(0)}%`,
      badgeClassName:
        simulatedPercent > 100
          ? "bg-red-100 text-red-800 border-red-300 font-bold"
          : simulatedPercent > 85
          ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
          : "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
    },
    {
      id: "contract-settlement",
      label: "Shartnoma va Saldo",
      icon: Building2,
    },
  ];

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* 1C Standard Document Header */}
        <DocumentHeader
          icon={Receipt}
          title={`Sotuv Hujjati: ${customer}`}
          docNo={docNo}
          date={date}
          status={status === "Posted" ? "Completed" : "Active"}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPrintModalOpen(true)}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
                title="Elektron hisob-faktura va yuk xati (PDF)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chop etish (PDF)</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Saqlash (Записать)</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePostAndClose}
                disabled={status === "Posted"}
                className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-medium shadow-none cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>O&apos;tkazish va yopish</span>
              </Button>
            </>
          }
        />

        {/* Workspace Body: Left DocumentSidebar + Right Main Viewport */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel="Bo'limlar"
            items={navItems}
            activeId={activeTab}
            onSelect={(id) => setLevel3Tab(tab.id, id)}
            summary={
              <SidebarSummaryCard
                icon={Receipt}
                title={docNo}
                subtitle={`${customer}`}
              >
                <InfoRow label="Jami Summa:">
                  <span className="font-mono font-bold text-xs text-primary">
                    {currency === "UZS"
                      ? `${totalUZS.toLocaleString()} UZS`
                      : `$${totalUSD.toFixed(2)} USD`}
                  </span>
                </InfoRow>

                <InfoRow label="Valyuta / Kurs:">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {currency} • 1$ = {exchangeRate.toLocaleString()}
                  </span>
                </InfoRow>

                <InfoRow label="Sotuvchi YTT:">
                  <span className="truncate max-w-[120px] text-[10px]" title={selectedEntity.name}>
                    {selectedEntity.code} ({selectedEntity.turnoverPercent.toFixed(0)}%)
                  </span>
                </InfoRow>

                <InfoRow label="Pozitsiyalar:">
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono">
                    {items.length} ta
                  </Badge>
                </InfoRow>
              </SidebarSummaryCard>
            }
            footer={
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Holat:</span>
                  <Badge
                    variant="outline"
                    className={
                      status === "Posted"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
                        : "bg-amber-50 text-amber-800 border-amber-300"
                    }
                  >
                    {status === "Posted" ? "✓ O'tkazilgan" : "Qoralama"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shartnoma:</span>
                  <span className="font-mono text-[10px] text-foreground">{contractNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">To&apos;lov shakli:</span>
                  <span className="text-[10px] truncate max-w-[120px] text-foreground" title={paymentMethod}>
                    {paymentMethod}
                  </span>
                </div>
              </div>
            }
          />

          {/* Right Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden m-0">
              {/* TOP INDUSTRIAL PARAMETER CARDS (COLLAPSIBLE / HIGH DENSITY) */}
              <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5">
                {/* SMART YTT BANNER */}
                <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Tavsiya YTT: </span>
                      <strong className="text-foreground">YTT Qodirov Baxtiyor</strong>
                      <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-mono h-4 px-1">
                        Bo&apos;sh: 412.5 mln UZS (58.7% band)
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 shrink-0 cursor-pointer"
                    onClick={() => {
                      setSellerEntityId("ytt-qodirov");
                      setTabUnsaved(tab.id, true);
                    }}
                  >
                    Tavsiya bo&apos;yicha belgilash
                  </Button>
                </div>

                {/* 3-COLUMN COMPACT HEADER CONTROLS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  {/* Col 1: Seller */}
                  <div className="p-2 rounded border border-border bg-muted/20 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Sotuvchi (Yuridik Shaxs):</Label>
                    <Select
                      value={sellerEntityId}
                      onValueChange={(val: any) => {
                        setSellerEntityId(val);
                        setTabUnsaved(tab.id, true);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="ytt-qodirov">YTT Qodirov Baxtiyor (58% band) ★</SelectItem>
                        <SelectItem value="ytt-aliyev">YTT Aliyev Jamshid (85% band)</SelectItem>
                        <SelectItem value="ytt-toshmatov">YTT Toshmatov O. (98% band - XAVF)</SelectItem>
                        <SelectItem value="mchj-printgoo">&quot;PRINTGOO SERVICES&quot; MChJ (QQS)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Col 2: Customer */}
                  <div className="p-2 rounded border border-border bg-muted/20 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Xaridor (Tekstil Fabrikasi):</Label>
                    <Select
                      value={customer}
                      onValueChange={(val) => {
                        setCustomer(val || "");
                        if (val === "'REAL TEXTILE INVEST' MChJ") setCustomerTin("304891234");
                        else if (val === "'BUKHARA COTTON WEAVE' XK") setCustomerTin("201889412");
                        else if (val === "'SAMARKAND APPAREL' MChJ") setCustomerTin("308112445");
                        setTabUnsaved(tab.id, true);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="'REAL TEXTILE INVEST' MChJ">&quot;REAL TEXTILE INVEST&quot; MChJ</SelectItem>
                        <SelectItem value="'BUKHARA COTTON WEAVE' XK">&quot;BUKHARA COTTON WEAVE&quot; XK</SelectItem>
                        <SelectItem value="'SAMARKAND APPAREL' MChJ">&quot;SAMARKAND APPAREL&quot; MChJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Col 3: Currency & Rate */}
                  <div className="p-2 rounded border border-border bg-muted/20 flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Valyuta:</Label>
                      <div className="flex rounded border border-input overflow-hidden bg-background p-0.5 mt-0.5 h-7">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrency("UZS");
                            setTabUnsaved(tab.id, true);
                          }}
                          className={`flex-1 rounded text-center font-bold text-[11px] transition-colors cursor-pointer ${
                            currency === "UZS" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                          }`}
                        >
                          UZS
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrency("USD");
                            setTabUnsaved(tab.id, true);
                          }}
                          className={`flex-1 rounded text-center font-bold text-[11px] transition-colors cursor-pointer ${
                            currency === "USD" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                          }`}
                        >
                          USD
                        </button>
                      </div>
                    </div>
                    <div className="w-24">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold">MB Kursi:</Label>
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

              {/* INDUSTRIAL HIGH-DENSITY ACTION TOOLBAR FOR GRID */}
              <div className="px-3 h-9 border-b border-border bg-card shrink-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => setIsWarehousePickerOpen(true)}
                    className="h-7 px-2.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Ombordan qo&apos;shish</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleQuickAddRow}
                    className="h-7 px-2 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Qator qo&apos;shish (Ins)</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveSelectedRows}
                    disabled={gridSelection.rows.length === 0}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>O&apos;chirish (Del)</span>
                  </Button>

                  <Separator orientation="vertical" className="h-4 bg-border mx-1" />

                  <Badge variant="secondary" className="font-mono text-[10px] h-5">
                    {items.length} ta pozitsiya
                  </Badge>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Jami: <strong className="text-foreground">{currency === "UZS" ? `${totalUZS.toLocaleString()} UZS` : `$${totalUSD.toFixed(2)} USD`}</strong>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono hidden md:inline">
                    (Ikkita marta bosing: Katalog kartochkasi)
                  </span>
                </div>
              </div>

              {/* GLIDE DATA GRID WORKSPACE */}
              <div className="flex-1 min-h-0 relative">
                <div className="absolute inset-0">
                  <DataEditor
                    columns={columns}
                    rows={items.length}
                    getCellContent={getCellContent}
                    onCellEdited={handleCellEdited}
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

            {/* TAB 2: YTT LIMIT ANALYSIS */}
            <TabsContent value="ytt-analysis" className="flex-1 overflow-y-auto m-0 p-4 space-y-4">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      YTT Yillik Aylanma Limiti Tahlili (Soliq Xavfsizligi)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      simulatedPercent > 100
                        ? "bg-red-50 text-red-800 border-red-300 font-bold"
                        : simulatedPercent > 85
                        ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                    }
                  >
                    {simulatedPercent > 100
                      ? "⛔ LIMITDAN OSHIB KETADI"
                      : simulatedPercent > 85
                      ? "⚠ Diqqat zonasi (85%+)"
                      : "✓ Xavfsiz kvota"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Tashkilot:</span>
                    <strong className="text-foreground">{selectedEntity.name}</strong>
                    <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">INN: {selectedEntity.inn}</span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Yillik Soliqsiz Limit:</span>
                    <strong className="text-foreground font-mono">
                      {selectedEntity.annualLimit > 10_000_000_000 ? "Cheksiz (MChJ)" : "1,000,000,000 UZS"}
                    </strong>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Amaldagi Yillik Aylanma:</span>
                    <strong className="text-foreground font-mono">
                      {(selectedEntity.currentTurnover / 1_000_000).toFixed(1)} mln UZS ({selectedEntity.turnoverPercent.toFixed(1)}%)
                    </strong>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Ushbu Hujjatdan Keyingi:</span>
                    <strong className="text-primary font-mono">
                      {(simulatedTurnover / 1_000_000).toFixed(1)} mln UZS ({simulatedPercent.toFixed(1)}%)
                    </strong>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Aylanma kvotasi bandligi:</span>
                    <span className="font-mono font-bold text-foreground">{simulatedPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        simulatedPercent > 100
                          ? "bg-destructive"
                          : simulatedPercent > 85
                          ? "bg-amber-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, simulatedPercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: CONTRACT & SETTLEMENT */}
            <TabsContent value="contract-settlement" className="flex-1 overflow-y-auto m-0 p-4 space-y-4">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Shartnoma va O&apos;zaro Hisob-kitob Qoldiqlari
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-muted-foreground">Shartnoma raqami:</Label>
                    <Input
                      value={contractNo}
                      onChange={(e) => {
                        setContractNo(e.target.value);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] text-muted-foreground">Hujjat izohi / Maxsus shartlar:</Label>
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
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* DIALOG: OMBORDAN MAHSULOT QO'SHISH (WAREHOUSE PICKER) */}
      <Dialog open={isWarehousePickerOpen} onOpenChange={setIsWarehousePickerOpen}>
        <DialogContent className="max-w-2xl text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-primary" />
              <span>Ombor Zaxirasidan Mahsulot Qo&apos;shish</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                placeholder="Ombordan qidirish (Artikul, Nomi, Kategoriya)..."
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>

            <div className="max-h-60 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {filteredCatalogItems.map((cat) => {
                const isSelected = selectedCatalogItem?.sku === cat.sku;
                return (
                  <div
                    key={cat.sku}
                    onClick={() => setSelectedCatalogItem(cat)}
                    className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-foreground">{cat.sku}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{cat.category}</Badge>
                      </div>
                      <div className="font-medium text-xs text-foreground mt-0.5">{cat.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        Ombordagi qoldiq: <strong className="text-emerald-600 dark:text-emerald-400">{cat.stockQty.toLocaleString()} {cat.unit}</strong> • Manba: {cat.origin}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-primary">
                        {currency === "UZS" ? `${cat.priceUZS.toLocaleString()} UZS` : `$${cat.priceUSD.toFixed(3)}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {cat.unit} narxi
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCatalogItem && (
              <div className="p-3 bg-muted/30 border border-border rounded-md flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground">Tanlangan:</span>
                  <div className="font-bold text-xs text-foreground">{selectedCatalogItem.sku} — {selectedCatalogItem.name}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground">Miqdor ({selectedCatalogItem.unit}):</Label>
                  <Input
                    type="number"
                    value={pickerQuantity}
                    onChange={(e) => setPickerQuantity(Number(e.target.value) || 0)}
                    className="h-8 w-28 text-right font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsWarehousePickerOpen(false)} className="h-7 text-xs">
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleAddFromWarehouse}
              disabled={!selectedCatalogItem || pickerQuantity <= 0}
              className="h-7 text-xs bg-primary text-primary-foreground font-semibold"
            >
              Hujjatga kiritish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Printable Akt Sverka Dialog */}
      <AktSverkaPrintModal
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        customer={{
          id: "cust-trd",
          name: customer,
          tin: customerTin,
          contractNo: contractNo,
        } as any}
        settlement={clientSettlements[0] || null}
      />
    </div>
  );
}
