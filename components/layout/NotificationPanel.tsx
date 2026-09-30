"use client";

import React, { useCallback, useState } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceStore, AppNotification, NotifSeverity } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number, t: any): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("hoursAgo", { hrs });
  const days = Math.floor(hrs / 24);
  return t("daysAgo", { days });
}

function fullDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEVERITY_META: Record<
  NotifSeverity,
  {
    icon: React.ElementType;
    iconCls: string;
    ringCls: string;
    dotCls: string;
    label: string;
    mediaBg: string;
  }
> = {
  error: {
    icon: XCircle,
    iconCls: "text-red-500 dark:text-red-400",
    ringCls: "border-l-red-500 dark:border-l-red-400",
    dotCls: "bg-red-500",
    label: "Error",
    mediaBg: "bg-red-100 dark:bg-red-950",
  },
  warning: {
    icon: AlertTriangle,
    iconCls: "text-amber-500 dark:text-amber-400",
    ringCls: "border-l-amber-500 dark:border-l-amber-400",
    dotCls: "bg-amber-500",
    label: "Warning",
    mediaBg: "bg-amber-100 dark:bg-amber-950",
  },
  success: {
    icon: CheckCircle2,
    iconCls: "text-emerald-500 dark:text-emerald-400",
    ringCls: "border-l-emerald-500 dark:border-l-emerald-400",
    dotCls: "bg-emerald-500",
    label: "Success",
    mediaBg: "bg-emerald-100 dark:bg-emerald-950",
  },
  info: {
    icon: Info,
    iconCls: "text-blue-500 dark:text-blue-400",
    ringCls: "border-l-blue-500 dark:border-l-blue-400",
    dotCls: "bg-blue-500",
    label: "Info",
    mediaBg: "bg-blue-100 dark:bg-blue-950",
  },
};

// ─── Notification Detail AlertDialog ─────────────────────────────────────────

interface NotifDetailDialogProps {
  notif: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: (id: string) => void;
  onNavigate: (module: string, subModule: string) => void;
}

function NotifDetailDialog({
  notif,
  open,
  onOpenChange,
  onDismiss,
  onNavigate,
}: NotifDetailDialogProps) {
  if (!notif) return null;

  const meta = SEVERITY_META[notif.severity];
  const Icon = meta.icon;

  const handleNavigate = () => {
    if (notif.link) {
      onNavigate(notif.link.module, notif.link.subModule);
    }
    onOpenChange(false);
  };

  const handleDismiss = () => {
    onDismiss(notif.id);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          {/* Severity icon badge */}
          <AlertDialogMedia className={cn(meta.mediaBg)}>
            <Icon className={cn("w-5 h-5", meta.iconCls)} />
          </AlertDialogMedia>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertDialogTitle className="text-sm leading-snug">
                {notif.title}
              </AlertDialogTitle>
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wider h-4 px-1.5 shrink-0",
                  notif.severity === "error" &&
                    "border-red-300 text-red-600 dark:border-red-800 dark:text-red-400",
                  notif.severity === "warning" &&
                    "border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400",
                  notif.severity === "success" &&
                    "border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400",
                  notif.severity === "info" &&
                    "border-blue-300 text-blue-600 dark:border-blue-800 dark:text-blue-400",
                )}
              >
                {meta.label}
              </Badge>
            </div>
            <AlertDialogDescription className="text-xs leading-relaxed">
              {notif.description ?? "No additional details available for this notification."}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        {/* Metadata row */}
        <div className="px-4 -mt-1 mb-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1.5 border border-border/50">
            <span>Received</span>
            <span>{fullDate(notif.timestamp)}</span>
          </div>
          {notif.link && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1.5 border border-border/50 mt-1">
              <span>Module</span>
              <span className="text-primary capitalize">
                {notif.link.module} / {notif.link.subModule}
              </span>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss} variant="outline" size="sm">
            Dismiss
          </AlertDialogCancel>
          {notif.link ? (
            <AlertDialogAction
              size="sm"
              onClick={handleNavigate}
              className="gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in {notif.link.module}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction size="sm" onClick={() => onOpenChange(false)}>
              Got it
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Notification List Item ───────────────────────────────────────────────────

interface NotifItemProps {
  notif: AppNotification;
  onDismiss: (id: string) => void;
  onExpand: (notif: AppNotification) => void;
}

function NotifItem({ notif, onDismiss, onExpand }: NotifItemProps) {
  const t = useTranslations("NotificationPanel");
  const meta = SEVERITY_META[notif.severity];
  const Icon = meta.icon;

  return (
    <button
      onClick={() => onExpand(notif)}
      className={cn(
        "group relative w-full text-left flex gap-2.5 px-3 py-2.5 border-l-2 transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50",
        notif.read ? "border-l-border/40 opacity-60" : meta.ringCls,
      )}
    >
      {/* Severity icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("w-3.5 h-3.5", meta.iconCls)} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-[11px] font-medium leading-snug",
              notif.read ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {notif.title}
          </p>
          {/* Dismiss — stops propagation so it doesn't open detail */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notif.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onDismiss(notif.id);
              }
            }}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Dismiss notification"
          >
            <X className="w-3 h-3" />
          </span>
        </div>

        {notif.description && (
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1 pr-2">
            {notif.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {relativeTime(notif.timestamp, t)}
          </span>
          <span className="text-[10px] text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            Details <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <span
          className={cn(
            "absolute top-2 right-2 w-1.5 h-1.5 rounded-full shrink-0 pointer-events-none",
            meta.dotCls,
          )}
        />
      )}
    </button>
  );
}

// ─── Main Notification Panel ──────────────────────────────────────────────────

export function NotificationPanel() {
  const tNotif = useTranslations("NotificationPanel");
  const {
    notifications,
    isNotifPanelOpen,
    setNotifPanelOpen,
    dismissNotification,
    markAllRead,
    clearAllNotifications,
    setActiveModule,
    setModule,
  } = useWorkspaceStore();

  const [detailNotif, setDetailNotif] = useState<AppNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  const handleExpand = useCallback((notif: AppNotification) => {
    setDetailNotif(notif);
    setDetailOpen(true);
  }, []);

  const handleNavigate = useCallback(
    (module: string, subModule: string) => {
      setActiveModule(module);
      setModule(module, subModule);
      setNotifPanelOpen(false);
      setDetailOpen(false);
    },
    [setActiveModule, setModule, setNotifPanelOpen],
  );

  return (
    <>
      {/* ── Popover tray (panel list) ── */}
      <Popover open={isNotifPanelOpen} onOpenChange={setNotifPanelOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground relative"
                    aria-label={`${tNotif("title")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-0.5 leading-none select-none pointer-events-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>
                }
              />
            }
          />
          <TooltipContent side="bottom" className="text-[11px]">
            {tNotif("title")}{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </TooltipContent>
        </Tooltip>

        <PopoverContent side="bottom" align="end" sideOffset={6} className="w-[340px] p-0 gap-0">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-foreground" />
              <span className="text-xs font-semibold text-foreground">{tNotif("title")}</span>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-primary/20"
                >
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {unreadCount > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={markAllRead}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={tNotif("markAllRead")}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-[11px]">{tNotif("markAllRead")}</TooltipContent>
                </Tooltip>
              )}
              {notifications.length > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllNotifications}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={tNotif("clearAll")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-[11px]">{tNotif("clearAll")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Body */}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="w-8 h-8 opacity-20" />
              <p className="text-[11px]">{tNotif("noNotifications")}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="divide-y divide-border/50">
                {unread.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-muted/30 border-b border-border/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {tNotif("unreadCount", { count: unread.length })}
                      </span>
                    </div>
                    {unread.map((n) => (
                      <NotifItem key={n.id} notif={n} onDismiss={dismissNotification} onExpand={handleExpand} />
                    ))}
                  </div>
                )}
                {read.length > 0 && (
                  <div>
                    {read.map((n) => (
                      <NotifItem key={n.id} notif={n} onDismiss={dismissNotification} onExpand={handleExpand} />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {notifications.length} · {tNotif("unreadCount", { count: unreadCount })}
                </span>
                <Button
                  variant="link"
                  size="xs"
                  onClick={markAllRead}
                  className="text-[10px] text-primary hover:underline font-medium h-auto p-0"
                >
                  {tNotif("markAllRead")}
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* ── AlertDialog for single notification detail ── */}
      <NotifDetailDialog
        notif={detailNotif}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDismiss={dismissNotification}
        onNavigate={handleNavigate}
      />
    </>
  );
}
