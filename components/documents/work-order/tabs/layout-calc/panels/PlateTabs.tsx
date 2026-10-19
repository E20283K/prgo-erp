import React from "react";
import { Layers, Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlateConfig, PlatePartitionStrategy } from "../types";

interface Props {
  plates: PlateConfig[];
  activePlateIndex: number;
  partitionStrategy?: PlatePartitionStrategy;
  hasMultipleModels?: boolean;
  uniqueModelsCount?: number;
  onSelectPlate: (idx: number) => void;
  onAddPlate: () => void;
  onRemovePlate: (idx: number) => void;
  onAutoPartition?: (strategy: PlatePartitionStrategy) => void;
}

export function PlateTabs({
  plates,
  activePlateIndex,
  partitionStrategy = "gang_capacity",
  hasMultipleModels = false,
  uniqueModelsCount = 1,
  onSelectPlate,
  onAddPlate,
  onRemovePlate,
  onAutoPartition,
}: Props) {
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Qoliplar / Plate ({plates.length})</span>
        </span>
        <Button onClick={onAddPlate} variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-1.5 cursor-pointer">
          <Plus className="w-3 h-3" /> + Plate
        </Button>
      </div>

      {/* Smart Partition Strategy Bar */}
      {onAutoPartition && (
        <div className="p-1.5 rounded-md bg-muted/40 border border-border space-y-1">
          <div className="flex items-center justify-between text-[9px] uppercase font-semibold text-muted-foreground px-0.5">
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              Avto-taqsimlash usuli:
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onAutoPartition("gang_capacity")}
              title="Barcha modellarni list sig'imiga qarab bitta yoki eng kam qolipga joylash"
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "gang_capacity"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Yig&apos;ma (Gang)
            </button>
            <button
              type="button"
              onClick={() => onAutoPartition("by_model")}
              title="Har bir model uchun alohida bosma qolip (Plate) ochish"
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "by_model"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Model ({hasMultipleModels ? uniqueModelsCount : "1x"})
            </button>
            <button
              type="button"
              onClick={() => onAutoPartition("by_volume")}
              title="Katta tirajli va kichik tirajli o'lchamlarni alohida qoliplarga ajratish"
              className={`py-1 px-1.5 rounded text-[10px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "by_volume"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Tiraj balans
            </button>
          </div>
        </div>
      )}

      {/* Plate Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {plates.map((p, idx) => (
          <div
            key={p.id}
            onClick={() => onSelectPlate(idx)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer border flex items-center gap-1.5 shrink-0 transition-all ${
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
                className="opacity-70 hover:opacity-100 cursor-pointer"
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
