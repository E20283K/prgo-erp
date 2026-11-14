"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/documents/common/DocumentShell";
import type { RouteCostLine } from "../utils/financialsEngine";

const STATUS_LABEL: Record<RouteCostLine["status"], string> = {
  Queued: "Navbatda",
  "In Progress": "Jarayonda",
  Paused: "To'xtalish",
  Finished: "Yakunlandi",
};

const fmtHours = (h: number | null) => (h === null ? "—" : `${Number(h.toFixed(2))}`);

/**
 * Route steps side by side: planned vs actual cost, and the tariff (selling) price with its margin.
 * Finished steps count at fact; the rest at plan.
 */
export function RouteEconomicsTable({ lines, currency }: { lines: RouteCostLine[]; currency: string }) {
  const money = (v: number) => formatMoney(v, currency, currency.toUpperCase() === "USD" ? 2 : 0);

  const totals = lines.reduce(
    (t, l) => {
      const used = l.actualCost ?? l.plannedCost;
      t.planned += l.plannedCost;
      t.used += used;
      t.tariff += l.tariffPrice;
      if (l.actualCost !== null) {
        t.factPlanned += l.plannedCost;
        t.fact += l.actualCost;
      }
      if (l.tariffPrice > 0) t.marginBase += used;
      return t;
    },
    { planned: 0, used: 0, tariff: 0, fact: 0, factPlanned: 0, marginBase: 0 }
  );

  const varianceCell = (plan: number, fact: number | null) => {
    if (fact === null) return <span className="text-muted-foreground">—</span>;
    const diff = fact - plan;
    const pct = plan > 0 ? (diff / plan) * 100 : 0;
    return (
      <span className={cn(diff > 0.005 ? "text-rose-600 dark:text-rose-400" : diff < -0.005 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
        {diff > 0 ? "+" : ""}
        {money(diff)}
        {plan > 0 && Math.abs(pct) >= 0.1 ? ` (${diff > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}
      </span>
    );
  };

  const marginCell = (tariff: number, cost: number) => {
    if (!(tariff > 0)) return <span className="text-muted-foreground">—</span>;
    const m = tariff - cost;
    return (
      <span className={cn(m < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
        {money(m)} <span className="text-muted-foreground">{((m / tariff) * 100).toFixed(1)}%</span>
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
          <tr className="h-7 text-[11px] text-muted-foreground">
            <th className="px-2 text-left font-medium border-b border-border">Bosqich</th>
            <th className="px-2 text-left font-medium border-b border-border w-24">Holat</th>
            <th className="px-2 text-right font-medium border-b border-border w-20">Soat reja</th>
            <th className="px-2 text-right font-medium border-b border-border w-20">Soat fakt</th>
            <th className="px-2 text-right font-medium border-b border-border w-32">Tannarx reja</th>
            <th className="px-2 text-right font-medium border-b border-border w-32">Tannarx fakt</th>
            <th className="px-2 text-right font-medium border-b border-border w-40">Farq</th>
            <th className="px-2 text-right font-medium border-b border-border w-32">Tarif narxi</th>
            <th className="px-2 text-right font-medium border-b border-border w-40">Marja</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {lines.map((l) => (
            <tr key={l.opId} className="h-7 border-b border-border/60 hover:bg-muted/30">
              <td className="px-2 font-sans text-foreground truncate max-w-[280px]">
                {l.name}
                {l.costMode !== "auto" && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{l.costMode === "outsourced" ? "autsors" : "qo'lda"}</span>
                )}
              </td>
              <td className="px-2 font-sans text-muted-foreground">{STATUS_LABEL[l.status] || l.status}</td>
              <td className="px-2 text-right">{fmtHours(l.plannedHours)}</td>
              <td className="px-2 text-right">{fmtHours(l.actualHours)}</td>
              <td className="px-2 text-right">{money(l.plannedCost)}</td>
              <td className="px-2 text-right">{l.actualCost === null ? <span className="text-muted-foreground">—</span> : money(l.actualCost)}</td>
              <td className="px-2 text-right">{varianceCell(l.plannedCost, l.actualCost)}</td>
              <td className="px-2 text-right">{l.tariffPrice > 0 ? money(l.tariffPrice) : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-2 text-right">{marginCell(l.tariffPrice, l.actualCost ?? l.plannedCost)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={9} className="h-24 text-center font-sans text-muted-foreground">
                Marshrut bosqichlari kiritilmagan
              </td>
            </tr>
          )}
        </tbody>
        {lines.length > 0 && (
          <tfoot className="font-mono">
            <tr className="h-8 bg-muted/30 font-semibold">
              <td className="px-2 font-sans" colSpan={4}>Jami</td>
              <td className="px-2 text-right">{money(totals.planned)}</td>
              <td className="px-2 text-right">{totals.fact > 0 ? money(totals.fact) : "—"}</td>
              <td className="px-2 text-right">{totals.fact > 0 ? varianceCell(totals.factPlanned, totals.fact) : "—"}</td>
              <td className="px-2 text-right">{totals.tariff > 0 ? money(totals.tariff) : "—"}</td>
              <td className="px-2 text-right">{marginCell(totals.tariff, totals.marginBase)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
