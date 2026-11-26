"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw } from "lucide-react";
import type { PnlLine, PnlReport as Report } from "@/lib/server/treasuryService";
import { apiJson, currentMonth, fmtMoney } from "./format";

export function PnlReport() {
  const [from, setFrom] = useState(currentMonth());
  const [to, setTo] = useState(currentMonth());
  const [nonce, setNonce] = useState(0);
  const requestKey = `${from}|${to}` + `#${nonce}`;
  const [result, setResult] = useState<{ key: string; report: Report | null; error: string | null }>({
    key: "",
    report: null,
    error: null,
  });
  const report = result.report;
  const error = result.key === requestKey ? result.error : null;
  const loading = result.key !== requestKey;
  const load = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    apiJson<{ data: Report }>(`/api/v1/finance/reports/pnl?from=${from}&to=${to}`)
      .then((j) => alive && setResult({ key: requestKey, report: j.data, error: null }))
      .catch((e) => alive && setResult((r) => ({ key: requestKey, report: r.report, error: e instanceof Error ? e.message : "Xatolik" })));
    return () => {
      alive = false;
    };
  }, [from, to, requestKey]);

  const t = report?.totals;
  const repriced = report?.materialPricing?.repriced ?? 0;
  const unpriced = report?.materialPricing?.unpriced ?? 0;
  const margin = t && t.revenue ? Math.round((t.netProfit / t.revenue) * 1000) / 10 : null;

  return (
    <div className="flex flex-col h-full bg-background text-xs">
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 bg-muted/60 px-2 h-7 rounded border border-border/70">
          <Calendar className="size-3 text-muted-foreground" />
          <input type="month" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="bg-transparent font-mono text-xs focus:outline-none" />
          <span className="text-muted-foreground">—</span>
          <input type="month" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="bg-transparent font-mono text-xs focus:outline-none" />
        </div>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={load} disabled={loading} aria-label="Yangilash">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {error ? (
          <div className="text-destructive">{error}</div>
        ) : (
          <table className="w-full max-w-[640px] border-collapse">
            <tbody>
              <Section title="Daromad" lines={report?.revenue} />
              <Total label="Jami daromad" value={t?.revenue} />
              <Section title="Tannarx" lines={report?.cogs} />
              <Total label="Jami tannarx" value={t?.cogs} />
              <Total label="Yalpi foyda" value={t?.grossProfit} strong />
              <Section title="Davr xarajatlari" lines={report?.opex} />
              <Total label="Jami xarajat" value={t?.opex} />
              <Total label="Sof foyda" value={t?.netProfit} strong signed />
              <tr>
                <td className="px-2 h-[26px] text-muted-foreground">Rentabellik</td>
                <td className="px-2 text-right font-mono">{margin === null ? "—" : `${margin}%`}</td>
              </tr>
              {(repriced > 0 || unpriced > 0) && (
                <tr>
                  <td colSpan={2} className="px-2 pt-2 text-[11px] text-muted-foreground">
                    Xomashyo:
                    {repriced > 0 && ` ${repriced} qator joriy narxda`}
                    {repriced > 0 && unpriced > 0 && ","}
                    {unpriced > 0 && <span className="text-amber-600 dark:text-amber-400"> {unpriced} qator narxsiz</span>}
                  </td>
                </tr>
              )}
              {(report?.capex.length ?? 0) > 0 && (
                <>
                  <Section title="Asosiy vositalar" lines={report?.capex} />
                  <Total label="Jami" value={t?.capex} />
                </>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Section({ title, lines }: { title: string; lines?: PnlLine[] }) {
  return (
    <>
      <tr>
        <td colSpan={2} className="px-2 pt-3 pb-1 font-semibold">
          {title}
        </td>
      </tr>
      {(lines ?? []).length === 0 && (
        <tr className="border-b border-border/60">
          <td className="px-2 h-[26px] pl-5 text-muted-foreground">—</td>
          <td />
        </tr>
      )}
      {(lines ?? []).map((l) => (
        <tr key={l.key} className="border-b border-border/60">
          <td className="px-2 h-[26px] pl-5">{l.label}</td>
          <td className="px-2 text-right font-mono tabular-nums">{fmtMoney(l.amount)}</td>
        </tr>
      ))}
    </>
  );
}

function Total({ label, value, strong, signed }: { label: string; value?: number; strong?: boolean; signed?: boolean }) {
  const v = value ?? 0;
  const color = signed ? (v < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400") : "";
  return (
    <tr className={`border-b border-border ${strong ? "bg-muted/60 font-semibold" : "bg-muted/30"}`}>
      <td className="px-2 h-[26px]">{label}</td>
      <td className={`px-2 text-right font-mono tabular-nums ${color}`}>{fmtMoney(v)}</td>
    </tr>
  );
}
