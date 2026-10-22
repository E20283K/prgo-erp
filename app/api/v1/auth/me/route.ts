import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, seedDefaultUsersIfEmpty } from "@/lib/server/authService";

export async function GET(req: NextRequest) {
  try {
    await seedDefaultUsersIfEmpty();

    const cookieStore = await cookies();
    let token = cookieStore.get("printgoo_session")?.value;

    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Aktiv sessiya topilmadi" },
        { status: 401 }
      );
    }

    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sessiya muddati tugagan yoki yaroqsiz" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error("[Auth Me Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Sessiyani tekshirishda xatolik" },
      { status: 500 }
    );
  }
}
