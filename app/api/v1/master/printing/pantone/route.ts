import { NextRequest, NextResponse } from "next/server";
import { getPantoneCatalog } from "@/lib/server/masterDataService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;
    const category = searchParams.get("category") ?? undefined;

    const colors = await getPantoneCatalog(query, category);
    return NextResponse.json({
      success: true,
      data: colors,
      total: colors.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch pantone colors",
      },
      { status: 500 }
    );
  }
}
