"use client";

type PdfJsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJsModule> | null = null;

function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return lib;
    });
  }
  return pdfjsPromise;
}

export interface ExtractedArtwork {
  front: string;
  back?: string;
  totalPages: number;
  fileName?: string;
  fileSize?: string;
  detectedWidthMm?: number;
  detectedHeightMm?: number;
  isAutoCropped?: boolean;
  colorAnalysis?: ArtworkColorAnalysisResult | null;
}

export interface ArtworkColorAnalysisResult {
  success: boolean;
  front: {
    hasContent: boolean;
    c: boolean;
    m: boolean;
    y: boolean;
    k: boolean;
    spotColors: string[];
    colorCount: number;
    formula: string;
  };
  back?: {
    hasContent: boolean;
    c: boolean;
    m: boolean;
    y: boolean;
    k: boolean;
    spotColors: string[];
    colorCount: number;
    formula: string;
  };
  hasBackSide: boolean;
  technicalDielines: string[];
  commercialSpotColors: string[];
  detectedFormula: string;
  pageCount: number;
  widthMm?: number;
  heightMm?: number;
  notes?: string | null;
}

/**
 * Requests deep prepress color & separation analysis from doc-service backend.
 */
export async function requestArtworkColorAnalysis(payload: {
  url?: string;
  dataUrl?: string;
  backUrl?: string;
  backDataUrl?: string;
}): Promise<ArtworkColorAnalysisResult | null> {
  try {
    const res = await fetch("/api/docs/analyze-artwork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as ArtworkColorAnalysisResult;
  } catch (err) {
    console.warn("[artworkExtractor] Color analysis request failed:", err);
    return null;
  }
}

/**
 * Reads a File object as a Base64 data URL.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Reads image dimensions and estimates physical mm at 300 DPI.
 */
export function getImageDimensions(file: File): Promise<{ widthMm: number; heightMm: number; dataUrl: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // Standard 300 DPI: 1 inch = 25.4 mm -> 1 px = 25.4 / 300 mm = 0.08466 mm
        let widthMm = Math.round((img.naturalWidth * 25.4) / 300);
        let heightMm = Math.round((img.naturalHeight * 25.4) / 300);

        if (widthMm < 15 || heightMm < 15) {
          widthMm = Math.round((img.naturalWidth * 25.4) / 150);
          heightMm = Math.round((img.naturalHeight * 25.4) / 150);
        }

        resolve({ widthMm, heightMm, dataUrl });
      };
      img.onerror = () => resolve({ widthMm: 50, heightMm: 90, dataUrl });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Scans a canvas for content that differs from the corner background color.
 * If white/empty margins exist around the actual artwork (e.g. tag placed in center of A4),
 * detects the bounding box so the artwork can be auto-trimmed to its true size.
 */
export function detectContentBoundingBox(
  canvas: HTMLCanvasElement,
  options: { tolerance?: number; padding?: number } = {}
): { x: number; y: number; width: number; height: number } | null {
  const { tolerance = 18, padding = 1 } = options;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Background sample from top-left corner
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  const isBackground = (r: number, g: number, b: number, a: number) => {
    if (a < 15) return true; // transparent
    return (
      Math.abs(r - bgR) <= tolerance &&
      Math.abs(g - bgG) <= tolerance &&
      Math.abs(b - bgB) <= tolerance
    );
  };

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  // Step for performance (sample every 2-3 pixels)
  const step = Math.max(1, Math.floor(Math.min(w, h) / 350));

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (!isBackground(r, g, b, a)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no content found
  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  const spanW = maxX - minX;
  const spanH = maxY - minY;

  // If content already takes up > 95% of both width and height, it's already a full artboard
  if (spanW > w * 0.95 && spanH > h * 0.95) {
    return null;
  }

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(w - cropX, spanW + padding * 2);
  const cropH = Math.min(h - cropY, spanH + padding * 2);

  return { x: cropX, y: cropY, width: cropW, height: cropH };
}

/**
 * Extracts Page 1 (Front) and Page 2 (Back) from a PDF File or ArrayBuffer/URL.
 * Renders pages onto high-resolution HTML Canvas elements and returns PNG data URLs.
 * Automatically detects physical dimensions (in mm) and auto-trims unwanted white margins.
 */
export async function extractPdfPagesToImages(
  source: File | ArrayBuffer | string,
  options: {
    scale?: number;
    maxPages?: number;
    targetFormat?: "image/png" | "image/webp";
    quality?: number;
    autoTrim?: boolean;
  } = {}
): Promise<ExtractedArtwork> {
  const { scale = 2.8, maxPages = 2, targetFormat = "image/png", quality = 0.95, autoTrim = true } = options;

  let fileData: ArrayBuffer | string;
  let fileName: string | undefined;
  let fileSize: string | undefined;

  if (source instanceof File) {
    fileName = source.name;
    fileSize = `${(source.size / (1024 * 1024)).toFixed(2)} MB`;
    fileData = await source.arrayBuffer();
  } else {
    fileData = source;
  }

  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument(
    typeof fileData === "string" ? { url: fileData } : { data: new Uint8Array(fileData) }
  );

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  let detectedWidthMm = 50;
  let detectedHeightMm = 90;
  let isAutoCropped = false;

  const renderPageToDataUrl = async (pageIndex: number): Promise<string> => {
    const page = await pdf.getPage(pageIndex);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // 1 pt = 25.4 / 72 mm = ~0.3528 mm
    const fullWidthMm = Math.round((unscaledViewport.width * 25.4) / 72);
    const fullHeightMm = Math.round((unscaledViewport.height * 25.4) / 72);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create 2D canvas context");

    // Fill white background before rendering
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    let outputCanvas = canvas;

    // Check for auto-crop if the artwork has white margins (e.g. tag placed on a large artboard/sheet)
    if (autoTrim) {
      const contentBox = detectContentBoundingBox(canvas);
      if (contentBox && contentBox.width > 20 && contentBox.height > 20) {
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = contentBox.width;
        croppedCanvas.height = contentBox.height;
        const croppedCtx = croppedCanvas.getContext("2d");
        if (croppedCtx) {
          croppedCtx.drawImage(
            canvas,
            contentBox.x,
            contentBox.y,
            contentBox.width,
            contentBox.height,
            0,
            0,
            contentBox.width,
            contentBox.height
          );
          outputCanvas = croppedCanvas;
          if (pageIndex === 1) {
            detectedWidthMm = Math.max(5, Math.round((contentBox.width / canvas.width) * fullWidthMm));
            detectedHeightMm = Math.max(5, Math.round((contentBox.height / canvas.height) * fullHeightMm));
            isAutoCropped = true;
          }
        }
      } else if (pageIndex === 1) {
        detectedWidthMm = fullWidthMm;
        detectedHeightMm = fullHeightMm;
      }
    } else if (pageIndex === 1) {
      detectedWidthMm = fullWidthMm;
      detectedHeightMm = fullHeightMm;
    }

    return outputCanvas.toDataURL(targetFormat, quality);
  };

  const front = await renderPageToDataUrl(1);
  let back: string | undefined = undefined;

  if (totalPages >= 2 && maxPages >= 2) {
    back = await renderPageToDataUrl(2);
  }

  return {
    front,
    back,
    totalPages,
    fileName,
    fileSize,
    detectedWidthMm,
    detectedHeightMm,
    isAutoCropped,
  };
}


