"use client";

import React, { useRef } from "react";
import { FileCheck2, FileUp, Layers, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NumField, Section, SelectField, fmt } from "../components/fields";
import { variantColor } from "../components/variantColor";
import type { ImpositionVariant } from "../types";
import type { SheetImpositionController } from "../useSheetImposition";

function PdfSlot({
  label,
  file,
  url,
  name,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  file?: File;
  url?: string;
  name?: string;
  disabled?: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const has = !!file || !!url;
  const title = file?.name || name || (url ? "PDF" : `${label} PDF tanlash`);
  return (
    <span className="inline-flex items-center">
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => ref.current?.click()}
        className={cn(
          "h-6 px-1.5 inline-flex items-center gap-1 rounded border text-[11px] cursor-pointer disabled:cursor-not-allowed",
          has
            ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5"
            : "border-dashed border-border text-muted-foreground hover:text-foreground"
        )}
      >
        {has ? <FileCheck2 className="size-3" /> : <FileUp className="size-3" />}
        {label}
      </button>
      {file && !disabled && (
        <button type="button" title="Olib tashlash" onClick={onClear} className="ml-0.5 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

export function GangingPanel({ c, readOnly }: { c: SheetImpositionController; readOnly?: boolean }) {
  const s = c.settings;
  const showBack = s.mode !== "single_sided";
  const dieRef = useRef<HTMLInputElement>(null);

  const slotsByVariant = new Map<number, number>();
  c.calc?.forms.forEach((f) => f.allocations.forEach((a) => slotsByVariant.set(a.variant_index, (slotsByVariant.get(a.variant_index) || 0) + a.slots)));

  return (
    <Section title="Turlar" icon={Layers} right={<span className="text-[11px] text-muted-foreground">{c.variants.length} ta</span>}>
      <div className="grid grid-cols-4 gap-2">
        <SelectField
          className="col-span-2"
          label="Strategiya"
          value={s.strategy}
          disabled={readOnly}
          onChange={(strategy) => c.update({ strategy })}
          options={[
            { value: "smart_no_split", label: "Aqlli (bo'lmasdan)" },
            { value: "max_economy_split", label: "Maks. tejash" },
            { value: "single_form", label: "Bitta forma" },
            { value: "manual", label: "Qo'lda" },
          ]}
        />
        <NumField label="Ortiqcha" suffix="%" value={s.maxOverprintPct} disabled={readOnly} onChange={(v) => c.update({ maxOverprintPct: v ?? 0 })} />
        <NumField label="Priladka" suffix="list" value={s.wasteSheets} disabled={readOnly} onChange={(v) => c.update({ wasteSheets: Math.round(v ?? 0) })} />
        <SelectField
          className="col-span-2"
          label="To'ldirish"
          value={s.fillDirection}
          disabled={readOnly}
          onChange={(fillDirection) => c.update({ fillDirection })}
          options={[
            { value: "col", label: "Ustun bo'yicha" },
            { value: "row", label: "Qator bo'yicha" },
          ]}
        />
        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Pichoq PDF</span>
          <input
            ref={dieRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              c.setDielineFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-1 h-7">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => dieRef.current?.click()}
              className="h-7 flex-1 min-w-0 px-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer truncate"
            >
              <FileUp className="size-3.5 shrink-0" />
              <span className="truncate">{c.dielineFile?.name || "Tanlash"}</span>
            </button>
            {c.dielineFile && !readOnly && (
              <button type="button" title="Olib tashlash" onClick={() => c.setDielineFile(undefined)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr className="h-6">
              <th className="text-left font-medium px-2">Tur</th>
              <th className="text-right font-medium px-2 w-20">Tiraj</th>
              <th className="text-right font-medium px-1 w-14">Katak</th>
              <th className="text-left font-medium px-2">Fayl</th>
            </tr>
          </thead>
          <tbody>
            {c.variants.map((v: ImpositionVariant, i) => (
              <tr key={v.key} className="h-7 border-t border-border">
                <td className="px-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="size-2.5 rounded-sm shrink-0" style={{ background: variantColor(i).solid }} />
                    <span className="truncate" title={v.name}>{v.name}</span>
                  </span>
                </td>
                <td className="px-2 text-right font-mono tabular-nums">{fmt(v.quantity)}</td>
                <td className="px-1">
                  <Input
                    type="number"
                    min={1}
                    disabled={readOnly}
                    placeholder={String(slotsByVariant.get(i) ?? "")}
                    value={v.manualSlots ?? ""}
                    onChange={(e) => c.setManualSlots(v.key, e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined)}
                    className="h-6 w-12 ml-auto text-xs font-mono text-right px-1 bg-background"
                  />
                </td>
                <td className="px-2">
                  <span className="flex items-center gap-1">
                    <PdfSlot
                      label="Oldi"
                      file={v.frontFile}
                      url={v.frontUrl}
                      name={v.frontName}
                      disabled={readOnly}
                      onPick={(f) => c.setVariantFile(v.key, "front", f)}
                      onClear={() => c.setVariantFile(v.key, "front", undefined)}
                    />
                    {showBack && (
                      <PdfSlot
                        label="Orqa"
                        file={v.backFile}
                        url={v.backUrl}
                        name={v.backName}
                        disabled={readOnly}
                        onPick={(f) => c.setVariantFile(v.key, "back", f)}
                        onClear={() => c.setVariantFile(v.key, "back", undefined)}
                      />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.calc && c.calc.forms.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr className="h-6">
                <th className="text-left font-medium px-2 w-14">Forma</th>
                <th className="text-left font-medium px-2">Taqsimot</th>
                <th className="text-right font-medium px-2 w-16">List</th>
                <th className="text-right font-medium px-2 w-14">Ortiq</th>
              </tr>
            </thead>
            <tbody>
              {c.calc.forms.map((f) => {
                const target = f.allocations.reduce((sum, a) => sum + a.target_qty, 0);
                const over = target > 0 ? (f.total_overprint_qty / target) * 100 : 0;
                return (
                  <tr key={f.form_index} className="h-7 border-t border-border align-middle">
                    <td className="px-2 font-mono">{f.form_index}</td>
                    <td className="px-2">
                      <span className="flex flex-wrap gap-1">
                        {f.allocations.map((a) => (
                          <span
                            key={a.variant_index}
                            className="inline-flex items-center gap-1 px-1 rounded border border-border text-[11px] font-mono"
                            title={`${a.variant_name}: ${a.slots} katak · ${fmt(a.produced_qty)} dona (+${a.overprint_pct.toFixed(1)}%)`}
                          >
                            <span className="size-2 rounded-sm" style={{ background: variantColor(a.variant_index).solid }} />
                            {a.slots}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-2 text-right font-mono tabular-nums">{fmt(f.total_sheets_with_waste)}</td>
                    <td
                      className={cn(
                        "px-2 text-right font-mono tabular-nums",
                        over > s.maxOverprintPct && "text-amber-600 dark:text-amber-500"
                      )}
                    >
                      {over.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
