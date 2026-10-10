"use client";

import React from "react";
import {
  Clock,
  Wrench,
  PlayCircle,
  AlertTriangle,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import { RouteStep } from "../types";

interface LogEventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOp: RouteStep;
  form: {
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC" | "Waste";
    note: string;
    time: string;
    wasteQty?: number;
    wasteReason?: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC" | "Waste";
    note: string;
    time: string;
    wasteQty?: number;
    wasteReason?: string;
  }>>;
  onSave: () => void;
}

const EVENT_TYPE_OPTIONS: ComboboxItem[] = [
  {
    value: "Setup",
    label: "Setup / Make-Ready",
    badge: "Prep",
    description: "Tooling, plate mounting, registration & ink calibration",
    icon: Wrench,
  },
  {
    value: "Run",
    label: "Run Milestone",
    badge: "Active",
    description: "Production run progress & speed milestone update",
    icon: PlayCircle,
  },
  {
    value: "Delay",
    label: "Delay / Downtime",
    badge: "Stoppage",
    description: "Unplanned stop, waiting on substrate, plates or client approval",
    icon: AlertTriangle,
  },
  {
    value: "Maintenance",
    label: "Maintenance",
    badge: "Service",
    description: "Blanket wash, lubrication, mechanical cleaning & check",
    icon: Settings2,
  },
  {
    value: "QC",
    label: "Quality Check (QC)",
    badge: "Inspection",
    description: "Color Delta-E, density check, registration sign-off",
    icon: ShieldCheck,
  },
  {
    value: "Waste",
    label: "Log Waste / Defect",
    badge: "Scrap",
    description: "Damaged sheets, wrong artwork, misprint or substrate defect",
    icon: Trash2,
  },
];

const WASTE_REASON_OPTIONS: ComboboxItem[] = [
  { value: "Design Error", label: "Design Error", badge: "Prepress", description: "Wrong artwork file, outdated proof, layout discrepancy" },
  { value: "Color Mismatch", label: "Color Mismatch", badge: "Press", description: "Delta-E tolerance exceeded or ink formulation error" },
  { value: "Machine Jam", label: "Machine Jam", badge: "Press", description: "Feeder double-sheet or cylinder paper jam" },
  { value: "Substrate Defect", label: "Substrate Defect", badge: "Material", description: "Paper curl, surface contamination, static charging" },
  { value: "Die-cut Shift", label: "Die-cut Misalignment", badge: "Finishing", description: "Off-center cutting or creasing error" },
  { value: "Ink Set-off", label: "Ink Set-off / Smudge", badge: "Press", description: "Wet ink transfer or drying failure" },
];

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
      <DialogContent className="sm:max-w-[460px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Log Shift Event / Downtime</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record a shift milestone, downtime delay, QC inspection, or scrap waste for Step {selectedOp.stepNumber} ({selectedOp.name}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium">Event Type *</label>
              <SmartCombobox
                value={form.type}
                onChange={(val) => setForm((p) => ({ ...p, type: val as any }))}
                options={EVENT_TYPE_OPTIONS}
                placeholder="Select event type..."
                searchPlaceholder="Search event type..."
                allowCustom={false}
                popoverWidth="w-[330px]"
              />
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
            <label className="text-xs font-medium">Event Description / Note *</label>
            <Input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="h-8 text-xs font-medium"
              placeholder={form.type === "Waste" ? "e.g. 1000 sheets spoiled due to wrong revision artwork" : "e.g. Waiting for paper delivery / Blanket wash"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>

          {form.type === "Waste" && (
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="space-y-1">
                <label className="text-xs font-medium">Waste Qty (units) *</label>
                <Input
                  type="number"
                  value={form.wasteQty || ""}
                  onChange={(e) => setForm((p) => ({ ...p, wasteQty: Number(e.target.value) }))}
                  className="h-8 text-xs font-medium"
                  placeholder="e.g. 1000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Waste Reason *</label>
                <SmartCombobox
                  value={form.wasteReason || ""}
                  onChange={(val) => setForm((p) => ({ ...p, wasteReason: val }))}
                  options={WASTE_REASON_OPTIONS}
                  placeholder="Select reason..."
                  searchPlaceholder="Search or type defect reason..."
                  allowCustom={true}
                  popoverWidth="w-[300px]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-1.5 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-none">
            Save Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
