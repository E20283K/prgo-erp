import { NextRequest, NextResponse } from "next/server";
import { getSupplierSettlementLedger } from "@/lib/server/supplierService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const ledgerData = await getSupplierSettlementLedger(id, companyCode);
    return NextResponse.json({
      success: true,
      data: ledgerData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Akt-sverka ma'lumotlarini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}
