"use client";

import React, { useRef } from "react";
import {
  Printer,
  QrCode,
  Layers,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Factory,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShiftEvent, RouteStep } from "../types";

interface PalletTagPrintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderNo: string;
  productName?: string;
  customerName?: string;
  step: RouteStep;
  event: ShiftEvent;
}

export function PalletTagPrintDialog({
  isOpen,
  onOpenChange,
  workOrderNo,
  productName = "Poligrafiya Mahsuloti",
  customerName = "Mijoz",
  step,
  event,
}: PalletTagPrintDialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const palletCode = event.palletCode || `PL-${workOrderNo.replace(/[^a-zA-Z0-9]/g, "")}-${String(event.palletNumber || 1).padStart(2, "0")}`;
  const goodQty = event.goodQty || 0;
  const wasteQty = (event.makeReadyQty || 0) + (event.defectQty || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border shadow-xl">
        <DialogHeader className="p-4 bg-muted/40 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <QrCode className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-xs font-bold text-foreground">
                  Palet etiketkasi
                </DialogTitle>
                <DialogDescription className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {palletCode}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              100 × 150 mm
            </Badge>
          </div>
        </DialogHeader>

        {/* Printable Thermal Label Area */}
        <div className="p-4 bg-muted/20 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-[380px] bg-white text-zinc-950 p-4 rounded-md border-2 border-zinc-900 shadow-sm font-sans space-y-3"
            style={{ minHeight: "420px" }}
          >
            {/* Header / Company & Order # */}
            <div className="border-b-2 border-zinc-900 pb-2.5 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 block">
                  PRINTGOO ERP · TSEXLARARO PASPORT
                </span>
                <div className="text-base font-black tracking-tight font-mono">
                  {workOrderNo}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-zinc-600 block">
                  {event.time} · {event.shift || "1-smena"}
                </span>
                <span className="text-xs font-black font-mono px-1.5 py-0.5 bg-zinc-900 text-white rounded">
                  {palletCode}
                </span>
              </div>
            </div>

            {/* Product & Customer */}
            <div className="space-y-0.5">
              <div className="text-xs font-black uppercase truncate" title={productName}>
                {productName}
              </div>
              <div className="text-[11px] text-zinc-700 truncate">
                Mijoz: {customerName}
              </div>
            </div>

            {/* Current Step */}
            <div className="p-2 bg-zinc-100 rounded border border-zinc-300 space-y-1">
              <div className="text-[10px] font-mono uppercase text-zinc-600">
                Ishlov berilgan bosqich
              </div>
              <div className="text-xs font-bold leading-tight">
                Step {step.stepNumber}: {step.name}
              </div>
              <div className="text-[11px] font-mono text-zinc-700">
                Stanok: {step.machine} · Mas&apos;ul: {event.operator}
              </div>
            </div>

            {/* Quantities (Industrial High-Contrast Box) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2 border border-zinc-300 rounded bg-zinc-50">
                <span className="text-[9px] uppercase font-mono text-zinc-600 block">
                  Kirgan qog&apos;oz (Brutto)
                </span>
                <div className="text-lg font-black font-mono leading-none mt-1">
                  {(event.inputQty || goodQty + wasteQty).toLocaleString()}
                </div>
                <span className="text-[9px] text-zinc-500 font-mono">list</span>
              </div>

              <div className="p-2 border-2 border-zinc-900 rounded bg-zinc-900 text-white">
                <span className="text-[9px] uppercase font-mono text-zinc-300 block">
                  Sof Chiqish (Yaroqli)
                </span>
                <div className="text-xl font-black font-mono leading-none mt-1">
                  {goodQty.toLocaleString()}
                </div>
                <span className="text-[9px] text-zinc-300 font-mono">
                  {event.outputPiecesQty
                    ? `${event.outputPiecesQty.toLocaleString()} dona`
                    : "list"}
                </span>
              </div>
            </div>

            {/* Waste info if any */}
            {wasteQty > 0 && (
              <div className="text-[10px] font-mono text-zinc-700 flex justify-between border-t border-zinc-300 pt-1">
                <span>Isrof (Priladka + Brak):</span>
                <strong>{wasteQty.toLocaleString()} list {event.wasteReason ? `(${event.wasteReason})` : ""}</strong>
              </div>
            )}

            {/* QR Code and Verification Stamp */}
            <div className="pt-2 border-t-2 border-zinc-900 flex items-center justify-between">
              {/* Synthetic Visual High-Density QR code */}
              <div className="flex items-center gap-2">
                <div className="size-14 border border-zinc-900 p-1 flex items-center justify-center bg-white">
                  <QrCode className="size-full text-zinc-950" />
                </div>
                <div className="text-[9px] font-mono text-zinc-600 space-y-0.5">
                  <div className="font-bold text-zinc-900">{palletCode}</div>
                  <div>Skanerlash orqali</div>
                  <div>keyingi bosqichga qabul</div>
                </div>
              </div>

              <div className="text-right">
                <div className="border border-zinc-900 rounded px-2 py-1 text-center">
                  <span className="text-[9px] font-mono uppercase block text-zinc-600">
                    QC STATUS
                  </span>
                  <span className="text-xs font-black text-emerald-700 font-mono">
                    TASDIQLANDI
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 bg-muted/40 border-t border-border flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Yopish
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
          >
            <Printer className="size-3.5" />
            <span>Etiketkani chop etish</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
