import { NextRequest, NextResponse } from "next/server";
import { getAvailableFinishedGoodsForShipment } from "@/lib/server/warehouseService";
import { requireApiUser, WAREHOUSE_READ } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const data = await getAvailableFinishedGoodsForShipment(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Mavjud tayyor mahsulotlarni olishda xatolik",
      },
      { status: 500 }
    );
  }
}
