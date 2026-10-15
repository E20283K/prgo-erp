"use client";

import React from "react";
import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ───────────────────────── Status / priority badges ───────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800",
  neutral:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700",
};

export function getStatusTone(status?: string): keyof typeof STATUS_STYLES {
  switch (status) {
    case "Active":
    case "In Production":
      return "success";
    case "Approved":
    case "Completed":
      return "info";
    case "Calculating":
    case "Sample Sent":
      return "warning";
    case "Cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn("h-5 shrink-0 text-[11px]", STATUS_STYLES[getStatusTone(status)])}>
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const isHot = priority === "Urgent" || priority === "High";
  return (
    <Badge
      variant="outline"
      className={cn("h-5 shrink-0 text-[11px]", isHot ? STATUS_STYLES.warning : "text-muted-foreground")}
    >
      {priority}
    </Badge>
  );
}

/* ───────────────────────── Header bar ───────────────────────── */

export function DocumentHeader({
  icon: Icon,
  title,
  docNo,
  status,
  priority,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  docNo: string;
  status?: string;
  priority?: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="h-9 shrink-0 px-3 flex items-center justify-between gap-2 border-b border-border bg-muted/60">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <span className="font-semibold text-xs text-foreground truncate" title={title}>
          {title}
        </span>
        <Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />
        <Badge variant="outline" className="h-5 font-mono text-[11px] shrink-0">
          {docNo}
        </Badge>
        <StatusBadge status={status} />
        <span className="hidden md:contents">
          <PriorityBadge priority={priority} />
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </div>
  );
}

export function HeaderIconAction({
  icon: Icon,
  label,
  onClick,
  variant = "ghost",
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "ghost" | "outline";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            onClick={onClick}
            variant={variant}
            size="icon-sm"
            aria-label={label}
            className={cn("h-7 w-7 cursor-pointer", className)}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        }
      />
      <TooltipContent side="bottom" sideOffset={6} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */

export interface DocumentNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number | null;
  badgeClassName?: string;
}

export function DocumentSidebar({
  summary,
  sectionsLabel,
  items,
  activeId,
  onSelect,
  footer,
}: {
  summary: React.ReactNode;
  sectionsLabel: string;
  items: DocumentNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  footer?: React.ReactNode;
}) {
  return (
    <aside className="flex w-52 lg:w-60 shrink-0 flex-col bg-card border-r border-border select-none">
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3">
        {summary}

        <nav className="space-y-0.5" aria-label={sectionsLabel}>
          <div className="px-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {sectionsLabel}
          </div>
          {items.map((item) => {
            const isActive = activeId === item.id;
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="sm"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "relative w-full h-8 justify-between gap-2 px-2 text-xs font-medium cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== null && item.badge !== undefined && item.badge !== "" && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-4.5 px-1.5 text-[10px] font-mono shrink-0",
                      isActive ? "bg-primary/15 text-primary" : item.badgeClassName || "text-muted-foreground"
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </div>

      {footer && <div className="shrink-0 p-2.5 border-t border-border bg-muted/30 space-y-2">{footer}</div>}
    </aside>
  );
}

export function SidebarSummaryCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-xs text-foreground truncate" title={title}>
            {title}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground truncate">{subtitle}</div>
        </div>
      </div>
      <div className="rounded-md border border-border bg-background px-2 py-1.5 divide-y divide-border/60">
        {children}
      </div>
    </div>
  );
}

export function SidebarSectionTitle({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
      <span>{label}</span>
      <Icon className="w-3 h-3 text-primary" />
    </div>
  );
}

/** Label/value row that never overflows the sidebar. */
export function InfoRow({
  label,
  children,
  title,
  className,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2 py-1 text-[11px] first:pt-0 last:pb-0", className)}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground" title={title}>
        {children}
      </span>
    </div>
  );
}

export function formatMoney(value: number | undefined, currency = "USD", fractionDigits = 2) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value || 0);
  } catch {
    return `${(value || 0).toLocaleString()} ${currency}`;
  }
}
