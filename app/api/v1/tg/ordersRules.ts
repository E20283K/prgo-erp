import type { PermissionRule } from "@/lib/server/apiAuth";

/** Who may see work orders in the Mini App: the same rules as the "Buyurtmalar" section in app/tg/modules.ts. */
export const TG_ORDERS_RULES: PermissionRule[] = [
  ["production", "view"],
  ["crm", "view"],
];
