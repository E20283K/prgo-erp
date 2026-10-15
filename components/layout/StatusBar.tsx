"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  CheckSquare,
  FileCode,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  GitBranch,
  Monitor,
  Activity,
  Layers,
  ChevronRight,
  Info,
  X,
  Sparkles,
  Database,
  Cpu,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getModule, getSubItemLabel } from "@/lib/modules";
import { resolveActiveComponent, WORKSPACE_ROOT } from "@/lib/dev/componentRegistry";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    setShowStatusBar,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isRegistry = !activeTab || activeTab.type === "registry";

  // Resolve active React .tsx Component Module and LOC
  const resolution = resolveActiveComponent(activeTab, activeModule, currentSubModule);

  // Live telemetry state
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState<number>(60);
  const [memoryHeap, setMemoryHeap] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Live Viewport Tracking
  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== "undefined") {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // 2. Real-time Live FPS Monitor
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const calcFps = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(calcFps);
    };

    animId = requestAnimationFrame(calcFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3. Performance Memory Sampling (if available in Chromium)
  useEffect(() => {
    const sampleMemory = () => {
      if (typeof window !== "undefined" && (window.performance as any)?.memory?.usedJSHeapSize) {
        const bytes = (window.performance as any).memory.usedJSHeapSize;
        setMemoryHeap(`${Math.round(bytes / 1048576)}MB`);
      }
    };
    sampleMemory();
    const interval = setInterval(sampleMemory, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDumpState = () => {
    console.group(`[PrintGoo DevTools] Active Component: ${resolution.fileName}`);
    console.log("Component Resolution:", resolution);
    console.log("Active Tab Object:", activeTab);
    console.log("Active Module:", activeModule, "SubModule:", currentSubModule);
    console.log("All Workspace Tabs:", tabs);
    console.groupEnd();
    setCopiedKey("console-logged");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const moduleDef = getModule(activeModule);
  const moduleLabel = tMod.has(activeModule) ? tMod(activeModule) : (moduleDef?.label ?? activeModule);

  return (
    <TooltipProvider delay={200}>
      <footer className="h-7 bg-zinc-950 text-zinc-300 border-t border-zinc-800/90 flex items-center justify-between px-3 text-[11px] font-mono tracking-tight select-none shrink-0 z-20 shadow-inner">
        {/* ── Left: Developer HUD & Active .tsx Component Module ── */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Dev Indicator */}
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>DEV HUD</span>
          </div>

          {/* Module tag */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] shrink-0 uppercase font-semibold">
            <span className="text-zinc-500 font-normal">MOD:</span>
            <span className="text-blue-400">{moduleLabel}</span>
          </div>

          <span className="text-zinc-700">|</span>

          {/* Active .tsx Component Module & Line Count Button with Inspector Popover */}
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:border-zinc-500 transition-colors cursor-pointer group shrink-0"
                  title="Click to inspect .tsx Component Module details & line count"
                />
              }
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 shrink-0" />
              <span className="text-zinc-100 font-bold tracking-tight">
                {resolution.fileName}
              </span>

              {resolution.activeSubTab && (
                <>
                  <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="text-amber-400 font-medium">
                    {resolution.activeSubTab.fileName}
                  </span>
                </>
              )}

              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-zinc-950 text-emerald-400 font-mono font-semibold border border-emerald-500/30">
                {resolution.linesOfCode.toLocaleString()} LOC
              </span>
            </PopoverTrigger>

            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-96 p-3 bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-2xl rounded-lg font-mono text-xs z-50"
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-zinc-100 text-sm">{resolution.fileName}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60 text-[10px] font-semibold">
                  TSX Module
                </span>
              </div>

              <div className="py-2.5 space-y-2 text-[11px]">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Source File Path</div>
                  <div className="flex items-center justify-between gap-2 mt-0.5 p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <span className="truncate text-zinc-300 text-[10px]">{resolution.relativePath}</span>
                    <button
                      onClick={() => handleCopy(resolution.relativePath, "relpath")}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy relative file path"
                    >
                      {copiedKey === "relpath" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === "relpath" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 uppercase">Lines of Code (LOC)</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">
                      {resolution.linesOfCode.toLocaleString()} <span className="text-[10px] text-zinc-400 font-normal">lines</span>
                    </div>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 uppercase">Category</div>
                    <div className="text-[11px] font-semibold text-zinc-200 mt-0.5 truncate">
                      {resolution.category}
                    </div>
                  </div>
                </div>

                {resolution.activeSubTab && (
                  <div className="p-2 bg-amber-950/30 rounded border border-amber-500/30">
                    <div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center justify-between">
                      <span>Active Sub-Component Tab</span>
                      <span className="font-bold">{resolution.activeSubTab.linesOfCode.toLocaleString()} LOC</span>
                    </div>
                    <div className="text-[11px] font-semibold text-zinc-200 mt-0.5">
                      {resolution.activeSubTab.fileName}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {resolution.activeSubTab.relativePath}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  {resolution.description}
                </p>
              </div>

              {/* Dev Inspector Actions */}
              <div className="pt-2 border-t border-zinc-800 flex items-center gap-1.5 flex-wrap">
                <a
                  href={resolution.vscodeUrl}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in VS Code</span>
                </a>

                <button
                  onClick={handleDumpState}
                  className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Print active tab state to Browser DevTools Console"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedKey === "console-logged" ? "Logged!" : "Log State"}</span>
                </button>

                {activeTab && (
                  <button
                    onClick={() => handleCopy(JSON.stringify(activeTab, null, 2), "tab-json")}
                    className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Copy active tab JSON state to clipboard"
                  >
                    {copiedKey === "tab-json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "tab-json" ? "Copied JSON" : "Copy JSON"}</span>
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <span className="hidden md:inline text-zinc-700">|</span>

          {/* Data Grid / Document metrics */}
          {isRegistry ? (
            <div className="hidden sm:flex items-center gap-2 text-zinc-400">
              <span className="flex items-center gap-1">
                <Table className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-zinc-200 font-semibold">{totalCount.toLocaleString()}</span>
                <span className="text-[10px]">rows</span>
              </span>

              {selectedCount > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckSquare className="w-3 h-3" />
                    <span>{selectedCount} selected</span>
                  </span>
                </>
              )}

              <span className="text-zinc-700">·</span>
              <span className="text-zinc-300 font-medium">
                {activeCellCoords || "R1:C1"}
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-zinc-400">
              <span className="flex items-center gap-1 text-amber-400 font-medium truncate max-w-[140px]">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{resolution.docNo || activeTab.title}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                activeTab.isUnsaved ? "bg-amber-950 text-amber-400 border border-amber-600/30" : "bg-emerald-950 text-emerald-400 border border-emerald-600/30"
              }`}>
                {activeTab.isUnsaved ? "DIRTY" : "CLEAN"}
              </span>
            </div>
          )}
        </div>

        {/* ── Right: Diagnostics, Telemetry & Hide Action ── */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 shrink-0">
          {/* Live Viewport */}
          <div className="hidden lg:flex items-center gap-1" title="Browser window viewport size">
            <Monitor className="w-3 h-3 text-zinc-500" />
            <span>{viewport.width}×{viewport.height}</span>
          </div>

          <span className="hidden lg:inline text-zinc-800">|</span>

          {/* Real-time FPS */}
          <div className="hidden md:flex items-center gap-1" title="Live rendering frame rate">
            <span className={`w-1.5 h-1.5 rounded-full ${fps >= 55 ? "bg-emerald-400" : fps >= 30 ? "bg-amber-400" : "bg-rose-500"}`} />
            <span className={fps >= 55 ? "text-zinc-300" : "text-amber-400 font-bold"}>{fps} FPS</span>
          </div>

          {memoryHeap && (
            <>
              <span className="hidden md:inline text-zinc-800">|</span>
              <div className="hidden md:flex items-center gap-1 text-zinc-400" title="Chromium JS Heap Memory Usage">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>{memoryHeap}</span>
              </div>
            </>
          )}

          <span className="hidden sm:inline text-zinc-800">|</span>

          {/* Git branch */}
          <div className="flex items-center gap-1 text-zinc-300 font-medium" title="Git current branch">
            <GitBranch className="w-3 h-3 text-violet-400" />
            <span>master</span>
          </div>

          <span className="hidden sm:inline text-zinc-800">|</span>

          {/* Framework stack badge */}
          <div className="hidden xl:flex items-center gap-1 text-zinc-500 text-[9px] uppercase tracking-wider" title="Next.js 15 + React 19">
            <span>Next 15 · R19</span>
          </div>

          {/* Quick console log button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleDumpState}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
                  title="Log state to DevTools Console"
                />
              }
            >
              <Terminal className="w-3.5 h-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="text-xs">
              Log Workspace State to Console
            </TooltipContent>
          </Tooltip>

          {/* Hide Status Bar button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setShowStatusBar(false)}
                  className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer ml-0.5"
                  title="Hide Developer Status Bar"
                />
              }
            >
              <X className="w-3.5 h-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="text-xs">
              Hide Status Bar (Right-click anywhere in sidebar to re-enable)
            </TooltipContent>
          </Tooltip>
        </div>
      </footer>
    </TooltipProvider>
  );
}
