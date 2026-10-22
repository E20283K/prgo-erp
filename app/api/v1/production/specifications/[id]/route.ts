import { NextResponse } from "next/server";
import {
  getProductionSpecificationById,
  upsertProductionSpecification,
  deleteProductionSpecification,
} from "@/lib/server/workOrderService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const spec = await getProductionSpecificationById(id, companyCode);
    if (!spec) {
      return NextResponse.json({ success: false, error: "Specification not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: spec });
  } catch (error) {
    console.error("GET /api/v1/production/specifications/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await upsertProductionSpecification(
      { ...body, id: body.id || id },
      body.companyCode || "PRINTGOO"
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/v1/production/specifications/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const deleted = await deleteProductionSpecification(id, companyCode);
    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("DELETE /api/v1/production/specifications/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
