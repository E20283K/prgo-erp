"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { X, FileText, Table, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { WorkOrderDetail } from "@/components/documents/WorkOrderDetail";
import { CreateOrderDialog } from "@/components/documents/CreateOrderDialog";
import { ProductSpecDetail } from "@/components/documents/ProductSpecDetail";

export function Workspace({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Workspace");
  const tMod = useTranslations("Modules");
    const { tabs, activeTabId, setActiveTab, closeTab, openTab, setCreateOrderOpen } = useWorkspaceStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const getTabTitle = (tab: DocumentTab) => {
    if (tab.id === "registry-work-orders") {
      return `${tMod("work-orders")} (${tMod("registry")})`;
    }
    if (tab.id.startsWith("tab-")) {
      const parts = tab.id.split("-");
      const subId = parts.slice(2).join("-");
      if (subId && tMod.has(subId)) {
        return tMod(subId);
      }
    }
    return tab.title;
  };

  const handleCloseOthers = (keepId: string) => {
    tabs.forEach((t) => {
      if (t.id !== keepId) closeTab(t.id);
    });
  };

  const handleCloseToRight = (tabId: string) => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx !== -1) {
      tabs.slice(idx + 1).forEach((t) => closeTab(t.id));
    }
  };

  const handleNewQuickTab = () => {
    setCreateOrderOpen(true);
  };

  return (
    <TooltipProvider delay={300}>
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
        <CreateOrderDialog />
      
      {/* VS Code + 1C Document Tab Bar */}
      <div className="flex items-end h-9 bg-zinc-200/90 dark:bg-zinc-950 px-1.5 gap-1 overflow-x-auto shrink-0 border-b border-zinc-300 dark:border-zinc-800 select-none [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab, idx) => {
          const isActive = activeTabId === tab.id;
          const isRegistry = tab.type === "registry";
          const showSeparator = idx < tabs.length - 1;

          return (
            <React.Fragment key={tab.id}>
              <ContextMenu>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <ContextMenuTrigger asChild>
                        <div
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "group flex items-center gap-1.5 px-2 h-8 w-[125px] rounded-t-md text-xs cursor-pointer select-none border-t border-x relative transition-all duration-150 ease-in-out",
                            isActive
                              ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 border-zinc-300 dark:border-zinc-800 font-medium shadow-xs"
                              : "bg-zinc-200/60 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-white/70 dark:hover:bg-zinc-900/70 hover:text-zinc-950 dark:hover:text-zinc-100 hover:border-zinc-300/60 dark:hover:border-zinc-800/60 hover:shadow-xs"
                          )}
                        >
                          {/* Top blue accent bar on active tab */}
                          {isActive ? (
                            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-blue-600 dark:bg-blue-500 rounded-t-md pointer-events-none" />
                          ) : (
                            /* Subtle hover accent preview */
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500/40 rounded-t-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          )}

                          {isRegistry ? (
                            <Table className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          )}

                          <span className="truncate flex-1 text-xs leading-tight font-sans tracking-tight max-w-[10ch]">
                            {getTabTitle(tab)}
                          </span>

                          {tab.isUnsaved && (
                            <span 
                              className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" 
                              title={t("unsavedChanges")} 
                            />
                          )}

                          {/* Close Tab Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className={cn(
                              "p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors",
                              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                            title={`${t("close")} (Ctrl+W)`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </ContextMenuTrigger>
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={6} className="text-xs z-50">
                    {getTabTitle(tab)}
                  </TooltipContent>
                </Tooltip>

                <ContextMenuContent className="text-xs">
                  <ContextMenuItem onClick={() => closeTab(tab.id)}>
                    {t("close")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleCloseOthers(tab.id)}>
                    {t("closeOthers")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleCloseToRight(tab.id)}>
                    {t("closeToRight")}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => navigator.clipboard.writeText(tab.id)}>
                    {t("copyDocId")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              {showSeparator && (
                <Separator
                  orientation="vertical"
                  className="h-4 data-vertical:h-4 self-center data-vertical:self-center bg-zinc-300 dark:bg-zinc-800 shrink-0 mx-0.5"
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Quick New Document Tab button */}
        <button
          onClick={handleNewQuickTab}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-zinc-300/80 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 ml-0.5 mb-0.5 transition-colors cursor-pointer"
          title={t("openNewOrder")}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>


      {/* Main Workspace Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab && activeTab.type === "work-order" ? (
          <WorkOrderDetail key={activeTab.id} tab={activeTab} />
        ) : activeTab && activeTab.type === "product-spec" ? (
          <ProductSpecDetail key={activeTab.id} tab={activeTab} />
        ) : (
          children
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
