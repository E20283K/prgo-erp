import { NextRequest, NextResponse } from "next/server";
import { processTelegramWebhookUpdate } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

/**
 * Telegram Bot Webhook Handler
 * Telegram Botdan keladigan har qanday xabar, hujjat yoki guruh hodisasini qabul qiladi
 */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await processTelegramWebhookUpdate(update, companyCode);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[Telegram Webhook API] Error:", error);
    // Telegram qayta-qayta yubormasligi uchun 200 qaytariladi, xato logda saqlanadi
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "PrintGoo Telegram Webhook",
    timestamp: new Date().toISOString(),
  });
}
