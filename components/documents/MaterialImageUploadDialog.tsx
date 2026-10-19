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
  Palette,
  Check,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  SVG_PAPER_SILK,
  SVG_CARDBOARD,
  SVG_KRAFT,
  SVG_COLORPLAN_EBONY,
  SVG_INK_CMYK,
  SVG_INK_PANTONE,
  SVG_CTP_PLATE,
  SVG_FILM_ROLL,
  SVG_FOIL_GOLD,
  SVG_GLUE,
  SVG_RIBBON_SATIN,
  SVG_YARN_CONE,
  SVG_OFFCUT,
  SVG_BOX,
} from "@/lib/materialImages";

export interface MaterialPresetItem {
  id: string;
  name: string;
  category: string;
  svgUrl: string;
}

export const MATERIAL_PRESETS: MaterialPresetItem[] = [
  { id: "paper-silk", name: "Art Silk 150g", category: "Paper & Board", svgUrl: SVG_PAPER_SILK },
  { id: "cardboard", name: "Cardboard 300g", category: "Paper & Board", svgUrl: SVG_CARDBOARD },
  { id: "kraft", name: "Kraft Board 350g", category: "Paper & Board", svgUrl: SVG_KRAFT },
  { id: "colorplan", name: "Colorplan Ebony 270g", category: "Specialty", svgUrl: SVG_COLORPLAN_EBONY },
  { id: "ink-cmyk", name: "CMYK Process Ink", category: "Inks & Plates", svgUrl: SVG_INK_CMYK },
  { id: "ink-pantone", name: "Pantone Spot Ink", category: "Inks & Plates", svgUrl: SVG_INK_PANTONE },
  { id: "ctp-plate", name: "CTP Plates 1030×790", category: "Inks & Plates", svgUrl: SVG_CTP_PLATE },
  { id: "film-bopp", name: "Soft-Touch Matte Film", category: "Foil & Film", svgUrl: SVG_FILM_ROLL },
  { id: "foil-gold", name: "Gold Hot Foil 220mm", category: "Foil & Film", svgUrl: SVG_FOIL_GOLD },
  { id: "glue-pur", name: "PUR / PVA Yelim", category: "Adhesives", svgUrl: SVG_GLUE },
  { id: "satin-ribbon", name: "Satin Ribbon 60mm", category: "Roll & Label", svgUrl: SVG_RIBBON_SATIN },
  { id: "yarn-cone", name: "Polyester Ip / Kalava", category: "Textile", svgUrl: SVG_YARN_CONE },
  { id: "offcut-scrap", name: "Delovoy Otxod / Qoldiq", category: "Offcuts", svgUrl: SVG_OFFCUT },
  { id: "carton-box", name: "Quti / Qadoqlash", category: "Packaging", svgUrl: SVG_BOX },
];

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle local file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSelectedImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      setSelectedImage(urlInput.trim());
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl text-xs p-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ImageIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <span>Materialga rasm biriktirish</span>
                {materialSku && (
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5">
                    {materialSku}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-md">
                {materialName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Live Preview Bar */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-lg border border-border overflow-hidden bg-background shrink-0 flex items-center justify-center p-1 shadow-sm">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="size-full object-contain select-none"
                />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-foreground block">
                {selectedImage ? "Tanlangan rasm ko'rinishi" : "Hozircha rasm tanlanmadi"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {selectedImage.startsWith("data:")
                  ? `Format: Oflayn Data-URI (${fileName || "Ichki rasm"})`
                  : selectedImage
                  ? `URL: ${selectedImage.slice(0, 45)}...`
                  : "Standart avtomatik shablon ishlatiladi"}
              </span>
            </div>
          </div>

          {selectedImage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="size-3" />
              <span>Tozalash</span>
            </Button>
          )}
        </div>

        {/* Tabs for Source: Upload vs URL vs Presets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4 pt-2">
          <TabsList className="h-8 bg-muted/70 p-0.5 text-xs grid grid-cols-3 mb-3">
            <TabsTrigger value="upload" className="h-7 text-xs gap-1.5 data-[state=active]:bg-background">
              <Upload className="size-3.5" />
              <span>Qurilmadan yuklash</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="h-7 text-xs gap-1.5 data-[state=active]:bg-background">
              <LinkIcon className="size-3.5" />
              <span>Internet havolasi (URL)</span>
            </TabsTrigger>
            <TabsTrigger value="presets" className="h-7 text-xs gap-1.5 data-[state=active]:bg-background">
              <Palette className="size-3.5" />
              <span>Shablonlar ({MATERIAL_PRESETS.length})</span>
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
              className="border-2 border-dashed border-border hover:border-blue-500/60 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 text-center"
            >
              <div className="size-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Upload className="size-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Kompyuterdan rasm faylini tanlash
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  PNG, JPG, WEBP yoki SVG (maksimal 5 MB)
                </span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs mt-1 pointer-events-none">
                Faylni tanlash
              </Button>
            </div>
            {fileName && (
              <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground truncate">{fileName}</span>
                <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                  Yuklandi
                </Badge>
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
                  placeholder="https://images.unsplash.com/... yoki https://cdn.server/photo.jpg"
                  className="h-8 text-xs font-mono bg-background"
                />
                <Button size="sm" onClick={handleUrlApply} className="h-8 text-xs px-3 shrink-0">
                  Qo&apos;llash
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tavsiya: Yuqori tezlikda yuklanishi uchun to&apos;g&apos;ridan-to&apos;g&apos;ri rasm fayliga havola bering.
            </p>
          </TabsContent>

          {/* ── 3. Presets Catalog Tab ─────────────────────────────── */}
          <TabsContent value="presets" className="m-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
              {MATERIAL_PRESETS.map((preset) => {
                const isCurrent = selectedImage === preset.svgUrl;
                return (
                  <div
                    key={preset.id}
                    onClick={() => {
                      setSelectedImage(preset.svgUrl);
                      setFileName(preset.name);
                    }}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-1.5 relative ${
                      isCurrent
                        ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                    }`}
                  >
                    <div className="size-12 mx-auto rounded border border-border/80 overflow-hidden bg-background flex items-center justify-center p-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preset.svgUrl}
                        alt={preset.name}
                        className="size-full object-contain select-none"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-foreground block truncate text-center">
                        {preset.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground block text-center truncate">
                        {preset.category}
                      </span>
                    </div>
                    {isCurrent && (
                      <div className="absolute top-1 right-1 size-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="size-2.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
            Saqlash va yangilash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
