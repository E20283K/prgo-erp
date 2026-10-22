"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Paperclip,
  Plus,
  Trash2,
  Download,
  UploadCloud,
  Search,
  Eye,
  FileCode,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Check,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";
import { FilePreviewDialog } from "@/components/file-viewer/FilePreviewDialog";
import {
  FILE_KIND_ICON,
  getFileKind,
  isPreviewable,
  downloadFile,
  ViewableFile,
} from "@/components/file-viewer/file-utils";
import { OrderAttachment } from "../work-order/types";

interface FilesTabProps {
  orderAttachments: OrderAttachment[];
  setOrderAttachments: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  onMarkUnsaved: () => void;
  isOperator?: boolean;
  docNo?: string;
  uploadInputId?: string;
  onFileUploaded?: (attachment: OrderAttachment) => void;
}

interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: string;
  progress: number;
  state: "uploading" | "processing" | "done" | "error";
  errorMessage?: string;
  cancelFn?: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function FilesTab({
  orderAttachments,
  setOrderAttachments,
  onMarkUnsaved,
  isOperator = false,
  docNo = "DOC-001",
  uploadInputId = "doc-files-upload-input",
  onFileUploaded,
}: FilesTabProps) {
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pdf" | "image" | "cad">("all");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  // Ref to hold abort controllers / timers for cleanup
  const activeJobsRef = useRef<Map<string, { abort: () => void }>>(new Map());

  const filteredFiles = useMemo(() => {
    return orderAttachments.filter((file) => {
      const matchSearch =
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.type.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      const kind = getFileKind(file);
      if (selectedFilter === "pdf") return kind === "pdf";
      if (selectedFilter === "image") return file.isImage || kind === "other";
      if (selectedFilter === "cad") {
        return (
          file.name.endsWith(".dxf") ||
          file.name.endsWith(".cad") ||
          file.name.endsWith(".ai") ||
          file.name.endsWith(".eps") ||
          file.type.includes("vector")
        );
      }
      return true;
    });
  }, [orderAttachments, searchQuery, selectedFilter]);

  const updateTask = useCallback((id: string, updates: Partial<UploadTask>) => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const cancelUpload = useCallback((taskId: string) => {
    const job = activeJobsRef.current.get(taskId);
    if (job) {
      job.abort();
      activeJobsRef.current.delete(taskId);
    }
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const dismissTask = useCallback((taskId: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setUploadTasks((prev) => prev.filter((t) => t.state === "uploading" || t.state === "processing"));
  }, []);

  // Upload runner with real percentage progress tracking and graceful fallback
  const startUpload = useCallback(
    async (file: File, taskId: string) => {
      let category: "proofs" | "artwork" | "dieline" | "docs" = "docs";
      const ext = file.name.toLowerCase().split(".").pop();
      if (["dxf", "cf2", "ard"].includes(ext || "")) category = "dieline";
      else if (["ai", "eps", "cdr"].includes(ext || "")) category = "artwork";
      else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) category = "proofs";

      let isAborted = false;
      let activeXhr: XMLHttpRequest | null = null;
      let activeTimer: ReturnType<typeof setInterval> | null = null;

      const abortHandler = () => {
        isAborted = true;
        if (activeXhr) activeXhr.abort();
        if (activeTimer) clearInterval(activeTimer);
      };

      activeJobsRef.current.set(taskId, { abort: abortHandler });
      updateTask(taskId, { progress: 8, state: "uploading", cancelFn: abortHandler });

      try {
        // Step 1: Request presigned upload URL from API
        const metaRes = await fetch(`/api/v1/production/work-orders/${encodeURIComponent(docNo)}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docNo,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: formatBytes(file.size),
            category,
          }),
        });

        if (isAborted) return;

        let presignedData: any = null;
        try {
          presignedData = await metaRes.json();
        } catch {
          presignedData = null;
        }

        // Case A: Real presigned upload URL is available
        if (presignedData && presignedData.success && presignedData.uploadUrl) {
          updateTask(taskId, { progress: 15, state: "uploading" });

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            activeXhr = xhr;

            xhr.upload.addEventListener("progress", (evt) => {
              if (evt.lengthComputable && !isAborted) {
                // Scale progress from 15% to 92%
                const pct = Math.min(92, Math.max(15, Math.round(15 + (evt.loaded / evt.total) * 77)));
                updateTask(taskId, { progress: pct, state: "uploading" });
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                updateTask(taskId, { progress: 96, state: "processing" });
                resolve();
              } else {
                reject(new Error(`Server javobi: ${xhr.status}`));
              }
            });

            xhr.addEventListener("error", () => reject(new Error("Tarmoqda xatolik yuz berdi")));
            xhr.addEventListener("abort", () => reject(new Error("Yuklash bekor qilindi")));

            xhr.open("PUT", presignedData.uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            xhr.send(file);
          });

          if (isAborted) return;

          const finalUrl = presignedData.downloadUrl || URL.createObjectURL(file);
          updateTask(taskId, { progress: 100, state: "done" });

          const newAtt: OrderAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: formatBytes(file.size),
            type: file.type || "Document",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: file.type.startsWith("image/"),
            url: finalUrl,
          };

          setOrderAttachments((prev) => [newAtt, ...prev]);
          onFileUploaded?.(newAtt);
          onMarkUnsaved();
        } else {
          // Case B: Local development / mock simulation with realistic incremental progress
          let currentProgress = 12;
          updateTask(taskId, { progress: currentProgress, state: "uploading" });

          await new Promise<void>((resolve) => {
            activeTimer = setInterval(() => {
              if (isAborted) {
                if (activeTimer) clearInterval(activeTimer);
                resolve();
                return;
              }
              currentProgress += Math.floor(Math.random() * 16) + 10;
              if (currentProgress >= 95) {
                currentProgress = 95;
                if (activeTimer) clearInterval(activeTimer);
                updateTask(taskId, { progress: 95, state: "processing" });
                setTimeout(() => {
                  if (!isAborted) {
                    updateTask(taskId, { progress: 100, state: "done" });
                    resolve();
                  }
                }, 350);
              } else {
                updateTask(taskId, { progress: currentProgress, state: "uploading" });
              }
            }, 90);
          });

          if (isAborted) return;

          const localUrl = URL.createObjectURL(file);
          const newAtt: OrderAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: formatBytes(file.size),
            type: file.type || "Document",
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            isImage: file.type.startsWith("image/"),
            url: localUrl,
          };

          setOrderAttachments((prev) => [newAtt, ...prev]);
          onFileUploaded?.(newAtt);
          onMarkUnsaved();
        }

        // Auto-cleanup finished task after 6 seconds to keep layout pristine
        setTimeout(() => {
          setUploadTasks((prev) => prev.filter((t) => t.id !== taskId || t.state !== "done"));
        }, 6000);
      } catch (err: any) {
        if (!isAborted) {
          updateTask(taskId, {
            state: "error",
            errorMessage: err?.message || "Yuklashda xatolik yuz berdi",
          });
        }
      } finally {
        activeJobsRef.current.delete(taskId);
      }
    },
    [docNo, onFileUploaded, onMarkUnsaved, setOrderAttachments, updateTask]
  );

  const handleAddFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const newTaskList: { task: UploadTask; file: File }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const taskId = `up-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        const task: UploadTask = {
          id: taskId,
          file,
          name: file.name,
          size: formatBytes(file.size),
          progress: 0,
          state: "uploading",
        };
        newTaskList.push({ task, file });
      }

      setUploadTasks((prev) => [...newTaskList.map((item) => item.task), ...prev]);

      // Launch upload workers
      newTaskList.forEach(({ file, task }) => {
        startUpload(file, task.id);
      });
    },
    [startUpload]
  );

  const retryUpload = useCallback(
    (taskId: string) => {
      const task = uploadTasks.find((t) => t.id === taskId);
      if (task) {
        updateTask(taskId, { progress: 0, state: "uploading", errorMessage: undefined });
        startUpload(task.file, taskId);
      }
    },
    [uploadTasks, updateTask, startUpload]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isOperator && e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const activeUploadsCount = useMemo(() => {
    return uploadTasks.filter((t) => t.state === "uploading" || t.state === "processing").length;
  }, [uploadTasks]);

  const hasDoneTasks = useMemo(() => {
    return uploadTasks.some((t) => t.state === "done");
  }, [uploadTasks]);

  return (
    <TabsContent value="files" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
      {/* File Preview Modal */}
      <FilePreviewDialog
        file={previewFile}
        isOpen={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-card border border-border rounded-lg shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xs text-foreground">
                Hujjatlar va Texnik Fayllar (Attached Files & Documents)
              </h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                {orderAttachments.length} ta fayl
              </Badge>
              {activeUploadsCount > 0 && (
                <Badge variant="default" className="text-[10px] bg-primary animate-pulse font-mono">
                  {activeUploadsCount} ta yuklanmoqda...
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Buyurtma chizmalari, shtans-forma DXF fayllari, mijoz maketi va texnik tasdiqnomalar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOperator && (
            <Button
              type="button"
              size="sm"
              onClick={() => document.getElementById(uploadInputId)?.click()}
              className="h-8 px-3 text-xs gap-1.5 font-medium shadow-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Fayl yuklash</span>
            </Button>
          )}
        </div>
      </div>

      {/* Upload Drag & Drop Area */}
      {!isOperator && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(uploadInputId)?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5",
            isDragOver
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border hover:border-primary/60 bg-muted/10 hover:bg-muted/20"
          )}
        >
          <UploadCloud className="w-7 h-7 text-muted-foreground" />
          <div className="font-semibold text-xs text-foreground">
            Fayllarni shu yerga tashlang yoki tanlash uchun bosing
          </div>
          <div className="text-[11px] text-muted-foreground">
            PDF, AI, CDR, DXF shtans-forma, ZIP va yuqori aniqlikdagi maketlar qabul qilinadi
          </div>
          <input
            type="file"
            id={uploadInputId}
            className="hidden"
            multiple
            onChange={(e) => handleAddFiles(e.target.files)}
          />
        </div>
      )}

      {/* ── Active Uploading Queue Progress Panel (shadcn Attachment & Progress) ── */}
      {uploadTasks.length > 0 && (
        <div className="p-3.5 bg-muted/25 border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className={cn("w-3.5 h-3.5 text-primary", activeUploadsCount > 0 && "animate-spin")} />
              <span className="text-xs font-semibold text-foreground">
                Yuklash holati ({activeUploadsCount} faol / {uploadTasks.length} jami)
              </span>
            </div>
            {hasDoneTasks && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearCompletedTasks}
                className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Yakunlanganlarni tozalash
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {uploadTasks.map((task) => {
              const isImg = task.file.type.startsWith("image/");
              return (
                <Attachment
                  key={task.id}
                  state={task.state}
                  className="w-full justify-between bg-card shadow-2xs border-border"
                >
                  <AttachmentMedia variant={isImg ? "image" : "icon"}>
                    {task.state === "uploading" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : task.state === "processing" ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    ) : task.state === "error" ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </AttachmentMedia>

                  <AttachmentContent className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <AttachmentTitle className="text-xs font-medium" title={task.name}>
                        {task.name}
                      </AttachmentTitle>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
                        {task.progress}%
                      </span>
                    </div>

                    <AttachmentDescription className="text-[11px]">
                      {task.state === "uploading" && `${task.size} · Yuklanmoqda...`}
                      {task.state === "processing" && "Serverda saqlanmoqda..."}
                      {task.state === "done" && `${task.size} · Muvaffaqiyatli yuklandi`}
                      {task.state === "error" && (task.errorMessage || "Xatolik yuz berdi")}
                    </AttachmentDescription>

                    {(task.state === "uploading" || task.state === "processing") && (
                      <div className="w-full pt-1">
                        <Progress value={task.progress} className="h-1.5" />
                      </div>
                    )}
                  </AttachmentContent>

                  <AttachmentActions>
                    {(task.state === "uploading" || task.state === "processing") && (
                      <AttachmentAction
                        onClick={() => cancelUpload(task.id)}
                        title="Bekor qilish (Cancel)"
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </AttachmentAction>
                    )}
                    {task.state === "error" && (
                      <AttachmentAction
                        onClick={() => retryUpload(task.id)}
                        title="Qayta urinish (Retry)"
                        className="text-muted-foreground hover:text-primary cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </AttachmentAction>
                    )}
                    {task.state === "done" && (
                      <AttachmentAction
                        onClick={() => dismissTask(task.id)}
                        title="Yopish (Dismiss)"
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      </AttachmentAction>
                    )}
                  </AttachmentActions>
                </Attachment>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls & Search Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "Barchasi (All)" },
            { id: "pdf", label: "PDF Hujjatlar" },
            { id: "image", label: "Rasmlar / Maketlar" },
            { id: "cad", label: "CAD / Chizmalar" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedFilter(cat.id as any)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer shrink-0",
                selectedFilter === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Fayl nomi bo'yicha qidirish..."
            className="h-8 pl-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* Files Grid (shadcn Attachment components) */}
      {filteredFiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map((file) => {
            const fKind = getFileKind(file);
            const fMeta = FILE_KIND_ICON[fKind];
            const Icon = fMeta.icon;
            const isLinkable = isPreviewable(file);

            return (
              <Attachment
                key={file.id}
                state="done"
                className="w-full justify-between bg-card hover:border-primary/50 transition-all p-3 shadow-2xs group"
              >
                <AttachmentMedia variant={file.isImage ? "image" : "icon"}>
                  {file.isImage && file.url ? (
                    <img src={file.url} alt={file.name} className="object-cover w-full h-full" />
                  ) : (
                    <Icon className={cn("w-5 h-5", fMeta.className)} />
                  )}
                </AttachmentMedia>

                <AttachmentContent
                  className={cn("space-y-0.5 min-w-0 flex-1", isLinkable && "cursor-pointer")}
                  onClick={isLinkable ? () => setPreviewFile(file) : undefined}
                >
                  <AttachmentTitle
                    className="text-xs font-semibold group-hover:text-primary transition-colors"
                    title={file.name}
                  >
                    {file.name}
                  </AttachmentTitle>
                  <AttachmentDescription className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span>{file.size}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono uppercase">
                      {fKind}
                    </Badge>
                    {file.date && <span className="text-muted-foreground/80">• {file.date}</span>}
                  </AttachmentDescription>
                </AttachmentContent>

                <AttachmentActions>
                  {isLinkable && (
                    <AttachmentAction
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(file);
                      }}
                      title="Ko'rish (Preview)"
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </AttachmentAction>
                  )}
                  {file.url && (
                    <AttachmentAction
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(file);
                      }}
                      title="Yuklab olish (Download)"
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </AttachmentAction>
                  )}
                  {!isOperator && (
                    <AttachmentAction
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrderAttachments((prev) => prev.filter((f) => f.id !== file.id));
                        onMarkUnsaved();
                      }}
                      title="O'chirish (Delete)"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </AttachmentAction>
                  )}
                </AttachmentActions>
              </Attachment>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/10 space-y-1">
          <FileCode className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="text-xs font-semibold text-foreground">Mos keluvchi fayllar topilmadi</p>
          <p className="text-[11px] text-muted-foreground">
            Ushbu bo&apos;limda hozircha hech qanday fayl yuklanmagan yoki qidiruv natijasi mavjud emas.
          </p>
        </div>
      )}
    </TabsContent>
  );
}
