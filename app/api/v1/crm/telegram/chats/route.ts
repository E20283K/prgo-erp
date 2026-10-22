import { NextRequest, NextResponse } from "next/server";
import { getTelegramChats } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";
    const status = (searchParams.get("status") || "all") as any;
    const search = searchParams.get("search") || undefined;

    const chats = await getTelegramChats(companyCode, { status, search });

    return NextResponse.json({
      success: true,
      data: chats,
      total: chats.length,
    });
  } catch (error) {
    console.error("[GET /api/v1/crm/telegram/chats] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Guruhlarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}
