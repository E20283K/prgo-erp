import { NextRequest, NextResponse } from "next/server";
import { syncAllEmployeesToDevice } from "@/lib/server/hikvisionService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const result = await syncAllEmployeesToDevice(id, companyCode);

    return NextResponse.json({
      success: result.success,
      totalSynced: result.totalSynced,
      errors: result.errors,
      message: `${result.totalSynced} nafar xodim terminalga muvaffaqiyatli sinxronlandi`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
