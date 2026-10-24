import { NextRequest, NextResponse } from "next/server";
import { syncEmployeeToAllActiveDevices } from "@/lib/server/hikvisionService";
import { getEmployeeById } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const emp = await getEmployeeById(id);
    if (!emp) {
      return NextResponse.json({ success: false, message: "Xodim topilmadi" }, { status: 404 });
    }

    const result = await syncEmployeeToAllActiveDevices(
      {
        id: emp.id,
        badgeNumber: emp.badgeNumber || emp.badgeNo,
        fullName: emp.fullName,
        avatarUrl: emp.avatarUrl,
      },
      companyCode
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
