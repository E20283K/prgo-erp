"use client";

import React, { useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FilePreviewDialogProps {
  /** File to show; the dialog is open while this is set. */
  url: string | null;
  /** Title shown after "Ko'rish:" and used as the download name. */
  name: string;
  /** Original file name (with extension) for the download; falls back to `name`. */
  fileName?: string;
  onClose: () => void;
}

function isSvg(url: string, fileName?: string): boolean {
  let s = url;
  try {
    s = decodeURIComponent(url);
  } catch {
    /* raw */
  }
  return /\.svg(&|$)/i.test(`${fileName || ""}`) || /\.svg(\?|&|#|$)/i.test(s);
}

/** PDF / SVG preview used for artworks and the die file. */
export function FilePreviewDialog({ url, name, fileName, onClose }: FilePreviewDialogProps) {
  const [downloading, setDownloading] = useState(false);

  // `download` on a cross-origin / API URL is ignored by browsers, so the bytes are fetched
  // and saved from a blob with a proper file name.
  const download = async () => {
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || `${name.replace(/[\\/:*?"<>|]+/g, "_")}${isSvg(url, fileName) ? ".svg" : ".pdf"}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl w-[94vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="h-10 px-3 pr-10 border-b border-border flex flex-row items-center justify-between gap-2 shrink-0">
          <DialogTitle className="text-xs font-semibold truncate flex items-center gap-1.5 min-w-0">
            <Eye className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{name}</span>
          </DialogTitle>
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait shrink-0"
          >
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Yuklab olish
          </button>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30 flex items-center justify-center">
          {url && isSvg(url, fileName) ? (
            <div className="size-full overflow-auto p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} className="max-w-full max-h-full object-contain border border-border bg-white" />
            </div>
          ) : url ? (
            <iframe src={`${url}#toolbar=1&navpanes=0&view=Fit`} title={name} className="size-full border-0" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
