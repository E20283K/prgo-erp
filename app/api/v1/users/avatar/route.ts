import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { updateUser, getUserById } from "@/lib/server/userService";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("userId") as string | null) || "";

    if (!file) {
      return NextResponse.json({ success: false, error: "Rasm fayli taqdim etilmadi" }, { status: 400 });
    }

    const mime = file.type || "";
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      return NextResponse.json(
        { success: false, error: "Faqat JPG, PNG yoki WebP rasmlari qabul qilinadi" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { success: false, error: "Rasm hajmi 5MB dan oshmasligi kerak" },
        { status: 400 }
      );
    }

    // Determine target directory: public/uploads/avatars
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    if (!existsSync(uploadsDir)) {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // File name: avatar-[safeUserId]-[timestamp].jpg
    const safeId = userId ? userId.replace(/[^a-zA-Z0-9_\-]/g, "_") : "user";
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const fileName = `avatar-${safeId}-${Date.now()}.${ext}`;
    const destPath = path.join(uploadsDir, fileName);

    // Write file
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/avatars/${fileName}`;

    // Update user in DB if valid userId provided
    let updatedUser = null;
    if (userId) {
      // Find user by id or code
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (existing.length > 0) {
        // Remove previous local avatar file if exists
        const oldAvatar = existing[0].avatar;
        if (oldAvatar && oldAvatar.startsWith("/uploads/avatars/")) {
          const oldFilePath = path.join(process.cwd(), "public", oldAvatar);
          if (existsSync(oldFilePath)) {
            try {
              await fs.unlink(oldFilePath);
            } catch (unlinkErr) {
              console.warn("[avatar unlink warning]:", unlinkErr);
            }
          }
        }

        updatedUser = await updateUser(existing[0].id, { avatar: publicUrl });
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("[Avatar POST Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Rasmni yuklashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId majburiy" }, { status: 400 });
    }

    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existing.length > 0) {
      const oldAvatar = existing[0].avatar;
      if (oldAvatar && oldAvatar.startsWith("/uploads/avatars/")) {
        const oldFilePath = path.join(process.cwd(), "public", oldAvatar);
        if (existsSync(oldFilePath)) {
          try {
            await fs.unlink(oldFilePath);
          } catch {}
        }
      }
      await updateUser(existing[0].id, { avatar: undefined });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Avatar DELETE Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Rasmni o'chirishda xatolik" },
      { status: 500 }
    );
  }
}
