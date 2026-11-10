import { NextRequest, NextResponse } from "next/server";
import { getLinkedTelegramChatForEntity } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "client" | "supplier";
    const entityId = searchParams.get("id");

    if (!type || !entityId) {
      return NextResponse.json(
        { success: false, error: "type ('client' yoki 'supplier') va id talab qilinadi" },
        { status: 400 }
      );
    }

    const chat = await getLinkedTelegramChatForEntity(type, entityId);

    return NextResponse.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    console.error("[GET /api/v1/crm/telegram/entity-chat] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Guruhni yuklashda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
