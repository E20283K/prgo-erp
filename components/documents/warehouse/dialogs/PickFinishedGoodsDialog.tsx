"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PackageCheck,
  Search,
  AlertTriangle,
  RotateCcw,
  Check,
  Loader2,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface PickFinishedGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerCustomer: string;
  onSelectFgItem: (data: {
    finishedGoodId: string;
    sku: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    sourceWorkOrderId?: string;
    notes?: string;
  }) => void;
}

export function PickFinishedGoodsDialog({
  open,
  onOpenChange,
  buyerCustomer,
  onSelectFgItem,
}: PickFinishedGoodsDialogProps) {
  const {
    availableFinishedGoodsForShipment = [],
    loadAvailableFinishedGoods,
    checkAndTriggerReorderAsync,
  } = useWorkspaceStore();

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFg, setSelectedFg] = useState<any | null>(null);
  const [shipQty, setShipQty] = useState<number>(1000);
  const [unitPrice, setUnitPrice] = useState<number>(200);
  const [createReorder, setCreateReorder] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      loadAvailableFinishedGoods().finally(() => setIsLoading(false));
      setSelectedFg(null);
      setSearchQuery("");
    }
  }, [open, loadAvailableFinishedGoods]);

  const filteredItems = useMemo(() => {
    const list = availableFinishedGoodsForShipment || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return (availableFinishedGoodsForShipment || []).filter(
      (item) =>
        item.productName?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.customerName?.toLowerCase().includes(q) ||
        item.workOrderId?.toLowerCase().includes(q)
    );
  }, [availableFinishedGoodsForShipment, searchQuery]);

  const isCrossCustomer = useMemo(() => {
    if (!selectedFg || !buyerCustomer) return false;
    return (
      selectedFg.customerName &&
      buyerCustomer.trim() &&
      selectedFg.customerName.trim().toLowerCase() !== buyerCustomer.trim().toLowerCase()
    );
  }, [selectedFg, buyerCustomer]);

  const handleSelectRow = (item: any) => {
    setSelectedFg(item);
    const maxQty = item.availableQty || 1000;
    setShipQty(maxQty);
    const suggestedPrice = item.unitCost ? Math.round(item.unitCost * 1.4) : 210;
    setUnitPrice(suggestedPrice);
    setCreateReorder(true);
  };

  const handleConfirmAdd = async () => {
    if (!selectedFg || shipQty <= 0) return;
    try {
      setIsSubmitting(true);
      let notes = "";

      if (isCrossCustomer) {
        notes = `${selectedFg.customerName} (${selectedFg.workOrderId}) zaxirasidan yo'naltirildi`;
        if (createReorder && selectedFg.workOrderId) {
          await checkAndTriggerReorderAsync({
            originalWorkOrderId: selectedFg.workOrderId,
            divertedQty: shipQty,
            buyerCustomerName: buyerCustomer,
            notes: `Mijoz zaxirasidan ${buyerCustomer} ga berilgani munosabati bilan`,
          });
          notes += " (Asl mijoz uchun Reorder ochildi)";
        }
      } else {
        notes = `${selectedFg.workOrderId || "Zaxira"} bo'yicha chiqim`;
      }

      onSelectFgItem({
        finishedGoodId: selectedFg.id,
        sku: selectedFg.sku,
        name: selectedFg.productName,
        quantity: shipQty,
        unit: selectedFg.unit || "pcs",
        unitPrice,
        totalPrice: shipQty * unitPrice,
        sourceWorkOrderId: selectedFg.workOrderId,
        notes,
      });

      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 border-border bg-card">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-blue-600/10 flex items-center justify-center shrink-0">
              <PackageCheck className="size-4 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Tayyor Mahsulotlar Omboridan Tanlash (FG Stock)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Qabul qiluvchi mijoz: <strong className="text-foreground">{buyerCustomer || "Tanlanmagan"}</strong>
              </DialogDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/30">
            {(availableFinishedGoodsForShipment || []).length} ta partiya mavjud
          </Badge>
        </DialogHeader>

        {/* Content */}
        <div className="p-4 space-y-3.5 max-h-[65vh] overflow-y-auto">
          {/* Search bar */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mahsulot nomi, SKU, mijoz yoki buyurtma raqami bo'yicha qidirish..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Table of available FG stock */}
          <div className="border border-border rounded-md overflow-hidden max-h-[260px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0">
                <TableRow className="h-8 border-b border-border">
                  <TableHead className="text-[11px] font-semibold text-muted-foreground px-2.5 h-8">Partiya / WO №</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground px-2.5 h-8">Asl Buyurtmachi</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground px-2.5 h-8">Mahsulot Nomi</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground px-2.5 h-8 text-right">Qoldiq</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground px-2.5 h-8">Joylashuvi</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground px-2.5 h-8 text-center w-20">Tanlash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin inline-block mr-2" />
                      Yuklanmoqda...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Omborda tayyor mahsulot zaxiralari topilmadi.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = selectedFg?.id === item.id;
                    const isOtherCustomer =
                      buyerCustomer &&
                      item.customerName &&
                      item.customerName.trim().toLowerCase() !== buyerCustomer.trim().toLowerCase();

                    return (
                      <TableRow
                        key={item.id}
                        onClick={() => handleSelectRow(item)}
                        className={`h-9 border-b border-border hover:bg-muted/40 cursor-pointer ${
                          isSelected ? "bg-primary/5 font-medium" : ""
                        }`}
                      >
                        <TableCell className="px-2.5 py-1 font-mono text-xs text-primary font-semibold">
                          {item.workOrderId || item.sku}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-xs">
                          <span className={isOtherCustomer ? "text-amber-700 dark:text-amber-400 font-medium" : "text-foreground"}>
                            {item.customerName}
                          </span>
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-xs text-foreground truncate max-w-[220px]">
                          {item.productName}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-xs text-right font-mono font-bold text-foreground">
                          {item.availableQty.toLocaleString()} <span className="font-normal text-[10px] text-muted-foreground">{item.unit || "dona"}</span>
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-[11px] text-muted-foreground truncate max-w-[140px]">
                          {item.location}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-center">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRow(item);
                            }}
                          >
                            {isSelected ? <Check className="size-3" /> : "Tanlash"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Selected Item Configuration Form */}
          {selectedFg && (
            <div className="p-3.5 rounded-md border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Tanlangan tovar parametrlari va narxi
                </span>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
                  Maksimal qoldiq: {selectedFg.availableQty.toLocaleString()} {selectedFg.unit || "dona"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Chiqariladigan miqdor ({selectedFg.unit || "dona"})
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedFg.availableQty}
                    value={shipQty}
                    onChange={(e) => setShipQty(Math.min(selectedFg.availableQty, Math.max(1, Number(e.target.value) || 0)))}
                    className="h-7 text-xs font-mono mt-1"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="size-3 text-muted-foreground" />
                    Sotish narxi ({buyerCustomer} uchun)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 text-xs font-mono mt-1"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Jami qator summasi
                  </label>
                  <div className="h-7 px-2.5 rounded-md border border-input bg-background flex items-center font-mono text-xs font-bold text-primary mt-1">
                    {(shipQty * unitPrice).toLocaleString()} so'm
                  </div>
                </div>
              </div>

              {/* Inter-customer Cross-Allocation & Auto-Reorder Alert */}
              {isCrossCustomer && (
                <div className="p-3 rounded border border-amber-500/40 bg-amber-500/10 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground space-y-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        Mijozlararo zaxira yo'naltirilmoqda
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Ushbu {shipQty.toLocaleString()} dona mahsulot dastlab <strong>{selectedFg.customerName}</strong> ({selectedFg.workOrderId}) buyurtmasi uchun chiqarilgan.
                        Agar uni hozir <strong>{buyerCustomer}</strong> ga chiqarsangiz, {selectedFg.customerName} ning ombordagi zaxirasi kamayadi yoki 0 ga tushadi.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                    <Checkbox
                      id="createReorderCheck"
                      checked={createReorder}
                      onCheckedChange={(checked) => setCreateReorder(Boolean(checked))}
                    />
                    <label
                      htmlFor="createReorderCheck"
                      className="text-xs font-medium text-foreground cursor-pointer select-none flex items-center gap-1"
                    >
                      <RotateCcw className="size-3 text-primary" />
                      <span>{selectedFg.customerName} uchun {shipQty.toLocaleString()} dona yangi Reorder (qayta ishlab chiqarish) qoralamasini ochish</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs px-3"
          >
            Bekor qilish
          </Button>

          <Button
            size="sm"
            disabled={!selectedFg || shipQty <= 0 || isSubmitting}
            onClick={handleConfirmAdd}
            className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-medium shadow-none"
          >
            {isSubmitting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            <span>Chiqimga qo'shish</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
