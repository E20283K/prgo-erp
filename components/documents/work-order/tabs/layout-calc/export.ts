import { jsPDF } from "jspdf";
import { CalculatedPlate, GridCell, ImpositionLayout, PrepressMargins, TrimMarkSegment } from "./types";
import { ProductShapeType, ProductCustomShape } from "../../types";
import { parseSvgContour } from "../../utils/svgContour";

interface DrawPlateToPdfOptions {
  plate: CalculatedPlate;
  plateIndex: number;
  totalPlates: number;
  docNo: string;
  orderName: string;
  sheetW: number;
  sheetH: number;
  gripper: number;
  activeGripperEdge: "Bottom" | "Top" | "Left" | "Right";
  prepressMargins: PrepressMargins;
  layout: ImpositionLayout;
  bleed: number;
  gap: number;
  outerTrimMarks: TrimMarkSegment[];
  gridCells?: GridCell[];
  splitCutAxisX?: number;
  splitAxisLabel?: string;
  activeSideLabel?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }
  return [243, 246, 255];
}

export function drawPlateToPdf(doc: jsPDF, opts: DrawPlateToPdfOptions) {
  const {
    plate,
    plateIndex,
    totalPlates,
    docNo,
    orderName,
    sheetW,
    sheetH,
    gripper,
    activeGripperEdge,
    prepressMargins,
    layout,
    bleed,
    gap,
    outerTrimMarks,
    gridCells,
    splitCutAxisX,
    splitAxisLabel,
    activeSideLabel = "OLDI",
  } = opts;

  const {
    gridLeft: baseLeft,
    gridTop: baseTop,
    effMarginLeft,
    effMarginTop,
    effMarginRight,
    effMarginBottom,
    gTop,
    gBottom,
    gLeft,
    gRight,
  } = prepressMargins;
  const gridLeft = baseLeft + layout.offsetX;
  const gridTop = baseTop + layout.offsetY;

  // Background sheet
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, sheetW, sheetH, "F");

  // Border of sheet
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.rect(0, 0, sheetW, sheetH, "S");

  // Gripper area & Labels
  if (gripper > 0) {
    doc.setFillColor(254, 226, 226);

    let rect = [0, 0, 0, 0];
    let txtArgs: any = [];

    if (activeGripperEdge === "Bottom") {
      rect = [0, sheetH - gripper, sheetW, gripper];
      txtArgs = [`KLAPAN / GRIPPER (${gripper}mm)`, baseLeft, sheetH - gripper / 2 + 1.5];
    } else if (activeGripperEdge === "Top") {
      rect = [0, 0, sheetW, gripper];
      txtArgs = [`KLAPAN / GRIPPER (${gripper}mm)`, baseLeft, gripper / 2 + 1.5];
    } else if (activeGripperEdge === "Left") {
      rect = [0, 0, gripper, sheetH];
      txtArgs = [`KLAPAN (${gripper}mm)`, gripper / 2 + 1.5, baseTop + 20, { angle: 90 }];
    } else if (activeGripperEdge === "Right") {
      rect = [sheetW - gripper, 0, gripper, sheetH];
      txtArgs = [`KLAPAN (${gripper}mm)`, sheetW - gripper / 2 + 1.5, baseTop + 20, { angle: 90 }];
    }

    doc.rect(rect[0], rect[1], rect[2], rect[3], "F");
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(7.5);
    doc.text(...(txtArgs as [string, number, number]));
  }

  // Usable Area Dash boundary
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(
    effMarginLeft + gLeft,
    effMarginTop + gTop,
    sheetW - effMarginLeft - effMarginRight - gLeft - gRight,
    sheetH - effMarginTop - effMarginBottom - gTop - gBottom,
    "S"
  );
  doc.setLineDashPattern([], 0);

  // Prepress Slug Line
  const slugPt = Math.max(6, Math.min(effMarginTop > 0 ? effMarginTop * 1.4 : 8.5, 8.5));
  doc.setFontSize(slugPt);
  doc.setTextColor(55, 65, 81);
  const slugText = `${docNo} | ${orderName} | ${plate.name} (${plateIndex + 1}/${totalPlates}) [${activeSideLabel}] | Format: ${sheetW}x${sheetH}mm | Tiraj: ${plate.requiredSheets.toLocaleString()} list`;

  const slugY = activeGripperEdge === "Top" ? sheetH - Math.max(2.5, effMarginBottom / 2) : gTop + Math.max(3, effMarginTop / 2 + 1);
  doc.text(slugText, baseLeft, slugY, { maxWidth: Math.max(50, sheetW - baseLeft * 2) });

  // Build fallback cells in column-first order if gridCells not provided
  let cellsToRender: GridCell[] = gridCells || [];
  if (cellsToRender.length === 0) {
    const colMajorPool: GridCell[] = [];
    plate.assignments.forEach((assignment) => {
      for (let i = 0; i < assignment.slots; i++) {
        colMajorPool.push({
          label: assignment.sizeCode || assignment.sizeLabel,
          model: assignment.model,
          sizeCode: assignment.sizeCode || assignment.sizeLabel,
          color: "#dbeafe",
          sizeId: assignment.sizeId,
          slotsCount: assignment.slots,
        });
      }
    });
    while (colMajorPool.length < layout.pieces) {
      colMajorPool.push({ label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" });
    }
    const ordered: GridCell[] = new Array(layout.pieces);
    let idx = 0;
    for (let c = 0; c < layout.cols; c++) {
      for (let r = 0; r < layout.rows; r++) {
        ordered[r * layout.cols + c] = colMajorPool[idx++];
      }
    }
    cellsToRender = ordered;
  }

  for (let i = 0; i < layout.pieces; i++) {
    const row = Math.floor(i / layout.cols);
    const col = i % layout.cols;
    const x = gridLeft + col * (layout.itemW + gap);
    const y = gridTop + row * (layout.itemH + gap);
    const cell = cellsToRender[i] || { label: "", color: "#f4f4f5", sizeId: "empty" };

    const [r, g, b] = hexToRgb(cell.color || "#dbeafe");
    doc.setFillColor(r, g, b);
    doc.setDrawColor(160, 175, 200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, layout.itemW, layout.itemH, "FD");

    // Cut boundary
    const pX1 = x + bleed;
    const pY1 = y + bleed;
    const pW = layout.itemW - bleed * 2;
    const pH = layout.itemH - bleed * 2;

    doc.setDrawColor(37, 99, 235);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.rect(pX1, pY1, pW, pH, "S");
    doc.setLineDashPattern([], 0);

    // Label text
    const displayLabel = cell.sizeCode || cell.label;
    if (displayLabel) {
      const maxLabelW = pW * 0.85;
      const charCount = Math.max(1, displayLabel.length);
      const autoMm = maxLabelW / (charCount * 0.55);
      const fontMm = Math.max(3.2, Math.min(autoMm, pH * 0.22, 9));
      const fontPt = fontMm * 2.83465;

      doc.setFontSize(fontPt);
      doc.setTextColor(17, 24, 39);
      doc.text(displayLabel, x + layout.itemW / 2, y + layout.itemH / 2 + fontMm * 0.35, {
        align: "center",
        maxWidth: maxLabelW,
      });
    }
  }

  // Split Axis Line (Work-and-Turn or Split-Half Kashirovka)
  if (splitCutAxisX !== undefined) {
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2.5, 1.5], 0);
    doc.line(splitCutAxisX, Math.max(2, effMarginTop * 0.4), splitCutAxisX, sheetH - Math.max(2, effMarginBottom * 0.4));
    doc.setLineDashPattern([], 0);
    if (splitAxisLabel) {
      doc.setFontSize(6.5);
      doc.setTextColor(37, 99, 235);
      doc.text(splitAxisLabel, splitCutAxisX - 1.5, sheetH / 2, { angle: 90, align: "center" });
    }
  }

  // Outer crop marks
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  outerTrimMarks.forEach((s) => doc.line(s.x1, s.y1, s.x2, s.y2));

  // Corner Registration Crosshairs
  const regPoints = [
    { cx: Math.max(5, gridLeft - 4), cy: Math.max(5, gridTop - 4) },
    { cx: Math.min(sheetW - 5, gridLeft + layout.cols * layout.itemW + Math.max(0, layout.cols - 1) * gap + 4), cy: Math.max(5, gridTop - 4) },
    { cx: Math.max(5, gridLeft - 4), cy: Math.min(sheetH - 5, gridTop + layout.rows * layout.itemH + Math.max(0, layout.rows - 1) * gap + 4) },
    { cx: Math.min(sheetW - 5, gridLeft + layout.cols * layout.itemW + Math.max(0, layout.cols - 1) * gap + 4), cy: Math.min(sheetH - 5, gridTop + layout.rows * layout.itemH + Math.max(0, layout.rows - 1) * gap + 4) },
  ];
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.18);
  regPoints.forEach(({ cx, cy }) => {
    doc.circle(cx, cy, 1.6, "S");
    doc.line(cx - 2.6, cy, cx + 2.6, cy);
    doc.line(cx, cy - 2.6, cx, cy + 2.6);
  });
}

export function exportSvg(svgElement: SVGSVGElement | null, fileName: string) {
  if (!svgElement) return;
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const link = document.createElement("a");
  link.href = svgUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(svgUrl);
}

export function exportPdf(
  sheetW: number,
  sheetH: number,
  docNo: string,
  plateCalculations: CalculatedPlate[],
  activePlateIndex: number,
  baseOpts: Omit<DrawPlateToPdfOptions, "plate" | "plateIndex" | "totalPlates" | "docNo">,
  exportAll = false
) {
  const isLandscape = sheetW >= sheetH;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [sheetW, sheetH],
  });

  if (exportAll) {
    plateCalculations.forEach((plate, idx) => {
      if (idx > 0) {
        doc.addPage([sheetW, sheetH], isLandscape ? "landscape" : "portrait");
      }
      drawPlateToPdf(doc, {
        ...baseOpts,
        gridCells: idx === activePlateIndex ? baseOpts.gridCells : undefined,
        docNo,
        plate,
        plateIndex: idx,
        totalPlates: plateCalculations.length,
      });
    });
    doc.save(`${docNo}_barcha_formalar.pdf`);
  } else {
    const activePlate = plateCalculations[activePlateIndex] || plateCalculations[0];
    drawPlateToPdf(doc, {
      ...baseOpts,
      docNo,
      plate: activePlate,
      plateIndex: activePlateIndex,
      totalPlates: plateCalculations.length,
    });
    doc.save(`${docNo}_${activePlate.name.replace(/\s+/g, "_")}.pdf`);
  }
}

export interface ProductionImpositionExportOptions {
  docNo: string;
  orderName: string;
  pressMachine: string;
  paperStock: string;
  sheetW: number;
  sheetH: number;
  prodW: number;
  prodH: number;
  bleed: number;
  gap: number;
  gripper: number;
  activeGripperEdge: "Bottom" | "Top" | "Left" | "Right";
  prepressMargins: PrepressMargins;
  layout: ImpositionLayout;
  outerTrimMarks: TrimMarkSegment[];
  plateCalculations: CalculatedPlate[];
  activePlateIndex: number;
  activeSideLabel: string;
  splitCutAxisX?: number;
  splitAxisLabel?: string;
  shapeType?: ProductShapeType;
  customShape?: ProductCustomShape;
  customSvgPath?: string;
  cornerType?: string;
  holeSize?: number;
  holePosition?: string;
  holeOffset?: number;
  buildCellsForPlate: (plate: CalculatedPlate) => GridCell[];
  exportAll?: boolean;
}

export async function exportProductionImpositionPdf(opts: ProductionImpositionExportOptions): Promise<void> {
  const {
    docNo,
    orderName,
    pressMachine,
    paperStock,
    sheetW,
    sheetH,
    prodW,
    prodH,
    bleed,
    gap,
    gripper,
    activeGripperEdge,
    prepressMargins,
    layout,
    outerTrimMarks,
    plateCalculations,
    activePlateIndex,
    activeSideLabel,
    splitCutAxisX,
    splitAxisLabel,
    shapeType,
    customShape,
    customSvgPath,
    cornerType,
    holeSize,
    holePosition,
    holeOffset,
    buildCellsForPlate,
    exportAll = false,
  } = opts;

  const gridLeft = prepressMargins.gridLeft + layout.offsetX;
  const gridTop = prepressMargins.gridTop + layout.offsetY;

  let parsedSvgPathD: string | undefined;
  let parsedSvgViewBox: { x: number; y: number; width: number; height: number } | undefined;
  if (shapeType === "custom_die" && customShape === "vector_svg" && customSvgPath) {
    const parsed = parseSvgContour(customSvgPath);
    if (parsed) {
      parsedSvgPathD = parsed.pathD;
      parsedSvgViewBox = parsed.computedBox || parsed.viewBox;
    }
  }

  const targetPlates = exportAll
    ? plateCalculations.map((p, idx) => ({ plate: p, idx }))
    : [{ plate: plateCalculations[activePlateIndex] || plateCalculations[0], idx: activePlateIndex }];

  const pages = targetPlates.map(({ plate, idx }) => {
    const rawCells = buildCellsForPlate(plate);
    const cells = [];
    for (let i = 0; i < layout.pieces; i++) {
      const row = Math.floor(i / layout.cols);
      const col = i % layout.cols;
      const x = gridLeft + col * (layout.itemW + gap);
      const y = gridTop + row * (layout.itemH + gap);
      const cell = rawCells[i] || { label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" };
      cells.push({
        index: i,
        row,
        col,
        x,
        y,
        itemW: layout.itemW,
        itemH: layout.itemH,
        label: cell.label || "",
        model: cell.model,
        sizeCode: cell.sizeCode || cell.label || "",
        color: cell.color || "#dbeafe",
        sizeId: cell.sizeId || "empty",
        sideBadge: cell.sideBadge || (activeSideLabel === "ORQA" ? "BACK" : "FRONT"),
        artworkUrl: cell.artworkUrl,
        rawArtworkUrl: cell.rawArtworkUrl || cell.artworkUrl,
      });
    }

    return {
      plateName: plate.name,
      plateIndex: idx,
      totalPlates: plateCalculations.length,
      sideLabel: activeSideLabel,
      requiredSheets: plate.requiredSheets,
      cells,
    };
  });

  const payload = {
    docNo,
    orderName,
    pressMachine,
    paperStock,
    sheetW,
    sheetH,
    prodW,
    prodH,
    bleed,
    gap,
    gripper,
    activeGripperEdge,
    gridLeft,
    gridTop,
    cols: layout.cols,
    rows: layout.rows,
    itemW: layout.itemW,
    itemH: layout.itemH,
    shapeType: shapeType || "rectangle",
    customShape,
    customSvgPath,
    parsedSvgPathD,
    parsedSvgViewBox,
    cornerType,
    holeSize,
    holePosition,
    holeOffset,
    splitCutAxisX,
    splitAxisLabel,
    outerTrimMarks,
    pages,
  };

  try {
    const res = await fetch("/api/docs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "imposition-pdf", payload }),
    });

    if (!res.ok) {
      throw new Error(`Imposition PDF service returned ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const activePlate = plateCalculations[activePlateIndex] || plateCalculations[0];
    const fileName = exportAll
      ? `${docNo}_barcha_formalar_CTP.pdf`
      : `${docNo}_${activePlate.name.replace(/\s+/g, "_")}_${activeSideLabel}_CTP.pdf`;

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn("[exportProductionImpositionPdf] Falling back to client jsPDF:", err);
    const activePlate = plateCalculations[activePlateIndex] || plateCalculations[0];
    exportPdf(
      sheetW,
      sheetH,
      docNo,
      plateCalculations,
      activePlateIndex,
      {
        orderName,
        sheetW,
        sheetH,
        gripper,
        activeGripperEdge,
        prepressMargins,
        layout,
        bleed,
        gap,
        outerTrimMarks,
        gridCells: buildCellsForPlate(activePlate),
        splitCutAxisX,
        splitAxisLabel,
        activeSideLabel,
      },
      exportAll
    );
  }
}
