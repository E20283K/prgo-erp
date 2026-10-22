import { NextRequest, NextResponse } from "next/server";
import { updateTelegramChatSettings } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateTelegramChatSettings(
      id,
      body.settings || {},
      {
        assignedUserId: body.assignedUserId,
        clientId: body.clientId,
      }
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    console.error("[PATCH /api/v1/crm/telegram/chats/[id]/settings] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Guruh sozlamalarini saqlab bo'lmadi" },
      { status: 500 }
    );
  }
}
