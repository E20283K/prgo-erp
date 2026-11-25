import type { PermissionRule } from "@/lib/server/apiAuth";

/** Who may see work orders in the Mini App: the same rules as the "Buyurtmalar" section in app/tg/modules.ts. */
export const TG_ORDERS_RULES: PermissionRule[] = [
  ["production", "view"],
  ["crm", "view"],
];

/** Who also sees the order's price in the Mini App card: sales and finance, not the shop floor. */
export const TG_ORDER_PRICE_RULES: PermissionRule[] = [
  ["crm", "view"],
  ["finance", "view"],
];
