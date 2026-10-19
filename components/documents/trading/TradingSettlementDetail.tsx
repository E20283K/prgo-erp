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
  Scale,
  Printer,
  Download,
  Building2,
  Users,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { INITIAL_SETTLEMENT_LEDGERS, INITIAL_YTT_ENTITIES } from "./data";
import { AktSverkaPrintModal } from "../customer/components/AktSverkaPrintModal";

export function TradingSettlementDetail({ tab }: { tab: DocumentTab }) {
  const { setLevel3Tab, clientSettlements, addNotification } = useWorkspaceStore();
  const rawData = tab.documentData || {};
  const customerName = rawData.customer || "'REAL TEXTILE INVEST' MChJ";
  const [selectedEntityId, setSelectedEntityId] = useState<string>("ytt-aliyev");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const activeTab = tab.activeLevel3Tab || "ledger";

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
    const curr = selectedEntityId === "mchj-printgoo" ? "USD" : "UZS";
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

  const navItems: DocumentNavItem[] = [
    {
      id: "ledger",
      label: "O'zaro Hisob-kitob (Ledger)",
      icon: Scale,
      badge: filteredLedger.length,
    },
    {
      id: "cross-sell",
      label: "Cross-Sell Radar",
      icon: Sparkles,
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
          icon={Scale}
          title={`Akt-Sverka: ${customerName}`}
          docNo={`STL-${selectedEntity.code}`}
          date="01.10.2026 — 18.10.2026"
          status={closingBalance > 0 ? "Active" : "Completed"}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPrintModalOpen(true)}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
                title="Akt-Sverka rasmiy PDF shakli"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chop etish (PDF)</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  addNotification({
                    title: "Excel eksport",
                    description: `${customerName} akt-sverkasi yuklab olinmoqda.`,
                    severity: "info",
                  });
                }}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Excel</span>
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
                icon={Building2}
                title={customerName}
                subtitle="Tekstil Kontragent"
              >
                <InfoRow label="Sotuvchi:">
                  <span className="truncate max-w-[120px] text-[10px]" title={selectedEntity.name}>
                    {selectedEntity.name}
                  </span>
                </InfoRow>

                <InfoRow label="Joriy Saldo:">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span
                      className={`font-mono font-bold text-xs ${
                        closingBalance > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {closingBalance > 0
                        ? `${closingBalance.toLocaleString()} ${currency}`
                        : "0 (Qarz yo'q)"}
                    </span>
                  </div>
                </InfoRow>

                <InfoRow label="Operatsiyalar:">
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono">
                    {filteredLedger.length} ta
                  </Badge>
                </InfoRow>
              </SidebarSummaryCard>
            }
            footer={
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Davr:</span>
                  <span className="font-mono text-[10px]">Oktabr 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Umumiy Qarz:</span>
                  <span className="font-mono text-[10px] text-foreground font-semibold">
                    14.2M UZS + $1.8K
                  </span>
                </div>
              </div>
            }
          />

          {/* Right Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-background p-4 space-y-4">
            <TabsContent value="ledger" className="m-0 space-y-4">
              {/* SELLER SELECTOR CARD */}
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      Sotuvchi Yuridik Shaxsni Tanlang:
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Har bir YTT yoki MChJ bo&apos;yicha alohida, mustaqil akt-sverka yuritiladi.
                  </p>
                </div>

                <div className="w-full sm:w-72">
                  <Select
                    value={selectedEntityId}
                    onValueChange={(val) => setSelectedEntityId(val || "ytt-aliyev")}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold">
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
                        &quot;PRINTGOO SERVICES&quot; MChJ (Flexo / Jakkard)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ACTIVE CONTRACT AND BALANCE OVERVIEW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Amaldagi Shartnoma:</span>
                  <strong className="text-foreground text-xs block">
                    {selectedEntityId === "ytt-aliyev"
                      ? "№ AK-2025/11 (Aksessuarlar)"
                      : selectedEntityId === "ytt-qodirov"
                      ? "№ AK-2026/04 (Aksessuarlar)"
                      : "№ PRG-2026/18 (Flexo & Jakkard)"}
                  </strong>
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    Sotuvchi INN: {selectedEntity.inn}
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Berilgan Tovar (Debet):</span>
                  <strong className="text-primary text-sm font-mono block">
                    {totalDebit > 0 ? `${totalDebit.toLocaleString()} ${currency}` : "0"}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">Yuk xatlari bo&apos;yicha</span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Ushbu shaxs oldidagi qarz (Saldo):</span>
                  <strong
                    className={`text-sm font-mono block ${
                      closingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {closingBalance > 0
                      ? `${closingBalance.toLocaleString()} ${currency}`
                      : "0 (Qarz yo'q)"}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">Oxirgi holat bo&apos;yicha</span>
                </div>
              </div>

              {/* LEDGER TABLE */}
              <div className="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                    <Scale className="w-4 h-4 text-primary" />
                    <span>Operatsiyalar va Hujjatlar Reestri</span>
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 h-5">
                      {filteredLedger.length} ta yozuv
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/20 text-muted-foreground border-b border-border font-semibold text-[11px]">
                        <th className="p-2 w-24">Sana</th>
                        <th className="p-2">Hujjat turi va raqami</th>
                        <th className="p-2 w-48">Operatsiya tavsifi</th>
                        <th className="p-2 w-36 text-right">Berilgan Tovar (Debet)</th>
                        <th className="p-2 w-36 text-right">Tushgan To&apos;lov (Kredit)</th>
                        <th className="p-2 w-36 text-right">Qoldiq Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-foreground font-medium">
                      {filteredLedger.length > 0 ? (
                        filteredLedger.map((row) => (
                          <tr key={row.id} className="hover:bg-muted/30 transition-colors">
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
                            <td className="p-2 text-right font-bold text-primary">
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
                            Ushbu tashkilot bilan hisob-kitoblar to&apos;liq tenglashgan yoki operatsiyalar mavjud emas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CROSS SELL */}
            <TabsContent value="cross-sell" className="m-0 space-y-4">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Cross-Sell Imkoniyati (PrintGoo Bosmaxonasi bilan integratsiya)
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Ushbu mijoz (&quot;{customerName}&quot;) muntazam aksessuar va furnitura xarid qilmoqda, lekin <strong>Flexo samokleyka etiketka</strong> yoki <strong>Ofset quti</strong> poligrafiya buyurtmalarini bermagan.
                </p>

                <div className="pt-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-primary text-primary-foreground font-medium cursor-pointer"
                    onClick={() => {
                      addNotification({
                        title: "Menejerga topshiriq biriktirildi",
                        description: `${customerName} uchun bosmaxona xizmatlari bo'yicha tijoriy taklif shakllantirish topshirig'i yaratildi.`,
                        severity: "success",
                      });
                    }}
                  >
                    Bosmaxona taklifi yaratish
                  </Button>
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
          id: "cust-trd-stl",
          name: customerName,
          tin: "304891234",
          contractNo: "AK-2026/04",
        } as any}
        settlement={clientSettlements[0] || null}
      />
    </div>
  );
}
