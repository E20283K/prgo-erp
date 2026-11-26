/**
 * Tayyor mahsulot boshlang'ich qoldig'ini Excel/CSV fayldan import qilish.
 * Har qator FgOpeningBalanceDialog bilan bir xil yozuv: workOrderId = OB-<SKU>.
 * Server tomoni: POST /api/v1/warehouse/finished-goods/import (warehouseService → importFinishedGoodsOpening)
 */
import {
  buildTemplateCsv,
  buildTemplateXlsx,
  mapHeaders,
  matchOption,
  norm,
  parseNumber,
  type ImportColumnDef,
  type ImportOption,
  type ImportPreviewRow,
  type ImportValidation,
  type RawTable,
} from "./tableImport";

export type FgImportField =
  | "sku"
  | "customerName"
  | "productName"
  | "quantity"
  | "unit"
  | "costPricePerUnit"
  | "locationName"
  | "locationShelf"
  | "batchNo"
  | "notes";

export const FG_IMPORT_COLUMNS: ImportColumnDef<FgImportField>[] = [
  { key: "sku", header: "SKU", width: 16, aliases: ["sku", "artikul", "kod", "code"] },
  { key: "customerName", header: "Mijoz", required: true, width: 28, aliases: ["mijoz", "buyurtmachi", "customer", "client", "buyurtmachi (mijoz)"] },
  { key: "productName", header: "Mahsulot nomi", required: true, width: 36, aliases: ["mahsulot nomi", "mahsulot", "nomi", "product", "product name", "tayyor mahsulot nomi"] },
  { key: "quantity", header: "Miqdor", required: true, numeric: true, width: 12, aliases: ["miqdor", "qoldiq", "soni", "quantity", "qty", "stock"] },
  { key: "unit", header: "Birlik", width: 10, aliases: ["birlik", "unit", "o'lchov birligi"] },
  { key: "costPricePerUnit", header: "Tannarx", numeric: true, width: 12, aliases: ["tannarx", "narx", "tannarx (1 birlik)", "cost", "unit cost", "price"] },
  { key: "locationName", header: "Ombor", width: 24, aliases: ["ombor", "location", "warehouse", "joylashuv"] },
  { key: "locationShelf", header: "Javon", width: 12, aliases: ["javon", "katak", "shelf", "bin"] },
  { key: "batchNo", header: "Partiya", width: 14, aliases: ["partiya", "batch", "batchno", "lot"] },
  { key: "notes", header: "Izoh", width: 28, aliases: ["izoh", "notes", "note", "comment"] },
];

export const FG_UNIT_OPTIONS: ImportOption[] = [
  { value: "pcs", label: "dona", aliases: ["dona", "pcs", "pc", "piece", "pieces", "sht"] },
  { value: "kg", label: "kg", aliases: ["kg", "kilogramm", "kilogram"] },
  { value: "rolls", label: "rulon", aliases: ["rulon", "roll", "rolls"] },
  { value: "m²", label: "m²", aliases: ["m²", "m2", "kv.m", "kvm", "sqm"] },
];

/** Tayyor mahsulot omborlari; bunday ombor bo'lmasa hammasi (FgOpeningBalanceDialog bilan bir xil qoida) */
export function pickFgWarehouses<T extends { type?: unknown; code?: unknown }>(all: T[]): T[] {
  const fg = all.filter((w) => /finished/i.test(String(w.type || "")) || /^WH-FG/i.test(String(w.code || "")));
  return fg.length > 0 ? fg : all;
}

export interface ParsedFgRow {
  rowNo: number;
  sku?: string;
  customerName: string;
  clientId?: string;
  productName: string;
  quantity: number;
  unit: string;
  costPricePerUnit?: number;
  locationName?: string;
  locationShelf?: string;
  batchNo?: string;
  notes?: string;
}

export type ValidatedFgRow = ImportPreviewRow<ParsedFgRow>;

export const openingWorkOrderId = (sku: string) => `OB-${sku}`;

export function validateFgRows(
  table: RawTable,
  ctx: {
    customers: { name: string; dbId?: string | null }[];
    warehouses: { name: string }[];
    finishedGoods: { sku?: string; workOrderId?: string }[];
  }
): ImportValidation<ParsedFgRow> {
  const [headerRow = [], ...body] = table;
  const { missingHeaders, getter } = mapHeaders(headerRow, FG_IMPORT_COLUMNS);
  if (missingHeaders.length > 0) return { rows: [], missingHeaders };

  const customers = new Map(ctx.customers.filter((c) => c?.name).map((c) => [norm(c.name), c]));
  const whNames = new Map(ctx.warehouses.map((w) => [norm(w.name), w.name]));
  const seen = new Set<string>();
  const rows: ValidatedFgRow[] = [];

  body.forEach((cells, i) => {
    const get = getter(cells);
    if (FG_IMPORT_COLUMNS.every((c) => !get(c.key))) return; // bo'sh qator

    const rowNo = i + 2;
    const errors: string[] = [];
    const flags: string[] = [];

    const customerRaw = get("customerName");
    const customer = customers.get(norm(customerRaw));
    if (!customerRaw) errors.push("Mijoz bo'sh");
    else if (!customer) flags.push("Yangi mijoz");

    const productName = get("productName");
    if (!productName) errors.push("Mahsulot nomi bo'sh");

    const qty = parseNumber(get("quantity"));
    if (qty === undefined) errors.push("Miqdor bo'sh");
    else if (Number.isNaN(qty) || qty <= 0) errors.push("Miqdor noldan katta bo'lishi kerak");

    const cost = parseNumber(get("costPricePerUnit"));
    if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) errors.push("Tannarx: noto'g'ri son");

    const unitRaw = get("unit");
    const unit = unitRaw ? matchOption(unitRaw, FG_UNIT_OPTIONS) : "pcs";
    if (!unit) errors.push(`Birlik noma'lum: ${unitRaw}`);

    const locationRaw = get("locationName");
    let locationName: string | undefined;
    if (locationRaw) {
      locationName = whNames.get(norm(locationRaw));
      if (!locationName && ctx.warehouses.length > 0) errors.push(`Ombor topilmadi: ${locationRaw}`);
      if (!locationName && ctx.warehouses.length === 0) locationName = locationRaw;
    }

    const sku = get("sku") || undefined;
    let action: "create" | "update" = "create";
    if (sku) {
      if (seen.has(sku)) errors.push("Faylda takroriy SKU");
      seen.add(sku);
      const sameSku = ctx.finishedGoods.filter((g) => g.sku === sku);
      if (sameSku.some((g) => g.workOrderId === openingWorkOrderId(sku))) action = "update";
      else if (sameSku.length > 0) errors.push("SKU ishlab chiqarish zaxirasiga tegishli");
    }

    rows.push({
      rowNo,
      errors,
      flags,
      action,
      data: {
        rowNo,
        sku,
        customerName: customer?.name || customerRaw,
        clientId: customer?.dbId || undefined,
        productName,
        quantity: qty && !Number.isNaN(qty) ? qty : 0,
        unit: unit || unitRaw,
        costPricePerUnit: cost !== undefined && !Number.isNaN(cost) ? cost : undefined,
        locationName,
        locationShelf: get("locationShelf") || undefined,
        batchNo: get("batchNo") || undefined,
        notes: get("notes") || undefined,
      },
    });
  });

  return { rows, missingHeaders: [] };
}

export function buildFgTemplateXlsx(ctx: { customers: { name: string }[]; warehouses: { name: string }[] }): Promise<Blob> {
  const whList = ctx.warehouses.length > 0 ? ctx.warehouses.map((w) => w.name) : ["Tayyor mahsulot ombori"];
  const customerList = Array.from(new Set(ctx.customers.map((c) => c.name).filter(Boolean)));
  return buildTemplateXlsx({
    sheetName: "Tayyor mahsulot",
    columns: FG_IMPORT_COLUMNS,
    lists: [
      // Mijoz ro'yxati faqat taklif: yangi mijoz nomini ham yozish mumkin
      { key: "customerName", title: "Mijoz", values: customerList, strict: false },
      { key: "unit", title: "Birlik", values: FG_UNIT_OPTIONS.map((o) => o.label) },
      { key: "locationName", title: "Ombor", values: whList },
    ],
    sample: {
      customerName: customerList[0] || "Mijoz nomi",
      productName: "Etiketka 50x30 mm",
      quantity: 10000,
      unit: "dona",
      costPricePerUnit: 120,
      locationName: whList[0],
      locationShelf: "A-01",
      notes: "Boshlang'ich qoldiq",
    },
  });
}

export function buildFgTemplateCsv(): Blob {
  return buildTemplateCsv(FG_IMPORT_COLUMNS);
}
