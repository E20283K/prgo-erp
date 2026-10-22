import { NextRequest, NextResponse } from "next/server";
import { getClientSettlements } from "@/lib/server/financeService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const settlements = await getClientSettlements(companyCode);
    return NextResponse.json({
      success: true,
      data: settlements,
      total: settlements.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Hisob-kitob saldosini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}
