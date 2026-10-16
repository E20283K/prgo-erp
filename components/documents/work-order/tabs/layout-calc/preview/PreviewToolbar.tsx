import React from "react";
import { ChevronLeft, ChevronRight, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  activePlateIndex: number;
  totalPlates: number;
  requiredSheets: number;
  onPrevPlate: () => void;
  onNextPlate: () => void;
  onExportSVG: () => void;
  onExportPDFCurrent: () => void;
  onExportPDFAll?: () => void;
}

export function PreviewToolbar({
  activePlateIndex,
  totalPlates,
  requiredSheets,
  onPrevPlate,
  onNextPlate,
  onExportSVG,
  onExportPDFCurrent,
  onExportPDFAll,
}: Props) {
  return (
    <div className="flex items-center justify-between pb-2 border-b border-border mb-2 shrink-0">
      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-card border border-border rounded-md shadow-xs p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={activePlateIndex <= 0}
            onClick={onPrevPlate}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="px-2 font-medium text-xs text-foreground">
            Plate {activePlateIndex + 1} of {totalPlates}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={activePlateIndex >= totalPlates - 1}
            onClick={onNextPlate}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          ({requiredSheets.toLocaleString()} sheets for this plate)
        </span>
      </div>

      {/* Download Buttons */}
      <div className="flex items-center gap-1.5">
        <Button onClick={onExportSVG} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" />
          <span>SVG</span>
        </Button>
        <Button onClick={onExportPDFCurrent} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <FileDown className="w-3.5 h-3.5 text-red-500" />
          <span>PDF (Current)</span>
        </Button>
        {totalPlates > 1 && onExportPDFAll && (
          <Button
            onClick={onExportPDFAll}
            variant="default"
            size="sm"
            className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>PDF (All {totalPlates} Plates)</span>
          </Button>
        )}
      </div>
    </div>
  );
}
