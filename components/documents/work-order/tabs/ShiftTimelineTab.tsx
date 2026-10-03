"use client";

import React from "react";
import { Clock, Factory } from "lucide-react";
import { cn } from "cn";
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

interface ShiftTimelineTabProps {
  operations: RouteStep[];
  selectedTimelineOpId: string;
  setSelectedTimelineOpId: (id: string) => void;
  selectedOp: RouteStep;
  selectedOpEvents: ShiftEvent[];
  onOpenLogEvent: () => void;
}

export function ShiftTimelineTab({
  operations,
  selectedTimelineOpId,
  setSelectedTimelineOpId,
  selectedOp,
  selectedOpEvents,
  onOpenLogEvent,
}: ShiftTimelineTabProps) {
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

      {/* Operation Selector Choice Cards using RadioGroup */}
      <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Factory className="w-3.5 h-3.5 text-blue-600" />
            Select Technological Route Step
          </span>
          <span className="text-[11px] text-zinc-500">
            Switch machine & operator to view shift timeline and log events
          </span>
        </div>

        <RadioGroup
          value={selectedTimelineOpId}
          onValueChange={(val: any) => val && setSelectedTimelineOpId(String(val))}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
        >
          {operations.map((op) => {
            const isSelected = selectedTimelineOpId === op.id;
            const statusBadge =
              op.status === "Finished" ? (
                <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 text-[9px] px-1.5 py-0 h-4">
                  Finished
                </Badge>
              ) : op.status === "In Progress" ? (
                <Badge className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 text-[9px] px-1.5 py-0 h-4">
                  In Progress
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
                  "p-2.5 rounded-md border transition-all cursor-pointer flex flex-col justify-between gap-2 text-left",
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
                  <span className="truncate max-w-[110px]">{op.operator}</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{op.duration}h plan</span>
                </div>
              </FieldLabel>
            );
          })}
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shift Assignment Card */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 col-span-1">
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
            <div>
              <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Shift Lead / Operator</label>
              <Input disabled value={selectedOp.operator} className="h-7 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-medium" />
            </div>
            <div>
              <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Assigned Work Center / Machine</label>
              <Input disabled value={selectedOp.machine} className="h-7 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-500" />
            </div>
          </div>
        </div>

        {/* Timeline Visualizer Card */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-4 col-span-1 lg:col-span-2">
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
                  RUN
                  <div className="absolute top-0 bottom-0 left-[45%] w-0.5 bg-black/50 z-10 shadow-[0_0_2px_rgba(255,255,255,0.5)]"></div>
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
                <span className="text-blue-600 font-bold ml-10">15:30 (Now)</span>
              )}
              <span>18:00</span>
              <span>18:15</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Operation Status</span>
              <span className={cn(
                "font-mono text-sm font-semibold",
                selectedOp.status === "Finished" ? "text-emerald-600" : selectedOp.status === "In Progress" ? "text-blue-600" : "text-zinc-500"
              )}>
                {selectedOp.status === "Finished" ? "100% Completed" : selectedOp.status === "In Progress" ? "38% In Progress" : "0% In Queue"}
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
                      ev.type === "QC" && "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200"
                    )}
                  >
                    {ev.type}
                  </Badge>
                  <span className={cn(
                    "font-medium",
                    ev.type === "Delay" ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300"
                  )}>
                    {ev.note}
                  </span>
                </div>
                <span className="text-zinc-400 font-mono text-[10px]">{ev.operator}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TabsContent>
  );
}
