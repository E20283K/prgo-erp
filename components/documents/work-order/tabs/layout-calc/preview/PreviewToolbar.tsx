import React from "react";
import { ChevronLeft, ChevronRight, Download, FileDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivePlateSide } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";

interface Props {
  activePlateIndex: number;
  totalPlates: number;
  requiredSheets: number;
  activeSide?: ActivePlateSide;
  onToggleSide?: (side: ActivePlateSide) => void;
  onPrevPlate: () => void;
  onNextPlate: () => void;
  onExportSVG: () => void;
  onExportPDFCurrent: () => void;
  onExportPDFAll?: () => void;
}

export function PreviewToolbar({
  activePlateIndex,
  totalPlates,
  requiredSheets,
  activeSide = "back",
  onToggleSide,
  onPrevPlate,
  onNextPlate,
  onExportSVG,
  onExportPDFCurrent,
  onExportPDFAll,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-border mb-1 shrink-0 text-xs">
      {/* Pagination & Side Controls */}
      <div className="flex items-center gap-1.5">
        {/* Plate Pager */}
        <div className="flex items-center gap-0.5">
          <div className="flex items-center bg-card border border-border rounded shadow-2xs p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              disabled={activePlateIndex <= 0}
              onClick={onPrevPlate}
              title="Oldingi forma"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="px-1 font-semibold text-[11px] text-foreground font-mono">
              {activePlateIndex + 1}/{totalPlates}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              disabled={activePlateIndex >= totalPlates - 1}
              onClick={onNextPlate}
              title="Keyingi forma"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <InfoTooltip
            title="Forma navigatsiyasi"
            description="Bosma montaj qoliplari bo'ylab o'tish (Forma 1, 2, 3...). Har bir forma o'zining mustaqil montaj chizmasiga ega."
          />
        </div>

        {/* Side Toggle: Oldi (Front) vs Orqa (Back) */}
        {onToggleSide && (
          <div className="flex items-center gap-0.5">
            <div className="flex items-center bg-muted p-0.5 rounded border border-border text-[10px]">
              <button
                type="button"
                onClick={() => onToggleSide("front")}
                className={`px-1.5 py-0.2 rounded font-semibold transition-all cursor-pointer ${
                  activeSide === "front"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Oldi
              </button>
              <button
                type="button"
                onClick={() => onToggleSide("back")}
                className={`px-1.5 py-0.2 rounded font-semibold transition-all cursor-pointer ${
                  activeSide === "back"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Orqa
              </button>
            </div>
            <InfoTooltip
              title="Bosma Tomoni (Oldi / Orqa)"
              description="Oldi — mahsulotning yuz qismi. Orqa — teskari tomon. Orqa taraf bosmaxona qonuniyati bo'yicha gorizontal akslantirilgan, shunda kesganda old va orqa dizayn bir-biriga 100% mos tushadi."
            />
          </div>
        )}

        <span className="text-[10px] text-muted-foreground hidden sm:inline font-mono">
          · {requiredSheets.toLocaleString()} list
        </span>
      </div>

      {/* Compact Export Dropdown */}
      <div className="flex items-center gap-1">
        <Button
          onClick={onExportSVG}
          variant="outline"
          size="sm"
          className="h-5.5 text-[10px] gap-1 px-1.5 bg-background cursor-pointer"
          title="Vektor SVG fayl yuklab olish"
        >
          <Download className="w-2.5 h-2.5" />
          <span>SVG</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className="inline-flex items-center gap-1 h-5.5 px-1.5 rounded text-[10px] font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
          >
            <FileDown className="w-2.5 h-2.5 text-red-500" />
            <span>PDF</span>
            <ChevronDown className="w-2 h-2 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={onExportPDFCurrent} className="cursor-pointer">
              <FileDown className="w-3.5 h-3.5 mr-1.5 text-red-500" />
              <span>Joriy forma PDF (Forma {activePlateIndex + 1})</span>
            </DropdownMenuItem>
            {totalPlates > 1 && onExportPDFAll && (
              <DropdownMenuItem onClick={onExportPDFAll} className="cursor-pointer">
                <FileDown className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                <span>Barcha {totalPlates} ta forma PDF</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <InfoTooltip
          title="Montaj chizmasini eksport qilish"
          description="Ushbu montaj chizmasini CTP yoki pichoqchilar (plotter) uchun vektor SVG yoki chop etish uchun tayyor vektor PDF formatida yuklab olish."
        />
      </div>
    </div>
  );
}
