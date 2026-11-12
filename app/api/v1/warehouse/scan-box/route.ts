import { NextRequest, NextResponse } from "next/server";
import { lookupBoxOrWorkOrderBarcode } from "@/lib/server/warehouseService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const barcode = String(body.barcode || "").trim();
    // companyCode kod yoki UUID bo'lishi mumkin (getCompanyIdByCode ikkalasini ham qabul qiladi)
    const companyCode = body.companyCode || body.companyId || "PRINTGOO";

    if (!barcode) {
      return NextResponse.json(
        { ok: false, error: "Shtrix-kod kiritilmadi" },
        { status: 400 }
      );
    }

    const result = await lookupBoxOrWorkOrderBarcode(barcode, companyCode);
    return NextResponse.json({
      ok: result.found,
      ...result,
    });
  } catch (err: any) {
    console.error("[POST /api/v1/warehouse/scan-box] Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Shtrix-kodni tekshirishda xatolik" },
      { status: 500 }
    );
  }
}
