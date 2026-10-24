import { NextRequest, NextResponse } from "next/server";
import { getTradingSettlements, recordTradingPayment } from "@/lib/server/tradingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const seller = searchParams.get("seller") || undefined;
    const customer = searchParams.get("customer") || undefined;

    const data = await getTradingSettlements(company, seller, customer);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/v1/trading/settlements error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const body = await req.json();

    const data = await recordTradingPayment(body, company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/v1/trading/settlements error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
