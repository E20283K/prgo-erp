import { NextRequest, NextResponse } from "next/server";
import { getCarriers, upsertCarrier, deleteCarrier } from "@/lib/server/warehouseService";
import { requireApiUser, WAREHOUSE_DELETE, WAREHOUSE_READ, WAREHOUSE_WRITE } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "ALL";

    const data = await getCarriers(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tashuvchilarni yuklashda xatolik",
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

    const result = await upsertCarrier(body, companyCode);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tashuvchini saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_DELETE);
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "ALL";

    if (!id) {
      return NextResponse.json({ success: false, error: "ID ko'rsatilmagan" }, { status: 400 });
    }

    const result = await deleteCarrier(id, companyCode);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tashuvchini o'chirishda xatolik",
      },
      { status: 500 }
    );
  }
}
