import { NextRequest, NextResponse } from "next/server";
import { s3Client, S3_BUCKETS, type StorageBucketKey } from "@/lib/server/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucketKey = (searchParams.get("bucket") as StorageBucketKey) || "prepress";
  let key = searchParams.get("key") || searchParams.get("path") || "";

  // 1. Unwrap any nested /api/v1/storage/file wrapper calls
  while (key.includes("/api/v1/storage/file")) {
    try {
      const subUrl = new URL(key, "http://localhost:3000");
      const nextKey = subUrl.searchParams.get("key") || subUrl.searchParams.get("path");
      if (nextKey && nextKey !== key) {
        key = nextKey;
      } else {
        break;
      }
    } catch (_) {
      break;
    }
  }

  // 2. If a full MinIO / S3 URL was passed (including presigned URLs), extract pathname
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      const parsed = new URL(key);
      key = parsed.pathname;
    } catch (_) {}
  }

  // 3. Strip query string, hashes and leading slashes
  key = key.split("?")[0].split("#")[0];
  let cleanKey = key.replace(/^\/+/, "");

  // 4. Strip bucket prefix if accidentally included in path
  if (cleanKey.startsWith("printgoo-prepress/")) {
    cleanKey = cleanKey.replace(/^printgoo-prepress\//, "");
  } else if (cleanKey.startsWith("printgoo-crm/")) {
    cleanKey = cleanKey.replace(/^printgoo-crm\//, "");
  }

  if (!cleanKey) {
    return new NextResponse("Key parameter required", { status: 400 });
  }

  // 5. Check local public/ folder if file is on disk
  const localPath = path.join(process.cwd(), "public", cleanKey);
  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    const fileBuffer = fs.readFileSync(localPath);
    const ext = path.extname(cleanKey).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
    };
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeMap[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // 6. Fetch directly from MinIO / S3 using server client (no expiration, no CORS)
  try {
    const bucketName = S3_BUCKETS[bucketKey] || S3_BUCKETS.prepress;
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
    });
    const s3Res = await s3Client.send(command);
    if (!s3Res.Body) {
      return new NextResponse("File not found in storage", { status: 404 });
    }

    const contentType = s3Res.ContentType || "image/jpeg";
    const byteArray = await s3Res.Body.transformToByteArray();

    return new NextResponse(Buffer.from(byteArray), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err: any) {
    console.error("[storage/file] Error fetching from S3:", err?.message || err);
    return new NextResponse("Failed to load file from storage", { status: 404 });
  }
}
