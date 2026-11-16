import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWorkOrders, upsertWorkOrder, WorkOrderValidationError } from "@/lib/server/workOrderService";
import { validateSession } from "@/lib/server/authService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const clientId = searchParams.get("clientId");
    const customer = searchParams.get("customer")?.trim().toLowerCase();

    let orders = await getWorkOrders(companyCode);
    // Mijoz bo'yicha filtr: avval clientId, clientId siz eski buyurtmalar uchun nom bo'yicha
    if (clientId || customer) {
      orders = orders.filter((o) =>
        o.clientId
          ? o.clientId === clientId
          : !!customer && o.customer?.trim().toLowerCase() === customer
      );
    }
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

    // Who saves the order is taken from the session, never from the request body: the author's
    // role decides what they may do (e.g. release an urgent order past a credit hold).
    delete body.user;
    delete body.author;
    try {
      const cookieStore = await cookies();
      const token =
        cookieStore.get("printgoo_session")?.value ||
        request.headers.get("authorization")?.replace("Bearer ", "");
      const sessionUser = token ? await validateSession(token) : null;
      if (sessionUser) {
        body.author = {
          id: sessionUser.id,
          name: sessionUser.fullName || sessionUser.username,
          role: sessionUser.role,
        };
      }
    } catch (_) {}

    const result = await upsertWorkOrder(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkOrderValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Buyurtmani saqlashda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
