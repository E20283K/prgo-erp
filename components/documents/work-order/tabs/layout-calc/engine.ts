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
} from "./types";

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
      gt = gripper;
    } else if (activeGripperEdge === "Bottom") {
      gb = gripper;
    } else if (activeGripperEdge === "Left") {
      gl = gripper;
    } else if (activeGripperEdge === "Right") {
      gr = gripper;
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
    return [{ id: `plate-1-${Date.now()}`, name: "Forma 1", manualSlots: {} }];
  }

  const { goal = "min_waste", targetPlateCount } = params;

  // Determine possible plate counts to search
  const minPlates = Math.max(1, Math.ceil(adjustedSizes.length / cap));
  let candidateKList: number[] = [];

  if (targetPlateCount && targetPlateCount >= 1) {
    candidateKList = [Math.max(1, targetPlateCount)];
  } else {
    // Search from minPlates up to min(adjustedSizes.length, minPlates + 4)
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

  for (const k of candidateKList) {
    const sorted = [...adjustedSizes].sort((a, b) => b.quantity - a.quantity);

    let bestKGroups: (SizeDistribution & { originalQuantity?: number })[][] = [];
    let bestKSlotsMaps: Record<string, number>[] = [];
    let bestKCost = Infinity;
    let bestKTotalSheets = Infinity;
    let bestKTotalWaste = Infinity;

    // Run 10 simulated annealing restarts
    const restarts = 10;
    for (let restart = 0; restart < restarts; restart++) {
      const groups: (SizeDistribution & { originalQuantity?: number })[][] = Array.from(
        { length: k },
        () => []
      );

      if (restart === 0) {
        // Chunk sorted items
        const chunkSize = Math.ceil(sorted.length / k);
        for (let i = 0; i < sorted.length; i++) {
          const gIdx = Math.min(k - 1, Math.floor(i / chunkSize));
          groups[gIdx].push(sorted[i]);
        }
      } else if (restart === 1) {
        // Block chunks bounded by capacity
        for (let i = 0; i < sorted.length; i++) {
          const gIdx = Math.min(k - 1, Math.floor(i / cap));
          groups[gIdx].push(sorted[i]);
        }
      } else {
        // Balanced random permutation
        const shuffled = [...sorted].sort(() => Math.random() - 0.5);
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

        const wasteWeight = goal === "min_waste" ? 1.0 : 0.4;
        const plateWeight = goal === "min_plates" ? 500 : 50;
        const cost = totWaste * wasteWeight + totSheets * 0.4 + k * plateWeight + overflowPenalty;

        return { slotsMaps, totSheets, totWaste, cost };
      };

      let curEval = evalGroups(groups);
      let T = 350.0;
      const coolingRate = 0.99;

      // 1000 annealing steps
      for (let step = 0; step < 1000; step++) {
        T *= coolingRate;
        const g1 = Math.floor(Math.random() * k);
        let g2 = Math.floor(Math.random() * k);
        while (g2 === g1 && k > 1) g2 = Math.floor(Math.random() * k);

        if (groups[g1].length === 0) continue;

        const isSwap = Math.random() > 0.45 && groups[g2].length > 0;

        if (isSwap) {
          const idx1 = Math.floor(Math.random() * groups[g1].length);
          const idx2 = Math.floor(Math.random() * groups[g2].length);

          const it1 = groups[g1][idx1];
          const it2 = groups[g2][idx2];

          groups[g1][idx1] = it2;
          groups[g2][idx2] = it1;

          const nextEval = evalGroups(groups);
          const delta = nextEval.cost - curEval.cost;

          if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(1, T))) {
            curEval = nextEval;
          } else {
            // Revert
            groups[g1][idx1] = it1;
            groups[g2][idx2] = it2;
          }
        } else if (groups[g1].length > 1 && groups[g2].length < cap) {
          // Move from g1 to g2
          const idx1 = Math.floor(Math.random() * groups[g1].length);
          const [moved] = groups[g1].splice(idx1, 1);
          groups[g2].push(moved);

          const nextEval = evalGroups(groups);
          const delta = nextEval.cost - curEval.cost;

          if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(1, T))) {
            curEval = nextEval;
          } else {
            // Revert
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
    return [{ id: `plate-1-${Date.now()}`, name: "Forma 1", manualSlots: {} }];
  }

  // Filter out any empty groups
  const validGroups = bestGlobalSolution.groups
    .map((grp, idx) => ({ items: grp, slotsMap: bestGlobalSolution!.slotsMaps[idx] }))
    .filter((g) => g.items.length > 0);

  const result: PlateConfig[] = validGroups.map((g, idx) => {
    return {
      id: `plate-${idx + 1}-${Date.now()}`,
      name: `Forma ${idx + 1}`,
      manualSlots: g.slotsMap,
      assignedSizeIds: g.items.map((it) => it.id),
    };
  });

  return result;
}

export function buildPartitionedPlates(
  strategy: PlatePartitionStrategy,
  effectivePieces: number,
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[],
  optimizerParams?: SmartOptimizerParams
): PlateConfig[] {
  const cap = Math.max(1, effectivePieces);
  if (adjustedSizes.length === 0) {
    return [{ id: `plate-1-${Date.now()}`, name: "Forma 1", manualSlots: {} }];
  }

  if (strategy === "smart_gang_optimizer") {
    return smartGangRunOptimizer(cap, adjustedSizes, optimizerParams);
  }

  if (strategy === "by_model") {
    // Group SKUs by model name
    const groups = new Map<string, (SizeDistribution & { originalQuantity?: number })[]>();
    adjustedSizes.forEach((s) => {
      const { model } = parseModelAndSize(s);
      const key = model || "Asosiy model";
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    });

    const result: PlateConfig[] = [];
    let pCounter = 1;
    groups.forEach((groupItems, modelName) => {
      if (groupItems.length <= cap) {
        result.push({
          id: `plate-${pCounter}-${Date.now()}`,
          name: groups.size > 1 ? `Forma ${pCounter} (${modelName})` : `Forma ${pCounter}`,
          manualSlots: {},
          assignedSizeIds: groupItems.map((i) => i.id),
        });
        pCounter++;
      } else {
        // Model itself has more sizes than 1 sheet capacity -> split model into sub-plates
        const subCount = Math.ceil(groupItems.length / cap);
        for (let sub = 0; sub < subCount; sub++) {
          const slice = groupItems.slice(sub * cap, (sub + 1) * cap);
          result.push({
            id: `plate-${pCounter}-${Date.now()}-${sub}`,
            name: `Forma ${pCounter} (${modelName} · ${sub + 1}/${subCount})`,
            manualSlots: {},
            assignedSizeIds: slice.map((i) => i.id),
          });
          pCounter++;
        }
      }
    });
    return result;
  }

  if (strategy === "by_volume") {
    // Sort SKUs by quantity descending so high-volume items and low-volume items are separated
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
        const labelSuffix =
          targetPlates === 2 ? (i === 0 ? "High-Run" : "Low-Run") : `Batch ${i + 1}`;
        result.push({
          id: `plate-${i + 1}-${Date.now()}`,
          name: `Forma ${i + 1} (${labelSuffix})`,
          manualSlots: {},
          assignedSizeIds: slice.map((s) => s.id),
        });
      }
    }
    return result;
  }

  // Default: "gang_capacity" (Pack as many SKUs per plate as effectivePieces allows)
  const neededPlates = Math.max(1, Math.ceil(adjustedSizes.length / cap));
  const chunkSize = Math.ceil(adjustedSizes.length / neededPlates);
  const result: PlateConfig[] = [];
  for (let i = 0; i < neededPlates; i++) {
    const slice = adjustedSizes.slice(i * chunkSize, (i + 1) * chunkSize);
    if (slice.length > 0) {
      result.push({
        id: `plate-${i + 1}-${Date.now()}`,
        name: `Forma ${i + 1}`,
        manualSlots: {},
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
    backColorsCount = 4,
  } = options;

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
      // Generic mode without variations
      const targetQ = Math.ceil(adjustedGeneralQuantity / totalPlates);
      const reqSheets = Math.ceil(targetQ / pieces);
      const yieldQ = reqSheets * pieces;
      const overQ = yieldQ - targetQ;

      // CTP plates per this plate
      const fPlates = ctpSideRelation === "shared_front_variable_back" ? (pIdx === 0 ? frontColorsCount : 0) : frontColorsCount;
      const bPlates = ctpSideRelation === "work_and_turn" ? 0 : backColorsCount;
      const totCtp = ctpSideRelation === "work_and_turn" ? Math.max(frontColorsCount, backColorsCount) : fPlates + bPlates;

      return {
        ...plate,
        assignments: [
          {
            sizeId: "generic",
            sizeLabel: "Main Product",
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

    // Determine which sizes belong to this plate
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

    const totalTargetInPlate = plateSizes.reduce((sum, s) => sum + s.quantity, 0);

    // Check manual overrides for this plate
    let remainingSlots = pieces;
    const assignments: SlotAssignment[] = [];
    let hasManual = false;
    let overflowSkusCount = 0;

    for (const s of plateSizes) {
      if (plate.manualSlots[s.id] !== undefined) {
        hasManual = true;
        break;
      }
    }

    if (hasManual) {
      for (const s of plateSizes) {
        const slots = plate.manualSlots[s.id] ?? 0;
        const { model, sizeCode } = parseModelAndSize(s);
        assignments.push({
          sizeId: s.id,
          sizeLabel: s.size,
          model: model || undefined,
          sizeCode: sizeCode || s.size,
          targetQuantity: s.quantity,
          slots,
        });
        remainingSlots -= slots;
      }
    } else if (plateSizes.length > pieces) {
      // More SKUs assigned to this single plate than physical slots on the sheet!
      overflowSkusCount = plateSizes.length - pieces;
      plateSizes.forEach((s, idx) => {
        const slots = idx < pieces ? 1 : 0;
        const { model, sizeCode } = parseModelAndSize(s);
        assignments.push({
          sizeId: s.id,
          sizeLabel: s.size,
          model: model || undefined,
          sizeCode: sizeCode || s.size,
          targetQuantity: s.quantity,
          slots,
        });
      });
      remainingSlots = 0;
    } else {
      // Proportional Auto-Distribution when plateSizes.length <= pieces
      const exactSlots = plateSizes.map((s) => ({
        ...s,
        exact: totalTargetInPlate > 0 ? (s.quantity / totalTargetInPlate) * pieces : 0,
      }));

      let assigned = 0;
      exactSlots.forEach((s) => {
        const slots = Math.max(1, Math.floor(s.exact)); // at least 1 slot
        const { model, sizeCode } = parseModelAndSize(s);
        assignments.push({
          sizeId: s.id,
          sizeLabel: s.size,
          model: model || undefined,
          sizeCode: sizeCode || s.size,
          targetQuantity: s.quantity,
          slots,
        });
        assigned += slots;
      });

      remainingSlots = pieces - assigned;

      if (remainingSlots > 0) {
        const remainders = exactSlots
          .map((s, i) => ({
            index: i,
            rem: s.exact - Math.floor(s.exact),
          }))
          .sort((a, b) => b.rem - a.rem);

        for (let i = 0; i < remainingSlots; i++) {
          const idx = remainders[i % remainders.length].index;
          assignments[idx].slots += 1;
        }
        remainingSlots = 0;
      } else if (remainingSlots < 0) {
        let over = Math.abs(remainingSlots);
        for (let i = assignments.length - 1; i >= 0 && over > 0; i--) {
          while (assignments[i].slots > 1 && over > 0) {
            assignments[i].slots -= 1;
            over -= 1;
          }
        }
        remainingSlots = 0;
      }
    }

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

    // Populate yields and overproduction for each assignment
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

    // CTP Plates calculation for this specific plate
    let ctpFrontPlates = 0;
    let ctpBackPlates = 0;
    let totalCtpPlates = 0;

    if (ctpSideRelation === "work_and_turn") {
      // 1 plate set per plate
      totalCtpPlates = Math.max(frontColorsCount, backColorsCount);
      ctpFrontPlates = totalCtpPlates;
      ctpBackPlates = 0;
    } else if (ctpSideRelation === "shared_front_variable_back") {
      // Front is shared once overall, but for this plate we attribute front to plate 1
      ctpFrontPlates = pIdx === 0 ? frontColorsCount : 0;
      ctpBackPlates = backColorsCount;
      totalCtpPlates = ctpFrontPlates + ctpBackPlates;
    } else {
      // Independent
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

  // Direct alignment (same grain / orientation)
  const directCols = Math.floor(parentW / childW);
  const directRows = Math.floor(parentH / childH);
  const directCuts = directCols * directRows;

  // Rotated alignment (90 deg)
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
