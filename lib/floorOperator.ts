import { isLeadershipRole } from "./userRole";

export interface FloorRoleUser {
  role?: string | null;
  permissions?: unknown;
}

/**
 * Floor operator (pressman, machine operator, or anyone without production edit right).
 * Operators confirm the floor readiness gates (paper, plates, tooling) but not design
 * approval or the production stage.
 */
export function isFloorOperator(user: FloorRoleUser | null | undefined): boolean {
  if (!user || isLeadershipRole(user.role)) return false;
  const role = (user.role ?? "").toLowerCase();
  if (role.includes("operator") || role.includes("pressman") || role.includes("stanokchi")) return true;
  const production = (user.permissions as Record<string, Record<string, boolean> | undefined> | undefined)?.production;
  return Boolean(production && !production.edit);
}

/** Readiness gates a floor operator may set. */
export const FLOOR_OPERATOR_GATES = ["paperReady", "platesReady", "toolingReady"] as const;
