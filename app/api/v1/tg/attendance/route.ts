import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, type PermissionRule } from "@/lib/server/apiAuth";
import { getRollCallSheet, resolveUserCompany, saveRollCall, type RollCallEntry } from "@/lib/server/tgAttendanceService";
import { publishRollCallSummaries } from "@/lib/server/rollCallGroupService";

export const dynamic = "force-dynamic";

/** Shift masters usually hold production rights, HR holds hr rights: either may take the roll call. */
const ROLL_CALL: PermissionRule[] = [
  ["hr", "create"],
  ["hr", "edit"],
  ["production", "create"],
  ["production", "edit"],
];

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, ROLL_CALL);
  if ("response" in auth) return auth.response;
  try {
    const date = new URL(request.url).searchParams.get("date") ?? "";
    const data = await getRollCallSheet(auth.user.id, date);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}

/** Body: { date: "YYYY-MM-DD", entries: [{ employeeId, status | null, shiftType, overtimeHours }] } */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, ROLL_CALL);
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { date?: string; entries?: RollCallEntry[] };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) throw new Error("Saqlanadigan belgi yo'q");
    if (entries.length > 1000) throw new Error("Bir so'rovda 1000 tadan ko'p belgi bo'lmaydi");
    const date = body.date ?? "";
    const result = await saveRollCall(auth.user.id, auth.user.fullName, date, entries);
    if (result.saved > 0) {
      const company = await resolveUserCompany(auth.user.id);
      await publishRollCallSummaries(company.id, date, entries, auth.user.fullName);
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
