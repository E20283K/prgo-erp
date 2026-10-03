"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Calculator, 
  RotateCw, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Layers, 
  FileDown, 
  Percent, 
  Hash, 
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SizeDistribution } from "../types";
import { jsPDF } from "jspdf";

interface Props {
  sizes: SizeDistribution[];
  defaultQuantity: number;
  docNo?: string;
  orderName?: string;
  defaultProdW?: number;
  defaultProdH?: number;
  defaultBleed?: number;
}

interface SlotAssignment {
  sizeId: string;
  sizeLabel: string;
  targetQuantity: number;
  slots: number;
}

interface PlateConfig {
  id: string;
  name: string;
  manualSlots: Record<string, number>;
}

export function LayoutCalcTab({ 
  sizes = [], 
  defaultQuantity, 
  docNo = "CO-NEW", 
  orderName = "Client Order",
  defaultProdW,
  defaultProdH,
  defaultBleed,
}: Props) {
  // Dimensions & Prepress parameters
  const [sheetW, setSheetW] = useState(1000);
  const [sheetH, setSheetH] = useState(700);
  const [prodW, setProdW] = useState(defaultProdW || 210);
  const [prodH, setProdH] = useState(defaultProdH || 297);
  const [baseQuantity, setBaseQuantity] = useState(defaultQuantity || 1000);
  
  const [bleed, setBleed] = useState(defaultBleed !== undefined ? defaultBleed : 2);
  const [gap, setGap] = useState(4);
  const [marginTop, setMarginTop] = useState(10);
  const [marginBottom, setMarginBottom] = useState(10);
  const [marginLeft, setMarginLeft] = useState(10);
  const [marginRight, setMarginRight] = useState(10);
  const [gripper, setGripper] = useState(15);
  const [gripperEdge, setGripperEdge] = useState<"Auto" | "Bottom" | "Top" | "Left" | "Right">("Auto");
  
  const [orientation, setOrientation] = useState<"A" | "B">("A");
  const [cmykColors, setCmykColors] = useState<number>(4); // 4 = CMYK, 1 = 1-color, etc.

  // Overproduction
  const [overproductionMode, setOverproductionMode] = useState<"percent" | "exact">("percent");
  const [overproductionValue, setOverproductionValue] = useState<number>(5); // default 5%

  // Multi-Plate State
  const [plates, setPlates] = useState<PlateConfig[]>([
    { id: "plate-1", name: "Plate 1", manualSlots: {} }
  ]);
  const [activePlateIndex, setActivePlateIndex] = useState(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync base quantity if defaultQuantity changes
  useEffect(() => {
    if (defaultQuantity > 0) {
      setBaseQuantity(defaultQuantity);
    }
  }, [defaultQuantity]);

  useEffect(() => {
    if (defaultProdW && defaultProdW > 0) {
      setProdW(defaultProdW);
    }
  }, [defaultProdW]);

  useEffect(() => {
    if (defaultProdH && defaultProdH > 0) {
      setProdH(defaultProdH);
    }
  }, [defaultProdH]);

  useEffect(() => {
    if (defaultBleed !== undefined) {
      setBleed(defaultBleed);
    }
  }, [defaultBleed]);

  // Compute Adjusted Sizes with Overproduction applied BEFORE layout
  const adjustedSizes = useMemo(() => {
    if (sizes.length === 0) return [];
    return sizes.map((s) => {
      let adjQty = s.quantity;
      if (overproductionValue > 0) {
        if (overproductionMode === "percent") {
          adjQty = Math.ceil(s.quantity * (1 + overproductionValue / 100));
        } else {
          adjQty = s.quantity + overproductionValue;
        }
      }
      return {
        ...s,
        originalQuantity: s.quantity,
        quantity: adjQty,
      };
    });
  }, [sizes, overproductionMode, overproductionValue]);

  // Adjusted general quantity if no sizes defined
  const adjustedGeneralQuantity = useMemo(() => {
    if (overproductionValue <= 0) return baseQuantity;
    if (overproductionMode === "percent") {
      return Math.ceil(baseQuantity * (1 + overproductionValue / 100));
    }
    return baseQuantity + overproductionValue;
  }, [baseQuantity, overproductionMode, overproductionValue]);

  const activeGripperEdge = useMemo(() => {
    if (gripperEdge !== "Auto") return gripperEdge;
    return sheetW >= sheetH ? "Bottom" : "Left";
  }, [gripperEdge, sheetW, sheetH]);

  const prepressMargins = useMemo(() => {
    let mt = marginTop, mb = marginBottom, ml = marginLeft, mr = marginRight;
    let gt = 0, gb = 0, gl = 0, gr = 0;

    // Gripper represents the unprintable physical edge constraint.
    // The margin provides the safe space for crop marks and bleeds.
    // We add them together to ensure the layout starts after both the gripper and the margin.
    if (gripper > 0) {
      if (activeGripperEdge === "Top") { gt = gripper; }
      else if (activeGripperEdge === "Bottom") { gb = gripper; }
      else if (activeGripperEdge === "Left") { gl = gripper; }
      else if (activeGripperEdge === "Right") { gr = gripper; }
    }

    return {
      effMarginTop: mt, effMarginBottom: mb, effMarginLeft: ml, effMarginRight: mr,
      gTop: gt, gBottom: gb, gLeft: gl, gRight: gr,
      gridLeft: ml + gl,
      gridTop: mt + gt,
    };
  }, [activeGripperEdge, gripper, marginTop, marginBottom, marginLeft, marginRight]);

  // Calculate Single Sheet Imposition capacity (pieces per sheet)
  const layout = useMemo(() => {
    const { effMarginTop, effMarginBottom, effMarginLeft, effMarginRight, gTop, gBottom, gLeft, gRight } = prepressMargins;
    
    const usableW = Math.max(0, sheetW - effMarginLeft - effMarginRight - gLeft - gRight);
    const usableH = Math.max(0, sheetH - effMarginTop - effMarginBottom - gTop - gBottom);

    const itemTotalW = prodW + bleed * 2;
    const itemTotalH = prodH + bleed * 2;

    const calcForOrientation = (w: number, h: number) => {
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
  }, [sheetW, sheetH, prodW, prodH, bleed, gap, orientation, prepressMargins]);

  const switchOrientation = () => {
    setOrientation(orientation === "A" ? "B" : "A");
  };

  // Auto-distribute or Auto-partition sizes across plates if user has multiple plates
  const plateCalculations = useMemo(() => {
    const currentPieces = layout.pieces;
    if (currentPieces === 0) {
      return plates.map((p) => ({
        ...p,
        assignments: [] as SlotAssignment[],
        requiredSheets: 0,
        unassignedSlots: 0,
      }));
    }

    // Determine sizes subset for each plate if multiple plates exist
    const totalPlates = plates.length;
    
    return plates.map((plate, pIdx) => {
      if (adjustedSizes.length === 0) {
        // Generic mode without variations
        const targetQ = Math.ceil(adjustedGeneralQuantity / totalPlates);
        const reqSheets = Math.ceil(targetQ / currentPieces);
        return {
          ...plate,
          assignments: [{
            sizeId: "generic",
            sizeLabel: "Main Product",
            targetQuantity: targetQ,
            slots: currentPieces,
          }],
          requiredSheets: reqSheets,
          unassignedSlots: 0,
        };
      }

      // If multiple plates, partition sizes or distribute equally across plates
      let plateSizes = adjustedSizes;
      if (totalPlates > 1) {
        const chunkSize = Math.ceil(adjustedSizes.length / totalPlates);
        const start = pIdx * chunkSize;
        plateSizes = adjustedSizes.slice(start, start + chunkSize);
        if (plateSizes.length === 0) {
          plateSizes = [adjustedSizes[adjustedSizes.length - 1]];
        }
      }

      const totalTargetInPlate = plateSizes.reduce((sum, s) => sum + s.quantity, 0);

      // Check manual overrides for this plate
      let remainingSlots = currentPieces;
      const assignments: SlotAssignment[] = [];
      let hasManual = false;

      for (const s of plateSizes) {
        if (plate.manualSlots[s.id] !== undefined) {
          hasManual = true;
          break;
        }
      }

      if (hasManual) {
        for (const s of plateSizes) {
          const slots = plate.manualSlots[s.id] ?? 0;
          assignments.push({
            sizeId: s.id,
            sizeLabel: s.size,
            targetQuantity: s.quantity,
            slots,
          });
          remainingSlots -= slots;
        }
      } else {
        // Proportional Auto-Distribution
        const exactSlots = plateSizes.map((s) => ({
          ...s,
          exact: totalTargetInPlate > 0 ? (s.quantity / totalTargetInPlate) * currentPieces : 0,
        }));

        let assigned = 0;
        exactSlots.forEach((s) => {
          const slots = Math.max(1, Math.floor(s.exact)); // at least 1 slot if possible
          assignments.push({
            sizeId: s.id,
            sizeLabel: s.size,
            targetQuantity: s.quantity,
            slots,
          });
          assigned += slots;
        });

        remainingSlots = currentPieces - assigned;

        if (remainingSlots > 0) {
          const remainders = exactSlots.map((s, i) => ({
            index: i,
            rem: s.exact - Math.floor(s.exact),
          })).sort((a, b) => b.rem - a.rem);

          for (let i = 0; i < remainingSlots; i++) {
            const idx = remainders[i % remainders.length].index;
            assignments[idx].slots += 1;
          }
          remainingSlots = 0;
        } else if (remainingSlots < 0) {
          // Adjust if overassigned
          let over = Math.abs(remainingSlots);
          for (let i = assignments.length - 1; i >= 0 && over > 0; i--) {
            if (assignments[i].slots > 1) {
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
      };
    });
  }, [layout.pieces, plates, adjustedSizes, adjustedGeneralQuantity]);

  // Current active plate calculation
  const activePlate = plateCalculations[activePlateIndex] || plateCalculations[0];

  // Plate management actions
  const handleAddPlate = () => {
    const newIdx = plates.length + 1;
    const newPlate: PlateConfig = {
      id: `plate-${Date.now()}`,
      name: `Plate ${newIdx}`,
      manualSlots: {},
    };
    setPlates([...plates, newPlate]);
    setActivePlateIndex(plates.length);
  };

  const handleRemovePlate = (idxToRemove: number) => {
    if (plates.length <= 1) return;
    const updated = plates.filter((_, idx) => idx !== idxToRemove);
    setPlates(updated);
    if (activePlateIndex >= updated.length) {
      setActivePlateIndex(updated.length - 1);
    }
  };

  const handleAutoPartitionPlates = () => {
    if (layout.pieces === 0 || adjustedSizes.length === 0) return;
    // Suggest plates count based on variations
    const needed = Math.max(1, Math.ceil(adjustedSizes.length / layout.pieces));
    const newPlatesList: PlateConfig[] = [];
    for (let i = 0; i < needed; i++) {
      newPlatesList.push({
        id: `plate-${i + 1}-${Date.now()}`,
        name: `Plate ${i + 1}`,
        manualSlots: {},
      });
    }
    setPlates(newPlatesList);
    setActivePlateIndex(0);
  };

  const handleManualSlotChange = (sizeId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setPlates((prev) =>
      prev.map((p, idx) => {
        if (idx !== activePlateIndex) return p;
        return {
          ...p,
          manualSlots: {
            ...p.manualSlots,
            [sizeId]: safeVal,
          },
        };
      })
    );
  };

  // Color palette for size labels
  const colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#ffedd5", "#f3e8ff", "#fce7f3", "#ccfbf1", "#e0e7ff"];

  // Grid cells for active plate SVG visualization
  const gridCells = useMemo(() => {
    if (!activePlate) return [];
    const cells: { label: string; color: string; sizeId: string }[] = [];
    
    activePlate.assignments.forEach((assignment, index) => {
      for (let i = 0; i < assignment.slots; i++) {
        cells.push({
          label: assignment.sizeLabel,
          color: colors[index % colors.length],
          sizeId: assignment.sizeId,
        });
      }
    });

    while (cells.length < layout.pieces) {
      cells.push({ label: "Empty", color: "#f4f4f5", sizeId: "empty" });
    }

    return cells;
  }, [activePlate, layout.pieces]);

  // Overall Statistics across all plates
  const totalSheetsRun = plateCalculations.reduce((sum, p) => sum + p.requiredSheets, 0);
  const totalCtpPlates = plates.length * cmykColors;
  const paperAreaWastePercent = Math.max(0, 100 - layout.utilization);

  // ----------------------------------------------------------------------
  // EXPORT FUNCTIONS: SVG & PDF
  // ----------------------------------------------------------------------
  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = svgUrl;
    link.download = `${docNo}_${activePlate.name.replace(/\s+/g, "_")}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(svgUrl);
  };

  // Outer crop marks: placed only in the margin around the imposed grid,
  // aligned with every column / row cut line (standard gang-run practice).
  const outerTrimMarks = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    if (layout.cols === 0 || layout.rows === 0) return segs;
    const { gridLeft: baseLeft, gridTop: baseTop } = prepressMargins;
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
  }, [layout, gap, bleed, prepressMargins]);

  const drawPlateToPdf = (doc: jsPDF, plate: typeof plateCalculations[0], plateIndex: number) => {
    const { gridLeft: baseLeft, gridTop: baseTop, effMarginLeft, effMarginTop, effMarginRight, effMarginBottom, gTop, gBottom, gLeft, gRight } = prepressMargins;
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
    doc.rect(effMarginLeft + gLeft, effMarginTop + gTop, sheetW - effMarginLeft - effMarginRight - gLeft - gRight, sheetH - effMarginTop - effMarginBottom - gTop - gBottom, "S");
    doc.setLineDashPattern([], 0); // reset dash

    // Prepress Slug Line (placed safely in margin, avoiding gripper)
    const slugPt = Math.max(6.5, Math.min(effMarginTop > 0 ? effMarginTop * 1.5 : 9, 9));
    doc.setFontSize(slugPt);
    doc.setTextColor(75, 85, 99);
    const slugText = `ORDER: ${docNo} | ${orderName} | ${plate.name} (${plateIndex + 1}/${plates.length}) | Sheet: ${sheetW}x${sheetH}mm | Run: ${plate.requiredSheets.toLocaleString()} sheets | PRINTGOO PREPRESS`;
    
    // Position slug outside of the gripper, preferably in the top margin
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
          maxWidth: maxLabelW 
        });
      }
    }

    // Outer crop marks (margin only)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    outerTrimMarks.forEach((s) => doc.line(s.x1, s.y1, s.x2, s.y2));
  };

  const handleExportPDF = (exportAll = false) => {
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
        drawPlateToPdf(doc, plate, idx);
      });
      doc.save(`${docNo}_all_plates.pdf`);
    } else {
      drawPlateToPdf(doc, activePlate, activePlateIndex);
      doc.save(`${docNo}_${activePlate.name.replace(/\s+/g, "_")}.pdf`);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full text-xs">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: CONTROLS & DISTRIBUTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full md:w-[350px] shrink-0 bg-card border border-border rounded-lg flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-2.5 border-b border-border bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span>Layout Engine</span>
          </div>
          <div className="flex items-center gap-1">
            <Button onClick={switchOrientation} variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
              <RotateCw className="w-3 h-3" /> {orientation === "A" ? "Port" : "Land"}
            </Button>
            <Button onClick={handleAutoPartitionPlates} variant="secondary" size="sm" className="h-6 text-[10px] gap-1 px-2">
              <Sparkles className="w-3 h-3 text-amber-500" /> Auto-Split
            </Button>
          </div>
        </div>

        {/* Scrollable Configuration Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* Overproduction Section */}
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                Overproduction Allowance
              </span>
              <div className="flex bg-muted rounded p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setOverproductionMode("percent")}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    overproductionMode === "percent" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setOverproductionMode("exact")}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    overproductionMode === "exact" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Exact pcs
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={overproductionValue}
                onChange={(e) => setOverproductionValue(Math.max(0, Number(e.target.value)))}
                className="h-7 text-xs bg-white dark:bg-zinc-950 flex-1"
                placeholder={overproductionMode === "percent" ? "e.g. 5%" : "e.g. 200 pcs"}
              />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {overproductionMode === "percent" ? `${overproductionValue}% extra` : `+${overproductionValue} pcs each`}
              </span>
            </div>
          </div>

          {/* Sheet & Product Dimensions */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Sheet W (mm)</label>
                <Input type="number" value={sheetW} onChange={(e) => setSheetW(Number(e.target.value))} className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Sheet H (mm)</label>
                <Input type="number" value={sheetH} onChange={(e) => setSheetH(Number(e.target.value))} className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Product W (mm)</label>
                <Input type="number" value={prodW} onChange={(e) => setProdW(Number(e.target.value))} className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Product H (mm)</label>
                <Input type="number" value={prodH} onChange={(e) => setProdH(Number(e.target.value))} className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Bleed (mm)</label>
                <Input type="number" value={bleed} onChange={(e) => setBleed(Number(e.target.value))} className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Gap / Gutter (mm)</label>
                <Input type="number" value={gap} onChange={(e) => setGap(Number(e.target.value))} className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Margins T/B</label>
                <div className="flex gap-1">
                  <Input type="number" value={marginTop} onChange={(e) => setMarginTop(Number(e.target.value))} className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950" />
                  <Input type="number" value={marginBottom} onChange={(e) => setMarginBottom(Number(e.target.value))} className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Margins L/R</label>
                <div className="flex gap-1">
                  <Input type="number" value={marginLeft} onChange={(e) => setMarginLeft(Number(e.target.value))} className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950" />
                  <Input type="number" value={marginRight} onChange={(e) => setMarginRight(Number(e.target.value))} className="h-7 text-xs px-1 text-center bg-zinc-50 dark:bg-zinc-950" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] uppercase font-semibold text-zinc-500 block">Gripper Edge & Size</label>
                <div className="flex gap-1">
                  <Select value={gripperEdge} onValueChange={(v: any) => setGripperEdge(v)}>
                    <SelectTrigger className="h-7 text-[10px] bg-zinc-50 dark:bg-zinc-950 px-2 w-[75px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Auto">Auto</SelectItem>
                      <SelectItem value="Bottom">Bottom</SelectItem>
                      <SelectItem value="Top">Top</SelectItem>
                      <SelectItem value="Left">Left</SelectItem>
                      <SelectItem value="Right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    value={gripper} 
                    onChange={(e) => setGripper(Number(e.target.value))} 
                    className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950 flex-1 px-1.5 text-center" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Colors / Plate</label>
                <Select value={String(cmykColors)} onValueChange={(v) => setCmykColors(Number(v))}>
                  <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Spot Color</SelectItem>
                    <SelectItem value="2">2 Colors</SelectItem>
                    <SelectItem value="4">4 Colors (CMYK)</SelectItem>
                    <SelectItem value="5">5 Colors (CMYK+Spot)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Plates Selector / Tabs */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Plate Layouts ({plates.length})
              </span>
              <Button onClick={handleAddPlate} variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-1.5">
                <Plus className="w-3 h-3" /> Add Plate
              </Button>
            </div>

            {/* Plate Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {plates.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => setActivePlateIndex(idx)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer border flex items-center gap-1.5 transition-all ${
                    idx === activePlateIndex
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  <span>{p.name}</span>
                  {plates.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePlate(idx);
                      }}
                      className="opacity-70 hover:opacity-100"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Plate Slot Assignment Table */}
          <div className="border border-border rounded-md p-2.5 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-foreground">
                {activePlate.name} Assignments
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
                {layout.pieces} slots/sheet
              </Badge>
            </div>

            {activePlate.unassignedSlots < 0 && (
              <div className="text-red-500 text-[10px] font-medium bg-red-50 p-1 rounded border border-red-200">
                Over-assigned: {layout.pieces - activePlate.unassignedSlots}/{layout.pieces} slots used
              </div>
            )}

            {activePlate.assignments.length > 0 ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_55px_45px_50px] gap-1 text-[9px] font-semibold text-zinc-500 uppercase px-1">
                  <span>Variation</span>
                  <span className="text-center">Target</span>
                  <span className="text-center">Slots</span>
                  <span className="text-right">Yield</span>
                </div>
                {activePlate.assignments.map((a) => {
                  const yieldQty = a.slots * activePlate.requiredSheets;
                  const diff = yieldQty - a.targetQuantity;
                  return (
                    <div key={a.sizeId} className="grid grid-cols-[1fr_55px_45px_50px] gap-1 items-center bg-white dark:bg-zinc-950 p-1 rounded border border-border">
                      <span className="font-medium px-1 truncate text-[11px]" title={a.sizeLabel}>
                        {a.sizeLabel}
                      </span>
                      <span className="text-center text-[10px] text-zinc-500 font-mono">
                        {a.targetQuantity}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={a.slots}
                        onChange={(e) => handleManualSlotChange(a.sizeId, parseInt(e.target.value) || 0)}
                        className="h-5 text-[10px] text-center px-1 bg-zinc-50 dark:bg-zinc-900"
                      />
                      <div className="text-right flex flex-col items-end pr-1">
                        <span className="font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          {yieldQty}
                        </span>
                        {diff > 0 && <span className="text-[8px] text-zinc-400 leading-none">+{diff}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground italic py-1">
                No items allocated to this plate.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Production Summary Footer */}
        <div className="bg-muted/50 p-3 space-y-1.5 shrink-0 border-t border-border">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Total Run (All Plates)</span>
            <span className="font-semibold text-sm text-foreground font-mono">{totalSheetsRun.toLocaleString()} sheets</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Unique CTP Plates</span>
            <span className="font-medium text-foreground">
              {plates.length} layout{plates.length > 1 ? "s" : ""} · {totalCtpPlates} plates @ {cmykColors}C
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Paper Waste (Trim Area)</span>
            <span className={`font-medium font-mono ${paperAreaWastePercent > 40 ? "text-destructive" : "text-foreground"}`}>
              {paperAreaWastePercent.toFixed(1)}% <span className="text-muted-foreground font-normal">({layout.utilization.toFixed(1)}% usable)</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: SVG VISUALIZATION & PAGINATION / EXPORT
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col overflow-hidden relative">
        
        {/* Top Control Bar with Pagination & Download Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-border mb-2 shrink-0">
          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-card border border-border rounded-md shadow-xs p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={activePlateIndex <= 0}
                onClick={() => setActivePlateIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="px-2 font-medium text-xs text-foreground">
                Plate {activePlateIndex + 1} of {plates.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={activePlateIndex >= plates.length - 1}
                onClick={() => setActivePlateIndex((prev) => Math.min(plates.length - 1, prev + 1))}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              ({activePlate.requiredSheets.toLocaleString()} sheets for this plate)
            </span>
          </div>

          {/* Download Buttons */}
          <div className="flex items-center gap-1.5">
            <Button onClick={handleExportSVG} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>SVG</span>
            </Button>
            <Button onClick={() => handleExportPDF(false)} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <FileDown className="w-3.5 h-3.5 text-red-500" />
              <span>PDF (Current)</span>
            </Button>
            {plates.length > 1 && (
              <Button onClick={() => handleExportPDF(true)} variant="default" size="sm" className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF (All {plates.length} Plates)</span>
              </Button>
            )}
          </div>
        </div>

        {/* SVG Drawing Canvas Container */}
        <div className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
          {sheetW > 0 && sheetH > 0 ? (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${sheetW} ${sheetH}`}
              className="max-w-full max-h-full"
              style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.12))" }}
            >
              {/* Sheet Background */}
              <rect width={sheetW} height={sheetH} fill="white" stroke="#9ca3af" strokeWidth="1.5" />

              {/* Gripper Area & Tail/Side Lay Indicators */}
              {gripper > 0 && (() => {
                const { effMarginTop, effMarginBottom, effMarginLeft, effMarginRight, gridTop: baseTop, gridLeft: baseLeft } = prepressMargins;
                
                let rect = { x: 0, y: 0, w: 0, h: 0 };
                let gText = { x: 0, y: 0, transform: "", label: `GRIPPER (${gripper}mm)` };
                let tailText = { x: 0, y: 0, transform: "", label: "TAIL" };
                let sideText = { x: 0, y: 0, transform: "", label: "SIDE LAY" };

                if (activeGripperEdge === "Bottom") {
                  rect = { x: 0, y: sheetH - gripper, w: sheetW, h: gripper };
                  gText = { x: baseLeft, y: sheetH - gripper / 2 + 2, transform: "", label: `GRIPPER (${gripper}mm)` };
                  tailText = { x: sheetW / 2, y: Math.max(5, effMarginTop / 2 + 1), transform: "", label: "TAIL" };
                  sideText = { x: Math.max(5, effMarginLeft / 2), y: sheetH / 2, transform: `rotate(-90 ${Math.max(5, effMarginLeft / 2)} ${sheetH / 2})`, label: "SIDE LAY" };
                } else if (activeGripperEdge === "Top") {
                  rect = { x: 0, y: 0, w: sheetW, h: gripper };
                  gText = { x: baseLeft, y: gripper / 2 + 2, transform: "", label: `GRIPPER (${gripper}mm)` };
                  tailText = { x: sheetW / 2, y: sheetH - Math.max(3, effMarginBottom / 2), transform: "", label: "TAIL" };
                  sideText = { x: Math.max(5, effMarginLeft / 2), y: sheetH / 2, transform: `rotate(-90 ${Math.max(5, effMarginLeft / 2)} ${sheetH / 2})`, label: "SIDE LAY" };
                } else if (activeGripperEdge === "Left") {
                  rect = { x: 0, y: 0, w: gripper, h: sheetH };
                  gText = { x: gripper / 2 + 2, y: baseTop + 20, transform: `rotate(-90 ${gripper / 2 + 2} ${baseTop + 20})`, label: `GRIPPER (${gripper}mm)` };
                  tailText = { x: sheetW - Math.max(3, effMarginRight / 2), y: sheetH / 2, transform: `rotate(-90 ${sheetW - Math.max(3, effMarginRight / 2)} ${sheetH / 2})`, label: "TAIL" };
                  sideText = { x: sheetW / 2, y: sheetH - Math.max(3, effMarginBottom / 2), transform: "", label: "SIDE LAY" };
                } else if (activeGripperEdge === "Right") {
                  rect = { x: sheetW - gripper, y: 0, w: gripper, h: sheetH };
                  gText = { x: sheetW - gripper / 2 + 2, y: baseTop + 20, transform: `rotate(-90 ${sheetW - gripper / 2 + 2} ${baseTop + 20})`, label: `GRIPPER (${gripper}mm)` };
                  tailText = { x: Math.max(5, effMarginLeft / 2), y: sheetH / 2, transform: `rotate(-90 ${Math.max(5, effMarginLeft / 2)} ${sheetH / 2})`, label: "TAIL" };
                  sideText = { x: sheetW / 2, y: sheetH - Math.max(3, effMarginBottom / 2), transform: "", label: "SIDE LAY" };
                }

                return (
                  <g>
                    <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#fee2e2" opacity="0.65" />
                    <text x={gText.x} y={gText.y} transform={gText.transform} fontSize={Math.max(7, gripper * 0.4)} fill="#ef4444" fontWeight="bold">
                      {gText.label}
                    </text>
                    <text x={tailText.x} y={tailText.y} transform={tailText.transform} fontSize={5} fill="#6b7280" textAnchor="middle" letterSpacing="1">
                      {tailText.label}
                    </text>
                    <text x={sideText.x} y={sideText.y} transform={sideText.transform} fontSize={5} fill="#6b7280" textAnchor="middle" letterSpacing="1">
                      {sideText.label}
                    </text>
                  </g>
                );
              })()}

              {/* Usable Area Boundary */}
              {(() => {
                const { effMarginTop, effMarginBottom, effMarginLeft, effMarginRight, gTop, gBottom, gLeft, gRight, gridLeft: baseLeft, gridTop: baseTop } = prepressMargins;
                return (
                  <rect
                    x={baseLeft}
                    y={baseTop}
                    width={sheetW - effMarginLeft - effMarginRight - gLeft - gRight}
                    height={sheetH - effMarginTop - effMarginBottom - gTop - gBottom}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })()}

              {/* Prepress Slug Line (Order Name, Date, Plate Info) */}
              {(() => {
                const { effMarginTop, gridLeft: baseLeft, gTop } = prepressMargins;
                const slugFontSize = Math.min(3.5, Math.max(2.2, effMarginTop > 6 ? effMarginTop * 0.35 : 3));
                
                let slugY = gTop + Math.max(slugFontSize, effMarginTop / 2 + 1);
                
                return (
                  <text
                    x={baseLeft}
                    y={slugY}
                    fontSize={slugFontSize}
                    fill="#4b5563"
                    fontWeight="bold"
                    letterSpacing="0.3"
                  >
                    {`ORDER: ${docNo} | ${orderName} | ${activePlate.name} (${activePlateIndex + 1}/${plates.length}) | Sheet: ${sheetW}x${sheetH}mm | Run: ${activePlate.requiredSheets.toLocaleString()} sheets | PRINTGOO PREPRESS`}
                  </text>
                );
              })()}

              {/* Layout Items */}
              {Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
                const row = Math.floor(i / layout.cols);
                const col = i % layout.cols;
                const { gridLeft: baseLeft, gridTop: baseTop } = prepressMargins;
                
                const gridLeft = baseLeft + layout.offsetX;
                const gridTop = baseTop + layout.offsetY;

                const x = gridLeft + col * (layout.itemW + gap);
                const y = gridTop + row * (layout.itemH + gap);

                const cellData = gridCells[i];
                if (!cellData) return null;

                const hasItem = i < layout.pieces;

                // Trim marks configuration
                const pX1 = x + bleed;
                const pY1 = y + bleed;
                const pW = layout.itemW - bleed * 2;
                const pH = layout.itemH - bleed * 2;

                // Dynamic, mathematically contained font sizes
                const labelText = cellData.label || "";
                const maxLabelW = pW * 0.82;
                const charCount = Math.max(1, labelText.length);
                const autoFontSize = maxLabelW / (charCount * 0.6);
                const labelFontSize = Math.max(2.4, Math.min(autoFontSize, pH * 0.13, 7));
                const slotNumFontSize = Math.max(2, Math.min(labelFontSize * 0.7, 3.6));

                return (
                  <g key={i}>
                    {hasItem && (
                      <>
                        {/* Bleed Area Box */}
                        <rect
                          x={x}
                          y={y}
                          width={layout.itemW}
                          height={layout.itemH}
                          fill={cellData.color}
                          stroke="#9ca3af"
                          strokeWidth="0.5"
                        />

                        {/* Product Cut Boundary */}
                        <rect
                          x={pX1}
                          y={pY1}
                          width={pW}
                          height={pH}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="0.5"
                          strokeDasharray="2 2"
                        />

                        {/* Optimized Centered Label and Meta */}
                        {cellData.label && (
                          <g>
                            {pH > 35 ? (
                              <>
                                <text
                                  x={x + layout.itemW / 2}
                                  y={y + layout.itemH / 2 - labelFontSize * 0.75}
                                  fontSize={slotNumFontSize}
                                  fill="#6b7280"
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                  fontWeight="600"
                                >
                                  {`#${i + 1}`}
                                </text>
                                <text
                                  x={x + layout.itemW / 2}
                                  y={y + layout.itemH / 2 + labelFontSize * 0.25}
                                  fontSize={labelFontSize}
                                  fill="#111827"
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                  fontWeight="bold"
                                >
                                  {cellData.label}
                                </text>
                                <text
                                  x={x + layout.itemW / 2}
                                  y={y + layout.itemH / 2 + labelFontSize * 1.25}
                                  fontSize={slotNumFontSize * 0.9}
                                  fill="#9ca3af"
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                >
                                  {`${prodW}×${prodH}mm`}
                                </text>
                              </>
                            ) : (
                              <text
                                x={x + layout.itemW / 2}
                                y={y + layout.itemH / 2 + labelFontSize * 0.35}
                                fontSize={labelFontSize}
                                fill="#111827"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fontWeight="bold"
                              >
                                {`#${i + 1} ${cellData.label}`}
                              </text>
                            )}
                          </g>
                        )}
                      </>
                    )}
                  </g>
                );
              })}

              {/* Outer Crop Marks (margin only, aligned to cut lines) */}
              <g stroke="#000" strokeWidth="0.4">
                {outerTrimMarks.map((s, idx) => (
                  <line key={idx} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
                ))}
              </g>
            </svg>
          ) : (
            <div className="text-muted-foreground text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Please enter valid sheet dimensions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
