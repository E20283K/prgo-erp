import { cutPlanDims, cutPlanEdges, type CutPlanSnapshot, type CutStep } from "./cutPlan";

/**
 * Printable cutting plan card: A4 landscape, mm units, plain black/grey so it survives a
 * mono printer. Pure string output, so the layout tab, the order attachment and the operator
 * terminal all show the same card.
 */

export interface CutPlanCardMeta {
  docNo?: string;
  jobName?: string;
  /** Forms in the job, to print "F1/3" */
  totalForms?: number;
}

const PAGE_W = 297;
const PAGE_H = 210;
const M = 10;
const TABLE_W = 78;
const HEAD_H = 14;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (v: number) => (Math.round(v * 100) / 100).toString();
const mm = (v: number) => v.toFixed(1);

function stepSegments(plan: CutPlanSnapshot, st: CutStep) {
  const spans =
    st.stage === 1 ? [{ from: 0, to: st.axis === "y" ? plan.sheetW : plan.sheetH }] : plan.groups[st.group].spans;
  return spans.map((sp) =>
    st.axis === "y" ? { x1: sp.from, y1: st.pos, x2: sp.to, y2: st.pos } : { x1: st.pos, y1: sp.from, x2: st.pos, y2: sp.to }
  );
}

export function renderCutPlanSvg(plan: CutPlanSnapshot, meta: CutPlanCardMeta = {}): string {
  const W = plan.sheetW;
  const H = plan.sheetH;
  const out: string[] = [];
  const push = (s: string) => out.push(s);

  push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${PAGE_H}mm" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Arial, Helvetica, sans-serif">`
  );
  push(`<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>`);

  // Header
  const title = ["Kesish rejasi", meta.docNo, meta.jobName].filter(Boolean).join(" · ");
  const form = meta.totalForms && meta.totalForms > 1 ? `F${plan.formIndex}/${meta.totalForms} · ` : "";
  push(`<text x="${M}" y="${M + 5}" font-size="5" font-weight="700" fill="#000">${esc(title)}</text>`);
  push(
    `<text x="${PAGE_W - M}" y="${M + 5}" font-size="3.6" text-anchor="end" fill="#333">${esc(
      `${form}List ${n1(W)}×${n1(H)} mm · Polosa ${plan.strips} · Dona ${plan.pieces} · Kesish ${plan.strokes}`
    )}</text>`
  );
  push(`<line x1="${M}" y1="${M + HEAD_H - 4}" x2="${PAGE_W - M}" y2="${M + HEAD_H - 4}" stroke="#000" stroke-width="0.3"/>`);

  // Sheet drawing, scaled into the left area with room for labels
  const areaX = M + 8;
  const areaY = M + HEAD_H + 4;
  const areaW = PAGE_W - 2 * M - TABLE_W - 26;
  const areaH = PAGE_H - areaY - M - 8;
  const k = Math.min(areaW / W, areaH / H);
  const ox = areaX + (areaW - W * k) / 2;
  const oy = areaY + (areaH - H * k) / 2;
  const X = (v: number) => (ox + v * k).toFixed(2);
  const Y = (v: number) => (oy + v * k).toFixed(2);

  push(`<rect x="${X(0)}" y="${Y(0)}" width="${(W * k).toFixed(2)}" height="${(H * k).toFixed(2)}" fill="#fff" stroke="#999" stroke-width="0.25"/>`);
  for (const c of plan.cells) {
    push(
      `<rect x="${X(c.x)}" y="${Y(c.y)}" width="${(c.w * k).toFixed(2)}" height="${(c.h * k).toFixed(2)}" fill="#eee" stroke="#bbb" stroke-width="0.15"/>`
    );
  }
  // Reference edges
  push(`<line x1="${X(0)}" y1="${Y(H)}" x2="${X(W)}" y2="${Y(H)}" stroke="#000" stroke-width="1.2"/>`);
  push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(H)}" stroke="#000" stroke-width="1.2"/>`);
  // Which edge goes to the back gauge and which faces the knife, per stage
  const edges = cutPlanEdges(plan.firstAxis);
  const midX = (ox + (W * k) / 2).toFixed(2);
  const midY = (oy + (H * k) / 2).toFixed(2);
  const lx = (ox - 3.5).toFixed(2);
  const rx = (ox + W * k + 12).toFixed(2);
  push(`<text x="${midX}" y="${(oy + H * k + 4.5).toFixed(2)}" font-size="3" text-anchor="middle" fill="#000">${esc(edges.bottom)}</text>`);
  push(`<text x="${midX}" y="${(oy - 2.5).toFixed(2)}" font-size="3" font-weight="700" text-anchor="middle" fill="#000">${esc(edges.top)}</text>`);
  push(`<text x="${lx}" y="${midY}" font-size="3" text-anchor="middle" fill="#000" transform="rotate(-90 ${lx} ${midY})">${esc(edges.left)}</text>`);
  push(`<text x="${rx}" y="${midY}" font-size="3" font-weight="700" text-anchor="middle" fill="#000" transform="rotate(90 ${rx} ${midY})">${esc(edges.right)}</text>`);

  // Piece size, gutter and edge waste
  for (const d of cutPlanDims(plan.cells, W, H)) {
    const vertical = d.x1 === d.x2;
    const t = 0.8;
    const color = d.kind === "piece" ? "#000" : "#555";
    const x1 = ox + d.x1 * k;
    const y1 = oy + d.y1 * k;
    const x2 = ox + d.x2 * k;
    const y2 = oy + d.y2 * k;
    const ticks = vertical
      ? `M${x1 - t} ${y1}H${x1 + t}M${x2 - t} ${y2}H${x2 + t}`
      : `M${x1} ${y1 - t}V${y1 + t}M${x2} ${y2 - t}V${y2 + t}`;
    push(
      `<path d="M${x1} ${y1}L${x2} ${y2}${ticks}" fill="none" stroke="${color}" stroke-width="0.2"/>`
    );
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const left = d.x1 < W / 2;
    const tx2 = vertical ? mx + (left ? 1 : -1) : mx;
    const ty2 = vertical ? my + 0.9 : my - 0.8;
    const anchor = vertical ? (left ? "start" : "end") : "middle";
    push(
      `<text x="${tx2.toFixed(2)}" y="${ty2.toFixed(2)}" font-size="2.5" text-anchor="${anchor}" fill="${color}" stroke="#fff" stroke-width="0.6" paint-order="stroke">${n1(d.value)}</text>`
    );
  }

  // Knife lines and numbers
  const r = 2;
  for (const st of plan.steps) {
    const color = st.drop === "product" ? "#000" : "#888";
    const dash = st.stage === 2 ? ` stroke-dasharray="1.6 0.8"` : "";
    const segs = stepSegments(plan, st);
    for (const sg of segs) {
      push(`<line x1="${X(sg.x1)}" y1="${Y(sg.y1)}" x2="${X(sg.x2)}" y2="${Y(sg.y2)}" stroke="${color}" stroke-width="0.4"${dash}/>`);
    }
    // Stage 2 cuts the stacked strips in one stroke: number it once, on the group's first strip
    for (const sg of segs.slice(0, 1)) {
      // Waste cuts sit a gutter away from a product cut: move their label one step along the line
      const shift = st.drop === "waste" ? 2 * r + 0.6 : 0;
      const cx =
        st.axis === "y" ? (st.stage === 1 ? ox + sg.x2 * k + r + 1 + shift : ox + sg.x1 * k + r + 0.6 + shift) : ox + sg.x1 * k;
      const cy =
        st.axis === "y" ? oy + sg.y1 * k : st.stage === 1 ? oy + sg.y1 * k - r - 1 - shift : oy + sg.y1 * k + r + 0.6 + shift;
      push(
        `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="#fff" stroke="#000" stroke-width="0.3"/>` +
          `<text x="${cx.toFixed(2)}" y="${(cy + 1).toFixed(2)}" font-size="2.6" text-anchor="middle" fill="#000">${st.n}</text>`
      );
    }
  }

  // Steps table
  const tx = PAGE_W - M - TABLE_W;
  let ty = areaY;
  const rows = plan.steps.length + 2;
  const rowH = Math.min(6, (PAGE_H - M - ty) / rows);
  const fs = Math.min(3.4, rowH * 0.6);
  const col = { n: tx + 2, gauge: tx + 40, drop: tx + TABLE_W - 2 };

  const header = (label: string) => {
    push(`<rect x="${tx}" y="${ty.toFixed(2)}" width="${TABLE_W}" height="${rowH.toFixed(2)}" fill="#e5e5e5"/>`);
    const by = (ty + rowH * 0.68).toFixed(2);
    push(`<text x="${col.n}" y="${by}" font-size="${(fs * 0.85).toFixed(2)}" font-weight="700" fill="#000">${label}</text>`);
    push(`<text x="${col.gauge}" y="${by}" font-size="${(fs * 0.85).toFixed(2)}" font-weight="700" text-anchor="end" fill="#000">Tirgak, mm</text>`);
    push(`<text x="${col.drop}" y="${by}" font-size="${(fs * 0.85).toFixed(2)}" font-weight="700" text-anchor="end" fill="#000">Tushadi</text>`);
    ty += rowH;
  };
  const row = (st: CutStep, multiGroup: boolean) => {
    const by = (ty + rowH * 0.68).toFixed(2);
    const turn = st.turn ? ` ↻ 90°${multiGroup ? ` G${st.group + 1}` : ""}` : "";
    push(`<text x="${col.n}" y="${by}" font-size="${fs.toFixed(2)}" fill="#000">${st.n}${esc(turn)}</text>`);
    push(`<text x="${col.gauge}" y="${by}" font-size="${fs.toFixed(2)}" font-weight="700" text-anchor="end" fill="#000">${mm(st.gauge)}</text>`);
    push(
      `<text x="${col.drop}" y="${by}" font-size="${fs.toFixed(2)}" text-anchor="end" fill="${st.drop === "product" ? "#000" : "#777"}">${
        st.drop === "product" ? "Mahsulot" : "Chiqindi"
      }</text>`
    );
    ty += rowH;
    push(`<line x1="${tx}" y1="${ty.toFixed(2)}" x2="${tx + TABLE_W}" y2="${ty.toFixed(2)}" stroke="#ccc" stroke-width="0.15"/>`);
  };

  const multi = plan.groups.length > 1;
  header("1. Polosalar");
  plan.steps.filter((s) => s.stage === 1).forEach((s) => row(s, multi));
  header("2. Donalar");
  plan.steps.filter((s) => s.stage === 2).forEach((s) => row(s, multi));

  push(`</svg>`);
  return out.join("\n");
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Opens the browser print dialog with one A4 landscape page per plan. */
export function printCutPlans(plans: CutPlanSnapshot[], meta: CutPlanCardMeta = {}): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const pages = plans.map((p) => `<div class="page">${renderCutPlanSvg(p, { ...meta, totalForms: plans.length })}</div>`).join("");
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(`Kesish rejasi ${meta.docNo ?? ""}`)}</title>` +
      `<style>@page{size:A4 landscape;margin:0}html,body{margin:0}.page{width:297mm;height:210mm;page-break-after:always}.page svg{display:block}</style>` +
      `</head><body>${pages}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`
  );
  win.document.close();
  return true;
}
