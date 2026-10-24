import { NextRequest, NextResponse } from "next/server";
import { getYttEntities, upsertYttEntity } from "@/lib/server/tradingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const data = await getYttEntities(company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/v1/trading/ytt-limits error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "PRINTGOO";
    const body = await req.json();
    const data = await upsertYttEntity(body, company);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/v1/trading/ytt-limits error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
