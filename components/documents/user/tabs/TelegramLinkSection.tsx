"use client";

import React, { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Send, Link2Off, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Binds the user's Telegram account so they can record payouts through the bot. */
export function TelegramLinkSection({ userId }: { userId: string }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [tgId, setTgId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/v1/users/${userId}/telegram-link`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setLinked(j.linked);
          setTgId(j.telegramUserId);
        }
      })
      .catch(() => setLinked(null));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the QR is shown, poll so the badge flips as soon as /start is pressed.
  useEffect(() => {
    if (!url || linked) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [url, linked, load]);

  const createLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const j = await fetch(`/api/v1/users/${userId}/telegram-link`, { method: "POST" }).then((r) => r.json());
      if (!j.success) throw new Error(j.error || "Havola yaratilmadi");
      setUrl(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    await fetch(`/api/v1/users/${userId}/telegram-link`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setUrl(null);
    load();
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="h-9 px-4 bg-muted/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Send className="size-4 text-primary" />
          Telegram bot
        </div>
        {linked !== null && (
          <Badge variant="outline" className="h-5 text-[10px] font-mono">
            {linked ? `ID ${tgId}` : "Bog'lanmagan"}
          </Badge>
        )}
      </div>
      <div className="px-4 py-3 flex items-start gap-4">
        <div className="flex items-center gap-1.5">
          {linked ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={unlink} disabled={busy}>
              <Link2Off className="size-3.5" />
              Uzish
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={createLink} disabled={busy}>
              <Send className="size-3.5" />
              {url ? "Yangilash" : "Bog'lash"}
            </Button>
          )}
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>
        {url && !linked && (
          <div className="flex items-center gap-3">
            <div className="rounded border border-border bg-white p-1.5">
              <QRCodeSVG value={url} size={96} />
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Telegramda ochish
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
