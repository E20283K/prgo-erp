"use client";

import React, { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageCheck, CheckCircle2, Warehouse, Loader2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface PendingFgReceiptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingFgReceiptsDialog({
  open,
  onOpenChange,
}: PendingFgReceiptsDialogProps) {
  const {
    pendingFinishedGoodsReceipts = [],
    isPendingFgLoading,
    confirmFinishedGoodReceiptAsync,
    loadPendingFinishedGoods,
  } = useWorkspaceStore();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [shelfInputs, setShelfInputs] = useState<Record<string, string>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, number>>({});

  const pendingList = pendingFinishedGoodsReceipts || [];

  const handleConfirm = async (item: any) => {
    try {
      setConfirmingId(item.id);
      const shelf = shelfInputs[item.id] || item.locationShelf || "FG-01";
      const confirmedQty = qtyInputs[item.id] !== undefined ? qtyInputs[item.id] : item.quantity;

      await confirmFinishedGoodReceiptAsync(item.id, confirmedQty, shelf);
      await loadPendingFinishedGoods();
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 border-border bg-card">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600/10 flex items-center justify-center shrink-0">
              <PackageCheck className="size-4 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Ishlab chiqarishdan kutilayotgan qabullar
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Bosmaxona qadoqlashdan topshirilgan tayyor mahsulotlarni 2810 ombor balansiga qabul qilish
              </DialogDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/30">
            {pendingList.length} ta partiya
          </Badge>
        </DialogHeader>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {isPendingFgLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Kutilayotgan qabullar yuklanmoqda...</span>
            </div>
          ) : pendingList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2 text-center">
              <Warehouse className="size-8 text-muted-foreground/40 stroke-[1.5]" />
              <p className="text-xs font-medium text-foreground">
                Hozirda kutilayotgan qabullar yo'q
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Bosmaxonada buyurtma qadoqlangach, ushbu ro'yxatda paydo bo'ladi va omborchi tomonidan sanab qabul qilinadi.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="h-8 border-b border-border">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-8 px-2.5">Buyurtma №</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-8 px-2.5">Buyurtmachi</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-8 px-2.5">Tayyor Mahsulot</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-8 px-2.5 text-right">Tiraj</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-8 px-2.5 w-24">Stelaj/Joy</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-8 px-2.5 text-center w-28">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingList.map((item) => {
                    const isConfirming = confirmingId === item.id;
                    const shelf = shelfInputs[item.id] !== undefined ? shelfInputs[item.id] : item.locationShelf || "FG-01";
                    const qty = qtyInputs[item.id] !== undefined ? qtyInputs[item.id] : item.quantity;

                    return (
                      <TableRow key={item.id} className="h-9 border-b border-border hover:bg-muted/30">
                        <TableCell className="px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                          {item.workOrderId || item.orderNo || item.id}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-xs font-medium text-foreground truncate max-w-[150px]">
                          {item.customerName || "—"}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-xs text-foreground truncate max-w-[200px]">
                          <div>{item.productName}</div>
                          {item.notes && (
                            <div className="text-[10px] text-muted-foreground truncate">{item.notes}</div>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-xs text-right font-mono font-medium">
                          <Input
                            type="number"
                            value={qty}
                            onChange={(e) =>
                              setQtyInputs((prev) => ({ ...prev, [item.id]: Number(e.target.value) || 0 }))
                            }
                            className="h-6 w-20 text-right px-1.5 text-xs font-mono inline-block ml-auto"
                          />{" "}
                          <span className="text-[10px] text-muted-foreground">{item.unit || "dona"}</span>
                        </TableCell>
                        <TableCell className="px-2.5 py-1">
                          <Input
                            type="text"
                            placeholder="FG-01"
                            value={shelf}
                            onChange={(e) =>
                              setShelfInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-6 w-20 text-xs px-1.5 font-mono"
                          />
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-center">
                          <Button
                            size="sm"
                            disabled={isConfirming}
                            onClick={() => handleConfirm(item)}
                            className="h-6 px-2 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded shadow-none"
                          >
                            {isConfirming ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            <span>Qabul qilish</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Omborga qabul qilingan mahsulotlar 2810 schyot jamg'arish registrida aks etadi
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs px-3"
          >
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
