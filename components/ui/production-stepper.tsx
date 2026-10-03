"use client";

import React, { useRef, useEffect, useState } from "react";
import { Check, Clock, AlertTriangle, PlayCircle } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductionMilestone } from "../documents/work-order/types";

interface ProductionStepperProps {
  milestones: ProductionMilestone[];
  onStatusChange?: (milestoneId: string, newStatus: ProductionMilestone["status"]) => void;
  readOnly?: boolean;
}

const statusConfig = {
  "Pending": {
    icon: Clock,
    colorClass: "text-zinc-400 dark:text-zinc-500",
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-300 dark:border-zinc-700",
    lineClass: "bg-zinc-200 dark:bg-zinc-800",
  },
  "In Progress": {
    icon: PlayCircle,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    borderClass: "border-blue-300 dark:border-blue-700",
    lineClass: "bg-blue-400 dark:bg-blue-600",
  },
  "Done": {
    icon: Check,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    borderClass: "border-emerald-400 dark:border-emerald-700",
    lineClass: "bg-emerald-400 dark:bg-emerald-600",
  },
  "Issue": {
    icon: AlertTriangle,
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/40",
    borderClass: "border-red-400 dark:border-red-700",
    lineClass: "bg-red-400 dark:bg-red-600",
  },
};

export function ProductionStepper({ milestones, onStatusChange, readOnly = false }: ProductionStepperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineWidths, setLineWidths] = useState<number[]>([]);

  useEffect(() => {
    // Calculate the width between each node for absolute positioning of connecting lines
    const calculateWidths = () => {
      if (!containerRef.current) return;
      const nodes = containerRef.current.querySelectorAll('.stepper-node');
      const widths: number[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        const current = nodes[i].getBoundingClientRect();
        const next = nodes[i + 1].getBoundingClientRect();
        // Distance from center of current node to center of next node
        const distance = next.left + next.width / 2 - (current.left + current.width / 2);
        widths.push(distance);
      }
      setLineWidths(widths);
    };

    calculateWidths();
    window.addEventListener('resize', calculateWidths);
    return () => window.removeEventListener('resize', calculateWidths);
  }, [milestones]);

  if (!milestones || milestones.length === 0) return null;

  return (
    <div className="w-full flex items-start justify-between relative px-2 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md" ref={containerRef}>
      {milestones.map((milestone, idx) => {
        const config = statusConfig[milestone.status] || statusConfig["Pending"];
        const Icon = config.icon;
        
        const isPrevDoneOrActive = idx > 0 && 
          (milestones[idx - 1].status === "Done" || milestones[idx - 1].status === "In Progress" || milestones[idx - 1].status === "Issue");
        
        const content = (
          <div className={cn(
            "flex flex-col items-center gap-2 relative group cursor-pointer stepper-node z-10",
            readOnly && "cursor-default"
          )}>
            {/* Colored segment connecting from previous */}
            {idx > 0 && (
              <div 
                className={cn(
                  "absolute top-4 h-0.5 -z-10", 
                  isPrevDoneOrActive ? statusConfig[milestones[idx-1].status].lineClass : "bg-zinc-200 dark:bg-zinc-800"
                )} 
                style={{ 
                  right: '50%', 
                  width: lineWidths[idx - 1] ? `${lineWidths[idx - 1]}px` : '100px',
                  transition: 'background-color 0.3s ease, width 0.1s ease'
                }}
              />
            )}
            
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white dark:bg-zinc-900 transition-colors shadow-sm",
              config.borderClass,
              config.bgClass,
              !readOnly && "hover:ring-2 hover:ring-offset-1 hover:ring-blue-200 dark:hover:ring-blue-900"
            )}>
              <Icon className={cn("w-4 h-4", config.colorClass)} />
            </div>
            
            <div className="text-center w-24">
              <span className="block text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                {milestone.name}
              </span>
              <span className="block text-[9px] font-medium text-zinc-500 uppercase mt-0.5 tracking-wide">
                {milestone.department}
              </span>
            </div>
          </div>
        );

        if (readOnly) {
          return <React.Fragment key={milestone.id}>{content}</React.Fragment>;
        }

        return (
          <DropdownMenu key={milestone.id}>
            <DropdownMenuTrigger render={content} />
            <DropdownMenuContent align="center" className="w-40 text-xs">
              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "Done")} className="flex items-center gap-2 cursor-pointer">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Mark as Done
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "In Progress")} className="flex items-center gap-2 cursor-pointer">
                <PlayCircle className="w-3.5 h-3.5 text-blue-600" /> Mark In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "Issue")} className="flex items-center gap-2 cursor-pointer">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Report Issue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(milestone.id, "Pending")} className="flex items-center gap-2 cursor-pointer">
                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Reset to Pending
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
