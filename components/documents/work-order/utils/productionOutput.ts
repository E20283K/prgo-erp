import type { PackagingBoxItem, RouteStep, ShiftEvent } from "../types";

/** Last production step of the route: the packaging step is never the producing one. */
export function getLastProductionStep(operations: RouteStep[]): RouteStep | null {
  for (let i = operations.length - 1; i >= 0; i--) {
    if (operations[i].kind !== "packaging") return operations[i];
  }
  return null;
}

/**
 * Good output of the order so far: what the last production step has made,
 * from its shift events, else from its "done / planned" counter.
 */
export function getProducedOutputQty(operations: RouteStep[], shiftEvents: ShiftEvent[] = []): number {
  const last = getLastProductionStep(operations);
  if (!last) return 0;
  const good = shiftEvents
    .filter((ev) => ev.opId === last.id)
    .reduce((sum, ev) => sum + (Number(ev.outputPiecesQty || ev.goodQty) || 0), 0);
  if (good > 0) return good;
  const parsed = parseInt((last.qtyCompleted || "").split("/")[0].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Every production step (everything but packaging) is finished. */
export function isProductionRouteFinished(operations: RouteStep[]): boolean {
  const production = operations.filter((op) => op.kind !== "packaging");
  return production.length > 0 && production.every((op) => op.status === "Finished");
}

/** Box lifecycle: packed in the shop → handed to the FG warehouse → received there → dispatched. */
export function boxStage(box: Pick<PackagingBoxItem, "status">): NonNullable<PackagingBoxItem["status"]> {
  return box.status || "ready";
}

export function sumBoxQty(boxes: PackagingBoxItem[], stage?: NonNullable<PackagingBoxItem["status"]>): number {
  return boxes
    .filter((b) => !stage || boxStage(b) === stage)
    .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
}
