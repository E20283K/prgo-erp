"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Edit2,
  Eye,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalculatedPlate,
  PlatePartitionStrategy,
  CtpSideRelation,
  OptimizerGoal,
  SlotAssignment,
  ActivePlateSide,
} from "../types";
import { InfoTooltip } from "../components/InfoTooltip";

interface Props {
  plates: CalculatedPlate[];
  activePlateIndex: number;
  effectivePieces: number;
  activeSide: ActivePlateSide;
  onToggleSide: (side: ActivePlateSide) => void;
  ctpSideRelation: CtpSideRelation;
  totalCtpPlates: number;
  totalSheetsRun: number;
  totalProducedYield: number;
  totalOverproduction: number;
  overallOverproductionPercent: number;
  onSelectPlate: (idx: number) => void;
  onAddPlate: () => void;
  onRemovePlate: (idx: number) => void;
  onRenamePlate: (idx: number, name: string) => void;
  onDuplicatePlate: (idx: number) => void;
  onReassignSkuPlate: (sizeId: string, targetPlateIdx: number) => void;
  onSetSkuSlots: (sizeId: string, slots: number, plateIdx?: number) => void;
  onSwitchToVisualizer: () => void;
}

export function MasterPlanningMatrix({
  plates,
  activePlateIndex,
  effectivePieces,
  activeSide,
  onToggleSide,
  ctpSideRelation,
  totalCtpPlates,
  totalSheetsRun,
  totalProducedYield,
  totalOverproduction,
  overallOverproductionPercent,
  onSelectPlate,
  onAddPlate,
  onRemovePlate,
  onRenamePlate,
  onDuplicatePlate,
  onReassignSkuPlate,
  onSetSkuSlots,
  onSwitchToVisualizer,
}: Props) {
  const [selectedPlateFilter, setSelectedPlateFilter] = useState<string>("all");
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Flatten all items across all plates with plate context
  const allPlateItems = useMemo(() => {
    interface MatrixRow extends SlotAssignment {
      plateIndex: number;
      plateName: string;
      plateRequiredSheets: number;
      isBottleneck: boolean;
    }

    const rows: MatrixRow[] = [];

    plates.forEach((plate, pIdx) => {
      plate.assignments.forEach((a) => {
        const isBottleneck =
          a.slots > 0 && Math.ceil(a.targetQuantity / a.slots) === plate.requiredSheets;
        rows.push({
          ...a,
          plateIndex: pIdx,
          plateName: plate.name,
          plateRequiredSheets: plate.requiredSheets,
          isBottleneck,
        });
      });
    });

    return rows;
  }, [plates]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allPlateItems.filter((row) => {
      if (selectedPlateFilter !== "all" && String(row.plateIndex) !== selectedPlateFilter) {
        return false;
      }
      return true;
    });
  }, [allPlateItems, selectedPlateFilter]);

  const handleStartRename = (idx: number, currentName: string) => {
    setRenamingIdx(idx);
    setRenameValue(currentName);
  };

  const handleCommitRename = (idx: number) => {
    if (renameValue.trim()) {
      onRenamePlate(idx, renameValue.trim());
    }
    setRenamingIdx(null);
  };

  return (
    <div className="flex flex-col gap-1.5 h-full overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          1. SLEEK HORIZONTAL PLATE TABS BAR (HEIGHT 28px)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 shrink-0 py-0.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
          {/* "Barchasi" filter chip */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setSelectedPlateFilter("all")}
              className={`h-6 px-2 rounded text-[11px] font-medium transition-all cursor-pointer border ${
                selectedPlateFilter === "all"
                  ? "bg-foreground text-background font-semibold border-foreground"
                  : "bg-muted/60 text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              Barchasi ({allPlateItems.length})
            </button>
            <InfoTooltip
              title="Barcha formalar"
              description="Barcha montaj qoliplariga taqsimlangan barcha o'lchamlarni bitta umumiy matritsa jadvalida ko'rsatish."
              className="ml-0.5"
            />
          </div>

          {plates.map((plate, idx) => {
            const usedSlots = plate.assignments.reduce((s, a) => s + a.slots, 0);
            const isFull = usedSlots === effectivePieces;
            const isOver = usedSlots > effectivePieces;
            const isSelected = selectedPlateFilter === String(idx);
            const isActive = idx === activePlateIndex;

            return (
              <div
                key={plate.id}
                onClick={() => {
                  setSelectedPlateFilter(String(idx));
                  onSelectPlate(idx);
                }}
                className={`h-6 px-2 rounded text-[11px] font-medium flex items-center gap-1.5 cursor-pointer shrink-0 border transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                    : isActive
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                    : "bg-muted/60 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
                }`}
              >
                {renamingIdx === idx ? (
                  <input
                    type="text"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleCommitRename(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitRename(idx);
                      if (e.key === "Escape") setRenamingIdx(null);
                    }}
                    className="h-4 w-16 px-0.5 text-[10px] font-semibold bg-background text-foreground border rounded"
                  />
                ) : (
                  <span>{plate.name}</span>
                )}

                <span className="font-mono text-[9px] opacity-80">
                  {usedSlots}/{effectivePieces}
                </span>

                <span className="font-mono text-[9px] font-bold opacity-90">
                  · {plate.requiredSheets}sh
                </span>

                {plate.totalOverproduction !== undefined && plate.totalOverproduction > 0 && (
                  <span className="text-[8px] text-emerald-400 font-mono">
                    +{plate.totalOverproduction}
                  </span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-60 hover:opacity-100 p-0.5 text-[9px]"
                  >
                    •••
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuItem onClick={() => handleStartRename(idx, plate.name)}>
                      <Edit2 className="w-3 h-3 mr-1.5" /> Nomini o&apos;zgartirish
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicatePlate(idx)}>
                      <Copy className="w-3 h-3 mr-1.5" /> Nusxa olish
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={plates.length <= 1}
                      onClick={() => onRemovePlate(idx)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-1.5" /> O&apos;chirish
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddPlate}
            className="h-6 text-[10px] px-1.5 gap-0.5 text-muted-foreground hover:text-foreground shrink-0"
          >
            <Plus className="w-3 h-3" /> Forma
          </Button>
        </div>

        {/* Current Side badge & eye shortcut */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
          <span className="text-muted-foreground hidden sm:inline">
            {activeSide === "back" ? "Orqa qoliplar:" : "Oldi qolip:"}
          </span>
          <div className="flex items-center gap-0.5">
            <Badge
              variant="outline"
              className={`text-[9px] h-5 px-1.5 font-semibold ${
                activeSide === "back"
                  ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
              }`}
            >
              {activeSide === "back"
                ? "Orqa (Har xil razmerlar)"
                : ctpSideRelation === "shared_front_variable_back"
                ? "Oldi (1 ta umumiy yuz)"
                : "Oldi (Mustaqil)"}
            </Badge>
            <InfoTooltip
              title="CTP Tomonlar Rejasi"
              description={
                activeSide === "back"
                  ? "Orqa tomon — har bir forma uchun individual dizayn va razmerlar joylashtiriladi."
                  : ctpSideRelation === "shared_front_variable_back"
                  ? "Old tomoni barcha formalarda bir xil umumiy dizaynga ega, shuning uchun faqat 1 ta CTP to'plami (4 dona) olinadi va xarajat tejaladi."
                  : "Old tomoni har bir forma uchun alohida ochiladi."
              }
            />
          </div>
          <button
            type="button"
            onClick={onSwitchToVisualizer}
            title="Chizmada ko'rish"
            className="text-muted-foreground hover:text-foreground p-1 rounded"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DENSE 1C MASTER PLANNING TABLE
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-card rounded-md border border-border overflow-hidden flex flex-col min-h-0">
        {/* Table Header */}
        <div className="grid grid-cols-[28px_130px_1fr_75px_110px_96px_75px_75px_85px] gap-1 px-2.5 py-1.5 bg-muted/70 border-b border-border font-semibold text-[9px] text-muted-foreground uppercase tracking-wider sticky top-0 z-10 select-none items-center">
          <span className="text-center">#</span>
          <span className="flex items-center gap-0.5">
            <span>Artikul</span>
            <InfoTooltip
              title="Artikul / Model"
              description="Mahsulot dizayni, qolip turi yoki model nomi."
            />
          </span>
          <span className="flex items-center gap-0.5">
            <span>O&apos;lcham</span>
            <InfoTooltip
              title="O'lcham (Size)"
              description="Mahsulotning individual o'lchami yoki razmer kodi."
            />
          </span>
          <span className="flex items-center justify-end gap-0.5">
            <span>Buyurtma</span>
            <InfoTooltip
              title="Buyurtma tiraji (Target)"
              description="Mijoz buyurtma qilgan kerakli mahsulot soni (dona)."
            />
          </span>
          <span className="flex items-center gap-0.5">
            <span>Forma</span>
            <InfoTooltip
              title="Bosma qolipi (Plate)"
              description="Ushbu o'lcham joylashgan montaj qolipi. O'lchamni boshqa formaga ko'chirish uchun tanlang."
            />
          </span>
          <span className="flex items-center justify-center gap-0.5">
            <span>Joy (Slots)</span>
            <InfoTooltip
              title="Listdagi joylar soni (Slots)"
              description="Ushbu o'lcham bitta bosma listida nechta joy egallashi (1x, 2x, 4x...). Tiraji katta o'lchamga ko'proq slot berilsa, butun formaning list soni kamayadi."
            />
          </span>
          <span className="flex items-center justify-end gap-0.5">
            <span>List</span>
            <InfoTooltip
              title="Kerakli listlar soni"
              description="Ushbu tirajni chiqarish uchun kerak bo'ladigan sof bosma listlar soni."
              formula="List = Tiraj / Joy"
            />
          </span>
          <span className="flex items-center justify-end gap-0.5">
            <span>Chiqish</span>
            <InfoTooltip
              title="Faktik chiqish (Yield)"
              description="Chop etilgandan so'ng chiqadigan jami tayyor mahsulot miqdori."
              formula="Chiqish = Formaning Listi × Joy"
            />
          </span>
          <span className="flex items-center justify-end gap-0.5">
            <span>Ortiqcha</span>
            <InfoTooltip
              title="Ortiqcha chiqish (Overproduction)"
              description="Rejadan ortiqcha chiqadigan mahsulot soni va uning foizi."
            />
          </span>
        </div>

        {/* Scrollable Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 text-xs">
          {filteredRows.length > 0 ? (
            filteredRows.map((row, idx) => {
              const diff = (row.yieldQuantity || 0) - row.targetQuantity;
              const overPct = row.overproductionPercent || 0;

              return (
                <div
                  key={`${row.plateIndex}-${row.sizeId}`}
                  className={`grid grid-cols-[28px_130px_1fr_75px_110px_96px_75px_75px_85px] gap-1 items-center px-2.5 py-1 hover:bg-muted/40 transition-colors ${
                    row.isBottleneck ? "bg-blue-50/15 dark:bg-blue-950/15" : ""
                  }`}
                >
                  {/* # */}
                  <span className="text-center font-mono text-[9px] text-muted-foreground">
                    {idx + 1}
                  </span>

                  {/* Artikul / Model */}
                  <div className="flex items-center min-w-0 pr-1 gap-1">
                    <span
                      className="font-mono text-[10px] font-semibold truncate bg-muted/60 px-1 py-0.5 rounded text-foreground max-w-[125px]"
                      title={row.model || "Universal"}
                    >
                      {row.model || "Asosiy"}
                    </span>
                    {row.isBottleneck && (
                      <InfoTooltip
                        title="Tirajni belgilovchi o'lcham (Bottleneck)"
                        description="Ushbu o'lchamning tiraji eng katta bo'lib, formaning umumiy list sonini belgilab bermoqda. Agar unga 2x yoki 4x slot bersangiz, umumiy list soni kamayadi."
                        iconClassName="text-amber-500 w-3 h-3"
                      />
                    )}
                  </div>

                  {/* O'lcham (Size) */}
                  <span
                    className="font-mono text-[11px] font-medium text-foreground truncate pr-1"
                    title={row.sizeCode || row.sizeLabel}
                  >
                    {row.sizeCode || row.sizeLabel}
                  </span>

                  {/* Buyurtma (Target) */}
                  <span className="text-right font-mono font-semibold text-foreground pr-1">
                    {row.targetQuantity.toLocaleString()}
                  </span>

                  {/* Forma Reassignment Dropdown */}
                  <div>
                    <Select
                      value={String(row.plateIndex)}
                      onValueChange={(val) => {
                        if (val !== null && val !== undefined) {
                          onReassignSkuPlate(row.sizeId, parseInt(val));
                        }
                      }}
                    >
                      <SelectTrigger className="h-5 text-[10px] font-medium bg-background px-1.5 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plates.map((p, pIdx) => (
                          <SelectItem key={p.id} value={String(pIdx)}>
                            {p.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={String(plates.length)}>
                          + Yangi Forma
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Joy soni (Slots) - 1x, 2x, 4x Segmented Pills */}
                  <div className="flex items-center justify-center gap-0.5">
                    <div className="flex items-center bg-muted/80 p-0.5 rounded border border-border">
                      {[1, 2, 4].map((slotVal) => (
                        <button
                          key={slotVal}
                          type="button"
                          onClick={() => onSetSkuSlots(row.sizeId, slotVal, row.plateIndex)}
                          className={`h-4 px-1 rounded text-[9px] font-mono font-semibold transition-all cursor-pointer ${
                            row.slots === slotVal
                              ? "bg-blue-600 text-white shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {slotVal}x
                        </button>
                      ))}
                    </div>
                    {row.slots !== 1 && row.slots !== 2 && row.slots !== 4 && (
                      <Input
                        type="number"
                        min={0}
                        value={row.slots}
                        onChange={(e) =>
                          onSetSkuSlots(row.sizeId, parseInt(e.target.value) || 0, row.plateIndex)
                        }
                        className="h-5 w-7 text-center text-[10px] font-mono px-0.5 bg-background"
                      />
                    )}
                  </div>

                  {/* List soni */}
                  <div className="text-right pr-1 flex flex-col items-end">
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {row.sheetsNeeded?.toLocaleString() || 0}
                    </span>
                  </div>

                  {/* Chiqish (Yield) */}
                  <span className="text-right font-mono text-[11px] font-bold text-foreground pr-1">
                    {row.yieldQuantity?.toLocaleString() || 0}
                  </span>

                  {/* Ortiqcha (Overproduction) */}
                  <div className="text-right pr-1 flex items-center justify-end gap-0.5">
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        diff > 0
                          ? overPct > 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : "0"}
                    </span>
                    {diff > 0 && (
                      <span className="text-[8px] text-muted-foreground font-mono">
                        ({overPct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-muted-foreground text-xs italic">
              Hech qanday o&apos;lcham topilmadi.
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. DENSE BOTTOM KPI STRIP (HEIGHT 28px)
        ───────────────────────────────────────────────────────────── */}
        <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-t border-border flex items-center justify-between text-[11px] shrink-0 font-mono">
          <div className="flex items-center gap-3 text-muted-foreground font-sans">
            <span className="flex items-center gap-1">
              <span>SKU: <strong className="font-mono text-foreground">{allPlateItems.length}</strong></span>
              <InfoTooltip
                title="Mahsulot turlari (SKU)"
                description="Matritsadagi barcha alohida modellar va o'lchamlar soni."
              />
            </span>
            <span className="flex items-center gap-1">
              <span>Formalar: <strong className="font-mono text-foreground">{plates.length}</strong></span>
              <InfoTooltip
                title="Jami formalar"
                description="Montaj qilingan alohida bosma qoliplari soni."
              />
            </span>
            <span className="flex items-center gap-1">
              <span>CTP:{" "}
              <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                {totalCtpPlates} qolip
              </strong></span>
              <InfoTooltip
                title="Jami CTP alyuminiy plastinalari"
                description="Barcha formalarni chop etish uchun CTP apparatida ochiladigan metall plastinalar soni."
              />
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span>List: <strong className="text-foreground">{totalSheetsRun.toLocaleString()}</strong></span>
              <InfoTooltip
                title="Jami sof bosma listlar"
                description="Mashinaga chop etish uchun kerak bo'lgan jami sof listlar soni."
              />
            </span>
            <span className="flex items-center gap-1">
              <span>Chiqish: <strong className="text-foreground">{totalProducedYield.toLocaleString()}</strong></span>
              <InfoTooltip
                title="Jami tayyor mahsulot"
                description="Barcha formalardan olinadigan umumiy tayyor mahsulotlar soni."
              />
            </span>
            <span className="flex items-center gap-1">
              <span>Ortiqcha:{" "}
              <span
                className={`font-semibold ${
                  overallOverproductionPercent > 5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                +{totalOverproduction.toLocaleString()} (+{overallOverproductionPercent.toFixed(1)}%)
              </span></span>
              <InfoTooltip
                title="Ortiqcha mahsulot"
                description="Tirajlar nomutanosibligi tufayli buyurtmadan ortiqcha chiqadigan umumiy mahsulotlar miqdori va foizi."
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
