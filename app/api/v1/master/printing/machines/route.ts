import { NextRequest, NextResponse } from "next/server";
import { getFlexoMachinesWithCylinders } from "@/lib/server/masterDataService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const machines = await getFlexoMachinesWithCylinders(companyCode);
    return NextResponse.json({
      success: true,
      data: machines,
      total: machines.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch flexo machines",
      },
      { status: 500 }
    );
  }
}
