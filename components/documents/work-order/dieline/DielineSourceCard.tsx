"use client";

import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FileUp, Loader2, Scissors } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PresignUnavailableError, uploadOrderFile } from "@/lib/client/uploadOrderFile";
import type { OrderAttachment, OrderDieline } from "../types";
import {
  dielineFileCandidates,
  dielineNeed,
  resolveDieline,
  type DielineSpec,
} from "../utils/dielineGeometry";

interface ToolingLike {
  category?: string;
  name?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface DielineSourceCardProps {
  spec: DielineSpec;
  value?: OrderDieline;
  onChange: (value: OrderDieline) => void;
  attachments?: OrderAttachment[];
  toolingItems?: ToolingLike[];
  docNo?: string;
  onAddAttachment?: (attachment: OrderAttachment) => void;
  readOnly?: boolean;
  className?: string;
}

const MODES: { value: OrderDieline["source"]; label: string }[] = [
  { value: "spec", label: "Spetsifikatsiya" },
  { value: "file", label: "Fayl" },
  { value: "none", label: "Yo'q" },
];

/**
 * One place to choose the order's die (noj): generated from the Specifications shape,
 * a PDF/SVG file on the order (uploaded here, in Files or on a die-cutting tool), or none.
 */
export function DielineSourceCard({
  spec,
  value,
  onChange,
  attachments = [],
  toolingItems = [],
  docNo,
  onAddAttachment,
  readOnly,
  className,
}: DielineSourceCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => dielineFileCandidates(attachments, toolingItems), [attachments, toolingItems]);
  const resolved = useMemo(() => resolveDieline(value, spec, candidates), [value, spec, candidates]);
  const need = dielineNeed(spec);
  const mode: OrderDieline["source"] = value?.source ?? resolved.source;

  const previewSrc = useMemo(
    () => (resolved.source === "spec" ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(resolved.built.svg)}` : null),
    [resolved]
  );

  const selectMode = (next: OrderDieline["source"]) => {
    setError(null);
    if (next === "file") {
      const current = value?.source === "file" && value.fileUrl ? value : null;
      const first = candidates[0];
      onChange(
        current ?? (first ? { source: "file", fileUrl: first.url, fileName: first.name, origin: first.origin } : { source: "file" })
      );
    } else {
      onChange({ source: next });
    }
  };

  const handleUpload = async (file: File) => {
    if (!docNo) {
      setError("Avval buyurtmani saqlang");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const att = await uploadOrderFile(docNo, file, { category: "dieline" });
      onAddAttachment?.(att);
      onChange({ source: "file", fileUrl: att.url, fileName: att.name, origin: "upload" });
    } catch (e) {
      setError(e instanceof PresignUnavailableError ? "Fayl ombori ulanmagan" : e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setUploading(false);
    }
  };

  const status =
    resolved.source === "spec"
      ? resolved.built.summary
      : resolved.source === "file"
        ? resolved.name
        : resolved.reason === "file_required"
          ? "Fayl kerak"
          : resolved.reason === "missing_file"
            ? "Fayl tanlanmagan"
            : resolved.reason === "missing_size"
              ? "O'lcham yo'q"
              : "Gilotin";
  const warn = resolved.source === "none" && resolved.reason !== undefined && resolved.reason !== "not_needed";

  return (
    <section className={cn("border border-border rounded-md bg-card", className)}>
      <header className="h-8 px-2.5 flex items-center justify-between gap-2 border-b border-border">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Scissors className="size-3.5 text-muted-foreground" />
          Pichoq
        </h3>
        <span
          className={cn(
            "flex items-center gap-1 text-[11px] font-mono truncate max-w-[60%]",
            warn ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
          )}
          title={status}
        >
          {warn && <AlertTriangle className="size-3 shrink-0" />}
          <span className="truncate">{status}</span>
        </span>
      </header>

      <div className="p-2.5 space-y-2">
        <div className="inline-flex h-7 p-0.5 rounded-md border border-border bg-muted w-full">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={readOnly}
              onClick={() => selectMode(m.value)}
              className={cn(
                "flex-1 px-2 rounded text-xs transition-colors cursor-pointer disabled:cursor-not-allowed",
                mode === m.value ? "bg-background text-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "spec" &&
          (previewSrc ? (
            <div className="h-28 rounded border border-border bg-white flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt="Pichoq konturi" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {need === "file_required" || (resolved.source === "none" && resolved.reason === "missing_size") ? (
                <>
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                  {need === "file_required" ? "Bu shakl uchun noj faylini yuklang" : "Mahsulot o'lchamini kiriting"}
                </>
              ) : (
                "To'g'ri burchakli gilotin kesim — pichoq kerak emas"
              )}
            </div>
          ))}

        {mode === "file" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Select
                value={value?.fileUrl ?? ""}
                disabled={readOnly || candidates.length === 0}
                onValueChange={(url) => {
                  const c = candidates.find((x) => x.url === url);
                  if (c) onChange({ source: "file", fileUrl: c.url, fileName: c.name, origin: c.origin });
                }}
              >
                <SelectTrigger className="h-7 flex-1 min-w-0 text-xs px-2 bg-background">
                  <SelectValue placeholder={candidates.length ? "Faylni tanlang" : "Fayl yo'q"} />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {candidates.map((c) => (
                    <SelectItem key={c.url} value={c.url} className="text-xs">
                      {c.name}
                      {c.origin === "tooling" ? " · jihoz" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {value?.fileUrl && (
                <a
                  href={value.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Ochish"
                  className="size-7 shrink-0 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf,image/svg+xml,.svg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={readOnly || uploading}
              onClick={() => inputRef.current?.click()}
              className="h-7 w-full px-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
              PDF / SVG yuklash
            </button>
          </div>
        )}

        {error && <div className="text-[11px] text-destructive">{error}</div>}
      </div>
    </section>
  );
}
