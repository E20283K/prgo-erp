"use client";

import React from "react";
import {
  Stamp,
  Factory,
  Users,
  Info,
  RotateCcw,
  RefreshCw,
  TriangleAlert,
  ChevronDown,
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
import { operationDepartment } from "@/components/documents/work-rate/types";
import { useShallow } from "zustand/react/shallow";
import { formatMoney, formatNumberWithSpaces } from "@/components/documents/common/DocumentShell";
import {
  computeOperationCost,
  calcUnitLabel,
  estimateOperationHours,
  freezeMachineRates,
  frozenRatesFor,
  getMachineCostRates,
  resolveMachine,
  type OperationCostMode,
} from "../utils/operationCost";
import { SHEET_BASED_UNITS, catalogPieceworkUsd, resolveCalcBaseQty } from "../utils/quickStep";
import { useProductiveTimePercent } from "../utils/useProductiveTimePercent";
import { machineCostingGaps } from "@/components/documents/machine/costingGaps";

interface OperationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingOpIndex: number | null;
  form: Omit<RouteStep, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<RouteStep, "id">>>;
  onSave: () => void;
  /** Saves the step and opens a blank form for the next one. */
  onSaveAndNext?: () => void;
  customerName?: string;
  orderQuantity?: number;
  plannedSheets?: number;
  currency?: string;
  exchangeRate?: number;
  /** Lets the user replace the computed cost with a manual amount (with a reason). */
  canOverrideCost?: boolean;
}

const THROUGHPUT_UNIT_LABEL: Record<string, string> = {
  sheet: "varaq",
  meter: "metr",
  pick: "zarb",
  cut: "kesim",
  book: "kitob",
};

const COST_MODE_LABEL: Record<OperationCostMode, string> = {
  auto: "Avto",
  outsourced: "Autsors",
  manual: "Qo'lda",
};

interface OperatorItem {
  value: string;
  name: string;
  /** False for a name kept on the step or machine card that HR does not know. */
  inHr?: boolean;
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
  onSaveAndNext,
  orderQuantity = 0,
  plannedSheets = 0,
  currency = "UZS",
  exchangeRate = 12850,
  canOverrideCost = false,
}: OperationDialogProps) {
  const isUsd = (currency || "UZS").toUpperCase() === "USD";
  const moneyDecimals = isUsd ? 2 : 0;

  const { customerTooling, employees, machines, workRates } = useWorkspaceStore(
    useShallow((s) => ({
      customerTooling: s.customerTooling,
      employees: s.employees,
      machines: s.machines,
      workRates: s.workRates,
    }))
  );
  const anchor = useComboboxAnchor();
  // New steps start collapsed: operation, machine and operators are enough; the rest is auto-filled.
  const [showMore, setShowMore] = React.useState(editingOpIndex !== null);
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
    if (s.machines.length === 0 && s.loadMachines) {
      s.loadMachines();
    }
    if (s.workRates.length === 0) {
      s.fetchWorkRates();
    }
  }, [isOpen]);

  const machineOptions = React.useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    if (Array.isArray(machines) && machines.length > 0) {
      machines.forEach((m) => {
        if (!m.name || seen.has(m.id)) return;
        seen.add(m.id);
        list.push({
          value: m.id,
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

  // ── Planned cost (read-only): machine + operators from master data ─────────
  // The dialog edits money in the order currency; the cost util works in USD.
  const fx = isUsd ? 1 : Number(exchangeRate) || 12850;
  const resolvedMachine = React.useMemo(() => resolveMachine(form, machines), [form, machines]);
  const durationEstimate = React.useMemo(
    () => estimateOperationHours(resolvedMachine, plannedSheets, orderQuantity),
    [resolvedMachine, plannedSheets, orderQuantity]
  );
  const productiveTimePercent = useProductiveTimePercent();
  const opCost = React.useMemo(
    () =>
      computeOperationCost(
        {
          ...form,
          pieceworkTotalUsd: (Number(form.pieceworkTotalUsd) || 0) / fx,
          manualCostUsd: (Number(form.manualCostUsd) || 0) / fx,
        },
        { machines, employees, exchangeRate, productiveTimePercent }
      ),
    [form, machines, employees, exchangeRate, fx, productiveTimePercent]
  );
  const costMode: OperationCostMode = form.costMode || "auto";
  const money = (usd: number) => formatMoney(usd * fx, currency, moneyDecimals);
  const needsReason = costMode === "manual" && !form.costNote?.trim();
  const costBreakdownText = (() => {
    if (costMode === "outsourced") return "Autsors: tashqi tashkilot hisobidagi summa.";
    if (costMode === "manual") return "Qo'lda kiritilgan summa (sabab bilan).";
    const machinePart =
      opCost.machineRateUsd > 0
        ? `Uskuna: ${form.duration} soat × ${money(opCost.machineRateUsd)}`
        : resolvedMachine
        ? "Uskuna: kartada tannarx yo'q"
        : "Uskuna: tanlanmagan";
    const laborPart =
      opCost.laborBasis === "piecework"
        ? `Mehnat: sdelka ${money((Number(form.pieceworkTotalUsd) || 0) / fx)}${
            opCost.laborMultiplier !== 1 ? ` × ${opCost.laborMultiplier}` : ""
          }`
        : opCost.laborBasis === "employees"
        ? `Mehnat: ${form.duration} soat × ${money(opCost.laborRateUsd)} (operatorlar)`
        : opCost.laborBasis === "crew"
        ? `Mehnat: ${form.duration} soat × ${money(opCost.laborRateUsd)} (ekipaj)`
        : "Mehnat: stavka yo'q";
    return `${machinePart}. ${laborPart}.`;
  })();

  // Legacy steps carry only a machine name: pin the registry id once it resolves.
  React.useEffect(() => {
    if (isOpen && resolvedMachine && form.machineId !== resolvedMachine.id) {
      setForm((p) => ({ ...p, machineId: resolvedMachine.id }));
    }
  }, [isOpen, resolvedMachine, form.machineId, setForm]);

  const applyDuration = (hours: number) => {
    setDurationInput(String(hours));
    if (form.calcUnit === "1 hour") {
      handleRecalculateCosts({ duration: hours });
    } else {
      setForm((p) => ({ ...p, duration: hours }));
    }
  };

  // Operations added to the catalog from this dialog: they learn their default machine from the step.
  const createdOperationIds = React.useRef<Set<string>>(new Set());

  const handleSelectMachine = (val: string) => {
    const byId = machines.find((m) => m.id === val);
    const linkedOp = workRates.find((w) => w.id === form.workRateId);
    if (byId && linkedOp && createdOperationIds.current.has(linkedOp.id) && linkedOp.defaultMachineId !== byId.id) {
      void useWorkspaceStore.getState().saveWorkRate({
        ...linkedOp,
        defaultMachineId: byId.id,
        department: byId.department || "",
      });
    }
    const name = byId ? byId.name : val;
    // The machine's lead operator is filled in only when HR knows them: costing reads their wage.
    const lead = byId?.leadOperator?.trim();
    const leadInHr = Boolean(
      lead && Array.isArray(employees) && employees.some((e) => e.status !== "terminated" && e.fullName === lead)
    );
    const autoOps =
      (!form.operators || form.operators.length === 0) && !form.operator && lead && leadInHr
        ? [lead]
        : form.operators;
    const estimate = estimateOperationHours(byId || null, plannedSheets, orderQuantity);
    setForm((p) => ({
      ...p,
      machine: name,
      machineId: byId?.id,
      operators: autoOps,
      operator: autoOps && autoOps.length > 0 ? autoOps.join(", ") : p.operator,
      ...(estimate ? { duration: estimate.hours } : {}),
    }));
    if (estimate) setDurationInput(String(estimate.hours));
  };

  // ── Piecework from the work-rate list (Ish turlari) ─────────────────────────
  const selectedWorkRate = React.useMemo(
    () => workRates.find((w) => w.id === form.workRateId) || null,
    [workRates, form.workRateId]
  );
  // Catalog operations offered in the picker (archived ones only when already on the step).
  const operationOptions = React.useMemo(
    () =>
      workRates
        .filter((w) => w.status === "Active" || w.id === form.workRateId)
        .map((w) => {
          const dept = operationDepartment(w, machines);
          return { value: w.id, label: dept ? `${w.code} — ${w.name} (${dept})` : `${w.code} — ${w.name}` };
        }),
    [workRates, machines, form.workRateId]
  );

  // Optional note appended to the catalog name: "UF lak (selektiv)".
  const operationNote = React.useMemo(() => {
    if (!selectedWorkRate || !form.name?.startsWith(selectedWorkRate.name)) return "";
    const rest = form.name.slice(selectedWorkRate.name.length).trim();
    return rest.replace(/^\((.*)\)$/, "$1");
  }, [selectedWorkRate, form.name]);

  // Legacy steps carry only a name: link the catalog operation with the same name.
  React.useEffect(() => {
    if (!isOpen || form.workRateId || !form.name) return;
    const clean = form.name.trim().toLowerCase();
    const match = workRates.find((w) => {
      const n = w.name.trim().toLowerCase();
      return clean === n || clean.startsWith(`${n} (`);
    });
    if (match) setForm((p) => ({ ...p, workRateId: match.id }));
  }, [isOpen, form.workRateId, form.name, workRates, setForm]);

  const operatorCount =
    form.operators && form.operators.length > 0
      ? form.operators.length
      : (form.operator || "").split(",").filter((x) => x.trim()).length;

  // Lead rate + assistant rate for every additional operator, per the work type's unit, in the order currency.
  React.useEffect(() => {
    if (!selectedWorkRate) return;
    const { leadRateUsd, totalUsd } = catalogPieceworkUsd(selectedWorkRate, {
      orderQuantity,
      plannedSheets,
      duration: form.duration,
      operatorCount,
      exchangeRate,
    });
    const lead = leadRateUsd * fx;
    const total = totalUsd * fx;
    const rate = Number(lead.toFixed(isUsd ? 4 : 2));
    const fund = isUsd ? Number(total.toFixed(2)) : Math.round(total);
    if (form.pieceworkRateUsd !== rate || form.pieceworkTotalUsd !== fund) {
      setForm((p) => ({ ...p, pieceworkRateUsd: rate, pieceworkTotalUsd: fund }));
    }
  }, [selectedWorkRate, form.duration, form.pieceworkRateUsd, form.pieceworkTotalUsd, operatorCount, orderQuantity, plannedSheets, isUsd, exchangeRate, fx, setForm]);

  // What the piecework fund is counted from: the catalog operation's unit and the order's quantity.
  const pieceworkBasis = React.useMemo(() => {
    if (!selectedWorkRate) return null;
    const unit = selectedWorkRate.unit;
    const divisor = Math.max(1, selectedWorkRate.unitDivisor || 1);
    const qty = resolveCalcBaseQty(unit, orderQuantity, plannedSheets, form.duration);
    const source =
      unit === "1 hour" ? "soat" : unit && SHEET_BASED_UNITS.has(unit) && plannedSheets > 0 ? "varaq" : "dona";
    return { unit, unitLabel: calcUnitLabel(unit), qty, divisor, units: qty / divisor, source };
  }, [selectedWorkRate, orderQuantity, plannedSheets, form.duration]);

  // Machine card fields the cost cannot be exact without.
  const machineGaps = React.useMemo(() => machineCostingGaps(resolvedMachine), [resolvedMachine]);

  // Rates frozen on the step vs today's machine card: offer a refresh when the card has moved on.
  const staleRates = React.useMemo(() => {
    const frozen = frozenRatesFor(form, resolvedMachine);
    if (!frozen || !resolvedMachine) return null;
    const live = getMachineCostRates(resolvedMachine);
    const moved =
      Math.abs(live.machineRate - (Number(frozen.machineRateUsd) || 0)) > 0.0001 ||
      Math.abs(live.crewRate - (Number(frozen.crewRateUsd) || 0)) > 0.0001;
    return moved ? { frozen, live } : null;
  }, [form, resolvedMachine]);
  const refreshRates = () => {
    if (resolvedMachine) setForm((p) => ({ ...p, costRates: freezeMachineRates(resolvedMachine) }));
  };

  // Cost formula lines shown under the total: every number the cost is made of, in the order currency.
  const costLines = (() => {
    if (costMode !== "auto") return [];
    const cur = (v: number) => formatMoney(v, currency, moneyDecimals);
    const hours = Number(form.duration) || 0;
    const machineLine =
      opCost.machineRateUsd > 0
        ? { label: "Uskuna", formula: `${hours} soat × ${money(opCost.machineRateUsd)}/soat`, total: opCost.machineCostUsd }
        : { label: "Uskuna", formula: resolvedMachine ? "kartada soatlik tannarx yo'q" : "tanlanmagan", total: 0 };

    let laborFormula = "stavka yo'q";
    if (opCost.laborBasis === "piecework") {
      const fund = Number(form.pieceworkTotalUsd) || 0;
      const mult = opCost.laborMultiplier !== 1 ? ` × ${opCost.laborMultiplier} (razryad)` : "";
      if (pieceworkBasis && pieceworkBasis.units > 0) {
        const perUnit = fund / pieceworkBasis.units;
        const qtyPart =
          pieceworkBasis.divisor > 1
            ? `${formatNumberWithSpaces(pieceworkBasis.qty)} ${pieceworkBasis.source} ÷ ${formatNumberWithSpaces(pieceworkBasis.divisor)}`
            : `${formatNumberWithSpaces(pieceworkBasis.qty, pieceworkBasis.unit === "1 hour" ? 1 : 0)} ${pieceworkBasis.source}`;
        laborFormula = `sdelka: ${qtyPart} × ${cur(perUnit)} / ${pieceworkBasis.unitLabel}${mult}`;
      } else {
        laborFormula = `sdelka: ${cur(fund)}${mult}`;
      }
    } else if (opCost.laborBasis === "employees") {
      laborFormula = `${hours} soat × ${money(opCost.laborRateUsd)}/soat (operatorlar maoshi)`;
    } else if (opCost.laborBasis === "crew") {
      laborFormula = `${hours} soat × ${money(opCost.laborRateUsd)}/soat (uskuna ekipaji)`;
    }
    return [machineLine, { label: "Mehnat", formula: laborFormula, total: opCost.laborCostUsd }];
  })();

  const handleSelectOperation = (val: string) => {
    const op = workRates.find((w) => w.id === val);
    if (!op) {
      // Typed name (being added to the catalog): no piecework until it is linked.
      setForm((p) => ({ ...p, name: val, workRateId: undefined, pieceworkRateUsd: 0, pieceworkTotalUsd: 0 }));
      return;
    }
    setForm((p) => ({ ...p, workRateId: op.id, name: op.name }));
    // A new step takes the operation's default machine (and its norm hours).
    if (op.defaultMachineId && (editingOpIndex === null || !form.machine)) {
      handleSelectMachine(op.defaultMachineId);
    }
  };

  const handleAddOperation = async (name: string) => {
    const saved = await useWorkspaceStore.getState().saveWorkRate({
      name,
      department: resolvedMachine?.department || "",
      defaultMachineId: resolvedMachine?.id || null,
      unit: "1,000 sheets",
      unitDivisor: 1000,
      currency: "UZS",
      pieceRate: 0,
      helperPieceRate: 0,
      status: "Active",
    });
    if (!saved) return;
    createdOperationIds.current.add(saved.id);
    setForm((p) => (p.name === name ? { ...p, workRateId: saved.id } : p));
  };

  const handleNoteChange = (note: string) => {
    const base = selectedWorkRate?.name || form.name;
    setForm((p) => ({ ...p, name: note.trim() ? `${base} (${note.trim()})` : base }));
  };

  // Keeps a template's tariff price in step with the hours when the tariff is billed per hour.
  const handleRecalculateCosts = (overrides: Partial<RouteStep>) => {
    const activeRate = overrides.rateUsd !== undefined ? overrides.rateUsd : form.rateUsd ?? 0;
    const activeSetup = overrides.setupFeeUsd !== undefined ? overrides.setupFeeUsd : form.setupFeeUsd ?? 0;
    const activeDivisor = overrides.unitDivisor !== undefined ? overrides.unitDivisor : form.unitDivisor ?? 1000;
    const activeUnit = overrides.calcUnit !== undefined ? overrides.calcUnit : form.calcUnit;
    const activeDuration = overrides.duration !== undefined ? overrides.duration : form.duration;

    const qty = resolveCalcBaseQty(activeUnit, orderQuantity, plannedSheets, activeDuration);
    const divisor = activeDivisor > 0 ? activeDivisor : 1;
    const chargeableUnits = qty / divisor;

    const runCost = isUsd ? Number((chargeableUnits * activeRate).toFixed(2)) : Math.round(chargeableUnits * activeRate);
    const plannedCostUsd = isUsd ? Number((activeSetup + runCost).toFixed(2)) : Math.round(activeSetup + runCost);

    setForm((p) => ({
      ...p,
      ...overrides,
      plannedCostUsd,
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
          department: "HR'da yo'q",
          initials: getOperatorInitials(name),
          inHr: false,
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
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1.5">
          {/* Operation */}
          <div>
            <div>
              <label className="text-xs font-medium flex items-center mb-1">
                <span>Operatsiya *</span>
                <FieldInfoTooltip text="Operatsiyalar spravochnigidan tanlanadi: nom, standart uskuna va sdelka stavkasi shundan olinadi. Ro'yxatda yo'q bo'lsa, nomini yozib ro'yxatga qo'shing." />
              </label>
              <FieldCombobox
                value={form.workRateId || form.name || ""}
                onChange={handleSelectOperation}
                onAddNew={handleAddOperation}
                allowCustom
                addCustomLabel={(v) => `Ro'yxatga qo'shish: "${v}"`}
                options={operationOptions}
                placeholder="Operatsiyani tanlang..."
                searchPlaceholder="Operatsiya nomi yoki kodi..."
                className="h-8 text-xs font-medium"
                popoverClassName="w-[420px]"
              />
            </div>
          </div>

          {/* Machine */}
          <div>
            <div className="space-y-1">
              <label className="text-xs font-medium block">
                Uskuna / Ish markazi *
              </label>
              <FieldCombobox
                value={resolvedMachine?.id || form.machine}
                onChange={handleSelectMachine}
                allowCustom
                options={machineOptions}
                placeholder="Uskunani tanlang..."
                searchPlaceholder="Uskunalarni qidirish..."
                className="h-8 text-xs"
                popoverClassName="w-[360px]"
              />
            </div>
          </div>

          {/* Operators: moved up, before the optional block */}
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
                        const unknown = op?.inHr === false;
                        return (
                          <ComboboxChip
                            key={val}
                            title={unknown ? "HR'da yo'q" : undefined}
                            className={cn(
                              "!h-7 py-0.5 pl-1 pr-1.5 gap-1.5 rounded-md bg-muted/80 hover:bg-muted border border-border text-xs font-medium shrink-0 inline-flex items-center shadow-xs transition-colors",
                              unknown && "border-amber-500/60 bg-amber-500/10"
                            )}
                          >
                            {unknown && <TriangleAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-500" />}
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

          {/* Collapsed summary of the auto-filled values */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-2.5 h-8 text-xs cursor-pointer hover:bg-muted/40"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <ChevronDown className={cn("size-3.5 transition-transform", !showMore && "-rotate-90")} />
              Qo&apos;shimcha
            </span>
            <span className="font-mono text-muted-foreground truncate">
              {Number(form.duration) || 0} soat · {money(opCost.totalUsd)}
            </span>
          </button>

          {showMore && <div className="space-y-3">
          <div className="grid grid-cols-6 gap-2.5">
            <div>
              <label className="text-xs font-medium block mb-1">Tartib #</label>
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
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1">Me&apos;yoriy vaqt (soat)</label>
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
                  applyDuration(!Number.isNaN(parsed) && parsed > 0 ? parsed : 0.5);
                }}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-medium block mb-1">Izoh</label>
              <Input
                value={operationNote}
                disabled={!selectedWorkRate}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Ixtiyoriy"
                className="h-8 text-xs"
              />
            </div>
            {durationEstimate && (
              <div className="col-span-6 -mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground font-mono">
                <span>
                  {durationEstimate.throughput.makeReadyMinutes} daq + {formatNumberWithSpaces(durationEstimate.qty)} ÷{" "}
                  {formatNumberWithSpaces(durationEstimate.throughput.perHour)}{" "}
                  {THROUGHPUT_UNIT_LABEL[durationEstimate.throughput.unit]}/soat = {durationEstimate.hours} soat
                </span>
                {durationEstimate.hours !== Number(form.duration) && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => applyDuration(durationEstimate.hours)}
                          className="inline-flex items-center justify-center size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                        </button>
                      }
                    />
                    <TooltipContent side="top" className="text-xs">
                      Me&apos;yorni qo&apos;llash
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {form.status === "Finished" && (
            <div className="flex items-center justify-end gap-2 -mt-1">
              <label className="text-xs font-medium flex items-center">
                <span>Fakt vaqt (soat)</span>
                <FieldInfoTooltip text="Bosqich boshlanishidan tugashigacha, to'xtalishlar chiqarilgan holda. Smenalar orasidagi tanaffus kirib qolgan bo'lsa, shu yerda tuzating — fakt tannarx shundan hisoblanadi." />
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.actualDurationMinutes !== undefined && form.actualDurationMinutes !== null ? String(Number((form.actualDurationMinutes / 60).toFixed(2))) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const hours = parseFloat(raw);
                  setForm((p) => ({
                    ...p,
                    actualDurationMinutes: raw === "" || Number.isNaN(hours) ? undefined : Math.max(0, Math.round(hours * 60)),
                  }));
                }}
                placeholder="—"
                className="h-8 w-28 text-xs font-mono"
              />
            </div>
          )}

          {/* Technological Tooling & Step Status */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className={cn("space-y-1", editingOpIndex !== null ? "col-span-2" : "col-span-3")}>
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

            {editingOpIndex !== null && (
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
            )}
          </div>
          {/* Planned cost: one read-only line; outsourced / manual only on request */}
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center text-muted-foreground">
                <span>Tannarx</span>
                {costMode !== "auto" && <FieldInfoTooltip text={costBreakdownText} />}
              </span>
              <span className="flex items-center gap-2 min-w-0">
                <strong className="font-mono text-foreground shrink-0">{money(opCost.totalUsd)}</strong>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, costMode: costMode === "auto" ? "outsourced" : "auto" }))}
                  className="text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                >
                  {costMode === "auto" ? "Autsors" : "Avto"}
                </button>
              </span>
            </div>

            {costLines.length > 0 && (
              <div className="space-y-0.5 border-t border-border/60 pt-1.5">
                {costLines.map((line) => (
                  <div key={line.label} className="flex items-center gap-2 text-[11px] min-w-0">
                    <span className="w-14 shrink-0 text-muted-foreground inline-flex items-center gap-1">
                      {line.label}
                      {line.label === "Uskuna" && machineGaps.length > 0 && (
                        <span title={`Kartada to'ldirilmagan: ${machineGaps.map((g) => g.label).join(", ")}`}>
                          <TriangleAlert className="size-3 text-amber-600 dark:text-amber-500" />
                        </span>
                      )}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-mono text-muted-foreground" title={line.formula}>
                      {line.formula}
                    </span>
                    {line.label === "Uskuna" && staleRates && (
                      <button
                        type="button"
                        onClick={refreshRates}
                        title={`Qotirilgan ${new Date(staleRates.frozen.frozenAt).toLocaleDateString("uz-UZ")}: ${money(
                          Number(staleRates.frozen.machineRateUsd) || 0
                        )}/soat. Kartada: ${money(staleRates.live.machineRate)}/soat`}
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        <RefreshCw className="size-3" />
                        <span>Yangilash</span>
                      </button>
                    )}
                    <span className="shrink-0 font-mono text-foreground">{money(line.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {costMode !== "auto" && (
              <div className="grid grid-cols-[auto_1fr_8rem] items-end gap-2">
                <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5 h-7">
                  {(["outsourced", "manual"] as const).map((mode) => {
                    const locked = mode === "manual" && !canOverrideCost && costMode !== "manual";
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={locked}
                        title={locked ? "Faqat rahbar" : undefined}
                        onClick={() => setForm((p) => ({ ...p, costMode: mode }))}
                        className={cn(
                          "h-5.5 px-2 rounded text-[11px] font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                          costMode === mode ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {COST_MODE_LABEL[mode]}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={form.costNote || ""}
                  onChange={(e) => setForm((p) => ({ ...p, costNote: e.target.value }))}
                  placeholder={costMode === "outsourced" ? "Yetkazib beruvchi" : "Sabab *"}
                  className={cn("h-7 text-xs", needsReason && "border-destructive/60")}
                />
                <MoneyInput
                  thousandSeparator=" "
                  decimalScale={moneyDecimals}
                  value={form.manualCostUsd ?? 0}
                  onValueChange={(values) => setForm((p) => ({ ...p, manualCostUsd: values.floatValue ?? 0 }))}
                  className="h-7 text-xs font-mono"
                />
              </div>
            )}
          </div>
          </div>}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Bekor qilish
          </Button>
          {editingOpIndex === null && onSaveAndNext && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveAndNext}
              disabled={!form.name?.trim() || needsReason}
              className="h-8 text-xs"
            >
              Qo&apos;shish va keyingisi
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={!form.name?.trim() || needsReason}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {editingOpIndex !== null ? "Saqlash" : "Qo'shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
