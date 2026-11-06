import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { db } from "@/db";
import { clients } from "@/db/schema/crm";
import { eq, or } from "drizzle-orm";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
];

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = (formData.get("clientId") as string | null) || "";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Logotip fayli taqdim etilmadi" },
        { status: 400 }
      );
    }

    const mime = file.type || "";
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      return NextResponse.json(
        { success: false, error: "Faqat PNG, JPG, WebP yoki SVG formatidagi rasmlar qabul qilinadi" },
        { status: 400 }
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { success: false, error: "Logotip hajmi 5MB dan oshmasligi kerak" },
        { status: 400 }
      );
    }

    // Target directory: public/uploads/clients/logos
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "clients", "logos");
    if (!existsSync(uploadsDir)) {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    const safeId = clientId ? clientId.replace(/[^a-zA-Z0-9_\-]/g, "_") : "client";
    let ext = "png";
    if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpg";
    else if (mime === "image/webp") ext = "webp";
    else if (mime === "image/svg+xml") ext = "svg";
    else if (mime === "image/gif") ext = "gif";

    const fileName = `logo-${safeId}-${Date.now()}.${ext}`;
    const destPath = path.join(uploadsDir, fileName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/clients/logos/${fileName}`;

    // If clientId corresponds to an existing client in DB, update their logoUrl
    if (clientId && !clientId.startsWith("draft-") && !clientId.startsWith("new-")) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
      const existing = await db
        .select()
        .from(clients)
        .where(
          isUuid
            ? or(eq(clients.id, clientId), eq(clients.code, clientId))
            : eq(clients.code, clientId)
        )
        .limit(1);

      if (existing.length > 0) {
        const oldLogo = existing[0].logoUrl;
        if (oldLogo && oldLogo.startsWith("/uploads/clients/logos/")) {
          const oldFilePath = path.join(process.cwd(), "public", oldLogo);
          if (existsSync(oldFilePath)) {
            try {
              await fs.unlink(oldFilePath);
            } catch (unlinkErr) {
              console.warn("[Client logo unlink error]:", unlinkErr);
            }
          }
        }

        await db
          .update(clients)
          .set({ logoUrl: publicUrl, updatedAt: new Date() })
          .where(eq(clients.id, existing[0].id));
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (err: any) {
    console.error("[Client Logo POST Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Logotipni yuklashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";
    const logoUrl = searchParams.get("logoUrl") || "";

    if (logoUrl && logoUrl.startsWith("/uploads/clients/logos/")) {
      const filePath = path.join(process.cwd(), "public", logoUrl);
      if (existsSync(filePath)) {
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.warn("[Client logo delete file error]:", err);
        }
      }
    }

    if (clientId && !clientId.startsWith("draft-") && !clientId.startsWith("new-")) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
      await db
        .update(clients)
        .set({ logoUrl: null, updatedAt: new Date() })
        .where(
          isUuid
            ? or(eq(clients.id, clientId), eq(clients.code, clientId))
            : eq(clients.code, clientId)
        );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Client Logo DELETE Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Logotipni o'chirishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
