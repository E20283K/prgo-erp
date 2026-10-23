"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Crop, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onCropComplete: (croppedBlob: Blob, previewUrl: string) => void;
}

const OUTPUT_SIZE = 400; // Standard 400x400 square avatar
const VIEWPORT_SIZE = 280; // Size of square preview box in dialog

export function ImageCropperDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: ImageCropperDialogProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Load and measure natural dimensions of the image
  useEffect(() => {
    if (!imageSrc) {
      setImageLoaded(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imageObjRef.current = img;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImageLoaded(true);
    };
  }, [imageSrc]);

  // Handle Drag / Pan
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Reset positioning
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Perform square 1:1 canvas crop
  const handleCrop = useCallback(() => {
    const img = imageObjRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Fill white background just in case of transparent png
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Calculate scaling ratio from VIEWPORT_SIZE to natural image
    // In viewport: base dimension fits smallest edge
    const minDim = Math.min(naturalSize.width, naturalSize.height);
    const baseScale = VIEWPORT_SIZE / minDim;
    const totalScale = baseScale * zoom;

    // Viewport center
    const vpCenterX = VIEWPORT_SIZE / 2;
    const vpCenterY = VIEWPORT_SIZE / 2;

    // Canvas center
    const outCenterX = OUTPUT_SIZE / 2;
    const outCenterY = OUTPUT_SIZE / 2;

    const scaleFactor = OUTPUT_SIZE / VIEWPORT_SIZE;

    ctx.save();
    ctx.translate(outCenterX + pan.x * scaleFactor, outCenterY + pan.y * scaleFactor);
    ctx.scale((totalScale * scaleFactor) / 1, (totalScale * scaleFactor) / 1);
    ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2);
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          onCropComplete(blob, previewUrl);
          onOpenChange(false);
        }
      },
      "image/jpeg",
      0.92
    );
  }, [naturalSize, pan, zoom, onCropComplete, onOpenChange]);

  // Calculate base width/height to fill the viewport
  const minDim = Math.min(naturalSize.width || 1, naturalSize.height || 1);
  const baseScale = VIEWPORT_SIZE / minDim;
  const currentWidth = naturalSize.width * baseScale * zoom;
  const currentHeight = naturalSize.height * baseScale * zoom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-5 select-none">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Crop className="w-4 h-4 text-blue-600" />
            <span>Rasmni kvadrat formatga moslash (1:1)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Rasmni kvadrat ramka ichida siljiting va kattalashtiring. Avatar doim kvadrat ko&apos;rinishda saqlanadi.
          </p>

          {/* Viewport Canvas area */}
          <div className="flex justify-center">
            <div
              className="relative rounded-lg overflow-hidden border-2 border-dashed border-blue-500/50 bg-black/10 dark:bg-black/40 cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
              style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {imageLoaded && imageSrc && (
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none transition-none"
                  style={{
                    width: currentWidth,
                    height: currentHeight,
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                  }}
                />
              )}

              {/* Circular avatar guideline overlay */}
              <div
                className="absolute inset-0 rounded-full border border-white/60 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
              />

              {/* Center crosshair */}
              <div className="absolute w-2 h-2 border-t border-l border-white/60 pointer-events-none" />
            </div>
          </div>

          {/* Zoom Slider Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Masshtab (Zoom)</span>
              </span>
              <span className="font-mono text-[11px]">{zoom.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(1)))}
                disabled={zoom <= 1}
                className="h-7 w-7"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-blue-600 h-1.5 bg-muted rounded cursor-pointer"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
                disabled={zoom >= 3}
                className="h-7 w-7"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleReset}
                title="Qayta tiklash"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Bekor qilish
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCrop}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
          >
            Qirqish va Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
