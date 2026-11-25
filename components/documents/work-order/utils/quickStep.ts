import type { RouteStep } from "../types";
import type { MachineRecord } from "@/components/documents/machine/types";
import type { WorkRateRecord } from "@/components/documents/work-rate/types";
import { estimateOperationHours, resolveMachine } from "./operationCost";

export const SHEET_BASED_UNITS = new Set([
  "1,000 sheets",
  "1,000 impressions",
  "1,000 strokes",
  "1,000 glue passes",
]);

/** Quantity a catalog operation is counted by: hours, planned sheets, or the order quantity. */
export function resolveCalcBaseQty(
  calcUnit: string | undefined,
  orderQuantity: number,
  plannedSheets: number,
  duration: number
): number {
  if (calcUnit === "1 hour") return Math.max(0, duration || 0);
  if (calcUnit && SHEET_BASED_UNITS.has(calcUnit) && plannedSheets > 0) return plannedSheets;
  return Math.max(0, orderQuantity || 0);
}

/** Operators on a step: the list, or the legacy comma-separated name. */
export function stepOperatorCount(step: { operators?: string[]; operator?: string }): number {
  if (step.operators && step.operators.length > 0) return step.operators.length;
  return (step.operator || "").split(",").filter((x) => x.trim()).length;
}

/**
 * Piecework of a step linked to a catalog operation, in USD: lead rate per the operation's unit, and
 * the fund = units × (lead rate + assistants × assistant rate). The one formula for every route step.
 */
export function catalogPieceworkUsd(
  op: Pick<WorkRateRecord, "unit" | "unitDivisor" | "currency" | "pieceRate" | "helperPieceRate">,
  ctx: { orderQuantity: number; plannedSheets: number; duration: number; operatorCount: number; exchangeRate: number }
): { leadRateUsd: number; totalUsd: number } {
  const toUsd = (v: number) =>
    (op.currency || "UZS").toUpperCase() === "USD" ? v : v / (Number(ctx.exchangeRate) || 12850);
  const qty = resolveCalcBaseQty(op.unit, ctx.orderQuantity, ctx.plannedSheets, ctx.duration);
  const units = qty / Math.max(1, op.unitDivisor || 1);
  const helpers = Math.max(0, ctx.operatorCount - 1);
  const leadRateUsd = toUsd(op.pieceRate || 0);
  return { leadRateUsd, totalUsd: units * (leadRateUsd + helpers * toUsd(op.helperPieceRate || 0)) };
}

interface QuickStepContext {
  machines: MachineRecord[];
  employees: { fullName?: string; status?: string }[];
  orderQuantity: number;
  plannedSheets: number;
  exchangeRate: number;
  stepNumber: number;
  /** Machine name preselected on the order (press), used when the operation has no default machine. */
  fallbackMachine?: string;
}

/**
 * A ready route step from a catalog operation: default machine, norm hours, the machine's lead
 * operator (only when HR knows them) and the piecework fund. Money is stored in USD like every route step.
 */
export function buildQuickStep(op: WorkRateRecord, ctx: QuickStepContext): RouteStep {
  const machines = ctx.machines || [];
  const byId = op.defaultMachineId ? machines.find((m) => m.id === op.defaultMachineId) || null : null;
  const machine = byId || resolveMachine({ machine: ctx.fallbackMachine || "" }, machines);

  const lead = machine?.leadOperator?.trim();
  const leadInHr = Boolean(
    lead && ctx.employees.some((e) => e.status !== "terminated" && e.fullName === lead)
  );
  const operators = lead && leadInHr ? [lead] : [];

  const estimate = estimateOperationHours(machine, ctx.plannedSheets, ctx.orderQuantity);
  const duration = estimate?.hours ?? 1;

  const { leadRateUsd: leadRate, totalUsd: total } = catalogPieceworkUsd(op, {
    orderQuantity: ctx.orderQuantity,
    plannedSheets: ctx.plannedSheets,
    duration,
    operatorCount: operators.length,
    exchangeRate: ctx.exchangeRate,
  });

  return {
    id: `op-${Date.now()}`,
    stepNumber: ctx.stepNumber,
    name: op.name,
    workRateId: op.id,
    machine: machine?.name || ctx.fallbackMachine || "",
    machineId: machine?.id,
    operator: operators.join(", "),
    operators,
    duration,
    qtyCompleted: `0 / ${(ctx.orderQuantity || 5000).toLocaleString()}`,
    status: "Queued",
    calcUnit: "1,000 sheets",
    unitDivisor: 1000,
    rateUsd: 0,
    setupFeeUsd: 0,
    pieceworkRateUsd: Number(leadRate.toFixed(6)),
    plannedCostUsd: 0,
    pieceworkTotalUsd: Number(total.toFixed(6)),
    costMode: "auto",
    manualCostUsd: 0,
  } as RouteStep;
}
