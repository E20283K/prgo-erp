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
  ArrowRight,
  Trash2,
  Package,
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
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
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

export function getOperatorInitials(name: string) {
  if (!name) return "OP";
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

interface ShiftTimelineTabProps {
  operations: RouteStep[];
  selectedTimelineOpId: string;
  setSelectedTimelineOpId: (id: string) => void;
  selectedOp: RouteStep;
  selectedOpEvents: ShiftEvent[];
  allEvents?: ShiftEvent[];
  onOpenQuickPalletLog?: () => void;
  onChangeStepStatus?: (opId: string, status: RouteStep["status"]) => void;
  onDeleteEvent?: (eventId: string) => void;
  piecesPerSheet?: number;
}

export function ShiftTimelineTab({
  operations,
  selectedTimelineOpId,
  setSelectedTimelineOpId,
  selectedOp,
  selectedOpEvents,
  allEvents = [],
  onOpenQuickPalletLog,
  onChangeStepStatus,
  onDeleteEvent,
  piecesPerSheet = 1,
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

  // Find index of current op
  const currentOpIndex = operations.findIndex((o) => o.id === selectedOp.id);
  const previousOp = currentOpIndex > 0 ? operations[currentOpIndex - 1] : undefined;

  // Previous op good output calculation
  const previousOpGoodOutput = useMemo(() => {
    if (!previousOp) return 0;
    const prevEvents = allEvents.filter((ev) => ev.opId === previousOp.id);
    if (prevEvents.length > 0) {
      return prevEvents.reduce((sum, ev) => sum + (ev.goodQty || 0), 0);
    }
    const parsed = parseQtyString(previousOp.qtyCompleted);
    return parsed.completed;
  }, [previousOp, allEvents]);

  // Aggregate stats strictly from structured ShiftEvent records
  const stepStats = useMemo(() => {
    if (!selectedOpEvents || selectedOpEvents.length === 0) {
      return {
        hasLogs: false,
        grossInput: 0,
        makeReady: 0,
        defect: 0,
        totalWaste: 0,
        goodOutput: 0,
        outputPieces: 0,
        wastePct: "0.0",
        percentCompleted: 0,
      };
    }

    let inputTotal = 0;
    let makeReadyTotal = 0;
    let defectTotal = 0;
    let goodTotal = 0;
    let piecesTotal = 0;

    selectedOpEvents.forEach((ev) => {
      // Direct structured fields
      if (ev.inputQty !== undefined) {
        inputTotal += ev.inputQty;
      } else {
        const inputMatch = ev.note.match(/Kirish:\s*([\d,]+)/i);
        if (inputMatch) inputTotal += parseInt(inputMatch[1].replace(/,/g, ""), 10) || 0;
      }

      if (ev.makeReadyQty !== undefined) {
        makeReadyTotal += ev.makeReadyQty;
      }
      if (ev.defectQty !== undefined) {
        defectTotal += ev.defectQty;
      }

      if (ev.goodQty !== undefined) {
        goodTotal += ev.goodQty;
      } else {
        const outMatch = ev.note.match(/Chiqish:\s*([\d,]+)/i);
        if (outMatch) {
          goodTotal += parseInt(outMatch[1].replace(/,/g, ""), 10) || 0;
        } else if (ev.type === "Run" && !ev.wasteQty) {
          goodTotal += completed;
        }
      }

      if (ev.outputPiecesQty !== undefined) {
        piecesTotal += ev.outputPiecesQty;
      }
    });

    const totalWaste = makeReadyTotal + defectTotal > 0
      ? makeReadyTotal + defectTotal
      : selectedOpEvents.reduce((sum, ev) => sum + (ev.wasteQty || 0), 0);

    const grossInput = inputTotal > 0 ? inputTotal : (goodTotal + totalWaste);
    const wastePct = grossInput > 0 ? ((totalWaste / grossInput) * 100).toFixed(1) : "0.0";
    const percentCompleted = target > 0 ? Math.min(100, Math.round((goodTotal / target) * 100)) : 0;

    return {
      hasLogs: true,
      grossInput,
      makeReady: makeReadyTotal,
      defect: defectTotal,
      totalWaste,
      goodOutput: goodTotal,
      outputPieces: piecesTotal,
      wastePct,
      percentCompleted,
    };
  }, [selectedOpEvents, target, completed]);

  // Is multipiece step
  const isMultipiece = selectedOp.countingMode === "multipiece" || /shtamp|die-cut|tigel|qadoq|pack/i.test(selectedOp.name);

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
              <span>Smena & Qog&apos;oz Harakati Nazorati (Cascade Floor Ledger)</span>
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
        {/* Left Column: Technological Route Steps (Cascade Waterfall) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-3 bg-card border border-border rounded-lg space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-primary" />
                <span>Texnologik Bosqichlar Zanjiri</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {operations.length} ta operatsiya
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {operations.map((op, idx) => {
                const isSelected = selectedTimelineOpId === op.id;
                const opParsed = parseQtyString(op.qtyCompleted);
                const isCutter = /kesish|gilotin|cutter/i.test(op.name);

                return (
                  <div
                    key={op.id}
                    onClick={() => setSelectedTimelineOpId(op.id)}
                    className={cn(
                      "p-2.5 rounded-md border transition-all cursor-pointer flex flex-col gap-1.5 text-left select-none relative",
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
                            {opParsed.percent}% Bajarildi
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

                    {isCutter && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                        Datchiksiz (Nazariy hisob)
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                      <span className="truncate max-w-[130px]">{op.machine || "Dastgoh"}</span>
                      <strong className="text-foreground">{op.qtyCompleted}</strong>
                    </div>

                    {/* Biriktirilgan Operatorlar (Avatar Group) */}
                    {(() => {
                      const opList = (op.operators && op.operators.length > 0)
                        ? op.operators
                        : (op.operator ? [op.operator] : []);

                      if (opList.length === 0) return null;

                      return (
                        <div className="flex items-center justify-between gap-1.5 pt-1 mt-0.5 border-t border-border/30">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AvatarGroup className="-space-x-1.5">
                              {opList.slice(0, 3).map((operatorName) => {
                                const initials = getOperatorInitials(operatorName);
                                return (
                                  <Avatar
                                    key={operatorName}
                                    size="sm"
                                    className="size-6 text-[10px] font-bold border-2 border-card bg-card shadow-sm"
                                    title={operatorName}
                                  >
                                    <AvatarFallback className="size-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                );
                              })}
                            </AvatarGroup>

                            <span className="text-[10px] text-muted-foreground truncate font-sans" title={opList.join(", ")}>
                              {opList.length === 1 ? opList[0] : `${opList[0]} (+${opList.length - 1})`}
                            </span>
                          </div>

                          {opList.length > 3 && (
                            <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 rounded">
                              +{opList.length - 3}
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <AvatarGroup className="-space-x-1.5">
                      {((selectedOp.operators && selectedOp.operators.length > 0)
                        ? selectedOp.operators
                        : (selectedOp.operator ? [selectedOp.operator] : [])
                      ).slice(0, 4).map((opName) => (
                        <Avatar
                          key={opName}
                          size="sm"
                          className="size-6 text-[10px] font-bold border-2 border-card bg-card shadow-sm"
                          title={opName}
                        >
                          <AvatarFallback className="size-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold">
                            {getOperatorInitials(opName)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    <span>Mas&apos;ul: <strong className="text-foreground">{selectedOp.operator}</strong></span>
                    {selectedOp.operators && selectedOp.operators.length > 1 && (
                      <span className="text-muted-foreground"> (+{selectedOp.operators.length - 1} yordamchi)</span>
                    )}
                  </div>
                  <span>·</span>
                  <div>Reja: <strong className="text-foreground font-mono">{target.toLocaleString()}{unitSuffix}</strong></div>
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
                    2. Jami Isrof (Brak)
                  </span>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="mt-1">
                  <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 leading-none">
                    {stepStats.totalWaste.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1 block font-mono">
                    {stepStats.wastePct}% ({stepStats.makeReady} pril. + {stepStats.defect} brak)
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
                    {stepStats.goodOutput > 0 ? stepStats.goodOutput.toLocaleString() : completed.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
                    {isMultipiece && stepStats.outputPieces > 0
                      ? `${stepStats.outputPieces.toLocaleString()} dona tayyor`
                      : "yaroqli list"}
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
                <span>Ushbu Bosqichda Qabul Qilingan va Topshirilgan Paletlar (Log)</span>
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
                      {ev.shift && (
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4">
                          {ev.shift}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          ev.wasteQty && ev.wasteQty > 0
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        )}
                      >
                        {ev.wasteQty && ev.wasteQty > 0
                          ? `Brak: ${ev.wasteQty} l.`
                          : "Toza partiya"}
                      </Badge>
                      <span className="font-medium text-foreground text-xs">
                        {ev.note}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-mono">
                        <User className="w-3 h-3 text-primary" />
                        <span>{ev.operator}</span>
                      </div>

                      {onDeleteEvent && (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(ev.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                          title="Yozuvni o'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
