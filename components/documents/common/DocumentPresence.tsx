"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentTab } from "@/components/layout/TabContentWrapper";

const HEARTBEAT_MS = 10_000;
const EDITING_WINDOW_MS = 20_000;
const MAX_VISIBLE = 4;
const ENDPOINT = "/api/v1/presence";

interface Viewer {
  userId: string;
  name: string;
  initials: string;
  avatar: string | null;
  editing: boolean;
  since: number;
}

const COLORS = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-teal-600",
  "bg-orange-600",
  "bg-indigo-600",
];

function colorFor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function sendLeave(key: string, sid: string) {
  const payload = JSON.stringify({ key, sid, leave: true });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([payload], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Heartbeats the current user's presence on the active document tab and
 * returns the other users who have the same document open.
 */
function useDocumentPresence(): Viewer[] {
  const tab = useDocumentTab();
  const [viewers, setViewers] = React.useState<Viewer[]>([]);
  const lastInputRef = React.useRef(0);

  const key = tab ? `${tab.tabType}:${tab.tabId}`.replace(/[^\w:.\-]/g, "_").slice(0, 160) : null;
  const active = Boolean(tab?.isActive);
  const containerRef = tab?.containerRef;

  // Typing inside this tab marks the user as editing for a short window.
  React.useEffect(() => {
    if (!active || !containerRef) return;
    const onInput = (event: Event) => {
      const root = containerRef.current;
      if (root && event.target instanceof Node && root.contains(event.target)) {
        lastInputRef.current = Date.now();
      }
    };
    window.addEventListener("input", onInput, true);
    window.addEventListener("change", onInput, true);
    return () => {
      window.removeEventListener("input", onInput, true);
      window.removeEventListener("change", onInput, true);
    };
  }, [active, containerRef]);

  React.useEffect(() => {
    if (!key || !active) return;
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // A background browser tab still counts as "has it open" (like Google Docs);
    // only closing the page or switching the workspace tab leaves.
    const beat = async () => {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            sid,
            editing: Date.now() - lastInputRef.current < EDITING_WINDOW_MS,
          }),
        });
        const json = await res.json();
        if (!cancelled && json?.success) setViewers(json.data as Viewer[]);
      } catch {
        // Network hiccup: keep the last known list.
      }
    };

    const loop = async () => {
      await beat();
      if (!cancelled) timer = setTimeout(loop, HEARTBEAT_MS);
    };
    loop();

    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    const onPageHide = () => sendLeave(key, sid);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      sendLeave(key, sid);
      setViewers([]);
    };
  }, [key, active]);

  return active ? viewers : [];
}

function ViewerAvatar({ viewer, className }: { viewer: Viewer; className?: string }) {
  return (
    <Avatar size="sm" className={cn("size-6 ring-2 ring-muted", className)}>
      {viewer.avatar && <AvatarImage src={viewer.avatar} alt={viewer.name} />}
      <AvatarFallback className={cn("text-[10px] font-semibold text-white", colorFor(viewer.userId))}>
        {viewer.initials}
      </AvatarFallback>
      {viewer.editing && (
        <span className="absolute -right-0.5 -bottom-0.5 z-10 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-background">
          <Pencil className="size-2" />
        </span>
      )}
    </Avatar>
  );
}

export function DocumentPresence() {
  const t = useTranslations("DocumentShell");
  const viewers = useDocumentPresence();
  if (viewers.length === 0) return null;

  const visible = viewers.slice(0, MAX_VISIBLE);
  const hidden = viewers.slice(MAX_VISIBLE);
  const status = (v: Viewer) => (v.editing ? t("presenceEditing") : t("presenceViewing"));

  return (
    <div className="flex items-center -space-x-1.5 mr-1" aria-label={t("presenceLabel")}>
      {visible.map((viewer) => (
        <Tooltip key={viewer.userId}>
          <TooltipTrigger render={<span className="relative inline-flex cursor-default" />}>
            <ViewerAvatar viewer={viewer} />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <div className="font-medium">{viewer.name}</div>
            <div className="opacity-70">{status(viewer)}</div>
          </TooltipContent>
        </Tooltip>
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="relative inline-flex size-6 items-center justify-center rounded-full bg-background text-[10px] font-semibold text-muted-foreground ring-2 ring-muted border border-border cursor-default" />
            }
          >
            +{hidden.length}
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs space-y-0.5">
            {hidden.map((v) => (
              <div key={v.userId}>
                {v.name} <span className="opacity-70">· {status(v)}</span>
              </div>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
