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
  partitionStrategy = "smart_gang_optimizer",
  hasMultipleModels = false,
  uniqueModelsCount = 1,
  onSelectPlate,
  onAddPlate,
  onRemovePlate,
  onAutoPartition,
}: Props) {
  return (
    <div className="border-t border-border pt-1.5 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-[10px] flex items-center gap-1">
          <Layers className="w-3 h-3 text-blue-600" />
          <span>Qoliplar ({plates.length})</span>
        </span>
        <Button onClick={onAddPlate} variant="outline" size="sm" className="h-5 text-[9px] gap-0.5 px-1.5 cursor-pointer">
          <Plus className="w-2.5 h-2.5" /> + Forma
        </Button>
      </div>

      {/* Smart Partition Strategy Bar */}
      {onAutoPartition && (
        <div className="p-1 rounded bg-muted/40 border border-border space-y-0.5">
          <div className="grid grid-cols-4 gap-0.5">
            <button
              type="button"
              onClick={() => onAutoPartition("smart_gang_optimizer")}
              title="Smart Gang Optimizer: slotlar va tirajlarni avtomatik muvozanatlash"
              className={`py-0.5 px-1 rounded text-[9px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "smart_gang_optimizer"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Smart
            </button>
            <button
              type="button"
              onClick={() => onAutoPartition("gang_capacity")}
              title="Barcha modellarni list sig'imiga qarab bitta yoki eng kam qolipga joylash"
              className={`py-0.5 px-1 rounded text-[9px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "gang_capacity"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Sig&apos;im
            </button>
            <button
              type="button"
              onClick={() => onAutoPartition("by_model")}
              title="Har bir model uchun alohida bosma qolip (Plate) ochish"
              className={`py-0.5 px-1 rounded text-[9px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "by_model"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Model
            </button>
            <button
              type="button"
              onClick={() => onAutoPartition("by_volume")}
              title="Katta tirajli va kichik tirajli o'lchamlarni alohida qoliplarga ajratish"
              className={`py-0.5 px-1 rounded text-[9px] font-medium border transition-all cursor-pointer truncate ${
                partitionStrategy === "by_volume"
                  ? "bg-background border-primary text-primary font-semibold shadow-2xs"
                  : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Tiraj
            </button>
          </div>
        </div>
      )}

      {/* Plate Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {plates.map((p, idx) => (
          <div
            key={p.id}
            onClick={() => onSelectPlate(idx)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer border flex items-center gap-1 shrink-0 transition-all ${
              idx === activePlateIndex
                ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                : "bg-muted/60 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
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
