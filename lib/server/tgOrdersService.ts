import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { workOrderAttachments, workOrderEvents, workOrderOperations, workOrders } from "@/db/schema/production";
import { warehouseShipmentItems, warehouseShipments } from "@/db/schema/warehouse";
import { deriveWorkOrderStatus, type WorkOrderStatus } from "@/lib/workOrderStatus";
import { resolveUserCompany } from "./tgAttendanceService";
import { normalizePermanentMediaUrl } from "./workOrderService";

/**
 * Work orders for the Telegram Mini App: a read-only list and a full card of the
 * orders of the organisation the user's ERP account belongs to.
 */

export type TgOrderScope = "active" | "done" | "all";

export interface TgOrderRow {
  id: string;
  docNo: string;
  clientOrderId: string;
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  stage: string;
  status: WorkOrderStatus;
  priority: string;
  orderType: string;
  department: string;
  deadline: string;
  stepsDone: number;
  stepsTotal: number;
  /** The step running now, else the next one waiting. */
  currentStep: string;
  photo: string;
}

export interface TgOrderStep {
  id: string;
  name: string;
  department: string;
  machine: string;
  operator: string;
  tooling: string;
  status: string;
  plannedQty: number;
  completedQty: number;
  plannedHours: number;
  actualMinutes: number | null;
  downtimeMinutes: number;
  startedAt: string;
  completedAt: string;
  notes: string;
}

export interface TgOrderEvent {
  id: string;
  at: string;
  type: string;
  step: string;
  note: string;
  operator: string;
  shift: string;
  goodOutput: number | null;
  /** Pieces cut from the good output (roll work reports metres in goodOutput). */
  outputPieces: number;
  wasteReason: string;
  makeReadyQty: number;
  defectQty: number;
  downtimeMinutes: number;
  downtimeReason: string;
  pallet: string;
  batch: string;
}

export interface TgOrderSpec {
  width: number;
  height: number;
  depth: number;
  dimensionUnit: string;
  bleed: number;
  shape: string;
  corner: string;
  category: string;
  gsm: number;
  printMethod: string;
  parentSheet: string;
  pressSheet: string;
  plannedSheets: number;
  laminationSides: string;
  laminationMicron: number;
  coatingZone: string;
  embellishmentZone: string;
  labelMaterial: string;
  labelCut: string;
  labelFold: string;
  labelEdge: string;
  labelPrintSides: string;
  hole: string;
}

export interface TgOrderColors {
  formula: string;
  front: string[];
  back: string[];
  spot: Array<{ name: string; code: string; hex: string; side: string }>;
}

export interface TgOrderMaterial {
  name: string;
  spec: string;
  unit: string;
  planQty: number;
  actualQty: number;
}

export interface TgOrderTooling {
  name: string;
  category: string;
  spec: string;
  quantity: number;
  unit: string;
  status: string;
}

export interface TgOrderAttachment {
  id: string;
  name: string;
  category: string;
  fileType: string;
  fileSize: string;
  url: string;
  uploadedBy: string;
  at: string;
}

export interface TgOrderShipment {
  id: string;
  no: string;
  date: string;
  status: string;
  qty: number;
  recipient: string;
  phone: string;
  address: string;
  carrier: string;
  driver: string;
  trackingNo: string;
}

export interface TgOrderPackaging {
  boxType: string;
  capacity: number;
  boxes: number;
  packedQty: number;
  readyQty: number;
  handedQty: number;
  inStockQty: number;
  dispatchedQty: number;
  completed: boolean;
}

export interface TgOrderSample {
  qty: number;
  purpose: string;
  machine: string;
  produced: boolean;
  qcPassed: boolean;
  approval: string;
  approvedBy: string;
  revisions: number;
  notes: string;
}

export interface TgOrderTotals {
  produced: number;
  waste: number;
  makeReady: number;
  downtimeMinutes: number;
  shipped: number;
}

export interface TgOrderCard extends TgOrderRow {
  productType: string;
  site: string;
  pressMachine: string;
  recipeCode: string;
  operator: string;
  shift: string;
  orderDate: string;
  startDate: string;
  actualEndDate: string;
  createdAt: string;
  updatedAt: string;
  paperStock: string;
  coating: string;
  lamination: string;
  embellishment: string;
  notes: string;
  cancelReason: string;
  /** Null when the viewer may not see prices. */
  price: { total: number; currency: string } | null;
  checks: { design: boolean; paper: boolean; plates: boolean; tooling: boolean };
  spec: TgOrderSpec;
  colors: TgOrderColors;
  sizes: Array<{ label: string; qty: number }>;
  materials: TgOrderMaterial[];
  tooling: TgOrderTooling[];
  photos: string[];
  attachments: TgOrderAttachment[];
  sample: TgOrderSample | null;
  packaging: TgOrderPackaging | null;
  shipments: TgOrderShipment[];
  totals: TgOrderTotals;
  steps: TgOrderStep[];
  events: TgOrderEvent[];
}

const LIST_LIMIT = 150;
const EVENT_LIMIT = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHIPPED = new Set(["Dispatched", "In Transit", "Delivered"]);
/** Shipment lines that are not the order's own product: accessories (2910) and raw materials (1010). */
const NON_PRODUCT_ACCOUNTS = new Set(["2910", "1010"]);

/** Step statuses are stored as "Queued" | "In Progress" | "Paused" | "Finished"; the Mini App uses one lowercase set. */
const STEP_STATUS: Record<string, string> = {
  queued: "pending",
  pending: "pending",
  "in progress": "in_progress",
  in_progress: "in_progress",
  paused: "paused",
  finished: "completed",
  completed: "completed",
  done: "completed",
  skipped: "skipped",
};
function stepStatus(status: string): string {
  return STEP_STATUS[status.trim().toLowerCase()] ?? status;
}

function isStepDone(status: string): boolean {
  const s = stepStatus(status);
  return s === "completed" || s === "skipped";
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
/** Defect of a journal entry: older entries kept it in waste_qty (when no make-ready was given). */
const defectOf = (e: { defectQty: number | null; makeReadyQty: number | null; wasteQty: number | null }): number =>
  e.defectQty ?? (!e.makeReadyQty && e.wasteQty ? e.wasteQty : 0);
const iso = (d: Date | null | undefined): string => (d ? d.toISOString() : "");
const sameNo = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

function firstPhoto(photoUrl: string | null, photoUrls: string[] | null): string {
  return normalizePermanentMediaUrl(photoUrl || photoUrls?.[0] || null) ?? "";
}

function pickCurrentStep(steps: Array<{ name: string; status: string }>): string {
  return (
    steps.find((s) => stepStatus(s.status) === "in_progress")?.name ??
    steps.find((s) => stepStatus(s.status) === "paused")?.name ??
    steps.find((s) => !isStepDone(s.status))?.name ??
    ""
  );
}

function scopeWhere(scope: TgOrderScope): SQL | undefined {
  if (scope === "active") {
    return and(notInArray(workOrders.status, ["Draft", "Cancelled", "Completed"]), ne(workOrders.stage, "Completed"));
  }
  if (scope === "done") return or(eq(workOrders.stage, "Completed"), eq(workOrders.status, "Completed"));
  return undefined;
}

export async function listTgOrders(userId: string, scope: TgOrderScope, query: string): Promise<TgOrderRow[]> {
  const company = await resolveUserCompany(userId);
  const q = query.trim().slice(0, 64);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = and(
    eq(workOrders.companyId, company.id),
    scopeWhere(scope),
    q
      ? or(
          ilike(workOrders.docNo, like),
          ilike(workOrders.customerName, like),
          ilike(workOrders.productName, like),
          ilike(workOrders.clientOrderId, like)
        )
      : undefined
  );

  const rows = await db
    .select({
      id: workOrders.id,
      docNo: workOrders.docNo,
      clientOrderId: workOrders.clientOrderId,
      customer: workOrders.customerName,
      product: workOrders.productName,
      quantity: workOrders.quantity,
      unit: workOrders.unit,
      stage: workOrders.stage,
      status: workOrders.status,
      priority: workOrders.priority,
      orderType: workOrders.orderType,
      department: workOrders.department,
      deadline: workOrders.deadline,
      photoUrl: workOrders.photoUrl,
      photoUrls: workOrders.photoUrls,
    })
    .from(workOrders)
    .where(where)
    .orderBy(scope === "active" ? asc(workOrders.queueOrder) : desc(workOrders.updatedAt), desc(workOrders.createdAt))
    .limit(LIST_LIMIT);

  const ids = rows.map((r) => r.id);
  const steps = ids.length
    ? await db
        .select({
          workOrderId: workOrderOperations.workOrderId,
          name: workOrderOperations.name,
          status: workOrderOperations.status,
        })
        .from(workOrderOperations)
        .where(inArray(workOrderOperations.workOrderId, ids))
        .orderBy(asc(workOrderOperations.sequence))
    : [];
  const byOrder = new Map<string, Array<{ name: string; status: string }>>();
  for (const s of steps) {
    const list = byOrder.get(s.workOrderId) ?? [];
    list.push(s);
    byOrder.set(s.workOrderId, list);
  }

  return rows.map((r) => {
    const ops = byOrder.get(r.id) ?? [];
    return {
      id: r.id,
      docNo: r.docNo,
      clientOrderId: r.clientOrderId ?? "",
      customer: r.customer,
      product: r.product,
      quantity: num(r.quantity),
      unit: r.unit,
      stage: r.stage,
      status: deriveWorkOrderStatus(r.status, r.stage),
      priority: r.priority,
      orderType: r.orderType,
      department: r.department ?? "",
      deadline: r.deadline ?? "",
      stepsDone: ops.filter((o) => isStepDone(o.status)).length,
      stepsTotal: ops.length,
      currentStep: pickCurrentStep(ops),
      photo: firstPhoto(r.photoUrl, r.photoUrls),
    };
  });
}

/** Shipments carrying this order's goods (by line source order, else the shipment's own order number). */
async function loadShipments(companyId: string, docNo: string): Promise<TgOrderShipment[]> {
  const key = docNo.trim().toLowerCase();
  const lineShipmentIds = db
    .select({ id: warehouseShipmentItems.shipmentId })
    .from(warehouseShipmentItems)
    .where(sql`lower(trim(${warehouseShipmentItems.sourceWorkOrderId})) = ${key}`);
  const shipments = await db
    .select()
    .from(warehouseShipments)
    .where(
      and(
        eq(warehouseShipments.companyId, companyId),
        or(sql`lower(trim(${warehouseShipments.workOrderId})) = ${key}`, inArray(warehouseShipments.id, lineShipmentIds))
      )
    )
    .orderBy(desc(warehouseShipments.shipmentDate))
    .limit(30);
  if (shipments.length === 0) return [];

  const lines = await db
    .select({
      shipmentId: warehouseShipmentItems.shipmentId,
      accountCode: warehouseShipmentItems.accountCode,
      sourceWorkOrderId: warehouseShipmentItems.sourceWorkOrderId,
      quantity: warehouseShipmentItems.quantity,
    })
    .from(warehouseShipmentItems)
    .where(
      inArray(
        warehouseShipmentItems.shipmentId,
        shipments.map((s) => s.id)
      )
    );

  return shipments
    .map((s) => {
      const own = lines.filter((l) => l.shipmentId === s.id);
      const qty = own
        .filter((l) => !NON_PRODUCT_ACCOUNTS.has(l.accountCode))
        .filter((l) => sameNo(l.sourceWorkOrderId || s.workOrderId, docNo))
        .reduce((sum, l) => sum + num(l.quantity), 0);
      return {
        id: s.id,
        no: s.shipmentNumber,
        date: iso(s.dispatchedAt ?? s.shipmentDate),
        status: s.status,
        qty,
        recipient: s.recipientName ?? "",
        phone: s.recipientPhone ?? "",
        address: s.deliveryAddress ?? "",
        carrier: s.carrier ?? "",
        driver: s.driverName ?? "",
        trackingNo: s.trackingNo ?? "",
      };
    })
    .sort((a, b) => Number(a.status === "Cancelled") - Number(b.status === "Cancelled"));
}

const COLOR_ORDER = ["c", "m", "y", "k", "w"];
function activeColors(map: unknown): string[] {
  if (!map || typeof map !== "object") return [];
  const rank = (k: string) => (COLOR_ORDER.indexOf(k) + 1 || 99);
  return Object.entries(map as Record<string, unknown>)
    .filter(([, on]) => on === true)
    .map(([k]) => k.toLowerCase())
    .sort((a, b) => rank(a) - rank(b))
    .map((k) => k.toUpperCase());
}

function sizeOf(w: unknown, h: unknown): string {
  const a = num(w);
  const b = num(h);
  return a > 0 && b > 0 ? `${a}×${b}` : "";
}

export async function getTgOrder(userId: string, id: string, opts: { withPrice: boolean }): Promise<TgOrderCard | null> {
  if (!UUID_RE.test(id)) return null;
  const company = await resolveUserCompany(userId);
  const wo = await db.query.workOrders.findFirst({
    where: and(eq(workOrders.id, id), eq(workOrders.companyId, company.id)),
    with: {
      operations: { orderBy: (ops, { asc }) => [asc(ops.sequence)] },
    },
  });
  if (!wo) return null;

  const [events, attachments, shipments] = await Promise.all([
    db
      .select()
      .from(workOrderEvents)
      .where(and(eq(workOrderEvents.workOrderId, wo.id), isNull(workOrderEvents.deletedAt)))
      .orderBy(desc(workOrderEvents.occurredAt), desc(workOrderEvents.createdAt)),
    db
      .select()
      .from(workOrderAttachments)
      .where(eq(workOrderAttachments.workOrderId, wo.id))
      .orderBy(desc(workOrderAttachments.createdAt)),
    loadShipments(company.id, wo.docNo),
  ]);

  const checks = (wo.checks ?? {}) as { designReady?: boolean; paperReady?: boolean; platesReady?: boolean; toolingReady?: boolean };
  const dims = (wo.dimensions ?? {}) as Record<string, unknown>;
  const colorsCfg = (wo.colorsConfig ?? {}) as Record<string, unknown>;
  const ops = wo.operations ?? [];
  const opName = new Map(ops.map((o) => [o.id, o.name]));

  // Good output is what the last production step (not packaging) has made: its journal, else its counter.
  const productionOps = ops.filter((o) => !/qadoq|packag/i.test(o.name));
  const lastOp = productionOps[productionOps.length - 1];
  const lastGood = lastOp
    ? events.filter((e) => e.opId === lastOp.id).reduce((s, e) => s + num(e.outputPiecesQty || e.goodOutput), 0)
    : 0;
  const produced = lastGood || (lastOp ? num(lastOp.completedQty) : 0);

  const photos = Array.from(
    new Set(
      [wo.photoUrl, ...(wo.photoUrls ?? []), ...attachments.filter((a) => a.fileType?.startsWith("image/")).map((a) => a.url)]
        .map((u) => normalizePermanentMediaUrl(u) ?? "")
        .filter(Boolean)
    )
  ).slice(0, 12);

  const sample = (wo.sampleData ?? {}) as Record<string, unknown>;
  const hasSample = wo.orderType === "Sample" || sample.isRequired === true;

  const pkg = (wo.packagingData ?? {}) as Record<string, unknown>;
  const boxes = Array.isArray(pkg.boxes) ? (pkg.boxes as Array<Record<string, unknown>>) : [];
  const boxQty = (stage?: string) =>
    boxes.filter((b) => !stage || (str(b.status) || "ready") === stage).reduce((s, b) => s + num(b.quantity), 0);

  const sizes = Array.isArray(dims.sizes) ? (dims.sizes as Array<Record<string, unknown>>) : [];
  const materials = Array.isArray(dims.materials) ? (dims.materials as Array<Record<string, unknown>>) : [];
  const tooling = Array.isArray(dims.toolingItems) ? (dims.toolingItems as Array<Record<string, unknown>>) : [];
  const spots = Array.isArray(colorsCfg.spotColorItems)
    ? (colorsCfg.spotColorItems as Array<Record<string, unknown>>)
    : Array.isArray(colorsCfg.spotColors)
      ? (colorsCfg.spotColors as unknown[]).map((name) => ({ name }))
      : [];

  const holePosition = str(dims.holePosition);

  return {
    id: wo.id,
    docNo: wo.docNo,
    clientOrderId: wo.clientOrderId ?? "",
    customer: wo.customerName,
    product: wo.productName,
    quantity: num(wo.quantity),
    unit: wo.unit,
    stage: wo.stage,
    status: deriveWorkOrderStatus(wo.status, wo.stage),
    priority: wo.priority,
    orderType: wo.orderType,
    department: wo.department ?? "",
    deadline: wo.deadline ?? "",
    stepsDone: ops.filter((o) => isStepDone(o.status)).length,
    stepsTotal: ops.length,
    currentStep: pickCurrentStep(ops),
    photo: photos[0] ?? "",
    productType: wo.productType ?? "",
    site: wo.site ?? "",
    pressMachine: wo.pressMachine ?? "",
    recipeCode: wo.recipeCode ?? "",
    operator: wo.operator ?? "",
    shift: wo.shift ?? "",
    orderDate: wo.orderDate || (wo.createdAt ? wo.createdAt.toISOString().slice(0, 10) : ""),
    startDate: wo.startDate ?? "",
    actualEndDate: wo.actualEndDate ?? "",
    createdAt: iso(wo.createdAt),
    updatedAt: iso(wo.updatedAt),
    paperStock: wo.paperStock || str(dims.paperStock),
    coating: wo.coating || str(dims.coating),
    lamination: wo.lamination || str(dims.lamination),
    embellishment: wo.embellishment || str(dims.embellishment),
    notes: wo.notes ?? "",
    cancelReason: wo.cancelReason ?? "",
    price: opts.withPrice ? { total: num(wo.priceTotal), currency: wo.currency || "UZS" } : null,
    checks: {
      design: !!checks.designReady,
      paper: !!checks.paperReady,
      plates: !!checks.platesReady,
      tooling: !!checks.toolingReady,
    },
    spec: {
      width: num(dims.width),
      height: num(dims.height),
      depth: num(dims.boxDepth),
      dimensionUnit: str(dims.dimensionUnit) || "mm",
      bleed: num(dims.bleed),
      shape: str(dims.shapeType),
      corner: str(dims.cornerType),
      category: str(dims.itemCategory),
      gsm: num(dims.targetGsm),
      printMethod: str(dims.printMethod),
      parentSheet: sizeOf(dims.parentSheetW, dims.parentSheetH),
      pressSheet: sizeOf(dims.pressSheetW, dims.pressSheetH),
      plannedSheets:
        num(dims.plannedSheets) ||
        num((dims.impositionState as { summary?: { parentSheets?: number } } | undefined)?.summary?.parentSheets),
      laminationSides: str(dims.laminationSides),
      laminationMicron: num(dims.laminationMicron),
      coatingZone: str(dims.coatingZone),
      embellishmentZone: str(dims.embellishmentZone),
      labelMaterial: str(dims.labelMaterialType),
      labelCut: str(dims.labelCutType),
      labelFold: str(dims.labelFoldType),
      labelEdge: str(dims.labelEdgeType),
      labelPrintSides: str(dims.labelPrintSides),
      hole: holePosition && holePosition !== "none" ? `${holePosition}${num(dims.holeSize) ? ` · ${num(dims.holeSize)} mm` : ""}` : "",
    },
    colors: {
      formula: str(colorsCfg.formula),
      front: activeColors(colorsCfg.frontColors),
      back: activeColors(colorsCfg.backColors),
      spot: spots
        .map((s) => ({
          name: str((s as Record<string, unknown>).name),
          code: str((s as Record<string, unknown>).code),
          hex: str((s as Record<string, unknown>).hex),
          side: str((s as Record<string, unknown>).side),
        }))
        .filter((s) => s.name || s.code),
    },
    sizes: sizes
      .map((s) => ({
        label: [str(s.model), str(s.size) || str(s.sizeCode)].filter(Boolean).join(" · ") || sizeOf(s.width, s.height),
        qty: num(s.quantity),
      }))
      .filter((s) => s.label || s.qty > 0),
    materials: materials
      .map((m) => ({
        name: str(m.name),
        spec: str(m.spec),
        unit: str(m.unit),
        planQty: num(m.planQty),
        actualQty: num(m.actualQty ?? m.qty),
      }))
      .filter((m) => m.name),
    tooling: tooling
      .map((t) => ({
        name: str(t.name),
        category: str(t.category),
        spec: str(t.specDetails),
        quantity: num(t.quantity),
        unit: str(t.unit),
        status: str(t.status),
      }))
      .filter((t) => t.name),
    photos,
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      fileType: a.fileType,
      fileSize: a.fileSize ?? "",
      url: normalizePermanentMediaUrl(a.url) ?? a.url,
      uploadedBy: a.uploadedBy ?? "",
      at: iso(a.createdAt),
    })),
    sample: hasSample
      ? {
          qty: num(sample.sampleQty),
          purpose: str(sample.testPurpose),
          machine: str(sample.testMachine),
          produced: sample.isProduced === true,
          qcPassed: sample.qcPassed === true,
          approval: str(sample.approvalStatus),
          approvedBy: str(sample.approvedBy),
          revisions: Array.isArray(sample.revisions) ? sample.revisions.length : 0,
          notes: str(sample.technicalNotes) || str(sample.qcNotes),
        }
      : null,
    packaging:
      boxes.length > 0
        ? {
            boxType: str(pkg.boxType),
            capacity: num(pkg.standardBoxCapacity),
            boxes: boxes.length,
            packedQty: boxQty(),
            readyQty: boxQty("ready"),
            handedQty: boxQty("handed"),
            inStockQty: boxQty("in_stock"),
            dispatchedQty: boxQty("dispatched"),
            completed: pkg.isCompleted === true,
          }
        : null,
    shipments,
    totals: {
      produced,
      waste: events.reduce((s, e) => s + defectOf(e), 0),
      makeReady: events.reduce((s, e) => s + num(e.makeReadyQty), 0),
      downtimeMinutes: events.reduce((s, e) => s + num(e.downtimeMinutes), 0),
      shipped: shipments.filter((s) => SHIPPED.has(s.status)).reduce((s, x) => s + x.qty, 0),
    },
    steps: ops.map((o) => ({
      id: o.id,
      name: o.name,
      department: o.department ?? "",
      machine: o.machineStr ?? "",
      operator: o.operator ?? "",
      tooling: o.toolingName ?? "",
      status: stepStatus(o.status),
      plannedQty: num(o.plannedQty),
      completedQty: num(o.completedQty),
      plannedHours: num(o.durationHours),
      actualMinutes: o.actualDurationMinutes ?? null,
      downtimeMinutes: o.downtimeMinutes ?? 0,
      startedAt: iso(o.startedAt),
      completedAt: iso(o.completedAt),
      notes: o.notes ?? "",
    })),
    events: events.slice(0, EVENT_LIMIT).map((e) => ({
      id: e.id,
      at: (e.occurredAt ?? e.createdAt).toISOString(),
      type: e.type,
      step: (e.opId && opName.get(e.opId)) || "",
      note: e.note,
      operator: e.operator ?? "",
      shift: e.shift ?? "",
      goodOutput: e.goodOutput,
      outputPieces: e.outputPiecesQty ?? 0,
      wasteReason: e.wasteReason ?? "",
      makeReadyQty: e.makeReadyQty ?? 0,
      defectQty: defectOf(e),
      downtimeMinutes: e.downtimeMinutes ?? 0,
      downtimeReason: e.downtimeReason ?? "",
      pallet: e.palletCode ?? (e.palletNumber ? `#${e.palletNumber}` : ""),
      batch: e.batchLabel ?? "",
    })),
  };
}
