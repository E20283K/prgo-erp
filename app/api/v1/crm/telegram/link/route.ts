import { NextRequest, NextResponse } from "next/server";
import { linkTelegramChatToClient } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, clientId, assignedUserId } = body;

    if (!chatId || !clientId) {
      return NextResponse.json(
        { success: false, error: "chatId va clientId talab qilinadi" },
        { status: 400 }
      );
    }

    const result = await linkTelegramChatToClient({
      chatId,
      clientId,
      assignedUserId,
    });

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
    console.error("[POST /api/v1/crm/telegram/link] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bog'lashda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
