import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { readStoredFile, type StorageBucketKey } from "@/lib/server/storage";

// Widths a caller may ask for (?w=); anything else is rounded up to the next one.
const THUMB_WIDTHS = [96, 192, 640];
const THUMB_DIR = path.join(os.tmpdir(), "printgoo-thumbs");
const RESIZABLE = /^image\/(png|jpe?g|webp|gif|avif|tiff)$/i;

/** A downscaled WebP copy, cached on disk so each photo is resized once. Null when it cannot be made. */
async function thumbnail(key: string, width: number, source: Buffer): Promise<Buffer | null> {
  const cachePath = path.join(THUMB_DIR, `${createHash("sha1").update(`${key}|${width}`).digest("hex")}.webp`);
  try {
    return await fs.readFile(cachePath);
  } catch {}
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await fs.mkdir(THUMB_DIR, { recursive: true });
    await fs.writeFile(cachePath, out).catch(() => {});
    return out;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucketKey = (searchParams.get("bucket") as StorageBucketKey) || "prepress";
  const key = searchParams.get("key") || searchParams.get("path") || "";
  if (!key) {
    return new NextResponse("Key parameter required", { status: 400 });
  }

  // Local public/ folder first (uploads, artwork, cache volumes), then MinIO / S3 buckets
  const file = await readStoredFile(key, bucketKey);
  if (!file) {
    return new NextResponse("File not found in storage", { status: 404 });
  }

  // ?w= serves a small preview instead of the original (registry thumbnails, hover cards).
  const requested = Number(searchParams.get("w"));
  if (requested > 0 && RESIZABLE.test(file.contentType)) {
    const width = THUMB_WIDTHS.find((w) => w >= requested) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
    const thumb = await thumbnail(`${bucketKey}:${key}`, width, file.buffer);
    if (thumb) {
      return new NextResponse(new Uint8Array(thumb), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
        },
      });
    }
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": file.source === "local"
        ? "public, max-age=86400"
        : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
