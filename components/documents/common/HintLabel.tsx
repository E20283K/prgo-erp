"use client";

import React from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Maydon yorlig'i + (i) belgisi: sichqoncha olib borilganda yoki bosilganda
 * parametr nimani anglatishini qisqa tushuntiradi.
 */
export function HintLabel({
  children,
  hint,
  required,
  className,
}: {
  children: React.ReactNode;
  hint: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 min-w-0", className)}>
      <Label className="text-[11px] text-muted-foreground font-semibold truncate">
        {children}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              tabIndex={-1}
              aria-label="Izoh"
              className="shrink-0 inline-flex items-center justify-center text-muted-foreground/60 hover:text-primary cursor-help"
            >
              <Info className="size-3" />
            </button>
          }
        />
        <TooltipContent side="top" sideOffset={4} className="max-w-72 text-[11px] leading-snug whitespace-normal block">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
