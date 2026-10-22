import { NextResponse } from "next/server";
import {
  getProductionMachineById,
  updateProductionMachine,
  deleteProductionMachine,
} from "@/lib/server/workOrderService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const machine = await getProductionMachineById(id, companyCode);
    if (!machine) {
      return NextResponse.json({ success: false, error: "Machine not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: machine });
  } catch (error) {
    console.error("GET /api/v1/production/machines/[id] error:", error);
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
    const machine = await updateProductionMachine(id, body, body.companyCode || "PRINTGOO");
    if (!machine) {
      return NextResponse.json({ success: false, error: "Machine not found or update failed" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: machine });
  } catch (error) {
    console.error("PUT /api/v1/production/machines/[id] error:", error);
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
    const deleted = await deleteProductionMachine(id, companyCode);
    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("DELETE /api/v1/production/machines/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
