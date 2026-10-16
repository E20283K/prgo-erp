import React from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlateConfig } from "../types";

interface Props {
  plates: PlateConfig[];
  activePlateIndex: number;
  onSelectPlate: (idx: number) => void;
  onAddPlate: () => void;
  onRemovePlate: (idx: number) => void;
}

export function PlateTabs({
  plates,
  activePlateIndex,
  onSelectPlate,
  onAddPlate,
  onRemovePlate,
}: Props) {
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          Plate Layouts ({plates.length})
        </span>
        <Button onClick={onAddPlate} variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-1.5">
          <Plus className="w-3 h-3" /> Add Plate
        </Button>
      </div>

      {/* Plate Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {plates.map((p, idx) => (
          <div
            key={p.id}
            onClick={() => onSelectPlate(idx)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer border flex items-center gap-1.5 transition-all ${
              idx === activePlateIndex
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            <span>{p.name}</span>
            {plates.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePlate(idx);
                }}
                className="opacity-70 hover:opacity-100"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
