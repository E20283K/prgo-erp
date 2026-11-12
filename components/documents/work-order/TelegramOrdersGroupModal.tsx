"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Send,
  CheckCircle2,
  RefreshCw,
  FileUp,
  FileText,
  AlertTriangle,
  Loader2,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { WorkOrderTelegramMeta } from "@/db/schema";

interface TelegramOrdersGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
  orderNumber: string;
  customerName?: string;
  productName?: string;
  quantity?: number | string;
  unit?: string;
  paperStock?: string;
  coating?: string;
  lamination?: string;
  embellishment?: string;
  width?: number;
  height?: number;
  status?: string;
  stage?: string;
  deadline?: string;
  telegramMeta?: WorkOrderTelegramMeta | null;
  onSuccess?: (meta?: WorkOrderTelegramMeta) => void;
}

interface ChatOption {
  id: string;
  chatId: string;
  title: string;
  clientName?: string | null;
}

type UpdateMode = "caption_only" | "replace_pdf" | "resend_new";

export function TelegramOrdersGroupModal({
  isOpen,
  onClose,
  workOrderId,
  orderNumber,
  customerName = "Mijoz",
  productName = "Poligrafiya mahsuloti",
  quantity = 0,
  unit = "dona",
  paperStock = "Standart",
  coating,
  lamination,
  embellishment,
  width = 50,
  height = 125,
  status = "Active",
  stage = "Queue",
  deadline = "Kelishilmoqda",
  telegramMeta,
  onSuccess,
}: TelegramOrdersGroupModalProps) {
  const { addNotification } = useWorkspaceStore();

  const [chats, setChats] = useState<ChatOption[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [defaultOrdersChatId, setDefaultOrdersChatId] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Xabar avval yuborilgan bo'lsa yangilash rejimi
  const isAlreadySent = Boolean(telegramMeta?.messageId);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("replace_pdf");
  const [sendAlertReply, setSendAlertReply] = useState<boolean>(true);

  // Guruhlarni va tizim sozlamalarini yuklash
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingChats(true);

    Promise.all([
      fetch("/api/v1/crm/telegram/chats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/v1/settings/telegram").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([chatsRes, settingsRes]) => {
        if (!isMounted) return;

        if (chatsRes?.success && Array.isArray(chatsRes.data)) {
          setChats(chatsRes.data);
        }

        const configuredOrdersChat = settingsRes?.data?.ordersChatId || "";
        setDefaultOrdersChatId(configuredOrdersChat);

        if (telegramMeta?.chatId) {
          setSelectedChatId(telegramMeta.chatId);
        } else if (configuredOrdersChat) {
          setSelectedChatId(configuredOrdersChat);
        } else if (chatsRes?.data?.length > 0) {
          setSelectedChatId(chatsRes.data[0].chatId);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingChats(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, telegramMeta]);

  // Stepper matnini vizual ko'rish
  const previewStepper = useMemo(() => {
    const steps = [
      { key: "prepress", label: "Prepress" },
      { key: "print", label: "Chop etish" },
      { key: "finishing", label: "Shtamp/Ishlov" },
      { key: "packaging", label: "Qadoqlash" },
      { key: "completed", label: "Tayyor" },
    ];

    let activeIndex = 0;
    if (stage === "Queue" || stage === "Ready to Print") activeIndex = 0;
    else if (stage === "In Production") activeIndex = 1;
    else if (stage === "Post-press") activeIndex = 2;
    else if (stage === "Packaging") activeIndex = 3;
    else if (stage === "Completed") activeIndex = 4;

    return steps
      .map((s, idx) => {
        if (idx < activeIndex) return `[✓ ${s.label}]`;
        if (idx === activeIndex) return `[▶ ${s.label}]`;
        return `[○ ${s.label}]`;
      })
      .join(" ➔ ");
  }, [stage]);

  const embellishmentsStr = useMemo(() => {
    const list: string[] = [];
    if (coating) list.push(coating);
    if (lamination) list.push(lamination);
    if (embellishment) list.push(embellishment);
    return list.length > 0 ? list.join(", ") : "Standart";
  }, [coating, lamination, embellishment]);

  const dimStr = useMemo(() => {
    const w = Number(width) || 50;
    const h = Number(height) || 125;
    return `${(h / 10).toFixed(1)} x ${(w / 10).toFixed(1)} cm (${h}x${w} mm)`;
  }, [width, height]);

  // Yuborish / Yangilash amali
  const handleSubmit = async () => {
    if (!workOrderId) return;
    setIsSubmitting(true);

    try {
      const isUpdatingCaption = isAlreadySent && updateMode === "caption_only";
      const isReplacingPdf = isAlreadySent && updateMode === "replace_pdf";

      const res = await fetch(
        `/api/v1/production/work-orders/${encodeURIComponent(workOrderId)}/send-orders-group`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: selectedChatId || undefined,
            customNote: customNote.trim() || undefined,
            updateOnly: isUpdatingCaption,
            replacePdf: isReplacingPdf,
            alertReply: isAlreadySent ? sendAlertReply : false,
          }),
        }
      );

      const json = await res.json();
      if (json.success) {
        let successTitle = "Guruhga yuborildi";
        let successDesc = `Buyurtma ${orderNumber} Telegram guruhga muvaffaqiyatli jo'natildi.`;

        if (isReplacingPdf) {
          successTitle = "PDF yangilandi";
          successDesc = "Guruhdagi mavjud xabarning PDF pasporti yangilandi.";
        } else if (isUpdatingCaption) {
          successTitle = "Status yangilandi";
          successDesc = "Guruhdagi mavjud xabar matni va jarayon bosqichi yangilandi.";
        }

        addNotification({
          title: successTitle,
          description: successDesc,
          severity: "success",
        });

        if (onSuccess) onSuccess(json.telegramMeta);
        onClose();
      } else {
        addNotification({
          title: "Xatolik",
          description: json.error || "Xabarni yuborishda xatolik yuz berdi.",
          severity: "error",
        });
      }
    } catch (err) {
      console.error("send error:", err);
      addNotification({
        title: "Aloqa uzildi",
        description: "Server bilan bog'lanishda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" />
            <span>Telegram Buyurtmalar guruhiga yuborish</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          {/* Oldin yuborilganlik holati va Rejim tanlash */}
          {isAlreadySent && telegramMeta && (
            <div className="p-2.5 rounded border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Xabar #{telegramMeta.messageId}</span>
                  {telegramMeta.channelTitle && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      ({telegramMeta.channelTitle})
                    </span>
                  )}
                </div>
                {telegramMeta.lastSentAt && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(telegramMeta.lastSentAt).toLocaleTimeString("uz-UZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>

              {/* Yangilash usuli tanlovi */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setUpdateMode("replace_pdf")}
                  className={`flex flex-col items-start p-1.5 rounded border text-left transition-colors ${
                    updateMode === "replace_pdf"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px]">
                    <FileUp className="size-3" />
                    <span>PDF almashtirish</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Faylni o&apos;zgartirish
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUpdateMode("caption_only")}
                  className={`flex flex-col items-start p-1.5 rounded border text-left transition-colors ${
                    updateMode === "caption_only"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px]">
                    <RefreshCw className="size-3" />
                    <span>Status yangilash</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Faqat matn/bosqich
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUpdateMode("resend_new")}
                  className={`flex flex-col items-start p-1.5 rounded border text-left transition-colors ${
                    updateMode === "resend_new"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px]">
                    <Send className="size-3" />
                    <span>Qayta yuborish</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Yangi xabar sifatida
                  </span>
                </button>
              </div>

              {/* Ogohlantirish eslatmasi */}
              <div className="flex items-center space-x-2 pt-1 border-t border-border/50">
                <Checkbox
                  id="alertReplyCheckbox"
                  checked={sendAlertReply}
                  onCheckedChange={(c) => setSendAlertReply(Boolean(c))}
                />
                <label
                  htmlFor="alertReplyCheckbox"
                  className="text-[11px] text-foreground cursor-pointer select-none flex items-center gap-1"
                >
                  <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
                  <span>Guruh a&apos;zolariga eslatma javobi (reply) yuborish</span>
                </label>
              </div>
            </div>
          )}

          {/* Qabul qiluvchi guruh (agar yangi bo'lsa yoki qayta yuborilayotgan bo'lsa) */}
          {(!isAlreadySent || updateMode === "resend_new") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium">Qabul qiluvchi guruh</Label>
                {defaultOrdersChatId && (
                  <span className="text-[10px] text-muted-foreground">
                    Asosiy: {chats.find((c) => c.chatId === defaultOrdersChatId)?.title || "Sozlamalardagi"}
                  </span>
                )}
              </div>
              {loadingChats ? (
                <div className="h-8 flex items-center gap-2 px-2 border border-border rounded bg-muted/20 text-muted-foreground text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Guruhlar yuklanmoqda...</span>
                </div>
              ) : (
                <Select value={selectedChatId} onValueChange={(val) => setSelectedChatId(val || "")}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {chats.map((c) => (
                      <SelectItem key={c.id} value={c.chatId}>
                        {c.title} {c.clientName ? `• ${c.clientName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Oldindan ko'rish (Telegram xabari) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium">Xabar va biriktirilgan fayl</Label>
              <Badge variant="outline" className="h-4 text-[9px] px-1 font-mono gap-1">
                <FileText className="size-2.5 text-primary" />
                <span>PDF Texnik Pasport (A4)</span>
              </Badge>
            </div>
            <div className="p-2.5 rounded border border-border bg-card font-mono text-[11px] space-y-1.5 leading-relaxed">
              <div className="text-primary font-bold">🏭 * {customerName.toUpperCase()} *</div>
              <div className="font-bold text-foreground">📋 BUYURTMA: {orderNumber}</div>

              <div className="pt-1 text-muted-foreground">
                <span className="font-semibold text-foreground">🔄 Jarayon:</span> {previewStepper}
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground">📌 Holati:</span> {status} ({stage})
              </div>

              <div className="border-t border-border/60 pt-1.5 space-y-0.5 text-muted-foreground">
                <div>• <span className="font-medium text-foreground">Mahsulot:</span> {productName}</div>
                <div>• <span className="font-medium text-foreground">Material:</span> {paperStock}</div>
                <div>• <span className="font-medium text-foreground">Ishlov:</span> {embellishmentsStr}</div>
                <div>• <span className="font-medium text-foreground">O&apos;lchami:</span> {dimStr}</div>
                <div>• <span className="font-medium text-foreground">Tiraj:</span> {Number(quantity).toLocaleString("uz-UZ")} {unit}</div>
                <div>• <span className="font-medium text-foreground">Topshirish:</span> {deadline}</div>
              </div>

              {customNote.trim() && (
                <div className="border-t border-border/60 pt-1 text-amber-700 dark:text-amber-400 italic">
                  💬 Izoh: {customNote.trim()}
                </div>
              )}
            </div>
          </div>

          {/* Qo'shimcha izoh */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium">Qo&apos;shimcha izoh (ixtiyoriy)</Label>
            <Textarea
              placeholder="Sex va ustalar uchun eslatma yoki o'zgarish sababi..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="h-14 text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 gap-1.5 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Bekor qilish
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleSubmit}
            disabled={isSubmitting || (!isAlreadySent && !selectedChatId)}
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isAlreadySent ? (
              updateMode === "replace_pdf" ? (
                <FileUp className="size-3.5" />
              ) : updateMode === "caption_only" ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Send className="size-3.5" />
              )
            ) : (
              <Send className="size-3.5" />
            )}
            <span>
              {isAlreadySent
                ? updateMode === "replace_pdf"
                  ? "PDF almashtirish"
                  : updateMode === "caption_only"
                  ? "Statusni yangilash"
                  : "Qayta yuborish"
                : "Guruhga yuborish"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
