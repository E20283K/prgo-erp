"use client";

import React, { useCallback, useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { SheetImpositionController } from "../useSheetImposition";

/**
 * Small live diagrams next to imposition fields, in the style of the parent sheet cut sketch:
 * 60×44 px, monochrome, the part the focused field controls drawn in the primary colour.
 */

const BOX_W = 60;
const BOX_H = 44;

/**
 * Tracks which field of a group has focus. Wrap each field in an element with `data-k`
 * and spread the handlers on a common parent.
 */
export function useFocusKey() {
  const [focus, setFocus] = useState<string | null>(null);
  const onFocusCapture = useCallback((e: React.FocusEvent) => {
    setFocus((e.target as HTMLElement).closest("[data-k]")?.getAttribute("data-k") ?? null);
  }, []);
  const onBlurCapture = useCallback(() => setFocus(null), []);
  return { focus, handlers: { onFocusCapture, onBlurCapture } };
}

function Frame({ caption, title, children }: { caption?: React.ReactNode; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0" title={title}>
      <svg width={BOX_W + 2} height={BOX_H + 2} viewBox={`-1 -1 ${BOX_W + 2} ${BOX_H + 2}`} className="overflow-visible">
        {children}
      </svg>
      <span className="h-2.5 text-[10px] font-mono leading-none text-muted-foreground whitespace-nowrap">{caption}</span>
    </div>
  );
}

const hi = (on: boolean, base: string, active = "fill-primary/50 stroke-primary") => (on ? active : base);

// ------------------------------------------------------------------------------------ print mode

/** One sheet one plate set, two sheets two sets, or one sheet turned over for both sides. */
export function ModeSketch({ mode }: { mode: SheetImpositionController["settings"]["mode"] }) {
  const face = (x: number, y: number, w: number, h: number, label: string, key: string) => (
    <g key={key}>
      <rect x={x} y={y} width={w} height={h} className="fill-primary/15 stroke-primary/60" strokeWidth={0.75} />
      <text
        x={x + w / 2}
        y={y + h / 2}
        fontSize={9}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground/70 font-mono"
      >
        {label}
      </text>
    </g>
  );

  if (mode === "sheetwise") {
    return (
      <Frame caption="2 forma" title="Oldi va orqa alohida formada">
        <rect x={2} y={8} width={26} height={26} className="fill-muted stroke-border" strokeWidth={1} />
        {face(5, 11, 20, 20, "A", "a")}
        <rect x={32} y={8} width={26} height={26} className="fill-muted stroke-border" strokeWidth={1} />
        {face(35, 11, 20, 20, "B", "b")}
      </Frame>
    );
  }
  if (mode === "work_and_turn") {
    return (
      <Frame caption="1 forma" title="Oldi va orqa bitta formada, list ag'dariladi">
        <rect x={6} y={4} width={48} height={26} className="fill-muted stroke-border" strokeWidth={1} />
        {face(9, 7, 20, 20, "A", "a")}
        {face(31, 7, 20, 20, "B", "b")}
        <line x1={30} y1={1} x2={30} y2={33} className="stroke-muted-foreground" strokeWidth={0.75} strokeDasharray="2 1.5" />
        {/* Turn over the long side */}
        <path d="M 14 37 Q 30 45 46 37" className="fill-none stroke-foreground/70" strokeWidth={1} />
        <path d="M 46 37 l -4 -0.5 M 46 37 l -1.5 3.5" className="fill-none stroke-foreground/70" strokeWidth={1} />
      </Frame>
    );
  }
  return (
    <Frame caption="1 forma" title="Bir tomonlama">
      <rect x={12} y={6} width={36} height={28} className="fill-muted stroke-border" strokeWidth={1} />
      {face(15, 9, 30, 22, "A", "a")}
    </Frame>
  );
}

// ------------------------------------------------------------------------------------ knife / gutter

/** One knife cuts flush between neighbours; two knives leave the gutter as waste. */
export function KnifeSketch({
  cutStyle,
  gutter,
  focus,
}: {
  cutStyle: "single" | "double";
  gutter: number;
  focus?: string | null;
}) {
  const double = cutStyle === "double" && gutter > 0;
  const g = double ? Math.min(14, Math.max(4, gutter * 2.5)) : 0;
  const pw = (BOX_W - 8 - g) / 2;
  const x1 = 4;
  const x2 = x1 + pw + g;
  const y = 8;
  const h = 26;
  const gapOn = focus === "gutterX" || focus === "gutterY";
  const knives = double ? [x1 + pw, x2] : [x1 + pw];
  const hatchId = `sk-hatch-${useId().replace(/:/g, "")}`;

  return (
    <Frame caption={double ? `${gutter} mm` : "0 mm"} title={double ? "2 pichoq: oraliq chiqindiga" : "1 pichoq: oraliqsiz"}>
      <defs>
        <pattern id={hatchId} width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={3} className="stroke-muted-foreground/60" strokeWidth={1} />
        </pattern>
      </defs>
      <rect x={x1} y={y} width={pw} height={h} className="fill-primary/15 stroke-primary/60" strokeWidth={0.75} />
      <rect x={x2} y={y} width={pw} height={h} className="fill-primary/15 stroke-primary/60" strokeWidth={0.75} />
      {double && (
        <rect
          x={x1 + pw}
          y={y}
          width={g}
          height={h}
          fill={`url(#${hatchId})`}
          className={gapOn ? "stroke-primary" : "stroke-none"}
          strokeWidth={0.75}
        />
      )}
      {knives.map((x) => (
        <line key={x} x1={x} y1={2} x2={x} y2={BOX_H - 4} className="stroke-foreground" strokeWidth={1} strokeDasharray="3 1.5" />
      ))}
    </Frame>
  );
}

// ------------------------------------------------------------------------------------ bleed / crop

/**
 * Corner of the block: a piece on the outer edge and its neighbour across the gutter.
 * Outer edges get the outer bleed and crop marks; edges facing a neighbour get the inner bleed.
 */
export function BleedSketch({
  outer,
  inner,
  cropGap,
  cropWidth,
  gutter,
  focus,
}: {
  outer: number;
  inner: number;
  cropGap: number;
  cropWidth: number;
  gutter: number;
  focus?: string | null;
}) {
  const CROP_LEN = 4;
  const x0 = 17;
  const y0 = 16;
  const k = Math.min(2.5, 15 / Math.max(1, outer + cropGap + CROP_LEN));
  const pieceW = 18;
  const o = outer * k;
  const ib = Math.min(inner, gutter / 2) * k;
  const g = Math.max(gutter * k, 0);
  const xB = x0 + pieceW + g;
  const bottom = BOX_H;

  const onOuter = focus === "outerBleed";
  const onInner = focus === "innerBleed";
  const onGap = focus === "cropGap";
  const onCrop = focus === "cropLineWidth";

  const cropOff = (outer + cropGap) * k;
  const cropLen = CROP_LEN * k;
  const cropCls = onCrop ? "stroke-primary" : "stroke-foreground";
  const cropW = onCrop ? 1.5 : 0.75;

  const caption =
    focus === "outerBleed"
      ? `${outer} mm`
      : focus === "innerBleed"
        ? `${inner} mm`
        : focus === "cropGap"
          ? `${cropGap} mm`
          : focus === "cropLineWidth"
            ? `${cropWidth} mm`
            : `${outer} / ${inner}`;

  return (
    <Frame caption={caption} title="Tashqi fon / ichki fon">
      {/* Outer bleed: left and top of the corner piece, top of the neighbour */}
      <rect x={x0 - o} y={y0 - o} width={o} height={bottom - y0 + o} className={hi(onOuter, "fill-muted-foreground/20 stroke-none")} strokeWidth={0.5} />
      <rect x={x0} y={y0 - o} width={pieceW + ib} height={o} className={hi(onOuter, "fill-muted-foreground/20 stroke-none")} strokeWidth={0.5} />
      {xB < BOX_W && (
        <rect x={xB - ib} y={y0 - o} width={BOX_W - xB + ib} height={o} className={hi(onOuter, "fill-muted-foreground/20 stroke-none")} strokeWidth={0.5} />
      )}
      {/* Inner bleed: towards the neighbour */}
      {ib > 0 && (
        <>
          <rect x={x0 + pieceW} y={y0} width={ib} height={bottom - y0} className={hi(onInner, "fill-muted-foreground/20 stroke-none")} strokeWidth={0.5} />
          {xB < BOX_W && (
            <rect x={xB - ib} y={y0} width={ib} height={bottom - y0} className={hi(onInner, "fill-muted-foreground/20 stroke-none")} strokeWidth={0.5} />
          )}
        </>
      )}
      {/* Trim boxes */}
      <rect x={x0} y={y0} width={pieceW} height={bottom - y0} className="fill-primary/15 stroke-primary/70" strokeWidth={0.75} />
      {xB < BOX_W && <rect x={xB} y={y0} width={BOX_W - xB} height={bottom - y0} className="fill-primary/15 stroke-primary/70" strokeWidth={0.75} />}

      {/* Crop marks on the outer edges, offset by bleed + gap */}
      <g className={cropCls} strokeWidth={cropW}>
        {[x0, x0 + pieceW, ...(xB < BOX_W ? [xB] : [])].map((x) => (
          <line key={`v${x}`} x1={x} y1={y0 - cropOff} x2={x} y2={Math.max(0, y0 - cropOff - cropLen)} />
        ))}
        <line x1={x0 - cropOff} y1={y0} x2={Math.max(0, x0 - cropOff - cropLen)} y2={y0} />
        <line x1={x0 - cropOff} y1={BOX_H - 6} x2={Math.max(0, x0 - cropOff - cropLen)} y2={BOX_H - 6} />
      </g>
      {/* Crop gap: from the bleed edge to the mark */}
      {onGap && cropGap > 0 && (
        <g className="stroke-primary" strokeWidth={2.5}>
          <line x1={x0} y1={y0 - o} x2={x0} y2={y0 - cropOff} />
          <line x1={x0 - o} y1={y0} x2={x0 - cropOff} y2={y0} />
        </g>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------------------------ margins

/** Press sheet with its margins, gripper band and where the block sits. */
export function MarginSketch({
  sheetW,
  sheetH,
  top,
  bottom,
  left,
  right,
  gripper,
  alignment,
  blockW,
  blockH,
  focus,
}: {
  sheetW: number;
  sheetH: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  gripper: boolean;
  alignment: "center" | "gripper";
  blockW?: number;
  blockH?: number;
  focus?: string | null;
}) {
  if (!(sheetW > 0 && sheetH > 0)) return null;
  const scale = Math.min(BOX_W / sheetW, (BOX_H - 2) / sheetH);
  const W = sheetW * scale;
  const H = sheetH * scale;
  // Margins are a few % of the sheet: keep each band visible
  const band = (mm: number) => Math.max(mm * scale, 3.5);
  const t = band(top);
  const b = band(bottom);
  const l = band(left);
  const r = band(right);
  const ox = (BOX_W - W) / 2;
  const oy = (BOX_H - H) / 2;

  const areaW = Math.max(0, W - l - r);
  const areaH = Math.max(0, H - t - b);
  const bw = blockW ? Math.min(areaW, blockW * scale) : 0;
  const bh = blockH ? Math.min(areaH, blockH * scale) : 0;
  const bx = l + (areaW - bw) / 2;
  const by = alignment === "gripper" && gripper ? H - b - bh : t + (areaH - bh) / 2;

  const bandCls = (key: string, base = "fill-muted-foreground/10") => (focus === key ? "fill-primary/40" : base);
  const values: Record<string, number> = { marginBottom: bottom, marginTop: top, marginLeft: left, marginRight: right };

  return (
    <Frame caption={focus && focus in values ? `${values[focus]} mm` : gripper ? "Klapan" : ""} title="Hoshiyalar">
      <g transform={`translate(${ox} ${oy})`}>
        <rect width={W} height={H} className="fill-muted stroke-border" strokeWidth={1} />
        <rect x={0} y={0} width={W} height={t} className={bandCls("marginTop")} />
        <rect x={0} y={H - b} width={W} height={b} className={bandCls("marginBottom", gripper ? "fill-muted-foreground/30" : "fill-muted-foreground/10")} />
        <rect x={0} y={t} width={l} height={areaH} className={bandCls("marginLeft")} />
        <rect x={W - r} y={t} width={r} height={areaH} className={bandCls("marginRight")} />
        <rect
          x={l}
          y={t}
          width={areaW}
          height={areaH}
          className="fill-none stroke-muted-foreground/60"
          strokeWidth={0.75}
          strokeDasharray="2 1.5"
        />
        {bw > 0 && bh > 0 && (
          <rect x={bx} y={by} width={bw} height={bh} className="fill-primary/15 stroke-primary/60" strokeWidth={0.75} />
        )}
      </g>
    </Frame>
  );
}

/** Field + sketch row: fields take the space, the sketch sits on the right. */
export function WithSketch({
  sketch,
  children,
  className,
  ...handlers
}: {
  sketch: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & Partial<ReturnType<typeof useFocusKey>["handlers"]>) {
  return (
    <div className={cn("flex gap-2 items-start", className)} {...handlers}>
      <div className="flex-1 min-w-0">{children}</div>
      {sketch}
    </div>
  );
}
