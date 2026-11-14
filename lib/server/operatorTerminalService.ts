import { db } from "@/db";
import { productionMachines, workOrders } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ShiftEvent } from "@/components/documents/work-order/types";
import { getStepTimeline, type StepPhase } from "@/components/documents/work-order/utils/stepTimeline";
import { toShiftEvent } from "./workOrderEventService";

/**
 * Operator terminal: the work waiting on one machine, across all active work orders.
 * Every step's state comes from its shift journal, like on the order screen.
 */

const PACKAGING_STEP_NAME_RE = /qadoq|upakov|pack/i;
const ACTIVE_ORDER_STATUSES = ["Active", "In Production"] as const;
const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

export interface TerminalJob {
  workOrderNo: string;
  productName: string;
  customerName: string;
  deadline: string | null;
  priority: string;
  unit: string;
  opId: string;
  stepNumber: number;
  opName: string;
  phase: StepPhase;
  plannedQty: number;
  plannedHours: number;
  goodQty: number;
  makeReadyQty: number;
  defectQty: number;
  inputQty: number;
  setupMinutes: number;
  runMinutes: number;
  downtimeMinutes: number;
  openDowntime: { id: string; reason: string; since: string } | null;
  previousStep: { name: string; stepNumber: number; goodQty: number } | null;
  /** The previous production step has output (or there is none): the job can start. */
  ready: boolean;
  /** This step's output reports and downtimes, newest first. */
  recentEvents: ShiftEvent[];
  /** All output reports of the step (input already taken in, pallet numbering). */
  reports: ShiftEvent[];
}

export interface TerminalMachine {
  id: string;
  code: string;
  name: string;
  department: string;
}

export async function listTerminalMachines(): Promise<TerminalMachine[]> {
  const rows = await db
    .select({
      id: productionMachines.id,
      code: productionMachines.code,
      name: productionMachines.name,
      department: productionMachines.department,
    })
    .from(productionMachines);
  return rows.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}

const goodOf = (events: ShiftEvent[], completedQty: unknown) => {
  const reported = events.filter((ev) => ev.type === "Run").reduce((s, ev) => s + (Number(ev.goodQty) || 0), 0);
  return reported > 0 ? reported : Number(completedQty) || 0;
};

export async function getMachineQueue(machineId: string): Promise<{ machine: TerminalMachine; jobs: TerminalJob[] }> {
  const machine = await db.query.productionMachines.findFirst({ where: eq(productionMachines.id, machineId) });
  if (!machine) throw new Error("Uskuna topilmadi.");
  const machineName = machine.name.trim().toLowerCase();

  const orders = await db.query.workOrders.findMany({
    where: and(
      eq(workOrders.companyId, machine.companyId),
      inArray(workOrders.status, [...ACTIVE_ORDER_STATUSES])
    ),
    with: {
      operations: { orderBy: (ops, { asc }) => [asc(ops.sequence)] },
      events: true,
    },
  });

  const jobs: TerminalJob[] = [];
  for (const wo of orders) {
    const events = (wo.events || []).filter((ev) => !ev.deletedAt).map(toShiftEvent);
    const production = (wo.operations || []).filter((op) => !PACKAGING_STEP_NAME_RE.test(op.name || ""));

    production.forEach((op, idx) => {
      const onMachine =
        op.machineId === machine.id || (op.machineStr || "").trim().toLowerCase() === machineName;
      if (!onMachine) return;

      const stepEvents = events.filter((ev) => ev.opId === op.id);
      const tl = getStepTimeline(stepEvents);
      const phase: StepPhase = tl.hasTransitions
        ? tl.phase
        : op.status === "Finished"
        ? "finished"
        : op.status === "Paused"
        ? "paused"
        : op.status === "In Progress"
        ? "run"
        : "queued";
      if (phase === "finished") return;

      const prev = idx > 0 ? production[idx - 1] : null;
      const prevGood = prev ? goodOf(events.filter((ev) => ev.opId === prev.id), prev.completedQty) : 0;
      const reports = stepEvents.filter((ev) => ev.type === "Run");
      const sum = (pick: (ev: ShiftEvent) => number | undefined) =>
        reports.reduce((s, ev) => s + (Number(pick(ev)) || 0), 0);

      jobs.push({
        workOrderNo: wo.docNo,
        productName: wo.productName,
        customerName: wo.customerName,
        deadline: wo.deadline,
        priority: wo.priority,
        unit: wo.unit,
        opId: op.id,
        stepNumber: op.sequence,
        opName: op.name,
        phase,
        plannedQty: Number(op.plannedQty) || Number(wo.quantity) || 0,
        plannedHours: Number(op.durationHours) || 0,
        goodQty: goodOf(stepEvents, op.completedQty),
        makeReadyQty: sum((ev) => ev.makeReadyQty),
        defectQty: sum((ev) => ev.defectQty),
        inputQty: sum((ev) => ev.inputQty),
        setupMinutes: tl.setupMinutes,
        runMinutes: tl.runMinutes,
        downtimeMinutes: tl.downtimeMinutes,
        openDowntime: tl.openDowntime?.occurredAt
          ? { id: tl.openDowntime.id, reason: tl.openDowntime.downtimeReason || "To'xtalish", since: tl.openDowntime.occurredAt }
          : null,
        previousStep: prev ? { name: prev.name, stepNumber: prev.sequence, goodQty: prevGood } : null,
        ready: !prev || prevGood > 0,
        recentEvents: stepEvents
          .filter((ev) => ev.type === "Run" || ev.type === "Delay" || ev.type === "Maintenance")
          .sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""))
          .slice(0, 8),
        reports,
      });
    });
  }

  // Running work first, then what can start, then by deadline and priority.
  const activeRank = (j: TerminalJob) => (j.phase === "queued" ? 1 : 0);
  jobs.sort(
    (a, b) =>
      activeRank(a) - activeRank(b) ||
      Number(b.ready) - Number(a.ready) ||
      (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
      (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
      a.stepNumber - b.stepNumber
  );

  return {
    machine: { id: machine.id, code: machine.code, name: machine.name, department: machine.department },
    jobs,
  };
}
