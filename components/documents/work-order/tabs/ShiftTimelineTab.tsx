"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Factory,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Plus,
  User,
  ArrowRight,
  Trash2,
  Play,
  Pause,
  Wrench,
  QrCode,
  FileSpreadsheet,
  Search,
  Pencil,
  SlidersHorizontal, Clock,
  Boxes,
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
import { plantClock } from "@/lib/shiftSchedule";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveMachine } from "../utils/operationCost";
import { getStepKpis, pct, scoreTone, stepUnit } from "../utils/stepKpis";

const TONE_TEXT = {
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-rose-600 dark:text-rose-400",
  none: "text-foreground",
} as const;
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatMinutes,
  getStepTimeline,
  isDowntimeEvent,
  isOpenDowntime,
  type StepPhase,
} from "../utils/stepTimeline";

const PHASE_LABEL: Record<StepPhase, string> = {
  queued: "Navbatda",
  setup: "Sozlash",
  run: "Ishlamoqda",
  paused: "To'xtalish",
  finished: "Yakunlandi",
};

const PHASE_CLASS: Record<StepPhase, string> = {
  queued: "bg-muted text-muted-foreground border-border",
  setup: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  run: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  finished: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const TRANSITION_LABEL: Partial<Record<ShiftEvent["type"], string>> = {
  SetupStart: "Sozlash",
  RunStart: "Ishga tushdi",
  Finish: "Yakunlandi",
  Correction: "Tuzatish",
};

/** Steps recorded before the journal kept transitions: their phase comes from the stored status. */
function legacyPhase(op: RouteStep): StepPhase {
  if (op.status === "Finished") return "finished";
  if (op.status === "Paused") return "paused";
  if (op.status === "In Progress") return op.phase === "setup" ? "setup" : "run";
  return "queued";
}

/** "14.11" day label of an entry on the plant clock (empty for old entries without a date). */
function eventDay(ev: ShiftEvent): string {
  if (!ev.occurredAt) return "";
  const d = new Date(ev.occurredAt);
  if (Number.isNaN(d.getTime())) return "";
  const [, m, day] = plantClock(d).day.split("-");
  return `${day}.${m}`;
}

export function formatElapsedHMS(totalSeconds: number) { const s = Math.max(0, Math.floor(totalSeconds)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; }

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
  steps: "Holatlar",
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
  /** Make-ready starts. */
  onStartSetup?: (opId: string) => void;
  /** Production run starts (from the queue or after make-ready). */
  onStartStep?: (opId: string) => void;
  /** Opens a downtime now. */
  onPauseStep?: (opId: string) => void;
  /** Closes the open downtime. */
  onResumeStep?: (opId: string) => void;
  onFinishStep?: (opId: string) => void;
  /** Manager's status fix with a reason (not given to operators). */
  onCorrectStep?: (opId: string, status: RouteStep["status"], reason: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  piecesPerSheet?: number;
  /** The packaging step is recorded as boxes, not as shift output: it opens the packaging dialog. */
  onOpenPackaging?: () => void;
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
  onStartSetup,
  onStartStep,
  onPauseStep,
  onResumeStep,
  onFinishStep,
  onCorrectStep,
  onDeleteEvent,
  onOpenPackaging,
}: ShiftTimelineTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const hasOperation = operations.length > 0 && Boolean(selectedOp.id);
  const hasActiveRunningOp = operations.some((op) => op.status === "In Progress" || op.status === "Paused");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasActiveRunningOp) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActiveRunningOp]);
  const { totalElapsedSeconds, totalPlannedHours } = useMemo(() => {
    let elapsed = 0;
    let planned = 0;
    for (const op of operations) {
      planned += Number(op.duration) || 0;
      if (op.actualDurationMinutes != null && op.actualDurationMinutes > 0 && op.status !== "In Progress") {
        elapsed += Math.round(op.actualDurationMinutes * 60);
      } else if (op.startedAt) {
        const start = new Date(op.startedAt).getTime();
        const end = op.completedAt
          ? new Date(op.completedAt).getTime()
          : op.status === "In Progress"
          ? nowMs
          : op.pausedAt
          ? new Date(op.pausedAt).getTime()
          : start;
        if (!isNaN(start) && !isNaN(end) && end > start) {
          elapsed += Math.floor((end - start) / 1000);
        }
      }
    }
    return { totalElapsedSeconds: elapsed, totalPlannedHours: Math.round(planned * 10) / 10 };
  }, [operations, nowMs]);
  const timeRatio = totalPlannedHours > 0 ? totalElapsedSeconds / (totalPlannedHours * 3600) : 0;
  const timerBadgeClass =
    timeRatio > 1
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
      : timeRatio >= 0.85
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
      : hasActiveRunningOp
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
      : "bg-muted/50 text-muted-foreground border-border";

  const selectedTimeline = useMemo(
    () => getStepTimeline(allEvents.filter((ev) => ev.opId === selectedOp.id), nowMs),
    [allEvents, selectedOp.id, nowMs]
  );
  const selectedPhase: StepPhase = selectedTimeline.hasTransitions
    ? selectedTimeline.phase
    : legacyPhase(selectedOp);
  const openDowntimeSeconds = selectedTimeline.openDowntime?.occurredAt
    ? Math.max(0, Math.floor((nowMs - new Date(selectedTimeline.openDowntime.occurredAt).getTime()) / 1000))
    : 0;
  const { machines, workRates } = useWorkspaceStore(
    useShallow((st) => ({ machines: st.machines, workRates: st.workRates }))
  );
  const unitOf = (op: RouteStep) =>
    op.kind === "packaging"
      ? "dona"
      : stepUnit(resolveMachine(op, machines), workRates.find((w) => w.id === op.workRateId)?.unit);
  const kpis = useMemo(
    () =>
      getStepKpis(
        selectedOp,
        allEvents.filter((ev) => ev.opId === selectedOp.id),
        selectedTimeline,
        resolveMachine(selectedOp, machines),
        workRates.find((w) => w.id === selectedOp.workRateId)?.unit
      ),
    [selectedOp, allEvents, selectedTimeline, machines, workRates]
  );
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionStatus, setCorrectionStatus] = useState<RouteStep["status"]>("In Progress");
  const [correctionReason, setCorrectionReason] = useState("");

  const { completed, target } = useMemo(
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
        makeReadyPct: "0.0",
        defectPct: "0.0",
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
    const makeReadyPct =
      grossInput > 0 ? ((makeReadyTotal / grossInput) * 100).toFixed(1) : "0.0";
    const defectPct =
      grossInput > 0 ? ((defectTotal / grossInput) * 100).toFixed(1) : "0.0";
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
      makeReadyPct,
      defectPct,
      wastePct,
      percentCompleted,
      downtimeTotalMinutes: downtimeMinutesTotal,
    };
  }, [selectedOpEvents, target, completed]);

  const effectiveGrossInput =
    stepStats.grossInput > 0 ? stepStats.grossInput : completed > 0 ? completed : 0;
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
    const ordered = [...selectedOpEvents].sort((a, b) =>
      (b.occurredAt || "").localeCompare(a.occurredAt || "")
    );
    return ordered.filter((ev) => {
      const effectiveShift = ev.shift || "1-smena";
      if (shiftFilter !== "all" && effectiveShift !== shiftFilter) return false;
      if (typeFilter === "pallets" && ev.type !== "Run") return false;
      if (typeFilter === "steps" && !TRANSITION_LABEL[ev.type]) return false;
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


  const handleExportCsv = () => {
    const headers = [
      "Sana",
      "Vaqt",
      "Smena",
      "Bosqich",
      "Tavsif",
      "Turi",
      "Kirish",
      "Priladka",
      "Brak",
      "Chiqish",
      "Sabab",
      "Operator",
      "Izoh",
    ];

    const rows = filteredEvents.map((ev) => {
      const isDt = ev.type === "Delay" || ev.type === "Maintenance";
      return [
        ev.occurredAt ? plantClock(new Date(ev.occurredAt)).day : "",
        ev.time,
        ev.shift || "1-smena",
        `#${selectedOp.stepNumber} ${selectedOp.name}`,
        isDt
          ? `To'xtalish (${ev.downtimeDurationMinutes || 15}m)`
          : ev.batchLabel || ev.palletCode || "Palet",
        ev.type,
        isDt ? "" : ev.inputQty || 0,
        isDt ? "" : ev.makeReadyQty || 0,
        isDt ? "" : ev.defectQty || 0,
        isDt ? "" : ev.goodQty || 0,
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
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px] h-5 px-1.5 flex items-center gap-1",
                timerBadgeClass
              )}
            >
              <Clock className="size-3" />
              <span>{formatElapsedHMS(totalElapsedSeconds)}</span>
              {totalPlannedHours > 0 && (
                <span className="opacity-75">/ {totalPlannedHours}h</span>
              )}
            </Badge>
          </div>
        </div>

        {/* Cascade Pipeline Steps */}
        <div className="flex items-stretch gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {operations.map((op, idx) => {
            const isSelected = selectedTimelineOpId === op.id;
            const opParsed = parseQtyString(op.qtyCompleted);
            const opGoodQty = getOpGoodOutput(op);
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
                      ) : op.status === "In Progress" && op.phase === "setup" ? (
                        <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30 text-[9px] px-1.5 py-0 h-4">
                          <SlidersHorizontal className="size-2.5 mr-0.5" />
                          Sozlash
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
                      <span className="font-semibold text-foreground">
                        {opGoodQty.toLocaleString()}
                        {opParsed.target > 0
                          ? ` / ${opParsed.target.toLocaleString()}`
                          : ""}
                        <span className="font-normal text-muted-foreground"> {unitOf(op)}</span>
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
                    {target.toLocaleString()} {kpis.unit}
                  </strong>
                </span>
                {selectedTimeline.hasTransitions && (
                  <>
                    <span>·</span>
                    <span title="Sozlash / ish / to'xtalish vaqti">
                      Sozlash <strong className="text-foreground">{formatMinutes(selectedTimeline.setupMinutes)}</strong>
                      {" · "}Ish <strong className="text-foreground">{formatMinutes(selectedTimeline.runMinutes)}</strong>
                      {" · "}To&apos;xtalish{" "}
                      <strong
                        className={cn(
                          selectedTimeline.downtimeMinutes > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                        )}
                      >
                        {formatMinutes(selectedTimeline.downtimeMinutes)}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {selectedOp.kind === "packaging" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{STATUS_LABELS[selectedOp.status] || selectedOp.status}</span>
              {onOpenPackaging && (
                <Button type="button" size="sm" onClick={onOpenPackaging} className="h-8 text-xs gap-1.5">
                  <Boxes className="size-3.5" />
                  <span>Qutilar</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("h-7 px-2 text-xs font-medium", PHASE_CLASS[selectedPhase])}>
                {PHASE_LABEL[selectedPhase]}
              </Badge>

              {selectedPhase === "paused" && selectedTimeline.openDowntime && (
                <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-mono">
                  <Pause className="size-3.5" />
                  <span className="font-sans">{selectedTimeline.openDowntime.downtimeReason || "To'xtalish"}</span>
                  <span>{formatElapsedHMS(openDowntimeSeconds)}</span>
                </span>
              )}

              {selectedPhase === "queued" && onStartSetup && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStartSetup(selectedOp.id)}
                  disabled={!hasOperation}
                  className="h-8 text-xs gap-1.5"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Sozlash</span>
                </Button>
              )}

              {(selectedPhase === "queued" || selectedPhase === "setup") && onStartStep && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onStartStep(selectedOp.id)}
                  disabled={!hasOperation}
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>Ishga tushirish</span>
                </Button>
              )}

              {(selectedPhase === "setup" || selectedPhase === "run") && onPauseStep && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPauseStep(selectedOp.id)}
                  className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <Pause className="size-3.5" />
                  <span>To&apos;xtatish</span>
                </Button>
              )}

              {selectedPhase === "paused" && onResumeStep && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onResumeStep(selectedOp.id)}
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>Davom ettirish</span>
                </Button>
              )}

              {(selectedPhase === "run" || selectedPhase === "paused") && onOpenQuickPalletLog && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onOpenQuickPalletLog}
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="size-3.5" />
                  <span>Palet kiritish</span>
                </Button>
              )}

              {(selectedPhase === "run" || selectedPhase === "paused") && onFinishStep && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onFinishStep(selectedOp.id)}
                  className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Yakunlash</span>
                </Button>
              )}

              {selectedPhase !== "queued" && onOpenDowntimeLog && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenDowntimeLog}
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                  title="Tugagan to'xtalishni keyinroq yozish"
                >
                  <Wrench className="size-3.5" />
                  <span>To&apos;xtalish qayd</span>
                </Button>
              )}

              {onCorrectStep && hasOperation && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCorrectionStatus(selectedOp.status);
                    setCorrectionReason("");
                    setIsCorrectionOpen(true);
                  }}
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                >
                  <Pencil className="size-3.5" />
                  <span>Tuzatish</span>
                </Button>
              )}
            </div>
          )}
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

      {/* 3. Step indicators: plan vs fact, speed, scrap, time and OEE in the step's own unit */}
      {selectedOp.kind !== "packaging" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-border rounded-lg bg-card divide-x divide-y lg:divide-y-0 divide-border overflow-hidden">
          <KpiCell
            label="Bajarildi"
            value={`${kpis.good.toLocaleString()}${kpis.plan > 0 ? ` / ${kpis.plan.toLocaleString()}` : ""}`}
            sub={`${kpis.unit}${kpis.plan > 0 ? ` · ${pct(kpis.completion)}` : ""}`}
            bar={kpis.plan > 0 ? Math.min(1, kpis.completion) : undefined}
          />
          <KpiCell
            label="Kirish"
            value={kpis.input.toLocaleString()}
            sub={previousOpGoodOutput > 0 ? `oldingi: ${previousOpGoodOutput.toLocaleString()}` : kpis.unit}
          />
          <KpiCell
            label="Tezlik"
            value={kpis.speedPerHour !== null ? `${Math.round(kpis.speedPerHour).toLocaleString()}/soat` : "—"}
            valueClass={
              kpis.speedPerHour !== null && kpis.normPerHour
                ? TONE_TEXT[scoreTone(kpis.speedPerHour / kpis.normPerHour, 0.9, 0.7)]
                : undefined
            }
            sub={
              kpis.normPerHour
                ? `norma ${kpis.normPerHour.toLocaleString()} (${kpis.normSource === "machine" ? "uskuna" : "reja"})`
                : "norma yo'q"
            }
          />
          <KpiCell
            label="Brak"
            value={pct(kpis.scrapRate, 1)}
            valueClass={
              kpis.scrapRate !== null && kpis.scrapRate > 0.05
                ? TONE_TEXT.poor
                : kpis.scrapRate !== null && kpis.scrapRate > 0.02
                ? TONE_TEXT.fair
                : undefined
            }
            sub={`priladka ${kpis.makeReady.toLocaleString()} · brak ${kpis.defect.toLocaleString()}`}
          />
          <KpiCell
            label="Vaqt"
            value={selectedTimeline.hasTransitions ? formatMinutes(kpis.actualMinutes) : "—"}
            valueClass={
              selectedTimeline.hasTransitions && kpis.plannedMinutes > 0 && kpis.actualMinutes > kpis.plannedMinutes
                ? TONE_TEXT.poor
                : undefined
            }
            sub={`reja ${formatMinutes(kpis.plannedMinutes)}`}
          />
          <KpiCell
            label="OEE"
            value={pct(kpis.oee)}
            valueClass={TONE_TEXT[scoreTone(kpis.oee)]}
            sub={`A ${pct(kpis.availability)} · P ${pct(kpis.performance)} · Q ${pct(kpis.quality)}`}
            title="Mavjudlik × Unumdorlik × Sifat"
          />
        </div>
      )}

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
                <SelectItem value="steps" className="text-xs">
                  Holatlar
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
                  <th className="py-2 px-3 font-semibold text-right">Priladka</th>
                  <th className="py-2 px-3 font-semibold text-right">Brak</th>
                  <th className="py-2 px-3 font-semibold text-right">Chiqish</th>
                  <th className="py-2 px-3 font-semibold">Operator</th>
                  <th className="py-2 px-3 font-semibold text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEvents.map((ev) => {
                  const isDowntime = isDowntimeEvent(ev);
                  const transitionLabel = TRANSITION_LABEL[ev.type];
                  const makeReadyQty = ev.makeReadyQty || 0;
                  const defectQty =
                    ev.defectQty !== undefined
                      ? ev.defectQty
                      : !ev.makeReadyQty && ev.wasteQty
                      ? ev.wasteQty
                      : 0;
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
                          {eventDay(ev) && (
                            <span className="text-muted-foreground">{eventDay(ev)}</span>
                          )}
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
                        {transitionLabel ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            {transitionLabel}
                          </Badge>
                        ) : isDowntime ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0 h-4 font-mono">
                            <Pause className="size-2.5 mr-0.5" />
                            {isOpenDowntime(ev) ? "davom etmoqda" : `${ev.downtimeDurationMinutes} daq.`}
                          </Badge>
                        ) : defectQty > 0 ? (
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
                        {transitionLabel ? (
                          <div className="text-foreground">
                            {ev.type === "Correction" && ev.toStatus
                              ? `${STATUS_LABELS[ev.toStatus] || ev.toStatus}: ${ev.note}`
                              : ev.note || transitionLabel}
                          </div>
                        ) : isDowntime ? (
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
                        {isDowntime || transitionLabel
                          ? "—"
                          : ev.inputQty !== undefined
                          ? ev.inputQty.toLocaleString()
                          : "—"}
                      </td>

                      <td className="py-2 px-3 text-right font-mono">
                        {isDowntime || transitionLabel ? (
                          <span className="text-muted-foreground">—</span>
                        ) : makeReadyQty > 0 ? (
                          <span className="text-foreground font-medium">
                            {makeReadyQty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      <td className="py-2 px-3 text-right font-mono">
                        {isDowntime || transitionLabel ? (
                          <span className="text-muted-foreground">—</span>
                        ) : defectQty > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {defectQty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {isDowntime || transitionLabel ? (
                          "—"
                        ) : ev.goodQty !== undefined ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {ev.goodQty.toLocaleString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="size-3 text-primary shrink-0" />
                          <span
                            className="truncate max-w-[130px] text-foreground/90"
                            title={[
                              ev.createdBy ? `Yozdi: ${ev.createdBy}` : "",
                              ev.updatedBy ? `Tuzatdi: ${ev.updatedBy}` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || undefined}
                          >
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

                          {transitionLabel
                            ? null
                            : isDowntime
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

      {onCorrectStep && (
        <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
          <DialogContent className="max-w-sm p-4 gap-3">
            <DialogHeader>
              <DialogTitle className="text-sm">
                Holatni tuzatish · #{selectedOp.stepNumber} {selectedOp.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-xs">
              <Select
                value={correctionStatus}
                onValueChange={(val: string | null) => {
                  if (val === "Queued" || val === "In Progress" || val === "Paused" || val === "Finished") {
                    setCorrectionStatus(val);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue>{STATUS_LABELS[correctionStatus]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["Queued", "In Progress", "Finished"] as const).map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {STATUS_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Sabab *"
                className="h-8 text-xs"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsCorrectionOpen(false)}>
                Bekor qilish
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={!correctionReason.trim()}
                onClick={() => {
                  onCorrectStep(selectedOp.id, correctionStatus, correctionReason);
                  setIsCorrectionOpen(false);
                }}
              >
                Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </TabsContent>
  );
}

function KpiCell({
  label,
  value,
  sub,
  valueClass,
  bar,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  /** 0..1 progress shown under the value. */
  bar?: number;
  title?: string;
}) {
  return (
    <div className="px-3 py-2 min-w-0" title={title}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold font-mono leading-tight mt-0.5 truncate", valueClass || "text-foreground")}>
        {value}
      </div>
      {bar !== undefined && (
        <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
          <div className="h-full bg-primary" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
      {sub && <div className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}
