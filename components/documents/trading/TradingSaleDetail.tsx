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
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import {
  Printer,
  Save,
  Check,
  Plus,
  Trash2,
  Receipt,
  Warehouse,
  Search,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Building2,
  CreditCard,
  Calendar,
} from "lucide-react";
import {
  TradingSaleRecord,
  TradingSaleItem,
  TradingCurrency,
  TradingCatalogItemRecord,
  TRADING_UNITS,
} from "./types";
import { INITIAL_YTT_ENTITIES, INITIAL_TRADING_CATALOG } from "./data";
import { AktSverkaPrintModal } from "../customer/components/AktSverkaPrintModal";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function TradingSaleDetail({ tab }: { tab: DocumentTab }) {
  const {
    setTabUnsaved,
    closeTab,
    addNotification,
    clientSettlements,
    theme,
    openTab,
    tradingCatalog,
    tradingYttEntities,
    crmCustomers,
    loadCrmCustomers,
    loadTradingData,
    upsertTradingSaleAsync,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const rawData: Partial<TradingSaleRecord> = tab.documentData || {};

  // Load master data on mount if needed
  React.useEffect(() => {
    if (!crmCustomers || crmCustomers.length === 0) {
      loadCrmCustomers();
    }
    if (!tradingYttEntities || tradingYttEntities.length === 0) {
      loadTradingData("ytt-limits");
    }
    if (!tradingCatalog || tradingCatalog.length === 0) {
      loadTradingData("catalog");
    }
  }, [crmCustomers, tradingYttEntities, tradingCatalog, loadCrmCustomers, loadTradingData]);

  // Form State
  const [docNo] = useState<string>(rawData.docNo || tab.id);
  const [date, setDate] = useState<string>(
    rawData.date || new Date().toISOString().split("T")[0]
  );
  const [sellerEntityId, setSellerEntityId] = useState<string>(
    rawData.sellerEntityId || "ytt-qodirov"
  );
  const [customer, setCustomer] = useState<string>(rawData.customer || "");
  const [customerTin, setCustomerTin] = useState<string>(rawData.customerTin || "");
  const [contractNo, setContractNo] = useState<string>(rawData.contractNo || "");
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
  const [notes, setNotes] = useState<string>(rawData.notes || "");

  const availableEntities = useMemo(() => {
    return tradingYttEntities.length > 0 ? tradingYttEntities : INITIAL_YTT_ENTITIES;
  }, [tradingYttEntities]);

  const availableCatalog = useMemo(() => {
    return tradingCatalog.length > 0 ? tradingCatalog : INITIAL_TRADING_CATALOG;
  }, [tradingCatalog]);

  const [items, setItems] = useState<TradingSaleItem[]>(
    rawData.items && rawData.items.length > 0 ? rawData.items : []
  );

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isWarehousePickerOpen, setIsWarehousePickerOpen] = useState(false);
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<TradingCatalogItemRecord | null>(null);
  const [pickerQuantity, setPickerQuantity] = useState<number>(10000);

  // Selected YTT entity calculations
  const selectedEntity = useMemo(() => {
    return (
      availableEntities.find((e) => e.id === sellerEntityId || e.code === sellerEntityId) ||
      availableEntities[0]
    );
  }, [sellerEntityId, availableEntities]);

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
      { id: "originType", title: "Ishlab Chiqarish", width: 150, icon: GridColumnIcon.HeaderLookup },
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
              ? isDark ? "#c084fc" : "#7e22ce"
              : isDark ? "#38bdf8" : "#0284c7",
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

  const handleSave = async () => {
    const payload: Partial<TradingSaleRecord> = {
      id: rawData.id && !rawData.id.startsWith("draft-") ? rawData.id : undefined,
      docNo,
      date,
      sellerEntityId,
      sellerEntityName: selectedEntity.name,
      customer,
      customerTin,
      contractNo,
      currency,
      exchangeRate,
      totalAmount,
      totalUSD,
      totalUZS,
      paymentMethod,
      status: "Draft",
      notes,
      items,
    };
    await upsertTradingSaleAsync(payload);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Hujjat saqlandi",
      description: `${docNo} qoralama bazaga muvaffaqiyatli saqlandi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-sales" },
    });
  };

  const handlePostAndClose = async () => {
    if (simulatedPercent > 100 && selectedEntity.legalType === "YTT") {
      alert(
        `Diqqat! Ushbu hujjat ${selectedEntity.name} yillik aylanma limitidan (1 mlrd UZS) oshib ketadi. Boshqa YTT ni tanlash tavsiya etiladi.`
      );
    }
    const payload: Partial<TradingSaleRecord> = {
      id: rawData.id && !rawData.id.startsWith("draft-") ? rawData.id : undefined,
      docNo,
      date,
      sellerEntityId,
      sellerEntityName: selectedEntity.name,
      customer,
      customerTin,
      contractNo,
      currency,
      exchangeRate,
      totalAmount,
      totalUSD,
      totalUZS,
      paymentMethod,
      status: "Posted",
      notes,
      items,
    };
    await upsertTradingSaleAsync(payload);
    setStatus("Posted");
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Sotuv o'tkazildi (Проведено)",
      description: `${docNo} muvaffaqiyatli o'tkazildi. Ombor zaxirasidan kamaytirildi va YTT aylanmasi yangilandi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-sales" },
    });
    closeTab(tab.id);
  };

  const filteredCatalogItems = useMemo(() => {
    if (!warehouseSearch.trim()) return availableCatalog;
    const q = warehouseSearch.toLowerCase();
    return availableCatalog.filter(
      (c) =>
        c.sku.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [warehouseSearch, availableCatalog]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1C Standard Document Header (Sales Emerald/Blue Style) */}
      <DocumentHeader
        icon={Receipt}
        title={`Sotuv Hujjati (Hisob-faktura / Realizatsiya): ${customer}`}
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
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Chop etish (PDF)</span>
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
              onClick={handlePostAndClose}
              disabled={status === "Posted"}
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>O&apos;tkazish va yopish</span>
            </Button>
          </>
        }
      />

      {/* SINGLE-PAGE INDUSTRIAL VIEW: ALL PARAMETERS AT TOP */}
      <div className="p-3 border-b border-border bg-card shrink-0 space-y-2.5">
        {/* SUMMARY KPI CARDS (SALES SPECIFIC) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Card 1: Jami Hisob-faktura */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Jami Hujjat Summasi:</span>
            <div className="text-sm font-mono font-bold text-foreground">
              {currency === "UZS" ? `${totalAmount.toLocaleString()} UZS` : `$${totalAmount.toFixed(2)}`}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Ekv: {currency === "UZS" ? `$${totalUSD.toFixed(2)} USD` : `${totalUZS.toLocaleString()} UZS`}
            </span>
          </div>

          {/* Card 2: Sotuvchi Yuridik Shaxs */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sotuvchi (INN):</span>
            <div className="text-xs font-semibold text-foreground truncate" title={selectedEntity.name}>
              {selectedEntity.name}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">INN: {selectedEntity.inn} • {selectedEntity.legalType}</span>
          </div>

          {/* Card 3: YTT Soliq Aylanma Limiti */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">YTT Yillik Limiti:</span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 h-3.5 ${
                  simulatedPercent > 100
                    ? "bg-red-50 text-red-700 border-red-300"
                    : simulatedPercent > 85
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                }`}
              >
                {simulatedPercent.toFixed(1)}% band
              </Badge>
            </div>
            <div className="text-xs font-mono font-bold text-foreground">
              {(simulatedTurnover / 1_000_000).toFixed(1)} / 1,000 mln UZS
            </div>
            <span className="text-[10px] text-muted-foreground">
              {simulatedPercent > 100 ? "Limit oshgan! Boshqa YTT tanlang" : "1 mlrd aylanma chegarasida"}
            </span>
          </div>

          {/* Card 4: Hujjat Holati & Shartnoma */}
          <div className="p-2 rounded border border-border bg-muted/20 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Holat & Shartnoma:</span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={
                  status === "Posted"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
                    : "bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                }
              >
                {status === "Posted" ? "✓ O'tkazilgan" : "Qoralama"}
              </Badge>
              <span className="font-mono text-xs text-foreground font-semibold truncate">{contractNo || "—"}</span>
            </div>
            <span className="text-[10px] text-muted-foreground truncate block" title={paymentMethod}>
              {paymentMethod}
            </span>
          </div>
        </div>

        {/* EDITABLE PARAMETERS: 4 COMPACT COLUMNS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {/* Col 1: Seller Selector with Searchable Combobox */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Sotuvchi YTT / MChJ:</Label>
            <div className="mt-0.5">
              <SmartCombobox
                value={sellerEntityId}
                onChange={(val) => {
                  setSellerEntityId(val);
                  setTabUnsaved(tab.id, true);
                }}
                options={availableEntities.map((ent) => ({
                  value: ent.id,
                  label: `${ent.name} (${ent.legalType === "MChJ" ? "MChJ" : `${ent.turnoverPercent.toFixed(1)}% band`})`,
                  description: `${ent.code} • ${ent.legalType} • STIR: ${ent.inn || "—"}`,
                  badge: ent.legalType === "MChJ" ? "MChJ" : `${ent.turnoverPercent.toFixed(0)}%`,
                }))}
                placeholder="Sotuvchini tanlang..."
                searchPlaceholder="Sotuvchini qidirish..."
                allowCustom={false}
                className="h-7 text-xs font-medium"
              />
            </div>
          </div>

          {/* Col 2: Customer with Searchable SmartCombobox */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Xaridor (Tekstil Fabrikasi):</Label>
            <div className="mt-0.5">
              <SmartCombobox
                value={customer}
                onChange={(val) => {
                  setCustomer(val);
                  const found = crmCustomers?.find((c) => c.name.toLowerCase() === val.toLowerCase());
                  if (found) {
                    if (found.tin) setCustomerTin(found.tin);
                    if (found.contractNo) setContractNo(found.contractNo);
                  }
                  setTabUnsaved(tab.id, true);
                }}
                onAddNew={(newVal) => {
                  setCustomer(newVal);
                  setTabUnsaved(tab.id, true);
                }}
                options={(crmCustomers || []).map((c) => ({
                  value: c.name,
                  label: c.name,
                  description: c.tin ? `STIR: ${c.tin}` : c.industry || undefined,
                  badge: c.status,
                }))}
                placeholder="Mijozni tanlang yoki kiriting..."
                searchPlaceholder="Mijoz nomi yoki STIR..."
                allowCustom={true}
                className="h-7 text-xs font-medium"
              />
            </div>
          </div>

          {/* Col 3: Currency & Rate */}
          <div className="flex items-center gap-1.5">
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

          {/* Col 4: Shartnoma & Sana */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Shartnoma №:</Label>
              <Input
                value={contractNo}
                onChange={(e) => {
                  setContractNo(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>
            <div className="w-36">
              <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Sana:</Label>
              <DatePicker
                value={date}
                onChange={(val) => {
                  setDate(val);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 text-xs mt-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* INDUSTRIAL ACTION TOOLBAR FOR REAL-TIME GLIDE DATA GRID */}
      <div className="px-3 h-9 border-b border-border bg-card shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setIsWarehousePickerOpen(true)}
            className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 shadow-xs cursor-pointer"
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

      {/* GLIDE DATA GRID: ENTIRE LOWER VIEWPORT */}
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

      {/* OMBORDAN QO'SHISH MODAL PICKER */}
      <Dialog open={isWarehousePickerOpen} onOpenChange={setIsWarehousePickerOpen}>
        <DialogContent className="max-w-2xl text-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Warehouse className="w-4 h-4 text-emerald-600" />
              <span>Ombordan tovar tanlash va sotuv hujjatiga qo&apos;shish</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Artikul yoki nom bo'yicha qidirish (masalan: Tugma, Molniya, Fermuar)..."
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="max-h-60 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {filteredCatalogItems.map((c) => {
                const isSelected = selectedCatalogItem?.sku === c.sku;
                return (
                  <div
                    key={c.sku}
                    onClick={() => setSelectedCatalogItem(c)}
                    className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">{c.sku}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {c.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">({c.origin})</span>
                      </div>
                      <div className="text-muted-foreground text-[11px]">{c.name}</div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="font-mono font-bold text-foreground">
                        {currency === "UZS" ? `${c.priceUZS.toLocaleString()} UZS` : `$${c.priceUSD.toFixed(3)}`}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        Qoldiq: {c.stockQty.toLocaleString()} {c.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCatalogItem && (
              <div className="p-2.5 rounded-md bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">
                    Tanlandi: {selectedCatalogItem.sku} — {selectedCatalogItem.name}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Ombordagi mavjud qoldiq: {selectedCatalogItem.stockQty.toLocaleString()} {selectedCatalogItem.unit}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">Miqdori:</Label>
                  <Input
                    type="number"
                    value={pickerQuantity}
                    onChange={(e) => setPickerQuantity(Number(e.target.value) || 0)}
                    className="w-24 h-7 text-xs font-mono text-right"
                  />
                  <span className="text-muted-foreground">{selectedCatalogItem.unit}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWarehousePickerOpen(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              disabled={!selectedCatalogItem || pickerQuantity <= 0}
              onClick={handleAddFromWarehouse}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Hujjatga qo&apos;shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Printable Akt Sverka / Invoice Modal */}
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
