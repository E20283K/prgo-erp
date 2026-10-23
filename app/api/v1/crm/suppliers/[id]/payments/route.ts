import { NextRequest, NextResponse } from "next/server";
import { getSupplierPayments, recordSupplierPayment } from "@/lib/server/supplierService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const payments = await getSupplierPayments(id, companyCode);
    return NextResponse.json({
      success: true,
      data: payments,
      total: payments.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "To'lovlarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await recordSupplierPayment({ ...body, supplierId: id }, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "To'lovni kiritishda xatolik",
      },
      { status: 500 }
    );
  }
}
