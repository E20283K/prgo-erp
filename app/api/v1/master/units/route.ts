import { NextResponse } from "next/server";
import { getUnitsOfMeasure } from "@/lib/server/masterDataService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const units = await getUnitsOfMeasure();
    return NextResponse.json({
      success: true,
      data: units,
      total: units.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch units of measure",
      },
      { status: 500 }
    );
  }
}
