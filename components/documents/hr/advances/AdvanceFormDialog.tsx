"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { SmartCombobox, type ComboboxItem } from "@/components/ui/smart-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { MoneyAccountSelect } from "@/components/finance/MoneyAccountSelect";
import type { EmployeeLedger, EmployeeRecord, PayoutKind, PayoutMethod } from "../types";

interface AdvanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string; // preselected (from the employee card)
  defaultKind?: PayoutKind;
  onSaved?: () => void;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fmt = (n: number) => Math.round(n).toLocaleString("uz-UZ");

export function AdvanceFormDialog(props: AdvanceFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 text-xs">
        {/* Mounted per opening, so every open starts from a clean form. */}
        {props.open && <AdvanceFormBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function AdvanceFormBody({ onOpenChange, employeeId, defaultKind = "advance", onSaved }: AdvanceFormDialogProps) {
  const { addNotification } = useWorkspaceStore();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [empId, setEmpId] = useState(employeeId ?? "");
  const [amount, setAmount] = useState(0);
  const [kind, setKind] = useState<PayoutKind>(defaultKind);
  const [method, setMethod] = useState<PayoutMethod>("cash");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [period, setPeriod] = useState(todayLocal().slice(0, 7));
  const [note, setNote] = useState("");
  const [ledger, setLedger] = useState<EmployeeLedger | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employeeId) return;
    fetch("/api/v1/hr/employees")
      .then((r) => r.json())
      .then((j) => setEmployees(Array.isArray(j.data) ? j.data.filter((e: EmployeeRecord) => e.status !== "terminated") : []))
      .catch(() => setEmployees([]));
  }, [employeeId]);

  useEffect(() => {
    if (!empId) return;
    fetch(`/api/v1/hr/employees/${empId}/ledger`)
      .then((r) => r.json())
      .then((j) => setLedger(j.success ? j.data : null))
      .catch(() => setLedger(null));
  }, [empId]);

  const options: ComboboxItem[] = useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: e.fullName,
        code: e.badgeNumber || e.badgeNo,
        description: e.positionTitle,
      })),
    [employees]
  );

  const activeLedger = ledger && ledger.employeeId === empId ? ledger : null;
  const current = activeLedger?.periods.find((p) => p.period === period);
  const currency = activeLedger?.currency ?? "UZS";

  const handleSave = async () => {
    setError(null);
    if (!empId) return setError("Hodim tanlanmagan");
    if (!(amount > 0)) return setError("Summa kiriting");
    setSaving(true);
    try {
      const res = await fetch("/api/v1/hr/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empId,
          amount,
          kind,
          paymentMethod: method,
          accountId: accountId || null,
          advanceDate: date,
          period,
          note,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Saqlanmadi");
      addNotification({
        title: kind === "settlement" ? "Raschot yozildi" : "Avans yozildi",
        description: json.warning || `${fmt(amount)} ${currency}`,
        severity: json.warning ? "warning" : "success",
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm">{kind === "settlement" ? "Raschot berish" : "Avans berish"}</DialogTitle>
        </DialogHeader>

        <div className="p-4 grid grid-cols-2 gap-3">
          {!employeeId && (
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Hodim</Label>
              <SmartCombobox
                value={empId}
                onChange={setEmpId}
                options={options}
                placeholder="Hodimni tanlang"
                searchPlaceholder="Ism yoki tabel"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Tur</Label>
            <Select value={kind} onValueChange={(v) => v && setKind(v as PayoutKind)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="advance">Avans</SelectItem>
                <SelectItem value="settlement">Raschot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Usul</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as PayoutMethod)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Naqd</SelectItem>
                <SelectItem value="card">Karta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Hisob</Label>
            <MoneyAccountSelect method={method} value={accountId} onChange={setAccountId} className="h-8" />
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Summa</Label>
            <MoneyInput
              value={amount || ""}
              onAmountChange={setAmount}
              className="h-8 text-xs font-mono"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Sana</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (e.target.value) setPeriod(e.target.value.slice(0, 7));
              }}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Davr</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 text-xs font-mono" />
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Izoh</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-xs" />
          </div>

          {current && (
            <div className="col-span-2 grid grid-cols-3 gap-2 rounded border border-border bg-muted/40 px-3 py-2 font-mono text-[11px]">
              <div>
                <div className="text-muted-foreground font-sans">Avans</div>
                {fmt(current.advances)}
              </div>
              <div>
                <div className="text-muted-foreground font-sans">Hisoblangan</div>
                {current.accrued == null ? "—" : fmt(current.accrued)}
              </div>
              <div>
                <div className="text-muted-foreground font-sans">Qoldiq</div>
                {current.balance == null ? "—" : fmt(current.balance)}
              </div>
            </div>
          )}

          {error && <div className="col-span-2 text-destructive text-[11px]">{error}</div>}
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            Bekor
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda" : "Saqlash"}
          </Button>
        </DialogFooter>
    </>
  );
}
