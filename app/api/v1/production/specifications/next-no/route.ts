import { NextRequest, NextResponse } from "next/server";
import { getNextSpecNumber } from "@/lib/server/numberingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const nextNo = await getNextSpecNumber(companyCode);
    return NextResponse.json({
      success: true,
      data: { nextNo },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navbatdagi spetsifikatsiya raqamini hisoblashda xatolik",
      },
      { status: 500 }
    );
  }
}
