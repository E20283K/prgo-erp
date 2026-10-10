import React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalculatedPlate } from "../types";

interface Props {
  activePlate: CalculatedPlate;
  layoutPieces: number;
  onManualSlotChange: (sizeId: string, val: number) => void;
}

export function SlotAssignmentTable({
  activePlate,
  layoutPieces,
  onManualSlotChange,
}: Props) {
  return (
    <div className="border border-border rounded-md p-2.5 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[11px] text-foreground">
          {activePlate.name} Assignments
        </span>
        <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
          {layoutPieces} slots/sheet
        </Badge>
      </div>

      {activePlate.unassignedSlots < 0 && (
        <div className="text-red-500 text-[10px] font-medium bg-red-50 p-1 rounded border border-red-200">
          Over-assigned: {layoutPieces - activePlate.unassignedSlots}/{layoutPieces} slots used
        </div>
      )}

      {activePlate.assignments.length > 0 ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_55px_45px_50px] gap-1 text-[9px] font-semibold text-zinc-500 uppercase px-1">
            <span>Variation</span>
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
                className="grid grid-cols-[1fr_55px_45px_50px] gap-1 items-center bg-white dark:bg-zinc-950 p-1 rounded border border-border"
              >
                <span className="font-medium px-1 truncate text-[11px]" title={a.sizeLabel}>
                  {a.sizeLabel}
                </span>
                <span className="text-center text-[10px] text-zinc-500 font-mono">
                  {a.targetQuantity}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={a.slots}
                  onChange={(e) => onManualSlotChange(a.sizeId, parseInt(e.target.value) || 0)}
                  className="h-5 text-[10px] text-center px-1 bg-zinc-50 dark:bg-zinc-900"
                />
                <div className="text-right flex flex-col items-end pr-1">
                  <span className="font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    {yieldQty}
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
