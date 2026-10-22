import { NextRequest, NextResponse } from "next/server";
import { getAttendanceList } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const workDate = searchParams.get("workDate") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;

    const data = await getAttendanceList(companyCode, { workDate, employeeId, status });
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 500 }
    );
  }
}
