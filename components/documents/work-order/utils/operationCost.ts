import type { MachineRecord } from "@/components/documents/machine/types";
import type { RouteStep } from "../types";

/**
 * Planned cost of one route step, derived from master data:
 *   machine = hours × machine hourly cost (crew wages excluded)
 *   labor   = piecework fund × lead operator multiplier, or hours × assigned operators' hourly wage,
 *             or — when no operator is known — hours × the machine's crew rate.
 * Outsourced and manually overridden steps take their cost from `manualCostUsd` instead.
 * All amounts are USD, like every other route money field.
 */

/** Norm working hours per month used to turn a monthly salary into an hourly wage (40-hour week). */
export const MONTHLY_WORK_HOURS = 168;

export type OperationCostMode = "auto" | "outsourced" | "manual";

export type LaborBasis = "piecework" | "employees" | "crew" | "none";

export interface CostEmployee {
  fullName: string;
  status?: string;
  wageType?: string;
  baseSalary?: number;
  hourlyRate?: number;
  pieceworkMultiplier?: number;
}

export interface OperationCostBreakdown {
  mode: OperationCostMode;
  machine: MachineRecord | null;
  machineRateUsd: number;
  machineCostUsd: number;
  laborBasis: LaborBasis;
  /** USD per hour (employees / crew) or USD per calc unit (piecework). */
  laborRateUsd: number;
  laborMultiplier: number;
  laborCostUsd: number;
  manualCostUsd: number;
  totalUsd: number;
}

const isRealMachineName = (name?: string) => Boolean(name && name !== "Manual" && name !== "—");

/** Finds the step's machine: by id first, then exact name/code, then a loose name match for legacy steps. */
export function resolveMachine(
  op: Pick<RouteStep, "machine" | "machineId">,
  machines: MachineRecord[] = []
): MachineRecord | null {
  if (op.machineId) {
    const byId = machines.find((m) => m.id === op.machineId);
    if (byId) return byId;
  }
  const clean = (op.machine || "").toLowerCase().trim();
  if (!isRealMachineName(op.machine) || !clean) return null;

  const codeOf = (m: MachineRecord) => ((m as unknown as { code?: string }).code || "").toLowerCase().trim();
  const exact = machines.find((m) => (m.name || "").toLowerCase().trim() === clean || codeOf(m) === clean);
  if (exact) return exact;

  return (
    machines.find((m) => {
      const mName = (m.name || "").toLowerCase().trim();
      const mCode = codeOf(m);
      return (mName !== "" && (mName.includes(clean) || clean.includes(mName))) || (mCode !== "" && mCode.includes(clean));
    }) || null
  );
}

/** Machine hourly cost without crew wages, and the crew wage per hour — both USD. Billing rate never used. */
export function getMachineCostRates(machine: MachineRecord | null): { machineRate: number; crewRate: number } {
  if (!machine) return { machineRate: 0, crewRate: 0 };
  const c = machine.costing;
  const crewRate = (Number(c?.operatorHourlyWageUsd) || 0) + (Number(c?.assistantHourlyWageUsd) || 0);
  const totalBase = Number(c?.totalBaseCostPerHourUsd) || 0;
  const parts =
    (Number(c?.hourlyDepreciationUsd) || 0) +
    (Number(c?.hourlyElectricityUsd) || 0) +
    (Number(c?.hourlyMaintenanceReserveUsd) || 0) +
    (Number(c?.factoryOverheadUsd) || 0);
  const machineRate = totalBase > 0 ? Math.max(0, totalBase - crewRate) : parts;
  return { machineRate: Number(machineRate.toFixed(4)), crewRate: Number(crewRate.toFixed(4)) };
}

export interface MachineThroughput {
  /** Practical output per hour, in `unit`. */
  perHour: number;
  unit: "sheet" | "meter" | "pick" | "cut" | "book";
  makeReadyMinutes: number;
}

/** Practical speed and make-ready time from the machine's technical specs. */
export function getMachineThroughput(machine: MachineRecord | null): MachineThroughput | null {
  if (!machine) return null;
  const m = machine;
  const pick = (): Omit<MachineThroughput, "makeReadyMinutes"> | null => {
    if (m.offsetSpecs?.practicalSpeedSph) return { perHour: m.offsetSpecs.practicalSpeedSph, unit: "sheet" };
    if (m.dieCuttingSpecs?.practicalSpeedSph) return { perHour: m.dieCuttingSpecs.practicalSpeedSph, unit: "sheet" };
    if (m.mountingSpecs?.practicalSpeedSph) return { perHour: m.mountingSpecs.practicalSpeedSph, unit: "sheet" };
    if (m.flexoSpecs?.practicalSpeedMpm) return { perHour: m.flexoSpecs.practicalSpeedMpm * 60, unit: "meter" };
    if (m.laminationSpecs?.practicalSpeedMpm) return { perHour: m.laminationSpecs.practicalSpeedMpm * 60, unit: "meter" };
    if (m.jacquardSpecs?.practicalRpm) return { perHour: m.jacquardSpecs.practicalRpm * 60, unit: "pick" };
    if (m.casingInSpecs?.speedCyclesPerHour) return { perHour: m.casingInSpecs.speedCyclesPerHour, unit: "book" };
    if (m.guillotineSpecs?.cycleTimeSec) return { perHour: Math.round(3600 / m.guillotineSpecs.cycleTimeSec), unit: "cut" };
    return null;
  };
  const base = pick();
  if (!base || !(base.perHour > 0)) return null;
  const makeReadyMinutes =
    m.offsetSpecs?.makeReadyMinutes ||
    m.flexoSpecs?.makeReadyMinutes ||
    m.dieCuttingSpecs?.makeReadyMinutes ||
    m.laminationSpecs?.makeReadyMinutes ||
    m.jacquardSpecs?.makeReadyMinutes ||
    m.mountingSpecs?.makeReadyMinutes ||
    m.casingInSpecs?.makeReadyMinutes ||
    0;
  return { ...base, makeReadyMinutes: Number(makeReadyMinutes) || 0 };
}

export interface DurationEstimate {
  hours: number;
  qty: number;
  throughput: MachineThroughput;
}

/**
 * Norm hours = make-ready + run quantity ÷ practical speed.
 * Only sheet-fed machines (planned sheets) and book lines (order quantity) have a known run quantity;
 * for roll, weaving and cutting machines it returns null and the hours stay manual.
 */
export function estimateOperationHours(
  machine: MachineRecord | null,
  plannedSheets: number,
  orderQuantity: number
): DurationEstimate | null {
  const tp = getMachineThroughput(machine);
  if (!tp) return null;
  const qty = tp.unit === "sheet" ? plannedSheets : tp.unit === "book" ? orderQuantity : 0;
  if (!(qty > 0)) return null;
  const hours = tp.makeReadyMinutes / 60 + qty / tp.perHour;
  return { hours: Math.max(0.1, Number(hours.toFixed(1))), qty, throughput: tp };
}

const splitOperators = (op: Pick<RouteStep, "operator" | "operators">): string[] =>
  op.operators && op.operators.length > 0
    ? op.operators
    : (op.operator || "").split(",").map((s) => s.trim()).filter(Boolean);

/** Hourly wage of one employee in UZS (HR keeps wages in UZS). */
function employeeHourlyWageUzs(emp: CostEmployee): number {
  const hourly = Number(emp.hourlyRate) || 0;
  const monthly = Number(emp.baseSalary) || 0;
  if (emp.wageType === "hourly") return hourly;
  if (emp.wageType === "salary") return monthly > 0 ? monthly / MONTHLY_WORK_HOURS : hourly;
  return hourly > 0 ? hourly : monthly > 0 ? monthly / MONTHLY_WORK_HOURS : 0;
}

/**
 * Actual run hours of a finished step: the recorded value (set at finish, correctable in the dialog),
 * else completedAt − startedAt − downtime. Null while the step is not finished or has no timestamps.
 */
export function getActualHours(
  op: Pick<RouteStep, "status" | "actualDurationMinutes" | "startedAt" | "completedAt" | "downtimeMinutes">
): number | null {
  if (op.status !== "Finished") return null;
  if (op.actualDurationMinutes !== undefined && op.actualDurationMinutes !== null) {
    return Math.max(0, Number(op.actualDurationMinutes) || 0) / 60;
  }
  const minutes = elapsedRunMinutes(op);
  return minutes === null ? null : minutes / 60;
}

/** completedAt − startedAt − downtime, in whole minutes; null without both timestamps. */
export function elapsedRunMinutes(
  op: Pick<RouteStep, "startedAt" | "completedAt" | "downtimeMinutes">
): number | null {
  if (!op.startedAt || !op.completedAt) return null;
  const ms = new Date(op.completedAt).getTime() - new Date(op.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.max(0, Math.round(ms / 60000) - (Number(op.downtimeMinutes) || 0));
}

/** Completed share of the step's planned quantity (0..n), or null when either side is unknown. */
function completedRatio(op: Partial<RouteStep> & { plannedQty?: number; completedQty?: number }): number | null {
  const planned = Number(op.plannedQty) || 0;
  let done = Number(op.completedQty);
  if (!Number.isFinite(done) || done <= 0) {
    done = parseFloat(String(op.qtyCompleted || "").split("/")[0].replace(/[^\d.]/g, "")) || 0;
  }
  return planned > 0 && done > 0 ? done / planned : null;
}

/**
 * Actual cost of a finished step: actual hours on the machine and for hourly labor,
 * piecework fund scaled to the quantity actually produced. Null while the step is not finished.
 */
export function computeOperationActualCost(
  op: RouteStep,
  ctx: { machines?: MachineRecord[]; employees?: CostEmployee[]; exchangeRate?: number }
): (OperationCostBreakdown & { hours: number }) | null {
  if (op.status !== "Finished") return null;
  const hours = getActualHours(op) ?? (Number(op.duration) || 0);
  const ratio = completedRatio(op);
  const fund = Number(op.pieceworkTotalUsd) || 0;
  const cost = computeOperationCost(
    { ...op, duration: hours, pieceworkTotalUsd: ratio !== null ? fund * ratio : fund },
    ctx
  );
  return { ...cost, hours };
}

export function computeOperationCost(
  op: Pick<
    RouteStep,
    "machine" | "machineId" | "operator" | "operators" | "duration" | "pieceworkTotalUsd" | "pieceworkRateUsd" | "costMode" | "manualCostUsd"
  >,
  ctx: { machines?: MachineRecord[]; employees?: CostEmployee[]; exchangeRate?: number }
): OperationCostBreakdown {
  const machine = resolveMachine(op, ctx.machines || []);
  const mode: OperationCostMode = op.costMode || "auto";
  const manualCostUsd = Number(op.manualCostUsd) || 0;

  const empty: OperationCostBreakdown = {
    mode,
    machine,
    machineRateUsd: 0,
    machineCostUsd: 0,
    laborBasis: "none",
    laborRateUsd: 0,
    laborMultiplier: 1,
    laborCostUsd: 0,
    manualCostUsd,
    totalUsd: manualCostUsd,
  };
  if (mode !== "auto") return empty;

  const hours = Math.max(0, Number(op.duration) || 0);
  const fx = Number(ctx.exchangeRate) || 12850;
  const { machineRate, crewRate } = getMachineCostRates(machine);
  const machineCostUsd = hours * machineRate;

  const names = splitOperators(op);
  const staff = (ctx.employees || []).filter((e) => e.status !== "terminated");
  const assigned = names
    .map((n) => staff.find((e) => e.fullName === n))
    .filter((e): e is CostEmployee => Boolean(e));

  let laborBasis: LaborBasis = "none";
  let laborRateUsd = 0;
  let laborMultiplier = 1;
  let laborCostUsd = 0;

  const pieceworkFund = Number(op.pieceworkTotalUsd) || 0;
  if (pieceworkFund > 0) {
    // Piecework is set per work type; the lead operator's grade multiplier scales it.
    laborBasis = "piecework";
    laborMultiplier = Number(assigned[0]?.pieceworkMultiplier) || 1;
    laborRateUsd = Number(op.pieceworkRateUsd) || 0;
    laborCostUsd = pieceworkFund * laborMultiplier;
  } else {
    const wageUzs = assigned.reduce((s, e) => s + employeeHourlyWageUzs(e), 0);
    if (wageUzs > 0) {
      laborBasis = "employees";
      laborRateUsd = wageUzs / fx;
    } else if (crewRate > 0) {
      laborBasis = "crew";
      laborRateUsd = crewRate;
    }
    laborCostUsd = hours * laborRateUsd;
  }

  const round = (v: number) => Number(v.toFixed(4));
  return {
    mode,
    machine,
    machineRateUsd: machineRate,
    machineCostUsd: round(machineCostUsd),
    laborBasis,
    laborRateUsd: round(laborRateUsd),
    laborMultiplier,
    laborCostUsd: round(laborCostUsd),
    manualCostUsd,
    totalUsd: round(machineCostUsd + laborCostUsd),
  };
}
