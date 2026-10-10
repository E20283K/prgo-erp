import React from "react";

interface Props {
  totalSheetsRun: number;
  totalPlates: number;
  totalCtpPlates: number;
  cmykColors: number;
  paperAreaWastePercent: number;
  utilization: number;
}

export function ProductionSummary({
  totalSheetsRun,
  totalPlates,
  totalCtpPlates,
  cmykColors,
  paperAreaWastePercent,
  utilization,
}: Props) {
  return (
    <div className="bg-muted/50 p-3 space-y-1.5 shrink-0 border-t border-border">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-muted-foreground">Total Run (All Plates)</span>
        <span className="font-semibold text-sm text-foreground font-mono">
          {totalSheetsRun.toLocaleString()} sheets
        </span>
      </div>
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-muted-foreground">Unique CTP Plates</span>
        <span className="font-medium text-foreground">
          {totalPlates} layout{totalPlates > 1 ? "s" : ""} · {totalCtpPlates} plates @ {cmykColors}C
        </span>
      </div>
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-muted-foreground">Paper Waste (Trim Area)</span>
        <span
          className={`font-medium font-mono ${
            paperAreaWastePercent > 40 ? "text-destructive" : "text-foreground"
          }`}
        >
          {paperAreaWastePercent.toFixed(1)}%{" "}
          <span className="text-muted-foreground font-normal">({utilization.toFixed(1)}% usable)</span>
        </span>
      </div>
    </div>
  );
}
