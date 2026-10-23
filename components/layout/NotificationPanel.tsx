"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  SlidersHorizontal,
  CircleDot,
  Check,
  ChevronLeft,
  Layers,
  ArrowRight,
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

const SEVERITY_CONFIG: Record<
  NotifSeverity,
  {
    icon: React.ElementType;
    iconCls: string;
    borderAccent?: string;
  }
> = {
  error: {
    icon: XCircle,
    iconCls: "text-rose-500 dark:text-rose-400",
    borderAccent: "border-l-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    iconCls: "text-amber-500 dark:text-amber-400",
    borderAccent: "border-l-amber-500",
  },
  success: {
    icon: CheckCircle2,
    iconCls: "text-emerald-500 dark:text-emerald-400",
  },
  info: {
    icon: Info,
    iconCls: "text-blue-500 dark:text-blue-400",
  },
};

// ─── Notification List Item ───────────────────────────────────────────────────

interface NotifItemProps {
  notif: AppNotification;
  onOpen: (notif: AppNotification) => void;
  onToggleRead: (id: string, e: React.MouseEvent) => void;
  onDismiss: (id: string, e: React.MouseEvent) => void;
}

function NotifItem({ notif, onOpen, onToggleRead, onDismiss }: NotifItemProps) {
  const t = useTranslations("NotificationPanel");
  const cfg = SEVERITY_CONFIG[notif.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  const categoryLabel = useMemo(() => {
    switch (notif.category) {
      case "production":
        return t("catProduction");
      case "warehouse":
        return t("catWarehouse");
      case "finance":
        return t("catFinance");
      case "crm":
        return t("catCrm");
      default:
        return t("catSystem");
    }
  }, [notif.category, t]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notif)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(notif);
        }
      }}
      className={cn(
        "group relative w-full text-left flex items-start gap-2.5 px-3 py-2.5 transition-colors cursor-pointer select-none border-b border-border/40 last:border-b-0",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50",
        notif.read ? "bg-background opacity-65" : "bg-muted/15 font-normal"
      )}
    >
      {/* Severity Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("size-3.5", cfg.iconCls)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 pr-12 space-y-1">
        {/* Top row: Entity code badge + Title */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {notif.entityCode && (
            <span className="font-mono text-[9px] font-semibold px-1 py-0.2 rounded bg-muted border border-border/70 text-foreground shrink-0 leading-tight">
              {notif.entityCode}
            </span>
          )}
          <span
            className={cn(
              "text-xs leading-snug truncate",
              notif.read ? "text-muted-foreground font-normal" : "text-foreground font-medium"
            )}
          >
            {notif.title}
          </span>
        </div>

        {/* Description snippet */}
        {notif.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {notif.description}
          </p>
        )}

        {/* Meta row: Category · Timestamp */}
        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground/75">
          <span className="font-medium text-foreground/80">{categoryLabel}</span>
          <span>·</span>
          <span className="font-mono">{relativeTime(notif.timestamp, t)}</span>
          {notif.targetTab && (
            <span className="text-[10px] text-primary hidden group-hover:inline-flex items-center gap-0.5 ml-auto">
              {t("openDocument")} <ArrowRight className="size-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Action Slot (Top-Right): Quiet dot in idle, Quick action buttons on hover */}
      <div
        className="absolute top-2.5 right-2.5 flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Idle unread indicator dot */}
        {!notif.read && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 transition-opacity group-hover:hidden pointer-events-none" />
        )}

        {/* Hover action buttons (clean 18px icons, zero overlap) */}
        <div className="hidden group-hover:flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => onToggleRead(notif.id, e)}
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={notif.read ? t("markUnread") : t("markRead")}
                >
                  {notif.read ? <CircleDot className="size-3" /> : <Check className="size-3 text-primary" />}
                </Button>
              }
            />
            <TooltipContent side="top" className="text-[10px]">
              {notif.read ? t("markUnread") : t("markRead")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => onDismiss(notif.id, e)}
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={t("dismiss")}
                >
                  <X className="size-3" />
                </Button>
              }
            />
            <TooltipContent side="top" className="text-[10px]">
              {t("dismiss")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Notification Rules Settings View ─────────────────────────────────

interface RulesSettingsViewProps {
  onBack: () => void;
}

function RulesSettingsView({ onBack }: RulesSettingsViewProps) {
  const t = useTranslations("NotificationPanel");
  const { notificationRules, updateNotificationRules } = useWorkspaceStore();

  const handleToggle = (key: keyof typeof notificationRules) => {
    updateNotificationRules({ [key]: !notificationRules[key] });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          <span>{t("rulesTitle")}</span>
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t("rulesDesc")}
      </p>

      <div className="space-y-2 pt-1">
        <label className="flex items-start gap-2.5 p-2 rounded border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={notificationRules.woDeadlineEnabled}
            onChange={() => handleToggle("woDeadlineEnabled")}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
          />
          <div className="space-y-0.5">
            <span className="font-medium text-foreground block">{t("ruleWoDeadline")}</span>
            <span className="text-[10px] text-muted-foreground block font-mono">
              7 kun qolganda yoki muddati o'tganda (WOOF)
            </span>
          </div>
        </label>

        <label className="flex items-start gap-2.5 p-2 rounded border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={notificationRules.stockLowEnabled}
            onChange={() => handleToggle("stockLowEnabled")}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
          />
          <div className="space-y-0.5">
            <span className="font-medium text-foreground block">{t("ruleStockLow")}</span>
            <span className="text-[10px] text-muted-foreground block font-mono">
              Qoldiq minimal nuqtadan (reorder point) tushganda
            </span>
          </div>
        </label>

        <label className="flex items-start gap-2.5 p-2 rounded border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={notificationRules.financeDocsEnabled}
            onChange={() => handleToggle("financeDocsEnabled")}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
          />
          <div className="space-y-0.5">
            <span className="font-medium text-foreground block">{t("ruleFinanceDocs")}</span>
            <span className="text-[10px] text-muted-foreground block font-mono">
              Schet-fakturalar (SF) va rasmiylashtirilgan to'lovlar
            </span>
          </div>
        </label>

        <label className="flex items-start gap-2.5 p-2 rounded border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={notificationRules.woStatusEnabled}
            onChange={() => handleToggle("woStatusEnabled")}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
          />
          <div className="space-y-0.5">
            <span className="font-medium text-foreground block">{t("ruleWoStatus")}</span>
            <span className="text-[10px] text-muted-foreground block font-mono">
              Yangi buyurtmalar va ishlab chiqarish bosqichlari
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── Main Notification Panel ──────────────────────────────────────────────────

export function NotificationPanel() {
  const t = useTranslations("NotificationPanel");
  const {
    notifications,
    isNotifPanelOpen,
    setNotifPanelOpen,
    loadNotifications,
    markNotificationRead,
    toggleNotificationRead,
    markAllRead,
    dismissNotification,
    clearAllNotifications,
    openTab,
    setActiveModule,
    setModule,
  } = useWorkspaceStore();

  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "critical">("all");
  const [showSettings, setShowSettings] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Background polling: har 60 soniyada yangilab turish
  useEffect(() => {
    loadNotifications();
    const timer = setInterval(() => {
      loadNotifications();
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    if (activeFilter === "critical") {
      return notifications.filter((n) => n.severity === "error" || n.severity === "warning");
    }
    return notifications;
  }, [notifications, activeFilter]);

  // 1-Klikda Hujjatni Ochish (Deep-Linking)
  const handleOpenNotification = useCallback(
    (notif: AppNotification) => {
      // 1. O'qilgan deb belgilash
      markNotificationRead(notif.id, true);
      setNotifPanelOpen(false);

      // 2. To'g'ridan-to'g'ri Workspace Document Tab ochish
      if (notif.targetTab) {
        openTab(notif.targetTab);
        return;
      }

      // 3. Fallback: modul va submodulga o'tish
      if (notif.link) {
        setActiveModule(notif.link.module);
        setModule(notif.link.module, notif.link.subModule);
      }
    },
    [markNotificationRead, setNotifPanelOpen, openTab, setActiveModule, setModule]
  );

  const handleToggleRead = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNotificationRead(id);
    },
    [toggleNotificationRead]
  );

  const handleDismiss = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      dismissNotification(id);
    },
    [dismissNotification]
  );

  const handleConfirmClear = () => {
    clearAllNotifications();
    setConfirmClearOpen(false);
  };

  return (
    <>
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
                    aria-label={`${t("title")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
                  >
                    <Bell className="size-3.5" />
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
            {t("title")}{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={6}
          className="w-[380px] p-0 gap-0 shadow-lg border-border bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <Bell className="size-3.5 text-foreground" />
              <span className="text-xs font-semibold text-foreground">{t("title")}</span>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-primary/20"
                >
                  {unreadCount}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={showSettings ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setShowSettings((prev) => !prev)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      aria-label={t("rulesTitle")}
                    >
                      <SlidersHorizontal className="size-3" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" className="text-[10px]">
                  {t("rulesTitle")}
                </TooltipContent>
              </Tooltip>

              {unreadCount > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAllRead()}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={t("markAllRead")}
                      >
                        <CheckCheck className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-[10px]">
                    {t("markAllRead")}
                  </TooltipContent>
                </Tooltip>
              )}

              {notifications.length > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmClearOpen(true)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={t("clearAll")}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-[10px]">
                    {t("clearAll")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Conditional: Settings View or Main Notification List */}
          {showSettings ? (
            <RulesSettingsView onBack={() => setShowSettings(false)} />
          ) : (
            <>
              {/* 3 Filter Tabs */}
              <div className="flex items-center px-3 py-1.5 gap-1.5 border-b border-border/60 bg-muted/10">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded transition-colors",
                    activeFilter === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {t("tabAll")}
                </button>
                <button
                  onClick={() => setActiveFilter("unread")}
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded transition-colors flex items-center gap-1",
                    activeFilter === "unread"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span>{t("tabUnread")}</span>
                  {unreadCount > 0 && (
                    <span className="font-mono text-[9px] px-1 rounded-full bg-background/20">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveFilter("critical")}
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded transition-colors",
                    activeFilter === "critical"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {t("tabCritical")}
                </button>
              </div>

              {/* Body */}
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-10 px-4 text-center text-muted-foreground">
                  <Bell className="size-7 opacity-20" />
                  <p className="text-xs font-medium text-foreground/80">{t("noNotifications")}</p>
                  <p className="text-[11px] text-muted-foreground/70 leading-normal max-w-[260px]">
                    {t("noNotificationsSub")}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[380px]">
                  <div>
                    {filteredNotifications.map((notif) => (
                      <NotifItem
                        key={notif.id}
                        notif={notif}
                        onOpen={handleOpenNotification}
                        onToggleRead={handleToggleRead}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Footer */}
              {notifications.length > 0 && (
                <>
                  <Separator />
                  <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono bg-muted/15">
                    <span>
                      {notifications.length} · {t("unreadCount", { count: unreadCount })}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead()}
                        className="text-primary hover:underline font-sans font-medium"
                      >
                        {t("markAllRead")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Confirmation Dialog for Clear All */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              {t("confirmClearTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t("confirmClearDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              onClick={handleConfirmClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
