import { NextRequest, NextResponse } from "next/server";

const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const upstreamRes = await fetch(`${DOC_SERVICE_URL}/api/pdf/analyze-artwork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: "Document service color analysis error", details: errText },
        { status: upstreamRes.status }
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[analyze-artwork] Failed to analyze artwork colors:", err);
    return NextResponse.json(
      { error: "Failed to connect to document analysis service", details: err?.message },
      { status: 500 }
    );
  }
}
