"use client";

import React, { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FileDown, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import {
  downloadBlob,
  readImportFile,
  type ImportPreviewRow,
  type ImportValidation,
  type RawTable,
} from "@/components/documents/warehouse/utils/tableImport";

export interface ImportPreviewColumn<T> {
  header: string;
  className?: string;
  render: (row: ImportPreviewRow<T>) => React.ReactNode;
}

interface SpreadsheetImportDialogProps<T extends { rowNo: number }> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shablon fayl nomi (kengaytmasiz) */
  templateName: string;
  buildXlsx: () => Promise<Blob>;
  buildCsv: () => Blob;
  validate: (table: RawTable) => ImportValidation<T>;
  previewColumns: ImportPreviewColumn<T>[];
  /** POST { rows } → { success, data: { created, updated, failed: [{ rowNo, error }] } } */
  endpoint: string;
  onImported: () => Promise<void> | void;
}

const Badge = ({ tone, children }: { tone: "new" | "update" | "info"; children: React.ReactNode }) => {
  const cls =
    tone === "update"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : tone === "new"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400";
  return <span className={`inline-flex h-5 items-center rounded border px-1.5 text-[11px] whitespace-nowrap ${cls}`}>{children}</span>;
};

/** Excel/CSV fayldan ommaviy kiritish: shablon, oldindan ko'rish, faqat yaroqli qatorlarni saqlash */
export function SpreadsheetImportDialog<T extends { rowNo: number }>({
  open,
  onOpenChange,
  title,
  templateName,
  buildXlsx,
  buildCsv,
  validate,
  previewColumns,
  endpoint,
  onImported,
}: SpreadsheetImportDialogProps<T>) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow<T>[]>([]);
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const counts = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0);
    return {
      total: rows.length,
      valid: valid.length,
      create: valid.filter((r) => r.action === "create").length,
      update: valid.filter((r) => r.action === "update").length,
      invalid: rows.length - valid.length,
    };
  }, [rows]);

  const reset = () => {
    setFileName("");
    setRows([]);
    setError("");
    setResult(null);
  };

  const handleClose = (next: boolean) => {
    if (saving) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const { rows: parsed, missingHeaders } = validate(await readImportFile(file));
      if (missingHeaders.length > 0) {
        setError(`Ustunlar topilmadi: ${missingHeaders.join(", ")}. Shablondan foydalaning.`);
        return;
      }
      if (parsed.length === 0) {
        setError("Faylda ma'lumot qatori yo'q.");
        return;
      }
      setRows(parsed);
    } catch (e: any) {
      setError(e?.message || "Faylni o'qib bo'lmadi.");
    } finally {
      setParsing(false);
    }
  };

  const handleTemplate = async (kind: "xlsx" | "csv") => {
    try {
      if (kind === "xlsx") downloadBlob(await buildXlsx(), `${templateName}.xlsx`);
      else downloadBlob(buildCsv(), `${templateName}.csv`);
    } catch (e: any) {
      setError(e?.message || "Shablonni yaratib bo'lmadi.");
    }
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid.map((r) => r.data) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || "Import bajarilmadi.");
        return;
      }
      const { created, updated, failed } = json.data as {
        created: number;
        updated: number;
        failed: { rowNo: number; error: string }[];
      };
      await onImported();
      // Faqat saqlanmagan qatorlar (mijozdagi va serverdagi xatolar) ro'yxatda qoladi
      const failedMap = new Map(failed.map((f) => [f.rowNo, f.error]));
      setRows((prev) =>
        prev
          .filter((r) => r.errors.length > 0 || failedMap.has(r.rowNo))
          .map((r) => (failedMap.has(r.rowNo) ? { ...r, errors: [failedMap.get(r.rowNo)!] } : r))
      );
      setResult({ created, updated, failed: failed.length });
    } catch (e: any) {
      setError(e?.message || "Import bajarilmadi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 border-border bg-card">
        <DialogHeader className="px-4 py-3 border-b border-border bg-muted/30">
          <DialogTitle className="text-sm font-semibold text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 p-4 min-h-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing || saving}
            >
              <Upload className="size-3.5" />
              <span>Fayl tanlash</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer outline-none">
                <FileDown className="size-3.5" />
                <span>Shablon</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36 p-1 text-xs">
                <DropdownMenuItem className="text-xs gap-2" onClick={() => void handleTemplate("xlsx")}>
                  <FileSpreadsheet className="size-3.5" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={() => void handleTemplate("csv")}>
                  <FileDown className="size-3.5" />
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {fileName && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-mono truncate max-w-72">
                {fileName}
                {!saving && (
                  <button type="button" onClick={reset} className="p-0.5 rounded hover:bg-muted cursor-pointer">
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            )}
          </div>

          {rows.length === 0 && !parsing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className="h-28 rounded border border-dashed border-border bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
            >
              <FileSpreadsheet className="size-5 text-muted-foreground/60" />
              <span>.xlsx / .csv</span>
            </button>
          )}

          {parsing && (
            <div className="h-28 flex items-center justify-center text-xs text-muted-foreground gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              O&apos;qilmoqda
            </div>
          )}

          {rows.length > 0 && (
            <div className="border border-border rounded overflow-auto min-h-0 flex-1 max-h-[55vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted text-muted-foreground z-10">
                  <tr className="h-7 text-left">
                    <th className="px-2 font-medium w-10">Qator</th>
                    {previewColumns.map((c) => (
                      <th key={c.header} className={`px-2 font-medium ${c.className || ""}`}>
                        {c.header}
                      </th>
                    ))}
                    <th className="px-2 font-medium">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNo} className="h-[26px] border-t border-border align-middle">
                      <td className="px-2 font-mono text-muted-foreground">{r.rowNo}</td>
                      {previewColumns.map((c) => (
                        <td key={c.header} className={`px-2 truncate max-w-64 ${c.className || ""}`}>
                          {c.render(r)}
                        </td>
                      ))}
                      <td className="px-2">
                        {r.errors.length > 0 ? (
                          <span className="text-destructive" title={r.errors.join("; ")}>
                            {r.errors.join("; ")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            {r.action === "update" ? <Badge tone="update">Yangilash</Badge> : <Badge tone="new">Yangi</Badge>}
                            {(r.flags || []).map((f) => (
                              <Badge key={f} tone="info">
                                {f}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result && (
            <div className="text-xs text-foreground">
              Saqlandi: yangi {result.created}, yangilandi {result.updated}
              {result.failed > 0 && <span className="text-destructive">, xato {result.failed}</span>}
            </div>
          )}
          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>

        <DialogFooter className="mx-0 mb-0 px-4 py-3 border-t border-border bg-muted/20 sm:items-center">
          {rows.length > 0 && (
            <span className="mr-auto text-xs text-muted-foreground font-mono">
              Jami {counts.total} · Yangi {counts.create} · Yangilash {counts.update}
              {counts.invalid > 0 && <span className="text-destructive"> · Xato {counts.invalid}</span>}
            </span>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClose(false)} disabled={saving}>
            {result && rows.length === 0 ? "Yopish" : "Bekor"}
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleImport} disabled={saving || counts.valid === 0}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Import{counts.valid > 0 ? ` (${counts.valid})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
