"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented, Stat, fmt } from "../components/fields";
import { variantColor } from "../components/variantColor";
import type { SheetImpositionController } from "../useSheetImposition";
import { ZoomSvg } from "./ZoomSvg";
import { CutPlanView } from "./CutPlanView";
import { COLOR_BAR, colorBarPlacement } from "../colorBar";

const PdfViewer = dynamic(() => import("@/components/file-viewer/PdfViewer"), { ssr: false });

type View = "scheme" | "cut" | "pdf";

/** Matches crop_length_mm sent to doc-service */
const CROP_LEN = 4;

function SchemeView({ c, formIdx, side }: { c: SheetImpositionController; formIdx: number; side: "front" | "back" }) {
  const s = c.settings;
  const form = c.calc?.forms[formIdx];
  const cells = useMemo(
    () => (side === "back" ? form?.back_cells : form?.front_cells) ?? [],
    [form, side]
  );
  const W = s.sheetW;
  const H = s.sheetH;

  const maxCol = cells.reduce((m, c2) => Math.max(m, c2.col), 0);
  const maxRow = cells.reduce((m, c2) => Math.max(m, c2.row), 0);
  const cropOff = s.outerBleed + s.cropGap;
  const block = useMemo(() => {
    if (!cells.length) return null;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const xs = new Set<number>();
    const ys = new Set<number>();
    for (const c2 of cells) {
      xs.add(r2(c2.x_mm));
      xs.add(r2(c2.x_mm + c2.w_mm));
      ys.add(r2(c2.y_mm));
      ys.add(r2(c2.y_mm + c2.h_mm));
    }
    return {
      minX: Math.min(...cells.map((c2) => c2.x_mm)),
      maxX: Math.max(...cells.map((c2) => c2.x_mm + c2.w_mm)),
      minY: Math.min(...cells.map((c2) => c2.y_mm)),
      maxY: Math.max(...cells.map((c2) => c2.y_mm + c2.h_mm)),
      xs: [...xs],
      ys: [...ys],
    };
  }, [cells]);

  const bar = s.colorBar ? colorBarPlacement(cells, { ...s, sheetW: W }) : null;

  return (
    <ZoomSvg W={W} H={H}>
      {(stroke) => (
        <>
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
            {s.gripper !== false && (
              <>
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
              </>
            )}

            {/* CMYK shkala: klapanga qarama-qarshi chetda, ▲ list markazida (engine bilan bir xil) */}
            {bar?.segments.map((seg) => (
              <svg
                key={seg.originX}
                x={seg.clipX0}
                y={bar.yTop}
                width={seg.clipX1 - seg.clipX0}
                height={COLOR_BAR.heightMm}
                overflow="hidden"
              >
                <image
                  href={COLOR_BAR.src}
                  x={seg.originX - seg.clipX0}
                  y={0}
                  width={COLOR_BAR.widthMm}
                  height={COLOR_BAR.heightMm}
                  preserveAspectRatio="none"
                />
              </svg>
            ))}

            {/* Bleed (fon) behind each cell, as the engine extends artwork: outer edges of the block
                get the outer bleed, edges facing a neighbour get min(inner bleed, gutter / 2). */}
            {cells.map((cell, i) => {
              const l = cell.col === 0 ? s.outerBleed : Math.min(s.innerBleed, s.gutterX / 2);
              const r = cell.col === maxCol ? s.outerBleed : Math.min(s.innerBleed, s.gutterX / 2);
              const t = cell.row === 0 ? s.outerBleed : Math.min(s.innerBleed, s.gutterY / 2);
              const b = cell.row === maxRow ? s.outerBleed : Math.min(s.innerBleed, s.gutterY / 2);
              if (l + r + t + b <= 0) return null;
              return (
                <rect
                  key={`bleed-${i}`}
                  x={cell.x_mm - l}
                  y={cell.y_mm - t}
                  width={cell.w_mm + l + r}
                  height={cell.h_mm + t + b}
                  fill={variantColor(cell.variant_index).solid}
                  fillOpacity={0.18}
                />
              );
            })}

            {/* Crop marks on the outer perimeter only (engine: offset = outer bleed + crop gap, 4 mm long) */}
            {block && (
              <g stroke="var(--foreground)" strokeWidth={Math.max(stroke, s.cropLineWidth ?? 0.12)} strokeOpacity={0.8}>
                {block.xs.map((x) => (
                  <React.Fragment key={`cx-${x}`}>
                    <line x1={x} y1={block.minY - cropOff} x2={x} y2={block.minY - cropOff - CROP_LEN} />
                    <line x1={x} y1={block.maxY + cropOff} x2={x} y2={block.maxY + cropOff + CROP_LEN} />
                  </React.Fragment>
                ))}
                {block.ys.map((y) => (
                  <React.Fragment key={`cy-${y}`}>
                    <line x1={block.minX - cropOff} y1={y} x2={block.minX - cropOff - CROP_LEN} y2={y} />
                    <line x1={block.maxX + cropOff} y1={y} x2={block.maxX + cropOff + CROP_LEN} y2={y} />
                  </React.Fragment>
                ))}
              </g>
            )}

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
        </>
      )}
    </ZoomSvg>
  );
}

export function SheetCanvas({ c }: { c: SheetImpositionController }) {
  const [viewSel, setView] = useState<View>("scheme");
  const [formSel, setFormIdx] = useState(0);
  const [sideSel, setSide] = useState<"front" | "back">("front");

  const forms = c.calc?.forms ?? [];
  const formIdx = formSel < forms.length ? formSel : 0;
  const hasBack = (forms[formIdx]?.back_cells.length ?? 0) > 0;
  const side = hasBack ? sideSel : "front";

  const mainFile = c.generated?.files.find((f) => f.label === "Montaj") ?? c.generated?.files[0];
  const pdfUrl = mainFile?.url ?? c.savedPdfUrl;
  const canCut = c.settings.category === "guillotine";
  const view: View = (viewSel === "cut" && !canCut) || (viewSel === "pdf" && !pdfUrl) ? "scheme" : viewSel;

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
            { label: "Ortiqcha", value: `${sm.extraPct.toFixed(1)}%`, tone: overTone as "warn" | undefined },
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
            ...(canCut ? [{ value: "cut" as const, label: "Kesish" }] : []),
            { value: "pdf", label: "PDF", disabled: !pdfUrl },
          ]}
        />
        {view !== "pdf" ? (
          <>
            {forms.length > 1 && (
              <Segmented
                value={formIdx}
                onChange={setFormIdx}
                options={forms.map((f, i) => ({ value: i, label: `F${f.form_index}` }))}
              />
            )}
            {hasBack && view === "scheme" && (
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

      <div className={cn("flex-1 min-h-0 overflow-hidden", view !== "pdf" ? "p-3 bg-muted/30" : "")}>
        {view === "pdf" && pdfUrl ? (
          <PdfViewer key={pdfUrl} url={pdfUrl} />
        ) : c.calcError ? (
          <div className="h-full flex items-center justify-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-4" />
            {c.calcError}
          </div>
        ) : c.calc ? (
          view === "cut" ? (
            <CutPlanView c={c} formIdx={formIdx} />
          ) : (
            <SchemeView c={c} formIdx={formIdx} side={side} />
          )
        ) : (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
