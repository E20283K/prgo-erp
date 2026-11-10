
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

import { db } from "@/db";
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
  supplierOrders,
} from "@/db/schema";
import { eq, desc, and, or, ilike, isNull } from "drizzle-orm";
import type { ProductionQueueItem } from "@/store/workspaceStore";
import type { WorkOrderFormData, RouteStep } from "@/components/documents/work-order/types";
import { getCompanyIdByCode } from "./crmService";
import { generateNextCode } from "@/lib/utils";
import { getNextSpecNumber } from "./numberingService";
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

/**
 * Vaqtinchalik Flexo Imposition keshidagi faylni (qirqilgan SKU PDF yoki generatsiya qilingan film/prevyu)
 * MinIO S3 ga doimiy saqlab, /api/v1/storage/file havolasiga aylantiradi.
 */
export async function persistCachedImpositionUrlToS3(
  docNo: string,
  url?: string | null,
  preferredName?: string
): Promise<string | undefined> {
  if (!url || typeof url !== "string") return undefined;
  if (!url.includes("/api/flexo-imposition/")) {
    return url;
  }

  try {
    const rawFileName = preferredName || url.split("/").pop()?.split("?")[0] || "artwork.pdf";
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `PRINTGOO/orders/${docNo}/artwork/${cleanFileName}`;
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

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

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
      customer: wo.customerName,
      product: wo.productName,
      quantity: Number(wo.quantity) || 0,
      unit: wo.unit || "pcs",
      pressMachine: wo.pressMachine || "",
      department: wo.department || "Offset",
      priority: (wo.priority as any) || "Normal",
      stage: (wo.stage as any) || "Queue",
      status: (wo.status as any) || "Draft",
      queueOrder: index + 1,
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
      plannedSheets: Number(wo.quantity) || 0,
      completedSheets: 0,
      operator: wo.operator || undefined,
      shift: wo.shift || undefined,
      recipe: wo.recipeCode || "",
      site: wo.site || "",
      priceTotal: Number(wo.priceTotal) || 0,
      currency: wo.currency || "UZS",

      // Asosiy spetsifikatsiya materiallari va pardozlash
      paperStock: wo.paperStock || dims.paperStock || "",
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
      kashirovkaMakeReadySheets: dims.kashirovkaMakeReadySheets ?? 0,
      kashirovkaCuringHours: dims.kashirovkaCuringHours ?? 0,

      // Shtansforma / Asbob-uskuna
      toolingItems: dims.toolingItems || [],
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
      events: wo.events || [],
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
          operator: op.operator || "",
          duration: Number(op.durationHours || 1),
          toolingId: op.toolingId || undefined,
          toolingName: op.toolingName || undefined,
          tariffId: op.tariffId || undefined,
          tariffCode: op.tariffCode || undefined,
          calcUnit: op.calcUnit || undefined,
          unitDivisor: op.unitDivisor || 1000,
          rateUsd: Number(op.rateUsd || 0),
          setupFeeUsd: Number(op.setupFeeUsd || 0),
          pieceworkRateUsd: Number(op.pieceworkRateUsd || 0),
          plannedCostUsd: Number(op.plannedCostUsd || 0),
          pieceworkTotalUsd: Number(op.pieceworkTotalUsd || 0),
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
  department: string = "Offset"
): Promise<string> {
  const companyId = await getCompanyIdByCode(companyCode);
  const normalizedDept = normalizeDepartment(department);
  const prefix = WO_DEPT_PREFIXES[normalizedDept] || "WOOF";
  const yearSuffix = getCurrentYearSuffix();
  const pattern = `${prefix}-${yearSuffix}-%`;

  const rows = await db
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
  let clientId: string | null = null;
  const clientRecord = await db.query.clients.findFirst({
    where: (c, { and, eq, ilike }) =>
      and(eq(c.companyId, companyId), ilike(c.name, customerName)),
  });
  if (clientRecord) {
    clientId = clientRecord.id;
  }

  // 2. Mavjud buyurtmani qidirish
  const existingOrder = await db.query.workOrders.findFirst({
    where: (wo, { and, eq }) => and(eq(wo.companyId, companyId), eq(wo.docNo, docNo)),
  });

  const rawStatus = (data.status || "").trim();
  let statusVal: "Draft" | "Active" | "In Production" | "Completed" | "Cancelled" = "Active";
  if (rawStatus === "Draft") statusVal = "Draft";
  else if (rawStatus === "Active") statusVal = "Active";
  else if (rawStatus === "In Production" || rawStatus === "In_Production") statusVal = "In Production";
  else if (rawStatus === "Completed") statusVal = "Completed";
  else if (rawStatus === "Cancelled") statusVal = "Cancelled";
  else statusVal = "Active";

  let stageVal: any = (data as any).stage || existingOrder?.stage || "Queue";
  if (statusVal === "In Production" && (!stageVal || stageVal === "Queue")) {
    stageVal = "In Production";
  } else if (statusVal === "Completed") {
    stageVal = "Completed";
  }

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
      holeSize: data.holeSize,
      holePosition: data.holePosition,
      holeOffset: data.holeOffset,
      sizes: data.sizes ?? (data as any).dimensions?.sizes ?? (existingOrder?.dimensions as any)?.sizes ?? [],
      skuArtworks: resolvedSkuArtworks,
      kashirovkaMode: data.kashirovkaMode,
      kashirovkaStrategy: data.kashirovkaStrategy,
      kashirovkaLayers: data.kashirovkaLayers,
      kashirovkaGlueGsm: data.kashirovkaGlueGsm,
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
      flexoColors: data.flexoColors,
      financials: data.financials,
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
    packagingData: data.packagingData || {},
    deliveryBatches: data.deliveryBatches || [],
    notes: (data as any).notes || null,
    updatedAt: new Date(),
  };

  let targetId: string;

  const currentAuthor = {
    id: data.author?.id || data.user?.id,
    name: data.author?.name || data.user?.name || "Operator",
    role: data.author?.role || data.user?.role || "Operator",
    initials: data.author?.initials || data.user?.initials,
  };

  if (existingOrder) {
    targetId = existingOrder.id;
    await db.update(workOrders).set(payload).where(eq(workOrders.id, targetId));

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
    const [inserted] = await db.insert(workOrders).values(payload).returning({ id: workOrders.id });
    targetId = inserted.id;

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

  // 3. Marshrut operatsiyalarini (operations) saqlash
  if (data.operations && Array.isArray(data.operations)) {
    await db.delete(workOrderOperations).where(eq(workOrderOperations.workOrderId, targetId));
    if (data.operations.length > 0) {
      await db.insert(workOrderOperations).values(
        data.operations.map((op: any, idx: number) => {
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
            workOrderId: targetId,
            tariffId: op.tariffId && op.tariffId.length > 20 ? op.tariffId : null,
            tariffCode: op.tariffCode || null,
            name: op.name || `Bosqich ${idx + 1}`,
            department: op.department || data.department || "Offset",
            machineStr: op.machine || op.machineStr || null,
            operator: op.operator || (Array.isArray(op.operators) ? op.operators.join(", ") : null),
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
            sequence: seqNum,
            status: op.status || "Queued",
            plannedQty: parseSafePlannedQty(op, Number(data.quantity) || 0),
            completedQty: parseSafeNumeric(op.completedQty ?? op.qtyCompleted, 0),
            notes: op.notes || null,
          };
        })
      );
    }
  }

  // 4. Timeline / Smena hodisalarini saqlash
  if (data.events && Array.isArray(data.events)) {
    await db.delete(workOrderEvents).where(eq(workOrderEvents.workOrderId, targetId));
    if (data.events.length > 0) {
      await db.insert(workOrderEvents).values(
        data.events.map((ev: any) => ({
          workOrderId: targetId,
          opId: ev.opId ? String(ev.opId) : null,
          time: ev.time || "12:00",
          type: ev.type || "Run",
          note: ev.note || "",
          operator: ev.operator || null,
          wasteQty: parseInt(String(ev.wasteQty || 0), 10) || 0,
          wasteReason: ev.wasteReason || null,
          grossInput: ev.grossInput !== undefined && ev.grossInput !== null ? parseInt(String(ev.grossInput), 10) || null : null,
          goodOutput: ev.goodOutput !== undefined && ev.goodOutput !== null ? parseInt(String(ev.goodOutput), 10) || null : null,
        }))
      );
    }
  }

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
      if (attUrl.includes("/api/flexo-imposition/")) {
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

  return {
    success: true,
    workOrder: {
      ...payload,
      id: targetId,
    },
  };
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
    await db
      .update(workOrders)
      .set({
        status: "Cancelled",
        recipeCode: cancelReason
          ? `${existingOrder.recipeCode ? `[${existingOrder.recipeCode}] ` : ""}[BEKOR QILINDI]: ${cancelReason}`
          : existingOrder.recipeCode,
      })
      .where(eq(workOrders.id, existingOrder.id));

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

    if (updates.stage !== undefined) {
      patchPayload.stage = updates.stage;
    }

    if (updates.pressMachine !== undefined) {
      patchPayload.pressMachine = updates.pressMachine;
    }

    if (updates.status !== undefined) {
      patchPayload.status = updates.status;
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

    await db
      .update(workOrders)
      .set(patchPayload)
      .where(eq(workOrders.id, existingOrder.id));

    return {
      success: true,
      data: {
        id: existingOrder.docNo,
        docNo: existingOrder.docNo,
        stage: patchPayload.stage || existingOrder.stage,
        checks: patchPayload.checks || existingOrder.checks,
        pressMachine: patchPayload.pressMachine || existingOrder.pressMachine,
        status: patchPayload.status || existingOrder.status,
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
    status: m.status || "Idle",
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
  let rows = await db.query.productionMachines.findMany({
    where: eq(productionMachines.companyId, companyId),
    orderBy: [desc(productionMachines.createdAt)],
  });

  if (rows.length === 0) {
    const defaultMachines = [
      { code: "M-001", name: "Heidelberg Speedmaster XL 106", department: "Offset", status: "Running", hourlyRateUsd: "45.00", maxSpeedPerHour: 15000, currentOperator: "Alisher Ergashev" },
      { code: "M-002", name: "Mark Andy P5 Series", department: "Flexo", status: "Running", hourlyRateUsd: "35.00", maxSpeedPerHour: 12000, currentOperator: "Bobur Karimov" },
      { code: "M-003", name: "Gallus ECS 340", department: "Flexo", status: "Idle", hourlyRateUsd: "30.00", maxSpeedPerHour: 10000, currentOperator: "Jamshid Qodirov" },
      { code: "M-004", name: "Bobst Novacut 106", department: "Post-press", status: "Running", hourlyRateUsd: "25.00", maxSpeedPerHour: 8000, currentOperator: "Dilshod Saidov" },
      { code: "M-005", name: "Muller Martini Presto II", department: "Post-press", status: "Maintenance", hourlyRateUsd: "20.00", maxSpeedPerHour: 6000, currentOperator: "Otabek Umarov" },
    ];

    try {
      await db.insert(productionMachines).values(
        defaultMachines.map((m) => ({
          code: m.code,
          name: m.name,
          department: m.department,
          status: m.status,
          hourlyRateUsd: m.hourlyRateUsd,
          maxSpeedPerHour: m.maxSpeedPerHour,
          currentOperator: m.currentOperator,
          companyId,
          isActive: true,
        }))
      ).onConflictDoNothing();

      rows = await db.query.productionMachines.findMany({
        where: eq(productionMachines.companyId, companyId),
        orderBy: [desc(productionMachines.createdAt)],
      });
    } catch (e) {
      console.error("Error auto-seeding machines:", e);
    }
  }

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
