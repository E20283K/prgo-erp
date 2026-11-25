"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JobTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saved work order doc number (or id) */
  workOrderId: string;
}

/**
 * Work order passport: the two-page PDF built on the server from the saved order —
 * page 1 the order card, page 2 the production sheet. The Telegram orders group
 * receives this same file.
 */
export function JobTicketDialog({ isOpen, onOpenChange, workOrderId }: JobTicketDialogProps) {
  const t = useTranslations("JobTicket");
  const [isLoading, setIsLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Only the latest request may show its result; an older one (closed dialog, repeated refresh) is aborted.
  const abortRef = useRef<AbortController | null>(null);
  const fileName = `Ish_pasporti_${workOrderId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  // State is set only after the request settles, so the mount effect can call it directly.
  const fetchPdf = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/v1/production/work-orders/${encodeURIComponent(workOrderId)}/order-card?format=pdf`,
        { signal: controller.signal, cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      const url = `${URL.createObjectURL(file)}#filename=${encodeURIComponent(fileName)}`;
      if (controller.signal.aborted) {
        URL.revokeObjectURL(url.split("#")[0]);
        return;
      }
      setErrorMsg(null);
      setPdfUrl(url);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Failed to load work order passport:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, [workOrderId, fileName]);

  const loadPdf = () => {
    setIsLoading(true);
    setErrorMsg(null);
    void fetchPdf();
  };

  // The dialog is mounted only while open: load once. The deferred start and the
  // abort on cleanup keep the StrictMode re-run in dev from rendering a second PDF.
  useEffect(() => {
    const timer = window.setTimeout(() => void fetchPdf(), 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [fetchPdf]);

  // Free the blob when it is replaced or the dialog closes
  useEffect(() => {
    if (!pdfUrl) return;
    return () => URL.revokeObjectURL(pdfUrl.split("#")[0]);
  }, [pdfUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[96vw]! sm:max-w-[96vw]! h-[94vh] max-h-[94vh]! flex flex-col overflow-hidden p-0 gap-0 border border-border bg-muted"
      >
        <div className="shrink-0 flex items-center justify-between px-3 h-11 bg-card border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <DialogTitle className="text-sm font-semibold text-foreground truncate">{t("title")}</DialogTitle>
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {workOrderId}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadPdf}
              disabled={isLoading}
              className="h-7 gap-1.5 text-xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{t("refresh")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
              <span>{t("close")}</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full flex items-center justify-center relative">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              <span>{t("generating")}</span>
            </div>
          ) : errorMsg ? (
            <div className="max-w-md p-4 bg-card border border-destructive/40 rounded-md text-center space-y-3">
              <p className="text-xs font-semibold text-destructive">{t("failed")}</p>
              <p className="text-[11px] text-muted-foreground font-mono break-all">{errorMsg}</p>
              <Button size="sm" variant="outline" onClick={loadPdf} className="h-7 text-xs">
                {t("retry")}
              </Button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}&toolbar=1&navpanes=0&view=FitH`}
              title={fileName}
              className="w-full h-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
