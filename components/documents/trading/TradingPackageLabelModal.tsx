"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  QrCode,
  Package,
  Layers,
  X,
  Check,
} from "lucide-react";
import { TradingSaleRecord, TradingSaleItem } from "./types";

interface TradingPackageLabelModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Partial<TradingSaleRecord>;
}

export function TradingPackageLabelModal({
  isOpen,
  onOpenChange,
  sale,
}: TradingPackageLabelModalProps) {
  const [labelSize, setLabelSize] = useState<"100x70" | "58x40">("100x70");

  const docNo = sale.docNo || "TRD-2026-001";
  const customer = sale.customer || "Mijoz";
  const items: TradingSaleItem[] = sale.items || [];
  const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const estWeightKg = Number((totalQty * 0.005).toFixed(2)) || 2.5;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 border border-border bg-card overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
          <DialogTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
            <QrCode className="size-4 text-blue-600" />
            <span>Aksessuarlar stikeri (Markirovka)</span>
          </DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={labelSize === "100x70" ? "default" : "outline"}
              onClick={() => setLabelSize("100x70")}
              className="h-6 px-2 text-[10px]"
            >
              100x70 mm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={labelSize === "58x40" ? "default" : "outline"}
              onClick={() => setLabelSize("58x40")}
              className="h-6 px-2 text-[10px]"
            >
              58x40 mm
            </Button>
          </div>
        </DialogHeader>

        {/* Label Preview Container */}
        <div className="p-4 bg-muted/40 flex items-center justify-center min-h-[300px]">
          {/* Printable Thermal Label */}
          <div
            id="trading-package-sticker"
            className={`bg-white text-black border-2 border-black rounded shadow-sm p-3 flex flex-col justify-between font-sans select-none print:m-0 print:border-none print:shadow-none ${
              labelSize === "100x70" ? "w-[360px] h-[252px]" : "w-[280px] h-[190px]"
            }`}
            style={{ color: "#000000", backgroundColor: "#ffffff" }}
          >
            {/* Header Strip */}
            <div className="border-b border-black pb-1.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block">
                  {sale.sellerEntityName || "PRINTGOO INDUSTRIAL"}
                </span>
                <span className="text-[9px] font-mono text-neutral-600 block">
                  Savdo aksessuarlari ombori (2910)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 border border-black rounded">
                TRD-BOX
              </span>
            </div>

            {/* Customer & Document Info */}
            <div className="py-1 space-y-0.5 text-left">
              <div className="text-[9px] text-neutral-600 uppercase font-bold">Xaridor:</div>
              <div className="text-xs font-bold truncate leading-tight">
                {customer}
              </div>
              {sale.customerTin && (
                <div className="text-[9px] font-mono text-neutral-700">
                  STIR / INN: {sale.customerTin}
                </div>
              )}
            </div>

            {/* Items Summary (compact list) */}
            <div className="border-t border-b border-dashed border-neutral-400 py-1 text-[9px] font-mono max-h-16 overflow-hidden">
              {items.slice(0, 3).map((it, idx) => (
                <div key={idx} className="flex justify-between truncate leading-tight">
                  <span className="truncate max-w-[190px]">• {it.name}</span>
                  <span className="font-bold shrink-0">
                    {Number(it.quantity).toLocaleString()} {it.unit}
                  </span>
                </div>
              ))}
              {items.length > 3 && (
                <div className="text-[8px] italic text-neutral-500">
                  + yana {items.length - 3} ta aksessuar pozitsiyasi...
                </div>
              )}
            </div>

            {/* Barcode & Total Block */}
            <div className="pt-1 flex items-end justify-between">
              <div className="flex flex-col items-start">
                {/* Visual SVG Code 128-like Barcode */}
                <div className="h-7 flex items-center gap-[2px] bg-transparent">
                  {[4,2,3,1,4,2,1,3,2,4,1,2,3,4,1,3,2,1,4,2,3,1,2,4,3,1,2,4,1,3,2,4].map((w, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{ width: `${w}px` }}
                    />
                  ))}
                </div>
                <div className="font-mono font-bold text-[10px] tracking-widest mt-0.5">
                  *{docNo}*
                </div>
              </div>

              <div className="text-right">
                <div className="text-[9px] text-neutral-600">Jami adad:</div>
                <div className="font-mono font-bold text-xs">
                  {totalQty.toLocaleString()} dona
                </div>
                <div className="text-[9px] font-mono text-neutral-700">
                  ~{estWeightKg} kg
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="px-4 py-2.5 border-t border-border bg-card flex sm:justify-between items-center">
          <div className="text-[11px] text-muted-foreground hidden sm:block">
            Ombordan yuklashda skaner apparat orqali o&apos;qitiladi (F2).
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 px-3 text-xs"
            >
              Yopish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="size-3.5" />
              <span>Chop etish (Termo)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
