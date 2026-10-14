"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Clock, Factory, CheckCircle2, Layers, Calculator, Hash, ArrowRightLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldTitle,
  FieldDescription,
} from "@/components/ui/field";
import { RouteStep, ShiftEvent } from "../types";

export function parseQtyString(qtyStr: string, fallbackTarget = 5000) {
  const parts = (qtyStr || "").split("/");
  const parseNum = (s?: string) => {
    if (!s) return 0;
    const digits = s.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };
  const completed = parseNum(parts[0]);
  const target = parts[1] ? parseNum(parts[1]) || fallbackTarget : fallbackTarget;
  const suffixMatch = (parts[1] || "").match(/[a-zA-Z]+.*$/);
  const unitSuffix = suffixMatch ? ` ${suffixMatch[0].trim()}` : "";
  const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  return { completed, target, unitSuffix, percent };
}

type ReportMode = "stack" | "passthrough" | "bundles" | "counter";

interface ShiftTimelineTabProps {
  operations: RouteStep[];
  selectedTimelineOpId: string;
  setSelectedTimelineOpId: (id: string) => void;
  selectedOp: RouteStep;
  selectedOpEvents: ShiftEvent[];
  onOpenLogEvent: () => void;
  onUpdateStepOutput: (
    opId: string,
    newCompleted: number,
    target: number,
    unitSuffix: string,
    logNote: string,
    wasteQty?: number,
    wasteReason?: string
  ) => void;
}

export function ShiftTimelineTab({
  operations,
  selectedTimelineOpId,
  setSelectedTimelineOpId,
  selectedOp,
  selectedOpEvents,
  onOpenLogEvent,
  onUpdateStepOutput,
}: ShiftTimelineTabProps) {
  const { completed, target, unitSuffix, percent } = useMemo(
    () => parseQtyString(selectedOp.qtyCompleted),
    [selectedOp.qtyCompleted]
  );

  // Previous step output for Pass-Through mode
  const prevStep = useMemo(() => {
    const idx = operations.findIndex((o) => o.id === selectedOp.id);
    return idx > 0 ? operations[idx - 1] : null;
  }, [operations, selectedOp.id]);

  const prevStepParsed = useMemo(
    () => (prevStep ? parseQtyString(prevStep.qtyCompleted, target) : null),
    [prevStep, target]
  );
  const passThroughInput = prevStepParsed && prevStepParsed.completed > 0 ? prevStepParsed.completed : target;

  // Auto-select smart mode based on machine/operation type
  const isSemiAutoOrFinishing = /cut|die|laminat|fold|gluer|pack|slit|ultrasonic|laser/i.test(
    `${selectedOp.name} ${selectedOp.machine}`
  );

  const [reportMode, setReportMode] = useState<ReportMode>(
    isSemiAutoOrFinishing ? "passthrough" : "counter"
  );

  useEffect(() => {
    const semiAuto = /cut|die|laminat|fold|gluer|pack|slit|ultrasonic|laser/i.test(
      `${selectedOp.name} ${selectedOp.machine}`
    );
    setReportMode(semiAuto ? "passthrough" : "counter");
  }, [selectedOp.id, selectedOp.name, selectedOp.machine]);

  // Mode inputs
  const [counterDelta, setCounterDelta] = useState<string>("500");
  const [wasteInput, setWasteInput] = useState<string>("0");
  const [bundleCount, setBundleCount] = useState<string>("5");
  const [bundleSize, setBundleSize] = useState<string>("250");

  const handleStackMilestone = (pct: number) => {
    const nextQty = Math.round((target * pct) / 100);
    onUpdateStepOutput(
      selectedOp.id,
      nextQty,
      target,
      unitSuffix,
      `Visual stack progress set to ${pct}% (${nextQty.toLocaleString()} / ${target.toLocaleString()}${unitSuffix})`
    );
  };

  const handlePassThroughApply = () => {
    const spoil = Math.max(0, parseInt(wasteInput, 10) || 0);
    const goodQty = Math.max(0, passThroughInput - spoil);
    onUpdateStepOutput(
      selectedOp.id,
      goodQty,
      target,
      unitSuffix,
      spoil > 0
        ? `Pass-through completed from ${prevStep ? `Step ${prevStep.stepNumber}` : "batch"} (${passThroughInput.toLocaleString()} input − ${spoil.toLocaleString()} waste = ${goodQty.toLocaleString()} good)`
        : `Pass-through 100% transferred (${goodQty.toLocaleString()}${unitSuffix})`,
      spoil > 0 ? spoil : undefined,
      spoil > 0 ? "Cutting / Finishing Spoilage" : undefined
    );
    setWasteInput("0");
  };

  const handleBundlesAdd = () => {
    const packs = Math.max(1, parseInt(bundleCount, 10) || 0);
    const perPack = Math.max(1, parseInt(bundleSize, 10) || 0);
    const added = packs * perPack;
    const nextQty = Math.min(target, completed + added);
    onUpdateStepOutput(
      selectedOp.id,
      nextQty,
      target,
      unitSuffix,
      `Recorded ${packs} lifts/bundles × ${perPack} = +${added.toLocaleString()}${unitSuffix} (Total: ${nextQty.toLocaleString()})`
    );
  };

  const handleCounterAdd = (amount?: number) => {
    const delta = amount ?? (parseInt(counterDelta, 10) || 0);
    if (delta <= 0) return;
    const nextQty = Math.min(target, completed + delta);
    onUpdateStepOutput(
      selectedOp.id,
      nextQty,
      target,
      unitSuffix,
      `Counter output +${delta.toLocaleString()}${unitSuffix} logged (Total: ${nextQty.toLocaleString()} / ${target.toLocaleString()})`
    );
  };

  return (
    <TabsContent value="timeline" className="flex-1 p-4 m-0 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            Shift Allocation & Timeline
          </h3>
          <Badge variant="outline" className="text-[10px] font-mono">
            Step {selectedOp.stepNumber}: {selectedOp.name}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono">
            Planned: {selectedOp.duration}h
          </Badge>
          {selectedOp.status === "Finished" ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border-none text-[10px]">
              Finished
            </Badge>
          ) : selectedOp.status === "In Progress" ? (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-none text-[10px]">
              In Progress (On Schedule)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-zinc-500 border-zinc-300 text-[10px]">
              Queued (Pending)
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Vertical Technological Route Steps & Assignment Details */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-blue-600" />
                Technological Route Steps
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {operations.length} steps
              </span>
            </div>

            <RadioGroup
              value={selectedTimelineOpId}
              onValueChange={(val: any) => val && setSelectedTimelineOpId(String(val))}
              className="flex flex-col gap-2"
            >
              {operations.map((op) => {
                const isSelected = selectedTimelineOpId === op.id;
                const opParsed = parseQtyString(op.qtyCompleted);
                const statusBadge =
                  op.status === "Finished" ? (
                    <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 text-[9px] px-1.5 py-0 h-4">
                      Finished
                    </Badge>
                  ) : op.status === "In Progress" ? (
                    <Badge className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 text-[9px] px-1.5 py-0 h-4">
                      {opParsed.percent}% Run
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-500 text-[9px] px-1.5 py-0 h-4">
                      Queued
                    </Badge>
                  );

                return (
                  <FieldLabel
                    key={op.id}
                    htmlFor={`op-radio-${op.id}`}
                    className={cn(
                      "p-2.5 rounded-md border transition-all cursor-pointer flex flex-col justify-between gap-1.5 text-left",
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/30 shadow-xs"
                        : "bg-zinc-50/60 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100/50"
                    )}
                  >
                    <Field orientation="horizontal" className="items-start">
                      <FieldContent className="gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-zinc-500 font-bold">
                            Step {op.stepNumber}
                          </span>
                          {statusBadge}
                        </div>
                        <FieldTitle className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                          {op.name}
                        </FieldTitle>
                        <FieldDescription className="text-[10px] text-zinc-500 truncate">
                          {op.machine}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={op.id} id={`op-radio-${op.id}`} className="mt-0.5" />
                    </Field>

                    <div className="pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span className="truncate">{op.operator}</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                        {op.qtyCompleted} ({op.duration}h)
                      </span>
                    </div>
                  </FieldLabel>
                );
              })}
            </RadioGroup>
          </div>

          {/* Shift Assignment Card */}
          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-2.5">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span>Assignment Details</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">Step {selectedOp.stepNumber}</span>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Assigned Shift</label>
                <Select defaultValue="day-shift">
                  <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day-shift">Day Shift (08:00 - 20:00)</SelectItem>
                    <SelectItem value="night-shift">Night Shift (20:00 - 08:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Shift Lead / Operator</label>
                  <Input disabled value={selectedOp.operator} className="h-7 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-medium" />
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Work Center / Machine</label>
                  <Input disabled value={selectedOp.machine} className="h-7 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Timeline, Smart Output Reporting & Shift Event Log */}
        <div className="lg:col-span-8 space-y-4">
          {/* Timeline Visualizer Card */}
          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <span>Execution Timeline: {selectedOp.name}</span>
              <span className="text-zinc-500 font-mono text-[10px]">
                {selectedOp.status === "Finished" ? "Completed Shift" : selectedOp.status === "In Progress" ? "Live: 15:30" : "Planned Run"}
              </span>
            </div>
            
            <div className="space-y-1">
              {/* Visual Bar */}
              {selectedOp.status === "Finished" ? (
                <div className="h-6 w-full rounded overflow-hidden flex font-mono text-[9px] font-bold text-white text-center leading-6 shadow-inner">
                  <div className="bg-emerald-600 w-full" title="Step Complete">FINISHED (100%)</div>
                </div>
              ) : selectedOp.status === "In Progress" ? (
                <div className="h-6 w-full rounded overflow-hidden flex font-mono text-[9px] font-bold text-white text-center leading-6 shadow-inner">
                  <div className="bg-amber-500 w-[15%]" title="Setup / Make-Ready: 40 mins">SETUP</div>
                  <div className="bg-blue-600 w-[75%] relative" title="Print Run: 3 hrs 20 mins">
                    RUN ({percent}%)
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_4px_rgba(0,0,0,0.8)] transition-all"
                      style={{ left: `${Math.min(98, Math.max(4, percent))}%` }}
                    />
                  </div>
                  <div className="bg-emerald-500 w-[10%]" title="Wash-up / Maintenance: 15 mins">WASH</div>
                </div>
              ) : (
                <div className="h-6 w-full rounded overflow-hidden flex font-mono text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 text-center leading-6 border border-dashed border-zinc-300 dark:border-zinc-700">
                  <div className="w-[20%] border-r border-zinc-200 dark:border-zinc-700">PLANNED SETUP</div>
                  <div className="w-[80%]">PLANNED RUN ({selectedOp.duration} hrs)</div>
                </div>
              )}

              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>14:00</span>
                <span>14:40</span>
                {selectedOp.status === "In Progress" && (
                  <span className="text-blue-600 font-bold">15:30 (Now)</span>
                )}
                <span>18:00</span>
                <span>18:15</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Operation Status</span>
                <span className={cn(
                  "font-mono text-sm font-semibold",
                  selectedOp.status === "Finished" ? "text-emerald-600" : selectedOp.status === "In Progress" ? "text-blue-600" : "text-zinc-500"
                )}>
                  {selectedOp.status === "Finished" ? "100% Completed" : selectedOp.status === "In Progress" ? `${percent}% In Progress` : "0% In Queue"}
                </span>
              </div>
              <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Processed Output</span>
                <span className="font-mono text-sm font-semibold text-blue-600">{selectedOp.qtyCompleted}</span>
              </div>
              <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Machine Velocity</span>
                <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {selectedOp.status === "Finished" ? "Cycle Completed" : selectedOp.status === "In Progress" ? "12,500 sh/hr" : "Scheduled"}
                </span>
              </div>
            </div>

            {/* Smart Shop-Floor Output Reporting Bar */}
            <div className="p-2.5 rounded-md bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                    Report Operator Output
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono h-4 px-1.5 text-zinc-500">
                    {isSemiAutoOrFinishing ? "Semi-Auto / Finishing Mode" : "Digital Counter Mode"}
                  </Badge>
                </div>

                {/* 4 Reporting Modes Selector */}
                <div className="inline-flex items-center rounded bg-zinc-200/70 dark:bg-zinc-900 p-0.5 border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setReportMode("passthrough")}
                    className={cn(
                      "px-2 py-0.5 rounded-[3px] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                      reportMode === "passthrough"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    )}
                    title="Best for Die-cutting, Guillotine & Lamination: Inherit previous step output minus waste"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Input − Waste</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportMode("stack")}
                    className={cn(
                      "px-2 py-0.5 rounded-[3px] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                      reportMode === "stack"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    )}
                    title="Visual pallet or stack percentage estimate"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Pallet %</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportMode("bundles")}
                    className={cn(
                      "px-2 py-0.5 rounded-[3px] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                      reportMode === "bundles"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    )}
                    title="Count by cut lifts (стопа), bundles or boxes"
                  >
                    <Calculator className="w-3 h-3" />
                    <span>Lifts / Boxes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportMode("counter")}
                    className={cn(
                      "px-2 py-0.5 rounded-[3px] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                      reportMode === "counter"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    )}
                    title="Direct machine counter reading (Offset, Flexo, Loom)"
                  >
                    <Hash className="w-3 h-3" />
                    <span>Counter</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Pass-Through (Input from Prev Step - Waste) */}
              {reportMode === "passthrough" && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span>
                      Input from {prevStep ? `Step ${prevStep.stepNumber}` : "Order"}:{" "}
                      <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                        {passThroughInput.toLocaleString()}
                      </strong>
                    </span>
                    <span>−</span>
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Spoiled / Waste:</span>
                      <Input
                        type="number"
                        min={0}
                        value={wasteInput}
                        onChange={(e) => setWasteInput(e.target.value)}
                        className="h-6 w-16 text-xs font-mono px-1.5 bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <span>=</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {Math.max(0, passThroughInput - (parseInt(wasteInput, 10) || 0)).toLocaleString()} good
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePassThroughApply}
                    className="h-6 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Complete Step</span>
                  </Button>
                </div>
              )}

              {/* Mode 2: Pallet / Stack % Milestones */}
              {reportMode === "stack" && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                  <span className="text-[11px] text-zinc-500">
                    Tap visual pallet/stack progress (no piece counting needed):
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[25, 50, 75, 100].map((pct) => {
                      const pctQty = Math.round((target * pct) / 100);
                      const isCurrent = Math.abs(percent - pct) <= 3;
                      return (
                        <Button
                          key={pct}
                          type="button"
                          size="sm"
                          variant={isCurrent ? "default" : "outline"}
                          onClick={() => handleStackMilestone(pct)}
                          className={cn(
                            "h-6 px-2 text-[10px] font-mono cursor-pointer",
                            pct === 100 && !isCurrent && "border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          )}
                        >
                          {pct}% ({pctQty.toLocaleString()})
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mode 3: Lifts / Bundles / Boxes Calculator */}
              {reportMode === "bundles" && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span>Lifts / Boxes:</span>
                    <Input
                      type="number"
                      min={1}
                      value={bundleCount}
                      onChange={(e) => setBundleCount(e.target.value)}
                      className="h-6 w-14 text-xs font-mono px-1.5 bg-white dark:bg-zinc-900"
                    />
                    <span>×</span>
                    <span>Qty per Lift/Box:</span>
                    <Input
                      type="number"
                      min={1}
                      value={bundleSize}
                      onChange={(e) => setBundleSize(e.target.value)}
                      className="h-6 w-16 text-xs font-mono px-1.5 bg-white dark:bg-zinc-900"
                    />
                    <span>=</span>
                    <strong className="font-mono text-blue-600 dark:text-blue-400">
                      +{((parseInt(bundleCount, 10) || 0) * (parseInt(bundleSize, 10) || 0)).toLocaleString()}
                    </strong>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleBundlesAdd}
                    className="h-6 px-2.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Batch</span>
                  </Button>
                </div>
              )}

              {/* Mode 4: Machine Digital Counter */}
              {reportMode === "counter" && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span>Add Counter Qty:</span>
                    <Input
                      type="number"
                      min={1}
                      value={counterDelta}
                      onChange={(e) => setCounterDelta(e.target.value)}
                      className="h-6 w-20 text-xs font-mono px-1.5 bg-white dark:bg-zinc-900"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCounterAdd()}
                      className="h-6 px-2 text-[11px] bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    >
                      + Add
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCounterAdd(500)}
                      className="h-6 px-2 text-[10px] font-mono cursor-pointer"
                    >
                      +500
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCounterAdd(1000)}
                      className="h-6 px-2 text-[10px] font-mono cursor-pointer"
                    >
                      +1,000
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleStackMilestone(100)}
                      className="h-6 px-2 text-[10px] font-mono border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                    >
                      100% Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

      {/* Downtime / Delay Log */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
        <div className="p-2.5 bg-zinc-100 dark:bg-zinc-950 font-semibold border-b border-zinc-200 dark:border-zinc-800 text-xs flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <span>Shift Event & Downtime Log</span>
            <Badge variant="outline" className="text-[10px] font-mono font-normal">
              Step {selectedOp.stepNumber} ({selectedOpEvents.length})
            </Badge>
          </span>
          <Button onClick={onOpenLogEvent} size="sm" variant="outline" className="h-6 text-[10px] px-2 py-0 border-zinc-300 cursor-pointer">
            Log Event
          </Button>
        </div>
        
        {selectedOpEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No shift events logged for this step yet. Click &quot;Log Event&quot; above to record setup, run, or delays.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]">
            {selectedOpEvents.map((ev) => (
              <div key={ev.id} className="p-2.5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">{ev.time}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px]",
                      ev.type === "Setup" && "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200",
                      ev.type === "Run" && "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200",
                      ev.type === "Delay" && "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200",
                      ev.type === "Maintenance" && "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200",
                      ev.type === "QC" && "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200",
                      ev.type === "Waste" && "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 font-semibold"
                    )}
                  >
                    {ev.type === "Waste" ? "Scrap / Waste" : ev.type}
                  </Badge>
                  <span className={cn(
                    "font-medium",
                    ev.type === "Delay" || ev.type === "Waste" ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300"
                  )}>
                    {ev.note}
                    {ev.wasteQty ? (
                      <span className="ml-2 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                        {ev.wasteQty.toLocaleString()} units • {ev.wasteReason || "Defect"}
                      </span>
                    ) : null}
                  </span>
                </div>
                <span className="text-zinc-400 font-mono text-[10px]">{ev.operator}</span>
              </div>
            ))}
          </div>
        )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
