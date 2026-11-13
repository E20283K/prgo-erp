import { NextRequest, NextResponse } from "next/server";
import { getDispatchManifests, upsertDispatchManifest } from "@/lib/server/warehouseService";
import { getRequestActor, errorHttpStatus } from "@/lib/server/requestActor";
import { requireApiUser, WAREHOUSE_READ, WAREHOUSE_WRITE } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "ALL";

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
  const auth = await requireApiUser(request, WAREHOUSE_WRITE);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "ALL";

    const actor = await getRequestActor(request);
    const result = await upsertDispatchManifest(body, companyCode, actor);
    return NextResponse.json({
      success: true,
      data: result,
      message: "Yuk manifesti muvaffaqiyatli saqlandi",
    });
  } catch (error) {
    const status = errorHttpStatus(error);
    if (status === 500) console.error("[POST /api/v1/warehouse/manifests]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Yuk manifestini saqlashda xatolik",
      },
      { status }
    );
  }
}
