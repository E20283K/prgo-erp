/**
 * A work order's status is the business state; its stage is where it stands on the floor.
 * Only "Draft", "Active" and "Cancelled" are a manager's call. "In Production" and "Completed"
 * follow the stage, which itself follows the route steps (see syncOrderStageFromSteps).
 *
 *   Queue / Ready to Print / On Hold  → Active
 *   In Production / Post-press / Packaging → In Production
 *   Completed → Completed
 */
export type WorkOrderStatus = "Draft" | "Active" | "In Production" | "Completed" | "Cancelled";

/** Statuses a person sets by hand; the rest come from the stage. */
export const MANUAL_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = ["Draft", "Active", "Cancelled"];

const IN_PRODUCTION_STAGES = new Set(["In Production", "Post-press", "Packaging"]);

export function deriveWorkOrderStatus(
  status: string | null | undefined,
  stage: string | null | undefined
): WorkOrderStatus {
  if (status === "Draft" || status === "Cancelled") return status;
  if (stage === "Completed") return "Completed";
  if (stage && IN_PRODUCTION_STAGES.has(stage)) return "In Production";
  return "Active";
}
