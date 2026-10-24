import { NextRequest, NextResponse } from "next/server";
import { getTradingImports, upsertTradingImport } from "@/lib/server/tradingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const data = await getTradingImports(company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/v1/trading/imports error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const body = await req.json();
    const data = await upsertTradingImport(body, company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/v1/trading/imports error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
