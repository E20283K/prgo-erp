import { jsPDF } from "jspdf";
import { CalculatedPlate, ImpositionLayout, PrepressMargins, TrimMarkSegment, GripperEdge } from "./types";

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
  artworkFront?: string;
  artworkBack?: string;
  previewMode?: "schematic" | "artwork";
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
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(0, 0, sheetW, sheetH, "S");

  // Gripper area & Labels
  if (gripper > 0) {
    doc.setFillColor(254, 226, 226);

    let rect = [0, 0, 0, 0];
    let txtArgs: any = [];

    if (activeGripperEdge === "Bottom") {
      rect = [0, sheetH - gripper, sheetW, gripper];
      txtArgs = [`GRIPPER (${gripper}mm)`, baseLeft, sheetH - gripper / 2 + 2];

      doc.setTextColor(107, 114, 128);
      doc.setFontSize(5);
      doc.text("TAIL", sheetW / 2, Math.max(5, effMarginTop / 2 + 1), { align: "center", charSpace: 1 });
      doc.text("SIDE LAY", Math.max(5, effMarginLeft / 2), sheetH / 2, { angle: 90, align: "center", charSpace: 1 });
    } else if (activeGripperEdge === "Top") {
      rect = [0, 0, sheetW, gripper];
      txtArgs = [`GRIPPER (${gripper}mm)`, baseLeft, gripper / 2 + 2];

      doc.setTextColor(107, 114, 128);
      doc.setFontSize(5);
      doc.text("TAIL", sheetW / 2, sheetH - Math.max(3, effMarginBottom / 2), { align: "center", charSpace: 1 });
      doc.text("SIDE LAY", Math.max(5, effMarginLeft / 2), sheetH / 2, { angle: 90, align: "center", charSpace: 1 });
    } else if (activeGripperEdge === "Left") {
      rect = [0, 0, gripper, sheetH];
      txtArgs = [`GRIPPER (${gripper}mm)`, gripper / 2 + 2, baseTop + 20, { angle: 90 }];

      doc.setTextColor(107, 114, 128);
      doc.setFontSize(5);
      doc.text("TAIL", sheetW - Math.max(3, effMarginRight / 2), sheetH / 2, { angle: 90, align: "center", charSpace: 1 });
      doc.text("SIDE LAY", sheetW / 2, sheetH - Math.max(3, effMarginBottom / 2), { align: "center", charSpace: 1 });
    } else if (activeGripperEdge === "Right") {
      rect = [sheetW - gripper, 0, gripper, sheetH];
      txtArgs = [`GRIPPER (${gripper}mm)`, sheetW - gripper / 2 + 2, baseTop + 20, { angle: 90 }];

      doc.setTextColor(107, 114, 128);
      doc.setFontSize(5);
      doc.text("TAIL", Math.max(5, effMarginLeft / 2), sheetH / 2, { angle: 90, align: "center", charSpace: 1 });
      doc.text("SIDE LAY", sheetW / 2, sheetH - Math.max(3, effMarginBottom / 2), { align: "center", charSpace: 1 });
    }

    doc.rect(rect[0], rect[1], rect[2], rect[3], "F");
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(8);
    doc.text(...(txtArgs as [string, number, number]));
  }

  // Usable Area Dash boundary
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(
    effMarginLeft + gLeft,
    effMarginTop + gTop,
    sheetW - effMarginLeft - effMarginRight - gLeft - gRight,
    sheetH - effMarginTop - effMarginBottom - gTop - gBottom,
    "S"
  );
  doc.setLineDashPattern([], 0); // reset dash

  // Prepress Slug Line
  const slugPt = Math.max(6.5, Math.min(effMarginTop > 0 ? effMarginTop * 1.5 : 9, 9));
  doc.setFontSize(slugPt);
  doc.setTextColor(75, 85, 99);
  const slugText = `ORDER: ${docNo} | ${orderName} | ${plate.name} (${plateIndex + 1}/${totalPlates}) | Sheet: ${sheetW}x${sheetH}mm | Run: ${plate.requiredSheets.toLocaleString()} sheets | PRINTGOO PREPRESS`;

  let slugY = gTop + Math.max(3, effMarginTop / 2 + 1);
  doc.text(slugText, baseLeft, slugY);

  // Cells
  const plateCells: { label: string }[] = [];
  plate.assignments.forEach((assignment) => {
    for (let i = 0; i < assignment.slots; i++) {
      plateCells.push({ label: assignment.sizeLabel });
    }
  });

  for (let i = 0; i < layout.pieces; i++) {
    const row = Math.floor(i / layout.cols);
    const col = i % layout.cols;
    const x = gridLeft + col * (layout.itemW + gap);
    const y = gridTop + row * (layout.itemH + gap);
    const cell = plateCells[i] || { label: "" };

    // Box with bleed
    doc.setFillColor(243, 246, 255);
    doc.setDrawColor(180, 195, 220);
    doc.setLineWidth(0.25);
    doc.rect(x, y, layout.itemW, layout.itemH, "FD");

    // Cut boundary
    const pX1 = x + bleed;
    const pY1 = y + bleed;
    const pW = layout.itemW - bleed * 2;
    const pH = layout.itemH - bleed * 2;

    doc.setDrawColor(59, 130, 246);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.rect(pX1, pY1, pW, pH, "S");
    doc.setLineDashPattern([], 0);

    // Label text
    if (cell.label) {
      const maxLabelW = pW * 0.85;
      const charCount = Math.max(1, cell.label.length);
      const autoMm = maxLabelW / (charCount * 0.58);
      const fontMm = Math.max(2.4, Math.min(autoMm, pH * 0.14, 6.5));
      const fontPt = fontMm * 2.83465;

      doc.setFontSize(fontPt);
      doc.setTextColor(31, 41, 55);
      doc.text(cell.label, x + layout.itemW / 2, y + layout.itemH / 2 + fontMm * 0.35, {
        align: "center",
        maxWidth: maxLabelW,
      });
    }
  }

  // Outer crop marks (margin only)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  outerTrimMarks.forEach((s) => doc.line(s.x1, s.y1, s.x2, s.y2));
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
        docNo,
        plate,
        plateIndex: idx,
        totalPlates: plateCalculations.length,
      });
    });
    doc.save(`${docNo}_all_plates.pdf`);
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
