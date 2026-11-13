import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

/**
 * Ish vaqtida public/ ga yozilgan fayllarni berish (avatar, logo, artwork, telegram kesh).
 * Production'da Next.js public/ ro'yxatini faqat ishga tushganda o'qiydi, shuning uchun
 * keyin yuklangan fayllar 404 bo'ladi. next.config.ts dagi fallback rewrite
 * /uploads, /artwork, /cache so'rovlarini shu route'ga yo'naltiradi.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ALLOWED_ROOTS = new Set(["uploads", "artwork", "cache"]);

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".ai": "application/postscript",
  ".eps": "application/postscript",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".xls": "application/vnd.ms-excel",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
};

async function serve(request: NextRequest, segments: string[], withBody: boolean) {
  if (!segments.length || !ALLOWED_ROOTS.has(segments[0])) {
    return new NextResponse(null, { status: 404 });
  }

  const absPath = path.resolve(PUBLIC_DIR, ...segments.map((s) => decodeURIComponent(s)));
  const rootDir = path.join(PUBLIC_DIR, segments[0]) + path.sep;
  if (!absPath.startsWith(rootDir)) {
    return new NextResponse(null, { status: 404 });
  }

  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!stat.isFile()) {
    return new NextResponse(null, { status: 404 });
  }

  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[path.extname(absPath).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": String(stat.size),
    "Last-Modified": stat.mtime.toUTCString(),
    ETag: etag,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    // Foydalanuvchi yuklagan SVG ichidagi skriptlar ishlamasligi uchun
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  });

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  if (!withBody) {
    return new NextResponse(null, { status: 200, headers });
  }

  const data = await fs.readFile(absPath);
  return new NextResponse(new Uint8Array(data), { status: 200, headers });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  return serve(request, segments, true);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  return serve(request, segments, false);
}
