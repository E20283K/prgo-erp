"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
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
  Scale,
  Building2,
  Users,
  FileCheck2,
  Sparkles,
  Download,
  Calendar,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { INITIAL_SETTLEMENT_LEDGERS, INITIAL_YTT_ENTITIES } from "./data";

export function TradingSettlementDetail({ tab }: { tab: DocumentTab }) {
  const [selectedEntityId, setSelectedEntityId] = useState<string>("ytt-aliyev");
  const rawData = tab.documentData || {};
  const customerName = rawData.customer || "'REAL TEXTILE INVEST' MChJ";

  const selectedEntity = useMemo(() => {
    return (
      INITIAL_YTT_ENTITIES.find((e) => e.id === selectedEntityId) ||
      INITIAL_YTT_ENTITIES[0]
    );
  }, [selectedEntityId]);

  // Filter ledger strictly by selected legal entity
  const filteredLedger = useMemo(() => {
    return INITIAL_SETTLEMENT_LEDGERS.filter(
      (entry) =>
        entry.customer === customerName &&
        (selectedEntityId === "ytt-aliyev"
          ? entry.sellerEntityName.includes("Aliyev")
          : selectedEntityId === "ytt-qodirov"
          ? entry.sellerEntityName.includes("Qodirov")
          : entry.sellerEntityName.includes("PRINTGOO"))
    );
  }, [customerName, selectedEntityId]);

  const { totalDebit, totalCredit, closingBalance, currency } = useMemo(() => {
    let d = 0;
    let c = 0;
    let curr = selectedEntityId === "mchj-printgoo" ? "USD" : "UZS";
    filteredLedger.forEach((row) => {
      d += row.debit;
      c += row.credit;
    });
    return {
      totalDebit: d,
      totalCredit: c,
      closingBalance: d - c,
      currency: curr,
    };
  }, [filteredLedger, selectedEntityId]);

  const handlePrintPDF = () => {
    alert(
      `Rasmiy Akt-Sverka (PDF) shakllantirildi!\nSotuvchi korxona: ${selectedEntity.name}\nXaridor: ${customerName}\nSaldo: ${closingBalance.toLocaleString()} ${currency}`
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto text-xs font-sans">
      {/* 1C TOOLBAR */}
      <div className="bg-white dark:bg-zinc-900 border-b border-border px-3 py-1.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePrintPDF}
            className="h-7 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Rasmiy Akt-Sverka (PDF chop etish)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert("Excel fayli yuklab olinmoqda...")}
            className="h-7 px-2.5 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excelga eksport</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono">Davr:</span>
          <span className="font-semibold text-foreground">01.10.2026 — 18.10.2026</span>
        </div>
      </div>

      <div className="p-3 space-y-3 max-w-7xl mx-auto w-full">
        {/* CUSTOMER 360 HEADER CARD */}
        <div className="bg-card p-4 rounded-lg border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-xs">
              RT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">{customerName}</h2>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                  Doimiy Mijoz
                </Badge>
              </div>
              <div className="text-muted-foreground text-[11px] flex items-center gap-3 mt-0.5">
                <span>INN: <strong className="text-foreground font-mono">304891234</strong></span>
                <span>•</span>
                <span>Mas'ul: Jasur Rustamov (+998 90 123-45-67)</span>
                <span>•</span>
                <span>Manzil: Farg'ona vil., Quva tumani</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-muted/40 p-2 rounded-lg border border-border text-right">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                Xolding bo'yicha jami umumiy qarz:
              </div>
              <div className="text-xs font-mono font-bold text-foreground">
                14,200,000 UZS + $1,850 USD
              </div>
            </div>
          </div>
        </div>

        {/* ISOLATED RECONCILIATION CONFIGURATION (SAVOLGA ASOSAN) */}
        <div className="bg-card rounded-lg border border-border shadow-xs p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between border-b border-border pb-2.5 gap-2">
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span>O'zaro Hisob-kitob Dalolatnomasi (Akt-Sverka)</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Talabga asosan: Har bir YTT yoki MChJ uchun mutlaqo mustaqil, alohida hisob-kitob yuritiladi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium text-[11px]">Sotuvchi korxonani tanlang:</span>
              <Select
                value={selectedEntityId}
                onValueChange={(val) => setSelectedEntityId(val || "ytt-aliyev")}
              >
                <SelectTrigger className="h-8 w-64 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ytt-aliyev">
                    YTT Aliyev Jamshid (Aksessuarlar)
                  </SelectItem>
                  <SelectItem value="ytt-qodirov">
                    YTT Qodirov Baxtiyor (Aksessuarlar)
                  </SelectItem>
                  <SelectItem value="mchj-printgoo">
                    "PRINTGOO SERVICES" MChJ (Flexo / Jakkard)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Contract Info Banner */}
          <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">
                Shartnoma:{" "}
                <span className="text-blue-700 dark:text-blue-300">
                  {selectedEntityId === "ytt-aliyev"
                    ? "№ AK-2025/11 (Aksessuarlar yetkazib berish)"
                    : selectedEntityId === "ytt-qodirov"
                    ? "№ AK-2026/04 (Aksessuarlar yetkazib berish)"
                    : "№ PRG-2026/18 (Flexo & Jakkard bosma xizmatlari)"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Sotuvchi: <strong>{selectedEntity.name}</strong> (INN: {selectedEntity.inn}) • Xaridor: <strong>{customerName}</strong>
              </div>
            </div>

            <div className="text-right">
              <span className="text-muted-foreground text-[10px] block uppercase font-medium">Ushbu shaxs oldidagi qarz (Saldo):</span>
              <span
                className={`text-sm font-mono font-extrabold ${
                  closingBalance > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {closingBalance > 0
                  ? `${closingBalance.toLocaleString()} ${currency}`
                  : "0 UZS (Qarz yo'q)"}
              </span>
            </div>
          </div>

          {/* LEDGER TABLE */}
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold text-[11px]">
                <tr>
                  <th className="p-2 w-24">Sana</th>
                  <th className="p-2">Hujjat turi va raqami</th>
                  <th className="p-2 w-48">Operatsiya tavsifi</th>
                  <th className="p-2 w-36 text-right">
                    Berilgan Tovar (Debet)
                  </th>
                  <th className="p-2 w-36 text-right">
                    Tushgan To'lov (Kredit)
                  </th>
                  <th className="p-2 w-36 text-right">Qoldiq Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {filteredLedger.length > 0 ? (
                  filteredLedger.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="p-2 text-muted-foreground">{row.date}</td>
                      <td className="p-2 font-sans font-medium text-foreground">
                        {row.docNo} ({row.docType})
                      </td>
                      <td className="p-2 font-sans text-muted-foreground text-[11px]">
                        {row.docType === "Sotuv Hujjati"
                          ? "Aksessuarlar jo'natildi"
                          : row.docType === "Bank To'lovi"
                          ? "Bank orqali to'lov qabul qilindi"
                          : "Boshlang'ich qoldiq"}
                      </td>
                      <td className="p-2 text-right font-bold text-blue-600 dark:text-blue-400">
                        {row.debit > 0 ? `${row.debit.toLocaleString()} ${row.currency}` : "—"}
                      </td>
                      <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {row.credit > 0 ? `${row.credit.toLocaleString()} ${row.currency}` : "—"}
                      </td>
                      <td className="p-2 text-right font-bold text-foreground">
                        {row.balance.toLocaleString()} {row.currency}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground font-sans">
                      Ushbu tashkilot bilan hisob-kitoblar to'liq tenglashgan yoki operatsiyalar mavjud emas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CROSS-SELL RADAR (PrintGoo Bosmaxonasi bilan integratsiya) */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-purple-600 text-white flex items-center justify-center text-sm shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-purple-950 dark:text-purple-100 text-xs">
                Cross-Sell Imkoniyati (PrintGoo Bosmaxona)
              </h4>
              <p className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5">
                Ushbu mijoz ("{customerName}") muntazam aksessuar xarid qilmoqda, lekin <strong>Flexo samokleyka etiketka</strong> yoki <strong>Ofset quti</strong> buyurtma bermagan!
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
            onClick={() => alert("Menejerga vazifa biriktirildi: Bosmaxona xizmatlari bo'yicha tijoriy taklif jo'natish!")}
          >
            Bosmaxona taklifi yaratish
          </Button>
        </div>
      </div>
    </div>
  );
}
