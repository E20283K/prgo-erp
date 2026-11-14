import type { MachineFormatConstraints, PressMachineLike, SheetCutOption } from "./types";

function parseDimPair(str?: string): [number, number] | null {
  if (!str) return null;
  const m = str.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  if (!(a > 0) || !(b > 0)) return null;
  return [Math.max(a, b), Math.min(a, b)];
}

/** "1000x700", "70×100" -> [long, short] in mm */
export function parseFormatString(format?: string): [number, number] | null {
  return parseDimPair(format);
}

/**
 * Offset press max/min sheet size, plate size and default gripper, from a MachineRecord
 * (offsetSpecs) or the machine name (SM 52, GTO 52, SX 74, XL 106, Komori G40...).
 */
export function resolveMachineConstraints(
  pressMachineName?: string,
  activeMachine?: PressMachineLike | null
): MachineFormatConstraints {
  const name = (activeMachine?.name || pressMachineName || "Heidelberg Speedmaster XL 106").trim();
  const lower = name.toLowerCase();
  const specs = activeMachine?.offsetSpecs;
  const max = parseDimPair(specs?.maxSheetMm);
  const min = parseDimPair(specs?.minSheetMm);
  const plate = parseDimPair(specs?.plateSizeMm);

  const build = (
    d: { maxW: number; maxH: number; minW: number; minH: number; plateW: number; plateH: number },
    gripper: number,
    units: number
  ): MachineFormatConstraints => ({
    machineName: name,
    maxW: max ? max[0] : d.maxW,
    maxH: max ? max[1] : d.maxH,
    minW: min ? min[0] : d.minW,
    minH: min ? min[1] : d.minH,
    plateW: plate ? plate[0] : d.plateW,
    plateH: plate ? plate[1] : d.plateH,
    defaultGripper: gripper,
    printingUnits: specs?.printingUnits || units,
  });

  if (lower.includes("52") || lower.includes("gto")) {
    return build({ maxW: 520, maxH: 370, minW: 180, minH: 105, plateW: 510, plateH: 400 }, 10, lower.includes("-2") ? 2 : 4);
  }
  if (lower.includes("74") || lower.includes("75") || lower.includes("b2")) {
    return build({ maxW: 740, maxH: 530, minW: 340, minH: 210, plateW: 745, plateH: 605 }, 12, 4);
  }
  if (lower.includes("komori") || lower.includes("g40") || lower.includes("102") || lower.includes("103")) {
    return build({ maxW: 1030, maxH: 720, minW: 520, minH: 360, plateW: 1030, plateH: 800 }, 12, 4);
  }
  return build({ maxW: 1060, maxH: 750, minW: 480, minH: 340, plateW: 1055, plateH: 811 }, 15, 8);
}

export function doesSheetFitMachine(w: number, h: number, m: MachineFormatConstraints): boolean {
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  return (
    long <= Math.max(m.maxW, m.maxH) &&
    short <= Math.min(m.maxW, m.maxH) &&
    long >= Math.max(m.minW, m.minH) &&
    short >= Math.min(m.minW, m.minH)
  );
}

export interface GridEstimateInput {
  trimW: number;
  trimH: number;
  gutterX: number;
  gutterY: number;
  margins: { top: number; bottom: number; left: number; right: number };
}

/**
 * Same formula as doc-service LayoutCalculator.calculate_optimal_grid; used only to rank
 * parent-sheet cut options locally. Authoritative numbers come from /calculate.
 */
export function estimatePiecesPerSheet(sheetW: number, sheetH: number, g: GridEstimateInput): number {
  const uw = sheetW - g.margins.left - g.margins.right;
  const uh = sheetH - g.margins.top - g.margins.bottom;
  const fit = (avail: number, item: number, gap: number) =>
    item + gap > 0 ? Math.max(1, Math.floor((avail + gap) / (item + gap))) : 1;
  if (uw <= 0 || uh <= 0) return 0;
  const p0 = fit(uw, g.trimW, g.gutterX) * fit(uh, g.trimH, g.gutterY);
  const p90 = fit(uw, g.trimH, g.gutterX) * fit(uh, g.trimW, g.gutterY);
  return Math.max(p0, p90);
}

/** Standard guillotine divisions of a parent sheet (1/1 ... 1/9). */
export function calculateSheetCutOptions(
  parentW: number,
  parentH: number,
  grid: GridEstimateInput,
  machine: MachineFormatConstraints
): SheetCutOption[] {
  const L = Math.max(parentW, parentH);
  const S = Math.min(parentW, parentH);
  const splits = [
    { divisor: 1, w: L, h: S },
    { divisor: 2, w: S, h: Math.floor(L / 2) },
    { divisor: 3, w: S, h: Math.floor(L / 3) },
    { divisor: 4, w: Math.floor(L / 2), h: Math.floor(S / 2) },
    { divisor: 6, w: Math.floor(L / 3), h: Math.floor(S / 2) },
    { divisor: 8, w: Math.floor(S / 2), h: Math.floor(L / 4) },
    { divisor: 9, w: Math.floor(L / 3), h: Math.floor(S / 3) },
  ];
  return splits.map((sp) => {
    const pressW = Math.max(sp.w, sp.h);
    const pressH = Math.min(sp.w, sp.h);
    const pieces = estimatePiecesPerSheet(pressW, pressH, grid);
    return {
      divisor: sp.divisor,
      label: `1/${sp.divisor} · ${pressW}×${pressH}`,
      pressW,
      pressH,
      fitsMachine: doesSheetFitMachine(pressW, pressH, machine),
      piecesPerPressSheet: pieces,
      piecesPerParentSheet: pieces * sp.divisor,
    };
  });
}

/** Largest press sheet that fits the machine and holds at least one piece. */
export function pickOptimalCutOption(options: SheetCutOption[]): SheetCutOption {
  return (
    options.find((o) => o.fitsMachine && o.piecesPerPressSheet > 0) ||
    options.find((o) => o.fitsMachine) ||
    options[0]
  );
}
