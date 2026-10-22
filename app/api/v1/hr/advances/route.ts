import { NextRequest, NextResponse } from "next/server";
import { getEmployeeAdvancesList } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const period = searchParams.get("period") || undefined;

    const data = await getEmployeeAdvancesList(companyCode, period);
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 500 }
    );
  }
}
