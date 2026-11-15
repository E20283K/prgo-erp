"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ComboboxSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductType {
  id: string;
  name: string;
}

const ENDPOINT = "/api/v1/master/product-types";

// Ro'yxat bir marta yuklanadi va barcha ochiq buyurtma oynalari uchun umumiy.
let cache: ProductType[] | null = null;
let inflight: Promise<ProductType[]> | null = null;
const listeners = new Set<(list: ProductType[]) => void>();

function publish(list: ProductType[]) {
  cache = list;
  listeners.forEach((fn) => fn(list));
}

async function loadProductTypes(force = false): Promise<ProductType[]> {
  if (cache && !force) return cache;
  if (!inflight) {
    inflight = fetch(ENDPOINT)
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) throw new Error(json?.error || "Mahsulot turlari yuklanmadi");
        publish(json.data as ProductType[]);
        return json.data as ProductType[];
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function useProductTypes() {
  const [list, setList] = useState<ProductType[]>(cache ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setList);
    loadProductTypes().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return { list, error };
}

interface ProductTypeSelectProps {
  value?: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Faqat ma'lumotnomadagi turlardan tanlanadi; yangi tur alohida oynada yaratiladi. */
export function ProductTypeSelect({ value, onChange, disabled, className }: ProductTypeSelectProps) {
  const { list, error } = useProductTypes();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const items = list.map((t) => t.name);
  // Ro'yxatdan olib tashlangan eski qiymat ham ko'rinib tursin.
  if (value && !items.includes(value)) items.unshift(value);

  const openCreate = useCallback((query?: string) => {
    setNewName((query || "").trim());
    setCreateError(null);
    setIsCreateOpen(true);
  }, []);

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
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setCreateError(json?.error || `Server xatoligi (${res.status})`);
        return;
      }
      const created = json.data as ProductType;
      await loadProductTypes(true).catch(() => publish([...(cache ?? []), created]));
      onChange(created.name);
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
        value={value || ""}
        onValueChange={onChange}
        disabled={disabled}
        className={className}
        placeholder="Tanlang"
        emptyText={error || "Bunday tur yo'q"}
        actionLabel={disabled ? undefined : "Yangi tur"}
        onAction={disabled ? undefined : openCreate}
      />

      <Dialog open={isCreateOpen} onOpenChange={(open) => !isSaving && setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-[360px] p-4 gap-3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-sm font-semibold">Yangi mahsulot turi</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Nomi</label>
            <Input
              autoFocus
              value={newName}
              maxLength={128}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Masalan: Tvil etiketka"
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
