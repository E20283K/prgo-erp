import type { MachineRecord } from "./types";
import { getMachineThroughput } from "@/components/documents/work-order/utils/operationCost";

/** Machine card section a missing field lives in (MachineDetail tab id). */
export type MachineCardTab = "overview" | "energy" | "costing";

export interface MachineCostingGap {
  key: "category" | "speed" | "makeReady" | "investment" | "annualHours" | "power";
  label: string;
  tab: MachineCardTab;
}

/** Categories whose spec block has no make-ready time (a guillotine cuts without one). */
const NO_MAKE_READY = new Set(["guillotine"]);

/**
 * Fields the order costing reads from a machine card and cannot do without:
 * the hourly rate (investment, yearly hours, power) and the norm hours (category, speed, make-ready).
 * Empty list = the card is complete enough for costing.
 */
export function machineCostingGaps(machine: MachineRecord | null | undefined): MachineCostingGap[] {
  if (!machine) return [];
  const gaps: MachineCostingGap[] = [];

  if (!machine.category) {
    gaps.push({ key: "category", label: "Texnologik kategoriya", tab: "overview" });
  } else {
    const tp = getMachineThroughput(machine);
    if (!tp) gaps.push({ key: "speed", label: "Amaliy tezlik", tab: "overview" });
    else if (!(tp.makeReadyMinutes > 0) && !NO_MAKE_READY.has(machine.category)) {
      gaps.push({ key: "makeReady", label: "Pril'adka vaqti", tab: "overview" });
    }
  }

  const c = machine.costing;
  if (!(Number(c?.investmentUsd) > 0)) gaps.push({ key: "investment", label: "Uskuna qiymati", tab: "costing" });
  if (!(Number(c?.annualWorkHours) > 0)) gaps.push({ key: "annualHours", label: "Yillik ish soati", tab: "costing" });
  if (!(Number(machine.energy?.activePowerKw) > 0)) gaps.push({ key: "power", label: "Faol quvvat", tab: "energy" });

  return gaps;
}
