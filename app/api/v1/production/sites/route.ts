import { NextResponse } from "next/server";
import { getProductionSites, createProductionSite, deleteProductionSite } from "@/lib/server/workOrderService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const sites = await getProductionSites(companyCode);
    return NextResponse.json({ success: true, data: sites });
  } catch (error) {
    console.error("GET /api/v1/production/sites error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const site = await createProductionSite(body, body.companyCode || "PRINTGOO");
    return NextResponse.json({ success: true, data: site });
  } catch (error) {
    console.error("POST /api/v1/production/sites error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }
    const deleted = await deleteProductionSite(id);
    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("DELETE /api/v1/production/sites error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
