"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeftRight,
  Scissors,
  Sparkles,
  Shirt,
  Layers,
  RotateCw,
  Tag,
} from "lucide-react";

interface TextileLabelPreviewProps {
  width: number; // Ribbon / Tape width (mm)
  height: number; // Cut length / Repeat length (mm)
  materialType?: string;
  foldType?: string;
  cutType?: string;
  sewingMarginMm?: number;
  printSides?: string;
  department?: "Flexo" | "Jacquard" | "Offset";
  weaveQuality?: string;
  hasLurex?: boolean;
  lurexColor?: string;
  colorsConfig?: string;
  brandName?: string;
  className?: string;
}

export function TextileLabelPreview({
  width = 30,
  height = 70,
  materialType = "nylon_taffeta",
  foldType = "center_fold",
  cutType = "ultrasonic",
  sewingMarginMm = 5,
  printSides = "1s",
  department = "Flexo",
  weaveQuality = "damask_50d",
  hasLurex = false,
  lurexColor = "gold",
  colorsConfig = "1+0",
  brandName = "PrintGoo Care",
  className,
}: TextileLabelPreviewProps) {
  const [viewSide, setViewSide] = useState<"front" | "back">("front");
  const [isFoldSimulated, setIsFoldSimulated] = useState(false);

  const safeW = Math.max(10, Number(width) || 30);
  const safeH = Math.max(15, Number(height) || 70);
  const safeSew = Math.max(0, Number(sewingMarginMm) || 5);

  // Material Appearance & Texture Styles
  const isSatin = materialType.includes("satin");
  const isCotton = materialType.includes("cotton");
  const isJacquard = department === "Jacquard";

  const getSubstrateStyle = () => {
    if (materialType === "polyester_satin_black") {
      return "bg-zinc-950 text-white border-zinc-700 shadow-md ring-1 ring-white/10";
    }
    if (isSatin) {
      return "bg-gradient-to-b from-slate-50 via-white to-slate-100 text-zinc-900 border-slate-300 shadow-md";
    }
    if (isCotton) {
      return "bg-[#faf6ed] text-zinc-800 border-[#e6dcce] shadow-xs";
    }
    if (isJacquard) {
      return "bg-zinc-900 text-zinc-100 border-zinc-700 shadow-md";
    }
    // Default: Nylon Taffeta (Crisp matte off-white)
    return "bg-zinc-100 dark:bg-zinc-200 text-zinc-900 border-zinc-300 shadow-xs";
  };

  // Fold Type Label
  const getFoldLabel = () => {
    switch (foldType) {
      case "center_fold":
        return "Markazdan buklama (Center Fold)";
      case "end_fold":
        return "Ikki chekkadan buklama (End Fold)";
      case "manhattan_fold":
        return "Kitobcha (Manhattan Fold)";
      case "mitre_fold":
        return "Manjet (Mitre Fold)";
      case "roll":
        return "Rulonda uzluksiz (Roll)";
      default:
        return "To'g'ri kesim (Straight Cut)";
    }
  };

  // Cut Type Label
  const getCutLabel = () => {
    switch (cutType) {
      case "ultrasonic":
        return "Ultrasonik (Yumshoq qirra)";
      case "hot_knife":
        return "Issiq pichoq (Hot knife)";
      case "laser":
        return "Lazer kesim (Laser cut)";
      default:
        return "Sovuq pichoq (Cold knife)";
    }
  };

  // Aspect ratio calculation for visual canvas
  const canvasWidth = 240;
  const scale = canvasWidth / safeW;
  const canvasHeight = Math.min(380, safeH * scale);

  return (
    <div className={cn("p-3 bg-card border border-border rounded-lg shadow-2xs flex flex-col gap-2.5", className)}>
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-xs text-foreground">
            {isJacquard ? "To'qima jakard etiketka ko'rinishi" : "To'qimachilik etiketkasi (Care Label)"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {printSides === "2s" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewSide((prev) => (prev === "front" ? "back" : "front"))}
              className="h-6 px-1.5 text-[10px] gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>{viewSide === "front" ? "Oldi (Face)" : "Orqasi (Back)"}</span>
            </Button>
          )}
          <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
            {safeW} × {safeH} mm
          </Badge>
        </div>
      </div>

      {/* Visual Canvas Viewport */}
      <div className="relative w-full h-[320px] rounded-lg bg-zinc-900/5 dark:bg-zinc-950/40 border border-dashed border-border flex items-center justify-center p-4 overflow-hidden select-none">
        {/* Dimension Indicators */}
        <div className="absolute top-2 left-4 text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <span>Kenglik: <b>{safeW}mm</b></span>
          <span>•</span>
          <span>Uzunlik: <b>{safeH}mm</b></span>
        </div>

        {/* The Ribbon Element */}
        <div
          style={{
            width: `${Math.min(180, Math.max(90, safeW * 3.5))}px`,
            height: `${Math.min(270, Math.max(130, safeH * 2.8))}px`,
          }}
          className={cn(
            "relative rounded-xs border transition-all duration-200 flex flex-col overflow-hidden font-sans",
            getSubstrateStyle()
          )}
        >
          {/* Subtle Ribbon Texture Shimmer */}
          {isSatin && (
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.8)_50%,transparent_100%)]" />
          )}
          {isJacquard && (
            <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:3px_3px]" />
          )}

          {/* Sewing Allowance Zone (Top Hatching) */}
          {safeSew > 0 && (
            <div
              style={{ height: `${Math.min(28, (safeSew / safeH) * 100)}%` }}
              className="w-full shrink-0 border-b border-dashed border-red-500/50 bg-red-500/10 flex items-center justify-center text-[9px] font-mono text-red-600 dark:text-red-400"
            >
              <span className="truncate">Tikish xoshiyasi (+{safeSew}mm)</span>
            </div>
          )}

          {/* End Fold: Top fold tab indicator */}
          {foldType === "end_fold" && (
            <div className="w-full h-4 border-b border-blue-500/60 bg-blue-500/10 flex items-center justify-center text-[8px] font-mono text-blue-600">
              <span>Buklama 7mm ▼</span>
            </div>
          )}

          {/* Label Main Body */}
          <div className="flex-1 flex flex-col justify-between p-2 text-center text-[10px]">
            {/* Upper Portion: Brand & Logo */}
            <div className="space-y-0.5">
              <div className="text-[12px] font-bold tracking-wider uppercase font-mono">
                {brandName}
              </div>
              <div className="text-[9px] opacity-75 font-mono">
                {isJacquard ? `${weaveQuality.toUpperCase()} WOVEN` : "100% PREMIUM QUALITY"}
              </div>
            </div>

            {/* Center Fold Line Indicator */}
            {foldType === "center_fold" && (
              <div className="w-full my-1 border-t-2 border-dashed border-amber-500 flex items-center justify-center relative">
                <span className="absolute -top-2 bg-amber-500 text-white text-[7px] font-mono px-1 rounded-xs">
                  BUKLAMA CHIZIG&apos;I (FOLD)
                </span>
              </div>
            )}

            {/* Lower Portion: Care Instructions / Symbols */}
            <div className="space-y-1">
              {/* International Care Symbols */}
              <div className="flex items-center justify-center gap-1.5 opacity-80 text-[10px]">
                <span title="Wash at 40°C" className="border border-current px-0.5 rounded-xs text-[8px]">40°</span>
                <span title="Do not bleach">△</span>
                <span title="Iron low">☡</span>
                <span title="Do not tumble dry">⨂</span>
                <span title="Dry clean safe">℗</span>
              </div>
              <div className="text-[8px] opacity-70 leading-tight">
                MADE IN UZBEKISTAN
                <br />
                {viewSide === "back" ? "RN #94820 · DRY FLAT" : "COTTON / POLY BLEND"}
              </div>
            </div>
          </div>

          {/* End Fold: Bottom fold tab indicator */}
          {foldType === "end_fold" && (
            <div className="w-full h-4 border-t border-blue-500/60 bg-blue-500/10 flex items-center justify-center text-[8px] font-mono text-blue-600">
              <span>Buklama 7mm ▲</span>
            </div>
          )}
        </div>
      </div>

      {/* Technical Specifications Summary Footer */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border text-[11px]">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-[10px]">Buklash & Qirra:</span>
          <span className="font-medium text-foreground truncate">{getFoldLabel()}</span>
          <span className="text-[10px] text-muted-foreground truncate">{getCutLabel()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-[10px]">Material & Ranglilik:</span>
          <span className="font-medium text-foreground truncate capitalize">
            {materialType.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] text-muted-foreground truncate">
            {isJacquard ? `${weaveQuality} · ${hasLurex ? `Lurex (${lurexColor})` : "Standart ip"}` : `${colorsConfig} (${printSides.toUpperCase()})`}
          </span>
        </div>
      </div>
    </div>
  );
}
