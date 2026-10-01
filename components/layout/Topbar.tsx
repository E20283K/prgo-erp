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
  Sparkles,
  Globe,
  LogOut,
  BadgeCheck,
  Settings2,
  ChevronRight,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

import { getModule, getSubItemLabel } from "@/lib/modules";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { Avatar, AvatarFallback, AvatarImage, AvatarBadge } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toggleAppFullscreen } from "@/lib/fullscreen";
import { NotificationPanel } from "@/components/layout/NotificationPanel";

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "tr", label: "Türkçe", short: "TR" },
] as const;

export function Topbar() {
  const tTop = useTranslations("Topbar");
  const tMod = useTranslations("Modules");
  const tSide = useTranslations("Sidebar");
  const tLang = useTranslations("LanguageSwitcher");

  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const { 
    activeModule, 
    currentModule, 
    currentSubModule, 
    tabs, 
    activeTabId, 
    theme, 
    setTheme,
    setCommandOpen,
    setAiChatOpen,
    currentUser,
    logout,
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

    syncTimerRef.current = setTimeout(() => {
      setSyncState("done");

      toast.add({
        title: tTop("syncToastTitle"),
        description: tTop("syncToastDesc"),
        type: "success",
      });

      syncTimerRef.current = setTimeout(() => {
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

  const handleLanguageSelect = (nextLocale: string) => {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  };

  const getRoleLabel = (role: string) => {
    if (role === "Production Shift Lead") return tSide.has("roleShiftLead") ? tSide("roleShiftLead" as any) : role;
    if (role === "Sales & Client Director") return tSide.has("roleSalesDirector") ? tSide("roleSalesDirector" as any) : role;
    if (role === "System Administrator") return tSide.has("roleSysAdmin") ? tSide("roleSysAdmin" as any) : role;
    return role;
  };

  // Localized human-readable labels
  const moduleDef = getModule(activeModule);
  const moduleLabel = tMod.has(activeModule) ? tMod(activeModule) : (moduleDef?.label ?? activeModule);
  const subItemLabel = tMod.has(currentSubModule) ? tMod(currentSubModule) : getSubItemLabel(currentModule, currentSubModule);

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

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

      {/* Right: Command Search + Notification + Avatar */}
      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandOpen(true)}
                className="flex items-center gap-1.5 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 border-border/40 font-normal"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium hidden md:inline">{tTop("commands")}</span>
              </Button>
            }
          />
          <TooltipContent className="flex items-center gap-2">
            <span>{tTop("commandsTitle")}</span>
            <Kbd>⌘K</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Notification Panel */}
        <NotificationPanel />

        {/* Avatar Dropdown — houses theme, language, fullscreen, AI, logout */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
            <Avatar className="size-7">
              {currentUser.avatar && (
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              )}
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {currentUser.initials}
              </AvatarFallback>
              <AvatarBadge className="bg-emerald-500" />
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-lg">
            {/* User Info Header */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                  <Avatar className="size-9">
                    {currentUser.avatar && (
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    )}
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {currentUser.initials}
                    </AvatarFallback>
                    <AvatarBadge className="bg-emerald-500" />
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold text-foreground text-sm">{currentUser.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{currentUser.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            {/* Appearance & Preferences */}
            <DropdownMenuGroup>
              {/* Theme Toggle */}
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="gap-2.5 cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="size-4 text-amber-500" />
                ) : (
                  <Moon className="size-4 text-blue-500" />
                )}
                <span>{theme === "dark" ? tTop("switchToLight") : tTop("switchToDark")}</span>
              </DropdownMenuItem>

              {/* Language Sub-menu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2.5 cursor-pointer">
                  <Globe className="size-4 text-muted-foreground" />
                  <span>{tLang("title")}</span>
                  <span className="ml-auto text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {currentLang.short}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36">
                  {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => handleLanguageSelect(lang.code)}
                      className="flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span>{tLang(lang.code as any) || lang.label}</span>
                      {locale === lang.code && <Check className="size-3.5 text-primary ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Fullscreen */}
              <DropdownMenuItem
                onClick={toggleAppFullscreen}
                className="gap-2.5 cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize className="size-4 text-muted-foreground" />
                ) : (
                  <Maximize className="size-4 text-muted-foreground" />
                )}
                <span>{isFullscreen ? tTop("exitFullscreen") : tTop("enterFullscreen")}</span>
                <Kbd className="ml-auto">F11</Kbd>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* AI Copilot */}
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setAiChatOpen(true)}
                className="gap-2.5 cursor-pointer"
              >
                <Sparkles className="size-4 text-purple-500" />
                <span>{tTop("openAiCopilot")}</span>
                <Kbd className="ml-auto">⌘J</Kbd>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Account & Logout */}
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2.5 cursor-pointer">
                <BadgeCheck className="size-4 text-muted-foreground" />
                <span>{tSide("accountDetails")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 cursor-pointer">
                <Settings2 className="size-4 text-muted-foreground" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="gap-2.5 text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>{tSide("logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
