import { NextRequest, NextResponse } from "next/server";
import { getItemsByCompany } from "@/lib/server/masterDataService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const category = searchParams.get("category") ?? undefined;
    const itemType = (searchParams.get("type") as any) ?? undefined;

    const items = await getItemsByCompany(companyCode, { category, itemType });
    return NextResponse.json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch items",
      },
      { status: 500 }
    );
  }
}
