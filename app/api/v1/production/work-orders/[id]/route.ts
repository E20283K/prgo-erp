import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteWorkOrder } from "@/lib/server/workOrderService";
import { validateSession } from "@/lib/server/authService";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Buyurtma identifikatori ko'rsatilmadi" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const mode = (searchParams.get("mode") as "auto" | "cancel" | "hard_delete") || "auto";
    const reason = searchParams.get("reason") || undefined;

    // 1. Session va Foydalanuvchi huquqlarini tekshirish
    let sessionUser: any = null;
    try {
      const cookieStore = await cookies();
      const token =
        cookieStore.get("printgoo_session")?.value ||
        request.headers.get("authorization")?.replace("Bearer ", "");
      if (token) {
        sessionUser = await validateSession(token);
      }
    } catch (_) {}

    // Fallback: Agar request body'da author kelgan bo'lsa (dev/demo mode)
    let bodyAuthor: any = null;
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        const body = JSON.parse(text);
        if (body && (body.user || body.author)) {
          bodyAuthor = body.user || body.author;
        }
      }
    } catch (_) {}

    const currentUser = sessionUser || bodyAuthor;

    // RBAC huquqlarini tekshirish: Admin yoki production.delete huquqi
    if (currentUser) {
      const role = (currentUser.role || "").toLowerCase();
      const isAdmin =
        role === "admin" ||
        role === "superadmin" ||
        role === "system administrator" ||
        role === "administrator" ||
        role === "boshliq" ||
        role === "director";
      const hasProdDeletePermission = currentUser.permissions?.production?.delete === true;

      if (!isAdmin && !hasProdDeletePermission) {
        return NextResponse.json(
          {
            success: false,
            error: "Buyurtmani o'chirish yoki bekor qilish uchun huquqingiz yetarli emas! (production.delete ruxsati talab qilinadi)",
          },
          { status: 403 }
        );
      }
    }

    const authorPayload = currentUser
      ? {
          id: currentUser.id,
          name: currentUser.fullName || currentUser.username || currentUser.name || "Foydalanuvchi",
          role: currentUser.role || "Operator",
        }
      : undefined;

    const result = await deleteWorkOrder(
      id,
      companyCode,
      authorPayload,
      mode,
      reason
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Buyurtmani o'chirishda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
