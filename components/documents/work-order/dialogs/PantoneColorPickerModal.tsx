"use client";

import React, { useState, useMemo } from "react";
import {
  Palette,
  Search,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ALL_PANTONE_COLORS,
  BASE_PANTONE_INKS,
  SPECIALTY_STATIONS,
  PantoneColor,
  searchPantoneColors,
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
  defaultSide?: "front" | "back" | "both";
}

export function PantoneColorPickerModal({
  isOpen,
  onOpenChange,
  onSelectColor,
  defaultSide = "front",
}: PantoneColorPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [targetSide, setTargetSide] = useState<"front" | "back" | "both">(defaultSide);

  React.useEffect(() => {
    if (isOpen) {
      setTargetSide(defaultSide);
    }
  }, [isOpen, defaultSide]);
  const [activeCategory, setActiveCategory] = useState<"all" | "base" | "specialty" | "custom">("base");

  // Custom mix inputs
  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#2563eb");

  // Filter colors based on search and category
  const filteredColors = useMemo(() => {
    const q = searchQuery.trim();
    if (q) {
      // If user typed a search query, search comprehensively across catalog
      if (activeCategory === "specialty") {
        return searchPantoneColors(q, 100).filter((c) => c.category === "Specialty & Foils");
      }
      return searchPantoneColors(q, 100);
    }

    if (activeCategory === "base") return BASE_PANTONE_INKS;
    if (activeCategory === "specialty") return SPECIALTY_STATIONS;
    return ALL_PANTONE_COLORS.slice(0, 80);
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

  const handleAddCustomNamed = (name: string, hex = "#2563eb") => {
    const clean = name.trim();
    if (!clean) return;
    const cleanName = clean.toUpperCase().startsWith("PANTONE") ? clean : `PANTONE ${clean}`;
    onSelectColor({
      code: clean,
      name: cleanName,
      hex,
      side: targetSide,
    });
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    handleAddCustomNamed(customName, customHex);
    setCustomName("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredColors.length > 0) {
        handleSelect(filteredColors[0]);
      } else if (searchQuery.trim()) {
        handleAddCustomNamed(searchQuery.trim());
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-card border border-border shadow-md">
        <DialogHeader className="p-3.5 pb-2.5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-muted text-muted-foreground">
                <Palette className="size-4" />
              </div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Pantone Matching System (PMS) & Spot Inks
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Pantone katalogi va maxsus bo&apos;yoqlarni tanlash
          </DialogDescription>
        </DialogHeader>

        {/* Target Side Selector Banner */}
        <div className="px-3.5 py-2 bg-muted/40 border-b border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium text-[11px]">Tayinlash tomoni (Target side):</span>
          <div className="inline-flex items-center p-0.5 rounded bg-muted border border-border">
            <button
              type="button"
              onClick={() => setTargetSide("front")}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                targetSide === "front"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Old tomon (Front)
            </button>
            <button
              type="button"
              onClick={() => setTargetSide("back")}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                targetSide === "back"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Orqa tomon (Back)
            </button>
            <button
              type="button"
              onClick={() => setTargetSide("both")}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                targetSide === "both"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Ikkala tomon (Both)
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="p-3.5 pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center p-0.5 rounded bg-muted/60 border border-border">
              <button
                type="button"
                onClick={() => { setActiveCategory("base"); }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded transition-colors cursor-pointer",
                  activeCategory === "base"
                    ? "bg-background text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Base Inks ({BASE_PANTONE_INKS.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveCategory("specialty"); }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded transition-colors cursor-pointer",
                  activeCategory === "specialty"
                    ? "bg-background text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Foils & Varnishes ({SPECIALTY_STATIONS.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveCategory("all"); }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded transition-colors cursor-pointer",
                  activeCategory === "all"
                    ? "bg-background text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All PMS (900+)
              </button>
              <button
                type="button"
                onClick={() => { setActiveCategory("custom"); }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded transition-colors cursor-pointer",
                  activeCategory === "custom"
                    ? "bg-background text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Custom Mix
              </button>
            </div>

            {activeCategory !== "custom" && (
              <div className="relative flex-1 min-w-[180px]">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Katalogdan qidirish (021, Warm Red, 485, 871)..."
                  className="h-7.5 pl-8 text-xs bg-background border-input"
                />
              </div>
            )}
          </div>

          {/* Quick Custom Add Banner when searching */}
          {searchQuery.trim() && activeCategory !== "custom" && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-muted/40 border border-border text-xs">
              <span className="text-muted-foreground text-[11px] truncate mr-2">
                Qidiruv: <span className="font-semibold text-foreground">&quot;{searchQuery.trim()}&quot;</span>
              </span>
              <button
                type="button"
                onClick={() => handleAddCustomNamed(searchQuery.trim())}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Maxsus rang sifatida qo&apos;shish</span>
              </button>
            </div>
          )}

          {/* Content Area */}
          {activeCategory === "custom" ? (
            <div className="p-3 bg-muted/20 rounded border border-border space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Custom Spot Station / Ink Formulation Name
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Silk Screen White, Gold Foil Mirror, PMS 286 C"
                  className="h-8 text-xs bg-background border-input"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer p-0.5 bg-transparent"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono block">HEX CODE</span>
                    <Input
                      value={customHex}
                      onChange={(e) => setCustomHex(e.target.value)}
                      className="h-7 w-24 text-xs font-mono uppercase bg-background border-input"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustom}
                  disabled={!customName.trim()}
                  className="h-8 ml-auto text-xs cursor-pointer gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Add Station</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded max-h-72 overflow-y-auto divide-y divide-border/60 bg-card">
              {filteredColors.length > 0 ? (
                filteredColors.map((color, idx) => (
                  <div
                    key={`${color.code}-${idx}`}
                    onClick={() => handleSelect(color)}
                    className="flex items-center justify-between p-2 px-3 hover:bg-muted/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Live Color Swatch */}
                      <div
                        className="w-5 h-5 rounded border border-border/80 shrink-0 flex items-center justify-center shadow-2xs"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-foreground group-hover:text-foreground">
                            {color.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {color.hex.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/80 block truncate">
                          {color.category}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-muted-foreground group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="size-3 mr-1" />
                      <span>Select</span>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                  <p>Katalogda &quot;{searchQuery}&quot; topilmadi.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddCustomNamed(searchQuery.trim())}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>&quot;{searchQuery}&quot; ni maxsus rang sifatida qo&apos;shish</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
