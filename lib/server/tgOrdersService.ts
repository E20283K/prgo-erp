import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { workOrderEvents, workOrderOperations, workOrders } from "@/db/schema/production";
import { deriveWorkOrderStatus, type WorkOrderStatus } from "@/lib/workOrderStatus";
import { resolveUserCompany } from "./tgAttendanceService";

/**
 * Work orders for the Telegram Mini App: a light, read-only list and card of the
 * orders of the organisation the user's ERP account belongs to.
 */

export type TgOrderScope = "active" | "done" | "all";

export interface TgOrderRow {
  id: string;
  docNo: string;
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  stage: string;
  status: WorkOrderStatus;
  priority: string;
  deadline: string;
  stepsDone: number;
  stepsTotal: number;
}

export interface TgOrderStep {
  id: string;
  name: string;
  machine: string;
  status: string;
  plannedQty: number;
  completedQty: number;
}

export interface TgOrderEvent {
  id: string;
  at: string;
  type: string;
  note: string;
  operator: string;
  goodOutput: number | null;
  wasteQty: number;
}

export interface TgOrderCard extends TgOrderRow {
  clientOrderId: string;
  productType: string;
  department: string;
  pressMachine: string;
  orderDate: string;
  startDate: string;
  actualEndDate: string;
  paperStock: string;
  coating: string;
  lamination: string;
  embellishment: string;
  notes: string;
  cancelReason: string;
  checks: { design: boolean; paper: boolean; plates: boolean; tooling: boolean };
  steps: TgOrderStep[];
  events: TgOrderEvent[];
}

const LIST_LIMIT = 150;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isStepDone(status: string): boolean {
  return status === "completed" || status === "done" || status === "skipped";
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
      customer: workOrders.customerName,
      product: workOrders.productName,
      quantity: workOrders.quantity,
      unit: workOrders.unit,
      stage: workOrders.stage,
      status: workOrders.status,
      priority: workOrders.priority,
      deadline: workOrders.deadline,
    })
    .from(workOrders)
    .where(where)
    .orderBy(scope === "active" ? asc(workOrders.queueOrder) : desc(workOrders.updatedAt), desc(workOrders.createdAt))
    .limit(LIST_LIMIT);

  const ids = rows.map((r) => r.id);
  const steps = ids.length
    ? await db
        .select({ workOrderId: workOrderOperations.workOrderId, status: workOrderOperations.status })
        .from(workOrderOperations)
        .where(inArray(workOrderOperations.workOrderId, ids))
    : [];
  const progress = new Map<string, { done: number; total: number }>();
  for (const s of steps) {
    const p = progress.get(s.workOrderId) ?? { done: 0, total: 0 };
    p.total++;
    if (isStepDone(s.status)) p.done++;
    progress.set(s.workOrderId, p);
  }

  return rows.map((r) => ({
    id: r.id,
    docNo: r.docNo,
    customer: r.customer,
    product: r.product,
    quantity: Number(r.quantity) || 0,
    unit: r.unit,
    stage: r.stage,
    status: deriveWorkOrderStatus(r.status, r.stage),
    priority: r.priority,
    deadline: r.deadline ?? "",
    stepsDone: progress.get(r.id)?.done ?? 0,
    stepsTotal: progress.get(r.id)?.total ?? 0,
  }));
}

export async function getTgOrder(userId: string, id: string): Promise<TgOrderCard | null> {
  if (!UUID_RE.test(id)) return null;
  const company = await resolveUserCompany(userId);
  const wo = await db.query.workOrders.findFirst({
    where: and(eq(workOrders.id, id), eq(workOrders.companyId, company.id)),
    with: {
      operations: { orderBy: (ops, { asc }) => [asc(ops.sequence)] },
    },
  });
  if (!wo) return null;

  const events = await db
    .select()
    .from(workOrderEvents)
    .where(and(eq(workOrderEvents.workOrderId, wo.id), isNull(workOrderEvents.deletedAt)))
    .orderBy(desc(workOrderEvents.createdAt))
    .limit(20);

  const checks = (wo.checks ?? {}) as { designReady?: boolean; paperReady?: boolean; platesReady?: boolean; toolingReady?: boolean };
  const ops = wo.operations ?? [];

  return {
    id: wo.id,
    docNo: wo.docNo,
    customer: wo.customerName,
    product: wo.productName,
    quantity: Number(wo.quantity) || 0,
    unit: wo.unit,
    stage: wo.stage,
    status: deriveWorkOrderStatus(wo.status, wo.stage),
    priority: wo.priority,
    deadline: wo.deadline ?? "",
    stepsDone: ops.filter((o) => isStepDone(o.status)).length,
    stepsTotal: ops.length,
    clientOrderId: wo.clientOrderId ?? "",
    productType: wo.productType ?? "",
    department: wo.department ?? "",
    pressMachine: wo.pressMachine ?? "",
    orderDate: wo.orderDate || (wo.createdAt ? wo.createdAt.toISOString().slice(0, 10) : ""),
    startDate: wo.startDate ?? "",
    actualEndDate: wo.actualEndDate ?? "",
    paperStock: wo.paperStock ?? "",
    coating: wo.coating ?? "",
    lamination: wo.lamination ?? "",
    embellishment: wo.embellishment ?? "",
    notes: wo.notes ?? "",
    cancelReason: wo.cancelReason ?? "",
    checks: {
      design: !!checks.designReady,
      paper: !!checks.paperReady,
      plates: !!checks.platesReady,
      tooling: !!checks.toolingReady,
    },
    steps: ops.map((o) => ({
      id: o.id,
      name: o.name,
      machine: o.machineStr ?? "",
      status: o.status,
      plannedQty: Number(o.plannedQty) || 0,
      completedQty: Number(o.completedQty) || 0,
    })),
    events: events.map((e) => ({
      id: e.id,
      at: (e.occurredAt ?? e.createdAt).toISOString(),
      type: e.type,
      note: e.note,
      operator: e.operator ?? "",
      goodOutput: e.goodOutput,
      wasteQty: e.wasteQty ?? 0,
    })),
  };
}
