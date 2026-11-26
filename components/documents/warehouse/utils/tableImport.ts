/**
 * Excel/CSV jadval importi uchun umumiy qism: fayl o'qish, sarlavhalarni moslash, son/sana o'qish
 * va shablon yaratish. Ombor qoldig'i (stockImport.ts) va tayyor mahsulot (fgImport.ts) importlari ishlatadi.
 */

export interface ImportColumnDef<K extends string = string> {
  key: K;
  header: string;
  required?: boolean;
  width: number;
  aliases: string[];
  /** Shablonda manfiy bo'lmagan son validatsiyasi qo'yiladi */
  numeric?: boolean;
}

export interface ImportOption<T extends string = string> {
  value: T;
  label: string;
  aliases: string[];
}

/** Oldindan ko'rish va importdagi bitta qator */
export interface ImportPreviewRow<T> {
  rowNo: number;
  data: T;
  errors: string[];
  action: "create" | "update";
  /** Xato emas, ammo e'tibor beriladigan belgilar (masalan, "Yangi mijoz") */
  flags?: string[];
}

export interface ImportValidation<T> {
  rows: ImportPreviewRow<T>[];
  missingHeaders: string[];
}

/** Excel/CSV'dan o'qilgan xom jadval: birinchi qator sarlavha */
export type RawTable = string[][];

export const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[‘’`ʻʼ]/g, "'")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ");

export function matchOption<T extends string>(raw: string, options: ImportOption<T>[]): T | null {
  const n = norm(raw);
  if (!n) return null;
  for (const o of options) {
    if (norm(o.value) === n || norm(o.label) === n || o.aliases.some((a) => norm(a) === n)) return o.value;
  }
  return null;
}

// ─── Fayl o'qish ────────────────────────────────────────────────────────────────

export function parseCsv(input: string): RawTable {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const count = (re: RegExp) => firstLine.match(re)?.length || 0;
  const delimiter =
    count(/;/g) > count(/,/g) ? ";" : count(/\t/g) > count(/,/g) ? "\t" : ",";

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

// ─── Qiymatlarni o'qish ─────────────────────────────────────────────────────────

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

/** YYYY-MM-DD yoki DD.MM.YYYY → YYYY-MM-DD; bo'sh → undefined; noto'g'ri → null */
export function parseDate(raw: string): string | undefined | null {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** Sarlavha qatorini ustun ta'riflariga moslaydi; birinchi mos kelgan ustun olinadi */
export function mapHeaders<K extends string>(headerRow: string[], columns: ImportColumnDef<K>[]) {
  const colIndex = new Map<K, number>();
  headerRow.forEach((h, idx) => {
    const n = norm(h);
    const col = columns.find((c) => norm(c.header) === n || c.aliases.some((a) => norm(a) === n));
    if (col && !colIndex.has(col.key)) colIndex.set(col.key, idx);
  });
  const missingHeaders = columns.filter((c) => c.required && !colIndex.has(c.key)).map((c) => c.header);
  const getter = (cells: string[]) => (k: K) => {
    const idx = colIndex.get(k);
    return idx === undefined ? "" : String(cells[idx] ?? "").trim();
  };
  return { colIndex, missingHeaders, getter };
}

// ─── Shablon ────────────────────────────────────────────────────────────────────

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

export interface TemplateList<K extends string> {
  /** Dropdown qo'yiladigan ustun */
  key: K;
  title: string;
  values: string[];
  /** false bo'lsa ro'yxatdan tashqari qiymat yozish mumkin (faqat taklif) */
  strict?: boolean;
}

const TEMPLATE_ROWS = 2000;

export async function buildTemplateXlsx<K extends string>(opts: {
  sheetName: string;
  columns: ImportColumnDef<K>[];
  lists: TemplateList<K>[];
  sample: Partial<Record<K, string | number>>;
}): Promise<Blob> {
  const { sheetName, columns, lists, sample } = opts;
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PrintGoo";
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  const listSheet = wb.addWorksheet("Ro'yxatlar");

  const colDefs = columns.map((c) => ({ header: c.required ? `${c.header}*` : c.header, key: c.key, width: c.width }));
  ws.columns = colDefs;
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  header.eachCell((cell, colNo) => {
    const col = columns[colNo - 1];
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col?.required ? "FFFDE68A" : "FFE5E7EB" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });

  // Namuna alohida varaqda — asosiy varaqda qolib ketib import bo'lmasligi uchun
  const sampleSheet = wb.addWorksheet("Namuna");
  sampleSheet.columns = colDefs;
  sampleSheet.getRow(1).font = { bold: true };
  sampleSheet.addRow(sample);

  // Ro'yxatlar varag'i: dropdown manbalari
  listSheet.columns = lists.map((l) => ({ header: l.title, key: l.key, width: 26 }));
  listSheet.getRow(1).font = { bold: true };
  const maxLen = Math.max(1, ...lists.map((l) => l.values.length));
  for (let i = 0; i < maxLen; i++) {
    listSheet.addRow(Object.fromEntries(lists.map((l) => [l.key, l.values[i] ?? ""])));
  }

  const listByKey = new Map(
    lists.map((l, idx) => {
      const letter = listSheet.getColumn(idx + 1).letter;
      const end = Math.max(2, l.values.length + 1);
      return [l.key, { list: l, formula: `'Ro''yxatlar'!$${letter}$2:$${letter}$${end}` }];
    })
  );

  columns.forEach((c, idx) => {
    const letter = ws.getColumn(idx + 1).letter;
    const entry = listByKey.get(c.key);
    if (!entry && !c.numeric) return;
    for (let r = 2; r <= TEMPLATE_ROWS + 1; r++) {
      const cell = ws.getCell(`${letter}${r}`);
      if (entry) {
        const strict = entry.list.strict !== false;
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [entry.formula],
          showErrorMessage: strict,
          errorStyle: strict ? "stop" : "information",
          errorTitle: c.header,
          error: "Ro'yxatdan tanlang",
        };
      } else {
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
export function buildTemplateCsv(columns: ImportColumnDef[]): Blob {
  const header = columns.map((c) => c.header).join(";");
  return new Blob(["﻿" + header + "\r\n"], { type: "text/csv;charset=utf-8" });
}
