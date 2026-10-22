import {
  SideColorConfig,
  SpotColorItem,
  RouteStep,
  parseModelAndSize,
} from "./types";

export type PrintMethod =
  | "single_sided" // 4+0, 1+0: Only front side printed
  | "sheetwise" // 4+4, 4+1: Front & Back from separate plates (2 passes, 2 sets of CTP)
  | "work_and_turn" // 4+4, 1+1: Work and Turn (Свой оборот) - same plate prints both sides, cut in half (50% plates saving!)
  | "work_and_tumble" // 4+4: Work and Tumble (Со своего клапана)
  | "kashirovka"; // Multi-layer board mounting

export interface PrintPlanningInput {
  targetQuantity: number; // Finished product target quantity (e.g., 5,000 pcs)
  piecesPerSheet: number; // N-up imposition yield per press sheet (e.g., 10 cards/sheet)
  frontColors: SideColorConfig;
  backColors: SideColorConfig;
  spotColors: SpotColorItem[];
  printMethod?: PrintMethod;
  pressSpeed?: number; // Sheets/hour (e.g. 10,000)
  makeReadySheetsPerPlate?: number; // Make-ready waste sheets per plate (e.g., 40)
  runningWastePercent?: number; // In-process run waste (e.g., 2.5%)
  postPressWasteSheets?: number; // Die-cutting, lamination setup waste (e.g., 50)
  parentSheetW?: number; // Raw flatsheet width mm (e.g. 1000)
  parentSheetH?: number; // Raw flatsheet height mm (e.g. 700)
  pressSheetW?: number; // Cut press sheet width mm (e.g. 500)
  pressSheetH?: number; // Cut press sheet height mm (e.g. 700)
  paperGsm?: number; // Paper grammage (e.g., 300)
  paperPricePerTon?: number; // USD per metric ton (e.g. 1100)
  ctpPlateCost?: number; // Cost per CTP plate USD (e.g. 12)
  pressHourRate?: number; // Machine hourly rate USD (e.g. 65)
}

export interface PrintPlanningResult {
  // Color Breakdown
  frontProcessCount: number; // 0 to 4 (CMYK)
  frontSpotCount: number; // Spot colors on front
  frontTotalColors: number;
  backProcessCount: number; // 0 to 4 (CMYK)
  backSpotCount: number; // Spot colors on back
  backTotalColors: number;
  totalUniqueInks: number;
  colorNotation: string; // e.g. "4+4", "4+1", "4+0"
  recommendedMethod: PrintMethod;
  activeMethod: PrintMethod;
  piecesPerSheet: number;
  targetQuantity: number;

  // CTP Plates
  frontPlates: number;
  backPlates: number;
  totalCtpPlates: number;
  savedPlatesFromWorkAndTurn: number; // Plates saved if work & turn chosen

  // Sheets & Waste Balance
  netPressSheets: number; // Theoretical required press sheets
  makeReadySheets: number; // Setup & color matching waste
  runningWasteSheets: number; // Defect & speed ramp-up waste
  postPressWasteSheets: number; // Finishing & die-cutting setup
  totalWasteSheets: number;
  grossPressSheets: number; // Total press sheets to be printed
  totalWastePercent: number;

  // Parent Raw Stock Yield (Ombor xomashyosi)
  pressSheetsPerParent: number; // How many press sheets cut from 1 parent sheet
  requiredParentSheets: number; // Total flatsheets needed from warehouse
  parentSheetWastePercent: number;
  totalPaperWeightKg: number; // Total paper weight in kilograms

  // Press Operations & Time
  pressPasses: number; // Number of machine passes (1 or 2)
  totalImpressions: number; // Total machine counter cycles
  setupHours: number; // Makeready duration (hours)
  runHours: number; // Production run duration (hours)
  totalPressHours: number; // Total machine time (hours)

  // Estimated Direct Costs
  estimatedPaperCost: number;
  estimatedPlatesCost: number;
  estimatedPressCost: number;
  totalDirectProductionCost: number;
  costPerFinishedUnit: number;
}

export function calculatePrintPlanning(inputs: PrintPlanningInput): PrintPlanningResult {
  if (!inputs.targetQuantity || inputs.targetQuantity <= 0) {
    return {
      frontProcessCount: 0,
      frontSpotCount: 0,
      frontTotalColors: 0,
      backProcessCount: 0,
      backSpotCount: 0,
      backTotalColors: 0,
      totalUniqueInks: 0,
      colorNotation: "0+0",
      recommendedMethod: "single_sided",
      activeMethod: "single_sided",
      piecesPerSheet: 1,
      targetQuantity: 0,
      frontPlates: 0,
      backPlates: 0,
      totalCtpPlates: 0,
      savedPlatesFromWorkAndTurn: 0,
      netPressSheets: 0,
      makeReadySheets: 0,
      runningWasteSheets: 0,
      postPressWasteSheets: 0,
      totalWasteSheets: 0,
      grossPressSheets: 0,
      totalWastePercent: 0,
      pressSheetsPerParent: 1,
      requiredParentSheets: 0,
      parentSheetWastePercent: 0,
      totalPaperWeightKg: 0,
      pressPasses: 1,
      totalImpressions: 0,
      setupHours: 0,
      runHours: 0,
      totalPressHours: 0,
      estimatedPaperCost: 0,
      estimatedPlatesCost: 0,
      estimatedPressCost: 0,
      totalDirectProductionCost: 0,
      costPerFinishedUnit: 0,
    };
  }

  const {
    targetQuantity = 1000,
    piecesPerSheet = 1,
    frontColors = { c: true, m: true, y: true, k: true },
    backColors = { c: false, m: false, y: false, k: false },
    spotColors = [],
    printMethod,
    pressSpeed = 10000,
    makeReadySheetsPerPlate = 40,
    runningWastePercent = 2.5,
    postPressWasteSheets = 50,
    parentSheetW = 1000,
    parentSheetH = 700,
    pressSheetW = 500,
    pressSheetH = 700,
    paperGsm = 300,
    paperPricePerTon = 1100,
    ctpPlateCost = 12,
    pressHourRate = 65,
  } = inputs;

  // 1. Calculate color counts
  const frontProcess = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
  const backProcess = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);

  const frontSpots = spotColors.filter((s) => s.side === "front" || s.side === "both").length;
  const backSpots = spotColors.filter((s) => s.side === "back" || s.side === "both").length;

  const frontTotalColors = frontProcess + frontSpots;
  const backTotalColors = backProcess + backSpots;
  const totalUniqueInks = frontTotalColors + backTotalColors;

  const colorNotation = `${frontTotalColors}+${backTotalColors}`;

  // 2. Recommend Print Method
  let recommendedMethod: PrintMethod = "single_sided";
  if (backTotalColors === 0) {
    recommendedMethod = "single_sided";
  } else if (frontTotalColors === backTotalColors && frontTotalColors > 0 && piecesPerSheet >= 2) {
    // Both sides have identical or similar color counts, and sheet has at least 2 pieces
    // Work & Turn (Свой оборот) can save 50% on plates!
    recommendedMethod = "work_and_turn";
  } else {
    recommendedMethod = "sheetwise";
  }

  const activeMethod: PrintMethod = printMethod || recommendedMethod;

  // 3. CTP Plates Calculation
  let frontPlates = frontTotalColors;
  let backPlates = backTotalColors;
  let totalCtpPlates = 0;
  let savedPlatesFromWorkAndTurn = 0;

  if (activeMethod === "single_sided") {
    backPlates = 0;
    totalCtpPlates = frontPlates;
  } else if (activeMethod === "work_and_turn" || activeMethod === "work_and_tumble") {
    // Both sides are mounted onto a single plate set
    const sharedPlates = Math.max(frontTotalColors, backTotalColors);
    totalCtpPlates = sharedPlates;
    savedPlatesFromWorkAndTurn = (frontTotalColors + backTotalColors) - sharedPlates;
    frontPlates = sharedPlates;
    backPlates = 0; // Printed simultaneously
  } else {
    // sheetwise / separate plates
    totalCtpPlates = frontPlates + backPlates;
  }

  // Ensure at least 1 plate if 0 colors
  totalCtpPlates = Math.max(totalCtpPlates, frontTotalColors > 0 ? 1 : 0);

  // 4. Net Press Sheets
  // If work & turn: each press sheet produces 2x the cards after cutting in half, but requires printing on both sides
  const effectiveNUp = Math.max(1, piecesPerSheet);
  const netPressSheets = Math.ceil(targetQuantity / effectiveNUp);

  // 5. Waste & Brutto Sheets
  // Make-ready sheets: setup per CTP plate
  const makeReadySheets = totalCtpPlates * makeReadySheetsPerPlate;
  const runningWasteSheets = Math.ceil((netPressSheets * runningWastePercent) / 100);
  const totalWasteSheets = makeReadySheets + runningWasteSheets + postPressWasteSheets;
  const grossPressSheets = netPressSheets + totalWasteSheets;
  const totalWastePercent = Number(((totalWasteSheets / Math.max(1, grossPressSheets)) * 100).toFixed(1));

  // 6. Parent Raw Stock Yield (Ombor xomashyosi)
  // How many press sheets fit on a parent raw sheet
  let cutsDirect = 1;
  let cutsRot = 1;
  if (parentSheetW > 0 && parentSheetH > 0 && pressSheetW > 0 && pressSheetH > 0) {
    cutsDirect = Math.floor(parentSheetW / pressSheetW) * Math.floor(parentSheetH / pressSheetH);
    cutsRot = Math.floor(parentSheetW / pressSheetH) * Math.floor(parentSheetH / pressSheetW);
  }
  const pressSheetsPerParent = Math.max(1, Math.max(cutsDirect, cutsRot));
  const requiredParentSheets = Math.ceil(grossPressSheets / pressSheetsPerParent);

  const parentAreaM2 = (parentSheetW * parentSheetH) / 1_000_000;
  const pressAreaM2 = (pressSheetW * pressSheetH) / 1_000_000;
  const parentSheetWastePercent = Number(
    (
      Math.max(0, (parentAreaM2 - pressAreaM2 * pressSheetsPerParent) / Math.max(0.001, parentAreaM2)) * 100
    ).toFixed(1)
  );

  // Total paper weight in kg: sheets * area * gsm / 1000
  const totalPaperWeightKg = Number(
    ((requiredParentSheets * parentAreaM2 * paperGsm) / 1000).toFixed(1)
  );

  // 7. Press Passes & Running Time
  // Single-sided: 1 pass. Sheetwise or Work & Turn: 2 passes (each sheet fed twice).
  const pressPasses = activeMethod === "single_sided" ? 1 : 2;
  const totalImpressions = grossPressSheets * pressPasses;

  // Setup time: ~15 mins (0.25h) per plate mounting & ink key presetting
  const setupHours = Number((totalCtpPlates * 0.25).toFixed(2));
  // Run time: impressions / speed
  const safeSpeed = Math.max(1000, pressSpeed);
  const runHours = Number((totalImpressions / safeSpeed).toFixed(2));
  const totalPressHours = Number((setupHours + runHours).toFixed(2));

  // 8. Cost Breakdown
  const estimatedPaperCost = Number(((totalPaperWeightKg / 1000) * paperPricePerTon).toFixed(2));
  const estimatedPlatesCost = Number((totalCtpPlates * ctpPlateCost).toFixed(2));
  const estimatedPressCost = Number((totalPressHours * pressHourRate).toFixed(2));
  const totalDirectProductionCost = Number(
    (estimatedPaperCost + estimatedPlatesCost + estimatedPressCost).toFixed(2)
  );
  const costPerFinishedUnit = Number(
    (totalDirectProductionCost / Math.max(1, targetQuantity)).toFixed(4)
  );

  return {
    frontProcessCount: frontProcess,
    frontSpotCount: frontSpots,
    frontTotalColors,
    backProcessCount: backProcess,
    backSpotCount: backSpots,
    backTotalColors,
    totalUniqueInks,
    colorNotation,
    recommendedMethod,
    activeMethod,
    piecesPerSheet,
    targetQuantity,
    frontPlates,
    backPlates,
    totalCtpPlates,
    savedPlatesFromWorkAndTurn,
    netPressSheets,
    makeReadySheets,
    runningWasteSheets,
    postPressWasteSheets,
    totalWasteSheets,
    grossPressSheets,
    totalWastePercent,
    pressSheetsPerParent,
    requiredParentSheets,
    parentSheetWastePercent,
    totalPaperWeightKg,
    pressPasses,
    totalImpressions,
    setupHours,
    runHours,
    totalPressHours,
    estimatedPaperCost,
    estimatedPlatesCost,
    estimatedPressCost,
    totalDirectProductionCost,
    costPerFinishedUnit,
  };
}

/**
 * Generates an automated technological route (operations list)
 * directly from the print plan, accounting for CTP, Front Print, Back Print (if needed),
 * surface coating / lamination, and die-cutting.
 */
export function generateRouteStepsFromPlan(
  plan: PrintPlanningResult,
  pressMachineName: string = "Heidelberg Speedmaster XL 106",
  laminationType?: string,
  embellishment?: string,
  operatorName: string = "M. Ivanova"
): RouteStep[] {
  const steps: RouteStep[] = [];
  let stepCounter = 10;

  // Step 1: Pre-press & CTP Plates
  steps.push({
    id: `route-step-${Date.now()}-1`,
    stepNumber: stepCounter,
    name: `Pre-press & CTP Plate Imaging (${plan.totalCtpPlates} plates · ${plan.colorNotation})`,
    machine: "Screen PlateRite 8600 CTP",
    operator: "K. Anderson (Prepress)",
    duration: Math.max(0.5, Number((plan.totalCtpPlates * 0.15).toFixed(1))),
    qtyCompleted: `0 / ${plan.totalCtpPlates} plates`,
    status: "Queued",
  });
  stepCounter += 10;

  // Step 2: Paper Stock Trimming (Ombor kesimi)
  if (plan.pressSheetsPerParent > 1) {
    steps.push({
      id: `route-step-${Date.now()}-2`,
      stepNumber: stepCounter,
      name: `Guillotine Paper Cut (${plan.requiredParentSheets} raw sheets → ${plan.grossPressSheets} press sheets)`,
      machine: "Polar 115 High-Speed Cutter",
      operator: "Warehouse Cut Dept",
      duration: Math.max(0.5, Number((plan.requiredParentSheets / 1500).toFixed(1))),
      qtyCompleted: `0 / ${plan.grossPressSheets} sheets`,
      status: "Queued",
    });
    stepCounter += 10;
  }

  // Step 3: Printing Operations
  if (plan.activeMethod === "single_sided") {
    // 1-sided printing
    steps.push({
      id: `route-step-${Date.now()}-3`,
      stepNumber: stepCounter,
      name: `Offset Printing (${plan.colorNotation} Front · ${plan.grossPressSheets.toLocaleString()} sheets)`,
      machine: pressMachineName,
      operator: operatorName,
      duration: plan.totalPressHours,
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;
  } else if (plan.activeMethod === "work_and_turn" || plan.activeMethod === "work_and_tumble") {
    // Work & Turn / Tumble
    const halfDuration = Number((plan.totalPressHours / 2).toFixed(1));
    steps.push({
      id: `route-step-${Date.now()}-3`,
      stepNumber: stepCounter,
      name: `Offset Print Pass 1 (Face & Back Work & Turn · ${plan.grossPressSheets.toLocaleString()} sheets)`,
      machine: pressMachineName,
      operator: operatorName,
      duration: halfDuration,
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;

    steps.push({
      id: `route-step-${Date.now()}-4`,
      stepNumber: stepCounter,
      name: `Offset Print Pass 2 (Reverse Sheet Turn & Back Print · ${plan.grossPressSheets.toLocaleString()} sheets)`,
      machine: pressMachineName,
      operator: operatorName,
      duration: halfDuration,
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;
  } else {
    // Sheetwise: 2 distinct passes
    const halfPassDuration = Number((plan.totalPressHours / 2).toFixed(1));
    steps.push({
      id: `route-step-${Date.now()}-3`,
      stepNumber: stepCounter,
      name: `Offset Printing (Pass 1: Front ${plan.frontTotalColors}C · ${plan.grossPressSheets.toLocaleString()} sheets)`,
      machine: pressMachineName,
      operator: operatorName,
      duration: halfPassDuration,
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;

    steps.push({
      id: `route-step-${Date.now()}-4`,
      stepNumber: stepCounter,
      name: `Offset Printing (Pass 2: Back ${plan.backTotalColors}C · ${plan.grossPressSheets.toLocaleString()} sheets)`,
      machine: pressMachineName,
      operator: operatorName,
      duration: halfPassDuration,
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;
  }

  // Step 4: Lamination / Coating (if specified)
  const isLam = laminationType && laminationType.toLowerCase() !== "none" && laminationType.toLowerCase() !== "uncoated";
  if (isLam) {
    steps.push({
      id: `route-step-${Date.now()}-5`,
      stepNumber: stepCounter,
      name: `Surface Lamination (${laminationType})`,
      machine: "Autobond Mini 76 Thermal Laminator",
      operator: "A. Becker (Lamination)",
      duration: Math.max(1.0, Number((plan.grossPressSheets / 3000).toFixed(1))),
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;
  }

  // Step 5: Embellishment / Spot UV / Hot Foil (if specified)
  const isEmbellish = embellishment && embellishment.toLowerCase() !== "none";
  if (isEmbellish) {
    steps.push({
      id: `route-step-${Date.now()}-6`,
      stepNumber: stepCounter,
      name: `Special Embellishment (${embellishment})`,
      machine: "MGI JETvarnish 3D",
      operator: "Finishing Lead",
      duration: Math.max(0.8, Number((plan.grossPressSheets / 2000).toFixed(1))),
      qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
      status: "Queued",
    });
    stepCounter += 10;
  }

  // Step 6: Die-cutting / Slitting
  steps.push({
    id: `route-step-${Date.now()}-7`,
    stepNumber: stepCounter,
    name: `Die-Cutting & Stripping (${plan.grossPressSheets.toLocaleString()} sheets → ${plan.netPressSheets * (plan.piecesPerSheet || 1)} pieces)`,
    machine: "Bobst Novacut 106 Flatbed Die-Cutter",
    operator: "S. Petrov (Die-cut)",
    duration: Math.max(1.2, Number((plan.grossPressSheets / 4500).toFixed(1))),
    qtyCompleted: `0 / ${plan.grossPressSheets.toLocaleString()} sheets`,
    status: "Queued",
  });
  stepCounter += 10;

  // Step 7: Final Quality Control & Packing
  steps.push({
    id: `route-step-${Date.now()}-8`,
    stepNumber: stepCounter,
    name: "Final Quality Inspection, Banding & Box Packing",
    machine: "Automated Packaging Line",
    operator: "QC & Dispatch Dept",
    duration: 1.0,
    qtyCompleted: `0 / ${plan.netPressSheets * (plan.piecesPerSheet || 1)} pcs`,
    status: "Queued",
  });

  return steps;
}
