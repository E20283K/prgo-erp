import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { companies } from "@/db/schema/core";
import { createSession, sanitizeUser } from "@/lib/server/authService";
import { getTelegramBotToken } from "@/lib/server/telegramService";
import { verifyTelegramInitData, type TelegramWebAppUser } from "@/lib/server/telegramWebApp";

export const dynamic = "force-dynamic";

/** Every bot token the ERP knows: per-company tokens from settings plus the env token. */
async function knownBotTokens(): Promise<string[]> {
  const rows = await db.select({ settings: companies.settings }).from(companies);
  const tokens = rows
    .map((r) => (r.settings as { telegram?: { botToken?: string } } | null)?.telegram?.botToken?.trim())
    .filter((t): t is string => !!t);
  const envToken = getTelegramBotToken();
  if (envToken) tokens.push(envToken);
  return [...new Set(tokens)];
}

/**
 * Mini App sign-in: exchanges Telegram `initData` for a regular ERP session token.
 * Only an active ERP user whose Telegram account was linked from the ERP gets a session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { initData?: string };
    const initData = typeof body.initData === "string" ? body.initData : "";

    let tgUser: TelegramWebAppUser | null = null;
    for (const token of await knownBotTokens()) {
      tgUser = verifyTelegramInitData(initData, token);
      if (tgUser) break;
    }
    if (!tgUser) {
      return NextResponse.json({ success: false, error: "Telegram ma'lumoti tasdiqlanmadi" }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({ where: eq(users.telegramUserId, String(tgUser.id)) });
    if (!dbUser) {
      return NextResponse.json(
        { success: false, code: "not_linked", error: "Telegram akkaunt ERP foydalanuvchisiga bog'lanmagan" },
        { status: 403 }
      );
    }
    if (dbUser.status !== "Active") {
      return NextResponse.json({ success: false, error: "Hisob faol emas yoki bloklangan" }, { status: 403 });
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
    const { token, expiresAt } = await createSession(dbUser.id, ipAddress, "telegram-mini-app");

    return NextResponse.json({ success: true, token, expiresAt, user: sanitizeUser(dbUser) });
  } catch (error) {
    console.error("[POST /api/v1/auth/telegram]", error);
    return NextResponse.json({ success: false, error: "Kirishda xatolik" }, { status: 500 });
  }
}
