import type { MachineRecord } from "@/components/documents/machine/types";
import type { RouteStep, ShiftEvent } from "../types";
import { calcUnitLabel, getMachineThroughput } from "./operationCost";
import type { StepTimeline } from "./stepTimeline";

/**
 * Shop-floor indicators of one route step, in the step's own unit:
 * plan vs fact, speed vs norm, scrap and OEE (availability × performance × quality).
 */

const THROUGHPUT_UNIT_LABEL: Record<string, string> = {
  sheet: "varaq",
  meter: "metr",
  pick: "zarb",
  cut: "kesim",
  book: "kitob",
};

export interface StepKpis {
  unit: string;
  plan: number;
  good: number;
  input: number;
  makeReady: number;
  defect: number;
  /** Good output against plan, 0..1 (can pass 1). */
  completion: number;
  /** (make-ready + defect) / input, 0..1; null without input. */
  scrapRate: number | null;
  /** Good output per run hour; null before any run time. */
  speedPerHour: number | null;
  /** Machine's practical speed, else plan / planned hours. */
  normPerHour: number | null;
  normSource: "machine" | "plan" | null;
  plannedMinutes: number;
  /** Make-ready + run + downtime so far. */
  actualMinutes: number;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Unit the step counts in: the machine's speed unit, else the catalog operation's unit, else pieces. */
export function stepUnit(machine: MachineRecord | null, catalogUnit?: string): string {
  const tp = getMachineThroughput(machine);
  if (tp) return THROUGHPUT_UNIT_LABEL[tp.unit] || tp.unit;
  // "1,000 varaq" → "varaq", "1 soat ish vaqti" → "soat"
  if (catalogUnit) return calcUnitLabel(catalogUnit).replace(/^1(,000)?\s+/, "").split(" ")[0] || "dona";
  return "dona";
}

export function getStepKpis(
  op: RouteStep,
  stepEvents: ShiftEvent[],
  timeline: StepTimeline,
  machine: MachineRecord | null,
  catalogUnit?: string
): StepKpis {
  const reports = stepEvents.filter((ev) => ev.type === "Run");
  const sum = (pick: (ev: ShiftEvent) => number | undefined) => reports.reduce((s, ev) => s + (Number(pick(ev)) || 0), 0);
  const counter = (op.qtyCompleted || "").split("/");
  const parse = (v?: string) => parseInt((v || "").replace(/[^\d]/g, ""), 10) || 0;

  const plan = parse(counter[1]);
  const reportedGood = sum((ev) => ev.goodQty);
  const good = reportedGood > 0 ? reportedGood : parse(counter[0]);
  const makeReady = sum((ev) => ev.makeReadyQty);
  const defect = sum((ev) => ev.defectQty);
  const inputRaw = sum((ev) => ev.inputQty);
  const input = inputRaw > 0 ? inputRaw : good + makeReady + defect;

  const runHours = timeline.runMinutes / 60;
  const plannedMinutes = Math.round((Number(op.duration) || 0) * 60);
  const tp = getMachineThroughput(machine);
  const normPerHour = tp?.perHour || (plan > 0 && op.duration > 0 ? plan / op.duration : null);
  const normSource = tp?.perHour ? "machine" : normPerHour ? "plan" : null;

  // OEE: time lost to make-ready and downtime (availability), slow running (performance), scrap (quality).
  const loading = timeline.setupMinutes + timeline.runMinutes + timeline.downtimeMinutes;
  const availability = timeline.runMinutes > 0 ? ratio(timeline.runMinutes, loading) : null;
  const produced = good + defect;
  const performance =
    runHours > 0 && normPerHour ? Math.min(1, produced / (runHours * normPerHour)) : null;
  const quality = produced + makeReady > 0 ? good / (produced + makeReady) : null;
  const oee =
    availability !== null && performance !== null && quality !== null ? availability * performance * quality : null;

  return {
    unit: stepUnit(machine, catalogUnit),
    plan,
    good,
    input,
    makeReady,
    defect,
    completion: plan > 0 ? good / plan : 0,
    scrapRate: input > 0 && makeReady + defect > 0 ? (makeReady + defect) / input : input > 0 ? 0 : null,
    speedPerHour: runHours > 0 ? good / runHours : null,
    normPerHour: normPerHour ? Math.round(normPerHour) : null,
    normSource,
    plannedMinutes,
    actualMinutes: Math.round(loading),
    availability,
    performance,
    quality,
    oee,
  };
}

/** Colour band for a 0..1 score: world-class OEE is about 0.85. */
export function scoreTone(v: number | null, good = 0.85, fair = 0.6): "good" | "fair" | "poor" | "none" {
  if (v === null) return "none";
  return v >= good ? "good" : v >= fair ? "fair" : "poor";
}

export const pct = (v: number | null, digits = 0) => (v === null ? "—" : `${(v * 100).toFixed(digits)}%`);
