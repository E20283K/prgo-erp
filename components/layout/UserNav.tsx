"use client";

import * as React from "react";
import {
  Sparkles,
  BadgeCheck,
  LogOut,
  Check,
  Sun,
  Moon,
  Maximize,
  Minimize,
  Globe,
  Settings2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { toggleAppFullscreen } from "@/lib/fullscreen";
import { MODULE_NAV } from "@/lib/modules";
import { useWorkspaceStore } from "@/store/workspaceStore";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "tr", label: "Türkçe", short: "TR" },
] as const;

export function UserNav() {
  const tSide = useTranslations("Sidebar");
  const tMod = useTranslations("Modules");
  const tAuth = useTranslations("Auth");
  const tTop = useTranslations("Topbar");
  const tLang = useTranslations("LanguageSwitcher");

  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const {
    currentUser,
    logout,
    theme,
    setTheme,
    setAiChatOpen,
    setActiveModule,
    setModule,
    openTab,
  } = useWorkspaceStore();

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleUpdate = () => {
      const isHtml5Fs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      const isNativeFs =
        typeof window !== "undefined" &&
        Boolean(window.screen && window.screen.height - window.innerHeight <= 5);
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

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  const getRoleLabel = (role: string) => {
    if (role === "Production Shift Lead" && tAuth.has("roleShiftLead")) return tAuth("roleShiftLead");
    if ((role === "Commercial & Order Manager" || role === "Sales & Client Director") && tAuth.has("roleSalesDirector")) return tAuth("roleSalesDirector");
    if (role === "System Administrator" && tAuth.has("roleSysAdmin")) return tAuth("roleSysAdmin");
    return role;
  };

  const handleOpenSettings = () => {
    setActiveModule("settings");
    const mod = MODULE_NAV.find((m) => m.id === "settings");
    const firstItem = mod?.sections[0]?.items[0];
    if (firstItem) {
      const itemLabel = tMod.has(firstItem.id) ? tMod(firstItem.id) : firstItem.label;
      setModule("settings", firstItem.id);
      openTab({
        id: `tab-settings-${firstItem.id}`,
        title: itemLabel,
        type: "registry",
        module: "settings",
      });
    }
  };

  const handleOpenUsersAndRoles = () => {
    setActiveModule("settings");
    const label = tMod.has("users") ? tMod("users") : "Users & Roles";
    setModule("settings", "users");
    openTab({
      id: "tab-settings-users",
      title: label,
      type: "registry",
      module: "settings",
    });
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="relative flex items-center justify-center size-7 rounded-full hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shrink-0"
                  aria-label={`${currentUser.name} - ${getRoleLabel(currentUser.role)}`}
                />
              }
            >
              <Avatar size="sm" className="size-7">
                {currentUser.avatar && (
                  <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                )}
                <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                  {currentUser.initials}
                </AvatarFallback>
                <AvatarBadge className="bg-emerald-500" />
              </Avatar>
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          <p className="font-semibold">{currentUser.name}</p>
          <p className="text-[10px] text-muted-foreground">{getRoleLabel(currentUser.role)}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="w-60 rounded-lg text-xs">
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
              <div className="grid flex-1 text-left leading-tight min-w-0">
                <span className="truncate font-semibold text-foreground text-sm">
                  {currentUser.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {getRoleLabel(currentUser.role)}
                </span>
                <span className="truncate text-[10px] text-muted-foreground/80 font-mono">
                  {currentUser.email}
                </span>
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
            className="gap-2.5 cursor-pointer text-xs"
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-amber-500" />
            ) : (
              <Moon className="size-4 text-blue-500" />
            )}
            <span>
              {theme === "dark"
                ? tTop.has("switchToLight")
                  ? tTop("switchToLight")
                  : "Switch to Light Mode"
                : tTop.has("switchToDark")
                  ? tTop("switchToDark")
                  : "Switch to Dark Mode"}
            </span>
          </DropdownMenuItem>

          {/* Language Sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2.5 cursor-pointer text-xs">
              <Globe className="size-4 text-muted-foreground" />
              <span>{tLang.has("title") ? tLang("title") : "Language"}</span>
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
                  <span>{tLang.has(lang.code as any) ? tLang(lang.code as any) : lang.label}</span>
                  {locale === lang.code && <Check className="size-3.5 text-primary ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Fullscreen */}
          <DropdownMenuItem
            onClick={toggleAppFullscreen}
            className="gap-2.5 cursor-pointer text-xs"
          >
            {isFullscreen ? (
              <Minimize className="size-4 text-muted-foreground" />
            ) : (
              <Maximize className="size-4 text-muted-foreground" />
            )}
            <span>
              {isFullscreen
                ? tTop.has("exitFullscreen")
                  ? tTop("exitFullscreen")
                  : "Exit Fullscreen"
                : tTop.has("enterFullscreen")
                  ? tTop("enterFullscreen")
                  : "Enter Fullscreen"}
            </span>
            <Kbd className="ml-auto text-[10px]">F11</Kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* AI Copilot */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => setAiChatOpen(true)}
            className="gap-2.5 cursor-pointer text-xs"
          >
            <Sparkles className="size-4 text-purple-500" />
            <span>{tTop.has("openAiCopilot") ? tTop("openAiCopilot") : "AI Copilot"}</span>
            <Kbd className="ml-auto text-[10px]">⌘J</Kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Account & Settings */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleOpenUsersAndRoles}
            className="gap-2.5 cursor-pointer text-xs"
          >
            <BadgeCheck className="size-4 text-muted-foreground" />
            <span>{tSide.has("accountDetails") ? tSide("accountDetails") : "Account details"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleOpenSettings}
            className="gap-2.5 cursor-pointer text-xs"
          >
            <Settings2 className="size-4 text-muted-foreground" />
            <span>{tMod.has("settings") ? tMod("settings") : "Settings"}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          onClick={() => logout()}
          className="gap-2.5 text-destructive focus:text-destructive cursor-pointer text-xs"
        >
          <LogOut className="size-4" />
          <span>{tSide.has("logout") ? tSide("logout") : "Log out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
