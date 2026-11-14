"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Maximize2, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented, Stat, fmt } from "../components/fields";
import { variantColor } from "../components/variantColor";
import type { SheetImpositionController } from "../useSheetImposition";

type View = "scheme" | "pdf";

function SchemeView({ c, formIdx, side }: { c: SheetImpositionController; formIdx: number; side: "front" | "back" }) {
  const s = c.settings;
  const form = c.calc?.forms[formIdx];
  const cells = side === "back" ? form?.back_cells ?? [] : form?.front_cells ?? [];
  const W = s.sheetW;
  const H = s.sheetH;
  const stroke = Math.max(W, H) / 900;

  return (
    <svg viewBox={`${-W * 0.02} ${-H * 0.02} ${W * 1.04} ${H * 1.04}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={W} height={H} fill="var(--background)" stroke="var(--border)" strokeWidth={stroke * 2} />
      {/* Printable area */}
      <rect
        x={s.marginLeft}
        y={s.marginTop}
        width={Math.max(0, W - s.marginLeft - s.marginRight)}
        height={Math.max(0, H - s.marginTop - s.marginBottom)}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.4}
        strokeDasharray={`${stroke * 6} ${stroke * 4}`}
        strokeWidth={stroke}
      />
      {/* Gripper band (bottom edge, as in the engine) */}
      <rect x={0} y={H - s.marginBottom} width={W} height={s.marginBottom} fill="var(--muted-foreground)" fillOpacity={0.12} />
      <text x={W / 2} y={H - s.marginBottom / 2} fontSize={Math.min(s.marginBottom * 0.55, 8)} textAnchor="middle" dominantBaseline="middle" fill="var(--muted-foreground)">
        KLAPAN {s.marginBottom} mm
      </text>

      {cells.map((cell, i) => {
        const col = variantColor(cell.variant_index);
        const fs = Math.max(2, Math.min(cell.w_mm, cell.h_mm) * 0.16);
        return (
          <g key={i}>
            <rect x={cell.x_mm} y={cell.y_mm} width={cell.w_mm} height={cell.h_mm} fill={col.fill} stroke={col.stroke} strokeWidth={stroke} />
            <text
              x={cell.x_mm + cell.w_mm / 2}
              y={cell.y_mm + cell.h_mm / 2}
              fontSize={fs}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--foreground)"
              fillOpacity={0.75}
              className="font-mono"
            >
              {(cell.variant_name || "").slice(0, 14)}
              {cell.rotation ? ` ${cell.rotation}°` : ""}
            </text>
          </g>
        );
      })}

      <text x={0} y={-H * 0.006} fontSize={Math.max(W, H) / 70} fill="var(--muted-foreground)" className="font-mono">
        {W}×{H} mm
      </text>
    </svg>
  );
}

export function SheetCanvas({ c }: { c: SheetImpositionController }) {
  const [view, setView] = useState<View>("scheme");
  const [formSel, setFormIdx] = useState(0);
  const [sideSel, setSide] = useState<"front" | "back">("front");
  const [pageIdx, setPageIdx] = useState(0);
  const [fit, setFit] = useState(true);

  const forms = c.calc?.forms ?? [];
  const formIdx = formSel < forms.length ? formSel : 0;
  const hasBack = (forms[formIdx]?.back_cells.length ?? 0) > 0;
  const side = hasBack ? sideSel : "front";
  const pages = c.generated?.pages ?? [];

  // Jump to the rendered PDF whenever a new montage arrives (adjust state during render)
  const [seenGenerated, setSeenGenerated] = useState(c.generated);
  if (c.generated !== seenGenerated) {
    setSeenGenerated(c.generated);
    if (c.generated) {
      setView("pdf");
      setPageIdx(0);
    }
  }

  const sm = c.summary;
  const overTone = sm && sm.overprintPct > c.settings.maxOverprintPct ? "warn" : undefined;

  const stats = useMemo(
    () =>
      c.calc && sm
        ? [
            { label: "Grid", value: `${c.calc.cols}×${c.calc.rows}${c.calc.rotation ? " ↻" : ""}` },
            { label: "Dona/list", value: c.calc.items_per_sheet },
            { label: "Forma", value: sm.forms },
            { label: "Press-list", value: fmt(sm.pressSheets) },
            { label: "Ota-list", value: fmt(sm.parentSheets) },
            { label: "CTP", value: sm.ctpPlates },
            { label: "Ortiqcha", value: `${sm.overprintPct.toFixed(1)}%`, tone: overTone as "warn" | undefined },
            { label: "To'lish", value: `${c.calc.utilization_pct.toFixed(0)}%` },
          ]
        : [],
    [c.calc, sm, overTone]
  );

  return (
    <div className="flex flex-col h-full min-h-0 border border-border rounded-md bg-card overflow-hidden">
      <div className="grid grid-cols-4 2xl:grid-cols-8 border-b border-border min-h-[42px] [&>*:nth-child(-n+4)]:border-b 2xl:[&>*:nth-child(-n+4)]:border-b-0 [&>*]:border-border">

        {stats.map((st) => (
          <Stat key={st.label} label={st.label} value={st.value} tone={st.tone} />
        ))}
      </div>

      <div className="h-9 px-2 flex items-center gap-2 border-b border-border">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "scheme", label: "Sxema" },
            { value: "pdf", label: "PDF" },
          ]}
          disabled={!pages.length}
        />
        {view === "scheme" ? (
          <>
            {forms.length > 1 && (
              <Segmented
                value={formIdx}
                onChange={setFormIdx}
                options={forms.map((f, i) => ({ value: i, label: `F${f.form_index}` }))}
              />
            )}
            {hasBack && (
              <Segmented
                value={side}
                onChange={setSide}
                options={[
                  { value: "front", label: "Oldi" },
                  { value: "back", label: "Orqa" },
                ]}
              />
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {pages.map((p, i) => (
                <button
                  key={p.page_index}
                  type="button"
                  onClick={() => setPageIdx(i)}
                  className={cn(
                    "h-7 px-2 rounded border text-xs whitespace-nowrap cursor-pointer",
                    i === pageIdx ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              title={fit ? "100%" : "Sig'dirish"}
              onClick={() => setFit((f) => !f)}
              className="ml-auto size-7 inline-flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {fit ? <ZoomIn className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </>
        )}
        {c.calcLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>

      <div className={cn("flex-1 min-h-0 p-3 bg-muted/30", view === "pdf" && !fit ? "overflow-auto" : "overflow-hidden")}>
        {c.calcError && view === "scheme" ? (
          <div className="h-full flex items-center justify-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-4" />
            {c.calcError}
          </div>
        ) : view === "scheme" ? (
          c.calc ? (
            <SchemeView c={c} formIdx={formIdx} side={side} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )
        ) : pages[pageIdx] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pages[pageIdx].url}
            alt={pages[pageIdx].label}
            className={cn("mx-auto bg-white shadow-sm", fit ? "max-h-full max-w-full object-contain" : "max-w-none")}
          />
        ) : null}
      </div>
    </div>
  );
}
