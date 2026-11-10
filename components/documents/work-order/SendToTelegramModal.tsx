"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  MessageSquare,
  Building2,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { TelegramChat } from "@/db/schema";

interface SendToTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
  orderNumber: string;
  clientId?: string;
  clientName?: string;
  productName?: string;
  quantity?: number | string;
  unit?: string;
  deliveryDate?: string;
  status?: string;
  artworkUrl?: string;
}

export function SendToTelegramModal({
  isOpen,
  onClose,
  workOrderId,
  orderNumber,
  clientId,
  clientName,
  productName,
  quantity,
  unit = "dona",
  deliveryDate,
  status,
  artworkUrl,
}: SendToTelegramModalProps) {
  const { addNotification, openTab } = useWorkspaceStore();

  const [linkedChat, setLinkedChat] = useState<TelegramChat | null>(null);
  const [checkingChat, setCheckingChat] = useState<boolean>(false);
  const [sendArtwork, setSendArtwork] = useState<boolean>(Boolean(artworkUrl));
  const [customMessage, setCustomMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  // Mijozning bog'langan Telegram guruhini tekshirish
  useEffect(() => {
    if (!isOpen || !clientId) return;
    let isMounted = true;
    setCheckingChat(true);

    fetch(`/api/v1/crm/telegram/entity-chat?type=client&id=${clientId}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          setLinkedChat(json.data || null);
        }
      })
      .catch((err) => {
        console.error("fetch linked chat error:", err);
      })
      .finally(() => {
        if (isMounted) setCheckingChat(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, clientId]);

  const handleSend = async () => {
    if (!workOrderId) return;
    setIsSending(true);

    try {
      const res = await fetch(
        `/api/v1/production/work-orders/${encodeURIComponent(workOrderId)}/send-telegram`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendArtwork,
            customMessage: customMessage.trim() || undefined,
          }),
        }
      );

      const json = await res.json();
      if (json.success) {
        addNotification({
          title: "Guruhga yuborildi",
          description: `Buyurtma ${orderNumber} ma'lumotlari Telegram guruhga jo'natildi.`,
          severity: "success",
        });
        onClose();
      } else {
        addNotification({
          title: "Yuborilmadi",
          description: json.error || "Xabarni yuborishda xatolik yuz berdi.",
          severity: "error",
        });
      }
    } catch (err) {
      console.error("handleSend error:", err);
      addNotification({
        title: "Xatolik",
        description: "Aloqa uzildi yoki server xatosi.",
        severity: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-4">
        <DialogHeader>
          <DialogTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Send className="size-4 text-primary" />
            <span>Telegram guruhga yuborish</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          {/* Bog'langan guruh haqida axborot */}
          {checkingChat ? (
            <div className="flex items-center gap-2 text-muted-foreground p-3 border border-border rounded-md bg-muted/30">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Mijozning Telegram guruhi tekshirilmoqda...</span>
            </div>
          ) : linkedChat ? (
            <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-muted/40">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground truncate">
                    {linkedChat.title}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {linkedChat.chatId}
                  </div>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium shrink-0"
              >
                Ulangan
              </Badge>
            </div>
          ) : (
            <div className="p-3 border border-dashed border-amber-500/40 bg-amber-500/5 rounded-md text-amber-700 dark:text-amber-400 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>Mijozga Telegram guruh biriktirilmagan</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Xabar jo'natish uchun avval mijoz profilidan guruhni ulash lozim.
              </p>
              {clientId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    openTab({
                      id: clientId,
                      title: clientName || "Mijoz",
                      type: "customer",
                      module: "crm",
                    });
                  }}
                  className="h-6 text-[10px] gap-1 cursor-pointer"
                >
                  <ExternalLink className="size-3" />
                  <span>Mijoz profilini ochish</span>
                </Button>
              )}
            </div>
          )}

          {/* Xabar ko'rinishi (Preview) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Yuboriladigan xabar
            </span>
            <div className="p-2.5 rounded-md border border-border bg-background space-y-1 font-mono text-[11px]">
              <div className="font-bold text-foreground">
                BUYURTMA PASPORTI: {orderNumber}
              </div>
              <div className="text-muted-foreground">Mijoz: {clientName || "—"}</div>
              <div className="text-muted-foreground">Mahsulot: {productName || "—"}</div>
              <div className="text-muted-foreground">
                Miqdori: {Number(quantity || 0).toLocaleString()} {unit}
              </div>
              {deliveryDate && (
                <div className="text-muted-foreground">Muddati: {deliveryDate}</div>
              )}
              {status && (
                <div className="text-muted-foreground">Holati: {status}</div>
              )}
            </div>
          </div>

          {/* Eskiz rasmini biriktirish parametri */}
          {artworkUrl && (
            <label className="flex items-center gap-2 p-2 rounded border border-border bg-muted/20 cursor-pointer">
              <input
                type="checkbox"
                checked={sendArtwork}
                onChange={(e) => setSendArtwork(e.target.checked)}
                className="size-3.5 rounded border-input"
              />
              <ImageIcon className="size-3.5 text-primary" />
              <span className="text-[11px] text-foreground font-medium">
                Maket eskizini rasm sifatida ilova qilish
              </span>
            </label>
          )}

          {/* Qo'shimcha izoh */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Qo'shimcha izoh (ixtiyoriy)
            </label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Masalan: Tiraj chop etishga tushirildi..."
              rows={2}
              className="text-xs resize-none min-h-[50px] bg-background"
            />
          </div>
        </div>

        <DialogFooter className="gap-1 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-xs cursor-pointer"
          >
            Bekor qilish
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={isSending || !linkedChat || checkingChat}
            className="h-7 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold"
          >
            {isSending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            <span>Guruhga jo'natish</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
