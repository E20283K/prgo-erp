import { NextRequest, NextResponse } from "next/server";
import { getNextDeliveryActNumber } from "@/lib/server/numberingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const nextNo = await getNextDeliveryActNumber(companyCode);
    return NextResponse.json({
      success: true,
      data: { nextNo },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navbatdagi akt/faktura raqamini hisoblashda xatolik",
      },
      { status: 500 }
    );
  }
}
