import { NextRequest, NextResponse } from "next/server";
import { getEmployeeHistoryList } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await getEmployeeHistoryList(id);
    return NextResponse.json({ success: true, data: history, total: history.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Tarixni yuklashda xatolik" },
      { status: 500 }
    );
  }
}
