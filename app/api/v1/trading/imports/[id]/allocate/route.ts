import { NextRequest, NextResponse } from "next/server";
import { allocateImportToStock } from "@/lib/server/tradingService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";

    const result = await allocateImportToStock(id, company);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST /api/v1/trading/imports/[id]/allocate error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
