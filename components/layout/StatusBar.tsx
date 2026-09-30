"use client";

import React from "react";
import { Table, CheckSquare, MousePointer, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function StatusBar() {
  const t = useTranslations("StatusBar");
  const { totalCount, selectedCount, activeCellCoords, tabs, activeTabId } = useWorkspaceStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isRegistry = !activeTab || activeTab.type === "registry";

  return (
    <footer className="h-6 bg-card border-t border-border flex items-center justify-between px-3 text-[11px] text-muted-foreground select-none shrink-0 font-mono tracking-tight z-10">
      {/* Left: Real Data Table Metrics */}
      <div className="flex items-center gap-2.5">
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
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-foreground border border-border/60">Ins</kbd> {t("shortcutNew")}</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-foreground border border-border/60">F12</kbd> {t("shortcutOpen")}</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-foreground border border-border/60">Del</kbd> {t("shortcutDelete")}</span>
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
