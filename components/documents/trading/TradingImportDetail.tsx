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
  Ship,
  Printer,
  Save,
  Check,
  Plus,
  Trash2,
  Building2,
  Scale,
  Calculator,
  Boxes,
  Paperclip,
  Truck,
  ExternalLink,
  Download,
} from "lucide-react";
import { TradingImportBatchRecord, ImportBatchItem } from "./types";
import { INITIAL_IMPORT_BATCHES } from "./data";

export function TradingImportDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, setLevel3Tab, addNotification } = useWorkspaceStore();
  const rawData: Partial<TradingImportBatchRecord> = tab.documentData || {};

  const activeTab = tab.activeLevel3Tab || "costing";

  // Form State
  const [batchNo] = useState<string>(rawData.batchNo || tab.id);
  const [date, setDate] = useState<string>(
    rawData.date || new Date().toISOString().split("T")[0]
  );
  const [origin, setOrigin] = useState<"Guangzhou, Xitoy" | "Yiwu, Xitoy" | "Shanghai, Xitoy">(
    rawData.origin || "Guangzhou, Xitoy"
  );
  const [supplier, setSupplier] = useState<string>(
    rawData.supplier || "Yiwu Accessories Industrial Group Ltd"
  );
  const [containerNo, setContainerNo] = useState<string>(
    rawData.containerNo || "TGHU-992140"
  );
  const [status, setStatus] = useState<
    "In Transit" | "Customs Clearance" | "Arrived & Calculated" | "Allocated to Stock"
  >(rawData.status || "Arrived & Calculated");
  const [exchangeRate, setExchangeRate] = useState<number>(
    rawData.exchangeRate || 12850
  );

  // Financial components for Landed Cost
  const [fobAmountUSD, setFobAmountUSD] = useState<number>(rawData.fobAmountUSD || 14500);
  const [internationalCargoUSD, setInternationalCargoUSD] = useState<number>(
    rawData.internationalCargoUSD || 2850
  );
  const [customsDutyUZS, setCustomsDutyUZS] = useState<number>(
    rawData.customsDutyUZS || 21400000
  );
  const [grossWeightKg, setGrossWeightKg] = useState<number>(
    rawData.grossWeightKg || 1840
  );
  const [notes, setNotes] = useState<string>(
    rawData.notes || "Qishki mavsum uchun 1-katta partiya. Bojxona to'liq rasmiylashtirildi."
  );

  const [items, setItems] = useState<ImportBatchItem[]>(
    rawData.items && rawData.items.length > 0
      ? rawData.items
      : [
          {
            id: "imp-item-1",
            sku: "BTN-MET-18MM",
            name: "Metall Gravirovka Tugma 18mm",
            category: "Tugmalar",
            unit: "dona",
            quantity: 100000,
            fobPriceUSD: 0.025,
            fobTotalUSD: 2500,
            landedCostUZS: 405,
            suggestedSalePriceUZS: 480,
          },
          {
            id: "imp-item-2",
            sku: "ZIP-NYL-N5-45",
            name: "Neylon Fermuar (Molniya) N5, 45sm, Qora",
            category: "Fermuarlar",
            unit: "dona",
            quantity: 30000,
            fobPriceUSD: 0.18,
            fobTotalUSD: 5400,
            landedCostUZS: 2750,
            suggestedSalePriceUZS: 3200,
          },
        ]
  );

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

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Partiya saqlandi",
      description: `${batchNo} import partiyasi ma'lumotlari saqlandi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-imports" },
    });
  };

  const handleAllocateToStock = () => {
    setStatus("Allocated to Stock");
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Omborga kirim qilindi",
      description: `${batchNo} partiyasidagi ${items.length} ta pozitsiya markaziy ombor zaxirasiga kirim qilindi.`,
      severity: "success",
      link: { module: "trading", subModule: "trading-catalog" },
    });
    closeTab(tab.id);
  };

  const navItems: DocumentNavItem[] = [
    {
      id: "costing",
      label: "Tannarx (Landed Cost)",
      icon: Calculator,
    },
    {
      id: "items",
      label: "Partiya Tarkibi (Tovarlar)",
      icon: Boxes,
      badge: items.length,
    },
    {
      id: "logistics",
      label: "Logistika & Bojxona",
      icon: Ship,
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

        {/* Workspace Body */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <DocumentSidebar
            sectionsLabel="Bo'limlar"
            items={navItems}
            activeId={activeTab}
            onSelect={(id) => setLevel3Tab(tab.id, id)}
            summary={
              <SidebarSummaryCard
                icon={Ship}
                title={batchNo}
                subtitle={origin}
              >
                <InfoRow label="Jami Tannarx:">
                  <span className="font-mono font-bold text-xs text-primary">
                    {(grandLandedCostUZS / 1_000_000).toFixed(1)} mln UZS
                  </span>
                </InfoRow>

                <InfoRow label="FOB Xarid ($):">
                  <span className="font-mono text-xs">
                    ${fobAmountUSD.toLocaleString()}
                  </span>
                </InfoRow>

                <InfoRow label="Landed Ustama:">
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-300">
                    +{landedMarkupPercent.toFixed(1)}%
                  </Badge>
                </InfoRow>

                <InfoRow label="Pozitsiyalar:">
                  <span className="font-mono text-xs">{items.length} ta tovar</span>
                </InfoRow>
              </SidebarSummaryCard>
            }
            footer={
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Konteyner:</span>
                  <span className="font-mono text-[10px] font-semibold text-foreground">{containerNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Brutto og'irlik:</span>
                  <span className="font-mono text-[10px] text-foreground">{grossWeightKg} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Holat:</span>
                  <Badge variant="secondary" className="text-[9px]">{status}</Badge>
                </div>
              </div>
            }
          />

          {/* Right Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-background p-4 space-y-4">
            {/* TAB 1: LANDED COST & FINANCIALS */}
            <TabsContent value="costing" className="m-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">FOB Xarid (Xitoy zavodi):</span>
                  <strong className="text-base font-mono block text-foreground">${fobAmountUSD.toLocaleString()}</strong>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(totalFobUZS / 1_000_000).toFixed(1)} mln UZS
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Xalqaro Kargo / Fura:</span>
                  <strong className="text-base font-mono block text-blue-600 dark:text-blue-400">${internationalCargoUSD.toLocaleString()}</strong>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(totalCargoUZS / 1_000_000).toFixed(1)} mln UZS
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Bojxona To'lovlari (UZS):</span>
                  <strong className="text-base font-mono block text-amber-600 dark:text-amber-400">
                    {(customsDutyUZS / 1_000_000).toFixed(1)} mln UZS
                  </strong>
                  <span className="text-[10px] text-muted-foreground">Bojxona deklaratsiyasi</span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-2xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Toshkent Omboridagi Tannarx:</span>
                  <strong className="text-base font-mono block text-primary">
                    {(grandLandedCostUZS / 1_000_000).toFixed(1)} mln UZS
                  </strong>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    +{landedMarkupPercent.toFixed(1)}% umumiy ustama
                  </span>
                </div>
              </div>

              {/* PARAMETER CONFIGURATION CARD */}
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Xarajatlarni Ta&apos;qsimlash va Valyuta Kursi Parametrlari
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">FOB Summa ($):</Label>
                    <Input
                      type="number"
                      value={fobAmountUSD}
                      onChange={(e) => {
                        setFobAmountUSD(Number(e.target.value) || 0);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Xalqaro Transport ($):</Label>
                    <Input
                      type="number"
                      value={internationalCargoUSD}
                      onChange={(e) => {
                        setInternationalCargoUSD(Number(e.target.value) || 0);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Bojxona (UZS):</Label>
                    <Input
                      type="number"
                      value={customsDutyUZS}
                      onChange={(e) => {
                        setCustomsDutyUZS(Number(e.target.value) || 0);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono mt-1"
                    />
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
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: ITEMS */}
            <TabsContent value="items" className="m-0 space-y-4">
              <div className="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                    <Boxes className="w-4 h-4 text-primary" />
                    <span>Partiyadagi Tovarlar va Landed Tannarx Taqsimoti</span>
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 h-5">
                      {items.length} ta tovar
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/20 text-muted-foreground border-b border-border font-semibold text-[11px]">
                        <th className="p-2 w-10 text-center">№</th>
                        <th className="p-2 w-32">Artikul</th>
                        <th className="p-2">Mahsulot Nomi</th>
                        <th className="p-2 w-28">Kategoriya</th>
                        <th className="p-2 w-20 text-center">Birlik</th>
                        <th className="p-2 w-28 text-right">Miqdor</th>
                        <th className="p-2 w-28 text-right">FOB Narx ($)</th>
                        <th className="p-2 w-32 text-right">Landed Tannarx (UZS)</th>
                        <th className="p-2 w-32 text-right">Tavsiya Sotuv (UZS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground font-medium">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="p-2 font-mono text-muted-foreground text-[11px]">{item.sku}</td>
                          <td className="p-2 font-semibold">{item.name}</td>
                          <td className="p-2">
                            <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                          </td>
                          <td className="p-2 text-center text-muted-foreground">{item.unit}</td>
                          <td className="p-2 text-right font-mono">{item.quantity.toLocaleString()}</td>
                          <td className="p-2 text-right font-mono text-muted-foreground">${item.fobPriceUSD.toFixed(3)}</td>
                          <td className="p-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {item.landedCostUZS.toLocaleString()} UZS
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.suggestedSalePriceUZS.toLocaleString()} UZS
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: LOGISTICS */}
            <TabsContent value="logistics" className="m-0 space-y-4">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Transport, Marshrut va Bojxona Hujjatlari
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Konteyner / Fura raqami:</Label>
                    <Input
                      value={containerNo}
                      onChange={(e) => {
                        setContainerNo(e.target.value);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Xitoy Yetkazib Beruvchi (Zavod):</Label>
                    <Input
                      value={supplier}
                      onChange={(e) => {
                        setSupplier(e.target.value);
                        setTabUnsaved(tab.id, true);
                      }}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Jo&apos;natilgan port / shahar:</Label>
                    <Select
                      value={origin}
                      onValueChange={(val: any) => {
                        setOrigin(val);
                        setTabUnsaved(tab.id, true);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="Guangzhou, Xitoy">Guangzhou, Xitoy</SelectItem>
                        <SelectItem value="Yiwu, Xitoy">Yiwu, Xitoy</SelectItem>
                        <SelectItem value="Shanghai, Xitoy">Shanghai, Xitoy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <Label className="text-[11px] text-muted-foreground">Partiya bo&apos;yicha eslatma va deklaratsiya izohlari:</Label>
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
