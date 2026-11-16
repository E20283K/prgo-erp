const ADMIN_ROLES = new Set(["admin", "administrator", "system administrator"]);

/** True when the role string belongs to a system administrator. */
export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.has((role ?? "").trim().toLowerCase());
}

const CREDIT_OVERRIDE_ROLES = new Set([...ADMIN_ROLES, "superadmin", "director", "boshliq", "commercial director"]);

/** True when the role may release an urgent order of a client who is over their credit terms. */
export function canOverrideCreditHold(role: string | null | undefined): boolean {
  return CREDIT_OVERRIDE_ROLES.has((role ?? "").trim().toLowerCase());
}
