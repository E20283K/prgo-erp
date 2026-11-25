import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { calculateKashirovkaTotals } from "@/components/documents/work-order/types";
import { getCountingProfile, planInUnit } from "@/components/documents/work-order/utils/countingProfile";
import { resolveMachine } from "@/components/documents/work-order/utils/operationCost";
import { and, asc, eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { productionMachines, telegramMessages, workOrderOperations, workOrders } from "@/db/schema";
import { getCompanyIdByCode } from "./crmService";

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

const PACKAGING_STEP_RE = /qadoq|upakov|pack/i;

/** A route step as printed on the passport's production page. */
export interface PassportOperation {
  stepNumber: number;
  name: string;
  machine?: string;
  operator?: string;
  plannedQty?: number;
  planUnit?: string;
}

/**
 * The order's route with each step's plan in its own counting unit (sheets,
 * metres or pieces), the same figures the operator terminal shows.
 */
export async function loadPassportRoute(order: any): Promise<PassportOperation[]> {
  if (!order?.id) return [];
  const ops: any[] = Array.isArray(order.operations)
    ? [...order.operations].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
    : await db.query.workOrderOperations.findMany({
        where: eq(workOrderOperations.workOrderId, order.id),
        orderBy: [asc(workOrderOperations.sequence)],
      });
  if (!ops.length) return [];

  const machines = order.companyId
    ? await db.select().from(productionMachines).where(eq(productionMachines.companyId, order.companyId))
    : [];
  const dims = (order.dimensions || {}) as Record<string, any>;
  const orderPieces = Number(order.quantity) || 0;
  const itemsPerSheet = Number(dims.impositionState?.summary?.itemsPerSheet) || 0;

  return ops.map((op, idx) => {
    const machine = resolveMachine({ machine: op.machineStr, machineId: op.machineId }, machines as any[]) as any;
    const pieces = Number(op.plannedQty) || orderPieces;
    const base = {
      stepNumber: Number(op.sequence) || idx + 1,
      name: op.name || "",
      machine: str(op.machineStr) || machine?.name || undefined,
      operator: str(op.operator),
    };
    // Packing counts finished pieces whatever the department
    if (PACKAGING_STEP_RE.test(op.name || "")) {
      return { ...base, plannedQty: pieces || undefined, planUnit: order.unit || "dona" };
    }
    const profile = getCountingProfile({
      machineCategory: machine?.category,
      machineDepartment: machine?.department,
      orderDepartment: order.department,
      widthMm: Number(dims.width) || 0,
      heightMm: Number(dims.height) || 0,
      gapYMm: dims.flexoGapY ?? 3,
      lanes: dims.flexoLanes ?? 1,
      itemsPerSheet: itemsPerSheet || 1,
    });
    // A sheet plan needs the imposition; without it the plan is left for the planner to write in
    if (profile.kind === "sheet" && !itemsPerSheet) return base;
    return { ...base, plannedQty: planInUnit(pieces, profile) || undefined, planUnit: profile.unit };
  });
}

/** Production page figures kept on the order itself (imposition, BOM). */
function productionFields(order: any) {
  const dims = (order.dimensions || {}) as Record<string, any>;
  const imp = (dims.impositionState || {}) as Record<string, any>;
  const summary = (imp.summary || {}) as Record<string, any>;
  const materials = (Array.isArray(dims.materials) ? dims.materials : [])
    .filter((m: any) => str(m?.name))
    .map((m: any) => ({
      name: String(m.name).trim(),
      spec: str(m.spec),
      planQty: Number(m.planQty) || Number(m.qty) || Number(m.quantity) || 0,
      unit: str(m.unit),
    }));
  return {
    department: str(order.department),
    pressMachine: str(order.pressMachine),
    itemsPerSheet: num(summary.itemsPerSheet),
    pressSheets: num(summary.pressSheets),
    parentSheets: num(summary.parentSheets),
    forms: num(summary.forms),
    makeReadySheets: num(dims.kashirovkaMakeReadySheets),
    effectivePieces: num(imp.effectivePieces),
    plateCalculations: Array.isArray(imp.plateCalculations) ? imp.plateCalculations : [],
    materials,
  };
}

export function buildOrderCardPayload(
  order: any,
  customNote?: string,
  logo?: OrderCardLogo,
  operations: PassportOperation[] = []
) {
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

    ...productionFields(order),
    operations,
  };
}

type CardFormat = "png" | "pdf" | "both";

/**
 * Renders the passport in doc-service: page 1 is the order card (also the PNG),
 * page 2 the production sheet. Throws when the service fails.
 */
async function renderOrderCard(
  order: any,
  customNote: string | undefined,
  format: CardFormat,
  logo?: OrderCardLogo
): Promise<{ png?: Buffer; pdf?: Buffer }> {
  const pages = format === "png" ? 1 : 2;
  const operations = pages === 2 ? await loadPassportRoute(order) : [];
  const payload = buildOrderCardPayload(order, customNote, logo, operations);
  const res = await fetch(`${DOC_SERVICE_URL}/generate/pdf/order-card`, {
    method: "POST",
    signal: AbortSignal.timeout(CARD_TIMEOUT_MS),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, format, pages }),
  });
  if (!res.ok) {
    throw new Error(`doc-service order-card ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  if (format === "png") return { png: Buffer.from(await res.arrayBuffer()) };
  if (format === "pdf") return { pdf: Buffer.from(await res.arrayBuffer()) };
  const json = (await res.json()) as { png: string; pdf: string };
  return { png: Buffer.from(json.png, "base64"), pdf: Buffer.from(json.pdf, "base64") };
}

async function findSavedOrder(workOrderId: string, companyCode: string) {
  const companyId = await getCompanyIdByCode(companyCode);
  const matchOrder = UUID_REGEX.test(workOrderId)
    ? or(eq(workOrders.id, workOrderId), eq(workOrders.docNo, workOrderId))
    : eq(workOrders.docNo, workOrderId);
  return db.query.workOrders.findFirst({
    where: and(eq(workOrders.companyId, companyId), matchOrder),
    with: { client: true },
  });
}

/** PNG preview of page 1 for the send dialog, built from the saved order. */
export async function renderWorkOrderCardPreview(
  workOrderId: string,
  companyCode: string = "PRINTGOO",
  customNote?: string,
  logo?: OrderCardLogo
): Promise<Buffer | null> {
  const order = await findSavedOrder(workOrderId, companyCode);
  if (!order) return null;
  return (await renderOrderCard(order, customNote, "png", logo)).png ?? null;
}

/** The two-page passport PDF (Ctrl+P): the same file the Telegram group receives. */
export async function renderWorkOrderPassportPdf(
  workOrderId: string,
  companyCode: string = "PRINTGOO",
  logo?: OrderCardLogo
): Promise<{ pdf: Buffer; docNo: string } | null> {
  const order = await findSavedOrder(workOrderId, companyCode);
  if (!order) return null;
  const { pdf } = await renderOrderCard(order, undefined, "pdf", resolveOrderCardLogo(order, logo));
  if (!pdf?.length) throw new Error("doc-service bo'sh PDF qaytardi");
  return { pdf, docNo: order.docNo };
}

/** File names served by the public PDF route: `{docNo}-{sha1 prefix}.pdf`. */
export const ORDER_CARD_PDF_NAME = /^[A-Za-z0-9_-]+-[a-f0-9]{20}\.pdf$/;

export function orderCardPdfPath(fileName: string): string | null {
  return ORDER_CARD_PDF_NAME.test(fileName) ? path.join(CARD_CACHE_DIR, fileName) : null;
}

export interface OrderCardMedia {
  /** Page 1 of the passport as a PNG, sent as the card photo */
  buffer: Buffer;
  fileName: string;
  publicUrl: string;
  isPhoto: boolean;
  /** The two-page passport PDF, sent as a reply document under the photo */
  pdfBuffer: Buffer;
  pdfFileName: string;
  pdfPublicUrl: string;
}

const CARD_URL_PREFIX = "/cache/telegram/order-cards/";

/**
 * Keeps only the passport that was just delivered for this order: older PNG/PDF
 * pairs are deleted, and ERP chat rows that showed an older card image or PDF
 * are pointed at the new files so the chat history keeps working.
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
      for (const [ext, url] of [
        ["png", media.publicUrl],
        ["pdf", media.pdfPublicUrl],
      ] as const) {
        await db
          .update(telegramMessages)
          .set({ mediaUrl: url })
          .where(
            and(
              eq(telegramMessages.workOrderId, order.id),
              like(telegramMessages.mediaUrl, `${CARD_URL_PREFIX}${safeDocNo}-%.${ext}`)
            )
          );
      }
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
 * Media for the Telegram orders group: page 1 of the passport as a PNG photo
 * and the whole two-page passport PDF. Throws when doc-service cannot render it.
 */
export async function generateOrderCardMedia(
  order: any,
  customNote?: string,
  logo?: OrderCardLogo
): Promise<OrderCardMedia> {
  const safeDocNo = String(order.docNo || "ZAKAZ").replace(/[^a-zA-Z0-9_-]/g, "_");
  const { png, pdf } = await renderOrderCard(order, customNote, "both", logo);
  if (!png?.length || !pdf?.length) throw new Error("doc-service bo'sh karta qaytardi");
  if (!fs.existsSync(CARD_CACHE_DIR)) fs.mkdirSync(CARD_CACHE_DIR, { recursive: true });
  const hash = createHash("sha1").update(png).update(pdf).digest("hex").slice(0, 20);
  const pngName = `${safeDocNo}-${hash}.png`;
  const pdfName = `${safeDocNo}-${hash}.pdf`;
  fs.writeFileSync(path.join(CARD_CACHE_DIR, pngName), png);
  fs.writeFileSync(path.join(CARD_CACHE_DIR, pdfName), pdf);
  return {
    buffer: png,
    fileName: `${safeDocNo}.png`,
    publicUrl: `${CARD_URL_PREFIX}${pngName}`,
    isPhoto: true,
    pdfBuffer: pdf,
    pdfFileName: `Ish_pasporti_${safeDocNo}.pdf`,
    pdfPublicUrl: `${CARD_URL_PREFIX}${pdfName}`,
  };
}
