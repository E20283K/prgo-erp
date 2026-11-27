import type { PlacedCell } from "@/lib/sheet-imposition/types";

/**
 * Guillotine cutting plan for a printed press sheet.
 *
 * Model (sheet coordinates, y down, gripper on the bottom edge as in the engine):
 * - Stage 1 cuts across the whole pile into strips. The untouched gripper edge (y = H) stays
 *   against the back gauge, the knife works from the far edge towards it, so every gauge is
 *   measured from the gripper edge: gauge = H - y.
 * - Stage 2: the strips are stacked, turned 90° and the untouched side-lay edge (x = 0) goes
 *   against the back gauge: gauge = x, cutting from the far edge again.
 * Untouched sheet edges stay as the reference until the very last cut, so no gauge depends on
 * an earlier cut's accuracy. If the strips run the other way (columns), the axes swap.
 */

export type CutAxis = "x" | "y";
/** What falls off in front of the knife on this cut */
export type CutDrop = "waste" | "product";

export interface CutStep {
  /** 1-based order of the cut */
  n: number;
  stage: 1 | 2;
  axis: CutAxis;
  /** Knife line on the sheet, mm (x for an "x" cut, y for a "y" cut) */
  pos: number;
  /** Back gauge setting, mm */
  gauge: number;
  drop: CutDrop;
  /** Stage 2 strip group (strips with the same column edges are stacked together) */
  group: number;
  /** Turn the pile 90° before this cut */
  turn: boolean;
}

export interface CutStripGroup {
  /** Strip span along the stage 1 axis, mm */
  spans: { from: number; to: number }[];
  /** Product pieces per strip */
  pieces: number;
}

export interface CutPlan {
  /** Axis of the stage 1 cuts ("y" = horizontal knife lines) */
  firstAxis: CutAxis;
  steps: CutStep[];
  groups: CutStripGroup[];
  strips: number;
  pieces: number;
  /** Total knife strokes per pile */
  strokes: number;
}

const EPS = 0.05;
const r1 = (v: number) => Math.round(v * 10) / 10;

interface Span {
  from: number;
  to: number;
}

const spanOf = (c: PlacedCell, axis: CutAxis): Span =>
  axis === "y" ? { from: c.y_mm, to: c.y_mm + c.h_mm } : { from: c.x_mm, to: c.x_mm + c.w_mm };

function uniqueSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (!out.length || v - out[out.length - 1] > EPS) out.push(v);
  }
  return out;
}

/** Edges along an axis; null if a line through one cell's edge would cut another cell. */
function cleanEdges(cells: PlacedCell[], axis: CutAxis): number[] | null {
  const edges = uniqueSorted(cells.flatMap((c) => [spanOf(c, axis).from, spanOf(c, axis).to]));
  for (const e of edges) {
    for (const c of cells) {
      const s = spanOf(c, axis);
      if (e > s.from + EPS && e < s.to - EPS) return null;
    }
  }
  return edges;
}

/**
 * Cuts along one axis, from the far edge towards the reference edge.
 * The reference edge is at `size` when `refAtEnd`, else at 0; the gauge is measured from it.
 */
function sweep(
  edges: number[],
  cells: PlacedCell[],
  axis: CutAxis,
  size: number,
  refAtEnd: boolean
): { pos: number; gauge: number; drop: CutDrop }[] {
  // Knife lines strictly inside the material; a block edge on the sheet edge needs no cut
  const inside = edges.filter((e) => e > EPS && e < size - EPS);
  const ordered = refAtEnd ? inside : [...inside].reverse();
  const out: { pos: number; gauge: number; drop: CutDrop }[] = [];
  let prev = refAtEnd ? 0 : size;
  for (const pos of ordered) {
    const lo = Math.min(prev, pos);
    const hi = Math.max(prev, pos);
    const isProduct = cells.some((c) => {
      const s = spanOf(c, axis);
      return s.from <= lo + EPS && s.to >= hi - EPS;
    });
    out.push({ pos: r1(pos), gauge: r1(refAtEnd ? size - pos : pos), drop: isProduct ? "product" : "waste" });
    prev = pos;
  }
  return out;
}

function planFor(cells: PlacedCell[], W: number, H: number, firstAxis: CutAxis): CutPlan | null {
  const second: CutAxis = firstAxis === "y" ? "x" : "y";
  const edges1 = cleanEdges(cells, firstAxis);
  if (!edges1) return null;

  // Gripper (y = H) is the stage 1/2 reference on the y axis, side lay (x = 0) on the x axis
  const size = (a: CutAxis) => (a === "y" ? H : W);
  const refAtEnd = (a: CutAxis) => a === "y";

  // Strips between consecutive edges that hold product
  const strips: { span: Span; cells: PlacedCell[] }[] = [];
  for (let i = 0; i < edges1.length - 1; i++) {
    const span = { from: edges1[i], to: edges1[i + 1] };
    const inStrip = cells.filter((c) => {
      const s = spanOf(c, firstAxis);
      return s.from <= span.from + EPS && s.to >= span.to - EPS;
    });
    if (inStrip.length) strips.push({ span, cells: inStrip });
  }

  // Strips whose cross edges match are stacked and cut together
  const groupMap = new Map<string, { edges: number[]; strips: typeof strips }>();
  for (const st of strips) {
    const e = cleanEdges(st.cells, second);
    if (!e) return null;
    const key = e.map(r1).join("|");
    const g = groupMap.get(key);
    if (g) g.strips.push(st);
    else groupMap.set(key, { edges: e, strips: [st] });
  }

  const steps: CutStep[] = [];
  let n = 0;
  for (const c of sweep(edges1, cells, firstAxis, size(firstAxis), refAtEnd(firstAxis))) {
    steps.push({ n: ++n, stage: 1, axis: firstAxis, ...c, group: 0, turn: false });
  }

  const groups: CutStripGroup[] = [];
  [...groupMap.values()].forEach((g, gi) => {
    const groupCells = g.strips.flatMap((s) => s.cells);
    sweep(g.edges, groupCells, second, size(second), refAtEnd(second)).forEach((c, i) => {
      steps.push({ n: ++n, stage: 2, axis: second, ...c, group: gi, turn: i === 0 });
    });
    groups.push({
      spans: g.strips.map((s) => ({ from: r1(s.span.from), to: r1(s.span.to) })),
      pieces: g.strips[0].cells.length,
    });
  });

  return {
    firstAxis,
    steps,
    groups,
    strips: strips.length,
    pieces: cells.length,
    strokes: steps.length,
  };
}

/**
 * Builds the plan from the engine's placed cells (trim boxes). Tries horizontal strips first
 * (the gripper edge is the most accurate reference), then vertical ones, and keeps the variant
 * with fewer strokes. Returns null when the layout cannot be cut in two guillotine stages.
 */
export function buildCutPlan(cells: PlacedCell[], sheetW: number, sheetH: number): CutPlan | null {
  if (!cells.length || sheetW <= 0 || sheetH <= 0) return null;
  const byRows = planFor(cells, sheetW, sheetH, "y");
  const byCols = planFor(cells, sheetW, sheetH, "x");
  if (byRows && byCols) return byCols.strokes < byRows.strokes ? byCols : byRows;
  return byRows ?? byCols;
}

/** Trim box of a placed piece, kept on the order so the plan renders without the engine. */
export interface CutPlanCell {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Variant index (colour) */
  v: number;
}

/** A form's cutting plan as saved on the work order (impositionState.cutPlans). */
export interface CutPlanSnapshot extends CutPlan {
  formIndex: number;
  sheetW: number;
  sheetH: number;
  cells: CutPlanCell[];
}

/** One snapshot per form that can be cut; forms whose layout cannot be guillotined are skipped. */
export function snapshotCutPlans(
  forms: { form_index: number; front_cells: PlacedCell[] }[],
  sheetW: number,
  sheetH: number
): CutPlanSnapshot[] {
  const out: CutPlanSnapshot[] = [];
  for (const f of forms) {
    const plan = buildCutPlan(f.front_cells, sheetW, sheetH);
    if (!plan) continue;
    out.push({
      ...plan,
      formIndex: f.form_index,
      sheetW,
      sheetH,
      cells: f.front_cells.map((c) => ({ x: r1(c.x_mm), y: r1(c.y_mm), w: r1(c.w_mm), h: r1(c.h_mm), v: c.variant_index })),
    });
  }
  return out;
}

/** A dimension to draw on the plan, in sheet mm. */
export interface CutDim {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  kind: "piece" | "waste" | "gap";
}

/**
 * What the operator checks after a cut: one piece's trim size (with the gutter to its
 * neighbours chained on) and the waste on each sheet edge. Everything is placed along the
 * first piece's column and row, off its edges, so no dimension lies on a knife line or under
 * the cut numbers at the top of a strip.
 */
export function cutPlanDims(cells: CutPlanCell[], W: number, H: number): CutDim[] {
  if (!cells.length) return [];
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x + c.w));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxY = Math.max(...cells.map((c) => c.y + c.h));
  const dims: CutDim[] = [];
  const add = (x1: number, y1: number, x2: number, y2: number, kind: CutDim["kind"]) => {
    const value = r1(Math.abs(x2 - x1) + Math.abs(y2 - y1));
    if (value > EPS) dims.push({ x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), value, kind });
  };

  // Top-left piece
  const s = [...cells].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  const dy = s.y + s.h * 0.35;
  const dx = s.x + s.w * 0.3;
  add(s.x, dy, s.x + s.w, dy, "piece");
  add(dx, s.y, dx, s.y + s.h, "piece");
  const right = cells
    .filter((c) => Math.abs(c.y - s.y) < EPS && c.x > s.x + s.w - EPS)
    .sort((a, b) => a.x - b.x)[0];
  if (right) add(s.x + s.w, dy, right.x, dy, "gap");
  const below = cells
    .filter((c) => Math.abs(c.x - s.x) < EPS && c.y > s.y + s.h - EPS)
    .sort((a, b) => a.y - b.y)[0];
  if (below) add(dx, s.y + s.h, dx, below.y, "gap");

  // Edge waste
  const xc = s.x + s.w * 0.75;
  const yc = s.y + s.h * 0.75;
  add(xc, 0, xc, minY, "waste");
  add(xc, maxY, xc, H, "waste");
  add(0, yc, minX, yc, "waste");
  add(maxX, yc, W, yc, "waste");
  return dims;
}

/**
 * Edge labels for the drawing. Each stage pushes one untouched edge against the back gauge
 * and cuts from the opposite edge: the y stage uses the gripper (bottom), the x stage the
 * side lay (left).
 */
export function cutPlanEdges(firstAxis: CutAxis) {
  const yStage = firstAxis === "y" ? 1 : 2;
  const xStage = firstAxis === "y" ? 2 : 1;
  return {
    top: `PICHOQ ${yStage}`,
    bottom: `KLAPAN · TIRGAK ${yStage}`,
    right: `PICHOQ ${xStage}`,
    left: `YON TIRGAK · TIRGAK ${xStage}`,
  };
}

// ------------------------------------------------------------------------------ parent sheet

/** Smaller side below this the strip is waste; at or above it goes back to stock as an offcut. */
export const OFFCUT_MIN_MM = 50;

export interface ParentCutOffcut {
  w: number;
  h: number;
  /** Pieces per parent sheet */
  perSheet: number;
  kind: "offcut" | "waste";
}

/** How the parent sheet is cut into press sheets before printing (impositionState.parentCut). */
export interface ParentCutSnapshot {
  parentW: number;
  parentH: number;
  pressW: number;
  pressH: number;
  /** Press sheets laid across the parent sheet's other way */
  rotated: boolean;
  cols: number;
  rows: number;
  /** Press sheets that fit one parent sheet */
  fit: number;
  /** Press sheets per parent sheet the run is planned with (the layout's divisor) */
  divisor: number;
  usedPct: number;
  /** Knife order with the press sheets as pieces; null when nothing fits */
  plan: CutPlanSnapshot | null;
  offcuts: ParentCutOffcut[];
  pressSheets: number;
  runSheets: number;
  wasteSheets: number;
  parentSheets: number;
  paperName?: string;
}

/** Press sheets per parent sheet by geometry: the better of the two orientations. */
export function parentSheetFit(parentW: number, parentH: number, pressW: number, pressH: number) {
  if (!(parentW > 0 && parentH > 0 && pressW > 0 && pressH > 0)) return { cols: 0, rows: 0, rotated: false, fit: 0 };
  const straight = { cols: Math.floor(parentW / pressW + 1e-6), rows: Math.floor(parentH / pressH + 1e-6), rotated: false };
  const turned = { cols: Math.floor(parentW / pressH + 1e-6), rows: Math.floor(parentH / pressW + 1e-6), rotated: true };
  const best = turned.cols * turned.rows > straight.cols * straight.rows ? turned : straight;
  return { ...best, fit: best.cols * best.rows };
}

/**
 * Lays the press sheets against the two reference edges (bottom and left) so the leftover
 * strips fall off first, then plans the knife order the same way as the printed sheet.
 */
export function buildParentCut(input: {
  parentW: number;
  parentH: number;
  pressW: number;
  pressH: number;
  divisor: number;
  pressSheets: number;
  runSheets: number;
  parentSheets: number;
  paperName?: string;
}): ParentCutSnapshot {
  const { parentW: W, parentH: H, pressW, pressH } = input;
  const g = parentSheetFit(W, H, pressW, pressH);
  const cw = g.rotated ? pressH : pressW;
  const ch = g.rotated ? pressW : pressH;

  const cells: PlacedCell[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      cells.push({
        col: c,
        row: r,
        x_mm: c * cw,
        y_mm: H - (r + 1) * ch,
        w_mm: cw,
        h_mm: ch,
        rotation: g.rotated ? 90 : 0,
        variant_index: 0,
        variant_name: "",
      });
    }
  }
  const plan = buildCutPlan(cells, W, H);

  const rightW = r1(W - g.cols * cw);
  const topH = r1(H - g.rows * ch);
  const raw =
    !plan || plan.firstAxis === "y"
      ? [
          { w: W, h: topH, perSheet: 1 },
          { w: rightW, h: ch, perSheet: g.rows },
        ]
      : [
          { w: rightW, h: H, perSheet: 1 },
          { w: cw, h: topH, perSheet: g.cols },
        ];
  const offcuts: ParentCutOffcut[] = g.fit
    ? raw
        .filter((o) => o.w > 0.5 && o.h > 0.5 && o.perSheet > 0)
        .map((o) => ({ ...o, w: r1(o.w), h: r1(o.h), kind: Math.min(o.w, o.h) >= OFFCUT_MIN_MM ? "offcut" : "waste" }))
    : [];

  return {
    parentW: W,
    parentH: H,
    pressW,
    pressH,
    rotated: g.rotated,
    cols: g.cols,
    rows: g.rows,
    fit: g.fit,
    divisor: input.divisor,
    usedPct: W * H > 0 ? Math.round(((g.fit * pressW * pressH) / (W * H)) * 1000) / 10 : 0,
    plan: plan
      ? {
          ...plan,
          formIndex: 0,
          sheetW: W,
          sheetH: H,
          cells: cells.map((c) => ({ x: r1(c.x_mm), y: r1(c.y_mm), w: r1(c.w_mm), h: r1(c.h_mm), v: 0 })),
        }
      : null,
    offcuts,
    pressSheets: input.pressSheets,
    runSheets: input.runSheets,
    wasteSheets: Math.max(0, input.pressSheets - input.runSheets),
    parentSheets: input.parentSheets,
    paperName: input.paperName,
  };
}
