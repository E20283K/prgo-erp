"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Send,
  Bot,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Globe,
  Key,
  ShieldCheck,
  AlertTriangle,
  Save,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Sliders,
  Sparkles,
  Link2,
  Search,
  MessageSquare,
  Users,
  Activity,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface TelegramSettingsData {
  botToken: string;
  botUsername: string;
  webhookUrl: string;
  isWebhookActive: boolean;
  defaultNotificationLanguage: "uz" | "ru" | "en";
  autoCreateLeadsFromUnknownGroups: boolean;
}

interface TelegramChatRecord {
  id: string;
  chatId: string;
  title: string;
  type: string;
  clientId?: string | null;
  clientName?: string | null;
  clientCode?: string | null;
  clientPhone?: string | null;
  assignedUserId?: string | null;
  status: "active" | "unlinked" | "archived";
  unreadCount: number;
  lastMessageAt?: string | null;
  lastMessageSnippet?: string | null;
}

export function TelegramSettingsView() {
  const tCommon = useTranslations("Common");
  const { addNotification, openTab } = useWorkspaceStore();

  const [activeSubTab, setActiveSubTab] = useState<"general" | "groups" | "diagnostics">("general");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);

  const [settings, setSettings] = useState<TelegramSettingsData>({
    botToken: "",
    botUsername: "",
    webhookUrl: "",
    isWebhookActive: false,
    defaultNotificationLanguage: "uz",
    autoCreateLeadsFromUnknownGroups: false,
  });

  const [botStatus, setBotStatus] = useState<{
    tested: boolean;
    online: boolean;
    bot?: { id: number; first_name: string; username?: string; can_join_groups?: boolean };
    error?: string;
    responseTimeMs?: number;
  }>({
    tested: false,
    online: false,
  });

  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Guruhlar ro'yxati
  const [chats, setChats] = useState<TelegramChatRecord[]>([]);
  const [chatSearch, setChatSearch] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);

  // 1. Sozlamalarni yuklash
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/settings/telegram");
      const json = await res.json();
      if (json.ok && json.data) {
        setSettings(json.data);
      }
    } catch (err) {
      console.error("fetchSettings error:", err);
      addNotification({
        title: "Xatolik",
        description: "Telegram sozlamalarini yuklab bo'lmadi",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  // 2. Ulangan guruhlarni yuklash
  const fetchChats = useCallback(async () => {
    try {
      setLoadingChats(true);
      const res = await fetch("/api/v1/crm/telegram/chats");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setChats(json.data);
      }
    } catch (err) {
      console.error("fetchChats error:", err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchChats();
  }, [fetchSettings, fetchChats]);

  // 3. Ulanishni tekshirish (Ping / getMe)
  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const start = performance.now();
      const res = await fetch("/api/v1/settings/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: settings.botToken }),
      });
      const data = await res.json();
      const duration = Math.round(performance.now() - start);

      if (data.ok && data.bot) {
        setBotStatus({
          tested: true,
          online: true,
          bot: data.bot,
          responseTimeMs: duration,
        });
        if (data.bot.username && !settings.botUsername) {
          setSettings((prev) => ({ ...prev, botUsername: `@${data.bot.username}` }));
        }
        addNotification({
          title: "Telegram Bot Faol",
          description: `@${data.bot.username || data.bot.first_name} ga ulandi (${duration}ms)`,
          severity: "success",
        });
      } else {
        setBotStatus({
          tested: true,
          online: false,
          error: data.error || "Telegram API ulanishda xato berdi",
          responseTimeMs: duration,
        });
        addNotification({
          title: "Ulanish xatosi",
          description: data.error || "Bot token noto'g'ri",
          severity: "error",
        });
      }
    } catch (err: any) {
      setBotStatus({
        tested: true,
        online: false,
        error: err?.message || "Tarmoq xatosi",
      });
    } finally {
      setTesting(false);
    }
  };

  // 4. Sozlamalarni saqlash
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/v1/settings/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) {
        setSettings(data.data);
        addNotification({
          title: "Muvaffaqiyatli saqlandi",
          description: "Telegram sozlamalari yangilandi.",
          severity: "success",
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addNotification({
        title: "Saqlashda xatolik",
        description: err?.message || "Sozlamalarni saqlab bo'lmadi",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // 5. Webhookni sozlash yoki o'chirish
  const handleConfigureWebhook = async (action: "set" | "delete") => {
    try {
      setWebhookLoading(true);
      const res = await fetch("/api/v1/settings/telegram/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          webhookUrl: settings.webhookUrl,
          token: settings.botToken,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSettings((prev) => ({
          ...prev,
          isWebhookActive: action === "set",
        }));
        addNotification({
          title: action === "set" ? "Webhook faollashtirildi" : "Webhook o'chirildi",
          description: data.description || "Telegram API yangilandi.",
          severity: "success",
        });
      } else {
        throw new Error(data.description || "Webhookni yangilab bo'lmadi");
      }
    } catch (err: any) {
      addNotification({
        title: "Webhook xatosi",
        description: err?.message || "Telegram API ga so'rov yuborishda xatolik",
        severity: "error",
      });
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!settings.botToken) return;
    navigator.clipboard.writeText(settings.botToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const filteredChats = useMemo(() => {
    if (!chatSearch.trim()) return chats;
    const q = chatSearch.toLowerCase();
    return chats.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.chatId?.toLowerCase().includes(q) ||
        c.clientName?.toLowerCase().includes(q) ||
        c.assignedUserId?.toLowerCase().includes(q)
    );
  }, [chats, chatSearch]);

  if (loading) {
    return (
      <div className="w-full h-full bg-card flex items-center justify-center text-xs text-muted-foreground gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
        <span>Telegram sozlamalari yuklanmoqda...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
      {/* ─── 1C Enterprise Standard Toolbar (Height 40px) ─── */}
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        {/* Chap amallar */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            size="sm"
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saqlanmoqda..." : tCommon("save")}</span>
          </Button>

          <Button
            onClick={handleTestConnection}
            disabled={testing || !settings.botToken}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-medium gap-1 rounded cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", testing && "animate-spin")} />
            <span>Ulanishni tekshirish</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Sub-tab navigatsiya tugmalari (Pills) */}
          <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
            <button
              onClick={() => setActiveSubTab("general")}
              className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                activeSubTab === "general"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sozlamalar & API
            </button>
            <button
              onClick={() => setActiveSubTab("groups")}
              className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "groups"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Mijoz Guruhlari</span>
              <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono leading-none">
                {chats.length}
              </Badge>
            </button>
            <button
              onClick={() => setActiveSubTab("diagnostics")}
              className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                activeSubTab === "diagnostics"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Diagnostika
            </button>
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Status indikatorlari */}
          <div className="hidden sm:flex items-center gap-1.5">
            {botStatus.tested ? (
              botStatus.online ? (
                <Badge className="h-5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Online ({botStatus.responseTimeMs}ms)</span>
                </Badge>
              ) : (
                <Badge className="h-5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-medium gap-1">
                  <XCircle className="w-2.5 h-2.5" />
                  <span>Xatolik</span>
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground gap-1">
                <Bot className="w-2.5 h-2.5" />
                <span>Status: Noma&apos;lum</span>
              </Badge>
            )}

            {settings.isWebhookActive ? (
              <Badge className="h-5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-medium gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                <span>Webhook Faol</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground">
                Webhook Nofaol
              </Badge>
            )}
          </div>
        </div>

        {/* O'ng amallar */}
        <div className="flex items-center gap-2">
          {settings.botUsername && (
            <a
              href={`https://t.me/${settings.botUsername.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-mono"
            >
              <span>{settings.botUsername}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* ─── Asosiy Tarkib (Tab Content) ─── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSubTab === "general" && (
          <div className="space-y-4 max-w-5xl">
            {/* 1. Bot Identifikatorlari & API Kalitlari */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
                <Bot className="w-4 h-4 text-primary" />
                <span>Telegram Bot Identifikatorlari & API Kalitlari</span>
                <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                  {settings.botUsername || "BOT-API"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Bot Token (API Token) *</span>
                    <span className="text-[10px] font-mono text-muted-foreground">Maxfiy kalit</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showToken ? "text" : "password"}
                      value={settings.botToken}
                      onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="h-8 text-xs font-mono pr-14"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={handleCopyToken}
                      >
                        {copiedToken ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Token korxona sozlamalarida shifrlanib saqlanadi. Agar kiritilmasa, server `.env` zaxira sifatida ishlatiladi.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Bot Foydalanuvchi Nomi (Username)
                  </Label>
                  <Input
                    value={settings.botUsername}
                    onChange={(e) => setSettings({ ...settings, botUsername: e.target.value })}
                    placeholder="@printgoo_bot"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Mijozlar buyurtma va maketlarni yuborishi uchun Telegram havolasi (t.me/username).
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Webhook & Real-time Integratsiya */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
                <Globe className="w-4 h-4 text-primary" />
                <span>Webhook & Real-Time Hodisalar Marshruti</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto text-[10px] font-mono",
                    settings.isWebhookActive ? "text-blue-600 border-blue-300" : "text-muted-foreground"
                  )}
                >
                  {settings.isWebhookActive ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Webhook URL (HTTPS protokoli talab etiladi)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={settings.webhookUrl}
                      onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                      placeholder="https://erp.printgoo.uz/api/telegram/webhook"
                      className="h-8 text-xs font-mono flex-1"
                    />
                    <Button
                      onClick={() => handleConfigureWebhook("set")}
                      disabled={webhookLoading || !settings.webhookUrl}
                      size="sm"
                      className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0 cursor-pointer"
                    >
                      <Radio className="w-3 h-3" />
                      <span>{webhookLoading ? "Sozlanmoqda..." : "Webhookni O'rnatish"}</span>
                    </Button>
                    <Button
                      onClick={() => handleConfigureWebhook("delete")}
                      disabled={webhookLoading}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 cursor-pointer"
                    >
                      <span>O&apos;chirish</span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Telegram barcha kiruvchi xabarlar, fayllar va buyurtma maketlarini shu manzilga uzatadi.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Avtomatlashtirish & Xabarnoma Qoidalari */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Standart Xabarnoma & CRM Avtomatlashtirish Qoidalari</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Standart Xabarnoma Tili
                  </Label>
                  <Select
                    value={settings.defaultNotificationLanguage}
                    onValueChange={(val: any) =>
                      setSettings({ ...settings, defaultNotificationLanguage: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uz">O&apos;zbekcha (UZ)</SelectItem>
                      <SelectItem value="ru">Русский (RU)</SelectItem>
                      <SelectItem value="en">English (EN)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Mijoz guruhlariga yangi buyurtma va maket tasdiqlash xabarlarini avtomatik yuborish tili.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded border border-border bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-medium cursor-pointer" htmlFor="auto-leads-switch">
                      Yangi guruhlardan avtomatik Lid ochish
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Bot noma&apos;lum mijoz guruhiga qo&apos;shilganda avtomatik CRM lid kartochkasi yaratiladi.
                    </p>
                  </div>
                  <Switch
                    id="auto-leads-switch"
                    checked={settings.autoCreateLeadsFromUnknownGroups}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autoCreateLeadsFromUnknownGroups: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 2-Tab: Mijoz Guruhlari Reyestri ─── */}
        {activeSubTab === "groups" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Guruh nomi yoki chat ID bo'yicha qidiruv..."
                  className="pl-8 h-8 text-xs bg-background border-input rounded"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchChats}
                  disabled={loadingChats}
                  className="h-8 text-xs gap-1 rounded cursor-pointer"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loadingChats && "animate-spin")} />
                  <span>Yangilash</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() =>
                    openTab({
                      id: "registry-telegram-inbox",
                      title: "Telegram Inbox",
                      type: "registry",
                      module: "crm",
                    })
                  }
                  className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Telegram Inboxda Ochish</span>
                  <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            </div>

            {/* Guruhlar jadvali */}
            <div className="rounded border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                    <tr className="h-8">
                      <th className="px-3 py-1 font-medium">Guruh / Chat Nomi</th>
                      <th className="px-3 py-1 font-medium">Telegram Chat ID</th>
                      <th className="px-3 py-1 font-medium">Turi</th>
                      <th className="px-3 py-1 font-medium">Biriktirilgan Mijoz</th>
                      <th className="px-3 py-1 font-medium">Mas&apos;ul Menejer</th>
                      <th className="px-3 py-1 font-medium">Holat</th>
                      <th className="px-3 py-1 font-medium text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredChats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-xs">
                          {loadingChats ? "Guruhlar yuklanmoqda..." : "Ulangan Telegram guruhlari topilmadi"}
                        </td>
                      </tr>
                    ) : (
                      filteredChats.map((chat) => (
                        <tr key={chat.id} className="h-9 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-1 font-medium text-foreground max-w-[220px] truncate">
                            {chat.title}
                          </td>
                          <td className="px-3 py-1 font-mono text-[11px] text-muted-foreground">
                            {chat.chatId}
                          </td>
                          <td className="px-3 py-1">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {chat.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-1 text-foreground max-w-[180px] truncate">
                            {chat.clientName ? (
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {chat.clientName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                Biriktirilmagan
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1 text-muted-foreground">
                            {chat.assignedUserId || "—"}
                          </td>
                          <td className="px-3 py-1">
                            {chat.status === "active" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] h-5">
                                Faol
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] h-5">
                                Bog&apos;lanmagan
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-1 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer"
                              onClick={() =>
                                openTab({
                                  id: "registry-telegram-inbox",
                                  title: "Telegram Inbox",
                                  type: "registry",
                                  module: "crm",
                                })
                              }
                            >
                              Inboxda ochish
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── 3-Tab: Diagnostika & Webhook Loglari ─── */}
        {activeSubTab === "diagnostics" && (
          <div className="space-y-4 max-w-4xl">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border pb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span>Bot Diagnostikasi & Ulanish Holati</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded border border-border bg-muted/20">
                  <div className="text-[10px] text-muted-foreground">Telegram API Status</div>
                  <div className="font-semibold text-foreground text-sm mt-0.5">
                    {botStatus.tested ? (botStatus.online ? "ONLINE" : "OFFLINE") : "TEKSHIRILMAGAN"}
                  </div>
                </div>

                <div className="p-3 rounded border border-border bg-muted/20">
                  <div className="text-[10px] text-muted-foreground">Kechikish (Latency)</div>
                  <div className="font-semibold font-mono text-foreground text-sm mt-0.5">
                    {botStatus.responseTimeMs ? `${botStatus.responseTimeMs} ms` : "—"}
                  </div>
                </div>

                <div className="p-3 rounded border border-border bg-muted/20">
                  <div className="text-[10px] text-muted-foreground">Guruhlarga ruxsat</div>
                  <div className="font-semibold text-foreground text-sm mt-0.5">
                    {botStatus.bot ? "Ha (Allowed)" : "—"}
                  </div>
                </div>

                <div className="p-3 rounded border border-border bg-muted/20">
                  <div className="text-[10px] text-muted-foreground">Jami Chatlar</div>
                  <div className="font-semibold font-mono text-foreground text-sm mt-0.5">
                    {chats.length} ta
                  </div>
                </div>
              </div>

              {botStatus.bot && (
                <div className="p-3 rounded bg-muted/30 border border-border font-mono text-[11px] space-y-1">
                  <div className="text-muted-foreground font-semibold">getMe natijasi (JSON):</div>
                  <pre className="text-foreground overflow-x-auto">
                    {JSON.stringify(botStatus.bot, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
