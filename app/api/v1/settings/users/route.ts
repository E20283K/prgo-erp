import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, createUser } from "@/lib/server/userService";

export async function GET() {
  try {
    const usersList = await getAllUsers();
    return NextResponse.json({
      success: true,
      users: usersList,
    });
  } catch (error: any) {
    console.error("[Users GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Foydalanuvchilarni yuklashda xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.username || !body.fullName) {
      return NextResponse.json(
        { success: false, error: "Login va to'liq ism majburiy" },
        { status: 400 }
      );
    }

    const newUser = await createUser(body);
    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (error: any) {
    console.error("[Users POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Foydalanuvchi yaratishda xatolik" },
      { status: 500 }
    );
  }
}
