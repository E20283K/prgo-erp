import { NextRequest, NextResponse } from "next/server";
import { getTelegramSettings, saveTelegramSettings } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const settings = await getTelegramSettings(companyCode);
    return NextResponse.json({ ok: true, data: settings });
  } catch (error: any) {
    console.error("[GET /api/v1/settings/telegram] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Sozlamalarni olishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";
    const body = await request.json();

    const updated = await saveTelegramSettings(companyCode, {
      botToken: body.botToken,
      botUsername: body.botUsername,
      webhookUrl: body.webhookUrl,
      defaultNotificationLanguage: body.defaultNotificationLanguage,
      autoCreateLeadsFromUnknownGroups: body.autoCreateLeadsFromUnknownGroups,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    console.error("[POST /api/v1/settings/telegram] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Sozlamalarni saqlashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
