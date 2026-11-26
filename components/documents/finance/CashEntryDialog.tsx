"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { SmartCombobox, type ComboboxItem } from "@/components/ui/smart-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountLabel, invalidateMoneyAccounts, useMoneyAccounts } from "@/components/finance/MoneyAccountSelect";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { CashCategoryRecord } from "@/lib/server/treasuryService";
import { apiJson, fmtMoney, todayLocal } from "./format";

interface CashEntryDialogProps {
  open: boolean;
  direction: "in" | "out";
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function CashEntryDialog(props: CashEntryDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-0 gap-0 text-xs">
        {props.open && <CashEntryBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

const METHOD_BY_KIND = { cash: "cash", card: "corporate_card", bank: "bank_transfer" } as const;

function CashEntryBody({ direction, onOpenChange, onSaved }: CashEntryDialogProps) {
  const { addNotification, suppliers, loadSuppliers } = useWorkspaceStore();
  const accounts = useMoneyAccounts();
  const [categories, setCategories] = useState<CashCategoryRecord[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayLocal());
  const [supplierId, setSupplierId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [docNo, setDocNo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ data: CashCategoryRecord[] }>("/api/v1/finance/cash-categories")
      .then((j) => setCategories(j.data))
      .catch(() => setCategories([]));
    if (!suppliers?.length) loadSuppliers?.();
  }, [suppliers?.length, loadSuppliers]);

  const catOptions = useMemo(
    () => categories.filter((c) => c.direction === direction && !c.isSystem && c.isActive),
    [categories, direction]
  );
  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  // Until one is picked, the default cash desk (else the first account) is the choice.
  const account =
    activeAccounts.find((a) => a.id === accountId) ??
    (accountId ? undefined : activeAccounts.find((a) => a.kind === "cash" && a.isDefault) ?? activeAccounts[0]);
  const category = catOptions.find((c) => c.id === categoryId);

  const supplierOptions: ComboboxItem[] = useMemo(
    () =>
      (suppliers || [])
        .filter((s) => s.id)
        .map((s) => ({ value: s.id as string, label: s.name, code: s.code })),
    [suppliers]
  );

  const handleSave = async () => {
    setError(null);
    if (!categoryId) return setError("Modda tanlanmagan");
    if (!account) return setError("Hisob tanlanmagan");
    if (!(amount > 0)) return setError("Summa kiriting");
    setSaving(true);
    try {
      await apiJson("/api/v1/finance/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          categoryId,
          amount,
          currency: account.currency,
          accountId: account.id,
          method: METHOD_BY_KIND[account.kind],
          supplierId: supplierId || null,
          counterpartyName: supplierId ? null : counterparty,
          docNo,
          note,
        }),
      });
      invalidateMoneyAccounts();
      addNotification({
        title: direction === "out" ? "Chiqim yozildi" : "Kirim yozildi",
        description: `${category?.name ?? ""}: ${fmtMoney(amount)} ${account.currency}`,
        severity: "success",
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
        <DialogTitle className="text-sm">{direction === "out" ? "Chiqim" : "Kirim"}</DialogTitle>
      </DialogHeader>

      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Modda</Label>
          <Select value={categoryId} onValueChange={(v) => setCategoryId((v as string) || "")}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{category?.name ?? "Moddani tanlang"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {catOptions.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Hisob</Label>
          <Select value={account?.id ?? ""} onValueChange={(v) => setAccountId((v as string) || "")}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{account ? accountLabel(account) : "Hisobni tanlang"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {accountLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Summa{account ? `, ${account.currency}` : ""}</Label>
          <MoneyInput value={amount || ""} onAmountChange={setAmount} className="h-8 text-xs font-mono" autoFocus />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Sana</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs font-mono" />
        </div>

        {direction === "out" && (
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Ta&apos;minotchi</Label>
            <SmartCombobox
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder="Tanlanmagan"
              searchPlaceholder="Nomi yoki kodi"
              className="h-8 text-xs"
            />
          </div>
        )}

        {!supplierId && (
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Kontragent</Label>
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="h-8 text-xs" />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Hujjat №</Label>
          <Input value={docNo} onChange={(e) => setDocNo(e.target.value)} className="h-8 text-xs font-mono" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Izoh</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-xs" />
        </div>

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
