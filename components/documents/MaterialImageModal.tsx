"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MapPin, Boxes, Package, Tag, Layers, X, ExternalLink } from "lucide-react";

export interface MaterialImagePreviewData {
  imageUrl: string;
  title: string;
  sku?: string;
  category?: string;
  spec?: string;
  stock?: string | number;
  unit?: string;
  location?: string;
  supplier?: string;
  notes?: string;
  status?: string;
}

interface MaterialImageModalProps {
  data: MaterialImagePreviewData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MaterialImageModal({ data, isOpen, onClose }: MaterialImageModalProps) {
  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Image Display Container */}
        <div className="relative w-full h-56 bg-muted/40 flex items-center justify-center border-b border-border p-4">
          <div className="relative size-44 rounded-xl overflow-hidden shadow-md border border-border/80 bg-background flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.imageUrl}
              alt={data.title}
              className="w-full h-full object-contain p-2 select-none"
            />
          </div>
          {data.status && (
            <Badge
              variant="outline"
              className={`absolute top-3 right-3 text-[11px] font-semibold px-2 py-0.5 shadow-sm bg-background/90 backdrop-blur-sm ${
                data.status === "In Stock" || data.status === "Active"
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : data.status === "Low Stock" || data.status === "Reserved"
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "border-rose-500/40 text-rose-600 dark:text-rose-400"
              }`}
            >
              {data.status}
            </Badge>
          )}
        </div>

        {/* Content Info */}
        <div className="p-4 space-y-3">
          <DialogHeader className="p-0 text-left space-y-1">
            <div className="flex items-center gap-2">
              {data.sku && (
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                  {data.sku}
                </span>
              )}
              {data.category && (
                <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5">
                  {data.category}
                </Badge>
              )}
            </div>
            <DialogTitle className="text-sm font-semibold text-foreground leading-snug">
              {data.title}
            </DialogTitle>
            {data.spec && (
              <DialogDescription className="text-xs text-muted-foreground font-mono">
                {data.spec}
              </DialogDescription>
            )}
          </DialogHeader>

          <Separator />

          {/* Key Attributes */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.stock !== undefined && (
              <div className="p-2 rounded bg-muted/40 border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Boxes className="size-3 text-muted-foreground" />
                  Qoldiq miqdori
                </span>
                <span className="font-mono font-bold text-foreground">
                  {data.stock} {data.unit || ""}
                </span>
              </div>
            )}

            {data.location && (
              <div className="p-2 rounded bg-muted/40 border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3 text-muted-foreground" />
                  Ombordagi joyi
                </span>
                <span className="font-medium text-foreground truncate">
                  {data.location}
                </span>
              </div>
            )}

            {data.supplier && (
              <div className="col-span-2 p-2 rounded bg-muted/40 border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Package className="size-3 text-muted-foreground" />
                  Ta&apos;minotchi / Ishlab chiqaruvchi
                </span>
                <span className="font-medium text-foreground truncate">
                  {data.supplier}
                </span>
              </div>
            )}

            {data.notes && (
              <div className="col-span-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-semibold block mb-0.5">Texnik izoh:</span>
                {data.notes}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs px-3">
              Yopish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
