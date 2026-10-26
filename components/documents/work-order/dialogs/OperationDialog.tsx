"use client";

import React from "react";
import { Stamp, Factory, Users, Tag, Calculator, DollarSign, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RouteStep, MACHINE_MAP } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { computeTariffEstimate, TARIFF_CALC_UNITS } from "@/components/documents/tariff/types";

interface OperationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingOpIndex: number | null;
  form: Omit<RouteStep, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<RouteStep, "id">>>;
  onSave: () => void;
  customerName?: string;
  orderQuantity?: number;
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
  orderQuantity = 1000,
}: OperationDialogProps) {
  const { customerTooling, employees, tariffs, machines } = useWorkspaceStore(
    useShallow((s) => ({
      customerTooling: s.customerTooling,
      employees: s.employees,
      tariffs: s.tariffs,
      machines: s.machines,
    }))
  );
  const anchor = useComboboxAnchor();

  React.useEffect(() => {
    const s = useWorkspaceStore.getState();
    if (s.employees.length === 0 && s.loadEmployees) {
      s.loadEmployees();
    }
    if (s.tariffs.length === 0 && s.fetchTariffs) {
      s.fetchTariffs();
    }
    if (s.machines.length === 0 && s.loadMachines) {
      s.loadMachines();
    }
  }, [isOpen]);

  const machineOptions = React.useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    if (Array.isArray(machines) && machines.length > 0) {
      machines.forEach((m) => {
        if (!m.name || seen.has(m.name)) return;
        seen.add(m.name);
        list.push({
          value: m.name,
          label: m.department ? `${m.name} (${m.department})` : m.name,
        });
      });
    } else {
      Object.entries(MACHINE_MAP).forEach(([dept, names]) => {
        names.forEach((name) => {
          if (seen.has(name)) return;
          seen.add(name);
          list.push({
            value: name,
            label: `${name} (${dept})`,
          });
        });
      });
    }
    return list;
  }, [machines]);

  const toolingOptions = React.useMemo(() => {
    return customerTooling.map((t) => ({
      value: t.id,
      label: `${t.id} - ${t.name} (${t.location || "Ombor"})`,
    }));
  }, [customerTooling]);

  const tariffOptions = React.useMemo(() => {
    return tariffs.map((t) => ({
      value: t.id,
      label: `${t.code} — ${t.operationName} [${t.machineOrDept || t.category}] ($${t.rateUsd}/${t.unit})`,
    }));
  }, [tariffs]);

  const calcUnitOptions = React.useMemo(() => {
    return TARIFF_CALC_UNITS.map((u) => ({
      value: u.value,
      label: `${u.label} (÷${u.divisor})`,
    }));
  }, []);

  // Recalculate costs whenever rate, setup, or piecework changes
  const handleRecalculateCosts = (overrides: Partial<RouteStep>) => {
    const activeRate = overrides.rateUsd !== undefined ? overrides.rateUsd : form.rateUsd ?? 0;
    const activeSetup = overrides.setupFeeUsd !== undefined ? overrides.setupFeeUsd : form.setupFeeUsd ?? 0;
    const activePiecework = overrides.pieceworkRateUsd !== undefined ? overrides.pieceworkRateUsd : form.pieceworkRateUsd ?? 0;
    const activeDivisor = overrides.unitDivisor !== undefined ? overrides.unitDivisor : form.unitDivisor ?? 1000;

    const qty = Math.max(0, orderQuantity || 1000);
    const divisor = activeDivisor > 0 ? activeDivisor : 1;
    const chargeableUnits = qty / divisor;

    const runCost = Number((chargeableUnits * activeRate).toFixed(2));
    const plannedCostUsd = Number((activeSetup + runCost).toFixed(2));
    const pieceworkTotalUsd = Number((chargeableUnits * activePiecework).toFixed(2));

    setForm((p) => ({
      ...p,
      ...overrides,
      plannedCostUsd,
      pieceworkTotalUsd,
    }));
  };

  const handleSelectTariff = (tariffId: string) => {
    const selected = tariffs.find((t) => t.id === tariffId);
    if (!selected) {
      setForm((p) => ({ ...p, tariffId: undefined, tariffCode: undefined }));
      return;
    }

    const estimate = computeTariffEstimate(selected, orderQuantity || 1000);

    // Calculate estimated duration if norm is available
    let estimatedDuration = form.duration;
    if (selected.normOutputPerShift > 0) {
      const shiftHours = 8;
      const hours = (orderQuantity || 1000) / (selected.normOutputPerShift / shiftHours);
      estimatedDuration = Math.max(0.5, Number(hours.toFixed(1)));
    }

    setForm((p) => ({
      ...p,
      tariffId: selected.id,
      tariffCode: selected.code,
      name: selected.operationName,
      machine: selected.machineOrDept || p.machine,
      calcUnit: selected.unit,
      unitDivisor: selected.unitDivisor,
      rateUsd: estimate.effectiveRate,
      setupFeeUsd: estimate.effectiveSetup,
      pieceworkRateUsd: selected.pieceworkRateUsd,
      plannedCostUsd: estimate.netCost,
      pieceworkTotalUsd: estimate.pieceworkTotal,
      duration: estimatedDuration,
    }));
  };

  // Operators map sourced directly from real HR Employees
  const operatorMap = React.useMemo(() => {
    const map = new Map<string, OperatorItem>();

    if (Array.isArray(employees)) {
      employees.forEach((emp) => {
        if (emp.status === "terminated") return;
        const val = emp.fullName;
        if (!val || map.has(val)) return;
        const posLabel = emp.positionTitle || emp.position || "";
        const deptLabel = emp.departmentName || emp.department || "";
        const badgeLabel = emp.badgeNumber || emp.badgeNo || "";
        const subtitleParts = [posLabel, deptLabel, badgeLabel ? `#${badgeLabel}` : ""].filter(Boolean);

        map.set(val, {
          value: val,
          name: val,
          department: subtitleParts.join(" · ") || "Xodim",
          avatar: emp.avatarUrl || (emp as any).avatar,
          initials: getOperatorInitials(val),
        });
      });
    }

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
  }, [employees, form.operators, form.operator]);

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
      <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto text-xs p-4">
        <DialogHeader className="pb-2 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold flex items-center justify-between pr-6">
            <span className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-primary" />
              <span>{editingOpIndex !== null ? "Bosqichni tahrirlash" : "Bosqich qo'shish"}</span>
            </span>
            {form.tariffCode && (
              <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-border bg-muted text-foreground">
                {form.tariffCode}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1.5">
          {/* Quick Tariff Picker */}
          <div className="p-2.5 rounded-md border border-border bg-muted/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span>Korxona tarifi</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                Adad: {orderQuantity.toLocaleString()}
              </span>
            </div>
            <FieldCombobox
              value={form.tariffId || ""}
              onChange={handleSelectTariff}
              options={tariffOptions}
              placeholder="Tarifni tanlang (masalan, TRF-OFF-01)..."
              searchPlaceholder="Tarif kodi yoki operatsiya nomini qidiring..."
              className="h-8 text-xs bg-card"
              popoverClassName="w-[500px]"
            />
          </div>

          {/* Row 1: Step # & Operation Description */}
          <div className="grid grid-cols-4 gap-2.5">
            <div>
              <label className="text-xs font-medium block mb-1">Tartib #</label>
              <Input
                type="number"
                step="10"
                value={form.stepNumber}
                onChange={(e) => setForm((p) => ({ ...p, stepNumber: parseInt(e.target.value) || 10 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-medium block mb-1">Operatsiya nomi *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-8 text-xs font-medium"
                placeholder="Masalan: 4+4 Ofset bosma, UF laklash, Tigel kesish..."
              />
            </div>
          </div>

          {/* Row 2: Assigned Machine & Planned Duration */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium block">Uskuna / Ish markazi *</label>
              <FieldCombobox
                value={form.machine}
                onChange={(val) => {
                  const matchedMachine = machines.find((m) => m.name === val);
                  const autoOp =
                    !form.operator && matchedMachine?.leadOperator
                      ? matchedMachine.leadOperator
                      : form.operator;
                  const autoOps =
                    (!form.operators || form.operators.length === 0) && matchedMachine?.leadOperator
                      ? [matchedMachine.leadOperator]
                      : form.operators;
                  setForm((p) => ({
                    ...p,
                    machine: val,
                    operator: autoOp || "",
                    operators: autoOps,
                  }));
                }}
                allowCustom
                options={machineOptions}
                placeholder="Uskunani tanlang..."
                searchPlaceholder="Uskunalarni qidirish..."
                className="h-8 text-xs"
                popoverClassName="w-[360px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium block">Me&apos;yoriy vaqt (soat)</label>
              <Input
                type="number"
                step="0.1"
                value={form.duration}
                onChange={(e) => setForm((p) => ({ ...p, duration: parseFloat(e.target.value) || 1 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 3: Tariff Rates & Divisors */}
          <div className="p-2.5 rounded-md border border-border bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Stavka va tannarx</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Pripravka + (Adad / Birlik) × Stavka
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block">Hisob birligi</label>
                <FieldCombobox
                  value={form.calcUnit || "1,000 sheets"}
                  onChange={(val) => {
                    const matched = TARIFF_CALC_UNITS.find((u) => u.value === val);
                    const divisor = matched ? matched.divisor : (form.unitDivisor || 1000);
                    handleRecalculateCosts({ calcUnit: val, unitDivisor: divisor });
                  }}
                  options={calcUnitOptions}
                  className="h-7 text-xs"
                  popoverClassName="w-[280px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block">Pripravka ($)</label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={2}
                  value={form.setupFeeUsd ?? 0}
                  onValueChange={(values) => handleRecalculateCosts({ setupFeeUsd: values.floatValue ?? 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block">Stavka ($)</label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={2}
                  value={form.rateUsd ?? 0}
                  onValueChange={(values) => handleRecalculateCosts({ rateUsd: values.floatValue ?? 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block">Sdelka stavkasi ($)</label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={3}
                  value={form.pieceworkRateUsd ?? 0}
                  onValueChange={(values) => handleRecalculateCosts({ pieceworkRateUsd: values.floatValue ?? 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>

            {/* Live Cost Summary Bar */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  Rejaviy tannarx:{" "}
                  <strong className="text-foreground font-mono">
                    ${(form.plannedCostUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground">
                  Sdelka FOT:{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    ${(form.pieceworkTotalUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Row 4: Assigned Operators */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Mas&apos;ul operatorlar</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {selectedOperators.length > 0
                  ? `${selectedOperators.length} ta tanlandi`
                  : "Brigada"}
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
                className="w-full min-h-11 flex-wrap py-1 px-2 gap-1.5 rounded-lg border border-input bg-card shadow-2xs focus-within:ring-1 focus-within:ring-ring text-xs items-center"
              >
                <ComboboxValue>
                  {(values: string[]) => (
                    <React.Fragment>
                      {values.map((val: string) => {
                        const op = operatorMap.get(val);
                        return (
                          <ComboboxChip
                            key={val}
                            className="!h-7 py-0.5 pl-1 pr-1.5 gap-1.5 rounded-md bg-muted/80 hover:bg-muted border border-border text-xs font-medium shrink-0 inline-flex items-center shadow-xs transition-colors"
                          >
                            <div className="size-4 shrink-0 rounded-full overflow-hidden flex items-center justify-center border border-border/40 shadow-2xs">
                              {op?.avatar ? (
                                <img src={op.avatar} alt={val} className="size-full object-cover rounded-full" />
                              ) : (
                                <span
                                  className={cn(
                                    "size-full rounded-full flex items-center justify-center text-[9px] font-bold text-white select-none leading-none",
                                    getOperatorColor(val)
                                  )}
                                >
                                  {op?.initials || getOperatorInitials(val)}
                                </span>
                              )}
                            </div>
                            <span className="truncate max-w-[140px] text-foreground font-medium text-[11px] leading-none">
                              {op?.name || val}
                            </span>
                          </ComboboxChip>
                        );
                      })}
                      <ComboboxChipsInput
                        placeholder={values.length === 0 ? "Operatorlarni tanlang yoki qidiring..." : ""}
                        className="text-xs h-6 py-0 min-w-28 text-foreground placeholder:text-muted-foreground"
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
                <ComboboxList className="max-h-60 overflow-y-auto no-scrollbar space-y-1">
                  {(item: string) => {
                    const op = operatorMap.get(item);
                    return (
                      <ComboboxItem
                        key={item}
                        value={item}
                        className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-accent/80 cursor-pointer text-xs transition-colors"
                      >
                        <div className="size-7 shrink-0 rounded-full overflow-hidden flex items-center justify-center border border-border/50 shadow-xs">
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

          {/* Technological Tooling & Step Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/60">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Stamp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Texnologik jihoz</span>
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
                searchPlaceholder="Jihozlarni qidirish..."
                className="h-8 text-xs"
                popoverClassName="w-[380px]"
              />
              {form.toolingId && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <span>Joylashuv:</span>
                  <span className="font-mono font-medium text-foreground">
                    {customerTooling.find((t) => t.id === form.toolingId)?.location || "Belgilanmagan"}
                  </span>
                  <span className="text-muted-foreground/60">•</span>
                  <span>Resurs:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {customerTooling.find((t) => t.id === form.toolingId)?.impressionsUsed?.toLocaleString() || 0} /{" "}
                    {customerTooling.find((t) => t.id === form.toolingId)?.maxLife?.toLocaleString() || 150000}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium block text-foreground">Bosqich holati</label>
              <Select
                value={form.status || "Queued"}
                onValueChange={(val: any) => setForm((p) => ({ ...p, status: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Queued">Navbatda</SelectItem>
                  <SelectItem value="In Progress">Jarayonda</SelectItem>
                  <SelectItem value="Paused">To&apos;xtalish</SelectItem>
                  <SelectItem value="Finished">Yakunlandi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Bekor qilish
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!form.name?.trim()}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {editingOpIndex !== null ? "Saqlash" : "Qo'shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
