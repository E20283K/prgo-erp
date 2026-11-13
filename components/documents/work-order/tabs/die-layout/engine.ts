/**
 * Flat-bed die layout for roll-cut thermal stickers.
 * Coordinates are in mm, origin at the top-left corner of the die plate.
 * X runs across the web (lanes), Y runs along the web (rows per stroke).
 */
export interface DieLayoutInput {
  webWidthMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  lanes: number;
  rows: number;
  marginMm: number;
  cornerRadiusMm: number;
}

export interface DieCell {
  x: number;
  y: number;
  lane: number;
  row: number;
}

export interface DieLayoutResult {
  cells: DieCell[];
  maxLanes: number;
  lanesExceeded: boolean;
  dieWidthMm: number;
  dieLengthMm: number;
  feedStepMm: number;
  usedWidthMm: number;
  edgeWasteMm: number;
  fitsWeb: boolean;
  labelsPerStroke: number;
}

export function calculateDieLayout(input: DieLayoutInput): DieLayoutResult {
  const w = Math.max(0, input.labelWidthMm || 0);
  const h = Math.max(0, input.labelHeightMm || 0);
  const gapX = Math.max(0, input.gapXMm || 0);
  const gapY = Math.max(0, input.gapYMm || 0);
  const lanes = Math.max(1, Math.floor(input.lanes || 1));
  const rows = Math.max(1, Math.floor(input.rows || 1));
  const margin = Math.max(0, input.marginMm || 0);
  const web = Math.max(0, input.webWidthMm || 0);

  const maxLanes = w > 0 ? Math.max(0, Math.floor((web + gapX) / (w + gapX))) : 0;
  const usedWidthMm = lanes * w + (lanes - 1) * gapX;
  const dieWidthMm = usedWidthMm + 2 * margin;
  const dieLengthMm = rows * h + (rows - 1) * gapY + 2 * margin;
  const feedStepMm = rows * (h + gapY);

  const cells: DieCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let l = 0; l < lanes; l++) {
      cells.push({
        x: margin + l * (w + gapX),
        y: margin + r * (h + gapY),
        lane: l + 1,
        row: r + 1,
      });
    }
  }

  return {
    cells,
    maxLanes,
    lanesExceeded: maxLanes > 0 && lanes > maxLanes,
    dieWidthMm,
    dieLengthMm,
    feedStepMm,
    usedWidthMm,
    edgeWasteMm: Math.max(0, web - usedWidthMm),
    fitsWeb: web <= 0 || usedWidthMm <= web,
    labelsPerStroke: lanes * rows,
  };
}

export interface DieSvgOptions {
  layout: DieLayoutResult;
  labelWidthMm: number;
  labelHeightMm: number;
  cornerRadiusMm: number;
  /** Optional contour from a customer file (SVG path "d" and its view box). */
  contour?: { pathD: string; viewBox: { x: number; y: number; width: number; height: number } } | null;
  title?: string;
  showDimensions?: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const n2 = (v: number) => Number(v.toFixed(2));

/** Builds a standalone SVG (mm units) used both for preview and for export to the die maker. */
export function buildDieSvg(opts: DieSvgOptions): string {
  const { layout, labelWidthMm: w, labelHeightMm: h, contour } = opts;
  const r = Math.max(0, Math.min(opts.cornerRadiusMm || 0, w / 2, h / 2));
  const pad = opts.showDimensions === false ? 2 : 14;
  const W = layout.dieWidthMm;
  const L = layout.dieLengthMm;
  const vbW = W + pad * 2;
  const vbH = L + pad * 2;

  const stroke = "#d6336c";
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(vbW)}mm" height="${n2(vbH)}mm" viewBox="${-pad} ${-pad} ${n2(vbW)} ${n2(vbH)}">`
  );
  if (opts.title) parts.push(`<title>${esc(opts.title)}</title>`);

  parts.push(
    `<rect x="0" y="0" width="${n2(W)}" height="${n2(L)}" fill="none" stroke="#868e96" stroke-width="0.25" stroke-dasharray="2 1.5"/>`
  );

  for (const c of layout.cells) {
    if (contour && contour.viewBox.width > 0 && contour.viewBox.height > 0) {
      const sx = w / contour.viewBox.width;
      const sy = h / contour.viewBox.height;
      parts.push(
        `<path d="${esc(contour.pathD)}" transform="translate(${n2(c.x)} ${n2(c.y)}) scale(${sx} ${sy}) translate(${-contour.viewBox.x} ${-contour.viewBox.y})" fill="none" stroke="${stroke}" stroke-width="0.3" vector-effect="non-scaling-stroke"/>`
      );
    } else {
      parts.push(
        `<rect x="${n2(c.x)}" y="${n2(c.y)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(r)}" ry="${n2(r)}" fill="none" stroke="${stroke}" stroke-width="0.3"/>`
      );
    }
  }

  if (opts.showDimensions !== false) {
    const dim = (x1: number, y1: number, x2: number, y2: number, label: string, tx: number, ty: number, rot = 0) =>
      `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="#495057" stroke-width="0.2"/>` +
      `<text x="${n2(tx)}" y="${n2(ty)}" font-family="monospace" font-size="3.2" fill="#495057" text-anchor="middle"${
        rot ? ` transform="rotate(${rot} ${n2(tx)} ${n2(ty)})"` : ""
      }>${esc(label)}</text>`;
    parts.push(dim(0, -6, W, -6, `${n2(W)} mm`, W / 2, -8));
    parts.push(dim(-6, 0, -6, L, `${n2(L)} mm`, -8, L / 2, -90));
    const first = layout.cells[0];
    if (first) {
      parts.push(
        `<text x="${n2(first.x + w / 2)}" y="${n2(first.y + h / 2 + 1)}" font-family="monospace" font-size="3" fill="#868e96" text-anchor="middle">${n2(w)}x${n2(h)}</text>`
      );
    }
  }

  parts.push("</svg>");
  return parts.join("");
}
