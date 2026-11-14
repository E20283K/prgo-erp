"use client";

import React from "react";
import type { LayoutCalcTabProps } from "./types";
import { useSheetImposition } from "./useSheetImposition";
import { SheetPanel } from "./panels/SheetPanel";
import { ProductPanel } from "./panels/ProductPanel";
import { GangingPanel } from "./panels/GangingPanel";
import { PreflightPanel } from "./panels/PreflightPanel";
import { OutputPanel } from "./panels/OutputPanel";
import { SheetCanvas } from "./preview/SheetCanvas";
import { DielineSourceCard } from "../../dieline/DielineSourceCard";

export function LayoutCalcTab(props: LayoutCalcTabProps) {
  const c = useSheetImposition(props);
  const readOnly = !!props.isOperator;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-3 h-full min-h-0 text-xs">
      <div className="flex flex-col gap-3 min-h-0 xl:overflow-y-auto no-scrollbar pb-2">
        <SheetPanel c={c} readOnly={readOnly} />
        <ProductPanel c={c} readOnly={readOnly} />
        {c.dieCard.onChange && <DielineSourceCard {...c.dieCard} onChange={c.dieCard.onChange} readOnly={readOnly} />}
        <GangingPanel c={c} readOnly={readOnly} />
        <OutputPanel c={c} readOnly={readOnly} />
        <PreflightPanel c={c} />
      </div>
      <div className="min-h-[520px] xl:min-h-0">
        <SheetCanvas c={c} />
      </div>
    </div>
  );
}

export default LayoutCalcTab;
