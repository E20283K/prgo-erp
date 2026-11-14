"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function Section({
  title,
  icon: Icon,
  right,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-border rounded-md bg-card", className)}>
      <header className="h-8 px-2.5 flex items-center justify-between gap-2 border-b border-border">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
          {title}
        </h3>
        {right}
      </header>
      <div className="p-2.5 space-y-2">{children}</div>
    </section>
  );
}

export function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
  disabled,
  placeholder,
  className,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-0.5 min-w-0", className)}>
      <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          disabled={disabled}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(undefined);
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(Math.max(min, n));
          }}
          className={cn("h-7 text-xs font-mono px-2 bg-background", suffix && "pr-8")}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 min-w-0", className)}>
      <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(v as T)} disabled={disabled}>
        <SelectTrigger className="h-7 w-full text-xs px-2 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="text-xs">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex h-7 p-0.5 rounded-md border border-border bg-muted", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2 rounded text-xs transition-colors cursor-pointer disabled:cursor-not-allowed",
            value === o.value
              ? "bg-background text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" | "ok" }) {
  return (
    <div className="flex flex-col min-w-0 px-2.5 py-1.5 border-r border-border last:border-r-0">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold font-mono tabular-nums truncate",
          tone === "warn" && "text-amber-600 dark:text-amber-500",
          tone === "ok" && "text-emerald-600 dark:text-emerald-500"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");
