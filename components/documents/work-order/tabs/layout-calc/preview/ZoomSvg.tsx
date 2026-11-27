"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

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

/**
 * Sheet-sized SVG with wheel / button zoom and drag-to-pan; children get a zoom-stable stroke
 * width. `pad` (fraction of the longer side) reserves room around the sheet for labels.
 */
export function ZoomSvg({
  W,
  H,
  pad,
  children,
}: {
  W: number;
  H: number;
  pad?: number;
  children: (stroke: number) => React.ReactNode;
}) {
  const base = useMemo<ViewBox>(() => {
    if (pad == null) return { x: -W * 0.02, y: -H * 0.04, w: W * 1.04, h: H * 1.06 };
    const p = Math.max(W, H) * pad;
    return { x: -p, y: -p, w: W + 2 * p, h: H + 2 * p };
  }, [W, H, pad]);
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
        {children(stroke)}
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
