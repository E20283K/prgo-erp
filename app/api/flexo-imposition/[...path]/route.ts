import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { s3Client, S3_BUCKETS } from "@/lib/server/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL ?? "http://localhost:8000";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function trySelfHealJobFile(
  jobId: string,
  filename: string,
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    console.log(`[flexo-imposition] Attempting self-healing for job ${jobId}, file ${filename}...`);

    let masterUrl: string | null = null;
    let masterName = "master.pdf";

    // 1. Check work_order_attachments
    const attMatch = await db.execute<{ work_order_id: string }>(
      sql`SELECT work_order_id FROM work_order_attachments WHERE url LIKE ${'%' + jobId + '%'} LIMIT 1`
    );

    if (attMatch && attMatch.length > 0 && attMatch[0].work_order_id) {
      const woId = attMatch[0].work_order_id;
      const candidates = await db.execute<{ url: string; storage_path: string; name: string }>(
        sql`SELECT url, storage_path, name FROM work_order_attachments 
            WHERE work_order_id = ${woId} 
              AND (name ILIKE '%[Master PDF]%' OR (file_type = 'application/pdf' AND category = 'artwork' AND url NOT LIKE '%/api/flexo-imposition/%'))
            ORDER BY CASE WHEN name ILIKE '%[Master PDF]%' THEN 0 ELSE 1 END, created_at ASC
            LIMIT 1`
      );
      if (candidates && candidates.length > 0) {
        masterUrl = candidates[0].url || candidates[0].storage_path;
        masterName = candidates[0].name || "master.pdf";
      }
    }

    // 2. Check work_orders table if not found in attachments table
    if (!masterUrl) {
      const woMatch = await db.execute<{ id: string; attachments: any }>(
        sql`SELECT id, attachments FROM work_orders WHERE dimensions::text LIKE ${'%' + jobId + '%'} LIMIT 1`
      );
      if (woMatch && woMatch.length > 0) {
        const atts = Array.isArray(woMatch[0].attachments) ? woMatch[0].attachments : [];
        const masterAtt = atts.find((a: any) =>
          (typeof a?.name === "string" && a.name.includes("[Master PDF]")) ||
          (a?.type === "application/pdf" && a?.category === "artwork" && !String(a?.url || "").includes("/api/flexo-imposition/"))
        );
        if (masterAtt?.url) {
          masterUrl = masterAtt.url;
          masterName = masterAtt.name || "master.pdf";
        }
      }
    }

    if (!masterUrl) {
      console.warn(`[flexo-imposition] Self-healing could not find master PDF for job ${jobId}`);
      return null;
    }

    console.log(`[flexo-imposition] Found master PDF for job ${jobId}: ${masterName} (${masterUrl})`);

    // 3. Download master PDF bytes
    let pdfBytes: Buffer | null = null;
    let s3Key = masterUrl;
    if (s3Key.includes("key=")) {
      try {
        const parsed = new URL(s3Key, "http://localhost:3000");
        s3Key = parsed.searchParams.get("key") || s3Key;
      } catch (_) {}
    }
    if (s3Key.startsWith("http://") || s3Key.startsWith("https://")) {
      try {
        s3Key = new URL(s3Key).pathname;
      } catch (_) {}
    }
    s3Key = s3Key.split("?")[0].split("#")[0].replace(/^\/+/, "");
    for (const b of ["printgoo-docs/", "printgoo-prepress/", "printgoo-crm/"]) {
      if (s3Key.startsWith(b)) {
        s3Key = s3Key.replace(b, "");
      }
    }

    for (const bKey of ["docs", "prepress"] as const) {
      try {
        const s3Res = await s3Client.send(
          new GetObjectCommand({
            Bucket: S3_BUCKETS[bKey],
            Key: s3Key,
          })
        );
        if (s3Res.Body) {
          const arr = await s3Res.Body.transformToByteArray();
          pdfBytes = Buffer.from(arr);
          break;
        }
      } catch (_) {}
    }

    if (!pdfBytes) {
      try {
        const fetchUrl = masterUrl.startsWith("http")
          ? masterUrl
          : `http://localhost:3000${masterUrl.startsWith("/") ? "" : "/"}${masterUrl}`;
        const httpRes = await fetch(fetchUrl);
        if (httpRes.ok) {
          const arr = await httpRes.arrayBuffer();
          pdfBytes = Buffer.from(arr);
        }
      } catch (err: any) {
        console.warn(`[flexo-imposition] HTTP fetch failed for master PDF: ${err?.message}`);
      }
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      console.error(`[flexo-imposition] Could not retrieve bytes for master PDF: ${masterUrl}`);
      return null;
    }

    // 4. Send to doc-service to regenerate job with exact jobId
    const cleanFilename = masterName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const formData = new FormData();
    formData.append("job_id", jobId);
    formData.append(
      "file",
      new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
      cleanFilename.endsWith(".pdf") ? cleanFilename : `${cleanFilename}.pdf`
    );

    const reanalyzeRes = await fetch(`${DOC_SERVICE_URL}/imposition/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!reanalyzeRes.ok) {
      const errTxt = await reanalyzeRes.text();
      console.error(`[flexo-imposition] Re-analyze failed for job ${jobId}: ${reanalyzeRes.status} ${errTxt}`);
      return null;
    }

    console.log(`[flexo-imposition] Job ${jobId} successfully healed and re-analyzed.`);

    // 5. Retry fetching the requested file from doc-service
    const retryUrl = new URL(`${DOC_SERVICE_URL}/imposition/${jobId}/files/${filename}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      retryUrl.searchParams.set(key, value);
    });

    const retryRes = await fetch(retryUrl.toString(), {
      method: "GET",
      headers: {
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
    });

    if (!retryRes.ok) {
      console.warn(`[flexo-imposition] Healed job file still not found: ${filename}`);
      return null;
    }

    const contentType = retryRes.headers.get("content-type") || "application/octet-stream";
    const fileBuffer = await retryRes.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", contentType);

    const disposition = retryRes.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    }
    headers.set("Cache-Control", "public, max-age=3600");

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (healError: any) {
    console.error(`[flexo-imposition] Self-healing exception for job ${jobId}:`, healError);
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const subpath = path.join("/");
    const targetUrl = new URL(`${DOC_SERVICE_URL}/imposition/${subpath}`);

    // Forward query params if any
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const upstreamRes = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      // If a file request returned 404, attempt self-healing
      if (upstreamRes.status === 404 && path.length >= 3 && path[1] === "files") {
        const jobId = path[0];
        const filename = path.slice(2).join("/");
        const healedRes = await trySelfHealJobFile(jobId, filename, request);
        if (healedRes) {
          return healedRes;
        }
      }

      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: "Doc service error", details: errText },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get("content-type") || "application/octet-stream";

    // If JSON response (like /imposition/gears)
    if (contentType.includes("application/json")) {
      const data = await upstreamRes.json();
      return NextResponse.json(data);
    }

    // Binary file response (PDF or preview PNG)
    const fileBuffer = await upstreamRes.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", contentType);

    const disposition = upstreamRes.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    }
    headers.set("Cache-Control", "public, max-age=3600");

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[flexo-imposition] GET error:", error);
    return NextResponse.json(
      { error: "Failed to connect to imposition service", details: error?.message },
      { status: 502 }
    );
  }
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return GET(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const subpath = path.join("/");
    const targetUrl = `${DOC_SERVICE_URL}/imposition/${subpath}`;
    const contentType = request.headers.get("content-type") || "";

    let upstreamRes: Response;

    if (contentType.includes("multipart/form-data")) {
      // Forward multipart form data (PDF upload)
      const formData = await request.formData();
      upstreamRes = await fetch(targetUrl, {
        method: "POST",
        body: formData,
      });
    } else {
      // Forward JSON payload
      const body = await request.json();
      upstreamRes = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errText);
      } catch {
        errorJson = null;
      }
      return NextResponse.json(
        errorJson || { error: "Imposition generation failed", details: errText },
        { status: upstreamRes.status }
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[flexo-imposition] POST error:", error);
    return NextResponse.json(
      { error: "Failed to communicate with imposition service", details: error?.message },
      { status: 502 }
    );
  }
}
