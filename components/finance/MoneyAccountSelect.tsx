"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "cn";

export type MoneyMethod = "bank_transfer" | "cash" | "corporate_card" | "card" | "offset";

export interface MoneyAccountOption {
  id: string;
  balance?: number;
  kind: "bank" | "cash" | "card";
  name: string;
  accountNo: string | null;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

/** Accounts a payment method can move money through: cash → kassa, card → card (else bank), transfer → bank. */
function accountsFor(method: MoneyMethod, all: MoneyAccountOption[]): MoneyAccountOption[] {
  const active = all.filter((a) => a.isActive);
  if (method === "offset") return [];
  if (method === "cash") return active.filter((a) => a.kind === "cash");
  if (method === "card" || method === "corporate_card") {
    const cards = active.filter((a) => a.kind === "card");
    return cards.length ? cards : active.filter((a) => a.kind === "bank");
  }
  return active.filter((a) => a.kind === "bank");
}

export function accountLabel(a: MoneyAccountOption): string {
  const tail = a.accountNo ? ` · ${a.accountNo.slice(-4)}` : "";
  return `${a.name}${tail} (${a.currency})`;
}

let cache: Promise<MoneyAccountOption[]> | null = null;
const listeners = new Set<() => void>();

function loadAccounts(): Promise<MoneyAccountOption[]> {
  if (!cache) {
    cache = fetch("/api/v1/finance/bank-accounts")
      .then((r) => r.json())
      .then((j) => (j.success && Array.isArray(j.data) ? (j.data as MoneyAccountOption[]) : []))
      .catch(() => {
        cache = null;
        return [];
      });
  }
  return cache;
}

/** Drops the cached list (after an account is added or changed) and reloads every open picker. */
export function invalidateMoneyAccounts() {
  cache = null;
  listeners.forEach((l) => l());
}

export function useMoneyAccounts(): MoneyAccountOption[] {
  const [all, setAll] = useState<MoneyAccountOption[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => loadAccounts().then((a) => alive && setAll(a));
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  return all;
}

interface MoneyAccountSelectProps {
  method: MoneyMethod;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Picks the money account for a payment. Keeps the value valid for the method: switching from
 * cash to transfer moves the choice to the default bank account. With no matching account the
 * value is empty and the server picks (and for cash, opens) the default one.
 */
export function MoneyAccountSelect({ method, value, onChange, className }: MoneyAccountSelectProps) {
  const all = useMoneyAccounts();
  const options = useMemo(() => accountsFor(method, all), [method, all]);

  useEffect(() => {
    if (options.some((o) => o.id === value)) return;
    const next = options.find((o) => o.isDefault) ?? options[0];
    if ((next?.id ?? "") !== value) onChange(next?.id ?? "");
  }, [options, value, onChange]);

  if (method === "offset") return null;

  const selected = options.find((o) => o.id === value);
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) || "")} disabled={options.length === 0}>
      <SelectTrigger className={cn("h-7 text-xs", className)}>
        <SelectValue>{selected ? accountLabel(selected) : method === "cash" ? "Asosiy kassa" : "Standart hisob"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((a) => (
          <SelectItem key={a.id} value={a.id} className="text-xs">
            {accountLabel(a)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
