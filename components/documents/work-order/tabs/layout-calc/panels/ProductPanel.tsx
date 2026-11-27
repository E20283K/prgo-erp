"use client";

import React from "react";
import { Scissors } from "lucide-react";
import { NumField, Section, Segmented, SelectField } from "../components/fields";
import { BleedSketch, KnifeSketch, ModeSketch, WithSketch, useFocusKey } from "../components/sketches";
import type { SheetImpositionController } from "../useSheetImposition";

export function ProductPanel({ c, readOnly }: { c: SheetImpositionController; readOnly?: boolean }) {
  const s = c.settings;
  const n = (v: number | undefined, fallback = 0) => v ?? fallback;
  const hasBack = c.backColorCount > 0;
  const bleedFocus = useFocusKey();
  const knifeFocus = useFocusKey();

  return (
    <Section title="Mahsulot" icon={Scissors}>
      <div className="grid grid-cols-3 gap-2">
        <NumField label="Eni" suffix="mm" step={0.5} value={s.trimW} disabled={readOnly} onChange={(v) => c.update({ trimW: n(v, 1) })} />
        <NumField label="Bo'yi" suffix="mm" step={0.5} value={s.trimH} disabled={readOnly} onChange={(v) => c.update({ trimH: n(v, 1) })} />
        <NumField label="Bleed" suffix="mm" step={0.5} value={s.bleed} disabled={readOnly} onChange={(v) => c.update({ bleed: n(v) })} />
      </div>

      <WithSketch
        {...bleedFocus.handlers}
        sketch={
          <BleedSketch
            outer={s.outerBleed}
            inner={s.innerBleed}
            cropGap={s.cropGap}
            cropWidth={s.cropLineWidth ?? 0.12}
            gutter={s.gutterX}
            focus={bleedFocus.focus}
          />
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <div data-k="innerBleed">
            <NumField label="Ichki fon" suffix="mm" step={0.5} value={s.innerBleed} disabled={readOnly} onChange={(v) => c.update({ innerBleed: n(v) })} />
          </div>
          <div data-k="outerBleed">
            <NumField label="Tashqi fon" suffix="mm" step={0.5} value={s.outerBleed} disabled={readOnly} onChange={(v) => c.update({ outerBleed: n(v) })} />
          </div>
          <div data-k="cropGap">
            <NumField label="Krop oralig'i" suffix="mm" step={0.5} value={s.cropGap} disabled={readOnly} onChange={(v) => c.update({ cropGap: n(v) })} />
          </div>
          <div data-k="cropLineWidth">
            <NumField
              label="Krop qalinligi"
              suffix="mm"
              step={0.05}
              min={0.05}
              value={s.cropLineWidth ?? 0.12}
              disabled={readOnly}
              onChange={(v) => c.update({ cropLineWidth: Math.min(2, n(v, 0.12)) })}
            />
          </div>
        </div>
      </WithSketch>

      <WithSketch
        {...knifeFocus.handlers}
        sketch={
          <KnifeSketch
            cutStyle={s.cutStyle}
            gutter={knifeFocus.focus === "gutterY" ? s.gutterY : s.gutterX}
            focus={knifeFocus.focus}
          />
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <div data-k="gutterX">
            <NumField label="Oraliq X" suffix="mm" step={0.5} value={s.gutterX} disabled={readOnly} onChange={(v) => c.update({ gutterX: n(v) })} />
          </div>
          <div data-k="gutterY">
            <NumField label="Oraliq Y" suffix="mm" step={0.5} value={s.gutterY} disabled={readOnly} onChange={(v) => c.update({ gutterY: n(v) })} />
          </div>
          <SelectField
            label="Kesim"
            className="col-span-2"
            value={s.cutStyle}
            disabled={readOnly || s.category === "diecut"}
            // One knife cuts flush between neighbours, so there is no gutter; two knives need one
            onChange={(cutStyle) =>
              c.update(
                cutStyle === "single"
                  ? { cutStyle, gutterX: 0, gutterY: 0 }
                  : { cutStyle, gutterX: s.gutterX || 3, gutterY: s.gutterY || 3 }
              )
            }
            options={[
              { value: "double", label: "2 pichoq" },
              { value: "single", label: "1 pichoq" },
            ]}
          />
        </div>
      </WithSketch>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Turi</span>
        <Segmented
          value={s.category}
          disabled={readOnly}
          onChange={(category) =>
            c.update({
              category,
              templateStyle: category === "diecut" ? "packaging" : "offset_standard",
            })
          }
          options={[
            { value: "guillotine", label: "Gilotin" },
            { value: "diecut", label: "Shtans" },
          ]}
        />
      </div>

      <WithSketch sketch={<ModeSketch mode={s.mode} />}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Bosma</span>
          <Segmented
            value={s.mode}
            disabled={readOnly}
            onChange={c.setMode}
            options={[
              { value: "single_sided", label: `${c.frontColorCount}+0` },
              { value: "sheetwise", label: "Oldi-orqa", title: hasBack ? undefined : "Orqa rang belgilanmagan" },
              { value: "work_and_turn", label: "Svoy" },
            ]}
          />
        </div>
      </WithSketch>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Aylantirish</span>
        <Segmented
          value={s.rotation}
          disabled={readOnly}
          onChange={(rotation) => c.update({ rotation })}
          options={[
            { value: "auto", label: "Avto" },
            { value: 0, label: "0°" },
            { value: 90, label: "90°" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="Ustun"
          value={s.manualCols}
          min={1}
          placeholder="avto"
          disabled={readOnly}
          onChange={(v) => c.update({ manualCols: v ? Math.round(v) : undefined })}
        />
        <NumField
          label="Qator"
          value={s.manualRows}
          min={1}
          placeholder="avto"
          disabled={readOnly}
          onChange={(v) => c.update({ manualRows: v ? Math.round(v) : undefined })}
        />
      </div>
    </Section>
  );
}
