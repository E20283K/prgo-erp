"use client";

import React from "react";
import { Stamp, Factory, Users } from "lucide-react";
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
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
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

interface OperatorItem {
  value: string;
  name: string;
  department?: string;
  avatar?: string;
  initials: string;
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-indigo-600",
  "bg-teal-600",
];

function getOperatorColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] || "bg-zinc-600";
}

function getOperatorInitials(name: string): string {
  const clean = name.replace(/\([^)]*\)/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (clean.slice(0, 2) || "OP").toUpperCase();
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
  const { customerTooling, users, fetchUsers } = useWorkspaceStore();
  const anchor = useComboboxAnchor();

  React.useEffect(() => {
    if (users.length === 0 && fetchUsers) {
      fetchUsers();
    }
  }, [users.length, fetchUsers]);

  const machineOptions = React.useMemo(
    () =>
      MACHINE_OPTIONS.map((m) => ({
        value: m.name,
        label: `${m.name} (${m.department})`,
      })),
    []
  );

  const toolingOptions = React.useMemo(() => {
    return customerTooling.map((t) => ({
      value: t.id,
      label: `${t.id} - ${t.name} (${t.location || "Ombor"})`,
    }));
  }, [customerTooling]);

  // Unified operators map (Database Users + Floor Operators Catalog + Any custom already assigned)
  const operatorMap = React.useMemo(() => {
    const map = new Map<string, OperatorItem>();

    // 1. System Users from Database
    if (Array.isArray(users)) {
      users.forEach((u) => {
        const val = u.fullName || u.username;
        if (!val) return;
        map.set(val, {
          value: val,
          name: val,
          department: u.department || u.role || "Operator",
          avatar: u.avatar,
          initials: u.initials || getOperatorInitials(val),
        });
      });
    }

    // 2. Standard Floor Operators catalog
    FLOOR_OPERATORS.forEach((op) => {
      const match = op.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      const name = match ? match[1].trim() : op;
      const dept = match && match[2] ? match[2].trim() : undefined;
      if (!map.has(name)) {
        map.set(name, {
          value: name,
          name,
          department: dept,
          initials: getOperatorInitials(name),
        });
      }
    });

    // 3. Already selected operators if any
    const rawList =
      form.operators && form.operators.length > 0
        ? form.operators
        : form.operator
        ? form.operator.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    rawList.forEach((name) => {
      if (!map.has(name)) {
        map.set(name, {
          value: name,
          name,
          department: "Operator",
          initials: getOperatorInitials(name),
        });
      }
    });

    return map;
  }, [users, form.operators, form.operator]);

  const allOperatorNames = React.useMemo(
    () => Array.from(operatorMap.keys()),
    [operatorMap]
  );

  const selectedOperators = React.useMemo<string[]>(() => {
    if (form.operators && Array.isArray(form.operators) && form.operators.length > 0) {
      return form.operators;
    }
    if (form.operator && form.operator.trim()) {
      return form.operator.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [form.operator, form.operators]);

  const handleOperatorsChange = (vals: string[]) => {
    setForm((prev) => ({
      ...prev,
      operators: vals,
      operator: vals.join(", "),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Factory className="w-4 h-4 text-blue-600" />
            <span>{editingOpIndex !== null ? "Edit Routing Operation" : "Add Routing Step to Work Order"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Texnologik marshrut bosqichi, stanok, biriktirilgan operatorlar va rejaviy davomiylikni sozlang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Row 1: Step # & Operation Description */}
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

          {/* Row 2: Assigned Machine & Planned Duration */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium block">Assigned Machine / Work Center *</label>
              <FieldCombobox
                value={form.machine}
                onChange={(val) => setForm((p) => ({ ...p, machine: val }))}
                allowCustom
                options={machineOptions}
                placeholder="Stanok yoki uskunani tanlang..."
                searchPlaceholder="Stanoklarni qidirish..."
                className="h-8 text-xs"
                popoverClassName="w-[360px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium block">Duration (hrs)</label>
              <Input
                type="number"
                step="0.1"
                value={form.duration}
                onChange={(e) => setForm((p) => ({ ...p, duration: parseFloat(e.target.value) || 1 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 3: Assigned Operators (Multiple with Avatar Combobox) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Mas&apos;ul Operatorlar / Smena brigadasi</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                {selectedOperators.length > 0
                  ? `${selectedOperators.length} ta operator tanlandi`
                  : "Bir nechta tanlash mumkin"}
              </span>
            </div>

            <Combobox
              multiple
              autoHighlight
              items={allOperatorNames}
              value={selectedOperators}
              onValueChange={handleOperatorsChange}
            >
              <ComboboxChips
                ref={anchor}
                className="w-full min-h-12 flex-wrap py-1.5 px-2 gap-2 rounded-lg border border-input bg-card shadow-2xs focus-within:ring-1 focus-within:ring-ring text-xs items-center"
              >
                <ComboboxValue>
                  {(values: string[]) => (
                    <React.Fragment>
                      {values.map((val: string) => {
                        const op = operatorMap.get(val);
                        return (
                          <ComboboxChip
                            key={val}
                            className="!h-8 py-1 pl-1.5 pr-2 gap-2 rounded-lg bg-muted/80 hover:bg-muted border border-border text-xs font-medium shrink-0 inline-flex items-center shadow-xs transition-colors"
                          >
                            <div className="size-5 shrink-0 rounded-full overflow-hidden flex items-center justify-center border border-border/40 shadow-2xs">
                              {op?.avatar ? (
                                <img src={op.avatar} alt={val} className="size-full object-cover rounded-full" />
                              ) : (
                                <span
                                  className={cn(
                                    "size-full rounded-full flex items-center justify-center text-[10px] font-bold text-white select-none leading-none",
                                    getOperatorColor(val)
                                  )}
                                >
                                  {op?.initials || getOperatorInitials(val)}
                                </span>
                              )}
                            </div>
                            <span className="truncate max-w-[150px] text-foreground font-medium text-xs leading-none">
                              {op?.name || val}
                            </span>
                          </ComboboxChip>
                        );
                      })}
                      <ComboboxChipsInput
                        placeholder={values.length === 0 ? "Operatorlarni tanlang yoki qidiring..." : ""}
                        className="text-xs h-7 py-0 min-w-32 text-foreground placeholder:text-muted-foreground"
                      />
                    </React.Fragment>
                  )}
                </ComboboxValue>
              </ComboboxChips>

              <ComboboxContent
                anchor={anchor}
                className="w-[420px] max-w-[95vw] z-[100] shadow-2xl border border-border rounded-xl bg-popover text-popover-foreground p-1.5"
              >
                <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground">
                  Operator topilmadi.
                </ComboboxEmpty>
                <ComboboxList className="max-h-64 overflow-y-auto no-scrollbar space-y-1">
                  {(item: string) => {
                    const op = operatorMap.get(item);
                    return (
                      <ComboboxItem
                        key={item}
                        value={item}
                        className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-accent/80 cursor-pointer text-xs transition-colors"
                      >
                        <div className="size-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center border border-border/50 shadow-xs">
                          {op?.avatar ? (
                            <img src={op.avatar} alt={item} className="size-full object-cover rounded-full" />
                          ) : (
                            <span
                              className={cn(
                                "size-full rounded-full flex items-center justify-center text-xs font-bold text-white select-none leading-none",
                                getOperatorColor(item)
                              )}
                            >
                              {op?.initials || getOperatorInitials(item)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {op?.name || item}
                          </span>
                          {op?.department && (
                            <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {op.department}
                            </span>
                          )}
                        </div>
                      </ComboboxItem>
                    );
                  }}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
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
            Bekor qilish
          </Button>
          <Button size="sm" onClick={onSave} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium">
            {editingOpIndex !== null ? "Saqlash" : "Bosqichni qo'shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
