"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Flame, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelegramBackButton, useTgSession } from "../TgSession";
import type { TgOrderRow, TgOrderScope } from "@/lib/server/tgOrdersService";
import { STAGE_LABEL, TONE_CLASS, formatQty, shortDate, stageTone, todayIso } from "./labels";

const SCOPES: Array<{ key: TgOrderScope; label: string }> = [
  { key: "active", label: "Faol" },
  { key: "done", label: "Tayyor" },
  { key: "all", label: "Hammasi" },
];

function OrdersScreen() {
  const { api } = useTgSession();
  const router = useRouter();
  const params = useSearchParams();
  const initialScope = params.get("scope") as TgOrderScope | null;
  const [scope, setScope] = React.useState<TgOrderScope>(
    initialScope && SCOPES.some((s) => s.key === initialScope) ? initialScope : "active"
  );
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [result, setResult] = React.useState<{ key: string; rows: TgOrderRow[] | null; error: string | null } | null>(null);

  const goBack = React.useCallback(() => router.push("/tg"), [router]);
  useTelegramBackButton(goBack);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // The result remembers which request it answers; until the current one arrives the list shows loading.
  const qs = new URLSearchParams({ scope });
  if (debounced) qs.set("q", debounced);
  const requestKey = qs.toString();
  React.useEffect(() => {
    let cancelled = false;
    api(`/api/v1/tg/orders?${requestKey}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.success) throw new Error(json.error || "Yuklab bo'lmadi");
        setResult({ key: requestKey, rows: json.data, error: null });
      })
      .catch((e) => {
        if (!cancelled) setResult({ key: requestKey, rows: null, error: e instanceof Error ? e.message : "Yuklab bo'lmadi" });
      });
    return () => {
      cancelled = true;
    };
  }, [api, requestKey]);
  const current = result?.key === requestKey ? result : null;
  const rows = current?.rows ?? null;
  const error = current?.error ?? null;

  const today = todayIso();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 space-y-2 border-b border-border bg-background px-3 pb-2 pt-2">
        <div className="grid h-8 grid-cols-3 rounded-md border border-border bg-muted p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setScope(s.key);
                router.replace(`/tg/orders?scope=${s.key}`);
              }}
              className={cn(
                "rounded-[5px] text-xs",
                scope === s.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Raqam, mijoz, mahsulot"
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-foreground/30"
          />
        </div>
      </header>

      <section className="flex-1 pb-6">
        {error ? (
          <div className="py-10 text-center text-xs text-destructive">{error}</div>
        ) : rows === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">{debounced ? "Topilmadi" : "Buyurtma yo'q"}</div>
        ) : (
          <ul>
            {rows.map((o) => {
              const overdue = !!o.deadline && o.deadline.slice(0, 10) < today && o.status !== "Completed" && o.status !== "Cancelled";
              return (
                <li key={o.id} className="border-b border-border">
                  <Link href={`/tg/orders/${o.id}`} className="flex items-center gap-2 px-3 py-2 active:bg-muted">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium tabular-nums">{o.docNo}</span>
                        {o.priority === "Urgent" && <Flame className="size-3.5 text-destructive" aria-label="Shoshilinch" />}
                        {o.priority === "High" && <Flame className="size-3.5 text-amber-600" aria-label="Yuqori" />}
                        <span className="truncate text-muted-foreground">{o.customer}</span>
                      </div>
                      <div className="truncate text-sm">{o.product}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span
                          className={cn(
                            "rounded border px-1.5 py-px text-[10px] font-medium",
                            TONE_CLASS[stageTone(o.stage, o.status)]
                          )}
                        >
                          {o.status === "Cancelled" ? "Bekor" : o.status === "Draft" ? "Qoralama" : STAGE_LABEL[o.stage] ?? o.stage}
                        </span>
                        <span className="tabular-nums">{formatQty(o.quantity, o.unit)}</span>
                        {o.stepsTotal > 0 && (
                          <span className="tabular-nums">
                            {o.stepsDone}/{o.stepsTotal}
                          </span>
                        )}
                        {o.deadline && (
                          <span className={cn("ml-auto tabular-nums", overdue && "font-medium text-destructive")}>
                            {shortDate(o.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function OrdersPage() {
  return (
    <React.Suspense fallback={null}>
      <OrdersScreen />
    </React.Suspense>
  );
}
