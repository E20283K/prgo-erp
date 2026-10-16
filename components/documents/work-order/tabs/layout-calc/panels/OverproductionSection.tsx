import React from "react";
import { Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OverproductionMode } from "../types";

interface Props {
  mode: OverproductionMode;
  onModeChange: (mode: OverproductionMode) => void;
  value: number;
  onValueChange: (val: number) => void;
}

export function OverproductionSection({
  mode,
  onModeChange,
  value,
  onValueChange,
}: Props) {
  return (
    <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-[11px] flex items-center gap-1">
          <Percent className="w-3.5 h-3.5 text-blue-600" />
          Overproduction Allowance
        </span>
        <div className="flex bg-muted rounded p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => onModeChange("percent")}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
              mode === "percent" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onModeChange("exact")}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
              mode === "exact" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            Exact pcs
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onValueChange(Math.max(0, Number(e.target.value)))}
          className="h-7 text-xs bg-white dark:bg-zinc-950 flex-1"
          placeholder={mode === "percent" ? "e.g. 5%" : "e.g. 200 pcs"}
        />
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {mode === "percent" ? `${value}% extra` : `+${value} pcs each`}
        </span>
      </div>
    </div>
  );
}
