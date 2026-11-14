import type { RouteStep, ShiftEvent } from "../types";

/**
 * A route step's state machine, read from its shift-journal events:
 *   queued → setup → run ⇄ paused (open downtime) → finished
 * The journal is the source of truth; the step's status fields are derived from it.
 */

export type StepPhase = "queued" | "setup" | "run" | "paused" | "finished";

export const TRANSITION_TYPES: ReadonlyArray<ShiftEvent["type"]> = ["SetupStart", "RunStart", "Finish", "Correction"];

export const isDowntimeEvent = (ev: Pick<ShiftEvent, "type">) => ev.type === "Delay" || ev.type === "Maintenance";

/** A downtime with no duration yet is still going on. */
export const isOpenDowntime = (ev: ShiftEvent) =>
  isDowntimeEvent(ev) && (ev.downtimeDurationMinutes === undefined || ev.downtimeDurationMinutes === null);

export interface StepTimeline {
  phase: StepPhase;
  /** The step has transition events (new flow); legacy steps keep their stored status. */
  hasTransitions: boolean;
  setupStartedAt?: string;
  runStartedAt?: string;
  finishedAt?: string;
  openDowntime?: ShiftEvent;
  setupMinutes: number;
  runMinutes: number;
  /** Closed downtime plus the open one up to now. */
  downtimeMinutes: number;
  /** Closed downtime only (what the step record keeps). */
  closedDowntimeMinutes: number;
  /** Good output from output reports. */
  reportedGood: number;
}

const ms = (iso?: string) => (iso ? new Date(iso).getTime() : NaN);
const minutesBetween = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b > a ? (b - a) / 60000 : 0);

export function getStepTimeline(stepEvents: ShiftEvent[], now: number = Date.now()): StepTimeline {
  const events = [...stepEvents]
    .filter((ev) => ev.occurredAt)
    .sort((a, b) => (a.occurredAt || "").localeCompare(b.occurredAt || ""));

  let phase: StepPhase = "queued";
  let setupStartedAt: string | undefined;
  let runStartedAt: string | undefined;
  let finishedAt: string | undefined;
  let hasTransitions = false;

  for (const ev of events) {
    if (!TRANSITION_TYPES.includes(ev.type)) continue;
    hasTransitions = true;
    if (ev.type === "SetupStart") {
      setupStartedAt = setupStartedAt || ev.occurredAt;
      phase = "setup";
    } else if (ev.type === "RunStart") {
      runStartedAt = runStartedAt || ev.occurredAt;
      phase = "run";
    } else if (ev.type === "Finish") {
      finishedAt = ev.occurredAt;
      phase = "finished";
    } else if (ev.type === "Correction") {
      if (ev.toStatus === "Queued") {
        setupStartedAt = runStartedAt = finishedAt = undefined;
        phase = "queued";
      } else if (ev.toStatus === "Finished") {
        finishedAt = ev.occurredAt;
        phase = "finished";
      } else if (ev.toStatus === "In Progress" || ev.toStatus === "Paused") {
        runStartedAt = runStartedAt || ev.occurredAt;
        finishedAt = undefined;
        phase = "run";
      }
    }
  }

  const downtimes = events.filter(isDowntimeEvent);
  const openDowntime = phase !== "finished" && phase !== "queued" ? downtimes.filter(isOpenDowntime).pop() : undefined;
  if (openDowntime) phase = "paused";

  const end = finishedAt ? ms(finishedAt) : now;
  const dtStart = (ev: ShiftEvent) => ms(ev.occurredAt);
  const dtMinutes = (ev: ShiftEvent) =>
    isOpenDowntime(ev) ? minutesBetween(dtStart(ev), Math.min(now, end)) : Number(ev.downtimeDurationMinutes) || 0;
  const downtimeIn = (from: number, to: number) =>
    downtimes.filter((ev) => dtStart(ev) >= from && dtStart(ev) < to).reduce((s, ev) => s + dtMinutes(ev), 0);

  const setupFrom = ms(setupStartedAt);
  const setupTo = runStartedAt ? ms(runStartedAt) : end;
  const runFrom = ms(runStartedAt);
  const setupMinutes = setupStartedAt ? Math.max(0, minutesBetween(setupFrom, setupTo) - downtimeIn(setupFrom, setupTo)) : 0;
  const runMinutes = runStartedAt ? Math.max(0, minutesBetween(runFrom, end) - downtimeIn(runFrom, end)) : 0;

  return {
    phase,
    hasTransitions,
    setupStartedAt,
    runStartedAt,
    finishedAt,
    openDowntime,
    setupMinutes: Math.round(setupMinutes),
    runMinutes: Math.round(runMinutes),
    downtimeMinutes: Math.round(downtimes.reduce((s, ev) => s + dtMinutes(ev), 0)),
    closedDowntimeMinutes: Math.round(
      downtimes.filter((ev) => !isOpenDowntime(ev)).reduce((s, ev) => s + (Number(ev.downtimeDurationMinutes) || 0), 0)
    ),
    reportedGood: events.filter((ev) => ev.type === "Run").reduce((s, ev) => s + (Number(ev.goodQty) || 0), 0),
  };
}

const PHASE_STATUS: Record<StepPhase, RouteStep["status"]> = {
  queued: "Queued",
  setup: "In Progress",
  run: "In Progress",
  paused: "Paused",
  finished: "Finished",
};

/**
 * The step's stored fields as its journal says they are. Returns the same object when nothing changes;
 * steps without transition events (older orders) are left as they are.
 */
export function applyTimelineToStep(op: RouteStep, timeline: StepTimeline): RouteStep {
  if (!timeline.hasTransitions || op.kind === "packaging") return op;
  const next: RouteStep = {
    ...op,
    status: PHASE_STATUS[timeline.phase],
    phase: timeline.phase === "setup" ? "setup" : timeline.phase === "run" || timeline.phase === "paused" ? "run" : undefined,
    // Older steps started before the journal kept transitions: keep their recorded start.
    startedAt: timeline.setupStartedAt || timeline.runStartedAt || op.startedAt,
    completedAt: timeline.finishedAt,
    pausedAt: timeline.openDowntime?.occurredAt,
    downtimeMinutes: timeline.closedDowntimeMinutes,
    actualDurationMinutes:
      timeline.phase === "finished" && (timeline.setupStartedAt || timeline.runStartedAt)
        ? timeline.setupMinutes + timeline.runMinutes
        : op.actualDurationMinutes,
  };
  const same = (Object.keys(next) as (keyof RouteStep)[]).every((k) => next[k] === op[k]);
  return same ? op : next;
}

/** Good output of a step: its output reports, else its "done / planned" counter (older orders). */
export function stepGoodOutput(op: RouteStep, stepEvents: ShiftEvent[]): number {
  const reported = stepEvents.filter((ev) => ev.type === "Run").reduce((s, ev) => s + (Number(ev.goodQty) || 0), 0);
  if (reported > 0) return reported;
  const parsed = parseInt((op.qtyCompleted || "").split("/")[0].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}s ${String(m % 60).padStart(2, "0")}d` : `${m}d`;
}
