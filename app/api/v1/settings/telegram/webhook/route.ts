import { NextRequest, NextResponse } from "next/server";
import { configureTelegramWebhook, saveTelegramSettings } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";
    const body = await request.json();

    const action: "set" | "delete" = body?.action === "delete" ? "delete" : "set";
    const webhookUrl: string = body?.webhookUrl || "";
    const token: string | undefined = body?.token;

    const result = await configureTelegramWebhook(action, webhookUrl, token);

    if (result.ok) {
      await saveTelegramSettings(companyCode, {
        isWebhookActive: action === "set",
        ...(action === "set" ? { webhookUrl } : {}),
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[POST /api/v1/settings/telegram/webhook] Error:", error);
    return NextResponse.json(
      { ok: false, description: error?.message || "Webhook sozlashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
