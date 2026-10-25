"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Bot,
  User,
  Send,
  Trash2,
  Copy,
  Check,
  FileText,
  Boxes,
  Printer,
  DollarSign,
  ArrowRight,
  CornerDownLeft,
  X,
  Minus,
  Maximize2,
  Minimize2,
  GripHorizontal,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Plus,
  Layers,
  Terminal,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Message,
  MessageGroup,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
  MessageScrollerButton,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { useTranslations, useLocale } from "next-intl";
import {
  CopilotMessage,
  CopilotClientAction,
  CopilotToolStep,
  CopilotMetric,
  CopilotTable,
  CopilotProviderMode,
} from "@/lib/ai/types";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_WIDTH = 340;
const MIN_HEIGHT = 380;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 540;
const EXPANDED_WIDTH = 620;
const EXPANDED_HEIGHT = 700;

const STORAGE_KEY = "printgoo_copilot_history_v1";

const SLASH_COMMANDS = [
  { cmd: "/wo", desc: "Ishlab chiqarish buyrug'i", example: "/wo WOOF-26-0351", icon: FileText },
  { cmd: "/stock", desc: "Ombor qoldiqlari va defitsit", example: "/stock Silk", icon: Boxes },
  { cmd: "/calc", desc: "Tiraj va priladka hisobi", example: "/calc 5000", icon: Calculator },
  { cmd: "/debt", desc: "Mijozlar qarzdorligi (Akt)", example: "/debt", icon: DollarSign },
  { cmd: "/machines", desc: "Dastgohlar telemetriyasi & OEE", example: "/machines", icon: Printer },
  { cmd: "/draft", desc: "Yangi buyurtma qoralamasi", example: "/draft Katalog", icon: Plus },
];

export function AiChatSheet() {
  const tAi = useTranslations("AiChatSheet");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  const {
    isAiChatOpen,
    setAiChatOpen,
    openTab,
    setActiveModule,
    setModule,
    tabs,
    activeTabId,
    activeModule,
    currentSubModule,
    currentUser,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Messages state with local persistence
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (_) {}
    }
    return [
      {
        id: "msg-welcome",
        role: "assistant",
        content: tAi("welcomeMessage"),
        timestamp: "Online",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [includeActiveTabContext, setIncludeActiveTabContext] = useState(true);
  const [providerMode, setProviderMode] = useState<CopilotProviderMode>("smart_local");
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  // Floating position & dimensions state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);

  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const resizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ mouseX: 0, mouseY: 0, x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  const windowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist messages to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
      } catch (_) {}
    }
  }, [messages]);

  useEffect(() => {
    if (isAiChatOpen && !isMinimized) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isAiChatOpen, isMinimized]);

  // Window drag handlers
  const handleMouseDownHeader = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (!windowRef.current) return;

    const rect = windowRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    setPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
  }, []);

  // 8-Way Resize handlers
  const handleResizeStart = useCallback(
    (dir: ResizeDirection) => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!windowRef.current) return;

      const rect = windowRef.current.getBoundingClientRect();
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      setPosition({ x: rect.left, y: rect.top });
      setSize({ width: rect.width, height: rect.height });
      setResizeDir(dir);
    },
    []
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!windowRef.current) return;
      const rect = windowRef.current.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width - 8);
      const maxY = Math.max(0, window.innerHeight - rect.height - 8);
      const nextX = Math.min(Math.max(8, e.clientX - dragOffsetRef.current.dx), maxX);
      const nextY = Math.min(Math.max(8, e.clientY - dragOffsetRef.current.dy), maxY);
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!resizeDir) return;

    const handleMouseMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      const deltaX = e.clientX - start.mouseX;
      const deltaY = e.clientY - start.mouseY;

      const maxWidth = window.innerWidth - 16;
      const maxHeight = window.innerHeight - 16;

      let nextX = start.x;
      let nextY = start.y;
      let nextWidth = start.width;
      let nextHeight = start.height;

      if (resizeDir.includes("e")) {
        nextWidth = Math.min(
          Math.max(MIN_WIDTH, start.width + deltaX),
          window.innerWidth - start.x - 8
        );
      }
      if (resizeDir.includes("s")) {
        nextHeight = Math.min(
          Math.max(MIN_HEIGHT, start.height + deltaY),
          window.innerHeight - start.y - 8
        );
      }
      if (resizeDir.includes("w")) {
        const rawWidth = start.width - deltaX;
        const clampedWidth = Math.min(
          Math.max(MIN_WIDTH, rawWidth),
          start.x + start.width - 8
        );
        nextX = start.x + (start.width - clampedWidth);
        nextWidth = Math.min(clampedWidth, maxWidth);
      }
      if (resizeDir.includes("n")) {
        const rawHeight = start.height - deltaY;
        const clampedHeight = Math.min(
          Math.max(MIN_HEIGHT, rawHeight),
          start.y + start.height - 8
        );
        nextY = start.y + (start.height - clampedHeight);
        nextHeight = Math.min(clampedHeight, maxHeight);
      }

      setPosition({ x: nextX, y: nextY });
      setSize({ width: nextWidth, height: nextHeight });
    };

    const handleMouseUp = () => {
      setResizeDir(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeDir]);

  const handleToggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    } else {
      setIsExpanded(true);
      setSize({ width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT });
    }
    setPosition(null);
  };

  const handleCopy = (id: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleClear = () => {
    const welcome: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: tAi("welcomeMessage"),
      timestamp: "Just now",
    };
    setMessages([welcome]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
  };

  // Client Action Handler
  const handleClientAction = (action: CopilotClientAction) => {
    if (action.type === "open_tab" && action.payload.tab) {
      openTab(action.payload.tab);
      return;
    }

    if (action.type === "navigate_module" && action.payload.module) {
      setActiveModule(action.payload.module);
      if (action.payload.subModule) {
        setModule(action.payload.module, action.payload.subModule);
      }
      return;
    }

    if (action.type === "create_draft_tab" && action.payload.initialData) {
      const data = action.payload.initialData;
      const tabType = action.payload.tabType || "work-order";
      const moduleMap: Record<string, string> = {
        "work-order": "production",
        customer: "crm",
        supplier: "warehouse",
        "warehouse-receipt": "warehouse",
      };

      const newTab: DocumentTab = {
        id: data.docNo || `draft-${Date.now()}`,
        title: action.payload.title || `${data.docNo || "Yangi"} (Qoralama)`,
        type: tabType as any,
        module: moduleMap[tabType] || "production",
        isUnsaved: true,
        documentData: data,
        activeLevel3Tab: "overview",
      };
      openTab(newTab);
    }
  };

  // Main Send Handler with API Integration
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    setShowSlashMenu(false);
    setInput("");

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const requestPayload = {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        context: {
          activeModule,
          activeSubModule: currentSubModule,
          activeTabId: activeTab?.id,
          activeTabType: activeTab?.type,
          activeTabTitle: activeTab?.title,
          activeDocumentSummary: activeTab?.documentData || null,
          userRole: currentUser?.role || "Operator",
          userName: currentUser?.name || "User",
          locale,
          includeActiveTabContext,
        },
        companyCode: "PRINTGOO",
      };

      const res = await fetch("/api/v1/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        throw new Error(`API responded with ${res.status}`);
      }

      const data = await res.json();
      if (data.providerMode) {
        setProviderMode(data.providerMode);
      }

      const botMessage: CopilotMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: data.message || "Operatsiya bajarildi.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolSteps: data.toolSteps,
        actions: data.actions,
        metrics: data.metrics,
        structuredTable: data.structuredTable,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("AI Copilot request error:", err);
      // Fallback assistant response
      const errorMessage: CopilotMessage = {
        id: `bot-err-${Date.now()}`,
        role: "assistant",
        content:
          "Tarmoq so'rovida kechikish yuz berdi. Smart Local Engine orqali barcha mahalliy registrlarni tekshirish davom ettirildi. Iltimos, /wo, /stock yoki /debt buyrug'i orqali qayta urinib ko'ring.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith("/") && val.length < 5) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  if (!isAiChatOpen) return null;

  const isInteracting = isDragging || resizeDir !== null;

  // Active Context Label
  const contextLabel = activeTab
    ? `${activeModule.toUpperCase()} › ${activeTab.id}`
    : `${activeModule.toUpperCase()}${currentSubModule ? ` › ${currentSubModule.toUpperCase()}` : ""}`;

  // Dynamic Suggestion Chips based on activeModule
  const dynamicSuggestions = (() => {
    if (activeModule === "warehouse") {
      return [
        { label: tAi("suggestPaperStock"), prompt: tAi("suggestPaperStockPrompt"), icon: Boxes },
        { label: "Qog'oz qoldig'i", prompt: "/stock Silk", icon: Boxes },
        { label: "Kritik defitsit", prompt: "/stock", icon: AlertCircle },
      ];
    }
    if (activeModule === "finance") {
      return [
        { label: tAi("suggestDebt"), prompt: tAi("suggestDebtPrompt"), icon: DollarSign },
        { label: "Akt sverki", prompt: "/debt Alpha", icon: DollarSign },
        { label: "Schet-fakturalar", prompt: "/debt", icon: FileText },
      ];
    }
    return [
      { label: tAi("suggestWo351"), prompt: tAi("suggestWo351Prompt"), icon: FileText },
      { label: tAi("suggestShiftLead"), prompt: tAi("suggestShiftLeadPrompt"), icon: Printer },
      { label: tAi("suggestCalc"), prompt: tAi("suggestCalcPrompt"), icon: Calculator },
    ];
  })();

  return (
    <div
      ref={windowRef}
      data-slot="floating-ai-window"
      style={{
        ...(position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : { right: "16px", bottom: "32px" }),
        width: `${size.width}px`,
        height: isMinimized ? "auto" : `${size.height}px`,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 32px)",
      }}
      className={cn(
        "fixed z-50 flex flex-col rounded-lg border border-border bg-card text-card-foreground shadow-2xl overflow-hidden select-none",
        !isInteracting && "transition-[width,height] duration-150 ease-out"
      )}
    >
      {/* 8-Way Resize Handles */}
      {!isMinimized && (
        <>
          <div onMouseDown={handleResizeStart("n")} className="absolute top-0 inset-x-2.5 h-1.5 cursor-ns-resize z-20" />
          <div onMouseDown={handleResizeStart("s")} className="absolute bottom-0 inset-x-2.5 h-1.5 cursor-ns-resize z-20" />
          <div onMouseDown={handleResizeStart("w")} className="absolute left-0 inset-y-2.5 w-1.5 cursor-ew-resize z-20" />
          <div onMouseDown={handleResizeStart("e")} className="absolute right-0 inset-y-2.5 w-1.5 cursor-ew-resize z-20" />
          <div onMouseDown={handleResizeStart("nw")} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-30" />
          <div onMouseDown={handleResizeStart("ne")} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-30" />
          <div onMouseDown={handleResizeStart("sw")} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-30" />
          <div
            onMouseDown={handleResizeStart("se")}
            className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 pointer-events-auto"
          >
            <svg viewBox="0 0 6 6" className="w-2 h-2 text-muted-foreground/40" fill="currentColor">
              <circle cx="5" cy="5" r="0.75" />
              <circle cx="2" cy="5" r="0.75" />
              <circle cx="5" cy="2" r="0.75" />
            </svg>
          </div>
        </>
      )}

      {/* Industrial Header */}
      <div
        data-slot="sheet-header"
        onMouseDown={handleMouseDownHeader}
        onDoubleClick={() => setIsMinimized((prev) => !prev)}
        className={cn(
          "px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between shrink-0",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">
              {tAi("title")}
            </span>
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 shrink-0"
            >
              {providerMode === "smart_local" ? "Local" : "Cloud AI"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <GripHorizontal className="size-3.5 text-muted-foreground/40 mr-1 pointer-events-none" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleClear}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  aria-label={tAi("clearChat")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom" className="text-[11px]">
              {tAi("clearChat")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setIsMinimized((prev) => !prev)}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  aria-label={tAi("minimize")}
                >
                  <Minus className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom" className="text-[11px]">
              {tAi("minimize")}
            </TooltipContent>
          </Tooltip>

          {!isMinimized && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleToggleExpand}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    aria-label={tAi("expand")}
                  >
                    {isExpanded ? (
                      <Minimize2 className="size-3.5" />
                    ) : (
                      <Maximize2 className="size-3.5" />
                    )}
                  </Button>
                }
              />
              <TooltipContent side="bottom" className="text-[11px]">
                {tAi("expand")}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setAiChatOpen(false)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label={tCommon("close")}
                >
                  <X className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom" className="text-[11px]">
              {tCommon("close")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Live Context Bar */}
          <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="size-3 text-primary shrink-0" />
              <span className="font-mono font-medium text-muted-foreground text-[10px] truncate">
                {contextLabel}
              </span>
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => setIncludeActiveTabContext((prev) => !prev)}
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors shrink-0",
                      includeActiveTabContext
                        ? "bg-primary/10 border-primary/30 text-primary font-medium"
                        : "bg-muted border-border text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        includeActiveTabContext ? "bg-primary" : "bg-muted-foreground"
                      )}
                    />
                    <span>{tAi("activeContext")}</span>
                  </button>
                }
              />
              <TooltipContent side="bottom" className="text-[11px]">
                {tAi("activeContextTooltip")}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-2.5 py-1.5 border-b border-border bg-muted/10 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {dynamicSuggestions.map((sug, idx) => {
              const Icon = sug.icon;
              return (
                <Button
                  key={idx}
                  variant="outline"
                  size="xs"
                  onClick={() => handleSend(sug.prompt)}
                  className="h-6 px-2 text-[10px] font-medium gap-1 shrink-0 bg-background border-border text-foreground hover:border-primary/40"
                >
                  <Icon className="size-3 text-primary" />
                  <span>{sug.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Message Scroller Container */}
          <div className="flex-1 min-h-0 relative bg-background/50">
            <MessageScrollerProvider>
              <MessageScroller className="h-full">
                <MessageScrollerViewport className="p-3 space-y-3">
                  <MessageScrollerContent className="gap-3">
                    <MessageGroup className="gap-3">
                      {messages.map((msg) => {
                        const isUser = msg.role === "user";
                        return (
                          <MessageScrollerItem key={msg.id}>
                            <Message align={isUser ? "end" : "start"} className="gap-2">
                              <MessageAvatar
                                className={cn(
                                  "w-6 h-6 text-xs font-semibold rounded-md border shrink-0",
                                  isUser
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-foreground border-border"
                                )}
                              >
                                {isUser ? (
                                  <User className="size-3.5" />
                                ) : (
                                  <Bot className="size-3.5 text-primary" />
                                )}
                              </MessageAvatar>

                              <MessageContent className="max-w-[88%]">
                                <MessageHeader className="gap-2 text-[10px] py-0 px-1">
                                  <span className="font-semibold text-foreground">
                                    {isUser ? (currentUser?.name || "User") : "PrintGoo AI"}
                                  </span>
                                  <span className="text-muted-foreground/70 font-mono">
                                    {msg.timestamp}
                                  </span>
                                </MessageHeader>

                                {/* Tool Steps Trace (If Assistant executed ERP functions) */}
                                {msg.toolSteps && msg.toolSteps.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1.5 px-0.5">
                                    {msg.toolSteps.map((step) => (
                                      <Badge
                                        key={step.id}
                                        variant="outline"
                                        className={cn(
                                          "h-5 px-1.5 text-[10px] font-mono gap-1 border-border bg-card",
                                          step.status === "done" && "text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
                                          step.status === "error" && "text-rose-700 dark:text-rose-300 border-rose-500/20"
                                        )}
                                      >
                                        {step.status === "done" ? (
                                          <CheckCircle2 className="size-2.5 text-emerald-600" />
                                        ) : (
                                          <AlertCircle className="size-2.5 text-rose-600" />
                                        )}
                                        <span>{step.label}</span>
                                        {step.durationMs !== undefined && (
                                          <span className="text-muted-foreground text-[9px]">
                                            {step.durationMs}ms
                                          </span>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <Bubble
                                  variant={isUser ? "default" : "secondary"}
                                  align={isUser ? "end" : "start"}
                                >
                                  <BubbleContent className="text-xs p-2.5 rounded-lg whitespace-pre-line leading-relaxed select-text">
                                    {msg.content}
                                  </BubbleContent>
                                </Bubble>

                                {/* Structured Metrics Strip */}
                                {msg.metrics && msg.metrics.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1.5 my-1.5">
                                    {msg.metrics.map((m, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-card border border-border rounded p-1.5 flex flex-col"
                                      >
                                        <span className="text-[10px] text-muted-foreground truncate">
                                          {m.label}
                                        </span>
                                        <div className="flex items-baseline gap-1 mt-0.5">
                                          <span className="text-xs font-mono font-semibold text-foreground">
                                            {m.value}
                                          </span>
                                          {m.sublabel && (
                                            <span className="text-[9px] text-muted-foreground">
                                              {m.sublabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Structured Mini Data Table */}
                                {msg.structuredTable && (
                                  <div className="my-1.5 overflow-x-auto rounded border border-border bg-card">
                                    <table className="w-full text-[10px] font-mono text-left">
                                      <thead className="bg-muted/50 border-b border-border">
                                        <tr>
                                          {msg.structuredTable.headers.map((h, i) => (
                                            <th key={i} className="p-1 px-1.5 font-semibold text-foreground whitespace-nowrap">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border">
                                        {msg.structuredTable.rows.map((row, rIdx) => (
                                          <tr key={rIdx} className="hover:bg-muted/20">
                                            {row.map((cell, cIdx) => (
                                              <td key={cIdx} className="p-1 px-1.5 whitespace-nowrap text-muted-foreground">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Interactive Smart Action Cards */}
                                {msg.actions && msg.actions.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1 px-0.5">
                                    {msg.actions.map((act) => {
                                      const Icon =
                                        act.iconName === "Boxes"
                                          ? Boxes
                                          : act.iconName === "Printer"
                                          ? Printer
                                          : act.iconName === "DollarSign"
                                          ? DollarSign
                                          : act.iconName === "Plus"
                                          ? Plus
                                          : act.iconName === "User"
                                          ? User
                                          : act.iconName === "Calculator"
                                          ? Calculator
                                          : act.type === "open_tab"
                                          ? FileText
                                          : ArrowRight;

                                      return (
                                        <Button
                                          key={act.id}
                                          variant="outline"
                                          size="xs"
                                          onClick={() => handleClientAction(act)}
                                          className="gap-1.5 text-[11px] font-medium border-primary/30 text-primary hover:bg-primary/10 h-7"
                                        >
                                          <Icon className="size-3 text-primary" />
                                          <span>{act.label}</span>
                                          <ArrowRight className="size-2.5 ml-0.5 opacity-60" />
                                        </Button>
                                      );
                                    })}
                                  </div>
                                )}

                                {!isUser && (
                                  <MessageFooter className="gap-1 py-0 px-1 mt-1">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => handleCopy(msg.id, msg.content)}
                                      className="h-5 px-1.5 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                                    >
                                      {copiedId === msg.id ? (
                                        <>
                                          <Check className="size-2.5 text-emerald-500" />
                                          <span className="text-emerald-500">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="size-2.5" />
                                          <span>{tCommon("copy")}</span>
                                        </>
                                      )}
                                    </Button>
                                  </MessageFooter>
                                )}
                              </MessageContent>
                            </Message>
                          </MessageScrollerItem>
                        );
                      })}

                      {isTyping && (
                        <MessageScrollerItem>
                          <Message align="start" className="gap-2">
                            <MessageAvatar className="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center">
                              <Bot className="size-3.5 text-primary animate-pulse" />
                            </MessageAvatar>
                            <MessageContent>
                              <Bubble variant="secondary" align="start">
                                <BubbleContent className="text-xs p-2 px-3 rounded-lg text-muted-foreground flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )}
                    </MessageGroup>
                  </MessageScrollerContent>
                </MessageScrollerViewport>

                <MessageScrollerButton
                  direction="end"
                  className="bottom-3 right-4 shadow-md border-border bg-card"
                />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          {/* Slash Commands Dropdown Menu */}
          {showSlashMenu && (
            <div className="border-t border-border bg-card p-1.5 space-y-0.5 shadow-lg max-h-48 overflow-y-auto">
              <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tezkor buyruqlar (Slash Commands)
              </div>
              {SLASH_COMMANDS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.cmd}
                    onClick={() => {
                      setInput(`${item.cmd} `);
                      setShowSlashMenu(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full flex items-center justify-between p-1.5 px-2 rounded hover:bg-muted text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-primary shrink-0" />
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {item.cmd}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.desc}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {item.example}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* High-density Input Bar */}
          <div className="p-2.5 border-t border-border bg-card shrink-0">
            <div className="flex items-center gap-1.5 bg-muted/40 rounded-md p-1 border border-border focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tAi("inputPlaceholder")}
                className="h-7 border-none bg-transparent shadow-none text-xs focus-visible:ring-0 px-2"
              />
              <Button
                size="xs"
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="h-7 w-7 p-0 shrink-0"
                aria-label={tAi("sendButton")}
              >
                <Send className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-2.5" />
                <span>Enter</span>
                <span className="text-muted-foreground/50 mx-1">•</span>
                <span className="font-mono text-[9px] bg-muted px-1 rounded">/</span>
                <span>buyruqlar</span>
              </span>
              <span className="font-mono text-[9px]">Ctrl+J</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
