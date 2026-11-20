import { NextRequest, NextResponse } from "next/server";
import { renderWorkOrderCardPreview } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

/** PNG preview of the Telegram order card, built from the saved order. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const note = request.nextUrl.searchParams.get("note") || undefined;
  const companyCode = request.nextUrl.searchParams.get("companyCode") || "PRINTGOO";

  try {
    const png = await renderWorkOrderCardPreview(id, companyCode, note);
    if (!png) {
      return NextResponse.json({ success: false, error: "Buyurtma topilmadi" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/v1/production/work-orders/[id]/order-card] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Kartani yaratib bo'lmadi" },
      { status: 502 }
    );
  }
}
