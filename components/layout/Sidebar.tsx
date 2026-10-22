"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronsUpDown,
  Sparkles,
  Check,
  Search,
  Sun,
  Moon,
  Maximize,
  Minimize,
  Settings2,
  Terminal,
  Code2,
  Copy,
  ExternalLink,
  Crosshair,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toggleAppFullscreen } from "@/lib/fullscreen";
import { MODULE_NAV } from "@/lib/modules";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveActiveComponent } from "@/lib/dev/componentRegistry";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
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
  trading:    "bg-indigo-600",
  sales:      "bg-emerald-600",
  warehouse:  "bg-amber-600",
  finance:    "bg-rose-600",
  hr:         "bg-teal-600",
  settings:   "bg-zinc-600",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const tSide = useTranslations("Sidebar");
  const tMod = useTranslations("Modules");

  const {
    activeModule,
    currentSubModule,
    setActiveModule,
    setModule,
    openTab,
    setCommandOpen,
    theme,
    setTheme,
    toggleTheme,
    setAiChatOpen,
    showStatusBar,
    setShowStatusBar,
    isInspectorActive,
    setInspectorActive,
    lastInspectedElement,
    tabs,
    activeTabId,
    currentUser,
  } = useWorkspaceStore();

  // Filter modules based on user permissions
  const allowedModules = React.useMemo(() => {
    if (!currentUser || currentUser.role === "admin" || !currentUser.permissions) {
      return MODULE_NAV;
    }
    return MODULE_NAV.filter((mod) => {
      const perm = (currentUser.permissions as any)?.[mod.id];
      return perm ? perm.view === true : true;
    });
  }, [currentUser]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const resolvedComponent = resolveActiveComponent(activeTab, activeModule, currentSubModule);
  const [copiedPath, setCopiedPath] = React.useState(false);
  const [copiedInspected, setCopiedInspected] = React.useState(false);

  const handleCopyComponentPath = () => {
    navigator.clipboard.writeText(resolvedComponent.relativePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleOpenInVsCode = () => {
    window.open(resolvedComponent.vscodeUrl, "_blank");
  };

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isMac, setIsMac] = React.useState(false);
  const [moduleMenuOpen, setModuleMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

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

  // Resolve the currently active module definition
  const activeMod = allowedModules.find((m) => m.id === activeModule) ?? allowedModules[0] ?? MODULE_NAV[0];
  const ActiveModIcon = activeMod.icon;
  const activeModColor = MODULE_COLORS[activeMod.id] ?? "bg-zinc-600";
  const activeModLabel = tMod.has(activeMod.id) ? tMod(activeMod.id) : activeMod.label;

  const handleModuleSelect = (modId: string) => {
    setModuleMenuOpen(false);
    const mod = allowedModules.find((m) => m.id === modId) ?? MODULE_NAV.find((m) => m.id === modId);
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

  React.useEffect(() => {
    if (allowedModules.length > 0 && !allowedModules.some((m) => m.id === activeModule)) {
      handleModuleSelect(allowedModules[0].id);
    }
  }, [allowedModules, activeModule]);

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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex flex-col h-full w-full min-h-0">
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
            <DropdownMenu open={moduleMenuOpen} onOpenChange={setModuleMenuOpen}>
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

              <DropdownMenuContent
                className="w-64 rounded-lg"
                side="right"
                align="start"
                sideOffset={8}
                onKeyDown={(e) => {
                  const codeMatch = e.code.match(/^(?:Digit|Numpad)([1-6])$/);
                  const keyMatch = e.key.match(/^[1-6]$/);
                  const digit = codeMatch ? parseInt(codeMatch[1], 10) : (keyMatch ? parseInt(keyMatch[0], 10) : null);
                  if (digit !== null && digit >= 1 && digit <= allowedModules.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleModuleSelect(allowedModules[digit - 1].id);
                  }
                }}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {tSide("modules")}
                  </DropdownMenuLabel>
                  {allowedModules.map((mod, index) => {
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
                        <Kbd className="ml-auto opacity-75 bg-muted border-muted-foreground/20 text-[10px]">
                          {isMac ? `⌥${index + 1}` : `Alt+${index + 1}`}
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
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 truncate" title={activeModLabel}>
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
                      <span className="flex-1 min-w-0 truncate text-left font-medium" title={sectionName}>
                        {sectionName}
                      </span>
                      <ChevronRight className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          const itemName = tMod.has(item.id) ? tMod(item.id) : item.label;
                          return (
                            <SidebarMenuSubItem key={item.id} className="w-full min-w-0">
                              <SidebarMenuSubButton
                                render={<button type="button" />}
                                isActive={currentSubModule === item.id}
                                onClick={() => handleSubItemClick(item.id, item.label)}
                                className="w-full cursor-pointer"
                                title={itemName}
                              >
                                {ItemIcon && <ItemIcon className="size-3.5 shrink-0" />}
                                <span className="flex-1 min-w-0 truncate text-left">{itemName}</span>
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
    </div>
  </ContextMenuTrigger>

        <ContextMenuContent className="w-64 text-xs font-sans">
          <ContextMenuLabel className="font-semibold text-[11px] text-muted-foreground flex items-center justify-between py-1.5 px-2">
            <span className="flex items-center gap-1.5">
              <Terminal className="size-3.5 text-blue-500" />
              <span>Developer & View Options</span>
            </span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
              HUD
            </span>
          </ContextMenuLabel>

          <ContextMenuSeparator />

          <ContextMenuCheckboxItem
            checked={showStatusBar}
            onCheckedChange={(checked) => setShowStatusBar(checked)}
            className="cursor-pointer py-1.5"
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium text-foreground">Developer Status Bar</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {showStatusBar ? "Enabled" : "Disabled"}
              </span>
            </div>
          </ContextMenuCheckboxItem>

          <ContextMenuCheckboxItem
            checked={isInspectorActive}
            onCheckedChange={(checked) => setInspectorActive(checked)}
            className="cursor-pointer py-1.5"
          >
            <div className="flex items-center justify-between w-full gap-2">
              <span className="flex items-center gap-1.5 font-medium text-cyan-500 dark:text-cyan-400">
                <Crosshair className="size-3.5 shrink-0" />
                <span>Inspect Element (AI)</span>
              </span>
              <Kbd className="text-[9px]">Ctrl+Shift+C</Kbd>
            </div>
          </ContextMenuCheckboxItem>

          {lastInspectedElement && (
            <>
              <ContextMenuSeparator />
              <ContextMenuLabel className="text-[10px] text-cyan-500 dark:text-cyan-400 uppercase tracking-wider py-0.5 px-2 font-mono">
                Last Inspected (AI Context)
              </ContextMenuLabel>
              <ContextMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(lastInspectedElement.aiPromptText);
                  setCopiedInspected(true);
                  setTimeout(() => setCopiedInspected(false), 2000);
                }}
                className="gap-2 cursor-pointer py-1.5"
              >
                {copiedInspected ? (
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Copy className="size-3.5 text-cyan-500 shrink-0" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate font-mono text-[11px] font-semibold text-foreground">
                    {lastInspectedElement.fileName}:{lastInspectedElement.lineRangeLabel}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground font-mono">
                    {copiedInspected
                      ? "Copied AI context!"
                      : `${lastInspectedElement.componentName} · ${lastInspectedElement.elementLabel}`}
                  </span>
                </div>
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />

          <ContextMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider py-0.5 px-2 font-mono">
            Active Component Module (.tsx)
          </ContextMenuLabel>

          <ContextMenuItem
            onClick={handleCopyComponentPath}
            className="gap-2 cursor-pointer py-1.5"
          >
            {copiedPath ? (
              <Check className="size-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="size-3.5 text-emerald-500 shrink-0" />
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate font-mono text-[11px] font-semibold text-foreground">
                {resolvedComponent.fileName}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {copiedPath
                  ? "Copied to clipboard!"
                  : `${resolvedComponent.linesOfCode.toLocaleString()} lines · Copy path`}
              </span>
            </div>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handleOpenInVsCode}
            className="gap-2 cursor-pointer py-1.5"
          >
            <ExternalLink className="size-3.5 text-blue-500 shrink-0" />
            <span className="flex-1">Open in VS Code</span>
            <Kbd className="text-[9px]">vscode://</Kbd>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => toggleTheme()}
            className="gap-2 cursor-pointer py-1.5"
          >
            {theme === "dark" ? (
              <Sun className="size-3.5 text-amber-500" />
            ) : (
              <Moon className="size-3.5 text-blue-400" />
            )}
            <span>{theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => toggleAppFullscreen()}
            className="gap-2 cursor-pointer py-1.5"
          >
            {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
            <span>Toggle Fullscreen</span>
            <Kbd className="ml-auto text-[9px]">F11</Kbd>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => setCommandOpen(true)}
            className="gap-2 cursor-pointer py-1.5"
          >
            <Search className="size-3.5 text-muted-foreground" />
            <span>Command Palette</span>
            <Kbd className="ml-auto text-[9px]">⌘K</Kbd>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => setAiChatOpen(true)}
            className="gap-2 cursor-pointer py-1.5"
          >
            <Sparkles className="size-3.5 text-purple-400" />
            <span>AI Copilot Assistant</span>
            <Kbd className="ml-auto text-[9px]">⌘J</Kbd>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <SidebarRail />
    </Sidebar>
  );
}

export { AppSidebar as Sidebar };
