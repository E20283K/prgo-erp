import { NextRequest, NextResponse } from "next/server";
import { getQuickReplyTemplates } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const templates = await getQuickReplyTemplates(companyCode);

    return NextResponse.json({
      success: true,
      data: templates,
      total: templates.length,
    });
  } catch (error) {
    console.error("[GET /api/v1/crm/telegram/templates] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shablonlarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}
