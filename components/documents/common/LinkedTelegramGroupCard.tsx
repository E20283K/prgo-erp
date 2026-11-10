"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Link2,
  Unlink,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Send,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { TelegramChat } from "@/db/schema";

interface LinkedTelegramGroupCardProps {
  entityType: "client" | "supplier";
  entityId: string;
  entityName: string;
  className?: string;
}

export function LinkedTelegramGroupCard({
  entityType,
  entityId,
  entityName,
  className = "",
}: LinkedTelegramGroupCardProps) {
  const { openTab, setActiveTelegramChatId, addNotification } = useWorkspaceStore();

  const [linkedChat, setLinkedChat] = useState<TelegramChat | null>(null);
  const [unlinkedChats, setUnlinkedChats] = useState<Array<{ id: string; chatId: string; title: string }>>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [manualChatId, setManualChatId] = useState<string>("");
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Bog'langan guruhni va bo'sh guruhlar ro'yxatini yuklash
  const fetchGroupData = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    try {
      // 1. Shu kontragentga biriktirilgan faol guruhni tekshirish
      const res = await fetch(`/api/v1/crm/telegram/entity-chat?type=${entityType}&id=${entityId}`);
      const json = await res.json();
      if (json.success) {
        setLinkedChat(json.data || null);
      }

      // 2. Biriktirilmagan (unlinked) guruhlar ro'yxatini yuklash
      const unlinkedRes = await fetch("/api/v1/crm/telegram/chats?status=unlinked");
      const unlinkedJson = await unlinkedRes.json();
      if (Array.isArray(unlinkedJson)) {
        setUnlinkedChats(unlinkedJson);
        if (unlinkedJson.length > 0 && !selectedChatId) {
          setSelectedChatId(unlinkedJson[0].id);
        }
      }
    } catch (err) {
      console.error("[LinkedTelegramGroupCard] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, selectedChatId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  // Guruhni biriktirish (Link)
  const handleLinkGroup = async () => {
    const targetChatId = isManualInput ? manualChatId.trim() : selectedChatId;
    if (!targetChatId) return;

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        chatId: targetChatId,
      };
      if (entityType === "client") {
        payload.clientId = entityId;
      } else {
        payload.supplierId = entityId;
      }

      const res = await fetch("/api/v1/crm/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setLinkedChat(json.data);
        setIsManualInput(false);
        setManualChatId("");
        addNotification({
          title: "Telegram guruh biriktirildi",
          description: `Guruh "${entityName}"ga muvaffaqiyatli ulandi.`,
          severity: "success",
        });
        fetchGroupData();
      } else {
        addNotification({
          title: "Xatolik",
          description: json.error || "Guruhni biriktirib bo'lmadi.",
          severity: "error",
        });
      }
    } catch (err) {
      console.error("handleLinkGroup error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Guruhni uzish (Unlink)
  const handleUnlinkGroup = async () => {
    if (!linkedChat) return;
    if (!confirm("Haqiqatan ham ushbu Telegram guruhni ajratmoqchimisiz?")) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/crm/telegram/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: linkedChat.id }),
      });
      const json = await res.json();
      if (json.success) {
        setLinkedChat(null);
        addNotification({
          title: "Guruh ajratildi",
          description: "Telegram guruh biriktirilishi bekor qilindi.",
          severity: "info",
        });
        fetchGroupData();
      }
    } catch (err) {
      console.error("handleUnlinkGroup error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Telegram Inbox oynasida ochish
  const handleOpenInbox = () => {
    if (!linkedChat) return;
    setActiveTelegramChatId(linkedChat.id);
    openTab({
      id: "registry-telegram-inbox",
      title: "Telegram Inbox",
      type: "registry",
      module: "crm",
    });
  };

  const handleCopyChatId = () => {
    if (!linkedChat?.chatId) return;
    navigator.clipboard.writeText(linkedChat.chatId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`bg-card border border-border rounded-md p-3.5 space-y-3 ${className}`}>
      {/* Sarlavha satri */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <span className="font-semibold text-xs text-foreground">Telegram guruh</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isLoading && <RefreshCw className="size-3 text-muted-foreground animate-spin" />}
          {linkedChat ? (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium"
            >
              Ulangan
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 bg-muted text-muted-foreground border-border font-medium"
            >
              Ulanmagan
            </Badge>
          )}
        </div>
      </div>

      {/* Kontent: Ulangan yoki Ulanmagan holat */}
      {linkedChat ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/40 border border-border">
            {linkedChat.photoUrl ? (
              <img
                src={linkedChat.photoUrl}
                alt={linkedChat.title}
                className="size-8 rounded-full object-cover shrink-0 border border-border/40"
              />
            ) : (
              <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                TG
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs text-foreground truncate">
                  {linkedChat.title}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {linkedChat.type}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono truncate">{linkedChat.chatId}</span>
                <button
                  type="button"
                  onClick={handleCopyChatId}
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  title="Chat ID nusxalash"
                >
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                </button>
              </div>

              {linkedChat.lastMessageSnippet && (
                <div className="text-[10px] text-muted-foreground truncate mt-1">
                  Oxirgi xabar: {linkedChat.lastMessageSnippet}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenInbox}
              className="h-7 text-xs flex-1 gap-1.5 cursor-pointer"
            >
              <ExternalLink className="size-3.5" />
              <span>Inbox muloqot</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUnlinkGroup}
              disabled={isSaving}
              className="h-7 text-xs px-2.5 text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
              title="Guruhni ajratish"
            >
              <Unlink className="size-3.5" />
              <span>Uzish</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-[11px] text-muted-foreground">
            Buyurtmalar va holat xabarnomalarini to'g'ridan-to'g'ri Telegramga jo'natish uchun guruhni ulang.
          </div>

          {!isManualInput ? (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Mavjud guruhlar ro'yxati
              </label>

              {unlinkedChats.length > 0 ? (
                <select
                  value={selectedChatId}
                  onChange={(e) => setSelectedChatId(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs focus:ring-1 focus:ring-primary"
                >
                  {unlinkedChats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.chatId})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[11px] text-muted-foreground border border-dashed border-border rounded p-2 text-center">
                  Hozircha biriktirilmagan yangi guruhlar yo'q. Guruhga botni qo'shing yoki quyida Chat ID kiriting.
                </div>
              )}

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsManualInput(true)}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Chat ID orqali ulash
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLinkGroup}
                  disabled={isSaving || unlinkedChats.length === 0 || !selectedChatId}
                  className="h-7 text-xs px-3 gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold"
                >
                  <Link2 className="size-3.5" />
                  <span>Biriktirish</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Telegram Chat ID (masalan: -10021481928)
              </label>
              <Input
                placeholder="-100..."
                value={manualChatId}
                onChange={(e) => setManualChatId(e.target.value)}
                className="h-8 text-xs font-mono"
              />

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsManualInput(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Ro'yxatdan tanlash
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLinkGroup}
                  disabled={isSaving || !manualChatId.trim()}
                  className="h-7 text-xs px-3 gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold"
                >
                  <Link2 className="size-3.5" />
                  <span>Ulash</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
