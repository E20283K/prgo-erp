"use client";

import React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  title?: string;
  description: React.ReactNode;
  formula?: string;
  example?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
  iconClassName?: string;
}

export function InfoTooltip({
  title,
  description,
  formula,
  example,
  side = "top",
  align = "center",
  className,
  iconClassName,
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={0}
            className={cn(
              "inline-flex items-center justify-center p-0.5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors cursor-help focus:outline-hidden focus:ring-1 focus:ring-ring shrink-0 select-none",
              className
            )}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            aria-label={title || "Ma'lumot"}
          >
            <Info className={cn("w-3.5 h-3.5", iconClassName)} />
          </span>
        }
      />
      <TooltipContent
        side={side}
        align={align}
        sideOffset={5}
        className="max-w-[280px] p-2.5 text-xs bg-zinc-900 text-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-700 shadow-lg rounded-md space-y-1.5 z-50 text-left font-normal"
      >
        {title && (
          <div className="font-semibold text-white text-[11px] leading-tight flex items-center gap-1 border-b border-zinc-700/60 pb-1">
            <span>{title}</span>
          </div>
        )}
        <div className="text-[11px] leading-relaxed text-zinc-200">
          {description}
        </div>
        {formula && (
          <div className="mt-1 pt-1 border-t border-zinc-700/60 text-[10px] font-mono text-amber-300 bg-black/30 px-1.5 py-0.5 rounded">
            <span className="text-zinc-400 font-sans mr-1">Formula:</span>
            {formula}
          </div>
        )}
        {example && (
          <div className="text-[10px] text-zinc-400 italic">
            <span className="font-medium not-italic text-zinc-300">Misol: </span>
            {example}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default InfoTooltip;
