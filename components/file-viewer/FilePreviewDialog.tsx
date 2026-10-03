"use client";

import React, { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Maximize2, Minimize2, X } from "lucide-react";
import { ViewableFile, getFileKind, downloadFile, FILE_KIND_ICON } from "./file-utils";
import { ViewerError, ViewerLoading } from "./ViewerState";
import { cn } from "cn";

// Lazy load the heavy viewers with ssr: false
const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });
const XlsxViewer = dynamic(() => import("./XlsxViewer"), { ssr: false });
const DocxViewer = dynamic(() => import("./DocxViewer"), { ssr: false });

interface FilePreviewDialogProps {
  file: ViewableFile | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ file, isOpen, onOpenChange }: FilePreviewDialogProps) {
  const t = useTranslations("FileViewer");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsFullscreen(false);
  }, [isOpen]);

  if (!file) return null;

  const kind = getFileKind(file);
  const canPreview = kind !== "other" && !!file.url;
  const KindMeta = FILE_KIND_ICON[kind];
  const KindIcon = KindMeta.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[96vw] max-w-[96vw] sm:max-w-[96vw] md:max-w-[96vw] lg:max-w-[1720px] h-[92vh] sm:h-[92vh] max-h-[95vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden shadow-2xl border bg-background duration-150 transition-all",
          isFullscreen &&
            "fixed inset-0 top-0 left-0 w-screen max-w-none sm:max-w-none md:max-w-none lg:max-w-none h-screen sm:h-screen max-h-none translate-x-0 translate-y-0 rounded-none z-50 border-0"
        )}
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-2.5 border-b border-border flex-row items-center justify-between shrink-0 bg-muted/30 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-md bg-white dark:bg-zinc-800 border border-border flex items-center justify-center shrink-0 shadow-xs">
              <KindIcon className={cn("w-4 h-4", KindMeta.className)} />
            </div>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="truncate text-sm font-semibold text-foreground leading-tight">
                {file.name}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span>{file.size}</span>
                <span>•</span>
                <span>{file.type}</span>
                {file.date && (
                  <>
                    <span>•</span>
                    <span>{file.date}</span>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 cursor-pointer"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? t("exitFullscreen") : t("fullscreen")}</span>
            </Button>

            {file.url && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 hidden md:flex cursor-pointer"
                onClick={() => window.open(file.url, "_blank")}
                title={t("openInNewTab")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t("openInNewTab")}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 cursor-pointer"
              onClick={() => downloadFile(file)}
              title={t("download")}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("download")}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer ml-1"
              onClick={() => onOpenChange(false)}
              title={t("close")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative bg-zinc-100/60 dark:bg-zinc-950/60 overflow-hidden">
          {!canPreview ? (
            <ViewerError message={t("unsupportedTitle")} detail={t("unsupportedHint")} />
          ) : (
            <Suspense fallback={<ViewerLoading label={t("loading")} />}>
              {kind === "image" && (
                <div className="w-full h-full p-6 flex items-center justify-center overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-md shadow-md border border-border"
                  />
                </div>
              )}
              {kind === "pdf" && <PdfViewer url={file.url!} />}
              {kind === "xlsx" && <XlsxViewer url={file.url!} name={file.name} />}
              {kind === "docx" && <DocxViewer url={file.url!} name={file.name} />}
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
