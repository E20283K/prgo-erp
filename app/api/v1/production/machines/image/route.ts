import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { requireApiUser } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

/**
 * Machine photo upload. The file goes to public/uploads/machines and only its URL is
 * returned; the machine document stores that URL when it is saved, so the database
 * never carries the image bytes.
 */

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [
    ["production", "create"],
    ["production", "edit"],
  ]);
  if ("response" in auth) return auth.response;

  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Rasm fayli topilmadi." }, { status: 400 });
    }
    const ext = EXT_BY_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        { success: false, error: "Faqat PNG, JPG yoki WEBP rasm yuklash mumkin." },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Rasm hajmi 5 MB dan oshmasligi kerak." },
        { status: 400 }
      );
    }

    const dir = path.join(process.cwd(), "public", "uploads", "machines");
    await fs.mkdir(dir, { recursive: true });
    const fileName = `machine-${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ success: true, url: `/uploads/machines/${fileName}` });
  } catch (error) {
    console.error("POST /api/v1/production/machines/image error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Rasmni yuklab bo'lmadi." },
      { status: 500 }
    );
  }
}
