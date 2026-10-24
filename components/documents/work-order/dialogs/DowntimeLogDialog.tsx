"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  User,
  Wrench,
  CheckCircle2,
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
import { cn } from "@/lib/utils";

interface DowntimeLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOp: RouteStep;
  editingDowntime?: ShiftEvent | null;
  onSaveDowntime: (data: {
    eventId?: string;
    opId: string;
    shift: "1-smena" | "2-smena";
    downtimeReason: string;
    durationMinutes: number;
    operator: string;
    note: string;
    time: string;
    pauseStep: boolean;
  }) => void;
}

export function DowntimeLogDialog({
  isOpen,
  onOpenChange,
  selectedOp,
  editingDowntime = null,
  onSaveDowntime,
}: DowntimeLogDialogProps) {
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const defaultShift: "1-smena" | "2-smena" =
    now.getHours() >= 8 && now.getHours() < 20 ? "1-smena" : "2-smena";

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

  const [shift, setShift] = useState<"1-smena" | "2-smena">(defaultShift);
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
  const [pauseStep, setPauseStep] = useState<boolean>(true);

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
        setPauseStep(selectedOp.status === "Paused");
      } else {
        setSelectedReasonCode(DOWNTIME_REASONS[0].code);
        setDurationMinutes(DOWNTIME_REASONS[0].defaultDurationMinutes);
        setShift(defaultShift);
        setOperator(selectedOp.operator || FLOOR_OPERATORS[0]);
        setTime(defaultTime);
        setNote("");
        setPauseStep(true);
      }
    }
  }, [isOpen, editingDowntime, selectedOp.operator, selectedOp.status, defaultShift, defaultTime]);

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
      time: time || defaultTime,
      pauseStep,
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
                  <span>{editingDowntime ? "To'xtalishni tahrirlash" : "To'xtalish kiritish"}</span>
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
                if (val === "1-smena" || val === "2-smena") setShift(val);
              }}
            >
              <SelectTrigger className="h-7 text-xs w-[100px] bg-background font-medium">
                <SelectValue>{shift}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-smena" className="text-xs">
                  1-smena
                </SelectItem>
                <SelectItem value="2-smena" className="text-xs">
                  2-smena
                </SelectItem>
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

          {/* Pause checkbox card */}
          <div
            onClick={() => setPauseStep(!pauseStep)}
            className={cn(
              "p-2.5 rounded-md border flex items-center justify-between cursor-pointer transition-colors",
              pauseStep
                ? "bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-300"
                : "bg-muted/30 border-border text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "size-4 rounded flex items-center justify-center border",
                  pauseStep ? "bg-amber-500 border-amber-600 text-white" : "border-border"
                )}
              >
                {pauseStep && <CheckCircle2 className="size-3" />}
              </div>
              <span className="text-xs font-medium">
                Bosqichni to&apos;xtatib turish
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {pauseStep ? "To'xtatilgan" : "Faol"}
            </Badge>
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
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
