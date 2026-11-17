"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeLedger } from "../types";
import { AdvanceFormDialog } from "./AdvanceFormDialog";

const fmt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("uz-UZ"));
const KIND_LABEL: Record<string, string> = { advance: "Avans", settlement: "Raschot" };
const PAYROLL_LABEL: Record<string, string> = {
  draft: "Qoralama",
  calculated: "Hisoblangan",
  approved: "Tasdiqlangan",
  paid: "To'langan",
};

/** "Hisob" tab of the employee card: month-by-month accrued vs. paid out, plus the payout log. */
export function EmployeeLedgerPanel({ employeeId }: { employeeId: string }) {
  const [ledger, setLedger] = useState<EmployeeLedger | null>(null);
  const [dialog, setDialog] = useState<null | "advance" | "settlement">(null);

  const load = useCallback(() => {
    fetch(`/api/v1/hr/employees/${employeeId}/ledger`)
      .then((r) => r.json())
      .then((j) => setLedger(j.success ? j.data : null))
      .catch(() => setLedger(null));
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const th = "px-2 h-7 text-left font-medium text-muted-foreground whitespace-nowrap";
  const td = "px-2 h-[26px] whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="h-9 px-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Wallet className="size-4 text-primary" />
            Hisob
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => setDialog("advance")}>
              <HandCoins className="size-3.5" />
              Avans berish
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setDialog("settlement")}>
              Raschot
            </Button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-muted/20">
            <tr>
              <th className={th}>Davr</th>
              <th className={cn(th, "text-right")}>Hisoblangan</th>
              <th className={cn(th, "text-right")}>Avans</th>
              <th className={cn(th, "text-right")}>Raschot</th>
              <th className={cn(th, "text-right")}>Qoldiq</th>
              <th className={th}>Vedomost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {(ledger?.periods ?? []).map((p) => (
              <tr key={p.period}>
                <td className={td}>{p.period}</td>
                <td className={cn(td, "text-right")}>{fmt(p.accrued)}</td>
                <td className={cn(td, "text-right")}>{fmt(p.advances)}</td>
                <td className={cn(td, "text-right")}>{fmt(p.settlements)}</td>
                <td
                  className={cn(
                    td,
                    "text-right font-semibold",
                    p.balance != null && p.balance < 0 && "text-destructive",
                    p.balance != null && p.balance > 0 && "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {fmt(p.balance)}
                </td>
                <td className={cn(td, "font-sans")}>{p.payrollStatus ? PAYROLL_LABEL[p.payrollStatus] ?? p.payrollStatus : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="h-9 px-3 border-b border-border bg-muted/30 flex items-center gap-2 text-xs font-semibold">
          To&apos;lovlar
          <Badge variant="outline" className="h-5 font-mono text-[10px]">
            {ledger?.entries.length ?? 0}
          </Badge>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-muted/20">
            <tr>
              <th className={th}>Sana</th>
              <th className={th}>Tur</th>
              <th className={cn(th, "text-right")}>Summa</th>
              <th className={th}>Davr</th>
              <th className={th}>Manba</th>
              <th className={th}>Kiritdi</th>
              <th className={th}>Izoh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(ledger?.entries ?? []).map((e) => (
              <tr key={e.id} className={cn(e.status === "cancelled" && "text-muted-foreground line-through")}>
                <td className={cn(td, "font-mono")}>{e.advanceDate.split("-").reverse().join(".")}</td>
                <td className={td}>{KIND_LABEL[e.kind] ?? e.kind}</td>
                <td className={cn(td, "text-right font-mono font-medium")}>
                  {fmt(e.amount)} {e.currency}
                </td>
                <td className={cn(td, "font-mono")}>{e.period}</td>
                <td className={td}>{e.source === "telegram" ? "Bot" : "ERP"}</td>
                <td className={td}>{e.createdByName ?? "—"}</td>
                <td className={cn(td, "max-w-[240px] truncate")}>{e.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdvanceFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        employeeId={employeeId}
        defaultKind={dialog ?? "advance"}
        onSaved={load}
      />
    </div>
  );
}
