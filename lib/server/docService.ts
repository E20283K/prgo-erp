import type { FlexoLayoutResult } from "../flexo/types";

const DOC_SERVICE_URL =
  process.env.DOC_SERVICE_URL ?? "http://localhost:8000";

export interface FlexoPdfRequestMeta {
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
  qrData?: string;
  barcodeData?: string;
  saveToS3?: boolean;
  s3Key?: string;
}

export interface TableExportPayload {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  saveToS3?: boolean;
  s3Key?: string;
}

/**
 * Python doc-service (ReportLab) holatini tekshirish
 */
export async function checkDocServiceHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  font?: string;
  error?: string;
}> {
  const start = performance.now();
  try {
    const res = await fetch(`${DOC_SERVICE_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      font: data.font,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Doc service unreachable",
    };
  }
}

/**
 * ReportLab orqali Flexo Texkarta PDF yaratish (QR code va Barcode bilan)
 */
export async function generateFlexoPdfBuffer(
  result: FlexoLayoutResult,
  meta: FlexoPdfRequestMeta = {}
): Promise<ArrayBuffer> {
  const res = await fetch(`${DOC_SERVICE_URL}/generate/pdf/flexo-spec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...result,
      ...meta,
      saveToS3: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocService PDF Error (${res.status}): ${errText}`);
  }

  return res.arrayBuffer();
}

/**
 * Python openpyxl orqali Excel (.xlsx) yaratish
 */
export async function generateExcelBuffer(
  payload: TableExportPayload
): Promise<ArrayBuffer> {
  const res = await fetch(`${DOC_SERVICE_URL}/generate/xlsx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, saveToS3: false }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocService XLSX Error (${res.status}): ${errText}`);
  }

  return res.arrayBuffer();
}

/**
 * Python python-docx orqali Word (.docx) yaratish
 */
export async function generateDocxBuffer(
  payload: TableExportPayload
): Promise<ArrayBuffer> {
  const res = await fetch(`${DOC_SERVICE_URL}/generate/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, saveToS3: false }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocService DOCX Error (${res.status}): ${errText}`);
  }

  return res.arrayBuffer();
}
