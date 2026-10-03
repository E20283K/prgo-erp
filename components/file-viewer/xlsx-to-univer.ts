import type { Workbook as ExcelWorkbook, Worksheet, Cell, Fill, Font, Borders, Alignment, Color } from "exceljs";
import {
  BooleanNumber,
  BorderStyleTypes,
  CellValueType,
  HorizontalAlign,
  LocaleType,
  VerticalAlign,
  WrapStrategy,
  type ICellData,
  type IStyleData,
  type IWorkbookData,
  type IWorksheetData,
  type IBorderData,
} from "@univerjs/presets";

/**
 * Converts an .xlsx file (parsed client-side by ExcelJS) into Univer's IWorkbookData snapshot.
 * Univer's open-source build has no native XLSX import, so we map values, formulas, styles,
 * merges, column widths and row heights ourselves.
 */

// Default Office theme palette (Excel theme index order: lt1, dk1, lt2, dk2, accent1..6)
const THEME_COLORS = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];

function applyTint(hex: string, tint = 0): string {
  if (!tint) return hex;
  const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = ch.map((c) => Math.round(tint < 0 ? c * (1 + tint) : c + (255 - c) * tint));
  return out.map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")).join("");
}

function toRgb(color?: Partial<Color> & { tint?: number }): string | undefined {
  if (!color) return undefined;
  if (color.argb) {
    const argb = color.argb.length === 8 ? color.argb.slice(2) : color.argb;
    return `#${argb}`;
  }
  if (typeof color.theme === "number" && THEME_COLORS[color.theme]) {
    return `#${applyTint(THEME_COLORS[color.theme], color.tint)}`;
  }
  return undefined;
}

const BORDER_MAP: Record<string, BorderStyleTypes> = {
  thin: BorderStyleTypes.THIN,
  hair: BorderStyleTypes.HAIR,
  dotted: BorderStyleTypes.DOTTED,
  dashed: BorderStyleTypes.DASHED,
  dashDot: BorderStyleTypes.DASH_DOT,
  dashDotDot: BorderStyleTypes.DASH_DOT_DOT,
  double: BorderStyleTypes.DOUBLE,
  medium: BorderStyleTypes.MEDIUM,
  mediumDashed: BorderStyleTypes.MEDIUM_DASHED,
  mediumDashDot: BorderStyleTypes.MEDIUM_DASH_DOT,
  mediumDashDotDot: BorderStyleTypes.MEDIUM_DASH_DOT_DOT,
  slantDashDot: BorderStyleTypes.SLANT_DASH_DOT,
  thick: BorderStyleTypes.THICK,
};

const H_ALIGN: Record<string, HorizontalAlign> = {
  left: HorizontalAlign.LEFT,
  center: HorizontalAlign.CENTER,
  centerContinuous: HorizontalAlign.CENTER,
  right: HorizontalAlign.RIGHT,
  justify: HorizontalAlign.JUSTIFIED,
  distributed: HorizontalAlign.DISTRIBUTED,
};

const V_ALIGN: Record<string, VerticalAlign> = {
  top: VerticalAlign.TOP,
  middle: VerticalAlign.MIDDLE,
  bottom: VerticalAlign.BOTTOM,
};

function convertBorders(border?: Partial<Borders>): IBorderData | undefined {
  if (!border) return undefined;
  const bd: IBorderData = {};
  const sides = [
    ["top", "t"],
    ["bottom", "b"],
    ["left", "l"],
    ["right", "r"],
  ] as const;
  for (const [src, dst] of sides) {
    const b = border[src];
    if (b?.style && BORDER_MAP[b.style]) {
      bd[dst] = { s: BORDER_MAP[b.style], cl: { rgb: toRgb(b.color) ?? "#000000" } };
    }
  }
  return Object.keys(bd).length ? bd : undefined;
}

function convertStyle(cell: Cell): IStyleData | undefined {
  const s: IStyleData = {};
  const font = cell.font as Partial<Font> | undefined;
  if (font) {
    if (font.name) s.ff = font.name;
    if (font.size) s.fs = font.size;
    if (font.bold) s.bl = BooleanNumber.TRUE;
    if (font.italic) s.it = BooleanNumber.TRUE;
    if (font.underline) s.ul = { s: BooleanNumber.TRUE };
    if (font.strike) s.st = { s: BooleanNumber.TRUE };
    const cl = toRgb(font.color);
    if (cl) s.cl = { rgb: cl };
  }

  const fill = cell.fill as Fill | undefined;
  if (fill && fill.type === "pattern" && fill.pattern !== "none") {
    const bg = toRgb(fill.fgColor) ?? toRgb(fill.bgColor);
    if (bg) s.bg = { rgb: bg };
  }

  const align = cell.alignment as Partial<Alignment> | undefined;
  if (align) {
    if (align.horizontal && H_ALIGN[align.horizontal]) s.ht = H_ALIGN[align.horizontal];
    if (align.vertical && V_ALIGN[align.vertical]) s.vt = V_ALIGN[align.vertical];
    if (align.wrapText) s.tb = WrapStrategy.WRAP;
  }

  const bd = convertBorders(cell.border);
  if (bd) s.bd = bd;

  if (cell.numFmt && cell.numFmt !== "General") s.n = { pattern: cell.numFmt };

  return Object.keys(s).length ? s : undefined;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const toExcelSerial = (d: Date) => (d.getTime() - EXCEL_EPOCH) / 86400000;

function convertCell(cell: Cell): ICellData | null {
  const out: ICellData = {};
  const raw = cell.value as unknown;

  if (raw === null || raw === undefined) {
    // Keep styled empty cells (fills / borders)
  } else if (typeof raw === "number") {
    out.v = raw;
    out.t = CellValueType.NUMBER;
  } else if (typeof raw === "string") {
    out.v = raw;
    out.t = CellValueType.STRING;
  } else if (typeof raw === "boolean") {
    out.v = raw ? 1 : 0;
    out.t = CellValueType.BOOLEAN;
  } else if (raw instanceof Date) {
    out.v = toExcelSerial(raw);
    out.t = CellValueType.NUMBER;
  } else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("formula" in obj || "sharedFormula" in obj) {
      const formula = (obj.formula as string | undefined) ?? undefined;
      if (formula) out.f = `=${formula}`;
      const result = obj.result as unknown;
      if (result instanceof Date) out.v = toExcelSerial(result);
      else if (result !== undefined && result !== null && typeof result !== "object") {
        out.v = typeof result === "boolean" ? (result ? 1 : 0) : (result as string | number);
      } else if (!formula) out.v = cell.text;
    } else if (Array.isArray(obj.richText)) {
      out.v = (obj.richText as { text: string }[]).map((r) => r.text).join("");
      out.t = CellValueType.STRING;
    } else if ("hyperlink" in obj) {
      out.v = String(obj.text ?? obj.hyperlink ?? "");
      out.t = CellValueType.STRING;
    } else if ("error" in obj) {
      out.v = String(obj.error);
    } else {
      out.v = cell.text;
    }
  }

  const style = convertStyle(cell);
  if (style) {
    out.s = style;
    if (raw instanceof Date && !style.n) style.n = { pattern: "yyyy-mm-dd" };
  } else if (raw instanceof Date) {
    out.s = { n: { pattern: "yyyy-mm-dd" } };
  }

  return Object.keys(out).length ? out : null;
}

function decodeCellRef(ref: string): { r: number; c: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.replace(/\$/g, ""));
  if (!m) return { r: 0, c: 0 };
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: parseInt(m[2], 10) - 1, c: c - 1 };
}

function convertWorksheet(ws: Worksheet, id: string): Partial<IWorksheetData> {
  const cellData: Record<number, Record<number, ICellData>> = {};
  let maxRow = 0;
  let maxCol = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (cell.isMerged && cell.master !== cell) return; // only master cell carries value
      const data = convertCell(cell);
      if (!data) return;
      const r = rowNumber - 1;
      const c = colNumber - 1;
      (cellData[r] ??= {})[c] = data;
      maxRow = Math.max(maxRow, r);
      maxCol = Math.max(maxCol, c);
    });
  });

  // Merged ranges ("A1:C2")
  const merges = ((ws.model as unknown as { merges?: string[] }).merges ?? []).map((range) => {
    const [a, b = a] = range.split(":");
    const s = decodeCellRef(a);
    const e = decodeCellRef(b);
    return { startRow: s.r, startColumn: s.c, endRow: e.r, endColumn: e.c };
  });

  // Column widths (Excel chars -> px)
  const columnData: Record<number, { w: number; hd?: BooleanNumber }> = {};
  (ws.columns ?? []).forEach((col, idx) => {
    if (!col) return;
    const entry: { w: number; hd?: BooleanNumber } = { w: col.width ? Math.round(col.width * 7 + 5) : 73 };
    if (col.hidden) entry.hd = BooleanNumber.TRUE;
    if (col.width || col.hidden) columnData[idx] = entry;
  });

  // Row heights (pt -> px)
  const rowData: Record<number, { h: number; hd?: BooleanNumber }> = {};
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (row.height || row.hidden) {
      rowData[rowNumber - 1] = {
        h: row.height ? Math.round((row.height * 4) / 3) : 20,
        ...(row.hidden ? { hd: BooleanNumber.TRUE } : {}),
      };
    }
  });

  const frozen = ws.views?.find((v) => v.state === "frozen") as { xSplit?: number; ySplit?: number } | undefined;

  return {
    id,
    name: ws.name,
    hidden: ws.state === "hidden" || ws.state === "veryHidden" ? BooleanNumber.TRUE : BooleanNumber.FALSE,
    rowCount: Math.max(maxRow + 30, 100),
    columnCount: Math.max(maxCol + 6, 26),
    defaultColumnWidth: 73,
    defaultRowHeight: 20,
    cellData,
    mergeData: merges,
    columnData,
    rowData,
    ...(frozen && (frozen.xSplit || frozen.ySplit)
      ? {
          freeze: {
            xSplit: frozen.xSplit ?? 0,
            ySplit: frozen.ySplit ?? 0,
            startRow: frozen.ySplit ?? -1,
            startColumn: frozen.xSplit ?? -1,
          },
        }
      : {}),
  };
}

export async function xlsxToUniverWorkbook(buffer: ArrayBuffer, name: string, locale: LocaleType): Promise<Partial<IWorkbookData>> {
  const ExcelJS = (await import("exceljs")).default;
  const wb: ExcelWorkbook = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheets: Record<string, Partial<IWorksheetData>> = {};
  const sheetOrder: string[] = [];
  wb.worksheets.forEach((ws, i) => {
    const id = `sheet-${i + 1}`;
    sheets[id] = convertWorksheet(ws, id);
    sheetOrder.push(id);
  });

  return {
    id: `wb-${Date.now()}`,
    name,
    appVersion: "1.0.0",
    locale,
    styles: {},
    sheetOrder,
    sheets,
  };
}
