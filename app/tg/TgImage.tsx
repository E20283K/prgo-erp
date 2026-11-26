"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTgSession } from "./TgSession";

// <img> cannot send the Mini App's Bearer token, and /api/* rejects requests without it.
// Fetch through api() and show a blob URL instead; each URL is fetched once per page load.
const cache = new Map<string, Promise<string>>();

function isProtected(src: string) {
  return src.startsWith("/api/");
}

export function TgImage({ src, className }: { src: string; className?: string }) {
  const { api } = useTgSession();
  const [result, setResult] = React.useState<{ src: string; url: string | null } | null>(null);

  React.useEffect(() => {
    if (!isProtected(src)) return;
    let cancelled = false;
    let pending = cache.get(src);
    if (!pending) {
      pending = api(src, { cache: "default" }).then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return URL.createObjectURL(await res.blob());
      });
      pending.catch(() => cache.delete(src));
      cache.set(src, pending);
    }
    pending.then(
      (url) => !cancelled && setResult({ src, url }),
      () => !cancelled && setResult({ src, url: null })
    );
    return () => {
      cancelled = true;
    };
  }, [api, src]);

  const url = isProtected(src) ? (result?.src === src ? result.url : undefined) : src;

  if (url === undefined) return <div className={cn("animate-pulse bg-muted", className)} />;
  if (url === null) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <ImageOff className="size-4 text-muted-foreground" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}
