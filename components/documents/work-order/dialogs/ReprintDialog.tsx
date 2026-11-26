"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "../../common/DocumentShell";
import { REPRINT_FAULT_PARTIES, isInternalFault, type ReprintFaultParty } from "../reprint";

const FAULT_LABEL_KEYS: Record<ReprintFaultParty, string> = {
  production: "reprintFaultProduction",
  prepress: "reprintFaultPrepress",
  supplier: "reprintFaultSupplier",
  client: "reprintFaultClient",
};

interface ReprintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderedQty: number;
  producedQty: number;
  unit: string;
  priceTotal: number;
  currency: string;
  existingReprints: string[];
  onCreate: (input: { quantity: number; faultParty: ReprintFaultParty; reason: string }) => void;
}

export function ReprintDialog({
  isOpen,
  onOpenChange,
  orderedQty,
  producedQty,
  unit,
  priceTotal,
  currency,
  existingReprints,
  onCreate,
}: ReprintDialogProps) {
  const t = useTranslations("WorkOrderDetail");
  const shortfall = Math.max(0, orderedQty - producedQty);
  const [qty, setQty] = useState<number>(shortfall);
  const [faultParty, setFaultParty] = useState<ReprintFaultParty>("production");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setQty(shortfall);
    setFaultParty("production");
    setReason("");
  }, [isOpen, shortfall]);

  const unitPrice = orderedQty > 0 ? priceTotal / orderedQty : 0;
  const reprintPrice = isInternalFault(faultParty) ? 0 : unitPrice * (qty || 0);
  const canCreate = qty > 0 && reason.trim().length > 0;

  const submit = () => {
    if (!canCreate) return;
    onCreate({ quantity: qty, faultParty, reason });
  };

  const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <div className="flex flex-col gap-0.5 rounded border border-border bg-muted/40 px-2 py-1.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-semibold ${tone || "text-foreground"}`}>
        {value.toLocaleString()} {unit}
      </span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <CopyPlus className="size-4 text-muted-foreground" />
            <span>{t("reprintAction")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label={t("reprintOrdered")} value={orderedQty} />
            <Stat label={t("reprintProduced")} value={producedQty} />
            <Stat
              label={t("reprintShortfall")}
              value={shortfall}
              tone={shortfall > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}
            />
          </div>

          {existingReprints.length > 0 && (
            <div className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">
                {t("reprintExisting")}: {existingReprints.join(", ")}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("reprintQty")}</label>
              <Input
                type="number"
                min={1}
                value={qty || ""}
                onChange={(e) => setQty(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                className="h-8 text-xs font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{t("reprintFault")}</label>
              <Select value={faultParty} onValueChange={(v) => setFaultParty(v as ReprintFaultParty)}>
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue>{(v: string) => t(FAULT_LABEL_KEYS[v as ReprintFaultParty] || "reprintFaultProduction")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REPRINT_FAULT_PARTIES.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {t(FAULT_LABEL_KEYS[p])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">{t("reprintReason")}</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reprintReasonPlaceholder")}
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between rounded border border-border px-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">{t("reprintPrice")}</span>
            <span className="font-mono text-xs font-semibold">
              {isInternalFault(faultParty) ? t("reprintFree") : formatMoney(reprintPrice, currency, 0)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs cursor-pointer">
            {t("reprintCancel")}
          </Button>
          <Button size="sm" onClick={submit} disabled={!canCreate} className="h-8 text-xs cursor-pointer shadow-none">
            {t("reprintCreate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
