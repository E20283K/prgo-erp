import { NextRequest, NextResponse } from "next/server";
import { convertOrderToSale } from "@/lib/server/tradingService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";

    const result = await convertOrderToSale(id, company);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("POST /api/v1/trading/orders/[id]/convert error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
