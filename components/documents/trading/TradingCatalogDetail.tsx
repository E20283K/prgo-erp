"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { TradingCatalogItemRecord } from "./types";
import { INITIAL_TRADING_CATALOG } from "./data";

export function TradingCatalogDetail({ tab }: { tab: DocumentTab }) {
  const { setTabUnsaved, closeTab, setLevel3Tab, addNotification, openTab } = useWorkspaceStore();
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
  const [material, setMaterial] = useState<string>(rawData.material || "Metall qotishma");
  const [colorCode, setColorCode] = useState<string>(rawData.colorCode || "Antik bronza");
  const [dimensions, setDimensions] = useState<string>(rawData.dimensions || "18mm diametr");
  const [supplier, setSupplier] = useState<string>(
    rawData.supplier || "Yiwu Accessories Industrial Group Ltd"
  );
  const [notes, setNotes] = useState<string>(
    rawData.notes || "Tekstil fabrikalari uchun standart furnitura."
  );

  const priceUSD = priceUZS / exchangeRate;

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
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-background p-4 space-y-4">
            {/* TAB 1: PRICING */}
            <TabsContent value="pricing" className="m-0 space-y-4">
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

            {/* TAB 2: STOCK */}
            <TabsContent value="stock" className="m-0 space-y-4">
              <div className="bg-card p-4 rounded-lg border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Warehouse className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs text-foreground">
                    Ombor Qoldig&apos;i va Minimal Chegara Nazorati
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Amaldagi Zaxira Qoldig&apos;i:</span>
                    <strong className="text-lg font-mono text-emerald-600 dark:text-emerald-400 block mt-1">
                      {stockQty.toLocaleString()} {unit}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">Asosiy Toshkent Omborida</span>
                  </div>

                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Minimal Xavfsiz Chegara:</span>
                    <strong className="text-lg font-mono text-foreground block mt-1">
                      {minStockLevel.toLocaleString()} {unit}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">Tugashidan oldin Xitoyga buyurtirish uchun</span>
                  </div>

                  <div className="p-3 rounded-md bg-muted/40 border border-border">
                    <span className="text-[11px] text-muted-foreground block">Yetkazib Berish Manbasi:</span>
                    <strong className="text-xs font-sans text-foreground block mt-1">
                      {origin}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">Ishlab chiqaruvchi zavod</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: SPECS */}
            <TabsContent value="specs" className="m-0 space-y-4">
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
