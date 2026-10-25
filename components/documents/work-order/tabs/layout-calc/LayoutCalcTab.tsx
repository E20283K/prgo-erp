"use client";

import React from "react";
import { LayoutCalcTabProps } from "./types";
import { useLayoutCalc } from "./useLayoutCalc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PhoenixWorkspace } from "./panels/PhoenixWorkspace";

export function LayoutCalcTab(props: LayoutCalcTabProps) {
  const calc = useLayoutCalc(props);

  return (
    <TooltipProvider delay={100}>
      <div className="flex flex-col h-full text-xs overflow-hidden">
        <PhoenixWorkspace calc={calc} props={props} />
      </div>
    </TooltipProvider>
  );
}

export default LayoutCalcTab;
