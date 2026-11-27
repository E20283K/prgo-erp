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
  ImageOff,
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
  /** Production site (branch or company id); picks the orders group. */
  site?: string;
  telegramMeta?: WorkOrderTelegramMeta | null;
  onSuccess?: (meta?: WorkOrderTelegramMeta) => void;
}

interface ChatOption {
  id: string;
  chatId: string;
  title: string;
  clientName?: string | null;
}

interface ResolvedOrdersChat {
  id: string;
  chatId: string;
  title: string;
  source: "manual" | "branch" | "company" | "default" | "client";
  sourceName?: string;
}

const CHAT_SOURCE_LABEL: Record<ResolvedOrdersChat["source"], string> = {
  manual: "Tanlangan",
  branch: "Filial",
  company: "Tashkilot",
  default: "Asosiy",
  client: "Mijoz",
};

type UpdateMode = "caption_only" | "replace_pdf" | "resend_new";

type CardLogo = "printgoo" | "label" | "none";

const CARD_LOGO_OPTIONS: { value: CardLogo; label: string }[] = [
  { value: "printgoo", label: "PrintGoo" },
  { value: "label", label: "Label" },
  { value: "none", label: "Yo'q" },
];

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
  site,
  telegramMeta,
  onSuccess,
}: TelegramOrdersGroupModalProps) {
  const { addNotification } = useWorkspaceStore();

  const [chats, setChats] = useState<ChatOption[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [resolvedChat, setResolvedChat] = useState<ResolvedOrdersChat | null>(null);
  const [customNote, setCustomNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Xabar avval yuborilgan bo'lsa yangilash rejimi
  const isAlreadySent = Boolean(telegramMeta?.messageId);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("replace_pdf");
  const [sendAlertReply, setSendAlertReply] = useState<boolean>(true);

  // Buyurtma kartasi (PNG) preview — saqlangan buyurtma holatidan
  const [cardNote, setCardNote] = useState("");
  const [cardNonce, setCardNonce] = useState(0);
  // null = oxirgi yuborilgan logotip (telegramMeta), aks holda foydalanuvchi tanlovi
  const [cardLogoChoice, setCardLogoChoice] = useState<CardLogo | null>(null);
  const cardLogo: CardLogo =
    cardLogoChoice ?? CARD_LOGO_OPTIONS.find((o) => o.value === telegramMeta?.cardLogo)?.value ?? "printgoo";
  const setCardLogo = (logo: CardLogo) => setCardLogoChoice(logo);

  // So'ralgan preview kaliti; natija shu kalit bilan saqlanadi, mos kelmasa — yuklanmoqda
  const cardKey = `${workOrderId}|${cardLogo}|${cardNote}|${cardNonce}`;
  const [cardResult, setCardResult] = useState<{ key: string; url: string | null; error: boolean }>({
    key: "",
    url: null,
    error: false,
  });
  const cardLoading = isOpen && cardResult.key !== cardKey;
  const cardUrl = cardResult.url;
  const cardError = cardResult.error;

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const params = new URLSearchParams({ logo: cardLogo });
    if (cardNote) params.set("note", cardNote);
    fetch(`/api/v1/production/work-orders/${encodeURIComponent(workOrderId)}/order-card?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok || !r.headers.get("content-type")?.includes("image")) throw new Error(String(r.status));
        objectUrl = URL.createObjectURL(await r.blob());
        setCardResult({ key: cardKey, url: objectUrl, error: false });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn("order card preview:", err);
        setCardResult({ key: cardKey, url: null, error: true });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, workOrderId, cardNote, cardNonce, cardLogo, cardKey]);

  const closeDialog = () => {
    setCardLogoChoice(null);
    onClose();
  };

  const refreshCard = () => {
    const note = customNote.trim();
    if (note !== cardNote) setCardNote(note);
    else setCardNonce((n) => n + 1);
  };

  // Guruhlarni va tizim sozlamalarini yuklash
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingChats(true);

    Promise.all([
      fetch("/api/v1/crm/telegram/chats").then((r) => r.json()).catch(() => ({})),
      fetch(
        `/api/v1/production/work-orders/${encodeURIComponent(workOrderId)}/send-orders-group?${new URLSearchParams({ site: site || "" }).toString()}`,
        { cache: "no-store" }
      )
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([chatsRes, resolvedRes]) => {
        if (!isMounted) return;

        if (chatsRes?.success && Array.isArray(chatsRes.data)) {
          setChats(chatsRes.data);
        }

        const resolved: ResolvedOrdersChat | null = resolvedRes?.success ? resolvedRes.data ?? null : null;
        setResolvedChat(resolved);

        if (telegramMeta?.chatId) {
          // The meta keeps the chat row id; the select is keyed by the Telegram chat id
          const sentChat = (chatsRes?.data as ChatOption[] | undefined)?.find(
            (c) => c.id === telegramMeta.chatId || c.chatId === telegramMeta.chatId
          );
          setSelectedChatId(sentChat?.chatId ?? telegramMeta.chatId);
        } else if (resolved?.chatId) {
          setSelectedChatId(resolved.chatId);
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
  }, [isOpen, telegramMeta, workOrderId, site]);

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

    return steps.map((s, idx) => ({
      label: s.label,
      mark: idx < activeIndex ? "✓" : idx === activeIndex ? "▶" : "○",
      active: idx === activeIndex,
    }));
  }, [stage]);

  // Server tomondagi buildClientHashtag bilan bir xil qoida
  const clientTag = useMemo(() => {
    const tag = customerName
      .toUpperCase()
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "");
    return tag && /\p{L}/u.test(tag) ? `#${tag}` : "";
  }, [customerName]);

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
            logo: cardLogo,
          }),
        }
      );

      const json = await res.json();
      if (json.success) {
        let successTitle = "Guruhga yuborildi";
        let successDesc = `Buyurtma ${orderNumber} Telegram guruhga muvaffaqiyatli jo'natildi.`;

        if (isReplacingPdf) {
          successTitle = "Karta yangilandi";
          successDesc = "Guruhdagi mavjud xabarning buyurtma kartasi yangilandi.";
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
        closeDialog();
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeDialog();
      }}
    >
      <DialogContent className="p-4 sm:max-w-5xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" />
            <span>Telegram Buyurtmalar guruhiga yuborish</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1 text-xs md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Buyurtma kartasi (rasm) */}
        <div className="flex flex-col gap-1 min-h-0">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-medium">Buyurtma kartasi</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Logotip</span>
              <div className="flex items-center rounded border border-border bg-muted/30 p-0.5">
                {CARD_LOGO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCardLogo(opt.value)}
                    disabled={cardLoading}
                    className={`h-5 px-2 rounded-sm text-[10px] transition-colors ${
                      cardLogo === opt.value
                        ? "bg-card text-foreground font-medium shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-1"
                onClick={refreshCard}
                disabled={cardLoading}
              >
                <RefreshCw className={`size-3 ${cardLoading ? "animate-spin" : ""}`} />
                <span>Yangilash</span>
              </Button>
            </div>
          </div>
          <div className="relative h-[300px] md:h-[min(70vh,640px)] rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden p-2">
            {cardUrl && !cardError ? (
              <a href={cardUrl} target="_blank" rel="noreferrer" className="h-full w-full flex items-center justify-center">
                <img
                  src={cardUrl}
                  alt={`${orderNumber} buyurtma kartasi`}
                  className={`max-h-full max-w-full object-contain bg-white transition-opacity ${cardLoading ? "opacity-40" : ""}`}
                />
              </a>
            ) : cardError && !cardLoading ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ImageOff className="size-3.5" />
                <span>Karta yaratilmadi — PDF yuboriladi</span>
              </div>
            ) : null}
            {cardLoading && (
              <Loader2 className="absolute size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="space-y-3 min-w-0 md:max-h-[min(70vh,640px)] md:overflow-y-auto md:pr-1">
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
                    <span>Kartani almashtirish</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Rasmni yangilash
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

          {/* Maydon o'zgargan: xabar eski guruhda qolgan */}
          {isAlreadySent && resolvedChat && telegramMeta?.chatId && resolvedChat.id !== telegramMeta.chatId &&
            resolvedChat.chatId !== telegramMeta.chatId && (
            <div className="flex items-center gap-1.5 rounded border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">Maydon guruhi boshqa: {resolvedChat.title}</span>
              {updateMode !== "resend_new" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-6 px-2 text-[11px]"
                  onClick={() => {
                    setUpdateMode("resend_new");
                    setSelectedChatId(resolvedChat.chatId);
                  }}
                >
                  Qayta yuborish
                </Button>
              )}
            </div>
          )}

          {/* Qabul qiluvchi guruh (agar yangi bo'lsa yoki qayta yuborilayotgan bo'lsa) */}
          {(!isAlreadySent || updateMode === "resend_new") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium">Qabul qiluvchi guruh</Label>
                {resolvedChat && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                    {CHAT_SOURCE_LABEL[resolvedChat.source]}
                    {resolvedChat.sourceName ? `: ${resolvedChat.sourceName}` : ""}
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
            <Label className="text-[11px] font-medium">Xabar matni</Label>
            <div className="p-2.5 rounded border border-border bg-card font-mono text-[11px] space-y-1.5 leading-relaxed">
              <div className="text-primary font-bold">🏭 {clientTag || customerName.toUpperCase()}</div>
              <div className="font-bold text-foreground">📋 BUYURTMA: {orderNumber}</div>

              <div className="pt-1 text-muted-foreground">
                <div className="font-semibold text-foreground">🔄 Jarayon:</div>
                {previewStepper.map((s) => (
                  <div key={s.label} className={s.active ? "font-semibold text-foreground" : undefined}>
                    {s.mark} {s.label}
                  </div>
                ))}
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
        </div>

        <DialogFooter className="pt-2 gap-1.5 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={closeDialog}
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
                  ? "Kartani almashtirish"
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
