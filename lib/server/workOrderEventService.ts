import { db } from "@/db";
import { branches, workOrderEvents, workOrders } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import { parseShiftSchedule, plantClock, shiftAt, type ShiftInterval } from "@/lib/shiftSchedule";
import type { ShiftEvent } from "@/components/documents/work-order/types";

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
  };

  if (existing) {
    const [row] = await db
      .update(workOrderEvents)
      .set({ ...values, updatedBy: actor.name, updatedAt: new Date() })
      .where(eq(workOrderEvents.id, existing.id))
      .returning();
    return toShiftEvent(row);
  }
  const [row] = await db
    .insert(workOrderEvents)
    .values({ ...values, workOrderId: wo.id, clientEventId: input.id, createdBy: actor.name })
    .returning();
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
    .returning({ id: workOrderEvents.id });
  if (!row) throw new Error("Yozuv topilmadi.");
  return { id: eventId };
}
