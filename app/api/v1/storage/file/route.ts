import { NextRequest, NextResponse } from "next/server";
import { readStoredFile, type StorageBucketKey } from "@/lib/server/storage";

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

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": file.source === "local"
        ? "public, max-age=86400"
        : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
