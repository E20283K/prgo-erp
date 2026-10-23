import { NextRequest, NextResponse } from "next/server";
import { getTelegramChatMessages, sendTelegramMessage } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: "chatId parametri talab qilinadi" },
        { status: 400 }
      );
    }

    const { chat, messages, bot } = await getTelegramChatMessages(chatId);

    return NextResponse.json({
      success: true,
      chat,
      data: messages,
      bot,
      total: messages.length,
    });
  } catch (error) {
    console.error("[GET /api/v1/crm/telegram/messages] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Xabarlarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, text, senderName, replyToTelegramMessageId } = body;

    if (!chatId || !text || text.trim() === "") {
      return NextResponse.json(
        { success: false, error: "chatId va text maydonlari to'ldirilishi shart" },
        { status: 400 }
      );
    }

    const result = await sendTelegramMessage({
      chatId,
      text: text.trim(),
      senderName,
      replyToTelegramMessageId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Xabar yuborishda xatolik" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.message,
    });
  } catch (error) {
    console.error("[POST /api/v1/crm/telegram/messages] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Xabar yuborishda xatolik",
      },
      { status: 500 }
    );
  }
}
