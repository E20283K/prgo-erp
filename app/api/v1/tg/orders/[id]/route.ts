import { NextRequest, NextResponse } from "next/server";
import { hasAny, requireApiUser } from "@/lib/server/apiAuth";
import { getTgOrder } from "@/lib/server/tgOrdersService";
import { TG_ORDER_PRICE_RULES, TG_ORDERS_RULES } from "../../ordersRules";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request, TG_ORDERS_RULES);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const data = await getTgOrder(auth.user.id, id, { withPrice: hasAny(auth.user, TG_ORDER_PRICE_RULES) });
    if (!data) return NextResponse.json({ success: false, error: "Buyurtma topilmadi" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
