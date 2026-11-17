/**
 * How a route step counts its output, by technology. Shared by the order screen, the operator
 * terminal (server side too) and the output report dialog.
 *
 *   sheet  offset, sheet die-cutting/guillotine   counted sheets, reported per pallet
 *   web    flexo roll printing, termo roll cutting  metres from the machine counter, reported per roll
 *   piece  post-press, assembly, jacquard (for now) counted pieces, reported per box / batch
 */

export type CountingKind = "sheet" | "web" | "piece";

export interface CountingProfile {
  kind: CountingKind;
  /** Unit the step's quantities are in. */
  unit: string;
  /** Name of one output report: "Palet", "Rulon", "Pachka", "Quti", "O'ram". */
  container: string;
  /** Pieces of finished product in one unit (1 when not known or when counting pieces). */
  piecesPerUnit: number;
  /** The machine has a length/stroke counter: the report takes start and end readings. */
  counter: boolean;
  makeReadyLabel: string;
}

export interface CountingInputs {
  /** Machine category from the registry: offset, flexo, die-cutting, lamination, guillotine, jacquard... */
  machineCategory?: string | null;
  machineDepartment?: string | null;
  /** Order department: Offset, Flexo, Termo, Jacquard, Post-press. */
  orderDepartment?: string | null;
  /** Label / product size and roll layout (flexo, termo). */
  widthMm?: number | null;
  heightMm?: number | null;
  gapYMm?: number | null;
  lanes?: number | null;
  /** Offset imposition: products on one press sheet. */
  itemsPerSheet?: number | null;
}

/** Pieces in one running metre of web: lanes across × labels along one metre. */
export function piecesPerMetre(heightMm?: number | null, gapYMm?: number | null, lanes?: number | null): number {
  const pitch = (Number(heightMm) || 0) + (Number(gapYMm ?? 3) || 0);
  if (!(pitch > 0)) return 1;
  return Math.max(1, Math.floor(Number(lanes) || 1)) * (1000 / pitch);
}

export function getCountingProfile(input: CountingInputs): CountingProfile {
  const category = (input.machineCategory || "").toLowerCase();
  const dept = `${input.machineDepartment || ""} ${input.orderDepartment || ""}`.toLowerCase();

  if (category === "flexo" || dept.includes("flexo") || dept.includes("termo")) {
    const isTermo = dept.includes("termo") && category !== "flexo";
    return {
      kind: "web",
      unit: "metr",
      container: "Rulon",
      piecesPerUnit: piecesPerMetre(input.heightMm, input.gapYMm, input.lanes),
      counter: true,
      makeReadyLabel: isTermo ? "Sozlash" : "Ulama / priladka",
    };
  }
  if (category === "jacquard" || dept.includes("jacquard") || dept.includes("jakkard")) {
    return { kind: "piece", unit: "dona", container: "O'ram", piecesPerUnit: 1, counter: false, makeReadyLabel: "Sozlash" };
  }
  if (category === "offset" || category === "die-cutting" || category === "guillotine" || category === "mounting" || dept.includes("offset")) {
    const ups = Math.max(1, Math.floor(Number(input.itemsPerSheet) || 1));
    // Sheet-fed presses and die-cutters count every sheet through the feeder; a guillotine counts cuts, not sheets.
    const counter = category === "offset" || category === "die-cutting" || (!category && dept.includes("offset"));
    return { kind: "sheet", unit: "varaq", container: "Palet", piecesPerUnit: ups, counter, makeReadyLabel: "Priladka" };
  }
  return { kind: "piece", unit: "dona", container: "Quti", piecesPerUnit: 1, counter: false, makeReadyLabel: "Sozlash" };
}

/** The step's plan in its own unit: order pieces ÷ pieces per unit (a sheet or metre plan). */
export function planInUnit(orderPieces: number, profile: CountingProfile): number {
  if (!(orderPieces > 0)) return 0;
  return profile.piecesPerUnit > 1 ? Math.ceil(orderPieces / profile.piecesPerUnit) : orderPieces;
}

/** "Hisoblagich: 12 450 → 13 650" kept in a report's note; the last end reading starts the next report. */
export const COUNTER_NOTE_RE = /Hisoblagich:\s*([\d\s ]+)\s*→\s*([\d\s ]+)/;

export function lastCounterReading(notes: Array<string | undefined>): number | null {
  for (const note of notes) {
    const m = (note || "").match(COUNTER_NOTE_RE);
    if (m) return parseInt(m[2].replace(/[^\d]/g, ""), 10) || 0;
  }
  return null;
}
