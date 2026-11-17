"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  ArrowRight,
  TrendingDown,
  Info,
  Package,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { QtySource, RouteStep, ShiftEvent } from "../types";
import { DEFAULT_SHIFTS, plantClock, shiftAt, type ShiftInterval } from "@/lib/shiftSchedule";
import { COUNTER_NOTE_RE, lastCounterReading, type CountingProfile } from "../utils/countingProfile";

type ShiftName = NonNullable<ShiftEvent["shift"]>;
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

interface PalletReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOp: RouteStep;
  allOperations: RouteStep[];
  previousOp?: RouteStep;
  previousOpGoodOutput?: number; // Previous step's good output sheets
  existingOpEvents: ShiftEvent[];
  piecesPerSheet?: number;
  editingEvent?: ShiftEvent | null;
  onSaveEvent: (eventData: {
    eventId?: string;
    batchLabel: string;
    shift: ShiftName;
    operator: string;
    inputQty: number;
    makeReadyQty: number;
    defectQty: number;
    goodQty: number;
    outputPiecesQty?: number;
    wasteReason?: string;
    time: string;
    note: string;
    markStepFinished?: boolean;
    /** How the quantities were obtained; estimated and derived ones are not counted facts. */
    qtySource: QtySource;
  }) => void;
  /** Plant shifts: the current one is preselected. */
  shiftSchedule?: ShiftInterval[];
  /** Unit the step counts in (varaq, metr, zarba, dona...). */
  unit?: string;
  /** How this technology counts (pallet of sheets, roll of metres, box of pieces). */
  profile?: CountingProfile;
}

const QTY_SOURCE_LABEL: Record<QtySource, string> = {
  counter: "Hisoblagich",
  counted: "Sanaldi",
  estimated: "Taxminiy",
  derived: "Noma'lum",
};

const DEFECT_REASON_OPTIONS: ComboboxItem[] = [
  { value: "Rang og'ishi / Noto'g'ri rang", label: "Rang og'ishi / Noto'g'ri rang (Color Shift)", badge: "Press" },
  { value: "Stanok qisishi / Jam", label: "Stanok qisishi / Jam (Machine Jam)", badge: "Press" },
  { value: "Qog'oz nuqsoni / To'lqinlanish", label: "Qog'oz nuqsoni (Substrate Defect)", badge: "Material" },
  { value: "Pichoq siljishi / Shtamp nuqsoni", label: "Pichoq siljishi (Die-cut Shift)", badge: "Finishing" },
  { value: "Laminatsiya pufagi / Ajralish", label: "Laminatsiya nuqsoni (Delamination)", badge: "Finishing" },
  { value: "Bo'yoq surkalishi / Dog'", label: "Bo'yoq surkalishi (Ink Set-off)", badge: "Press" },
  { value: "Boshqa texnik sabab", label: "Boshqa texnik sabab", badge: "Umumiy" },
];

export function PalletReportDialog({
  isOpen,
  onOpenChange,
  selectedOp,
  allOperations,
  previousOp,
  previousOpGoodOutput = 0,
  existingOpEvents,
  piecesPerSheet = 1,
  editingEvent = null,
  onSaveEvent,
  shiftSchedule = DEFAULT_SHIFTS,
  unit: unitProp = "varaq",
  profile,
}: PalletReportDialogProps) {
  const unit = profile?.unit || unitProp;
  const container = profile?.container || "Palet";
  // Plant clock: current time and the shift it falls in.
  const shiftOptions = shiftSchedule.length > 0 ? shiftSchedule : DEFAULT_SHIFTS;
  const defaultTime = plantClock(new Date()).time;
  const defaultShift = shiftAt(defaultTime, shiftOptions) as ShiftName;

  // Next pallet number
  const nextPalletNum = useMemo(() => {
    return existingOpEvents.length + 1;
  }, [existingOpEvents]);

  // Determine counting mode
  const isTheoretical = selectedOp.countingMode === "theoretical" || /kesish|gilotin|cutter|ctp|prepress/i.test(selectedOp.name);
  const isMultipiece = selectedOp.countingMode === "multipiece" || /shtamp|die-cut|tigel|qadoq|pack/i.test(selectedOp.name);
  const multiplier =
    profile && profile.piecesPerUnit > 1
      ? profile.piecesPerUnit
      : selectedOp.multiplier || (isMultipiece && piecesPerSheet > 1 ? piecesPerSheet : 1);
  const showPieces = multiplier > 1;

  // What the previous step handed over and this step has not taken in yet. Never the plan:
  // a target is not a count, and saving it would book it as fact.
  const suggestedInputQty = useMemo(() => {
    if (previousOpGoodOutput <= 0) return 0;
    const alreadyInput = existingOpEvents.reduce((sum, ev) => sum + (ev.inputQty || 0), 0);
    const remaining = Math.max(0, previousOpGoodOutput - alreadyInput);
    return remaining > 0 ? remaining : previousOpGoodOutput;
  }, [previousOpGoodOutput, existingOpEvents]);

  // What the previous step has produced and this step has not taken in yet.
  const availableFromPrevious =
    previousOpGoodOutput > 0
      ? Math.max(
          0,
          previousOpGoodOutput -
            existingOpEvents
              .filter((ev) => ev.id !== editingEvent?.id)
              .reduce((sum, ev) => sum + (ev.inputQty || 0), 0)
        )
      : null;

  const employees = useWorkspaceStore((s) => s.employees);

  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.employees.length === 0 && s.loadEmployees) {
      s.loadEmployees();
    }
  }, [isOpen]);

  // Form states
  const [shift, setShift] = useState<ShiftName>(defaultShift);
  const [batchLabel, setBatchLabel] = useState<string>(`${container} #${nextPalletNum}`);
  const [selectedOperator, setSelectedOperator] = useState<string>(selectedOp.operator || "");
  const [inputQty, setInputQty] = useState<number>(suggestedInputQty);
  const [makeReadyQty, setMakeReadyQty] = useState<number>(0);
  const [defectQty, setDefectQty] = useState<number>(0);
  const [wasteReason, setWasteReason] = useState<string>("");
  const [time, setTime] = useState<string>(defaultTime);
  const [customGoodQty, setCustomGoodQty] = useState<number | null>(null);
  const [counterStart, setCounterStart] = useState<number>(0);
  const [counterEnd, setCounterEnd] = useState<number>(0);
  const useCounter = Boolean(profile?.counter);
  const defaultSource: QtySource = useCounter ? "counter" : "counted";
  const [qtySource, setQtySource] = useState<QtySource>(defaultSource);
  /** Input unknown ("derived"): the operator counts the good stack, the input is the sum. */
  const [goodInput, setGoodInput] = useState<number>(0);
  const isDerived = qtySource === "derived";
  const sourceOptions: QtySource[] = useCounter
    ? ["counter", "counted", "estimated", "derived"]
    : ["counted", "estimated", "derived"];
  const applyCounter = (start: number, end: number) => {
    setCounterStart(start);
    setCounterEnd(end);
    setCustomGoodQty(null);
  };
  // Counter mode: the input is the difference of the two readings, nothing typed by hand.
  const isCounter = qtySource === "counter";
  const counterDelta = counterEnd > counterStart ? counterEnd - counterStart : 0;
  const counterInvalid = isCounter && counterEnd > 0 && counterEnd <= counterStart;

  // Synchronize when opening
  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        setBatchLabel(editingEvent.batchLabel || `${container} #${existingOpEvents.length}`);
        setShift(editingEvent.shift || defaultShift);
        setInputQty(editingEvent.inputQty || 0);
        setMakeReadyQty(editingEvent.makeReadyQty || 0);
        setDefectQty(editingEvent.defectQty || 0);
        setWasteReason(editingEvent.wasteReason || "");
        setTime(editingEvent.time || defaultTime);
        setCustomGoodQty(editingEvent.goodQty ?? null);
        setQtySource(editingEvent.qtySource || defaultSource);
        setGoodInput(editingEvent.qtySource === "derived" ? editingEvent.goodQty || 0 : 0);
        const readings = (editingEvent.note || "").match(COUNTER_NOTE_RE);
        setCounterStart(readings ? parseInt(readings[1].replace(/[^\d]/g, ""), 10) || 0 : 0);
        setCounterEnd(readings ? parseInt(readings[2].replace(/[^\d]/g, ""), 10) || 0 : 0);
        setSelectedOperator(editingEvent.operator || selectedOp.operator || employees[0]?.fullName || "");
      } else {
        setBatchLabel(`${container} #${existingOpEvents.length + 1}`);
        setCounterStart(lastCounterReading(existingOpEvents.map((ev) => ev.note)) ?? 0);
        setCounterEnd(0);
        setShift(defaultShift);
        setTime(defaultTime);
        setInputQty(suggestedInputQty);
        setMakeReadyQty(0);
        setDefectQty(0);
        setWasteReason("");
        setCustomGoodQty(null);
        setQtySource(defaultSource);
        setGoodInput(0);
        setSelectedOperator(selectedOp.operator || employees[0]?.fullName || "");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens or the edited entry changes
  }, [isOpen, editingEvent, existingOpEvents.length, suggestedInputQty, selectedOp.operator, employees]);

  // Net good output calculation
  // Input as reported: the counter difference, or what the operator entered.
  const baseInput = isCounter ? counterDelta : inputQty;
  const calculatedGoodQty = useMemo(() => {
    if (isDerived) return goodInput;
    if (customGoodQty !== null && !isCounter) return customGoodQty;
    return Math.max(0, baseInput - (makeReadyQty + defectQty));
  }, [isDerived, isCounter, goodInput, customGoodQty, baseInput, makeReadyQty, defectQty]);

  // Unknown input is rebuilt from what was counted.
  const effectiveInput = isDerived ? goodInput + makeReadyQty + defectQty : baseInput;

  // Output pieces (if multi-piece)
  const outputPieces = useMemo(() => {
    return calculatedGoodQty * multiplier;
  }, [calculatedGoodQty, multiplier]);

  // Total waste
  const totalWaste = makeReadyQty + defectQty;
  const wastePercent = effectiveInput > 0 ? ((totalWaste / effectiveInput) * 100).toFixed(1) : "0.0";

  // Operator list combining step operators + active HR employees
  const quickOperators = useMemo(() => {
    const list: string[] = [];
    if (selectedOp.operators && selectedOp.operators.length > 0) {
      selectedOp.operators.forEach((op) => {
        if (op && !list.includes(op)) list.push(op);
      });
    }
    if (selectedOp.operator) {
      selectedOp.operator
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((op) => {
          if (!list.includes(op)) list.push(op);
        });
    }
    return list;
  }, [selectedOp]);

  const allAvailableOperators = useMemo(() => {
    const list = [...quickOperators];
    if (Array.isArray(employees)) {
      employees.forEach((emp) => {
        if (emp.status !== "terminated" && emp.fullName && !list.includes(emp.fullName)) {
          list.push(emp.fullName);
        }
      });
    }
    return list;
  }, [quickOperators, employees]);

  // Helper to extract initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "OP";
    const clean = name.replace(/\(.*?\)/g, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const overInput = availableFromPrevious !== null && effectiveInput > availableFromPrevious;
  // Nothing to book until something was counted (or estimated).
  const missingQty = isDerived ? goodInput <= 0 : baseInput <= 0;
  // Waste cannot exceed what went in.
  const wasteOverInput = !isDerived && baseInput > 0 && makeReadyQty + defectQty > baseInput;
  const cannotSave = overInput || missingQty || counterInvalid || wasteOverInput;

  const handleSave = (markStepFinished: boolean) => {
    if (cannotSave) return;
    const counterText =
      useCounter && counterEnd > counterStart
        ? ` | Hisoblagich: ${counterStart.toLocaleString()} → ${counterEnd.toLocaleString()}`
        : "";
    const sourceText =
      qtySource === "estimated" ? " (taxminiy)" : qtySource === "derived" ? " (hisoblangan)" : "";
    const noteText =
      `[${batchLabel}] Kirish: ${effectiveInput.toLocaleString()} ${unit}${sourceText} | ${profile?.makeReadyLabel || "Priladka"}: ${makeReadyQty} | Brak: ${defectQty} | Chiqish: ${calculatedGoodQty.toLocaleString()} ${unit}` +
      (showPieces ? ` (${outputPieces.toLocaleString()} dona)` : "") +
      (qtySource === "counter" ? counterText : "");

    onSaveEvent({
      eventId: editingEvent?.id,
      batchLabel,
      shift,
      operator: selectedOperator,
      inputQty: effectiveInput,
      makeReadyQty,
      defectQty,
      goodQty: calculatedGoodQty,
      qtySource,
      outputPiecesQty: showPieces ? outputPieces : undefined,
      wasteReason: defectQty > 0 ? wasteReason : undefined,
      time,
      note: noteText,
      markStepFinished,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] w-full max-h-[90vh] flex flex-col p-0 text-xs gap-0 overflow-hidden border border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="shrink-0 p-3.5 bg-muted/40 border-b border-border">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span>{editingEvent ? "Palet tahrirlash" : "Palet kiritish"}</span>
                  <Badge variant="outline" className="font-mono text-[10px] py-0 h-4">
                    #{selectedOp.stepNumber}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {selectedOp.name}
                </DialogDescription>
              </div>
            </div>

            <Select value={shift} onValueChange={(val: any) => { if (val) setShift(val); }}>
              <SelectTrigger className="h-7 text-xs w-[115px] bg-background font-medium">
                <SelectValue>{shift}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {shiftOptions.map((sh) => (
                  <SelectItem key={sh.name} value={sh.name} className="text-xs">
                    {sh.name} ({sh.start}–{sh.end})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {/* Discrepancy Warning Banner */}
          {availableFromPrevious !== null && effectiveInput > availableFromPrevious && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-700 dark:text-rose-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                <span className="text-[11px] font-semibold">
                  Kirish oldingi bosqich qoldig&apos;idan ({availableFromPrevious.toLocaleString()}) ko&apos;p
                </span>
              </div>
              <span className="font-mono text-xs font-bold shrink-0">
                +{(effectiveInput - availableFromPrevious).toLocaleString()}
              </span>
            </div>
          )}
          {/* Cascade Context Banner (Previous Step Good Output Link) */}
          {previousOp && (
            <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="text-[11px]">
                  <span className="text-muted-foreground">Oldingi bosqichdan qabul: </span>
                  <strong className="text-foreground">{previousOp.name}</strong>
                </div>
              </div>
              <div className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-400">
                {previousOpGoodOutput > 0 ? `${previousOpGoodOutput.toLocaleString()} yaroqli ${unit}` : "Kutilmoqda"}
              </div>
            </div>
          )}

          {isTheoretical && (!profile || profile.kind === "sheet") && (
            <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px]">
                Gilotina / CTP bosqichi uchun hisoblagich datchiksiz (nazariy hisob). Haqiqiy aniq fakt hisobi Ofset bosma hisoblagichidan boshlanadi.
              </span>
            </div>
          )}

          {/* Row 1: Pallet Label, Time & Responsible Operator */}
          <div className="grid grid-cols-12 gap-2.5 items-center">
            <div className="col-span-5 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">{container}</label>
              <Input
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                className="h-8 text-xs font-mono font-semibold"
                placeholder="e.g. Palet #1"
              />
            </div>

            <div className="col-span-3 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Vaqt</label>
              <Input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="15:30"
              />
            </div>

            <div className="col-span-4 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Mas&apos;ul Operator</label>
              <Select value={selectedOperator} onValueChange={(val) => { if (val) setSelectedOperator(val); }}>
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue>{selectedOperator || "Operator tanlang"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {allAvailableOperators.map((op) => (
                    <SelectItem key={op} value={op} className="text-xs">
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Operator Selection (Larger cards with Avatar) */}
          {quickOperators.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Biriktirilgan Operatorlar (Tezkor tanlash):</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Tanlangan: <strong className="text-foreground">{selectedOperator}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickOperators.map((op) => {
                  const isActive = selectedOperator === op;
                  const initials = getInitials(op);

                  return (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setSelectedOperator(op)}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5 relative select-none",
                        isActive
                          ? "bg-primary/10 border-primary text-foreground shadow-xs ring-1 ring-primary"
                          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <Avatar
                        className={cn(
                          "size-8 text-[11px] font-bold border transition-colors",
                          isActive
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-foreground"
                        )}
                      >
                        <AvatarFallback
                          className={cn(
                            "size-full flex items-center justify-center font-mono font-bold",
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          )}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate leading-tight text-foreground">
                          {op}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {isActive ? "Hozir mas'ul" : "Smena operatori"}
                        </div>
                      </div>

                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Floor Quantities Panel (Main Operator Calculator - Enlarged & Prominent) */}
          <div className="p-3.5 rounded-xl border border-border bg-card/70 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">Qog&apos;oz Harakati va Isrof Balansi</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">
                  Isrof / Brak ulushi:
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-xs font-bold px-2 py-0.5",
                    Number(wastePercent) > 5
                      ? "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                      : "border-border text-foreground bg-muted"
                  )}
                >
                  {wastePercent}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0">Kirgan</span>
              <div className="flex rounded-md border border-border bg-muted/40 p-0.5">
                {sourceOptions.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      setQtySource(src);
                      setCustomGoodQty(null);
                    }}
                    className={cn(
                      "h-6 px-2.5 rounded text-[11px] font-medium cursor-pointer",
                      qtySource === src ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {QTY_SOURCE_LABEL[src]}
                  </button>
                ))}
              </div>
            </div>

            {/* Enlarged 3-Column Calculator */}
            {isCounter && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Hisoblagich boshi</label>
                    <Input
                      type="number"
                      value={counterStart === 0 ? "" : counterStart}
                      onChange={(e) => applyCounter(parseInt(e.target.value, 10) || 0, counterEnd)}
                      className="h-10 text-base font-mono font-semibold"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Hisoblagich oxiri</label>
                    <Input
                      type="number"
                      autoFocus
                      value={counterEnd === 0 ? "" : counterEnd}
                      onChange={(e) => applyCounter(counterStart, parseInt(e.target.value, 10) || 0)}
                      className={cn("h-10 text-base font-mono font-semibold", counterInvalid && "border-destructive")}
                      placeholder="0"
                    />
                  </div>
                </div>
                {counterInvalid && (
                  <div className="text-[11px] text-destructive">Oxiri boshidan katta bo&apos;lishi kerak</div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Kirgan qog'oz */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-background shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                    <span className="w-4 h-4 rounded-full bg-muted border border-border/80 flex items-center justify-center text-[10px] font-mono font-bold">
                      1
                    </span>
                    Kirgan
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono font-semibold uppercase",
                      qtySource === "estimated" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    )}
                  >
                    {qtySource === "estimated" ? "Taxminiy" : isDerived ? "Hisoblangan" : isCounter ? "Hisoblagich" : "(Brutto)"}
                  </span>
                </div>
                <div className="relative flex items-center mt-0.5">
                  <Input
                    type="number"
                    value={isDerived || isCounter ? (effectiveInput === 0 ? "" : effectiveInput) : inputQty === 0 ? "" : inputQty}
                    readOnly={isDerived || isCounter}
                    tabIndex={isDerived || isCounter ? -1 : undefined}
                    onChange={(e) => {
                      setInputQty(parseInt(e.target.value, 10) || 0);
                      setCustomGoodQty(null);
                    }}
                    className={cn(
                      "h-12 text-2xl font-mono font-bold pl-3 pr-11 bg-background border-input tracking-tight",
                      isDerived || isCounter ? "text-muted-foreground bg-muted/40 border-dashed" : "text-foreground"
                    )}
                    placeholder={isDerived || isCounter ? "—" : "0"}
                  />
                  <span className="absolute right-3 text-xs font-semibold font-mono text-muted-foreground pointer-events-none uppercase">
                    {unit}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight truncate">
                  {isDerived
                    ? "Yaroqli + priladka + brak"
                    : qtySource === "estimated"
                    ? "Vazn yoki taxlam balandligi bo'yicha"
                    : previousOpGoodOutput > 0
                    ? `Oldingi: ${previousOpGoodOutput.toLocaleString()} ${unit}`
                    : isCounter
                    ? "Oxiri − boshi"
                    : "Jarayonga kirgan umumiy miqdor"}
                </span>
              </div>

              {/* 2. Sozlash (Priladka) */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-mono font-bold">
                      2
                    </span>
                    {profile?.makeReadyLabel || "Priladka"}
                  </span>
                </div>
                <div className="relative flex items-center mt-0.5">
                  <Input
                    type="number"
                    value={makeReadyQty === 0 ? "" : makeReadyQty}
                    onChange={(e) => {
                      setMakeReadyQty(parseInt(e.target.value, 10) || 0);
                      setCustomGoodQty(null);
                    }}
                    className="h-12 text-2xl font-mono font-bold pl-3 pr-11 text-amber-700 dark:text-amber-300 bg-background border-amber-500/40 focus-visible:ring-amber-500 tracking-tight"
                    placeholder="0"
                  />
                  <span className="absolute right-3 text-xs font-semibold font-mono text-amber-700/80 dark:text-amber-400 pointer-events-none uppercase">
                    {unit}
                  </span>
                </div>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-tight">
                  Mashinani to&apos;g&apos;irlash isrofi
                </span>
              </div>

              {/* 3. Ishlab chiqarish braki */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.04] shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <span className="w-4 h-4 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-[10px] font-mono font-bold">
                      3
                    </span>
                    Jarayon Braki
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-rose-600/80 dark:text-rose-400/80 uppercase">
                    Brak
                  </span>
                </div>
                <div className="relative flex items-center mt-0.5">
                  <Input
                    type="number"
                    value={defectQty === 0 ? "" : defectQty}
                    onChange={(e) => {
                      setDefectQty(parseInt(e.target.value, 10) || 0);
                      setCustomGoodQty(null);
                    }}
                    className="h-12 text-2xl font-mono font-bold pl-3 pr-11 text-rose-600 dark:text-rose-400 bg-background border-rose-500/40 focus-visible:ring-rose-500 tracking-tight"
                    placeholder="0"
                  />
                  <span className="absolute right-3 text-xs font-semibold font-mono text-rose-600/80 dark:text-rose-400 pointer-events-none uppercase">
                    {unit}
                  </span>
                </div>
                <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 leading-tight">
                  Nuqson va texnik brak
                </span>
              </div>
            </div>

            {/* Waste Reason Selection (if defect > 0) */}
            {defectQty > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <label className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">
                  Brak sababi (Defect Reason) *
                </label>
                <SmartCombobox
                  value={wasteReason}
                  onChange={setWasteReason}
                  options={DEFECT_REASON_OPTIONS}
                  placeholder="Brak sababini tanlang..."
                  searchPlaceholder="Qidirish yoki sabab yozish..."
                  allowCustom={true}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {wasteOverInput && (
              <div className="text-[11px] text-destructive">Priladka va brak kirgan miqdordan ko&apos;p</div>
            )}

            {/* Result Hero Card: Good Output (Prominent & Clear) */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/35 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold text-emerald-700 dark:text-emerald-400 tracking-wider">
                    Sof Yaroqli Chiqish (Topshiriladigan)
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0 h-4 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-mono">
                    Net Output
                  </Badge>
                </div>
                {isDerived ? (
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                    <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{goodInput.toLocaleString()} yaroqli</strong>
                    <span className="text-muted-foreground/60">+</span>
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{makeReadyQty.toLocaleString()} priladka</span>
                    <span className="text-muted-foreground/60">+</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{defectQty.toLocaleString()} brak</span>
                    <span className="text-muted-foreground/60">=</span>
                    <span>{effectiveInput.toLocaleString()} kirish</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                    <span>{baseInput.toLocaleString()} kirish</span>
                    <span className="text-muted-foreground/60">−</span>
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{makeReadyQty.toLocaleString()} priladka</span>
                    <span className="text-muted-foreground/60">−</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{defectQty.toLocaleString()} brak</span>
                    <span className="text-muted-foreground/60">=</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{calculatedGoodQty.toLocaleString()} {unit}</strong>
                  </div>
                )}
              </div>

              <div className="text-right shrink-0 pl-3">
                {isDerived ? (
                  <div className="relative flex items-center w-44">
                    <Input
                      type="number"
                      autoFocus
                      value={goodInput === 0 ? "" : goodInput}
                      onChange={(e) => setGoodInput(parseInt(e.target.value, 10) || 0)}
                      className="h-12 text-2xl font-mono font-bold pl-3 pr-14 text-emerald-700 dark:text-emerald-400 bg-background border-emerald-500/40 focus-visible:ring-emerald-500 tracking-tight"
                      placeholder="0"
                    />
                    <span className="absolute right-3 text-xs font-semibold font-mono text-emerald-700/80 dark:text-emerald-400 pointer-events-none uppercase">
                      {unit}
                    </span>
                  </div>
                ) : (
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400 leading-none tracking-tight">
                    {qtySource === "estimated" && "~"}
                    {calculatedGoodQty.toLocaleString()}{" "}
                    <span className="text-xs sm:text-sm font-semibold text-emerald-700/80 dark:text-emerald-400/80 uppercase">
                      {unit}
                    </span>
                  </div>
                )}
                {showPieces && (
                  <div className="text-xs font-mono font-bold text-primary mt-1 flex items-center justify-end gap-1">
                    <Package className="w-3.5 h-3.5 inline" />
                    <span>= {outputPieces.toLocaleString()} dona tayyor</span>
                  </div>
                )}
              </div>
            </div>

            {/* Multi-piece conversion hint (Kesish / Tigel uchun) */}
            {showPieces && (
              <div className="p-2 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span>1 {unit} = {multiplier} dona mahsulot</span>
                </span>
                <span className="font-semibold text-foreground">
                  {outputPieces.toLocaleString()} dona
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="m-0 p-3 sm:p-3 bg-muted/40 border-t border-border flex sm:flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer shrink-0"
          >
            Bekor qilish
          </Button>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={cannotSave}
              className="h-8 text-xs border-border bg-card hover:bg-muted font-medium cursor-pointer shrink-0"
            >
              Partiyani saqlash (Davom etadi)
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={cannotSave}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Bosqichni Yakunlash</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
