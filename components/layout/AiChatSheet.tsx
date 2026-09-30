"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Message,
  MessageGroup,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
} from "@/components/ui/bubble";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
  MessageScrollerButton,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  action?: {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
  };
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-welcome",
    role: "assistant",
    content:
      "Hello Alexey! I am PrintGoo AI Copilot. I can query real-time production orders, verify warehouse substrate inventory, inspect press machine queues, and assist with prepress technical specs.",
    timestamp: "Just now",
  },
];

const SUGGESTIONS = [
  {
    label: "WO-00351 Status",
    prompt: "What is the current status and deadline for WO-00351?",
    icon: FileText,
  },
  {
    label: "Silk 150g Stock",
    prompt: "Check warehouse inventory for Galerie Art Silk 150g.",
    icon: Boxes,
  },
  {
    label: "Heidelberg Queue",
    prompt: "Show active jobs on Heidelberg Speedmaster XL 106.",
    icon: Printer,
  },
  {
    label: "Paid Invoices",
    prompt: "Are there any recent payments recorded for Alpha Media Group?",
    icon: DollarSign,
  },
];

export function AiChatSheet() {
  const tAi = useTranslations("AiChatSheet");
  const {
    isAiChatOpen,
    setAiChatOpen,
    openTab,
    setActiveModule,
    setModule,
  } = useWorkspaceStore();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "msg-welcome",
      role: "assistant",
      content: tAi("welcomeMessage"),
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAiChatOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isAiChatOpen]);

  const handleCopy = (id: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: tAi("welcomeMessage"),
        timestamp: "Just now",
      },
    ]);
  };

  const generateResponse = (userText: string): Omit<ChatMessage, "id" | "timestamp"> => {
    const q = userText.toLowerCase();

    if (q.includes("wo-00351") || q.includes("catalog") || q.includes("order")) {
      return {
        role: "assistant",
        content:
          "📋 **Work Order WO-00351: Hardcover Catalog 96p**\n\n• **Customer**: Alpha Media Group LLC\n• **Run Size**: 5,000 pcs (Hardcover, sewn)\n• **Status**: In Production (High Priority)\n• **Machine**: Heidelberg Speedmaster XL 106\n• **Deadline**: October 06, 2026 (6 days remaining)\n• **Prepress**: Approved by Client\n• **Stock**: Galerie Art Silk 150g/m²\n• **Total Value**: $14,850.00 USD (Paid)",
        action: {
          label: "Open WO-00351 Tab",
          icon: FileText,
          onClick: () => {
            openTab({
              id: "WO-00351",
              title: "WO-00351: Hardcover Catalog (5k)",
              type: "work-order",
              module: "production",
              isUnsaved: false,
              activeLevel3Tab: "overview",
              documentData: {
                docNo: "WO-00351",
                customer: "Alpha Media Group LLC",
                product: "A4 Hardcover Catalog 96p",
                quantity: 5000,
                unit: "pcs",
                status: "Active",
                priority: "High",
                pressMachine: "Heidelberg Speedmaster XL 106",
                startDate: "2026-09-30",
                deadline: "2026-10-06",
                prepressStatus: "Approved by Client",
                paperStock: "Galerie Art Silk 150g/m²",
                coating: "Soft-Touch Matte + Spot UV",
                priceTotal: 14850.0,
                currency: "USD",
                responsible: "K. Anderson (Prepress Lead)",
              },
            });
            setAiChatOpen(false);
          },
        },
      };
    }

    if (q.includes("stock") || q.includes("silk") || q.includes("paper") || q.includes("warehouse")) {
      return {
        role: "assistant",
        content:
          "⚠️ **Warehouse Stock Alert: Galerie Art Silk 150g/m²**\n\n• **Current Balance**: 42 sheets on shelf (Pallet B-14)\n• **Safety Threshold**: 500 sheets\n• **Allocated to WO-00351**: 2,600 sheets required\n• **Status**: Critical Shortage. Replenishment PO-8812 was submitted to Stora Enso with expected ETA tomorrow 14:00.",
        action: {
          label: "Go to Warehouse Registry",
          icon: Boxes,
          onClick: () => {
            setActiveModule("warehouse");
            setModule("warehouse", "stock");
            setAiChatOpen(false);
          },
        },
      };
    }

    if (q.includes("heidelberg") || q.includes("press") || q.includes("machine") || q.includes("queue")) {
      return {
        role: "assistant",
        content:
          "🖨️ **Heidelberg Speedmaster XL 106 — Schedule & Telemetry**\n\n• **Current Status**: Running (14,200 sheets/hr)\n• **Active Job**: WO-00351 (Form 2 of 6)\n• **Next in Queue**: WO-00355 (Cosmetics Packaging 350g)\n• **Operator**: Alexey Kovalev (Shift 1)\n• **Drying Unit**: IR + Hot Air running at 62°C\n• **OEE Rating**: 89.4% this week",
        action: {
          label: "View Production Registry",
          icon: Printer,
          onClick: () => {
            setActiveModule("production");
            setModule("production", "machines");
            setAiChatOpen(false);
          },
        },
      };
    }

    if (q.includes("invoice") || q.includes("paid") || q.includes("payment") || q.includes("finance")) {
      return {
        role: "assistant",
        content:
          "💵 **Payment Verification: Alpha Media Group LLC**\n\n• **Invoice**: INV-2026-0892\n• **Amount**: $14,850.00 USD\n• **Status**: Cleared (Wire Transfer via SWIFT)\n• **Reference**: WO-00351 Contract prepayment 100%\n• **Accounting Ledger**: Posted to 62.01 Accounts Receivable",
        action: {
          label: "Open Invoices Registry",
          icon: DollarSign,
          onClick: () => {
            setActiveModule("finance");
            setModule("finance", "invoices");
            setAiChatOpen(false);
          },
        },
      };
    }

    return {
      role: "assistant",
      content:
        `Understood. I analyzed your query regarding "${userText}". All related production registers, BOM item specifications, and warehouse stock entries have been cross-checked in the PrintGoo ERP database. Let me know if you need to generate a job ticket or open a specific work order tab.`,
    };
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const responseData = generateResponse(query);
      const botMessage: ChatMessage = {
        ...responseData,
        id: `bot-${Date.now()}`,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 450);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={isAiChatOpen} onOpenChange={setAiChatOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col gap-0 border-l border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="p-3.5 border-b border-border bg-muted/20 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-xs font-semibold">{tAi("title")}</SheetTitle>
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[9px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40"
                >
                  Online
                </Badge>
              </div>
              <SheetDescription className="text-[10px] text-muted-foreground">
                {tAi("subtitle")}
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={tAi("clearChat")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="bottom" className="text-[11px]">{tAi("clearChat")}</TooltipContent>
            </Tooltip>
          </div>
        </SheetHeader>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 border-b border-border/60 bg-muted/10 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            {
              label: tAi("suggestWo351"),
              prompt: tAi("suggestWo351Prompt"),
              icon: FileText,
            },
            {
              label: tAi("suggestPaperStock"),
              prompt: tAi("suggestPaperStockPrompt"),
              icon: Boxes,
            },
            {
              label: tAi("suggestShiftLead"),
              prompt: tAi("suggestShiftLeadPrompt"),
              icon: Printer,
            },
          ].map((sug, idx) => {
            const Icon = sug.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(sug.prompt)}
                className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md text-[10px] font-medium bg-background border border-border/80 hover:bg-muted/80 text-foreground transition-colors cursor-pointer select-none"
              >
                <Icon className="w-3 h-3 text-primary" />
                <span>{sug.label}</span>
              </button>
            );
          })}
        </div>

        {/* Message Scroller Container */}
        <div className="flex-1 min-h-0 relative bg-background/50">
          <MessageScrollerProvider>
            <MessageScroller className="h-full">
              <MessageScrollerViewport className="p-3.5 space-y-4">
                <MessageScrollerContent className="gap-3.5">
                  <MessageGroup className="gap-3.5">
                    {messages.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <MessageScrollerItem key={msg.id}>
                          <Message align={isUser ? "end" : "start"} className="gap-2">
                            <MessageAvatar className={cn(
                              "w-6 h-6 text-xs font-semibold rounded-md border",
                              isUser
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-foreground border-border"
                            )}>
                              {isUser ? (
                                <User className="w-3.5 h-3.5" />
                              ) : (
                                <Bot className="w-3.5 h-3.5 text-primary" />
                              )}
                            </MessageAvatar>

                            <MessageContent className="max-w-[85%]">
                              <MessageHeader className="gap-2 text-[10px] py-0 px-1">
                                <span className="font-semibold text-foreground">
                                  {isUser ? "Alexey (Operator)" : "PrintGoo AI"}
                                </span>
                                <span className="text-muted-foreground/70 font-mono">
                                  {msg.timestamp}
                                </span>
                              </MessageHeader>

                              <Bubble
                                variant={isUser ? "default" : "secondary"}
                                align={isUser ? "end" : "start"}
                              >
                                <BubbleContent className="text-xs p-2.5 rounded-lg whitespace-pre-line leading-relaxed select-text">
                                  {msg.content}
                                </BubbleContent>
                              </Bubble>

                              {/* Interactive Deep-link Action Button */}
                              {msg.action && (
                                <div className="pt-1 px-1">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={msg.action.onClick}
                                    className="gap-1.5 text-[11px] font-medium border-primary/30 text-primary hover:bg-primary/10"
                                  >
                                    {msg.action.icon && (
                                      <msg.action.icon className="w-3 h-3 text-primary" />
                                    )}
                                    <span>{msg.action.label}</span>
                                    <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                                  </Button>
                                </div>
                              )}

                              {!isUser && (
                                <MessageFooter className="gap-1 py-0 px-1">
                                  <button
                                    onClick={() => handleCopy(msg.id, msg.content)}
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {copiedId === msg.id ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                                        <span className="text-emerald-500">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-2.5 h-2.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
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
                            <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
                          </MessageAvatar>
                          <MessageContent>
                            <Bubble variant="secondary" align="start">
                              <BubbleContent className="text-xs p-2 px-3 rounded-lg text-muted-foreground flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                <span className="text-[10px] ml-1">Querying database...</span>
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

        {/* Input Bar */}
        <div className="p-3 border-t border-border bg-card shrink-0">
          <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-1 border border-border/80 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tAi("inputPlaceholder")}
              className="h-8 border-none bg-transparent shadow-none text-xs focus-visible:ring-0 px-2"
            />
            <Button
              size="xs"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="h-7 w-7 p-0 shrink-0"
              aria-label={tAi("sendButton")}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-2.5 h-2.5" />
              <span>Enter to send</span>
            </span>
            <span className="font-mono">Ctrl+J to toggle</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
