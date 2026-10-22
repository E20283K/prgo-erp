import { NextRequest, NextResponse } from "next/server";
import { calculatePeriodPayroll } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const period = body.period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    const result = await calculatePeriodPayroll(period, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Hisoblashda xatolik" },
      { status: 500 }
    );
  }
}
