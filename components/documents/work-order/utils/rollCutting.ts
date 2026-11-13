/**
 * Roll cutting (termo sticker converting) calculator.
 * Each lane of the die becomes one output roll, so one pass yields up to `lanes` rolls.
 */
export interface RollCuttingInput {
  webWidthMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  lanes: number;
  rollsCount: number;
  labelsPerRoll: number;
}

export interface RollCuttingResult {
  maxLanes: number;
  lanes: number;
  lanesExceeded: boolean;
  usedWidthMm: number;
  edgeWasteMm: number;
  totalLabels: number;
  passes: number;
  pitchMm: number;
  rollLengthM: number;
  jumboMeters: number;
  jumboAreaM2: number;
  wastePercent: number;
}

export function calculateRollCutting(input: RollCuttingInput): RollCuttingResult {
  const web = Math.max(0, input.webWidthMm || 0);
  const w = Math.max(0, input.labelWidthMm || 0);
  const h = Math.max(0, input.labelHeightMm || 0);
  const gapX = Math.max(0, input.gapXMm || 0);
  const gapY = Math.max(0, input.gapYMm || 0);
  const rolls = Math.max(0, Math.floor(input.rollsCount || 0));
  const perRoll = Math.max(0, Math.floor(input.labelsPerRoll || 0));

  const maxLanes = w > 0 ? Math.max(0, Math.floor((web + gapX) / (w + gapX))) : 0;
  const lanes = Math.max(1, Math.floor(input.lanes || 1));
  const lanesExceeded = maxLanes > 0 && lanes > maxLanes;

  const usedWidthMm = lanes * w + (lanes - 1) * gapX;
  const edgeWasteMm = Math.max(0, web - usedWidthMm);
  const pitchMm = h + gapY;
  const passes = rolls > 0 ? Math.ceil(rolls / lanes) : 0;
  const rollLengthM = (perRoll * pitchMm) / 1000;
  const jumboMeters = passes * rollLengthM;
  const jumboAreaM2 = (jumboMeters * web) / 1000;
  const totalLabels = rolls * perRoll;
  const labelsAreaM2 = (totalLabels * w * h) / 1_000_000;
  const wastePercent = jumboAreaM2 > 0 ? Math.max(0, (1 - labelsAreaM2 / jumboAreaM2) * 100) : 0;

  return {
    maxLanes,
    lanes,
    lanesExceeded,
    usedWidthMm,
    edgeWasteMm,
    totalLabels,
    passes,
    pitchMm,
    rollLengthM,
    jumboMeters,
    jumboAreaM2,
    wastePercent,
  };
}
