"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { X, FileText, Table, Plus, ChevronDown, Check, Layers, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { WorkOrderDetail } from "@/components/documents/WorkOrderDetail";
import { CreateWorkOrderPickerModal } from "@/components/documents/work-order/dialogs/CreateWorkOrderPickerModal";
import { ProductSpecDetail } from "@/components/documents/ProductSpecDetail";
import { ClientOrderDetail } from "@/components/documents/client-order/ClientOrderDetail";
import { SalesRecordDetail } from "@/components/documents/SalesRecordDetail";
import { DeliveryActDetail } from "@/components/documents/DeliveryActDetail";
import { CustomerDetail } from "@/components/documents/CustomerDetail";
import { WarehouseReceiptDetail } from "@/components/documents/WarehouseReceiptDetail";
import { PlanningSlotDetail } from "@/components/documents/PlanningSlotDetail";

import { TabContentWrapper } from "./TabContentWrapper";
import { RegistryGridRenderer } from "./RegistryGridRenderer";

export function Workspace({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Workspace");
  const tMod = useTranslations("Modules");
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeSavedTabs,
    closeAllDocumentTabs,
    openTab,
    activeModule,
    currentModule,
    isCreateWorkOrderOpen,
    setCreateWorkOrderOpen,
  } = useWorkspaceStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isPOSActive = activeTabId.includes("pos");

  const tabBarRef = React.useRef<HTMLDivElement>(null);
  const [maxVisibleTabs, setMaxVisibleTabs] = React.useState<number>(7);

  React.useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;

    const computeMaxTabs = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      // Reserve ~116px for sidebar trigger + quick new tab button + overflow dropdown trigger
      const availableForTabs = Math.max(200, width - 116);
      const calculated = Math.max(2, Math.floor(availableForTabs / 118));
      setMaxVisibleTabs(calculated);
    };

    computeMaxTabs();
    const observer = new ResizeObserver(computeMaxTabs);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Split tabs into visible in the bar vs overflown, guaranteeing activeTab is always visible
  const { visibleTabs, overflowTabs } = React.useMemo(() => {
    if (tabs.length <= maxVisibleTabs) {
      return { visibleTabs: tabs, overflowTabs: [] as DocumentTab[] };
    }
    const slice = tabs.slice(0, maxVisibleTabs);
    const rest = tabs.slice(maxVisibleTabs);
    const activeInRestIdx = rest.findIndex((t) => t.id === activeTabId);
    if (activeInRestIdx !== -1 && slice.length > 0) {
      const swappedOut = slice[slice.length - 1];
      const activeItem = rest[activeInRestIdx];
      const nextVisible = [...slice.slice(0, slice.length - 1), activeItem];
      const nextOverflow = [
        swappedOut,
        ...rest.filter((_, idx) => idx !== activeInRestIdx),
      ];
      return { visibleTabs: nextVisible, overflowTabs: nextOverflow };
    }
    return { visibleTabs: slice, overflowTabs: rest };
  }, [tabs, maxVisibleTabs, activeTabId]);

  const hasOverflowUnsaved = overflowTabs.some((t) => t.isUnsaved);
  const savedDocTabsCount = tabs.filter((t) => t.type !== "registry" && !t.isUnsaved).length;
  const docTabsCount = tabs.filter((t) => t.type !== "registry").length;

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
      if (t.id !== keepId && t.type !== "registry") closeTab(t.id);
    });
  };

  const handleCloseToRight = (tabId: string) => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx !== -1) {
      tabs.slice(idx + 1).forEach((t) => closeTab(t.id));
    }
  };

  const handleNewQuickTab = () => {
    const isProduction =
      activeModule === "production" ||
      currentModule === "production" ||
      activeTab?.module === "production" ||
      activeTab?.type === "work-order" ||
      activeTab?.id.includes("work-orders");

    if (isProduction) {
      setCreateWorkOrderOpen(true);
    } else {
      const newId = `NEW-CO-${Math.floor(Math.random() * 1000)}`;
      openTab({
        id: newId,
        title: "New Client Order",
        type: "client-order",
        module: "sales",
        isUnsaved: true,
        activeLevel3Tab: "overview",
        documentData: {
          docNo: newId,
          status: "Draft",
          quantity: 1000,
          unit: "pcs",
        },
      });
    }
  };

  const renderTabType = (tab: DocumentTab) => {
    if (tab.type === "work-order") return <WorkOrderDetail tab={tab} />;
    if (tab.type === "product-spec") return <ProductSpecDetail tab={tab} />;
    if (tab.type === "client-order") return <ClientOrderDetail tab={tab} />;
    if (tab.type === "sales-record") return <SalesRecordDetail tab={tab} />;
    if (tab.type === "delivery-act") return <DeliveryActDetail tab={tab} />;
    if (tab.type === "customer") return <CustomerDetail tab={tab} />;
    if (tab.type === "warehouse-receipt") return <WarehouseReceiptDetail tab={tab} />;
    if (tab.type === "planning-slot") return <PlanningSlotDetail tab={tab} />;
    if (tab.type === "registry") return <RegistryGridRenderer tab={tab} />;
    return null;
  };

  return (
    <TooltipProvider delay={300}>
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
        <CreateWorkOrderPickerModal
          isOpen={isCreateWorkOrderOpen}
          onOpenChange={setCreateWorkOrderOpen}
        />

        {/* VS Code + 1C Document Tab Bar (Fluid Widths, No Scrollbar, Overflow Dropdown) */}
        {!isPOSActive && (
          <div
            ref={tabBarRef}
            className="flex items-end h-9 bg-zinc-200/90 dark:bg-zinc-950 px-1.5 gap-1 overflow-hidden no-scrollbar shrink-0 border-b border-zinc-300 dark:border-zinc-800 select-none"
          >
            {/* Sidebar Toggle Button */}
            <div className="flex items-center self-center shrink-0 mr-0.5 gap-1">
              <SidebarTrigger className="h-7 w-7 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-300/80 dark:hover:bg-zinc-800 transition-colors" />
              <Separator orientation="vertical" className="h-4 bg-zinc-300 dark:bg-zinc-800" />
            </div>

            {/* Fluid Visible Tabs */}
            <div className="flex items-end flex-1 min-w-0 gap-1 overflow-hidden">
              {visibleTabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                const isRegistry = tab.type === "registry";
                const canClose = !(isRegistry && tabs.length === 1);

                return (
                  <ContextMenu key={tab.id}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <ContextMenuTrigger asChild>
                            <div
                              onClick={() => setActiveTab(tab.id)}
                              onAuxClick={(e) => {
                                if (e.button === 1 && canClose) {
                                  e.preventDefault();
                                  closeTab(tab.id);
                                }
                              }}
                              className={cn(
                                "group flex items-center gap-1.5 px-2.5 h-8 rounded-t-md text-xs cursor-pointer select-none border-t border-x relative transition-all duration-150 ease-in-out",
                                isActive || isRegistry
                                  ? "flex-1 min-w-[110px] max-w-[195px]"
                                  : "flex-1 min-w-[90px] max-w-[165px]",
                                isActive
                                  ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 border-zinc-300 dark:border-zinc-800 font-medium shadow-xs"
                                  : "bg-zinc-200/60 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 border-zinc-300/40 dark:border-zinc-800/40 hover:bg-white/70 dark:hover:bg-zinc-900/70 hover:text-zinc-950 dark:hover:text-zinc-100 hover:border-zinc-300/70 dark:hover:border-zinc-800/70"
                              )}
                            >
                              {/* Top blue accent bar on active tab */}
                              {isActive ? (
                                <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-blue-600 dark:bg-blue-500 rounded-t-md pointer-events-none" />
                              ) : (
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500/40 rounded-t-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                              )}

                              {isRegistry ? (
                                <Table className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              )}

                              <span className="truncate flex-1 min-w-0 text-xs leading-tight font-sans tracking-tight">
                                {getTabTitle(tab)}
                              </span>

                              {tab.isUnsaved && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                                  title={t("unsavedChanges")}
                                />
                              )}

                              {/* Close Tab Button */}
                              {canClose && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                  }}
                                  className={cn(
                                    "p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors shrink-0",
                                    isActive ? "flex" : "hidden group-hover:flex"
                                  )}
                                  title={`${t("close")} (Ctrl+W)`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </ContextMenuTrigger>
                        }
                      />
                      <TooltipContent side="bottom" sideOffset={6} className="text-xs z-50">
                        {getTabTitle(tab)}
                      </TooltipContent>
                    </Tooltip>

                    <ContextMenuContent className="text-xs w-48">
                      {canClose && (
                        <ContextMenuItem onClick={() => closeTab(tab.id)}>
                          {t("close")}
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem onClick={() => handleCloseOthers(tab.id)}>
                        {t("closeOthers")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCloseToRight(tab.id)}>
                        {t("closeToRight")}
                      </ContextMenuItem>
                      {savedDocTabsCount > 0 && (
                        <ContextMenuItem onClick={closeSavedTabs}>
                          {t("closeSaved")}
                        </ContextMenuItem>
                      )}
                      {docTabsCount > 0 && (
                        <ContextMenuItem
                          onClick={closeAllDocumentTabs}
                          className="text-destructive focus:text-destructive"
                        >
                          {t("closeAllDocs")}
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => navigator.clipboard.writeText(tab.id)}>
                        {t("copyDocId")}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>

            {/* Right Action Controls: Quick New Document + Overflow / All Tabs Dropdown */}
            <div className="flex items-center self-center shrink-0 gap-1 ml-1">
              <button
                onClick={handleNewQuickTab}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-zinc-300/80 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                title={t("openNewOrder")}
              >
                <Plus className="w-4 h-4" />
              </button>

              {tabs.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          "h-7 px-2 flex items-center gap-1 rounded-md text-xs font-medium transition-colors cursor-pointer relative",
                          overflowTabs.length > 0
                            ? "bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 dark:hover:bg-blue-500/25 border border-blue-500/30"
                            : "hover:bg-zinc-300/80 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100"
                        )}
                        title={t("openTabs", { count: tabs.length })}
                      />
                    }
                  >
                    {overflowTabs.length > 0 ? (
                      <>
                        <span className="font-mono text-[11px] font-semibold">
                          +{overflowTabs.length}
                        </span>
                        {hasOverflowUnsaved && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                        )}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        <ChevronDown className="w-3 h-3 opacity-70" />
                      </>
                    )}
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" sideOffset={6} className="w-64 text-xs">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span>{t("openTabs", { count: tabs.length })}</span>
                        {overflowTabs.length > 0 && (
                          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                            {t("overflowTabs", { count: overflowTabs.length })}
                          </span>
                        )}
                      </DropdownMenuLabel>
                      {tabs.map((tab) => {
                        const isActive = tab.id === activeTabId;
                        const isRegistry = tab.type === "registry";
                        const isOverflown = overflowTabs.some((o) => o.id === tab.id);
                        const canClose = !(isRegistry && tabs.length === 1);

                        return (
                          <DropdownMenuItem
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-2 cursor-pointer group/item",
                              isActive && "bg-accent font-medium"
                            )}
                          >
                            {isRegistry ? (
                              <Table className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            )}
                            <span className="flex-1 truncate text-xs">
                              {getTabTitle(tab)}
                            </span>
                            {isOverflown && !isActive && (
                              <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                                hidden
                              </span>
                            )}
                            {tab.isUnsaved && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                                title={t("unsavedChanges")}
                              />
                            )}
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                            {canClose && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeTab(tab.id);
                                }}
                                className="p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                                title={t("close")}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>

                    {(savedDocTabsCount > 0 || docTabsCount > 0) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          {savedDocTabsCount > 0 && (
                            <DropdownMenuItem
                              onClick={closeSavedTabs}
                              className="gap-2 text-xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{t("closeSaved")}</span>
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                                {savedDocTabsCount}
                              </span>
                            </DropdownMenuItem>
                          )}
                          {docTabsCount > 0 && (
                            <DropdownMenuItem
                              onClick={closeAllDocumentTabs}
                              className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t("closeAllDocs")}</span>
                              <span className="ml-auto font-mono text-[10px]">
                                {docTabsCount}
                              </span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}


      {/* Main Workspace Body */}
      <div className="flex-1 overflow-hidden relative">
        {tabs.map((tab) => (
          <TabContentWrapper key={tab.id} isActive={activeTabId === tab.id}>
            {renderTabType(tab)}
          </TabContentWrapper>
        ))}
        {tabs.length === 0 && children}
      </div>
    </div>
    </TooltipProvider>
  );
}
