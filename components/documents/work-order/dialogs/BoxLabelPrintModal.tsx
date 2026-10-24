"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Printer,
  Download,
  PackageCheck,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayedBoxes = React.useMemo(() => {
    if (selectedBoxIndex === "all") return boxes;
    const single = boxes[selectedBoxIndex];
    return single ? [single] : boxes;
  }, [boxes, selectedBoxIndex]);

  const generateReportLabPdf = useCallback(async () => {
    try {
      setIsGeneratingPdf(true);
      setErrorMsg(null);

      const res = await fetch("/api/docs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "box-labels-pdf",
          payload: {
            workOrderNo,
            clientOrderNo,
            customer: customer || "—",
            product: product || "—",
            totalBoxes: totalBoxes || boxes.length || 1,
            boxes: displayedBoxes.map((b) => ({
              id: b.id,
              boxNumber: b.boxNumber,
              boxCode: b.boxCode,
              model: b.model,
              sizeCode: b.sizeCode,
              quantity: b.quantity,
              grossWeightKg: b.grossWeightKg,
              packerName: b.packerName,
              packedAt: b.packedAt,
              barcode: b.barcode,
              notes: b.notes,
            })),
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [workOrderNo, clientOrderNo, customer, product, totalBoxes, boxes.length, displayedBoxes]);

  // Generate automatically when dialog opens or selection changes
  useEffect(() => {
    if (isOpen) {
      generateReportLabPdf();
    } else {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [isOpen, generateReportLabPdf]);

  const handlePrint = () => {
    if (pdfBlobUrl) {
      const printWin = window.open(pdfBlobUrl, "_blank");
      if (printWin) {
        printWin.addEventListener("load", () => {
          printWin.print();
        });
      }
      return;
    }
    window.print();
  };

  const handleDownloadPdf = () => {
    const filename = `Box_Labels_${workOrderNo || "PRINTGOO"}.pdf`;
    if (pdfBlobUrl) {
      const link = document.createElement("a");
      link.href = pdfBlobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[96vw]! sm:max-w-[96vw]! h-[94vh] max-h-[94vh]! flex flex-col overflow-hidden p-0 gap-0 border border-border bg-zinc-100 dark:bg-zinc-950 text-foreground print:p-0 print:border-none print:bg-white print:max-h-none print:overflow-visible shadow-2xl"
      >
        {/* Header Bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shadow-xs print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-7 rounded-md border border-border bg-muted flex items-center justify-center text-foreground shrink-0">
              <PackageCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate">
                  Quti pasportlari
                </span>
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  {workOrderNo}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono shrink-0"
                >
                  100×150 mm
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter by box */}
            <div className="flex items-center gap-1.5 mr-1">
              <span className="text-[11px] text-muted-foreground">Quti:</span>
              <Select
                value={String(selectedBoxIndex)}
                onValueChange={(val) =>
                  setSelectedBoxIndex(!val || val === "all" ? "all" : Number(val))
                }
              >
                <SelectTrigger className="h-8 min-w-[170px] text-xs bg-muted font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Barchasi ({boxes.length} ta)
                  </SelectItem>
                  {boxes.map((b, idx) => (
                    <SelectItem key={b.id || idx} value={String(idx)} className="text-xs font-mono">
                      Quti #{b.boxNumber} ({b.quantity} dona{b.sizeCode ? ` · ${b.sizeCode}` : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateReportLabPdf}
              disabled={isGeneratingPdf}
              className="h-8 gap-1.5 text-xs cursor-pointer"
              title="Qayta generatsiya qilish"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPdf ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Yangilash</span>
            </Button>

            {pdfBlobUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(pdfBlobUrl, "_blank")}
                className="h-8 gap-1.5 text-xs cursor-pointer hidden md:inline-flex"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Yangi oynada</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || !pdfBlobUrl}
              className="h-8 gap-1.5 text-xs cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Yuklab olish</span>
            </Button>
          </div>
        </div>

        {/* Live ReportLab PDF Viewport */}
        <div className="flex-1 min-h-0 w-full bg-zinc-200/70 dark:bg-zinc-900 flex items-center justify-center relative">
          {isGeneratingPdf ? (
            <div className="flex flex-col items-center gap-3 text-center p-6">
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  ReportLab (Python) termoetiketkalarni generatsiya qilmoqda...
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  POST /generate/pdf/box-labels • {displayedBoxes.length} ta 100×150 mm yorliq
                </p>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="max-w-md p-6 bg-card border border-destructive/40 rounded-lg text-center space-y-3 shadow-sm">
              <p className="text-xs font-bold text-destructive">
                ReportLab PDF Xatoligi
              </p>
              <p className="text-[11px] text-muted-foreground font-mono break-all">
                {errorMsg}
              </p>
              <Button size="sm" variant="outline" onClick={generateReportLabPdf} className="text-xs">
                Qayta urinib ko&apos;rish
              </Button>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={`${pdfBlobUrl}#toolbar=1&navpanes=0&view=FitH`}
              title={`Box Labels ${workOrderNo}`}
              className="w-full h-full border-0"
            />
          ) : null}
        </div>

        {/* Modal Bottom Actions */}
        <div className="shrink-0 p-3 px-5 bg-card border-t border-border flex items-center justify-between text-xs print:hidden">
          <div className="text-muted-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-[11px]">
              Standart termoetiketka formati: <strong>100 × 150 mm (4×6 dyuym)</strong>. Zebra/Xprinter yoki oddiy printerda chop qilinadi.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Yopish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={isGeneratingPdf}
              className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Chop etish ({displayedBoxes.length} ta yorliq)</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
