"use client";

import React from "react";
import { Table, CheckSquare, MousePointer, Info, ChevronRight, FileText, FolderTree } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getModule, getSubItemLabel } from "@/lib/modules";
import { Kbd } from "@/components/ui/kbd";

export function StatusBar() {
  const t = useTranslations("StatusBar");
  const tMod = useTranslations("Modules");
  const { 
    totalCount, 
    selectedCount, 
    activeCellCoords, 
    tabs, 
    activeTabId,
    activeModule,
    currentModule,
    currentSubModule,
  } = useWorkspaceStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isRegistry = !activeTab || activeTab.type === "registry";

  const moduleDef = getModule(activeModule);
  const moduleLabel = tMod.has(activeModule) ? tMod(activeModule) : (moduleDef?.label ?? activeModule);
  const subItemLabel = tMod.has(currentSubModule) ? tMod(currentSubModule) : getSubItemLabel(currentModule, currentSubModule);
  const docTitle = activeTab && activeTab.type !== "registry" ? (activeTab.documentData?.docNo || activeTab.title) : null;

  return (
    <footer className="h-6 bg-card border-t border-border flex items-center justify-between px-3 text-[11px] text-muted-foreground select-none shrink-0 font-mono tracking-tight z-10">
      {/* Left: Breadcrumbs + Data Table Metrics */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 text-foreground/90 font-medium shrink-0">
          <FolderTree className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="uppercase text-[10px] tracking-wider text-muted-foreground font-semibold">
            {moduleLabel}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
          <span className="text-foreground font-normal">
            {subItemLabel}
          </span>
          {docTitle && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
              <span className="text-primary font-semibold flex items-center gap-1 truncate max-w-[150px]">
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate">{docTitle}</span>
              </span>
            </>
          )}
        </div>

        <span className="text-border">|</span>

        {isRegistry ? (
          <>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Table className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                {t("total")}: <strong className="text-foreground">{totalCount.toLocaleString()}</strong> {t("records")}
              </span>
            </div>

            {selectedCount > 0 && (
              <>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1 text-primary font-semibold">
                  <CheckSquare className="w-3 h-3" />
                  <span>{selectedCount} {t("selected")}</span>
                </div>
              </>
            )}

            <span className="text-border">|</span>
            <div className="flex items-center gap-1">
              <span>{t("cell")}:</span>
              <span className="text-foreground font-semibold">{activeCellCoords || "R1:C1"}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>{t("active")}: {activeTab.title}</span>
          </div>
        )}
      </div>

      {/* Right: Key Shortcuts & Hints */}
      <div className="flex items-center gap-2.5 text-[10px]">
        <div className="hidden md:flex items-center gap-2 text-muted-foreground/80">
          <span><Kbd>Ins</Kbd> {t("shortcutNew")}</span>
          <span><Kbd>F12</Kbd> {t("shortcutOpen")}</span>
          <span><Kbd>Del</Kbd> {t("shortcutDelete")}</span>
        </div>
        <span className="hidden md:inline text-border">|</span>
        <div className="flex items-center gap-1 text-muted-foreground/90">
          <MousePointer className="w-3 h-3 text-muted-foreground" />
          <span>{t("doubleClickHint")}</span>
        </div>
      </div>
    </footer>
  );
}
