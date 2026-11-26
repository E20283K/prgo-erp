"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { CashFlowReport as Report, CashFlowRow } from "@/lib/server/treasuryService";
import { apiJson, fmtMoney } from "./format";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_LABELS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

const cell = "px-2 h-[26px] text-right font-mono tabular-nums whitespace-nowrap";
const fmt = (n: number | undefined) => (n ? fmtMoney(n) : "");

export function CashFlowReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [nonce, setNonce] = useState(0);
  const requestKey = `${year}` + `#${nonce}`;
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
    apiJson<{ data: Report }>(`/api/v1/finance/reports/cash-flow?year=${year}`)
      .then((j) => alive && setResult({ key: requestKey, report: j.data, error: null }))
      .catch((e) => alive && setResult((r) => ({ key: requestKey, report: r.report, error: e instanceof Error ? e.message : "Xatolik" })));
    return () => {
      alive = false;
    };
  }, [year, requestKey]);

  const { inflow, outflow, closing } = useMemo(() => {
    const rows = report?.rows ?? [];
    const closing: Record<string, number> = {};
    let running = report?.openingUzs ?? 0;
    for (const m of MONTHS) {
      running += (report?.inByMonth[m] || 0) - (report?.outByMonth[m] || 0);
      closing[m] = running;
    }
    return {
      inflow: rows.filter((r) => r.direction === "in"),
      outflow: rows.filter((r) => r.direction === "out"),
      closing,
    };
  }, [report]);

  const sumOf = (rec: Record<string, number> | undefined) => MONTHS.reduce((s, m) => s + (rec?.[m] || 0), 0);

  const renderRows = (rows: CashFlowRow[]) =>
    rows.map((r) => (
      <tr key={r.categoryId} className="border-b border-border/60 hover:bg-muted/40">
        <td className="px-2 h-[26px] sticky left-0 bg-background whitespace-nowrap">{r.categoryName}</td>
        {MONTHS.map((m) => (
          <td key={m} className={cell}>
            {fmt(r.months[m])}
          </td>
        ))}
        <td className={`${cell} font-semibold`}>{fmt(r.total)}</td>
      </tr>
    ));

  const totalRow = (label: string, rec: Record<string, number> | undefined, strong = false) => (
    <tr className={`border-b border-border ${strong ? "bg-muted/60 font-semibold" : "bg-muted/30"}`}>
      <td className="px-2 h-[26px] sticky left-0 bg-inherit whitespace-nowrap">{label}</td>
      {MONTHS.map((m) => (
        <td key={m} className={cell}>
          {fmtMoney(rec?.[m] || 0)}
        </td>
      ))}
      <td className={`${cell} font-semibold`}>{fmtMoney(sumOf(rec))}</td>
    </tr>
  );

  return (
    <div className="flex flex-col h-full bg-background text-xs">
      <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setYear((y) => y - 1)} aria-label="Oldingi yil">
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="font-mono px-2">{year}</span>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setYear((y) => y + 1)} aria-label="Keyingi yil">
            <ChevronRight className="size-3.5" />
          </Button>
          <span className="ml-2 text-muted-foreground">UZS</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={load} disabled={loading} aria-label="Yangilash">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-4 text-destructive">{error}</div>
        ) : (
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 h-7 text-left font-medium sticky left-0 bg-card min-w-[200px]">Modda</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="px-2 h-7 text-right font-medium min-w-[96px]">
                    {m}
                  </th>
                ))}
                <th className="px-2 h-7 text-right font-medium min-w-[110px]">Jami</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-2 h-[26px] sticky left-0 bg-background text-muted-foreground">Boshlang&apos;ich qoldiq</td>
                <td className={cell}>{fmtMoney(report?.openingUzs ?? 0)}</td>
                <td colSpan={12} />
              </tr>
              <tr>
                <td colSpan={14} className="px-2 pt-2 pb-1 font-semibold text-emerald-600 dark:text-emerald-400">Kirim</td>
              </tr>
              {renderRows(inflow)}
              {totalRow("Jami kirim", report?.inByMonth)}
              <tr>
                <td colSpan={14} className="px-2 pt-2 pb-1 font-semibold text-red-600 dark:text-red-400">Chiqim</td>
              </tr>
              {renderRows(outflow)}
              {totalRow("Jami chiqim", report?.outByMonth)}
              {totalRow(
                "Sof oqim",
                Object.fromEntries(MONTHS.map((m) => [m, (report?.inByMonth[m] || 0) - (report?.outByMonth[m] || 0)])),
                true
              )}
              <tr className="border-b border-border font-semibold">
                <td className="px-2 h-[26px] sticky left-0 bg-background">Yakuniy qoldiq</td>
                {MONTHS.map((m) => (
                  <td key={m} className={cell}>
                    {fmtMoney(closing[m])}
                  </td>
                ))}
                <td className={cell}>{fmtMoney(closing["12"])}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
