import { NextRequest, NextResponse } from "next/server";
import { getTradingOrders, upsertTradingOrder, deleteTradingOrder } from "@/lib/server/tradingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const data = await getTradingOrders(company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/v1/trading/orders error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const body = await req.json();
    const data = await upsertTradingOrder(body, company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/v1/trading/orders error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const company = searchParams.get("company") || "PRINTGOO";
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }
    const success = await deleteTradingOrder(id, company);
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error("DELETE /api/v1/trading/orders error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
