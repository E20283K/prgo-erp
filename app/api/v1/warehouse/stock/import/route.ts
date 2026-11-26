import { NextRequest, NextResponse } from "next/server";
import { importStockBalances, type StockImportRow } from "@/lib/server/warehouseService";
import { requireApiUser, WAREHOUSE_WRITE } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, WAREHOUSE_WRITE);
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const rows: StockImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Import uchun qator yo'q" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Bir martada ko'pi bilan ${MAX_ROWS} qator yuklash mumkin` },
        { status: 400 }
      );
    }

    const result = await importStockBalances(rows, companyCode, {
      id: auth.user.id,
      name: auth.user.fullName || auth.user.username,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Qoldiqlarni import qilishda xatolik",
      },
      { status: 500 }
    );
  }
}
