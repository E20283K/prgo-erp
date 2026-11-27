import { db } from "@/db";
import { productionMachines, workOrders } from "@/db/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { ShiftEvent } from "@/components/documents/work-order/types";
import { getStepTimeline, type StepPhase } from "@/components/documents/work-order/utils/stepTimeline";
import { toShiftEvent } from "./workOrderEventService";
import {
  getCountingProfile,
  planInUnit,
  type CountingProfile,
} from "@/components/documents/work-order/utils/countingProfile";

/**
 * Operator terminal: the work waiting on one machine, across all active work orders.
 * Every step's state comes from its shift journal, like on the order screen.
 */

const PACKAGING_STEP_NAME_RE = /qadoq|upakov|pack/i;
/** Orders the planner released to the floor (or already running); drafts and cancelled ones never show. */
const FLOOR_STAGES = ["Ready to Print", "In Production"] as const;
const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

export interface TerminalJob {
  workOrderNo: string;
  productName: string;
  customerName: string;
  deadline: string | null;
  priority: string;
  /** Planner's run order (lower first). */
  queueOrder: number;
  unit: string;
  opId: string;
  stepNumber: number;
  opName: string;
  phase: StepPhase;
  /** How this machine counts (unit, report container, pieces per unit). */
  profile: CountingProfile;
  /** Plan in the step's unit (sheets, metres...). */
  plannedQty: number;
  /** Plan in finished pieces (the order quantity this step serves). */
  plannedPieces: number;
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
  /** Photo of the machine, when one was uploaded. */
  imageUrl: string | null;
}

export async function listTerminalMachines(): Promise<TerminalMachine[]> {
  const rows = await db
    .select({
      id: productionMachines.id,
      code: productionMachines.code,
      name: productionMachines.name,
      department: productionMachines.department,
      imageUrl: productionMachines.imageUrl,
    })
    .from(productionMachines);
  return rows.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}

const goodOf = (events: ShiftEvent[], completedQty: unknown) => {
  const reported = events.filter((ev) => ev.type === "Run").reduce((s, ev) => s + (Number(ev.goodQty) || 0), 0);
  return reported > 0 ? reported : Number(completedQty) || 0;
};

type MachineRow = typeof productionMachines.$inferSelect;

/** Orders on the floor of one company, with their route and journal. */
function loadFloorOrders(companyId: string) {
  return db.query.workOrders.findMany({
    where: and(
      eq(workOrders.companyId, companyId),
      inArray(workOrders.stage, [...FLOOR_STAGES]),
      notInArray(workOrders.status, ["Draft", "Cancelled"])
    ),
    with: {
      operations: { orderBy: (ops, { asc }) => [asc(ops.sequence)] },
      events: true,
    },
  });
}

type FloorOrder = Awaited<ReturnType<typeof loadFloorOrders>>[number];

export async function getMachineQueue(machineId: string): Promise<{ machine: TerminalMachine; jobs: TerminalJob[] }> {
  const machine = await db.query.productionMachines.findFirst({ where: eq(productionMachines.id, machineId) });
  if (!machine) throw new Error("Uskuna topilmadi.");
  const jobs = buildMachineJobs(machine, await loadFloorOrders(machine.companyId));
  return {
    machine: {
      id: machine.id,
      code: machine.code,
      name: machine.name,
      department: machine.department,
      imageUrl: machine.imageUrl || null,
    },
    jobs,
  };
}

export interface FloorMachine extends TerminalMachine {
  /** The job running (or set up, or paused) on the machine, if any. */
  active: Pick<TerminalJob, "workOrderNo" | "productName" | "opName" | "phase" | "goodQty" | "plannedQty" | "openDowntime"> | null;
  /** Jobs waiting on the machine, and how many of them can start now. */
  queued: number;
  ready: number;
}

/** Every machine of the shop at a glance, for the shared kiosk's home screen. */
export async function getFloorOverview(): Promise<FloorMachine[]> {
  const machines = await db.select().from(productionMachines);
  const ordersByCompany = new Map<string, FloorOrder[]>();
  for (const companyId of new Set(machines.map((m) => m.companyId))) {
    ordersByCompany.set(companyId, await loadFloorOrders(companyId));
  }
  return machines
    .map((machine) => {
      const jobs = buildMachineJobs(machine, ordersByCompany.get(machine.companyId) || []);
      const active = jobs.find((j) => j.phase !== "queued") || null;
      const waiting = jobs.filter((j) => j.phase === "queued");
      return {
        id: machine.id,
        code: machine.code,
        name: machine.name,
        department: machine.department,
        imageUrl: machine.imageUrl || null,
        active: active
          ? {
              workOrderNo: active.workOrderNo,
              productName: active.productName,
              opName: active.opName,
              phase: active.phase,
              goodQty: active.goodQty,
              plannedQty: active.plannedQty,
              openDowntime: active.openDowntime,
            }
          : null,
        queued: waiting.length,
        ready: waiting.filter((j) => j.ready).length,
      };
    })
    .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}

/** The steps of floor orders that run on one machine, in the order the operator should take them. */
function buildMachineJobs(machine: MachineRow, orders: FloorOrder[]): TerminalJob[] {
  const machineName = machine.name.trim().toLowerCase();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dims = (wo.dimensions || {}) as any;
      const profile = getCountingProfile({
        machineCategory: machine.category,
        machineDepartment: machine.department,
        orderDepartment: wo.department,
        widthMm: Number(dims.width) || 0,
        heightMm: Number(dims.height) || 0,
        gapYMm: dims.flexoGapY ?? 3,
        lanes: dims.flexoLanes ?? 1,
        itemsPerSheet: Number(dims.impositionState?.summary?.itemsPerSheet) || 1,
      });
      const plannedPieces = Number(op.plannedQty) || Number(wo.quantity) || 0;

      jobs.push({
        workOrderNo: wo.docNo,
        productName: wo.productName,
        customerName: wo.customerName,
        deadline: wo.deadline,
        priority: wo.priority,
        queueOrder: wo.queueOrder ?? Number.MAX_SAFE_INTEGER,
        unit: wo.unit,
        opId: op.id,
        stepNumber: op.sequence,
        opName: op.name,
        phase,
        profile,
        plannedQty: planInUnit(plannedPieces, profile),
        plannedPieces,
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
        // A finished previous step never blocks (older steps were closed without output reports).
        ready: !prev || prevGood > 0 || prev.status === "Finished",
        recentEvents: stepEvents
          .filter((ev) => ev.type === "Run" || ev.type === "Delay" || ev.type === "Maintenance")
          .sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""))
          .slice(0, 8),
        reports,
      });
    });
  }

  // Running work first, then what can start, then the planner's order (deadline and priority break ties).
  const activeRank = (j: TerminalJob) => (j.phase === "queued" ? 1 : 0);
  jobs.sort(
    (a, b) =>
      activeRank(a) - activeRank(b) ||
      Number(b.ready) - Number(a.ready) ||
      a.queueOrder - b.queueOrder ||
      (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
      (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
      a.stepNumber - b.stepNumber
  );
  return jobs;
}
