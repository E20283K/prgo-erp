import type { OrderAttachment } from "@/components/documents/work-order/types";

export type OrderFileCategory = NonNullable<OrderAttachment["category"]>;

/** Thrown when storage is not configured (no presigned URL) — callers may fall back to a local preview. */
export class PresignUnavailableError extends Error {
  constructor(message = "Fayl ombori mavjud emas") {
    super(message);
    this.name = "PresignUnavailableError";
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(Math.max(0, decimals)))} ${sizes[i]}`;
}

/** Guesses the attachment category from the file extension. */
export function categoryForFile(name: string): OrderFileCategory {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (["dxf", "cf2", "ard"].includes(ext)) return "dieline";
  if (["ai", "eps", "cdr"].includes(ext)) return "artwork";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "proofs";
  return "docs";
}

/**
 * Uploads a file to the work order's storage folder (presigned PUT) and returns the
 * attachment record. When the order already exists, the API also stores it in
 * work_order_attachments.
 */
export async function uploadOrderFile(
  docNo: string,
  file: File,
  options: {
    category?: OrderFileCategory;
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<OrderAttachment> {
  const category = options.category ?? categoryForFile(file.name);
  const metaRes = await fetch(`/api/v1/production/work-orders/${encodeURIComponent(docNo)}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      docNo,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: formatBytes(file.size),
      category,
    }),
    signal: options.signal,
  });

  let presigned: { success?: boolean; uploadUrl?: string; downloadUrl?: string; objectKey?: string } | null = null;
  try {
    presigned = await metaRes.json();
  } catch {
    presigned = null;
  }
  if (!presigned?.success || !presigned.uploadUrl || !presigned.downloadUrl) throw new PresignUnavailableError();
  const downloadUrl = presigned.downloadUrl;

  const uploadUrl = presigned.uploadUrl;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) options.onProgress?.(Math.round((evt.loaded / evt.total) * 100));
    });
    xhr.addEventListener("load", () => {
      options.signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Server javobi: ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Tarmoqda xatolik yuz berdi")));
    xhr.addEventListener("abort", () => reject(new Error("Yuklash bekor qilindi")));
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: file.name,
    size: formatBytes(file.size),
    type: file.type || "Document",
    date: new Date().toISOString().slice(0, 16).replace("T", " "),
    isImage: file.type.startsWith("image/"),
    category,
    storagePath: presigned.objectKey,
    url: downloadUrl,
  };
}
