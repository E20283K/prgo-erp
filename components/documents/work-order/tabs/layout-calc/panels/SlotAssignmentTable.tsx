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
    <div className="border border-border rounded-md p-1.5 space-y-1 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs">
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold text-[10px] text-foreground truncate">
          {activePlate.name} ({activePlate.assignments.length} SKU)
        </span>
        <Badge variant="outline" className="text-[9px] font-mono bg-blue-50 text-blue-700 border-blue-200 h-4 px-1 shrink-0">
          {layoutPieces} slots
        </Badge>
      </div>

      {activePlate.unassignedSlots < 0 && (
        <div className="text-red-500 text-[9px] font-medium bg-red-50 p-1 rounded border border-red-200">
          Over-assigned: {layoutPieces - activePlate.unassignedSlots}/{layoutPieces} slots used
        </div>
      )}

      {hasOverflow && (
        <div className="p-1.5 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 space-y-1 text-[9px]">
          <div className="flex items-start gap-1 text-amber-800 dark:text-amber-300 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              Listga {layoutPieces} joy sig&apos;adi, bu qolipda {activePlate.assignments.length} SKU bor.
            </span>
          </div>
          {onAutoPartition && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAutoPartition("by_model")}
                className="h-4.5 px-1.5 text-[8px] gap-0.5 bg-background cursor-pointer"
              >
                <Sparkles className="w-2 h-2 text-amber-500" />
                Model bo&apos;yicha
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAutoPartition("gang_capacity")}
                className="h-4.5 px-1.5 text-[8px] gap-0.5 bg-background cursor-pointer"
              >
                Sig&apos;imga qarab
              </Button>
            </div>
          )}
        </div>
      )}

      {activePlate.assignments.length > 0 ? (
        <div className="space-y-0.5 max-h-[220px] overflow-y-auto pr-0.5 scrollbar-none">
          <div className="grid grid-cols-[1fr_45px_38px_45px] gap-1 text-[8px] font-semibold text-muted-foreground uppercase px-1 sticky top-0 bg-zinc-50 dark:bg-zinc-900 py-0.5 z-10">
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
                className={`grid grid-cols-[1fr_45px_38px_45px] gap-1 items-center bg-white dark:bg-zinc-950 px-1 py-0.5 rounded border ${
                  a.slots === 0 ? "border-amber-300/80 opacity-65" : "border-border"
                }`}
              >
                <div className="flex items-center gap-1 min-w-0" title={a.sizeLabel}>
                  {a.model && (
                    <span className="text-[8px] font-mono bg-muted/70 px-0.5 rounded text-foreground max-w-[50px] truncate">
                      {a.model}
                    </span>
                  )}
                  <span className="font-mono font-semibold truncate text-[10px] text-foreground">
                    {a.sizeCode || a.sizeLabel}
                  </span>
                </div>
                <span className="text-center text-[9px] text-zinc-500 font-mono">
                  {a.targetQuantity.toLocaleString()}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={a.slots}
                  onChange={(e) => onManualSlotChange(a.sizeId, parseInt(e.target.value) || 0)}
                  className="h-4.5 text-[9px] font-mono text-center px-0.5 bg-zinc-50 dark:bg-zinc-900"
                />
                <div className="text-right flex flex-col items-end pr-0.5">
                  <span className="font-mono text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                    {yieldQty.toLocaleString()}
                  </span>
                  {diff > 0 && <span className="text-[7px] text-zinc-400 leading-none">+{diff}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground italic py-0.5">
          Biriktirilgan o&apos;lchamlar yo&apos;q.
        </div>
      )}
    </div>
  );
}
