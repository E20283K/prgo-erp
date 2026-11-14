/**
 * Die-cut contour (noj) geometry — the single source used by Specifications, the order's
 * dieline selection and the imposition module. Produces a clean, production SVG in mm:
 * page = trim + DIE_PAGE_PAD on every side, cut contour centred on the trim box, no text.
 *
 * Proportions mirror DieLinePreview so the preview and the imposed die are the same shape.
 */
import type { OrderAttachment, OrderDieline, ProductCustomShape, ProductShapeType } from "../types";
import { parseSvgContour, polygonToPathD } from "./svgContour";

export const DIE_PAGE_PAD = 2; // mm around the trim box
export const DIE_STROKE = "#ff00ff";
export const DIE_STROKE_MM = 0.25;
const DEFAULT_ROUND_RADIUS = 3;

export type HolePosition =
  | "top-center"
  | "top-left"
  | "top-right"
  | "left-center"
  | "right-center"
  | "both-sides-fold"
  | "none";

export interface DielineSpec {
  width?: number;
  height?: number;
  shapeType?: ProductShapeType;
  cornerType?: string;
  customShape?: ProductCustomShape;
  customSvgPath?: string;
  foldType?: string;
  /** "Hangtag" implies a Ø4 top-centre hole when hole fields are unset (same rule as SpecificationsTab) */
  itemCategory?: string;
  holeSize?: number;
  holePosition?: HolePosition;
  holeOffset?: number;
}

export type DielineNeed = "none" | "supported" | "file_required";

export interface BuiltDieline {
  svg: string;
  trimW: number;
  trimH: number;
  /** Short human summary, e.g. "90×50 · R3 · Ø4" */
  summary: string;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** "Rounded (R5)" -> 5, "Round" -> 3, "Square" -> 0 */
export function cornerRadiusMm(cornerType?: string): number {
  const ct = (cornerType || "").toLowerCase();
  if (!ct.includes("round") && !ct.includes("radius")) return 0;
  const m = ct.match(/r\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : DEFAULT_ROUND_RADIUS;
}

export function dielineNeed(spec: DielineSpec): DielineNeed {
  const shape = spec.shapeType || "rectangle";
  if (shape === "folded" || shape === "carton_box") return "file_required";
  if (shape === "custom_die") {
    if (spec.customShape === "pillow") return "file_required";
    if (spec.customShape === "vector_svg") return spec.customSvgPath ? "supported" : "file_required";
    return "supported";
  }
  if (shape === "circle" || shape === "oval") return "supported";
  // rectangle
  const ct = (spec.cornerType || "").toLowerCase();
  if (cornerRadiusMm(spec.cornerType) > 0 || ct.includes("die")) return "supported";
  return "none";
}

function rectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M ${r2(x)} ${r2(y)} H ${r2(x + w)} V ${r2(y + h)} H ${r2(x)} Z`;
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${r2(x + rr)} ${r2(y)}`,
    `H ${r2(x + w - rr)}`,
    `A ${rr} ${rr} 0 0 1 ${r2(x + w)} ${r2(y + rr)}`,
    `V ${r2(y + h - rr)}`,
    `A ${rr} ${rr} 0 0 1 ${r2(x + w - rr)} ${r2(y + h)}`,
    `H ${r2(x + rr)}`,
    `A ${rr} ${rr} 0 0 1 ${r2(x)} ${r2(y + h - rr)}`,
    `V ${r2(y + rr)}`,
    `A ${rr} ${rr} 0 0 1 ${r2(x + rr)} ${r2(y)}`,
    "Z",
  ].join(" ");
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${r2(cx - rx)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(cx + rx)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(cx - rx)} ${r2(cy)} Z`;
}

function polyPath(pts: [number, number][]): string {
  return polygonToPathD(pts.map(([x, y]) => [r2(x), r2(y)]));
}

/** Path `d`, optionally with an exact transform (curved imported SVG paths keep their own coordinates). */
interface Contour {
  d: string;
  transform?: { tx: number; ty: number; s: number };
}

/** Cut contour in page coordinates (mm). Returns null when the shape cannot be generated. */
function contourPath(spec: DielineSpec, x: number, y: number, w: number, h: number): Contour | null {
  const d = contourD(spec, x, y, w, h);
  return typeof d === "string" ? { d } : d;
}

function contourD(spec: DielineSpec, x: number, y: number, w: number, h: number): string | Contour | null {
  const shape = spec.shapeType || "rectangle";
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (shape === "rectangle") return rectPath(x, y, w, h, cornerRadiusMm(spec.cornerType));
  if (shape === "circle") return ellipsePath(cx, cy, w / 2, w / 2);
  if (shape === "oval") return ellipsePath(cx, cy, w / 2, h / 2);
  if (shape !== "custom_die") return null;

  switch (spec.customShape || "arch") {
    case "arch": {
      const r = w / 2;
      return `M ${r2(x)} ${r2(y + r)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(x + w)} ${r2(y + r)} L ${r2(x + w)} ${r2(y + h)} L ${r2(x)} ${r2(y + h)} Z`;
    }
    case "hexagon":
      return polyPath([
        [cx, y],
        [x + w, y + h * 0.25],
        [x + w, y + h * 0.75],
        [cx, y + h],
        [x, y + h * 0.75],
        [x, y + h * 0.25],
      ]);
    case "star":
      return polyPath([
        [cx, y],
        [cx + w * 0.15, y + h * 0.3],
        [x + w, y + h * 0.35],
        [cx + w * 0.25, y + h * 0.6],
        [x + w * 0.8, y + h],
        [cx, y + h * 0.75],
        [x + w * 0.2, y + h],
        [cx - w * 0.25, y + h * 0.6],
        [x, y + h * 0.35],
        [cx - w * 0.15, y + h * 0.3],
      ]);
    case "vector_svg": {
      const parsed = spec.customSvgPath ? parseSvgContour(spec.customSvgPath) : null;
      if (!parsed) return null;
      const vb = parsed.computedBox || parsed.viewBox;
      const s = Math.min(vb.width > 0 ? w / vb.width : 1, vb.height > 0 ? h / vb.height : 1);
      const offX = x + (w - vb.width * s) / 2 - vb.x * s;
      const offY = y + (h - vb.height * s) / 2 - vb.y * s;
      if (parsed.polygonVertices && parsed.polygonVertices.length >= 3) {
        return polyPath(parsed.polygonVertices.map(([px, py]) => [offX + px * s, offY + py * s]));
      }
      // Curved path: keep it exact and position it with a transform
      return { d: parsed.pathD, transform: { tx: r2(offX), ty: r2(offY), s } };
    }
    default:
      return null;
  }
}

/** Effective hole: explicit fields win; hangtags default to Ø4, top-centre, 6 mm (as in SpecificationsTab). */
export function effectiveHole(spec: DielineSpec): { size: number; position: HolePosition; offset: number } {
  const isHangtag = spec.itemCategory === "Hangtag";
  return {
    size: spec.holeSize !== undefined ? Number(spec.holeSize) || 0 : isHangtag ? 4 : 0,
    position: spec.holePosition || (isHangtag ? "top-center" : "none"),
    offset: spec.holeOffset ?? 6,
  };
}

function holeCentres(spec: DielineSpec, x: number, y: number, w: number, h: number): [number, number][] {
  const { size: d, position: pos, offset: off } = effectiveHole(spec);
  if (d <= 0 || pos === "none" || spec.shapeType === "carton_box") return [];
  const r = d / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (pos) {
    case "both-sides-fold":
      return spec.foldType === "half_horizontal"
        ? [
            [cx, cy - off - r],
            [cx, cy + off + r],
          ]
        : [
            [cx - off - r, y + off + r],
            [cx + off + r, y + off + r],
          ];
    case "top-left":
      return [[x + off + r, y + off + r]];
    case "top-right":
      return [[x + w - off - r, y + off + r]];
    case "left-center":
      return [[x + off + r, cy]];
    case "right-center":
      return [[x + w - off - r, cy]];
    default:
      return [[cx, y + off + r]];
  }
}

/** Product size from the spec; null when it is missing (a die cannot be generated without it). */
export function dielineSize(spec: DielineSpec): { w: number; h: number } | null {
  const w = Number(spec.width) || 0;
  const h = spec.shapeType === "circle" ? w : Number(spec.height) || 0;
  return w > 0 && h > 0 ? { w, h } : null;
}

/** Builds the production die SVG for a supported spec; null when not generatable. */
export function buildDielineSvg(spec: DielineSpec): BuiltDieline | null {
  if (dielineNeed(spec) !== "supported") return null;
  const size = dielineSize(spec);
  if (!size) return null;
  const { w, h } = size;
  const pad = DIE_PAGE_PAD;
  const pageW = w + 2 * pad;
  const pageH = h + 2 * pad;

  const c = contourPath(spec, pad, pad, w, h);
  if (!c) return null;

  const base = `fill="none" stroke="${DIE_STROKE}" stroke-linejoin="round"`;
  const strokeAttrs = `${base} stroke-width="${DIE_STROKE_MM}"`;
  const contour = c.transform
    ? `<path d="${c.d}" transform="translate(${c.transform.tx} ${c.transform.ty}) scale(${c.transform.s})" ${base} stroke-width="${DIE_STROKE_MM / (c.transform.s || 1)}"/>`
    : `<path d="${c.d}" ${strokeAttrs}/>`;

  const holeD = effectiveHole(spec).size;
  const holes = holeCentres(spec, pad, pad, w, h)
    .map(([hx, hy]) => `<circle cx="${r2(hx)}" cy="${r2(hy)}" r="${r2(holeD / 2)}" ${strokeAttrs}/>`)
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(pageW)}mm" height="${r2(pageH)}mm" viewBox="0 0 ${r2(pageW)} ${r2(pageH)}">` +
    contour +
    holes +
    `</svg>`;

  const shape = spec.shapeType || "rectangle";
  const parts = [shape === "circle" ? `Ø${w}` : `${w}×${h}`];
  const radius = shape === "rectangle" ? cornerRadiusMm(spec.cornerType) : 0;
  if (radius) parts.push(`R${radius}`);
  if (shape === "custom_die") parts.push(spec.customShape === "vector_svg" ? "SVG" : spec.customShape || "");
  if (shape === "oval") parts.push("oval");
  if (holes) parts.push(`Ø${holeD} teshik`);

  return { svg, trimW: w, trimH: h, summary: parts.filter(Boolean).join(" · ") };
}

// ---------------------------------------------------------------------------
// Order-level resolution
// ---------------------------------------------------------------------------

export interface DielineFileCandidate {
  url: string;
  name: string;
  origin: "attachment" | "tooling";
}

interface ToolingLike {
  category?: string;
  name?: string;
  fileUrl?: string;
  fileName?: string;
}

const DIE_FILE_RE = /\.(pdf|svg)$/i;

function isDieFile(nameOrUrl?: string): boolean {
  if (!nameOrUrl) return false;
  let s = nameOrUrl;
  try {
    s = decodeURIComponent(nameOrUrl);
  } catch {
    /* raw */
  }
  return DIE_FILE_RE.test(s.split(/[?#]/)[0]) || /\.(pdf|svg)(&|$)/i.test(s);
}

/** PDF/SVG files on the order that can serve as a die: dieline attachments + die-cutting tooling. */
export function dielineFileCandidates(
  attachments: OrderAttachment[] = [],
  toolingItems: ToolingLike[] = []
): DielineFileCandidate[] {
  const out: DielineFileCandidate[] = [];
  const seen = new Set<string>();
  for (const a of attachments) {
    if (a.category !== "dieline" || !a.url) continue;
    if (!isDieFile(a.name) && !isDieFile(a.url)) continue;
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    out.push({ url: a.url, name: a.name, origin: "attachment" });
  }
  for (const t of toolingItems) {
    if (t.category !== "die_cutting" || !t.fileUrl || t.fileUrl.startsWith("data:")) continue;
    if (!isDieFile(t.fileName) && !isDieFile(t.fileUrl)) continue;
    if (seen.has(t.fileUrl)) continue;
    seen.add(t.fileUrl);
    out.push({ url: t.fileUrl, name: t.fileName || t.name || "pichoq.pdf", origin: "tooling" });
  }
  return out;
}

export type ResolvedDieline =
  | { source: "spec"; built: BuiltDieline }
  | { source: "file"; url: string; name: string }
  | { source: "none"; reason?: "not_needed" | "file_required" | "missing_file" | "missing_size" };

/**
 * The die actually in effect for the order. An explicit `dieline` choice wins; otherwise:
 * generatable spec shape -> spec, else first die file on the order, else none.
 */
export function resolveDieline(
  dieline: OrderDieline | undefined,
  spec: DielineSpec,
  candidates: DielineFileCandidate[]
): ResolvedDieline {
  const need = dielineNeed(spec);
  const built = () => buildDielineSvg(spec);
  const unbuildable = (): "not_needed" | "file_required" | "missing_size" =>
    need === "none" ? "not_needed" : need === "supported" && !dielineSize(spec) ? "missing_size" : "file_required";

  if (dieline?.source === "none") return { source: "none", reason: "not_needed" };
  if (dieline?.source === "file") {
    return dieline.fileUrl
      ? { source: "file", url: dieline.fileUrl, name: dieline.fileName || "pichoq.pdf" }
      : { source: "none", reason: "missing_file" };
  }
  if (dieline?.source === "spec") {
    const b = built();
    return b ? { source: "spec", built: b } : { source: "none", reason: unbuildable() };
  }

  // Implicit default
  if (need === "supported") {
    const b = built();
    if (b) return { source: "spec", built: b };
  }
  if (candidates[0]) return { source: "file", url: candidates[0].url, name: candidates[0].name };
  return { source: "none", reason: unbuildable() };
}
