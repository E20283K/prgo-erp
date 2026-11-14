"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  User,
  Wrench,
  FileText,
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
import { RouteStep, ShiftEvent, DOWNTIME_REASONS, FLOOR_OPERATORS } from "../types";
import { DEFAULT_SHIFTS, plantClock, shiftAt, type ShiftInterval } from "@/lib/shiftSchedule";

type ShiftName = NonNullable<ShiftEvent["shift"]>;

interface DowntimeLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOp: RouteStep;
  editingDowntime?: ShiftEvent | null;
  onSaveDowntime: (data: {
    eventId?: string;
    opId: string;
    shift: ShiftName;
    downtimeReason: string;
    durationMinutes: number;
    operator: string;
    note: string;
    time: string;
    /** The step stops now; the length is measured until it resumes. */
    open: boolean;
  }) => void;
  /** open: stop the step now (reason only). record: a downtime that already ended, with its length. */
  mode?: "open" | "record";
  /** Plant shifts: the current one is preselected. */
  shiftSchedule?: ShiftInterval[];
}

export function DowntimeLogDialog({
  isOpen,
  onOpenChange,
  selectedOp,
  editingDowntime = null,
  onSaveDowntime,
  shiftSchedule = DEFAULT_SHIFTS,
  mode = "record",
}: DowntimeLogDialogProps) {
  const isOpenMode = mode === "open";
  const shiftOptions = shiftSchedule.length > 0 ? shiftSchedule : DEFAULT_SHIFTS;
  const defaultTime = plantClock(new Date()).time;
  const defaultShift = shiftAt(defaultTime, shiftOptions) as ShiftName;

  const operatorOptions = useMemo(() => {
    const list = [...FLOOR_OPERATORS];
    if (selectedOp.operator && !list.includes(selectedOp.operator)) {
      list.unshift(selectedOp.operator);
    }
    if (selectedOp.operators) {
      selectedOp.operators.forEach((op) => {
        if (op && !list.includes(op)) list.unshift(op);
      });
    }
    return list;
  }, [selectedOp.operator, selectedOp.operators]);

  const [shift, setShift] = useState<ShiftName>(defaultShift);
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>(
    DOWNTIME_REASONS[0].code
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    DOWNTIME_REASONS[0].defaultDurationMinutes
  );
  const [operator, setOperator] = useState<string>(
    selectedOp.operator || FLOOR_OPERATORS[0]
  );
  const [time, setTime] = useState<string>(defaultTime);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      if (editingDowntime) {
        const matchedReason = DOWNTIME_REASONS.find(
          (r) => r.label === editingDowntime.downtimeReason
        );
        setSelectedReasonCode(matchedReason ? matchedReason.code : DOWNTIME_REASONS[0].code);
        setDurationMinutes(editingDowntime.downtimeDurationMinutes || 15);
        setShift(editingDowntime.shift || defaultShift);
        setOperator(editingDowntime.operator || selectedOp.operator || FLOOR_OPERATORS[0]);
        setTime(editingDowntime.time || defaultTime);
        setNote(editingDowntime.note || "");
      } else {
        setSelectedReasonCode(DOWNTIME_REASONS[0].code);
        setDurationMinutes(DOWNTIME_REASONS[0].defaultDurationMinutes);
        setShift(defaultShift);
        setOperator(selectedOp.operator || FLOOR_OPERATORS[0]);
        setTime(defaultTime);
        setNote("");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens, not as the clock ticks
  }, [isOpen, editingDowntime, selectedOp.operator, selectedOp.status]);

  const selectedReason =
    DOWNTIME_REASONS.find((r) => r.code === selectedReasonCode) ||
    DOWNTIME_REASONS[0];

  const handleReasonChange = (code: string) => {
    setSelectedReasonCode(code);
    const found = DOWNTIME_REASONS.find((r) => r.code === code);
    if (found && !editingDowntime) {
      setDurationMinutes(found.defaultDurationMinutes);
    }
  };

  const handleSave = () => {
    const cleanNote = note.trim();
    onSaveDowntime({
      eventId: editingDowntime?.id,
      opId: selectedOp.id,
      shift,
      downtimeReason: selectedReason.label,
      durationMinutes: Math.max(1, durationMinutes || 15),
      operator: operator || selectedOp.operator || FLOOR_OPERATORS[0],
      note: cleanNote || selectedReason.label,
      time: isOpenMode && !editingDowntime ? plantClock(new Date()).time : time || defaultTime,
      open: isOpenMode,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border shadow-lg">
        <DialogHeader className="p-3.5 bg-muted/40 border-b border-border">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span>
                    {editingDowntime ? "To'xtalishni tahrirlash" : isOpenMode ? "Bosqichni to'xtatish" : "To'xtalish kiritish"}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] py-0 h-4">
                    #{selectedOp.stepNumber}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {selectedOp.name}
                </DialogDescription>
              </div>
            </div>

            <Select
              value={shift}
              onValueChange={(val: string | null) => {
                if (val && shiftOptions.some((sh) => sh.name === val)) setShift(val as ShiftName);
              }}
            >
              <SelectTrigger className="h-7 text-xs w-[100px] bg-background font-medium">
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

        <div className="p-4 space-y-3 text-xs">
          {/* Reason Select */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <Wrench className="size-3.5 text-primary" />
              <span>Sabab</span>
            </label>
            <Select
              value={selectedReasonCode}
              onValueChange={(code: string | null) => {
                if (code) handleReasonChange(code);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background w-full">
                <SelectValue>{selectedReason.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DOWNTIME_REASONS.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code} className="text-xs">
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span>{reason.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        ~{reason.defaultDurationMinutes}m
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isOpenMode && (
          <div className="grid grid-cols-2 gap-3">
            {/* Duration */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span>Davomiyligi (daq.)</span>
              </label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Time */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span>Vaqt</span>
              </label>
              <Input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="14:30"
              />
            </div>
          </div>
          )}

          {/* Operator */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              <span>Operator</span>
            </label>
            <Select
              value={operator}
              onValueChange={(val: string | null) => {
                if (val) setOperator(val);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background w-full">
                <SelectValue>{operator || "Operator tanlang"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map((opName) => (
                  <SelectItem key={opName} value={opName} className="text-xs">
                    {opName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-muted-foreground" />
              <span>Izoh</span>
            </label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Qisqa izoh..."
              className="h-8 text-xs"
            />
          </div>

        </div>

        <DialogFooter className="p-3 bg-muted/30 border-t border-border flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Bekor qilish
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            {isOpenMode && !editingDowntime ? "To'xtatish" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
