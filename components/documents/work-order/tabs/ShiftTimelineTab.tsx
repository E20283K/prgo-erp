"use client";

import React, { useMemo } from "react";
import {
  Factory,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  Clock,
  Printer,
  ChevronRight,
  TrendingDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RouteStep, ShiftEvent } from "../types";

export function parseQtyString(qtyStr: string, fallbackTarget = 0) {
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

interface ShiftTimelineTabProps {
  operations: RouteStep[];
  selectedTimelineOpId: string;
  setSelectedTimelineOpId: (id: string) => void;
  selectedOp: RouteStep;
  selectedOpEvents: ShiftEvent[];
  onOpenQuickPalletLog?: () => void;
  onChangeStepStatus?: (opId: string, status: RouteStep["status"]) => void;
}

export function ShiftTimelineTab({
  operations,
  selectedTimelineOpId,
  setSelectedTimelineOpId,
  selectedOp,
  selectedOpEvents,
  onOpenQuickPalletLog,
  onChangeStepStatus,
}: ShiftTimelineTabProps) {
  const { completed, target, unitSuffix, percent } = useMemo(
    () => parseQtyString(selectedOp.qtyCompleted),
    [selectedOp.qtyCompleted]
  );

  // Overall route completion
  const { overallPercent, finishedStepsCount } = useMemo(() => {
    if (!operations.length) return { overallPercent: 0, finishedStepsCount: 0 };
    const finished = operations.filter((o) => o.status === "Finished").length;
    const pct = Math.round((finished / operations.length) * 100);
    return { overallPercent: pct, finishedStepsCount: finished };
  }, [operations]);

  // Aggregate stats STRICTLY from actual pallet floor logs for this step
  const stepStats = useMemo(() => {
    // If no events have been recorded for this step, it is completely fresh (0)
    if (!selectedOpEvents || selectedOpEvents.length === 0) {
      return {
        hasLogs: false,
        grossInput: 0,
        totalWaste: 0,
        goodOutput: 0,
        wastePct: "0.0",
        percentCompleted: 0,
      };
    }

    let inputTotal = 0;
    let totalWaste = 0;
    let goodOutput = 0;

    selectedOpEvents.forEach((ev) => {
      // Parse logged text like: "[Palet #1] Kirish: 5000 l. | Priladka: 20 | Brak: 0 | Chiqish: 4980 l."
      const inputMatch = ev.note.match(/Kirish:s*([d,]+)/i);
      const outMatch = ev.note.match(/Chiqish:s*([d,]+)/i);

      if (inputMatch) {
        inputTotal += parseInt(inputMatch[1].replace(/,/g, ""), 10) || 0;
      }
      if (outMatch) {
        goodOutput += parseInt(outMatch[1].replace(/,/g, ""), 10) || 0;
      } else if (ev.type === "Run" && !ev.wasteQty) {
        goodOutput += completed;
      }

      if (ev.wasteQty) {
        totalWaste += ev.wasteQty;
      }
    });

    // If input was not matched, fallback to goodOutput + waste
    const grossInput = inputTotal > 0 ? inputTotal : (goodOutput + totalWaste);
    const wastePct = grossInput > 0 ? ((totalWaste / grossInput) * 100).toFixed(1) : "0.0";
    const percentCompleted = target > 0 ? Math.min(100, Math.round((goodOutput / target) * 100)) : 0;

    return {
      hasLogs: true,
      grossInput,
      totalWaste,
      goodOutput,
      wastePct,
      percentCompleted,
    };
  }, [selectedOpEvents, target, completed]);

  return (
    <TabsContent value="timeline" className="flex-1 overflow-y-auto p-4 m-0 space-y-4 no-scrollbar">
      {/* Top Status & Overview Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border border-border rounded-lg shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-2">
              <span>Smena & Qog&apos;oz Harakati Nazorati</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                Bosqich {selectedOp.stepNumber}: {selectedOp.name}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Har bir bosqichga kirgan qog&apos;oz, priladka/brak va sof chiqishni qayd etish
            </p>
          </div>
        </div>

        {/* Center: Overall Progress */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-md bg-muted/50 border border-border">
          <span className="text-[11px] font-medium text-muted-foreground">
            Umumiy buyurtma:
          </span>
          <div className="w-32 lg:w-44 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                overallPercent >= 100 ? "bg-emerald-500" : "bg-emerald-600"
              )}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-foreground">
            {overallPercent}%
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ({finishedStepsCount}/{operations.length} bosqich)
          </span>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          {onChangeStepStatus && (
            <Select
              value={selectedOp.status}
              onValueChange={(val) => {
                if (val === "Queued" || val === "In Progress" || val === "Finished") {
                  onChangeStepStatus(selectedOp.id, val);
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-8 text-xs font-semibold px-2.5 w-[140px] border shadow-2xs",
                  selectedOp.status === "Finished"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : selectedOp.status === "In Progress"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Queued" className="text-xs">Navbatda (Queued)</SelectItem>
                <SelectItem value="In Progress" className="text-xs">Jarayonda (In Progress)</SelectItem>
                <SelectItem value="Finished" className="text-xs">Yakunlandi (Finished)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Technological Route Steps */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-3 bg-card border border-border rounded-lg space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-primary" />
                Texnologik Bosqichlar
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {operations.length} ta operatsiya
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {operations.map((op) => {
                const isSelected = selectedTimelineOpId === op.id;
                const opParsed = parseQtyString(op.qtyCompleted);
                return (
                  <div
                    key={op.id}
                    onClick={() => setSelectedTimelineOpId(op.id)}
                    className={cn(
                      "p-3 rounded-md border transition-all cursor-pointer flex flex-col gap-1.5 text-left select-none",
                      isSelected
                        ? "bg-primary/5 border-primary shadow-xs"
                        : "bg-muted/30 border-border hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">
                          Step {op.stepNumber}
                        </span>
                        {op.status === "Finished" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0 h-4">
                            Tayyor
                          </Badge>
                        ) : op.status === "In Progress" ? (
                          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[9px] px-1.5 py-0 h-4">
                            {opParsed.percent}% Bosildi
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5 py-0 h-4">
                            Navbatda
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {op.duration} soat
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-foreground leading-tight">
                      {op.name}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                      <span>{op.machine || "Dastgoh"}</span>
                      <strong className="text-foreground">{op.qtyCompleted}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Floor Output Dashboard & Actual Pallet Movement Log */}
        <div className="lg:col-span-8 space-y-4">
          {/* Main Floor Action Card */}
          <div className="p-4 bg-card border border-border rounded-lg space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>{selectedOp.name}</span>
                  <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/5">
                    {selectedOp.machine}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Mas&apos;ul: <strong className="text-foreground">{selectedOp.operator}</strong> · Reja:{" "}
                  <strong className="text-foreground font-mono">{target.toLocaleString()}{unitSuffix}</strong>
                </div>
              </div>

              {/* Single Main Primary Floor Action Button */}
              {onOpenQuickPalletLog && (
                <Button
                  type="button"
                  onClick={onOpenQuickPalletLog}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Palet hisobotini kiritish (Brak & Chiqish)</span>
                </Button>
              )}
            </div>

            {/* Actual Quantities KPI Cards (Real Floor Metrics) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* 1. Kirgan listlar */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col justify-between">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  1. Kirgan Qog&apos;oz
                </span>
                <div className="mt-1">
                  <div className="text-xl font-black font-mono text-foreground leading-none">
                    {stepStats.grossInput > 0 ? stepStats.grossInput.toLocaleString() : (completed > 0 ? completed.toLocaleString() : "—")}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">list (brutto)</span>
                </div>
              </div>

              {/* 2. Priladka & Jarayon braki */}
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400 tracking-wider">
                    2. Jami Brak
                  </span>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="mt-1">
                  <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 leading-none">
                    {stepStats.totalWaste.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1 block">
                    {stepStats.wastePct}% chiqindi
                  </span>
                </div>
              </div>

              {/* 3. Sof topshirilgan */}
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                    3. Sof Chiqish
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="mt-1">
                  <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                    {completed.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
                    yaroqli list
                  </span>
                </div>
              </div>

              {/* 4. Bosqich Bajarilishi */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col justify-between">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  4. Bajarilishi
                </span>
                <div className="mt-1">
                  <div className="text-xl font-black font-mono text-primary leading-none">
                    {percent}%
                  </div>
                  <div className="w-full bg-border h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actual Pallet Movement & Dispatch Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-2xs">
            <div className="p-3 bg-muted/40 font-bold border-b border-border text-xs flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>Ushbu Bosqichda Qabul Qilingan va Topshirilgan Paletlar</span>
                <Badge variant="outline" className="text-[10px] font-mono font-normal">
                  {selectedOpEvents.length} ta yozuv
                </Badge>
              </span>
            </div>

            {selectedOpEvents.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-foreground">
                  Hali palet hisoboti kiritilmadi
                </div>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Operator ishni boshlaganida yoki tugatganida yuqoridagi{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">&quot;Palet hisobotini kiritish&quot;</strong>{" "}
                  tugmasi orqali kirgan va chiqqan listlarni qayd etadi.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border text-xs">
                {selectedOpEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-muted-foreground text-xs font-semibold w-12">
                        {ev.time}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          ev.wasteQty && ev.wasteQty > 0
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        )}
                      >
                        {ev.wasteQty && ev.wasteQty > 0 ? `Brak: ${ev.wasteQty} l.` : "Toza partiya"}
                      </Badge>
                      <span className="font-medium text-foreground text-xs">
                        {ev.note}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-mono shrink-0">
                      <User className="w-3 h-3 text-primary" />
                      <span>{ev.operator}</span>
                    </div>
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
