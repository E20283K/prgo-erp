import { NextResponse } from "next/server";
import { getProductionSpecifications, createProductionSpecification } from "@/lib/server/workOrderService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const specs = await getProductionSpecifications(companyCode);
    return NextResponse.json({ success: true, data: specs });
  } catch (error) {
    console.error("GET /api/v1/production/specifications error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const spec = await createProductionSpecification(body, body.companyCode || "PRINTGOO");
    return NextResponse.json({ success: true, data: spec });
  } catch (error) {
    console.error("POST /api/v1/production/specifications error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
