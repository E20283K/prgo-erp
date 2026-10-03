"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronsUpDown,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  LogOut,
  Check,
  Search,
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
import { NotificationPanel } from "@/components/layout/NotificationPanel";
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";

// ─── Constants ────────────────────────────────────────────────────────────────

// Module accent colours — used for the icon tile background
const MODULE_COLORS: Record<string, string> = {
  production: "bg-blue-600",
  crm:        "bg-violet-600",
  sales:      "bg-emerald-600",
  warehouse:  "bg-amber-600",
  finance:    "bg-rose-600",
  settings:   "bg-zinc-600",
};

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "tr", label: "Türkçe", short: "TR" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const tSide = useTranslations("Sidebar");
  const tMod = useTranslations("Modules");
  const tAuth = useTranslations("Auth");
  const tTop = useTranslations("Topbar");
  const tLang = useTranslations("LanguageSwitcher");

  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const {
    activeModule,
    currentSubModule,
    setActiveModule,
    setModule,
    openTab,
    currentUser,
    logout,
    setCommandOpen,
    theme,
    setTheme,
    setAiChatOpen,
  } = useWorkspaceStore();

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
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

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  const getRoleLabel = (role: string) => {
    if (role === "Production Shift Lead" && tAuth.has("roleShiftLead")) return tAuth("roleShiftLead");
    if (role === "Sales & Client Director" && tAuth.has("roleSalesDirector")) return tAuth("roleSalesDirector");
    if (role === "System Administrator" && tAuth.has("roleSysAdmin")) return tAuth("roleSysAdmin");
    return role;
  };

  // Resolve the currently active module definition
  const activeMod = MODULE_NAV.find((m) => m.id === activeModule) ?? MODULE_NAV[0];
  const ActiveModIcon = activeMod.icon;
  const activeModColor = MODULE_COLORS[activeMod.id] ?? "bg-zinc-600";
  const activeModLabel = tMod.has(activeMod.id) ? tMod(activeMod.id) : activeMod.label;

  const handleModuleSelect = (modId: string) => {
    const mod = MODULE_NAV.find((m) => m.id === modId);
    const firstItem = mod?.sections[0]?.items[0];
    const modLabel = tMod.has(modId) ? tMod(modId) : (mod?.label ?? modId);
    setActiveModule(modId);
    if (firstItem) {
      const itemLabel = tMod.has(firstItem.id) ? tMod(firstItem.id) : firstItem.label;
      setModule(modId, firstItem.id);
      openTab({
        id: firstItem.id === "work-orders" ? "registry-work-orders" : `tab-${modId}-${firstItem.id}`,
        title: firstItem.id === "work-orders" ? `${itemLabel} (${tMod("registry")})` : itemLabel,
        type: "registry",
        module: modId,
      });
    }
  };

  const handleSubItemClick = (subId: string, defaultLabel: string) => {
    const subLabel = tMod.has(subId) ? tMod(subId) : defaultLabel;
    setModule(activeMod.id, subId);
    openTab({
      id: subId === "work-orders" ? "registry-work-orders" : `tab-${activeMod.id}-${subId}`,
      title: subId === "work-orders" ? `${subLabel} (${tMod("registry")})` : subLabel,
      type: "registry",
      module: activeMod.id,
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar select-none" {...props}>

      {/* ── Header: Global Search & Module switcher ─────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <button 
              onClick={() => setCommandOpen(true)}
              className="w-full flex items-center gap-2 h-8 px-2 rounded-md bg-background/50 border border-sidebar-border text-xs text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer group/search"
            >
              <Search className="size-4 shrink-0" />
              <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden">
                {tSide.has("searchCommands") ? tSide("searchCommands") : "Search commands..."}
              </span>
              <Kbd className="group-data-[collapsible=icon]:hidden text-[10px] bg-sidebar-accent/50 border-none shadow-none">⌘K</Kbd>
            </button>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  />
                }
              >
                <div className={`flex aspect-square size-8 items-center justify-center rounded-lg ${activeModColor} text-white shadow-xs`}>
                  <ActiveModIcon className="size-4 text-white" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-sidebar-foreground">
                    {activeModLabel}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tSide("erpModule")}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-64 rounded-lg" side="right" align="start" sideOffset={8}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {tSide("modules")}
                  </DropdownMenuLabel>
                  {MODULE_NAV.map((mod, index) => {
                    const ModIcon = mod.icon;
                    const color = MODULE_COLORS[mod.id] ?? "bg-zinc-600";
                    const modName = tMod.has(mod.id) ? tMod(mod.id) : mod.label;
                    return (
                      <DropdownMenuItem
                        key={mod.id}
                        onClick={() => handleModuleSelect(mod.id)}
                        className="gap-2 p-2 cursor-pointer"
                      >
                        <div className={`flex size-6 items-center justify-center rounded-sm ${color} shrink-0`}>
                          <ModIcon className="size-3.5 text-white shrink-0" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">
                          {modName}
                        </span>
                        {mod.id === activeModule && (
                          <Check className="size-3.5 text-primary shrink-0" />
                        )}
                        <Kbd className="ml-auto opacity-60 bg-muted border-muted-foreground/20">
                          <span className="text-[11px]">⌘</span>{index + 1}
                        </Kbd>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content: Active module nav — changes when module is switched ── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2">
            {activeModLabel}
          </SidebarGroupLabel>
          <SidebarMenu>
            {activeMod.sections.map((section) => {
              const SectionIcon = section.icon;
              const sectionName = tMod.has(section.id) ? tMod(section.id) : section.label;
              return (
                <Collapsible
                  key={section.id}
                  defaultOpen={section.defaultOpen ?? false}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={sectionName}
                          isActive={section.items.some((i) => i.id === currentSubModule)}
                        />
                      }
                    >
                      {SectionIcon && <SectionIcon className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="font-medium">{sectionName}</span>
                      <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          const itemName = tMod.has(item.id) ? tMod(item.id) : item.label;
                          return (
                            <SidebarMenuSubItem key={item.id}>
                              <SidebarMenuSubButton
                                render={<button type="button" />}
                                isActive={currentSubModule === item.id}
                                onClick={() => handleSubItemClick(item.id, item.label)}
                                className="cursor-pointer"
                              >
                                {ItemIcon && <ItemIcon className="size-3.5 shrink-0" />}
                                <span>{itemName}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: Notifications & User Menu ──────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <div className="flex items-center group-data-[collapsible=icon]:flex-col gap-1 w-full">
            <div className="group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:mb-2 group-data-[collapsible=icon]:mt-1 flex items-center justify-center shrink-0 h-8 w-8 rounded-md hover:bg-sidebar-accent transition-colors">
              <NotificationPanel />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <Avatar className="size-8">
                    {currentUser.avatar && (
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    )}
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {currentUser.initials}
                    </AvatarFallback>
                    <AvatarBadge className="bg-emerald-500" />
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-sidebar-foreground">{currentUser.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{getRoleLabel(currentUser.role)}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-lg" align="end" side="top" sideOffset={4}>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="size-8">
                          {currentUser.avatar && (
                            <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                          )}
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {currentUser.initials}
                          </AvatarFallback>
                          <AvatarBadge className="bg-emerald-500" />
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold text-foreground">{currentUser.name}</span>
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
                      <span>{theme === "dark" ? (tTop.has("switchToLight") ? tTop("switchToLight") : "Switch to Light") : (tTop.has("switchToDark") ? tTop("switchToDark") : "Switch to Dark")}</span>
                    </DropdownMenuItem>

                    {/* Language Sub-menu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2.5 cursor-pointer">
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
                      className="gap-2.5 cursor-pointer"
                    >
                      {isFullscreen ? (
                        <Minimize className="size-4 text-muted-foreground" />
                      ) : (
                        <Maximize className="size-4 text-muted-foreground" />
                      )}
                      <span>{isFullscreen ? (tTop.has("exitFullscreen") ? tTop("exitFullscreen") : "Exit Fullscreen") : (tTop.has("enterFullscreen") ? tTop("enterFullscreen") : "Enter Fullscreen")}</span>
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
                      <span>{tTop.has("openAiCopilot") ? tTop("openAiCopilot") : "AI Copilot"}</span>
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
          </div>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export { AppSidebar as Sidebar };
