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
import { RouteStep, ShiftEvent } from "../types";
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
    shift: "1-smena" | "2-smena";
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
  }) => void;
  onOpenPrintTag?: (event: ShiftEvent) => void;
}

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
  onOpenPrintTag,
}: PalletReportDialogProps) {
  // Current time default
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Next pallet number
  const nextPalletNum = useMemo(() => {
    return existingOpEvents.length + 1;
  }, [existingOpEvents]);

  // Determine counting mode
  const isTheoretical = selectedOp.countingMode === "theoretical" || /kesish|gilotin|cutter|ctp|prepress/i.test(selectedOp.name);
  const isMultipiece = selectedOp.countingMode === "multipiece" || /shtamp|die-cut|tigel|qadoq|pack/i.test(selectedOp.name);
  const multiplier = selectedOp.multiplier || (isMultipiece && piecesPerSheet > 1 ? piecesPerSheet : 1);

  // Suggested default input quantity from previous step or planned target
  const suggestedInputQty = useMemo(() => {
    if (previousOpGoodOutput > 0) {
      // Calculate how much input already logged for this step
      const alreadyInput = existingOpEvents.reduce((sum, ev) => sum + (ev.inputQty || 0), 0);
      const remaining = Math.max(0, previousOpGoodOutput - alreadyInput);
      return remaining > 0 ? remaining : previousOpGoodOutput;
    }
    // Fallback: parse target from qtyCompleted
    const match = (selectedOp.qtyCompleted || "").match(/\/s*([d,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ""), 10) || 1000;
    }
    return 1000;
  }, [previousOpGoodOutput, existingOpEvents, selectedOp.qtyCompleted]);

  const employees = useWorkspaceStore((s) => s.employees);

  useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.employees.length === 0 && s.loadEmployees) {
      s.loadEmployees();
    }
  }, [isOpen]);

  // Form states
  const [shift, setShift] = useState<"1-smena" | "2-smena">("1-smena");
  const [batchLabel, setBatchLabel] = useState<string>(`Palet #${nextPalletNum}`);
  const [selectedOperator, setSelectedOperator] = useState<string>(selectedOp.operator || "");
  const [inputQty, setInputQty] = useState<number>(suggestedInputQty);
  const [makeReadyQty, setMakeReadyQty] = useState<number>(0);
  const [defectQty, setDefectQty] = useState<number>(0);
  const [wasteReason, setWasteReason] = useState<string>("");
  const [time, setTime] = useState<string>(defaultTime);
  const [customGoodQty, setCustomGoodQty] = useState<number | null>(null);

  // Synchronize when opening
  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        setBatchLabel(editingEvent.batchLabel || `Palet #${existingOpEvents.length}`);
        setShift(editingEvent.shift || "1-smena");
        setInputQty(editingEvent.inputQty || 0);
        setMakeReadyQty(editingEvent.makeReadyQty || 0);
        setDefectQty(editingEvent.defectQty || 0);
        setWasteReason(editingEvent.wasteReason || "");
        setTime(editingEvent.time || defaultTime);
        setCustomGoodQty(editingEvent.goodQty ?? null);
        setSelectedOperator(editingEvent.operator || selectedOp.operator || employees[0]?.fullName || "");
      } else {
        setBatchLabel(`Palet #${existingOpEvents.length + 1}`);
        setInputQty(suggestedInputQty);
        setMakeReadyQty(0);
        setDefectQty(0);
        setWasteReason("");
        setCustomGoodQty(null);
        setSelectedOperator(selectedOp.operator || employees[0]?.fullName || "");
      }
    }
  }, [isOpen, editingEvent, existingOpEvents.length, suggestedInputQty, selectedOp.operator, defaultTime, employees]);

  // Net good output calculation
  const calculatedGoodQty = useMemo(() => {
    if (customGoodQty !== null) return customGoodQty;
    const net = Math.max(0, inputQty - (makeReadyQty + defectQty));
    return net;
  }, [customGoodQty, inputQty, makeReadyQty, defectQty]);

  // Output pieces (if multi-piece)
  const outputPieces = useMemo(() => {
    return calculatedGoodQty * multiplier;
  }, [calculatedGoodQty, multiplier]);

  // Total waste
  const totalWaste = makeReadyQty + defectQty;
  const wastePercent = inputQty > 0 ? ((totalWaste / inputQty) * 100).toFixed(1) : "0.0";

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

  const handleSave = (markStepFinished: boolean) => {
    const noteText = isMultipiece && multiplier > 1
      ? `[${batchLabel}] Kirish: ${inputQty.toLocaleString()} l. | Priladka: ${makeReadyQty} | Brak: ${defectQty} | Sof: ${calculatedGoodQty.toLocaleString()} l. (${outputPieces.toLocaleString()} dona)`
      : `[${batchLabel}] Kirish: ${inputQty.toLocaleString()} l. | Priladka: ${makeReadyQty} | Brak: ${defectQty} | Chiqish: ${calculatedGoodQty.toLocaleString()} l.`;

    onSaveEvent({
      eventId: editingEvent?.id,
      batchLabel,
      shift,
      operator: selectedOperator,
      inputQty,
      makeReadyQty,
      defectQty,
      goodQty: calculatedGoodQty,
      outputPiecesQty: isMultipiece && multiplier > 1 ? outputPieces : undefined,
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
                <SelectValue>
                  {shift === "1-smena" ? "1-smena (Kun)" : "2-smena (Tun)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-smena" className="text-xs">1-smena (Kun)</SelectItem>
                <SelectItem value="2-smena" className="text-xs">2-smena (Tun)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {/* Discrepancy Warning Banner */}
          {previousOpGoodOutput > 0 && inputQty > previousOpGoodOutput && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-700 dark:text-rose-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                <span className="text-[11px] font-semibold">
                  Hajm tafovuti (Discrepancy Warning): Kirayotgan miqdor oldingi bosqich toza qoldig&apos;idan ({previousOpGoodOutput.toLocaleString()} list) ko&apos;p!
                </span>
              </div>
              <span className="font-mono text-xs font-bold shrink-0">
                +{(inputQty - previousOpGoodOutput).toLocaleString()} list ortiqcha
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
                {previousOpGoodOutput > 0 ? `${previousOpGoodOutput.toLocaleString()} yaroqli list` : "Kutilmoqda"}
              </div>
            </div>
          )}

          {isTheoretical && (
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
              <label className="text-[11px] font-medium text-muted-foreground">Partiya / Palet Nomi</label>
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

            {/* Enlarged 3-Column Calculator */}
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
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">
                    (Brutto)
                  </span>
                </div>
                <div className="relative flex items-center mt-0.5">
                  <Input
                    type="number"
                    value={inputQty === 0 ? "" : inputQty}
                    onChange={(e) => {
                      setInputQty(parseInt(e.target.value, 10) || 0);
                      setCustomGoodQty(null);
                    }}
                    className="h-12 text-2xl font-mono font-bold pl-3 pr-11 text-foreground bg-background border-input tracking-tight"
                    placeholder="0"
                  />
                  <span className="absolute right-3 text-xs font-semibold font-mono text-muted-foreground pointer-events-none uppercase">
                    list
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight truncate">
                  {previousOpGoodOutput > 0
                    ? `Oldingi: ${previousOpGoodOutput.toLocaleString()} l.`
                    : "Jarayonga kirgan umumiy qog'oz"}
                </span>
              </div>

              {/* 2. Sozlash (Priladka) */}
              <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-mono font-bold">
                      2
                    </span>
                    Priladka
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-amber-700/80 dark:text-amber-400/80 uppercase">
                    Sozlash
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
                    list
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
                    list
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
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                  <span>{inputQty.toLocaleString()} kirish</span>
                  <span className="text-muted-foreground/60">−</span>
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">{makeReadyQty.toLocaleString()} priladka</span>
                  <span className="text-muted-foreground/60">−</span>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">{defectQty.toLocaleString()} brak</span>
                  <span className="text-muted-foreground/60">=</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{calculatedGoodQty.toLocaleString()} list</strong>
                </div>
              </div>

              <div className="text-right shrink-0 pl-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400 leading-none tracking-tight">
                  {calculatedGoodQty.toLocaleString()}{" "}
                  <span className="text-xs sm:text-sm font-semibold text-emerald-700/80 dark:text-emerald-400/80 uppercase">
                    list
                  </span>
                </div>
                {isMultipiece && multiplier > 1 && (
                  <div className="text-xs font-mono font-bold text-primary mt-1 flex items-center justify-end gap-1">
                    <Package className="w-3.5 h-3.5 inline" />
                    <span>= {outputPieces.toLocaleString()} dona tayyor</span>
                  </div>
                )}
              </div>
            </div>

            {/* Multi-piece conversion hint (Kesish / Tigel uchun) */}
            {isMultipiece && multiplier > 1 && (
              <div className="p-2 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span>1 list = {multiplier} dona mahsulot (Imposition layout)</span>
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
              className="h-8 text-xs border-border bg-card hover:bg-muted font-medium cursor-pointer shrink-0"
            >
              Partiyani saqlash (Davom etadi)
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSave(true)}
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
