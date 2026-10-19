"use client";

import React, { useState } from "react";
import { Printer, X, Check, PackageCheck, Layers, Tag, UserCheck, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackagingBoxItem } from "../types";

interface BoxLabelPrintModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderNo: string;
  clientOrderNo?: string;
  customer: string;
  product: string;
  boxes: PackagingBoxItem[];
  totalBoxes: number;
}

export function BoxLabelPrintModal({
  isOpen,
  onOpenChange,
  workOrderNo,
  clientOrderNo,
  customer,
  product,
  boxes,
  totalBoxes,
}: BoxLabelPrintModalProps) {
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | "all">("all");

  const displayedBoxes = React.useMemo(() => {
    if (selectedBoxIndex === "all") return boxes;
    const single = boxes[selectedBoxIndex];
    return single ? [single] : boxes;
  }, [boxes, selectedBoxIndex]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[740px] max-h-[90vh] flex flex-col p-0 overflow-hidden text-xs">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>Quti Pasportlari (100×150 mm Termoetiketka)</span>
                  <Badge variant="secondary" className="text-[10px] h-4 font-mono">
                    {boxes.length} ta quti
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Termoprinter (Zebra/Xprinter) va oddiy printerda chop etish uchun tayyor qadoq yorliqlari.
                </DialogDescription>
              </div>
            </div>
            {/* Filter by box */}
            <div className="flex items-center gap-1.5 mr-6">
              <span className="text-[11px] text-muted-foreground">Quti:</span>
              <select
                value={selectedBoxIndex}
                onChange={(e) =>
                  setSelectedBoxIndex(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="h-7 text-xs bg-muted border border-border rounded px-2 font-medium"
              >
                <option value="all">Barchasi ({boxes.length} ta)</option>
                {boxes.map((b, idx) => (
                  <option key={b.id || idx} value={idx}>
                    Quti #{b.boxNumber} ({b.quantity} dona {b.sizeCode ? `· ${b.sizeCode}` : ""})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </DialogHeader>

        {/* Printable Area / Scrollable Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/40 flex flex-col items-center gap-6">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-box-labels, #printable-box-labels * {
                visibility: visible !important;
              }
              #printable-box-labels {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .box-label-page {
                width: 100mm !important;
                height: 145mm !important;
                page-break-after: always !important;
                break-after: page !important;
                border: 2px solid #000 !important;
                box-shadow: none !important;
                margin: 0 auto 5mm auto !important;
              }
            }
          `}} />

          <div id="printable-box-labels" className="flex flex-col items-center gap-6 w-full">
            {displayedBoxes.map((box) => (
              <div
                key={box.id}
                className="box-label-page bg-white text-black p-4 w-[380px] min-h-[520px] rounded border-2 border-black shadow-md flex flex-col justify-between font-sans select-none relative"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                {/* 1. Header & Logo */}
                <div>
                  <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-2">
                    <div>
                      <div className="text-[15px] font-black tracking-wider uppercase text-black">
                        PRINTGOO PACKAGING
                      </div>
                      <div className="text-[9px] font-semibold text-neutral-600 uppercase">
                        Ishlab Chiqarish va Qadoqlash Pasporti
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-xs uppercase tracking-wide inline-block">
                        PASSPORT
                      </div>
                      <div className="text-[9px] font-mono font-bold mt-0.5 text-neutral-700">
                        {box.boxCode}
                      </div>
                    </div>
                  </div>

                  {/* 2. Customer & Work Order */}
                  <div className="grid grid-cols-2 gap-2 border-b border-black/40 pb-2 mb-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-500 block">Buyurtmachi:</span>
                      <span className="text-[12px] font-black leading-tight text-black line-clamp-1">
                        {customer || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-500 block">Buyurtma №:</span>
                      <span className="text-[12px] font-mono font-black text-black">
                        {workOrderNo} {clientOrderNo ? `(${clientOrderNo})` : ""}
                      </span>
                    </div>
                  </div>

                  {/* 3. Product Description */}
                  <div className="border-b border-black/40 pb-2 mb-2">
                    <span className="text-[9px] uppercase font-bold text-neutral-500 block">Mahsulot Nomi:</span>
                    <span className="text-[13px] font-bold leading-snug text-black block line-clamp-2">
                      {product || "Chop etilgan mahsulot"}
                    </span>
                  </div>

                  {/* 4. Model and Size (Prominent if exists) */}
                  <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-2 mb-2">
                    <div className="bg-neutral-100 p-1.5 rounded-xs border border-neutral-300">
                      <span className="text-[8px] uppercase font-black text-neutral-600 block">Model / Artikul:</span>
                      <span className="text-[13px] font-black text-black block truncate">
                        {box.model || "Standart"}
                      </span>
                    </div>
                    <div className="bg-neutral-100 p-1.5 rounded-xs border border-neutral-300">
                      <span className="text-[8px] uppercase font-black text-neutral-600 block">O&apos;lcham (Size):</span>
                      <span className="text-[16px] font-black text-blue-700 block truncate">
                        {box.sizeCode || "Standard / All"}
                      </span>
                    </div>
                  </div>

                  {/* 5. Big Box Number and Quantity (High Impact for Warehouse) */}
                  <div className="grid grid-cols-2 gap-2 items-center bg-black/5 p-2 rounded border border-black/30 mb-2">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-700 block">
                        Quti Raqami:
                      </span>
                      <div className="text-[26px] font-black font-mono leading-none text-black mt-0.5">
                        {box.boxNumber} <span className="text-[14px] text-neutral-500 font-bold">/ {totalBoxes || boxes.length}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-700 block">
                        Qutidagi Soni:
                      </span>
                      <div className="text-[28px] font-black font-mono leading-none text-emerald-700 mt-0.5">
                        {box.quantity.toLocaleString()} <span className="text-[12px] font-bold uppercase text-black">dona</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Barcode & Operator Footer */}
                <div className="mt-2 pt-2 border-t border-black/40">
                  {/* Pseudo Barcode (High Contrast SVG) */}
                  <div className="flex flex-col items-center justify-center my-1">
                    <div className="h-10 w-full max-w-[260px] flex items-stretch justify-center gap-[2px] bg-white px-2">
                      {Array.from({ length: 48 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-black"
                          style={{
                            width: (i % 3 === 0 || i % 7 === 0) ? "3px" : (i % 2 === 0 ? "1px" : "2px"),
                            opacity: (i % 11 === 0) ? 0 : 1,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-mono font-bold tracking-widest text-black mt-0.5">
                      *{box.barcode || `${workOrderNo}-BX${box.boxNumber}`}*
                    </span>
                  </div>

                  {/* Operator, Date, Sign */}
                  <div className="flex items-center justify-between text-[9px] font-medium text-neutral-600 mt-2 pt-1 border-t border-dashed border-black/30">
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-black" />
                      <span>Mas&apos;ul: <strong className="text-black">{box.packerName || "Qadoqchi"}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-black" />
                      <span>{new Date(box.packedAt || Date.now()).toLocaleDateString("ru-RU")}</span>
                    </div>
                    <div className="border border-neutral-400 px-1 py-0.5 text-[8px] uppercase font-bold text-neutral-500">
                      QC TEKSHIRILDI
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="p-3 border-t border-border bg-card shrink-0 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span>Standart o&apos;lcham: <strong>100 × 150 mm (4×6 in)</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-medium cursor-pointer"
            >
              Yopish
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Chop etish ({displayedBoxes.length} ta yorliq)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
