"use client";

import React from "react";
import { DollarSign, TrendingDown, AlertCircle } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShiftEvent } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FinancialsTabProps {
  shiftEvents: ShiftEvent[];
}

export function FinancialsTab({ shiftEvents }: FinancialsTabProps) {
  // Compute total waste
  const wasteEvents = shiftEvents.filter((ev) => ev.type === "Waste" && ev.wasteQty);
  const totalWasteQty = wasteEvents.reduce((sum, ev) => sum + (ev.wasteQty || 0), 0);

  // Mock pricing logic for demonstration
  const UNIT_COST = 0.5; 
  const wasteCost = totalWasteQty * UNIT_COST;
  
  const plannedMaterialCost = 12500 * UNIT_COST;
  const actualMaterialCost = plannedMaterialCost + wasteCost;
  
  const plannedMachineCost = 400; // Mock 4 hours * 100/hr
  const actualMachineCost = 450; // Mock extra half hour
  
  const totalPlannedCost = plannedMaterialCost + plannedMachineCost;
  const totalActualCost = actualMaterialCost + actualMachineCost;
  
  const expectedRevenue = 14850;
  const plannedMargin = ((expectedRevenue - totalPlannedCost) / expectedRevenue) * 100;
  const actualMargin = ((expectedRevenue - totalActualCost) / expectedRevenue) * 100;

  return (
    <TabsContent value="financials" className="flex-1 p-4 m-0 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Financials & Costing Analysis
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Margin Summary */}
        <Card className="col-span-1 shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {actualMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Planned: {plannedMargin.toFixed(1)}%
            </p>
            {actualMargin < plannedMargin && (
              <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/30 p-1.5 rounded">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Margin dropped due to waste/delays</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost of Poor Quality */}
        <Card className="col-span-1 md:col-span-2 shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              Cost of Poor Quality (COPQ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
                  ${wasteCost.toFixed(2)}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Total loss from {totalWasteQty} units of waste
                </p>
              </div>
              
              {wasteEvents.length > 0 && (
                <div className="text-right">
                  <span className="text-xs text-zinc-500 block mb-1">Top Reasons:</span>
                  {Array.from(new Set(wasteEvents.map(e => e.wasteReason))).map(reason => (
                    <Badge key={reason} variant="outline" className="mr-1 text-[10px]">
                      {reason}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Material Costs */}
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Material Costs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Planned Material Cost</span>
              <span className="font-mono font-medium">${plannedMaterialCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Actual Material Cost</span>
              <span className="font-mono font-medium">${actualMaterialCost.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Variance</span>
              <span className={`font-mono font-bold ${wasteCost > 0 ? "text-red-600" : "text-emerald-600"}`}>
                +${wasteCost.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Machine & Labor Costs */}
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Machine & Overheads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Planned Run Time Cost</span>
              <span className="font-mono font-medium">${plannedMachineCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Actual Run Time Cost</span>
              <span className="font-mono font-medium">${actualMachineCost.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Variance</span>
              <span className={`font-mono font-bold ${actualMachineCost > plannedMachineCost ? "text-red-600" : "text-emerald-600"}`}>
                +${(actualMachineCost - plannedMachineCost).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Waste Events Log */}
      {wasteEvents.length > 0 && (
        <div className="mt-6 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-950 font-semibold border-b border-zinc-200 dark:border-zinc-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            Waste & Defect Log
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]">
            {wasteEvents.map((ev) => (
              <div key={ev.id} className="p-2.5 flex items-center justify-between hover:bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500">{ev.time}</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[9px]">
                    {ev.wasteQty} units
                  </Badge>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {ev.wasteReason}
                  </span>
                  <span className="text-zinc-500 italic">
                    - {ev.note}
                  </span>
                </div>
                <span className="text-zinc-400 font-mono text-[10px]">{ev.operator}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </TabsContent>
  );
}
