import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser, deleteUser } from "@/lib/server/userService";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getUserById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error("[User Detail GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Foydalanuvchini yuklashda xatolik" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const updated = await updateUser(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error: any) {
    console.error("[User Detail PUT Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Foydalanuvchini yangilashda xatolik" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteUser(id);

    return NextResponse.json({
      success: true,
      message: "Foydalanuvchi muvaffaqiyatli o'chirildi",
    });
  } catch (error: any) {
    console.error("[User Detail DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Foydalanuvchini o'chirishda xatolik" },
      { status: 500 }
    );
  }
}
