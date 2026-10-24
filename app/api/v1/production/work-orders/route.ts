import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWorkOrders, upsertWorkOrder } from "@/lib/server/workOrderService";
import { validateSession } from "@/lib/server/authService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const orders = await getWorkOrders(companyCode);
    return NextResponse.json({
      success: true,
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ishlab chiqarish buyruqlarini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    if (!body.author && !body.user) {
      try {
        const cookieStore = await cookies();
        const token =
          cookieStore.get("printgoo_session")?.value ||
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (token) {
          const sessionUser = await validateSession(token);
          if (sessionUser) {
            body.author = {
              id: sessionUser.id,
              name: sessionUser.fullName || sessionUser.username,
              role: sessionUser.role,
            };
          }
        }
      } catch (_) {}
    }

    const result = await upsertWorkOrder(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Buyurtmani saqlashda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
