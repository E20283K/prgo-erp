import { db } from "@/db";
import { branches, workOrderEvents, workOrderOperations, workOrders } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import { parseShiftSchedule, plantClock, shiftAt, type ShiftInterval } from "@/lib/shiftSchedule";
import type { ShiftEvent } from "@/components/documents/work-order/types";
import { getStepTimeline, type StepPhase } from "@/components/documents/work-order/utils/stepTimeline";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHASE_STATUS: Record<StepPhase, string> = {
  queued: "Queued",
  setup: "In Progress",
  run: "In Progress",
  paused: "Paused",
  finished: "Finished",
};

/**
 * The order's production stage follows its steps; only "Queue" and "Ready to Print"
 * (released to the floor) are the planner's to set.
 *   any step started → In Production, every step (packaging too) finished → Completed,
 *   nothing started any more (a correction) → back to Ready to Print.
 */
export async function syncOrderStageFromSteps(workOrderId: string) {
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
    with: { operations: true },
  });
  if (!wo || !wo.operations || wo.operations.length === 0) return;
  const started = wo.operations.some((op) => ["In Progress", "Paused", "Finished"].includes(op.status));
  const allDone = wo.operations.every((op) => op.status === "Finished");

  let stage = wo.stage;
  if (allDone) stage = "Completed";
  else if (started) stage = "In Production";
  else if (wo.stage === "In Production" || wo.stage === "Completed") stage = "Ready to Print";
  if (stage === wo.stage) return;

  const today = new Date().toISOString().split("T")[0];
  await db
    .update(workOrders)
    .set({
      stage,
      actualEndDate: stage === "Completed" ? wo.actualEndDate || today : stage === "In Production" ? null : wo.actualEndDate,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, workOrderId));
}

/**
 * Writes the step's status, times, downtime and good output from its journal onto the step row,
 * so screens that read the route (registry, planning, operator terminal) see what the journal says
 * without the order being saved. Steps without transitions only get their reported output.
 */
export async function syncStepFromJournal(workOrderId: string, opId: string) {
  if (!UUID_RE.test(opId)) return;
  const rows = await db.query.workOrderEvents.findMany({
    where: and(
      eq(workOrderEvents.workOrderId, workOrderId),
      eq(workOrderEvents.opId, opId),
      isNull(workOrderEvents.deletedAt)
    ),
  });
  const events = rows.map(toShiftEvent);
  const tl = getStepTimeline(events);
  const update: Partial<typeof workOrderOperations.$inferInsert> = {};
  if (tl.reportedGood > 0) update.completedQty = String(tl.reportedGood);
  if (tl.hasTransitions) {
    update.status = PHASE_STATUS[tl.phase];
    const started = tl.setupStartedAt || tl.runStartedAt;
    if (started) update.startedAt = new Date(started);
    update.completedAt = tl.finishedAt ? new Date(tl.finishedAt) : null;
    update.pausedAt = tl.openDowntime?.occurredAt ? new Date(tl.openDowntime.occurredAt) : null;
    update.downtimeMinutes = tl.closedDowntimeMinutes;
    if (tl.phase === "finished" && started) update.actualDurationMinutes = tl.setupMinutes + tl.runMinutes;
  }
  if (Object.keys(update).length === 0) return;
  await db
    .update(workOrderOperations)
    .set(update)
    .where(and(eq(workOrderOperations.workOrderId, workOrderId), eq(workOrderOperations.id, opId)));
  await syncOrderStageFromSteps(workOrderId);
}

/**
 * Shift journal of a work order. Every event is written the moment it is logged (not with the order),
 * carries its real date and time, its shift from the plant's schedule and who logged it.
 * Deletes are soft so the journal keeps an audit trail.
 */

export interface EventActor {
  id?: string;
  name: string;
}

type EventRow = typeof workOrderEvents.$inferSelect;

async function findWorkOrder(docNo: string, companyCode?: string | null) {
  const companyId = companyCode ? await getCompanyIdByCode(companyCode).catch(() => null) : null;
  const wo = await db.query.workOrders.findFirst({
    where: companyId
      ? and(eq(workOrders.companyId, companyId), eq(workOrders.docNo, docNo))
      : eq(workOrders.docNo, docNo),
  });
  if (!wo) throw new Error(`${docNo} buyurtmasi topilmadi. Avval buyurtmani saqlang.`);
  return wo;
}

/** The plant's shifts: the first branch of the company that has working hours set. */
export async function getShiftScheduleForCompany(companyId: string): Promise<ShiftInterval[]> {
  const rows = await db
    .select({ workingHours: branches.workingHours })
    .from(branches)
    .where(eq(branches.companyId, companyId))
    .orderBy(asc(branches.createdAt));
  return parseShiftSchedule(rows.find((r) => r.workingHours && r.workingHours.trim())?.workingHours);
}

/** Database row → the journal entry the order screen works with. */
export function toShiftEvent(row: EventRow): ShiftEvent {
  const occurred = row.occurredAt || row.createdAt;
  const type = (row.type || "Run") as ShiftEvent["type"];
  const isDowntime = type === "Delay" || type === "Maintenance";
  return {
    id: row.clientEventId || row.id,
    opId: row.opId || "",
    time: occurred ? plantClock(occurred).time : row.time,
    occurredAt: occurred ? occurred.toISOString() : undefined,
    shift: (row.shift as ShiftEvent["shift"]) || undefined,
    batchLabel: row.batchLabel || undefined,
    type,
    note: row.note || "",
    operator: row.operator || "",
    inputQty: row.grossInput ?? undefined,
    makeReadyQty: row.makeReadyQty ?? undefined,
    defectQty: row.defectQty ?? undefined,
    goodQty: isDowntime ? undefined : row.goodOutput ?? undefined,
    outputPiecesQty: row.outputPiecesQty ?? undefined,
    wasteQty: row.wasteQty ?? undefined,
    wasteReason: row.wasteReason || undefined,
    downtimeReason: row.downtimeReason || undefined,
    downtimeDurationMinutes: row.downtimeMinutes ?? undefined,
    palletCode: row.palletCode || undefined,
    palletNumber: row.palletNumber ?? undefined,
    status: (row.status as ShiftEvent["status"]) || undefined,
    toStatus: (row.toStatus as ShiftEvent["toStatus"]) || undefined,
    createdBy: row.createdBy || undefined,
    updatedBy: row.updatedBy || undefined,
  };
}

const int = (v: unknown) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
};

export async function listWorkOrderEvents(docNo: string, companyCode?: string | null) {
  const wo = await findWorkOrder(docNo, companyCode);
  const rows = await db.query.workOrderEvents.findMany({
    where: and(eq(workOrderEvents.workOrderId, wo.id), isNull(workOrderEvents.deletedAt)),
  });
  const events = rows
    .map(toShiftEvent)
    .sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));
  return { events, schedule: await getShiftScheduleForCompany(wo.companyId) };
}

/** Creates or updates one journal entry (keyed by the client's event id). */
export async function saveWorkOrderEvent(
  docNo: string,
  input: Partial<ShiftEvent> & { id: string },
  actor: EventActor,
  companyCode?: string | null
): Promise<ShiftEvent> {
  if (!input.id) throw new Error("Hodisa identifikatori kerak.");
  if (!input.opId) throw new Error("Hodisa bosqichga bog'lanmagan.");
  const wo = await findWorkOrder(docNo, companyCode);

  const existing = await db.query.workOrderEvents.findFirst({
    where: and(eq(workOrderEvents.workOrderId, wo.id), eq(workOrderEvents.clientEventId, input.id)),
  });
  if (existing?.deletedAt) throw new Error("Bu yozuv o'chirilgan.");

  const parsedAt = input.occurredAt ? new Date(input.occurredAt) : null;
  const occurredAt =
    parsedAt && !Number.isNaN(parsedAt.getTime()) ? parsedAt : existing?.occurredAt || new Date();
  const clock = plantClock(occurredAt);
  const schedule = await getShiftScheduleForCompany(wo.companyId);
  const type = input.type || (existing?.type as ShiftEvent["type"]) || "Run";

  const values = {
    opId: input.opId,
    time: clock.time,
    occurredAt,
    // A shift picked by hand wins; otherwise the plant schedule decides.
    shift: input.shift || shiftAt(clock.time, schedule),
    type,
    note: input.note || "",
    operator: input.operator || actor.name,
    batchLabel: input.batchLabel || null,
    grossInput: int(input.inputQty),
    makeReadyQty: int(input.makeReadyQty),
    defectQty: int(input.defectQty),
    goodOutput: int(input.goodQty),
    outputPiecesQty: int(input.outputPiecesQty),
    wasteQty: int(input.wasteQty) ?? 0,
    wasteReason: input.wasteReason || null,
    downtimeReason: input.downtimeReason || null,
    downtimeMinutes: int(input.downtimeDurationMinutes),
    palletCode: input.palletCode || null,
    palletNumber: int(input.palletNumber),
    status: input.status || null,
    toStatus: input.toStatus || null,
  };

  if (existing) {
    const [row] = await db
      .update(workOrderEvents)
      .set({ ...values, updatedBy: actor.name, updatedAt: new Date() })
      .where(eq(workOrderEvents.id, existing.id))
      .returning();
    await syncStepFromJournal(wo.id, values.opId);
    return toShiftEvent(row);
  }
  const [row] = await db
    .insert(workOrderEvents)
    .values({ ...values, workOrderId: wo.id, clientEventId: input.id, createdBy: actor.name })
    .returning();
  await syncStepFromJournal(wo.id, values.opId);
  return toShiftEvent(row);
}

/** Removes an entry from the journal, keeping who removed it and when. */
export async function deleteWorkOrderEvent(
  docNo: string,
  eventId: string,
  actor: EventActor,
  companyCode?: string | null
) {
  const wo = await findWorkOrder(docNo, companyCode);
  const [row] = await db
    .update(workOrderEvents)
    .set({ deletedAt: new Date(), deletedBy: actor.name })
    .where(
      and(
        eq(workOrderEvents.workOrderId, wo.id),
        eq(workOrderEvents.clientEventId, eventId),
        isNull(workOrderEvents.deletedAt)
      )
    )
    .returning({ id: workOrderEvents.id, opId: workOrderEvents.opId });
  if (!row) throw new Error("Yozuv topilmadi.");
  if (row.opId) await syncStepFromJournal(wo.id, row.opId);
  return { id: eventId };
}
