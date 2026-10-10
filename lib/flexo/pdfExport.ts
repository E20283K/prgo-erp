import { jsPDF } from "jspdf";
import { FlexoLayoutResult } from "./types";

interface PdfMeta {
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
}

export function exportFlexoPDF(result: FlexoLayoutResult, meta: PdfMeta = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;

  // Header Background Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, margin, pageWidth - margin * 2, 18, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("PRINTGOO — FLEXOGRAPHIC PRODUCTION SPECIFICATION", margin + 5, margin + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  doc.text(`DOC: ${meta.docNo || "CO-FLEXO"}  |  DATE: ${dateStr}  |  STATUS: APPROVED FOR PRESS`, margin + 5, margin + 14);

  let curY = margin + 22;

  // 1. Order & Customer Info Grid
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.rect(margin, curY, pageWidth - margin * 2, 18, "FD");

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Customer:", margin + 4, curY + 6);
  doc.setFont("helvetica", "normal");
  doc.text(meta.customer || "General Client", margin + 22, curY + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Product:", margin + 4, curY + 13);
  doc.setFont("helvetica", "normal");
  doc.text(meta.productName || "Flexo Printed Label", margin + 22, curY + 13);

  doc.setFont("helvetica", "bold");
  doc.text("Press Machine:", margin + 100, curY + 6);
  doc.setFont("helvetica", "normal");
  doc.text(result.machineName, margin + 125, curY + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Substrate:", margin + 100, curY + 13);
  doc.setFont("helvetica", "normal");
  doc.text(`${result.materialName} (${result.webWidth} mm)`, margin + 125, curY + 13);

  curY += 22;

  // 2. Technical Cylinder & Tooling Specifications Block
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text("1. CYLINDER & TOOLING PARAMETERS", margin, curY);

  curY += 3;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, curY, pageWidth - margin * 2, 28, "FD");

  const col1 = margin + 4;
  const col2 = margin + 65;
  const col3 = margin + 125;

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  // Row 1
  doc.text("Gear Teeth:", col1, curY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.gearTeeth} Teeth (${result.gearTeeth}T)`, col1 + 25, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Cylinder Diameter:", col2, curY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.cylinderDiameter} mm`, col2 + 28, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Plate Thickness:", col3, curY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.plateThickness} mm`, col3 + 26, curY + 6);

  // Row 2
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Printing Repeat:", col1, curY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(`${result.printingLength} mm`, col1 + 25, curY + 14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Film Length:", col2, curY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.filmLength} mm`, col2 + 28, curY + 14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Pitch Circle (PCD):", col3, curY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.pitchCircleDiameter} mm`, col3 + 26, curY + 14);

  // Row 3
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Colors / Plates:", col1, curY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  const colorNames = result.colors.map((c) => c.name).join(", ");
  doc.text(`${result.colors.length} Colors (${colorNames || "CMYK"})`, col1 + 25, curY + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Web Usable Width:", col2, curY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.usablePrintWidth} mm (Total: ${result.webWidth}mm)`, col2 + 28, curY + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Side Trim Waste:", col3, curY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 38, 38);
  doc.text(`${result.sideWasteWidth} mm`, col3 + 26, curY + 22);

  curY += 33;

  // 3. Imposition & Yield Summary Table
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("2. PRODUCTION RUN & MATERIAL CALCULATIONS", margin, curY);

  curY += 3;
  doc.rect(margin, curY, pageWidth - margin * 2, 28, "FD");

  // Metric Row 1
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Product Size:", col1, curY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.productWidth} × ${result.productHeight} mm (${result.orientation})`, col1 + 25, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Across Count:", col2, curY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.acrossCount} across`, col2 + 28, curY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Around Repeat:", col3, curY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.aroundCount} around`, col3 + 26, curY + 6);

  // Metric Row 2
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Required Qty:", col1, curY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.requiredQuantity.toLocaleString()} pcs`, col1 + 25, curY + 14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Overproduction:", col2, curY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${result.overproductionValue}${result.overproductionMode === "percent" ? "%" : " pcs"} (+${(result.productionTargetQuantity - result.requiredQuantity).toLocaleString()} pcs)`,
    col2 + 28,
    curY + 14
  );

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Total Run Yield:", col3, curY + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.text(`${result.actualYieldQuantity.toLocaleString()} pcs`, col3 + 26, curY + 14);

  // Metric Row 3
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Cylinder Cycles:", col1, curY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.repeatCount.toLocaleString()} revs`, col1 + 25, curY + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Linear Substrate:", col2, curY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.materialConsumptionMeters.toLocaleString()} m (${result.materialConsumptionSqM} m²)`, col2 + 28, curY + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Substrate Yield:", col3, curY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${result.yieldPercent}% (${result.wasteSqM} m² trim)`, col3 + 26, curY + 22);

  curY += 33;

  // 4. Vector Layout Drawing Section
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("3. IMPOSITION PREVIEW & DIMENSION SCHEMATIC (1 REPEAT)", margin, curY);

  curY += 4;
  const drawBoxHeight = 110;
  const drawBoxWidth = pageWidth - margin * 2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, curY, drawBoxWidth, drawBoxHeight, "FD");

  // Calculate scaling factor to fit web width & printing length nicely inside drawBox
  const maxDrawW = drawBoxWidth - 30;
  const maxDrawH = drawBoxHeight - 20;
  const scale = Math.min(maxDrawW / result.webWidth, maxDrawH / result.printingLength, 1.2);

  const drawWebW = result.webWidth * scale;
  const drawWebH = result.printingLength * scale;
  const drawStartX = margin + (drawBoxWidth - drawWebW) / 2;
  const drawStartY = curY + (drawBoxHeight - drawWebH) / 2;

  // Web Substrate Rect
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.rect(drawStartX, drawStartY, drawWebW, drawWebH, "FD");

  // Machine Direction Arrow
  doc.setFontSize(6.5);
  doc.setTextColor(2, 132, 199);
  doc.setFont("helvetica", "bold");
  doc.text("MACHINE DIRECTION ->", drawStartX + drawWebW / 2, drawStartY - 3, { align: "center" });

  // Repeat Cut Line
  doc.setDrawColor(220, 38, 38);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.line(drawStartX - 4, drawStartY + drawWebH, drawStartX + drawWebW + 4, drawStartY + drawWebH);
  doc.setLineDashPattern([], 0); // reset dash

  doc.setFontSize(6);
  doc.setTextColor(220, 38, 38);
  doc.text(`REPEAT CUT: ${result.printingLength} mm (${result.gearTeeth}T)`, drawStartX + drawWebW / 2, drawStartY + drawWebH + 3.5, {
    align: "center",
  });

  // Placed Products
  doc.setDrawColor(37, 99, 235);
  doc.setFillColor(239, 246, 255);
  doc.setLineWidth(0.3);

  for (const pos of result.positions) {
    const px = drawStartX + pos.x * scale;
    const py = drawStartY + pos.y * scale;
    const pw = pos.width * scale;
    const ph = pos.height * scale;

    doc.rect(px, py, pw, ph, "FD");

    if (pw > 10 && ph > 6) {
      doc.setFontSize(Math.max(4.5, Math.min(pw * 0.25, 7)));
      doc.setTextColor(30, 64, 175);
      doc.text(`${pos.width}x${pos.height}`, px + pw / 2, py + ph / 2 + 1, { align: "center" });
    }
  }

  // Draw eye mark
  for (const mark of result.marks) {
    if (mark.type === "eyemark") {
      const mx = drawStartX + mark.x * scale;
      const my = drawStartY + mark.y * scale;
      const mw = Math.max(2, mark.width * scale);
      const mh = Math.max(1.5, mark.height * scale);
      doc.setFillColor(15, 23, 42);
      doc.rect(mx, my, mw, mh, "F");
    }
  }

  // Dimension Rulers
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  // Web Width dimension line
  doc.line(drawStartX, drawStartY - 1, drawStartX + drawWebW, drawStartY - 1);
  doc.text(`${result.webWidth} mm`, drawStartX + drawWebW / 2, drawStartY - 2, { align: "center" });

  curY += drawBoxHeight + 6;

  // 5. Prepress Quality & Approval Signatures
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, curY, pageWidth - margin * 2, 24, "FD");

  const sigCol1 = margin + 10;
  const sigCol2 = margin + 70;
  const sigCol3 = margin + 130;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);

  doc.text("Prepress Engineer:", sigCol1, curY + 6);
  doc.line(sigCol1, curY + 16, sigCol1 + 45, curY + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Sign & Date", sigCol1, curY + 20);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Press Lead Operator:", sigCol2, curY + 6);
  doc.line(sigCol2, curY + 16, sigCol2 + 45, curY + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Sign & Date", sigCol2, curY + 20);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Quality Control (QC):", sigCol3, curY + 6);
  doc.line(sigCol3, curY + 16, sigCol3 + 45, curY + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Sign & Date", sigCol3, curY + 20);

  // Save PDF
  const filename = `Flexo_Spec_${meta.docNo || "Order"}_${result.gearTeeth}T.pdf`;
  doc.save(filename);
}
