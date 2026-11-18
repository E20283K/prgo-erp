import type { MachineRecord } from "@/components/documents/machine/types";
import {
  employeeHourlyWageUzs,
  getMachineThroughput,
  type CostEmployee,
} from "@/components/documents/work-order/utils/operationCost";

/** Throughput unit a catalog unit is counted in; "hour" needs no speed. */
const UNIT_THROUGHPUT: Record<string, "sheet" | "meter" | "book" | "hour"> = {
  "1,000 sheets": "sheet",
  "1,000 impressions": "sheet",
  "1,000 strokes": "sheet",
  "1,000 glue passes": "sheet",
  "1,000 linear meters": "meter",
  "1,000 finished pcs": "book",
  "1 hour": "hour",
};

export interface WageSource {
  /** Hourly wage in the rate currency. */
  hourly: number;
  /** Employee name, or "karta" when the machine card's crew wage was used. */
  source: string;
}

export interface PieceRateSuggestion {
  pieceRate: number;
  helperPieceRate: number;
  /** Hours one unit takes at the machine's practical speed (make-ready excluded). */
  normHours: number;
  lead: WageSource;
  helper: WageSource | null;
}

export type PieceRateResult = { ok: true; value: PieceRateSuggestion } | { ok: false; error: string };

/**
 * Piece rate = operator hourly wage × norm hours per unit, the way 1C derives "сдельные расценки".
 * Norm hours come from the machine's practical speed; wages from HR (the machine's lead and assistant
 * operators), falling back to the crew wages on the machine card.
 */
export function suggestPieceRates(input: {
  unit: string;
  unitDivisor: number;
  currency: string;
  machine: MachineRecord | null;
  employees: CostEmployee[];
  exchangeRate?: number;
  productiveTimePercent?: number;
}): PieceRateResult {
  const { unit, machine, employees } = input;
  const kind = UNIT_THROUGHPUT[unit];
  if (!kind) return { ok: false, error: "Bu birlik uchun norma-vaqt hisoblanmaydi" };
  if (!machine) return { ok: false, error: "Standart uskuna tanlanmagan" };

  let normHours = 1;
  if (kind !== "hour") {
    const tp = getMachineThroughput(machine);
    if (!tp || tp.unit !== kind) return { ok: false, error: "Uskuna kartasida tezlik yo'q" };
    normHours = Math.max(1, Number(input.unitDivisor) || 1) / tp.perHour;
  }

  const fx = Number(input.exchangeRate) || 12850;
  const isUsd = (input.currency || "UZS").toUpperCase() === "USD";
  const fromUzs = (v: number) => (isUsd ? v / fx : v);
  const fromUsd = (v: number) => (isUsd ? v : v * fx);
  const staff = employees.filter((e) => e.status !== "terminated");

  const wageOf = (name: string | undefined, cardUsd: number): WageSource | null => {
    const emp = name ? staff.find((e) => e.fullName === name.trim()) : undefined;
    const hr = emp ? employeeHourlyWageUzs(emp, input.productiveTimePercent) : 0;
    if (emp && hr > 0) return { hourly: fromUzs(hr), source: emp.fullName };
    if (cardUsd > 0) return { hourly: fromUsd(cardUsd), source: "karta" };
    return null;
  };

  const c = machine.costing;
  const lead = wageOf(machine.leadOperator, Number(c?.operatorHourlyWageUsd) || 0);
  if (!lead) return { ok: false, error: "Operator maoshi topilmadi" };
  const helper = wageOf(machine.assistantOperator, Number(c?.assistantHourlyWageUsd) || 0);

  const round = (v: number) => (isUsd ? Number(v.toFixed(4)) : Math.round(v));
  return {
    ok: true,
    value: {
      pieceRate: round(lead.hourly * normHours),
      helperPieceRate: helper ? round(helper.hourly * normHours) : 0,
      normHours,
      lead,
      helper,
    },
  };
}
