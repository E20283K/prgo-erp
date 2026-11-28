/**
 * Korxona CMYK shkalasi (Prinect/FOGRA 4 Dipco 2.1, Format 74).
 * O'lchamlar doc-service/app/sheet_imposition/assets/color_bar.json bilan bir xil bo'lishi shart —
 * joylashuv qoidalari marks.py: MarksGenerator.color_bar_placement bilan mos.
 */
export const COLOR_BAR = {
  src: "/imposition/color-bar.svg",
  widthMm: 298.143,
  heightMm: 5.648,
  /** Shkaladagi bosma markazi uchburchagi (▲) — list markaziga to'g'rilanadi */
  pressCenterMm: 195.541,
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

export interface ColorBarPlacement {
  x0: number;
  yTop: number;
  clipX0: number;
  clipX1: number;
}

interface CellBox {
  y_mm: number;
}

/** Yuqori (klapanga qarama-qarshi) bo'sh tasma: list cheti -> montaj blokining tashqi foni, mm */
export function topFreeBand(cells: CellBox[], marginTop: number, outerBleed: number): number {
  const top = cells.length ? Math.min(...cells.map((c) => c.y_mm)) : marginTop;
  return Math.max(0, top - outerBleed);
}

export function colorBarPlacement(sheetW: number, topBand: number, reach: number): ColorBarPlacement | null {
  const lo = EDGE_SAFE;
  const hi = topBand - reach - BLEED_SAFE;
  if (hi - lo < COLOR_BAR.heightMm) return null;
  const x0 = sheetW / 2 - COLOR_BAR.pressCenterMm;
  const clipX0 = Math.max(x0, EDGE_SAFE);
  const clipX1 = Math.min(x0 + COLOR_BAR.widthMm, sheetW - EDGE_SAFE);
  if (clipX1 <= clipX0) return null;
  return { x0, yTop: (lo + hi) / 2 - COLOR_BAR.heightMm / 2, clipX0, clipX1 };
}
