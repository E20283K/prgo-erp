import React from "react";
import { Info } from "lucide-react";
import { 
  ImpositionLayout, 
  PrepressMargins, 
  GridCell, 
  TrimMarkSegment, 
  CalculatedPlate, 
  PlateConfig,
  LayoutCalcMode 
} from "../types";
import { LayoutCell } from "./LayoutCell";

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  calcMode?: LayoutCalcMode;
  sheetW: number;
  sheetH: number;
  prodW: number;
  prodH: number;
  bleed: number;
  gap: number;
  gripper: number;
  docNo: string;
  orderName: string;
  activePlate: CalculatedPlate;
  activePlateIndex: number;
  plates: PlateConfig[];
  prepressMargins: PrepressMargins & { activeGripperEdge: "Bottom" | "Top" | "Left" | "Right" };
  layout: ImpositionLayout;
  gridCells: GridCell[];
  outerTrimMarks: TrimMarkSegment[];
}

export function SheetPreview({
  svgRef,
  calcMode = "production",
  sheetW,
  sheetH,
  prodW,
  prodH,
  bleed,
  gap,
  gripper,
  docNo,
  orderName,
  activePlate,
  activePlateIndex,
  plates,
  prepressMargins,
  layout,
  gridCells,
  outerTrimMarks,
}: Props) {
  if (sheetW <= 0 || sheetH <= 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-2">
        <div className="text-muted-foreground text-sm flex items-center gap-1.5">
          <Info className="w-4 h-4" /> Please enter valid sheet dimensions
        </div>
      </div>
    );
  }

  const {
    effMarginTop,
    effMarginBottom,
    effMarginLeft,
    effMarginRight,
    gTop,
    gBottom,
    gLeft,
    gRight,
    gridLeft: baseLeft,
    gridTop: baseTop,
    activeGripperEdge,
  } = prepressMargins;

  // Gripper geometry
  let gripperRect = { x: 0, y: 0, w: 0, h: 0 };
  let gText = { x: 0, y: 0, transform: "", label: `GRIPPER (${gripper}mm)` };
  let tailText = { x: 0, y: 0, transform: "", label: "TAIL" };
  let sideText = { x: 0, y: 0, transform: "", label: "SIDE LAY" };

  if (gripper > 0) {
    if (activeGripperEdge === "Bottom") {
      gripperRect = { x: 0, y: sheetH - gripper, w: sheetW, h: gripper };
      gText = { x: baseLeft, y: sheetH - gripper / 2 + 2, transform: "", label: `GRIPPER (${gripper}mm)` };
      tailText = { x: sheetW / 2, y: Math.max(5, effMarginTop / 2 + 1), transform: "", label: "TAIL" };
      sideText = {
        x: Math.max(5, effMarginLeft / 2),
        y: sheetH / 2,
        transform: `rotate(-90 ${Math.max(5, effMarginLeft / 2)} ${sheetH / 2})`,
        label: "SIDE LAY",
      };
    } else if (activeGripperEdge === "Top") {
      gripperRect = { x: 0, y: 0, w: sheetW, h: gripper };
      gText = { x: baseLeft, y: gripper / 2 + 2, transform: "", label: `GRIPPER (${gripper}mm)` };
      tailText = { x: sheetW / 2, y: sheetH - Math.max(3, effMarginBottom / 2), transform: "", label: "TAIL" };
      sideText = {
        x: Math.max(5, effMarginLeft / 2),
        y: sheetH / 2,
        transform: `rotate(-90 ${Math.max(5, effMarginLeft / 2)} ${sheetH / 2})`,
        label: "SIDE LAY",
      };
    } else if (activeGripperEdge === "Left") {
      gripperRect = { x: 0, y: 0, w: gripper, h: sheetH };
      gText = {
        x: gripper / 2 + 2,
        y: baseTop + 20,
        transform: `rotate(-90 ${gripper / 2 + 2} ${baseTop + 20})`,
        label: `GRIPPER (${gripper}mm)`,
      };
      tailText = {
        x: sheetW - Math.max(3, effMarginRight / 2),
        y: sheetH / 2,
        transform: `rotate(-90 ${sheetW - Math.max(3, effMarginRight / 2)} ${sheetH / 2})`,
        label: "TAIL",
      };
      sideText = {
        x: sheetW / 2,
        y: sheetH - Math.max(3, effMarginBottom / 2),
        transform: "",
        label: "SIDE LAY",
      };
    } else if (activeGripperEdge === "Right") {
      gripperRect = { x: sheetW - gripper, y: 0, w: gripper, h: sheetH };
      gText = {
        x: sheetW - gripper / 2 + 2,
        y: baseTop + 20,
        transform: `rotate(-90 ${sheetW - gripper / 2 + 2} ${baseTop + 20})`,
        label: `GRIPPER (${gripper}mm)`,
      };
      tailText = {
        x: Math.max(5, effMarginLeft / 2),
        y: sheetH / 2,
        transform: `rotate(-90 ${Math.max(5, effMarginLeft / 2)} ${sheetH / 2})`,
        label: "TAIL",
      };
      sideText = {
        x: sheetW / 2,
        y: sheetH - Math.max(3, effMarginBottom / 2),
        transform: "",
        label: "SIDE LAY",
      };
    }
  }

  // Prepress Slug Line
  const slugFontSize = Math.min(3.5, Math.max(2.2, effMarginTop > 6 ? effMarginTop * 0.35 : 3));
  const slugY = gTop + Math.max(slugFontSize, effMarginTop / 2 + 1);

  return (
    <div className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${sheetW} ${sheetH}`}
        className="max-w-full max-h-full"
        style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.12))" }}
      >
        {/* Sheet Background */}
        <rect width={sheetW} height={sheetH} fill="white" stroke="#9ca3af" strokeWidth="1.5" />

        {/* Gripper Area & Tail/Side Lay Indicators */}
        {gripper > 0 && (
          <g>
            <rect
              x={gripperRect.x}
              y={gripperRect.y}
              width={gripperRect.w}
              height={gripperRect.h}
              fill="#fee2e2"
              opacity="0.65"
            />
            <text
              x={gText.x}
              y={gText.y}
              transform={gText.transform}
              fontSize={Math.max(7, gripper * 0.4)}
              fill="#ef4444"
              fontWeight="bold"
            >
              {gText.label}
            </text>
            <text
              x={tailText.x}
              y={tailText.y}
              transform={tailText.transform}
              fontSize={5}
              fill="#6b7280"
              textAnchor="middle"
              letterSpacing="1"
            >
              {tailText.label}
            </text>
            <text
              x={sideText.x}
              y={sideText.y}
              transform={sideText.transform}
              fontSize={5}
              fill="#6b7280"
              textAnchor="middle"
              letterSpacing="1"
            >
              {sideText.label}
            </text>
          </g>
        )}

        {/* Usable Area Boundary */}
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

        {/* Prepress Slug Line (Order Name, Date, Plate Info) */}
        <text
          x={baseLeft}
          y={slugY}
          fontSize={slugFontSize}
          fill={calcMode === "sample" ? "#b45309" : "#4b5563"}
          fontWeight="bold"
          letterSpacing="0.3"
        >
          {calcMode === "sample"
            ? `[SAMPLE PROOF] ORDER: ${docNo} | ${orderName} | Sheet: ${sheetW}x${sheetH}mm | Run: ${activePlate.requiredSheets.toLocaleString()} sheets (Sample) | PRINTGOO PREPRESS`
            : `ORDER: ${docNo} | ${orderName} | ${activePlate.name} (${activePlateIndex + 1}/${plates.length}) | Sheet: ${sheetW}x${sheetH}mm | Run: ${activePlate.requiredSheets.toLocaleString()} sheets | PRINTGOO PREPRESS`}
        </text>

        {/* Sample Proof Stamp Watermark */}
        {calcMode === "sample" && (
          <g transform={`translate(${sheetW - Math.max(effMarginRight, 40) - 2}, ${gTop + 2})`}>
            <rect
              x="-60"
              y="0"
              width="60"
              height="8"
              rx="1.5"
              fill="#fef3c7"
              stroke="#d97706"
              strokeWidth="0.4"
              strokeDasharray="1.5 0.8"
            />
            <text
              x="-30"
              y="5.5"
              fontSize="3.2"
              fill="#b45309"
              fontWeight="bold"
              textAnchor="middle"
              letterSpacing="0.4"
            >
              SAMPLE PROOF ONLY
            </text>
          </g>
        )}

        {/* Layout Items */}
        {Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
          const row = Math.floor(i / layout.cols);
          const col = i % layout.cols;

          const gridLeft = baseLeft + layout.offsetX;
          const gridTop = baseTop + layout.offsetY;

          const x = gridLeft + col * (layout.itemW + gap);
          const y = gridTop + row * (layout.itemH + gap);

          const cellData = gridCells[i];
          if (!cellData) return null;

          const hasItem = i < layout.pieces;
          if (!hasItem) return null;

          return (
            <LayoutCell
              key={i}
              index={i}
              x={x}
              y={y}
              itemW={layout.itemW}
              itemH={layout.itemH}
              bleed={bleed}
              prodW={prodW}
              prodH={prodH}
              cellData={cellData}
            />
          );
        })}

        {/* Outer Crop Marks (margin only, aligned to cut lines) */}
        <g stroke="#000" strokeWidth="0.4">
          {outerTrimMarks.map((s, idx) => (
            <line key={idx} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          ))}
        </g>
      </svg>
    </div>
  );
}
