/**
 * Korxona CMYK shkalasi (Prinect Fogra 4 Dipco 2.1, Format 74).
 * O'lchamlar doc-service/app/sheet_imposition/assets/color_bar.json bilan bir xil bo'lishi shart —
 * joylashuv qoidalari marks.py: MarksGenerator.color_bar_placement bilan mos.
 */
export const COLOR_BAR = {
  src: "/imposition/color-bar.svg",
  widthMm: 370.077,
  heightMm: 5.332,
  /** Shkaladagi bosma markazi uchburchagi (▲) — list markaziga to'g'rilanadi */
  pressCenterMm: 184.371,
  /** Takrorlash qadami: 21 zona × 17.573 mm */
  periodMm: 369.03,
} as const;

/** Gilotina xatoligi (list cheti) va tashqi fondan xavfsiz masofa, mm */
const EDGE_SAFE = 1;
const BLEED_SAFE = 0.5;

/** Krop chizig'i uzunligi (doc-service crop_length_mm) */
const CROP_LEN = 4;

/** Krop chiziqlari tashqi fondan tashqariga chiqadigan qism, mm */
export function cropReach(cropGap: number, hasCells: boolean): number {
  // krop offset = tashqi fon + oraliq, shuning uchun fon chetidan: oraliq + uzunlik
  return hasCells ? Math.max(0, cropGap + CROP_LEN) : 0;
}

/** Shkala sig'ishi uchun kerakli yuqori bo'sh tasma (list cheti -> tashqi fon), mm */
export function colorBarMinBand(reach: number): number {
  return COLOR_BAR.heightMm + EDGE_SAFE + reach + BLEED_SAFE;
}

export interface ColorBarSegment {
  /** Nusxa boshi (dizayn yoki list chetidan tashqarida bo'lishi mumkin) */
  originX: number;
  clipX0: number;
  clipX1: number;
}

export interface ColorBarPlacement {
  yTop: number;
  segments: ColorBarSegment[];
}

interface CellBox {
  x_mm: number;
  y_mm: number;
  w_mm: number;
}

interface SheetBox {
  sheetW: number;
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  outerBleed: number;
  cropGap: number;
}

/** Yuqori (klapanga qarama-qarshi) bo'sh tasma: list cheti -> montaj blokining tashqi foni, mm */
export function topFreeBand(cells: CellBox[], marginTop: number, outerBleed: number): number {
  const top = cells.length ? Math.min(...cells.map((c) => c.y_mm)) : marginTop;
  return Math.max(0, top - outerBleed);
}

/** Shkala dizayn boshidan oxirigacha (tashqi fon bilan), ▲ list markazida, zonalar qadamida takrorlanadi */
export function colorBarPlacement(cells: CellBox[], s: SheetBox): ColorBarPlacement | null {
  const reach = cropReach(s.cropGap, cells.length > 0);
  const lo = EDGE_SAFE;
  const hi = topFreeBand(cells, s.marginTop, s.outerBleed) - reach - BLEED_SAFE;
  if (hi - lo < COLOR_BAR.heightMm) return null;

  let span0 = cells.length ? Math.min(...cells.map((c) => c.x_mm)) - s.outerBleed : s.marginLeft;
  let span1 = cells.length ? Math.max(...cells.map((c) => c.x_mm + c.w_mm)) + s.outerBleed : s.sheetW - s.marginRight;
  span0 = Math.max(span0, EDGE_SAFE);
  span1 = Math.min(span1, s.sheetW - EDGE_SAFE);
  if (span1 <= span0) return null;

  const base = s.sheetW / 2 - COLOR_BAR.pressCenterMm;
  const kFirst = Math.floor((span0 - base) / COLOR_BAR.periodMm);
  const kLast = Math.floor((span1 - base) / COLOR_BAR.periodMm);
  const segments: ColorBarSegment[] = [];
  for (let k = kFirst; k <= kLast; k++) {
    const originX = base + k * COLOR_BAR.periodMm;
    const end = originX + (k === kLast ? COLOR_BAR.widthMm : COLOR_BAR.periodMm);
    const clipX0 = Math.max(originX, span0);
    const clipX1 = Math.min(end, span1);
    if (clipX1 - clipX0 > 0.01) segments.push({ originX, clipX0, clipX1 });
  }
  return segments.length ? { yTop: (lo + hi) / 2 - COLOR_BAR.heightMm / 2, segments } : null;
}
