import { NextRequest, NextResponse } from "next/server";
import { getPieceworkList, upsertPieceworkRecord } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const workOrderId = searchParams.get("workOrderId") || undefined;

    const data = await getPieceworkList(companyCode, { employeeId, status, workOrderId });
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const result = await upsertPieceworkRecord(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 500 }
    );
  }
}
