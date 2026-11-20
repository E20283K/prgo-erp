import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { orderCardPdfPath } from "@/lib/server/orderCardGenerator";

export const dynamic = "force-dynamic";

/**
 * Download link for the order card PDF posted in the Telegram orders group.
 * No login: the file name carries a 20-hex content hash, so links cannot be guessed.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const filePath = orderCardPdfPath(file);
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ success: false, error: "Fayl topilmadi" }, { status: 404 });
  }
  const data = await fs.promises.readFile(filePath);
  const downloadName = file.replace(/-[a-f0-9]{20}\.pdf$/, ".pdf");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${downloadName}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
