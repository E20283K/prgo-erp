import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripperEdge } from "../types";

interface Props {
  sheetW: number;
  setSheetW: (v: number) => void;
  sheetH: number;
  setSheetH: (v: number) => void;
  prodW: number;
  setProdW: (v: number) => void;
  prodH: number;
  setProdH: (v: number) => void;
  bleed: number;
  setBleed: (v: number) => void;
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
  setCmykColors: (v: number) => void;
}

export function DimensionsSection({
  sheetW,
  setSheetW,
  sheetH,
  setSheetH,
  prodW,
  setProdW,
  prodH,
  setProdH,
  bleed,
  setBleed,
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
  setCmykColors,
}: Props) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Sheet W (mm)</label>
          <Input
            type="number"
            value={sheetW}
            onChange={(e) => setSheetW(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Sheet H (mm)</label>
          <Input
            type="number"
            value={sheetH}
            onChange={(e) => setSheetH(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Product W (mm)</label>
          <Input
            type="number"
            value={prodW}
            onChange={(e) => setProdW(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Product H (mm)</label>
          <Input
            type="number"
            value={prodH}
            onChange={(e) => setProdH(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Bleed (mm)</label>
          <Input
            type="number"
            value={bleed}
            onChange={(e) => setBleed(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Gap / Gutter (mm)</label>
          <Input
            type="number"
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Margins T/B</label>
          <div className="flex gap-1">
            <Input
              type="number"
              value={marginTop}
              onChange={(e) => setMarginTop(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950"
            />
            <Input
              type="number"
              value={marginBottom}
              onChange={(e) => setMarginBottom(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Margins L/R</label>
          <div className="flex gap-1">
            <Input
              type="number"
              value={marginLeft}
              onChange={(e) => setMarginLeft(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950"
            />
            <Input
              type="number"
              value={marginRight}
              onChange={(e) => setMarginRight(Number(e.target.value))}
              className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
              className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 flex-1 px-1.5 text-center"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Colors / Plate</label>
          <Select value={String(cmykColors)} onValueChange={(v) => setCmykColors(Number(v))}>
            <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Spot Color</SelectItem>
              <SelectItem value="2">2 Colors</SelectItem>
              <SelectItem value="4">4 Colors (CMYK)</SelectItem>
              <SelectItem value="5">5 Colors (CMYK+Spot)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
