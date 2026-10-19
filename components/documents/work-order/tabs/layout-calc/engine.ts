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

export function buildPartitionedPlates(
  strategy: PlatePartitionStrategy,
  effectivePieces: number,
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[]
): PlateConfig[] {
  const cap = Math.max(1, effectivePieces);
  if (adjustedSizes.length === 0) {
    return [{ id: `plate-1-${Date.now()}`, name: "Plate 1", manualSlots: {} }];
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
          name: groups.size > 1 ? `Plate ${pCounter} (${modelName})` : `Plate ${pCounter}`,
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
            name: `Plate ${pCounter} (${modelName} · ${sub + 1}/${subCount})`,
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
    // If all fit on 1 sheet, still split into at least 2 plates (High-run vs Low-run) if there are >= 4 SKUs and max/min ratio >= 1.8
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
          name: `Plate ${i + 1} (${labelSuffix})`,
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
        name: `Plate ${i + 1}`,
        manualSlots: {},
        assignedSizeIds: slice.map((s) => s.id),
      });
    }
  }
  return result;
}

export function calculatePlateDistribution(
  pieces: number,
  plates: PlateConfig[],
  adjustedSizes: (SizeDistribution & { originalQuantity?: number })[],
  adjustedGeneralQuantity: number
): CalculatedPlate[] {
  if (pieces === 0) {
    return plates.map((p) => ({
      ...p,
      assignments: [] as SlotAssignment[],
      requiredSheets: 0,
      unassignedSlots: 0,
      overflowSkusCount: 0,
    }));
  }

  const totalPlates = plates.length;

  return plates.map((plate, pIdx) => {
    if (adjustedSizes.length === 0) {
      // Generic mode without variations
      const targetQ = Math.ceil(adjustedGeneralQuantity / totalPlates);
      const reqSheets = Math.ceil(targetQ / pieces);
      return {
        ...plate,
        assignments: [
          {
            sizeId: "generic",
            sizeLabel: "Main Product",
            targetQuantity: targetQ,
            slots: pieces,
          },
        ],
        requiredSheets: reqSheets,
        unassignedSlots: 0,
        overflowSkusCount: 0,
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
      // Allocate 1 slot to the first `pieces` SKUs (by priority/quantity) and 0 to the rest,
      // and record overflowSkusCount so the UI prompts to Auto-Split plates.
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
        if (sCount > requiredSheets) requiredSheets = sCount;
      }
    });

    return {
      ...plate,
      assignments,
      requiredSheets,
      unassignedSlots: remainingSlots,
      overflowSkusCount,
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
    wastePercent,
    parentSheetsNeeded,
  };
}

