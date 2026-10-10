import { FlexoLayoutResult, FlexoRenderOptions } from "./types";

interface RenderOrderMeta {
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
}

const f = (n: number) => Number(n.toFixed(2));

/** Point on circle, angle φ in degrees measured clockwise from 12 o'clock. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: f(cx + r * Math.sin(a)), y: f(cy - r * Math.cos(a)) };
}

/** Annular sector path between radii r1 < r2 from angle a1 to a2 (clockwise, degrees). */
function annularSector(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
  const large = a2 - a1 > 180 ? 1 : 0;
  const p1 = polar(cx, cy, r2, a1);
  const p2 = polar(cx, cy, r2, a2);
  const p3 = polar(cx, cy, r1, a2);
  const p4 = polar(cx, cy, r1, a1);
  return `M ${p1.x} ${p1.y} A ${r2} ${r2} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r1} ${r1} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}

/** Intersect an angular interval [a, a+span] (deg) with the front-visible half [0,180] (mod 360). */
function visibleFrontParts(a: number, span: number): Array<[number, number]> {
  const start = ((a % 360) + 360) % 360;
  const end = start + span;
  const parts: Array<[number, number]> = [];
  for (const off of [0, 360]) {
    const lo = Math.max(start, off);
    const hi = Math.min(end, off + 180);
    if (hi > lo) parts.push([lo - off, hi - off]);
  }
  return parts;
}

/**
 * 2D engineering drawing of the flexo plate cylinder.
 * Left: END VIEW (operator side) — barrel, mounted plate ring, true gear tooth count,
 *       label rows as arcs around the circumference, plate seam, web nip point.
 * Right: FRONT ELEVATION — orthographic side view, labels on the visible (front) half.
 * Fully deterministic from FlexoLayoutResult; rotation shared with the 3D view.
 */
export function renderFlexoCylinder2DSVG(
  result: FlexoLayoutResult,
  options: FlexoRenderOptions,
  meta: RenderOrderMeta = {}
): string {
  const rot = options.cylinderRotation || 0;
  const N = Math.max(10, result.gearTeeth || 100);
  const L = Math.max(30, result.printingLength);
  const webWidth = Math.max(10, result.webWidth);

  // Physical radii (mm)
  const RpMM = L / (2 * Math.PI); // printing surface (plate face)
  const RbMM = Math.min(RpMM - 0.5, Math.max(10, (result.cylinderDiameter || RpMM * 2 - 4) / 2));
  const pcd = result.pitchCircleDiameter > 0 ? result.pitchCircleDiameter : RpMM * 2;
  const mod = pcd / N;
  const RoMM = pcd / 2 + mod; // gear tip
  const RrMM = pcd / 2 - 1.25 * mod; // gear root

  // Front view widths (mm)
  const shaftMM = 18;
  const gearWMM = 12;
  const faceMM = Math.max(webWidth + 24, 60);
  const frontMM = shaftMM * 2 + gearWMM + faceMM;
  const endMM = Math.max(RoMM, RpMM) * 2 + 24;

  // Scale (px per mm)
  const W = 780;
  const s = Math.min(250 / endMM, 560 / (endMM + frontMM));

  const Rp = RpMM * s;
  const plateBand = Math.max(3.5, (RpMM - RbMM) * s); // exaggerate thin plates for readability
  const Rb = Rp - plateBand;
  const Ro = RoMM * s;
  const Rr = RrMM * s;
  const labelBand = 7;
  const outer = Math.max(Ro, Rp + labelBand + 14);

  const topY = 62;
  const cy = topY + outer + 18;
  const ex = 40 + outer;
  const fx = ex + outer + 60;
  const dimY = cy + outer + 22;
  const H = dimY + 58;

  // Colors (respect color separation)
  const sep = options.activeColorSeparation || "all";
  const sepMap: Record<string, { plate: string; stroke: string }> = {
    Cyan: { plate: "#a5f3fc", stroke: "#0891b2" },
    Magenta: { plate: "#fbcfe8", stroke: "#db2777" },
    Yellow: { plate: "#fef08a", stroke: "#ca8a04" },
    Black: { plate: "#d4d4d8", stroke: "#18181b" },
  };
  const plateFill = sepMap[sep]?.plate || "#bfdbfe";
  const labelStroke = sepMap[sep]?.stroke || "#2563eb";

  // Label rows around circumference (unique y positions)
  const rowMap = new Map<number, { y: number; h: number }>();
  for (const p of result.positions) {
    const key = Math.round(p.y * 100);
    if (!rowMap.has(key)) rowMap.set(key, { y: p.y, h: p.height });
  }
  const rows = [...rowMap.values()].sort((a, b) => a.y - b.y);
  const hasLayout = result.acrossCount > 0 && result.aroundCount > 0 && rows.length > 0;

  const t: string[] = [];
  t.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${f(H)}" width="100%" height="100%" style="background:#f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <defs>
    <marker id="c2d-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
    </marker>
    <marker id="c2d-arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284c7" />
    </marker>
    <pattern id="c2d-hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#94a3b8" stroke-width="0.7" />
    </pattern>
  </defs>
  <rect width="${W}" height="${f(H)}" fill="#f8fafc" />
`);

  // Technical Title Block Table (DIN / ISO Engineering Specification Stamp)
  const title = meta.docNo || "FLEXO-SPEC";
  const customerName = meta.customer || "General Client";
  const prodName = meta.productName || "Flexo Printed Label";

  t.push(`
  <!-- Engineering Specification Title Block (Table format) -->
  <g transform="translate(15, 10)">
    <!-- Outer Table Frame -->
    <rect width="${W - 30}" height="42" fill="#ffffff" stroke="#334155" stroke-width="1.2" />
    
    <!-- Table Grid Lines -->
    <line x1="0" y1="21" x2="${W - 30}" y2="21" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="220" y1="0" x2="220" y2="42" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="390" y1="0" x2="390" y2="42" stroke="#cbd5e1" stroke-width="0.8" />
    <line x1="560" y1="0" x2="560" y2="42" stroke="#cbd5e1" stroke-width="0.8" />

    <!-- Column 1: Document & Customer -->
    <text x="8" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">DOCUMENT NO. & CLIENT</text>
    <text x="8" y="18" fill="#0f172a" stroke="none" font-size="8.5" font-weight="700">${title} · ${customerName}</text>
    <text x="8" y="31" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">PRODUCT / JOB NAME</text>
    <text x="8" y="39" fill="#0f172a" stroke="none" font-size="8" font-weight="500">${prodName}</text>

    <!-- Column 2: Tooling & Cylinder System -->
    <text x="228" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">GEAR TEETH & MODULE</text>
    <text x="228" y="18" fill="#0f172a" stroke="none" font-size="8.5" font-weight="700">${N} Teeth (${N}T) · CP 1/8" (3.175mm)</text>
    <text x="228" y="31" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">PITCH CIRCLE (PCD)</text>
    <text x="228" y="39" fill="#0f172a" stroke="none" font-size="8" font-weight="600">PCD ${f(pcd)} mm · Ø ${result.cylinderDiameter} mm</text>

    <!-- Column 3: Circumference & Repeat Length -->
    <text x="398" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">REPEAT LENGTH (CIRCUMFERENCE)</text>
    <text x="398" y="18" fill="#0f172a" stroke="none" font-size="8.5" font-weight="700">${result.printingLength} mm (${(result.printingLength / 25.4).toFixed(3)}")</text>
    <text x="398" y="31" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">PLATE THICKNESS / CUSHION</text>
    <text x="398" y="39" fill="#0f172a" stroke="none" font-size="8" font-weight="600">t = ${result.plateThickness} mm</text>

    <!-- Column 4: Imposition & Feed Angle -->
    <text x="568" y="10" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">IMPOSITION COUNT</text>
    <text x="568" y="18" fill="#0f172a" stroke="none" font-size="8.5" font-weight="700">${result.aroundCount} Around × ${result.acrossCount} Across (${result.totalPerRepeat} pcs/rev)</text>
    <text x="568" y="31" fill="#64748b" stroke="none" font-size="6.5" font-weight="700" letter-spacing="0.5">ROTATION ANGLE / FEED</text>
    <text x="568" y="39" fill="#0284c7" stroke="none" font-size="8" font-weight="700">Angle: ${Math.round(rot)}° · Web: ${result.webWidth} mm</text>
  </g>
`);

  // ───────────────────────── END VIEW ─────────────────────────
  // Centerlines
  t.push(`
  <g stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="10 2 2 2" fill="none">
    <line x1="${f(ex - outer - 12)}" y1="${f(cy)}" x2="${f(ex + outer + 12)}" y2="${f(cy)}" />
    <line x1="${f(ex)}" y1="${f(cy - outer - 12)}" x2="${f(ex)}" y2="${f(cy + outer + 12)}" />
  </g>
`);

  // Gear (hidden behind barrel on operator side → clean technical steel/bronze contour)
  const p = 360 / N;
  const gearPts: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = rot + i * p;
    const pts = [
      polar(ex, cy, Rr, a),
      polar(ex, cy, Ro, a + 0.2 * p),
      polar(ex, cy, Ro, a + 0.45 * p),
      polar(ex, cy, Rr, a + 0.65 * p),
    ];
    gearPts.push(pts.map((q) => `${q.x},${q.y}`).join(" "));
  }
  t.push(`  <polygon points="${gearPts.join(" ")}" fill="#f1f5f9" stroke="#475569" stroke-width="0.6" />`);
  t.push(`  <circle cx="${f(ex)}" cy="${f(cy)}" r="${f(pcd / 2 * s)}" fill="none" stroke="#64748b" stroke-width="0.5" stroke-dasharray="4 2" />`);

  // Barrel (sectioned) + plate ring
  t.push(`
  <circle cx="${f(ex)}" cy="${f(cy)}" r="${f(Rb)}" fill="#f8fafc" stroke="#334155" stroke-width="1.2" />
  <circle cx="${f(ex)}" cy="${f(cy)}" r="${f(Rb)}" fill="url(#c2d-hatch)" opacity="0.25" />
  <path d="M ${f(ex - Rp)} ${f(cy)} a ${f(Rp)} ${f(Rp)} 0 1 0 ${f(2 * Rp)} 0 a ${f(Rp)} ${f(Rp)} 0 1 0 ${f(-2 * Rp)} 0 Z M ${f(ex - Rb)} ${f(cy)} a ${f(Rb)} ${f(Rb)} 0 1 1 ${f(2 * Rb)} 0 a ${f(Rb)} ${f(Rb)} 0 1 1 ${f(-2 * Rb)} 0 Z" fill="#e0f2fe" fill-rule="evenodd" stroke="#0284c7" stroke-width="0.8" />
`);

  // Shaft + keyway
  const shaftR = Math.max(6, Rb * 0.2);
  const key = polar(ex, cy, shaftR, rot);
  t.push(`
  <circle cx="${f(ex)}" cy="${f(cy)}" r="${f(shaftR)}" fill="#94a3b8" stroke="#334155" stroke-width="0.8" />
  <circle cx="${key.x}" cy="${key.y}" r="1.8" fill="#334155" />
`);

  // Label arcs around circumference
  if (hasLayout) {
    rows.forEach((r, i) => {
      const a1 = rot + (r.y / L) * 360;
      const a2 = rot + ((r.y + r.h) / L) * 360;
      t.push(`  <path d="${annularSector(ex, cy, Rp + 0.8, Rp + labelBand, a1, a2)}" fill="#eff6ff" stroke="${labelStroke}" stroke-width="0.8" />`);
      const mid = polar(ex, cy, Rp + labelBand + 7, (a1 + a2) / 2);
      t.push(`  <text x="${mid.x}" y="${f(mid.y + 2.5)}" fill="#1e3a8a" stroke="none" font-size="7" font-weight="700" text-anchor="middle">R${i + 1}</text>`);
    });
  } else {
    t.push(`  <text x="${f(ex)}" y="${f(cy + Rb * 0.55)}" fill="#dc2626" stroke="none" font-size="8" font-weight="700" text-anchor="middle">⚠ No labels fit web width</text>`);
  }

  // Plate seam
  const s1 = polar(ex, cy, Rb - 2, rot);
  const s2 = polar(ex, cy, Rp + labelBand + 3, rot);
  const sl = polar(ex, cy, Rb - 12, rot);
  t.push(`
  <line x1="${s1.x}" y1="${s1.y}" x2="${s2.x}" y2="${s2.y}" stroke="#dc2626" stroke-width="1.4" />
  <text x="${sl.x}" y="${f(sl.y + 2.5)}" fill="#dc2626" stroke="none" font-size="6.5" font-weight="700" text-anchor="middle">SEAM</text>
`);

  // Web passing over the nip (top) + direction
  const webY = cy - Rp - labelBand - 1;
  t.push(`
  <line x1="${f(ex - outer)}" y1="${f(webY)}" x2="${f(ex + outer)}" y2="${f(webY)}" stroke="#0284c7" stroke-width="1.6" marker-end="url(#c2d-arrow-blue)" />
  <text x="${f(ex - outer)}" y="${f(webY - 4)}" fill="#0369a1" stroke="none" font-size="7" font-weight="700">WEB →</text>
  <polygon points="${f(ex)},${f(webY + 0.5)} ${f(ex - 3.5)},${f(webY - 6)} ${f(ex + 3.5)},${f(webY - 6)}" fill="#0284c7" />
  <text x="${f(ex + 6)}" y="${f(webY - 5)}" fill="#0369a1" stroke="none" font-size="6.5" font-weight="600">NIP</text>
`);

  // Rotation arrow (clockwise)
  const ra = Ro + 8;
  const r1 = polar(ex, cy, ra, 55);
  const r2 = polar(ex, cy, ra, 100);
  const rl = polar(ex, cy, ra + 10, 78);
  t.push(`
  <path d="M ${r1.x} ${r1.y} A ${f(ra)} ${f(ra)} 0 0 1 ${r2.x} ${r2.y}" fill="none" stroke="#0284c7" stroke-width="1.2" marker-end="url(#c2d-arrow-blue)" />
  <text x="${rl.x}" y="${rl.y}" fill="#0369a1" stroke="none" font-size="7" font-weight="700">CW</text>
`);

  // End view dimension (printing diameter)
  if (options.showDimensions || options.view === "technical") {
    t.push(`
  <g>
    <line x1="${f(ex - Rp)}" y1="${f(cy)}" x2="${f(ex - Rp)}" y2="${f(dimY + 3)}" stroke="#cbd5e1" stroke-width="0.5" />
    <line x1="${f(ex + Rp)}" y1="${f(cy)}" x2="${f(ex + Rp)}" y2="${f(dimY + 3)}" stroke="#cbd5e1" stroke-width="0.5" />
    <line x1="${f(ex - Rp)}" y1="${f(dimY)}" x2="${f(ex + Rp)}" y2="${f(dimY)}" stroke="#475569" stroke-width="0.7" marker-start="url(#c2d-arrow)" marker-end="url(#c2d-arrow)" />
    <rect x="${f(ex - 46)}" y="${f(dimY - 6)}" width="92" height="12" rx="2" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5" />
    <text x="${f(ex)}" y="${f(dimY + 2.5)}" fill="#0f172a" stroke="none" font-size="7" font-weight="700" text-anchor="middle">Ø ${f(RpMM * 2)} mm (print)</text>
  </g>
`);
  }
  t.push(`  <text x="${f(ex)}" y="${f(dimY + 22)}" fill="#475569" stroke="none" font-size="7.5" font-weight="700" text-anchor="middle" letter-spacing="0.6">END VIEW · OPERATOR SIDE</text>`);
  t.push(`  <text x="${f(ex)}" y="${f(dimY + 33)}" fill="#64748b" stroke="none" font-size="6.5" text-anchor="middle">Barrel Ø ${result.cylinderDiameter} · Circumference ${result.printingLength} mm</text>`);

  // ─────────────────────── FRONT ELEVATION ───────────────────────
  const shaftW = shaftMM * s;
  const gearW = gearWMM * s;
  const faceW = faceMM * s;
  const shaftH = shaftR * 2;
  const gx = fx + shaftW;
  const bx = gx + gearW;
  const bxEnd = bx + faceW;
  const webStart = bx + ((faceMM - webWidth) / 2) * s;
  const webEnd = webStart + webWidth * s;

  // Centerline
  t.push(`  <line x1="${f(fx - 10)}" y1="${f(cy)}" x2="${f(bxEnd + shaftW + 10)}" y2="${f(cy)}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="10 2 2 2" />`);

  // Shafts
  t.push(`
  <rect x="${f(fx)}" y="${f(cy - shaftH / 2)}" width="${f(shaftW)}" height="${f(shaftH)}" fill="#cbd5e1" stroke="#334155" stroke-width="0.8" />
  <rect x="${f(bxEnd)}" y="${f(cy - shaftH / 2)}" width="${f(shaftW)}" height="${f(shaftH)}" fill="#cbd5e1" stroke="#334155" stroke-width="0.8" />
`);

  // Gear (side) with tooth lines - neutral engineering drawing steel
  t.push(`  <rect x="${f(gx)}" y="${f(cy - Ro)}" width="${f(gearW)}" height="${f(2 * Ro)}" fill="#f1f5f9" stroke="#334155" stroke-width="0.8" />`);
  const visibleTeeth = Math.min(60, Math.round(N / 2));
  for (let i = 1; i < visibleTeeth; i++) {
    const ang = (i / visibleTeeth) * 180 + ((rot % p) / p) * (180 / visibleTeeth);
    const y = cy - Ro * Math.cos((ang * Math.PI) / 180);
    t.push(`  <line x1="${f(gx)}" y1="${f(y)}" x2="${f(gx + gearW)}" y2="${f(y)}" stroke="#64748b" stroke-width="0.4" />`);
  }

  // Barrel + plate
  t.push(`
  <rect x="${f(bx)}" y="${f(cy - Rb)}" width="${f(faceW)}" height="${f(2 * Rb)}" fill="#e2e8f0" stroke="#334155" stroke-width="1" />
  <rect x="${f(webStart - 3)}" y="${f(cy - Rp)}" width="${f(webEnd - webStart + 6)}" height="${f(2 * Rp)}" fill="${plateFill}" fill-opacity="0.6" stroke="${labelStroke}" stroke-width="0.8" />
`);

  // Labels visible on front half
  if (hasLayout) {
    for (const pos of result.positions) {
      const a = rot + (pos.y / L) * 360;
      const span = (pos.height / L) * 360;
      for (const [lo, hi] of visibleFrontParts(a, span)) {
        const yTop = cy - Rp * Math.cos((lo * Math.PI) / 180);
        const yBot = cy - Rp * Math.cos((hi * Math.PI) / 180);
        const h = yBot - yTop;
        if (h < 0.6) continue;
        const x = webStart + pos.x * s;
        const w = pos.width * s;
        const midA = ((lo + hi) / 2) * (Math.PI / 180);
        const shade = (0.45 + 0.55 * Math.sin(midA)).toFixed(2);
        t.push(`  <rect x="${f(x)}" y="${f(yTop)}" width="${f(w)}" height="${f(h)}" fill="#ffffff" fill-opacity="${shade}" stroke="${labelStroke}" stroke-width="0.7" />`);
        if (h > 11 && w > 22) {
          const fs = Math.min(8, h * 0.4, w * 0.18);
          t.push(`  <text x="${f(x + w / 2)}" y="${f(yTop + h / 2 + fs * 0.35)}" fill="#1e3a8a" stroke="none" font-size="${f(fs)}" font-weight="700" text-anchor="middle">${pos.width}×${pos.height}</text>`);
        }
      }
    }
  }

  // Seam in front view (only when on the visible half)
  const seamN = ((rot % 360) + 360) % 360;
  if (seamN <= 180) {
    const ys = cy - Rp * Math.cos((seamN * Math.PI) / 180);
    t.push(`  <line x1="${f(webStart - 6)}" y1="${f(ys)}" x2="${f(webEnd + 6)}" y2="${f(ys)}" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="4 2" />`);
  }

  // Web width dimension above
  if (options.showDimensions || options.view === "technical") {
    const dy = cy - Ro - 12;
    t.push(`
  <g>
    <line x1="${f(webStart)}" y1="${f(dy - 3)}" x2="${f(webStart)}" y2="${f(cy - Rp)}" stroke="#cbd5e1" stroke-width="0.5" />
    <line x1="${f(webEnd)}" y1="${f(dy - 3)}" x2="${f(webEnd)}" y2="${f(cy - Rp)}" stroke="#cbd5e1" stroke-width="0.5" />
    <line x1="${f(webStart)}" y1="${f(dy)}" x2="${f(webEnd)}" y2="${f(dy)}" stroke="#475569" stroke-width="0.7" marker-start="url(#c2d-arrow)" marker-end="url(#c2d-arrow)" />
    <rect x="${f((webStart + webEnd) / 2 - 30)}" y="${f(dy - 6)}" width="60" height="12" rx="2" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.5" />
    <text x="${f((webStart + webEnd) / 2)}" y="${f(dy + 2.5)}" fill="#0f172a" stroke="none" font-size="7" font-weight="700" text-anchor="middle">WEB ${result.webWidth} mm</text>
    <line x1="${f(bxEnd + shaftW + 14)}" y1="${f(cy - Rp)}" x2="${f(bxEnd + shaftW + 14)}" y2="${f(cy + Rp)}" stroke="#475569" stroke-width="0.7" marker-start="url(#c2d-arrow)" marker-end="url(#c2d-arrow)" />
    <text x="${f(bxEnd + shaftW + 19)}" y="${f(cy + 2.5)}" fill="#0f172a" stroke="none" font-size="7" font-weight="700">Ø ${f(RpMM * 2)}</text>
  </g>
`);
  }

  const fCenter = (fx + bxEnd + shaftW) / 2;
  t.push(`  <text x="${f(fCenter)}" y="${f(dimY + 22)}" fill="#475569" stroke="none" font-size="7.5" font-weight="700" text-anchor="middle" letter-spacing="0.6">FRONT ELEVATION · VISIBLE HALF</text>`);
  t.push(`  <text x="${f(fCenter)}" y="${f(dimY + 33)}" fill="#64748b" stroke="none" font-size="6.5" text-anchor="middle">Gear side left · Labels foreshortened by curvature · Red dashed = plate seam</text>`);

  t.push(`</svg>`);
  return t.join("\n");
}
