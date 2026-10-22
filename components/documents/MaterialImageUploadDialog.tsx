"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  RotateCcw,
  Camera,
  Check,
} from "lucide-react";

interface MaterialImageUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materialName: string;
  materialSku?: string;
  currentImageUrl?: string;
  onSave: (newImageUrl: string) => void;
}

export function MaterialImageUploadDialog({
  isOpen,
  onClose,
  materialName,
  materialSku,
  currentImageUrl,
  onSave,
}: MaterialImageUploadDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [selectedImage, setSelectedImage] = useState<string>(currentImageUrl || "");
  const [urlInput, setUrlInput] = useState<string>(
    currentImageUrl && !currentImageUrl.startsWith("data:") ? currentImageUrl : ""
  );
  const [fileName, setFileName] = useState<string>("");
  const [fileSizeStr, setFileSizeStr] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;

    setFileName(file.name);
    const sizeKb = (file.size / 1024).toFixed(1);
    setFileSizeStr(file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSelectedImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle local file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      setSelectedImage(urlInput.trim());
      setFileName("Internet havolasi");
      setFileSizeStr("");
    }
  };

  const handleSave = () => {
    onSave(selectedImage);
    onClose();
  };

  const handleReset = () => {
    setSelectedImage("");
    setUrlInput("");
    setFileName("");
    setFileSizeStr("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg text-xs p-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Camera className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <span>Haqiqiy xomashyo rasmini biriktirish</span>
                {materialSku && (
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5">
                    {materialSku}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-md">
                {materialName || "Yangi material"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Live Preview Bar */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-lg border border-border overflow-hidden bg-background shrink-0 flex items-center justify-center p-0.5 shadow-sm">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="size-full object-contain select-none rounded"
                />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-foreground block">
                {selectedImage ? "Tanlangan haqiqiy rasm" : "Hozircha rasm tanlanmagan"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {selectedImage.startsWith("data:")
                  ? `Format: Oflayn Fotosurat (${fileSizeStr || "Yuklangan"})`
                  : selectedImage
                  ? `URL: ${selectedImage.slice(0, 40)}...`
                  : "Material fotosurati yuklanmagan"}
              </span>
            </div>
          </div>

          {selectedImage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive gap-1"
            >
              <RotateCcw className="size-3" />
              <span>O&apos;chirish</span>
            </Button>
          )}
        </div>

        {/* Tabs for Source: Upload vs URL */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4 pt-2">
          <TabsList className="h-8 bg-muted/70 p-0.5 text-xs grid grid-cols-2 mb-3">
            <TabsTrigger value="upload" className="h-7 text-xs gap-1.5 data-[state=active]:bg-background">
              <Upload className="size-3.5" />
              <span>Qurilmadan fotosurat yuklash</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="h-7 text-xs gap-1.5 data-[state=active]:bg-background">
              <LinkIcon className="size-3.5" />
              <span>Internet havolasi (URL)</span>
            </TabsTrigger>
          </TabsList>

          {/* ── 1. File Upload Tab ─────────────────────────────────── */}
          <TabsContent value="upload" className="m-0 space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-border hover:border-blue-500/60 bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <div className="size-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Upload className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Haqiqiy fotosuratni tanlash yoki bu yerga tashlash
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  PNG, JPG, JPEG, WEBP (telefon yoki kompyuterdan)
                </span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs mt-1 pointer-events-none">
                Faylni tanlash
              </Button>
            </div>
            {fileName && (
              <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground truncate max-w-[260px]">{fileName}</span>
                <div className="flex items-center gap-1.5">
                  {fileSizeStr && (
                    <span className="text-[10px] text-muted-foreground font-mono">{fileSizeStr}</span>
                  )}
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                    Yuklandi
                  </Badge>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── 2. Image URL Tab ───────────────────────────────────── */}
          <TabsContent value="url" className="m-0 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Tashqi rasm manzili (Direct Image URL)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://... rasm manzili"
                  className="h-8 text-xs font-mono bg-background"
                />
                <Button size="sm" onClick={handleUrlApply} className="h-8 text-xs px-3 shrink-0">
                  Qo&apos;llash
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              To&apos;g&apos;ridan-to&apos;g&apos;ri haqiqiy mahsulot fotosuratiga olib boruvchi URL manzilini kiriting.
            </p>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="p-3 bg-muted/20 border-t border-border flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs px-3">
            Bekor qilish
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
