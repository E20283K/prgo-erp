import { NextRequest, NextResponse } from "next/server";
import { getWarehouseReceipts, upsertWarehouseReceipt } from "@/lib/server/warehouseService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const data = await getWarehouseReceipts(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Kirim orderlarini yuklashda xatolik",
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

    const result = await upsertWarehouseReceipt(body, companyCode);
    return NextResponse.json({
      success: true,
      data: result.allReceipts,
      receipt: result.receipt,
      receiptNumber: result.receiptNumber,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Kirim orderini saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}
