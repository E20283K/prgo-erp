import { NextRequest, NextResponse } from "next/server";

const DOC_SERVICE_URL =
  process.env.DOC_SERVICE_URL ?? "http://localhost:8000";

const ENDPOINT_MAP: Record<string, string> = {
  "flexo-pdf": "/generate/pdf/flexo-spec",
  "job-ticket-pdf": "/generate/pdf/job-ticket",
  "pallet-passport-pdf": "/generate/pdf/pallet-passport",
  "box-labels-pdf": "/generate/pdf/box-labels",
  "imposition-pdf": "/generate/pdf/imposition",
  xlsx: "/generate/xlsx",
  docx: "/generate/docx",
};

export async function POST(req: NextRequest) {
  try {
    const { type, payload } = await req.json();
    const targetPath = ENDPOINT_MAP[type];

    if (!targetPath) {
      return NextResponse.json(
        { error: `Unsupported document type: ${type}` },
        { status: 400 }
      );
    }

    const upstreamRes = await fetch(`${DOC_SERVICE_URL}${targetPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: "Document service error", details: errText },
        { status: upstreamRes.status }
      );
    }

    // If saved to S3, return JSON metadata directly
    if (payload?.saveToS3) {
      const data = await upstreamRes.json();
      return NextResponse.json(data);
    }

    // Otherwise stream the binary file (PDF / XLSX / DOCX) back to browser
    const fileBuffer = await upstreamRes.arrayBuffer();
    const contentType =
      upstreamRes.headers.get("content-type") ?? "application/octet-stream";
    const contentDisposition =
      upstreamRes.headers.get("content-disposition") ??
      `inline; filename="Order_Passport_${payload?.docNo || "PRINTGOO"}.pdf"`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to communicate with Python doc-service",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
