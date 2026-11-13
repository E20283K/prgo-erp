import { NextResponse, type NextRequest } from "next/server";
import { validateSession } from "./authService";
import type { ModulePermissionKey, ActionPermission } from "@/components/documents/user/types";

export type PermissionAction = keyof ActionPermission;
/** [modul, amal] juftligi — masalan ["warehouse", "edit"] */
export type PermissionRule = [ModulePermissionKey, PermissionAction];

export type ApiUser = NonNullable<Awaited<ReturnType<typeof validateSession>>>;

/**
 * Ombor ma'lumotlarini boshqa modullar ham o'qiydi (savdo — tayyor mahsulot, ishlab chiqarish — xomashyo,
 * moliya — chiqim/SF). Shu modullardan biriga "view" ruxsati bo'lsa, o'qishga ruxsat beriladi.
 */
export const WAREHOUSE_READ: PermissionRule[] = [
  ["warehouse", "view"],
  ["trading", "view"],
  ["production", "view"],
  ["finance", "view"],
];
export const WAREHOUSE_WRITE: PermissionRule[] = [
  ["warehouse", "create"],
  ["warehouse", "edit"],
];
export const WAREHOUSE_DELETE: PermissionRule[] = [["warehouse", "delete"]];

function readToken(request: NextRequest): string | null {
  const fromCookie = request.cookies.get("printgoo_session")?.value;
  if (fromCookie) return fromCookie;
  const header = request.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function hasAny(user: ApiUser, rules: PermissionRule[]): boolean {
  if (user.role === "admin") return true;
  const perms = (user.permissions || {}) as Partial<Record<ModulePermissionKey, Partial<ActionPermission>>>;
  return rules.some(([mod, action]) => perms[mod]?.[action] === true);
}

/**
 * API route uchun autentifikatsiya va ruxsat tekshiruvi.
 * Muvaffaqiyatda `{ user }`, aks holda tayyor 401/403 javobi `{ response }` qaytadi:
 *
 *   const auth = await requireApiUser(request, WAREHOUSE_WRITE);
 *   if ("response" in auth) return auth.response;
 */
export async function requireApiUser(
  request: NextRequest,
  rules: PermissionRule[]
): Promise<{ user: ApiUser } | { response: NextResponse }> {
  const token = readToken(request);
  const user = token ? await validateSession(token).catch(() => null) : null;
  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, ok: false, error: "Avtorizatsiyadan o'tilmagan. Qaytadan tizimga kiring." },
        { status: 401 }
      ),
    };
  }
  if (!hasAny(user, rules)) {
    return {
      response: NextResponse.json(
        { success: false, ok: false, error: "Bu amal uchun ruxsatingiz yo'q." },
        { status: 403 }
      ),
    };
  }
  return { user };
}
