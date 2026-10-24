"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Printer,
  Download,
  X,
  RefreshCw,
  Image as ImageIcon,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
import type { OrderRow } from "./DataGrid";
import type { RegistryPrintRow, WorkOrdersRegistryPdfLabels } from "./WorkOrdersRegistryPDF";
import { evaluateOrderReadiness } from "@/components/documents/work-order/utils/readinessEngine";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface WorkOrdersPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: OrderRow[];
}

/**
 * Resolves the best thumbnail candidate for a Work Order row using the Smart Fallback chain:
 * 1. Proof Sample (photoUrl / photoUrls[0])
 * 2. Main Front Artwork (artworkFront)
 * 3. First SKU Size Artwork Thumbnail (skuArtworks[0].frontArtworkThumb)
 */
function pickSmartThumbnailCandidate(row: OrderRow): {
  url: string | null;
  sourceType: "proof" | "artwork" | "sku" | null;
} {
  const raw = row.rawOrder || {};
  const dims = raw.dimensions || {};

  // 1. Proof Sample
  if (Array.isArray(row.preview) && row.preview.length > 0 && row.preview[0]) {
    return { url: row.preview[0], sourceType: "proof" };
  }
  if (typeof raw.photoUrl === "string" && raw.photoUrl.trim().length > 0) {
    return { url: raw.photoUrl.trim(), sourceType: "proof" };
  }
  if (Array.isArray(raw.photoUrls) && raw.photoUrls.length > 0 && raw.photoUrls[0]) {
    return { url: String(raw.photoUrls[0]).trim(), sourceType: "proof" };
  }

  // 2. Main Front Artwork (if image or data URI, not raw .pdf url)
  const artFront = raw.artworkFront || dims.artworkFront;
  if (
    typeof artFront === "string" &&
    artFront.trim().length > 0 &&
    !artFront.toLowerCase().endsWith(".pdf")
  ) {
    return { url: artFront.trim(), sourceType: "artwork" };
  }

  // 3. First SKU Size Artwork Thumbnail (frontArtworkThumb or backArtworkThumb)
  const skuList = Array.isArray(raw.skuArtworks)
    ? raw.skuArtworks
    : Array.isArray(dims.skuArtworks)
    ? dims.skuArtworks
    : [];
  for (const sku of skuList) {
    if (sku?.frontArtworkThumb && typeof sku.frontArtworkThumb === "string") {
      return { url: sku.frontArtworkThumb, sourceType: "sku" };
    }
    if (sku?.backArtworkThumb && typeof sku.backArtworkThumb === "string") {
      return { url: sku.backArtworkThumb, sourceType: "sku" };
    }
  }

  return { url: null, sourceType: null };
}

/**
 * Converts any browser-accessible image URL (including WebP, SVG, relative /api/... or Data URI)
 * into a compact PNG Data URL so @react-pdf/renderer can embed it without format or CORS failures.
 */
async function rasterizeImageToPngDataUrl(src: string): Promise<string | undefined> {
  if (typeof window === "undefined" || !src) return undefined;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => {
      resolve(undefined);
    }, 3500);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const maxDim = 96;
        const w = img.naturalWidth || 96;
        const h = img.naturalHeight || 96;
        const scale = Math.min(maxDim / Math.max(1, w), maxDim / Math.max(1, h), 1);
        const targetW = Math.max(16, Math.round(w * scale));
        const targetH = Math.max(16, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(src.startsWith("data:image/png") || src.startsWith("data:image/jpeg") ? src : undefined);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(undefined);
    };

    img.src = src;
  });
}

export function WorkOrdersPrintModal({
  open,
  onOpenChange,
  rows,
}: WorkOrdersPrintModalProps) {
  const tGrid = useTranslations("DataGrid");
  const tCommon = useTranslations("Common");
  const warehouseStock = useWorkspaceStore((s) => s.warehouseStock);

  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [machineFilter, setMachineFilter] = useState<string>("ALL");
  const [statusMode, setStatusMode] = useState<"ACTIVE_AND_DRAFT" | "ONLY_ACTIVE">("ACTIVE_AND_DRAFT");
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Strict non-completed & non-cancelled base rows
  const nonCompletedRows = useMemo(() => {
    return rows.filter((r) => {
      const st = (r.status || "").toLowerCase();
      const stage = (r.rawOrder?.stage || "").toLowerCase();
      if (st === "completed" || st === "cancelled" || stage === "completed") {
        return false;
      }
      return true;
    });
  }, [rows]);

  // Dynamic filter options extracted from active work orders
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    nonCompletedRows.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [nonCompletedRows]);

  const availableSites = useMemo(() => {
    const set = new Set<string>();
    nonCompletedRows.forEach((r) => {
      if (r.site) set.add(r.site);
    });
    return Array.from(set);
  }, [nonCompletedRows]);

  const availableMachines = useMemo(() => {
    const set = new Set<string>();
    nonCompletedRows.forEach((r) => {
      if (deptFilter !== "ALL" && r.department !== deptFilter) return;
      if (r.machine && r.machine.trim().length > 0) {
        set.add(r.machine.trim());
      }
    });
    return Array.from(set);
  }, [nonCompletedRows, deptFilter]);

  // Reset machine filter if department changes and machine is no longer in list
  useEffect(() => {
    if (machineFilter !== "ALL" && !availableMachines.includes(machineFilter)) {
      setMachineFilter("ALL");
    }
  }, [availableMachines, machineFilter]);

  // Filtered rows ready for PDF generation
  const printableRows = useMemo(() => {
    return nonCompletedRows.filter((r) => {
      if (statusMode === "ONLY_ACTIVE" && r.status === "Draft") {
        return false;
      }
      if (deptFilter !== "ALL" && r.department !== deptFilter) {
        return false;
      }
      if (siteFilter !== "ALL" && r.site !== siteFilter) {
        return false;
      }
      if (machineFilter !== "ALL" && r.machine !== machineFilter) {
        return false;
      }
      return true;
    });
  }, [nonCompletedRows, statusMode, deptFilter, siteFilter, machineFilter]);

  const pdfLabels = useMemo<WorkOrdersRegistryPdfLabels>(
    () => ({
      title: tGrid("registryPrintTitle"),
      colSketch: tGrid("colSketch"),
      colDocDeadline: tGrid("colDocDeadline"),
      colCustomerProduct: tGrid("colCustomerProduct"),
      colMachineOperator: tGrid("colMachineOperator"),
      colQtySizes: tGrid("colQtySizes"),
      colTechSpecs: tGrid("colTechSpecs"),
      colGates: tGrid("colGates"),
      colStateSample: tGrid("colStateSample"),
      colNote: tGrid("colNote"),
      deptOrdersCount: tGrid("deptOrdersCount", { count: "{count}" }),
      totalQtyLabel: tGrid("totalQtyLabel"),
      pageLabel: tGrid("pageLabel"),
      statusActive: tCommon("statusActive"),
      statusDraft: tCommon("statusDraft"),
      priorityUrgent: tCommon("priorityUrgent"),
      priorityHigh: tCommon("priorityHigh"),
      priorityNormal: tCommon("priorityNormal"),
    }),
    [tGrid, tCommon]
  );

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];
    parts.push(deptFilter === "ALL" ? tGrid("allDepartments") : deptFilter);
    if (siteFilter !== "ALL") parts.push(siteFilter);
    if (machineFilter !== "ALL") parts.push(machineFilter);
    parts.push(
      statusMode === "ONLY_ACTIVE"
        ? tGrid("statusOnlyActive")
        : tGrid("statusActiveAndDraft")
    );
    return parts.join(" • ");
  }, [deptFilter, siteFilter, machineFilter, statusMode, tGrid]);

  const generatePdf = useCallback(async () => {
    if (!open) return;
    if (printableRows.length === 0) {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    setIsGenerating(true);
    try {
      const enrichedRows: RegistryPrintRow[] = await Promise.all(
        printableRows.map(async (row) => {
          const evaluatedChecks = evaluateOrderReadiness(
            row.rawOrder || row,
            warehouseStock || []
          );
          let resolvedThumbUrl: string | undefined = undefined;
          let thumbSourceType: "proof" | "artwork" | "sku" | null = null;

          if (showThumbnails) {
            const candidate = pickSmartThumbnailCandidate(row);
            thumbSourceType = candidate.sourceType;
            if (candidate.url) {
              resolvedThumbUrl = await rasterizeImageToPngDataUrl(candidate.url);
            }
          }

          return {
            ...row,
            evaluatedChecks,
            resolvedThumbUrl,
            thumbSourceType,
          };
        })
      );

      const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
      const { pdf } = await import("@react-pdf/renderer");
      const { WorkOrdersRegistryPDF } = await import("./WorkOrdersRegistryPDF");

      const blob = await pdf(
        <WorkOrdersRegistryPDF
          rows={enrichedRows}
          orientation={orientation}
          showThumbnails={showThumbnails}
          filterSummaryText={filterSummaryText}
          generatedAt={nowStr}
          labels={pdfLabels}
        />
      ).toBlob();

      const nextUrl = URL.createObjectURL(blob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (err) {
      console.error("Failed to generate Work Orders Registry PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    open,
    printableRows,
    warehouseStock,
    showThumbnails,
    orientation,
    filterSummaryText,
    pdfLabels,
  ]);

  useEffect(() => {
    if (open) {
      generatePdf();
    } else {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open, generatePdf]);

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const datePart = new Date().toISOString().slice(0, 10);
    const deptPart = deptFilter === "ALL" ? "ALL" : deptFilter.toUpperCase();
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `WorkOrders_Registry_${deptPart}_${datePart}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!pdfBlobUrl) return;
    const printWin = window.open(pdfBlobUrl, "_blank");
    if (printWin) {
      printWin.addEventListener("load", () => {
        printWin.print();
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[96vw]! sm:max-w-[96vw]! h-[94vh] max-h-[94vh]! flex flex-col overflow-hidden p-0 gap-0 border border-border bg-background"
      >
        {/* High-Density Top Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-card border-b border-border">
          {/* Left: Title & Count */}
          <div className="flex items-center gap-2 min-w-0">
            <Printer className="size-4 text-primary shrink-0" />
            <DialogTitle className="text-xs font-semibold text-foreground truncate">
              {tGrid("registryPrintTitle")}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-[11px] h-5 px-1.5">
              {printableRows.length}
            </Badge>
          </div>

          {/* Center: Filter & Layout Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Orientation Toggle (Landscape vs Portrait) */}
            <div className="flex items-center bg-muted p-0.5 rounded border border-border">
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium transition-colors ${
                  orientation === "landscape"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <RectangleHorizontal className="size-3.5" />
                <span>{tGrid("orientationLandscape")}</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium transition-colors ${
                  orientation === "portrait"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <RectangleVertical className="size-3.5" />
                <span>{tGrid("orientationPortrait")}</span>
              </button>
            </div>

            {/* Department (Sex) Filter */}
            <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v || "ALL")}>
              <SelectTrigger className="h-7 text-xs w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  {tGrid("allDepartments")}
                </SelectItem>
                {availableDepartments.map((d) => (
                  <SelectItem key={d} value={d} className="text-xs">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Site (Hudud) Filter */}
            <Select value={siteFilter} onValueChange={(v) => setSiteFilter(v || "ALL")}>
              <SelectTrigger className="h-7 text-xs w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  {tGrid("allSites")}
                </SelectItem>
                {availableSites.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Machine Filter */}
            <Select value={machineFilter} onValueChange={(v) => setMachineFilter(v || "ALL")}>
              <SelectTrigger className="h-7 text-xs w-44 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  {tGrid("allMachines")}
                </SelectItem>
                {availableMachines.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Mode (Active+Draft vs Active Only) */}
            <Select
              value={statusMode}
              onValueChange={(v) =>
                setStatusMode((v as "ACTIVE_AND_DRAFT" | "ONLY_ACTIVE") || "ACTIVE_AND_DRAFT")
              }
            >
              <SelectTrigger className="h-7 text-xs w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE_AND_DRAFT" className="text-xs">
                  {tGrid("statusActiveAndDraft")}
                </SelectItem>
                <SelectItem value="ONLY_ACTIVE" className="text-xs">
                  {tGrid("statusOnlyActive")}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Thumbnail Toggle */}
            <Button
              type="button"
              variant={showThumbnails ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowThumbnails((prev) => !prev)}
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <ImageIcon className="size-3.5" />
              <span>{tGrid("showThumbnails")}</span>
            </Button>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generatePdf}
              disabled={isGenerating}
              className="h-7 px-2 text-xs"
              title={tCommon("refresh")}
            >
              <RefreshCw className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!pdfBlobUrl || isGenerating}
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <Download className="size-3.5" />
              <span>{tGrid("downloadPdf")}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={!pdfBlobUrl || isGenerating}
              className="h-7 px-2.5 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="size-3.5" />
              <span>{tGrid("printDocument")}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Main PDF Preview Viewport */}
        <div className="flex-1 w-full h-full bg-muted/40 relative flex items-center justify-center overflow-hidden">
          {isGenerating ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <RefreshCw className="size-4 animate-spin text-primary" />
              <span>{tGrid("generatingPdf")}</span>
            </div>
          ) : printableRows.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {tGrid("emptyPrintRows")}
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={`${pdfBlobUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={tGrid("registryPrintTitle")}
              className="w-full h-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
