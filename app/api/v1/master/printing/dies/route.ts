import { NextRequest, NextResponse } from "next/server";
import {
  getDiesTooling,
  getNextDieCode,
  createDieTooling,
  updateDieTooling,
  deleteDieTooling,
} from "@/lib/server/masterDataService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const nextCodeOnly = searchParams.get("nextCode") === "true";
    if (nextCodeOnly) {
      const nextCode = await getNextDieCode(companyCode);
      return NextResponse.json({ success: true, nextCode });
    }
    const shape = (searchParams.get("shape") as any) ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const customerId = searchParams.get("customerId") ?? undefined;
    const isDedicatedParam = searchParams.get("isDedicated");
    const isDedicated = isDedicatedParam !== null ? isDedicatedParam === "true" : undefined;

    const dies = await getDiesTooling(companyCode, shape, search, customerId, isDedicated);
    return NextResponse.json({
      success: true,
      data: dies,
      total: dies.length,
    });
  } catch (error) {
    console.error("GET /api/v1/master/printing/dies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dies and tooling",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyCode = body.companyCode || "PRINTGOO";
    const die = await createDieTooling(body, companyCode);
    return NextResponse.json({ success: true, data: die });
  } catch (error) {
    console.error("POST /api/v1/master/printing/dies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create die tooling",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Die tooling id is required" },
        { status: 400 }
      );
    }
    const companyCode = body.companyCode || "PRINTGOO";
    const die = await updateDieTooling(body.id, body, companyCode);
    return NextResponse.json({ success: true, data: die });
  } catch (error) {
    console.error("PUT /api/v1/master/printing/dies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update die tooling",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Die tooling id is required" },
        { status: 400 }
      );
    }
    const deleted = await deleteDieTooling(id, companyCode);
    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error) {
    console.error("DELETE /api/v1/master/printing/dies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete die tooling",
      },
      { status: 500 }
    );
  }
}
