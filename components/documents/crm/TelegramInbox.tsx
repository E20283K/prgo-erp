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
  Truck,
  FileText,
  PlusCircle,
  RefreshCw,
  Link2,
  MessageSquare,
  Info,
  Layers,
  Settings,
  Sliders,
  Check,
  Copy,
  Radio,
  Activity,
  X,
  MoreHorizontal,
  Reply,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
  UserX,
  ChevronsUpDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
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
  username?: string | null;
  photoUrl?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  clientCode?: string | null;
  clientPhone?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCode?: string | null;
  supplierCategory?: string | null;
  chatCategory?: string | null;
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

interface ClientActiveOrder {
  docNo: string;
  product: string;
  stage: string;
  quantity: number;
}

function OrderStageBadge({ stage }: { stage: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-4 shrink-0 px-1 text-[10px] font-normal",
        stage === "Completed" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        stage === "In Production" && "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      )}
    >
      {stage}
    </Badge>
  );
}

function managerInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function TelegramInbox() {
  const t = useTranslations("TelegramInbox");
  const {
    openTab,
    crmCustomers,
    loadCrmCustomers,
    suppliers,
    loadSuppliers,
    addNotification,
    activeTelegramChatId,
    setActiveTelegramChatId,
    users,
    isUsersLoading,
    fetchUsers,
  } = useWorkspaceStore();

  const [chats, setChats] = useState<TelegramChatListItem[]>([]);
  const [activeChat, setActiveChat] = useState<TelegramChatListItem | null>(null);
  const [messages, setMessages] = useState<TelegramMessageItem[]>([]);
  const composerRef = useRef<HTMLInputElement>(null);
  const [botInfo, setBotInfo] = useState<{ avatarUrl?: string; firstName?: string; username?: string }>({
    avatarUrl: "/cache/telegram/avatars/bot.jpg",
    firstName: "PrintGoo Support",
    username: "printgoo_supportbot",
  });
  const [clientActiveOrders, setClientActiveOrders] = useState<ClientActiveOrder[]>([]);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState("");
  const filteredActiveOrders = (() => {
    const q = ordersSearch.trim().toLowerCase();
    if (!q) return clientActiveOrders;
    return clientActiveOrders.filter((o) =>
      [o.docNo, o.product, o.stage].some((v) => v?.toLowerCase().includes(q))
    );
  })();
  const [filter, setFilter] = useState<"all" | "unlinked" | "sla_breach" | "active">("all");
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [linkingDialogOpen, setLinkingDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [linkTargetType, setLinkTargetType] = useState<"client" | "supplier">("client");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const [groupChatSettings, setGroupChatSettings] = useState<TelegramChatSettings>({
    notifyOrderCreated: true,
    notifyProofReady: true,
    notifyProductionDone: true,
    notifyPaymentReminder: false,
  });
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const assignedManagerUser = activeChat?.assignedUserId
    ? users.find((u) => u.id === activeChat.assignedUserId)
    : undefined;
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);

  // Panel o'lchamlarini boshqarish (Telegram UI uslubidagi Resizable Rail)
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number>(320);
  const [rightWidth, setRightWidth] = useState<number>(320);
  const [isLeftResizing, setIsLeftResizing] = useState(false);
  const [isRightResizing, setIsRightResizing] = useState(false);

  useEffect(() => {
    try {
      const savedLeftCollapsed = localStorage.getItem("printgoo_tg_left_collapsed");
      if (savedLeftCollapsed === "true") {
        setIsLeftCollapsed(true);
      }
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

  const toggleLeftCollapse = () => {
    setIsLeftCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("printgoo_tg_left_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLeftResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawWidth = moveEvent.clientX - rect.left;

      if (rawWidth < 140) {
        setIsLeftCollapsed(true);
        try {
          localStorage.setItem("printgoo_tg_left_collapsed", "true");
        } catch {}
        return;
      }

      setIsLeftCollapsed(false);
      try {
        localStorage.setItem("printgoo_tg_left_collapsed", "false");
      } catch {}

      const newWidth = Math.min(Math.max(rawWidth, 240), 560);
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
        const rawWidth = upEvent.clientX - rect.left;
        if (rawWidth >= 140) {
          const finalWidth = Math.min(Math.max(rawWidth, 240), 560);
          try {
            localStorage.setItem("printgoo_tg_left_width", finalWidth.toString());
          } catch {}
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleLeftReset = () => {
    if (isLeftCollapsed) {
      setIsLeftCollapsed(false);
      try {
        localStorage.setItem("printgoo_tg_left_collapsed", "false");
      } catch {}
    } else {
      setLeftWidth(320);
      try {
        localStorage.setItem("printgoo_tg_left_width", "320");
      } catch {}
    }
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
        const preferredChat = activeTelegramChatId
          ? json.data.find(
              (c: any) =>
                c.id === activeTelegramChatId ||
                c.chatId === activeTelegramChatId ||
                String(c.chatId) === String(activeTelegramChatId)
            )
          : null;
        if (preferredChat) {
          selectChat(preferredChat);
        } else if (json.data.length > 0 && !activeChat) {
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
        if (json.bot) {
          setBotInfo((prev) => ({ ...prev, ...json.bot }));
        }
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

  // 4. Orqa fonda jimjit sinxronizatsiya (flickersiz, loading spinnersiz)
  const syncChatMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/v1/crm/telegram/messages?chatId=${chatId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        if (json.bot) {
          setBotInfo((prev) => ({ ...prev, ...json.bot }));
        }
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
    loadCrmCustomers();
    loadSuppliers();
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Faol chat almashganda kursor darrov yozish maydonida bo'lsin
  const activeChatId = activeChat?.id;
  useEffect(() => {
    if (!activeChatId) return;
    const id = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [activeChatId]);

  // Boshqa joyda turganda harf bosilsa — yozish maydoniga qaytaramiz
  useEffect(() => {
    if (!activeChatId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true'], [role='menu'], [role='listbox']")
      ) {
        return;
      }
      if (document.querySelector("[data-slot='dialog-content'], [data-slot='popover-content']")) return;
      const input = composerRef.current;
      // Inbox yashirin tabda bo'lsa, boshqa modullar klaviaturasini tortib olmaymiz
      if (!input || input.offsetParent === null) return;
      input.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeChatId]);

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
  // Faqat guruhga biriktirilgan mijozning buyurtmalari
  const linkedClientId = activeChat?.clientId || "";
  const linkedClientName = activeChat?.clientName || "";
  useEffect(() => {
    setClientActiveOrders([]);
    if (!linkedClientId) return;

    let cancelled = false;
    const params = new URLSearchParams({ clientId: linkedClientId });
    if (linkedClientName) params.set("customer", linkedClientName);

    fetch(`/api/v1/production/work-orders?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setClientActiveOrders(json.success && Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {
        if (!cancelled) setClientActiveOrders([]);
      });

    return () => {
      cancelled = true;
    };
  }, [linkedClientId, linkedClientName]);

  // Avtomatik pastga tushish (scroll to bottom)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectChat = (chat: TelegramChatListItem) => {
    setActiveChat(chat);
    setActiveTelegramChatId(chat.id);
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

  // Agar tashqaridan (Toaster / Bildirishnoma orqali) ma'lum bir chat tanlansa
  useEffect(() => {
    if (activeTelegramChatId && chats.length > 0) {
      const target = chats.find(
        (c) =>
          c.id === activeTelegramChatId ||
          c.chatId === activeTelegramChatId ||
          String(c.chatId) === String(activeTelegramChatId)
      );
      if (target && target.id !== activeChat?.id) {
        selectChat(target);
      }
    }
  }, [activeTelegramChatId, chats, activeChat?.id]);

  // Tab yopilganda faol chat holatini tozalash
  useEffect(() => {
    return () => {
      setActiveTelegramChatId(null);
    };
  }, [setActiveTelegramChatId]);

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
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  };

  const handleSendOrderStatus = (wo: ClientActiveOrder) =>
    handleSendMessage(
      `📋 Buyurtma holati: #${wo.docNo}\nMahsulot: ${wo.product}\nBosqich: ${wo.stage}\nTiraj: ${wo.quantity} dona`
    );

  // Guruhni mijoz yoki yetkazib beruvchiga biriktirish
  const handleLinkTarget = async () => {
    if (!activeChat) return;
    if (linkTargetType === "client" && !selectedClientId) return;
    if (linkTargetType === "supplier" && !selectedSupplierId) return;

    try {
      const res = await fetch("/api/v1/crm/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChat.id,
          clientId: linkTargetType === "client" ? selectedClientId : undefined,
          supplierId: linkTargetType === "supplier" ? selectedSupplierId : undefined,
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
        addNotification({
          title: "Guruh biriktirildi",
          description:
            linkTargetType === "client"
              ? "Mijozga muvaffaqiyatli bog'landi"
              : "Yetkazib beruvchiga muvaffaqiyatli bog'landi",
          severity: "success",
        });
      } else {
        addNotification({
          title: "Biriktirishda xatolik",
          description: json.error || "Guruhni biriktirishda xatolik yuz berdi",
          severity: "error",
        });
      }
    } catch (err) {
      console.error("handleLinkTarget error:", err);
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
      isUnsaved: false,
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
      {isLeftCollapsed ? (
        <div 
          style={{ width: "64px" }}
          className="flex flex-col border-r border-border bg-card shrink-0 relative items-center py-2 transition-[width] duration-150 animate-in fade-in-50"
        >
          {/* Yuqori ochish tugmasi */}
          <div className="h-10 w-full flex items-center justify-center border-b border-border/60 pb-2 mb-2">
            <TooltipProvider delay={100}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleLeftCollapse}
                      className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    >
                      <PanelLeftOpen className="size-4 text-blue-500" />
                    </Button>
                  }
                />
                <TooltipContent side="right" className="text-xs">
                  {t("expandLeftPanel")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Chatlar faqat ikonkalari ro'yxati */}
          <ScrollArea className="flex-1 w-full">
            <div className="flex flex-col items-center gap-2.5 p-1.5">
              {chats.map((c) => {
                const isSelected = activeChat?.id === c.id;
                return (
                  <TooltipProvider key={c.id} delay={100}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => selectChat(c)}
                            className={cn(
                              "relative size-10 rounded-full flex items-center justify-center transition-all cursor-pointer",
                              isSelected
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                                : "hover:scale-105 opacity-85 hover:opacity-100",
                              c.isSlaBreached && !isSelected && "ring-1 ring-red-500/60"
                            )}
                          >
                            <Avatar className="size-10 border border-border/70">
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

                            {c.isSlaBreached ? (
                              <span
                                className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse"
                              />
                            ) : c.unreadCount > 0 ? (
                              <span
                                className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background"
                              >
                                {c.unreadCount > 9 ? "9+" : c.unreadCount}
                              </span>
                            ) : null}
                          </button>
                        }
                      />
                      <TooltipContent side="right" className="max-w-[220px] p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs truncate text-foreground">{c.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{formatTime(c.lastMessageAt)}</span>
                        </div>
                        {c.clientName && (
                          <div className="text-[11px] text-blue-500 font-medium flex items-center gap-1">
                            <Building2 className="size-3 shrink-0" />
                            <span className="truncate">{c.clientName}</span>
                          </div>
                        )}
                        {c.lastMessageSnippet && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {c.lastMessageSnippet}
                          </p>
                        )}
                        <div className="flex items-center gap-1 pt-0.5">
                          <Badge variant="secondary" className="text-[9px] uppercase font-mono px-1 py-0 h-3.5">
                            {c.type}
                          </Badge>
                          {c.isSlaBreached && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">
                              SLA 15+ min
                            </Badge>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div 
          style={{ width: `${leftWidth}px` }}
          className="flex flex-col border-r border-border bg-card shrink-0 relative transition-[width] duration-150 animate-in fade-in-50"
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
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={fetchChats}
                  title="Yangilash"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loadingChats && "animate-spin")} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={toggleLeftCollapse}
                  title={t("collapseLeftPanel")}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
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
              <TabsList className="w-full flex h-7 p-0.5 bg-muted gap-0.5">
                <TabsTrigger value="all" className="flex-1 text-[10px] h-6 px-1 truncate">
                  {t("filterAll")}
                </TabsTrigger>
                <TabsTrigger
                  value="sla_breach"
                  className="flex-1 text-[10px] h-6 px-1 gap-1 text-red-500 data-[state=active]:text-red-500 truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  SLA
                </TabsTrigger>
                <TabsTrigger value="unlinked" className="flex-1 text-[10px] h-6 px-1 truncate">
                  {t("filterUnlinked")}
                </TabsTrigger>
                <TabsTrigger value="active" className="flex-1 text-[10px] h-6 px-1 truncate">
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
                            ) : c.supplierName ? (
                              <span className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium truncate">
                                <Truck className="w-3 h-3 shrink-0" />
                                <span className="truncate">{c.supplierName}</span>
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
      )}

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
                          variant={settingsDialogOpen ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setSettingsDialogOpen(true)}
                          className={cn(
                            "h-7 w-7 cursor-pointer transition-colors",
                            settingsDialogOpen
                              ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          title={t("groupSettings")}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="text-xs">
                      {t("groupSettings")}
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
                                      {m.isOutgoing ? (
                                        <>
                                          <AvatarImage
                                            src={botInfo?.avatarUrl || m.senderAvatarUrl || "/cache/telegram/avatars/bot.jpg"}
                                            alt={botInfo?.firstName || "PrintGoo Support"}
                                            className="object-cover"
                                          />
                                          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                                            BOT
                                          </AvatarFallback>
                                        </>
                                      ) : (
                                        <>
                                          {m.senderAvatarUrl && (
                                            <AvatarImage
                                              src={m.senderAvatarUrl}
                                              alt={m.senderName || "Foydalanuvchi"}
                                              className="object-cover"
                                            />
                                          )}
                                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                            {m.senderName ? m.senderName.slice(0, 2).toUpperCase() : "TG"}
                                          </AvatarFallback>
                                        </>
                                      )}
                                    </Avatar>
                                    <MessageContent>
                                      <MessageHeader
                                        className={cn(
                                          "px-1 gap-1.5 items-center opacity-0 transition-opacity duration-150 group-hover/message:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100",
                                          m.isOutgoing && "justify-end"
                                        )}
                                      >
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
            <div className="p-2.5 border-t border-border bg-card shrink-0">
              <InputGroup className="h-9 bg-background focus-within:ring-1 focus-within:ring-ring border-border">
                <InputGroupInput
                  ref={composerRef}
                  autoFocus
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
          {/* Telegram Header Card (Avatar + Title + Type Badge + Settings Button) */}
          <div className="flex flex-col items-center text-center p-3.5 rounded-lg bg-muted/40 border border-border">
            <Avatar className="size-16 border-2 border-border/80 shadow-xs mb-2">
              {activeChat.photoUrl && (
                <AvatarImage
                  src={activeChat.photoUrl}
                  alt={activeChat.title}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {activeChat.title ? activeChat.title.slice(0, 2).toUpperCase() : "TG"}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-sm text-foreground truncate max-w-[240px]">
              {activeChat.title}
            </h3>
            {activeChat.username ? (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">@{activeChat.username}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{activeChat.chatId}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="secondary" className="text-[9px] uppercase font-mono px-1.5 py-0 h-4">
                {activeChat.type}
              </Badge>
              {activeChat.status === "active" ? (
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-[9px] h-4 px-1.5">
                  Faol
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 text-[9px] h-4 px-1.5">
                  Bog'lanmagan
                </Badge>
              )}
            </div>

            {/* Guruh sozlamalari tugmasi */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsDialogOpen(true)}
              className="mt-3 h-7 text-xs px-2.5 gap-1.5 w-full justify-center cursor-pointer border-border hover:bg-accent"
            >
              <Sliders className="size-3.5 text-blue-500" />
              <span>{t("groupSettings")}</span>
            </Button>
          </div>

          {/* 1. Guruh ma'lumotlari */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <span>{t("groupDetails")}</span>
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

          {/* 2. Bog'langan mijoz yoki ta'minotchi */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                {activeChat.supplierName ? (
                  <Truck className="w-3.5 h-3.5 text-purple-500" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span>{activeChat.supplierName ? "Biriktirilgan ta'minotchi" : t("linkedCustomer")}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (activeChat.supplierId) {
                    setLinkTargetType("supplier");
                    setSelectedSupplierId(activeChat.supplierId);
                  } else {
                    setLinkTargetType("client");
                    setSelectedClientId(activeChat.clientId || crmCustomers[0]?.dbId || crmCustomers[0]?.id || "");
                  }
                  setLinkingDialogOpen(true);
                }}
                className="h-5 text-[10px] px-1.5 text-primary cursor-pointer hover:bg-primary/10"
              >
                {activeChat.clientId || activeChat.supplierId ? "O'zgartirish" : "Biriktirish"}
              </Button>
            </div>

            {activeChat.clientName ? (
              <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span
                    onClick={() => {
                      if (activeChat.clientId) {
                        openTab({
                          id: activeChat.clientId,
                          title: activeChat.clientName || "Mijoz",
                          type: "customer",
                          module: "crm",
                        });
                      }
                    }}
                    className="font-semibold text-[11px] text-foreground hover:text-primary hover:underline cursor-pointer flex items-center gap-1 truncate max-w-[200px]"
                    title="Mijoz kartasini ochish"
                  >
                    {activeChat.clientName}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500/20">
                    Mijoz
                  </Badge>
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
            ) : activeChat.supplierName ? (
              <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span
                    onClick={() => {
                      if (activeChat.supplierId) {
                        openTab({
                          id: activeChat.supplierId,
                          title: activeChat.supplierName || "Ta'minotchi",
                          type: "supplier",
                          module: "crm",
                        });
                      }
                    }}
                    className="font-semibold text-[11px] text-foreground hover:text-primary hover:underline cursor-pointer flex items-center gap-1 truncate max-w-[200px]"
                    title="Ta'minotchi kartasini ochish"
                  >
                    {activeChat.supplierName}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-500/10 text-purple-600 border-purple-500/20">
                    Ta'minotchi
                  </Badge>
                </div>
                {activeChat.supplierCode && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Kodi:</span>
                    <span className="font-mono text-foreground">{activeChat.supplierCode}</span>
                  </div>
                )}
                {activeChat.supplierCategory && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Yo'nalishi:</span>
                    <span className="font-mono text-foreground">{activeChat.supplierCategory}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 text-center border border-dashed border-border rounded-md text-[11px] text-muted-foreground space-y-1.5">
                <p>Ushbu guruh hali ERP kontragentiga biriktirilmagan</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLinkTargetType("client");
                    setSelectedClientId(crmCustomers[0]?.dbId || crmCustomers[0]?.id || "");
                    setLinkingDialogOpen(true);
                  }}
                  className="h-6 text-[10px] px-2 gap-1 cursor-pointer border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <Link2 className="w-2.5 h-2.5" />
                  <span>Guruhni biriktirish</span>
                </Button>
              </div>
            )}
          </div>

          {/* 3. Mas'ul menejer */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-muted-foreground" />
                <span>{t("assignedManager")}</span>
              </div>
              {savingGroupSettings && (
                <RefreshCw className="size-3 animate-spin text-muted-foreground" />
              )}
            </div>

            <Popover open={managerPickerOpen} onOpenChange={setManagerPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={managerPickerOpen}
                    disabled={savingGroupSettings}
                    className="w-full h-8 justify-between px-2 text-xs font-normal bg-background"
                  />
                }
              >
                {assignedManagerUser || activeChat.assignedUserId ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-5">
                      {assignedManagerUser?.avatar && (
                        <AvatarImage src={assignedManagerUser.avatar} />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {managerInitials(assignedManagerUser?.fullName || activeChat.assignedUserId || "")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-foreground">
                      {assignedManagerUser?.fullName || activeChat.assignedUserId}
                    </span>
                    {assignedManagerUser?.role && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {assignedManagerUser.role}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Belgilanmagan</span>
                )}
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--anchor-width) min-w-64 p-0">
                <Command className="rounded-lg! p-0">
                  <CommandInput placeholder="Menejer qidirish" className="text-xs" />
                  <CommandList className="max-h-60 p-1">
                    <CommandEmpty>
                      {isUsersLoading ? "Yuklanmoqda" : "Topilmadi"}
                    </CommandEmpty>
                    {users
                      .filter((u) => u.status !== "Suspended")
                      .map((u) => {
                        const checked = activeChat.assignedUserId === u.id;
                        return (
                          <CommandItem
                            key={u.id}
                            value={`${u.fullName} ${u.username} ${u.role} ${u.id}`}
                            data-checked={checked}
                            onSelect={() => {
                              setManagerPickerOpen(false);
                              if (!checked) {
                                setSelectedManager(u.id);
                                handleUpdateManager(u.id);
                              }
                            }}
                            className="h-8 cursor-pointer"
                          >
                            <Avatar className="size-5">
                              {u.avatar && <AvatarImage src={u.avatar} />}
                              <AvatarFallback className="text-[9px]">
                                {managerInitials(u.fullName || u.username)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{u.fullName || u.username}</span>
                            {u.role && (
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {u.role}
                              </span>
                            )}
                          </CommandItem>
                        );
                      })}
                  </CommandList>
                  {activeChat.assignedUserId && (
                    <div className="border-t border-border p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setManagerPickerOpen(false);
                          setSelectedManager("");
                          handleUpdateManager("");
                        }}
                        className="h-7 w-full justify-start gap-2 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <UserX className="size-3.5" />
                        Olib tashlash
                      </Button>
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator />

          {/* 4. Mijozning faol buyurtmalari */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-muted-foreground" />
                <span>{t("activeOrders")}</span>
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono tabular-nums">
                  {clientActiveOrders.length}
                </Badge>
              </div>
              {clientActiveOrders.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrdersDialogOpen(true)}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Barchasi
                </Button>
              )}
            </div>

            {clientActiveOrders.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-md">
                Buyurtma yo'q
              </div>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                {clientActiveOrders.slice(0, 3).map((wo: ClientActiveOrder) => (
                  <div
                    key={wo.docNo}
                    className="group/order flex h-7 items-center gap-2 px-2 text-xs hover:bg-muted/50"
                    title={wo.product}
                  >
                    <span className="font-mono text-[11px] font-medium text-foreground shrink-0">
                      {wo.docNo}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground flex-1 min-w-0">
                      {wo.product}
                    </span>
                    <OrderStageBadge stage={wo.stage} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSendOrderStatus(wo)}
                      className="size-5 shrink-0 opacity-0 group-hover/order:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Statusni guruhga yuborish"
                    >
                      <Send className="size-3" />
                    </Button>
                  </div>
                ))}
                {clientActiveOrders.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setOrdersDialogOpen(true)}
                    className="flex h-7 w-full items-center justify-center text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
                  >
                    +{clientActiveOrders.length - 3}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* ─── Faol buyurtmalar Dialog (Modal) ─────────────────────────── */}
      <Dialog
        open={ordersDialogOpen}
        onOpenChange={(open) => {
          setOrdersDialogOpen(open);
          if (!open) setOrdersSearch("");
        }}
      >
        <DialogContent className="sm:max-w-2xl gap-3 p-4">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="size-4 text-muted-foreground" />
              {t("activeOrders")}
              <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono tabular-nums">
                {clientActiveOrders.length}
              </Badge>
            </DialogTitle>
            <DialogDescription className="truncate">{activeChat?.title}</DialogDescription>
          </DialogHeader>

          <InputGroup className="h-8">
            <InputGroupAddon>
              <Search className="size-3.5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={ordersSearch}
              onChange={(e) => setOrdersSearch(e.target.value)}
              placeholder="Raqam, mahsulot yoki bosqich"
              className="text-xs"
            />
          </InputGroup>

          <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="h-7 hover:bg-transparent">
                  <TableHead className="h-7 px-2 text-[11px]">Raqam</TableHead>
                  <TableHead className="h-7 px-2 text-[11px]">Mahsulot</TableHead>
                  <TableHead className="h-7 px-2 text-[11px]">Bosqich</TableHead>
                  <TableHead className="h-7 px-2 text-[11px] text-right">Tiraj</TableHead>
                  <TableHead className="h-7 w-8 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActiveOrders.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Topilmadi
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActiveOrders.map((wo) => (
                    <TableRow key={wo.docNo} className="group/row h-7">
                      <TableCell className="px-2 py-1 font-mono text-[11px] font-medium whitespace-nowrap">
                        {wo.docNo}
                      </TableCell>
                      <TableCell className="px-2 py-1 max-w-0 w-full truncate" title={wo.product}>
                        {wo.product}
                      </TableCell>
                      <TableCell className="px-2 py-1 whitespace-nowrap">
                        <OrderStageBadge stage={wo.stage} />
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                        {wo.quantity?.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-1 py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendOrderStatus(wo)}
                          disabled={sendingMessage}
                          className="size-6 text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                          title="Statusni guruhga yuborish"
                        >
                          <Send className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Guruh Sozlamalari Dialog (Modal) ─────────────────────────── */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-500" />
                <span>{t("groupSettings")}</span>
              </div>
              {savingGroupSettings && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Saqlanmoqda...
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {activeChat && (
              <div className="p-2 rounded-md bg-muted/40 border border-border text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guruh:</span>
                  <span className="font-semibold text-foreground truncate max-w-[250px]">{activeChat.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chat ID:</span>
                  <span className="font-mono text-foreground">{activeChat.chatId}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Avtomatik xabarnomalar
              </span>

              <div className="space-y-2.5 p-3 rounded-md border border-border bg-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium block text-foreground">Yangi buyurtma</span>
                    <span className="text-[9px] text-muted-foreground block leading-tight">
                      Work order ochilganda avtomatik xabar
                    </span>
                  </div>
                  <Switch
                    checked={groupChatSettings.notifyOrderCreated ?? true}
                    onCheckedChange={(checked) => handleToggleSetting("notifyOrderCreated", checked)}
                    disabled={savingGroupSettings}
                  />
                </div>

                <Separator />

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

                <Separator />

                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium block text-foreground">Buyurtma tayyor</span>
                    <span className="text-[9px] text-muted-foreground block leading-tight">
                      Ishlab chiqarish yakunida xabar berish
                    </span>
                  </div>
                  <Switch
                    checked={groupChatSettings.notifyProductionDone ?? true}
                    onCheckedChange={(checked) => handleToggleSetting("notifyProductionDone", checked)}
                    disabled={savingGroupSettings}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium block text-foreground">To&apos;lov eslatmasi</span>
                    <span className="text-[9px] text-muted-foreground block leading-tight">
                      To&apos;lov muddati kelganda eslatma
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

          <DialogFooter className="gap-1 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsDialogOpen(false)}
              className="h-7 text-xs cursor-pointer"
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Kontragentga biriktirish Dialog (Modal) ─────────────────────────── */}
      <Dialog open={linkingDialogOpen} onOpenChange={setLinkingDialogOpen}>
        <DialogContent className="sm:max-w-md gap-3 p-4">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Link2 className="size-4 text-muted-foreground" />
              Guruhni biriktirish
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 truncate">
              <MessageSquare className="size-3.5 shrink-0" />
              <span className="truncate font-medium text-foreground">{activeChat?.title}</span>
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={linkTargetType}
            onValueChange={(v) => setLinkTargetType(v as "client" | "supplier")}
            className="gap-2"
          >
            <TabsList className="w-full h-8">
              <TabsTrigger value="client" className="flex-1 text-xs">
                <Building2 className="size-3.5" />
                Mijoz
                <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                  {crmCustomers.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="supplier" className="flex-1 text-xs">
                <Truck className="size-3.5" />
                Yetkazib beruvchi
                <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                  {suppliers.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Command
            key={linkTargetType}
            className="rounded-lg! border border-border bg-background p-0"
          >
            <CommandInput
              placeholder={linkTargetType === "client" ? "Mijoz qidirish" : "Yetkazib beruvchi qidirish"}
              className="text-xs"
            />
            <CommandList className="max-h-64 p-1">
              <CommandEmpty>Topilmadi</CommandEmpty>
              {linkTargetType === "client"
                ? crmCustomers.map((c: CrmCustomerRecord) => {
                    const id = String(c.dbId || c.id);
                    const checked = selectedClientId === id;
                    return (
                      <CommandItem
                        key={id}
                        value={`${c.name} ${c.phone ?? ""} ${id}`}
                        onSelect={() => setSelectedClientId(checked ? "" : id)}
                        data-checked={checked}
                        className="h-7 cursor-pointer"
                      >
                        <Building2 className="text-muted-foreground" />
                        <span className="truncate">{c.name}</span>
                        {c.phone && (
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {c.phone}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })
                : suppliers.map((s) => {
                    const id = String(s.id);
                    const checked = selectedSupplierId === id;
                    return (
                      <CommandItem
                        key={id}
                        value={`${s.name} ${s.code ?? ""} ${s.category ?? ""} ${id}`}
                        onSelect={() => setSelectedSupplierId(checked ? "" : id)}
                        data-checked={checked}
                        className="h-7 cursor-pointer"
                      >
                        <Truck className="text-muted-foreground" />
                        <span className="truncate">{s.name}</span>
                        {(s.code || s.category) && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {s.code || s.category}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
            </CommandList>
          </Command>

          <DialogFooter className="gap-1.5 px-4 py-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinkingDialogOpen(false)}
              className="h-7 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleLinkTarget}
              disabled={
                linkTargetType === "client"
                  ? !selectedClientId
                  : !selectedSupplierId
              }
              className="h-7 text-xs"
            >
              <Link2 className="size-3.5" />
              Biriktirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
