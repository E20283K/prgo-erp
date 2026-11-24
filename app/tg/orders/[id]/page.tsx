"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Circle, Flame, Loader2, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelegramBackButton, useTgSession } from "../../TgSession";
import type { TgOrderCard } from "@/lib/server/tgOrdersService";
import {
  EVENT_LABEL,
  PRIORITY_LABEL,
  STAGE_LABEL,
  STATUS_LABEL,
  STEP_LABEL,
  TONE_CLASS,
  formatQty,
  shortDate,
  stageTone,
  todayIso,
} from "../labels";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="border-y border-border bg-card">{children}</div>
    </section>
  );
}

function Field({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" }) {
  if (value === "" || value === null || value === undefined) return null;
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 border-b border-border px-3 py-1.5 text-xs last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("text-right", tone === "danger" && "font-medium text-destructive")}>{value}</span>
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "completed" || status === "done") return <Check className="size-3.5 text-emerald-600" />;
  if (status === "in_progress") return <Play className="size-3.5 text-sky-600" />;
  if (status === "paused") return <Pause className="size-3.5 text-amber-600" />;
  if (status === "skipped") return <X className="size-3.5 text-muted-foreground" />;
  return <Circle className="size-3.5 text-muted-foreground" />;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${shortDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function OrderCardPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useTgSession();
  const router = useRouter();
  const [order, setOrder] = React.useState<TgOrderCard | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Opened straight from a link there is no list to go back to.
  const goBack = React.useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/tg/orders");
  }, [router]);
  useTelegramBackButton(goBack);

  React.useEffect(() => {
    let cancelled = false;
    api(`/api/v1/tg/orders/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.success) throw new Error(json.error || "Yuklab bo'lmadi");
        setOrder(json.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
      });
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  if (error) return <div className="py-10 text-center text-xs text-destructive">{error}</div>;
  if (!order) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const finished = order.status === "Completed" || order.status === "Cancelled";
  const overdue = !!order.deadline && order.deadline.slice(0, 10) < todayIso() && !finished;
  const finishing = [order.coating, order.lamination, order.embellishment].filter(Boolean).join(", ");
  const checks: Array<[string, boolean]> = [
    ["Dizayn", order.checks.design],
    ["Qog'oz", order.checks.paper],
    ["Plastina", order.checks.plates],
    ["Qolip", order.checks.tooling],
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-lg pb-6">
      <header className="border-b border-border px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium tabular-nums">{order.docNo}</span>
          {order.priority !== "Normal" && (
            <span className={cn("flex items-center gap-0.5", order.priority === "Urgent" ? "text-destructive" : "text-amber-600")}>
              <Flame className="size-3.5" />
              {PRIORITY_LABEL[order.priority] ?? order.priority}
            </span>
          )}
          <span
            className={cn(
              "ml-auto rounded border px-1.5 py-px text-[10px] font-medium",
              TONE_CLASS[stageTone(order.stage, order.status)]
            )}
          >
            {order.status === "Cancelled" || order.status === "Draft"
              ? STATUS_LABEL[order.status]
              : STAGE_LABEL[order.stage] ?? order.stage}
          </span>
        </div>
        <div className="mt-1 text-sm font-medium leading-snug">{order.product}</div>
        <div className="text-xs text-muted-foreground">{order.customer}</div>
      </header>

      <Section title="Asosiy">
        <Field label="Adad" value={<span className="tabular-nums">{formatQty(order.quantity, order.unit)}</span>} />
        <Field label="Holat" value={STATUS_LABEL[order.status] ?? order.status} />
        <Field label="Muddat" value={order.deadline ? shortDate(order.deadline) : ""} tone={overdue ? "danger" : undefined} />
        <Field label="Qabul" value={order.orderDate ? shortDate(order.orderDate) : ""} />
        <Field label="Boshlangan" value={order.startDate ? shortDate(order.startDate) : ""} />
        <Field label="Tugagan" value={order.actualEndDate ? shortDate(order.actualEndDate) : ""} />
        <Field label="Mijoz buyurtmasi" value={order.clientOrderId} />
        <Field label="Turi" value={order.productType} />
        <Field label="Sex" value={order.department} />
        <Field label="Mashina" value={order.pressMachine} />
        <Field label="Qog'oz" value={order.paperStock} />
        <Field label="Pardoz" value={finishing} />
        <Field label="Bekor sababi" value={order.cancelReason} tone="danger" />
      </Section>

      <Section title="Tayyorgarlik">
        <div className="grid grid-cols-4">
          {checks.map(([label, ok]) => (
            <div key={label} className="flex h-9 items-center justify-center gap-1 border-r border-border text-xs last:border-r-0">
              {ok ? <Check className="size-3.5 text-emerald-600" /> : <Circle className="size-3 text-muted-foreground" />}
              <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {order.steps.length > 0 && (
        <Section title={`Marshrut · ${order.stepsDone}/${order.stepsTotal}`}>
          {order.steps.map((s) => {
            const pct = s.plannedQty > 0 ? Math.min(100, Math.round((s.completedQty / s.plannedQty) * 100)) : 0;
            return (
              <div key={s.id} className="border-b border-border px-3 py-1.5 last:border-b-0">
                <div className="flex items-center gap-2 text-xs">
                  <StepIcon status={s.status} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-[11px] text-muted-foreground">{STEP_LABEL[s.status] ?? s.status}</span>
                </div>
                {(s.machine || s.plannedQty > 0) && (
                  <div className="mt-0.5 flex items-center gap-2 pl-5 text-[11px] text-muted-foreground">
                    {s.machine && <span className="truncate">{s.machine}</span>}
                    {s.plannedQty > 0 && (
                      <span className="ml-auto tabular-nums">
                        {s.completedQty.toLocaleString("ru-RU")} / {s.plannedQty.toLocaleString("ru-RU")}
                      </span>
                    )}
                  </div>
                )}
                {s.plannedQty > 0 && (
                  <div className="ml-5 mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground/60" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {order.notes && (
        <Section title="Izoh">
          <div className="whitespace-pre-wrap px-3 py-2 text-xs">{order.notes}</div>
        </Section>
      )}

      {order.events.length > 0 && (
        <Section title="Smena jurnali">
          {order.events.map((e) => (
            <div key={e.id} className="border-b border-border px-3 py-1.5 text-xs last:border-b-0">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">{formatEventTime(e.at)}</span>
                <span>{EVENT_LABEL[e.type] ?? e.type}</span>
                {e.operator && <span className="ml-auto truncate">{e.operator}</span>}
              </div>
              {e.note && <div className="mt-0.5">{e.note}</div>}
              {(e.goodOutput != null || e.wasteQty > 0) && (
                <div className="mt-0.5 flex gap-3 text-[11px] text-muted-foreground">
                  {e.goodOutput != null && (
                    <span>
                      Yaroqli <b className="font-medium tabular-nums text-foreground">{e.goodOutput.toLocaleString("ru-RU")}</b>
                    </span>
                  )}
                  {e.wasteQty > 0 && (
                    <span>
                      Brak <b className="font-medium tabular-nums text-foreground">{e.wasteQty.toLocaleString("ru-RU")}</b>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}
    </main>
  );
}
