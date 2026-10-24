"use client";

import React from "react";
import { Stamp, Factory, Users, Tag, Calculator, DollarSign, Layers } from "lucide-react";
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
  const { customerTooling, users, fetchUsers, tariffs, fetchTariffs } = useWorkspaceStore();
  const anchor = useComboboxAnchor();

  React.useEffect(() => {
    if (users.length === 0 && fetchUsers) {
      fetchUsers();
    }
    if (tariffs.length === 0 && fetchTariffs) {
      fetchTariffs();
    }
  }, [users.length, fetchUsers, tariffs.length, fetchTariffs]);

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

  // Unified operators map
  const operatorMap = React.useMemo(() => {
    const map = new Map<string, OperatorItem>();

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
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto text-xs p-5">
        <DialogHeader className="pb-2 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span>{editingOpIndex !== null ? "Texnologik marshrut bosqichini tahrirlash" : "Work Orderga bosqich qo'shish"}</span>
            </span>
            {form.tariffCode && (
              <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {form.tariffCode}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Standart korxona tariflaridan tanlang yoki moslashtirilgan stavka, uskuna va operatorlar brigadasini belgilang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Tariff Picker */}
          <div className="p-2.5 rounded-lg border border-blue-100 dark:border-blue-950/80 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Standart Korxona Tarifi (Auto-fill)</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Tiraj bo&apos;yicha avtomatik stavka
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
              <label className="text-xs font-medium block mb-1">Qadam #</label>
              <Input
                type="number"
                step="10"
                value={form.stepNumber}
                onChange={(e) => setForm((p) => ({ ...p, stepNumber: parseInt(e.target.value) || 10 }))}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-medium block mb-1">Operatsiya nomi / Tavsif *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-8 text-xs font-medium"
                placeholder="Masalan: 4+4 Ofset Bosma, UF Lak, Tigel qirqish..."
              />
            </div>
          </div>

          {/* Row 2: Assigned Machine & Planned Duration */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium block">Biriktirilgan Uskuna / Ish markazi *</label>
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
              <label className="text-xs font-medium block">Rejaviy vaqt (soat)</label>
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
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Tarif stavkalari va hisoblash birligi</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Tiraj: {orderQuantity.toLocaleString()} birlik
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                <Input
                  type="number"
                  step="0.01"
                  value={form.setupFeeUsd ?? 0}
                  onChange={(e) => handleRecalculateCosts({ setupFeeUsd: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block">Operatsiya stavkasi ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.rateUsd ?? 0}
                  onChange={(e) => handleRecalculateCosts({ rateUsd: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block">Operator sdelkasi ($)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.pieceworkRateUsd ?? 0}
                  onChange={(e) => handleRecalculateCosts({ pieceworkRateUsd: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>

            {/* Live Cost Summary Bar */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  Stanok xarajati:{" "}
                  <strong className="text-foreground font-mono">
                    ${(form.plannedCostUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground">
                  Operator FOT (Sdelka):{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    ${(form.pieceworkTotalUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Formula: Pripravka + (Tiraj / Birlik) × Stavka
              </span>
            </div>
          </div>

          {/* Row 4: Assigned Operators */}
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

          {/* Technological Tooling (Shtansforma / Klishe / Fixture) */}
          <div className="space-y-1 pt-2 border-t border-border/60">
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
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
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

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
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
