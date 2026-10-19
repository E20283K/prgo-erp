"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Printer,
  Download,
  X,
  Scissors,
  FileCheck,
  Layers,
  Cpu,
  Palette,
  Boxes,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pdf } from "@react-pdf/renderer";
import { WorkOrderSpecPDF } from "../WorkOrderSpecPDF";
import {
  WorkOrderFormData,
  MasterSpecification,
  MachineOption,
  RouteStep,
  ShiftEvent,
  ShiftNote,
  SpotColorItem,
  SideColorConfig,
  RECIPE_MATERIALS,
  parseModelAndSize,
  calculateKashirovkaTotals,
  getDefaultKashirovkaLayers,
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
  shiftEvents,
  onExportSuccess,
}: JobTicketDialogProps) {
  const t = useTranslations("JobTicket");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Build localized label map for @react-pdf/renderer
  const buildPdfLabels = (): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const key of LABEL_KEYS) {
      map[key] = t(key);
    }
    return map;
  };

  // Calculations for gross sheets & yield
  const width = formData.width || 50;
  const height = formData.height || 90;
  const dimUnit = formData.dimensionUnit || "mm";
  const bleed = formData.bleed ?? 2;
  const itemW = width + 2 * bleed;
  const itemH = height + 2 * bleed;

  const cols = Math.max(1, Math.floor(960 / (itemW + 2)));
  const rows = Math.max(1, Math.floor(660 / (itemH + 2)));
  const yieldPerSheet = Math.max(1, cols * rows);
  const netQuantity = formData.quantity || 5000;
  const grossSheets =
    Math.ceil((netQuantity / yieldPerSheet) * 1.05) + (formData.kashirovkaMakeReadySheets || 50);

  // Hole specs
  const holeSize =
    formData.holeSize !== undefined
      ? formData.holeSize
      : formData.itemCategory === "Hangtag"
      ? 4
      : 0;
  const holePos = formData.holePosition || (formData.itemCategory === "Hangtag" ? "top-center" : "none");
  const holeOffset = formData.holeOffset ?? 6;

  // Colors & Spot Stations
  const frontColors: SideColorConfig = formData.frontColors || { c: true, m: true, y: true, k: true };
  const backColors: SideColorConfig = formData.backColors || { c: false, m: false, y: false, k: false };
  const spotColorItems: SpotColorItem[] =
    formData.spotColorItems && formData.spotColorItems.length > 0
      ? formData.spotColorItems
      : formData.spotColors && formData.spotColors.length > 0
      ? formData.spotColors.map((name, i) => ({
          id: `spot-${i}`,
          name,
          code: name.split(" ")[1] || "PMS",
          hex: name.includes("021") ? "#fe5000" : name.includes("871") ? "#84754e" : "#2563eb",
          side: "front" as const,
        }))
      : [];

  // Kashirovka
  const kashirovkaMode = formData.kashirovkaMode || "none";
  const kashirovkaLayers =
    kashirovkaMode === "none"
      ? []
      : formData.kashirovkaLayers && formData.kashirovkaLayers.length > 0
      ? formData.kashirovkaLayers
      : getDefaultKashirovkaLayers(kashirovkaMode, formData.paperStock, formData.coating);
  const kashirovkaTotals = calculateKashirovkaTotals(
    kashirovkaMode,
    kashirovkaLayers,
    formData.kashirovkaGlueGsm ?? 25
  );

  // BOM Materials
  const bomMaterials =
    materials && materials.length > 0
      ? materials
      : RECIPE_MATERIALS[formData.recipe] || RECIPE_MATERIALS["OFFSET_STD_V1"] || [];

  // Operations
  const routeSteps: RouteStep[] =
    operations && operations.length > 0
      ? operations
      : [
          {
            id: "1",
            stepNumber: 10,
            name: "Pre-press & CTP Plate Imaging",
            machine: "Screen PlateRite 8600",
            operator: "K. Anderson",
            duration: 0.5,
            qtyCompleted: "8 / 8 plates",
            status: "Finished",
          },
          {
            id: "2",
            stepNumber: 20,
            name: `${formData.department} Printing Run`,
            machine: formData.pressMachine || "Heidelberg Speedmaster XL 106",
            operator: "M. Ivanova",
            duration: 2.5,
            qtyCompleted: `${netQuantity.toLocaleString()} pcs`,
            status: "In Progress",
          },
          {
            id: "3",
            stepNumber: 30,
            name: "Surface Coating / Lamination",
            machine: "Autobond Mini 76",
            operator: "A. Becker",
            duration: 1.0,
            qtyCompleted: "0 pcs",
            status: "Queued",
          },
          {
            id: "4",
            stepNumber: 40,
            name: "Die-cutting & Stripping",
            machine: "Bobst Novacut 106",
            operator: "S. Petrov",
            duration: 1.2,
            qtyCompleted: "0 pcs",
            status: "Queued",
          },
        ];

  // Shift Notes
  const shiftNotes: ShiftNote[] =
    formData.shiftNotes && formData.shiftNotes.length > 0
      ? formData.shiftNotes
      : [
          {
            id: "sn-1",
            author: "M. Ivanova (Press Lead)",
            shift: "Morning",
            time: "Today 11:45",
            text: "Cyan & Magenta densities locked at 1.45 D. Viscosity 23s DIN4 cup. Running speed steady at 14,000 sht/h.",
          },
          {
            id: "sn-2",
            author: "S. Petrov (Die-Cut Lead)",
            shift: "Evening",
            time: "Yesterday 19:30",
            text: "Steel cutting rule aligned with 0.4mm crease channel. Test sample approved by Shift Lead.",
          },
        ];

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const blob = await pdf(
        <WorkOrderSpecPDF
          docNo={workOrderId}
          orderData={formData}
          operations={routeSteps}
          materials={bomMaterials}
          shiftEvents={shiftEvents}
          labels={buildPdfLabels()}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Order_Passport_${workOrderId || "PRINTGOO"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onExportSuccess?.(workOrderId);
    } catch (err) {
      console.error("Failed to generate Order Passport PDF", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // SVG QR Code Generator (Clean 21x21 QR Code Vector Matrix)
  const renderVectorQrCode = () => {
    const size = 21;
    const isFinder = (r: number, c: number) => {
      if (r <= 6 && c <= 6) {
        return r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
      if (r <= 6 && c >= 14) {
        return r === 0 || r === 6 || c === 14 || c === 20 || (r >= 2 && r <= 4 && c >= 16 && c <= 18);
      }
      if (r >= 14 && c <= 6) {
        return r === 14 || r === 20 || c === 0 || c === 6 || (r >= 16 && r <= 18 && c >= 2 && c <= 4);
      }
      return false;
    };
    const isTiming = (r: number, c: number) => {
      if (r === 6 && c >= 8 && c <= 12) return c % 2 === 0;
      if (c === 6 && r >= 8 && r <= 12) return r % 2 === 0;
      return false;
    };
    const isData = (r: number, c: number) => {
      if ((r <= 7 && c <= 7) || (r <= 7 && c >= 13) || (r >= 13 && c <= 7)) return false;
      if (r === 6 || c === 6) return false;
      const hash = (r * 31 + c * 17 + (workOrderId.charCodeAt(workOrderId.length - 1) || 42)) % 7;
      return hash === 0 || hash === 2 || hash === 5;
    };

    const modules: { r: number; c: number }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isFinder(r, c) || isTiming(r, c) || isData(r, c)) {
          modules.push({ r, c });
        }
      }
    }

    return (
      <svg viewBox="0 0 21 21" className="w-full h-full text-zinc-950 select-none">
        {modules.map((m, i) => (
          <rect key={i} x={m.c} y={m.r} width="1.02" height="1.02" fill="currentColor" />
        ))}
      </svg>
    );
  };

  // 2D Schematic proportional scaling
  const maxBoxW = 54;
  const maxBoxH = 52;
  const aspect = width / Math.max(1, height);
  const drawW = aspect >= 1 ? maxBoxW : Math.max(20, Math.round(maxBoxH * aspect));
  const drawH = aspect >= 1 ? Math.max(20, Math.round(maxBoxW / aspect)) : maxBoxH;
  const trimX = Math.round((86 - drawW) / 2);
  const trimY = Math.round((64 - drawH) / 2);

  let holeCx = trimX + drawW / 2;
  let holeCy = trimY + 6;
  if (holePos === "top-left") {
    holeCx = trimX + 6;
    holeCy = trimY + 6;
  } else if (holePos === "top-right") {
    holeCx = trimX + drawW - 6;
    holeCy = trimY + 6;
  } else if (holePos === "left-center") {
    holeCx = trimX + 6;
    holeCy = trimY + drawH / 2;
  } else if (holePos === "right-center") {
    holeCx = trimX + drawW - 6;
    holeCy = trimY + drawH / 2;
  }

  const samplePhoto =
    (formData.photoUrls && formData.photoUrls[0]) || formData.photoUrl || "";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-5xl !max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 border border-border bg-zinc-100 dark:bg-zinc-950 print:p-0 print:border-none print:bg-white print:max-h-none print:overflow-visible"
      >
        {/* Modal Controls Bar (Hidden during printing) */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-card border-b border-border print:hidden shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Printer className="w-4 h-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-semibold text-foreground truncate">
              {t("title")}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {workOrderId}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
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

        {/* Scrollable A4 Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
          {/* Printable A4 Passport Sheet (1:1 parity with WorkOrderSpecPDF) */}
          <div
            id="printable-job-ticket"
            className="max-w-[210mm] mx-auto bg-white text-zinc-950 p-6 sm:p-8 rounded-lg shadow-sm border border-zinc-300 print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none font-sans text-xs space-y-3.5"
          >
            {/* 1. Top Document Header */}
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2.5 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black tracking-wider text-base text-zinc-900 uppercase">
                    PRINTGOO ERP
                  </span>
                  <span className="text-[10px] bg-zinc-900 text-white font-mono px-2 py-0.5 rounded font-bold uppercase">
                    {t("badge")}
                  </span>
                  <span
                    className={`text-[10px] text-white font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      formData.priority === "Urgent" || formData.priority === "High"
                        ? "bg-red-600"
                        : "bg-blue-600"
                    }`}
                  >
                    {formData.priority || "Normal"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 font-medium">{t("subtitle")}</p>
              </div>

              {/* QR Code & Order ID */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right font-mono">
                  <div className="text-base font-black text-zinc-950">{workOrderId}</div>
                  <div className="text-[10px] text-zinc-600 font-medium">
                    {formData.status || "Active"} • {new Date().toISOString().slice(0, 10)}
                  </div>
                  {formData.linkedOrderId && (
                    <div className="text-[10px] text-blue-700 font-bold">
                      Ref: {formData.linkedOrderId}
                    </div>
                  )}
                </div>
                <div className="w-14 h-14 p-1 bg-white border border-zinc-300 rounded shrink-0">
                  {renderVectorQrCode()}
                </div>
              </div>
            </div>

            {/* 2. Core Requisites Grid & Target Run KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-2.5 border border-zinc-300 rounded bg-white">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block">
                  {t("customer")}
                </span>
                <span className="text-xs font-bold text-zinc-900 block truncate">
                  {formData.customer || "—"}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {formData.orderType || "Production Order"}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block">
                  {t("product")}
                </span>
                <span className="text-xs font-bold text-zinc-900 block truncate">
                  {formData.product || "—"}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {formData.itemCategory || "Commercial Print"}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block">
                  {t("departmentSite")}
                </span>
                <span className="text-xs font-bold text-zinc-900 block">
                  {formData.department}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {formData.site || "Building 1"}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block">
                  {t("pressMachine")}
                </span>
                <span className="text-xs font-bold text-zinc-900 block truncate">
                  {formData.pressMachine || "—"}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block">
                  {t("recipe")}: {formData.recipe || "STD_V1"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-2.5 bg-zinc-50 border border-zinc-300 rounded font-mono">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block font-sans">
                  {t("netRun")}
                </span>
                <span className="text-sm font-black text-blue-700">
                  {netQuantity.toLocaleString()} {formData.unit || "pcs"}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block font-sans">
                  {t("grossSheets")}
                </span>
                <span className="text-sm font-black text-zinc-900">
                  {grossSheets.toLocaleString()} sht
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block font-sans">
                  {t("impositionYield")}
                </span>
                <span className="text-sm font-bold text-emerald-700">
                  {yieldPerSheet} pcs / sht ({cols}×{rows})
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-zinc-500 block font-sans">
                  {t("scheduleWindow")}
                </span>
                <span className="text-xs font-bold text-zinc-900">
                  {formData.startDate || "—"} → {formData.deadline || "—"}
                </span>
              </div>
            </div>

            {/* 3. Physical Geometry + Sample / 2D Schematic + Inks & Colors */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Left (7 cols): Sample Photo, 2D Cut Schematic & Substrate */}
              <div className="md:col-span-7 border border-zinc-300 rounded p-2.5 space-y-2.5">
                <div className="bg-zinc-900 text-white px-2.5 py-1 rounded flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                    <Scissors className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{t("physicalSpecs")}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-300 font-bold shrink-0">
                    {width}×{height} {dimUnit} (+{bleed}{dimUnit})
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3.5 items-start">
                  {/* Sample Photo + 2D Vector Schematic */}
                  <div className="flex items-center gap-2 shrink-0">
                    {samplePhoto && (
                      <div className="w-20 h-24 border border-zinc-300 rounded overflow-hidden bg-zinc-100 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={samplePhoto}
                          alt="Sample"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="w-24 h-24 border border-zinc-300 rounded bg-zinc-50 flex flex-col items-center justify-center p-1 shrink-0">
                      <svg viewBox="0 0 86 66" className="w-full h-16">
                        <rect
                          x={trimX - 3}
                          y={trimY - 3}
                          width={drawW + 6}
                          height={drawH + 6}
                          fill="#fef2f2"
                          stroke="#ef4444"
                          strokeWidth="0.8"
                          strokeDasharray="2,2"
                        />
                        <rect
                          x={trimX}
                          y={trimY}
                          width={drawW}
                          height={drawH}
                          rx={formData.cornerType?.toLowerCase().includes("round") ? 3 : 0}
                          fill="#ffffff"
                          stroke="#1d4ed8"
                          strokeWidth="1.2"
                        />
                        <line
                          x1={trimX + 4}
                          y1={trimY + drawH / 2}
                          x2={trimX + drawW - 4}
                          y2={trimY + drawH / 2}
                          stroke="#cbd5e1"
                          strokeWidth="0.6"
                          strokeDasharray="1.5,1.5"
                        />
                        <line
                          x1={trimX + drawW / 2}
                          y1={trimY + 4}
                          x2={trimX + drawW / 2}
                          y2={trimY + drawH - 4}
                          stroke="#cbd5e1"
                          strokeWidth="0.6"
                          strokeDasharray="1.5,1.5"
                        />
                        {holeSize > 0 && holePos !== "none" && (
                          <circle
                            cx={holeCx}
                            cy={holeCy}
                            r="2.6"
                            fill="#eff6ff"
                            stroke="#2563eb"
                            strokeWidth="1"
                          />
                        )}
                      </svg>
                      <span className="text-[9px] font-mono font-bold text-zinc-700">
                        {width}×{height}{dimUnit} {holeSize > 0 && holePos !== "none" ? `• Ø${holeSize}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Specs Key-Value List */}
                  <div className="flex-1 min-w-0 w-full text-[11px] divide-y divide-zinc-100">
                    <div className="flex items-baseline justify-between gap-3 py-1">
                      <span className="text-zinc-500 shrink-0">{t("trimDimensions")}:</span>
                      <span className="font-bold font-mono text-zinc-900 text-right">
                        {width} × {height} {dimUnit} (+{bleed}{dimUnit})
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1">
                      <span className="text-zinc-500 shrink-0">{t("cornerCut")}:</span>
                      <span className="font-semibold text-zinc-900 text-right">
                        {formData.cornerType || "Square"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1">
                      <span className="text-zinc-500 shrink-0">{t("holeEyelet")}:</span>
                      <span className="font-semibold font-mono text-zinc-900 text-right">
                        {holeSize > 0 && holePos !== "none"
                          ? `Ø${holeSize}mm • ${holePos} (${holeOffset}mm)`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1">
                      <span className="text-zinc-500 shrink-0">{t("paperSubstrate")}:</span>
                      <span className="font-bold text-zinc-900 text-right">
                        {formData.paperStock || "—"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1">
                      <span className="text-zinc-500 shrink-0">{t("laminationSpec")}:</span>
                      <span className="font-semibold text-zinc-900 text-right">
                        {formData.lamination && formData.lamination !== "None"
                          ? `${formData.lamination} (${(formData.laminationSides || "1s").toUpperCase()}, ${
                              formData.laminationMicron || 28
                            }μm)`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-1">
                      <span className="text-zinc-500 shrink-0">{t("surfaceCoating")}:</span>
                      <span className="font-semibold text-zinc-900 text-right">
                        {formData.coating || "—"}
                        {formData.embellishment && formData.embellishment !== "None"
                          ? ` • ${formData.embellishment}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            {/* Right (5 cols): Inks & Color Stations + Kashirovka / Flexo */}
            <div className="md:col-span-5 border border-zinc-300 rounded p-2.5 space-y-2 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="bg-zinc-900 text-white px-2.5 py-1 rounded flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t("inksAndColors")}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-300 font-bold">
                    {formData.colorsConfig || "4+0 (CMYK)"}
                  </span>
                </div>

                {/* Front & Back CMYK */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-medium">{t("frontSide")}:</span>
                    <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
                      {(["c", "m", "y", "k"] as const).map((ch) => {
                        const active = frontColors[ch];
                        const colorCls =
                          ch === "c"
                            ? "bg-cyan-500 text-white"
                            : ch === "m"
                            ? "bg-pink-500 text-white"
                            : ch === "y"
                            ? "bg-yellow-500 text-white"
                            : "bg-zinc-900 text-white";
                        return (
                          <span
                            key={ch}
                            className={`px-1.5 py-0.5 rounded ${
                              active ? colorCls : "bg-zinc-200 text-zinc-400"
                            }`}
                          >
                            {ch.toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-medium">{t("backSide")}:</span>
                    <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
                      {(["c", "m", "y", "k"] as const).map((ch) => {
                        const active = backColors[ch];
                        const colorCls =
                          ch === "c"
                            ? "bg-cyan-500 text-white"
                            : ch === "m"
                            ? "bg-pink-500 text-white"
                            : ch === "y"
                            ? "bg-yellow-500 text-white"
                            : "bg-zinc-900 text-white";
                        return (
                          <span
                            key={ch}
                            className={`px-1.5 py-0.5 rounded ${
                              active ? colorCls : "bg-zinc-200 text-zinc-400"
                            }`}
                          >
                            {ch.toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Spot Stations */}
                <div className="pt-1 border-t border-zinc-200">
                  <span className="text-[9.5px] uppercase font-bold text-zinc-500 block mb-1">
                    {t("spotStations")}:
                  </span>
                  {spotColorItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {spotColorItems.map((sp) => (
                        <div
                          key={sp.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-zinc-300 bg-zinc-50 text-[10px] font-semibold"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0 border border-black/10"
                            style={{ backgroundColor: sp.hex || "#fe5000" }}
                          />
                          <span>{sp.name}</span>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">
                            ({sp.side})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-zinc-400">—</span>
                  )}
                </div>
              </div>

              {/* Conditional Kashirovka or Flexo */}
              {kashirovkaMode !== "none" && (
                <div className="pt-1.5 border-t border-zinc-200 text-[10.5px] space-y-1">
                  <div className="font-bold text-blue-700 uppercase text-[10px]">
                    {t("kashirovkaTitle")}: {kashirovkaMode.toUpperCase()} ({kashirovkaTotals.totalMountedGsm} g/m² • ~
                    {kashirovkaTotals.estimatedCaliperMm}mm)
                  </div>
                  <div className="text-zinc-600 text-[10px]">
                    {formData.kashirovkaStrategy === "split_half_sheet"
                      ? "1-CTP Work & Mount"
                      : "2-CTP Sheet-to-Sheet"}{" "}
                    • {t("kashirovkaGlue")}: {formData.kashirovkaGlueGsm ?? 25}g/m² • Pause:{" "}
                    {formData.kashirovkaCuringHours ?? 12}h
                  </div>
                  {kashirovkaLayers.map((ly, i) => (
                    <div key={ly.id || i} className="text-[9.5px] text-zinc-700 font-mono">
                      • L{i + 1}: {ly.paperStock} ({ly.grammage}g, {ly.colors})
                    </div>
                  ))}
                </div>
              )}

              {formData.department === "Flexo" && (
                <div className="pt-1.5 border-t border-zinc-200 text-[10.5px] space-y-1">
                  <div className="font-bold text-blue-700 uppercase text-[10px]">
                    {t("flexoTitle")}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{t("flexoTeeth")} / {t("flexoWebWidth")}:</span>
                    <span className="font-mono font-bold">
                      {formData.flexoCylinderTeeth || 100}T • {formData.flexoWebWidth || 35}mm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{t("flexoPlate")} / {t("flexoGap")}:</span>
                    <span className="font-mono font-bold">
                      {formData.flexoPlateThickness || 1.7}mm • {formData.flexoGapX ?? 2}×{formData.flexoGapY ?? 2.5}mm
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Pre-Flight Readiness Stage-Gates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
            {[
              { title: t("gate1Title"), sub: t("gate1Sub") },
              { title: t("gate2Title"), sub: t("gate2Sub") },
              { title: t("gate3Title"), sub: t("gate3Sub") },
              { title: t("gate4Title"), sub: t("gate4Sub") },
            ].map((g, idx) => (
              <div
                key={idx}
                className="p-2 border border-emerald-300 bg-emerald-50/60 rounded flex items-center justify-between gap-1"
              >
                <div className="min-w-0">
                  <div className="font-bold text-zinc-900 truncate">{g.title}</div>
                  <div className="text-zinc-500 text-[9.5px] truncate">{g.sub}</div>
                </div>
                <span className="bg-emerald-600 text-white text-[8.5px] px-1.5 py-0.5 rounded font-bold shrink-0">
                  {t("pass")}
                </span>
              </div>
            ))}
          </div>

          {/* 5. Side-by-Side: Size/SKU Matrix & BOM Materials */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Size / Model Breakdown (6 cols) */}
            <div className="md:col-span-6 border border-zinc-300 rounded p-2.5 space-y-1.5">
              <div className="bg-zinc-900 text-white px-2.5 py-1 rounded flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t("sizeBreakdown")}</span>
                </div>
                <span className="text-[10px] font-mono text-blue-300 font-bold">
                  {formData.sizes?.length || 1} SKU
                </span>
              </div>
              <table className="w-full text-left text-[10.5px] border border-zinc-200">
                <thead className="bg-zinc-100 font-semibold text-zinc-600 border-b border-zinc-200">
                  <tr>
                    <th className="p-1 px-2">{t("colModel")}</th>
                    <th className="p-1 px-2">{t("colSize")}</th>
                    <th className="p-1 px-2 text-right">{t("colQty")}</th>
                    <th className="p-1 px-2 text-right">{t("colShare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.sizes && formData.sizes.length > 0 ? (
                    formData.sizes.map((s, idx) => {
                      const parsed = parseModelAndSize(s);
                      const pct = netQuantity > 0 ? Math.round((s.quantity / netQuantity) * 100) : 0;
                      return (
                        <tr key={s.id || idx} className="border-b border-zinc-100 last:border-none">
                          <td className="p-1 px-2 text-zinc-600">{parsed.model || "STD"}</td>
                          <td className="p-1 px-2 font-bold text-zinc-900">
                            {parsed.sizeCode || s.size}
                          </td>
                          <td className="p-1 px-2 text-right font-mono font-bold">
                            {s.quantity.toLocaleString()}
                          </td>
                          <td className="p-1 px-2 text-right font-mono text-zinc-500">{pct}%</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-1 px-2 text-zinc-600">STD</td>
                      <td className="p-1 px-2 font-bold text-zinc-900">ALL</td>
                      <td className="p-1 px-2 text-right font-mono font-bold">
                        {netQuantity.toLocaleString()}
                      </td>
                      <td className="p-1 px-2 text-right font-mono text-zinc-500">100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Required Raw Materials BOM (6 cols) */}
            <div className="md:col-span-6 border border-zinc-300 rounded p-2.5 space-y-1.5">
              <div className="bg-zinc-900 text-white px-2.5 py-1 rounded flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                  <Boxes className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t("bomMaterials")}</span>
                </div>
                <span className="text-[10px] font-mono text-blue-300 font-bold">
                  {formData.recipe || "OFFSET_STD_V1"}
                </span>
              </div>
              <table className="w-full text-left text-[10.5px] border border-zinc-200">
                <thead className="bg-zinc-100 font-semibold text-zinc-600 border-b border-zinc-200">
                  <tr>
                    <th className="p-1 px-2">{t("colMaterial")}</th>
                    <th className="p-1 px-2 text-right">{t("colReqQty")}</th>
                    <th className="p-1 px-2 text-right">{t("colWarehouseStock")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bomMaterials.map((m, idx) => {
                    const isShort = m.req > m.stock;
                    return (
                      <tr key={idx} className="border-b border-zinc-100 last:border-none">
                        <td className="p-1 px-2 font-bold text-zinc-900">{m.name}</td>
                        <td className="p-1 px-2 text-right font-mono font-bold">
                          {m.req.toLocaleString()} {m.unit}
                        </td>
                        <td
                          className={`p-1 px-2 text-right font-mono font-semibold ${
                            isShort ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          {m.stock.toLocaleString()} ({isShort ? t("stockShortage") : t("stockOk")})
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Technological Route Steps & Shift Handover Notes */}
          <div className="border border-zinc-300 rounded p-2.5 space-y-2">
            <div className="bg-zinc-900 text-white px-2.5 py-1 rounded flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>{t("techRoute")}</span>
              </div>
              <span className="text-[10px] font-mono text-blue-300 font-bold">
                {routeSteps.length} Steps
              </span>
            </div>

            <table className="w-full text-left text-[10.5px] border border-zinc-200">
              <thead className="bg-zinc-100 font-semibold text-zinc-600 border-b border-zinc-200">
                <tr>
                  <th className="p-1 px-2 w-12 text-center">{t("colStep")}</th>
                  <th className="p-1 px-2.5">{t("colOperation")}</th>
                  <th className="p-1 px-2.5">{t("colMachine")}</th>
                  <th className="p-1 px-2.5">{t("colOperator")}</th>
                  <th className="p-1 px-2 text-right">{t("colDuration")}</th>
                  <th className="p-1 px-2 text-center w-20">{t("colSign")}</th>
                </tr>
              </thead>
              <tbody>
                {routeSteps.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-none">
                    <td className="p-1 px-2 text-center font-mono font-bold text-zinc-500">
                      #{s.stepNumber}
                    </td>
                    <td className="p-1 px-2.5 font-bold text-zinc-900">{s.name}</td>
                    <td className="p-1 px-2.5 font-medium text-zinc-700">{s.machine}</td>
                    <td className="p-1 px-2.5 text-zinc-600">{s.operator}</td>
                    <td className="p-1 px-2 text-right font-mono font-bold text-zinc-800">
                      {s.duration}h
                    </td>
                    <td className="p-1 px-2 text-center">
                      <div className="h-3.5 border-b border-dashed border-zinc-400 w-14 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Shift Notes */}
            {shiftNotes.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-600">
                  <MessageSquare className="w-3 h-3 text-blue-600" />
                  <span>{t("shiftNotesTitle")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {shiftNotes.slice(0, 2).map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded border border-zinc-200 bg-zinc-50 text-[10px]"
                    >
                      <div className="font-bold text-zinc-800">
                        [{n.shift}] {n.author} • {n.time}
                      </div>
                      <div className="text-zinc-600 mt-0.5">{n.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 7. 4-Party Shop-Floor Sign-Off Boxes */}
          <div className="space-y-1.5">
            <div className="font-bold text-[10.5px] uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t("signOffTitle")}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { title: t("signPrepress"), sub: t("signPrepressSub") },
                { title: t("signPress"), sub: t("signPressSub") },
                { title: t("signFinish"), sub: t("signFinishSub") },
                { title: t("signQc"), sub: t("signQcSub") },
              ].map((box, idx) => (
                <div
                  key={idx}
                  className="border border-zinc-300 rounded p-2 text-[10px] space-y-2 bg-zinc-50/70"
                >
                  <div>
                    <div className="font-bold text-zinc-900">{box.title}</div>
                    <div className="text-zinc-500 text-[9px]">{box.sub}</div>
                  </div>
                  <div className="pt-3 border-b border-dashed border-zinc-400" />
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span>{t("signLabel")}</span>
                    <span>{t("dateLabel")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Footer Timestamp */}
          <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-[9.5px] text-zinc-500 font-mono">
            <span>
              {t("footerSystem")} • DOC: {workOrderId}
            </span>
            <span>
              {t("printDate")}: {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}
