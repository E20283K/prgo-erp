"use client";

import React, { useEffect, useRef, useState } from "react";
import { Delete, Loader2, ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface KioskOperator {
  employeeId: string;
  fullName: string;
  token: string;
  expiresAt: string;
}

interface Props {
  open: boolean;
  machineId: string;
  /** What the operator is about to do, shown in the title. */
  actionLabel?: string;
  onIdentified: (operator: KioskOperator) => void;
  onCancel: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Shared kiosk: who is at the machine. A PIN on the pad, or a badge scanner that types the badge
 * number and Enter into the focused field (USB scanners act as a keyboard).
 */
export function OperatorIdentifyDialog({ open, machineId, actionLabel, onIdentified, onCancel }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const submit = async (value = code) => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/production/terminal/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, code: v }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || "Operator aniqlanmadi");
        setCode("");
        return;
      }
      setCode("");
      setError("");
      onIdentified({ ...json.operator, token: json.token, expiresAt: json.expiresAt });
    } catch {
      setError("Server bilan aloqa yo'q");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const press = (key: string) => {
    setError("");
    setCode((c) => (c.length >= 32 ? c : c + key));
    inputRef.current?.focus();
  };

  const isPin = /^\d*$/.test(code);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        setCode("");
        setError("");
        onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[340px] p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold">{actionLabel ? `Kim? · ${actionLabel}` : "Kim?"}</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => {
                setError("");
                setCode(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit(e.currentTarget.value);
                }
              }}
              type={isPin ? "password" : "text"}
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN yoki beyj"
              className={cn(
                "h-12 w-full rounded-md border border-border bg-background px-3 pr-9 text-center font-mono text-xl tracking-[0.3em] placeholder:tracking-normal placeholder:font-sans placeholder:text-sm outline-none focus:border-primary",
                error && "border-destructive"
              )}
            />
            <ScanLine className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
          <div className="h-4 text-center text-xs text-destructive">{error}</div>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <Button key={k} type="button" variant="outline" className="h-12 text-lg font-mono" onClick={() => press(k)}>
                {k}
              </Button>
            ))}
            <Button type="button" variant="ghost" className="h-12 text-muted-foreground" onClick={() => setCode((c) => c.slice(0, -1))}>
              <Delete className="size-4" />
            </Button>
            <Button type="button" variant="outline" className="h-12 text-lg font-mono" onClick={() => press("0")}>
              0
            </Button>
            <Button type="button" className="h-12 text-sm font-semibold" disabled={!code || busy} onClick={() => void submit()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Kirish"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
