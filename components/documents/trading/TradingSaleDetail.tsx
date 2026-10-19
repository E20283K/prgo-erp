"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "@/components/documents/common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Printer,
  Save,
  Check,
  CheckCheck,
  Plus,
  Trash2,
  Building2,
  Sparkles,
  Scale,
  Users,
  Coins,
  ShieldAlert,
  ShieldCheck,
  Barcode,
  History,
  FileSpreadsheet,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Percent,
} from "lucide-react";
import {
  TradingSaleRecord,
  TradingSaleItem,
  TradingCurrency,
} from "./types";
import { INITIAL_YTT_ENTITIES } from "./data";
import { AktSverkaPrintModal } from "../customer/components/AktSverkaPrintModal";

export function TradingSaleDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, setLevel3Tab, addNotification, clientSettlements } = useWorkspaceStore();
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
            name: "Metall Gravirovka Tugma 18mm (Xitoy import)",
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

  const handleItemChange = (
    index: number,
    field: "quantity" | "unitPrice",
    val: number
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      item[field] = val;
      item.totalAmount = item.quantity * item.unitPrice;
      if (currency === "UZS") {
        item.unitPriceUZS = item.unitPrice;
        item.unitPriceUSD = item.unitPrice / exchangeRate;
        item.totalUSD = item.totalAmount / exchangeRate;
      } else {
        item.unitPriceUSD = item.unitPrice;
        item.unitPriceUZS = item.unitPrice * exchangeRate;
        item.totalUSD = item.totalAmount;
      }
      next[index] = item;
      return next;
    });
    setTabUnsaved(tab.id, true);
  };

  const handleAddItem = () => {
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

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setTabUnsaved(tab.id, true);
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

  const navItems: DocumentNavItem[] = [
    {
      id: "overview",
      label: "Asosiy va Tovarlar",
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
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-background p-4 space-y-4">
            <TabsContent value="overview" className="m-0 space-y-4">
              {/* SMART YTT BANNER */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                      <span>Tizim tavsiyasi: <strong>YTT Qodirov Baxtiyor</strong></span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-mono">
                        Bo&apos;sh kvota: 412,500,000 UZS (58.7% band)
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Ushbu YTT soliqsiz aylanma kvotasi eng ko&apos;p saqlangan. Hujjat ushbu shaxs nomidan chiqsa xavfsizlik ta&apos;minlanadi.
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0 cursor-pointer"
                  onClick={() => {
                    setSellerEntityId("ytt-qodirov");
                    setTabUnsaved(tab.id, true);
                  }}
                >
                  Tavsiya bo&apos;yicha belgilash
                </Button>
              </div>

              {/* 3-CARD HIGH-DENSITY PARAMETER CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. SELLER ENTITY */}
                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span>Sotuvchi (Yuridik Shaxs)</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">Faktura egasi</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">YTT yoki MChJ:</Label>
                    <Select
                      value={sellerEntityId}
                      onValueChange={(val: any) => {
                        setSellerEntityId(val);
                        setTabUnsaved(tab.id, true);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="ytt-qodirov">
                          YTT Qodirov Baxtiyor (INN: 498213002) — [58% band] ★ Tavsiya
                        </SelectItem>
                        <SelectItem value="ytt-aliyev">
                          YTT Aliyev Jamshid (INN: 501982341) — [85% band - Diqqat]
                        </SelectItem>
                        <SelectItem value="ytt-toshmatov">
                          YTT Toshmatov O. (INN: 412890123) — [98% band - XAVF]
                        </SelectItem>
                        <SelectItem value="mchj-printgoo">
                          &quot;PRINTGOO SERVICES&quot; MChJ (QQS to&apos;lovchi)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-2 rounded bg-muted/40 border border-border space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground">Yillik soliqsiz kvota (1.0 mlrd):</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedEntity.legalType === "MChJ"
                          ? "Cheksiz (QQS)"
                          : `${selectedEntity.turnoverPercent.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          selectedEntity.turnoverPercent > 90
                            ? "bg-destructive"
                            : selectedEntity.turnoverPercent > 80
                            ? "bg-amber-500"
                            : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.min(100, selectedEntity.turnoverPercent)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Amaldagi: {(selectedEntity.currentTurnover / 1_000_000).toFixed(1)} mln</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        Qolgan: {((selectedEntity.annualLimit - selectedEntity.currentTurnover) / 1_000_000).toFixed(1)} mln UZS
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. CUSTOMER */}
                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Xaridor (Kontragent)</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-muted/50 font-mono">INN: {customerTin}</Badge>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Tekstil fabrikasi:</Label>
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
                      <SelectTrigger className="h-8 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="'REAL TEXTILE INVEST' MChJ">
                          &quot;REAL TEXTILE INVEST&quot; MChJ (INN: 304891234)
                        </SelectItem>
                        <SelectItem value="'BUKHARA COTTON WEAVE' XK">
                          &quot;BUKHARA COTTON WEAVE&quot; XK (INN: 201889412)
                        </SelectItem>
                        <SelectItem value="'SAMARKAND APPAREL' MChJ">
                          &quot;SAMARKAND APPAREL&quot; MChJ (INN: 308112445)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-2 rounded bg-muted/40 border border-border space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shartnoma:</span>
                      <span className="font-mono text-foreground">{contractNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shu YTT bo&apos;yicha qarz:</span>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {sellerEntityId === "ytt-aliyev"
                          ? "14,200,000 UZS"
                          : sellerEntityId === "mchj-printgoo"
                          ? "$1,850 USD"
                          : "0 UZS"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/60">
                      <span>To&apos;lov intizomi:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Ishonchli (A toifa)</span>
                    </div>
                  </div>
                </div>

                {/* 3. CURRENCY & SETTINGS */}
                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-primary" />
                      <span>Valyuta & Narx Siyosati</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">MB kursi</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Hisob Valyutasi:</Label>
                      <div className="flex rounded-md border border-input overflow-hidden bg-muted/40 p-0.5 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrency("UZS");
                            setTabUnsaved(tab.id, true);
                          }}
                          className={`flex-1 py-1 rounded text-center font-bold text-xs transition-colors cursor-pointer ${
                            currency === "UZS"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
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
                          className={`flex-1 py-1 rounded text-center font-bold text-xs transition-colors cursor-pointer ${
                            currency === "USD"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          USD
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">MB Kursi (1 USD):</Label>
                      <Input
                        type="number"
                        value={exchangeRate}
                        onChange={(e) => {
                          setExchangeRate(Number(e.target.value) || 12850);
                          setTabUnsaved(tab.id, true);
                        }}
                        className="h-8 text-xs font-mono text-right mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Hujjat sanasi:</Label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setTabUnsaved(tab.id, true);
                        }}
                        className="h-7 text-xs font-mono mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">To&apos;lov usuli:</Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={(val: any) => {
                          setPaymentMethod(val);
                          setTabUnsaved(tab.id, true);
                        }}
                      >
                        <SelectTrigger className="h-7 text-[11px] mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="Bank Wire (Hisob-raqam)">Hisob-raqam</SelectItem>
                          <SelectItem value="Corporate Card">Korporativ karta</SelectItem>
                          <SelectItem value="Cash / Cash Register">Naqd / Kassa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ITEMS & ACCESSORIES TABLE */}
              <div className="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                    <Barcode className="w-4 h-4 text-primary" />
                    <span>Aksessuarlar va Furnituralar Jadvali</span>
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 h-5">
                      {items.length} ta pozitsiya
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddItem}
                      className="h-7 px-2.5 text-xs flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>Qator qo&apos;shish (Ins)</span>
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/20 text-muted-foreground border-b border-border font-semibold text-[11px]">
                        <th className="p-2 w-10 text-center">№</th>
                        <th className="p-2 w-32">Artikul</th>
                        <th className="p-2">Nomenklatura nomi</th>
                        <th className="p-2 w-28">Kategoriya</th>
                        <th className="p-2 w-20 text-center">Birlik</th>
                        <th className="p-2 w-28 text-right">Miqdor</th>
                        <th className="p-2 w-32 text-right">Narxi ({currency})</th>
                        <th className="p-2 w-36 text-right">Jami ({currency})</th>
                        <th className="p-2 w-32 text-right text-muted-foreground">
                          Ekvivalent ({currency === "UZS" ? "USD" : "UZS"})
                        </th>
                        <th className="p-2 w-12 text-center">Amal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground font-medium">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2 text-center text-muted-foreground font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-2 font-mono text-[11px] text-muted-foreground">
                            {item.sku}
                          </td>
                          <td className="p-2 font-semibold">
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              {item.isSelfProduced && (
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 font-medium">
                                  O&apos;z Seximiz
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                          </td>
                          <td className="p-2 text-center text-muted-foreground">{item.unit}</td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(idx, "quantity", Number(e.target.value) || 0)
                              }
                              className="h-7 w-24 text-right font-mono text-xs ml-auto"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)
                              }
                              className="h-7 w-28 text-right font-mono text-xs ml-auto"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">
                            {currency === "UZS"
                              ? `${item.totalAmount.toLocaleString()} UZS`
                              : `$${item.totalAmount.toFixed(2)} USD`}
                          </td>
                          <td className="p-2 text-right font-mono text-muted-foreground text-[11px]">
                            {currency === "UZS"
                              ? `$${(item.totalAmount / exchangeRate).toFixed(2)}`
                              : `${(item.totalAmount * exchangeRate).toLocaleString()} UZS`}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* TOTALS & SUMMARY BAR */}
                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between">
                  <div className="text-muted-foreground">
                    Jami tovarlar: <strong className="text-foreground">{items.length} ta</strong>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">Ekvivalent:</div>
                      <div className="text-sm font-mono font-bold text-muted-foreground">
                        {currency === "UZS"
                          ? `$${totalUSD.toFixed(2)} USD`
                          : `${totalUZS.toLocaleString()} UZS`}
                      </div>
                    </div>
                    <div className="text-right border-l border-border pl-4">
                      <div className="text-[11px] text-muted-foreground font-medium">Jami to&apos;lov summasi:</div>
                      <div className="text-lg font-mono font-extrabold text-primary">
                        {currency === "UZS"
                          ? `${totalUZS.toLocaleString()} UZS`
                          : `$${totalUSD.toFixed(2)} USD`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: YTT LIMIT ANALYSIS */}
            <TabsContent value="ytt-analysis" className="m-0 space-y-4">
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
            <TabsContent value="contract-settlement" className="m-0 space-y-4">
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
