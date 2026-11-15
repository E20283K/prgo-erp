"use client";

import React, { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * In-app replacement for window.prompt / window.confirm on the shop-floor screens.
 *   const { ask, dialog } = useAskDialog();
 *   const reason = await ask({ title, message, reasonLabel: "Sabab" }); // text, or null when cancelled
 *   const ok = await ask({ title, message });                          // "" when confirmed, null when cancelled
 * Render {dialog} once in the component.
 */
export interface AskOptions {
  title: string;
  message?: string;
  /** Asks for a required text (a reason) when set. */
  reasonLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function useAskDialog() {
  const [options, setOptions] = useState<AskOptions | null>(null);
  const [text, setText] = useState("");
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const ask = useCallback((opts: AskOptions) => {
    // a second question closes the first as cancelled
    resolveRef.current?.(null);
    setText("");
    setOptions(opts);
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = (value: string | null) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  };

  const needsText = Boolean(options?.reasonLabel);
  const canConfirm = !needsText || text.trim().length > 0;

  const dialog = (
    <Dialog open={Boolean(options)} onOpenChange={(open) => !open && finish(null)}>
      <DialogContent className="max-w-sm p-4 gap-3">
        <DialogHeader>
          <DialogTitle className="text-sm">{options?.title}</DialogTitle>
        </DialogHeader>
        {options?.message && <p className="text-xs text-muted-foreground">{options.message}</p>}
        {needsText && (
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) finish(text.trim());
            }}
            placeholder={`${options?.reasonLabel} *`}
            className="h-8 text-xs"
          />
        )}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => finish(null)}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            size="sm"
            variant={options?.destructive ? "destructive" : "default"}
            className="h-8 text-xs"
            disabled={!canConfirm}
            onClick={() => finish(needsText ? text.trim() : "")}
          >
            {options?.confirmLabel || "Tasdiqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ask, dialog };
}
