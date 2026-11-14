"use client";

import React from "react";
import { Check, CheckCircle2, Download, FileOutput, Loader2, Play, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Section, SelectField } from "../components/fields";
import type { SheetImpositionController } from "../useSheetImposition";

export function OutputPanel({ c, readOnly }: { c: SheetImpositionController; readOnly?: boolean }) {
  const s = c.settings;
  const files = c.generated?.files ?? [];

  return (
    <Section title="Montaj" icon={FileOutput}>
      <div className="grid grid-cols-2 gap-2 items-end">
        <SelectField
          label="Shablon"
          value={s.templateStyle}
          disabled={readOnly}
          onChange={(templateStyle) => c.update({ templateStyle })}
          options={[
            { value: "offset_standard", label: "Ofset" },
            { value: "digital_compact", label: "Raqamli" },
            { value: "standard", label: "Shkala" },
            { value: "compact", label: "Ixcham" },
            { value: "packaging", label: "Qadoq" },
          ]}
        />
        <label className="h-7 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Alohida fayllar</span>
          <Switch size="sm" checked={s.exportSeparate} disabled={readOnly} onCheckedChange={(v) => c.update({ exportSeparate: v })} />
        </label>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={readOnly || !!c.busy || !c.hasAllArtwork}
          onClick={() => void c.runAnalyze()}
          title={c.hasAllArtwork ? undefined : "Har bir tur uchun oldi PDF kerak"}
        >
          {c.busy === "analyze" ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
          Tahlil
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs flex-1"
          disabled={readOnly || !!c.busy || !c.hasAllArtwork || !c.calc}
          onClick={() => void c.runGenerate()}
        >
          {c.busy === "generate" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Montaj yaratish
        </Button>
      </div>

      {c.actionError && <div className="text-[11px] text-destructive break-words">{c.actionError}</div>}

      {files.length > 0 ? (
        <ul className="divide-y divide-border border border-border rounded">
          {files.map((f) => (
            <li key={f.filename} className="h-7 flex items-center justify-between gap-2 px-2 text-xs">
              <span className="font-medium">{f.label}</span>
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                {(f.size_bytes / 1024 / 1024).toFixed(2)} MB
                <a href={f.url} target="_blank" rel="noreferrer" download={f.filename} className="text-foreground hover:text-primary" title="Yuklab olish">
                  <Download className="size-3.5" />
                </a>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        c.savedPdfUrl && (
          <a href={c.savedPdfUrl} target="_blank" rel="noreferrer" className="h-7 flex items-center gap-1.5 px-2 text-xs border border-border rounded hover:bg-muted">
            <Download className="size-3.5" />
            Oxirgi montaj PDF
          </a>
        )
      )}

      {c.canApply && !readOnly && (
        <Button
          type="button"
          size="sm"
          variant={c.isApplied ? "secondary" : "default"}
          className="h-7 w-full text-xs"
          onClick={c.applyToOrder}
          title="Listlar soni va CTP plastinalarni buyurtmaga yozish"
        >
          {c.isApplied ? <Check className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {c.isApplied ? "Qo'llangan" : "Buyurtmaga qo'llash"}
        </Button>
      )}
    </Section>
  );
}
