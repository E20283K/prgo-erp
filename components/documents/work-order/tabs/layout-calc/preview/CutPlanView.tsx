"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Paperclip, Printer, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { variantColor } from "../components/variantColor";
import { buildCutPlan, cutPlanDims, cutPlanEdges, type CutStep } from "../cutPlan";
import { printCutPlans } from "../cutPlanSvg";
import type { SheetImpositionController } from "../useSheetImposition";
import { ZoomSvg } from "./ZoomSvg";

export function CutPlanView({ c, formIdx }: { c: SheetImpositionController; formIdx: number }) {
  const s = c.settings;
  const W = s.sheetW;
  const H = s.sheetH;
  const cells = useMemo(() => c.calc?.forms[formIdx]?.front_cells ?? [], [c.calc, formIdx]);
  const plan = useMemo(() => buildCutPlan(cells, W, H), [cells, W, H]);
  const dims = useMemo(
    () => cutPlanDims(cells.map((c2) => ({ x: c2.x_mm, y: c2.y_mm, w: c2.w_mm, h: c2.h_mm, v: c2.variant_index })), W, H),
    [cells, W, H]
  );
  const [active, setActive] = useState<number | null>(null);

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="size-4" />
        Gilotinda kesib bo&apos;lmaydi
      </div>
    );
  }

  /** Knife line segments for a step: stage 1 crosses the sheet, stage 2 only its strips. */
  const segments = (st: CutStep) => {
    const spans = st.stage === 1 ? [{ from: 0, to: st.axis === "y" ? W : H }] : plan.groups[st.group].spans;
    return spans.map((sp) =>
      st.axis === "y"
        ? { x1: sp.from, y1: st.pos, x2: sp.to, y2: st.pos }
        : { x1: st.pos, y1: sp.from, x2: st.pos, y2: sp.to }
    );
  };

  const edges = cutPlanEdges(plan.firstAxis);
  const stage1 = plan.steps.filter((st) => st.stage === 1);
  const stage2 = plan.steps.filter((st) => st.stage === 2);

  return (
    <div className="h-full min-h-0 grid grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_224px] gap-3">
      <div className="min-h-[240px]">
        <ZoomSvg W={W} H={H} pad={0.08}>
          {(stroke) => {
            const fs = Math.max(W, H) / 60;
            return (
              <>
                <rect x={0} y={0} width={W} height={H} fill="var(--background)" stroke="var(--border)" strokeWidth={stroke * 2} />

                {cells.map((cell, i) => (
                  <rect
                    key={i}
                    x={cell.x_mm}
                    y={cell.y_mm}
                    width={cell.w_mm}
                    height={cell.h_mm}
                    fill={variantColor(cell.variant_index).solid}
                    fillOpacity={0.14}
                  />
                ))}

                {/* Reference edges: gripper (bottom) and side lay (left) stay untouched */}
                <g stroke="var(--foreground)" strokeWidth={stroke * 5} strokeLinecap="square">
                  <line x1={0} y1={H} x2={W} y2={H} />
                  <line x1={0} y1={0} x2={0} y2={H} />
                </g>
                {/* Which edge goes to the back gauge and which faces the knife, per stage */}
                <g fontSize={fs * 0.75} textAnchor="middle" fill="var(--muted-foreground)">
                  <text x={W / 2} y={H + fs * 1.3}>{edges.bottom}</text>
                  <text x={W / 2} y={-fs * 0.6} fill="var(--foreground)" fontWeight={600}>
                    {edges.top}
                  </text>
                  <text x={-fs * 0.7} y={H / 2} transform={`rotate(-90 ${-fs * 0.7} ${H / 2})`}>
                    {edges.left}
                  </text>
                  <text
                    x={W + fs * 3.9}
                    y={H / 2}
                    fill="var(--foreground)"
                    fontWeight={600}
                    transform={`rotate(90 ${W + fs * 3.9} ${H / 2})`}
                  >
                    {edges.right}
                  </text>
                </g>

                {/* Piece size, gutter and edge waste */}
                <g pointerEvents="none">
                  {dims.map((d, i) => {
                    const vertical = d.x1 === d.x2;
                    const t = fs * 0.3;
                    const color = d.kind === "piece" ? "var(--foreground)" : "var(--muted-foreground)";
                    const mx = (d.x1 + d.x2) / 2;
                    const my = (d.y1 + d.y2) / 2;
                    return (
                      <g key={i} stroke={color} strokeWidth={stroke}>
                        <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
                        {vertical ? (
                          <>
                            <line x1={d.x1 - t} y1={d.y1} x2={d.x1 + t} y2={d.y1} />
                            <line x1={d.x2 - t} y1={d.y2} x2={d.x2 + t} y2={d.y2} />
                          </>
                        ) : (
                          <>
                            <line x1={d.x1} y1={d.y1 - t} x2={d.x1} y2={d.y1 + t} />
                            <line x1={d.x2} y1={d.y2 - t} x2={d.x2} y2={d.y2 + t} />
                          </>
                        )}
                        <text
                          x={vertical ? mx + (mx < W / 2 ? fs * 0.35 : -fs * 0.35) : mx}
                          y={vertical ? my : my - fs * 0.3}
                          fontSize={fs * 0.62}
                          textAnchor={vertical ? (mx < W / 2 ? "start" : "end") : "middle"}
                          dominantBaseline={vertical ? "central" : "auto"}
                          fill={color}
                          stroke="var(--background)"
                          strokeWidth={fs * 0.12}
                          paintOrder="stroke"
                          className="font-mono"
                        >
                          {d.value}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {plan.steps.map((st) => {
                  const on = active === st.n;
                  const dim = active != null && !on;
                  const segs = segments(st);
                  return (
                    <g
                      key={st.n}
                      opacity={dim ? 0.25 : 1}
                      onMouseEnter={() => setActive(st.n)}
                      onMouseLeave={() => setActive(null)}
                    >
                      {segs.map((sg, i) => (
                        <line
                          key={i}
                          {...sg}
                          stroke={st.drop === "product" ? "var(--primary)" : "var(--muted-foreground)"}
                          strokeWidth={stroke * (on ? 4 : 2)}
                          strokeDasharray={st.stage === 2 ? `${stroke * 8} ${stroke * 4}` : undefined}
                        />
                      ))}
                      {segs.slice(0, 1).map((sg, i) => {
                        // Stage 2 cuts the stacked strips in one stroke: one number, on the group's first strip
                        // Stage 1: outside the sheet (right / top); stage 2: inside the strip, at its start
                        // Waste cuts sit a gutter away from a product cut: their label moves one step along
                        const r = fs * 0.62;
                        const shift = st.drop === "waste" ? 2 * r + fs * 0.15 : 0;
                        const lx = st.axis === "y" ? (st.stage === 1 ? sg.x2 + fs * 0.9 : sg.x1 + fs * 0.9) + shift : sg.x1;
                        const ly =
                          st.axis === "y" ? sg.y1 : st.stage === 1 ? sg.y1 - fs * 0.9 - shift : sg.y1 + fs * 0.9 + shift;
                        return (
                          <g key={`l${i}`}>
                            <circle
                              cx={lx}
                              cy={ly}
                              r={r}
                              fill={on ? "var(--primary)" : "var(--card)"}
                              stroke="var(--primary)"
                              strokeWidth={stroke * 1.5}
                            />
                            <text
                              x={lx}
                              y={ly}
                              fontSize={fs * 0.7}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={on ? "var(--primary-foreground)" : "var(--foreground)"}
                              className="font-mono"
                            >
                              {st.n}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                <text x={W} y={H + fs * 1.3} fontSize={fs * 0.8} textAnchor="end" fill="var(--muted-foreground)" className="font-mono">
                  {W}×{H} mm
                </text>
              </>
            );
          }}
        </ZoomSvg>
      </div>

      <div className="flex flex-col min-h-0 border border-border rounded-md bg-card overflow-hidden text-xs">
        <div className="h-9 px-1.5 flex items-center gap-1 border-b border-border">
          <ToolButton
            title="Chop etish"
            disabled={!c.cutPlans?.length}
            onClick={() => c.cutPlans && printCutPlans(c.cutPlans, { docNo: c.docNo, jobName: c.orderName })}
          >
            <Printer className="size-3.5" />
            Chop etish
          </ToolButton>
          <ToolButton
            title="Buyurtma fayllariga saqlash"
            disabled={!c.cutPlans?.length || !c.docNo || c.busy !== null}
            onClick={() => void c.attachCutPlans()}
          >
            {c.busy === "attachCut" ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
            Ilova
          </ToolButton>
        </div>
        <div className="grid grid-cols-3 border-b border-border">
          <MiniStat label="Polosa" value={plan.strips} />
          <MiniStat label="Dona" value={plan.pieces} />
          <MiniStat label="Kesish" value={plan.strokes} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <StepTable title="1. Polosalar" steps={stage1} active={active} onHover={setActive} />
          <StepTable title="2. Donalar" steps={stage2} active={active} onHover={setActive} groups={plan.groups.length} />
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="h-7 px-2 inline-flex items-center gap-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col px-2 py-1 border-r border-border last:border-r-0">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums font-semibold">{value}</span>
    </div>
  );
}

function StepTable({
  title,
  steps,
  active,
  onHover,
  groups = 1,
}: {
  title: string;
  steps: CutStep[];
  active: number | null;
  onHover: (n: number | null) => void;
  groups?: number;
}) {
  if (!steps.length) return null;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="h-7 bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="pl-2 text-left font-medium">{title}</th>
          <th className="text-right font-medium">Tirgak</th>
          <th className="pr-2 text-right font-medium">Tushadi</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((st) => (
          <tr
            key={st.n}
            onMouseEnter={() => onHover(st.n)}
            onMouseLeave={() => onHover(null)}
            className={cn("h-[26px] border-t border-border", active === st.n && "bg-accent")}
          >
            <td className="pl-2 font-mono tabular-nums">
              <span className="inline-flex items-center gap-1">
                {st.n}
                {st.turn && <RotateCw className="size-3 text-muted-foreground" aria-label="90° burish" />}
                {st.turn && groups > 1 && <span className="text-[10px] text-muted-foreground">G{st.group + 1}</span>}
              </span>
            </td>
            <td className="text-right font-mono tabular-nums font-semibold">{st.gauge.toFixed(1)}</td>
            <td className={cn("pr-2 text-right", st.drop === "product" ? "text-foreground" : "text-muted-foreground")}>
              {st.drop === "product" ? "Mahsulot" : "Chiqindi"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
