"use client";

import React from "react";
import { AlertTriangle, LayoutTemplate } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NumField, Section, Segmented } from "../components/fields";
import type { SheetImpositionController } from "../useSheetImposition";

export function SheetPanel({ c, readOnly }: { c: SheetImpositionController; readOnly?: boolean }) {
  const s = c.settings;
  const n = (v: number | undefined, fallback = 0) => v ?? fallback;

  return (
    <Section
      title="Qog'oz"
      icon={LayoutTemplate}
      right={<span className="text-[11px] text-muted-foreground truncate max-w-40">{c.machine.machineName}</span>}
    >
      {c.paperOptions.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Ombor</span>
          <Select
            value={c.paperOptions.find((p) => p.name === s.paperName)?.sku ?? ""}
            onValueChange={(sku) => {
              const stock = c.paperOptions.find((p) => p.sku === sku);
              if (stock) c.selectPaper(stock);
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 w-full text-xs px-2 bg-background">
              <SelectValue placeholder={s.paperName || "Tanlang"} />
            </SelectTrigger>
            <SelectContent className="text-xs">
              {c.paperOptions.map((p) => (
                <SelectItem key={p.sku} value={p.sku} className="text-xs">
                  {p.name} · {p.cutDimensions || p.sheetFormat} · {p.available.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumField label="Ota-list eni" suffix="mm" value={s.parentSheetW} disabled={readOnly} onChange={(v) => c.update({ parentSheetW: n(v, 1) })} />
        <NumField label="Ota-list bo'yi" suffix="mm" value={s.parentSheetH} disabled={readOnly} onChange={(v) => c.update({ parentSheetH: n(v, 1) })} />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] text-muted-foreground">Kesim</span>
        <div className="grid grid-cols-4 gap-1">
          {c.cutOptions.map((o) => (
            <button
              key={o.divisor}
              type="button"
              disabled={readOnly}
              onClick={() => c.selectCutOption(o)}
              title={`${o.pressW}×${o.pressH} mm · ${o.piecesPerPressSheet} dona/list`}
              className={cn(
                "h-7 rounded border text-xs font-mono transition-colors cursor-pointer disabled:cursor-not-allowed",
                s.cutDivisor === o.divisor && s.sheetW === o.pressW && s.sheetH === o.pressH
                  ? "border-primary bg-primary/10 text-foreground font-semibold"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
                !o.fitsMachine && "opacity-40 line-through"
              )}
            >
              1/{o.divisor}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumField label="Press-list eni" suffix="mm" value={s.sheetW} disabled={readOnly} onChange={(v) => c.update({ sheetW: n(v, 1) })} />
        <NumField label="Press-list bo'yi" suffix="mm" value={s.sheetH} disabled={readOnly} onChange={(v) => c.update({ sheetH: n(v, 1) })} />
        <NumField label="Bo'luvchi" value={s.cutDivisor} min={1} disabled={readOnly} onChange={(v) => c.update({ cutDivisor: Math.max(1, Math.round(n(v, 1))) })} />
      </div>
      {!c.sheetFitsMachine && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0" />
          Mashina formatiga sig&apos;maydi ({c.machine.minW}×{c.machine.minH} – {c.machine.maxW}×{c.machine.maxH})
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <NumField label="Klapan" suffix="mm" value={s.marginBottom} disabled={readOnly} onChange={(v) => c.update({ marginBottom: n(v) })} />
        <NumField label="Yuqori" suffix="mm" value={s.marginTop} disabled={readOnly} onChange={(v) => c.update({ marginTop: n(v) })} />
        <NumField label="Chap" suffix="mm" value={s.marginLeft} disabled={readOnly} onChange={(v) => c.update({ marginLeft: n(v) })} />
        <NumField label="O'ng" suffix="mm" value={s.marginRight} disabled={readOnly} onChange={(v) => c.update({ marginRight: n(v) })} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Joylashuv</span>
        <Segmented
          value={s.alignment}
          disabled={readOnly}
          onChange={(alignment) => c.update({ alignment })}
          options={[
            { value: "center", label: "Markaz" },
            { value: "gripper", label: "Klapan" },
          ]}
        />
      </div>
    </Section>
  );
}
