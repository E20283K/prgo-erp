import React from "react";
import { Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OverproductionMode } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";

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
    <div className="bg-muted/40 border border-border rounded-md p-2 flex items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-foreground text-xs flex items-center gap-1.5 shrink-0">
        <Percent className="w-3.5 h-3.5 text-blue-600" />
        <span>Ortiqcha bosma:</span>
        <InfoTooltip
          title="Ruxsat etilgan ortiqcha bosma (Overproduction Limit)"
          description="Tirajlar nomutanosibligi paytida ruxsat berilgan maksimal ortiqcha chiqish chegarasi. Foiz (%) yoki dona (pcs) ko'rinishida belgilanadi. Limitdan oshsa, tizim yangi forma ochishni tavsiya qiladi."
        />
      </span>

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onValueChange(Math.max(0, Number(e.target.value)))}
          className="h-7 w-16 text-center text-xs bg-background font-mono px-1"
        />

        <div className="flex bg-muted p-0.5 rounded border border-border text-xs font-mono">
          <button
            type="button"
            onClick={() => onModeChange("percent")}
            className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
              mode === "percent"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onModeChange("exact")}
            className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
              mode === "exact"
                ? "bg-background text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            pcs
          </button>
        </div>

        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {mode === "percent" ? `${value}%` : `+${value} dona`}
        </span>
      </div>
    </div>
  );
}
