import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiUser, type ApiUser } from "@/lib/server/apiAuth";
import { createTelegramLinkToken } from "@/lib/server/telegramPayoutBot";
import { getEffectiveTelegramBotToken, getTelegramSettings } from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** A user may manage their own link; admins and settings editors may manage anyone's. */
async function authorize(request: NextRequest, id: string): Promise<{ user: ApiUser } | { response: NextResponse }> {
  const auth = await requireApiUser(request, [
    ["settings", "view"],
    ["hr", "view"],
    ["crm", "view"],
    ["production", "view"],
    ["finance", "view"],
    ["warehouse", "view"],
    ["trading", "view"],
  ]);
  if ("response" in auth) return auth;
  const perms = auth.user.permissions as unknown as Record<string, { edit?: boolean }> | undefined;
  if (auth.user.id !== id && auth.user.role !== "admin" && perms?.settings?.edit !== true) {
    return { response: NextResponse.json({ success: false, error: "Ruxsat yo'q" }, { status: 403 }) };
  }
  return auth;
}

async function botUsername(): Promise<string> {
  const settings = await getTelegramSettings().catch(() => null);
  if (settings?.botUsername) return settings.botUsername.replace(/^@/, "");
  const token = await getEffectiveTelegramBotToken();
  if (!token) return "";
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    .then((r) => r.json())
    .catch(() => null);
  return me?.result?.username ?? "";
}

export async function GET(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const auth = await authorize(request, id);
  if ("response" in auth) return auth.response;
  const u = await db.query.users.findFirst({ where: eq(users.id, id), columns: { telegramUserId: true } });
  return NextResponse.json({ success: true, linked: Boolean(u?.telegramUserId), telegramUserId: u?.telegramUserId ?? null });
}

/** Returns a 15-minute deep link; opening it and pressing Start binds the Telegram account. */
export async function POST(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const auth = await authorize(request, id);
  if ("response" in auth) return auth.response;
  const username = await botUsername();
  if (!username) {
    return NextResponse.json({ success: false, error: "Telegram bot sozlanmagan" }, { status: 400 });
  }
  return NextResponse.json({ success: true, url: `https://t.me/${username}?start=${createTelegramLinkToken(id)}` });
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const auth = await authorize(request, id);
  if ("response" in auth) return auth.response;
  await db.update(users).set({ telegramUserId: null, updatedAt: new Date() }).where(eq(users.id, id));
  return NextResponse.json({ success: true });
}
