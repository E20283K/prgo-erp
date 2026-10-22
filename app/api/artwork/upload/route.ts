/**
 * POST /api/artwork/upload
 *
 * Accepts a multipart/form-data request containing:
 *   file        — PDF or SVG file (required)
 *   workOrderId — string, e.g. "WO-26-0001"
 *   skuId       — SizeDistribution.id, e.g. "sku-abc123"
 *   side        — "front" | "back"
 *
 * Saves to: public/artwork/{workOrderId}/{skuId}-{side}.{ext}
 * Returns:  { url, name, size, thumbUrl? }
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/svg+xml",
  "application/octet-stream", // some OS sends svg as this
];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const workOrderId = (formData.get("workOrderId") as string | null) ?? "unknown-wo";
    const skuId = (formData.get("skuId") as string | null) ?? "sku-0";
    const side = (formData.get("side") as string | null) === "back" ? "back" : "front";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (accept PDF and SVG)
    const mime = file.type || "";
    const isSvg = file.name.toLowerCase().endsWith(".svg");
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || mime === "application/pdf";
    if (!isSvg && !isPdf && !ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: "Only PDF and SVG files are accepted." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    // Sanitise identifiers to avoid path traversal
    const safeWoId = workOrderId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const safeSkuId = skuId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const ext = isSvg ? "svg" : "pdf";
    const fileName = `${safeSkuId}-${side}.${ext}`;

    // Destination: <project_root>/public/artwork/{workOrderId}/
    const publicDir = path.join(process.cwd(), "public", "artwork", safeWoId);
    if (!existsSync(publicDir)) {
      await fs.mkdir(publicDir, { recursive: true });
    }

    const destPath = path.join(publicDir, fileName);

    // Write file bytes
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));

    // Public URL (relative to /public)
    const publicUrl = `/artwork/${safeWoId}/${fileName}`;

    // Attempt thumbnail generation for PDF (requires canvas / sharp on server)
    // For now we return null; a future enhancement can add pdf-to-image conversion.
    const thumbUrl: string | null = null;

    return NextResponse.json({
      url: publicUrl,
      name: file.name,
      size: file.size,
      thumbUrl,
    });
  } catch (err) {
    console.error("[artwork/upload] Error:", err);
    return NextResponse.json(
      { error: "Internal server error during file upload." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/artwork/upload?path=/artwork/WO-26-0001/sku-abc-front.pdf
 * Removes a previously uploaded artwork file from public/.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "path query param required" }, { status: 400 });
    }

    // Security: only allow paths under /artwork/
    if (!filePath.startsWith("/artwork/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    const absPath = path.join(process.cwd(), "public", filePath);
    if (existsSync(absPath)) {
      await fs.unlink(absPath);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[artwork/upload] DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
