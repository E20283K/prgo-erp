"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  Undo2,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BomItem } from "../BomMaterialsGrid";
import type { MaterialFlowView, MaterialFlowLine, MaterialFlowOutsideLine } from "@/lib/server/workOrderMaterialService";
import { useWorkspaceStore, type MaterialStatus } from "@/store/workspaceStore";

interface MaterialFlowPanelProps {
  workOrderNo: string;
  isOperator?: boolean;
  /** Buyurtmada saqlanmagan o'zgarish bor — rezerv saqlangan BOM bo'yicha hisoblanadi */
  dirty?: boolean;
  /** Smena jurnalidagi chiqindi list — asosiy qog'oz sarfiga qo'shib taklif qilinadi */
  shiftWasteSheets?: number;
  onOpenIssueTab?: (docNo: string) => void;
  onClosed?: (materials: BomItem[], issueDocNo?: string) => void;
  /** Har yangilanishda — material jadvalidagi "Band" / "Berildi" ustunlari uchun */
  onFlowChange?: (flow: MaterialFlowView | null) => void;
}

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

const STATUS_LABEL: Record<MaterialFlowView["status"], string> = {
  planned: "Reja",
  reserved: "Band",
  issued: "Sexda",
  closed: "Yakunlangan",
};

const STATUS_CLASS: Record<MaterialFlowView["status"], string> = {
  planned: "border-border text-muted-foreground",
  reserved: "border-blue-500/40 text-blue-700 dark:text-blue-300",
  issued: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  closed: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
};

type DialogMode = "close" | null;

/** Ro'yxat va Overview belgisi qayta yuklashsiz yangilansin */
function syncQueueStatus(workOrderNo: string, flow: MaterialFlowView | null) {
  if (!flow) return;
  const hasPlan = flow.lines.some((l) => l.plan > 0);
  const status: MaterialStatus = flow.status === "planned" && !hasPlan ? "none" : flow.status;
  useWorkspaceStore.setState((s) => ({
    productionQueue: s.productionQueue.map((q) =>
      q.id === workOrderNo || q.docNo === workOrderNo ? { ...q, materialStatus: status } : q
    ),
  }));
}

export function MaterialFlowPanel({
  workOrderNo,
  isOperator,
  dirty,
  shiftWasteSheets = 0,
  onOpenIssueTab,
  onClosed,
  onFlowChange,
}: MaterialFlowPanelProps) {
  const [flow, setFlow] = useState<MaterialFlowView | null>(null);

  useEffect(() => {
    onFlowChange?.(flow);
  }, [flow, onFlowChange]);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<DialogMode>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const url = `/api/v1/production/work-orders/${encodeURIComponent(workOrderNo)}/materials`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success) setFlow(json.data);
    } catch {
      /* panel keyingi amalda qayta yuklanadi */
    }
  }, [url]);

  useEffect(() => {
    if (workOrderNo && !dirty) void load();
  }, [workOrderNo, dirty, load]);

  const post = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      setBusy(action);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Xatolik");
        setFlow(json.data);
        syncQueueStatus(workOrderNo, json.data);
        return json;
      } catch (e) {
        toast.add({ title: "Amal bajarilmadi", description: e instanceof Error ? e.message : String(e), type: "error" });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [url, workOrderNo]
  );

  const lines = useMemo(() => flow?.lines ?? [], [flow]);
  const closed = flow?.status === "closed";
  // Yetishmovchilik rezerv urinishidan keyin ma'noli: reja holatida hamma qator "band emas"
  const shortLines = lines.filter((l) => !closed && flow?.status !== "planned" && l.plan > 0 && l.reserved + Math.max(0, l.net) + 1e-9 < l.plan);
  const hasReservation = lines.some((l) => l.reserved > 0);
  const hasIssued = lines.some((l) => l.issued > 0);
  const substrateSku = useMemo(
    () => lines.find((l) => l.category === "Paper & Board" || l.category === "Roll & Label")?.sku,
    [lines]
  );

  const handleReserve = async () => {
    const json = await post("reserve");
    if (!json) return;
    if (json.shortages?.length) {
      toast.add({ title: "Qisman band qilindi", description: json.shortages.join("; "), type: "warning" });
    } else {
      toast.add({ title: "Xomashyo band qilindi", type: "success" });
    }
  };

  // Sexga berish faqat ombor modulida (ISS hujjati buyurtma raqami bilan) — bu yerda holat va hujjatlar ko'rinadi
  const openClose = () => {
    const next: Record<string, string> = {};
    for (const l of lines) {
      let q = l.net > 0 ? l.net : l.plan;
      if (l.sku === substrateSku && shiftWasteSheets > 0 && q === l.plan) q += shiftWasteSheets;
      next[l.sku] = String(q);
    }
    setDraft(next);
    setMode("close");
  };

  const confirmClose = async () => {
    const payload = lines.map((l) => ({ sku: l.sku, actualQty: Number(draft[l.sku]) || 0 }));
    const json = await post("close", { lines: payload });
    if (!json) return;
    setMode(null);
    onClosed?.(json.materials || [], json.materialIssueDocNo);
    const docs: string[] = json.documents || [];
    const hasReturn = docs.some((n) => n.startsWith("RET-"));
    toast.add({
      title: "Sarf yakunlandi",
      description: docs.length
        ? `${docs.join(", ")}${hasReturn ? " · qaytarishni omborchi qabul qiladi" : ""}`
        : undefined,
      type: "success",
    });
  };

  if (!workOrderNo) return null;

  const canAct = !isOperator && !closed && !dirty && !busy;
  const reservedLines = lines.filter((l) => l.plan > 0 && l.reserved + Math.max(0, l.net) + 1e-9 >= l.plan).length;
  const planLines = lines.filter((l) => l.plan > 0).length;

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="flex items-center gap-2 h-9 px-2 text-xs min-w-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 font-semibold text-foreground cursor-pointer shrink-0"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <span>Xomashyo oqimi</span>
        </button>
        {flow && (
          <span className={cn("px-1.5 h-5 inline-flex items-center rounded border text-[11px] font-medium shrink-0", STATUS_CLASS[flow.status])}>
            {STATUS_LABEL[flow.status]}
          </span>
        )}
        {flow && planLines > 0 && !closed && (
          <span className="text-muted-foreground tabular-nums shrink-0">
            Ta&apos;minlangan {reservedLines}/{planLines}
          </span>
        )}
        {shortLines.length > 0 && (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 shrink-0" title={shortLines.map((l) => l.name).join(", ")}>
            <AlertTriangle className="size-3.5" />
            Yetishmaydi {shortLines.length}
          </span>
        )}
        {flow && flow.unmatched.length > 0 && (
          <span className="flex items-center gap-1 text-destructive shrink-0" title={flow.unmatched.join(", ")}>
            <AlertTriangle className="size-3.5" />
            Katalogda yo&apos;q {flow.unmatched.length}
          </span>
        )}

        <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
          {(flow?.docs || []).map((d) => (
            <button
              key={d.number}
              type="button"
              onClick={() => onOpenIssueTab?.(d.number)}
              className={cn(
                "inline-flex items-center gap-1 font-mono text-[11px] px-1.5 h-5 rounded border cursor-pointer hover:bg-muted shrink-0",
                d.pending
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : d.type === "ProductionReturn"
                  ? "border-border text-muted-foreground"
                  : "border-border text-foreground"
              )}
              title={`${fmt(d.quantity)} ${d.unit}${d.pending ? " · omborchi tasdiqlamagan" : ""}`}
            >
              {d.number}
              {d.pending && <span className="font-sans">Kutilmoqda</span>}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {dirty && !closed && <span className="text-muted-foreground">Avval saqlang</span>}
          {!isOperator && !closed && (
            <>
              {hasReservation && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={!canAct} onClick={() => post("release")}>
                  <Unlock className="size-3.5" />
                  Bo&apos;shatish
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!canAct || planLines === 0} onClick={handleReserve}>
                {busy === "reserve" ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                Band qilish
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" disabled={!canAct || (!hasIssued && planLines === 0)} onClick={openClose}>
                <CheckCircle2 className="size-3.5" />
                Yakunlash
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && flow && (
        <div className="border-t border-border max-h-56 overflow-auto">
          <FlowTable lines={lines} outside={flow.outside} />
        </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-[760px] w-[95vw] p-0 overflow-hidden bg-card border border-border flex flex-col">
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <DialogTitle className="text-xs font-semibold">Sarfni yakunlash</DialogTitle>
            <DialogDescription className="sr-only">{workOrderNo}</DialogDescription>
          </DialogHeader>
          <div className="p-3 max-h-[60vh] overflow-auto">
            <table className="w-full text-xs min-w-[620px]">
              <thead className="text-[11px] text-muted-foreground border-b border-border">
                <tr className="h-7">
                  <th className="text-left px-2 font-medium">Xomashyo</th>
                  <th className="text-left px-2 font-medium">Ombor</th>
                  <th className="text-right px-2 font-medium">Reja</th>
                  <th className="text-right px-2 font-medium">Sexda</th>
                  <th className="text-right px-2 font-medium w-28">Haqiqiy sarf</th>
                  <th className="text-right px-2 font-medium">Farq</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const v = Number(draft[l.sku]) || 0;
                  const diff = v - l.net;
                  return (
                    <tr key={l.sku} className="h-7 border-b border-border/60">
                      <td className="px-2 truncate max-w-[220px]" title={`${l.sku} — ${l.name}`}>
                        {l.name}
                      </td>
                      <td className="px-2 text-muted-foreground truncate max-w-[120px]">{l.locationName || "—"}</td>
                      <td className="px-2 text-right tabular-nums">{fmt(l.plan)}</td>
                      <td className="px-2 text-right tabular-nums">{fmt(l.net)}</td>
                      <td className="px-1 text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={draft[l.sku] ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [l.sku]: e.target.value }))}
                          className="h-7 w-full rounded border border-border bg-background px-2 text-right text-xs tabular-nums outline-none focus:border-primary"
                        />
                      </td>
                        <td
                          className={cn(
                            "px-2 text-right tabular-nums whitespace-nowrap",
                            diff < -1e-9 && "text-blue-700 dark:text-blue-300",
                            diff > 1e-9 && "text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {Math.abs(diff) < 1e-9 ? "—" : diff < 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Undo2 className="size-3" />
                              {fmt(-diff)}
                            </span>
                          ) : (
                            `+${fmt(diff)}`
                          )}
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                  <Undo2 className="size-3" />
                  Omborga qaytadi
                </span>
                <span className="text-amber-700 dark:text-amber-300">+ Qo&apos;shimcha beriladi</span>
              </div>
          </div>
          <DialogFooter className="px-4 py-2.5 border-t border-border">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMode(null)}>
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={!!busy}
              onClick={confirmClose}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Yakunlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const OUTSIDE_LABEL: Record<MaterialFlowOutsideLine["reason"], string> = {
  no_catalog: "Katalogda yo'q",
  client: "Mijoz materiali",
};

function FlowTable({ lines, outside = [] }: { lines: MaterialFlowLine[]; outside?: MaterialFlowOutsideLine[] }) {
  if (lines.length === 0 && outside.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">Material yo&apos;q</div>;
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-[11px] text-muted-foreground bg-muted/40 sticky top-0">
        <tr className="h-7">
          <th className="text-left px-2 font-medium">Xomashyo</th>
          <th className="text-left px-2 font-medium">Ombor</th>
          <th className="text-right px-2 font-medium">Reja</th>
          <th className="text-right px-2 font-medium">Band</th>
          <th className="text-right px-2 font-medium">Berilgan</th>
          <th className="text-right px-2 font-medium">Qaytarilgan</th>
          <th className="text-right px-2 font-medium">Bo&apos;sh</th>
          <th className="text-left px-2 font-medium">Birlik</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.sku} className="h-[26px] border-t border-border/60">
            <td className="px-2 truncate max-w-[260px]" title={l.sku}>
              {l.name}
            </td>
            <td className="px-2 text-muted-foreground">{l.locationName || "—"}</td>
            <td className="px-2 text-right tabular-nums">{fmt(l.plan)}</td>
            <td className="px-2 text-right tabular-nums">{fmt(l.reserved)}</td>
            <td className="px-2 text-right tabular-nums">{fmt(l.issued)}</td>
            <td className="px-2 text-right tabular-nums">{fmt(l.returned)}</td>
            <td className="px-2 text-right tabular-nums text-muted-foreground">{fmt(l.free)}</td>
            <td className="px-2 text-muted-foreground">{l.unit}</td>
          </tr>
        ))}
        {outside.map((o, i) => (
          <tr key={`out-${i}-${o.sku}`} className="h-[26px] border-t border-border/60">
            <td className="px-2 truncate max-w-[260px]" title={o.sku}>
              {o.name}
            </td>
            <td className="px-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  o.reason === "client" ? "text-muted-foreground" : "text-destructive"
                )}
              >
                {o.reason !== "client" && <AlertTriangle className="size-3" />}
                {OUTSIDE_LABEL[o.reason]}
              </span>
            </td>
            <td className="px-2 text-right tabular-nums">{fmt(o.plan)}</td>
            <td className="px-2 text-right text-muted-foreground" colSpan={4}>
              —
            </td>
            <td className="px-2 text-muted-foreground">{o.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
