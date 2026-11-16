const ADMIN_ROLES = new Set(["admin", "administrator", "system administrator"]);

/** True when the role string belongs to a system administrator. */
export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.has((role ?? "").trim().toLowerCase());
}

const LEADERSHIP_ROLES = new Set([...ADMIN_ROLES, "superadmin", "director", "boshliq", "commercial director"]);

/** Administrators and company leadership: not bound by per-module permissions. */
export function isLeadershipRole(role: string | null | undefined): boolean {
  return LEADERSHIP_ROLES.has((role ?? "").trim().toLowerCase());
}

/** True when the role may release an urgent order of a client who is over their credit terms. */
export function canOverrideCreditHold(role: string | null | undefined): boolean {
  return isLeadershipRole(role);
}
