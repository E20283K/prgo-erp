"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ComboboxSelect, type ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FinishingKind = "lamination" | "coating" | "embellishment";

interface FinishingOption {
  id: string;
  kind: FinishingKind;
  value: string;
  label: string;
}

const ENDPOINT = "/api/v1/master/finishing-options";

const DIALOG_TITLE: Record<FinishingKind, string> = {
  lamination: "Yangi plyonka turi",
  coating: "Yangi lak turi",
  embellishment: "Yangi pardoz turi",
};

const NAME_PLACEHOLDER: Record<FinishingKind, string> = {
  lamination: "Masalan: Velvet Matte",
  coating: "Masalan: Glitter UF lak",
  embellishment: "Masalan: Mis issiq folga",
};

// Ro'yxat bir marta yuklanadi va barcha ochiq buyurtma oynalari uchun umumiy.
let cache: FinishingOption[] | null = null;
let inflight: Promise<FinishingOption[]> | null = null;
const listeners = new Set<(list: FinishingOption[]) => void>();

function publish(list: FinishingOption[]) {
  cache = list;
  listeners.forEach((fn) => fn(list));
}

async function loadFinishingOptions(force = false): Promise<FinishingOption[]> {
  if (cache && !force) return cache;
  if (!inflight) {
    inflight = fetch(ENDPOINT)
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) throw new Error(json?.error || "Pardoz turlari yuklanmadi");
        publish(json.data as FinishingOption[]);
        return json.data as FinishingOption[];
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function useFinishingOptions() {
  const [list, setList] = useState<FinishingOption[]>(cache ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setList);
    loadFinishingOptions().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return { list, error };
}

interface FinishingOptionSelectProps {
  kind: FinishingKind;
  /** Buyurtmada saqlangan qiymat; bo'sh bo'lsa "none". */
  value: string;
  /** "none" — tanlov olib tashlandi. */
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Laminatsiya / lak / pardoz turi — ma'lumotnomadan tanlanadi, yangisi oynada qo'shiladi. */
export function FinishingOptionSelect({
  kind,
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: FinishingOptionSelectProps) {
  const { list, error } = useFinishingOptions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const items = useMemo<ComboboxOption[]>(() => {
    const own = list.filter((o) => o.kind === kind).map((o) => ({ value: o.value, label: o.label }));
    const result: ComboboxOption[] = [{ value: "none", label: "Mavjud emas" }, ...own];
    // Ro'yxatdan olib tashlangan eski qiymat ham ko'rinib tursin.
    if (value && value !== "none" && !own.some((o) => o.value === value)) {
      result.splice(1, 0, { value, label: value });
    }
    return result;
  }, [list, kind, value]);

  const openCreate = useCallback(
    (query?: string) => {
      // Qidiruv maydonida tanlangan qiymat yorlig'i turadi — uni yangi nom sifatida olmaymiz.
      const q = (query || "").trim();
      const isExisting = items.some((it) => it.label.toLowerCase() === q.toLowerCase());
      setNewName(isExisting ? "" : q);
      setCreateError(null);
      setIsCreateOpen(true);
    },
    [items]
  );

  const handleCreate = async () => {
    const name = newName.replace(/\s+/g, " ").trim();
    if (!name) {
      setCreateError("Nomini kiriting");
      return;
    }
    setIsSaving(true);
    setCreateError(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setCreateError(json?.error || `Server xatoligi (${res.status})`);
        return;
      }
      const created = json.data as FinishingOption;
      await loadFinishingOptions(true).catch(() => publish([...(cache ?? []), created]));
      onChange(created.value);
      setIsCreateOpen(false);
    } catch {
      setCreateError("Saqlab bo'lmadi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ComboboxSelect
        items={items}
        value={value || "none"}
        onValueChange={onChange}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
        emptyText={error || "Bunday tur yo'q"}
        actionLabel={disabled ? undefined : "Yangi tur"}
        onAction={disabled ? undefined : openCreate}
      />

      <Dialog open={isCreateOpen} onOpenChange={(open) => !isSaving && setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-[360px] p-4 gap-3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-sm font-semibold">{DIALOG_TITLE[kind]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Nomi</label>
            <Input
              autoFocus
              value={newName}
              maxLength={255}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder={NAME_PLACEHOLDER[kind]}
              className="h-8 text-xs"
            />
            {createError && <p className="text-[11px] text-destructive">{createError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={isSaving}
              onClick={() => setIsCreateOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs gap-1.5" disabled={isSaving} onClick={handleCreate}>
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
