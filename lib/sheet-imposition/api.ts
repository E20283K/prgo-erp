import type {
  AnalyzeResponse,
  CalculateRequest,
  CalculateResponse,
  GenerateRequest,
  GenerateResponse,
  ManifestItem,
} from "./types";

const BASE_URL = "/api/sheet-imposition";

async function readError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  if (Array.isArray(detail)) {
    return new Error(detail.map((d: { msg?: string }) => d?.msg || String(d)).join("; "));
  }
  return new Error(detail || body?.error || fallback);
}

export async function calculateSheetLayout(
  req: CalculateRequest,
  signal?: AbortSignal
): Promise<CalculateResponse> {
  const res = await fetch(`${BASE_URL}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) throw await readError(res, "Hisoblashda xatolik");
  return res.json();
}

/** A PDF either already on the server (url) or picked locally (file). */
export type ArtworkSource = { name: string } & ({ url: string; file?: undefined } | { file: File; url?: undefined });

function sourceKey(src: ArtworkSource): string | File {
  return src.file ?? src.url;
}

export interface AnalyzeVariantSource {
  name: string;
  skuId?: string;
  quantity: number;
  front: ArtworkSource;
  frontPage?: number;
  back?: ArtworkSource;
  backPage?: number;
}

/**
 * Downloads artwork PDFs (deduplicated by URL) in the browser and uploads them
 * to doc-service together with a manifest that maps variants to file indexes.
 */
export async function analyzeSheetArtwork(params: {
  variants: AnalyzeVariantSource[];
  dieline?: ArtworkSource;
  expectedTrim?: { w: number; h: number };
  jobId?: string;
}): Promise<AnalyzeResponse> {
  const { variants, dieline, expectedTrim, jobId } = params;
  if (!variants.length) throw new Error("Kamida bitta dizayn fayli kerak");

  const fileIndex = new Map<string | File, number>();
  const sources: ArtworkSource[] = [];
  const indexOf = (src: ArtworkSource) => {
    const key = sourceKey(src);
    const existing = fileIndex.get(key);
    if (existing !== undefined) return existing;
    fileIndex.set(key, sources.length);
    sources.push(src);
    return sources.length - 1;
  };

  const manifest: ManifestItem[] = variants.map((v) => ({
    name: v.name,
    sku_id: v.skuId ?? null,
    quantity: Math.max(1, Math.round(v.quantity || 1)),
    front_file: indexOf(v.front),
    front_page: v.frontPage ?? 0,
    back_file: v.back ? indexOf(v.back) : null,
    back_page: v.back ? v.backPage ?? 0 : null,
  }));
  const dielineIdx = dieline ? indexOf(dieline) : undefined;

  const files = await Promise.all(
    sources.map(async (src) => {
      const name = src.name.toLowerCase().endsWith(".pdf") ? src.name : `${src.name}.pdf`;
      if (src.file) return new File([src.file], name, { type: "application/pdf" });
      const res = await fetch(src.url);
      if (!res.ok) throw new Error(`Faylni yuklab bo'lmadi: ${src.name}`);
      return new File([await res.blob()], name, { type: "application/pdf" });
    })
  );

  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("manifest", JSON.stringify(manifest));
  if (dielineIdx !== undefined) form.append("dieline_file", String(dielineIdx));
  if (expectedTrim) {
    form.append("expected_trim_w", String(expectedTrim.w));
    form.append("expected_trim_h", String(expectedTrim.h));
  }
  if (jobId) form.append("job_id", jobId);

  const res = await fetch(`${BASE_URL}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw await readError(res, "PDF tahlilida xatolik");
  return res.json();
}

export async function generateSheetImposition(
  jobId: string,
  req: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(jobId)}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw await readError(res, "Montaj yaratishda xatolik");
  return res.json();
}
