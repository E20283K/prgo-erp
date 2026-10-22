import { NextRequest, NextResponse } from "next/server";
import { getSuppliers, upsertSupplier } from "@/lib/server/supplierService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const suppliersList = await getSuppliers(companyCode);
    return NextResponse.json({
      success: true,
      data: suppliersList,
      total: suppliersList.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ta'minotchilarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await upsertSupplier(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ta'minotchini saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}
