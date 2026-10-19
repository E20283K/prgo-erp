"use client";

import React from "react";
import { Stamp, Factory } from "lucide-react";
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
import { useWorkspaceStore } from "@/store/workspaceStore";

interface OperationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingOpIndex: number | null;
  form: Omit<RouteStep, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<RouteStep, "id">>>;
  onSave: () => void;
  customerName?: string;
}

export function OperationDialog({
  isOpen,
  onOpenChange,
  editingOpIndex,
  form,
  setForm,
  onSave,
  customerName,
}: OperationDialogProps) {
  const { customerTooling } = useWorkspaceStore();

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

  const toolingOptions = React.useMemo(() => {
    return customerTooling.map((t) => ({
      value: t.id,
      label: `${t.id} - ${t.name} (${t.location || "Ombor"})`,
    }));
  }, [customerTooling]);

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

          {/* Technological Tooling (Shtansforma / Klishe / Fixture) */}
          <div className="space-y-1 pt-1 border-t border-border/60">
            <label className="text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-foreground">
                <Stamp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Biriktirilgan Texnologik Jihoz (Shtansforma / Klishe)
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">Ixtiyoriy</span>
            </label>
            <FieldCombobox
              value={form.toolingId || ""}
              onChange={(val) => {
                const matchedTool = customerTooling.find((t) => t.id === val);
                setForm((p) => ({
                  ...p,
                  toolingId: val,
                  toolingName: matchedTool ? `${matchedTool.id} - ${matchedTool.name}` : val,
                }));
              }}
              allowCustom
              options={toolingOptions}
              placeholder="Shtansforma yoki klishe tanlang..."
              searchPlaceholder="Shtansformalarni qidirish..."
              className="h-8 text-xs"
              popoverClassName="w-[380px]"
            />
            {form.toolingId && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span>Ombor joylashuvi:</span>
                <span className="font-mono font-medium text-foreground">
                  {customerTooling.find((t) => t.id === form.toolingId)?.location || "Belgilanmagan"}
                </span>
                <span className="text-muted-foreground/60">•</span>
                <span>Zarbalar:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {customerTooling.find((t) => t.id === form.toolingId)?.impressionsUsed?.toLocaleString() || 0} /{" "}
                  {customerTooling.find((t) => t.id === form.toolingId)?.maxLife?.toLocaleString() || 150000}
                </span>
              </p>
            )}
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
