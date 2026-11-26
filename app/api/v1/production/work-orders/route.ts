import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getWorkOrderByKey,
  getWorkOrders,
  getWorkOrdersPage,
  upsertWorkOrder,
  WorkOrderValidationError,
} from "@/lib/server/workOrderService";
import { validateSession } from "@/lib/server/authService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    // Mijoz bo'yicha filtr: avval clientId, clientId siz eski buyurtmalar uchun nom bo'yicha
    const filters = {
      clientId: searchParams.get("clientId") || undefined,
      customer: searchParams.get("customer")?.trim() || undefined,
      search: searchParams.get("q")?.trim() || undefined,
      status: searchParams.get("status") || undefined,
      department: searchParams.get("department") || undefined,
    };

    // Bitta buyurtma (buyurtma kartasi uchun)
    const key = searchParams.get("docNo");
    if (key) {
      const order = await getWorkOrderByKey(companyCode, key);
      if (!order) {
        return NextResponse.json({ success: false, error: "Buyurtma topilmadi" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: order });
    }

    // Sahifalab: ?limit=100&cursor=... — reyestr ro'yxat oxiriga yetganda keyingisini so'raydi
    const limit = Number(searchParams.get("limit"));
    if (limit > 0) {
      const page = await getWorkOrdersPage(companyCode, { ...filters, limit, cursor: searchParams.get("cursor") });
      return NextResponse.json({
        success: true,
        data: page.items,
        nextCursor: page.nextCursor,
        total: page.total,
      });
    }

    const orders = await getWorkOrders(companyCode, filters);
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
