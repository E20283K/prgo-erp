"use client";

import React, { useState, useMemo } from "react";
import {
  Paperclip,
  Plus,
  Trash2,
  Download,
  UploadCloud,
  FileText,
  Search,
  CheckCircle2,
  Eye,
  FileCode,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import {
  Attachment,
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
}

export function FilesTab({
  orderAttachments,
  setOrderAttachments,
  onMarkUnsaved,
  isOperator = false,
  docNo = "DOC-001",
  uploadInputId = "doc-files-upload-input",
}: FilesTabProps) {
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pdf" | "image" | "cad">("all");
  const [isDragOver, setIsDragOver] = useState(false);

  const filteredFiles = useMemo(() => {
    return orderAttachments.filter((file) => {
      const matchSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.type.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      const kind = getFileKind(file);
      if (selectedFilter === "pdf") return kind === "pdf";
      if (selectedFilter === "image") return file.isImage || kind === "other"; // image
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

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles: OrderAttachment[] = Array.from(files).map((f, i) => ({
      id: `att-new-${Date.now()}-${i}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
      type: f.type || "Document",
      date: new Date().toISOString().slice(0, 16).replace("T", " "),
      isImage: f.type.startsWith("image/"),
      url: URL.createObjectURL(f),
    }));
    setOrderAttachments((prev) => [...newFiles, ...prev]);
    onMarkUnsaved();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isOperator && e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

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

      {/* Files Grid */}
      {filteredFiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map((file) => {
            const fKind = getFileKind(file);
            const fMeta = FILE_KIND_ICON[fKind];
            const Icon = fMeta.icon;
            const isLinkable = isPreviewable(file);

            return (
              <div
                key={file.id}
                className={cn(
                  "p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-all flex flex-col justify-between gap-3 shadow-2xs group",
                  isLinkable && "cursor-pointer"
                )}
                onClick={isLinkable ? () => setPreviewFile(file) : undefined}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-muted/50 border border-border flex items-center justify-center shrink-0">
                    <Icon className={cn("w-5 h-5", fMeta.className)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4
                      className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors"
                      title={file.name}
                    >
                      {file.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-mono">
                      <span>{file.size}</span>
                      <span>•</span>
                      <span>{file.type}</span>
                    </div>
                    {file.date && (
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                        Yuklangan: {file.date}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono">
                    {fKind.toUpperCase()}
                  </Badge>

                  <div className="flex items-center gap-1">
                    {isLinkable && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(file);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Ko'rish (Preview)"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {file.url && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(file);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Yuklab olish (Download)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!isOperator && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderAttachments((prev) => prev.filter((f) => f.id !== file.id));
                          onMarkUnsaved();
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="O'chirish (Delete)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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
