import type { RouteStep, ShiftEvent } from "../types";
import { getStepTimeline, stepGoodOutput } from "./stepTimeline";

/**
 * Journal entries of a sample run are moved off the route when the mass run is released:
 * their step id gets this prefix, so step status, output, sequencing and piecework sync
 * (all keyed by the step id) only see the mass run. Piecework already accrued for them stays.
 */
export const SAMPLE_OP_PREFIX = "sample:";

export const isSampleEvent = (ev: Pick<ShiftEvent, "opId">) => (ev.opId || "").startsWith(SAMPLE_OP_PREFIX);

/** Entries that happened on the route up to the release moment belong to the sample run. */
export function moveSampleEvents(events: ShiftEvent[], releasedAt?: string): ShiftEvent[] {
  const cut = releasedAt ? Date.parse(releasedAt) : NaN;
  if (!Number.isFinite(cut)) return events;
  let changed = false;
  const next = events.map((ev) => {
    if (!ev.opId || isSampleEvent(ev)) return ev;
    const at = ev.occurredAt ? Date.parse(ev.occurredAt) : NaN;
    if (!(at <= cut)) return ev;
    changed = true;
    return { ...ev, opId: `${SAMPLE_OP_PREFIX}${ev.opId}` };
  });
  return changed ? next : events;
}

/**
 * What the sample run did on each step, kept when the mass run is released: the step as a finished
 * run with the sample's hours and good output, so its actual cost can be shown as the sample cost.
 */
export function buildSampleRunSteps(operations: RouteStep[], events: ShiftEvent[]): RouteStep[] {
  return operations.flatMap((op) => {
    if (op.kind === "packaging") return [];
    const stepEvents = events.filter((ev) => ev.opId === op.id);
    const tl = getStepTimeline(stepEvents);
    const minutes =
      tl.setupMinutes + tl.runMinutes > 0 ? tl.setupMinutes + tl.runMinutes : Number(op.actualDurationMinutes) || 0;
    const good = stepGoodOutput(op, stepEvents);
    if (minutes <= 0 && good <= 0) return [];
    const plannedText = (op.qtyCompleted || "").split("/")[1]?.trim() || "";
    const planned = parseFloat(plannedText.replace(/[^\d.]/g, "")) || 0;
    // The step's piecework fund is for the whole run: the sample earns only its share of it.
    const fund = Number(op.pieceworkTotalUsd) || 0;
    return [
      {
        ...op,
        status: "Finished" as const,
        actualDurationMinutes: Math.round(minutes),
        qtyCompleted: plannedText ? `${good} / ${plannedText}` : `${good}`,
        pieceworkTotalUsd: planned > 0 ? Number(((fund * good) / planned).toFixed(6)) : 0,
      },
    ];
  });
}
