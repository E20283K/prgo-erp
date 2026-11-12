"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingBag,
  Search,
  Check,
  Receipt,
  Layers,
  ArrowRight,
  ExternalLink,
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

const CATEGORIES = [
  "Barchasi",
  "Tugmalar",
  "Fermuarlar",
  "Jakkard",
  "Iplar",
  "Yorliqlar",
  "Furnitura",
] as const;

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

  const [activeTab, setActiveTab] = useState<"catalog" | "sales">("catalog");
  const [selectedCategory, setSelectedCategory] = useState<string>("Barchasi");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<TradingCatalogItemRecord | null>(null);
  const [quantity, setQuantity] = useState<number>(1000);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  // Sales import state
  const [selectedSale, setSelectedSale] = useState<TradingSaleRecord | null>(null);

  useEffect(() => {
    if (open) {
      if (tradingCatalog.length === 0) {
        loadTradingData("catalog");
      }
      if (tradingSales.length === 0) {
        loadTradingData("sales");
      }
      setSelectedItem(null);
      setSelectedSale(null);
      setSearchQuery("");
      setActiveTab("catalog");
    }
  }, [open, loadTradingData, tradingCatalog.length, tradingSales.length]);

  // When selectedItem changes, default unitPrice to wholesalePriceUZS or priceUZS
  useEffect(() => {
    if (selectedItem) {
      const price = selectedItem.wholesalePriceUZS || selectedItem.priceUZS || 0;
      setUnitPrice(price);
      setQuantity(Math.min(1000, Math.max(1, selectedItem.stockQty || 100)));
    }
  }, [selectedItem]);

  // Catalog filtered list
  const filteredCatalog = useMemo(() => {
    let list = tradingCatalog || [];
    if (selectedCategory !== "Barchasi") {
      list = list.filter((item) => item.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tradingCatalog, selectedCategory, searchQuery]);

  // Sales matching buyer customer
  const relevantSales = useMemo(() => {
    const list = tradingSales || [];
    if (!buyerCustomer?.trim()) return list;
    const q = buyerCustomer.toLowerCase().trim();
    const matched = list.filter((s) => s.customer?.toLowerCase().includes(q));
    return matched.length > 0 ? matched : list;
  }, [tradingSales, buyerCustomer]);

  const handleAddCatalogItem = () => {
    if (!selectedItem) return;
    const qty = Math.max(1, Number(quantity) || 1);
    const price = Math.max(0, Number(unitPrice) || 0);
    const total = qty * price;

    onSelectItems([
      {
        tradingCatalogId: selectedItem.id,
        sku: selectedItem.sku,
        name: selectedItem.name,
        quantity: qty,
        unit: selectedItem.unit || "dona",
        unitPrice: price,
        totalPrice: total,
        accountCode: "2910",
        notes: `Savdo katalogidan (2910): ${selectedItem.category}`,
      },
    ]);
    onOpenChange(false);
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
        notes: `Savdo hujjati ${sale.docNo} dan import`,
      };
    });

    onSelectItems(mapped, sale.docNo || sale.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 border border-border bg-card overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="size-4 text-blue-600" />
              <span>Savdo aksessuarlari ombori (2910)</span>
            </DialogTitle>
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded border border-border">
              <Button
                type="button"
                size="sm"
                variant={activeTab === "catalog" ? "default" : "ghost"}
                onClick={() => setActiveTab("catalog")}
                className="h-6 px-2.5 text-xs gap-1.5"
              >
                <Layers className="size-3" />
                <span>Katalogdan tanlash</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeTab === "sales" ? "default" : "ghost"}
                onClick={() => setActiveTab("sales")}
                className="h-6 px-2.5 text-xs gap-1.5"
              >
                <Receipt className="size-3" />
                <span>Sotuv hujjatidan import</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {activeTab === "catalog" ? (
          <div className="flex flex-col h-[520px]">
            {/* Filter and Search Bar */}
            <div className="p-3 border-b border-border bg-background space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Artikul (SKU) yoki nom bo'yicha qidirish..."
                    className="h-8 pl-8 text-xs bg-card border-border"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className="h-6 px-2 text-[11px] shrink-0"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Catalog Grid Table */}
            <div className="flex-1 overflow-y-auto min-h-0 border-b border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <TableRow className="h-7 text-[11px]">
                    <TableHead className="w-24 font-semibold">SKU</TableHead>
                    <TableHead className="font-semibold">Mahsulot tavsifi</TableHead>
                    <TableHead className="w-24 font-semibold">Kategoriya</TableHead>
                    <TableHead className="w-20 text-right font-semibold">Zaxira</TableHead>
                    <TableHead className="w-16 font-semibold">Birligi</TableHead>
                    <TableHead className="w-28 text-right font-semibold">Ulgurji narx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCatalog.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-xs text-muted-foreground">
                        Katalogda aksessuarlar topilmadi.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isOutOfStock = (item.stockQty || 0) <= 0;
                      return (
                        <TableRow
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`h-8 text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-500/10 hover:bg-blue-500/15"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <TableCell className="font-mono text-muted-foreground font-medium py-1">
                            {item.sku}
                          </TableCell>
                          <TableCell className="font-medium text-foreground py-1 truncate max-w-[280px]">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground py-1">
                            {item.category}
                          </TableCell>
                          <TableCell className="text-right py-1 font-mono font-medium">
                            <span
                              className={
                                isOutOfStock
                                  ? "text-destructive"
                                  : (item.stockQty || 0) < 500
                                  ? "text-amber-600"
                                  : "text-foreground"
                              }
                            >
                              {(item.stockQty || 0).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground py-1">
                            {item.unit}
                          </TableCell>
                          <TableCell className="text-right py-1 font-mono">
                            {(item.wholesalePriceUZS || item.priceUZS || 0).toLocaleString()}{" "}
                            <span className="text-[10px] text-muted-foreground">so&apos;m</span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Add Action Bar */}
            <div className="p-3 bg-muted/10 shrink-0 flex items-center justify-between gap-3">
              {selectedItem ? (
                <div className="flex items-center gap-4 flex-1">
                  <div className="min-w-0 max-w-[240px]">
                    <div className="text-[11px] font-mono text-blue-600 truncate">
                      [{selectedItem.sku}]
                    </div>
                    <div className="text-xs font-semibold text-foreground truncate">
                      {selectedItem.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Mavjud zaxira: {(selectedItem.stockQty || 0).toLocaleString()} {selectedItem.unit}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Miqdor:</span>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                        className="h-7 w-24 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Narx (dona):</span>
                      <Input
                        type="number"
                        min={0}
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                        className="h-7 w-28 text-xs font-mono"
                      />
                    </div>
                    <div className="pl-2">
                      <span className="text-[10px] text-muted-foreground block">Jami:</span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {(quantity * unitPrice).toLocaleString()} so&apos;m
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Chiqim qilish uchun jadvaldan aksessuarni tanlang.
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-7 px-3 text-xs"
                >
                  Bekor qilish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedItem || quantity <= 0}
                  onClick={handleAddCatalogItem}
                  className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="size-3.5" />
                  <span>Chiqimga qo&apos;shish</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Import from Trading Sale */
          <div className="flex flex-col h-[520px]">
            <div className="p-3 border-b border-border bg-background flex items-center justify-between shrink-0">
              <div className="text-xs text-muted-foreground">
                {buyerCustomer ? (
                  <span>
                    Mijoz: <b className="text-foreground">{buyerCustomer}</b> bo&apos;yicha shakllantirilgan savdo hujjatlari
                  </span>
                ) : (
                  <span>Mavjud barcha savdo hujjatlari</span>
                )}
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {relevantSales.length} ta hujjat
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 divide-x divide-border">
              {/* Left Column: Sales Documents List */}
              <div className="overflow-y-auto p-2 space-y-1.5">
                {relevantSales.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
                    Savdo hujjatlari topilmadi.
                  </div>
                ) : (
                  relevantSales.map((sale) => {
                    const isSelected = selectedSale?.id === sale.id;
                    const itemsCount = sale.items?.length || 0;
                    return (
                      <div
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        className={`p-2.5 rounded border transition-colors cursor-pointer text-xs space-y-1 ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500/40"
                            : "bg-background border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-foreground">
                            {sale.docNo}
                          </span>
                          <Badge
                            variant={sale.status === "Posted" ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {sale.status === "Posted" ? "O'tkazilgan" : "Qoralama"}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {sale.customer}
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground font-mono">
                          <span>{sale.date}</span>
                          <span>{itemsCount} ta tovar • {Number(sale.totalUZS || sale.totalAmount).toLocaleString()} UZS</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Selected Sale Items Preview */}
              <div className="flex flex-col h-full bg-background overflow-hidden">
                {selectedSale ? (
                  <div className="flex flex-col h-full">
                    <div className="p-3 border-b border-border bg-muted/20 shrink-0 flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-xs text-foreground">
                          {selectedSale.docNo} tovarlari
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {selectedSale.sellerEntityName}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleImportSale(selectedSale)}
                        className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <ArrowRight className="size-3.5" />
                        <span>Barchasini yuklash</span>
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                          <TableRow className="h-7 text-[10px]">
                            <TableHead className="font-semibold">Nomi</TableHead>
                            <TableHead className="text-right font-semibold">Miqdor</TableHead>
                            <TableHead className="text-right font-semibold">Narx</TableHead>
                            <TableHead className="text-right font-semibold">Jami</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedSale.items || []).map((it, idx) => (
                            <TableRow key={idx} className="h-7 text-xs">
                              <TableCell className="py-1">
                                <div className="font-medium truncate max-w-[160px]">{it.name}</div>
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
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
                    Tovarlar tarkibini ko&apos;rish va import qilish uchun chapdan savdo hujjatini tanlang.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
