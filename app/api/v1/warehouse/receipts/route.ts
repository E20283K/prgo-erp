import { NextRequest, NextResponse } from "next/server";
import { getWarehouseReceipts, upsertWarehouseReceipt } from "@/lib/server/warehouseService";
import { requireApiUser, WAREHOUSE_READ, WAREHOUSE_WRITE } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_READ);
  if ("response" in auth) return auth.response;

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
  const auth = await requireApiUser(request, WAREHOUSE_WRITE);
  if ("response" in auth) return auth.response;

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
