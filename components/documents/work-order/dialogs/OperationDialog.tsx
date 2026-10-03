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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RouteStep } from "../types";

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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Factory className="w-4 h-4 text-blue-600" />
            <span>{editingOpIndex !== null ? "Edit Routing Operation" : "Add Routing Step to Work Order"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define the operation sequence, equipment, operator, and planned run duration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-medium">Step #</label>
              <Input
                type="number"
                step="10"
                value={form.stepNumber}
                onChange={(e) => setForm((p) => ({ ...p, stepNumber: parseInt(e.target.value) || 10 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Operation Description *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-8 text-xs font-medium"
                placeholder="e.g. 4+4 Offset Printing"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Assigned Machine / Work Center *</label>
            <Input
              value={form.machine}
              onChange={(e) => setForm((p) => ({ ...p, machine: e.target.value }))}
              className="h-8 text-xs"
              placeholder="e.g. Heidelberg Speedmaster XL 106"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium">Assigned Operator</label>
              <Input
                value={form.operator}
                onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Operator name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Planned Duration (hrs)</label>
              <Input
                type="number"
                step="0.1"
                value={form.duration}
                onChange={(e) => setForm((p) => ({ ...p, duration: parseFloat(e.target.value) || 1 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium">Progress / Output</label>
              <Input
                value={form.qtyCompleted}
                onChange={(e) => setForm((p) => ({ ...p, qtyCompleted: e.target.value }))}
                className="h-8 text-xs font-mono"
                placeholder="e.g. 3,200 / 5,000"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Status</label>
              <Select
                value={form.status}
                onValueChange={(val: any) => val && setForm((p) => ({ ...p, status: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Queued">Queued</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Finished">Finished</SelectItem>
                </SelectContent>
              </Select>
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
