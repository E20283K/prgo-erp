"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
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
  FileText,
  Printer,
  Save,
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
  ArrowRight,
  Barcode,
  History,
} from "lucide-react";
import {
  TradingSaleRecord,
  TradingSaleItem,
  TradingCurrency,
} from "./types";
import { INITIAL_YTT_ENTITIES } from "./data";

export function TradingSaleDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab } = useWorkspaceStore();
  const rawData: Partial<TradingSaleRecord> = tab.documentData || {};

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
  const [currency, setCurrency] = useState<TradingCurrency>(
    rawData.currency || "UZS"
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    rawData.exchangeRate || 12850
  );
  const [status, setStatus] = useState<"Draft" | "Posted" | "Cancelled">(
    rawData.status || "Draft"
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
        ]
  );

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

    let tUZS = currency === "UZS" ? tAmount : tAmount * exchangeRate;
    let tUSD = currency === "USD" ? tAmount : tAmount / exchangeRate;

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

  const handlePost = () => {
    if (simulatedPercent > 100 && selectedEntity.legalType === "YTT") {
      alert(
        `Xatolik! Ushbu hujjat ${selectedEntity.name} yillik aylanma limitidan (1 mlrd UZS) oshib ketadi. Boshqa YTT ni tanlang!`
      );
      return;
    }
    setStatus("Posted");
    setTabUnsaved(tab.id, false);
    alert(
      `Hujjat muvaffaqiyatli tasdiqlandi (Проведен)!\nSotuvchi: ${selectedEntity.name}\nJami: ${totalUZS.toLocaleString()} UZS.\nYTT aylanmasi yangilandi.`
    );
  };

  const handlePrint = () => {
    alert(
      `Chop etish: Elektron hisob-faktura va Yuk xati (1C formati) PDF yuklanmoqda...\nSotuvchi: ${selectedEntity.name}\nXaridor: ${customer}`
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto text-xs font-sans">
      {/* 1C ACTION BAR / RIBBON */}
      <div className="bg-white dark:bg-zinc-900 border-b border-border px-3 py-1.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handlePost}
            disabled={status === "Posted"}
            className="h-7 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Tasdiqlash va O'tkazish (Провести)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTabUnsaved(tab.id, false);
              alert("Qoralama muvaffaqiyatli saqlandi!");
            }}
            className="h-7 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Saqlash (Записать)</span>
          </Button>

          <Separator orientation="vertical" className="h-4 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Hisob-faktura & Yuk xati (PDF)</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Tarixi</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={
              status === "Posted"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                : "bg-amber-50 text-amber-800 border-amber-300 font-medium"
            }
          >
            {status === "Posted" ? "✓ Tasdiqlangan (Проведено)" : "Qoralama"}
          </Badge>
          <span className="font-mono text-muted-foreground">
            Hujjat №: <strong className="text-foreground">{docNo}</strong>
          </span>
        </div>
      </div>

      {/* DOCUMENT FORM BODY */}
      <div className="p-3 space-y-3 max-w-7xl mx-auto w-full">
        {/* SMART YTT RECOMMENDATION NOTIFICATION */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-blue-950 dark:text-blue-100 flex items-center gap-2">
                <span>Tizim tavsiyasi: <strong>YTT Qodirov Baxtiyor</strong></span>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-mono">
                  Bo'sh kvota: 412,500,000 UZS (58.7% band)
                </Badge>
              </div>
              <div className="text-[11px] text-blue-700 dark:text-blue-300">
                Ushbu YTT soliqsiz aylanma kvotasi eng ko'p saqlangan. Hujjat ushbu shaxs nomidan chiqsa, xavfsizlik ta'minlanadi.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white dark:bg-zinc-900 border-blue-300 text-blue-700 hover:bg-blue-50 shadow-2xs font-semibold"
            onClick={() => setSellerEntityId("ytt-qodirov")}
          >
            Tavsiya bo'yicha belgilash
          </Button>
        </div>

        {/* 3-COLUMN PARAMETER CONFIGURATION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. SELLER LEGAL ENTITY (YTT / MCHJ) */}
          <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Sotuvchi (Yuridik Shaxs)</span>
              </span>
              <span className="text-[10px] text-muted-foreground">Faktura egasi</span>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">YTT yoki MChJ ni tanlang:</Label>
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
                    "PRINTGOO SERVICES" MChJ (QQS to'lovchi - Flexo/Ofset/Aksessuar)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Turnover Progress Gauge */}
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
                      ? "bg-red-600"
                      : selectedEntity.turnoverPercent > 80
                      ? "bg-amber-500"
                      : "bg-blue-600"
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

          {/* 2. CUSTOMER / BUYER (TEKSTIL KORXONASI) */}
          <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Xaridor (Kontragent)</span>
              </span>
              <Badge variant="outline" className="text-[10px] bg-muted/50">Umumiy Baza</Badge>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tekstil fabrikasi:</Label>
              <Select
                value={customer}
                onValueChange={(val) => {
                  setCustomer(val || "");
                  setTabUnsaved(tab.id, true);
                }}
              >
                <SelectTrigger className="h-8 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="'REAL TEXTILE INVEST' MChJ">
                    "REAL TEXTILE INVEST" MChJ (INN: 304891234)
                  </SelectItem>
                  <SelectItem value="'BUKHARA COTTON WEAVE' XK">
                    "BUKHARA COTTON WEAVE" XK (INN: 201889412)
                  </SelectItem>
                  <SelectItem value="'SAMARKAND APPAREL' MChJ">
                    "SAMARKAND APPAREL" MChJ (INN: 308112445)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Isolated Contract & Debt Info */}
            <div className="p-2 rounded bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shartnoma:</span>
                <span className="font-medium text-foreground">
                  {sellerEntityId === "ytt-qodirov"
                    ? "№ AK-2026/04 (YTT Qodirov nomidan)"
                    : sellerEntityId === "ytt-aliyev"
                    ? "№ AK-2025/11 (YTT Aliyev nomidan)"
                    : sellerEntityId === "ytt-toshmatov"
                    ? "№ AK-2026/09 (YTT Toshmatov nomidan)"
                    : "№ PRG-2026/18 (PRINTGOO MChJ)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aynan shu YTT bo'yicha qarzi:</span>
                <span className="font-mono font-bold text-amber-600">
                  {sellerEntityId === "ytt-aliyev"
                    ? "14,200,000 UZS"
                    : sellerEntityId === "mchj-printgoo"
                    ? "$1,850 USD"
                    : "0 UZS (Qarz yo'q)"}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-indigo-100/50">
                <span>To'lov intizomi:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Ishonchli (A toifa)</span>
              </div>
            </div>
          </div>

          {/* 3. CURRENCY & SETTINGS */}
          <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>Valyuta & Narx Siyosati</span>
              </span>
              <span className="text-[10px] text-muted-foreground">Yagona Katalog</span>
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
                    className={`flex-1 py-1 rounded text-center font-bold text-xs transition-colors ${
                      currency === "UZS"
                        ? "bg-blue-600 text-white shadow-xs"
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
                    className={`flex-1 py-1 rounded text-center font-bold text-xs transition-colors ${
                      currency === "USD"
                        ? "bg-blue-600 text-white shadow-xs"
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

            <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Sana:</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTabUnsaved(tab.id, true);
                }}
                className="h-7 w-32 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* ITEMS & ACCESSORIES TABLE */}
        <div className="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Barcode className="w-4 h-4 text-blue-600" />
              <span>Aksessuarlar va Furnituralar Jadvali</span>
              <span className="text-muted-foreground font-normal text-[11px]">
                ({items.length} ta pozitsiya)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddItem}
                className="h-7 px-2.5 text-xs flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Qator qo'shish (Ins)</span>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/20 text-muted-foreground border-b border-border font-semibold text-[11px]">
                  <th className="p-2 w-10 text-center">№</th>
                  <th className="p-2 w-32">Artikul</th>
                  <th className="p-2">Nomenklatura nomi</th>
                  <th className="p-2 w-28">Kategoriya</th>
                  <th className="p-2 w-20 text-center">Birlik</th>
                  <th className="p-2 w-28 text-right">Miqdor</th>
                  <th className="p-2 w-32 text-right">
                    Narxi ({currency})
                  </th>
                  <th className="p-2 w-36 text-right">
                    Jami ({currency})
                  </th>
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
                    <td className="p-2 font-semibold flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.isSelfProduced && (
                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-300 font-bold">
                          O'z Seximiz (Bosmaxona)
                        </Badge>
                      )}
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
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                <div className="text-[11px] text-muted-foreground font-medium">Jami to'lov summasi:</div>
                <div className="text-lg font-mono font-extrabold text-blue-600 dark:text-blue-400">
                  {currency === "UZS"
                    ? `${totalUZS.toLocaleString()} UZS`
                    : `$${totalUSD.toFixed(2)} USD`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* YTT LIMIT IMPACT SIMULATOR BAR */}
        <div
          className={`p-3 rounded-lg border flex items-center justify-between ${
            simulatedPercent > 100 && selectedEntity.legalType === "YTT"
              ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
              : simulatedPercent > 85 && selectedEntity.legalType === "YTT"
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {simulatedPercent > 100 && selectedEntity.legalType === "YTT" ? (
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <div>
              <span className="font-bold text-foreground text-xs">
                Limit tahlili ({selectedEntity.name}):
              </span>{" "}
              <span className="text-muted-foreground text-xs">
                Ushbu hujjat tasdiqlangach, aylanma{" "}
                <strong className="text-foreground">
                  {(selectedEntity.currentTurnover / 1_000_000).toFixed(1)} mln
                </strong>{" "}
                dan{" "}
                <strong className="text-foreground">
                  {(simulatedTurnover / 1_000_000).toFixed(1)} mln UZS
                </strong>{" "}
                ga yetadi ({simulatedPercent.toFixed(1)}%).
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={
              simulatedPercent > 100 && selectedEntity.legalType === "YTT"
                ? "bg-red-100 text-red-800 border-red-300 font-bold"
                : simulatedPercent > 85 && selectedEntity.legalType === "YTT"
                ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                : "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
            }
          >
            {simulatedPercent > 100 && selectedEntity.legalType === "YTT"
              ? "⛔ LIMITDAN OSHIB KETADI"
              : simulatedPercent > 85 && selectedEntity.legalType === "YTT"
              ? "⚠ Diqqat zonasi (85%+)"
              : "✓ Xavfsiz kvota"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
