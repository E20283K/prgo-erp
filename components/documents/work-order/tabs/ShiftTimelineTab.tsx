"use client";

import React, { useMemo, useState } from "react";
import {
  Factory,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Plus,
  TrendingDown,
  User,
  ArrowRight,
  Trash2,
  Play,
  Pause,
  Wrench,
  QrCode,
  FileSpreadsheet,
  Search,
  Hourglass,
  Gauge,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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

export function getOperatorInitials(name: string) {
  if (!name) return "OP";
  const clean = name.replace(/\(.*?\)/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

const STATUS_LABELS: Record<RouteStep["status"], string> = {
  Queued: "Navbatda",
  "In Progress": "Jarayonda",
  Paused: "To'xtatilgan",
  Finished: "Yakunlandi",
};

const SHIFT_FILTER_LABELS: Record<string, string> = {
  all: "Smena: Barchasi",
  "1-smena": "1-smena",
  "2-smena": "2-smena",
};

const TYPE_FILTER_LABELS: Record<string, string> = {
  all: "Turi: Barchasi",
  pallets: "Paletlar",
  downtime: "To'xtalishlar",
};

interface ShiftTimelineTabProps {
  workOrderNo?: string;
  productName?: string;
  customerName?: string;
  operations: RouteStep[];
  selectedTimelineOpId: string;
  setSelectedTimelineOpId: (id: string) => void;
  selectedOp: RouteStep;
  selectedOpEvents: ShiftEvent[];
  allEvents?: ShiftEvent[];
  onOpenQuickPalletLog?: () => void;
  onOpenEditPalletLog?: (event: ShiftEvent) => void;
  onOpenDowntimeLog?: () => void;
  onOpenEditDowntimeLog?: (event: ShiftEvent) => void;
  onOpenPalletTagPrint?: (event: ShiftEvent) => void;
  onStartStep?: (opId: string) => void;
  onPauseStep?: (opId: string) => void;
  onResumeStep?: (opId: string) => void;
  onFinishStep?: (opId: string) => void;
  onChangeStepStatus?: (opId: string, status: RouteStep["status"]) => void;
  onDeleteEvent?: (eventId: string) => void;
  piecesPerSheet?: number;
}

export function ShiftTimelineTab({
  workOrderNo = "WO-26-0001",
  operations,
  selectedTimelineOpId,
  setSelectedTimelineOpId,
  selectedOp,
  selectedOpEvents,
  allEvents = [],
  onOpenQuickPalletLog,
  onOpenEditPalletLog,
  onOpenDowntimeLog,
  onOpenEditDowntimeLog,
  onOpenPalletTagPrint,
  onStartStep,
  onResumeStep,
  onFinishStep,
  onChangeStepStatus,
  onDeleteEvent,
}: ShiftTimelineTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { completed, target, unitSuffix, percent } = useMemo(
    () => parseQtyString(selectedOp.qtyCompleted),
    [selectedOp.qtyCompleted]
  );

  const { overallPercent, finishedStepsCount } = useMemo(() => {
    if (!operations.length) return { overallPercent: 0, finishedStepsCount: 0 };
    const finished = operations.filter((o) => o.status === "Finished").length;
    const pct = Math.round((finished / operations.length) * 100);
    return { overallPercent: pct, finishedStepsCount: finished };
  }, [operations]);

  const getOpGoodOutput = (op: RouteStep) => {
    const evs = allEvents.filter((ev) => ev.opId === op.id && ev.type === "Run");
    if (evs.length > 0) {
      return evs.reduce((sum, ev) => sum + (ev.goodQty || 0), 0);
    }
    return parseQtyString(op.qtyCompleted).completed;
  };

  const currentOpIndex = operations.findIndex((o) => o.id === selectedOp.id);
  const previousOp = currentOpIndex > 0 ? operations[currentOpIndex - 1] : undefined;

  const previousOpGoodOutput = useMemo(() => {
    if (!previousOp) return 0;
    return getOpGoodOutput(previousOp);
  }, [previousOp, allEvents]);

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
        downtimeTotalMinutes: 0,
      };
    }

    let inputTotal = 0;
    let makeReadyTotal = 0;
    let defectTotal = 0;
    let goodTotal = 0;
    let piecesTotal = 0;
    let downtimeMinutesTotal = 0;

    selectedOpEvents.forEach((ev) => {
      if (ev.inputQty !== undefined) inputTotal += ev.inputQty;
      if (ev.makeReadyQty !== undefined) makeReadyTotal += ev.makeReadyQty;
      if (ev.defectQty !== undefined) defectTotal += ev.defectQty;
      if (ev.goodQty !== undefined) {
        goodTotal += ev.goodQty;
      } else if (ev.type === "Run" && !ev.wasteQty) {
        goodTotal += completed;
      }
      if (ev.outputPiecesQty !== undefined) piecesTotal += ev.outputPiecesQty;
      if (ev.downtimeDurationMinutes) downtimeMinutesTotal += ev.downtimeDurationMinutes;
    });

    const totalWaste =
      makeReadyTotal + defectTotal > 0
        ? makeReadyTotal + defectTotal
        : selectedOpEvents.reduce((sum, ev) => sum + (ev.wasteQty || 0), 0);

    const grossInput = inputTotal > 0 ? inputTotal : goodTotal + totalWaste;
    const wastePct =
      grossInput > 0 ? ((totalWaste / grossInput) * 100).toFixed(1) : "0.0";
    const percentCompleted =
      target > 0 ? Math.min(100, Math.round((goodTotal / target) * 100)) : 0;

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
      downtimeTotalMinutes: downtimeMinutesTotal,
    };
  }, [selectedOpEvents, target, completed]);

  const effectiveGrossInput =
    stepStats.grossInput > 0 ? stepStats.grossInput : completed > 0 ? completed : 0;
  const effectiveGoodOutput =
    stepStats.goodOutput > 0 ? stepStats.goodOutput : completed;
  const availableWipFromPrev = Math.max(0, previousOpGoodOutput - effectiveGrossInput);

  const discrepancy = useMemo(() => {
    if (!previousOp || previousOpGoodOutput <= 0 || stepStats.grossInput <= 0) {
      return null;
    }
    const diff = stepStats.grossInput - previousOpGoodOutput;
    if (diff > 0) {
      return {
        type: "excess",
        diff,
        message: `Oldingi bosqichdan (${previousOpGoodOutput.toLocaleString()}) ko'p kiritildi`,
      };
    }
    return null;
  }, [previousOp, previousOpGoodOutput, stepStats.grossInput]);

  const filteredEvents = useMemo(() => {
    return selectedOpEvents.filter((ev) => {
      const effectiveShift = ev.shift || "1-smena";
      if (shiftFilter !== "all" && effectiveShift !== shiftFilter) return false;
      if (typeFilter === "pallets" && ev.type !== "Run") return false;
      if (
        typeFilter === "downtime" &&
        ev.type !== "Delay" &&
        ev.type !== "Maintenance"
      )
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = (ev.note || "").toLowerCase().includes(q);
        const opMatch = (ev.operator || "").toLowerCase().includes(q);
        const batchMatch = (ev.batchLabel || "").toLowerCase().includes(q);
        const reasonMatch = (ev.downtimeReason || "").toLowerCase().includes(q);
        const palletCodeMatch = (ev.palletCode || "").toLowerCase().includes(q);
        return (
          noteMatch || opMatch || batchMatch || reasonMatch || palletCodeMatch
        );
      }
      return true;
    });
  }, [selectedOpEvents, shiftFilter, typeFilter, searchQuery]);

  const isMultipiece =
    selectedOp.countingMode === "multipiece" ||
    /shtamp|die-cut|tigel|qadoq|pack/i.test(selectedOp.name);

  const handleExportCsv = () => {
    const headers = [
      "Vaqt",
      "Smena",
      "Bosqich",
      "Tavsif",
      "Turi",
      "Kirish",
      "Chiqish",
      "Brak",
      "Sabab",
      "Operator",
      "Izoh",
    ];

    const rows = filteredEvents.map((ev) => {
      const isDt = ev.type === "Delay" || ev.type === "Maintenance";
      return [
        ev.time,
        ev.shift || "1-smena",
        `#${selectedOp.stepNumber} ${selectedOp.name}`,
        isDt
          ? `To'xtalish (${ev.downtimeDurationMinutes || 15}m)`
          : ev.batchLabel || ev.palletCode || "Palet",
        ev.type,
        isDt ? "" : ev.inputQty || 0,
        isDt ? "" : ev.goodQty || 0,
        isDt ? "" : ev.wasteQty || 0,
        ev.downtimeReason || ev.wasteReason || "",
        ev.operator || selectedOp.operator || "",
        `"${(ev.note || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Smena_${workOrderNo}_Step${selectedOp.stepNumber}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <TabsContent
      value="timeline"
      className="flex-1 overflow-y-auto p-3.5 m-0 space-y-3 no-scrollbar"
    >
      {/* 1. Minimalist Route Pipeline Card */}
      <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Factory className="size-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Texnologik zanjir
            </span>
            <Badge variant="outline" className="font-mono text-[10px] h-4 px-1.5">
              {workOrderNo}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-24 sm:w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  overallPercent >= 100 ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-foreground">
              {overallPercent}%
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              ({finishedStepsCount}/{operations.length})
            </span>
          </div>
        </div>

        {/* Cascade Pipeline Steps */}
        <div className="flex items-stretch gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {operations.map((op, idx) => {
            const isSelected = selectedTimelineOpId === op.id;
            const opParsed = parseQtyString(op.qtyCompleted);
            const opGoodQty = getOpGoodOutput(op);
            const isOffset = /ofset|print|pechat|press/i.test(op.name);
            const opEvents = allEvents.filter((ev) => ev.opId === op.id);
            const opDowntimeMins = opEvents.reduce(
              (sum, ev) => sum + (ev.downtimeDurationMinutes || 0),
              0
            );

            return (
              <React.Fragment key={op.id}>
                <div
                  onClick={() => setSelectedTimelineOpId(op.id)}
                  className={cn(
                    "flex-1 min-w-[200px] max-w-[320px] p-2.5 rounded-md border text-left cursor-pointer transition-all select-none flex flex-col justify-between",
                    isSelected
                      ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                      : "bg-muted/25 border-border hover:bg-muted/50"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">
                        #{op.stepNumber}
                      </span>
                      {op.status === "Finished" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0 h-4">
                          <CheckCircle2 className="size-2.5 mr-0.5" />
                          Tayyor
                        </Badge>
                      ) : op.status === "In Progress" ? (
                        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[9px] px-1.5 py-0 h-4">
                          <Play className="size-2.5 mr-0.5 fill-current" />
                          {opParsed.percent}%
                        </Badge>
                      ) : op.status === "Paused" ? (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0 h-4">
                          <Pause className="size-2.5 mr-0.5" />
                          To&apos;xtagan
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground text-[9px] px-1.5 py-0 h-4"
                        >
                          Navbatda
                        </Badge>
                      )}
                    </div>

                    <div className="font-bold text-xs text-foreground line-clamp-1 leading-snug">
                      {op.name}
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-border/50 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">
                        {op.duration}h
                        {opDowntimeMins > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            (+{opDowntimeMins}m)
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-foreground">
                        {opGoodQty.toLocaleString()}
                        {opParsed.target > 0
                          ? ` / ${opParsed.target.toLocaleString()}`
                          : ""}
                      </span>
                    </div>

                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          op.status === "Finished"
                            ? "bg-emerald-500"
                            : op.status === "Paused"
                            ? "bg-amber-500"
                            : "bg-primary"
                        )}
                        style={{
                          width: `${
                            op.status === "Finished" ? 100 : opParsed.percent
                          }%`,
                        }}
                      />
                    </div>

                    {isOffset && op.status === "Finished" && (
                      <div className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Hourglass className="size-2.5 shrink-0" />
                        <span className="truncate">Quritish: 4h</span>
                      </div>
                    )}
                  </div>
                </div>

                {idx < operations.length - 1 && (
                  <div className="flex flex-col items-center justify-center px-1 shrink-0 select-none">
                    <div className="px-1.5 py-0.5 rounded bg-muted/60 border border-border text-[9px] font-mono font-semibold text-muted-foreground whitespace-nowrap mb-1">
                      {opGoodQty > 0 ? `${opGoodQty.toLocaleString()}` : "0"}
                    </div>
                    <ArrowRight
                      className={cn(
                        "size-3.5",
                        opGoodQty > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground/40"
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 2. Selected Step Control Strip */}
      <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "size-8 rounded-md border flex items-center justify-center font-mono font-bold text-xs",
                selectedOp.status === "Finished"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : selectedOp.status === "Paused"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                  : "bg-primary/10 border-primary/25 text-primary"
              )}
            >
              #{selectedOp.stepNumber}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
                <span>{selectedOp.name}</span>
                {availableWipFromPrev > 0 && (
                  <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-mono text-[10px] h-5">
                    WIP: {availableWipFromPrev.toLocaleString()}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap font-mono">
                <span className="flex items-center gap-1 font-sans">
                  <User className="size-3 text-muted-foreground" />
                  <strong className="text-foreground">
                    {selectedOp.operator || "—"}
                  </strong>
                </span>
                <span>·</span>
                <span>{selectedOp.duration}h</span>
                <span>·</span>
                <span>
                  Reja:{" "}
                  <strong className="text-foreground">
                    {target.toLocaleString()}
                    {unitSuffix}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onChangeStepStatus && (
              <Select
                value={selectedOp.status}
                onValueChange={(val: string | null) => {
                  if (
                    val === "Queued" ||
                    val === "In Progress" ||
                    val === "Paused" ||
                    val === "Finished"
                  ) {
                    onChangeStepStatus(selectedOp.id, val);
                  }
                }}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 text-xs font-semibold px-2.5 w-[130px] border shadow-2xs",
                    selectedOp.status === "Finished"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : selectedOp.status === "In Progress"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                      : selectedOp.status === "Paused"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  <SelectValue>
                    {STATUS_LABELS[selectedOp.status] || selectedOp.status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Queued" className="text-xs">
                    Navbatda
                  </SelectItem>
                  <SelectItem value="In Progress" className="text-xs">
                    Jarayonda
                  </SelectItem>
                  <SelectItem value="Paused" className="text-xs">
                    To&apos;xtatilgan
                  </SelectItem>
                  <SelectItem value="Finished" className="text-xs">
                    Yakunlandi
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {selectedOp.status === "Queued" && onStartStep && (
              <Button
                type="button"
                size="sm"
                onClick={() => onStartStep(selectedOp.id)}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
              >
                <Play className="size-3.5 fill-current" />
                <span>Boshlash</span>
              </Button>
            )}

            {selectedOp.status === "In Progress" && (
              <>
                {onOpenDowntimeLog && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenDowntimeLog}
                    className="h-8 text-xs border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 font-semibold flex items-center gap-1.5"
                  >
                    <Pause className="size-3.5" />
                    <span>To&apos;xtalish</span>
                  </Button>
                )}

                {onFinishStep && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onFinishStep(selectedOp.id)}
                    className="h-8 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 font-semibold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Yakunlash</span>
                  </Button>
                )}
              </>
            )}

            {selectedOp.status === "Paused" && (
              <>
                {onResumeStep && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onResumeStep(selectedOp.id)}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
                  >
                    <Play className="size-3.5 fill-current" />
                    <span>Davom ettirish</span>
                  </Button>
                )}

                {onOpenDowntimeLog && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenDowntimeLog}
                    className="h-8 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15"
                  >
                    <Wrench className="size-3.5 mr-1" />
                    <span>To&apos;xtalish</span>
                  </Button>
                )}
              </>
            )}

            {onOpenQuickPalletLog && (
              <Button
                type="button"
                onClick={onOpenQuickPalletLog}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>Palet kiritish</span>
              </Button>
            )}
          </div>
        </div>

        {discrepancy && (
          <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-3.5 shrink-0 text-rose-600" />
              <span>{discrepancy.message}</span>
            </div>
            <span className="font-mono font-bold shrink-0">
              +{discrepancy.diff.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 3. Minimalist KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Kirgan qog'oz */}
        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
              Kirgan qog&apos;oz
            </span>
            <Layers className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-foreground leading-none">
              {effectiveGrossInput.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center justify-between font-mono">
              <span>list</span>
              {previousOpGoodOutput > 0 && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  oldingi: {previousOpGoodOutput.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Jami brak */}
        <div
          className={cn(
            "p-3 rounded-lg border shadow-2xs flex flex-col justify-between transition-colors",
            stepStats.totalWaste > 0
              ? "border-rose-500/30 bg-rose-500/5"
              : "border-border bg-card"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                stepStats.totalWaste > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground"
              )}
            >
              Jami brak
            </span>
            <TrendingDown
              className={cn(
                "size-3.5",
                stepStats.totalWaste > 0
                  ? "text-rose-500"
                  : "text-muted-foreground"
              )}
            />
          </div>
          <div className="mt-2">
            <div
              className={cn(
                "text-xl font-black font-mono leading-none",
                stepStats.totalWaste > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              )}
            >
              {stepStats.totalWaste.toLocaleString()}
            </div>
            <span
              className={cn(
                "text-[10px] mt-1.5 block font-mono",
                stepStats.totalWaste > 0
                  ? "text-rose-600/80 dark:text-rose-400/80"
                  : "text-muted-foreground"
              )}
            >
              {stepStats.wastePct}% ({stepStats.makeReady} pril. +{" "}
              {stepStats.defect} brak)
            </span>
          </div>
        </div>

        {/* Sof chiqish */}
        <div
          className={cn(
            "p-3 rounded-lg border shadow-2xs flex flex-col justify-between transition-colors",
            effectiveGoodOutput > 0
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-border bg-card"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                effectiveGoodOutput > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              Sof chiqish
            </span>
            <CheckCircle2
              className={cn(
                "size-3.5",
                effectiveGoodOutput > 0
                  ? "text-emerald-500"
                  : "text-muted-foreground"
              )}
            />
          </div>
          <div className="mt-2">
            <div
              className={cn(
                "text-xl font-black font-mono leading-none",
                effectiveGoodOutput > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              )}
            >
              {effectiveGoodOutput.toLocaleString()}
            </div>
            <span
              className={cn(
                "text-[10px] mt-1.5 block font-mono",
                effectiveGoodOutput > 0
                  ? "text-emerald-600/80 dark:text-emerald-400/80"
                  : "text-muted-foreground"
              )}
            >
              {isMultipiece && stepStats.outputPieces > 0
                ? `${stepStats.outputPieces.toLocaleString()} dona`
                : `reja: ${target.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Bajarilishi */}
        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
              Bajarilishi
            </span>
            <Gauge className="size-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-foreground leading-none">
                {percent}%
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold",
                  stepStats.downtimeTotalMinutes > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                {stepStats.downtimeTotalMinutes > 0
                  ? `${stepStats.downtimeTotalMinutes}m to'xtalish`
                  : `${selectedOp.duration}h me'yor`}
              </span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden flex">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
              {stepStats.downtimeTotalMinutes > 0 && percent < 100 && (
                <div
                  className="bg-amber-500/80 h-full"
                  style={{
                    width: `${Math.min(
                      100 - percent,
                      Math.max(12, Math.round((stepStats.downtimeTotalMinutes / 60) * 25))
                    )}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Smena Jurnali Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-2xs">
        <div className="p-2.5 px-3 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Smena jurnali
            </span>
            <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5">
              {filteredEvents.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-36 sm:w-44">
              <Search className="size-3.5 absolute left-2 top-2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Qidiruv..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 text-xs bg-background"
              />
            </div>

            <Select
              value={shiftFilter}
              onValueChange={(val: string | null) => {
                if (val) setShiftFilter(val);
              }}
            >
              <SelectTrigger size="sm" className="h-7 text-xs w-[130px] bg-background">
                <SelectValue>
                  {SHIFT_FILTER_LABELS[shiftFilter] || shiftFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Smena: Barchasi
                </SelectItem>
                <SelectItem value="1-smena" className="text-xs">
                  1-smena
                </SelectItem>
                <SelectItem value="2-smena" className="text-xs">
                  2-smena
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(val: string | null) => {
                if (val) setTypeFilter(val);
              }}
            >
              <SelectTrigger size="sm" className="h-7 text-xs w-[130px] bg-background">
                <SelectValue>
                  {TYPE_FILTER_LABELS[typeFilter] || typeFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Turi: Barchasi
                </SelectItem>
                <SelectItem value="pallets" className="text-xs">
                  Paletlar
                </SelectItem>
                <SelectItem value="downtime" className="text-xs">
                  To&apos;xtalishlar
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredEvents.length === 0}
              className="h-7 text-xs flex items-center gap-1.5"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              <span>CSV</span>
            </Button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Yozuvlar mavjud emas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] uppercase font-mono text-muted-foreground">
                  <th className="py-2 px-3 font-semibold">Vaqt</th>
                  <th className="py-2 px-3 font-semibold">Turi</th>
                  <th className="py-2 px-3 font-semibold">Tavsif</th>
                  <th className="py-2 px-3 font-semibold text-right">Kirish</th>
                  <th className="py-2 px-3 font-semibold text-right">Chiqish</th>
                  <th className="py-2 px-3 font-semibold text-right">Brak</th>
                  <th className="py-2 px-3 font-semibold">Operator</th>
                  <th className="py-2 px-3 font-semibold text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEvents.map((ev) => {
                  const isDowntime =
                    ev.type === "Delay" || ev.type === "Maintenance";
                  const wasteTotal =
                    (ev.makeReadyQty || 0) + (ev.defectQty || 0) ||
                    ev.wasteQty ||
                    0;
                  const effectiveShift = ev.shift || "1-smena";
                  const effectiveOperator =
                    ev.operator || selectedOp.operator || "Navbatchi";

                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-muted/40 transition-colors group text-xs"
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-semibold text-foreground">
                            {ev.time}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono px-1.5 py-0 h-4 text-muted-foreground"
                          >
                            {effectiveShift}
                          </Badge>
                        </div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        {isDowntime ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0 h-4 font-mono">
                            <Pause className="size-2.5 mr-0.5" />
                            {ev.downtimeDurationMinutes || 15} daq.
                          </Badge>
                        ) : wasteTotal > 0 ? (
                          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[9px] px-1.5 py-0 h-4">
                            Brakli
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0 h-4">
                            Palet
                          </Badge>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        {isDowntime ? (
                          <div>
                            <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                              <Wrench className="size-3 shrink-0" />
                              <span>
                                {ev.downtimeReason || "To'xtalish"}
                              </span>
                            </div>
                            {ev.note &&
                              ev.note !== ev.downtimeReason && (
                                <div className="text-[10px] text-muted-foreground truncate max-w-md">
                                  {ev.note}
                                </div>
                              )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-foreground">
                              {ev.batchLabel || "Palet #1"}
                            </div>
                            {ev.wasteReason && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-md">
                                {ev.wasteReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {isDowntime
                          ? "—"
                          : ev.inputQty !== undefined
                          ? ev.inputQty.toLocaleString()
                          : "—"}
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {isDowntime ? (
                          "—"
                        ) : ev.goodQty !== undefined ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {ev.goodQty.toLocaleString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-2 px-3 text-right font-mono">
                        {isDowntime ? (
                          <span className="text-muted-foreground">—</span>
                        ) : wasteTotal > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {wasteTotal.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="size-3 text-primary shrink-0" />
                          <span className="truncate max-w-[130px] text-foreground/90">
                            {effectiveOperator}
                          </span>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {ev.type === "Run" && onOpenPalletTagPrint && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onOpenPalletTagPrint(ev)}
                              title="QR etiketka"
                              className="size-7 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <QrCode className="size-3.5" />
                            </Button>
                          )}

                          {isDowntime
                            ? onOpenEditDowntimeLog && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenEditDowntimeLog(ev)}
                                  title="Tahrirlash"
                                  className="size-7 p-0 text-muted-foreground hover:text-primary"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              )
                            : onOpenEditPalletLog && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenEditPalletLog(ev)}
                                  title="Tahrirlash"
                                  className="size-7 p-0 text-muted-foreground hover:text-primary"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              )}

                          {onDeleteEvent && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteEvent(ev.id)}
                              title="O'chirish"
                              className="size-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TabsContent>
  );
}
