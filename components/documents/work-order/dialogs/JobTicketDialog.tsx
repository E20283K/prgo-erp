"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Printer,
  X,
  CheckCircle2,
  QrCode,
  Scissors,
  FileCheck,
  Calendar,
  Layers,
  Sparkles,
  Building2,
  Cpu,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WorkOrderFormData,
  MasterSpecification,
  MachineOption,
  RouteStep,
} from "../types";

interface JobTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  formData: WorkOrderFormData;
  activeSpec?: MasterSpecification;
  activeMachine?: MachineOption;
  operations?: RouteStep[];
}

export function JobTicketDialog({
  isOpen,
  onOpenChange,
  workOrderId,
  formData,
  activeSpec,
  activeMachine,
  operations,
}: JobTicketDialogProps) {
  const t = useTranslations("JobTicket");
  const tOrder = useTranslations("OrderReadiness");

  const handlePrint = () => {
    window.print();
  };

  // Basic calculation for gross sheets & yield
  const width = formData.width || 50;
  const height = formData.height || 90;
  const bleed = formData.bleed ?? 2;
  const itemW = width + 2 * bleed;
  const itemH = height + 2 * bleed;

  // Assume B1 standard sheet (700 x 1000) for offset traveler
  const cols = Math.max(1, Math.floor(960 / (itemW + 2)));
  const rows = Math.max(1, Math.floor(660 / (itemH + 2)));
  const yieldPerSheet = Math.max(1, cols * rows);
  const netQuantity = formData.quantity || 5000;
  const grossSheets = Math.ceil((netQuantity / yieldPerSheet) * 1.05) + 50;

  // Fallback operations if not passed
  const routeSteps: RouteStep[] = operations && operations.length > 0
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

  // SVG QR Code Generator (Clean 21x21 QR Code Vector Matrix)
  const renderVectorQrCode = () => {
    // 21x21 QR Matrix representation with 3 corner finder patterns and pseudo-deterministic payload
    const size = 21;
    const isFinder = (r: number, c: number) => {
      // Top-Left (0..6, 0..6)
      if (r <= 6 && c <= 6) {
        return r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
      // Top-Right (0..6, 14..20)
      if (r <= 6 && c >= 14) {
        return r === 0 || r === 6 || c === 14 || c === 20 || (r >= 2 && r <= 4 && c >= 16 && c <= 18);
      }
      // Bottom-Left (14..20, 0..6)
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
      // Deterministic hash based on workOrderId
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
      <svg viewBox="0 0 21 21" className="w-full h-full text-zinc-950 dark:text-zinc-100 select-none">
        {modules.map((m, i) => (
          <rect key={i} x={m.c} y={m.r} width="1.01" height="1.01" fill="currentColor" />
        ))}
      </svg>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 print:p-0 print:border-none print:bg-white print:max-h-none print:overflow-visible">
        {/* Modal Controls Bar (Hidden during printing) */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-3 px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 print:hidden shadow-xs">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("title")}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {workOrderId}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("print")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <span>{t("close")}</span>
            </Button>
          </div>
        </div>

        {/* Printable Paper Canvas (Styled as standard A4 page with 10mm print margin) */}
        <div
          id="printable-job-ticket"
          className="bg-white text-zinc-950 p-6 sm:p-8 m-3 sm:m-6 rounded-lg shadow-sm border border-zinc-200 print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none font-sans text-xs"
        >
          {/* Top Document Header */}
          <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black tracking-wider text-base text-zinc-900 uppercase">
                  PRINTGOO ERP • SHOP-FLOOR TRAVELER
                </span>
                <span className="text-[10px] bg-zinc-900 text-white font-mono px-1.5 py-0.5 rounded font-bold">
                  НАРЯД-ЗАКАЗ
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 font-medium">
                {t("subtitle")}
              </p>
            </div>

            {/* QR Code & Order ID */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-14 h-14 p-1 bg-white border border-zinc-300 rounded shrink-0">
                {renderVectorQrCode()}
              </div>
              <div className="text-right font-mono">
                <div className="text-sm font-black text-zinc-950">{workOrderId}</div>
                <div className="text-[10px] text-zinc-500 font-medium">
                  {new Date().toISOString().slice(0, 10)}
                </div>
                <div className="text-[10px] font-bold uppercase text-red-600">
                  {formData.priority}
                </div>
              </div>
            </div>
          </div>

          {/* Core Requisites Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-zinc-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Customer / Заказчик</span>
              <span className="text-xs font-bold text-zinc-900 block truncate">{formData.customer || "Alpha Media"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Product / Изделие</span>
              <span className="text-xs font-bold text-zinc-900 block truncate">{formData.product || "Commercial Packaging"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Department & Site</span>
              <span className="text-xs font-semibold text-zinc-900 block">
                {formData.department} • {formData.site || "Building 1"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Primary Press Line</span>
              <span className="text-xs font-semibold text-zinc-900 block truncate">
                {formData.pressMachine || "Heidelberg Speedmaster XL 106"}
              </span>
            </div>
          </div>

          {/* Net Target Run & Gross Press Sheet Quantities */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded my-3 p-3 font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">{t("netRun")}</span>
              <span className="text-sm font-black text-blue-600">
                {netQuantity.toLocaleString()} {formData.unit}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">{t("grossSheets")}</span>
              <span className="text-sm font-black text-zinc-900">
                {grossSheets.toLocaleString()} sheets
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Imposition N-Up</span>
              <span className="text-sm font-bold text-emerald-600">
                {yieldPerSheet} pcs / sheet
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Shift Deadline</span>
              <span className="text-sm font-bold text-zinc-900">
                {formData.deadline || "2026-10-07"}
              </span>
            </div>
          </div>

          {/* Physical Specifications & Inks */}
          <div className="py-2.5 space-y-2">
            <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 border-b border-zinc-200 pb-1">
              <Scissors className="w-3.5 h-3.5 text-blue-600" />
              <span>{t("physicalSpecs")}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11.5px]">
              <div>
                <span className="text-zinc-500 font-medium">Trim Dimensions: </span>
                <span className="font-bold text-zinc-900 font-mono">
                  {width} × {height} {formData.dimensionUnit || "mm"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Bleed Margin: </span>
                <span className="font-bold text-zinc-900 font-mono">+{bleed} mm</span>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Cut / Shape: </span>
                <span className="font-semibold text-zinc-900">{formData.cornerType || "Square Cut"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500 font-medium">Paper Substrate: </span>
                <span className="font-bold text-zinc-900">
                  {formData.paperStock || "Galerie Art Silk 150g/m²"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Surface Finish: </span>
                <span className="font-semibold text-zinc-900">
                  {formData.coating || "Soft-Touch Matte + Spot UV"}
                </span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-zinc-500 font-medium">Inks & Stations: </span>
                <span className="font-bold text-zinc-900 font-mono">
                  {formData.colorsConfig || "4+0 (CMYK)"}
                  {formData.spotColors && formData.spotColors.length > 0 && (
                    <span className="text-blue-700 font-normal"> + {formData.spotColors.join(" • ")}</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Size / Variation Breakdown Table (if exists) */}
          {formData.sizes && formData.sizes.length > 0 && (
            <div className="py-2.5 space-y-1.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 border-b border-zinc-200 pb-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>{t("sizeBreakdown")}</span>
              </div>
              <table className="w-full text-left text-[11px] border border-zinc-200">
                <thead className="bg-zinc-100 font-semibold text-zinc-600 border-b border-zinc-200">
                  <tr>
                    <th className="p-1 px-2.5">Size / SKU Code</th>
                    <th className="p-1 px-2.5 text-right">Target Quantity</th>
                    <th className="p-1 px-2.5 text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.sizes.map((s, idx) => (
                    <tr key={s.id || idx} className="border-b border-zinc-100 last:border-none">
                      <td className="p-1 px-2.5 font-bold text-zinc-900">{s.size}</td>
                      <td className="p-1 px-2.5 text-right font-mono font-bold">{s.quantity.toLocaleString()} pcs</td>
                      <td className="p-1 px-2.5 text-right font-mono text-zinc-500">
                        {Math.round((s.quantity / netQuantity) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pre-Flight Gate Readiness Checklist */}
          <div className="py-2.5 space-y-2">
            <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 border-b border-zinc-200 pb-1">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t("readinessChecklist")}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
              <div className="p-2 border border-emerald-300 bg-emerald-50/50 rounded flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900">Gate 1: Artwork</div>
                  <div className="text-zinc-500 text-[9.5px]">Trapping & Bleeds</div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] px-1 py-0 font-bold">
                  {t("pass")}
                </Badge>
              </div>

              <div className="p-2 border border-emerald-300 bg-emerald-50/50 rounded flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900">Gate 2: Substrate</div>
                  <div className="text-zinc-500 text-[9.5px]">Pallets at Press</div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] px-1 py-0 font-bold">
                  {t("pass")}
                </Badge>
              </div>

              <div className="p-2 border border-emerald-300 bg-emerald-50/50 rounded flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900">Gate 3: CTP Plates</div>
                  <div className="text-zinc-500 text-[9.5px]">Linearized HD</div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] px-1 py-0 font-bold">
                  {t("pass")}
                </Badge>
              </div>

              <div className="p-2 border border-emerald-300 bg-emerald-50/50 rounded flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900">Gate 4: Tooling</div>
                  <div className="text-zinc-500 text-[9.5px]">Die Matrix Mounted</div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] px-1 py-0 font-bold">
                  {t("pass")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Technological Route Steps */}
          <div className="py-2.5 space-y-1.5">
            <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 flex items-center gap-1.5 border-b border-zinc-200 pb-1">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>{t("techRoute")}</span>
            </div>

            <table className="w-full text-left text-[11px] border border-zinc-200">
              <thead className="bg-zinc-100 font-semibold text-zinc-600 border-b border-zinc-200">
                <tr>
                  <th className="p-1 px-2 w-12 text-center">Step</th>
                  <th className="p-1 px-2.5">Operation Description</th>
                  <th className="p-1 px-2.5">Assigned Machine</th>
                  <th className="p-1 px-2.5">Operator</th>
                  <th className="p-1 px-2 text-right">Plan (h)</th>
                  <th className="p-1 px-2 text-center w-20">Sign</th>
                </tr>
              </thead>
              <tbody>
                {routeSteps.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-none">
                    <td className="p-1 px-2 text-center font-mono font-bold text-zinc-500">#{s.stepNumber}</td>
                    <td className="p-1 px-2.5 font-bold text-zinc-900">{s.name}</td>
                    <td className="p-1 px-2.5 font-medium text-zinc-700">{s.machine}</td>
                    <td className="p-1 px-2.5 text-zinc-600">{s.operator}</td>
                    <td className="p-1 px-2 text-right font-mono text-zinc-700">{s.duration}h</td>
                    <td className="p-1 px-2 text-center">
                      <div className="h-4 border-b border-dashed border-zinc-400 w-16 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4-Party Shop-Floor Sign-Off Boxes */}
          <div className="pt-3 space-y-1.5 mt-2">
            <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-700 border-b border-zinc-200 pb-1">
              {t("signOffTitle")}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Box 1 */}
              <div className="border border-zinc-300 rounded p-2 text-[10px] space-y-2 bg-zinc-50/50">
                <div className="font-bold text-zinc-900">{t("signPrepress")}</div>
                <div className="text-zinc-500 text-[9px]">CTP Master: Plates & RIP OK</div>
                <div className="pt-4 border-b border-zinc-400" />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Sign:</span>
                  <span>Date:</span>
                </div>
              </div>

              {/* Box 2 */}
              <div className="border border-zinc-300 rounded p-2 text-[10px] space-y-2 bg-zinc-50/50">
                <div className="font-bold text-zinc-900">{t("signPress")}</div>
                <div className="text-zinc-500 text-[9px]">Press Operator: Density & Run OK</div>
                <div className="pt-4 border-b border-zinc-400" />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Sign:</span>
                  <span>Date:</span>
                </div>
              </div>

              {/* Box 3 */}
              <div className="border border-zinc-300 rounded p-2 text-[10px] space-y-2 bg-zinc-50/50">
                <div className="font-bold text-zinc-900">{t("signFinish")}</div>
                <div className="text-zinc-500 text-[9px]">Post-press: Die Cut & Fold OK</div>
                <div className="pt-4 border-b border-zinc-400" />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Sign:</span>
                  <span>Date:</span>
                </div>
              </div>

              {/* Box 4 */}
              <div className="border border-zinc-300 rounded p-2 text-[10px] space-y-2 bg-zinc-50/50">
                <div className="font-bold text-zinc-900">{t("signQc")}</div>
                <div className="text-zinc-500 text-[9px]">QC / ОТК: Count & Dispatch OK</div>
                <div className="pt-4 border-b border-zinc-400" />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Sign:</span>
                  <span>Date:</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Timestamp */}
          <div className="pt-3 mt-3 border-t border-zinc-200 flex items-center justify-between text-[9.5px] text-zinc-400 font-mono">
            <span>PRINTGOO AUTOMATED TRAVELER SYSTEM • DOC: {workOrderId}</span>
            <span>PRINT DATE: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
