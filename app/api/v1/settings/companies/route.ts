import { NextRequest, NextResponse } from "next/server";
import { getCompanies, upsertCompany, deleteCompany } from "@/lib/server/companyService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCompanies();
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error("GET /api/v1/settings/companies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Kompaniyalarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await upsertCompany(body);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("POST /api/v1/settings/companies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Kompaniyani saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID ko'rsatilmadi" }, { status: 400 });
    }
    await deleteCompany(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/v1/settings/companies error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Kompaniyani o'chirishda xatolik",
      },
      { status: 500 }
    );
  }
}
