import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getAttendanceList, setManualAttendance, type ManualAttendanceEntry } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const workDate = searchParams.get("workDate") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const period = searchParams.get("period") || undefined;

    const data = await getAttendanceList(companyCode, { workDate, employeeId, status, period });
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 500 }
    );
  }
}

/** Manual timesheet marks: { entries: [{ employeeId, workDate, status | null }] }. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [["hr", "edit"]]);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as { entries?: ManualAttendanceEntry[] };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) throw new Error("Belgilanadigan yozuv yo'q");
    if (entries.length > 2000) throw new Error("Bir so'rovda 2000 tadan ko'p yozuv bo'lmaydi");
    const result = await setManualAttendance(
      entries,
      searchParams.get("company") ?? "PRINTGOO",
      auth.user.fullName
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
