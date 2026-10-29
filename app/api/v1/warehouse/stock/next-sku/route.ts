import { NextRequest, NextResponse } from "next/server";
import { getNextMaterialSku } from "@/lib/server/numberingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const nextSku = await getNextMaterialSku(companyCode);
    return NextResponse.json({
      success: true,
      data: { nextSku },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navbatdagi SKU hisoblashda xatolik",
      },
      { status: 500 }
    );
  }
}
