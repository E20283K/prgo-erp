import { db, type DbExec } from "@/db";
import { employees, pieceworkLogs, workOrderEvents, workOrderOperations, workOrders } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { plantClock } from "@/lib/shiftSchedule";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Journal entry types that report no output (a stoppage is not paid by the piece). */
const DOWNTIME_TYPES = new Set(["Delay", "Maintenance"]);

/**
 * The employee a journal entry's operator is: the id the screen sent, else the one active employee
 * whose full name is the operator's. A name shared by two employees matches nobody — paying the
 * wrong person is worse than leaving the entry for the foreman.
 */
export async function resolveOperatorEmployeeId(
  exec: DbExec,
  companyId: string,
  employeeId: string | null | undefined,
  operatorName: string | null | undefined
): Promise<string | null> {
  const id = String(employeeId || "").trim();
  if (id && UUID_RE.test(id)) {
    const byId = await exec.query.employees.findFirst({
      where: and(eq(employees.companyId, companyId), eq(employees.id, id)),
      columns: { id: true },
    });
    if (byId) return byId.id;
  }
  const name = String(operatorName || "").trim();
  if (!name) return null;
  const byName = await exec.query.employees.findMany({
    where: and(
      eq(employees.companyId, companyId),
      eq(employees.status, "active"),
      sql`lower(trim(${employees.fullName})) = lower(${name})`
    ),
    columns: { id: true },
    limit: 2,
  });
  return byName.length === 1 ? byName[0].id : null;
}

/**
 * Production → HR: every journal entry of a step that reports good output by a known employee
 * becomes a piecework record, priced at the step's piecework rate. Records are created as drafts
 * and follow the journal (edited, deleted) only while they are drafts; once a foreman has verified
 * one it is his word and the journal no longer changes it.
 */
export async function syncPieceworkFromJournal(workOrderId: string, opId: string, exec: DbExec = db) {
  if (!UUID_RE.test(opId)) return;
  const [wo, op] = await Promise.all([
    exec.query.workOrders.findFirst({
      where: eq(workOrders.id, workOrderId),
      columns: { id: true, companyId: true, docNo: true, unit: true },
    }),
    exec.query.workOrderOperations.findFirst({
      where: and(eq(workOrderOperations.workOrderId, workOrderId), eq(workOrderOperations.id, opId)),
    }),
  ]);
  if (!wo || !op) return;

  const events = await exec.query.workOrderEvents.findMany({
    where: and(eq(workOrderEvents.workOrderId, workOrderId), eq(workOrderEvents.opId, opId)),
  });
  if (events.length === 0) return;

  const existing = await exec.query.pieceworkLogs.findMany({
    where: inArray(
      pieceworkLogs.sourceEventId,
      events.map((e) => e.id)
    ),
  });
  const logByEvent = new Map(existing.map((l) => [l.sourceEventId, l]));

  // The rate is quoted per `unitDivisor` units (per 1000 by default).
  const rate = Number(op.pieceworkRateUsd) || 0;
  const divisor = Number(op.unitDivisor) || 1000;

  for (const ev of events) {
    const log = logByEvent.get(ev.id);
    const good = Number(ev.goodOutput) || 0;
    const payable = !ev.deletedAt && !!ev.employeeId && good > 0 && rate > 0 && !DOWNTIME_TYPES.has(ev.type);

    if (!payable) {
      if (log && log.status === "draft") await exec.delete(pieceworkLogs).where(eq(pieceworkLogs.id, log.id));
      continue;
    }

    const values = {
      companyId: wo.companyId,
      employeeId: ev.employeeId!,
      workOrderId: wo.docNo,
      workDate: plantClock(ev.occurredAt || ev.createdAt).day,
      machineCode: op.machineStr || null,
      operationCode: op.tariffCode || "OP",
      operationName: op.name,
      completedQuantity: String(good),
      unit: wo.unit || "dona",
      pieceRate: (rate / divisor).toFixed(4),
      totalAmount: ((good / divisor) * rate).toFixed(2),
      currency: "USD",
      notes: "Smena jurnalidan",
      updatedAt: new Date(),
    };

    if (!log) {
      await exec.insert(pieceworkLogs).values({ ...values, status: "draft", approvedBy: null, sourceEventId: ev.id });
    } else if (log.status === "draft") {
      await exec.update(pieceworkLogs).set(values).where(eq(pieceworkLogs.id, log.id));
    }
  }
}
