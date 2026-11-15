const ADMIN_ROLES = new Set(["admin", "administrator", "system administrator"]);

/** True when the role string belongs to a system administrator. */
export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.has((role ?? "").trim().toLowerCase());
}
