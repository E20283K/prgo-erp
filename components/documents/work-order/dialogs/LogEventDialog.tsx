"use client";

import React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { RouteStep } from "../types";

interface LogEventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOp: RouteStep;
  form: {
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC";
    note: string;
    time: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC";
    note: string;
    time: string;
  }>>;
  onSave: () => void;
}

export function LogEventDialog({
  isOpen,
  onOpenChange,
  selectedOp,
  form,
  setForm,
  onSave,
}: LogEventDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Log Shift Event / Downtime</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record a shift milestone, downtime delay, or QC event for Step {selectedOp.stepNumber} ({selectedOp.name}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium">Event Type *</label>
              <Select
                value={form.type}
                onValueChange={(val: any) => val && setForm((p) => ({ ...p, type: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Setup">Setup / Make-Ready</SelectItem>
                  <SelectItem value="Run">Run Milestone</SelectItem>
                  <SelectItem value="Delay">Delay / Downtime</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="QC">Quality Check (QC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Event Time</label>
              <Input
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className="h-8 text-xs font-mono"
                placeholder="e.g. 15:45"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Machine & Operator</label>
            <Input
              disabled
              value={`${selectedOp.machine} • ${selectedOp.operator}`}
              className="h-8 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Event Description / Reason *</label>
            <Input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="h-8 text-xs font-medium"
              placeholder="e.g. Waiting for paper delivery / Blanket wash"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
            Save Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
