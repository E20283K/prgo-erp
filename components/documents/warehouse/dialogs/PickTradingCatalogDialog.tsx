"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tag,
  Search,
  ShoppingBag,
  ArrowRight,
  Package,
  Plus,
  Check,
  FileText,
  AlertCircle,
  Boxes,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { TradingCatalogItemRecord, TradingSaleRecord } from "@/components/documents/trading/types";

interface PickTradingCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerCustomer: string;
  onSelectItems: (
    items: Array<{
      tradingCatalogId?: string;
      sku: string;
      name: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
      accountCode: "2910";
      notes?: string;
    }>,
    linkedSaleId?: string
  ) => void;
}

export function PickTradingCatalogDialog({
  open,
  onOpenChange,
  buyerCustomer,
  onSelectItems,
}: PickTradingCatalogDialogProps) {
  const {
    tradingCatalog = [],
    tradingSales = [],
    loadTradingData,
  } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<"catalog" | "packages">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Barchasi");

  // Selected items from direct catalog: sku -> quantity to pick
  const [pickedCatalogQuantities, setPickedCatalogQuantities] = useState<Record<string, number>>({});
  const [selectedSale, setSelectedSale] = useState<TradingSaleRecord | null>(null);

  useEffect(() => {
    if (open) {
      if (tradingCatalog.length === 0) {
        loadTradingData("catalog");
      }
      if (tradingSales.length === 0) {
        loadTradingData("sales");
      }
      setPickedCatalogQuantities({});
      setSelectedSale(null);
    }
  }, [open, loadTradingData, tradingCatalog.length, tradingSales.length]);

  // Catalog filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    tradingCatalog.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return ["Barchasi", ...Array.from(set)];
  }, [tradingCatalog]);

  const filteredCatalog = useMemo(() => {
    let list = tradingCatalog || [];
    if (selectedCategory !== "Barchasi") {
      list = list.filter((c) => c.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.sku.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.material && c.material.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tradingCatalog, selectedCategory, searchQuery]);

  // Pre-packaged TRD sales matching customer
  const relevantSales = useMemo(() => {
    const list = tradingSales || [];
    if (!buyerCustomer?.trim()) return list;
    const q = buyerCustomer.toLowerCase().trim();
    const matched = list.filter((s) => s.customer?.toLowerCase().includes(q));
    return matched.length > 0 ? matched : list;
  }, [tradingSales, buyerCustomer]);

  useEffect(() => {
    if (relevantSales.length > 0 && !selectedSale) {
      setSelectedSale(relevantSales[0]);
    }
  }, [relevantSales, selectedSale]);

  const toggleCatalogItem = (item: TradingCatalogItemRecord) => {
    setPickedCatalogQuantities((prev) => {
      const next = { ...prev };
      if (next[item.sku] !== undefined) {
        delete next[item.sku];
      } else {
        next[item.sku] = 100; // default initial pick quantity
      }
      return next;
    });
  };

  const updateCatalogQuantity = (sku: string, val: number) => {
    setPickedCatalogQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, val),
    }));
  };

  const selectedCount = Object.keys(pickedCatalogQuantities).length;
  const selectedTotalSum = useMemo(() => {
    let sum = 0;
    Object.entries(pickedCatalogQuantities).forEach(([sku, qty]) => {
      const it = tradingCatalog.find((c) => c.sku === sku);
      if (it) {
        const price = it.priceUZS || it.wholesalePriceUZS || 0;
        sum += price * qty;
      }
    });
    return sum;
  }, [pickedCatalogQuantities, tradingCatalog]);

  const handleAddCatalogItems = () => {
    const mapped = Object.entries(pickedCatalogQuantities).map(([sku, qty]) => {
      const it = tradingCatalog.find((c) => c.sku === sku);
      const price = it?.priceUZS || it?.wholesalePriceUZS || 0;
      return {
        tradingCatalogId: it?.id || sku,
        sku,
        name: it?.name || sku,
        quantity: qty,
        unit: it?.unit || "dona",
        unitPrice: price,
        totalPrice: qty * price,
        accountCode: "2910" as const,
        notes: `2910 Aksessuarlar katalogidan yuklandi`,
      };
    });

    if (mapped.length > 0) {
      onSelectItems(mapped);
      onOpenChange(false);
    }
  };

  const handleImportSale = (sale: TradingSaleRecord) => {
    if (!sale.items || sale.items.length === 0) return;

    const mapped = sale.items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPriceUZS || it.unitPrice) || 0;
      return {
        tradingCatalogId: it.sku,
        sku: it.sku,
        name: it.name,
        quantity: qty,
        unit: it.unit || "dona",
        unitPrice: price,
        totalPrice: qty * price,
        accountCode: "2910" as const,
        notes: `Savdo hujjati ${sale.docNo} dan yuklandi`,
      };
    });

    onSelectItems(mapped, sale.docNo || sale.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 border border-border bg-card overflow-hidden">
        <DialogHeader className="px-4 py-2.5 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Tag className="size-4 text-blue-600" />
            <span>Aksessuarlar ombori (2910)</span>
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground bg-background">
              Hisob 2910
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col h-[520px]">
          {/* Tab Selection Bar */}
          <div className="px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
            <TabsList className="h-7 bg-muted/60 p-0.5">
              <TabsTrigger value="catalog" className="text-xs h-6 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Boxes className="size-3.5" />
                <span>Katalogdan tanlash ({tradingCatalog.length})</span>
              </TabsTrigger>
              <TabsTrigger value="packages" className="text-xs h-6 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Package className="size-3.5" />
                <span>Tayyor qutilar ({relevantSales.length})</span>
              </TabsTrigger>
            </TabsList>

            <span className="text-[11px] text-muted-foreground">
              Mijoz: <b className="text-foreground">{buyerCustomer || "Tanlanmagan"}</b>
            </span>
          </div>

          {/* TAB 1: Direct Catalog Selection */}
          <TabsContent value="catalog" className="flex-1 min-h-0 flex flex-col m-0 p-0 data-[state=inactive]:hidden">
            {/* Filter & Search Bar */}
            <div className="p-2.5 border-b border-border bg-muted/5 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Artikul yoki nom bo'yicha qidirish..."
                  className="h-7 text-xs pl-8 bg-background"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`h-6 px-2 rounded text-[11px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? "bg-blue-600 text-white"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Items Table */}
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <TableRow className="h-7 text-[10px]">
                    <TableHead className="w-10 text-center"></TableHead>
                    <TableHead className="font-semibold">Artikul / Kategoriya</TableHead>
                    <TableHead className="font-semibold">Mahsulot nomi</TableHead>
                    <TableHead className="text-right font-semibold">Omborda</TableHead>
                    <TableHead className="text-right font-semibold">Narx (so&apos;m)</TableHead>
                    <TableHead className="w-32 text-center font-semibold">Jo&apos;natish miqdori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCatalog.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-xs text-muted-foreground">
                        Aksessuarlar katalogida mos tovar topilmadi.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isPicked = pickedCatalogQuantities[item.sku] !== undefined;
                      const currentQty = pickedCatalogQuantities[item.sku] ?? 100;
                      const inStock = item.stockQty || 0;

                      return (
                        <TableRow
                          key={item.id || item.sku}
                          className={`h-8 text-xs cursor-pointer ${
                            isPicked ? "bg-blue-500/5 hover:bg-blue-500/10" : "hover:bg-muted/40"
                          }`}
                          onClick={() => toggleCatalogItem(item)}
                        >
                          <TableCell className="text-center py-1" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isPicked}
                              onCheckedChange={() => toggleCatalogItem(item)}
                              className="size-3.5"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <span className="font-mono font-bold text-foreground">{item.sku}</span>
                            <span className="text-[10px] text-muted-foreground block">{item.category}</span>
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="font-medium text-foreground truncate max-w-[260px]">{item.name}</div>
                            {item.material && <span className="text-[10px] text-muted-foreground">{item.material}</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono py-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1 py-0 h-4 font-mono ${
                                inStock > 0
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                              }`}
                            >
                              {inStock.toLocaleString()} {item.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono py-1">
                            {(item.priceUZS || item.wholesalePriceUZS || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-1 text-center" onClick={(e) => e.stopPropagation()}>
                            {isPicked ? (
                              <Input
                                type="number"
                                min={1}
                                value={currentQty}
                                onChange={(e) => updateCatalogQuantity(item.sku, Number(e.target.value) || 1)}
                                className="h-6 w-24 text-xs font-mono text-center mx-auto bg-background"
                              />
                            ) : (
                              <span className="text-muted-foreground text-[10px]">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Action Summary Bar */}
            <div className="p-3 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between">
              <div className="text-xs font-mono">
                {selectedCount > 0 ? (
                  <span>
                    Tanlandi: <b className="text-foreground">{selectedCount} xil</b> pozitsiya • Jami:{" "}
                    <b className="text-foreground">{selectedTotalSum.toLocaleString()} so&apos;m</b>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px]">
                    Chiqimga qo&apos;shmoqchi bo&apos;lgan tovarlarni belgilang.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-7 text-xs"
                >
                  Bekor qilish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={handleAddCatalogItems}
                  className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  <Plus className="size-3.5" />
                  <span>Chiqimga qo&apos;shish ({selectedCount})</span>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Pre-packaged TRD sales */}
          <TabsContent value="packages" className="flex-1 min-h-0 flex flex-col m-0 p-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 divide-x divide-border">
              {/* Left Column: Sales Packages List */}
              <div className="overflow-y-auto p-3 space-y-2">
                {relevantSales.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground space-y-2">
                    <AlertCircle className="size-6 text-muted-foreground opacity-50" />
                    <p>Ushbu mijoz uchun alohida qadoqlangan to&apos;plamlar yo&apos;q.</p>
                    <p className="text-[11px]">Yuqoridagi «Katalogdan tanlash» yorlig&apos;idan tovarlarni to&apos;g&apos;ridan-to&apos;g&apos;ri qo&apos;shing.</p>
                  </div>
                ) : (
                  relevantSales.map((sale) => {
                    const isSelected = selectedSale?.id === sale.id;
                    const isShipped = !!sale.linkedShipmentId;
                    const itemsCount = sale.items?.length || 0;
                    const totalQty = (sale.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);

                    return (
                      <div
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        className={`p-3 rounded border transition-colors cursor-pointer text-xs space-y-1.5 ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500/40 shadow-sm"
                            : "bg-background border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Package className="size-3.5 text-blue-600" />
                            <span className="font-mono font-bold text-foreground">
                              TRD-BOX [{sale.docNo}]
                            </span>
                          </div>
                          <Badge
                            variant={isShipped ? "secondary" : "default"}
                            className={`text-[10px] px-1.5 py-0 h-4 font-mono ${
                              isShipped ? "bg-muted text-muted-foreground" : "bg-emerald-600 text-white"
                            }`}
                          >
                            {isShipped ? `Yuklangan (${sale.linkedShipmentId})` : "Omborda tayyor"}
                          </Badge>
                        </div>

                        <div className="text-foreground font-medium truncate">{sale.customer}</div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/50 text-muted-foreground font-mono">
                          <span>{sale.date}</span>
                          <span>
                            {itemsCount} ta tovar ({totalQty.toLocaleString()} dona)
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Selected Package Items Preview */}
              <div className="flex flex-col h-full bg-background overflow-hidden">
                {selectedSale ? (
                  <div className="flex flex-col h-full">
                    <div className="p-3 border-b border-border bg-muted/20 shrink-0 flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-xs text-foreground flex items-center gap-1.5">
                          <FileText className="size-3.5 text-blue-600" />
                          <span>{selectedSale.docNo} tovarlari</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          TRD-BOX-{selectedSale.docNo}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleImportSale(selectedSale)}
                        className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <ArrowRight className="size-3.5" />
                        <span>Chiqimga yuklash</span>
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                          <TableRow className="h-7 text-[10px]">
                            <TableHead className="font-semibold">Nomi / Artikul</TableHead>
                            <TableHead className="text-right font-semibold">Miqdor</TableHead>
                            <TableHead className="text-right font-semibold">Narx</TableHead>
                            <TableHead className="text-right font-semibold">Jami</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedSale.items || []).map((it, idx) => (
                            <TableRow key={idx} className="h-7 text-xs">
                              <TableCell className="py-1">
                                <div className="font-medium text-foreground truncate max-w-[180px]">{it.name}</div>
                                <div className="text-[10px] font-mono text-muted-foreground">{it.sku}</div>
                              </TableCell>
                              <TableCell className="text-right font-mono py-1">
                                {Number(it.quantity).toLocaleString()} {it.unit}
                              </TableCell>
                              <TableCell className="text-right font-mono py-1">
                                {Number(it.unitPriceUZS || it.unitPrice).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium py-1">
                                {Number(it.totalAmount).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="p-2.5 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground text-[11px]">
                        Jami: {(selectedSale.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0).toLocaleString()} dona
                      </span>
                      <span className="font-bold text-foreground">
                        {(Number(selectedSale.totalUZS || selectedSale.totalAmount) || 0).toLocaleString()} so&apos;m
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
                    Tovarlar tarkibini ko&apos;rish va biriktirish uchun chapdan to&apos;plamni tanlang.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
