"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface ChatState {
  unreadCount: number;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
}

/**
 * Background hook that listens for incoming Telegram customer messages
 * and triggers smart Toast notifications with sound when the user is not actively in that chat.
 */
export function useTelegramNotificationPoller() {
  const {
    activeTabId,
    activeTelegramChatId,
    toastSoundConfig,
    notificationRules,
    addNotification,
  } = useWorkspaceStore();

  const isInitialized = useRef(false);
  const knownChatsMap = useRef<Map<string, ChatState>>(new Map());

  useEffect(() => {
    let isCancelled = false;

    const checkNewMessages = async () => {
      // Don't poll if document is hidden to conserve bandwidth and CPU
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      // Check if Telegram notifications are disabled by user
      const isToastEnabled = toastSoundConfig?.telegramToastEnabled !== false;
      const isRulesEnabled = notificationRules?.telegramMessagesEnabled !== false;
      if (!isToastEnabled || !isRulesEnabled) {
        return;
      }

      try {
        const res = await fetch("/api/v1/crm/telegram/chats?status=all");
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data) || isCancelled) return;

        const currentChats = json.data;

        // On first run, seed known chats map without triggering notifications
        if (!isInitialized.current) {
          for (const c of currentChats) {
            knownChatsMap.current.set(c.id, {
              unreadCount: c.unreadCount || 0,
              lastMessageSnippet: c.lastMessageSnippet || null,
              lastMessageAt: c.lastMessageAt || null,
            });
          }
          isInitialized.current = true;
          return;
        }

        // Compare subsequent polls to detect newly arrived client messages
        for (const chat of currentChats) {
          const prev = knownChatsMap.current.get(chat.id);
          const currentUnread = chat.unreadCount || 0;
          const prevUnread = prev ? prev.unreadCount : 0;

          const hasNewIncomingMessage =
            (!prev && currentUnread > 0) ||
            (prev && currentUnread > prevUnread) ||
            (prev && chat.lastMessageSnippet !== prev.lastMessageSnippet && currentUnread > 0);

          if (hasNewIncomingMessage) {
            // Smart Rule: If user is actively inside TelegramInbox and has this chat open, don't toast
            const isActivelyViewingThisChat =
              activeTabId.includes("telegram-inbox") &&
              activeTelegramChatId === chat.id;

            if (!isActivelyViewingThisChat) {
              const senderTitle = chat.clientName || chat.title || "Telegram Mijoz";
              const snippet = chat.lastMessageSnippet || "Yangi xabar keldi";

              addNotification({
                title: `Telegram • ${senderTitle}`,
                description: snippet,
                severity: "info",
                category: "crm",
                eventType: "telegram_message",
                entityCode: chat.chatId,
                channel: "both",
                link: { module: "crm", subModule: "telegram-inbox" },
                targetTab: {
                  id: "tab-crm-telegram-inbox",
                  title: "Telegram Inbox",
                  type: "registry",
                  module: "crm",
                  documentData: {
                    chatId: chat.id,
                  },
                },
              });
            }
          }

          // Update cache
          knownChatsMap.current.set(chat.id, {
            unreadCount: currentUnread,
            lastMessageSnippet: chat.lastMessageSnippet || null,
            lastMessageAt: chat.lastMessageAt || null,
          });
        }
      } catch {
        // Silent background catch
      }
    };

    // Initial check
    checkNewMessages();

    // Poll every 4 seconds
    const interval = setInterval(checkNewMessages, 4000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [
    activeTabId,
    activeTelegramChatId,
    toastSoundConfig?.telegramToastEnabled,
    notificationRules?.telegramMessagesEnabled,
    addNotification,
  ]);
}
