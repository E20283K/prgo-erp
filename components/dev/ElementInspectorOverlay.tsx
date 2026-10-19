"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Crosshair,
  FileCode,
  Layers,
  Copy,
  Check,
  ExternalLink,
  X,
  ArrowUpDown,
  Sparkles,
  Box,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveActiveComponent } from "@/lib/dev/componentRegistry";
import {
  inspectDomElement,
  InspectedElementInfo,
  ensureComponentIndexLoaded,
  preloadSourceFile,
} from "@/lib/dev/elementInspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ElementInspectorOverlay() {
  const {
    isInspectorActive,
    setInspectorActive,
    setLastInspectedElement,
    tabs,
    activeTabId,
    activeModule,
    currentSubModule,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeResolution = resolveActiveComponent(
    activeTab,
    activeModule,
    currentSubModule
  );

  const [inspected, setInspected] = useState<InspectedElementInfo | null>(null);
  const [ancestorDepth, setAncestorDepth] = useState<number>(0);
  const [copiedBanner, setCopiedBanner] = useState<{
    fileName: string;
    lineRange: string;
    elementLabel: string;
    aiPromptText: string;
  } | null>(null);

  const rawLeafElementRef = useRef<HTMLElement | null>(null);
  const ancestorChainRef = useRef<HTMLElement[]>([]);

  // Preload component index & current active component source lines when inspector activates
  useEffect(() => {
    if (!isInspectorActive) {
      setInspected(null);
      setAncestorDepth(0);
      rawLeafElementRef.current = null;
      ancestorChainRef.current = [];
      return;
    }

    ensureComponentIndexLoaded();
    preloadSourceFile(activeResolution.relativePath);
    if (activeResolution.activeSubTab?.relativePath) {
      preloadSourceFile(activeResolution.activeSubTab.relativePath);
    }
  }, [isInspectorActive, activeResolution.relativePath, activeResolution.activeSubTab?.relativePath]);

  const recomputeInspection = useCallback(
    (targetEl: HTMLElement | null) => {
      if (!targetEl || !document.body.contains(targetEl)) {
        setInspected(null);
        return;
      }
      const info = inspectDomElement(targetEl, activeResolution, () => {
        // Re-run once async source file lines finish loading so exact line number updates immediately
        if (rawLeafElementRef.current) {
          const currentTarget =
            ancestorChainRef.current[ancestorDepth] || rawLeafElementRef.current;
          if (currentTarget && document.body.contains(currentTarget)) {
            setInspected(inspectDomElement(currentTarget, activeResolution));
          }
        }
      });
      setInspected(info);
    },
    [activeResolution, ancestorDepth]
  );

  // Build ancestor chain from hovered leaf element up to body
  const buildAncestorChain = (leaf: HTMLElement): HTMLElement[] => {
    const chain: HTMLElement[] = [];
    let curr: HTMLElement | null = leaf;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (!curr.hasAttribute("data-dev-inspector-ignore")) {
        chain.push(curr);
      }
      curr = curr.parentElement;
    }
    return chain;
  };

  useEffect(() => {
    if (!isInspectorActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore elements belonging to the inspector overlay itself
      if (target.closest("[data-dev-inspector-ignore]")) {
        return;
      }

      if (target !== rawLeafElementRef.current) {
        rawLeafElementRef.current = target;
        const chain = buildAncestorChain(target);
        ancestorChainRef.current = chain;
        setAncestorDepth(0);
        recomputeInspection(chain[0] || target);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.altKey && !e.shiftKey) return;
      const chain = ancestorChainRef.current;
      if (chain.length <= 1) return;

      e.preventDefault();
      e.stopPropagation();

      setAncestorDepth((prev) => {
        const delta = e.deltaY < 0 ? 1 : -1;
        const next = Math.max(0, Math.min(chain.length - 1, prev + delta));
        const targetEl = chain[next];
        if (targetEl) {
          recomputeInspection(targetEl);
        }
        return next;
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setInspectorActive(false);
        return;
      }

      const chain = ancestorChainRef.current;
      if (chain.length > 1 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        e.stopPropagation();
        setAncestorDepth((prev) => {
          const step = e.key === "ArrowUp" ? 1 : -1;
          const next = Math.max(0, Math.min(chain.length - 1, prev + step));
          const targetEl = chain[next];
          if (targetEl) {
            recomputeInspection(targetEl);
          }
          return next;
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-dev-inspector-ignore]")) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!inspected) return;

      // Copy structured AI context to clipboard
      navigator.clipboard.writeText(inspected.aiPromptText);

      // Save in workspace store for Status Bar & Sidebar access
      setLastInspectedElement({
        elementLabel: inspected.elementLabel,
        componentName: inspected.componentName,
        moduleName: inspected.moduleName,
        relativePath: inspected.relativePath,
        fileName: inspected.fileName,
        lineRangeLabel: inspected.lineRangeLabel,
        startLine: inspected.startLine,
        vscodeUrl: inspected.vscodeUrl,
        aiPromptText: inspected.aiPromptText,
      });

      // Show floating copied confirmation toast
      setCopiedBanner({
        fileName: inspected.fileName,
        lineRange: inspected.lineRangeLabel,
        elementLabel: inspected.elementLabel,
        aiPromptText: inspected.aiPromptText,
      });
      setTimeout(() => {
        setCopiedBanner(null);
      }, 3200);

      // If Ctrl/Cmd+Click, also open directly in VS Code at exact line
      if (e.ctrlKey || e.metaKey) {
        window.open(inspected.vscodeUrl, "_blank");
      }

      // Exit inspector mode on click unless Shift is held (Shift+Click allows multi-inspect)
      if (!e.shiftKey) {
        setInspectorActive(false);
      }
    };

    const BlockPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-dev-inspector-ignore]")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousedown", BlockPointerDown, true);
    window.addEventListener("mouseup", BlockPointerDown, true);
    window.addEventListener("click", handleClick, true);

    document.body.style.cursor = "crosshair";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", BlockPointerDown, true);
      window.removeEventListener("mouseup", BlockPointerDown, true);
      window.removeEventListener("click", handleClick, true);
      document.body.style.cursor = "";
    };
  }, [isInspectorActive, inspected, recomputeInspection, setInspectorActive, setLastInspectedElement]);

  if (!isInspectorActive && !copiedBanner) {
    return null;
  }

  // Compute smart tooltip position so it stays inside the viewport
  const getTooltipStyle = (rect: DOMRect): React.CSSProperties => {
    const cardWidth = 380;
    const cardHeight = 195;
    const margin = 10;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    let top = rect.bottom + margin;
    if (top + cardHeight > vh - 36) {
      top = Math.max(44, rect.top - cardHeight - margin);
    }

    let left = rect.left;
    if (left + cardWidth > vw - 12) {
      left = Math.max(12, vw - cardWidth - 12);
    }
    if (left < 12) left = 12;

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${cardWidth}px`,
    };
  };

  const compRootRect =
    inspected?.componentRootEl &&
    inspected.componentRootEl !== inspected.element &&
    document.body.contains(inspected.componentRootEl)
      ? inspected.componentRootEl.getBoundingClientRect()
      : null;

  return (
    <div
      data-dev-inspector-ignore="true"
      className="fixed inset-0 pointer-events-none z-[9999] font-mono select-none"
    >
      {/* ── Top Floating Inspector Mode Banner ── */}
      {isInspectorActive && (
        <div
          data-dev-inspector-ignore="true"
          className="fixed top-2 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-zinc-950/95 border border-cyan-500/50 text-zinc-100 shadow-2xl text-[11px] z-[10000]"
        >
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Crosshair className="w-3.5 h-3.5 animate-pulse" />
            <span>AI INSPECTOR</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-300 font-sans text-[11px]">
            Element ustiga boring va{" "}
            <strong className="text-white">Click</strong> (AI uchun nusxalash)
          </span>
          <span className="hidden md:inline text-zinc-700">|</span>
          <span className="hidden md:flex items-center gap-1 text-[10px] text-amber-400">
            <ArrowUpDown className="w-3 h-3" />
            <span>↑/↓ Konteyner tanlash</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setInspectorActive(false)}
            className="h-5 px-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full ml-1 cursor-pointer"
          >
            <X className="w-3 h-3 mr-0.5" />
            Esc
          </Button>
        </div>
      )}

      {/* ── Copied Confirmation Floating Toast ── */}
      {copiedBanner && (
        <div
          data-dev-inspector-ignore="true"
          className="fixed bottom-10 right-4 pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-zinc-950/95 border border-emerald-500/60 text-zinc-100 shadow-2xl text-xs z-[10001] max-w-md"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
              <Sparkles className="w-3 h-3" />
              <span>AI uchun ma&apos;lumot nusxalandi!</span>
            </div>
            <div className="text-[11px] text-zinc-200 truncate font-mono mt-0.5">
              {copiedBanner.fileName}:{copiedBanner.lineRange} ·{" "}
              <span className="text-zinc-400">{copiedBanner.elementLabel}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Owning Component Container Boundary (Dashed Violet) ── */}
      {isInspectorActive && compRootRect && compRootRect.width > 0 && compRootRect.height > 0 && (
        <div
          style={{
            top: `${compRootRect.top}px`,
            left: `${compRootRect.left}px`,
            width: `${compRootRect.width}px`,
            height: `${compRootRect.height}px`,
          }}
          className="fixed border border-dashed border-violet-400/60 bg-violet-500/[0.02] pointer-events-none transition-all duration-75"
        >
          <span className="absolute -top-4 right-0 px-1 py-0.2 rounded bg-violet-950/90 border border-violet-500/40 text-violet-300 text-[9px] font-semibold">
            {inspected?.componentName} ({inspected?.fileName})
          </span>
        </div>
      )}

      {/* ── Hovered Target Element / Container Highlight Box ── */}
      {isInspectorActive &&
        inspected &&
        inspected.rect.width > 0 &&
        inspected.rect.height > 0 && (
          <>
            <div
              style={{
                top: `${inspected.rect.top}px`,
                left: `${inspected.rect.left}px`,
                width: `${inspected.rect.width}px`,
                height: `${inspected.rect.height}px`,
              }}
              className={`fixed pointer-events-none transition-all duration-75 ${
                inspected.isContainer
                  ? "border-2 border-amber-400 bg-amber-500/10"
                  : "border-2 border-cyan-400 bg-cyan-500/10"
              }`}
            >
              {/* Dimension & Tag Pill on Top-Left of Element */}
              <div
                className={`absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded-t text-[9px] font-bold whitespace-nowrap shadow ${
                  inspected.isContainer
                    ? "bg-amber-500 text-zinc-950"
                    : "bg-cyan-500 text-zinc-950"
                }`}
              >
                <span>
                  {inspected.isContainer ? "CONTAINER" : "ELEMENT"}
                </span>
                <span>·</span>
                <span>
                  {inspected.uiPrimitiveName || `<${inspected.tagName}>`}
                </span>
                <span>·</span>
                <span>
                  {Math.round(inspected.rect.width)}×{Math.round(inspected.rect.height)}
                </span>
              </div>
            </div>

            {/* ── Floating DevTools Inspector Details Card ── */}
            <div
              style={getTooltipStyle(inspected.rect)}
              className="fixed p-2.5 rounded-lg bg-zinc-950/95 border border-zinc-700/90 text-zinc-100 shadow-2xl pointer-events-none z-[10000] space-y-1.5 backdrop-blur-md"
            >
              {/* Row 1: Element Name & Kind Badge */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-zinc-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Box
                    className={`w-3.5 h-3.5 shrink-0 ${
                      inspected.isContainer ? "text-amber-400" : "text-cyan-400"
                    }`}
                  />
                  <span className="font-bold text-xs text-white truncate">
                    {inspected.elementLabel}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${
                    inspected.isContainer
                      ? "border-amber-500/40 text-amber-300 bg-amber-950/50"
                      : "border-cyan-500/40 text-cyan-300 bg-cyan-950/50"
                  }`}
                >
                  {inspected.isContainer ? "Container" : "UI Element"}
                  {ancestorDepth > 0 ? ` (+${ancestorDepth}↑)` : ""}
                </Badge>
              </div>

              {/* Row 2: ERP Module & Component Hierarchy */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800/80 min-w-0">
                  <div className="text-[9px] text-zinc-500 uppercase">ERP Module</div>
                  <div className="text-blue-400 font-semibold truncate mt-0.5">
                    {inspected.moduleName} › {inspected.subModuleOrDoc}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800/80 min-w-0">
                  <div className="text-[9px] text-zinc-500 uppercase">React Component</div>
                  <div className="text-violet-300 font-semibold truncate mt-0.5">
                    {inspected.componentChain.join(" › ")}
                  </div>
                </div>
              </div>

              {/* Row 3: Exact Source File & Code Line Number */}
              <div className="p-1.5 rounded bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-zinc-200 truncate">
                    {inspected.relativePath}
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] shrink-0">
                  {inspected.lineRangeLabel}
                </span>
              </div>

              {/* Row 4: Live Source Code Snippet Preview */}
              {inspected.codeSnippet && (
                <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-mono overflow-hidden">
                  <pre className="truncate leading-relaxed text-amber-200/90">
                    {inspected.codeSnippet}
                  </pre>
                </div>
              )}

              {/* Row 5: Footer Shortcut Hints */}
              <div className="pt-1 flex items-center justify-between text-[9px] text-zinc-400">
                <span className="text-cyan-300 font-semibold">
                  Click: Copy AI Context
                </span>
                <span>Ctrl+Click: VS Code</span>
                <span>↑/↓: Container</span>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
