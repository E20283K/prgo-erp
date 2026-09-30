"use client";

import { useState, useEffect, useRef } from "react";
import { 
  RefreshCw, 
  Check, 
  FileText, 
  Sun, 
  Moon, 
  Maximize, 
  Minimize, 
  Search, 
  Sparkles 
} from "lucide-react";
import { useTranslations } from "next-intl";

import { getModule, getSubItemLabel } from "@/lib/modules";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toggleAppFullscreen, isAppFullscreen } from "@/lib/fullscreen";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export function Topbar() {
  const tTop = useTranslations("Topbar");
  const tMod = useTranslations("Modules");

  const { 
    activeModule, 
    currentModule, 
    currentSubModule, 
    tabs, 
    activeTabId, 
    theme, 
    setTheme,
    setCommandOpen,
    setAiChatOpen
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [isFullscreen, setIsFullscreen] = useState(false);
  type SyncState = "idle" | "loading" | "done";
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSync = () => {
    if (syncState !== "idle") return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncState("loading");

    // Phase 1: Spinning loader (1000ms)
    syncTimerRef.current = setTimeout(() => {
      // Phase 2: Done success checkmark (1000ms)
      setSyncState("done");

      // Toast notification
      toast.add({
        title: tTop("syncToastTitle"),
        description: tTop("syncToastDesc"),
        type: "success",
      });

      syncTimerRef.current = setTimeout(() => {
        // Phase 3: Return to first state (Reload/Sync icon)
        setSyncState("idle");
        syncTimerRef.current = null;
      }, 1000);
    }, 1000);
  };

  const handleSyncRef = useRef(handleSync);
  handleSyncRef.current = handleSync;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleSyncRef.current();
      }
    };

    const handleCustomSync = () => {
      handleSyncRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("app:sync-data", handleCustomSync);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("app:sync-data", handleCustomSync);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      const isHtml5Fs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      const isNativeFs = typeof window !== "undefined" && Boolean(window.screen && (window.screen.height - window.innerHeight) <= 5);
      setIsFullscreen(isHtml5Fs || isNativeFs);
    };

    handleUpdate();

    document.addEventListener("fullscreenchange", handleUpdate);
    document.addEventListener("webkitfullscreenchange", handleUpdate);
    window.addEventListener("resize", handleUpdate);

    return () => {
      document.removeEventListener("fullscreenchange", handleUpdate);
      document.removeEventListener("webkitfullscreenchange", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
    };
  }, []);

  // Localized human-readable labels
  const moduleDef = getModule(activeModule);
  const moduleLabel = tMod.has(activeModule) ? tMod(activeModule) : (moduleDef?.label ?? activeModule);
  const subItemLabel = tMod.has(currentSubModule) ? tMod(currentSubModule) : getSubItemLabel(currentModule, currentSubModule);

  return (
    <header className="h-11 border-b border-border bg-card flex items-center justify-between px-3 shrink-0 select-none z-10">
      {/* Level 2 Breadcrumb Navigation with Sidebar Toggle */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                {moduleLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {activeTab && activeTab.type !== "registry" ? (
                <BreadcrumbLink className="text-muted-foreground">
                  {subItemLabel}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-muted-foreground font-normal">
                  {subItemLabel}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {activeTab && activeTab.type !== "registry" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-primary flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    <span>{activeTab.documentData?.docNo || activeTab.title}</span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right Utility actions */}
      <div className="flex items-center gap-1.5">
        {/* Command Palette Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-1.5 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 border-border/40 font-normal"
          title={tTop("commandsTitle")}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium hidden md:inline">{tTop("commands")}</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-background px-1 font-mono text-[9px] font-semibold text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        {/* Dark & Light mode switcher */}
        <div className="flex items-center gap-1.5 px-1 py-0.5 rounded text-xs select-none" title={tTop("toggleTheme")}>
          <Sun className={`w-3.5 h-3.5 transition-colors ${theme === "light" ? "text-amber-500 font-bold" : "text-muted-foreground/40"}`} />
          <Switch 
            checked={theme === "dark"} 
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            aria-label={tTop("toggleTheme")}
            size="sm"
          />
          <Moon className={`w-3.5 h-3.5 transition-colors ${theme === "dark" ? "text-blue-400 font-bold" : "text-muted-foreground/40"}`} />
        </div>

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        {/* Language Switcher */}
        <LanguageSwitcher />

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSync}
          disabled={syncState !== "idle"}
          className={cn(
            "h-7 w-7 p-0 transition-all duration-200",
            syncState === "done"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
              : syncState === "loading"
              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 cursor-wait"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={
            syncState === "loading"
              ? tTop("syncingData")
              : syncState === "done"
              ? tTop("syncComplete")
              : tTop("syncData")
          }
          aria-label={
            syncState === "loading"
              ? tTop("syncingData")
              : syncState === "done"
              ? tTop("syncComplete")
              : tTop("syncData")
          }
        >
          {syncState === "loading" ? (
            <Spinner className="size-3.5 text-blue-600 dark:text-blue-400" />
          ) : syncState === "done" ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5] animate-in zoom-in-50 duration-150" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleAppFullscreen}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          title={isFullscreen ? tTop("exitFullscreen") : tTop("enterFullscreen")}
          aria-label={isFullscreen ? tTop("exitFullscreen") : tTop("enterFullscreen")}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5" />
          ) : (
            <Maximize className="w-3.5 h-3.5" />
          )}
        </Button>

        {/* AI Copilot Trigger */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAiChatOpen(true)}
          className="h-7 w-7 p-0 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
          title={tTop("openAiCopilot")}
          aria-label="Open AI Copilot"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </Button>

        <NotificationPanel />
      </div>
    </header>
  );
}
