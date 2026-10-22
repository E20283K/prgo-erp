import { NextResponse } from "next/server";
import {
  getProductionMachines,
  getNextMachineCode,
  createProductionMachine,
  updateProductionMachine,
  deleteProductionMachine,
} from "@/lib/server/workOrderService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    const nextCodeOnly = searchParams.get("nextCode") === "true";
    if (nextCodeOnly) {
      const nextCode = await getNextMachineCode(companyCode);
      return NextResponse.json({ success: true, nextCode });
    }
    const machines = await getProductionMachines(companyCode);
    return NextResponse.json({ success: true, data: machines });
  } catch (error) {
    console.error("GET /api/v1/production/machines error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const machine = await createProductionMachine(body, body.companyCode || "PRINTGOO");
    return NextResponse.json({ success: true, data: machine });
  } catch (error) {
    console.error("POST /api/v1/production/machines error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "Machine id is required" }, { status: 400 });
    }
    const machine = await updateProductionMachine(body.id, body, body.companyCode || "PRINTGOO");
    return NextResponse.json({ success: true, data: machine });
  } catch (error) {
    console.error("PUT /api/v1/production/machines error:", error);
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
    const companyCode = searchParams.get("companyCode") || "PRINTGOO";
    if (!id) {
      return NextResponse.json({ success: false, error: "Machine id is required" }, { status: 400 });
    }
    const deleted = await deleteProductionMachine(id, companyCode);
    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("DELETE /api/v1/production/machines error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
