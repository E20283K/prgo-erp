"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "../components/fields";
import type { SheetImpositionController } from "../useSheetImposition";

const SEVERITY_CLS: Record<string, string> = {
  ERROR: "bg-destructive/10 text-destructive border-destructive/30",
  WARNING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  INFO: "bg-muted text-muted-foreground border-border",
};

export function PreflightPanel({ c }: { c: SheetImpositionController }) {
  const pf = c.analysis?.preflight;
  if (!pf) return null;

  // Die contour must match the product trim (either orientation) within 0.5 mm
  const die = c.analysis?.dieline;
  const { trimW, trimH } = c.settings;
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
  const dieMismatch =
    !!die &&
    !(near(die.trim_w_mm, trimW) && near(die.trim_h_mm, trimH)) &&
    !(near(die.trim_w_mm, trimH) && near(die.trim_h_mm, trimW));

  return (
    <Section
      title="Preflight"
      icon={ShieldCheck}
      right={
        <span className="flex items-center gap-1 text-[11px] font-mono">
          {pf.error_count > 0 && <span className="text-destructive">{pf.error_count} xato</span>}
          {pf.warning_count > 0 && <span className="text-amber-600 dark:text-amber-500">{pf.warning_count} ogoh.</span>}
          {pf.error_count === 0 && pf.warning_count === 0 && <span className="text-emerald-600 dark:text-emerald-500">Toza</span>}
          {c.analysisStale && <span className="text-muted-foreground">· eskirgan</span>}
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">Bleed</span>
        <span className="col-span-2 font-mono">{pf.detected_bleed_mm} mm</span>
        <span className="text-muted-foreground">Trim / Media</span>
        <span className="col-span-2 font-mono">
          {pf.trim_box_mm[0]}×{pf.trim_box_mm[1]} / {pf.media_box_mm[0]}×{pf.media_box_mm[1]} mm
        </span>
        {pf.min_image_dpi != null && (
          <>
            <span className="text-muted-foreground">Min DPI</span>
            <span className={cn("col-span-2 font-mono", pf.has_low_dpi && "text-amber-600 dark:text-amber-500")}>{pf.min_image_dpi}</span>
          </>
        )}
        {c.analysis?.dieline && (
          <>
            <span className="text-muted-foreground">Pichoq</span>
            <span className={cn("col-span-2 font-mono", dieMismatch && "text-amber-600 dark:text-amber-500")}>
              {c.analysis.dieline.trim_w_mm}×{c.analysis.dieline.trim_h_mm} mm
              {dieMismatch && ` ≠ ${c.settings.trimW}×${c.settings.trimH}`}
            </span>
          </>
        )}
      </div>

      {pf.colors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pf.colors.map((col) => {
            const [cc, m, y, k] = col.cmyk;
            const rgb = [cc, m, y].map((v) => Math.round(255 * (1 - v) * (1 - k)));
            return (
              <span key={col.name} className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-border text-[11px]">
                <span className="size-2.5 rounded-sm border border-border" style={{ background: `rgb(${rgb.join(",")})` }} />
                {col.name}
              </span>
            );
          })}
        </div>
      )}

      {pf.issues.length > 0 && (
        <ul className="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded">
          {pf.issues.map((iss, i) => (
            <li key={i} className="flex items-start gap-2 px-2 py-1 text-[11px]" title={iss.details || undefined}>
              <span className={cn("shrink-0 px-1 rounded border font-mono text-[10px]", SEVERITY_CLS[iss.severity] || SEVERITY_CLS.INFO)}>
                {iss.category}
              </span>
              <span className="min-w-0 break-words">{iss.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
