"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ViewerLoading, ViewerError } from "./ViewerState";

interface DocxViewerProps {
  url: string;
  name: string;
}

/** DOCX viewer powered entirely in-browser by docx-preview. */
export default function DocxViewer({ url, name }: DocxViewerProps) {
  const t = useTranslations("FileViewer");
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const blob = await response.blob();
        if (cancelled || !containerRef.current) return;

        // Clear previous content
        containerRef.current.innerHTML = "";

        const { renderAsync } = await import("docx-preview");
        await renderAsync(blob, containerRef.current, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
          useBase64URL: true,
        });

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(+(prev + delta).toFixed(2), 0.5), 2.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-100/80 dark:bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between h-9 px-3 border-b border-border bg-muted/40 shrink-0">
        <div className="text-xs text-muted-foreground truncate font-medium max-w-sm">
          {name}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleZoom(-0.15)}
            disabled={status !== "ready"}
            title={t("zoomOut")}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleZoom(0.15)}
            disabled={status !== "ready"}
            title={t("zoomIn")}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleResetZoom}
            disabled={status !== "ready" || zoom === 1}
            title={t("fitWidth")}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 overflow-auto relative p-6">
        {status === "loading" && <ViewerLoading label={t("loading")} />}
        {status === "error" && (
          <ViewerError message={t("loadError")} detail={error ?? undefined} />
        )}
        <div
          ref={containerRef}
          className="docx-viewer-content mx-auto transition-transform origin-top flex flex-col items-center"
          style={{
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "top center",
          }}
        />
      </div>

      <style jsx global>{`
        .docx-viewer-content .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .docx-viewer-content .docx-wrapper > section.docx {
          box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.08) !important;
          border-radius: 4px;
          margin-bottom: 24px !important;
          background: #ffffff !important;
          color: #111827 !important;
        }
        .dark .docx-viewer-content .docx-wrapper > section.docx {
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.6) !important;
        }
      `}</style>
    </div>
  );
}
