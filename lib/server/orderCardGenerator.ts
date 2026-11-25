import fs from "fs";
import path from "path";
import { createHash } from "crypto";
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

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** ERP address the passport's QR code opens the order at (`{base}?wo={docNo}`). */
function erpBaseUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Header logos the Telegram send dialog offers; "none" prints the passport without one. */
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

/** BOM rows kept on the order (`dimensions.materials`) as the passport's material lines. */
function passportMaterials(order: any) {
  const dims = (order.dimensions || {}) as Record<string, any>;
  return (Array.isArray(dims.materials) ? dims.materials : [])
    .filter((m: any) => str(m?.name))
    .map((m: any) => {
      const spec = str(m.spec);
      const name = String(m.name).trim();
      return {
        name: spec && !name.includes(spec) ? `${name} • ${spec}` : name,
        req: Number(m.planQty) || Number(m.qty) || Number(m.quantity) || 0,
        unit: str(m.unit) || "dona",
        availability: str(m.availability),
      };
    });
}

/**
 * Maps a saved work order row to the doc-service job ticket request. `orderData`
 * has the same keys as the order screen's form: `dimensions` holds most of them,
 * the rest are columns of their own.
 */
export function buildJobTicketPayload(
  order: any,
  customNote?: string,
  logo?: OrderCardLogo,
  operations: PassportOperation[] = []
) {
  const dims = (order.dimensions || {}) as Record<string, any>;
  const colors = (order.colorsConfig || {}) as Record<string, any>;
  const attachments = (Array.isArray(order.attachments) ? order.attachments : []).map((a: any) => ({
    name: a.name,
    category: a.category,
    url: a.url,
    storagePath: a.storagePath,
    isImage: /^image\//.test(a.fileType || ""),
  }));

  return {
    docNo: order.docNo,
    orderData: {
      ...dims,
      customer: order.client?.name || order.customerName || "Mijoz",
      product: order.productName || undefined,
      itemCategory: str(dims.itemCategory) || str(order.productType),
      quantity: Number(order.quantity) || 0,
      unit: order.unit || "dona",
      department: order.department || undefined,
      site: order.site || undefined,
      pressMachine: order.pressMachine || undefined,
      priority: order.priority || undefined,
      status: STATUS_LABELS[order.status] || order.status || undefined,
      startDate: order.startDate || order.orderDate || undefined,
      deadline: order.deadline || undefined,
      recipe: order.recipeCode || undefined,
      paperStock: order.paperStock || dims.paperStock || undefined,
      coating: order.coating || dims.coating || undefined,
      lamination: order.lamination || dims.lamination || undefined,
      embellishment: order.embellishment || dims.embellishment || undefined,
      colorsConfig: colors.formula || undefined,
      frontColors: colors.frontColors || undefined,
      backColors: colors.backColors || undefined,
      spotColors: colors.spotColors || undefined,
      spotColorItems: colors.spotColorItems || undefined,
      notes: order.notes || undefined,
      // Readiness checks ticked on the order screen, with who verified them
      checks: order.checks || undefined,
      attachments,
      appUrl: erpBaseUrl(),
    },
    operations: operations.map((op) => ({
      stepNumber: op.stepNumber,
      name: op.name,
      machine: op.machine || "—",
      operator: op.operator || "—",
      plannedQty: op.plannedQty,
      planUnit: op.planUnit,
    })),
    materials: passportMaterials(order),
    customNote: customNote?.trim() || undefined,
    logo: resolveOrderCardLogo(order, logo),
  };
}

type CardFormat = "png" | "pdf" | "both";

/**
 * Renders the two-page passport (job ticket) in doc-service: the PDF, page 1 as a
 * PNG, or both. Throws when the service fails.
 */
async function renderOrderCard(
  order: any,
  customNote: string | undefined,
  format: CardFormat,
  logo?: OrderCardLogo
): Promise<{ png?: Buffer; pdf?: Buffer }> {
  const operations = await loadPassportRoute(order);
  const payload = buildJobTicketPayload(order, customNote, logo, operations);
  const res = await fetch(`${DOC_SERVICE_URL}/generate/pdf/job-ticket`, {
    method: "POST",
    signal: AbortSignal.timeout(CARD_TIMEOUT_MS),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, format }),
  });
  if (!res.ok) {
    throw new Error(`doc-service job-ticket ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
    with: { client: true, attachments: true },
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
