/**
 * Ombor qoldiqlarini Excel/CSV fayldan import qilish: ustunlar, tekshirish va shablon.
 * Server tomoni: POST /api/v1/warehouse/stock/import (lib/server/warehouseService.ts → importStockBalances)
 */
import type { WarehouseStockRecord } from "@/store/workspaceStore";
import {
  buildTemplateCsv,
  buildTemplateXlsx,
  mapHeaders,
  matchOption,
  norm,
  parseDate,
  parseNumber,
  type ImportColumnDef,
  type ImportOption,
  type ImportPreviewRow,
  type ImportValidation,
  type RawTable,
} from "./tableImport";

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

export const STOCK_IMPORT_COLUMNS: ImportColumnDef<StockImportField>[] = [
  { key: "sku", header: "SKU", width: 14, aliases: ["sku", "artikul", "kod", "code"] },
  { key: "name", header: "Nomi", required: true, width: 36, aliases: ["nomi", "nom", "name", "material", "material name", "mahsulot"] },
  { key: "category", header: "Kategoriya", required: true, width: 20, aliases: ["kategoriya", "category", "turi", "guruh"] },
  { key: "location", header: "Ombor", width: 20, aliases: ["ombor", "location", "warehouse", "joylashuv"] },
  { key: "locationShelf", header: "Javon", width: 12, aliases: ["javon", "katak", "shelf", "bin", "locationshelf"] },
  { key: "stockLevel", header: "Miqdor", required: true, numeric: true, width: 12, aliases: ["miqdor", "qoldiq", "soni", "quantity", "qty", "stock", "stocklevel", "total stock"] },
  { key: "unit", header: "Birlik", required: true, width: 10, aliases: ["birlik", "unit", "ulchov", "o'lchov birligi"] },
  { key: "sheetFormat", header: "Format", width: 14, aliases: ["format", "o'lcham", "sheetformat", "format / dimensions", "dimensions"] },
  { key: "grammage", header: "Grammaj", numeric: true, width: 10, aliases: ["grammaj", "gramaj", "grammage", "gsm", "g/m2"] },
  { key: "price", header: "Narx", numeric: true, width: 12, aliases: ["narx", "tannarx", "price", "unit price", "unitprice"] },
  { key: "currency", header: "Valyuta", width: 9, aliases: ["valyuta", "currency"] },
  { key: "reorder", header: "Minimal qoldiq", numeric: true, width: 14, aliases: ["minimal qoldiq", "minimal", "reorder", "min"] },
  { key: "batchNo", header: "Partiya", width: 12, aliases: ["partiya", "batch", "batchno", "lot"] },
  { key: "supplier", header: "Yetkazuvchi", width: 20, aliases: ["yetkazuvchi", "supplier", "vendor", "ta'minotchi"] },
  { key: "rollWidthMm", header: "Rulon eni (mm)", numeric: true, width: 14, aliases: ["rulon eni (mm)", "rulon eni", "roll width", "rollwidthmm"] },
  { key: "rollLengthM", header: "Rulon uzunligi (m)", numeric: true, width: 16, aliases: ["rulon uzunligi (m)", "rulon uzunligi", "roll length", "rolllengthm"] },
  { key: "expiryDate", header: "Yaroqlilik muddati", width: 16, aliases: ["yaroqlilik muddati", "muddati", "expiry", "expirydate", "expiry date"] },
];

export const CATEGORY_OPTIONS: ImportOption<WarehouseStockRecord["category"]>[] = [
  { value: "Paper & Board", label: "Qog'oz va karton", aliases: ["qog'oz", "qogoz", "karton", "paper", "board"] },
  { value: "Roll & Label", label: "Rulon va etiketka", aliases: ["rulon", "etiketka", "roll", "label"] },
  { value: "Inks & Plates", label: "Bo'yoq va plastina", aliases: ["bo'yoq", "boyoq", "plastina", "ink", "inks", "plates"] },
  { value: "Foil & Film", label: "Folga va plyonka", aliases: ["folga", "plyonka", "foil", "film"] },
  { value: "Adhesives & Binding", label: "Yelim va muqova", aliases: ["yelim", "muqova", "adhesive", "adhesives", "binding"] },
  { value: "Offcuts & Scraps", label: "Qoldiq va chiqindi", aliases: ["chiqindi", "kesilma", "offcut", "offcuts", "scrap", "scraps"] },
];

export const UNIT_OPTIONS: ImportOption<WarehouseStockRecord["unit"]>[] = [
  { value: "sheets", label: "varaq", aliases: ["varaq", "list", "sheet", "sheets"] },
  { value: "rolls", label: "rulon", aliases: ["rulon", "roll", "rolls"] },
  { value: "kg", label: "kg", aliases: ["kg", "kilogramm", "kilogram"] },
  { value: "pcs", label: "dona", aliases: ["dona", "pcs", "pc", "piece", "pieces", "sht"] },
  { value: "m²", label: "m²", aliases: ["m²", "m2", "kv.m", "kvm", "sqm"] },
  { value: "m", label: "m", aliases: ["m", "metr", "meter"] },
  { value: "liters", label: "litr", aliases: ["litr", "l", "liter", "liters", "litre"] },
  { value: "drums", label: "bochka", aliases: ["bochka", "drum", "drums"] },
];

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

export type ValidatedRow = ImportPreviewRow<ParsedStockRow>;

export function validateRows(
  table: RawTable,
  ctx: { warehouses: { name: string }[]; existingStock: WarehouseStockRecord[] }
): ImportValidation<ParsedStockRow> {
  const [headerRow = [], ...body] = table;
  const { missingHeaders, getter } = mapHeaders(headerRow, STOCK_IMPORT_COLUMNS);
  if (missingHeaders.length > 0) return { rows: [], missingHeaders };

  const whNames = new Map(ctx.warehouses.map((w) => [norm(w.name), w.name]));
  const seen = new Set<string>();
  const rows: ValidatedRow[] = [];

  body.forEach((cells, i) => {
    const get = getter(cells);
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
      else if (["UZS", "SO'M", "SUM", "SOM"].includes(currencyRaw)) currency = "UZS";
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

export function buildStockTemplateXlsx(warehouses: { name: string }[]): Promise<Blob> {
  const whList = warehouses.length > 0 ? warehouses.map((w) => w.name) : ["Asosiy ombor"];
  return buildTemplateXlsx({
    sheetName: "Qoldiq",
    columns: STOCK_IMPORT_COLUMNS,
    lists: [
      { key: "category", title: "Kategoriya", values: CATEGORY_OPTIONS.map((o) => o.label) },
      { key: "unit", title: "Birlik", values: UNIT_OPTIONS.map((o) => o.label) },
      { key: "location", title: "Ombor", values: whList },
      { key: "currency", title: "Valyuta", values: ["USD", "UZS"] },
    ],
    sample: {
      name: "Mel qog'oz 300 g/m² 70x100",
      category: CATEGORY_OPTIONS[0].label,
      location: whList[0],
      locationShelf: "A-01",
      stockLevel: 5000,
      unit: "varaq",
      sheetFormat: "70x100",
      grammage: 300,
      price: 0.35,
      currency: "USD",
      reorder: 1000,
    },
  });
}

export function buildStockTemplateCsv(): Blob {
  return buildTemplateCsv(STOCK_IMPORT_COLUMNS);
}
