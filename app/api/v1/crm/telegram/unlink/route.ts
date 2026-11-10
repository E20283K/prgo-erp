import { NextRequest, NextResponse } from "next/server";
import { unlinkTelegramChat } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId } = body;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: "chatId talab qilinadi" },
        { status: 400 }
      );
    }

    const result = await unlinkTelegramChat(chatId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.chat,
    });
  } catch (error) {
    console.error("[POST /api/v1/crm/telegram/unlink] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Guruhni ajratishda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
