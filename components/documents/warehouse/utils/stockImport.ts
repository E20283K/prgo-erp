/**
 * Ombor qoldiqlarini Excel/CSV fayldan import qilish: shablon, o'qish va tekshirish.
 * Server tomoni: POST /api/v1/warehouse/stock/import (lib/server/warehouseService.ts → importStockBalances)
 */
import type { WarehouseStockRecord } from "@/store/workspaceStore";

export type StockImportField =
  | "sku"
  | "name"
  | "category"
  | "location"
  | "locationShelf"
  | "stockLevel"
  | "unit"
  | "sheetFormat"
  | "grammage"
  | "price"
  | "currency"
  | "reorder"
  | "batchNo"
  | "supplier"
  | "rollWidthMm"
  | "rollLengthM"
  | "expiryDate";

interface ColumnDef {
  key: StockImportField;
  header: string;
  required?: boolean;
  width: number;
  aliases: string[];
}

export const STOCK_IMPORT_COLUMNS: ColumnDef[] = [
  { key: "sku", header: "SKU", width: 14, aliases: ["sku", "artikul", "kod", "code"] },
  { key: "name", header: "Nomi", required: true, width: 36, aliases: ["nomi", "nom", "name", "material", "material name", "mahsulot"] },
  { key: "category", header: "Kategoriya", required: true, width: 20, aliases: ["kategoriya", "category", "turi", "guruh"] },
  { key: "location", header: "Ombor", width: 20, aliases: ["ombor", "location", "warehouse", "joylashuv"] },
  { key: "locationShelf", header: "Javon", width: 12, aliases: ["javon", "katak", "shelf", "bin", "locationshelf"] },
  { key: "stockLevel", header: "Miqdor", required: true, width: 12, aliases: ["miqdor", "qoldiq", "soni", "quantity", "qty", "stock", "stocklevel", "total stock"] },
  { key: "unit", header: "Birlik", required: true, width: 10, aliases: ["birlik", "unit", "ulchov", "o'lchov birligi"] },
  { key: "sheetFormat", header: "Format", width: 14, aliases: ["format", "o'lcham", "sheetformat", "format / dimensions", "dimensions"] },
  { key: "grammage", header: "Grammaj", width: 10, aliases: ["grammaj", "gramaj", "grammage", "gsm", "g/m2"] },
  { key: "price", header: "Narx", width: 12, aliases: ["narx", "tannarx", "price", "unit price", "unitprice"] },
  { key: "currency", header: "Valyuta", width: 9, aliases: ["valyuta", "currency"] },
  { key: "reorder", header: "Minimal qoldiq", width: 14, aliases: ["minimal qoldiq", "minimal", "reorder", "min"] },
  { key: "batchNo", header: "Partiya", width: 12, aliases: ["partiya", "batch", "batchno", "lot"] },
  { key: "supplier", header: "Yetkazuvchi", width: 20, aliases: ["yetkazuvchi", "supplier", "vendor", "ta'minotchi"] },
  { key: "rollWidthMm", header: "Rulon eni (mm)", width: 14, aliases: ["rulon eni (mm)", "rulon eni", "roll width", "rollwidthmm"] },
  { key: "rollLengthM", header: "Rulon uzunligi (m)", width: 16, aliases: ["rulon uzunligi (m)", "rulon uzunligi", "roll length", "rolllengthm"] },
  { key: "expiryDate", header: "Yaroqlilik muddati", width: 16, aliases: ["yaroqlilik muddati", "muddati", "expiry", "expirydate", "expiry date"] },
];

export const CATEGORY_OPTIONS: { value: WarehouseStockRecord["category"]; label: string; aliases: string[] }[] = [
  { value: "Paper & Board", label: "Qog'oz va karton", aliases: ["qog'oz", "qogoz", "karton", "paper", "board"] },
  { value: "Roll & Label", label: "Rulon va etiketka", aliases: ["rulon", "etiketka", "roll", "label"] },
  { value: "Inks & Plates", label: "Bo'yoq va plastina", aliases: ["bo'yoq", "boyoq", "plastina", "ink", "inks", "plates"] },
  { value: "Foil & Film", label: "Folga va plyonka", aliases: ["folga", "plyonka", "foil", "film"] },
  { value: "Adhesives & Binding", label: "Yelim va muqova", aliases: ["yelim", "muqova", "adhesive", "adhesives", "binding"] },
  { value: "Offcuts & Scraps", label: "Qoldiq va chiqindi", aliases: ["chiqindi", "kesilma", "offcut", "offcuts", "scrap", "scraps"] },
];

export const UNIT_OPTIONS: { value: WarehouseStockRecord["unit"]; label: string; aliases: string[] }[] = [
  { value: "sheets", label: "varaq", aliases: ["varaq", "list", "sheet", "sheets"] },
  { value: "rolls", label: "rulon", aliases: ["rulon", "roll", "rolls"] },
  { value: "kg", label: "kg", aliases: ["kg", "kilogramm", "kilogram"] },
  { value: "pcs", label: "dona", aliases: ["dona", "pcs", "pc", "piece", "pieces", "sht"] },
  { value: "m²", label: "m²", aliases: ["m²", "m2", "kv.m", "kvm", "sqm"] },
  { value: "m", label: "m", aliases: ["m", "metr", "meter"] },
  { value: "liters", label: "litr", aliases: ["litr", "l", "liter", "liters", "litre"] },
  { value: "drums", label: "bochka", aliases: ["bochka", "drum", "drums"] },
];

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[‘’`ʻʼ]/g, "'")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ");

function matchOption<T extends string>(raw: string, options: { value: T; label: string; aliases: string[] }[]): T | null {
  const n = norm(raw);
  if (!n) return null;
  for (const o of options) {
    if (norm(o.value) === n || norm(o.label) === n || o.aliases.some((a) => norm(a) === n)) return o.value;
  }
  return null;
}

// ─── Fayl o'qish ────────────────────────────────────────────────────────────────

/** Excel/CSV'dan o'qilgan xom jadval: birinchi qator sarlavha */
export type RawTable = string[][];

export function parseCsv(input: string): RawTable {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)
    ? ";"
    : (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)
    ? "\t"
    : ",";

  const rows: RawTable = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") {
    const v = value as any;
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("");
    if ("result" in v) return cellToString(v.result);
    if ("text" in v) return String(v.text);
    if ("error" in v) return "";
  }
  return String(value);
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<RawTable> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: RawTable = [];
  const colCount = ws.columnCount;
  ws.eachRow({ includeEmpty: true }, (r) => {
    const out: string[] = [];
    for (let c = 1; c <= colCount; c++) out.push(cellToString(r.getCell(c).value));
    rows.push(out);
  });
  return rows;
}

export async function readImportFile(file: File): Promise<RawTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(await file.text());
  throw new Error("Faqat .xlsx yoki .csv fayl qabul qilinadi");
}

// ─── Tekshirish ─────────────────────────────────────────────────────────────────

export interface ParsedStockRow {
  rowNo: number;
  sku?: string;
  name: string;
  category: string;
  location?: string;
  locationShelf?: string;
  stockLevel: number;
  unit: string;
  sheetFormat?: string;
  grammage?: number;
  price?: number;
  currency?: "USD" | "UZS";
  reorder?: number;
  batchNo?: string;
  supplier?: string;
  rollWidthMm?: number;
  rollLengthM?: number;
  expiryDate?: string;
}

export interface ValidatedRow {
  rowNo: number;
  data: ParsedStockRow;
  errors: string[];
  action: "create" | "update";
}

/** "1 234,5" / "1,234.5" / "1234.5" → 1234.5; bo'sh → undefined; noto'g'ri → NaN */
export function parseNumber(raw: string): number | undefined {
  let s = String(raw ?? "").trim().replace(/[\s ']/g, "");
  if (!s) return undefined;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function parseDate(raw: string): string | undefined | null {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function validateRows(
  table: RawTable,
  ctx: { warehouses: { name: string }[]; existingStock: WarehouseStockRecord[] }
): { rows: ValidatedRow[]; missingHeaders: string[] } {
  const [headerRow = [], ...body] = table;
  const colIndex = new Map<StockImportField, number>();
  headerRow.forEach((h, idx) => {
    const n = norm(h);
    const col = STOCK_IMPORT_COLUMNS.find((c) => norm(c.header) === n || c.aliases.some((a) => norm(a) === n));
    if (col && !colIndex.has(col.key)) colIndex.set(col.key, idx);
  });
  const missingHeaders = STOCK_IMPORT_COLUMNS.filter((c) => c.required && !colIndex.has(c.key)).map((c) => c.header);
  if (missingHeaders.length > 0) return { rows: [], missingHeaders };

  const whNames = new Map(ctx.warehouses.map((w) => [norm(w.name), w.name]));
  const seen = new Set<string>();
  const rows: ValidatedRow[] = [];

  body.forEach((cells, i) => {
    const get = (k: StockImportField) => {
      const idx = colIndex.get(k);
      return idx === undefined ? "" : String(cells[idx] ?? "").trim();
    };
    if (STOCK_IMPORT_COLUMNS.every((c) => !get(c.key))) return; // bo'sh qator

    const rowNo = i + 2;
    const errors: string[] = [];
    const num = (k: StockImportField, label: string) => {
      const n = parseNumber(get(k));
      if (n !== undefined && (Number.isNaN(n) || n < 0)) {
        errors.push(`${label}: noto'g'ri son`);
        return undefined;
      }
      return n;
    };

    const name = get("name");
    if (!name) errors.push("Nomi bo'sh");

    const categoryRaw = get("category");
    const category = matchOption(categoryRaw, CATEGORY_OPTIONS);
    if (!categoryRaw) errors.push("Kategoriya bo'sh");
    else if (!category) errors.push(`Kategoriya noma'lum: ${categoryRaw}`);

    const unitRaw = get("unit");
    const unit = matchOption(unitRaw, UNIT_OPTIONS);
    if (!unitRaw) errors.push("Birlik bo'sh");
    else if (!unit) errors.push(`Birlik noma'lum: ${unitRaw}`);

    const qtyRaw = get("stockLevel");
    const stockLevel = num("stockLevel", "Miqdor");
    if (!qtyRaw) errors.push("Miqdor bo'sh");

    const locationRaw = get("location");
    let location: string | undefined;
    if (locationRaw) {
      location = whNames.get(norm(locationRaw));
      if (!location && ctx.warehouses.length > 0) errors.push(`Ombor topilmadi: ${locationRaw}`);
      if (!location && ctx.warehouses.length === 0) location = locationRaw;
    }

    const currencyRaw = get("currency").toUpperCase();
    let currency: "USD" | "UZS" | undefined;
    if (currencyRaw) {
      if (currencyRaw === "USD" || currencyRaw === "$") currency = "USD";
      else if (currencyRaw === "UZS" || currencyRaw === "SO'M" || currencyRaw === "SUM" || currencyRaw === "SOM") currency = "UZS";
      else errors.push(`Valyuta noma'lum: ${currencyRaw}`);
    }

    const expiry = parseDate(get("expiryDate"));
    if (expiry === null) errors.push("Yaroqlilik muddati: sana formati YYYY-MM-DD yoki DD.MM.YYYY");

    const sku = get("sku") || undefined;
    // Ombor ko'rsatilmasa serverda mavjud joylashuv olinadi — dublikatni shu bo'yicha aniqlaymiz
    const existing = sku
      ? ctx.existingStock.find((s) => s.sku === sku && (!location || s.location === location))
      : undefined;
    const effectiveLocation = location || existing?.location || ctx.warehouses[0]?.name || "";
    if (sku) {
      const key = `${sku}@@${effectiveLocation}`;
      if (seen.has(key)) errors.push("Faylda takroriy SKU");
      seen.add(key);
    }

    rows.push({
      rowNo,
      errors,
      action: existing ? "update" : "create",
      data: {
        rowNo,
        sku,
        name,
        category: category || categoryRaw,
        location,
        locationShelf: get("locationShelf") || undefined,
        stockLevel: stockLevel ?? 0,
        unit: unit || unitRaw,
        sheetFormat: get("sheetFormat") || undefined,
        grammage: num("grammage", "Grammaj"),
        price: num("price", "Narx"),
        currency,
        reorder: num("reorder", "Minimal qoldiq"),
        batchNo: get("batchNo") || undefined,
        supplier: get("supplier") || undefined,
        rollWidthMm: num("rollWidthMm", "Rulon eni"),
        rollLengthM: num("rollLengthM", "Rulon uzunligi"),
        expiryDate: expiry || undefined,
      },
    });
  });

  return { rows, missingHeaders: [] };
}

// ─── Shablon ────────────────────────────────────────────────────────────────────

const SAMPLE_ROW = (warehouse: string): Record<StockImportField, string | number> => ({
  sku: "",
  name: "Mel qog'oz 300 g/m² 70x100",
  category: CATEGORY_OPTIONS[0].label,
  location: warehouse,
  locationShelf: "A-01",
  stockLevel: 5000,
  unit: "varaq",
  sheetFormat: "70x100",
  grammage: 300,
  price: 0.35,
  currency: "USD",
  reorder: 1000,
  batchNo: "",
  supplier: "",
  rollWidthMm: "",
  rollLengthM: "",
  expiryDate: "",
});

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildTemplateXlsx(warehouses: { name: string }[]): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PrintGoo";
  const ws = wb.addWorksheet("Qoldiq", { views: [{ state: "frozen", ySplit: 1 }] });
  const lists = wb.addWorksheet("Ro'yxatlar");

  ws.columns = STOCK_IMPORT_COLUMNS.map((c) => ({
    header: c.required ? `${c.header}*` : c.header,
    key: c.key,
    width: c.width,
  }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  header.eachCell((cell, colNo) => {
    const col = STOCK_IMPORT_COLUMNS[colNo - 1];
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col?.required ? "FFFDE68A" : "FFE5E7EB" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });
  // Namuna alohida varaqda — "Qoldiq" varag'ida qolib ketib import bo'lmasligi uchun
  const sample = wb.addWorksheet("Namuna");
  sample.columns = ws.columns.map((c) => ({ header: String(c.header ?? ""), key: String(c.key), width: c.width }));
  sample.getRow(1).font = { bold: true };
  sample.addRow(SAMPLE_ROW(warehouses[0]?.name || "Asosiy ombor"));

  // Ro'yxatlar varag'i: dropdown manbalari
  const whList = warehouses.length > 0 ? warehouses.map((w) => w.name) : ["Asosiy ombor"];
  lists.columns = [
    { header: "Kategoriya", key: "category", width: 24 },
    { header: "Birlik", key: "unit", width: 12 },
    { header: "Ombor", key: "location", width: 24 },
    { header: "Valyuta", key: "currency", width: 10 },
  ];
  lists.getRow(1).font = { bold: true };
  const maxLen = Math.max(CATEGORY_OPTIONS.length, UNIT_OPTIONS.length, whList.length, 2);
  for (let i = 0; i < maxLen; i++) {
    lists.addRow({
      category: CATEGORY_OPTIONS[i]?.label ?? "",
      unit: UNIT_OPTIONS[i]?.label ?? "",
      location: whList[i] ?? "",
      currency: ["USD", "UZS"][i] ?? "",
    });
  }

  const listRef = (colLetter: string, count: number) => `'Ro''yxatlar'!$${colLetter}$2:$${colLetter}$${count + 1}`;
  const validations: Partial<Record<StockImportField, string>> = {
    category: listRef("A", CATEGORY_OPTIONS.length),
    unit: listRef("B", UNIT_OPTIONS.length),
    location: listRef("C", whList.length),
    currency: listRef("D", 2),
  };
  STOCK_IMPORT_COLUMNS.forEach((c, idx) => {
    const formula = validations[c.key];
    const colLetter = ws.getColumn(idx + 1).letter;
    for (let r = 2; r <= 2001; r++) {
      const cell = ws.getCell(`${colLetter}${r}`);
      if (formula) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: c.header,
          error: "Ro'yxatdan tanlang",
        };
      } else if (["stockLevel", "grammage", "price", "reorder", "rollWidthMm", "rollLengthM"].includes(c.key)) {
        cell.dataValidation = {
          type: "decimal",
          operator: "greaterThanOrEqual",
          allowBlank: true,
          formulae: [0],
          showErrorMessage: true,
          errorTitle: c.header,
          error: "Musbat son kiriting",
        };
      }
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Faqat sarlavha qatori: `;` ajratgich va BOM — Excel o'zbek/kirill harflarni to'g'ri ochadi */
export function buildTemplateCsv(): Blob {
  const header = STOCK_IMPORT_COLUMNS.map((c) => c.header).join(";");
  return new Blob(["﻿" + header + "\r\n"], { type: "text/csv;charset=utf-8" });
}
