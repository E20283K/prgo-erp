import { NextRequest, NextResponse } from "next/server";
import { getDispatchManifests, upsertDispatchManifest } from "@/lib/server/warehouseService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const data = await getDispatchManifests(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Yuk manifestlarini olishda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const result = await upsertDispatchManifest(body, companyCode);
    return NextResponse.json({
      success: true,
      data: result,
      message: "Yuk manifesti muvaffaqiyatli saqlandi",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Yuk manifestini saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}
