"use client";

import React, { useState } from "react";
import {
  FileCode,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  GitBranch,
  ChevronRight,
  X,
  Crosshair,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getModule } from "@/lib/modules";
import {
  buildViewContextLines,
  formatViewSignature,
  resolveActiveComponent,
  vscodeFileUrl,
  type ResolvedFile,
} from "@/lib/dev/componentRegistry";
import { useSourceLineCount } from "@/lib/dev/useSourceLineCount";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const chip =
  "flex items-center gap-1 h-5 px-1.5 rounded border border-border bg-card text-[10px] shrink-0 transition-colors";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return { copied, copy };
}

function FileRow({
  label,
  file,
  copied,
  onCopy,
}: {
  label: string;
  file: ResolvedFile;
  copied: boolean;
  onCopy: () => void;
}) {
  const lines = useSourceLineCount(file.relativePath);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{lines === null ? "–" : `${lines.toLocaleString()} LOC`}</span>
      </div>
      <div className="flex items-center gap-1 h-7 pl-2 pr-1 rounded border border-border bg-muted">
        <span className="flex-1 truncate text-[10px]" title={file.relativePath}>
          {file.relativePath}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Copy path"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </button>
        <a
          href={vscodeFileUrl(file.relativePath)}
          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
          aria-label="Open in VS Code"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

export function StatusBar() {
  const tMod = useTranslations("Modules");
  const {
    tabs,
    activeTabId,
    activeModule,
    currentSubModule,
    setShowStatusBar,
    isInspectorActive,
    toggleInspectorMode,
    lastInspectedElement,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const r = resolveActiveComponent(activeTab, activeModule, currentSubModule);
  const targetLines = useSourceLineCount(r.target.relativePath);
  const { copied, copy } = useCopy();

  const moduleDef = getModule(r.module);
  const moduleLabel = tMod.has(r.module) ? tMod(r.module) : (moduleDef?.label ?? r.module);
  const gitBranch = process.env.NEXT_PUBLIC_GIT_BRANCH;
  const viewContext = ["[UI context]", ...buildViewContextLines(r)].join("\n");

  const logState = () => {
    console.group(`[PrintGoo DevTools] ${formatViewSignature(r)}`);
    console.log("Resolution:", r);
    console.log("Active tab:", activeTab);
    console.groupEnd();
  };

  return (
    <TooltipProvider delay={200}>
      <footer className="h-7 bg-muted text-foreground border-t border-border flex items-center justify-between gap-2 px-2 text-[11px] font-mono tracking-tight select-none shrink-0 z-20">
        <div className="flex flex-1 items-center gap-1.5 min-w-0 overflow-hidden">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleInspectorMode}
                  className={cn(
                    chip,
                    "cursor-pointer font-semibold",
                    isInspectorActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-background text-muted-foreground hover:text-foreground"
                  )}
                />
              }
            >
              <Crosshair className="size-3" />
              <span>Inspect</span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="text-xs font-mono">
              Ctrl+Shift+C
            </TooltipContent>
          </Tooltip>

          <span className="hidden lg:inline text-muted-foreground shrink-0">{moduleLabel}</span>
          <ChevronRight className="hidden lg:block size-3 text-muted-foreground shrink-0" />

          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={cn(chip, "cursor-pointer hover:bg-background min-w-0")}
                />
              }
            >
              {r.matched ? (
                <FileCode className="size-3 text-muted-foreground shrink-0" />
              ) : (
                <TriangleAlert className="size-3 text-amber-600 shrink-0" />
              )}
              <span className="font-semibold truncate">{formatViewSignature(r)}</span>
              {r.subView && (
                <>
                  <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{r.subView.componentName}</span>
                </>
              )}
              <span className="text-muted-foreground tabular-nums shrink-0">
                {targetLines === null ? "" : `${targetLines.toLocaleString()} LOC`}
              </span>
            </PopoverTrigger>

            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-96 p-2.5 space-y-2 bg-popover border border-border rounded-md font-mono text-xs z-50"
            >
              {!r.matched && (
                <div className="flex items-center gap-1.5 h-7 px-2 rounded border border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="size-3.5 shrink-0" />
                  <span>Marshrut topilmadi</span>
                </div>
              )}
              <FileRow
                label="View"
                file={r.view}
                copied={copied === "view"}
                onCopy={() => copy(r.view.relativePath, "view")}
              />
              {r.subView && (
                <FileRow
                  label={`Tab · ${r.subView.id}`}
                  file={r.subView}
                  copied={copied === "sub"}
                  onCopy={() => copy(r.subView!.relativePath, "sub")}
                />
              )}
              <pre className="p-2 rounded border border-border bg-muted text-[10px] text-muted-foreground whitespace-pre-wrap">
                {viewContext}
              </pre>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copy(viewContext, "ctx")}
                  className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] cursor-pointer"
                >
                  {copied === "ctx" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copied === "ctx" ? "Nusxalandi" : "Kontekst"}</span>
                </button>
                <button
                  type="button"
                  onClick={logState}
                  className="flex items-center gap-1.5 h-7 px-2 rounded border border-border hover:bg-muted text-[11px] cursor-pointer"
                >
                  <Terminal className="size-3.5" />
                  <span>Console</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {r.isDocument && activeTab && (
            <span className="hidden sm:flex items-center gap-1.5 min-w-0 text-muted-foreground">
              <span className="truncate max-w-[160px]">{r.record?.docNo || activeTab.title}</span>
              {activeTab.isUnsaved && <span className="text-amber-600 dark:text-amber-400 shrink-0">Saqlanmagan</span>}
            </span>
          )}

          {lastInspectedElement && (
            <Popover>
              <PopoverTrigger
                render={<button type="button" className={cn(chip, "hidden md:flex cursor-pointer hover:bg-background")} />}
              >
                <Crosshair className="size-3 text-muted-foreground" />
                <span className="font-semibold">{lastInspectedElement.fileName}</span>
                <span className="text-muted-foreground">{lastInspectedElement.lineRangeLabel}</span>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-[28rem] p-2.5 space-y-2 bg-popover border border-border rounded-md font-mono text-xs z-50"
              >
                <pre className="p-2 rounded border border-border bg-muted text-[10px] text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {lastInspectedElement.aiPromptText}
                </pre>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(lastInspectedElement.aiPromptText, "el")}
                    className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] cursor-pointer"
                  >
                    {copied === "el" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    <span>{copied === "el" ? "Nusxalandi" : "Kontekst"}</span>
                  </button>
                  <a
                    href={lastInspectedElement.vscodeUrl}
                    className="flex items-center gap-1.5 h-7 px-2 rounded border border-border hover:bg-muted text-[11px]"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>VS Code</span>
                  </a>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          {gitBranch && (
            <span className="flex items-center gap-1">
              <GitBranch className="size-3" />
              <span>{gitBranch}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowStatusBar(false)}
            className="p-0.5 rounded hover:bg-background hover:text-foreground cursor-pointer"
            aria-label="Hide status bar"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </footer>
    </TooltipProvider>
  );
}
