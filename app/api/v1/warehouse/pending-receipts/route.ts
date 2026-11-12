import { NextRequest, NextResponse } from "next/server";
import {
  getPendingFinishedGoodsReceipts,
  confirmFinishedGoodsReceipt,
} from "@/lib/server/warehouseService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const data = await getPendingFinishedGoodsReceipts(companyCode);
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Kutilayotgan qabullarni olishda xatolik",
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

    if (!body.fgId) {
      return NextResponse.json(
        { success: false, error: "fgId parametri kiritilishi shart" },
        { status: 400 }
      );
    }

    const result = await confirmFinishedGoodsReceipt(
      body.fgId,
      body.confirmedQty,
      body.locationShelf,
      companyCode
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: "Tayyor mahsulot omborga qabul qilindi",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tayyor mahsulotni qabul qilishda xatolik",
      },
      { status: 500 }
    );
  }
}
