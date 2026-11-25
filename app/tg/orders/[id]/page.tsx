"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Circle, FileText, Flame, Loader2, Pause, Play, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { telegramApp, useTelegramBackButton, useTgSession } from "../../TgSession";
import type { TgOrderCard } from "@/lib/server/tgOrdersService";
import {
  ATTACHMENT_LABEL,
  CORNER_LABEL,
  EVENT_LABEL,
  ITEM_CATEGORY_LABEL,
  ORDER_TYPE_LABEL,
  PRINT_METHOD_LABEL,
  PRIORITY_LABEL,
  SAMPLE_APPROVAL_LABEL,
  SAMPLE_PURPOSE_LABEL,
  SHAPE_LABEL,
  SHIPMENT_STATUS_LABEL,
  SIDES_LABEL,
  STAGE_LABEL,
  STATUS_LABEL,
  STEP_LABEL,
  TONE_CLASS,
  formatMinutes,
  formatMoney,
  formatNum,
  formatQty,
  shortDate,
  shortDateTime,
  stageTone,
  todayIso,
} from "../labels";

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <div className="mb-1 flex items-center px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        {aside != null && <span className="ml-auto normal-case tracking-normal tabular-nums">{aside}</span>}
      </div>
      <div className="border-y border-border bg-card">{children}</div>
    </section>
  );
}

function Field({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" }) {
  if (value === "" || value === null || value === undefined || value === false) return null;
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 border-b border-border px-3 py-1.5 text-xs last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words text-right", tone === "danger" && "font-medium text-destructive")}>{value}</span>
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

function Bar({ value, total, className }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className={cn("h-1 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full bg-foreground/60" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Files and photos open outside the Mini App webview, where they can be saved or shared. */
function openExternal(url: string) {
  const abs = new URL(url, window.location.origin).toString();
  const app = telegramApp();
  if (app?.openLink) app.openLink(abs);
  else window.open(abs, "_blank", "noopener");
}

const joinNonEmpty = (parts: Array<string | number | false | null | undefined>, sep = " · ") =>
  parts.filter((p) => p !== "" && p !== 0 && p !== false && p != null).join(sep);

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
  const { spec, colors, totals } = order;
  const unitLabel = order.unit === "pcs" ? "dona" : order.unit;
  const checks: Array<[string, boolean]> = [
    ["Dizayn", order.checks.design],
    ["Qog'oz", order.checks.paper],
    ["Plastina", order.checks.plates],
    ["Qolip", order.checks.tooling],
  ];
  const size = spec.width > 0 && spec.height > 0
    ? `${[spec.width, spec.height, spec.depth || null].filter(Boolean).join(" × ")} ${spec.dimensionUnit}`
    : "";
  const sizesTotal = order.sizes.reduce((s, x) => s + x.qty, 0);
  const files = order.attachments.filter((a) => !a.fileType.startsWith("image/"));
  const kpis: Array<[string, number, string?]> = [
    ["Tiraj", order.quantity],
    ["Tayyor", totals.produced],
    ["Brak", totals.waste, totals.waste > 0 ? "text-destructive" : undefined],
    ["Jo'natildi", totals.shipped],
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-lg pb-6">
      {order.photos.length > 0 && (
        <div className="flex snap-x gap-1 overflow-x-auto border-b border-border bg-muted">
          {order.photos.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => openExternal(src)}
              className={cn("h-44 shrink-0 snap-start bg-muted", order.photos.length === 1 ? "w-full" : "w-[80%]")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      <header className="border-b border-border px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium tabular-nums">{order.docNo}</span>
          {order.priority !== "Normal" && (
            <span className={cn("flex items-center gap-0.5", order.priority === "Urgent" ? "text-destructive" : "text-amber-600")}>
              <Flame className="size-3.5" />
              {PRIORITY_LABEL[order.priority] ?? order.priority}
            </span>
          )}
          {order.orderType !== "Production" && (
            <span className="rounded border border-border px-1.5 py-px text-[10px] text-muted-foreground">
              {ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
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

      <div className="grid grid-cols-4 border-b border-border bg-card">
        {kpis.map(([label, value, cls]) => (
          <div key={label} className="border-r border-border px-2 py-1.5 last:border-r-0">
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className={cn("text-xs font-medium tabular-nums", cls)}>{formatNum(value)}</div>
          </div>
        ))}
      </div>
      {order.quantity > 0 && <Bar value={totals.produced} total={order.quantity} className="mx-3 mt-2" />}

      <Section title="Asosiy">
        <Field label="Adad" value={<span className="tabular-nums">{formatQty(order.quantity, order.unit)}</span>} />
        <Field label="Holat" value={STATUS_LABEL[order.status] ?? order.status} />
        <Field label="Joriy bosqich" value={order.currentStep} />
        <Field label="Buyurtma turi" value={ORDER_TYPE_LABEL[order.orderType] ?? order.orderType} />
        <Field label="Mahsulot turi" value={order.productType} />
        <Field label="Mijoz buyurtmasi" value={order.clientOrderId} />
        <Field label="Sex" value={order.department} />
        <Field label="Uchastka" value={order.site} />
        <Field label="Mashina" value={order.pressMachine} />
        <Field label="Retsept" value={order.recipeCode} />
        <Field label="Operator" value={order.operator} />
        <Field label="Smena" value={order.shift} />
        {order.price && order.price.total > 0 && (
          <>
            <Field label="Narx" value={<span className="tabular-nums">{formatMoney(order.price.total, order.price.currency)}</span>} />
            {order.quantity > 0 && (
              <Field
                label="Birlik narxi"
                value={<span className="tabular-nums">{formatMoney(order.price.total / order.quantity, order.price.currency)}</span>}
              />
            )}
          </>
        )}
        <Field label="Bekor sababi" value={order.cancelReason} tone="danger" />
      </Section>

      <Section title="Muddatlar">
        <Field label="Qabul" value={order.orderDate ? shortDate(order.orderDate) : ""} />
        <Field label="Boshlangan" value={order.startDate ? shortDate(order.startDate) : ""} />
        <Field label="Muddat" value={order.deadline ? shortDate(order.deadline) : ""} tone={overdue ? "danger" : undefined} />
        <Field label="Tugagan" value={order.actualEndDate ? shortDate(order.actualEndDate) : ""} />
        <Field label="Yangilangan" value={shortDateTime(order.updatedAt)} />
      </Section>

      <Section title="Texnik">
        <Field label="O'lcham" value={size} />
        <Field label="Bleed" value={spec.bleed ? `${spec.bleed} ${spec.dimensionUnit}` : ""} />
        <Field
          label="Shakl"
          value={joinNonEmpty([SHAPE_LABEL[spec.shape] ?? spec.shape, CORNER_LABEL[spec.corner] ?? spec.corner])}
        />
        <Field label="Kategoriya" value={ITEM_CATEGORY_LABEL[spec.category] ?? spec.category} />
        <Field label="Qog'oz" value={joinNonEmpty([order.paperStock, spec.gsm ? `${spec.gsm} g/m²` : ""])} />
        <Field label="Bosma usuli" value={PRINT_METHOD_LABEL[spec.printMethod] ?? spec.printMethod} />
        <Field label="Xom list" value={spec.parentSheet} />
        <Field label="Bosma list" value={spec.pressSheet} />
        <Field label="Listlar" value={spec.plannedSheets ? <span className="tabular-nums">{formatNum(spec.plannedSheets)}</span> : ""} />
        <Field label="Lak" value={joinNonEmpty([order.coating, spec.coatingZone])} />
        <Field
          label="Laminatsiya"
          value={
            order.lamination
              ? joinNonEmpty([order.lamination, SIDES_LABEL[spec.laminationSides] ?? spec.laminationSides, spec.laminationMicron ? `${spec.laminationMicron} mkm` : ""])
              : ""
          }
        />
        <Field label="Pardoz" value={joinNonEmpty([order.embellishment, spec.embellishmentZone])} />
        <Field label="Etiketka" value={joinNonEmpty([spec.labelMaterial, spec.labelCut, spec.labelFold, spec.labelEdge])} />
        <Field label="Bosma tomonlar" value={spec.labelPrintSides} />
        <Field label="Teshik" value={spec.hole} />
      </Section>

      {(colors.formula || colors.front.length > 0 || colors.back.length > 0 || colors.spot.length > 0) && (
        <Section title="Ranglar">
          <Field label="Formula" value={colors.formula} />
          <Field label="Old tomon" value={colors.front.join(" ")} />
          <Field label="Orqa tomon" value={colors.back.join(" ")} />
          {colors.spot.map((s, i) => (
            <div key={`${s.name}-${i}`} className="flex min-h-8 items-center gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0">
              <span
                className="size-3 shrink-0 rounded-sm border border-border"
                style={s.hex ? { backgroundColor: s.hex } : undefined}
              />
              <span className="min-w-0 flex-1 truncate">{s.name || s.code}</span>
              <span className="text-[11px] text-muted-foreground">{joinNonEmpty([s.name ? s.code : "", s.side])}</span>
            </div>
          ))}
        </Section>
      )}

      {order.sizes.length > 0 && (
        <Section title="Razmerlar" aside={`${formatNum(sizesTotal)} ${unitLabel}`}>
          {order.sizes.map((s, i) => (
            <div key={`${s.label}-${i}`} className="flex h-7 items-center justify-between border-b border-border px-3 text-xs last:border-b-0">
              <span className="truncate">{s.label || "—"}</span>
              <span className="tabular-nums">{formatNum(s.qty)}</span>
            </div>
          ))}
        </Section>
      )}

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
        <Section title="Marshrut" aside={`${order.stepsDone}/${order.stepsTotal}`}>
          {order.steps.map((s) => {
            const meta = joinNonEmpty([s.machine || s.department, s.operator, s.tooling]);
            const timing = joinNonEmpty([
              s.startedAt ? shortDateTime(s.startedAt) : "",
              s.completedAt ? `→ ${shortDateTime(s.completedAt)}` : "",
              s.actualMinutes ? formatMinutes(s.actualMinutes) : s.plannedHours ? `reja ${formatMinutes(s.plannedHours * 60)}` : "",
              s.downtimeMinutes ? `to'xtalish ${formatMinutes(s.downtimeMinutes)}` : "",
            ]);
            return (
              <div key={s.id} className="border-b border-border px-3 py-1.5 last:border-b-0">
                <div className="flex items-center gap-2 text-xs">
                  <StepIcon status={s.status} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-[11px] text-muted-foreground">{STEP_LABEL[s.status] ?? s.status}</span>
                </div>
                {(meta || s.plannedQty > 0) && (
                  <div className="mt-0.5 flex items-center gap-2 pl-5 text-[11px] text-muted-foreground">
                    {meta && <span className="min-w-0 truncate">{meta}</span>}
                    {s.plannedQty > 0 && (
                      <span className="ml-auto shrink-0 tabular-nums">
                        {formatNum(s.completedQty)} / {formatNum(s.plannedQty)}
                      </span>
                    )}
                  </div>
                )}
                {timing && <div className="mt-0.5 pl-5 text-[11px] text-muted-foreground">{timing}</div>}
                {s.plannedQty > 0 && <Bar value={s.completedQty} total={s.plannedQty} className="ml-5 mt-1" />}
                {s.notes && <div className="mt-0.5 whitespace-pre-wrap pl-5 text-[11px]">{s.notes}</div>}
              </div>
            );
          })}
        </Section>
      )}

      {order.materials.length > 0 && (
        <Section title="Materiallar">
          {order.materials.map((m, i) => (
            <div key={`${m.name}-${i}`} className="border-b border-border px-3 py-1.5 text-xs last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="shrink-0 tabular-nums">
                  {formatNum(m.actualQty || m.planQty)} {m.unit}
                </span>
              </div>
              {(m.spec || (m.actualQty > 0 && m.planQty > 0 && m.actualQty !== m.planQty)) && (
                <div className="mt-0.5 flex gap-2 text-[11px] text-muted-foreground">
                  {m.spec && <span className="min-w-0 truncate">{m.spec}</span>}
                  {m.actualQty > 0 && m.planQty > 0 && m.actualQty !== m.planQty && (
                    <span className="ml-auto shrink-0 tabular-nums">reja {formatNum(m.planQty)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {order.tooling.length > 0 && (
        <Section title="Qoliplar">
          {order.tooling.map((t, i) => (
            <div key={`${t.name}-${i}`} className="border-b border-border px-3 py-1.5 text-xs last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {t.quantity > 0 && (
                  <span className="shrink-0 tabular-nums">
                    {formatNum(t.quantity)} {t.unit}
                  </span>
                )}
              </div>
              {(t.spec || t.category) && (
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{joinNonEmpty([t.category, t.spec])}</div>
              )}
            </div>
          ))}
        </Section>
      )}

      {order.sample && (
        <Section title="Namuna">
          <Field label="Holat" value={SAMPLE_APPROVAL_LABEL[order.sample.approval] ?? order.sample.approval} />
          <Field label="Soni" value={order.sample.qty ? formatNum(order.sample.qty) : ""} />
          <Field label="Maqsad" value={SAMPLE_PURPOSE_LABEL[order.sample.purpose] ?? order.sample.purpose} />
          <Field label="Mashina" value={order.sample.machine} />
          <Field label="Tayyorlandi" value={order.sample.produced ? "Ha" : "Yo'q"} />
          <Field label="Nazorat" value={order.sample.qcPassed ? "O'tdi" : "Kutilmoqda"} />
          <Field label="Tasdiqladi" value={order.sample.approvedBy} />
          <Field label="Tuzatishlar" value={order.sample.revisions || ""} />
          <Field label="Izoh" value={order.sample.notes} />
        </Section>
      )}

      {order.packaging && (
        <Section title="Qadoq" aside={`${order.packaging.boxes} quti`}>
          <Field label="Qadoqlandi" value={<span className="tabular-nums">{formatQty(order.packaging.packedQty, order.unit)}</span>} />
          <Field label="Sexda" value={order.packaging.readyQty ? formatNum(order.packaging.readyQty) : ""} />
          <Field label="Topshirildi" value={order.packaging.handedQty ? formatNum(order.packaging.handedQty) : ""} />
          <Field label="Omborda" value={order.packaging.inStockQty ? formatNum(order.packaging.inStockQty) : ""} />
          <Field label="Jo'natildi" value={order.packaging.dispatchedQty ? formatNum(order.packaging.dispatchedQty) : ""} />
          <Field label="Quti turi" value={order.packaging.boxType} />
          <Field label="Quti sig'imi" value={order.packaging.capacity ? formatNum(order.packaging.capacity) : ""} />
        </Section>
      )}

      {order.shipments.length > 0 && (
        <Section title="Jo'natmalar" aside={`${formatNum(totals.shipped)} / ${formatNum(order.quantity)}`}>
          {order.shipments.map((s) => (
            <div key={s.id} className={cn("border-b border-border px-3 py-1.5 text-xs last:border-b-0", s.status === "Cancelled" && "opacity-60")}>
              <div className="flex items-center gap-2">
                <Truck className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium tabular-nums">{s.no}</span>
                <span className="text-[11px] text-muted-foreground">{s.date ? shortDate(s.date) : ""}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{SHIPMENT_STATUS_LABEL[s.status] ?? s.status}</span>
                <span className="w-16 shrink-0 text-right tabular-nums">{formatNum(s.qty)}</span>
              </div>
              {(s.recipient || s.address || s.carrier || s.driver) && (
                <div className="mt-0.5 space-y-0.5 pl-5 text-[11px] text-muted-foreground">
                  {(s.recipient || s.phone) && <div className="truncate">{joinNonEmpty([s.recipient, s.phone])}</div>}
                  {s.address && <div>{s.address}</div>}
                  {(s.carrier || s.driver || s.trackingNo) && (
                    <div className="truncate">{joinNonEmpty([s.carrier, s.driver, s.trackingNo])}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {files.length > 0 && (
        <Section title="Fayllar">
          {files.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openExternal(a.url)}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-1.5 text-left text-xs last:border-b-0 active:bg-muted"
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {joinNonEmpty([ATTACHMENT_LABEL[a.category] ?? a.category, a.fileSize])}
              </span>
            </button>
          ))}
        </Section>
      )}

      {order.notes && (
        <Section title="Izoh">
          <div className="whitespace-pre-wrap px-3 py-2 text-xs">{order.notes}</div>
        </Section>
      )}

      {order.events.length > 0 && (
        <Section
          title="Smena jurnali"
          aside={totals.downtimeMinutes > 0 ? `to'xtalish ${formatMinutes(totals.downtimeMinutes)}` : undefined}
        >
          {order.events.map((e) => (
            <div key={e.id} className="border-b border-border px-3 py-1.5 text-xs last:border-b-0">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 whitespace-nowrap tabular-nums">{shortDateTime(e.at)}</span>
                <span className="shrink-0">{EVENT_LABEL[e.type] ?? e.type}</span>
                {e.step && <span className="ml-auto min-w-0 truncate text-foreground">{e.step}</span>}
              </div>
              {(e.operator || e.shift) && (
                <div className="truncate text-[11px] text-muted-foreground">{joinNonEmpty([e.operator, e.shift])}</div>
              )}
              {e.note && <div className="mt-0.5">{e.note}</div>}
              {(e.goodOutput != null || e.outputPieces > 0 || e.defectQty > 0 || e.makeReadyQty > 0 || e.downtimeMinutes > 0 || e.pallet || e.batch) && (
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  {e.goodOutput != null && (
                    <span>
                      Yaroqli <b className="font-medium tabular-nums text-foreground">{formatNum(e.goodOutput)}</b>
                    </span>
                  )}
                  {e.outputPieces > 0 && e.outputPieces !== e.goodOutput && (
                    <span>
                      Chiqish <b className="font-medium tabular-nums text-foreground">{formatQty(e.outputPieces, order.unit)}</b>
                    </span>
                  )}
                  {e.makeReadyQty > 0 && (
                    <span>
                      Sozlash <b className="font-medium tabular-nums text-foreground">{formatNum(e.makeReadyQty)}</b>
                    </span>
                  )}
                  {e.defectQty > 0 && (
                    <span>
                      Brak <b className="font-medium tabular-nums text-destructive">{formatNum(e.defectQty)}</b>
                      {e.wasteReason && ` · ${e.wasteReason}`}
                    </span>
                  )}
                  {e.downtimeMinutes > 0 && (
                    <span>
                      To&apos;xtalish <b className="font-medium tabular-nums text-foreground">{formatMinutes(e.downtimeMinutes)}</b>
                      {e.downtimeReason && ` · ${e.downtimeReason}`}
                    </span>
                  )}
                  {e.pallet && <span>Palet {e.pallet}</span>}
                  {e.batch && <span>{e.batch}</span>}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}
    </main>
  );
}
