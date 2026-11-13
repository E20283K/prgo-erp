"use client";

import React, { useMemo, useRef } from "react";
import { Download, Stamp, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { extractSvgDimensions, parseSvgContour } from "../../utils/svgContour";
import { calculateRollCutting } from "../../utils/rollCutting";
import type { WorkOrderFormData, WorkOrderToolingItem } from "../../types";
import { buildDieSvg, calculateDieLayout } from "./engine";

interface DieLayoutTabProps {
  formData: WorkOrderFormData;
  docNo?: string;
  handleFieldChange: (field: any, val?: any) => void;
  onMarkUnsaved: () => void;
  onAddTooling: (item: WorkOrderToolingItem) => void;
  isOperator?: boolean;
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-7 text-xs font-mono"
      />
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", danger && "text-destructive")}>{value}</span>
    </div>
  );
}

export function DieLayoutTab({
  formData,
  docNo,
  handleFieldChange,
  onMarkUnsaved,
  onAddTooling,
  isOperator,
}: DieLayoutTabProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // SVG already attached in Specifications is used by default; "O'lchamdan" must be chosen explicitly.
  const source =
    formData.customSvgPath && formData.termoDieSource !== "size" ? "file" : "size";
  const w = formData.width || 0;
  const h = formData.height || 0;
  const web = formData.flexoWebWidth ?? 100;
  const gapX = formData.flexoGapX ?? 3;
  const gapY = formData.flexoGapY ?? 3;
  const lanes = formData.flexoLanes ?? 1;
  const rows = formData.termoDieRows ?? 1;
  const margin = formData.termoDieMarginMm ?? 5;
  const radius = formData.termoCornerRadius ?? 0;

  const set = (field: string, val: any) => {
    handleFieldChange(field, val);
    onMarkUnsaved();
  };

  const contour = useMemo(() => {
    if (source !== "file") return null;
    const parsed = parseSvgContour(formData.customSvgPath || "");
    if (!parsed) return null;
    return { pathD: parsed.pathD, viewBox: parsed.computedBox || parsed.viewBox };
  }, [source, formData.customSvgPath]);

  const layout = useMemo(
    () =>
      calculateDieLayout({
        webWidthMm: web,
        labelWidthMm: w,
        labelHeightMm: h,
        gapXMm: gapX,
        gapYMm: gapY,
        lanes,
        rows,
        marginMm: margin,
        cornerRadiusMm: radius,
      }),
    [web, w, h, gapX, gapY, lanes, rows, margin, radius]
  );

  const rc = useMemo(
    () =>
      calculateRollCutting({
        webWidthMm: web,
        labelWidthMm: w,
        labelHeightMm: h,
        gapXMm: gapX,
        gapYMm: gapY,
        lanes,
        rollsCount: formData.flexoRollsCount || 0,
        labelsPerRoll: formData.flexoLabelsPerRoll || 0,
      }),
    [web, w, h, gapX, gapY, lanes, formData.flexoRollsCount, formData.flexoLabelsPerRoll]
  );

  const strokesPerRoll = formData.flexoLabelsPerRoll ? Math.ceil(formData.flexoLabelsPerRoll / rows) : 0;

  const svg = useMemo(
    () =>
      w > 0 && h > 0
        ? buildDieSvg({
            layout,
            labelWidthMm: w,
            labelHeightMm: h,
            cornerRadiusMm: radius,
            contour,
            title: `${docNo || "Pichoq"} ${w}x${h}`,
          })
        : "",
    [layout, w, h, radius, contour, docNo]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "").trim();
      const dims = extractSvgDimensions(text);
      handleFieldChange({
        customSvgPath: text,
        termoDieSource: "file",
        ...(dims && dims.width > 0 && dims.height > 0 ? { width: dims.width, height: dims.height } : {}),
      });
      onMarkUnsaved();
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docNo || "pichoq"}-${w}x${h}-${lanes}x${rows}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddTooling = () => {
    onAddTooling({
      id: `TL-DIE-TERMO-${Date.now()}`,
      category: "die_cutting",
      name: `${formData.product || "Termo stiker"} yassi pichoq ${w}x${h}`,
      specDetails: `Yassi pichoq, ${lanes} qator x ${rows} qatorda, stiker ${w}x${h} mm, R${radius}, oraliq ${gapX}/${gapY} mm, plita ${layout.dieWidthMm.toFixed(1)}x${layout.dieLengthMm.toFixed(1)} mm, qadam ${layout.feedStepMm.toFixed(1)} mm`,
      quantity: 1,
      unit: "dona",
      estimatedCost: 0,
      currency: formData.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 text-xs">
      <div className="space-y-3">
        <div className="p-3 bg-card border border-border rounded-lg space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-border">
            <span className="font-semibold text-xs text-foreground">Chizma</span>
            <div className="inline-flex items-center bg-muted p-0.5 rounded-md border border-border">
              {(["size", "file"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={isOperator || (s === "file" && !formData.customSvgPath)}
                  onClick={() => set("termoDieSource", s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                    source === s
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "size" ? "O'lchamdan" : "Fayldan"}
                </button>
              ))}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleFile} />
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isOperator}
              onClick={() => fileRef.current?.click()}
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              SVG yuklash
            </Button>
            {formData.customSvgPath && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isOperator}
                title="Faylni olib tashlash"
                onClick={() => {
                  handleFieldChange({ customSvgPath: "", termoDieSource: "size" });
                  onMarkUnsaved();
                }}
                className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {source === "file" && !contour && (
              <span className="text-[11px] text-destructive">Kontur o&apos;qilmadi</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Eni (mm)" value={w} step={0.5} disabled={isOperator} onChange={(n) => set("width", n)} />
            <Field label="Bo'yi (mm)" value={h} step={0.5} disabled={isOperator} onChange={(n) => set("height", n)} />
            <Field
              label="Burchak R"
              value={radius}
              step={0.5}
              disabled={isOperator || source === "file"}
              onChange={(n) => set("termoCornerRadius", n)}
            />
          </div>
        </div>

        <div className="p-3 bg-card border border-border rounded-lg space-y-2.5">
          <div className="pb-1.5 border-b border-border">
            <span className="font-semibold text-xs text-foreground">Pichoq</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="Qatorlar"
              value={lanes}
              min={1}
              disabled={isOperator}
              onChange={(n) => set("flexoLanes", Math.max(1, Math.floor(n) || 1))}
            />
            <Field
              label="Uzunlikda"
              value={rows}
              min={1}
              disabled={isOperator}
              onChange={(n) => set("termoDieRows", Math.max(1, Math.floor(n) || 1))}
            />
            <Field
              label="Chekka (mm)"
              value={margin}
              step={0.5}
              disabled={isOperator}
              onChange={(n) => set("termoDieMarginMm", n)}
            />
            <Field label="Rulon eni" value={web} min={10} disabled={isOperator} onChange={(n) => set("flexoWebWidth", n)} />
            <Field label="Oraliq X" value={gapX} step={0.5} disabled={isOperator} onChange={(n) => set("flexoGapX", n)} />
            <Field label="Oraliq Y" value={gapY} step={0.5} disabled={isOperator} onChange={(n) => set("flexoGapY", n)} />
          </div>
        </div>

        <div className="p-3 bg-card border border-border rounded-lg space-y-1.5">
          <div className="pb-1.5 border-b border-border">
            <span className="font-semibold text-xs text-foreground">Natija</span>
          </div>
          <Stat label="Max qator" value={String(layout.maxLanes)} danger={layout.lanesExceeded} />
          <Stat
            label="Plita"
            value={`${layout.dieWidthMm.toFixed(1)} x ${layout.dieLengthMm.toFixed(1)} mm`}
            danger={!layout.fitsWeb}
          />
          <Stat label="Qadam" value={`${layout.feedStepMm.toFixed(2)} mm`} />
          <Stat label="Zarbada" value={`${layout.labelsPerStroke} dona`} />
          <Stat label="Chekka qoldig'i" value={`${layout.edgeWasteMm.toFixed(1)} mm`} />
          <Stat label="Zarba / rulon" value={strokesPerRoll.toLocaleString()} />
          <Stat label="O'tishlar" value={String(rc.passes)} />
          <Stat label="Jumbo sarf" value={`${rc.jumboMeters.toFixed(0)} m / ${rc.jumboAreaM2.toFixed(1)} m2`} />
          <Stat label="Chiqindi" value={`${rc.wastePercent.toFixed(1)}%`} />
        </div>
      </div>

      <div className="p-3 bg-card border border-border rounded-lg flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between pb-1.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Stamp className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground">Maket</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {lanes} x {rows}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!svg}
              onClick={handleExport}
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              SVG
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!svg || isOperator}
              onClick={handleAddTooling}
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <Stamp className="w-3.5 h-3.5" />
              Shtampga
            </Button>
          </div>
        </div>
        {svg ? (
          <div
            className="w-full overflow-auto rounded border border-border bg-muted/20 p-2 [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[70vh]"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="p-6 text-center text-muted-foreground border border-dashed border-border rounded">
            Stiker eni va bo&apos;yini kiriting
          </div>
        )}
      </div>
    </div>
  );
}
