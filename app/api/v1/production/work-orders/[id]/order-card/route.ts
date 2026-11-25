import { NextRequest, NextResponse } from "next/server";
import {
  parseOrderCardLogo,
  renderWorkOrderCardPreview,
  renderWorkOrderPassportPdf,
} from "@/lib/server/orderCardGenerator";

export const dynamic = "force-dynamic";

/**
 * The work order passport, built from the saved order.
 * Default: PNG of page 1 (Telegram send dialog preview).
 * `?format=pdf`: the two-page passport PDF (Ctrl+P), the file the Telegram group receives.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const params = request.nextUrl.searchParams;
  const note = params.get("note") || undefined;
  const companyCode = params.get("companyCode") || "PRINTGOO";
  const logo = parseOrderCardLogo(params.get("logo"));

  try {
    if (params.get("format") === "pdf") {
      const passport = await renderWorkOrderPassportPdf(id, companyCode, logo);
      if (!passport) {
        return NextResponse.json({ success: false, error: "Buyurtma topilmadi" }, { status: 404 });
      }
      const fileName = `Ish_pasporti_${passport.docNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      return new NextResponse(new Uint8Array(passport.pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const png = await renderWorkOrderCardPreview(id, companyCode, note, logo);
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
      { success: false, error: error instanceof Error ? error.message : "Hujjatni yaratib bo'lmadi" },
      { status: 502 }
    );
  }
}
