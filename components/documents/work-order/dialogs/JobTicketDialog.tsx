"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Printer,
  Download,
  X,
  RefreshCw,
  FileText,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WorkOrderFormData,
  MasterSpecification,
  MachineOption,
  RouteStep,
  ShiftEvent,
  ShiftNote,
  RECIPE_MATERIALS,
} from "../types";

interface JobTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  formData: WorkOrderFormData;
  activeSpec?: MasterSpecification;
  activeMachine?: MachineOption;
  operations?: RouteStep[];
  materials?: { name: string; req: number; unit: string; stock: number }[];
  shiftEvents?: ShiftEvent[];
  onExportSuccess?: (docNo: string) => void;
}

const LABEL_KEYS = [
  "title",
  "subtitle",
  "badge",
  "customer",
  "product",
  "departmentSite",
  "pressMachine",
  "netRun",
  "grossSheets",
  "impositionYield",
  "scheduleWindow",
  "recipe",
  "physicalSpecs",
  "sampleAndDrawing",
  "trimDimensions",
  "bleedMargin",
  "cornerCut",
  "holeEyelet",
  "paperSubstrate",
  "laminationSpec",
  "surfaceCoating",
  "embellishment",
  "inksAndColors",
  "frontSide",
  "backSide",
  "spotStations",
  "kashirovkaTitle",
  "kashirovkaMode",
  "kashirovkaStrategy",
  "kashirovkaTotalGsm",
  "kashirovkaGlue",
  "kashirovkaWastePause",
  "flexoTitle",
  "flexoTeeth",
  "flexoWebWidth",
  "flexoPlate",
  "flexoGap",
  "sizeBreakdown",
  "colModel",
  "colSize",
  "colQty",
  "colShare",
  "totalTarget",
  "bomMaterials",
  "colMaterial",
  "colReqQty",
  "colWarehouseStock",
  "stockOk",
  "stockShortage",
  "readinessChecklist",
  "gate1Title",
  "gate1Sub",
  "gate2Title",
  "gate2Sub",
  "gate3Title",
  "gate3Sub",
  "gate4Title",
  "gate4Sub",
  "techRoute",
  "colStep",
  "colOperation",
  "colMachine",
  "colOperator",
  "colDuration",
  "colStatus",
  "colSign",
  "shiftNotesTitle",
  "signOffTitle",
  "signPrepress",
  "signPrepressSub",
  "signPress",
  "signPressSub",
  "signFinish",
  "signFinishSub",
  "signQc",
  "signQcSub",
  "signLabel",
  "dateLabel",
  "pass",
  "footerSystem",
  "printDate",
] as const;

export function JobTicketDialog({
  isOpen,
  onOpenChange,
  workOrderId,
  formData,
  operations,
  materials,
  onExportSuccess,
}: JobTicketDialogProps) {
  const t = useTranslations("JobTicket");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const netQuantity = formData.quantity || 5000;

  // BOM Materials
  const bomMaterials =
    materials && materials.length > 0
      ? materials
      : RECIPE_MATERIALS[formData.recipe] || RECIPE_MATERIALS["OFFSET_STD_V1"] || [];

  // Operations
  const routeSteps: RouteStep[] = operations || [];

  // Shift Notes
  const shiftNotes: ShiftNote[] = formData.shiftNotes || [];

  const generateReportLabPdf = useCallback(async () => {
    const labelsMap: Record<string, string> = {};
    for (const key of LABEL_KEYS) {
      labelsMap[key] = t(key);
    }

    try {
      setIsGeneratingPdf(true);
      setErrorMsg(null);

      const res = await fetch("/api/docs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "job-ticket-pdf",
          payload: {
            docNo: workOrderId,
            orderData: formData,
            operations: routeSteps,
            materials: bomMaterials,
            shiftNotes,
            labels: labelsMap,
            saveToS3: false,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ReportLab Server Error (${res.status}): ${errText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.warn("ReportLab service unavailable, falling back to client-side PDF renderer...", err);
      try {
        const { pdf } = await import("@react-pdf/renderer");
        const { WorkOrderSpecPDF } = await import("../WorkOrderSpecPDF");
        const clientBlob = await pdf(
          <WorkOrderSpecPDF
            docNo={workOrderId}
            orderData={formData}
            operations={routeSteps}
            materials={bomMaterials}
            labels={labelsMap}
          />
        ).toBlob();
        const url = URL.createObjectURL(clientBlob);
        setPdfBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (clientErr) {
        console.error("Failed to generate Order Passport PDF:", clientErr);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Ish pasporti PDF generatsiyasida xatolik yuz berdi."
        );
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [workOrderId, formData, routeSteps, bomMaterials, shiftNotes, t]);

  // Automatically generate the ReportLab PDF when the dialog opens
  useEffect(() => {
    if (isOpen) {
      generateReportLabPdf();
    } else {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDownloadPdf = async () => {
    const filename = `Order_Passport_${workOrderId || "PRINTGOO"}.pdf`;
    if (pdfBlobUrl) {
      const link = document.createElement("a");
      link.href = pdfBlobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onExportSuccess?.(workOrderId);
      return;
    }
    await generateReportLabPdf();
  };

  const handlePrint = () => {
    if (pdfBlobUrl) {
      const printWin = window.open(pdfBlobUrl, "_blank");
      if (printWin) {
        printWin.addEventListener("load", () => {
          printWin.print();
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[96vw]! sm:max-w-[96vw]! h-[94vh] max-h-[94vh]! flex flex-col overflow-hidden p-0 gap-0 border border-border bg-zinc-100 dark:bg-zinc-950"
      >
        {/* Top Modal Controls Bar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-card border-b border-border shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-semibold text-foreground truncate">
              {t("title")}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {workOrderId}
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1 text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0"
            >
              <Sparkles className="w-3 h-3" />
              <span>Python ReportLab PDF</span>
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateReportLabPdf}
              disabled={isGeneratingPdf}
              className="h-8 gap-1.5 text-xs cursor-pointer"
              title="Qayta generatsiya qilish (Refresh ReportLab PDF)"
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
              className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? t("downloadingPdf") : t("downloadPdf")}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!pdfBlobUrl}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("print")}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <span>{t("close")}</span>
            </Button>
          </div>
        </div>

        {/* Live ReportLab PDF Viewport */}
        <div className="flex-1 min-h-0 w-full bg-zinc-200/70 dark:bg-zinc-900 flex items-center justify-center relative">
          {isGeneratingPdf ? (
            <div className="flex flex-col items-center gap-3 text-center p-6">
              <RefreshCw className="w-7 h-7 text-primary animate-spin" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  ReportLab (Python) PDF hujjatni generatsiya qilmoqda...
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  POST /generate/pdf/job-ticket • QR + Code128 Barcode + 2D Vector
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
              title={`Order Passport ${workOrderId}`}
              className="w-full h-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
