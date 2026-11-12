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
  ArrowRight,
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { TradingSaleRecord } from "@/components/documents/trading/types";

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
    tradingSales = [],
    loadTradingData,
  } = useWorkspaceStore();

  const [selectedSale, setSelectedSale] = useState<TradingSaleRecord | null>(null);

  useEffect(() => {
    if (open) {
      if (tradingSales.length === 0) {
        loadTradingData("sales");
      }
      setSelectedSale(null);
    }
  }, [open, loadTradingData, tradingSales.length]);

  // Sales matching buyer customer or all ready sales
  const relevantSales = useMemo(() => {
    const list = tradingSales || [];
    if (!buyerCustomer?.trim()) return list;
    const q = buyerCustomer.toLowerCase().trim();
    const matched = list.filter((s) => s.customer?.toLowerCase().includes(q));
    return matched.length > 0 ? matched : list;
  }, [tradingSales, buyerCustomer]);

  // Auto-select first sale if only one matches
  useEffect(() => {
    if (relevantSales.length > 0 && !selectedSale) {
      setSelectedSale(relevantSales[0]);
    }
  }, [relevantSales, selectedSale]);

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
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShoppingBag className="size-4 text-blue-600" />
            <span>Tayyor savdo aksessuarlari to&apos;plami (2910)</span>
          </DialogTitle>
          <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground bg-background">
            Savdo yetakchi (TRD-BOX)
          </Badge>
        </DialogHeader>

        <div className="flex flex-col h-[480px]">
          {/* Customer Context Info Header */}
          <div className="px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
            <div>
              {buyerCustomer ? (
                <span>
                  Mijoz: <b className="text-foreground">{buyerCustomer}</b> uchun tayyorlangan aksessuarlar to&apos;plamlari
                </span>
              ) : (
                <span>Barcha tayyor savdo to&apos;plamlari ro&apos;yxati</span>
              )}
            </div>
            <span className="font-mono text-[11px]">{relevantSales.length} ta tayyor hujjat</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 divide-x divide-border">
            {/* Left Column: Sales Packages List */}
            <div className="overflow-y-auto p-3 space-y-2">
              {relevantSales.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground space-y-2">
                  <AlertCircle className="size-6 text-muted-foreground opacity-50" />
                  <p>Mijoz uchun Savdo modulida hali aksessuarlar sotuv hujjati shakllantirilmagan.</p>
                  <p className="text-[11px]">Avval Savdo modulida sotuv hujjatini rasmiylashtiring.</p>
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
                            isShipped
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-600 text-white"
                          }`}
                        >
                          {isShipped ? `Yuklangan (${sale.linkedShipmentId})` : "Omborda tayyor"}
                        </Badge>
                      </div>

                      <div className="text-foreground font-medium truncate">
                        {sale.customer}
                      </div>

                      <div className="text-[11px] text-muted-foreground truncate">
                        Sotuvchi: {sale.sellerEntityName}
                      </div>

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
                      <div className="text-[10px] text-muted-foreground">
                        Quti stikeri: TRD-BOX-{selectedSale.docNo}
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

                  {/* Summary Bar */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
