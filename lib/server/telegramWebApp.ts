import crypto from "crypto";

/** Telegram user inside Mini App `initData` (only the fields we use). */
export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/** How long a Mini App launch stays usable for sign-in. */
const MAX_INIT_DATA_AGE_SEC = 24 * 60 * 60;

/**
 * Verifies Mini App `initData` signed by Telegram with the bot token
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Returns the Telegram user, or null when the signature, age or payload is not valid.
 */
export function verifyTelegramInitData(initData: string, botToken: string): TelegramWebAppUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"))) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > MAX_INIT_DATA_AGE_SEC) return null;

  try {
    const user = JSON.parse(params.get("user") || "null") as TelegramWebAppUser | null;
    return user && Number.isFinite(user.id) ? user : null;
  } catch {
    return null;
  }
}

/** Public address of the Mini App, or null when the app URL is not configured. */
export function telegramWebAppUrl(fallbackOrigin?: string): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin || "").replace(/\/+$/, "");
  return base.startsWith("https://") ? `${base}/tg` : null;
}

/**
 * Shows the "PrintGoo" Mini App button in one private chat. Set per chat (not globally),
 * so CRM clients writing to the same bot do not get it.
 */
export async function setWebAppMenuButton(botToken: string, chatId: number | string, url: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(chatId),
        menu_button: { type: "web_app", text: "PrintGoo", web_app: { url } },
      }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return !!data.ok;
  } catch {
    return false;
  }
}
