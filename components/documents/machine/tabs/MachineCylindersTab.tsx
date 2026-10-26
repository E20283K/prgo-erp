"use client";

import React, { useState, useMemo, useCallback } from "react";
import { MachineRecord, FlexoMachineCylinderItem } from "../types";
import { JR_1521_CYLINDERS } from "@/lib/flexo/masterData";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Check,
  CheckSquare,
  Square,
  CircleDot,
  Filter,
  Layers,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface MachineCylindersTabProps {
  machine: MachineRecord;
  onUpdate: (updated: Partial<MachineRecord>) => void;
}

const COMMON_PRESET_TEETH = [54, 60, 64, 70, 72, 80, 84, 90, 96, 100, 108, 120];

export function MachineCylindersTab({ machine, onUpdate }: MachineCylindersTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "owned" | "missing">("all");

  const ownedMap = useMemo(() => {
    const map = new Map<number, FlexoMachineCylinderItem>();
    const items = machine.flexoSpecs?.ownedCylinders || [];
    for (const item of items) {
      map.set(item.teeth, item);
    }
    // Also consider ownedCylinderTeeth array if populated
    const teethList = machine.flexoSpecs?.ownedCylinderTeeth || [];
    for (const t of teethList) {
      if (!map.has(t)) {
        map.set(t, { teeth: t, quantity: 1, status: "ready" });
      }
    }
    return map;
  }, [machine.flexoSpecs?.ownedCylinders, machine.flexoSpecs?.ownedCylinderTeeth]);

  const ownedCount = ownedMap.size;

  const updateOwnedCylinders = useCallback(
    (newMap: Map<number, FlexoMachineCylinderItem>) => {
      const items = Array.from(newMap.values()).sort((a, b) => a.teeth - b.teeth);
      const teethList = items.map((i) => i.teeth);

      const currentFlexo = machine.flexoSpecs || {
        maxWebWidthMm: 0,
        minWebWidthMm: 0,
        repeatMinMm: 0,
        repeatMaxMm: 0,
        gearPitch: "2.7107",
        maxUnwindDiamMm: 0,
        maxRewindDiamMm: 0,
        coreDiameterMm: 0,
        printingStations: 0,
        plateThicknessMm: 1.7,
        cushionTapeMm: 0.38,
        maxSpeedMpm: 100,
        practicalSpeedMpm: 80,
        makeReadyMinutes: 15,
        makeReadyWasteMeters: 50,
        curingSystem: "UV",
        aniloxCount: 4,
        rotaryDieStations: 1,
        coldFoilUnit: false,
        delamRelam: false,
      };

      onUpdate({
        flexoSpecs: {
          ...currentFlexo,
          ownedCylinderTeeth: teethList,
          ownedCylinders: items,
        },
      });
    },
    [machine.flexoSpecs, onUpdate]
  );

  const handleToggle = (teeth: number) => {
    const next = new Map(ownedMap);
    if (next.has(teeth)) {
      next.delete(teeth);
    } else {
      next.set(teeth, {
        teeth,
        quantity: 1,
        location: `RACK-${teeth}`,
        status: "ready",
      });
    }
    updateOwnedCylinders(next);
  };

  const handleFieldChange = (
    teeth: number,
    field: "quantity" | "location" | "status" | "notes",
    val: any
  ) => {
    const next = new Map(ownedMap);
    const existing = next.get(teeth) || { teeth, quantity: 1, status: "ready" };
    next.set(teeth, {
      ...existing,
      [field]: val,
    });
    updateOwnedCylinders(next);
  };

  const handleSelectPreset = () => {
    const next = new Map(ownedMap);
    for (const t of COMMON_PRESET_TEETH) {
      if (!next.has(t)) {
        next.set(t, { teeth: t, quantity: 1, location: `RACK-${t}`, status: "ready" });
      }
    }
    updateOwnedCylinders(next);
  };

  const handleSelectAll = () => {
    const next = new Map(ownedMap);
    for (const c of JR_1521_CYLINDERS) {
      if (!next.has(c.teeth)) {
        next.set(c.teeth, { teeth: c.teeth, quantity: 1, location: `RACK-${c.teeth}`, status: "ready" });
      }
    }
    updateOwnedCylinders(next);
  };

  const handleClearAll = () => {
    updateOwnedCylinders(new Map());
  };

  // Filter cylinders list
  const filteredCylinders = useMemo(() => {
    return JR_1521_CYLINDERS.filter((c) => {
      const isOwned = ownedMap.has(c.teeth);

      if (filterMode === "owned" && !isOwned) return false;
      if (filterMode === "missing" && isOwned) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchTeeth = String(c.teeth).includes(term) || `${c.teeth}z`.includes(term) || `${c.teeth}t`.includes(term);
      const matchDiam = String(c.cylinderDiameter).includes(term);
      const matchPrintLen = String(c.printingLength).includes(term);
      const matchPitchDiam = String(c.pitchCircleDiameter).includes(term);

      return matchTeeth || matchDiam || matchPrintLen || matchPitchDiam;
    });
  }, [ownedMap, filterMode, searchTerm]);

  return (
    <div className="space-y-3">
      {/* 1. Industrial KPI Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="border border-border rounded-md p-2 bg-card">
          <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Mavjud Vallar</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {ownedCount}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/ 110 ta</span>
          </div>
        </div>

        <div className="border border-border rounded-md p-2 bg-card">
          <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Katalog Diapazoni</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            40Z — 149Z
          </div>
        </div>

        <div className="border border-border rounded-md p-2 bg-card">
          <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Tish Qadami (Pitch)</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            {machine.flexoSpecs?.gearPitch || "2.7107 mm (JR-1521)"}
          </div>
        </div>

        <div className="border border-border rounded-md p-2 bg-card">
          <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Forma Qalinligi</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            {machine.flexoSpecs?.plateThicknessMm || 1.7} mm
          </div>
        </div>
      </div>

      {/* 2. Compact Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border border-border rounded-md p-2 bg-muted/20">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Qidirish: Z tish (masalan: 64, 100), diametr..."
              className="h-7 text-xs pl-7 bg-background"
            />
          </div>

          <div className="flex items-center border border-border rounded-md bg-background p-0.5">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`h-6 px-2 text-[11px] font-medium rounded transition-colors ${
                filterMode === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Barchasi (110)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("owned")}
              className={`h-6 px-2 text-[11px] font-medium rounded transition-colors ${
                filterMode === "owned" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mavjud ({ownedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("missing")}
              className={`h-6 px-2 text-[11px] font-medium rounded transition-colors ${
                filterMode === "missing" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yo&apos;q ({110 - ownedCount})
            </button>
          </div>
        </div>

        {/* Quick Bulk Actions */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectPreset}
            className="h-7 text-xs px-2 gap-1 font-mono"
            title="Eng ko'p ishlatiladigan 12 ta standart valni belgilash"
          >
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>Standart Top-12</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="h-7 text-xs px-2 gap-1 font-mono"
          >
            <CheckSquare className="w-3 h-3" />
            <span>Hammasini tanlash</span>
          </Button>

          {ownedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs px-2 gap-1 font-mono text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tozalash</span>
            </Button>
          )}
        </div>
      </div>

      {/* 3. High-Density Cylinders Table */}
      <div className="border border-border rounded-md bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-xs border-collapse text-left font-mono">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs z-10 border-b border-border text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="py-2 px-3 w-10 text-center">Bor</th>
                <th className="py-2 px-2.5">Tish (Z)</th>
                <th className="py-2 px-2.5">Val Diametri (mm)</th>
                <th className="py-2 px-2.5">Bosma Uzunligi (mm)</th>
                <th className="py-2 px-2.5">Film Uzunligi (mm)</th>
                <th className="py-2 px-2.5">Pitch Diametri (mm)</th>
                <th className="py-2 px-2.5 w-20">Soni</th>
                <th className="py-2 px-2.5 w-28">Tokcha / Joy</th>
                <th className="py-2 px-2.5 w-28">Holati</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCylinders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs font-sans">
                    Qidiruv bo&apos;yicha silindr topilmadi.
                  </td>
                </tr>
              ) : (
                filteredCylinders.map((cyl) => {
                  const isOwned = ownedMap.has(cyl.teeth);
                  const item = ownedMap.get(cyl.teeth) || { teeth: cyl.teeth, quantity: 1, status: "ready" };

                  return (
                    <tr
                      key={cyl.teeth}
                      className={`hover:bg-accent/40 transition-colors ${
                        isOwned ? "bg-emerald-50/30 dark:bg-emerald-950/10 font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {/* Checkbox column */}
                      <td className="py-1 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(cyl.teeth)}
                          className="inline-flex items-center justify-center cursor-pointer text-foreground hover:opacity-80"
                        >
                          {isOwned ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>

                      {/* Teeth Number Z */}
                      <td className="py-1 px-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isOwned ? "text-foreground" : "text-muted-foreground"}`}>
                            {cyl.teeth}Z
                          </span>
                          {isOwned && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                              Mavjud
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Cylinder Diameter */}
                      <td className="py-1 px-2.5">
                        {cyl.cylinderDiameter.toFixed(2)} mm
                      </td>

                      {/* Printing Length */}
                      <td className="py-1 px-2.5 font-bold text-foreground">
                        {cyl.printingLength.toFixed(2)} mm
                      </td>

                      {/* Film Length */}
                      <td className="py-1 px-2.5">
                        {cyl.filmLength.toFixed(2)} mm
                      </td>

                      {/* Pitch Circle Diameter */}
                      <td className="py-1 px-2.5">
                        {cyl.pitchCircleDiameter.toFixed(2)} mm
                      </td>

                      {/* Quantity input */}
                      <td className="py-1 px-2.5">
                        {isOwned ? (
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={item.quantity || 1}
                            onChange={(e) =>
                              handleFieldChange(cyl.teeth, "quantity", Math.max(1, Number(e.target.value) || 1))
                            }
                            className="h-6 w-16 text-xs text-center font-mono bg-background"
                          />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Location input */}
                      <td className="py-1 px-2.5">
                        {isOwned ? (
                          <Input
                            type="text"
                            value={item.location || ""}
                            onChange={(e) => handleFieldChange(cyl.teeth, "location", e.target.value)}
                            placeholder="RACK-1"
                            className="h-6 w-24 text-xs font-mono bg-background px-1.5"
                          />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Status Selector */}
                      <td className="py-1 px-2.5">
                        {isOwned ? (
                          <Select
                            value={item.status || "ready"}
                            onValueChange={(val: any) => handleFieldChange(cyl.teeth, "status", val)}
                          >
                            <SelectTrigger className="h-6 w-24 text-[10px] font-sans">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ready" className="text-xs">
                                <span className="text-emerald-600 font-medium">Tayyor</span>
                              </SelectItem>
                              <SelectItem value="maintenance" className="text-xs">
                                <span className="text-amber-600 font-medium">Ta&apos;mirda</span>
                              </SelectItem>
                              <SelectItem value="damaged" className="text-xs">
                                <span className="text-destructive font-medium">Yaroqsiz</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground/60 text-[10px]">Yo&apos;q</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
