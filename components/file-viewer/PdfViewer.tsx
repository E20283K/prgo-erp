"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoomIn, ZoomOut, MoveHorizontal, RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ViewerLoading, ViewerError } from "./ViewerState";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

type PdfJsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJsModule> | null = null;

/** Lazily loads PDF.js in the browser only (it requires DOM APIs at import time). */
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

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
}

function PdfPage({ doc, pageNumber, scale, rotation }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let task: RenderTask | null = null;
    let cancelled = false;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      setSize({ w: viewport.width, h: viewport.height });
      task = page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      try {
        await task.promise;
      } catch {
        /* render cancelled on re-render */
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, scale, rotation]);

  return (
    <div
      data-page={pageNumber}
      className="bg-white shadow-sm ring-1 ring-border mx-auto"
      style={size ? { width: size.w, height: size.h } : { width: 600 * scale, height: 800 * scale }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

export default function PdfViewer({ url }: { url: string }) {
  const t = useTranslations("FileViewer");
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Load the document
  useEffect(() => {
    let destroyed = false;
    let loaded: PDFDocumentProxy | null = null;
    setDoc(null);
    setError(null);

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url }).promise)
      .then(async (pdf) => {
        if (destroyed) {
          pdf.cleanup();
          (pdf as unknown as { destroy?: () => void }).destroy?.();
          return;
        }
        loaded = pdf;
        // Fit first page to container width initially
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        const width = (containerRef.current?.clientWidth ?? 800) - 48;
        setScale(Math.min(Math.max(width / vp.width, MIN_SCALE), 2));
        setDoc(pdf);
      })
      .catch((e: unknown) => {
        if (!destroyed) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      destroyed = true;
      loaded?.cleanup();
      (loaded as unknown as { destroy?: () => void })?.destroy?.();
    };
  }, [url]);

  // Track the currently visible page
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !doc) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrentPage(Number((visible.target as HTMLElement).dataset.page));
      },
      { root, threshold: [0.25, 0.5, 0.75] }
    );
    root.querySelectorAll("[data-page]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [doc, scale, rotation]);

  const goToPage = useCallback((n: number) => {
    const el = containerRef.current?.querySelector(`[data-page="${n}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const fitWidth = useCallback(async () => {
    if (!doc || !containerRef.current) return;
    const page = await doc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
    setScale(Math.max((containerRef.current.clientWidth - 48) / vp.width, MIN_SCALE));
  }, [doc, currentPage, rotation]);

  const zoom = (factor: number) =>
    setScale((s) => Math.min(Math.max(+(s * factor).toFixed(2), MIN_SCALE), MAX_SCALE));

  const numPages = doc?.numPages ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-1 h-9 px-2 border-b border-border bg-muted/40 shrink-0">
        <Button variant="ghost" size="icon-sm" title={t("prevPage")} disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground min-w-24 text-center">
          {numPages ? t("pageOf", { page: currentPage, total: numPages }) : "—"}
        </span>
        <Button variant="ghost" size="icon-sm" title={t("nextPage")} disabled={currentPage >= numPages} onClick={() => goToPage(currentPage + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button variant="ghost" size="icon-sm" title={t("zoomOut")} onClick={() => zoom(1 / 1.2)} disabled={!doc}>
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon-sm" title={t("zoomIn")} onClick={() => zoom(1.2)} disabled={!doc}>
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" title={t("fitWidth")} onClick={fitWidth} disabled={!doc}>
          <MoveHorizontal className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" title={t("rotate")} onClick={() => setRotation((r) => (r + 90) % 360)} disabled={!doc}>
          <RotateCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Pages */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-muted p-6">
        {error ? (
          <ViewerError message={t("loadError")} detail={error} />
        ) : !doc ? (
          <ViewerLoading label={t("loading")} />
        ) : (
          <div className="flex flex-col gap-4 w-max min-w-full">
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage key={i + 1} doc={doc} pageNumber={i + 1} scale={scale} rotation={rotation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
