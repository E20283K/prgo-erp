import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession } from "@/lib/server/authService";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("printgoo_session")?.value;

    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      await destroySession(token);
    }

    cookieStore.delete("printgoo_session");

    return NextResponse.json({
      success: true,
      message: "Tizimdan muvaffaqiyatli chiqildi",
    });
  } catch (error: any) {
    console.error("[Auth Logout Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Tizimdan chiqishda xatolik" },
      { status: 500 }
    );
  }
}
