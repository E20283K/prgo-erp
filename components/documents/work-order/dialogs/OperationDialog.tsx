"use client";

import React from "react";
import {
  Stamp,
  Factory,
  Users,
  Tag,
  Calculator,
  Info,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RouteStep, MACHINE_MAP } from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useShallow } from "zustand/react/shallow";
import { computeTariffEstimate, TARIFF_CALC_UNITS } from "@/components/documents/tariff/types";
import { formatMoney, formatNumberWithSpaces } from "@/components/documents/common/DocumentShell";

interface OperationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingOpIndex: number | null;
  form: Omit<RouteStep, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<RouteStep, "id">>>;
  onSave: () => void;
  customerName?: string;
  orderQuantity?: number;
  plannedSheets?: number;
  currency?: string;
  exchangeRate?: number;
}

const SHEET_BASED_UNITS = new Set([
  "1,000 sheets",
  "1,000 impressions",
  "1,000 strokes",
  "1,000 glue passes",
]);

function resolveCalcBaseQty(
  calcUnit: string | undefined,
  orderQuantity: number,
  plannedSheets: number,
  duration: number
): number {
  if (calcUnit === "1 hour") {
    return Math.max(0, duration || 0);
  }
  if (calcUnit && SHEET_BASED_UNITS.has(calcUnit) && plannedSheets > 0) {
    return plannedSheets;
  }
  return Math.max(0, orderQuantity || 0);
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

function FieldInfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors cursor-help p-0.5 ml-1 select-none"
            title=""
          >
            <Info className="size-3" />
          </span>
        }
      />
      <TooltipContent side="top" className="max-w-[270px] text-xs leading-relaxed p-2 font-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function OperationDialog({
  isOpen,
  onOpenChange,
  editingOpIndex,
  form,
  setForm,
  onSave,
  orderQuantity = 0,
  plannedSheets = 0,
  currency = "UZS",
  exchangeRate = 12850,
}: OperationDialogProps) {
  const isUsd = (currency || "UZS").toUpperCase() === "USD";
  const currencyLabel = isUsd ? "$" : "so'm";
  const moneyDecimals = isUsd ? 2 : 0;
  const pieceworkDecimals = isUsd ? 3 : 0;

  const { customerTooling, employees, tariffs, machines } = useWorkspaceStore(
    useShallow((s) => ({
      customerTooling: s.customerTooling,
      employees: s.employees,
      tariffs: s.tariffs,
      machines: s.machines,
    }))
  );
  const anchor = useComboboxAnchor();
  const [stepNumberInput, setStepNumberInput] = React.useState(String(form.stepNumber ?? 10));
  const [durationInput, setDurationInput] = React.useState(String(form.duration ?? 1));

  React.useEffect(() => {
    if (isOpen) {
      setStepNumberInput(String(form.stepNumber ?? 10));
      setDurationInput(String(form.duration ?? 1));
    }
  }, [isOpen, form.stepNumber, form.duration]);

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
    return tariffs.map((t) => {
      const tCur = (t.currency || "USD").toUpperCase();
      let displayRate = t.rateUsd || 0;
      let displayCur = tCur === "USD" ? "$" : "so'm";

      if (tCur === "USD" && !isUsd) {
        displayRate = Math.round(displayRate * exchangeRate);
        displayCur = "so'm";
      } else if (tCur === "UZS" && isUsd) {
        displayRate = Number((displayRate / exchangeRate).toFixed(2));
        displayCur = "$";
      }

      const formattedRate = formatNumberWithSpaces(displayRate, isUsd ? 2 : 0);
      return {
        value: t.id,
        label: `${t.code} — ${t.operationName} [${t.machineOrDept || t.category}] (${formattedRate} ${displayCur}/${t.unit})`,
      };
    });
  }, [tariffs, isUsd, exchangeRate]);

  const calcUnitOptions = React.useMemo(() => {
    return TARIFF_CALC_UNITS.map((u) => ({
      value: u.value,
      label: `${u.label} (÷${formatNumberWithSpaces(u.divisor)})`,
    }));
  }, []);

  // Recalculate costs whenever rate, setup, unit, duration, or piecework changes
  const handleRecalculateCosts = (overrides: Partial<RouteStep>) => {
    const activeRate = overrides.rateUsd !== undefined ? overrides.rateUsd : form.rateUsd ?? 0;
    const activeSetup = overrides.setupFeeUsd !== undefined ? overrides.setupFeeUsd : form.setupFeeUsd ?? 0;
    const activePiecework = overrides.pieceworkRateUsd !== undefined ? overrides.pieceworkRateUsd : form.pieceworkRateUsd ?? 0;
    const activeDivisor = overrides.unitDivisor !== undefined ? overrides.unitDivisor : form.unitDivisor ?? 1000;
    const activeUnit = overrides.calcUnit !== undefined ? overrides.calcUnit : form.calcUnit;
    const activeDuration = overrides.duration !== undefined ? overrides.duration : form.duration;

    const qty = resolveCalcBaseQty(activeUnit, orderQuantity, plannedSheets, activeDuration);
    const divisor = activeDivisor > 0 ? activeDivisor : 1;
    const chargeableUnits = qty / divisor;

    const runCost = isUsd ? Number((chargeableUnits * activeRate).toFixed(2)) : Math.round(chargeableUnits * activeRate);
    const plannedCostUsd = isUsd ? Number((activeSetup + runCost).toFixed(2)) : Math.round(activeSetup + runCost);
    const pieceworkTotalUsd = isUsd ? Number((chargeableUnits * activePiecework).toFixed(2)) : Math.round(chargeableUnits * activePiecework);

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

    // Calculate estimated duration if norm is available
    let estimatedDuration = form.duration;
    if (selected.normOutputPerShift > 0) {
      const shiftHours = 8;
      const baseForNorm = SHEET_BASED_UNITS.has(selected.unit) && plannedSheets > 0
        ? plannedSheets
        : orderQuantity;
      const hours = baseForNorm / (selected.normOutputPerShift / shiftHours);
      estimatedDuration = Math.max(0.5, Number(hours.toFixed(1)));
    }

    const baseQty = resolveCalcBaseQty(selected.unit, orderQuantity, plannedSheets, estimatedDuration);
    const estimate = computeTariffEstimate(selected, baseQty);

    const tCur = (selected.currency || "USD").toUpperCase();
    let effectiveRate = estimate.effectiveRate;
    let effectiveSetup = estimate.effectiveSetup;
    let pieceworkRate = selected.pieceworkRateUsd || 0;

    if (tCur === "USD" && !isUsd) {
      effectiveRate = Math.round(effectiveRate * exchangeRate);
      effectiveSetup = Math.round(effectiveSetup * exchangeRate);
      pieceworkRate = Math.round(pieceworkRate * exchangeRate);
    } else if (tCur === "UZS" && isUsd) {
      effectiveRate = Number((effectiveRate / exchangeRate).toFixed(2));
      effectiveSetup = Number((effectiveSetup / exchangeRate).toFixed(2));
      pieceworkRate = Number((pieceworkRate / exchangeRate).toFixed(3));
    }

    const divisor = selected.unitDivisor > 0 ? selected.unitDivisor : 1;
    const chargeableUnits = baseQty / divisor;

    const runCost = isUsd ? Number((chargeableUnits * effectiveRate).toFixed(2)) : Math.round(chargeableUnits * effectiveRate);
    const plannedCostUsd = isUsd ? Number((effectiveSetup + runCost).toFixed(2)) : Math.round(effectiveSetup + runCost);
    const pieceworkTotalUsd = isUsd ? Number((chargeableUnits * pieceworkRate).toFixed(2)) : Math.round(chargeableUnits * pieceworkRate);

    setForm((p) => ({
      ...p,
      tariffId: selected.id,
      tariffCode: selected.code,
      name: selected.operationName,
      machine: selected.machineOrDept || p.machine,
      calcUnit: selected.unit,
      unitDivisor: selected.unitDivisor,
      rateUsd: effectiveRate,
      setupFeeUsd: effectiveSetup,
      pieceworkRateUsd: pieceworkRate,
      plannedCostUsd,
      pieceworkTotalUsd,
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
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span>Korxona tarifi</span>
                <FieldInfoTooltip text="Korxona bo'yicha tasdiqlangan me'yoriy tariflar spravochnigi. Tanlangan tarifdan operatsiya nomi, uskuna, stavka, pripravka va ish vaqti avtomatik yuklanadi." />
              </label>
              <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                <span>Adad:</span>
                <strong className="text-foreground">{formatNumberWithSpaces(orderQuantity)}</strong>
                {plannedSheets > 0 && (
                  <>
                    <span className="text-muted-foreground/50">|</span>
                    <span>Varaq:</span>
                    <strong className="text-foreground">{formatNumberWithSpaces(plannedSheets)}</strong>
                  </>
                )}
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
              <label className="text-xs font-medium block mb-1">
                Tartib #
              </label>
              <Input
                type="number"
                step="10"
                value={stepNumberInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setStepNumberInput(raw);
                  const parsed = parseInt(raw, 10);
                  if (!Number.isNaN(parsed) && parsed > 0) {
                    setForm((p) => ({ ...p, stepNumber: parsed }));
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(stepNumberInput, 10);
                  const valid = !Number.isNaN(parsed) && parsed > 0 ? parsed : 10;
                  setStepNumberInput(String(valid));
                  setForm((p) => ({ ...p, stepNumber: valid }));
                }}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-medium block mb-1">
                Operatsiya nomi *
              </label>
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
              <label className="text-xs font-medium block">
                Uskuna / Ish markazi *
              </label>
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
              <label className="text-xs font-medium block">
                Me&apos;yoriy vaqt (soat)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={durationInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDurationInput(raw);
                  const parsed = parseFloat(raw);
                  if (!Number.isNaN(parsed) && parsed > 0) {
                    if (form.calcUnit === "1 hour") {
                      handleRecalculateCosts({ duration: parsed });
                    } else {
                      setForm((p) => ({ ...p, duration: parsed }));
                    }
                  }
                }}
                onBlur={() => {
                  const parsed = parseFloat(durationInput);
                  const valid = !Number.isNaN(parsed) && parsed > 0 ? parsed : 0.5;
                  setDurationInput(String(valid));
                  if (form.calcUnit === "1 hour") {
                    handleRecalculateCosts({ duration: valid });
                  } else {
                    setForm((p) => ({ ...p, duration: valid }));
                  }
                }}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 3: Tariff Rates & Divisors */}
          <div className="p-2.5 rounded-md border border-border bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Stavka va tannarx ({currencyLabel})</span>
                <FieldInfoTooltip text="Operatsiya tannarxi buyurtma valyutasida hisoblanadi. Pripravka + (Adad ÷ Birlik) × Stavka formulasi asosida operatsiya rejaviy tannarxi va sdelka FOT fondi shakllanadi." />
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Pripravka + (Adad ÷ Birlik) × Stavka
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span>Hisob birligi</span>
                  <FieldInfoTooltip text="Tarif va sdelka stavkasi qaysi hajm uchun qo'llanishi (masalan: har 1 000 varaq, 1 000 ottisk, 1 dona yoki 1 soat)." />
                </label>
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
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span>Pripravka ({currencyLabel})</span>
                  <FieldInfoTooltip text="Stanokni sozlash, formalarni o'rnatish, bo'yoq tekislash va sinov varaqlarini chiqarish uchun fiksirlangan bir martalik xarajat summasi." />
                </label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={moneyDecimals}
                  value={form.setupFeeUsd ?? 0}
                  onValueChange={(values) => handleRecalculateCosts({ setupFeeUsd: values.floatValue ?? 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span>Stavka ({currencyLabel})</span>
                  <FieldInfoTooltip text="Belgilangan hisob birligi (masalan, har 1 000 varaq) uchun korxona hisob-kitob narxi / tarifi." />
                </label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={moneyDecimals}
                  value={form.rateUsd ?? 0}
                  onValueChange={(values) => handleRecalculateCosts({ rateUsd: values.floatValue ?? 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span>Sdelka stavkasi ({currencyLabel})</span>
                  <FieldInfoTooltip text="Belgilangan hisob birligi uchun operatorlarga hisoblanadigan ishbay ish haqi (FOT) stavkasi." />
                </label>
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={pieceworkDecimals}
                  value={form.pieceworkRateUsd ?? 0}
                  onValueChange={(values) => handleRecalculateCosts({ pieceworkRateUsd: values.floatValue ?? 0 })}
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>

            {/* Live Cost Summary Bar */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <span>Rejaviy tannarx:</span>
                  <strong className="text-foreground font-mono">
                    {formatMoney(form.plannedCostUsd || 0, currency, moneyDecimals)}
                  </strong>
                  <FieldInfoTooltip text="Ushbu operatsiya bo'yicha jami rejaviy tannarx: Pripravka + (Adad ÷ Birlik) × Stavka." />
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <span>Sdelka FOT:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatMoney(form.pieceworkTotalUsd || 0, currency, moneyDecimals)}
                  </strong>
                  <FieldInfoTooltip text="Operatorlar brigadasiga to'lanadigan jami ishbay ish haqi fondi: (Adad ÷ Birlik) × Sdelka stavkasi." />
                </span>
              </div>
            </div>
          </div>

          {/* Row 4: Assigned Operators */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Mas&apos;ul operatorlar</span>
                <FieldInfoTooltip text="Ushbu bosqichni bajarishga mas'ul bo'lgan bir yoki bir nechta operatorlar / brigada xodimlari." />
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
                  <FieldInfoTooltip text="Operatsiyada ishlatiladigan shtansforma, shtamp, klishe yoki qolip. Uning joylashuvi va ishlatilgan resursi hisobga olinadi." />
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
                    {customerTooling.find((t) => t.id === form.toolingId)?.impressionsUsed ? formatNumberWithSpaces(customerTooling.find((t) => t.id === form.toolingId)?.impressionsUsed) : 0} /{" "}
                    {formatNumberWithSpaces(customerTooling.find((t) => t.id === form.toolingId)?.maxLife || 150000)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium flex items-center gap-1 text-foreground">
                <span>Bosqich holati</span>
                <FieldInfoTooltip text="Operatsiyaning joriy holati: Navbatda (kutmoqda), Jarayonda (ishlanmoqda), To'xtalish (pauza) yoki Yakunlandi (tayyor)." />
              </label>
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

        <DialogFooter className="gap-2 pt-2 border-t border-border/60">
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
