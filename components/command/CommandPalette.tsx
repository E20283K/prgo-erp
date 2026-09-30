"use client";

import React from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { MODULE_NAV } from "@/lib/modules";
import { toggleAppFullscreen } from "@/lib/fullscreen";
import { 
  Sun, 
  Moon, 
  Maximize, 
  Plus, 
  FileText, 
  Table, 
  Layers, 
  X,
  Sparkles,
  ArrowRight,
  RefreshCw,
  LogOut,
  Bell,
} from "lucide-react";
import { useTranslations } from "next-intl";

export function CommandPalette() {
  const tCmd = useTranslations("CommandPalette");
  const tMod = useTranslations("Modules");
  const tCommon = useTranslations("Common");

  const {
    isCommandOpen,
    setCommandOpen,
    activeModule,
    setActiveModule,
    setModule,
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openTab,
    theme,
    toggleTheme,
    logout,
    notifications,
    setNotifPanelOpen,
    setAiChatOpen,
  } = useWorkspaceStore();

  const handleSelectModule = (modId: string) => {
    setActiveModule(modId);
    setCommandOpen(false);
  };

  const handleSelectSubItem = (modId: string, subId: string) => {
    setActiveModule(modId);
    setModule(modId, subId);
    setCommandOpen(false);
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setCommandOpen(false);
  };

  const handleNewOrder = () => {
    const newId = `WO-00${Math.floor(100 + Math.random() * 900)}`;
    openTab({
      id: newId,
      title: `${newId}: ${tCmd("newWorkOrder")}`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newId,
        customer: "Express Client",
        product: "Flyer A6 4+4",
        quantity: 5000,
        unit: "pcs",
        status: "Draft",
        priority: "Normal",
        pressMachine: "Heidelberg SX 74",
        startDate: "2026-09-30",
        deadline: "2026-10-03",
        paperStock: "130g Gloss",
        coating: "None",
        priceTotal: 290.0,
        currency: "USD",
      },
    });
    setCommandOpen(false);
  };

  const handleToggleTheme = () => {
    toggleTheme();
    setCommandOpen(false);
  };

  const handleToggleFullscreen = () => {
    toggleAppFullscreen();
    setCommandOpen(false);
  };

  const handleCloseActiveTab = () => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
    setCommandOpen(false);
  };

  return (
    <CommandDialog
      open={isCommandOpen}
      onOpenChange={setCommandOpen}
      title="PrintGoo ERP Command Palette"
      description="Fast travel across modules, menus, documents, and system actions"
    >
      <CommandInput placeholder={tCmd("placeholder")} />
      <CommandList className="max-h-[380px] overflow-y-auto">
        <CommandEmpty>{tCmd("emptyMessage")}</CommandEmpty>

        {/* 1. Quick System Actions */}
        <CommandGroup heading={tCmd("groupActions")}>
          <CommandItem onSelect={handleNewOrder} className="gap-2.5">
            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{tCmd("newWorkOrder")}</span>
            <CommandShortcut className="text-[10px]">Ins</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setCommandOpen(false);
              setTimeout(() => setNotifPanelOpen(true), 80);
            }}
            className="gap-2.5"
          >
            <Bell className="w-4 h-4 text-primary" />
            <span>Show Notifications</span>
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {notifications.filter((n) => !n.read).length} unread
              </span>
            )}
          </CommandItem>

          <CommandItem
            onSelect={() => {
              setCommandOpen(false);
              setTimeout(() => setAiChatOpen(true), 80);
            }}
            className="gap-2.5"
          >
            <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            <span className="font-medium">{tCmd("openAiCopilot")}</span>
            <CommandShortcut className="text-[10px]">Ctrl+J</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={handleToggleTheme} className="gap-2.5">
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-blue-500" />
            )}
            <span>{tCmd("toggleTheme")}</span>
          </CommandItem>
          <CommandItem onSelect={handleToggleFullscreen} className="gap-2.5">
            <Maximize className="w-4 h-4 text-primary" />
            <span>Toggle Fullscreen Mode</span>
            <CommandShortcut className="text-[10px]">F11</CommandShortcut>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setCommandOpen(false);
              window.dispatchEvent(new CustomEvent("app:sync-data"));
            }} 
            className="gap-2.5"
          >
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span>{tCmd("refreshAllData")}</span>
            <CommandShortcut className="text-[10px]">F5</CommandShortcut>
          </CommandItem>
          {activeTabId && (
            <CommandItem onSelect={handleCloseActiveTab} className="gap-2.5 text-destructive">
              <X className="w-4 h-4" />
              <span>{tCommon("close")}</span>
              <CommandShortcut className="text-[10px]">Ctrl+W</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem 
            onSelect={() => {
              setCommandOpen(false);
              logout();
            }} 
            className="gap-2.5 text-destructive"
          >
            <LogOut className="w-4 h-4" />
            <span>{tCmd("signOut")}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 2. Open Document Tabs */}
        {tabs.length > 0 && (
          <>
            <CommandGroup heading={tCmd("groupOpenTabs")}>
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const isRegistry = tab.type === "registry";
                return (
                  <CommandItem
                    key={tab.id}
                    onSelect={() => handleSelectTab(tab.id)}
                    className="gap-2.5"
                  >
                    {isRegistry ? (
                      <Table className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span className="flex-1 truncate">{tab.title}</span>
                    {isActive && (
                      <span className="text-[10px] uppercase font-bold text-primary tracking-wider bg-primary/10 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* 3. ERP Modules (Fast Travel) */}
        <CommandGroup heading={tCmd("groupNavigation")}>
          {MODULE_NAV.map((mod, index) => {
            const Icon = mod.icon;
            const isCurrent = activeModule === mod.id;
            const modLabel = tMod.has(mod.id) ? tMod(mod.id) : mod.label;
            return (
              <CommandItem
                key={mod.id}
                onSelect={() => handleSelectModule(mod.id)}
                className="gap-2.5"
              >
                <Icon className="w-4 h-4 text-primary" />
                <span className="flex-1 font-medium">{modLabel}</span>
                {isCurrent ? (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                    Current
                  </span>
                ) : (
                  <CommandShortcut className="text-[10px]">⌘{index + 1}</CommandShortcut>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* 4. Sub-Menus & Registries across all Modules */}
        <CommandGroup heading={tCmd("groupNavigation")}>
          {MODULE_NAV.flatMap((mod) =>
            mod.sections.flatMap((sec) =>
              sec.items.map((item) => {
                const ItemIcon = item.icon || Layers;
                const modLabel = tMod.has(mod.id) ? tMod(mod.id) : mod.label;
                const itemLabel = tMod.has(item.id) ? tMod(item.id) : item.label;
                return (
                  <CommandItem
                    key={`${mod.id}-${sec.id}-${item.id}`}
                    onSelect={() => handleSelectSubItem(mod.id, item.id)}
                    className="gap-2.5"
                  >
                    <ItemIcon className="w-4 h-4 text-muted-foreground" />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-muted-foreground text-xs">{modLabel}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                      <span className="font-medium truncate">{itemLabel}</span>
                    </div>
                  </CommandItem>
                );
              })
            )
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
