"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invalidateMoneyAccounts } from "@/components/finance/MoneyAccountSelect";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { MoneyAccountRecord } from "@/lib/server/treasuryService";
import { apiJson, KIND_LABEL } from "./format";

interface MoneyAccountDialogProps {
  open: boolean;
  account: MoneyAccountRecord | null; // null → new
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function MoneyAccountDialog(props: MoneyAccountDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 text-xs">
        {props.open && <MoneyAccountBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

type Kind = "bank" | "cash" | "card";

function MoneyAccountBody({ account, onOpenChange, onSaved }: MoneyAccountDialogProps) {
  const { addNotification } = useWorkspaceStore();
  const [kind, setKind] = useState<Kind>(account?.kind ?? "bank");
  const [name, setName] = useState(account?.name ?? "");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountNo, setAccountNo] = useState(account?.accountNo ?? "");
  const [mfo, setMfo] = useState(account?.mfo ?? "");
  const [currency, setCurrency] = useState(account?.currency ?? "UZS");
  const [opening, setOpening] = useState(account?.openingBalance ?? 0);
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false);
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await apiJson(account ? `/api/v1/finance/bank-accounts/${account.id}` : "/api/v1/finance/bank-accounts", {
        method: account ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          bankName,
          accountNo,
          mfo,
          currency,
          openingBalance: opening,
          isDefault,
          isActive,
        }),
      });
      invalidateMoneyAccounts();
      addNotification({ title: account ? "Hisob saqlandi" : "Hisob ochildi", description: name, severity: "success" });
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
        <DialogTitle className="text-sm">{account ? "Hisob" : "Yangi hisob"}</DialogTitle>
      </DialogHeader>

      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tur</Label>
          <Select value={kind} onValueChange={(v) => v && setKind(v as Kind)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{KIND_LABEL[kind]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(["bank", "cash", "card"] as Kind[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Valyuta</Label>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v as string)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{currency}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UZS" className="text-xs">UZS</SelectItem>
              <SelectItem value="USD" className="text-xs">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Nomi</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" autoFocus />
        </div>

        {kind === "bank" && (
          <>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Bank</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hisob raqami</Label>
              <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MFO</Label>
              <Input value={mfo} onChange={(e) => setMfo(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </>
        )}

        {kind === "card" && (
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Karta raqami</Label>
            <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
        )}

        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Boshlang&apos;ich qoldiq</Label>
          <MoneyInput value={opening || ""} onAmountChange={setOpening} className="h-8 text-xs font-mono" />
        </div>

        <label className="flex items-center gap-2 text-xs">
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          Asosiy
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          Faol
        </label>

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
