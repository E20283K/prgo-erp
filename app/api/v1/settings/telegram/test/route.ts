import { NextRequest, NextResponse } from "next/server";
import { testTelegramConnection } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;
    try {
      const body = await request.json();
      token = body?.token;
    } catch {
      // Body may be empty if testing saved token
    }

    const result = await testTelegramConnection(token);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[POST /api/v1/settings/telegram/test] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Bot ulanishini tekshirib bo'lmadi" },
      { status: 500 }
    );
  }
}
