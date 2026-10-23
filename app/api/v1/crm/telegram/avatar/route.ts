import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  getEffectiveTelegramBotToken,
  getTelegramBotAvatarUrl,
  getTelegramUserAvatarUrl,
  getTelegramChatPhotoUrl,
} from "@/lib/server/telegramService";

export const dynamic = "force-dynamic";

const AVATARS_CACHE_DIR = path.join(process.cwd(), "public", "cache", "telegram", "avatars");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "user"; // "bot" | "user" | "chat"
    const id = searchParams.get("id") || "";
    const name = searchParams.get("name") || "";

    const token = await getEffectiveTelegramBotToken();

    let resolvedPath: string | null = null;

    if (type === "bot") {
      resolvedPath = await getTelegramBotAvatarUrl(token);
    } else if (type === "chat") {
      resolvedPath = await getTelegramChatPhotoUrl(token, id, name);
    } else {
      resolvedPath = await getTelegramUserAvatarUrl(token, id, name);
    }

    if (!resolvedPath) {
      return new NextResponse("Avatar not found", { status: 404 });
    }

    // Diskdan faylni o'qish
    const fileName = path.basename(resolvedPath);
    const diskPath = path.join(AVATARS_CACHE_DIR, fileName);

    if (!fs.existsSync(diskPath)) {
      return new NextResponse("Avatar file not found on disk", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(diskPath);
    const ext = path.extname(diskPath).toLowerCase();
    const contentType = ext === ".svg" ? "image/svg+xml" : "image/jpeg";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/v1/crm/telegram/avatar] Error:", err);
    return new NextResponse("Error serving avatar", { status: 500 });
  }
}
