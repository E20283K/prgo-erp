"use client";

import React from "react";
import { Scissors, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ComboboxSelect } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { calculateRollCutting } from "../utils/rollCutting";
import type { WorkOrderFormData } from "../types";

interface TermoSpecSectionProps {
  formData: WorkOrderFormData;
  handleFieldChange: (field: any, val?: any) => void;
  onMarkUnsaved: () => void;
  isOperator?: boolean;
}

const MATERIAL_OPTIONS = [
  { value: "thermal_eco", label: "Termo EKO" },
  { value: "thermal_top", label: "Termo TOP" },
];

const CORE_OPTIONS = [
  { value: "25", label: "25 mm" },
  { value: "40", label: "40 mm" },
  { value: "76", label: "76 mm" },
];

const WINDING_OPTIONS = [
  { value: "out_top", label: "Tashqariga, boshi yuqori" },
  { value: "out_bottom", label: "Tashqariga, boshi past" },
  { value: "in_top", label: "Ichkariga, boshi yuqori" },
  { value: "in_bottom", label: "Ichkariga, boshi past" },
];

function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  disabled,
}: {
  label: string;
  value: number | undefined | "";
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <Input
        type="number"
        min={min}
        step={step}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 text-xs font-mono"
      />
    </div>
  );
}

export function TermoSpecSection({
  formData,
  handleFieldChange,
  onMarkUnsaved,
  isOperator,
}: TermoSpecSectionProps) {
  const set = (field: string, val: any) => {
    handleFieldChange(field, val);
    onMarkUnsaved();
  };

  const web = formData.flexoWebWidth ?? 100;
  const gapX = formData.flexoGapX ?? 3;
  const gapY = formData.flexoGapY ?? 3;
  const lanes = formData.flexoLanes ?? 1;
  const rolls = formData.flexoRollsCount || 0;
  const perRoll = formData.flexoLabelsPerRoll || 0;

  const syncQuantity = (nextRolls: number, nextPerRoll: number) => {
    const total = nextRolls * nextPerRoll;
    return total > 0 ? { quantity: total } : {};
  };

  const rc = calculateRollCutting({
    webWidthMm: web,
    labelWidthMm: formData.width || 0,
    labelHeightMm: formData.height || 0,
    gapXMm: gapX,
    gapYMm: gapY,
    lanes,
    rollsCount: rolls,
    labelsPerRoll: perRoll,
  });

  return (
    <>
      <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <CircleDot className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground">Stiker</span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {formData.width || 0} x {formData.height || 0} mm
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumField
            label="Eni (mm)"
            value={formData.width}
            step={0.5}
            disabled={isOperator}
            onChange={(n) => set("width", n)}
          />
          <NumField
            label="Bo'yi (mm)"
            value={formData.height}
            step={0.5}
            disabled={isOperator}
            onChange={(n) => set("height", n)}
          />
          <NumField
            label="Burchak R (mm)"
            value={formData.termoCornerRadius ?? 0}
            step={0.5}
            disabled={isOperator}
            onChange={(n) => set("termoCornerRadius", n)}
          />
        </div>
      </div>

      <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <CircleDot className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground">Jumbo rulon</span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {web} mm
          </Badge>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Material</label>
          <ComboboxSelect
            items={MATERIAL_OPTIONS}
            value={formData.labelMaterialType || "thermal_eco"}
            disabled={isOperator}
            onValueChange={(val) => set("labelMaterialType", val)}
            placeholder="Material"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumField
            label="Rulon eni (mm)"
            value={formData.flexoWebWidth ?? 100}
            min={10}
            disabled={isOperator}
            onChange={(n) => set("flexoWebWidth", n)}
          />
          <NumField
            label="Oraliq X (mm)"
            value={gapX}
            step={0.5}
            disabled={isOperator}
            onChange={(n) => set("flexoGapX", n)}
          />
          <NumField
            label="Oraliq Y (mm)"
            value={gapY}
            step={0.5}
            disabled={isOperator}
            onChange={(n) => set("flexoGapY", n)}
          />
        </div>
      </div>

      <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground">Chiqish</span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {rc.totalLabels.toLocaleString()} dona
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <NumField
            label="Qatorlar"
            value={lanes}
            min={1}
            disabled={isOperator}
            onChange={(n) => set("flexoLanes", Math.max(1, Math.floor(n) || 1))}
          />
          <NumField
            label="Rulonlar"
            value={formData.flexoRollsCount ?? ""}
            disabled={isOperator}
            onChange={(n) => {
              const v = Math.max(0, Math.floor(n));
              handleFieldChange({ flexoRollsCount: v, ...syncQuantity(v, perRoll) });
              onMarkUnsaved();
            }}
          />
          <NumField
            label="Dona / rulon"
            value={formData.flexoLabelsPerRoll ?? ""}
            step={100}
            disabled={isOperator}
            onChange={(n) => {
              const v = Math.max(0, Math.floor(n));
              handleFieldChange({ flexoLabelsPerRoll: v, ...syncQuantity(rolls, v) });
              onMarkUnsaved();
            }}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Gilza</label>
            <ComboboxSelect
              items={CORE_OPTIONS}
              value={String(formData.flexoCoreDiameter ?? 40)}
              disabled={isOperator}
              onValueChange={(val) => set("flexoCoreDiameter", Number(val) || 40)}
              placeholder="Gilza"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            O&apos;rash yo&apos;nalishi
          </label>
          <ComboboxSelect
            items={WINDING_OPTIONS}
            value={formData.flexoOrientation || "out_top"}
            disabled={isOperator}
            onValueChange={(val) => set("flexoOrientation", val)}
            placeholder="Yo'nalish"
          />
        </div>

        <div className="grid grid-cols-3 gap-x-3 gap-y-1 px-2 py-1.5 rounded border border-border bg-muted/30 text-[11px]">
          <div className="flex justify-between gap-1">
            <span className="text-muted-foreground">Max qator</span>
            <span className={cn("font-mono font-semibold", rc.lanesExceeded && "text-destructive")}>
              {rc.maxLanes}
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="text-muted-foreground">O&apos;tishlar</span>
            <span className="font-mono font-semibold">{rc.passes}</span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="text-muted-foreground">Rulon uzun.</span>
            <span className="font-mono font-semibold">{rc.rollLengthM.toFixed(1)} m</span>
          </div>
          <div className="flex justify-between gap-1 col-span-2">
            <span className="text-muted-foreground">Jumbo sarf</span>
            <span className="font-mono font-semibold">
              {rc.jumboMeters.toFixed(0)} m / {rc.jumboAreaM2.toFixed(1)} m2
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="text-muted-foreground">Chiqindi</span>
            <span className="font-mono font-semibold">{rc.wastePercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </>
  );
}
