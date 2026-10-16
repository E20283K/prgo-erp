import React from "react";
import { KashirovkaSummary } from "../types";

interface Props {
  totalSheetsRun: number;
  totalPlates: number;
  totalCtpPlates: number;
  cmykColors: number;
  paperAreaWastePercent: number;
  utilization: number;
  kashirovkaSummary?: KashirovkaSummary;
}

export function ProductionSummary({
  totalSheetsRun,
  totalPlates,
  totalCtpPlates,
  cmykColors,
  paperAreaWastePercent,
  utilization,
  kashirovkaSummary,
}: Props) {
  return (
    <div className="bg-muted/50 p-3 space-y-1.5 shrink-0 border-t border-border">
      {kashirovkaSummary?.enabled ? (
        <>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">
              Mounted Output ({kashirovkaSummary.totalMountedGsm}g/m²)
            </span>
            <span className="font-semibold text-xs text-amber-700 dark:text-amber-300 font-mono">
              {kashirovkaSummary.mountedSheetsRequired.toLocaleString()} sh{" "}
              <span className="text-[10px] font-normal text-muted-foreground">
                (+{kashirovkaSummary.makeReadySheets} setup)
              </span>
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Total Raw 300g Stock</span>
            <span className="font-semibold text-sm text-foreground font-mono">
              {kashirovkaSummary.totalRawBoardSheets.toLocaleString()} sheets
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Unique CTP Plates</span>
            <span className="font-medium text-foreground">
              {kashirovkaSummary.strategy === "split_half_sheet"
                ? `${totalCtpPlates} plates (1 Split Set @ ${cmykColors}C)`
                : `${totalCtpPlates} plates (2 Sets Front+Back)`}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Mounting Glue (PVA)</span>
            <span className="font-medium font-mono text-emerald-700 dark:text-emerald-400">
              {kashirovkaSummary.glueKgRequired.toFixed(2)} kg
            </span>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
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
