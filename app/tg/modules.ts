import { ClipboardCheck, ClipboardList, type LucideIcon } from "lucide-react";
import type { SanitizedUser } from "@/lib/server/authService";

/**
 * Sections of the Telegram Mini App. A section shows for a user holding any of its rules;
 * the API routes behind it check the same rules again on the server.
 */
export interface TgModule {
  key: string;
  title: string;
  href: string;
  icon: LucideIcon;
  rules: Array<[string, "view" | "create" | "edit" | "delete"]>;
}

export const TG_MODULES: TgModule[] = [
  {
    key: "attendance",
    title: "Yo'qlama",
    href: "/tg/attendance",
    icon: ClipboardCheck,
    rules: [
      ["hr", "create"],
      ["hr", "edit"],
      ["production", "create"],
      ["production", "edit"],
    ],
  },
  {
    key: "orders",
    title: "Buyurtmalar",
    href: "/tg/orders",
    icon: ClipboardList,
    rules: [
      ["production", "view"],
      ["crm", "view"],
    ],
  },
];

export function canOpenModule(user: SanitizedUser, mod: TgModule): boolean {
  // Same rule as requireApiUser on the server: admin passes, others need a listed right.
  if (user.role === "admin") return true;
  const perms = (user.permissions || {}) as unknown as Record<string, Record<string, boolean> | undefined>;
  return mod.rules.some(([m, action]) => perms[m]?.[action] === true);
}
