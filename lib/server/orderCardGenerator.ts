import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { calculateKashirovkaTotals } from "@/components/documents/work-order/types";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { telegramMessages, workOrders } from "@/db/schema";
import { getCompanyIdByCode } from "./crmService";
import { generateJobTicketPdf } from "./jobTicketPdfGenerator";

const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL ?? "http://localhost:8000";
const CARD_CACHE_DIR = path.join(process.cwd(), "public", "cache", "telegram", "order-cards");
const CARD_TIMEOUT_MS = 20_000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABELS: Record<string, string> = {
  Draft: "Qoralama",
  Active: "Faol",
  "On Hold": "To'xtatilgan",
  Completed: "Tayyor",
  Cancelled: "Bekor qilingan",
};

const STAGE_LABELS: Record<string, string> = {
  Queue: "Navbatda",
  "Ready to Print": "Bosmaga tayyor",
  "In Production": "Chop etilmoqda",
  "Post-press": "Ishlov",
  Packaging: "Qadoqlash",
  Completed: "Tayyor",
};

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** A stored thumbnail is only needed when the original file URL is missing. */
function pickArtwork(url?: string, thumb?: string): string | undefined {
  return str(url) || str(thumb);
}

/** "210g Kraft Paper" / "Coated Cardboard 300g/m²" -> 210 / 300 */
function gsmFromStock(stock?: string): number | undefined {
  const m = /(\d{2,4})\s*(?:g(?![a-z])|g\/m|gsm|гр)/i.exec(stock || "");
  return m ? Number(m[1]) : undefined;
}

function erpOrderUrl(docNo: string): string {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}?wo=${encodeURIComponent(docNo)}`;
}

/**
 * Maps a work order row (with its `dimensions` jsonb and `client`) to the
 * doc-service order card request.
 */
export const ORDER_CARD_LOGOS = ["printgoo", "label", "none"] as const;
export type OrderCardLogo = (typeof ORDER_CARD_LOGOS)[number];

export function parseOrderCardLogo(value: unknown): OrderCardLogo | undefined {
  return ORDER_CARD_LOGOS.includes(value as OrderCardLogo) ? (value as OrderCardLogo) : undefined;
}

/** Explicit choice, else the logo the order's Telegram card was last sent with. */
export function resolveOrderCardLogo(order: any, logo?: OrderCardLogo): OrderCardLogo {
  return logo ?? parseOrderCardLogo(order?.telegramMeta?.cardLogo) ?? "printgoo";
}

export function buildOrderCardPayload(order: any, customNote?: string, logo?: OrderCardLogo) {
  const dims = (order.dimensions || {}) as Record<string, any>;
  const colors = (order.colorsConfig || {}) as Record<string, any>;

  const kashMode = dims.kashirovkaMode || "none";
  const kashLayers: any[] = Array.isArray(dims.kashirovkaLayers) ? dims.kashirovkaLayers : [];
  const kashTotals =
    kashMode !== "none" && kashLayers.length
      ? calculateKashirovkaTotals(kashMode, kashLayers, Number(dims.kashirovkaGlueGsm) || undefined)
      : null;

  const skuArtworks = (Array.isArray(dims.skuArtworks) ? dims.skuArtworks : []).map((a: any) => ({
    skuId: a.skuId,
    model: a.model,
    sizeCode: a.sizeCode,
    frontArtworkUrl: pickArtwork(a.frontArtworkUrl, a.frontArtworkThumb),
    backArtworkUrl: pickArtwork(a.backArtworkUrl, a.backArtworkThumb),
  }));

  const sizes = (Array.isArray(dims.sizes) ? dims.sizes : []).map((s: any) => ({
    id: s.id != null ? String(s.id) : undefined,
    size: String(s.size ?? ""),
    sizeCode: s.sizeCode,
    model: s.model,
    quantity: Number(s.quantity) || 0,
  }));

  const termoRadius = num(dims.termoCornerRadius);

  return {
    docNo: order.docNo,
    clientName: order.client?.name || order.customerName || "Mijoz",
    productName: order.productName || undefined,
    itemCategory: str(dims.itemCategory) || str(order.productType),
    quantity: Number(order.quantity) || 0,
    unit: order.unit || "dona",
    orderDate: order.orderDate || undefined,
    deadline: order.deadline || undefined,
    statusLabel: STATUS_LABELS[order.status] || order.status || undefined,
    stageLabel: STAGE_LABELS[order.stage] || order.stage || undefined,

    width: num(dims.width),
    height: num(dims.height),
    bleed: Number(dims.bleed) || 0,
    shapeType: dims.shapeType || "rectangle",
    cornerType: dims.cornerType || "Square",
    cornerRadius: termoRadius,
    holeSize: Number(dims.holeSize) || 0,
    holePosition: dims.holePosition || "none",
    holeOffset: Number(dims.holeOffset) || 0,

    paperStock: order.paperStock || dims.paperStock || undefined,
    grammage: num(dims.paperDensity) ?? num(dims.grammage) ?? gsmFromStock(order.paperStock || dims.paperStock),
    targetGsm: num(dims.targetGsm),
    kashirovkaMode: kashMode,
    kashirovkaLayers: kashLayers.map((l) => ({
      label: l.label,
      paperStock: l.paperStock,
      grammage: Number(l.grammage) || 0,
      colors: l.colors,
    })),
    kashirovkaTotalGsm: kashTotals?.totalMountedGsm || undefined,

    colorsConfig: colors.formula || undefined,
    frontColors: colors.frontColors || undefined,
    backColors: colors.backColors || undefined,
    spotColorItems: (Array.isArray(colors.spotColorItems) ? colors.spotColorItems : []).map((s: any) => ({
      name: s.name || s.code || "",
      code: s.code,
      hex: s.hex,
      side: s.side,
    })),

    lamination: order.lamination || dims.lamination || undefined,
    laminationSides: dims.laminationSides || undefined,
    laminationMicron: num(dims.laminationMicron),
    coating: order.coating || dims.coating || undefined,
    coatingZone: str(dims.coatingZone),
    embellishment: order.embellishment || dims.embellishment || undefined,

    sizes,
    skuArtworks,
    artworkFront: str(dims.artworkFront),
    artworkBack: str(dims.artworkBack),

    notes: order.notes || undefined,
    customNote: customNote?.trim() || undefined,
    logo: resolveOrderCardLogo(order, logo),
    erpUrl: erpOrderUrl(order.docNo),
  };
}

type CardFormat = "png" | "both";

/** Renders the order card in doc-service. Throws when the service fails. */
async function renderOrderCard(
  order: any,
  customNote: string | undefined,
  format: CardFormat,
  logo?: OrderCardLogo
): Promise<{ png: Buffer; pdf?: Buffer }> {
  const payload = buildOrderCardPayload(order, customNote, logo);
  const res = await fetch(`${DOC_SERVICE_URL}/generate/pdf/order-card`, {
    method: "POST",
    signal: AbortSignal.timeout(CARD_TIMEOUT_MS),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, format }),
  });
  if (!res.ok) {
    throw new Error(`doc-service order-card ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  if (format === "png") return { png: Buffer.from(await res.arrayBuffer()) };
  const json = (await res.json()) as { png: string; pdf: string };
  return { png: Buffer.from(json.png, "base64"), pdf: Buffer.from(json.pdf, "base64") };
}

export async function renderOrderCardPng(order: any, customNote?: string, logo?: OrderCardLogo): Promise<Buffer> {
  return (await renderOrderCard(order, customNote, "png", logo)).png;
}

/** PNG preview for the send dialog, built from the saved order. */
export async function renderWorkOrderCardPreview(
  workOrderId: string,
  companyCode: string = "PRINTGOO",
  customNote?: string,
  logo?: OrderCardLogo
): Promise<Buffer | null> {
  const companyId = await getCompanyIdByCode(companyCode);
  const matchOrder = UUID_REGEX.test(workOrderId)
    ? or(eq(workOrders.id, workOrderId), eq(workOrders.docNo, workOrderId))
    : eq(workOrders.docNo, workOrderId);
  const order = await db.query.workOrders.findFirst({
    where: and(eq(workOrders.companyId, companyId), matchOrder),
    with: { client: true },
  });
  if (!order) return null;
  return renderOrderCardPng(order, customNote, logo);
}

/** File names served by the public PDF route: `{docNo}-{sha1 prefix}.pdf`. */
export const ORDER_CARD_PDF_NAME = /^[A-Za-z0-9_-]+-[a-f0-9]{20}\.pdf$/;

export function orderCardPdfPath(fileName: string): string | null {
  return ORDER_CARD_PDF_NAME.test(fileName) ? path.join(CARD_CACHE_DIR, fileName) : null;
}

/**
 * Absolute download link for Telegram. Telegram cannot open a local address,
 * so no link is produced while the ERP runs on localhost.
 */
function publicPdfLink(fileName: string): string | undefined {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(base) || /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(base)) return undefined;
  return `${base}/api/public/order-cards/${fileName}`;
}

export interface OrderCardMedia {
  buffer: Buffer;
  fileName: string;
  publicUrl: string;
  /** true for the PNG card; false when the PDF job ticket fallback was used */
  isPhoto: boolean;
  /** Public link to the vector PDF of the same card, when the ERP has a public URL */
  pdfUrl?: string;
}

const CARD_URL_PREFIX = "/cache/telegram/order-cards/";

/**
 * Keeps only the card that was just delivered for this order: older PNG/PDF
 * pairs are deleted, and ERP chat rows that showed an older card image are
 * pointed at the new one so the chat history keeps a picture.
 * Call it only after Telegram accepted the new card, so a failed send never
 * removes the files the existing message still links to.
 */
export async function retireOldOrderCards(order: any, media: OrderCardMedia): Promise<void> {
  if (!media.isPhoto || !media.publicUrl.startsWith(CARD_URL_PREFIX)) return;
  const keepPng = media.publicUrl.slice(CARD_URL_PREFIX.length);
  const keepStem = keepPng.replace(/\.png$/, "");
  const safeDocNo = String(order.docNo || "ZAKAZ").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ownFile = new RegExp(`^${safeDocNo.replace(/[-]/g, "\\-")}-[a-f0-9]{20}\\.(png|pdf)$`);

  try {
    if (order.id) {
      await db
        .update(telegramMessages)
        .set({ mediaUrl: media.publicUrl })
        .where(
          and(
            eq(telegramMessages.workOrderId, order.id),
            like(telegramMessages.mediaUrl, `${CARD_URL_PREFIX}${safeDocNo}-%`)
          )
        );
    }
  } catch (err) {
    // Keep the old files when chat rows could not be repointed
    console.warn("[orderCard] could not repoint chat media, keeping old cards:", err);
    return;
  }

  let names: string[] = [];
  try {
    names = await fs.promises.readdir(CARD_CACHE_DIR);
  } catch {
    return;
  }
  await Promise.all(
    names
      .filter((n) => ownFile.test(n) && !n.startsWith(`${keepStem}.`))
      .map((n) => fs.promises.unlink(path.join(CARD_CACHE_DIR, n)).catch(() => undefined))
  );
}

/**
 * Media for the Telegram orders group: the one-page PNG card plus its PDF, or
 * the PDF job ticket when doc-service cannot render the card.
 */
export async function generateOrderCardMedia(
  order: any,
  customNote?: string,
  logo?: OrderCardLogo
): Promise<OrderCardMedia> {
  const safeDocNo = String(order.docNo || "ZAKAZ").replace(/[^a-zA-Z0-9_-]/g, "_");
  try {
    const { png, pdf } = await renderOrderCard(order, customNote, "both", logo);
    if (!fs.existsSync(CARD_CACHE_DIR)) fs.mkdirSync(CARD_CACHE_DIR, { recursive: true });
    const hash = createHash("sha1").update(png).digest("hex").slice(0, 20);
    const pngName = `${safeDocNo}-${hash}.png`;
    fs.writeFileSync(path.join(CARD_CACHE_DIR, pngName), png);
    let pdfUrl: string | undefined;
    if (pdf?.length) {
      const pdfName = `${safeDocNo}-${hash}.pdf`;
      fs.writeFileSync(path.join(CARD_CACHE_DIR, pdfName), pdf);
      pdfUrl = publicPdfLink(pdfName);
    }
    return {
      buffer: png,
      fileName: `${safeDocNo}.png`,
      publicUrl: `/cache/telegram/order-cards/${pngName}`,
      isPhoto: true,
      pdfUrl,
    };
  } catch (err) {
    console.warn("[orderCard] PNG card failed, falling back to PDF job ticket:", err);
  }

  const dims = (order.dimensions || {}) as Record<string, any>;
  const pdf = await generateJobTicketPdf({
    docNo: order.docNo,
    clientName: order.client?.name || order.customerName || "Mijoz",
    productName: order.productName || "Poligrafiya mahsuloti",
    quantity: order.quantity,
    unit: order.unit,
    department: order.department,
    site: order.site || undefined,
    pressMachine: order.pressMachine || undefined,
    orderDate: order.orderDate || undefined,
    deadline: order.deadline || undefined,
    paperStock: order.paperStock || undefined,
    coating: order.coating || undefined,
    lamination: order.lamination || undefined,
    embellishment: order.embellishment || undefined,
    width: dims.width ? Number(dims.width) : undefined,
    height: dims.height ? Number(dims.height) : undefined,
    status: order.status,
    stage: order.stage,
    priority: order.priority,
    operations: order.operations || [],
    notes: order.notes || undefined,
  });
  return { buffer: pdf.buffer, fileName: pdf.fileName, publicUrl: pdf.publicUrl, isPhoto: false };
}
