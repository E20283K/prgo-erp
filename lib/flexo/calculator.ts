import {
  FlexoCylinderData,
  FlexoInputs,
  FlexoLayoutDimensions,
  FlexoLayoutPosition,
  FlexoLayoutResult,
  FlexoLayoutWarning,
  FlexoMark,
  FlexoColorSeparation,
  FlexoCylinderRecommendation,
} from "./types";
import { JR_1521_CYLINDERS, FLEXO_MACHINES, FLEXO_MATERIALS } from "./masterData";

/**
 * Evaluates available cylinders for a given product and orientation to find
 * the best repeat matches with minimal circumference waste.
 */
export function findCylinderCandidates(
  params: {
    productWidth: number;
    productHeight: number;
    orientation: "normal" | "rotated";
    bleedY: number;
    gapY: number;
  },
  cylinders: FlexoCylinderData[] = JR_1521_CYLINDERS
): FlexoCylinderRecommendation[] {
  const placedH = params.orientation === "normal" ? params.productHeight : params.productWidth;
  const itemTotalH = placedH + params.bleedY * 2;

  if (itemTotalH <= 0) return [];

  const candidates: FlexoCylinderRecommendation[] = [];

  for (const cyl of cylinders) {
    if (cyl.printingLength < itemTotalH) continue;

    const around = Math.floor((cyl.printingLength + params.gapY) / (itemTotalH + params.gapY));
    if (around < 1) continue;

    const usedLen = around * itemTotalH + (around - 1) * params.gapY;
    const residual = Math.max(0, cyl.printingLength - usedLen);
    const utilization = Math.min(100, (usedLen / cyl.printingLength) * 100);

    // Score prioritizes higher utilization and clean repeat fit
    let score = Math.round(utilization);
    if (cyl.needsVerification) {
      score -= 15; // penalty for unverified cylinder
    }

    candidates.push({
      cylinder: cyl,
      aroundCount: around,
      verticalFitEfficiency: Math.round(utilization * 10) / 10,
      residualSpace: Math.round(residual * 100) / 100,
      suitabilityScore: score,
      recommended: false,
    });
  }

  // Sort descending by score, then by smaller cylinder if scores are close
  candidates.sort((a, b) => {
    if (Math.abs(b.suitabilityScore - a.suitabilityScore) > 1) {
      return b.suitabilityScore - a.suitabilityScore;
    }
    return a.cylinder.teeth - b.cylinder.teeth;
  });

  if (candidates.length > 0) {
    candidates[0].recommended = true;
  }

  return candidates;
}

/**
 * Main Flexo Layout Calculation Engine
 * Pure deterministic calculation producing structured layout result.
 */
export function calculateFlexoLayout(inputs: FlexoInputs): FlexoLayoutResult {
  const warnings: FlexoLayoutWarning[] = [];

  // 1. Resolve Machine & Material
  const machine = FLEXO_MACHINES.find((m) => m.id === inputs.machineId) || FLEXO_MACHINES[0];
  const material = FLEXO_MATERIALS.find((m) => m.id === inputs.materialId) || FLEXO_MATERIALS[0];

  // 2. Resolve Cylinder
  const availableCylinders = machine.availableCylinders.length > 0 ? machine.availableCylinders : JR_1521_CYLINDERS;
  const cylinder =
    availableCylinders.find((c) => c.teeth === inputs.cylinderTeeth) ||
    availableCylinders.find((c) => c.teeth === 100) ||
    availableCylinders[0];

  if (!cylinder) {
    warnings.push({
      code: "NO_CYLINDER",
      severity: "error",
      message: "No valid cylinder found for this configuration.",
      field: "cylinderTeeth",
    });
  } else if (cylinder.needsVerification) {
    warnings.push({
      code: "CYLINDER_UNVERIFIED",
      severity: "warning",
      message: `Selected cylinder (${cylinder.teeth}T) contains source values requiring verification: ${cylinder.verificationNote || "Check cylinder diameter."}`,
      field: "cylinderTeeth",
    });
  }

  const plateThickness = inputs.plateThickness > 0 ? inputs.plateThickness : (cylinder?.plateThickness ?? 1.7);
  if (cylinder && Math.abs(cylinder.plateThickness - plateThickness) > 0.05) {
    warnings.push({
      code: "PLATE_THICKNESS_MISMATCH",
      severity: "warning",
      message: `Plate thickness (${plateThickness} mm) differs from cylinder calibration (${cylinder.plateThickness} mm).`,
      field: "plateThickness",
    });
  }

  // 3. Geometry & Orientation
  const isRotated = inputs.orientation === "rotated";
  const placedW = isRotated ? inputs.productHeight : inputs.productWidth;
  const placedH = isRotated ? inputs.productWidth : inputs.productHeight;

  const itemTotalW = placedW + inputs.bleedX * 2;
  const itemTotalH = placedH + inputs.bleedY * 2;

  // 4. Web & Across Calculation
  const webWidth = Math.max(1, inputs.webWidth);
  const sideMarginLeft = Math.max(0, inputs.sideMarginLeft);
  const sideMarginRight = Math.max(0, inputs.sideMarginRight);
  const usablePrintWidth = Math.max(0, webWidth - sideMarginLeft - sideMarginRight);

  let acrossCount = 0;
  if (itemTotalW > 0 && usablePrintWidth >= itemTotalW) {
    acrossCount = Math.floor((usablePrintWidth + inputs.gapX) / (itemTotalW + inputs.gapX));
  }

  if (acrossCount === 0) {
    warnings.push({
      code: "PRODUCT_EXCEEDS_WEB",
      severity: "error",
      message: `Product width + bleed (${itemTotalW} mm) exceeds usable web width (${usablePrintWidth} mm).`,
      field: "webWidth",
    });
  }

  const usedWidth = acrossCount > 0 ? acrossCount * itemTotalW + (acrossCount - 1) * inputs.gapX : 0;
  const sideWasteWidth = Math.max(0, webWidth - usedWidth);

  if (webWidth > 0 && acrossCount > 0 && sideWasteWidth / webWidth > 0.35) {
    warnings.push({
      code: "HIGH_SIDE_WASTE",
      severity: "info",
      message: `Side waste is ${(sideWasteWidth).toFixed(1)} mm (${((sideWasteWidth / webWidth) * 100).toFixed(0)}% of web width). Consider a narrower web width or rotated orientation.`,
      field: "webWidth",
    });
  }

  // 5. Cylinder Repeat & Around Calculation
  const printingLength = cylinder ? cylinder.printingLength : 271.07;
  const filmLength = cylinder ? cylinder.filmLength : 261.77;
  const cylinderDiameter = cylinder ? cylinder.cylinderDiameter : 82.78;
  const pitchCircleDiameter = cylinder ? cylinder.pitchCircleDiameter : 86.28;
  const gearTeeth = cylinder ? cylinder.teeth : 100;

  let aroundCount = 0;
  if (itemTotalH > 0 && printingLength >= itemTotalH) {
    aroundCount = Math.floor((printingLength + inputs.gapY) / (itemTotalH + inputs.gapY));
  }

  if (aroundCount === 0) {
    warnings.push({
      code: "PRODUCT_EXCEEDS_REPEAT",
      severity: "error",
      message: `Product height + bleed (${itemTotalH} mm) exceeds cylinder repeat (${printingLength} mm). Select a larger cylinder.`,
      field: "cylinderTeeth",
    });
  }

  const usedHeight = aroundCount > 0 ? aroundCount * itemTotalH + (aroundCount - 1) * inputs.gapY : 0;
  const residualRepeatSpace = Math.max(0, printingLength - usedHeight);
  if (printingLength > 0 && aroundCount > 0 && residualRepeatSpace / printingLength > 0.25) {
    warnings.push({
      code: "REPEAT_GAP_HIGH",
      severity: "info",
      message: `Circumference has ${residualRepeatSpace.toFixed(1)} mm unused repeat gap. Use Cylinder Optimizer for a tighter fit.`,
      field: "cylinderTeeth",
    });
  }

  const totalPerRepeat = acrossCount * aroundCount;

  // 6. Overproduction & Production Quantities
  const requiredQuantity = Math.max(1, inputs.requiredQuantity);
  let productionTargetQuantity = requiredQuantity;
  if (inputs.overproductionValue > 0) {
    if (inputs.overproductionMode === "percent") {
      productionTargetQuantity = Math.ceil(requiredQuantity * (1 + inputs.overproductionValue / 100));
    } else {
      productionTargetQuantity = requiredQuantity + inputs.overproductionValue;
    }
  }

  const repeatCount = totalPerRepeat > 0 ? Math.ceil(productionTargetQuantity / totalPerRepeat) : 0;
  const actualYieldQuantity = repeatCount * totalPerRepeat;

  // 7. Material Consumption & Yield
  const materialConsumptionMeters = repeatCount > 0 ? (repeatCount * printingLength) / 1000 : 0;
  const materialConsumptionSqM = (materialConsumptionMeters * webWidth) / 1000;

  const netProductAreaSqM = (actualYieldQuantity * inputs.productWidth * inputs.productHeight) / 1_000_000;
  const yieldPercent =
    materialConsumptionSqM > 0 ? Math.min(100, (netProductAreaSqM / materialConsumptionSqM) * 100) : 0;
  const wasteSqM = Math.max(0, materialConsumptionSqM - netProductAreaSqM);

  // 8. Product Positions within 1 Repeat Revolution
  const positions: FlexoLayoutPosition[] = [];
  const gridStartX = sideMarginLeft + Math.max(0, (usablePrintWidth - usedWidth) / 2);
  const gridStartY = Math.max(0, (printingLength - usedHeight) / 2);

  if (acrossCount > 0 && aroundCount > 0) {
    let itemIndex = 0;
    for (let row = 0; row < aroundCount; row++) {
      for (let col = 0; col < acrossCount; col++) {
        itemIndex++;
        const x = gridStartX + col * (itemTotalW + inputs.gapX) + inputs.bleedX;
        const y = gridStartY + row * (itemTotalH + inputs.gapY) + inputs.bleedY;

        positions.push({
          id: `pos-${row}-${col}`,
          acrossIndex: col,
          aroundIndex: row,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          width: placedW,
          height: placedH,
          bleedX: inputs.bleedX,
          bleedY: inputs.bleedY,
          label: `#${itemIndex}`,
          orientation: inputs.orientation,
        });
      }
    }
  }

  // 9. Registration & Technical Marks
  const marks: FlexoMark[] = [];

  // Optic Eye Mark (Sensor trigger mark for automated label cutting/rewinding)
  if (aroundCount > 0) {
    const eyeMarkX = Math.max(0.5, sideMarginLeft > 2 ? sideMarginLeft - 4 : 0.5);
    marks.push({
      type: "eyemark",
      x: eyeMarkX,
      y: gridStartY + 1,
      width: 4,
      height: 2.5,
      label: "EYEMARK",
      color: "#09090b",
    });
  }

  // Registration Crosshairs (Prepress mounting & alignment)
  if (webWidth > 0 && printingLength > 0) {
    marks.push({
      type: "crosshair",
      x: webWidth / 2,
      y: 3,
      width: 5,
      height: 5,
      label: "REG-TOP",
    });
    marks.push({
      type: "crosshair",
      x: webWidth / 2,
      y: printingLength - 3,
      width: 5,
      height: 5,
      label: "REG-BOT",
    });
  }

  // Color separation bars / patch test
  const defaultColors = [
    { name: "Cyan", colorCode: "#00a8e8", plateIndex: 1 },
    { name: "Magenta", colorCode: "#ec008c", plateIndex: 2 },
    { name: "Yellow", colorCode: "#ffec00", plateIndex: 3 },
    { name: "Black", colorCode: "#18181b", plateIndex: 4 },
  ];
  const colors: FlexoColorSeparation[] = defaultColors.slice(0, Math.max(1, Math.min(4, inputs.colors)));

  if (colors.length > 0) {
    const patchW = 3;
    const patchH = 3;
    const rightMarginX = webWidth - sideMarginRight + 1;
    colors.forEach((col, cIdx) => {
      marks.push({
        type: "colorbar",
        x: Math.min(webWidth - 4, rightMarginX),
        y: gridStartY + cIdx * (patchH + 1.5),
        width: patchW,
        height: patchH,
        label: col.name.charAt(0),
        color: col.colorCode,
      });
    });
  }

  // 10. Dimensions Metadata
  const dimensions: FlexoLayoutDimensions = {
    webWidth,
    usablePrintWidth,
    occupiedWidth: usedWidth,
    sideMarginLeft,
    sideMarginRight,
    sideWasteTotal: sideWasteWidth,
    productWidth: inputs.productWidth,
    productHeight: inputs.productHeight,
    placedWidth: placedW,
    placedHeight: placedH,
    gapX: inputs.gapX,
    gapY: inputs.gapY,
    repeatPrintingLength: printingLength,
    repeatFilmLength: filmLength,
    cylinderDiameter,
    gearTeeth,
    plateThickness,
  };

  return {
    machineId: machine.id,
    machineName: machine.name,
    materialId: material.id,
    materialName: material.name,

    webWidth,
    usablePrintWidth,
    sideMarginLeft,
    sideMarginRight,

    productWidth: inputs.productWidth,
    productHeight: inputs.productHeight,

    bleedX: inputs.bleedX,
    bleedY: inputs.bleedY,

    gapX: inputs.gapX,
    gapY: inputs.gapY,

    orientation: inputs.orientation,

    gearTeeth,
    cylinderDiameter,
    pitchCircleDiameter,
    filmLength,
    printingLength,
    plateThickness,

    acrossCount,
    aroundCount,
    totalPerRepeat,

    requiredQuantity,
    overproductionMode: inputs.overproductionMode,
    overproductionValue: inputs.overproductionValue,
    productionTargetQuantity,

    repeatCount,
    actualYieldQuantity,

    materialConsumptionMeters: Math.round(materialConsumptionMeters * 10) / 10,
    materialConsumptionSqM: Math.round(materialConsumptionSqM * 100) / 100,
    wasteSqM: Math.round(wasteSqM * 100) / 100,
    usedWidth: Math.round(usedWidth * 10) / 10,
    sideWasteWidth: Math.round(sideWasteWidth * 10) / 10,
    yieldPercent: Math.round(yieldPercent * 10) / 10,

    positions,
    dimensions,
    marks,
    colors,
    warnings,
  };
}
