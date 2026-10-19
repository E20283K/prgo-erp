"use client";

import React from "react";
import { Factory } from "lucide-react";
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
import { FieldCombobox } from "@/components/ui/field-combobox";
import { RouteStep, MACHINE_OPTIONS, FLOOR_OPERATORS } from "../types";

interface OperationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingOpIndex: number | null;
  form: Omit<RouteStep, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<RouteStep, "id">>>;
  onSave: () => void;
}

export function OperationDialog({
  isOpen,
  onOpenChange,
  editingOpIndex,
  form,
  setForm,
  onSave,
}: OperationDialogProps) {
  const machineOptions = React.useMemo(
    () =>
      MACHINE_OPTIONS.map((m) => ({
        value: m.name,
        label: `${m.name} (${m.department})`,
      })),
    []
  );

  const operatorOptions = React.useMemo(
    () =>
      FLOOR_OPERATORS.map((op) => ({
        value: op,
        label: op,
      })),
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Factory className="w-4 h-4 text-blue-600" />
            <span>{editingOpIndex !== null ? "Edit Routing Operation" : "Add Routing Step to Work Order"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure technological step, work center, operator, and planned normative duration. Execution status and output are tracked in Timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-medium block mb-1">Step #</label>
              <Input
                type="number"
                step="10"
                value={form.stepNumber}
                onChange={(e) => setForm((p) => ({ ...p, stepNumber: parseInt(e.target.value) || 10 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1">Operation Description *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-8 text-xs font-medium"
                placeholder="e.g. 4+4 Offset Printing"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium block">Assigned Machine / Work Center *</label>
            <FieldCombobox
              value={form.machine}
              onChange={(val) => setForm((p) => ({ ...p, machine: val }))}
              allowCustom
              options={machineOptions}
              placeholder="Select or type equipment..."
              searchPlaceholder="Search equipment..."
              className="h-8 text-xs"
              popoverClassName="w-[380px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium block">Assigned Operator</label>
              <FieldCombobox
                value={form.operator}
                onChange={(val) => setForm((p) => ({ ...p, operator: val }))}
                allowCustom
                options={operatorOptions}
                placeholder="Select operator..."
                searchPlaceholder="Search operator..."
                className="h-8 text-xs"
                popoverClassName="w-[260px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium block">Planned Duration (hrs)</label>
              <Input
                type="number"
                step="0.1"
                value={form.duration}
                onChange={(e) => setForm((p) => ({ ...p, duration: parseFloat(e.target.value) || 1 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
            {editingOpIndex !== null ? "Save Changes" : "Add Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
