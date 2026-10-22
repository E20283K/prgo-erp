
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
} from "@/db/schema";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import type { ProductionQueueItem } from "@/store/workspaceStore";
import type { WorkOrderFormData, RouteStep } from "@/components/documents/work-order/types";
import { getCompanyIdByCode } from "./crmService";
import { getNextSpecNumber } from "./numberingService";
import {
  normalizeDepartment,
  WO_DEPT_PREFIXES,
  getCurrentYearSuffix,
  formatWorkOrderNo,
} from "@/components/documents/work-order/utils/workOrderNumbering";

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

    return {
      id: wo.docNo,
      clientOrderId: wo.clientOrderId || undefined,
      customer: wo.customerName,
      product: wo.productName,
      quantity: Number(wo.quantity) || 0,
      unit: wo.unit || "pcs",
      pressMachine: wo.pressMachine || "",
      department: wo.department || "Offset",
      priority: (wo.priority as any) || "Normal",
      stage: (wo.stage as any) || "Queue",
      queueOrder: index + 1,
      checks: {
        designReady: !!checks.designReady,
        paperReady: !!checks.paperReady,
        platesReady: !!checks.platesReady,
        toolingReady: !!checks.toolingReady,
        audit: checks.audit || {},
      },
      deadline: wo.deadline || "",
      plannedSheets: Number(wo.quantity) || 0,
      completedSheets: 0,
      operator: wo.operator || undefined,
      shift: wo.shift || undefined,
      colors: (wo.colorsConfig as any)?.formula || undefined,
      spotColors: (wo.colorsConfig as any)?.spotColors || [],
      sampleRequired: wo.orderType === "Sample",
      sampleStatus: (wo.sampleData as any)?.approvalStatus || "none",
      sampleQty: (wo.sampleData as any)?.sampleQty || undefined,
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
      operations: wo.operations || [],
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
    events?: any[];
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
  if (!data.product) {
    throw new Error("Mahsulot nomi kiritilishi shart!");
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
    status: (data.status as any) || "Active",
    priority: (data.priority as any) || "Normal",
    stage: (data as any).stage || "Queue",
    orderType: (data.orderType as any) || "Production",
    startDate: data.startDate || null,
    deadline: data.deadline || null,
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
      dimensionUnit: data.dimensionUnit,
      bleed: data.bleed,
      shapeType: data.shapeType,
      cornerType: data.cornerType,
      itemCategory: data.itemCategory,
      boxDepth: data.boxDepth,
    },
    colorsConfig: {
      formula: data.colorsConfig,
      frontColors: data.frontColors as any,
      backColors: data.backColors as any,
      spotColors: data.spotColors,
      spotColorItems: data.spotColorItems,
    },
    checks: (data as any).checks || {
      designReady: false,
      paperReady: false,
      platesReady: false,
      toolingReady: false,
    },
    sampleData: data.sampleData || {},
    packagingData: data.packagingData || {},
    notes: (data as any).notes || null,
    updatedAt: new Date(),
  };

  let targetId: string;

  if (existingOrder) {
    targetId = existingOrder.id;
    await db.update(workOrders).set(payload).where(eq(workOrders.id, targetId));
  } else {
    const [inserted] = await db.insert(workOrders).values(payload).returning({ id: workOrders.id });
    targetId = inserted.id;
  }

  // 3. Marshrut operatsiyalarini (operations) saqlash
  if (data.operations && Array.isArray(data.operations)) {
    await db.delete(workOrderOperations).where(eq(workOrderOperations.workOrderId, targetId));
    if (data.operations.length > 0) {
      await db.insert(workOrderOperations).values(
        data.operations.map((op: any, idx: number) => ({
          workOrderId: targetId,
          name: op.name || `Bosqich ${idx + 1}`,
          department: op.department || data.department || "Offset",
          machineStr: op.machine || op.machineStr || null,
          sequence: op.stepNumber || idx + 1,
          status: op.status || "Queued",
          plannedQty: String(op.plannedQty || data.quantity || 0),
          completedQty: String(op.completedQty || op.qtyCompleted || 0),
          notes: op.notes || null,
        }))
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
          wasteQty: ev.wasteQty || 0,
          wasteReason: ev.wasteReason || null,
          grossInput: ev.grossInput || null,
          goodOutput: ev.goodOutput || null,
        }))
      );
    }
  }

  // 5. Fayllar va ilovalarni (attachments) saqlash
  if (data.attachments && Array.isArray(data.attachments)) {
    for (const att of data.attachments) {
      const attUrl = att.url;
      if (!attUrl) continue;
      const existing = await db.query.workOrderAttachments.findFirst({
        where: (a, { and, eq }) => and(eq(a.workOrderId, targetId), eq(a.url, attUrl)),
      });
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

  return {
    success: true,
    workOrder: {
      ...payload,
      id: targetId,
    },
  };
}

// ─── Production Machines CRUD ───────────────────────────────────────────────

function formatMachineDbToRecord(m: any): any {
  return {
    id: m.id,
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
      companyId,
      branchId: data.branchId || null,
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

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

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

export async function getProductionSites(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.branches.findMany({
    where: eq(branches.companyId, companyId),
    orderBy: [desc(branches.createdAt)],
  });
}

export async function createProductionSite(data: any, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  const [inserted] = await db
    .insert(branches)
    .values({
      companyId,
      code: data.code || `BR-${Date.now()}`,
      name: data.name,
      address: data.address || null,
      phone: data.phone || null,
      isMain: data.isMain ?? false,
      isActive: true,
    })
    .returning();
  return inserted;
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
