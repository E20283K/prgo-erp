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

/**
 * Generates high-resolution PNG Data URLs mimicking the sample Hangtag artwork (RED FLAG sample).
 * Renders directly onto an in-memory HTML Canvas for 100% compatibility across
 * browser previews, Canvas, jsPDF, @react-pdf/renderer, and ReportLab Python backend.
 */
export function generateSampleRedFlagArtwork(): { front: string; back: string } {
  // If in browser, render to Canvas for native PNG
  if (typeof document !== "undefined") {
    try {
      const renderHangtag = (isBack: boolean): string => {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 800;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No 2d context");

        // Background
        ctx.fillStyle = "#18181b";
        ctx.fillRect(0, 0, 400, 800);

        if (!isBack) {
          // Red Logo Bars
          ctx.fillStyle = "#ef4444";
          const startX = 90;
          const startY = 370;
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
              ctx.fillRect(startX + c * 36, startY + r * 52, 22, 42);
            }
          }

          // Vertical Text "RED FLAG"
          ctx.save();
          ctx.translate(140, 500);
          ctx.rotate(Math.PI / 2);
          ctx.font = "900 52px 'Helvetica Neue', Arial, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.fillText("RED", 0, 0);
          ctx.fillText("FLAG", 0, 52);
          ctx.restore();

          // QR Code Graphic Block
          ctx.fillStyle = "#27272a";
          ctx.fillRect(255, 665, 65, 65);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(261, 671, 20, 20);
          ctx.fillRect(294, 671, 20, 20);
          ctx.fillRect(261, 704, 20, 20);
          ctx.fillStyle = "#18181b";
          ctx.fillRect(264, 674, 14, 14);
          ctx.fillRect(297, 674, 14, 14);
          ctx.fillRect(264, 707, 14, 14);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(267, 677, 8, 8);
          ctx.fillRect(300, 677, 8, 8);
          ctx.fillRect(267, 710, 8, 8);
        } else {
          // Back side
          ctx.fillStyle = "#a1a1aa";
          ctx.font = "bold 13px 'Helvetica Neue', Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("RED FLAG COLLECTION • 100% COTTON", 200, 720);
          ctx.fillStyle = "#71717a";
          ctx.font = "11px 'Helvetica Neue', Arial, sans-serif";
          ctx.fillText("STYLE #RF-8092 • ARTWORK VERIFIED", 200, 742);
        }

        return canvas.toDataURL("image/png");
      };

      return {
        front: renderHangtag(false),
        back: renderHangtag(true),
      };
    } catch {
      // Fallback to SVG if canvas creation fails
    }
  }

  const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" width="400" height="800">
    <rect width="400" height="800" rx="30" fill="#18181b"/>
    <path d="M 35 0 L 365 0 C 385 0 400 15 400 35 L 400 765 C 400 785 385 800 365 800 L 35 800 C 15 800 0 785 0 765 L 0 35 C 0 15 15 0 35 0 Z" fill="#18181b"/>
    <g transform="translate(90, 370)">
      <rect x="0" y="0" width="22" height="42" rx="4" fill="#ef4444"/>
      <rect x="36" y="0" width="22" height="42" rx="4" fill="#ef4444"/>
      <rect x="72" y="0" width="22" height="42" rx="4" fill="#ef4444"/>
      <rect x="0" y="52" width="22" height="42" rx="4" fill="#ef4444"/>
      <rect x="36" y="52" width="22" height="42" rx="4" fill="#ef4444"/>
      <rect x="72" y="52" width="22" height="42" rx="4" fill="#ef4444"/>
    </g>
    <g transform="translate(140, 500) rotate(90)">
      <text x="0" y="0" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="52" fill="#ffffff" letter-spacing="4">RED</text>
      <text x="0" y="52" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="52" fill="#ffffff" letter-spacing="4">FLAG</text>
    </g>
    <g transform="translate(255, 665)">
      <rect width="65" height="65" rx="6" fill="#27272a"/>
      <rect x="6" y="6" width="20" height="20" fill="#ffffff"/>
      <rect x="9" y="9" width="14" height="14" fill="#18181b"/>
      <rect x="12" y="12" width="8" height="8" fill="#ffffff"/>
      <rect x="39" y="6" width="20" height="20" fill="#ffffff"/>
      <rect x="42" y="9" width="14" height="14" fill="#18181b"/>
      <rect x="45" y="12" width="8" height="8" fill="#ffffff"/>
      <rect x="6" y="39" width="20" height="20" fill="#ffffff"/>
      <rect x="9" y="42" width="14" height="14" fill="#18181b"/>
      <rect x="12" y="45" width="8" height="8" fill="#ffffff"/>
    </g>
  </svg>`;

  const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" width="400" height="800">
    <rect width="400" height="800" rx="30" fill="#18181b"/>
    <text x="200" y="740" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#52525b" letter-spacing="2">RED FLAG COLLECTION • 100% COTTON</text>
  </svg>`;

  return {
    front: `data:image/svg+xml;utf8,${encodeURIComponent(frontSvg)}`,
    back: `data:image/svg+xml;utf8,${encodeURIComponent(backSvg)}`,
  };
}
