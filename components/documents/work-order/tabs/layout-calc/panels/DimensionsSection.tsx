import React from "react";
import { ArrowRight, Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripperEdge } from "../types";

interface Props {
  sheetW: number;
  setSheetW: (v: number) => void;
  sheetH: number;
  setSheetH: (v: number) => void;
  prodW: number;
  prodH: number;
  bleed: number;
  gap: number;
  setGap: (v: number) => void;
  marginTop: number;
  setMarginTop: (v: number) => void;
  marginBottom: number;
  setMarginBottom: (v: number) => void;
  marginLeft: number;
  setMarginLeft: (v: number) => void;
  marginRight: number;
  setMarginRight: (v: number) => void;
  gripper: number;
  setGripper: (v: number) => void;
  gripperEdge: GripperEdge;
  setGripperEdge: (v: GripperEdge) => void;
  cmykColors: number;
  onSwitchTab?: (tabKey: string) => void;
}

export function DimensionsSection({
  sheetW,
  setSheetW,
  sheetH,
  setSheetH,
  prodW,
  prodH,
  bleed,
  gap,
  setGap,
  marginTop,
  setMarginTop,
  marginBottom,
  setMarginBottom,
  marginLeft,
  setMarginLeft,
  marginRight,
  setMarginRight,
  gripper,
  setGripper,
  gripperEdge,
  setGripperEdge,
  cmykColors,
  onSwitchTab,
}: Props) {
  return (
    <div className="space-y-2.5">
      {/* Inherited Product Geometry & Color Stations (Read-Only SSOT from Specs & Drawing) */}
      <div className="p-2 rounded-md bg-muted/40 border border-border space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
            <Ruler className="w-3 h-3 text-primary" />
            <span>Product Specs (SSOT)</span>
          </span>
          {onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab("specs")}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
            >
              <span>Edit in Specs</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono bg-background">
            {prodW} × {prodH} mm
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono bg-background">
            Bleed: {bleed} mm
          </Badge>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
            {cmykColors} colors / plate
          </Badge>
        </div>
      </div>

      {/* Press Sheet Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Sheet W (mm)</label>
          <Input
            type="number"
            value={sheetW}
            onChange={(e) => setSheetW(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Sheet H (mm)</label>
          <Input
            type="number"
            value={sheetH}
            onChange={(e) => setSheetH(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono"
          />
        </div>
      </div>

      {/* Imposition Margins T/B and L/R */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Margins T/B (mm)</label>
          <div className="flex gap-1">
            <Input
              type="number"
              value={marginTop}
              onChange={(e) => setMarginTop(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950 font-mono"
            />
            <Input
              type="number"
              value={marginBottom}
              onChange={(e) => setMarginBottom(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950 font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Margins L/R (mm)</label>
          <div className="flex gap-1">
            <Input
              type="number"
              value={marginLeft}
              onChange={(e) => setMarginLeft(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950 font-mono"
            />
            <Input
              type="number"
              value={marginRight}
              onChange={(e) => setMarginRight(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Gap / Gutter & Gripper Edge */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Gap / Gutter (mm)</label>
          <Input
            type="number"
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] uppercase font-semibold text-zinc-500 block">Gripper Edge & Size</label>
          <div className="flex gap-1">
            <Select value={gripperEdge} onValueChange={(v: any) => v && setGripperEdge(v as GripperEdge)}>
              <SelectTrigger className="h-7 text-[10px] bg-zinc-50 dark:bg-zinc-950 px-2 w-[75px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">Auto</SelectItem>
                <SelectItem value="Bottom">Bottom</SelectItem>
                <SelectItem value="Top">Top</SelectItem>
                <SelectItem value="Left">Left</SelectItem>
                <SelectItem value="Right">Right</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={gripper}
              onChange={(e) => setGripper(Number(e.target.value))}
              className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 flex-1 px-1.5 text-center font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
