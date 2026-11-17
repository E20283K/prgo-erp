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
/** Same as the server: the last digit signs the operator in. */
const PIN_LENGTH = 4;
const isFullPin = (v: string) => v.length === PIN_LENGTH && /^\d+$/.test(v);

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

  /** A full PIN signs in at once; a badge scanner ends with Enter. */
  const update = (next: string) => {
    if (busy) return;
    setError("");
    setCode(next);
    if (isFullPin(next)) void submit(next);
  };

  const press = (key: string) => {
    const isDigits = /^\d*$/.test(code);
    if ((isDigits && code.length >= PIN_LENGTH) || code.length >= 32) return;
    update(code + key);
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
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ScanLine className="size-3.5" />
            <span>PIN yoki beyj</span>
          </div>
          <div className="relative" onClick={() => inputRef.current?.focus()}>
            {isPin ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-16 rounded-lg border bg-background flex items-center justify-center",
                      error ? "border-destructive" : i === code.length ? "border-primary" : "border-border"
                    )}
                  >
                    {busy && i === PIN_LENGTH - 1 ? (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    ) : (
                      i < code.length && <span className="size-4 rounded-full bg-foreground" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-16 rounded-lg border border-primary bg-background flex items-center justify-center font-mono text-xl truncate px-3">
                {code}
              </div>
            )}
            {/* Takes keyboard and badge-scanner input; the cells above show it. */}
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => update(e.target.value.slice(0, 32))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit(e.currentTarget.value);
                }
              }}
              inputMode="numeric"
              autoComplete="off"
              aria-label="PIN yoki beyj"
              className="absolute inset-0 w-full h-full opacity-0 cursor-default"
            />
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
