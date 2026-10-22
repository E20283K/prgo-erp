import React from "react";
import { ArrowRight, Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripperEdge } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";

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
    <div className="space-y-2.5 text-xs">
      {/* Press Sheet Size (W × H) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <span>List eni (W mm)</span>
            <InfoTooltip
              title="Bosma qog'oz eni"
              description="Bosma mashinasiga solinadigan xom qog'oz listining eni (millimetrda). Masalan: 700 mm yoki 520 mm."
            />
          </label>
          <Input
            type="number"
            value={sheetW}
            onChange={(e) => setSheetW(Number(e.target.value))}
            className="h-7 text-xs bg-background font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <span>List bo&apos;yi (H mm)</span>
            <InfoTooltip
              title="Bosma qog'oz bo'yi"
              description="Bosma mashinasiga solinadigan xom qog'oz listining bo'yi (millimetrda). Masalan: 1000 mm yoki 720 mm."
            />
          </label>
          <Input
            type="number"
            value={sheetH}
            onChange={(e) => setSheetH(Number(e.target.value))}
            className="h-7 text-xs bg-background font-mono"
          />
        </div>
      </div>

      {/* Margins: T, B, L, R in a single clean row */}
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <span>Hoshiyalar (T / B / L / R mm)</span>
            <InfoTooltip
              title="Texnik Hoshiyalar (Margins)"
              description="List chetlaridan mahsulotgacha bo'lgan texnik masofa (Top, Bottom, Left, Right)."
            />
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">T · B · L · R</span>
        </label>
        <div className="grid grid-cols-4 gap-1">
          <Input
            type="number"
            value={marginTop}
            onChange={(e) => setMarginTop(Number(e.target.value))}
            className="h-7 text-xs text-center bg-background font-mono px-0.5"
            title="Yuqori hoshiya (Top)"
          />
          <Input
            type="number"
            value={marginBottom}
            onChange={(e) => setMarginBottom(Number(e.target.value))}
            className="h-7 text-xs text-center bg-background font-mono px-0.5"
            title="Pastki hoshiya (Bottom)"
          />
          <Input
            type="number"
            value={marginLeft}
            onChange={(e) => setMarginLeft(Number(e.target.value))}
            className="h-7 text-xs text-center bg-background font-mono px-0.5"
            title="Chap hoshiya (Left)"
          />
          <Input
            type="number"
            value={marginRight}
            onChange={(e) => setMarginRight(Number(e.target.value))}
            className="h-7 text-xs text-center bg-background font-mono px-0.5"
            title="O'ng hoshiya (Right)"
          />
        </div>
      </div>

      {/* Gap & Gripper */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <span>Tirqish / Gap (mm)</span>
            <InfoTooltip
              title="Mahsulotlar orasidagi oraliq (Gap)"
              description="Qo'shni qutichalar yoki yorliqlar orasidagi pichoq (kesish) masofasi. Odatda 3-4 mm qoldiriladi."
            />
          </label>
          <Input
            type="number"
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="h-7 text-xs bg-background font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <span>Klapin & Tomon</span>
            <InfoTooltip
              title="Mashina klapani (Gripper Margin)"
              description="Bosma mashinasining metall ushlagichlari (lapkalari) qog'ozni ushlab tortib ketishi uchun kerak bo'ladigan bo'yoqsiz toza oq maydon (odatda 10-15 mm)."
            />
          </label>
          <div className="flex gap-1">
            <Select
              value={gripperEdge}
              onValueChange={(v: any) => v && setGripperEdge(v as GripperEdge)}
            >
              <SelectTrigger className="h-7 text-xs bg-background px-2 w-[76px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
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
              className="h-7 text-xs text-center bg-background font-mono px-1 flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
