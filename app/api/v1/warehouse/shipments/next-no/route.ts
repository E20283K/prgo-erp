import { NextRequest, NextResponse } from "next/server";
import { getNextShipmentNumber } from "@/lib/server/numberingService";
import { requireApiUser, WAREHOUSE_READ } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const nextNo = await getNextShipmentNumber(companyCode);
    return NextResponse.json({
      success: true,
      data: { nextNo },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navbatdagi chiqim raqamini hisoblashda xatolik",
      },
      { status: 500 }
    );
  }
}
