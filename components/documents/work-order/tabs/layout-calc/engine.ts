import { SizeDistribution, parseModelAndSize } from "../../types";
import { 
  PrepressMargins, 
  ImpositionLayout, 
  PlateConfig, 
  CalculatedPlate, 
  SlotAssignment, 
  TrimMarkSegment, 
  GripperEdge, 
  Orientation,
  ParentCutResult,
  PlatePartitionStrategy,
  CtpSideRelation,
  OptimizerGoal,
  SmartOptimizerParams,
  MachineFormatConstraints,
  SheetCutOption,
  ImpositionPlanSummary,
} from "./types";

function parseDimPair(str?: string): [number, number] | null {
  if (!str) return null;
  const matches = str.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
  if (!matches) return null;
  const a = parseFloat(matches[1]);
  const b = parseFloat(matches[2]);
  if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) return null;
  return [Math.max(a, b), Math.min(a, b)];
}

/**
 * Resolves offset press max/min sheet size, plate dimensions, and default gripper
 * from either a MachineRecord (DB/store) or machine name string (e.g. SM 52, GTO 52, SX 74, XL 106).
 */
export function resolveMachineConstraints(
  pressMachineName?: string,
  activeMachine?: any
): MachineFormatConstraints {
  const name = (activeMachine?.name || pressMachineName || "Heidelberg Speedmaster XL 106").trim();
  const lower = name.toLowerCase();

  const specs = activeMachine?.offsetSpecs;
  const parsedMax = parseDimPair(specs?.maxSheetMm);
  const parsedMin = parseDimPair(specs?.minSheetMm);
  const parsedPlate = parseDimPair(specs?.plateSizeMm);

  // Small B3 format: Heidelberg SM 52 / GTO 52 / PM 52
  if (lower.includes("52") || lower.includes("gto") || lower.includes("sm 52") || lower.includes("sm52")) {
    return {
      machineName: name,
      maxW: parsedMax ? parsedMax[0] : 520,
      maxH: parsedMax ? parsedMax[1] : 370,
      minW: parsedMin ? parsedMin[0] : 180,
      minH: parsedMin ? parsedMin[1] : 105,
      plateW: parsedPlate ? parsedPlate[0] : 510,
      plateH: parsedPlate ? parsedPlate[1] : 400,
      defaultGripper: 10,
      printingUnits: specs?.printingUnits || (lower.includes("-2") ? 2 : 4),
    };
  }

  // Medium B2 format: Heidelberg SX 74 / SM 74 / XL 75
  if (lower.includes("74") || lower.includes("75") || lower.includes("b2")) {
    return {
      machineName: name,
      maxW: parsedMax ? parsedMax[0] : 740,
      maxH: parsedMax ? parsedMax[1] : 530,
      minW: parsedMin ? parsedMin[0] : 340,
      minH: parsedMin ? parsedMin[1] : 210,
      plateW: parsedPlate ? parsedPlate[0] : 745,
      plateH: parsedPlate ? parsedPlate[1] : 605,
      defaultGripper: 12,
      printingUnits: specs?.printingUnits || 4,
    };
  }

  // Komori Lithrone G40 / L40 (1030 x 720)
  if (lower.includes("komori") || lower.includes("g40") || lower.includes("102") || lower.includes("103")) {
    return {
      machineName: name,
      maxW: parsedMax ? parsedMax[0] : 1030,
      maxH: parsedMax ? parsedMax[1] : 720,
      minW: parsedMin ? parsedMin[0] : 520,
      minH: parsedMin ? parsedMin[1] : 360,
      plateW: parsedPlate ? parsedPlate[0] : 1030,
      plateH: parsedPlate ? parsedPlate[1] : 800,
      defaultGripper: 12,
      printingUnits: specs?.printingUnits || 4,
    };
  }

  // Default B1 flagship: Heidelberg Speedmaster XL 106 / CD 102
  return {
    machineName: name,
    maxW: parsedMax ? parsedMax[0] : 1060,
    maxH: parsedMax ? parsedMax[1] : 750,
    minW: parsedMin ? parsedMin[0] : 480,
    minH: parsedMin ? parsedMin[1] : 340,
    plateW: parsedPlate ? parsedPlate[0] : 1055,
    plateH: parsedPlate ? parsedPlate[1] : 811,
    defaultGripper: 15,
    printingUnits: specs?.printingUnits || 8,
  };
}

/**
 * Checks whether a press sheet (w x h) fits inside the machine's [min, max] format constraints.
 */
export function doesSheetFitMachine(
  sheetW: number,
  sheetH: number,
  machine: MachineFormatConstraints
): boolean {
  const longSide = Math.max(sheetW, sheetH);
  const shortSide = Math.min(sheetW, sheetH);
  const maxLong = Math.max(machine.maxW, machine.maxH);
  const maxShort = Math.min(machine.maxW, machine.maxH);
  const minLong = Math.max(machine.minW, machine.minH);
  const minShort = Math.min(machine.minW, machine.minH);

  return (
    longSide <= maxLong &&
    shortSide <= maxShort &&
    longSide >= minLong &&
    shortSide >= minShort
  );
}

/**
 * Evaluates standard guillotine divisions (1/1, 1/2, 1/3, 1/4, 1/6, 1/8, 1/9) of a parent sheet
 * and determines how many items fit per press sheet & per parent sheet.
 */
export function calculateSheetCutOptions(
  parentW: number,
  parentH: number,
  prodW: number,
  prodH: number,
  bleed: number,
  gap: number,
  margins: { top: number; bottom: number; left: number; right: number; gripper: number; gripperEdge: GripperEdge },
  machine: MachineFormatConstraints
): SheetCutOption[] {
  const pLong = Math.max(parentW, parentH);
  const pShort = Math.min(parentW, parentH);

  const rawSplits: { divisor: number; label: string; w: number; h: number }[] = [
    { divisor: 1, label: "1/1 (Butun list)", w: pLong, h: pShort },
    { divisor: 2, label: "1/2 kesim", w: pShort, h: Math.floor(pLong / 2) },
    { divisor: 3, label: "1/3 kesim", w: pShort, h: Math.floor(pLong / 3) },
    { divisor: 4, label: "1/4 kesim", w: Math.floor(pLong / 2), h: Math.floor(pShort / 2) },
    { divisor: 6, label: "1/6 kesim", w: Math.floor(pLong / 3), h: Math.floor(pShort / 2) },
    { divisor: 8, label: "1/8 kesim", w: Math.floor(pShort / 2), h: Math.floor(pLong / 4) },
    { divisor: 9, label: "1/9 kesim", w: Math.floor(pLong / 3), h: Math.floor(pShort / 3) },
  ];

  return rawSplits.map((sp) => {
    const pressW = Math.max(sp.w, sp.h);
    const pressH = Math.min(sp.w, sp.h);
    const fitsMachine = doesSheetFitMachine(pressW, pressH, machine);

    const prepMargins = calculatePrepressMargins(
      pressW,
      pressH,
      margins.top,
      margins.bottom,
      margins.left,
      margins.right,
      margins.gripper,
      margins.gripperEdge
    );

    const layA = calculateImposition(pressW, pressH, prodW, prodH, bleed, gap, "A", prepMargins);
    const layB = calculateImposition(pressW, pressH, prodW, prodH, bleed, gap, "B", prepMargins);
    const bestLay = layB.pieces > layA.pieces ? layB : layA;

    return {
      divisor: sp.divisor,
      label: `${sp.label} (${pressW}×${pressH})`,
      pressW,
      pressH,
      fitsMachine,
      wastePercent: Number(Math.max(0, 100 - bestLay.utilization).toFixed(1)),
      piecesPerPressSheet: bestLay.pieces,
      piecesPerParentSheet: bestLay.pieces * sp.divisor,
    };
  });
}

export function pickOptimalCutOption(options: SheetCutOption[]): SheetCutOption {
  const fitting = options.filter((o) => o.fitsMachine && o.piecesPerPressSheet > 0);
  if (fitting.length === 0) {
    return options.find((o) => o.fitsMachine) || options[0];
  }
  // Prefer the largest sheet (smallest divisor) that fits the press unless a smaller cut yields strictly more pieces per parent sheet with reasonable capacity
  return fitting[0];
}

export function calculatePrepressMargins(
  sheetW: number,
  sheetH: number,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number,
  gripper: number,
  gripperEdge: GripperEdge
): PrepressMargins & { activeGripperEdge: "Bottom" | "Top" | "Left" | "Right" } {
  const activeGripperEdge: "Bottom" | "Top" | "Left" | "Right" =
    gripperEdge !== "Auto" ? (gripperEdge as any) : sheetW >= sheetH ? "Bottom" : "Left";

  const mt = marginTop;
  const mb = marginBottom;
  const ml = marginLeft;
  const mr = marginRight;
  let gt = 0;
  let gb = 0;
  let gl = 0;
  let gr = 0;

  if (gripper > 0) {
    if (activeGripperEdge === "Top") {
      gt = Math.max(0, gripper - mt);
    } else if (activeGripperEdge === "Bottom") {
      gb = Math.max(0, gripper - mb);
    } else if (activeGripperEdge === "Left") {
      gl = Math.max(0, gripper - ml);
    } else if (activeGripperEdge === "Right") {
      gr = Math.max(0, gripper - mr);
    }
  }

  return {
    effMarginTop: mt,
    effMarginBottom: mb,
    effMarginLeft: ml,
    effMarginRight: mr,
    gTop: gt,
    gBottom: gb,
    gLeft: gl,
    gRight: gr,
    gridLeft: ml + gl,
    gridTop: mt + gt,
    activeGripperEdge,
  };
}

export function calculateImposition(
  sheetW: number,
  sheetH: number,
  prodW: number,
  prodH: number,
  bleed: number,
  gap: number,
  orientation: Orientation,
  margins: PrepressMargins
): ImpositionLayout {
  const { effMarginTop, effMarginBottom, effMarginLeft, effMarginRight, gTop, gBottom, gLeft, gRight } = margins;

  const usableW = Math.max(0, sheetW - effMarginLeft - effMarginRight - gLeft - gRight);
  const usableH = Math.max(0, sheetH - effMarginTop - effMarginBottom - gTop - gBottom);

  const itemTotalW = prodW + bleed * 2;
  const itemTotalH = prodH + bleed * 2;

  const calcForOrientation = (w: number, h: number): ImpositionLayout => {
    if (w <= 0 || h <= 0 || usableW < w || usableH < h) {
      return { cols: 0, rows: 0, pieces: 0, utilization: 0, itemW: w, itemH: h, offsetX: 0, offsetY: 0 };
    }
    const cols = Math.floor((usableW + gap) / (w + gap)) || 0;
    const rows = Math.floor((usableH + gap) / (h + gap)) || 0;
    const pieces = cols * rows;

    const cutProductArea = pieces * (prodW * prodH);
    const sheetArea = sheetW * sheetH;
    const utilization = sheetArea > 0 ? (cutProductArea / sheetArea) * 100 : 0;

    const actualGridW = cols > 0 ? cols * w + (cols - 1) * gap : 0;
    const actualGridH = rows > 0 ? rows * h + (rows - 1) * gap : 0;
    const offsetX = Math.max(0, (usableW - actualGridW) / 2);
    const offsetY = Math.max(0, (usableH - actualGridH) / 2);

    return { cols, rows, pieces, utilization, itemW: w, itemH: h, offsetX, offsetY };
  };

  const optA = calcForOrientation(itemTotalW, itemTotalH);
  const optB = calcForOrientation(itemTotalH, itemTotalW);

  return orientation === "A" ? optA : optB;
}

/**
 * Helper to solve the min-max bottleneck greedy slot allocation for a fixed plate group of items.
 * Allocates `capacity` total slots across items to minimize max(ceil(Q_i / s_i)).
 */
export function allocateOptimalSlotsForPlate(
  items: (SizeDistribution & { originalQuantity?: number })[],
  capacity: number
): { slotsMap: Record<string, number>; requiredSheets: number; waste: number; overflow: number } {
  const cap = Math.max(1, capacity);
  const slotsMap: Record<string, number> = {};

  if (items.length === 0) {
    return { slotsMap, requiredSheets: 0, waste: 0, overflow: 0 };
  }

  if (items.length > cap) {
    const overflow = items.length - cap;
    const sorted = [...items].sort((a, b) => b.quantity - a.quantity);
    sorted.forEach((it, idx) => {
      slotsMap[it.id] = idx < cap ? 1 : 0;
    });
    const active = sorted.slice(0, cap);
    const req = active.length > 0 ? Math.max(...active.map((it) => it.quantity)) : 0;
    let waste = 0;
    active.forEach((it) => {
      waste += req - it.quantity;
    });
    return { slotsMap, requiredSheets: req, waste, overflow };
  }

  // Each item gets at least 1 slot
  items.forEach((item) => {
    slotsMap[item.id] = 1;
  });

  let remainingSlots = cap - items.length;

  // Greedily assign remaining slots to the item with the highest current ceil(Q_i / s_i)
  while (remainingSlots > 0) {
    let worst = items[0];
    let worstSheets = Math.ceil(worst.quantity / slotsMap[worst.id]);

    for (let i = 1; i < items.length; i++) {
      const it = items[i];
      const sheets = Math.ceil(it.quantity / slotsMap[it.id]);
      if (sheets > worstSheets) {
        worstSheets = sheets;
        worst = it;
      }
    }

    slotsMap[worst.id] += 1;
    remainingSlots--;
  }

  let requiredSheets = 0;
  items.forEach((it) => {
    const s = slotsMap[it.id] || 1;
    const req = Math.ceil(it.quantity / s);
    if (req > requiredSheets) requiredSheets = req;
  });

  let waste = 0;
  items.forEach((it) => {
    const s = slotsMap[it.id] || 0;
    waste += requiredSheets * s - it.quantity;
  });

  return { slotsMap, requiredSheets, waste, overflow: 0 };
}

/**
 * Deterministic Pseudo-Random generator so optimizer produces stable, repeatable plans.
 */
function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Smart Gang Run Optimizer using Simulated Annealing:
 * Automatically groups items into plates and distributes slots (1x, 2x, 4x, etc.)
 * to minimize sheet overproduction and total press runs.
 */
export function smartGangRunOptimizer(
  capacity: number,
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[],
  params: {
    goal?: OptimizerGoal;
    targetPlateCount?: number;
    maxSlotsPerItem?: number;
  } = {}
): PlateConfig[] {
  const cap = Math.max(1, capacity);
  if (adjustedSizes.length === 0) {
    return [{ id: "plate-1", name: "Forma 1", manualSlots: {} }];
  }

  const { goal = "min_waste", targetPlateCount } = params;

  const minPlates = Math.max(1, Math.ceil(adjustedSizes.length / cap));
  let candidateKList: number[] = [];

  if (targetPlateCount && targetPlateCount >= 1) {
    candidateKList = [Math.max(1, targetPlateCount)];
  } else {
    const maxK = Math.min(adjustedSizes.length, minPlates + 4);
    for (let k = minPlates; k <= maxK; k++) {
      candidateKList.push(k);
    }
  }

  interface Solution {
    k: number;
    groups: (SizeDistribution & { originalQuantity?: number })[][];
    slotsMaps: Record<string, number>[];
    totalSheets: number;
    totalWaste: number;
    score: number;
  }

  let bestGlobalSolution: Solution | null = null;
  const rand = createSeededRandom(adjustedSizes.length * 101 + cap * 37 + (goal === "min_plates" ? 7 : 13));

  for (const k of candidateKList) {
    const sorted = [...adjustedSizes].sort((a, b) => b.quantity - a.quantity);

    let bestKGroups: (SizeDistribution & { originalQuantity?: number })[][] = [];
    let bestKSlotsMaps: Record<string, number>[] = [];
    let bestKCost = Infinity;
    let bestKTotalSheets = Infinity;
    let bestKTotalWaste = Infinity;

    const restarts = 6;
    for (let restart = 0; restart < restarts; restart++) {
      const groups: (SizeDistribution & { originalQuantity?: number })[][] = Array.from(
        { length: k },
        () => []
      );

      if (restart === 0) {
        const chunkSize = Math.ceil(sorted.length / k);
        for (let i = 0; i < sorted.length; i++) {
          const gIdx = Math.min(k - 1, Math.floor(i / chunkSize));
          groups[gIdx].push(sorted[i]);
        }
      } else if (restart === 1) {
        for (let i = 0; i < sorted.length; i++) {
          const gIdx = Math.min(k - 1, Math.floor(i / cap));
          groups[gIdx].push(sorted[i]);
        }
      } else {
        const shuffled = [...sorted].sort(() => rand() - 0.5);
        shuffled.forEach((it, i) => {
          const gIdx = i % k;
          groups[gIdx].push(it);
        });
      }

      const evalGroups = (grps: typeof groups) => {
        let totSheets = 0;
        let totWaste = 0;
        let overflowPenalty = 0;
        const slotsMaps: Record<string, number>[] = [];

        for (let g = 0; g < k; g++) {
          const res = allocateOptimalSlotsForPlate(grps[g], cap);
          slotsMaps.push(res.slotsMap);
          totSheets += res.requiredSheets;
          totWaste += res.waste;
          if (res.overflow > 0) {
            overflowPenalty += res.overflow * 50000;
          }
        }

        const wasteWeight = goal === "min_waste" ? 1.2 : 0.25;
        const plateWeight = goal === "min_plates" ? 2500 : 120;
        const cost = totWaste * wasteWeight + totSheets * 0.4 + k * plateWeight + overflowPenalty;

        return { slotsMaps, totSheets, totWaste, cost };
      };

      let curEval = evalGroups(groups);
      let T = 300.0;
      const coolingRate = 0.985;

      for (let step = 0; step < 500; step++) {
        T *= coolingRate;
        const g1 = Math.floor(rand() * k);
        let g2 = Math.floor(rand() * k);
        while (g2 === g1 && k > 1) g2 = Math.floor(rand() * k);

        if (groups[g1].length === 0) continue;

        const isSwap = rand() > 0.45 && groups[g2].length > 0;

        if (isSwap) {
          const idx1 = Math.floor(rand() * groups[g1].length);
          const idx2 = Math.floor(rand() * groups[g2].length);

          const it1 = groups[g1][idx1];
          const it2 = groups[g2][idx2];

          groups[g1][idx1] = it2;
          groups[g2][idx2] = it1;

          const nextEval = evalGroups(groups);
          const delta = nextEval.cost - curEval.cost;

          if (delta < 0 || rand() < Math.exp(-delta / Math.max(1, T))) {
            curEval = nextEval;
          } else {
            groups[g1][idx1] = it1;
            groups[g2][idx2] = it2;
          }
        } else if (groups[g1].length > 1 && groups[g2].length < cap) {
          const idx1 = Math.floor(rand() * groups[g1].length);
          const [moved] = groups[g1].splice(idx1, 1);
          groups[g2].push(moved);

          const nextEval = evalGroups(groups);
          const delta = nextEval.cost - curEval.cost;

          if (delta < 0 || rand() < Math.exp(-delta / Math.max(1, T))) {
            curEval = nextEval;
          } else {
            groups[g2].pop();
            groups[g1].splice(idx1, 0, moved);
          }
        }
      }

      if (curEval.cost < bestKCost) {
        bestKCost = curEval.cost;
        bestKTotalSheets = curEval.totSheets;
        bestKTotalWaste = curEval.totWaste;
        bestKGroups = groups.map((g) => [...g]);
        bestKSlotsMaps = curEval.slotsMaps;
      }
    }

    const sol: Solution = {
      k,
      groups: bestKGroups,
      slotsMaps: bestKSlotsMaps,
      totalSheets: bestKTotalSheets,
      totalWaste: bestKTotalWaste,
      score: bestKCost,
    };

    if (!bestGlobalSolution || sol.score < bestGlobalSolution.score) {
      bestGlobalSolution = sol;
    }
  }

  if (!bestGlobalSolution) {
    return [{ id: "plate-1", name: "Forma 1", manualSlots: {} }];
  }

  const validGroups = bestGlobalSolution.groups
    .map((grp, idx) => ({ items: grp, slotsMap: bestGlobalSolution!.slotsMaps[idx] }))
    .filter((g) => g.items.length > 0);

  return validGroups.map((g, idx) => ({
    id: `plate-${idx + 1}`,
    name: `Forma ${idx + 1}`,
    manualSlots: g.slotsMap,
    assignedSizeIds: g.items.map((it) => it.id),
  }));
}

export function buildPartitionedPlates(
  strategy: PlatePartitionStrategy,
  effectivePieces: number,
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[],
  optimizerParams?: SmartOptimizerParams
): PlateConfig[] {
  const cap = Math.max(1, effectivePieces);
  if (adjustedSizes.length === 0) {
    return [{ id: "plate-1", name: "Forma 1", manualSlots: {} }];
  }

  if (strategy === "smart_gang_optimizer") {
    return smartGangRunOptimizer(cap, adjustedSizes, optimizerParams);
  }

  if (strategy === "by_model") {
    const groups = new Map<string, (SizeDistribution & { originalQuantity?: number })[]>();
    adjustedSizes.forEach((s) => {
      const { model } = parseModelAndSize(s);
      const key = model || "Asosiy";
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    });

    const result: PlateConfig[] = [];
    let pCounter = 1;
    groups.forEach((groupItems, modelName) => {
      if (groupItems.length <= cap) {
        const alloc = allocateOptimalSlotsForPlate(groupItems, cap);
        result.push({
          id: `plate-${pCounter}`,
          name: groups.size > 1 ? `Forma ${pCounter} (${modelName})` : `Forma ${pCounter}`,
          manualSlots: alloc.slotsMap,
          assignedSizeIds: groupItems.map((i) => i.id),
        });
        pCounter++;
      } else {
        const subCount = Math.ceil(groupItems.length / cap);
        for (let sub = 0; sub < subCount; sub++) {
          const slice = groupItems.slice(sub * cap, (sub + 1) * cap);
          const alloc = allocateOptimalSlotsForPlate(slice, cap);
          result.push({
            id: `plate-${pCounter}-${sub}`,
            name: `Forma ${pCounter} (${modelName} · ${sub + 1}/${subCount})`,
            manualSlots: alloc.slotsMap,
            assignedSizeIds: slice.map((i) => i.id),
          });
          pCounter++;
        }
      }
    });
    return result;
  }

  if (strategy === "by_volume") {
    const sorted = [...adjustedSizes].sort((a, b) => b.quantity - a.quantity);
    const maxQ = sorted[0]?.quantity || 0;
    const minQ = sorted[sorted.length - 1]?.quantity || 0;
    const minPlatesForCap = Math.ceil(sorted.length / cap);
    const targetPlates =
      minPlatesForCap === 1 && sorted.length >= 4 && minQ > 0 && maxQ / minQ >= 1.5
        ? 2
        : Math.max(1, minPlatesForCap);

    const chunkSize = Math.ceil(sorted.length / targetPlates);
    const result: PlateConfig[] = [];
    for (let i = 0; i < targetPlates; i++) {
      const slice = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length > 0) {
        const alloc = allocateOptimalSlotsForPlate(slice, cap);
        const labelSuffix =
          targetPlates === 2 ? (i === 0 ? "Katta tiraj" : "Kichik tiraj") : `Guruh ${i + 1}`;
        result.push({
          id: `plate-${i + 1}`,
          name: `Forma ${i + 1} (${labelSuffix})`,
          manualSlots: alloc.slotsMap,
          assignedSizeIds: slice.map((s) => s.id),
        });
      }
    }
    return result;
  }

  // Default: "gang_capacity"
  const neededPlates = Math.max(1, Math.ceil(adjustedSizes.length / cap));
  const chunkSize = Math.ceil(adjustedSizes.length / neededPlates);
  const result: PlateConfig[] = [];
  for (let i = 0; i < neededPlates; i++) {
    const slice = adjustedSizes.slice(i * chunkSize, (i + 1) * chunkSize);
    if (slice.length > 0) {
      const alloc = allocateOptimalSlotsForPlate(slice, cap);
      result.push({
        id: `plate-${i + 1}`,
        name: `Forma ${i + 1}`,
        manualSlots: alloc.slotsMap,
        assignedSizeIds: slice.map((s) => s.id),
      });
    }
  }
  return result;
}

export interface PlateDistributionOptions {
  ctpSideRelation?: CtpSideRelation;
  frontColorsCount?: number;
  backColorsCount?: number;
}

export function computeTotalCtpPlatesForConfig(
  numPlates: number,
  ctpSideRelation: CtpSideRelation,
  frontColorsCount: number,
  backColorsCount: number
): number {
  if (numPlates <= 0) return 0;
  // When backColorsCount === 0 (4+0 single-sided), every distinct plate form needs its own front plates
  if (backColorsCount <= 0 || ctpSideRelation === "single_sided") {
    return numPlates * frontColorsCount;
  }
  if (ctpSideRelation === "work_and_turn") {
    return numPlates * Math.max(frontColorsCount, backColorsCount);
  }
  if (ctpSideRelation === "shared_front_variable_back") {
    return frontColorsCount + numPlates * backColorsCount;
  }
  return numPlates * (frontColorsCount + backColorsCount);
}

export function calculatePlateDistribution(
  pieces: number,
  plates: PlateConfig[],
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[],
  adjustedGeneralQuantity: number,
  options: PlateDistributionOptions = {}
): CalculatedPlate[] {
  const {
    ctpSideRelation = "shared_front_variable_back",
    frontColorsCount = 4,
    backColorsCount = 0,
  } = options;

  const effectiveRelation: CtpSideRelation =
    backColorsCount <= 0 ? "single_sided" : ctpSideRelation;

  if (pieces === 0) {
    return plates.map((p) => ({
      ...p,
      assignments: [] as SlotAssignment[],
      requiredSheets: 0,
      unassignedSlots: 0,
      overflowSkusCount: 0,
      totalTarget: 0,
      totalYield: 0,
      totalOverproduction: 0,
      totalOverproductionPercent: 0,
      ctpFrontPlates: 0,
      ctpBackPlates: 0,
      totalCtpPlates: 0,
    }));
  }

  const totalPlates = plates.length;

  return plates.map((plate, pIdx) => {
    if (adjustedSizes.length === 0) {
      const targetQ = Math.ceil(adjustedGeneralQuantity / totalPlates);
      const reqSheets = Math.ceil(targetQ / pieces);
      const yieldQ = reqSheets * pieces;
      const overQ = yieldQ - targetQ;

      let fPlates = frontColorsCount;
      let bPlates = backColorsCount;
      let totCtp = frontColorsCount + backColorsCount;

      if (effectiveRelation === "single_sided") {
        fPlates = frontColorsCount;
        bPlates = 0;
        totCtp = frontColorsCount;
      } else if (effectiveRelation === "work_and_turn") {
        totCtp = Math.max(frontColorsCount, backColorsCount);
        fPlates = totCtp;
        bPlates = 0;
      } else if (effectiveRelation === "shared_front_variable_back") {
        fPlates = pIdx === 0 ? frontColorsCount : 0;
        bPlates = backColorsCount;
        totCtp = fPlates + bPlates;
      }

      return {
        ...plate,
        assignments: [
          {
            sizeId: "generic",
            sizeLabel: "Asosiy mahsulot",
            targetQuantity: targetQ,
            slots: pieces,
            yieldQuantity: yieldQ,
            overproduction: overQ,
            overproductionPercent: targetQ > 0 ? (overQ / targetQ) * 100 : 0,
            sheetsNeeded: reqSheets,
          },
        ],
        requiredSheets: reqSheets,
        unassignedSlots: 0,
        overflowSkusCount: 0,
        totalTarget: targetQ,
        totalYield: yieldQ,
        totalOverproduction: overQ,
        totalOverproductionPercent: targetQ > 0 ? (overQ / targetQ) * 100 : 0,
        ctpFrontPlates: fPlates,
        ctpBackPlates: bPlates,
        totalCtpPlates: totCtp,
      };
    }

    let plateSizes = adjustedSizes;
    if (plate.assignedSizeIds && plate.assignedSizeIds.length > 0) {
      const idSet = new Set(plate.assignedSizeIds);
      const filtered = adjustedSizes.filter((s) => idSet.has(s.id));
      if (filtered.length > 0) {
        plateSizes = filtered;
      }
    } else if (totalPlates > 1) {
      const chunkSize = Math.ceil(adjustedSizes.length / totalPlates);
      const start = pIdx * chunkSize;
      plateSizes = adjustedSizes.slice(start, start + chunkSize);
      if (plateSizes.length === 0) {
        plateSizes = [adjustedSizes[adjustedSizes.length - 1]];
      }
    }

    // Start with optimal auto-allocated slots for this plate's items, then apply any explicit manual overrides
    const autoAlloc = allocateOptimalSlotsForPlate(plateSizes, pieces);
    const assignments: SlotAssignment[] = [];
    let assignedTotal = 0;

    for (const s of plateSizes) {
      const hasManualOverride = plate.manualSlots[s.id] !== undefined;
      const slots = hasManualOverride ? plate.manualSlots[s.id] : (autoAlloc.slotsMap[s.id] ?? 1);
      const { model, sizeCode } = parseModelAndSize(s);
      assignments.push({
        sizeId: s.id,
        sizeLabel: s.size,
        model: model || undefined,
        sizeCode: sizeCode || s.size,
        targetQuantity: s.quantity,
        slots,
      });
      assignedTotal += slots;
    }

    const remainingSlots = pieces - assignedTotal;
    const overflowSkusCount = assignments.filter((a) => a.slots === 0).length;

    // Calculate required sheets for this plate
    let requiredSheets = 0;
    assignments.forEach((a) => {
      if (a.slots > 0) {
        const sCount = Math.ceil(a.targetQuantity / a.slots);
        a.sheetsNeeded = sCount;
        if (sCount > requiredSheets) requiredSheets = sCount;
      } else {
        a.sheetsNeeded = 0;
      }
    });

    if (plate.customSheetRun && plate.customSheetRun > 0) {
      requiredSheets = plate.customSheetRun;
    }

    let totalTarget = 0;
    let totalYield = 0;
    let totalOver = 0;

    assignments.forEach((a) => {
      totalTarget += a.targetQuantity;
      const yieldQty = a.slots * requiredSheets;
      a.yieldQuantity = yieldQty;
      const overQty = Math.max(0, yieldQty - a.targetQuantity);
      a.overproduction = overQty;
      a.overproductionPercent = a.targetQuantity > 0 ? (overQty / a.targetQuantity) * 100 : 0;
      totalYield += yieldQty;
      totalOver += overQty;
    });

    const totalOverPct = totalTarget > 0 ? (totalOver / totalTarget) * 100 : 0;

    let ctpFrontPlates = 0;
    let ctpBackPlates = 0;
    let totalCtpPlates = 0;

    if (effectiveRelation === "single_sided") {
      ctpFrontPlates = frontColorsCount;
      ctpBackPlates = 0;
      totalCtpPlates = frontColorsCount;
    } else if (effectiveRelation === "work_and_turn") {
      totalCtpPlates = Math.max(frontColorsCount, backColorsCount);
      ctpFrontPlates = totalCtpPlates;
      ctpBackPlates = 0;
    } else if (effectiveRelation === "shared_front_variable_back") {
      ctpFrontPlates = pIdx === 0 ? frontColorsCount : 0;
      ctpBackPlates = backColorsCount;
      totalCtpPlates = ctpFrontPlates + ctpBackPlates;
    } else {
      ctpFrontPlates = frontColorsCount;
      ctpBackPlates = backColorsCount;
      totalCtpPlates = ctpFrontPlates + ctpBackPlates;
    }

    return {
      ...plate,
      assignments,
      requiredSheets,
      unassignedSlots: remainingSlots,
      overflowSkusCount,
      totalTarget,
      totalYield,
      totalOverproduction: totalOver,
      totalOverproductionPercent: totalOverPct,
      ctpFrontPlates,
      ctpBackPlates,
      totalCtpPlates,
    };
  });
}

/**
 * Pre-calculates real comparison metrics for all imposition plan options
 * so the user sees exact form count, sheet count, and CTP count inside the selector.
 */
export function compareImpositionPlans(
  effectivePieces: number,
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[],
  adjustedGeneralQuantity: number,
  cutDivisor: number,
  ctpSideRelation: CtpSideRelation,
  frontColorsCount: number,
  backColorsCount: number,
  hasMultipleModels: boolean
): ImpositionPlanSummary[] {
  const cap = Math.max(1, effectivePieces);
  const div = Math.max(1, cutDivisor);

  const evalStrategy = (
    id: "min_waste" | "min_plates" | "by_model",
    label: string,
    platesCfg: PlateConfig[]
  ): ImpositionPlanSummary => {
    const calc = calculatePlateDistribution(cap, platesCfg, adjustedSizes, adjustedGeneralQuantity, {
      ctpSideRelation,
      frontColorsCount,
      backColorsCount,
    });
    const totalPressSheets = calc.reduce((s, p) => s + p.requiredSheets, 0);
    const totalParentSheets = Math.ceil(totalPressSheets / div);
    const totalTarget = calc.reduce((s, p) => s + (p.totalTarget || 0), 0);
    const totalOver = calc.reduce((s, p) => s + (p.totalOverproduction || 0), 0);
    const overPct = totalTarget > 0 ? (totalOver / totalTarget) * 100 : 0;
    const totalCtpPlates = computeTotalCtpPlatesForConfig(
      calc.length,
      ctpSideRelation,
      frontColorsCount,
      backColorsCount
    );

    return {
      id,
      label,
      platesCount: calc.length,
      totalPressSheets,
      totalParentSheets,
      totalCtpPlates,
      overproductionPct: Number(overPct.toFixed(1)),
    };
  };

  const minWastePlates = buildPartitionedPlates("smart_gang_optimizer", cap, adjustedSizes, {
    capacity: cap,
    goal: "min_waste",
  });
  const minPlatesCfg = buildPartitionedPlates("smart_gang_optimizer", cap, adjustedSizes, {
    capacity: cap,
    goal: "min_plates",
  });

  const list: ImpositionPlanSummary[] = [
    evalStrategy("min_waste", "Min. chiqindi", minWastePlates),
    evalStrategy("min_plates", "Kamroq qolip", minPlatesCfg),
  ];

  if (hasMultipleModels) {
    const byModelCfg = buildPartitionedPlates("by_model", cap, adjustedSizes);
    list.push(evalStrategy("by_model", "Modellar bo'yicha", byModelCfg));
  }

  return list;
}

export function calculateOuterTrimMarks(
  layout: ImpositionLayout,
  margins: PrepressMargins,
  gap: number,
  bleed: number
): TrimMarkSegment[] {
  const segs: TrimMarkSegment[] = [];
  if (layout.cols === 0 || layout.rows === 0) return segs;

  const { gridLeft: baseLeft, gridTop: baseTop } = margins;
  const gridLeft = baseLeft + layout.offsetX;
  const gridTop = baseTop + layout.offsetY;
  const tmLen = 5;
  const tmOff = 2;
  const gridRight = gridLeft + layout.cols * layout.itemW + (layout.cols - 1) * gap;
  const gridBottom = gridTop + layout.rows * layout.itemH + (layout.rows - 1) * gap;

  const xs = new Set<number>();
  for (let c = 0; c < layout.cols; c++) {
    const x0 = gridLeft + c * (layout.itemW + gap) + bleed;
    xs.add(x0);
    xs.add(x0 + layout.itemW - bleed * 2);
  }
  const ys = new Set<number>();
  for (let r = 0; r < layout.rows; r++) {
    const y0 = gridTop + r * (layout.itemH + gap) + bleed;
    ys.add(y0);
    ys.add(y0 + layout.itemH - bleed * 2);
  }

  xs.forEach((x) => {
    segs.push({ x1: x, y1: gridTop - tmOff, x2: x, y2: gridTop - tmOff - tmLen });
    segs.push({ x1: x, y1: gridBottom + tmOff, x2: x, y2: gridBottom + tmOff + tmLen });
  });
  ys.forEach((y) => {
    segs.push({ x1: gridLeft - tmOff, y1: y, x2: gridLeft - tmOff - tmLen, y2: y });
    segs.push({ x1: gridRight + tmOff, y1: y, x2: gridRight + tmOff + tmLen, y2: y });
  });

  return segs;
}

/**
 * Calculates how many sample press sheets can be cut from a full-size parent sheet.
 */
export function calculateParentSheetCuts(
  parentW: number,
  parentH: number,
  childW: number,
  childH: number,
  neededChildSheets: number = 1
): ParentCutResult {
  if (parentW <= 0 || parentH <= 0 || childW <= 0 || childH <= 0) {
    return { cuts: 0, orientation: "direct", wastePercent: 100, parentSheetsNeeded: 0 };
  }

  const directCols = Math.floor(parentW / childW);
  const directRows = Math.floor(parentH / childH);
  const directCuts = directCols * directRows;

  const rotCols = Math.floor(parentW / childH);
  const rotRows = Math.floor(parentH / childW);
  const rotCuts = rotCols * rotRows;

  const bestCuts = Math.max(directCuts, rotCuts);
  const bestOrientation: "direct" | "rotated" = rotCuts > directCuts ? "rotated" : "direct";

  const parentArea = parentW * parentH;
  const usedArea = bestCuts * (childW * childH);
  const wastePercent = parentArea > 0 ? Math.max(0, ((parentArea - usedArea) / parentArea) * 100) : 0;

  const parentSheetsNeeded = bestCuts > 0 ? Math.ceil(neededChildSheets / bestCuts) : 0;

  return {
    cuts: bestCuts,
    orientation: bestOrientation,
    wastePercent: Number(wastePercent.toFixed(1)),
    parentSheetsNeeded,
  };
}
