import {
  GearItem,
  AnalyzeResponse,
  GenerateRequest,
  GenerateResponse,
} from "./types";

const BASE_URL = "/api/flexo-imposition";

export async function fetchImpositionGears(): Promise<GearItem[]> {
  const res = await fetch(`${BASE_URL}/gears`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch gears: ${res.statusText}`);
  }
  return res.json();
}

export async function analyzeImpositionPdf(file: File): Promise<AnalyzeResponse> {
  return analyzeImpositionPdfs([file]);
}

export async function analyzeImpositionPdfs(files: File[]): Promise<AnalyzeResponse> {
  if (!files.length) {
    throw new Error("Kamida bitta PDF fayl tanlanishi kerak");
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  if (files.length === 1) {
    formData.append("file", files[0]);
  }

  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.detail || errorBody?.error || "PDF tahlilida xatolik yuz berdi");
  }

  return res.json();
}

export async function analyzeImpositionPdfFromUrl(
  url: string,
  filename: string = "source.pdf"
): Promise<AnalyzeResponse> {
  return analyzeImpositionPdfsFromUrls([{ url, name: filename }]);
}

export async function analyzeImpositionPdfsFromUrls(
  items: { url: string; name: string }[]
): Promise<AnalyzeResponse> {
  if (!items.length) {
    throw new Error("Kamida bitta fayl URL manzili talab qilinadi");
  }

  const downloadPromises = items.map(async (item) => {
    const sourceRes = await fetch(item.url);
    if (!sourceRes.ok) {
      throw new Error(`Faylni yuklab bo'lmadi: ${item.name} (${item.url})`);
    }
    const blob = await sourceRes.blob();
    return new File([blob], item.name, { type: "application/pdf" });
  });

  const files = await Promise.all(downloadPromises);
  return analyzeImpositionPdfs(files);
}

export async function generateImposition(
  jobId: string,
  config: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch(`${BASE_URL}/${jobId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody?.detail || errorBody?.error || "Montaj faylini yaratishda xatolik yuz berdi"
    );
  }

  return res.json();
}
