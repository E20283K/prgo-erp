import { NextRequest, NextResponse } from "next/server";
import { getLastToolingPrice } from "@/lib/server/supplierService";
import type { ToolingCategory } from "@/components/documents/work-order/types";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set<ToolingCategory>([
  "ctp_plates",
  "die_cutting",
  "foil_cliche",
  "emboss_cliche",
  "varnish_plate",
  "flexo_polymer",
]);

/** Unit price of the latest supplier order for a tooling kind: ?category=&unit=&currency= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";
    const category = searchParams.get("category") as ToolingCategory | null;
    const unit = searchParams.get("unit") || "dona";
    const currency = (searchParams.get("currency") || "UZS").toUpperCase();

    if (!category || !CATEGORIES.has(category)) {
      return NextResponse.json({ success: false, error: "Jihoz turi noto'g'ri" }, { status: 400 });
    }

    const data = await getLastToolingPrice(companyCode, { category, unit, currency });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Last tooling price error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Narxni olishda xatolik" },
      { status: 500 }
    );
  }
}
