"use client";

import React from "react";
import { LayoutCalcTabProps } from "./types";
import { useLayoutCalc } from "./useLayoutCalc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CtpJobTicketModal } from "./panels/CtpJobTicketModal";
import { PhoenixWorkspace } from "./panels/PhoenixWorkspace";

export function LayoutCalcTab(props: LayoutCalcTabProps) {
  const calc = useLayoutCalc(props);

  return (
    <TooltipProvider delay={100}>
      <div className="flex flex-col h-full text-xs overflow-hidden">
        <PhoenixWorkspace calc={calc} props={props} />

        {/* CTP JOB TICKET / TECH CARD PRINT MODAL */}
        <CtpJobTicketModal
          isOpen={calc.isJobTicketOpen}
          onClose={() => calc.setIsJobTicketOpen(false)}
          docNo={props.docNo || "WOOF-26-0001"}
          orderName={props.orderName || "Client Order"}
          pressMachine={calc.pressMachine}
          paperStock={calc.paperStock}
          sheetW={calc.sheetW}
          sheetH={calc.sheetH}
          prodW={calc.prodW}
          prodH={calc.prodH}
          plates={calc.plateCalculations}
          effectivePieces={calc.effectivePieces}
          ctpSideRelation={calc.ctpSideRelation}
          frontColorsCount={calc.frontColorsCount}
          backColorsCount={calc.backColorsCount}
          totalCtpPlates={calc.totalCtpPlates}
          totalSheetsRun={calc.totalSheetsRun}
          totalProducedYield={calc.totalProducedYield}
          totalOverproduction={calc.totalOverproduction}
        />
      </div>
    </TooltipProvider>
  );
}

export default LayoutCalcTab;
