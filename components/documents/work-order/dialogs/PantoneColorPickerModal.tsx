"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Palette,
  Search,
  Plus,
  Sparkles,
  Check,
  X,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ALL_PANTONE_COLORS,
  BASE_PANTONE_INKS,
  SPECIALTY_STATIONS,
  PantoneColor,
} from "@/lib/pantone-catalog";
import { cn } from "@/lib/utils";

export interface SpotStationSelection {
  code: string;
  name: string;
  hex: string;
  side: "front" | "back" | "both";
}

interface PantoneColorPickerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectColor: (spot: SpotStationSelection) => void;
}

export function PantoneColorPickerModal({
  isOpen,
  onOpenChange,
  onSelectColor,
}: PantoneColorPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [targetSide, setTargetSide] = useState<"front" | "back" | "both">("front");
  const [activeCategory, setActiveCategory] = useState<"all" | "base" | "specialty" | "custom">("base");

  // Custom mix inputs
  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#2563eb");

  // Filter colors based on search and category
  const filteredColors = useMemo(() => {
    let source: PantoneColor[] = ALL_PANTONE_COLORS;
    if (activeCategory === "base") source = BASE_PANTONE_INKS;
    if (activeCategory === "specialty") source = SPECIALTY_STATIONS;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return source.slice(0, 80);

    return source
      .filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.hex.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [searchQuery, activeCategory]);

  const handleSelect = (color: PantoneColor) => {
    onSelectColor({
      code: color.code,
      name: color.name,
      hex: color.hex,
      side: targetSide,
    });
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    onSelectColor({
      code: customName.trim(),
      name: customName.trim(),
      hex: customHex,
      side: targetSide,
    });
    onOpenChange(false);
    setCustomName("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Palette className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Pantone Matching System (PMS) & Spot Inks
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Target Side Selector Banner */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-medium">Apply Station to:</span>
          <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setTargetSide("front")}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer",
                targetSide === "front"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Face / Лицо
            </button>
            <button
              type="button"
              onClick={() => setTargetSide("back")}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer",
                targetSide === "back"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Reverse / Оборот
            </button>
            <button
              type="button"
              onClick={() => setTargetSide("both")}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer",
                targetSide === "both"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Both Sides
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="p-4 pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveCategory("base")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer",
                  activeCategory === "base"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Base Inks ({BASE_PANTONE_INKS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("specialty")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer",
                  activeCategory === "specialty"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Foils & Varnishes ({SPECIALTY_STATIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer",
                  activeCategory === "all"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All PMS (900+)
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("custom")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer",
                  activeCategory === "custom"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Custom Mix
              </button>
            </div>

            {activeCategory !== "custom" && (
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code (e.g. 021, Warm Red, 871)..."
                  className="h-8 pl-8 text-xs bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            )}
          </div>

          {/* Content Area */}
          {activeCategory === "custom" ? (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Custom Spot Station / Ink Formulation Name
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Silk Screen White, Gold Foil Mirror, PMS 286 C"
                  className="h-8 text-xs bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0.5 bg-transparent"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono block">HEX CODE</span>
                    <Input
                      value={customHex}
                      onChange={(e) => setCustomHex(e.target.value)}
                      className="h-7 w-24 text-xs font-mono uppercase bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customName.trim()}
                  className="h-8 ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Station</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-950">
              {filteredColors.length > 0 ? (
                filteredColors.map((color, idx) => (
                  <div
                    key={`${color.code}-${idx}`}
                    onClick={() => handleSelect(color)}
                    className="flex items-center justify-between p-2 px-3 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Live Color Swatch */}
                      <div
                        className="w-6 h-6 rounded-md shadow-2xs border border-zinc-300/60 dark:border-zinc-700 shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {color.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {color.hex.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {color.category}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      <span>Select</span>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No Pantone colors matching "{searchQuery}".
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
