import { NextRequest, NextResponse } from "next/server";
import { checkAndTriggerReorder } from "@/lib/server/warehouseService";
import { requireApiUser, WAREHOUSE_WRITE } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_WRITE);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    if (!body.originalWorkOrderId || !body.buyerCustomerName) {
      return NextResponse.json(
        { success: false, error: "originalWorkOrderId va buyerCustomerName talab qilinadi" },
        { status: 400 }
      );
    }

    const result = await checkAndTriggerReorder({
      originalWorkOrderId: body.originalWorkOrderId,
      divertedQty: Number(body.divertedQty) || 0,
      buyerCustomerName: body.buyerCustomerName,
      notes: body.notes,
      companyCode,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Reorder tekshirishda xatolik",
      },
      { status: 500 }
    );
  }
}
