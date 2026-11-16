import { isLeadershipRole } from "./userRole";

/**
 * Module right needed to write through the API. Reads stay open to every signed-in user (screens
 * read across modules: an order reads clients, the warehouse reads orders). Warehouse routes
 * check themselves (lib/server/apiAuth.ts). The first matching rule applies.
 */
const WRITE_RULES: Array<{ prefix: string; modules: string[] }> = [
  { prefix: "/api/v1/finance/", modules: ["finance"] },
  { prefix: "/api/v1/hr/", modules: ["hr"] },
  // Production raises supplier orders too (dies, plates).
  { prefix: "/api/v1/crm/suppliers", modules: ["crm", "production"] },
  { prefix: "/api/v1/crm/", modules: ["crm"] },
  { prefix: "/api/v1/production/", modules: ["production"] },
];

/** Removing an entry inside a document (not the document itself) needs only the edit right. */
const SUB_RESOURCE_DELETE = /\/(events|files|contracts|unlink)$/;

export interface WriteAccessUser {
  role?: string | null;
  permissions?: unknown;
}

/** True when the user may not perform this write. Reads and paths outside the rules are never forbidden. */
export function isWriteForbidden(user: WriteAccessUser, pathname: string, method: string): boolean {
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return false;
  const rule = WRITE_RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule || isLeadershipRole(user.role)) return false;

  const perms = (user.permissions || {}) as Record<string, Record<string, boolean> | undefined>;
  const can = (action: string) => rule.modules.some((m) => perms[m]?.[action] === true);
  if (verb === "DELETE") {
    return !(can("delete") || (SUB_RESOURCE_DELETE.test(pathname) && can("edit")));
  }
  return !(can("create") || can("edit"));
}
