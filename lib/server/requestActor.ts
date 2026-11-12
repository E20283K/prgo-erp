import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "./authService";

export interface RequestActor {
  id: string;
  name: string;
}

/** Sessiya cookie yoki Bearer token bo'yicha joriy foydalanuvchini aniqlash (audit uchun). */
export async function getRequestActor(request: NextRequest): Promise<RequestActor | null> {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("printgoo_session")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const user = await validateSession(token);
    if (!user) return null;
    return { id: user.id, name: user.fullName || user.username };
  } catch {
    return null;
  }
}

/** Biznes xatosidagi httpStatus ni (409/422) olish; aks holda 500 */
export function errorHttpStatus(error: unknown): number {
  const s = (error as { httpStatus?: number } | null)?.httpStatus;
  return typeof s === "number" ? s : 500;
}
