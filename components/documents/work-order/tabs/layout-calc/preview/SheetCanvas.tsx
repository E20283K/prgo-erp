"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Download, Loader2, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented, Stat, fmt } from "../components/fields";
import { variantColor } from "../components/variantColor";
import type { SheetImpositionController } from "../useSheetImposition";

const PdfViewer = dynamic(() => import("@/components/file-viewer/PdfViewer"), { ssr: false });

type View = "scheme" | "pdf";
type ViewBox = { x: number; y: number; w: number; h: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 40;
const BUTTON_STEP = 1.4;

/** Mouse notch (~100px) ≈ 15%; trackpad / pinch deltas are small, so zoom stays smooth. */
function wheelFactor(e: WheelEvent): number {
  const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  const clamped = Math.max(-200, Math.min(200, px));
  return Math.exp(-clamped * 0.0014);
}

function SchemeView({ c, formIdx, side }: { c: SheetImpositionController; formIdx: number; side: "front" | "back" }) {
  const s = c.settings;
  const form = c.calc?.forms[formIdx];
  const cells = side === "back" ? form?.back_cells ?? [] : form?.front_cells ?? [];
  const W = s.sheetW;
  const H = s.sheetH;

  const base = useMemo<ViewBox>(() => ({ x: -W * 0.02, y: -H * 0.04, w: W * 1.04, h: H * 1.06 }), [W, H]);
  const [vb, setVb] = useState<ViewBox>(base);
  // Reset the view when the sheet size changes (adjust state during render)
  const [seenBase, setSeenBase] = useState(base);
  if (seenBase !== base) {
    setSeenBase(base);
    setVb(base);
  }

  const zoom = base.w / vb.w;
  // Keep strokes and labels a constant on-screen size while zooming
  const stroke = Math.max(W, H) / 900 / Math.sqrt(zoom);

  const svgRef = useRef<SVGSVGElement>(null);

  /** Client (px) point -> sheet (mm) point using the current CTM. */
  const toSheet = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const zoomAt = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setVb((prev) => {
        const cur = base.w / prev.w;
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cur * factor));
        if (next === cur) return prev;
        const w = base.w / next;
        const h = base.h / next;
        const ax = anchor?.x ?? prev.x + prev.w / 2;
        const ay = anchor?.y ?? prev.y + prev.h / 2;
        // Keep the anchor point fixed on screen
        const x = ax - ((ax - prev.x) / prev.w) * w;
        const y = ay - ((ay - prev.y) / prev.h) * h;
        return next === MIN_ZOOM ? base : { x, y, w, h };
      });
    },
    [base]
  );

  // Wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const anchor = toSheet(e.clientX, e.clientY) ?? undefined;
      zoomAt(wheelFactor(e), anchor);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toSheet, zoomAt]);

  // Drag to pan
  const drag = useRef<{ x: number; y: number; vb: ViewBox; pxPerMm: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || zoom <= MIN_ZOOM) return;
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vb, pxPerMm: ctm.a };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.pxPerMm;
    const dy = (e.clientY - d.y) / d.pxPerMm;
    setVb({ ...d.vb, x: d.vb.x - dx, y: d.vb.y - dy });
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className={cn("w-full h-full select-none touch-none", zoom > MIN_ZOOM && "cursor-grab active:cursor-grabbing")}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setVb(base)}
      >
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
        <text
          x={W / 2}
          y={H - s.marginBottom / 2}
          fontSize={Math.min(s.marginBottom * 0.55, 8)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--muted-foreground)"
        >
          KLAPAN {s.marginBottom} mm
        </text>

        {cells.map((cell, i) => {
          const col = variantColor(cell.variant_index);
          const fs = Math.max(1, Math.min(cell.w_mm, cell.h_mm) * 0.16);
          return (
            <g key={i}>
              <title>{`${cell.variant_name} · ${cell.w_mm}×${cell.h_mm} mm · ${cell.col + 1}/${cell.row + 1}`}</title>
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

        <text x={0} y={-H * 0.012} fontSize={Math.max(W, H) / 70} fill="var(--muted-foreground)" className="font-mono">
          {W}×{H} mm
        </text>
      </svg>

      <div className="absolute right-2 bottom-2 flex items-center h-7 rounded-md border border-border bg-card shadow-2xs">
        <button
          type="button"
          title="Kichiklashtirish"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomAt(1 / BUTTON_STEP)}
          className="size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <span className="w-12 text-center text-[11px] font-mono tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          title="Kattalashtirish"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomAt(BUTTON_STEP)}
          className="size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          <ZoomIn className="size-3.5" />
        </button>
        <button
          type="button"
          title="Sig'dirish"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setVb(base)}
          className="size-7 inline-flex items-center justify-center border-l border-border text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          <Maximize className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SheetCanvas({ c }: { c: SheetImpositionController }) {
  const [view, setView] = useState<View>("scheme");
  const [formSel, setFormIdx] = useState(0);
  const [sideSel, setSide] = useState<"front" | "back">("front");

  const forms = c.calc?.forms ?? [];
  const formIdx = formSel < forms.length ? formSel : 0;
  const hasBack = (forms[formIdx]?.back_cells.length ?? 0) > 0;
  const side = hasBack ? sideSel : "front";

  const mainFile = c.generated?.files.find((f) => f.label === "Montaj") ?? c.generated?.files[0];
  const pdfUrl = mainFile?.url ?? c.savedPdfUrl;

  // Jump to the PDF whenever a new montage arrives (adjust state during render)
  const [seenGenerated, setSeenGenerated] = useState(c.generated);
  if (c.generated !== seenGenerated) {
    setSeenGenerated(c.generated);
    if (c.generated) setView("pdf");
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
          disabled={!pdfUrl}
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
            {c.calcLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-auto" />}
          </>
        ) : (
          pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              download
              title="Yuklab olish"
              className="ml-auto size-7 inline-flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
            </a>
          )
        )}
      </div>

      <div className={cn("flex-1 min-h-0 overflow-hidden", view === "scheme" ? "p-3 bg-muted/30" : "")}>
        {view === "pdf" && pdfUrl ? (
          <PdfViewer key={pdfUrl} url={pdfUrl} />
        ) : c.calcError ? (
          <div className="h-full flex items-center justify-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-4" />
            {c.calcError}
          </div>
        ) : c.calc ? (
          <SchemeView c={c} formIdx={formIdx} side={side} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
