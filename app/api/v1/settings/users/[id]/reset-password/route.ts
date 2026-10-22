import { NextRequest, NextResponse } from "next/server";
import { resetUserPassword } from "@/lib/server/authService";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Parol kamida 3 ta belgidan iborat bo'lishi kerak" },
        { status: 400 }
      );
    }

    const success = await resetUserPassword(id, newPassword.trim());
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Foydalanuvchi paroli muvaffaqiyatli yangilandi",
    });
  } catch (error: any) {
    console.error("[Reset Password POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Parolni yangilashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
