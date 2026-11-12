/**
 * Ombor chiqimi (Shipment) dvigateli: holat mashinasi, rezervatsiya va qoldiq registrlari.
 *
 * Fazalar:
 *   free     — Draft, Cancelled            (qoldiqqa ta'sir yo'q)
 *   holding  — Reserved, Picking, Packed   (qoldiq band qilingan: reserved += qty)
 *   posted   — Dispatched, In Transit, Delivered (qoldiq yechilgan: onHand -= qty)
 *
 * Hisoblar (qator darajasida):
 *   2910 — trading_catalog.stock_qty / reserved_qty
 *   2810 — warehouse_finished_goods.quantity / reserved_quantity (+ stock_balances ko'zgusi)
 *   1010 — warehouse_stock_balances.stock_level / reserved (ombor nomi bo'yicha)
 *
 * Barcha funksiyalar `exec` (db yoki tranzaksiya) qabul qiladi; qatorlar FOR UPDATE bilan qulflanadi.
 */
import type { DbExec } from "@/db";
import {
  tradingCatalog,
  warehouseFinishedGoods,
  warehouseStockBalances,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type { DbExec };

export type ShipmentStatus =
  | "Draft"
  | "Reserved"
  | "Picking"
  | "Packed"
  | "Dispatched"
  | "In Transit"
  | "Delivered"
  | "Cancelled";

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "Draft",
  "Reserved",
  "Picking",
  "Packed",
  "Dispatched",
  "In Transit",
  "Delivered",
  "Cancelled",
];

export type ShipmentPhase = "free" | "holding" | "posted";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** HTTP status bilan biznes xatosi (API route uni to'g'ridan-to'g'ri qaytaradi) */
export class ShipmentError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: 409 | 422 = 422
  ) {
    super(message);
    this.name = "ShipmentError";
  }
}

export function phaseOf(status: string | null | undefined): ShipmentPhase {
  if (status === "Reserved" || status === "Picking" || status === "Packed") return "holding";
  if (status === "Dispatched" || status === "In Transit" || status === "Delivered") return "posted";
  return "free";
}

/** Ruxsat etilgan holat o'tishlari. Bir xil holatda qayta saqlash har doim ruxsat. */
export const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Draft: ["Reserved", "Picking", "Packed", "Dispatched", "Cancelled"],
  Reserved: ["Draft", "Picking", "Packed", "Dispatched", "Cancelled"],
  Picking: ["Draft", "Reserved", "Packed", "Dispatched", "Cancelled"],
  Packed: ["Draft", "Reserved", "Picking", "Dispatched", "Cancelled"],
  // Dispatched/In Transit dan holding/Cancelled ga o'tish = storno
  Dispatched: ["In Transit", "Delivered", "Packed", "Reserved", "Draft", "Cancelled"],
  "In Transit": ["Delivered", "Dispatched", "Packed", "Reserved", "Draft", "Cancelled"],
  // Yetkazilgan hujjat yakuniy: qaytarish faqat alohida qaytarish hujjati orqali
  Delivered: [],
  Cancelled: ["Draft"],
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  Draft: "Qoralama",
  Reserved: "Band qilingan",
  Picking: "Terilmoqda",
  Packed: "Qadoqlangan",
  Dispatched: "Jo'natilgan",
  "In Transit": "Yo'lda",
  Delivered: "Yetkazilgan",
  Cancelled: "Bekor qilingan",
};

export function normalizeStatus(raw: unknown): ShipmentStatus {
  const s = String(raw || "Draft");
  if ((SHIPMENT_STATUSES as string[]).includes(s)) return s as ShipmentStatus;
  if (s === "InTransit") return "In Transit";
  throw new ShipmentError(`Noma'lum chiqim holati: "${s}"`);
}

export function assertTransition(from: ShipmentStatus, to: ShipmentStatus) {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ShipmentError(
      `"${STATUS_LABELS[from]}" holatidan "${STATUS_LABELS[to]}" holatiga o'tib bo'lmaydi.`,
      409
    );
  }
}

// ─── Qatorlar ───────────────────────────────────────────────────────────────

export type ShipmentAccount = "1010" | "2810" | "2910";

export interface ShipmentStockLine {
  finishedGoodId?: string | null;
  tradingCatalogId?: string | null;
  accountCode?: string | null;
  sourceWorkOrderId?: string | null;
  sku: string;
  name: string;
  quantity: number;
  unit?: string | null;
}

/** Hisobni aniqlash: aniq kod > 2910 katalog > 2810 FG > chiqim turi */
export function resolveShipmentAccount(
  item: { accountCode?: string | null; tradingCatalogId?: string | null; finishedGoodId?: string | null },
  shipmentType: string
): ShipmentAccount {
  const code = String(item.accountCode || "");
  if (code === "1010" || code === "2810" || code === "2910") return code;
  if (item.tradingCatalogId) return "2910";
  if (item.finishedGoodId) return "2810";
  return shipmentType === "CustomerDelivery" ? "2810" : "1010";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeShipmentLines(itemsList: any[], defaults: { workOrderId?: string | null }): ShipmentStockLine[] {
  return itemsList.map((item) => ({
    finishedGoodId: item.finishedGoodId || null,
    tradingCatalogId: item.tradingCatalogId || null,
    accountCode: item.accountCode || null,
    sourceWorkOrderId: item.sourceWorkOrderId || defaults.workOrderId || null,
    sku: String(item.sku || "").trim(),
    name: item.name || item.product || "Mahsulot",
    quantity: Number(item.quantity ?? item.shippedQty) || 0,
    unit: item.unit || null,
  }));
}

// ─── Qoldiq "dastaklari" (locked handles) ─────────────────────────────────────

type StockHandle =
  | {
      kind: "catalog";
      key: string;
      account: "2910";
      label: string;
      unit: string;
      row: typeof tradingCatalog.$inferSelect;
    }
  | {
      kind: "fg";
      key: string;
      account: "2810";
      label: string;
      unit: string;
      row: typeof warehouseFinishedGoods.$inferSelect;
    }
  | {
      kind: "balance";
      key: string;
      account: "1010";
      label: string;
      unit: string;
      row: typeof warehouseStockBalances.$inferSelect;
    };

interface ResolvedLine {
  line: ShipmentStockLine;
  account: ShipmentAccount;
  handle: StockHandle | null;
}

async function lockCatalog(exec: DbExec, companyId: string, line: ShipmentStockLine) {
  if (line.tradingCatalogId && UUID_RE.test(line.tradingCatalogId)) {
    const [byId] = await exec
      .select()
      .from(tradingCatalog)
      .where(and(eq(tradingCatalog.companyId, companyId), eq(tradingCatalog.id, line.tradingCatalogId)))
      .for("update")
      .limit(1);
    if (byId) return byId;
  }
  // Savdo stikeri tradingCatalogId sifatida SKU yuborishi mumkin
  const skuKey = line.sku || (line.tradingCatalogId && !UUID_RE.test(line.tradingCatalogId) ? line.tradingCatalogId : "");
  if (!skuKey) return null;
  const [bySku] = await exec
    .select()
    .from(tradingCatalog)
    .where(and(eq(tradingCatalog.companyId, companyId), eq(tradingCatalog.sku, skuKey)))
    .for("update")
    .limit(1);
  return bySku || null;
}

async function lockFinishedGood(exec: DbExec, companyId: string, line: ShipmentStockLine) {
  if (line.finishedGoodId && UUID_RE.test(line.finishedGoodId)) {
    const [byId] = await exec
      .select()
      .from(warehouseFinishedGoods)
      .where(and(eq(warehouseFinishedGoods.companyId, companyId), eq(warehouseFinishedGoods.id, line.finishedGoodId)))
      .for("update")
      .limit(1);
    if (byId) return byId;
  }
  if (!line.sku) return null;
  const candidates = await exec
    .select()
    .from(warehouseFinishedGoods)
    .where(
      and(
        eq(warehouseFinishedGoods.companyId, companyId),
        eq(warehouseFinishedGoods.sku, line.sku),
        eq(warehouseFinishedGoods.receiptStatus, "Received")
      )
    )
    .for("update");
  if (candidates.length === 0) return null;
  return candidates.find((fg) => line.sourceWorkOrderId && fg.workOrderId === line.sourceWorkOrderId) || candidates[0];
}

async function lockBalance(exec: DbExec, companyId: string, locationName: string, sku: string) {
  if (!sku) return null;
  const [row] = await exec
    .select()
    .from(warehouseStockBalances)
    .where(
      and(
        eq(warehouseStockBalances.companyId, companyId),
        eq(warehouseStockBalances.locationName, locationName),
        eq(warehouseStockBalances.sku, sku)
      )
    )
    .for("update")
    .limit(1);
  return row || null;
}

async function resolveLines(
  exec: DbExec,
  companyId: string,
  lines: ShipmentStockLine[],
  fromLocationName: string,
  shipmentType: string
): Promise<ResolvedLine[]> {
  const out: ResolvedLine[] = [];
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const account = resolveShipmentAccount(line, shipmentType);
    let handle: StockHandle | null = null;
    if (account === "2910") {
      const row = await lockCatalog(exec, companyId, line);
      if (row) handle = { kind: "catalog", key: `2910:${row.id}`, account, label: `${row.sku} — ${row.name}`, unit: row.unit || "", row };
    } else if (account === "2810") {
      const row = await lockFinishedGood(exec, companyId, line);
      if (row) handle = { kind: "fg", key: `2810:${row.id}`, account, label: `${row.sku} — ${row.productName}`, unit: row.unit || "", row };
    } else {
      const row = await lockBalance(exec, companyId, fromLocationName, line.sku);
      if (row) handle = { kind: "balance", key: `1010:${row.id}`, account, label: `${row.sku} — ${row.name}`, unit: row.unit || "", row };
    }
    out.push({ line, account, handle });
  }
  return out;
}

function onHandOf(h: StockHandle): number {
  if (h.kind === "catalog") return Number(h.row.stockQty) || 0;
  if (h.kind === "fg") return Number(h.row.quantity) || 0;
  return Number(h.row.stockLevel) || 0;
}

function reservedOf(h: StockHandle): number {
  if (h.kind === "catalog") return Number(h.row.reservedQty) || 0;
  if (h.kind === "fg") return Number(h.row.reservedQuantity) || 0;
  return Number(h.row.reserved) || 0;
}

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/** Qatorlarni dastak bo'yicha yig'ish; topilmaganlarini alohida qaytarish */
function aggregate(resolved: ResolvedLine[]) {
  const byKey = new Map<string, { handle: StockHandle; qty: number }>();
  const missing: ResolvedLine[] = [];
  for (const r of resolved) {
    if (!r.handle) {
      missing.push(r);
      continue;
    }
    const prev = byKey.get(r.handle.key);
    byKey.set(r.handle.key, { handle: r.handle, qty: (prev?.qty || 0) + r.line.quantity });
  }
  return { groups: Array.from(byKey.values()), missing };
}

function missingMessage(r: ResolvedLine, fromLocationName: string) {
  const where =
    r.account === "2910"
      ? "aksessuarlar katalogida (2910)"
      : r.account === "2810"
      ? "tayyor mahsulot omborida (2810, qabul qilingan)"
      : `"${fromLocationName}" omborida (1010)`;
  return `${r.line.sku || "SKU yo'q"} — ${r.line.name}: ${where} topilmadi`;
}

function stockStatusFor(level: number, available: number, reorder: number) {
  if (level <= 0) return "Out of Stock" as const;
  if (available <= reorder * 0.3) return "Critical" as const;
  if (available <= reorder) return "Low Stock" as const;
  return "In Stock" as const;
}

async function writeHandle(exec: DbExec, h: StockHandle, onHand: number, reserved: number) {
  const now = new Date();
  if (h.kind === "catalog") {
    await exec
      .update(tradingCatalog)
      .set({ stockQty: onHand.toString(), reservedQty: reserved.toString(), updatedAt: now })
      .where(eq(tradingCatalog.id, h.row.id));
    h.row = { ...h.row, stockQty: onHand.toString(), reservedQty: reserved.toString() };
  } else if (h.kind === "fg") {
    const free = onHand - reserved;
    const status = onHand <= 0 ? "Shipped" : reserved > 0 && free <= 0 ? "Reserved" : "In Stock";
    await exec
      .update(warehouseFinishedGoods)
      .set({ quantity: onHand.toString(), reservedQuantity: reserved.toString(), status, updatedAt: now })
      .where(eq(warehouseFinishedGoods.id, h.row.id));
    h.row = { ...h.row, quantity: onHand.toString(), reservedQuantity: reserved.toString(), status };
  } else {
    const available = Math.max(0, onHand - reserved);
    const status = stockStatusFor(onHand, available, Number(h.row.reorder) || 0);
    await exec
      .update(warehouseStockBalances)
      .set({
        stockLevel: onHand.toString(),
        reserved: reserved.toString(),
        available: available.toString(),
        status,
        updatedAt: now,
      })
      .where(eq(warehouseStockBalances.id, h.row.id));
    h.row = { ...h.row, stockLevel: onHand.toString(), reserved: reserved.toString(), available: available.toString(), status };
  }
}

export interface StockOpContext {
  companyId: string;
  fromLocationName: string;
  shipmentType: string;
}

/**
 * Rezerv qo'yish (+1) yoki bo'shatish (-1).
 * Qo'yishda bo'sh qoldiq (onHand - reserved) yetarli bo'lmasa — hech narsa yozilmasdan xato.
 */
export async function reserveLines(exec: DbExec, ctx: StockOpContext, lines: ShipmentStockLine[], direction: 1 | -1) {
  const resolved = await resolveLines(exec, ctx.companyId, lines, ctx.fromLocationName, ctx.shipmentType);
  const { groups, missing } = aggregate(resolved);

  if (direction === 1) {
    const problems: string[] = missing.map((m) => missingMessage(m, ctx.fromLocationName));
    for (const g of groups) {
      const free = onHandOf(g.handle) - reservedOf(g.handle);
      if (g.qty > free + 1e-9) {
        problems.push(`${g.handle.label}: kerak ${fmt(g.qty)}, bo'sh qoldiq ${fmt(Math.max(0, free))} ${g.handle.unit}`.trim());
      }
    }
    if (problems.length > 0) throw new ShipmentError(`Zaxirani band qilib bo'lmadi. ${problems.join("; ")}`, 409);
  }

  for (const g of groups) {
    const nextReserved = Math.max(0, reservedOf(g.handle) + direction * g.qty);
    await writeHandle(exec, g.handle, onHandOf(g.handle), nextReserved);
  }
}

/**
 * Qoldiqdan yechish (-1, o'tkazish) yoki qaytarish (+1, storno).
 * Yechishda bo'sh qoldiq (onHand - reserved) yetarli bo'lmasa — xato. Shuning uchun
 * holding → posted o'tishida avval rezerv bo'shatiladi, keyin yechiladi.
 */
export async function postLines(exec: DbExec, ctx: StockOpContext, lines: ShipmentStockLine[], direction: 1 | -1) {
  const resolved = await resolveLines(exec, ctx.companyId, lines, ctx.fromLocationName, ctx.shipmentType);
  const { groups, missing } = aggregate(resolved);

  if (direction === -1) {
    const problems: string[] = missing.map((m) => missingMessage(m, ctx.fromLocationName));
    for (const g of groups) {
      const free = onHandOf(g.handle) - reservedOf(g.handle);
      if (g.qty > free + 1e-9) {
        problems.push(`${g.handle.label}: kerak ${fmt(g.qty)}, mavjud ${fmt(Math.max(0, free))} ${g.handle.unit}`.trim());
      }
    }
    if (problems.length > 0) throw new ShipmentError(`Qoldiq yetarli emas. ${problems.join("; ")}`, 409);
  }

  for (const g of groups) {
    const nextOnHand = Math.max(0, onHandOf(g.handle) + direction * g.qty);
    await writeHandle(exec, g.handle, nextOnHand, reservedOf(g.handle));

    // 2810: FG qabul qilinganda stock_balances ga ham yozilgan — ko'zgu qatori mavjud bo'lsa sinxronlaymiz
    if (g.handle.kind === "fg") {
      const fg = g.handle.row;
      const mirror = await lockBalance(exec, ctx.companyId, fg.locationName || "Tayyor mahsulotlar ombori", fg.sku);
      if (mirror) {
        const h: StockHandle = { kind: "balance", key: `1010:${mirror.id}`, account: "1010", label: fg.sku, unit: mirror.unit, row: mirror };
        await writeHandle(exec, h, Math.max(0, onHandOf(h) + direction * g.qty), reservedOf(h));
      }
    }
  }
}

/** O'tishdan oldingi asosiy validatsiya (qatorlar, miqdor) */
export function assertLinesValid(lines: ShipmentStockLine[]) {
  if (lines.length === 0) {
    throw new ShipmentError("Chiqim hujjatida mahsulot qatorlari yo'q. Kamida bitta qator qo'shing.");
  }
  const bad = lines.filter((l) => !(l.quantity > 0));
  if (bad.length > 0) {
    throw new ShipmentError(
      `Miqdor 0 dan katta bo'lishi kerak: ${bad.map((b) => b.sku || b.name).join(", ")}`
    );
  }
}
