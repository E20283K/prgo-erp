
export function normalizePermanentMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/api/v1/storage/file")) {
    return url;
  }
  if (url.includes(":9000/") || url.includes("X-Amz-Signature") || url.includes("printgoo-prepress")) {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `http://localhost:9000${url.startsWith("/") ? "" : "/"}${url}`);
      let key = parsed.pathname.replace(/^\/+/, "");
      if (key.startsWith("printgoo-prepress/")) {
        key = key.replace(/^printgoo-prepress\//, "");
      }
      return `/api/v1/storage/file?path=${encodeURIComponent(key)}`;
    } catch (_) {}
    const clean = url.split("?")[0].replace(/^.*?(PRINTGOO\/.*)$/, "$1");
    return `/api/v1/storage/file?path=${encodeURIComponent(clean)}`;
  }
  return url;
}

import { db, type DbExec } from "@/db";
import {
  workOrders,
  workOrderOperations,
  workOrderEvents,
  workOrderAttachments,
  productionMachines,
  productionSpecifications,
  branches,
  companies,
  clients,
  deliveryActs,
  deliveryActItems,
  supplierOrders,
  productTypes,
  warehouseShipments,
  warehouseShipmentItems,
  warehouseFinishedGoods,
} from "@/db/schema";
import { eq, desc, and, or, ilike, isNull, sql, inArray } from "drizzle-orm";
import type { ProductionQueueItem } from "@/store/workspaceStore";
import type { WorkOrderFormData, RouteStep } from "@/components/documents/work-order/types";
import { getCompanyIdByCode, resolveClient, unknownClientMessage } from "./crmService";
import { syncOrderStageFromSteps, syncStepFromJournal, toShiftEvent } from "./workOrderEventService";
import type { ShiftEvent } from "@/components/documents/work-order/types";
import type { MachineRecord } from "@/components/documents/machine/types";
import { freezeMachineRates, type FrozenCostRates } from "@/components/documents/work-order/utils/operationCost";
import { generateNextCode } from "@/lib/utils";
import { applySupplierOrders, type ToolingOrderLink } from "@/components/documents/work-order/toolingItems";
import { deriveWorkOrderStatus, type WorkOrderStatus } from "@/lib/workOrderStatus";
import { getNextSpecNumber, lockNumbering } from "./numberingService";
import { getClientCreditState } from "./financeService";
import { canOverrideCreditHold } from "@/lib/userRole";
import { emitNotification } from "./notificationService";
import {
  normalizeDepartment,
  WO_DEPT_PREFIXES,
  getCurrentYearSuffix,
  formatWorkOrderNo,
} from "@/components/documents/work-order/utils/workOrderNumbering";
import {
  computeAndRecordWorkOrderDiffs,
  recordWorkOrderAuditLog,
} from "./workOrderAuditService";
import { s3Client, S3_BUCKETS, deleteStorageObject } from "@/lib/server/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  updateTelegramOrderCardStatus,
  sendWorkOrderToOrdersGroup,
} from "./telegramService";

const SHEET_IMPOSITION_PREFIX = "/api/sheet-imposition/";

/** doc-service imposition keshidagi (flexo yoki varaqli montaj) vaqtinchalik fayl havolasimi? */
export function isCachedImpositionUrl(url?: string | null): url is string {
  return (
    typeof url === "string" &&
    (url.includes("/api/flexo-imposition/") || url.includes(SHEET_IMPOSITION_PREFIX))
  );
}

/**
 * Vaqtinchalik imposition keshidagi faylni (flexo: qirqilgan SKU PDF / film / prevyu;
 * varaqli: montaj PDF) MinIO S3 ga doimiy saqlab, /api/v1/storage/file havolasiga aylantiradi.
 */
export async function persistCachedImpositionUrlToS3(
  docNo: string,
  url?: string | null,
  preferredName?: string
): Promise<string | undefined> {
  if (!url || typeof url !== "string") return undefined;
  if (!isCachedImpositionUrl(url)) {
    return url;
  }

  try {
    const rawFileName = preferredName || url.split("/").pop()?.split("?")[0] || "artwork.pdf";
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const folder = url.includes(SHEET_IMPOSITION_PREFIX) ? "imposition" : "artwork";
    const s3Key = `PRINTGOO/orders/${docNo}/${folder}/${cleanFileName}`;
    const ext = cleanFileName.toLowerCase().endsWith(".png") ? "image/png" : "application/pdf";

    // 1. Fetch file from local doc-service / Next.js proxy
    const localUrl = url.startsWith("http")
      ? url
      : `http://localhost:3000${url.startsWith("/") ? "" : "/"}${url}`;
    const fileRes = await fetch(localUrl);
    if (!fileRes.ok) {
      console.warn(`[persistImposition] Could not download cached file ${url}: ${fileRes.status}`);
      return url;
    }
    const arrBuf = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrBuf);

    // 2. Upload to MinIO (printgoo-docs)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKETS.docs,
        Key: s3Key,
        Body: buffer,
        ContentType: ext,
      })
    );

    const permanentUrl = `/api/v1/storage/file?key=${encodeURIComponent(s3Key)}`;
    console.log(`[persistImposition] Promoted cached ${cleanFileName} -> ${permanentUrl}`);
    return permanentUrl;
  } catch (err: any) {
    console.error(`[persistImposition] Failed to promote ${url} to MinIO:`, err?.message || err);
    return url;
  }
}

const toDateOrNull = (val: unknown): Date | null => {
  if (!val) return null;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d;
};

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/** A step's frozen machine rates from the client, or null when they are missing or malformed. */
function toFrozenRates(raw: unknown): FrozenCostRates | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.machineId !== "string" || !isUuid(r.machineId)) return null;
  const machineRateUsd = Math.max(0, Number(r.machineRateUsd) || 0);
  const crewRateUsd = Math.max(0, Number(r.crewRateUsd) || 0);
  const frozenAt = typeof r.frozenAt === "string" && !Number.isNaN(Date.parse(r.frozenAt)) ? r.frozenAt : new Date().toISOString();
  return { machineId: r.machineId, machineRateUsd, crewRateUsd, frozenAt };
}

/**
 * Matnli yoki formatlangan miqdorlardan sof sonni ajratib olish (PostgreSQL numeric uchun)
 * Masalan: "0 / 4 dona" -> "0", "1,200 / 5,000 dona" -> "1200", 500 -> "500"
 */
function parseSafeNumeric(val: unknown, fallback: number = 0): string {
  if (val === null || val === undefined || val === "") return String(fallback);
  if (typeof val === "number") return isNaN(val) ? String(fallback) : String(val);

  const str = String(val).trim();
  // Agar "bajarildi / reja birlik" formatida bo'lsa (masalan: "0 / 4 dona", "150 / 500 dona")
  const slashMatch = str.match(/^([\d\s,.]+)\s*\//);
  if (slashMatch) {
    const cleaned = slashMatch[1].replace(/[\s,]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? String(fallback) : String(parsed);
  }

  // Boshidagi raqamni ajratib olish (masalan: "500 dona", "1,250")
  const numMatch = str.match(/^([\d\s,.]+)/);
  if (numMatch) {
    const cleaned = numMatch[1].replace(/[\s,]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? String(fallback) : String(parsed);
  }

  return String(fallback);
}

/**
 * Rejali miqdorni ajratib olish
 * Masalan: "0 / 4 dona" -> "4", "0 / 1 list" -> "1", yoki to'g'ridan-to'g'ri son
 */
function parseSafePlannedQty(op: any, defaultQty: number = 0): string {
  if (op.plannedQty !== undefined && op.plannedQty !== null && op.plannedQty !== "") {
    if (typeof op.plannedQty === "number") {
      return isNaN(op.plannedQty) ? String(defaultQty) : String(op.plannedQty);
    }
    const cleaned = String(op.plannedQty).replace(/[\s,]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) return String(parsed);
  }

  // Agar qtyCompleted da "/ reja birlik" ko'rinishida bo'lsa
  const text = String(op.qtyCompleted || "").trim();
  const targetMatch = text.match(/\/\s*([\d\s,.]+)/);
  if (targetMatch) {
    const cleaned = targetMatch[1].replace(/[\s,]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) return String(parsed);
  }

  return String(defaultQty);
}

/**
 * Bazadan barcha real ishlab chiqarish buyruqlarini (Work Orders) yuklash
 */
export async function getWorkOrders(companyCode: string = "PRINTGOO"): Promise<ProductionQueueItem[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawOrders = await db.query.workOrders.findMany({
    where: eq(workOrders.companyId, companyId),
    with: {
      operations: {
        orderBy: (ops, { asc }) => [asc(ops.sequence)],
      },
      events: {
        orderBy: (ev, { desc }) => [desc(ev.createdAt)],
      },
      attachments: {
        orderBy: (att, { desc }) => [desc(att.createdAt)],
      },
    },
    orderBy: [desc(workOrders.createdAt)],
  });

  // What has left the warehouse for each order (posted shipments) and what has been invoiced.
  const [shippedRows, invoicedRows] = await Promise.all([
    db
      .select({
        woNo: warehouseShipmentItems.sourceWorkOrderId,
        qty: sql<string>`coalesce(sum(${warehouseShipmentItems.quantity}), 0)`,
      })
      .from(warehouseShipmentItems)
      .innerJoin(warehouseShipments, eq(warehouseShipments.id, warehouseShipmentItems.shipmentId))
      .where(
        and(
          eq(warehouseShipments.companyId, companyId),
          inArray(warehouseShipments.status, ["Dispatched", "In Transit", "Delivered"])
        )
      )
      .groupBy(warehouseShipmentItems.sourceWorkOrderId),
    db
      .select({
        woId: deliveryActs.workOrderId,
        qty: sql<string>`coalesce(sum(${deliveryActItems.quantity}), 0)`,
      })
      .from(deliveryActItems)
      .innerJoin(deliveryActs, eq(deliveryActs.id, deliveryActItems.actId))
      .where(and(eq(deliveryActs.companyId, companyId), sql`${deliveryActs.status} not in ('cancelled', 'draft')`))
      .groupBy(deliveryActs.workOrderId),
  ]);
  const shippedByNo = new Map(shippedRows.filter((r) => r.woNo).map((r) => [r.woNo as string, Number(r.qty) || 0]));

  // Tooling & CTP orders are the source of truth for each tooling item's PO, supplier, progress and delivery cost.
  const toolingOrders = await db.query.supplierOrders.findMany({
    where: and(
      eq(supplierOrders.companyId, companyId),
      inArray(supplierOrders.orderType, ["ctp_plates", "die_tooling", "cliche"]),
      inArray(supplierOrders.status, ["Ordered", "In_Production", "Ready", "Delivered"])
    ),
    with: { supplier: { columns: { name: true } } },
    orderBy: [supplierOrders.orderNo],
  });
  const deliveryByWo = new Map<string, ToolingOrderLink[]>();
  for (const o of toolingOrders) {
    if (!o.workOrderId && !o.workOrderNo) continue;
    const link: ToolingOrderLink = {
      orderNo: o.orderNo,
      orderType: o.orderType,
      title: o.title,
      status: o.status,
      supplierId: o.supplierId,
      supplierName: o.supplier?.name || undefined,
      deliveryMethod: (o.deliveryMethod as ToolingOrderLink["deliveryMethod"]) || undefined,
      deliveryCost: Number(o.deliveryCost) || 0,
    };
    for (const key of new Set([o.workOrderId, o.workOrderNo?.trim().toLowerCase()].filter(Boolean) as string[])) {
      deliveryByWo.set(key, [...(deliveryByWo.get(key) || []), link]);
    }
  }
  const invoicedById = new Map(invoicedRows.filter((r) => r.woId).map((r) => [r.woId as string, Number(r.qty) || 0]));

  return rawOrders.map((wo, index) => {
    const checks = (wo.checks as any) || {
      designReady: false,
      paperReady: false,
      platesReady: false,
      toolingReady: false,
    };
    const dims = (wo.dimensions as any) || {};
    const colorsCfg = (wo.colorsConfig as any) || {};

    return {
      id: wo.docNo,
      docNo: wo.docNo,
      clientOrderId: wo.clientOrderId || undefined,
      clientId: wo.clientId || undefined,
      parentWorkOrderId: dims.parentWorkOrderId || undefined,
      isReorder: Boolean(dims.parentWorkOrderId),
      customer: wo.customerName,
      product: wo.productName,
      productType: wo.productType || "",
      quantity: Number(wo.quantity) || 0,
      unit: wo.unit || "pcs",
      pressMachine: wo.pressMachine || "",
      department: wo.department || "Offset",
      priority: (wo.priority as any) || "Normal",
      stage: (wo.stage as any) || "Queue",
      status: wo.status ? deriveWorkOrderStatus(wo.status, wo.stage) : "Draft",
      // Planner's run order; orders without one go to the end in creation order.
      queueOrder: wo.queueOrder ?? 100000 + index,
      checks: {
        designReady: !!checks.designReady,
        paperReady: !!checks.paperReady,
        platesReady: !!checks.platesReady,
        toolingReady: !!checks.toolingReady,
        audit: checks.audit || {},
      },
      orderDate: wo.orderDate || (wo.createdAt ? wo.createdAt.toISOString().split("T")[0] : ""),
      startDate: wo.startDate || "",
      deadline: wo.deadline || "",
      actualEndDate: wo.actualEndDate || "",
      // Imposition sheet count lives in dimensions; orders saved before it was stored take it from
      // the saved imposition summary, and only orders without any imposition fall back to the tiraj.
      plannedSheets:
        Number(dims.plannedSheets) ||
        Number(dims.impositionState?.summary?.parentSheets) ||
        Number(wo.quantity) ||
        0,
      completedSheets: 0,
      operator: wo.operator || undefined,
      shift: wo.shift || undefined,
      recipe: wo.recipeCode || "",
      cancelReason: wo.cancelReason || undefined,
      shippedQty: shippedByNo.get(wo.docNo) || 0,
      invoicedQty: invoicedById.get(wo.id) || 0,
      site: wo.site || "",
      priceTotal: Number(wo.priceTotal) || 0,
      currency: wo.currency || "UZS",

      // Asosiy spetsifikatsiya materiallari va pardozlash
      paperStock: wo.paperStock || dims.paperStock || "",
      targetGsm: dims.targetGsm ?? undefined,
      paperDensity: dims.paperDensity ?? undefined,
      coating: wo.coating || dims.coating || "",
      lamination: wo.lamination || dims.lamination || "",
      laminationSides: dims.laminationSides || "1s",
      laminationMicron: dims.laminationMicron ?? 0,
      embellishment: wo.embellishment || dims.embellishment || "",
      coatingZone: dims.coatingZone || "",
      embellishmentZone: dims.embellishmentZone || "",

      // Ranglar va Pantone
      colors: colorsCfg?.formula || undefined,
      colorsConfig: colorsCfg?.formula || "",
      frontColors: colorsCfg?.frontColors || { c: false, m: false, y: false, k: false },
      backColors: colorsCfg?.backColors || { c: false, m: false, y: false, k: false },
      spotColors: colorsCfg?.spotColors || [],
      spotColorItems: colorsCfg?.spotColorItems || [],

      // O'lchamlar va geometriya
      dimensions: dims,
      width: dims.width ?? 0,
      height: dims.height ?? 0,
      dimensionUnit: dims.dimensionUnit || "mm",
      bleed: dims.bleed ?? 0,
      shapeType: dims.shapeType || "rectangle",
      cornerType: dims.cornerType || "Square",
      itemCategory: dims.itemCategory || "",
      boxDepth: dims.boxDepth ?? 0,
      foldType: dims.foldType || "",
      boxType: dims.boxType || "",
      customShape: dims.customShape || "",
      customSvgPath: dims.customSvgPath || "",
      dieline: dims.dieline,
      impositionState: dims.impositionState,
      flexoImpositionState: dims.flexoImpositionState,
      holeSize: dims.holeSize ?? 0,
      holePosition: dims.holePosition || "none",
      holeOffset: dims.holeOffset ?? 0,
      sizes: dims.sizes || [],
      skuArtworks: dims.skuArtworks || [],

      // Kashirovka
      kashirovkaMode: dims.kashirovkaMode || "none",
      kashirovkaStrategy: dims.kashirovkaStrategy || "split_half_sheet",
      kashirovkaLayers: dims.kashirovkaLayers || [],
      kashirovkaGlueGsm: dims.kashirovkaGlueGsm ?? 0,
      kashirovkaGlueStockSku: dims.kashirovkaGlueStockSku || "",
      kashirovkaGlueStockName: dims.kashirovkaGlueStockName || "",
      bomDismissedAutoSources: dims.bomDismissedAutoSources || [],
      kashirovkaMakeReadySheets: dims.kashirovkaMakeReadySheets ?? 0,
      kashirovkaCuringHours: dims.kashirovkaCuringHours ?? 0,

      // Shtansforma / Asbob-uskuna
      toolingItems: applySupplierOrders(
        dims.toolingItems || [],
        // Linked by id, by doc number, or both — union, one entry per PO
        [
          ...new Map(
            [
              ...(deliveryByWo.get(wo.id) || []),
              ...(deliveryByWo.get((wo.docNo || "").trim().toLowerCase()) || []),
            ].map((l) => [l.orderNo, l])
          ).values(),
        ]
      ),
      materials: dims.materials || [],
      selectedToolingId: dims.selectedToolingId || "",
      selectedToolingName: dims.selectedToolingName || "",
      toolingProcurementNeeded: !!dims.toolingProcurementNeeded,
      toolingProcurementCost: dims.toolingProcurementCost ?? 0,

      // Maket va die-line
      artworkFront: dims.artworkFront || "",
      artworkBack: dims.artworkBack || "",
      artworkBleedIncluded: dims.artworkBleedIncluded,
      artworkDielineOpacity: dims.artworkDielineOpacity,
      artworkRotation: dims.artworkRotation,

      // Bosma & Varaq
      printMethod: dims.printMethod,
      parentSheetW: dims.parentSheetW,
      parentSheetH: dims.parentSheetH,
      pressSheetW: dims.pressSheetW,
      pressSheetH: dims.pressSheetH,
      makeReadyPerPlate: dims.makeReadyPerPlate,
      runWastePercent: dims.runWastePercent,

      // To'qimachilik / Ribbon Label
      labelFoldType: dims.labelFoldType,
      labelCutType: dims.labelCutType,
      labelMaterialType: dims.labelMaterialType,
      labelEdgeType: dims.labelEdgeType,
      labelWashResistance: dims.labelWashResistance,
      labelSewingMarginMm: dims.labelSewingMarginMm,
      labelPrintSides: dims.labelPrintSides,

      // Flexo
      flexoMachineId: dims.flexoMachineId,
      flexoMaterialId: dims.flexoMaterialId,
      flexoWebWidth: dims.flexoWebWidth,
      flexoCylinderTeeth: dims.flexoCylinderTeeth,
      flexoPlateThickness: dims.flexoPlateThickness,
      flexoOrientation: dims.flexoOrientation,
      flexoGapX: dims.flexoGapX,
      flexoGapY: dims.flexoGapY,
      termoCornerRadius: dims.termoCornerRadius,
      termoDieSource: dims.termoDieSource,
      termoDieMarginMm: dims.termoDieMarginMm,
      termoDieRows: dims.termoDieRows,
      flexoLanes: dims.flexoLanes,
      flexoRollsCount: dims.flexoRollsCount,
      flexoLabelsPerRoll: dims.flexoLabelsPerRoll,
      flexoCoreDiameter: dims.flexoCoreDiameter,
      flexoColors: dims.flexoColors,

      financials: dims.financials,

      orderType: wo.orderType || "Production",
      sampleRequired: wo.orderType === "Sample" || !!(wo.sampleData as any)?.isRequired,
      sampleStatus: (wo.sampleData as any)?.approvalStatus || "none",
      sampleQty: (wo.sampleData as any)?.sampleQty || undefined,
      sampleData: wo.sampleData || {},
      packagingData: wo.packagingData || {},
      deliveryBatches: wo.deliveryBatches || [],
      notes: wo.notes || "",
      photoUrl: normalizePermanentMediaUrl(wo.photoUrl) || normalizePermanentMediaUrl(wo.attachments && wo.attachments.find((a: any) => a.category === "proofs" || a.fileType?.startsWith("image/"))?.url) || undefined,
      photoUrls: (wo.photoUrls && wo.photoUrls.length > 0
        ? wo.photoUrls
        : (wo.attachments ? wo.attachments.filter((a: any) => a.category === "proofs" || a.fileType?.startsWith("image/")).map((a: any) => a.url) : [])
      ).map((u: string) => normalizePermanentMediaUrl(u) || u),
      attachments: wo.attachments ? wo.attachments.map((a: any) => ({
        id: a.id,
        name: a.name,
        size: a.fileSize || "—",
        type: a.fileType || "Document",
        date: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 16).replace("T", " ") : "",
        isImage: a.fileType?.startsWith("image/") || a.category === "proofs" || /\.(jpg|jpeg|png|webp|gif)$/i.test(a.name),
        url: normalizePermanentMediaUrl(a.url) || a.url,
      })) : [],
      // Journal entries the order screen understands; removed ones stay in the table for the audit trail.
      events: (wo.events || [])
        .filter((ev: { deletedAt?: Date | null }) => !ev.deletedAt)
        .map(toShiftEvent)
        .sort((a: ShiftEvent, b: ShiftEvent) => (b.occurredAt || "").localeCompare(a.occurredAt || "")),
      operations: (wo.operations || []).map((op: any, idx: number) => {
        const completedNum = Number(op.completedQty || 0);
        const plannedNum = Number(op.plannedQty || wo.quantity || 0);
        const qtyLabel = plannedNum > 0
          ? `${completedNum.toLocaleString()} / ${plannedNum.toLocaleString()}`
          : String(completedNum);
        return {
          id: op.id || `op-${idx + 1}`,
          stepNumber: op.sequence || (idx + 1) * 10,
          name: op.name || `Bosqich ${idx + 1}`,
          department: op.department || "Offset",
          machine: op.machineStr || "",
          machineId: op.machineId || undefined,
          operator: op.operator || "",
          costMode: (op.costMode as "auto" | "outsourced" | "manual") || "auto",
          manualCostUsd: Number(op.manualCostUsd || 0),
          costNote: op.costNote || undefined,
          duration: Number(op.durationHours || 1),
          toolingId: op.toolingId || undefined,
          toolingName: op.toolingName || undefined,
          tariffId: op.tariffId || undefined,
          tariffCode: op.tariffCode || undefined,
          workRateId: op.workRateId || undefined,
          startedAt: op.startedAt ? op.startedAt.toISOString() : undefined,
          pausedAt: op.pausedAt ? op.pausedAt.toISOString() : undefined,
          completedAt: op.completedAt ? op.completedAt.toISOString() : undefined,
          downtimeMinutes: Number(op.downtimeMinutes || 0),
          actualDurationMinutes: op.actualDurationMinutes ?? undefined,
          calcUnit: op.calcUnit || undefined,
          unitDivisor: op.unitDivisor || 1000,
          rateUsd: Number(op.rateUsd || 0),
          setupFeeUsd: Number(op.setupFeeUsd || 0),
          pieceworkRateUsd: Number(op.pieceworkRateUsd || 0),
          plannedCostUsd: Number(op.plannedCostUsd || 0),
          pieceworkTotalUsd: Number(op.pieceworkTotalUsd || 0),
          costRates: op.costRates || undefined,
          plannedQty: plannedNum,
          completedQty: completedNum,
          qtyCompleted: qtyLabel,
          status: op.status || "Queued",
          notes: op.notes || "",
        };
      }),
    } as any;
  });
}

/**
 * Bazadan haqiqiy saqlangan navbatdagi buyruq raqamini olish
 */
export async function getNextWorkOrderNoFromDb(
  companyCode: string = "PRINTGOO",
  department: string = "Offset",
  exec: DbExec = db
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const normalizedDept = normalizeDepartment(department);
  const prefix = WO_DEPT_PREFIXES[normalizedDept] || "WOOF";
  const yearSuffix = getCurrentYearSuffix();
  const pattern = `${prefix}-${yearSuffix}-%`;

  const rows = await exec
    .select({ docNo: workOrders.docNo })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.companyId, companyId),
        ilike(workOrders.docNo, pattern)
      )
    );

  let maxNum = 0;
  for (const r of rows) {
    const match = r.docNo?.match(new RegExp(`^${prefix}-${yearSuffix}-(\\d+)$`, "i"));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return formatWorkOrderNo(normalizedDept, nextNum, yearSuffix);
}

/**
 * Yangi ishlab chiqarish buyrug'ini yaratish yoki mavjudini to'liq saqlash (Upsert)
 */
/** Biznes-qoida buzilishi (status o'tishi va h.k.) — API 422 qaytaradi. */
export class WorkOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkOrderValidationError";
  }
}

export async function upsertWorkOrder(
  data: Partial<WorkOrderFormData> & {
    docNo?: string;
    operations?: RouteStep[];
    sampleData?: any;
    packagingData?: any;
    deliveryBatches?: any[];
    events?: any[];
    user?: { id?: string; name?: string; role?: string; initials?: string };
    author?: { id?: string; name?: string; role?: string; initials?: string };
  },
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; workOrder: any }> {
  const companyId = await getCompanyIdByCode(companyCode);

  let docNo = (data.docNo || "").trim();
  const isDraft = !docNo || docNo.startsWith("draft-") || docNo.startsWith("temp-") || docNo === "NEW" || docNo === "[Avtomatik]" || docNo.includes("Qoralama") || docNo.includes("Yangi");
  if (isDraft) {
    docNo = await getNextWorkOrderNoFromDb(companyCode, data.department || "Offset");
  }

  const customerName = (data.customer || "").trim();
  if (!customerName) {
    throw new Error("Mijoz nomi kiritilishi shart!");
  }
  const productName = (data.product || "").trim();
  if (!productName) {
    throw new Error("Mahsulot nomi kiritilishi shart!");
  }
  const quantity = Number(data.quantity) || 0;
  if (quantity <= 0) {
    throw new Error("Buyurtma miqdori (adad) 0 dan katta bo'lishi shart!");
  }

  // 1. Mijozni tekshirish yoki topish (agar mavjud bo'lsa)
  const clientRecord = await resolveClient(db, companyId, {
    id: (data as { clientId?: string | null }).clientId,
    name: customerName,
  });
  const clientId: string | null = clientRecord?.id ?? null;

  // 2. Mavjud buyurtmani qidirish
  const existingOrder = await db.query.workOrders.findFirst({
    where: (wo, { and, eq }) => and(eq(wo.companyId, companyId), eq(wo.docNo, docNo)),
  });

  // Mahsulot turi faqat ma'lumotnomadan: yangi qiymat ro'yxatda bo'lishi shart.
  const requestedProductType = data.productType?.trim();
  if (requestedProductType && requestedProductType !== existingOrder?.productType) {
    const known = await db
      .select({ id: productTypes.id })
      .from(productTypes)
      .where(
        and(
          eq(productTypes.companyId, companyId),
          eq(productTypes.name, requestedProductType),
          eq(productTypes.isActive, true)
        )
      )
      .limit(1);
    if (!known.length) {
      throw new WorkOrderValidationError(`"${requestedProductType}" mahsulot turi ma'lumotnomada yo'q. Avval uni yarating.`);
    }
  }

  // An order that goes to the floor belongs to a client CRM knows: finance invoices it by that link.
  // Drafts, and orders already saved under this name before the rule, may still be saved.
  const customerChanged =
    !existingOrder || existingOrder.customerName.trim().toLowerCase() !== customerName.toLowerCase();
  if (!clientId && customerChanged && (data.status || "").trim() !== "Draft") {
    throw new WorkOrderValidationError(unknownClientMessage(customerName));
  }

  // A save that sends no status keeps the one the order has: a cancelled or draft order
  // must not come back to life because a field was left out.
  const rawStatus = (data.status || "").trim();
  let requestedStatus: WorkOrderStatus = (existingOrder?.status as WorkOrderStatus | undefined) ?? "Active";
  if (rawStatus === "Draft") requestedStatus = "Draft";
  else if (rawStatus === "Active") requestedStatus = "Active";
  else if (rawStatus === "In Production" || rawStatus === "In_Production") requestedStatus = "In Production";
  else if (rawStatus === "Completed") requestedStatus = "Completed";
  else if (rawStatus === "Cancelled") requestedStatus = "Cancelled";

  let stageVal: any = (data as any).stage || existingOrder?.stage || "Queue";
  if (requestedStatus === "In Production" && (!stageVal || stageVal === "Queue")) {
    stageVal = "In Production";
  } else if (requestedStatus === "Completed") {
    stageVal = "Completed";
  }
  // "In Production" and "Completed" follow the stage; only Draft / Active / Cancelled are set by hand.
  const statusVal = deriveWorkOrderStatus(requestedStatus, stageVal);
  const existingStatus = existingOrder ? deriveWorkOrderStatus(existingOrder.status, existingOrder.stage) : undefined;

  // Sliced SKU Artworks ichidagi kesh URL larini MinIO S3 ga doimiy saqlash
  let resolvedSkuArtworks =
    (data as any).skuArtworks ??
    (data as any).dimensions?.skuArtworks ??
    (existingOrder?.dimensions as any)?.skuArtworks ??
    [];

  if (Array.isArray(resolvedSkuArtworks) && resolvedSkuArtworks.length > 0) {
    resolvedSkuArtworks = await Promise.all(
      resolvedSkuArtworks.map(async (art: any) => {
        let frontUrl = art.frontArtworkUrl;
        let thumbUrl = art.frontArtworkThumb;
        if (frontUrl && frontUrl.includes("/api/flexo-imposition/")) {
          frontUrl = (await persistCachedImpositionUrlToS3(docNo, frontUrl, art.frontArtworkName)) || frontUrl;
        }
        if (thumbUrl && thumbUrl.includes("/api/flexo-imposition/")) {
          thumbUrl = (await persistCachedImpositionUrlToS3(docNo, thumbUrl, (art.model || "sku") + "_thumb.png")) || thumbUrl;
        }
        return {
          ...art,
          frontArtworkUrl: frontUrl,
          frontArtworkThumb: thumbUrl,
        };
      })
    );
  }

  const payload: any = {
    companyId,
    clientId,
    docNo,
    clientOrderId: data.linkedOrderId || null,
    customerName,
    productName: data.product,
    productType:
      data.productType !== undefined
        ? data.productType.trim() || null
        : existingOrder?.productType ?? null,
    department: data.department || "Offset",
    site: data.site || null,
    pressMachine: data.pressMachine || null,
    recipeCode: data.recipe || null,
    quantity: String(data.quantity || 0),
    unit: data.unit || "pcs",
    status: statusVal,
    priority: (data.priority as any) || "Normal",
    stage: stageVal,
    orderType: (data.orderType as any) || "Production",
    orderDate: data.orderDate || new Date().toISOString().split("T")[0],
    startDate: data.startDate || null,
    deadline: data.deadline || null,
    actualEndDate:
      statusVal === "Completed" || stageVal === "Completed"
        ? data.actualEndDate || new Date().toISOString().split("T")[0]
        : data.actualEndDate || null,
    paperStock: data.paperStock || null,
    coating: data.coating || null,
    lamination: data.lamination || null,
    embellishment: data.embellishment || null,
    priceTotal: String(data.priceTotal || 0),
    currency: data.currency || "UZS",
    photoUrl: data.photoUrl || (data.photoUrls && data.photoUrls[0]) || null,
    photoUrls: data.photoUrls || (data.photoUrl ? [data.photoUrl] : []),
    dimensions: {
      width: data.width,
      height: data.height,
      dimensionUnit: data.dimensionUnit || "mm",
      bleed: data.bleed,
      shapeType: data.shapeType,
      cornerType: data.cornerType,
      itemCategory: data.itemCategory,
      boxDepth: data.boxDepth,
      foldType: data.foldType,
      boxType: data.boxType,
      customShape: data.customShape,
      customSvgPath: data.customSvgPath,
      dieline: data.dieline ?? (existingOrder?.dimensions as any)?.dieline,
      impositionState: data.impositionState ?? (existingOrder?.dimensions as any)?.impositionState,
      flexoImpositionState: data.flexoImpositionState ?? (existingOrder?.dimensions as any)?.flexoImpositionState,
      holeSize: data.holeSize,
      holePosition: data.holePosition,
      holeOffset: data.holeOffset,
      sizes: data.sizes ?? (data as any).dimensions?.sizes ?? (existingOrder?.dimensions as any)?.sizes ?? [],
      skuArtworks: resolvedSkuArtworks,
      targetGsm: data.targetGsm,
      paperDensity: data.paperDensity,
      kashirovkaMode: data.kashirovkaMode,
      kashirovkaStrategy: data.kashirovkaStrategy,
      kashirovkaLayers: data.kashirovkaLayers,
      kashirovkaGlueGsm: data.kashirovkaGlueGsm,
      kashirovkaGlueStockSku: data.kashirovkaGlueStockSku,
      kashirovkaGlueStockName: data.kashirovkaGlueStockName,
      bomDismissedAutoSources:
        (data as any).bomDismissedAutoSources ?? (existingOrder?.dimensions as any)?.bomDismissedAutoSources ?? [],
      kashirovkaMakeReadySheets: data.kashirovkaMakeReadySheets,
      kashirovkaCuringHours: data.kashirovkaCuringHours,
      toolingItems: (data as any).toolingItems || (data as any).dimensions?.toolingItems || [],
      materials: (data as any).materials || (data as any).dimensions?.materials || [],
      selectedToolingId: data.selectedToolingId,
      selectedToolingName: data.selectedToolingName,
      toolingProcurementNeeded: data.toolingProcurementNeeded,
      toolingProcurementCost: data.toolingProcurementCost,
      laminationSides: data.laminationSides,
      laminationMicron: data.laminationMicron,
      coatingZone: data.coatingZone,
      embellishmentZone: data.embellishmentZone,
      artworkFront: data.artworkFront,
      artworkBack: data.artworkBack,
      artworkBleedIncluded: data.artworkBleedIncluded,
      artworkDielineOpacity: data.artworkDielineOpacity,
      artworkRotation: data.artworkRotation,
      printMethod: data.printMethod,
      parentSheetW: data.parentSheetW,
      parentSheetH: data.parentSheetH,
      plannedSheets: (data as any).plannedSheets ?? (existingOrder?.dimensions as any)?.plannedSheets,
      pressSheetW: data.pressSheetW,
      pressSheetH: data.pressSheetH,
      makeReadyPerPlate: data.makeReadyPerPlate,
      runWastePercent: data.runWastePercent,
      labelFoldType: data.labelFoldType,
      labelCutType: data.labelCutType,
      labelMaterialType: data.labelMaterialType,
      labelEdgeType: data.labelEdgeType,
      labelWashResistance: data.labelWashResistance,
      labelSewingMarginMm: data.labelSewingMarginMm,
      labelPrintSides: data.labelPrintSides,
      flexoMachineId: data.flexoMachineId,
      flexoMaterialId: data.flexoMaterialId,
      flexoWebWidth: data.flexoWebWidth,
      flexoCylinderTeeth: data.flexoCylinderTeeth,
      flexoPlateThickness: data.flexoPlateThickness,
      flexoOrientation: data.flexoOrientation,
      flexoGapX: data.flexoGapX,
      flexoGapY: data.flexoGapY,
      termoCornerRadius: data.termoCornerRadius,
      termoDieSource: data.termoDieSource,
      termoDieMarginMm: data.termoDieMarginMm,
      termoDieRows: data.termoDieRows,
      flexoLanes: data.flexoLanes,
      flexoRollsCount: data.flexoRollsCount,
      flexoLabelsPerRoll: data.flexoLabelsPerRoll,
      flexoCoreDiameter: data.flexoCoreDiameter,
      flexoColors: data.flexoColors,
      financials: data.financials,
      // Takroriy buyurtmaning asosi: alohida ustun yo'q, shuning uchun o'lchamlar JSON ida saqlanadi.
      parentWorkOrderId:
        data.parentWorkOrderId ?? (existingOrder?.dimensions as any)?.parentWorkOrderId ?? undefined,
    },
    colorsConfig: {
      formula: data.colorsConfig,
      frontColors: data.frontColors as any,
      backColors: data.backColors as any,
      spotColors: data.spotColors,
      spotColorItems: data.spotColorItems,
    },
    checks: (() => {
      const existingChecks = (existingOrder?.checks as any) || {};
      const inputChecks = (data as any).checks;
      if (inputChecks !== undefined && inputChecks !== null) {
        const mergedAudit = {
          ...(existingChecks.audit || {}),
          ...(inputChecks.audit || {}),
        };

        const resolveCheck = (key: "designReady" | "paperReady" | "platesReady" | "toolingReady") => {
          // Agar inputAudit'da yangi audit ma'lumoti kelsa:
          if (inputChecks.audit?.[key]?.status) {
            return inputChecks.audit[key].status === "ready";
          }
          // Agar bazadagi mavjud buyurtmada inson tomonidan tasdiqlangan audit bo'lsa:
          if (existingChecks.audit?.[key]?.verifiedBy) {
            return existingChecks.audit[key].status === "ready";
          }
          // Aks holda inputChecks yoki existingChecks'dan olinadi:
          if (inputChecks[key] !== undefined) return !!inputChecks[key];
          return !!existingChecks[key];
        };

        return {
          designReady: resolveCheck("designReady"),
          paperReady: resolveCheck("paperReady"),
          platesReady: resolveCheck("platesReady"),
          toolingReady: resolveCheck("toolingReady"),
          audit: mergedAudit,
        };
      }
      return existingChecks && Object.keys(existingChecks).length > 0
        ? existingChecks
        : {
            designReady: false,
            paperReady: false,
            platesReady: false,
            toolingReady: false,
          };
    })(),
    sampleData: data.sampleData || {},
    packagingData: mergeWarehouseBoxStates(data.packagingData, existingOrder?.packagingData),
    deliveryBatches: data.deliveryBatches || [],
    notes: (data as any).notes || null,
    updatedAt: new Date(),
  };

  const currentAuthor = {
    id: data.author?.id || data.user?.id,
    name: data.author?.name || data.user?.name || "Operator",
    role: data.author?.role || data.user?.role || "Operator",
    initials: data.author?.initials || data.user?.initials,
  };

  // Status o'tishlarini himoyalash: faqat status o'zgarganda tekshiriladi (eski yozuvlarni saqlashga xalaqit bermaydi)
  if (requestedStatus !== existingStatus && requestedStatus !== existingOrder?.status) {
    if (requestedStatus === "In Production") {
      const c = payload.checks || {};
      const gateLabels: Record<string, string> = {
        designReady: "Dizayn",
        paperReady: "Xomashyo",
        platesReady: "Formalar",
        toolingReady: "Shtamp",
      };
      const pending = Object.keys(gateLabels).filter((k) => !c[k]);
      if (pending.length > 0) {
        throw new WorkOrderValidationError(
          `Ishlab chiqarishga o'tkazib bo'lmaydi: tayyor emas — ${pending.map((k) => gateLabels[k]).join(", ")}`
        );
      }
    } else if (requestedStatus === "Completed") {
      let ops: any[] = Array.isArray(data.operations) ? data.operations : [];
      if (!Array.isArray(data.operations) && existingOrder) {
        ops = await db.query.workOrderOperations.findMany({
          where: (op, { eq }) => eq(op.workOrderId, existingOrder.id),
        });
      }
      const isFinished = (s: unknown) => /^(finished|completed|done)$/i.test(String(s || "").trim());
      const unfinished = ops.filter((op) => !isFinished(op.status));
      if (ops.length === 0 || unfinished.length > 0) {
        throw new WorkOrderValidationError(
          ops.length === 0
            ? "Yakunlab bo'lmaydi: marshrut bosqichlari kiritilmagan"
            : `Yakunlab bo'lmaydi: ${unfinished.length} ta bosqich tugallanmagan (${unfinished
                .map((op) => op.name)
                .slice(0, 3)
                .join(", ")})`
        );
      }
    }
  }

  // Credit control: checked when the order is released to the floor, not on every save.
  const releasedNow =
    (requestedStatus === "In Production" && existingStatus !== "In Production") ||
    (stageVal === "Ready to Print" && existingOrder?.stage !== "Ready to Print" && statusVal !== "Draft");
  if (releasedNow && statusVal !== "Cancelled") {
    const hold = await checkCreditHold({
      companyId,
      clientId,
      workOrderId: existingOrder?.id,
      docNo,
      priority: payload.priority,
      author: currentAuthor,
    });
    if (hold) throw new WorkOrderValidationError(hold);
  }

  const incomingOps: any[] | null = Array.isArray(data.operations) ? data.operations : null;
  const toOperationRow = (op: any, idx: number) => {
    const rawDuration = op.durationHours ?? op.duration ?? 1.0;
    const durationNum = parseFloat(String(rawDuration).replace(/[^\d.]/g, "")) || 1.0;

    const rateNum = parseFloat(String(op.rateUsd || 0).replace(/[^\d.]/g, "")) || 0;
    const setupNum = parseFloat(String(op.setupFeeUsd || 0).replace(/[^\d.]/g, "")) || 0;
    const pwRateNum = parseFloat(String(op.pieceworkRateUsd || 0).replace(/[^\d.]/g, "")) || 0;
    const plannedCostNum = parseFloat(String(op.plannedCostUsd || 0).replace(/[^\d.]/g, "")) || 0;
    const pwTotalNum = parseFloat(String(op.pieceworkTotalUsd || 0).replace(/[^\d.]/g, "")) || 0;
    const divisorNum = parseInt(String(op.unitDivisor || 1000), 10) || 1000;
    const seqNum = parseInt(String(op.stepNumber ?? op.sequence ?? (idx + 1)), 10) || (idx + 1);

    return {
      tariffId: op.tariffId && op.tariffId.length > 20 ? op.tariffId : null,
      tariffCode: op.tariffCode || null,
      workRateId: typeof op.workRateId === "string" && isUuid(op.workRateId) ? op.workRateId : null,
      name: op.name || `Bosqich ${idx + 1}`,
      department: op.department || data.department || "Offset",
      machineStr: op.machine || op.machineStr || null,
      machineId: typeof op.machineId === "string" && isUuid(op.machineId) ? op.machineId : null,
      operator: op.operator || (Array.isArray(op.operators) ? op.operators.join(", ") : null),
      costMode: ["outsourced", "manual"].includes(op.costMode) ? op.costMode : "auto",
      manualCostUsd: (Math.max(0, Number(op.manualCostUsd) || 0)).toFixed(2),
      costNote: op.costNote ? String(op.costNote).slice(0, 500) : null,
      durationHours: durationNum.toFixed(2),
      toolingId: op.toolingId || null,
      toolingName: op.toolingName || null,
      calcUnit: op.calcUnit || null,
      unitDivisor: divisorNum,
      rateUsd: rateNum.toFixed(4),
      setupFeeUsd: setupNum.toFixed(2),
      pieceworkRateUsd: pwRateNum.toFixed(4),
      plannedCostUsd: plannedCostNum.toFixed(2),
      pieceworkTotalUsd: pwTotalNum.toFixed(2),
      costRates: toFrozenRates(op.costRates),
      sequence: seqNum,
      status: op.status || "Queued",
      plannedQty: parseSafePlannedQty(op, Number(data.quantity) || 0),
      startedAt: toDateOrNull(op.startedAt),
      pausedAt: toDateOrNull(op.pausedAt),
      completedAt: toDateOrNull(op.completedAt),
      downtimeMinutes: Math.max(0, Math.round(Number(op.downtimeMinutes) || 0)),
      actualDurationMinutes:
        op.actualDurationMinutes !== undefined && op.actualDurationMinutes !== null && op.actualDurationMinutes !== ""
          ? Math.max(0, Math.round(Number(op.actualDurationMinutes) || 0))
          : null,
      completedQty: parseSafeNumeric(op.completedQty ?? op.qtyCompleted, 0),
      notes: op.notes || null,
    };
  };

  // The order and its route are written together or not at all.
  const targetId: string = await db.transaction(async (tx) => {
    let orderId: string;
    if (existingOrder) {
      orderId = existingOrder.id;
      await tx.update(workOrders).set(payload).where(eq(workOrders.id, orderId));
    } else {
      // Numbers are handed out one at a time: two orders saved at once must not get the same one.
      await lockNumbering(tx, companyId, "WO");
      if (isDraft) {
        docNo = await getNextWorkOrderNoFromDb(companyCode, data.department || "Offset", tx);
        payload.docNo = docNo;
      }
      const [{ maxQueue }] = await tx
        .select({ maxQueue: sql<number>`coalesce(max(${workOrders.queueOrder}), 0)` })
        .from(workOrders)
        .where(eq(workOrders.companyId, companyId));
      const [inserted] = await tx
        .insert(workOrders)
        .values({ ...payload, queueOrder: Number(maxQueue) + 10 })
        .returning({ id: workOrders.id });
      orderId = inserted.id;
    }

    // 3. Route steps. A step keeps its id for as long as it exists — shift-journal entries point at
    //    it — so steps are matched (by id, else by position and name) and updated, not wiped.
    if (incomingOps) {
      const existingOps = await tx.query.workOrderOperations.findMany({
        where: eq(workOrderOperations.workOrderId, orderId),
      });
      const existingById = new Map(existingOps.map((o) => [o.id, o]));
      const sentIds = new Set(incomingOps.map((op) => op?.id).filter((id) => typeof id === "string" && isUuid(id)));
      const kept = new Set<string>();

      // Machine cards are read once, only for steps whose rates still have to be frozen.
      let machineCards: Map<string, MachineRecord> | null = null;
      const machineCard = async (id: string) => {
        if (!machineCards) {
          const ids = [...new Set(incomingOps.map((o) => o?.machineId).filter((v) => typeof v === "string" && isUuid(v)))];
          const rows = ids.length
            ? await tx
                .select({ id: productionMachines.id, costing: productionMachines.costing })
                .from(productionMachines)
                .where(inArray(productionMachines.id, ids))
            : [];
          machineCards = new Map(rows.map((r) => [r.id, r as unknown as MachineRecord]));
        }
        return machineCards.get(id) || null;
      };

      for (const [idx, op] of incomingOps.entries()) {
        const row = toOperationRow(op, idx);
        const sentId = typeof op.id === "string" && isUuid(op.id) ? (op.id as string) : null;
        const match =
          (sentId && existingById.get(sentId)) ||
          (!sentId
            ? existingOps.find(
                (e) => !kept.has(e.id) && !sentIds.has(e.id) && e.sequence === row.sequence && e.name === row.name
              )
            : undefined);
        // A step keeps the rates it was first costed at; a new machine (or none frozen yet) takes today's card.
        if (row.costRates?.machineId !== row.machineId) row.costRates = null;
        if (!row.costRates && match && match.costRates?.machineId === row.machineId) row.costRates = match.costRates;
        if (!row.costRates && row.machineId && row.costMode === "auto") {
          const card = await machineCard(row.machineId);
          const frozen = card ? freezeMachineRates(card) : null;
          if (frozen && (frozen.machineRateUsd > 0 || frozen.crewRateUsd > 0)) row.costRates = frozen;
        }
        if (match) {
          kept.add(match.id);
          await tx.update(workOrderOperations).set(row).where(eq(workOrderOperations.id, match.id));
        } else {
          await tx
            .insert(workOrderOperations)
            .values({ ...(sentId ? { id: sentId } : {}), workOrderId: orderId, ...row });
        }
      }

      const removed = existingOps.filter((e) => !kept.has(e.id));
      if (removed.length > 0) {
        const logged = await tx
          .selectDistinct({ opId: workOrderEvents.opId })
          .from(workOrderEvents)
          .where(and(eq(workOrderEvents.workOrderId, orderId), isNull(workOrderEvents.deletedAt)));
        const loggedIds = new Set(logged.map((l) => l.opId));
        const blocked = removed.filter((e) => loggedIds.has(e.id));
        if (blocked.length > 0) {
          throw new WorkOrderValidationError(
            `Smena jurnalida yozuvi bor bosqichni o'chirib bo'lmaydi: ${blocked.map((e) => e.name).join(", ")}. Avval jurnal yozuvlarini o'chiring.`
          );
        }
        await tx.delete(workOrderOperations).where(
          inArray(
            workOrderOperations.id,
            removed.map((e) => e.id)
          )
        );
      }
    }
    return orderId;
  });

  if (existingOrder) {
    // Audit Log: Server-side difflarni hisoblash va saqlash
    try {
      await computeAndRecordWorkOrderDiffs({
        companyId,
        docNo,
        workOrderId: targetId,
        existingOrder,
        payload,
        author: currentAuthor,
      });
    } catch (auditErr) {
      console.error("[WorkOrder Audit] Diff yozishda xatolik:", auditErr);
    }
  } else {
    // Audit Log: Yangi buyurtma yaratilish hodisasi
    try {
      await recordWorkOrderAuditLog({
        companyId,
        workOrderId: targetId,
        docNo,
        action: "create",
        author: {
          ...currentAuthor,
          role: currentAuthor.role !== "Operator" ? currentAuthor.role : "Yaratuvchi",
        },
        category: "status",
        actionText: `Buyurtma yaratildi: ${docNo}`,
        details: customerName
          ? `Mijoz: ${customerName} • Mahsulot: ${data.product || "Noma'lum"}`
          : "Yangi buyurtma rasmiylashtirildi.",
        badgeText: payload.status || "Draft",
        badgeVariant: "default",
      });
    } catch (auditErr) {
      console.error("[WorkOrder Audit] Boshlang'ich log yozishda xatolik:", auditErr);
    }
  }

  // 3b. The journal wins over what the screen sent: an order tab opened before entries were logged
  //     elsewhere (operator terminal, another tab) must not roll the steps' status back.
  if (data.operations && Array.isArray(data.operations)) {
    const loggedSteps = await db
      .selectDistinct({ opId: workOrderEvents.opId })
      .from(workOrderEvents)
      .where(and(eq(workOrderEvents.workOrderId, targetId), isNull(workOrderEvents.deletedAt)));
    for (const { opId } of loggedSteps) {
      if (opId) await syncStepFromJournal(targetId, opId);
    }
    await syncOrderStageFromSteps(targetId);
  }

  // 4. The shift journal is not written with the order: every event is saved on its own
  //    through /work-orders/[id]/events the moment it is logged (workOrderEventService).

  // 5. Fayllar va ilovalarni (attachments) saqlash va sinxronlash
  const inputAttachments = data.attachments !== undefined ? data.attachments : (data as any).orderAttachments;
  if (inputAttachments && Array.isArray(inputAttachments)) {
    // 5.1 Bazadagi mavjud fayllarni olish
    const existingAttachments = await db.query.workOrderAttachments.findMany({
      where: eq(workOrderAttachments.workOrderId, targetId),
    });

    const inputUrls = new Set(
      inputAttachments
        .map((a: any) => a?.url)
        .filter((u: any): u is string => typeof u === "string" && u.trim().length > 0)
    );

    // 5.2 Foydalanuvchi interfeysdan o'chirgan fayllarni DB va MinIO S3 omboridan tozalash
    for (const oldAtt of existingAttachments) {
      if (!inputUrls.has(oldAtt.url)) {
        await db.delete(workOrderAttachments).where(eq(workOrderAttachments.id, oldAtt.id));
        if (oldAtt.storagePath) {
          try {
            await deleteStorageObject({ bucket: "prepress", objectKey: oldAtt.storagePath });
          } catch (_) {}
        }
      }
    }

    // 5.3 Yangi yoki o'zgargan fayllarni qo'shish
    for (const att of inputAttachments) {
      let attUrl = att.url;
      if (!attUrl) continue;
      if (isCachedImpositionUrl(attUrl)) {
        attUrl = (await persistCachedImpositionUrlToS3(docNo, attUrl, att.name)) || attUrl;
      }
      const existing = existingAttachments.find((a) => a.url === attUrl);
      if (!existing) {
        await db.insert(workOrderAttachments).values({
          workOrderId: targetId,
          name: att.name || "Attachment",
          category: (att.category || (att.isImage ? "proofs" : "docs")) as any,
          fileType: att.type || (att.isImage ? "image/jpeg" : "application/octet-stream"),
          fileSize: att.size || null,
          storagePath: att.storagePath || `PRINTGOO/orders/${docNo}/proofs/${att.name || "file"}`,
          url: attUrl,
          uploadedBy: att.uploadedBy || null,
        });
      }
    }
  }

  // 5. Biznes bildirishnoma triggeri (Work Order Created / Updated)
  try {
    const isNew = !existingOrder;
    await emitNotification(
      {
        dedupKey: isNew ? `wo-create:${docNo}` : `wo-update:${docNo}:${payload.stage || "Queue"}`,
        severity: isNew ? "info" : "success",
        category: "production",
        eventType: isNew ? "wo_status:created" : "wo_status:updated",
        entityCode: docNo,
        title: isNew ? `Yangi buyurtma: ${docNo}` : `Buyurtma yangilandi: ${docNo}`,
        description: `${customerName} — ${(data as any).productName || data.product || "Poligrafiya mahsuloti"} (${data.quantity || 0} ${data.unit || "pcs"}). Bosqich: ${payload.stage || "Queue"}.`,
        link: { module: "production", subModule: "work-orders" },
        targetTab: {
          id: `wo-${docNo}`,
          title: `${docNo} (Buyurtma)`,
          type: "work-order",
          module: "production",
        },
      },
      companyCode
    );
  } catch (_) {}

  // 6. Draft davrida yaratilgan yetkazib beruvchi buyurtmalarini (PO) ushbu workOrderId ga bog'lash
  try {
    await db
      .update(supplierOrders)
      .set({ workOrderId: targetId })
      .where(
        and(
          eq(supplierOrders.workOrderNo, docNo),
          isNull(supplierOrders.workOrderId)
        )
      );
  } catch (poErr) {
    console.error("[WorkOrder] Supplier orders bog'lashda xatolik:", poErr);
  }

  // Telegram guruhidagi statusni yangilash yoki avtomatik yangi buyurtmani yuborish
  try {
    const specsChanged = Boolean(
      existingOrder?.telegramMeta && (
        existingOrder.quantity !== payload.quantity ||
        existingOrder.paperStock !== payload.paperStock ||
        existingOrder.coating !== payload.coating ||
        existingOrder.lamination !== payload.lamination ||
        existingOrder.embellishment !== payload.embellishment ||
        JSON.stringify(existingOrder.dimensions) !== JSON.stringify(payload.dimensions)
      )
    );

    updateTelegramOrderCardStatus(targetId, companyCode, specsChanged).catch(() => {});

    const comp = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });
    if (
      comp?.settings?.telegram?.autoSendNewOrders &&
      comp?.settings?.telegram?.ordersChatId &&
      !existingOrder?.telegramMeta &&
      (statusVal === "Active" || statusVal === "In Production")
    ) {
      sendWorkOrderToOrdersGroup({
        workOrderId: targetId,
        companyCode,
      }).catch((e) => console.warn("[WorkOrder] Auto send to telegram failed:", e));
    }
  } catch (_) {
  }

  return {
    success: true,
    workOrder: {
      ...payload,
      id: targetId,
    },
  };
}

/**
 * Credit control at the gate to production (business rules §1): an order of a client who is over
 * their credit limit or has overdue debt is not released. An urgent order may be released by a
 * director or administrator; that release is written to the order's audit log.
 * Returns the hold reason when the order must wait, null when it may go.
 */
export async function checkCreditHold(params: {
  companyId: string;
  clientId: string | null | undefined;
  workOrderId?: string;
  docNo: string;
  priority: string | null | undefined;
  author?: { id?: string; name?: string; role?: string; initials?: string };
  exec?: DbExec;
}): Promise<string | null> {
  if (!params.clientId) return null;
  const credit = await getClientCreditState(params.exec ?? db, params.companyId, params.clientId);
  if (!credit?.blocked) return null;

  if (params.priority === "Urgent" && canOverrideCreditHold(params.author?.role)) {
    if (params.workOrderId) {
      try {
        await recordWorkOrderAuditLog({
          companyId: params.companyId,
          workOrderId: params.workOrderId,
          docNo: params.docNo,
          action: "update",
          author: {
            id: params.author?.id || "system",
            name: params.author?.name || "Rahbar",
            role: params.author?.role || "Director",
            initials: params.author?.initials,
          },
          category: "status",
          actionText: "Kredit cheklovi rahbar ruxsati bilan chetlab o'tildi",
          details: credit.reason || undefined,
          badgeText: "Urgent",
          badgeVariant: "destructive",
        });
      } catch (auditErr) {
        console.error("[WorkOrder Audit] Kredit ruxsatini yozishda xatolik:", auditErr);
      }
    }
    return null;
  }
  return `${credit.reason} Buyurtma ishlab chiqarishga chiqarilmaydi. Shoshilinch buyurtmani faqat rahbar chiqara oladi.`;
}

/**
 * Buyurtmani xavfsiz o'chirish yoki bekor qilish (Soft Delete / Hard Delete)
 */
export async function deleteWorkOrder(
  docNoOrId: string,
  companyCode: string = "PRINTGOO",
  author?: { id?: string; name?: string; role?: string },
  mode: "auto" | "cancel" | "hard_delete" = "auto",
  cancelReason?: string
): Promise<{ success: boolean; mode: "deleted" | "cancelled"; docNo: string; message: string }> {
  const companyId = await getCompanyIdByCode(companyCode);

  const hasValidUuid = isUuid(docNoOrId);
  const existingOrder = await db.query.workOrders.findFirst({
    where: (wo, { and, eq, or }) =>
      and(
        eq(wo.companyId, companyId),
        hasValidUuid ? or(eq(wo.docNo, docNoOrId), eq(wo.id, docNoOrId)) : eq(wo.docNo, docNoOrId)
      ),
    with: {
      operations: true,
      events: true,
    },
  });

  if (!existingOrder) {
    throw new Error(`Buyurtma topilmadi: ${docNoOrId}`);
  }

  // 1. Bog'langan yetkazib berish aktlarini tekshirish
  const linkedActs = await db.query.deliveryActs.findMany({
    where: (act, { eq }) => eq(act.workOrderId, existingOrder.id),
  });

  // 2. Ishlab chiqarish jarayoni boshlanganligini tekshirish
  const hasOperationsProgress = existingOrder.operations?.some(
    (op) => Number(op.completedQty) > 0 || op.status === "completed" || op.status === "in_progress"
  );
  const hasEventsProgress = existingOrder.events?.some(
    (ev) => (ev.goodOutput !== null && ev.goodOutput > 0) || (ev.wasteQty !== null && ev.wasteQty > 0)
  );
  const isStarted = existingOrder.stage !== "Queue" || Boolean(hasOperationsProgress) || Boolean(hasEventsProgress);
  const hasDependencies = linkedActs.length > 0 || isStarted;

  // Agar ishlab chiqarish boshlangan yoki akt chiqarilgan bo'lsa, butunlay o'chirib bo'lmaydi
  if (hasDependencies && mode === "hard_delete") {
    throw new Error(
      `Buyurtma (${existingOrder.docNo}) bo'yicha ishlab chiqarish boshlangan yoki yetkazib berish akti mavjud. Uni bazadan butunlay o'chirib bo'lmaydi, faqat bekor qilish (Cancel) mumkin.`
    );
  }

  const effectiveMode = hasDependencies || mode === "cancel" ? "cancel" : "hard_delete";

  const currentAuthor = author || {
    id: "system",
    name: "Tizim administratori",
    role: "System Administrator",
  };

  if (effectiveMode === "cancel") {
    // Bekor qilish (Пометка на удаление / Cancel)
    // Goods of this order that a shipment has reserved would be left hanging: release those first.
    const heldShipments = await db
      .selectDistinct({ shipmentNumber: warehouseShipments.shipmentNumber })
      .from(warehouseShipments)
      .leftJoin(warehouseShipmentItems, eq(warehouseShipmentItems.shipmentId, warehouseShipments.id))
      .where(
        and(
          eq(warehouseShipments.companyId, companyId),
          inArray(warehouseShipments.status, ["Reserved", "Picking", "Packed"]),
          or(
            eq(warehouseShipments.workOrderId, existingOrder.docNo),
            eq(warehouseShipmentItems.sourceWorkOrderId, existingOrder.docNo)
          )
        )
      );
    if (heldShipments.length > 0) {
      throw new Error(
        `${existingOrder.docNo} mahsuloti ombor chiqimida band qilingan (${heldShipments
          .map((s) => s.shipmentNumber)
          .join(", ")}). Avval chiqimni bekor qiling.`
      );
    }

    await db.transaction(async (tx) => {
      // Boxes handed to the warehouse but not yet received go back to the shop.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pkg = existingOrder.packagingData as any;
      const boxes = Array.isArray(pkg?.boxes)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pkg.boxes.map((box: any) => (box.status === "handed" ? { ...box, status: "ready", handedOverAt: undefined } : box))
        : null;

      await tx
        .update(workOrders)
        .set({
          status: "Cancelled",
          cancelReason: cancelReason || null,
          ...(boxes ? { packagingData: { ...pkg, boxes } } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workOrders.id, existingOrder.id));

      // A hand-over the warehouse has not confirmed is withdrawn; stock already received stays.
      await tx
        .update(warehouseFinishedGoods)
        .set({
          pendingQuantity: "0",
          receiptStatus: "Received",
          notes: `Buyurtma bekor qilindi: kutilayotgan qabul olib tashlandi`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(warehouseFinishedGoods.companyId, companyId),
            eq(warehouseFinishedGoods.workOrderId, existingOrder.docNo),
            sql`${warehouseFinishedGoods.pendingQuantity} > 0`
          )
        );
    });

    // Purchases made for this order are still on their way: procurement has to decide about them.
    try {
      const openPurchases = await db.query.supplierOrders.findMany({
        where: and(
          eq(supplierOrders.companyId, companyId),
          eq(supplierOrders.workOrderId, existingOrder.id),
          inArray(supplierOrders.status, ["Draft", "Ordered", "In_Production", "Ready"])
        ),
        columns: { orderNo: true },
      });
      if (openPurchases.length > 0) {
        await emitNotification(
          {
            dedupKey: `wo-cancel-po:${existingOrder.docNo}`,
            severity: "warning",
            category: "production",
            eventType: "wo_status:cancelled",
            entityCode: existingOrder.docNo,
            title: `${existingOrder.docNo} bekor qilindi: ta'minot buyurtmalari ochiq`,
            description: `Ochiq buyurtmalar: ${openPurchases.map((p) => p.orderNo).join(", ")}.`,
            link: { module: "production", subModule: "work-orders" },
          },
          companyCode
        );
      }
    } catch (poErr) {
      console.error("[WorkOrder] Ta'minot buyurtmalarini tekshirishda xatolik:", poErr);
    }

    // Telegram guruhidagi xabarni avtomatik yangilash
    try {
      updateTelegramOrderCardStatus(existingOrder.id, companyCode).catch(() => {});
    } catch (_) {}

    const safeAuthor = {
      id: currentAuthor.id || "system",
      name: currentAuthor.name || "System Administrator",
      role: currentAuthor.role || "Administrator",
    };

    try {
      await recordWorkOrderAuditLog({
        companyId,
        workOrderId: existingOrder.id,
        docNo: existingOrder.docNo,
        action: "update",
        author: safeAuthor,
        category: "status",
        actionText: `Buyurtma bekor qilindi (O'chirishga belgilandi): ${existingOrder.docNo}`,
        details: cancelReason ? `Sabab: ${cancelReason}` : "Buyurtma foydalanuvchi tomonidan bekor qilindi.",
        badgeText: "Cancelled",
        badgeVariant: "destructive",
      });
    } catch (_) {}

    return {
      success: true,
      mode: "cancelled",
      docNo: existingOrder.docNo,
      message: `${existingOrder.docNo} buyurtmasi bekor qilindi va navbatdan chiqarildi.`,
    };
  } else {
    // Butunlay tozalash (Hard Delete — toza qoralama / dubl uchun)
    await db.delete(workOrderOperations).where(eq(workOrderOperations.workOrderId, existingOrder.id));
    await db.delete(workOrderEvents).where(eq(workOrderEvents.workOrderId, existingOrder.id));
    await db.delete(workOrderAttachments).where(eq(workOrderAttachments.workOrderId, existingOrder.id));
    await db.delete(workOrders).where(eq(workOrders.id, existingOrder.id));

    const safeAuthor = {
      id: currentAuthor.id || "system",
      name: currentAuthor.name || "System Administrator",
      role: currentAuthor.role || "Administrator",
    };

    try {
      await recordWorkOrderAuditLog({
        companyId,
        workOrderId: existingOrder.id,
        docNo: existingOrder.docNo,
        action: "delete",
        author: safeAuthor,
        category: "status",
        actionText: `Buyurtma bazadan butunlay o'chirildi: ${existingOrder.docNo}`,
        details: `Mijoz: ${existingOrder.customerName} • Mahsulot: ${existingOrder.productName}`,
        badgeText: "Deleted",
        badgeVariant: "destructive",
      });
    } catch (_) {}

    return {
      success: true,
      mode: "deleted",
      docNo: existingOrder.docNo,
      message: `${existingOrder.docNo} buyurtmasi bazadan butunlay o'chirildi.`,
    };
  }
}

/**
 * Buyurtmaning tayyorlik nazorati (checks), bosqich (stage) yoki dastgohini tezkor yangilash
 */
export async function updateWorkOrderReadiness(
  docNoOrId: string,
  updates: {
    stage?: string;
    queueOrder?: number;
    checks?: any;
    pressMachine?: string;
    status?: string;
    completedSheets?: number;
    actualEndDate?: string;
  },
  companyCode: string = "PRINTGOO",
  author?: { id?: string; name?: string; role?: string }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const companyId = await getCompanyIdByCode(companyCode);
    const hasValidUuid = isUuid(docNoOrId);

    const existingOrder = await db.query.workOrders.findFirst({
      where: (wo, { and, eq, or }) =>
        and(
          eq(wo.companyId, companyId),
          hasValidUuid ? or(eq(wo.id, docNoOrId), eq(wo.docNo, docNoOrId)) : eq(wo.docNo, docNoOrId)
        ),
    });

    if (!existingOrder) {
      return { success: false, error: "Buyurtma topilmadi" };
    }

    const patchPayload: any = {
      updatedAt: new Date(),
    };

    // "In Production" and "Completed" come from the steps (shift journal), not from a click.
    if (updates.stage === "Queue" || updates.stage === "Ready to Print") {
      if (existingOrder.stage !== "In Production" && existingOrder.stage !== "Completed") {
        patchPayload.stage = updates.stage;
      }
    }
    if (updates.queueOrder !== undefined && Number.isFinite(Number(updates.queueOrder))) {
      patchPayload.queueOrder = Math.round(Number(updates.queueOrder));
    }

    if (updates.pressMachine !== undefined) {
      patchPayload.pressMachine = updates.pressMachine;
    }


    if (updates.actualEndDate !== undefined) {
      patchPayload.actualEndDate = updates.actualEndDate;
    }

    let mergedChecks = (existingOrder.checks as any) || {
      designReady: false,
      paperReady: false,
      platesReady: false,
      toolingReady: false,
    };

    if (updates.checks !== undefined && updates.checks !== null) {
      mergedChecks = {
        designReady:
          updates.checks.designReady !== undefined
            ? !!updates.checks.designReady
            : !!mergedChecks.designReady,
        paperReady:
          updates.checks.paperReady !== undefined
            ? !!updates.checks.paperReady
            : !!mergedChecks.paperReady,
        platesReady:
          updates.checks.platesReady !== undefined
            ? !!updates.checks.platesReady
            : !!mergedChecks.platesReady,
        toolingReady:
          updates.checks.toolingReady !== undefined
            ? !!updates.checks.toolingReady
            : !!mergedChecks.toolingReady,
        audit: {
          ...(mergedChecks.audit || {}),
          ...(updates.checks.audit || {}),
        },
      };
      patchPayload.checks = mergedChecks;
    }

    // Bosqichni avtomatik ko'tarish yoki tushirish (agar stage to'g'ridan-to'g'ri berilmagan bo'lsa)
    if (updates.stage === undefined && patchPayload.checks) {
      const allReady =
        patchPayload.checks.designReady &&
        patchPayload.checks.paperReady &&
        patchPayload.checks.platesReady &&
        patchPayload.checks.toolingReady;

      if (allReady && existingOrder.stage === "Queue") {
        patchPayload.stage = "Ready to Print";
      } else if (!allReady && existingOrder.stage === "Ready to Print") {
        patchPayload.stage = "Queue";
      }
    }

    // Credit control: a release to the floor is refused when asked for, and simply not done
    // when it would only follow from the readiness checks (the checks themselves are still saved).
    let creditHold: string | null = null;
    if (patchPayload.stage === "Ready to Print" && existingOrder.stage !== "Ready to Print") {
      creditHold = await checkCreditHold({
        companyId,
        clientId: existingOrder.clientId,
        workOrderId: existingOrder.id,
        docNo: existingOrder.docNo,
        priority: existingOrder.priority,
        author,
      });
      if (creditHold) {
        if (updates.stage === "Ready to Print") return { success: false, error: creditHold };
        patchPayload.stage = undefined;
      }
    }

    // Only Draft / Active / Cancelled are taken from the request; production statuses follow the stage.
    const nextStatus = deriveWorkOrderStatus(updates.status ?? existingOrder.status, patchPayload.stage ?? existingOrder.stage);
    if (nextStatus !== existingOrder.status) patchPayload.status = nextStatus;

    await db
      .update(workOrders)
      .set(patchPayload)
      .where(eq(workOrders.id, existingOrder.id));

    // Telegram guruhidagi xabarni avtomatik yangilash
    try {
      updateTelegramOrderCardStatus(existingOrder.id, companyCode).catch(() => {});
    } catch (_) {}

    return {
      success: true,
      data: {
        id: existingOrder.docNo,
        docNo: existingOrder.docNo,
        stage: patchPayload.stage || existingOrder.stage,
        checks: patchPayload.checks || existingOrder.checks,
        pressMachine: patchPayload.pressMachine || existingOrder.pressMachine,
        status: patchPayload.status || existingOrder.status,
        ...(creditHold ? { creditHold } : {}),
      },
    };
  } catch (error: any) {
    console.error("updateWorkOrderReadiness error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Yangilashda xatolik yuz berdi",
    };
  }
}

// ─── Production Machines CRUD ───────────────────────────────────────────────

function formatMachineDbToRecord(m: any): any {
  return {
    id: m.id,
    companyId: m.companyId || undefined,
    branchId: m.branchId || undefined,
    departmentId: m.departmentId || undefined,
    code: m.code,
    name: m.name,
    department: m.department || "Offset",
    category: m.category || "offset",
    speed: m.speed || "",
    format: m.format || "",
    features: m.features || "",
    manufacturer: m.manufacturer || "",
    country: m.country || "",
    year: m.year || new Date().getFullYear(),
    serialNo: m.serialNo || "",
    imageUrl: m.imageUrl || undefined,
    location: m.location || "",
    leadOperator: m.leadOperator || "",
    assistantOperator: m.assistantOperator || "",
    shiftPattern: m.shiftPattern || "",
    // The column defaults to "Available", which is not a MachineStatus.
    status: ["Running", "Idle", "Maintenance", "Setup"].includes(m.status) ? m.status : "Idle",
    overallEfficiency: m.overallEfficiency || 90,
    totalLifetimeCounter: Number(m.totalLifetimeCounter) || 0,
    counterUnit: m.counterUnit || "sheets",
    offsetSpecs: m.category === "offset" ? m.specs : undefined,
    flexoSpecs: m.category === "flexo" ? m.specs : undefined,
    dieCuttingSpecs: m.category === "die-cutting" ? m.specs : undefined,
    laminationSpecs: m.category === "lamination" ? m.specs : undefined,
    guillotineSpecs: m.category === "guillotine" ? m.specs : undefined,
    jacquardSpecs: m.category === "jacquard" ? m.specs : undefined,
    mountingSpecs: m.category === "mounting" ? m.specs : undefined,
    casingInSpecs: m.category === "casing-in" ? m.specs : undefined,
    energy: m.energy || {
      installedPowerKw: Number(m.powerKw) || 0,
      activePowerKw: Number(m.powerKw) || 0,
      standbyPowerKw: 0,
      dryerHeatingKw: 0,
      compressedAirBar: 0,
      compressedAirCfm: 0,
      chillerPowerKw: 0,
      electricityTariffUsd: 0.08,
      hourlyElectricityCostUsd: 0,
      monthlyHoursPlanned: 160,
      monthlyPowerCostUsd: 0,
    },
    costing: m.costing || {
      investmentUsd: 0,
      depreciationYears: 8,
      annualWorkHours: 2000,
      hourlyDepreciationUsd: 0,
      hourlyElectricityUsd: 0,
      hourlyMaintenanceReserveUsd: 0,
      operatorHourlyWageUsd: 0,
      assistantHourlyWageUsd: 0,
      factoryOverheadUsd: 0,
      totalBaseCostPerHourUsd: 0,
      standardHourlyRateUsd: Number(m.hourlyRate) || 0,
      markupPercent: 30,
    },
    telemetry: m.telemetry || {
      temperatureC: 22,
      vibrationMmS: 0,
      oilPressureBar: 0,
    },
    maintenanceLogs: m.maintenanceLogs || [],
    notes: m.notes || "",
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export async function getProductionMachines(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.productionMachines.findMany({
    where: eq(productionMachines.companyId, companyId),
    orderBy: [desc(productionMachines.createdAt)],
  });

  return rows.map(formatMachineDbToRecord);
}

export async function getProductionMachineById(id: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const row = await db.query.productionMachines.findFirst({
    where: and(
      eq(productionMachines.companyId, companyId),
      or(eq(productionMachines.id, id), eq(productionMachines.code, id))
    ),
  });
  return row ? formatMachineDbToRecord(row) : null;
}

export async function getNextMachineCode(companyCode: string = "PRINTGOO"): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.productionMachines.findMany({
    where: eq(productionMachines.companyId, companyId),
    columns: { code: true },
  });

  let maxNum = 0;
  for (const r of rows) {
    const match = r.code?.match(/^MAC-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `MAC-${String(nextNum).padStart(4, "0")}`;
}

export async function createProductionMachine(data: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const specs = data.offsetSpecs || data.flexoSpecs || data.dieCuttingSpecs || data.laminationSpecs || data.guillotineSpecs || data.jacquardSpecs || data.mountingSpecs || data.casingInSpecs || data.specs || {};
  const hourlyRate = data.costing?.standardHourlyRateUsd !== undefined ? String(data.costing.standardHourlyRateUsd) : String(data.hourlyRate || 0);
  const powerKw = data.energy?.activePowerKw !== undefined ? String(data.energy.activePowerKw) : String(data.powerKw || 0);

  const code = (data.code && data.code.trim() && !data.code.startsWith("new-") && !data.code.startsWith("EQ-new-"))
    ? data.code.trim()
    : await getNextMachineCode(companyCode);

  const [inserted] = await db
    .insert(productionMachines)
    .values({
      companyId: data.companyId || companyId,
      branchId: data.branchId || null,
      departmentId: data.departmentId || null,
      code,
      name: data.name,
      department: data.department || "Offset",
      category: data.category || "offset",
      speed: data.speed || (data.offsetSpecs ? `${data.offsetSpecs.maxSpeedSph} sheets/hr` : null),
      format: data.format || (data.offsetSpecs ? data.offsetSpecs.maxSheetMm : null),
      features: data.features || null,
      manufacturer: data.manufacturer || null,
      country: data.country || null,
      year: data.year ? Number(data.year) : null,
      serialNo: data.serialNo || null,
      imageUrl: data.imageUrl || null,
      location: data.location || null,
      leadOperator: data.leadOperator || null,
      assistantOperator: data.assistantOperator || null,
      shiftPattern: data.shiftPattern || null,
      hourlyRate,
      powerKw,
      overallEfficiency: data.overallEfficiency ? Number(data.overallEfficiency) : 90,
      totalLifetimeCounter: data.totalLifetimeCounter !== undefined ? String(data.totalLifetimeCounter) : "0",
      counterUnit: data.counterUnit || "sheets",
      specs,
      energy: data.energy || null,
      costing: data.costing || null,
      telemetry: data.telemetry || null,
      maintenanceLogs: data.maintenanceLogs || [],
      notes: data.notes || null,
      status: data.status || "Idle",
      isAvailable: data.isAvailable ?? true,
    })
    .returning();
  return formatMachineDbToRecord(inserted);
}

export async function updateProductionMachine(id: string, data: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const specs = data.offsetSpecs || data.flexoSpecs || data.dieCuttingSpecs || data.laminationSpecs || data.guillotineSpecs || data.jacquardSpecs || data.mountingSpecs || data.casingInSpecs || data.specs;
  const updatePayload: any = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) updatePayload.code = data.code;
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.department !== undefined) updatePayload.department = data.department;
  if (data.category !== undefined) updatePayload.category = data.category;
  if (data.speed !== undefined) updatePayload.speed = data.speed;
  if (data.format !== undefined) updatePayload.format = data.format;
  if (data.features !== undefined) updatePayload.features = data.features;
  if (data.manufacturer !== undefined) updatePayload.manufacturer = data.manufacturer;
  if (data.country !== undefined) updatePayload.country = data.country;
  if (data.year !== undefined) updatePayload.year = Number(data.year);
  if (data.serialNo !== undefined) updatePayload.serialNo = data.serialNo;
  if (data.companyId !== undefined) updatePayload.companyId = data.companyId || companyId;
  if (data.imageUrl !== undefined) updatePayload.imageUrl = data.imageUrl || null;
  if (data.branchId !== undefined) updatePayload.branchId = data.branchId || null;
  if (data.departmentId !== undefined) updatePayload.departmentId = data.departmentId || null;
  if (data.location !== undefined) updatePayload.location = data.location;
  if (data.leadOperator !== undefined) updatePayload.leadOperator = data.leadOperator;
  if (data.assistantOperator !== undefined) updatePayload.assistantOperator = data.assistantOperator;
  if (data.shiftPattern !== undefined) updatePayload.shiftPattern = data.shiftPattern;
  if (data.costing?.standardHourlyRateUsd !== undefined) updatePayload.hourlyRate = String(data.costing.standardHourlyRateUsd);
  else if (data.hourlyRate !== undefined) updatePayload.hourlyRate = String(data.hourlyRate);
  if (data.energy?.activePowerKw !== undefined) updatePayload.powerKw = String(data.energy.activePowerKw);
  else if (data.powerKw !== undefined) updatePayload.powerKw = String(data.powerKw);
  if (data.overallEfficiency !== undefined) updatePayload.overallEfficiency = Number(data.overallEfficiency);
  if (data.totalLifetimeCounter !== undefined) updatePayload.totalLifetimeCounter = String(data.totalLifetimeCounter);
  if (data.counterUnit !== undefined) updatePayload.counterUnit = data.counterUnit;
  if (specs !== undefined) updatePayload.specs = specs;
  if (data.energy !== undefined) updatePayload.energy = data.energy;
  if (data.costing !== undefined) updatePayload.costing = data.costing;
  if (data.telemetry !== undefined) updatePayload.telemetry = data.telemetry;
  if (data.maintenanceLogs !== undefined) updatePayload.maintenanceLogs = data.maintenanceLogs;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.isAvailable !== undefined) updatePayload.isAvailable = data.isAvailable;

  const [updated] = await db
    .update(productionMachines)
    .set(updatePayload)
    .where(
      and(
        eq(productionMachines.companyId, companyId),
        or(eq(productionMachines.id, id), eq(productionMachines.code, id))
      )
    )
    .returning();
  return updated ? formatMachineDbToRecord(updated) : null;
}

export async function deleteProductionMachine(id: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const [deleted] = await db
    .delete(productionMachines)
    .where(
      and(
        eq(productionMachines.companyId, companyId),
        or(eq(productionMachines.id, id), eq(productionMachines.code, id))
      )
    )
    .returning();
  return Boolean(deleted);
}

// ─── Production Specifications CRUD ─────────────────────────────────────────

export async function getProductionSpecifications(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.productionSpecifications.findMany({
    where: eq(productionSpecifications.companyId, companyId),
    orderBy: [desc(productionSpecifications.createdAt)],
  });
}

export async function getProductionSpecificationById(idOrCode: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const matchCondition = isUuid(idOrCode)
    ? or(eq(productionSpecifications.id, idOrCode), eq(productionSpecifications.code, idOrCode))
    : eq(productionSpecifications.code, idOrCode);

  return db.query.productionSpecifications.findFirst({
    where: and(eq(productionSpecifications.companyId, companyId), matchCondition),
  });
}

export async function upsertProductionSpecification(data: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const rawCode = (data.code || "").trim();
  const isDraft = !rawCode || rawCode.startsWith("draft-") || rawCode.startsWith("new-") || rawCode.startsWith("SPEC-NEW-") || rawCode === "NEW" || rawCode.includes("Qoralama") || rawCode.includes("Yangi");
  const targetCode = isDraft ? await getNextSpecNumber(companyCode) : rawCode;
  const hasValidUuid = data.id && isUuid(String(data.id));

  // Check if existing
  const existing = await db.query.productionSpecifications.findFirst({
    where: and(
      eq(productionSpecifications.companyId, companyId),
      hasValidUuid
        ? or(eq(productionSpecifications.id, data.id), eq(productionSpecifications.code, targetCode))
        : eq(productionSpecifications.code, targetCode)
    ),
  });

  const payload = {
    companyId,
    code: targetCode,
    name: data.name || "Nomsiz shablon",
    category: data.category || "Commercial Print",
    department: data.department || "Offset",
    status: data.status || "Active",
    version: data.version || "1.0",
    basePrice: String(data.basePrice ?? "0.00"),
    currency: data.currency || "USD",
    unit: data.unit || "1k pcs",
    description: data.description || null,
    baseMaterial: data.baseMaterial || null,
    dimensions: {
      width: Number(data.width ?? data.dimensions?.width ?? 210),
      height: Number(data.height ?? data.dimensions?.height ?? 297),
      depth: Number(data.depth ?? data.dimensions?.depth ?? 0),
      dimensionUnit: data.dimensionUnit || data.dimensions?.dimensionUnit || "mm",
    },
    techSpecs: data.techSpecs || {
      // Valyuta kursi (BOM narxlarini USD <-> UZS o'tkazish uchun)
      exchangeRate: data.exchangeRate !== undefined ? Number(data.exchangeRate) || null : undefined,
      // Offset
      sheetFormat: data.sheetFormat,
      grammage: data.grammage,
      colorsConfig: data.colorsConfig,
      lamination: data.lamination,
      coating: data.coating,
      kashirovkaMode: data.kashirovkaMode,
      toolingCode: data.toolingCode,
      boxType: data.boxType,
      // Flexo
      flexoWebWidth: data.flexoWebWidth,
      flexoGearTeeth: data.flexoGearTeeth,
      flexoCoreDiameter: data.flexoCoreDiameter,
      flexoWindingDirection: data.flexoWindingDirection,
      flexoLabelsPerRoll: data.flexoLabelsPerRoll,
      flexoPlateThickness: data.flexoPlateThickness,
      flexoWashResistance: data.flexoWashResistance,
      // Jacquard
      jacquardWeaveQuality: data.jacquardWeaveQuality,
      jacquardWarpYarn: data.jacquardWarpYarn,
      jacquardWeftYarn: data.jacquardWeftYarn,
      jacquardPicksPerCm: data.jacquardPicksPerCm,
      jacquardFoldType: data.jacquardFoldType,
      jacquardSewingAllowance: data.jacquardSewingAllowance,
    },
    materialsCount: Array.isArray(data.materials) ? data.materials.length : 0,
    estimatedCost: data.estimatedCost || "$0",
    materials: Array.isArray(data.materials) ? data.materials : [],
    operations: Array.isArray(data.operations) ? data.operations : [],
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(productionSpecifications)
      .set(payload)
      .where(eq(productionSpecifications.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(productionSpecifications)
    .values(payload)
    .returning();
  return inserted;
}

export async function createProductionSpecification(data: any, companyCode: string = "PRINTGOO") {
  return upsertProductionSpecification(data, companyCode);
}

export async function deleteProductionSpecification(idOrCode: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const matchCondition = isUuid(idOrCode)
    ? or(eq(productionSpecifications.id, idOrCode), eq(productionSpecifications.code, idOrCode))
    : eq(productionSpecifications.code, idOrCode);

  const [deleted] = await db
    .delete(productionSpecifications)
    .where(and(eq(productionSpecifications.companyId, companyId), matchCondition))
    .returning();
  return Boolean(deleted);
}

// ─── Production Sites (Branches) ────────────────────────────────────────────

export async function getProductionSites(companyCode: string = "all") {
  if (companyCode === "all" || !companyCode) {
    return db.query.branches.findMany({
      orderBy: [desc(branches.createdAt)],
    });
  }
  const companyId = isUuid(companyCode)
    ? companyCode
    : await getCompanyIdByCode(companyCode);
  return db.query.branches.findMany({
    where: eq(branches.companyId, companyId),
    orderBy: [desc(branches.createdAt)],
  });
}

export async function createProductionSite(data: any, companyCode: string = "PRINTGOO") {
  const companyId = (data.companyId && isUuid(String(data.companyId)))
    ? data.companyId
    : await getCompanyIdByCode(companyCode);
  const hasValidUuid = data.id && isUuid(String(data.id));

  let existing = null;
  if (hasValidUuid) {
    existing = await db.query.branches.findFirst({
      where: eq(branches.id, data.id),
    });
  }

  const resolvedStatus = data.status || (data.isActive === false ? "Inactive" : "Active");
  const resolvedIsActive = data.status ? data.status !== "Inactive" : (data.isActive ?? true);

  if (existing) {
    const [updated] = await db
      .update(branches)
      .set({
        companyId: (data.companyId && isUuid(String(data.companyId))) ? data.companyId : existing.companyId,
        name: data.name ?? existing.name,
        code: data.code ?? existing.code,
        shortName: data.shortName !== undefined ? data.shortName : existing.shortName,
        legalEntityName: data.legalEntityName !== undefined ? data.legalEntityName : existing.legalEntityName,
        branchType: data.branchType !== undefined ? data.branchType : existing.branchType,
        tin: data.tin !== undefined ? data.tin : existing.tin,
        vatNumber: data.vatNumber !== undefined ? data.vatNumber : existing.vatNumber,
        oked: data.oked !== undefined ? data.oked : existing.oked,
        address: data.address !== undefined ? data.address : existing.address,
        legalAddress: data.legalAddress !== undefined ? data.legalAddress : existing.legalAddress,
        landmark: data.landmark !== undefined ? data.landmark : existing.landmark,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        email: data.email !== undefined ? data.email : existing.email,
        director: data.director !== undefined ? data.director : existing.director,
        directorPhone: data.directorPhone !== undefined ? data.directorPhone : existing.directorPhone,
        chiefAccountant: data.chiefAccountant !== undefined ? data.chiefAccountant : existing.chiefAccountant,
        chiefAccountantPhone: data.chiefAccountantPhone !== undefined ? data.chiefAccountantPhone : existing.chiefAccountantPhone,
        productionHead: data.productionHead !== undefined ? data.productionHead : existing.productionHead,
        productionHeadPhone: data.productionHeadPhone !== undefined ? data.productionHeadPhone : existing.productionHeadPhone,
        shiftRegime: data.shiftRegime !== undefined ? data.shiftRegime : existing.shiftRegime,
        workingHours: data.workingHours !== undefined ? data.workingHours : existing.workingHours,
        daysOfWeek: data.daysOfWeek !== undefined ? data.daysOfWeek : existing.daysOfWeek,
        totalFloorAreaM2: data.totalFloorAreaM2 !== undefined ? Number(data.totalFloorAreaM2) || 0 : existing.totalFloorAreaM2,
        machinesCount: data.machinesCount !== undefined ? Number(data.machinesCount) || 0 : existing.machinesCount,
        status: data.status !== undefined ? data.status : existing.status,
        isMain: data.isMain !== undefined ? Boolean(data.isMain) : existing.isMain,
        isActive: resolvedIsActive,
        departments: data.departments !== undefined ? data.departments : existing.departments,
        warehouses: data.warehouses !== undefined ? data.warehouses : existing.warehouses,
        bankAccounts: data.bankAccounts !== undefined ? data.bankAccounts : existing.bankAccounts,
        integration: data.integration !== undefined ? data.integration : existing.integration,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, existing.id))
      .returning();
    return updated;
  }

  const allBranches = await db.query.branches.findMany({
    where: eq(branches.companyId, companyId),
    columns: { code: true },
  });
  const existingCodes = allBranches.map((b) => b.code);
  const existingUpperSet = new Set(
    existingCodes.filter(Boolean).map((c) => String(c).trim().toUpperCase())
  );

  let branchCode = data.code?.trim()?.toUpperCase();
  if (!branchCode || existingUpperSet.has(branchCode)) {
    branchCode = generateNextCode("BRN", existingCodes, 2);
  }

  const [inserted] = await db
    .insert(branches)
    .values({
      companyId,
      code: branchCode,
      name: data.name,
      shortName: data.shortName || null,
      legalEntityName: data.legalEntityName || null,
      branchType: data.branchType || null,
      tin: data.tin || null,
      vatNumber: data.vatNumber || null,
      oked: data.oked || null,
      address: data.address || null,
      legalAddress: data.legalAddress || null,
      landmark: data.landmark || null,
      phone: data.phone || null,
      email: data.email || null,
      director: data.director || null,
      directorPhone: data.directorPhone || null,
      chiefAccountant: data.chiefAccountant || null,
      chiefAccountantPhone: data.chiefAccountantPhone || null,
      productionHead: data.productionHead || null,
      productionHeadPhone: data.productionHeadPhone || null,
      shiftRegime: data.shiftRegime || null,
      workingHours: data.workingHours || null,
      daysOfWeek: data.daysOfWeek || null,
      totalFloorAreaM2: Number(data.totalFloorAreaM2) || 0,
      machinesCount: Number(data.machinesCount) || 0,
      status: resolvedStatus,
      isMain: Boolean(data.isMain),
      isActive: resolvedIsActive,
      departments: Array.isArray(data.departments) ? data.departments : [],
      warehouses: Array.isArray(data.warehouses) ? data.warehouses : [],
      bankAccounts: Array.isArray(data.bankAccounts) ? data.bankAccounts : [],
      integration: data.integration || {},
      notes: data.notes || null,
    })
    .returning();
  return inserted;
}

export async function deleteProductionSite(id: string) {
  const [deleted] = await db
    .delete(branches)
    .where(eq(branches.id, id))
    .returning();
  return deleted;
}

// ─── Work Order Attachments CRUD ────────────────────────────────────────────

export async function getWorkOrderAttachments(workOrderId: string) {
  return db.query.workOrderAttachments.findMany({
    where: eq(workOrderAttachments.workOrderId, workOrderId),
    orderBy: [desc(workOrderAttachments.createdAt)],
  });
}

export async function createWorkOrderAttachment(data: {
  workOrderId: string;
  name: string;
  category: "proofs" | "artwork" | "dieline" | "docs";
  fileType: string;
  fileSize?: string;
  storagePath: string;
  url: string;
  uploadedBy?: string;
}) {
  const [inserted] = await db.insert(workOrderAttachments).values(data).returning();
  return inserted;
}

export async function deleteWorkOrderAttachment(params: {
  workOrderId: string;
  attachmentId?: string;
  url?: string;
}) {
  const { workOrderId, attachmentId, url } = params;

  let found: any = null;
  if (attachmentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attachmentId)) {
    found = await db.query.workOrderAttachments.findFirst({
      where: (a, { and, eq }) => and(eq(a.workOrderId, workOrderId), eq(a.id, attachmentId)),
    });
  }
  if (!found && url) {
    found = await db.query.workOrderAttachments.findFirst({
      where: (a, { and, eq }) => and(eq(a.workOrderId, workOrderId), eq(a.url, url)),
    });
  }
  if (!found && attachmentId) {
    found = await db.query.workOrderAttachments.findFirst({
      where: (a, { and, eq }) => and(eq(a.workOrderId, workOrderId), eq(a.id, attachmentId)),
    });
  }

  if (found) {
    await db.delete(workOrderAttachments).where(eq(workOrderAttachments.id, found.id));
    if (found.storagePath) {
      try {
        await deleteStorageObject({ bucket: "prepress", objectKey: found.storagePath });
      } catch (s3Err) {
        console.warn("[deleteWorkOrderAttachment] S3 object delete failed:", s3Err);
      }
    }
  }

  // Agar ushbu fayl buyurtmaning asosiy fotosurati (photoUrl) yoki photoUrls ro'yxatida bo'lsa, tozalaymiz
  const targetUrl = found?.url || url;
  if (targetUrl) {
    const wo = await db.query.workOrders.findFirst({
      where: (w, { eq }) => eq(w.id, workOrderId),
    });
    if (wo) {
      const currentPhotos = (wo.photoUrls as string[]) || [];
      const updatedPhotos = currentPhotos.filter((u) => u !== targetUrl);
      const isPhotoUrlAffected = wo.photoUrl === targetUrl;
      const newPrimaryPhoto = isPhotoUrlAffected ? updatedPhotos[0] || null : wo.photoUrl;

      if (currentPhotos.length !== updatedPhotos.length || isPhotoUrlAffected) {
        await db
          .update(workOrders)
          .set({
            photoUrl: newPrimaryPhoto,
            photoUrls: updatedPhotos,
          })
          .where(eq(workOrders.id, workOrderId));
      }
    }
  }

  return { success: true, deleted: found || null };
}

/**
 * Box states the warehouse owns (received in stock, dispatched) are written by the warehouse service;
 * an order saved from a tab opened earlier must not roll them back.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeWarehouseBoxStates(incoming: any, existing: any): any {
  const next = incoming || {};
  if (!Array.isArray(next.boxes) || !existing || !Array.isArray(existing.boxes)) return next;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = new Map<string, any>(existing.boxes.map((b: any) => [String(b.id), b]));
  return {
    ...next,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    boxes: next.boxes.map((box: any) => {
      const db = stored.get(String(box.id));
      if (!db || (db.status !== "in_stock" && db.status !== "dispatched")) return box;
      return { ...box, status: db.status, shipmentId: db.shipmentId, receivedAt: db.receivedAt, handedOverAt: db.handedOverAt };
    }),
  };
}
