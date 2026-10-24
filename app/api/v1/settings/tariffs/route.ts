import { NextRequest, NextResponse } from "next/server";
import { getTariffs, upsertTariff, deleteTariff } from "@/lib/server/tariffService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const data = await getTariffs(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error("GET /api/v1/settings/tariffs error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tariflarni yuklashda xatolik",
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

    const result = await upsertTariff(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/settings/tariffs error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tarifni saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    if (!id) {
      return NextResponse.json({ success: false, error: "Tarif ID berilmadi" }, { status: 400 });
    }

    const ok = await deleteTariff(id, companyCode);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error("DELETE /api/v1/settings/tariffs error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tarifni o'chirishda xatolik",
      },
      { status: 500 }
    );
  }
}
