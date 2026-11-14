import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DOC_SERVICE_URL = process.env.DOC_SERVICE_URL ?? "http://localhost:8000";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function upstreamUrl(path: string[], request?: NextRequest): URL {
  const url = new URL(`${DOC_SERVICE_URL}/sheet-imposition/${path.map(encodeURIComponent).join("/")}`);
  request?.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const upstreamRes = await fetch(upstreamUrl(path, request), {
      method: "GET",
      headers: { Accept: request.headers.get("accept") || "*/*" },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const details = await upstreamRes.text();
      return NextResponse.json({ error: "Doc service error", details }, { status: upstreamRes.status });
    }

    const contentType = upstreamRes.headers.get("content-type") || "application/octet-stream";
    if (contentType.includes("application/json")) {
      return NextResponse.json(await upstreamRes.json());
    }

    const headers = new Headers({ "Content-Type": contentType });
    const disposition = upstreamRes.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    // Generated files are overwritten on re-run; URLs carry ?v= so a short private cache is safe.
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(await upstreamRes.arrayBuffer(), { status: 200, headers });
  } catch (error: unknown) {
    console.error("[sheet-imposition] GET error:", error);
    return NextResponse.json(
      { error: "Failed to connect to imposition service", details: error instanceof Error ? error.message : String(error) },
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
    const contentType = request.headers.get("content-type") || "";

    const upstreamRes = contentType.includes("multipart/form-data")
      ? await fetch(upstreamUrl(path), { method: "POST", body: await request.formData() })
      : await fetch(upstreamUrl(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(await request.json()),
          signal: request.signal,
        });

    const text = await upstreamRes.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(json || { error: "Imposition request failed", details: text }, {
        status: upstreamRes.status,
      });
    }
    return NextResponse.json(json);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return new NextResponse(null, { status: 499 });
    }
    console.error("[sheet-imposition] POST error:", error);
    return NextResponse.json(
      { error: "Failed to communicate with imposition service", details: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
