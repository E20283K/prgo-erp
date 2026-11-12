import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sku = (formData.get("sku") as string | null) || "accessory";

    if (!file) {
      return NextResponse.json({ success: false, error: "Fayl yuborilmadi" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Fayl hajmi 15MB dan oshmasligi kerak" },
        { status: 400 }
      );
    }

    const mime = file.type || "";
    const isAllowed = ALLOWED_MIME_TYPES.includes(mime) || file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: "Faqat rasm formatlari (JPG, PNG, WEBP, GIF, SVG) qabul qilinadi" },
        { status: 400 }
      );
    }

    const cleanSku = sku.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();
    const extMatch = file.name.match(/\.[a-zA-Z0-9]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
    const fileName = `${cleanSku}_${Date.now()}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "accessories");
    if (!existsSync(uploadDir)) {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const destPath = path.join(uploadDir, fileName);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/accessories/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      size: file.size,
    });
  } catch (err: any) {
    console.error("POST /api/v1/trading/catalog/upload error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Serverda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
