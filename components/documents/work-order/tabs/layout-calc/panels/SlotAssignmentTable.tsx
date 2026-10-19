import React from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalculatedPlate, PlatePartitionStrategy } from "../types";

interface Props {
  activePlate: CalculatedPlate;
  layoutPieces: number;
  onManualSlotChange: (sizeId: string, val: number) => void;
  onAutoPartition?: (strategy: PlatePartitionStrategy) => void;
}

export function SlotAssignmentTable({
  activePlate,
  layoutPieces,
  onManualSlotChange,
  onAutoPartition,
}: Props) {
  const hasOverflow = (activePlate.overflowSkusCount || 0) > 0;

  return (
    <div className="border border-border rounded-md p-2.5 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold text-[11px] text-foreground truncate">
          {activePlate.name} ({activePlate.assignments.length} SKU)
        </span>
        <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200 shrink-0">
          {layoutPieces} slots/sheet
        </Badge>
      </div>

      {activePlate.unassignedSlots < 0 && (
        <div className="text-red-500 text-[10px] font-medium bg-red-50 p-1.5 rounded border border-red-200">
          Over-assigned: {layoutPieces - activePlate.unassignedSlots}/{layoutPieces} slots used
        </div>
      )}

      {hasOverflow && (
        <div className="p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 space-y-1.5 text-[10px]">
          <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Listga {layoutPieces} ta joy sig&apos;adi, lekin bu qolipda {activePlate.assignments.length} ta SKU bor ({activePlate.overflowSkusCount} tasi sig&apos;madi).
            </span>
          </div>
          {onAutoPartition && (
            <div className="flex items-center gap-1 pt-0.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAutoPartition("by_model")}
                className="h-5 px-2 text-[9px] gap-1 bg-background cursor-pointer"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                Model bo&apos;yicha bo&apos;lish
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAutoPartition("gang_capacity")}
                className="h-5 px-2 text-[9px] gap-1 bg-background cursor-pointer"
              >
                Sig&apos;imga qarab bo&apos;lish
              </Button>
            </div>
          )}
        </div>
      )}

      {activePlate.assignments.length > 0 ? (
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
          <div className="grid grid-cols-[1fr_50px_42px_50px] gap-1 text-[9px] font-semibold text-zinc-500 uppercase px-1 sticky top-0 bg-zinc-50 dark:bg-zinc-900 py-0.5 z-10">
            <span>Model / O&apos;lcham</span>
            <span className="text-center">Target</span>
            <span className="text-center">Slots</span>
            <span className="text-right">Yield</span>
          </div>
          {activePlate.assignments.map((a) => {
            const yieldQty = a.slots * activePlate.requiredSheets;
            const diff = yieldQty - a.targetQuantity;
            return (
              <div
                key={a.sizeId}
                className={`grid grid-cols-[1fr_50px_42px_50px] gap-1 items-center bg-white dark:bg-zinc-950 p-1 rounded border ${
                  a.slots === 0 ? "border-amber-300/80 opacity-65" : "border-border"
                }`}
              >
                <div className="flex items-center gap-1 min-w-0 px-0.5" title={a.sizeLabel}>
                  {a.model && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] h-4 px-1 font-medium shrink-0 max-w-[68px] truncate"
                    >
                      {a.model}
                    </Badge>
                  )}
                  <span className="font-mono font-semibold truncate text-[11px] text-foreground">
                    {a.sizeCode || a.sizeLabel}
                  </span>
                </div>
                <span className="text-center text-[10px] text-zinc-500 font-mono">
                  {a.targetQuantity.toLocaleString()}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={a.slots}
                  onChange={(e) => onManualSlotChange(a.sizeId, parseInt(e.target.value) || 0)}
                  className="h-5 text-[10px] font-mono text-center px-1 bg-zinc-50 dark:bg-zinc-900"
                />
                <div className="text-right flex flex-col items-end pr-1">
                  <span className="font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    {yieldQty.toLocaleString()}
                  </span>
                  {diff > 0 && <span className="text-[8px] text-zinc-400 leading-none">+{diff}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground italic py-1">
          No items allocated to this plate.
        </div>
      )}
    </div>
  );
}
