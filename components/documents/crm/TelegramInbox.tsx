"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore, type CrmCustomerRecord } from "@/store/workspaceStore";
import {
  Search,
  Send,
  Paperclip,
  CheckCheck,
  Clock,
  AlertTriangle,
  Building2,
  FileText,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Link2,
  MessageSquare,
  Info,
  Layers,
  Settings,
  Sliders,
  Check,
  Copy,
  Save,
  Radio,
  Activity,
  X,
  MoreHorizontal,
  Reply,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
  Message,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup,
  InputGroupInput,
  InputGroupButton,
  InputGroupAddon,
} from "@/components/ui/input-group";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemGroup,
} from "@/components/ui/item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TelegramChatSettings {
  notifyOrderCreated?: boolean;
  notifyProofReady?: boolean;
  notifyProductionDone?: boolean;
  notifyPaymentReminder?: boolean;
}

interface TelegramChatListItem {
  id: string;
  chatId: string;
  title: string;
  type: string;
  photoUrl?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  clientCode?: string | null;
  clientPhone?: string | null;
  assignedUserId?: string | null;
  status: "active" | "unlinked" | "archived";
  unreadCount: number;
  settings?: TelegramChatSettings;
  lastMessageAt?: string | null;
  lastMessageSnippet?: string | null;
  unansweredSince?: string | null;
  isSlaBreached?: boolean;
}

interface TelegramMessageItem {
  id: string;
  telegramMessageId: number;
  senderName?: string | null;
  senderUsername?: string | null;
  senderAvatarUrl?: string | null;
  isOutgoing: boolean;
  text?: string | null;
  mediaType?: string | null;
  mediaFileName?: string | null;
  mediaFileSize?: number | null;
  telegramFileId?: string | null;
  isAttachedToOrder?: boolean;
  workOrderId?: string | null;
  sentAt: string;
}

interface QuickReplyTemplate {
  id: string;
  code: string;
  title: string;
  content: string;
  category: string;
}

interface ClientActiveOrder {
  docNo: string;
  product: string;
  stage: string;
  quantity: number;
}

export function TelegramInbox() {
  const t = useTranslations("TelegramInbox");
  const { openTab, crmCustomers, loadCrmCustomers, addNotification } = useWorkspaceStore();

  const [chats, setChats] = useState<TelegramChatListItem[]>([]);
  const [activeChat, setActiveChat] = useState<TelegramChatListItem | null>(null);
  const [messages, setMessages] = useState<TelegramMessageItem[]>([]);
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>([]);
  const [clientActiveOrders, setClientActiveOrders] = useState<ClientActiveOrder[]>([]);
  const [filter, setFilter] = useState<"all" | "unlinked" | "sla_breach" | "active">("all");
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [linkingDialogOpen, setLinkingDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [groupChatSettings, setGroupChatSettings] = useState<TelegramChatSettings>({
    notifyOrderCreated: true,
    notifyProofReady: true,
    notifyProductionDone: true,
    notifyPaymentReminder: false,
  });
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Panel o'lchamlarini boshqarish (Telegram UI uslubidagi Resizable Rail)
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number>(320);
  const [rightWidth, setRightWidth] = useState<number>(320);
  const [isLeftResizing, setIsLeftResizing] = useState(false);
  const [isRightResizing, setIsRightResizing] = useState(false);

  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem("printgoo_tg_left_width");
      if (savedLeft) {
        const val = parseInt(savedLeft, 10);
        if (!isNaN(val) && val >= 240 && val <= 560) {
          setLeftWidth(val);
        }
      }
      const savedRight = localStorage.getItem("printgoo_tg_right_width");
      if (savedRight) {
        const val = parseInt(savedRight, 10);
        if (!isNaN(val) && val >= 260 && val <= 600) {
          setRightWidth(val);
        }
      }
    } catch {}
  }, []);

  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLeftResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(Math.max(moveEvent.clientX - rect.left, 240), 560);
      setLeftWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsLeftResizing(false);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const finalWidth = Math.min(Math.max(upEvent.clientX - rect.left, 240), 560);
        try {
          localStorage.setItem("printgoo_tg_left_width", finalWidth.toString());
        } catch {}
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleLeftReset = () => {
    setLeftWidth(320);
    try {
      localStorage.setItem("printgoo_tg_left_width", "320");
    } catch {}
  };

  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRightResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(Math.max(rect.right - moveEvent.clientX, 260), 600);
      setRightWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsRightResizing(false);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const finalWidth = Math.min(Math.max(rect.right - upEvent.clientX, 260), 600);
        try {
          localStorage.setItem("printgoo_tg_right_width", finalWidth.toString());
        } catch {}
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleRightReset = () => {
    setRightWidth(320);
    try {
      localStorage.setItem("printgoo_tg_right_width", "320");
    } catch {}
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleToggleSetting = async (key: keyof TelegramChatSettings, value: boolean) => {
    if (!activeChat) return;
    const newSettings = { ...groupChatSettings, [key]: value };
    setGroupChatSettings(newSettings);

    try {
      setSavingGroupSettings(true);
      const res = await fetch(`/api/v1/crm/telegram/chats/${activeChat.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: newSettings,
          clientId: activeChat.clientId || null,
          assignedUserId: selectedManager || activeChat.assignedUserId || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActiveChat({
          ...activeChat,
          settings: newSettings,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err?.message || "Sozlamani saqlab bo'lmadi",
        severity: "error",
      });
      setGroupChatSettings(groupChatSettings);
    } finally {
      setSavingGroupSettings(false);
    }
  };

  const handleUpdateManager = async (manager: string) => {
    if (!activeChat) return;
    try {
      setSavingGroupSettings(true);
      const res = await fetch(`/api/v1/crm/telegram/chats/${activeChat.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: groupChatSettings,
          clientId: activeChat.clientId || null,
          assignedUserId: manager.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addNotification({
          title: "Menejer saqlandi",
          description: `${activeChat.title} uchun mas'ul menejer yangilandi.`,
          severity: "success",
        });
        setActiveChat({
          ...activeChat,
          assignedUserId: manager.trim() || null,
        });
        fetchChats();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addNotification({
        title: "Xatolik",
        description: err?.message || "Menejerni saqlab bo'lmadi",
        severity: "error",
      });
    } finally {
      setSavingGroupSettings(false);
    }
  };

  // 1. Guruhlarni yuklash
  const fetchChats = async () => {
    try {
      setLoadingChats(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/v1/crm/telegram/chats?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setChats(json.data);
        if (json.data.length > 0 && !activeChat) {
          selectChat(json.data[0]);
        }
      }
    } catch (err) {
      console.error("fetchChats error:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  // 2. Tanlangan chat xabarlarini yuklash
  const fetchMessages = async (chatId: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/v1/crm/telegram/messages?chatId=${chatId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMessages(json.data);
        if (json.chat) {
          setActiveChat(json.chat);
          setSelectedClientId(json.chat.clientId || "");
          setSelectedManager(json.chat.assignedUserId || "");
          if (json.chat.settings) {
            setGroupChatSettings(json.chat.settings);
          }
        }
      }
    } catch (err) {
      console.error("fetchMessages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Shablonlarni yuklash
  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/v1/crm/telegram/templates");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTemplates(json.data);
      }
    } catch (err) {
      console.error("fetchTemplates error:", err);
    }
  };

  // 4. Orqa fonda jimjit sinxronizatsiya (flickersiz, loading spinnersiz)
  const syncChatMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/v1/crm/telegram/messages?chatId=${chatId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMessages((prev) => {
          if (
            prev.length !== json.data.length ||
            (json.data.length > 0 && prev[prev.length - 1]?.id !== json.data[json.data.length - 1]?.id)
          ) {
            return json.data;
          }
          return prev;
        });
      }
    } catch {
      // background sync
    }
  }, []);

  const syncChatList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/v1/crm/telegram/chats?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setChats((prev) => {
          if (prev.length !== json.data.length) return json.data;
          const hasDiff = json.data.some((nc: TelegramChatListItem, i: number) => {
            const oc = prev[i];
            return (
              !oc ||
              oc.id !== nc.id ||
              oc.unreadCount !== nc.unreadCount ||
              oc.lastMessageSnippet !== nc.lastMessageSnippet
            );
          });
          return hasDiff ? json.data : prev;
        });
      }
    } catch {
      // background sync
    }
  }, [filter, search]);

  useEffect(() => {
    fetchChats();
    fetchTemplates();
    loadCrmCustomers();
  }, [filter]);

  // ─── Real-Time Live Sync (Har 2 soniyada yangi xabarlarni avtomatik qabul qilish) ───
  useEffect(() => {
    if (!realtimeActive) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        syncChatList();
        if (activeChat?.id) {
          syncChatMessages(activeChat.id);
        }
      }
    }, 2000); // 2 soniya

    return () => clearInterval(interval);
  }, [realtimeActive, activeChat?.id, syncChatList, syncChatMessages]);

  // Faol buyurtmalarni yuklash
  useEffect(() => {
    if (activeChat?.clientName) {
      fetch(`/api/v1/production/work-orders?customer=${encodeURIComponent(activeChat.clientName)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setClientActiveOrders(json.data);
          } else {
            setClientActiveOrders([]);
          }
        })
        .catch(() => setClientActiveOrders([]));
    } else {
      setClientActiveOrders([]);
    }
  }, [activeChat]);

  // Avtomatik pastga tushish (scroll to bottom)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectChat = (chat: TelegramChatListItem) => {
    setActiveChat(chat);
    setSelectedClientId(chat.clientId || "");
    setSelectedManager(chat.assignedUserId || "");
    setGroupChatSettings(
      chat.settings || {
        notifyOrderCreated: true,
        notifyProofReady: true,
        notifyProductionDone: true,
        notifyPaymentReminder: false,
      }
    );
    fetchMessages(chat.id);
  };

  // Xabar yuborish
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !activeChat || sendingMessage) return;

    try {
      setSendingMessage(true);
      const res = await fetch("/api/v1/crm/telegram/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChat.id,
          text,
          senderName: "PrintGoo Menejer",
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMessages((prev) => [...prev, json.data]);
        setInputText("");
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChat.id
              ? {
                  ...c,
                  lastMessageSnippet: text.slice(0, 150),
                  lastMessageAt: new Date().toISOString(),
                  isSlaBreached: false,
                  unansweredSince: null,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error("handleSendMessage error:", err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Guruhni mijozga biriktirish
  const handleLinkClient = async () => {
    if (!activeChat || !selectedClientId) return;
    try {
      const res = await fetch("/api/v1/crm/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChat.id,
          clientId: selectedClientId,
          assignedUserId: "manager_1",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLinkingDialogOpen(false);
        fetchChats();
        if (activeChat) {
          fetchMessages(activeChat.id);
        }
      }
    } catch (err) {
      console.error("handleLinkClient error:", err);
    }
  };

  // Xabarni Qoralama Buyurtmaga (Work Order) aylantirish
  const handleCreateDraftOrder = (msg: TelegramMessageItem) => {
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const draftWoId = `draft-wo-${Date.now()}`;

    let guessedQty = 5000;
    let guessedProduct = "Chop etish buyurtmasi";
    if (msg.text) {
      const qtyMatch = msg.text.match(/(\d+[\d\s,.]*)\s*(dona|ta|sht|pcs|ming)/i);
      if (qtyMatch) {
        const raw = qtyMatch[1].replace(/[\s,.]/g, "");
        const num = parseInt(raw, 10);
        if (!isNaN(num)) guessedQty = qtyMatch[2].toLowerCase() === "ming" ? num * 1000 : num;
      }
      if (msg.text.toLowerCase().includes("yorliq") || msg.text.toLowerCase().includes("etiketka")) {
        guessedProduct = "Samokleyka flekso yorliq";
      } else if (msg.text.toLowerCase().includes("quti") || msg.text.toLowerCase().includes("korobka")) {
        guessedProduct = "Gofra karton qadoq";
      }
    }

    openTab({
      id: draftWoId,
      title: `Yangi: ${guessedProduct} (Qoralama)`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "",
        orderType: "Production",
        customer: activeChat?.clientName || activeChat?.title || "",
        product: guessedProduct,
        department: "Flexo",
        quantity: guessedQty,
        unit: "pcs",
        status: "Draft",
        priority: "Normal",
        startDate: today,
        deadline: nextWeek,
        currency: "UZS",
        notes: `Telegram orqali kelgan so'rov:\n"${msg.text || msg.mediaFileName || ""}"\nGuruh: ${activeChat?.title}`,
      },
    });
  };

  const handleCopyText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addNotification({
      title: "Nusxalandi",
      description: t("copiedSuccess"),
      severity: "info",
    });
  };

  const handleReplyMessage = (msg: TelegramMessageItem) => {
    const quote = msg.text
      ? `» ${msg.senderName || "Mijoz"}: ${msg.text.length > 60 ? msg.text.slice(0, 60) + "..." : msg.text}\n`
      : `» Fayl: ${msg.mediaFileName || "Hujjat"}\n`;
    setInputText((prev) => (prev ? `${quote}${prev}` : quote));
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div ref={containerRef} className="flex-1 flex h-full min-h-0 bg-background text-foreground overflow-hidden font-sans select-none">
      {/* ─── 1-USTUN: Guruhlar va Chatlar Ro'yxati (Chap Panel) ─────────── */}
      <div 
        style={{ width: `${leftWidth}px` }}
        className="flex flex-col border-r border-border bg-card shrink-0 relative"
      >
        {/* Yuqori boshqaruv va qidiruv */}
        <div className="p-2.5 border-b border-border space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{t("title")}</span>
              <Badge variant="secondary" className="h-4 text-[10px] px-1 font-mono">
                {chats.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider delay={200}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={fetchChats}
                      >
                        <RefreshCw className={cn("w-3 h-3", loadingChats && "animate-spin")} />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" className="text-xs">
                    Yangilash
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Qidiruv maydoni (shadcn InputGroup) */}
          <InputGroup className="h-8 bg-background border-input">
            <InputGroupAddon align="inline-start" className="pl-2.5 text-muted-foreground">
              <Search className="w-3.5 h-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchChats()}
              placeholder={t("searchPlaceholder")}
              className="text-xs h-full"
            />
            {search && (
              <InputGroupAddon align="inline-end" className="pr-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    fetchChats();
                  }}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </InputGroupAddon>
            )}
          </InputGroup>

          {/* Filter tabs (shadcn Tabs) */}
          <Tabs value={filter} onValueChange={(val) => setFilter(val as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-7 p-0.5 bg-muted">
              <TabsTrigger value="all" className="text-[10px] h-6 px-1">
                {t("filterAll")}
              </TabsTrigger>
              <TabsTrigger
                value="sla_breach"
                className="text-[10px] h-6 px-1 gap-1 text-red-500 data-[state=active]:text-red-500"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                SLA
              </TabsTrigger>
              <TabsTrigger value="unlinked" className="text-[10px] h-6 px-1">
                {t("filterUnlinked")}
              </TabsTrigger>
              <TabsTrigger value="active" className="text-[10px] h-6 px-1">
                {t("filterActive")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Guruhlar ro'yxati (shadcn Item & ItemGroup) */}
        <ScrollArea className="flex-1">
          {chats.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-48 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p>{t("noChats")}</p>
              <p className="text-[11px] text-muted-foreground/70 max-w-[200px]">
                Telegram bot guruhga qo'shilgach xabarlar bu yerda avtomatik ko'rinadi
              </p>
            </div>
          ) : (
            <ItemGroup className="p-2 gap-1.5">
              {chats.map((c) => {
                const isSelected = activeChat?.id === c.id;
                return (
                  <Item
                    key={c.id}
                    onClick={() => selectChat(c)}
                    className={cn(
                      "cursor-pointer select-none transition-all p-2.5 rounded-lg border",
                      isSelected
                        ? "bg-accent/80 border-border text-foreground shadow-2xs font-medium"
                        : "border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                      c.isSlaBreached && !isSelected && "bg-destructive/5 hover:bg-destructive/10"
                    )}
                  >
                    <ItemMedia
                      variant="image"
                      className="relative size-9 p-0 bg-transparent shrink-0"
                    >
                      <Avatar className="size-9 border border-border/60">
                        {c.photoUrl && (
                          <AvatarImage
                            src={c.photoUrl}
                            alt={c.title}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {c.title ? c.title.slice(0, 2).toUpperCase() : "TG"}
                        </AvatarFallback>
                      </Avatar>
                      {c.isSlaBreached && (
                        <span
                          title={t("slaBreached")}
                          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse"
                        />
                      )}
                    </ItemMedia>

                    <ItemContent className="min-w-0 flex-1 gap-1">
                      <ItemHeader className="flex items-center justify-between gap-1 w-full">
                        <ItemTitle className="text-xs font-semibold text-foreground truncate max-w-[145px]">
                          {c.title}
                        </ItemTitle>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {formatTime(c.lastMessageAt)}
                        </span>
                      </ItemHeader>

                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate flex items-center gap-1">
                          {c.clientName ? (
                            <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium truncate">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{c.clientName}</span>
                            </span>
                          ) : (
                            <Badge
                              variant="outline"
                              className="h-4 text-[9px] px-1 py-0 font-normal border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                            >
                              {t("unlinkedBadge")}
                            </Badge>
                          )}
                        </span>

                        {c.unreadCount > 0 && (
                          <Badge
                            variant="default"
                            className="h-4 min-w-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0"
                          >
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>

                      <ItemDescription className="text-[11px] text-muted-foreground truncate line-clamp-1 block w-full mt-0.5">
                        {c.lastMessageSnippet || "..."}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                );
              })}
            </ItemGroup>
          )}
        </ScrollArea>
      </div>

      {/* Resize Handle for Left Panel (Telegram UI rail) */}
      <div
        onMouseDown={handleLeftResizeStart}
        onDoubleClick={handleLeftReset}
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "relative z-20 flex w-2 -ml-1 -mr-1 items-center justify-center cursor-col-resize select-none shrink-0 group transition-colors",
          "after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2 after:w-[2px] after:transition-colors",
          "hover:after:bg-primary/50",
          isLeftResizing && "after:bg-primary"
        )}
        title="O'lchamni o'zgartirish uchun suring (2 marta bosish: 320px)"
      >
        <div
          className={cn(
            "z-10 h-6 w-1 shrink-0 rounded-full transition-all",
            isLeftResizing ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-primary/70"
          )}
        />
      </div>

      {/* ─── 2-USTUN: Chat Muloqot Oynasi (Markaziy Panel) ───────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {activeChat ? (
          <>
            {/* Chat sarlavhasi (Header) */}
            <div className="h-12 border-b border-border px-3 flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-8 border border-border/60 shrink-0">
                  {activeChat.photoUrl && (
                    <AvatarImage
                      src={activeChat.photoUrl}
                      alt={activeChat.title}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    {activeChat.title ? activeChat.title.slice(0, 2).toUpperCase() : "TG"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold text-xs truncate text-foreground">
                      {activeChat.title}
                    </h2>
                    {activeChat.isSlaBreached && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] h-4 px-1 gap-0.5 animate-pulse"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {t("slaBreached")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span>Chat ID: {activeChat.chatId}</span>
                    {activeChat.clientName && (
                      <>
                        <span>•</span>
                        <span className="text-foreground font-sans truncate max-w-[140px]">
                          {activeChat.clientName}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setRealtimeActive(!realtimeActive)}
                      className={cn(
                        "inline-flex items-center gap-1 text-[9px] font-sans px-1.5 py-0.5 rounded transition-colors cursor-pointer",
                        realtimeActive
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                          : "text-muted-foreground bg-muted"
                      )}
                      title={realtimeActive ? "Real-time yangilanish faol (2s) - to'xtatish uchun bosing" : "Real-time to'xtatilgan - yoqish uchun bosing"}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", realtimeActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400")} />
                      <span>{realtimeActive ? "Jonli (Real-time)" : "Pauza"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* O'ng taraf amallari */}
              <div className="flex items-center gap-1">
                <TooltipProvider delay={200}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (activeChat?.id) syncChatMessages(activeChat.id);
                            syncChatList();
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="text-xs">
                      Yangilash
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant={showRightPanel ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setShowRightPanel((prev) => !prev)}
                          className={cn(
                            "h-7 w-7 cursor-pointer transition-colors",
                            showRightPanel
                              ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {showRightPanel ? (
                            <PanelRightClose className="w-3.5 h-3.5" />
                          ) : (
                            <PanelRightOpen className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="text-xs">
                      {showRightPanel ? t("hidePanel") : t("showPanel")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Xabarlar lentasi (shadcn message-scroller + message + bubble) */}
            <div className="flex-1 relative min-h-0 flex flex-col overflow-hidden bg-background">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-48 text-xs text-muted-foreground gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Xabarlar yuklanmoqda...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 p-12 text-xs text-muted-foreground gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <span>Ushbu guruhda xabarlar mavjud emas</span>
                </div>
              ) : (
                <MessageScrollerProvider>
                  <MessageScroller className="flex-1">
                    <MessageScrollerViewport className="p-3">
                      <MessageScrollerContent className="max-w-3xl mx-auto gap-3.5 pb-2">
                        {messages.map((m) => (
                          <MessageScrollerItem key={m.id} messageId={m.id}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="cursor-context-menu select-text">
                                  <Message align={m.isOutgoing ? "end" : "start"} className="gap-2.5">
                                    <Avatar className="size-7 shrink-0 self-end border border-border/50">
                                      {!m.isOutgoing && m.senderAvatarUrl && (
                                        <AvatarImage
                                          src={m.senderAvatarUrl}
                                          alt={m.senderName || "Sender"}
                                          className="object-cover"
                                        />
                                      )}
                                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">
                                        {m.isOutgoing ? "OP" : (m.senderName ? m.senderName.slice(0, 2).toUpperCase() : "TG")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <MessageContent>
                                      <MessageHeader className={cn("px-1 gap-1.5 items-center", m.isOutgoing && "justify-end")}>
                                        {m.isOutgoing ? (
                                          <>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger
                                                render={
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 rounded-full opacity-0 group-hover/message:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 cursor-pointer mr-0.5"
                                                    title="Amallar"
                                                  >
                                                    <MoreHorizontal className="w-3 h-3" />
                                                  </Button>
                                                }
                                              />
                                              <DropdownMenuContent align="end" className="w-52 text-xs">
                                                <DropdownMenuItem
                                                  onClick={() => handleCreateDraftOrder(m)}
                                                  className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-950/40"
                                                >
                                                  <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                  <span>{t("createDraftOrder")}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {m.text && (
                                                  <DropdownMenuItem
                                                    onClick={() => handleCopyText(m.text || "")}
                                                    className="cursor-pointer gap-2"
                                                  >
                                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span>{t("copyText")}</span>
                                                  </DropdownMenuItem>
                                                )}
                                                {m.mediaFileName && (
                                                  <DropdownMenuItem
                                                    onClick={() => handleCopyText(m.mediaFileName || "")}
                                                    className="cursor-pointer gap-2"
                                                  >
                                                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span>Fayl nomini nusxalash</span>
                                                  </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                  onClick={() => handleReplyMessage(m)}
                                                  className="cursor-pointer gap-2"
                                                >
                                                  <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                                                  <span>{t("reply")}</span>
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>

                                            <span className="font-mono text-[10px]">{formatTime(m.sentAt)}</span>
                                            <span>•</span>
                                            <span className="font-semibold text-foreground/80">{m.senderName || "Operator"}</span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="font-semibold text-foreground/80">{m.senderName}</span>
                                            <span>•</span>
                                            <span className="font-mono text-[10px]">{formatTime(m.sentAt)}</span>

                                            <DropdownMenu>
                                              <DropdownMenuTrigger
                                                render={
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-4 rounded-full opacity-0 group-hover/message:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 cursor-pointer ml-0.5"
                                                    title="Amallar"
                                                  >
                                                    <MoreHorizontal className="w-3 h-3" />
                                                  </Button>
                                                }
                                              />
                                              <DropdownMenuContent align="start" className="w-52 text-xs">
                                                <DropdownMenuItem
                                                  onClick={() => handleCreateDraftOrder(m)}
                                                  className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-950/40"
                                                >
                                                  <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                  <span>{t("createDraftOrder")}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {m.text && (
                                                  <DropdownMenuItem
                                                    onClick={() => handleCopyText(m.text || "")}
                                                    className="cursor-pointer gap-2"
                                                  >
                                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span>{t("copyText")}</span>
                                                  </DropdownMenuItem>
                                                )}
                                                {m.mediaFileName && (
                                                  <DropdownMenuItem
                                                    onClick={() => handleCopyText(m.mediaFileName || "")}
                                                    className="cursor-pointer gap-2"
                                                  >
                                                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span>Fayl nomini nusxalash</span>
                                                  </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                  onClick={() => handleReplyMessage(m)}
                                                  className="cursor-pointer gap-2"
                                                >
                                                  <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                                                  <span>{t("reply")}</span>
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </>
                                        )}
                                      </MessageHeader>

                                      <Bubble
                                        variant={m.isOutgoing ? "default" : "secondary"}
                                        align={m.isOutgoing ? "end" : "start"}
                                        className="shadow-xs"
                                      >
                                        <BubbleContent className="p-2.5 text-xs">
                                          {m.mediaType === "document" && (
                                            <div
                                              className={cn(
                                                "flex items-center gap-2 p-2 rounded-md mb-2 border text-xs",
                                                m.isOutgoing
                                                  ? "bg-primary-foreground/15 border-primary-foreground/20 text-primary-foreground"
                                                  : "bg-card border-border text-foreground"
                                              )}
                                            >
                                              <FileText className="w-5 h-5 shrink-0 text-amber-500" />
                                              <div className="min-w-0 flex-1">
                                                <p className="font-semibold truncate text-[11px]">
                                                  {m.mediaFileName || "Maket fayli.pdf"}
                                                </p>
                                                <p className="text-[9px] opacity-80 font-mono">
                                                  {m.mediaFileSize
                                                    ? `${(m.mediaFileSize / (1024 * 1024)).toFixed(2)} MB`
                                                    : "PDF Document"}
                                                </p>
                                              </div>
                                            </div>
                                          )}

                                          {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                                        </BubbleContent>
                                      </Bubble>
                                    </MessageContent>
                                  </Message>
                                </div>
                              </ContextMenuTrigger>

                              <ContextMenuContent className="w-52 text-xs">
                                <ContextMenuItem
                                  onClick={() => handleCreateDraftOrder(m)}
                                  className="cursor-pointer gap-2 font-medium text-blue-600 dark:text-blue-400 focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-950/40"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>{t("createDraftOrder")}</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                {m.text && (
                                  <ContextMenuItem
                                    onClick={() => handleCopyText(m.text || "")}
                                    className="cursor-pointer gap-2"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>{t("copyText")}</span>
                                  </ContextMenuItem>
                                )}
                                {m.mediaFileName && (
                                  <ContextMenuItem
                                    onClick={() => handleCopyText(m.mediaFileName || "")}
                                    className="cursor-pointer gap-2"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Fayl nomini nusxalash</span>
                                  </ContextMenuItem>
                                )}
                                <ContextMenuItem
                                  onClick={() => handleReplyMessage(m)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{t("reply")}</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </MessageScrollerItem>
                        ))}
                        <div ref={messagesEndRef} />
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton direction="end" className="bottom-3" />
                  </MessageScroller>
                </MessageScrollerProvider>
              )}
            </div>

            {/* Pastki xabar yozish maydoni */}
            <div className="p-2.5 border-t border-border bg-card shrink-0 space-y-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 gap-1 cursor-pointer shrink-0 border-blue-500/30 text-blue-600 dark:text-blue-400"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        {t("quickReplies")}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuLabel className="text-xs">
                      {t("quickReplies")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {templates.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        onClick={() => handleSendMessage(tpl.content)}
                        className="text-xs cursor-pointer flex flex-col items-start py-1.5"
                      >
                        <span className="font-semibold text-[11px] text-foreground">
                          {tpl.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate w-full">
                          {tpl.content}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {templates.slice(0, 3).map((tpl) => (
                  <Button
                    key={tpl.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSendMessage(tpl.content)}
                    className="h-6 text-[10px] px-2 cursor-pointer bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 truncate max-w-[200px]"
                  >
                    {tpl.title}
                  </Button>
                ))}
              </div>

              <InputGroup className="h-9 bg-background focus-within:ring-1 focus-within:ring-ring border-border">
                <InputGroupInput
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={t("typeMessage")}
                  className="text-xs h-full"
                />
                <InputGroupAddon align="inline-end" className="pr-1">
                  <InputGroupButton
                    size="xs"
                    variant="default"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || sendingMessage}
                    className="h-7 px-2.5 gap-1.5 cursor-pointer font-medium text-xs rounded-md shadow-xs"
                  >
                    <Send className={cn("w-3 h-3", sendingMessage && "animate-pulse")} />
                    <span>{t("send")}</span>
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 space-y-2">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-xs">{t("noChatSelected")}</p>
          </div>
        )}
      </div>

      {/* ─── 3-USTUN: Guruh & Mijoz Ma'lumotlari & Sozlamalar (O'ng Panel) ─── */}
      {activeChat && showRightPanel && (
        <>
          {/* Resize Handle for Right Panel (Telegram UI rail) */}
          <div
            onMouseDown={handleRightResizeStart}
            onDoubleClick={handleRightReset}
            role="separator"
            aria-orientation="vertical"
            className={cn(
              "relative z-20 flex w-2 -ml-1 -mr-1 items-center justify-center cursor-col-resize select-none shrink-0 group transition-colors",
              "after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2 after:w-[2px] after:transition-colors",
              "hover:after:bg-primary/50",
              isRightResizing && "after:bg-primary"
            )}
            title="O'lchamni o'zgartirish uchun suring (2 marta bosish: 320px)"
          >
            <div
              className={cn(
                "z-10 h-6 w-1 shrink-0 rounded-full transition-all",
                isRightResizing ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-primary/70"
              )}
            />
          </div>

          <div 
            style={{ width: `${rightWidth}px` }}
            className="flex flex-col border-l border-border bg-card shrink-0 p-3 space-y-3.5 overflow-y-auto animate-in fade-in-50 duration-150"
          >
          {/* 1. Guruh ma'lumotlari */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>{t("groupDetails")}</span>
              </div>
              <TooltipProvider delay={200}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowRightPanel(false)}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted"
                      >
                        <PanelRightClose className="w-3.5 h-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent side="left" className="text-xs">
                    {t("hidePanel")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px]">Guruh:</span>
                <span className="font-semibold text-right truncate max-w-[170px] text-[11px]">
                  {activeChat.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px]">Turi:</span>
                <span className="font-mono text-[10px] uppercase text-foreground">
                  {activeChat.type}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-[10px]">Chat ID:</span>
                <div className="flex items-center gap-1 font-mono text-[10px] text-foreground">
                  <span>{activeChat.chatId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeChat.chatId) return;
                      navigator.clipboard.writeText(activeChat.chatId);
                      setCopiedChatId(true);
                      setTimeout(() => setCopiedChatId(false), 2000);
                    }}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Nusxa olish"
                  >
                    {copiedChatId ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px]">Holat:</span>
                <span className="font-mono text-[10px]">
                  {activeChat.status === "active" ? (
                    <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-[9px] h-4 px-1">
                      Faol
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 text-[9px] h-4 px-1">
                      Bog'lanmagan
                    </Badge>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Bog'langan mijoz */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>{t("linkedCustomer")}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedClientId(activeChat.clientId || crmCustomers[0]?.id || "");
                  setLinkingDialogOpen(true);
                }}
                className="h-5 text-[10px] px-1.5 text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-500/10"
              >
                {activeChat.clientId ? "O'zgartirish" : "Biriktirish"}
              </Button>
            </div>

            {activeChat.clientName ? (
              <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5 text-xs">
                <div className="font-semibold text-[11px] text-foreground">
                  {activeChat.clientName}
                </div>
                {activeChat.clientCode && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Kodi:</span>
                    <span className="font-mono text-foreground">{activeChat.clientCode}</span>
                  </div>
                )}
                {activeChat.clientPhone && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Telefon:</span>
                    <span className="font-mono text-foreground">{activeChat.clientPhone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 text-center border border-dashed border-border rounded-md text-[11px] text-muted-foreground space-y-1.5">
                <p>Ushbu guruh hali ERP mijoziga biriktirilmagan</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedClientId(crmCustomers[0]?.id || "");
                    setLinkingDialogOpen(true);
                  }}
                  className="h-6 text-[10px] px-2 gap-1 cursor-pointer border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <Link2 className="w-2.5 h-2.5" />
                  {t("linkClient")}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* 3. Guruh Sozlamalari & Xabarnomalar */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-500" />
                <span>Guruh sozlamalari</span>
              </div>
              {savingGroupSettings && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Saqlanmoqda...
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-2.5 text-xs">
              {/* Mas'ul menejer */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">
                  {t("assignedManager")}:
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateManager(selectedManager)}
                    placeholder="Menejer ismi..."
                    className="h-7 text-xs bg-background"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateManager(selectedManager)}
                    disabled={savingGroupSettings}
                    className="h-7 px-2 text-[10px] cursor-pointer shrink-0"
                    title="Menejerni saqlash"
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <Separator className="my-1" />

              {/* Xabarnomalar ro'yxati */}
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Avtomatik xabarnomalar
                </span>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-medium block text-foreground">Yangi buyurtma</span>
                      <span className="text-[9px] text-muted-foreground block leading-tight">
                        Work order ochilganda
                      </span>
                    </div>
                    <Switch
                      checked={groupChatSettings.notifyOrderCreated ?? true}
                      onCheckedChange={(checked) => handleToggleSetting("notifyOrderCreated", checked)}
                      disabled={savingGroupSettings}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-medium block text-foreground">Maket / Proof tasdiqlash</span>
                      <span className="text-[9px] text-muted-foreground block leading-tight">
                        Tasdiqlash so&apos;rovi yuborish
                      </span>
                    </div>
                    <Switch
                      checked={groupChatSettings.notifyProofReady ?? true}
                      onCheckedChange={(checked) => handleToggleSetting("notifyProofReady", checked)}
                      disabled={savingGroupSettings}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-medium block text-foreground">Buyurtma tayyor</span>
                      <span className="text-[9px] text-muted-foreground block leading-tight">
                        Ishlab chiqarish yakunida
                      </span>
                    </div>
                    <Switch
                      checked={groupChatSettings.notifyProductionDone ?? true}
                      onCheckedChange={(checked) => handleToggleSetting("notifyProductionDone", checked)}
                      disabled={savingGroupSettings}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-medium block text-foreground">To&apos;lov eslatmasi</span>
                      <span className="text-[9px] text-muted-foreground block leading-tight">
                        To&apos;lov muddati kelganda
                      </span>
                    </div>
                    <Switch
                      checked={groupChatSettings.notifyPaymentReminder ?? false}
                      onCheckedChange={(checked) => handleToggleSetting("notifyPaymentReminder", checked)}
                      disabled={savingGroupSettings}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 4. Mijozning faol buyurtmalari & Guruhga status yuborish */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>{t("activeOrders")}</span>
              </div>
              <Badge variant="secondary" className="h-4 text-[9px] px-1 font-mono">
                {clientActiveOrders.length}
              </Badge>
            </div>

            {clientActiveOrders.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-muted-foreground border border-dashed border-border rounded-md">
                Faol ishlab chiqarish buyurtmalari topilmadi
              </div>
            ) : (
              <div className="space-y-2">
                {clientActiveOrders.slice(0, 5).map((wo: ClientActiveOrder) => (
                  <div
                    key={wo.docNo}
                    className="p-2 rounded-md border border-border bg-muted/30 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[10px]">
                        {wo.docNo}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-4 px-1",
                          wo.stage === "Completed" && "text-emerald-600 border-emerald-500/20 bg-emerald-500/10",
                          wo.stage === "In Production" && "text-blue-600 border-blue-500/20 bg-blue-500/10"
                        )}
                      >
                        {wo.stage}
                      </Badge>
                    </div>
                    <p className="text-[11px] truncate text-foreground font-medium">
                      {wo.product}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                      <span>{wo.quantity?.toLocaleString()} dona</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleSendMessage(
                            `📋 Buyurtma holati: #${wo.docNo}\nMahsulot: ${wo.product}\nBosqich: ${wo.stage}\nTiraj: ${wo.quantity} dona`
                          )
                        }
                        className="h-5 text-[9px] px-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                        title="Guruhga ushbu buyurtma statusini yuborish"
                      >
                        <Send className="w-2.5 h-2.5 mr-1" />
                        Status jo'natish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* ─── Mijozga biriktirish Dialog (Modal) ─────────────────────────── */}
      <Dialog open={linkingDialogOpen} onOpenChange={setLinkingDialogOpen}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-blue-500" />
              {t("linkClient")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground text-[11px]">
              Guruh: <strong className="text-foreground">{activeChat?.title}</strong>
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t("selectClient")}
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Mijozni tanlang --</option>
                {crmCustomers.map((c: CrmCustomerRecord) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-1 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinkingDialogOpen(false)}
              className="h-7 text-xs cursor-pointer"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleLinkClient}
              disabled={!selectedClientId}
              className="h-7 text-xs cursor-pointer bg-primary text-primary-foreground font-semibold"
            >
              {t("linkClient")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
