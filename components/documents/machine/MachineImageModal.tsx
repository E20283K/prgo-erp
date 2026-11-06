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
import { Cpu, DollarSign, Gauge, User, MapPin, Camera, X } from "lucide-react";

export interface MachineImagePreviewData {
  imageUrl: string;
  name: string;
  code?: string;
  department?: string;
  category?: string;
  status?: string;
  hourlyRate?: number;
  speed?: string;
  location?: string;
  leadOperator?: string;
}

interface MachineImageModalProps {
  data: MachineImagePreviewData | null;
  isOpen: boolean;
  onClose: () => void;
  onEditImage?: () => void;
}

export function MachineImageModal({
  data,
  isOpen,
  onClose,
  onEditImage,
}: MachineImageModalProps) {
  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Image Display Container */}
        <div className="relative w-full h-64 bg-muted/40 flex items-center justify-center border-b border-border p-3">
          <div className="relative size-full rounded-lg overflow-hidden border border-border/80 bg-background flex items-center justify-center shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.imageUrl}
              alt={data.name}
              className="w-full h-full object-contain p-2 select-none"
            />
          </div>
          {data.status && (
            <Badge
              variant="outline"
              className={`absolute top-5 right-5 text-[11px] font-semibold px-2 py-0.5 shadow-xs bg-background/90 backdrop-blur-xs ${
                data.status === "Running"
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : data.status === "Maintenance"
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "border-blue-500/40 text-blue-600 dark:text-blue-400"
              }`}
            >
              {data.status}
            </Badge>
          )}
        </div>

        {/* Content Info */}
        <div className="p-4 space-y-3 text-xs">
          <DialogHeader className="p-0 text-left space-y-1">
            <div className="flex items-center gap-2">
              {data.code && (
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {data.code}
                </span>
              )}
              {data.department && (
                <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5">
                  {data.department}
                </Badge>
              )}
              {data.category && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 px-1.5">
                  {data.category}
                </Badge>
              )}
            </div>
            <DialogTitle className="text-sm font-semibold text-foreground leading-snug">
              {data.name}
            </DialogTitle>
            {data.location && (
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">{data.location}</span>
              </DialogDescription>
            )}
          </DialogHeader>

          <Separator />

          {/* Key Attributes */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.hourlyRate !== undefined && (
              <div className="p-2 rounded bg-muted/30 border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <DollarSign className="size-3 text-emerald-600 dark:text-emerald-400" />
                  Stavka ($/soat)
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${Number(data.hourlyRate).toFixed(2)}/h
                </span>
              </div>
            )}

            {data.speed && (
              <div className="p-2 rounded bg-muted/30 border border-border/50 flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Gauge className="size-3 text-blue-500" />
                  Ish Tezligi
                </span>
                <span className="font-mono font-semibold text-foreground truncate">
                  {data.speed}
                </span>
              </div>
            )}

            {data.leadOperator && (
              <div className="p-2 rounded bg-muted/30 border border-border/50 flex flex-col gap-0.5 col-span-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <User className="size-3 text-muted-foreground" />
                  Bosh Operator
                </span>
                <span className="font-medium text-foreground">
                  {data.leadOperator}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {onEditImage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEditImage();
                }}
                className="h-7 text-xs gap-1.5"
              >
                <Camera className="size-3.5" />
                <span>Rasmni almashtirish</span>
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
              className="h-7 text-xs ml-auto px-4"
            >
              Yopish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
