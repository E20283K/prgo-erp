import { NextRequest, NextResponse } from "next/server";
import { getDiesTooling } from "@/lib/server/masterDataService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const shape = (searchParams.get("shape") as any) ?? undefined;

    const dies = await getDiesTooling(companyCode, shape);
    return NextResponse.json({
      success: true,
      data: dies,
      total: dies.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dies and tooling",
      },
      { status: 500 }
    );
  }
}
