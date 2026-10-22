import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Info, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  ImpositionLayout, 
  PrepressMargins, 
  GridCell, 
  TrimMarkSegment, 
  CalculatedPlate, 
  PlateConfig,
  LayoutCalcMode,
  KashirovkaSummary,
  ActivePlateSide,
} from "../types";
import { LayoutCell } from "./LayoutCell";
import { ProductShapeType, ProductCustomShape } from "../../../types";
import { parseSvgContour, ParsedSvgContour } from "../../../utils/svgContour";

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
  kashirovkaSummary?: KashirovkaSummary;
  shapeType?: ProductShapeType;
  customShape?: ProductCustomShape;
  customSvgPath?: string;
  cornerType?: string;
  artworkFront?: string;
  artworkBack?: string;
  activeSide?: ActivePlateSide;
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
  kashirovkaSummary,
  shapeType,
  customShape,
  customSvgPath,
  cornerType,
  artworkFront,
  artworkBack,
  activeSide = "back",
}: Props) {
  const [cellViewMode, setCellViewMode] = useState<"schematic" | "artwork">(artworkFront || artworkBack ? "artwork" : "schematic");

  useEffect(() => {
    if (artworkFront || artworkBack) {
      setCellViewMode("artwork");
    }
  }, [artworkFront, artworkBack]);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const parsedSvg: ParsedSvgContour | null = useMemo(() => {
    if (shapeType === "custom_die" && customShape === "vector_svg" && customSvgPath) {
      return parseSvgContour(customSvgPath);
    }
    return null;
  }, [shapeType, customShape, customSvgPath]);

  // Wheel zoom handler with cursor focus zoom and passive: false to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.4), 8.0);
        setPan((prevPan) => ({
          x: prevPan.x - (cursorX - prevPan.x) * (nextZoom / prevZoom - 1),
          y: prevPan.y - (cursorY - prevPan.y) * (nextZoom / prevZoom - 1),
        }));
        return nextZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPan({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(z * 1.25, 8.0));
  const zoomOut = () => setZoom((z) => Math.max(z * 0.8, 0.4));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

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

  // Gripper layout
  const gripperRect = {
    x: activeGripperEdge === "Left" ? effMarginLeft : 0,
    y: activeGripperEdge === "Top" ? effMarginTop : activeGripperEdge === "Bottom" ? sheetH - effMarginBottom - gripper : 0,
    w: activeGripperEdge === "Left" || activeGripperEdge === "Right" ? gripper : sheetW,
    h: activeGripperEdge === "Top" || activeGripperEdge === "Bottom" ? gripper : sheetH,
  };

  const gText = {
    x: activeGripperEdge === "Left" ? effMarginLeft + gripper / 2 : sheetW / 2,
    y: activeGripperEdge === "Bottom" ? sheetH - effMarginBottom - gripper / 2 + 3 : effMarginTop + gripper / 2 + 3,
    transform: activeGripperEdge === "Left" ? `rotate(-90 ${effMarginLeft + gripper / 2} ${sheetH / 2})` : undefined,
    label: `GRIPPER (${gripper}mm - ${activeGripperEdge.toUpperCase()})`,
  };

  const tailText = {
    x: activeGripperEdge === "Bottom" ? sheetW / 2 : sheetW / 2,
    y: activeGripperEdge === "Bottom" ? effMarginTop - 2 : sheetH - effMarginBottom + 6,
    transform: undefined,
    label: "TAIL EDGE (REAR)",
  };

  const sideText = {
    x: activeSide === "back" ? effMarginLeft - 3 : sheetW - effMarginRight + 5,
    y: sheetH / 2,
    transform: `rotate(-90 ${activeSide === "back" ? effMarginLeft - 3 : sheetW - effMarginRight + 5} ${sheetH / 2})`,
    label: "SIDE GUIDE (SIDE LAY)",
  };

  const slugY = activeGripperEdge === "Top" ? sheetH - effMarginBottom / 2 : effMarginTop / 2 + 2;
  const slugFontSize = Math.max(6, Math.min(sheetW * 0.012, 11));

  const sideLabel = activeSide === "back" ? "ORQA / BACK (ОБОРОТ)" : "OLDI / FRONT (ЛИЦО)";

  return (
    <div className="relative flex-1 bg-white dark:bg-zinc-950 rounded-lg overflow-hidden flex items-center justify-center border border-border select-none">
      {/* Zoom / Pan and View mode Controls Overlay (Bottom-Right corner to avoid covering artwork) */}
      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-background/85 backdrop-blur-md px-1 py-0.5 rounded border border-border shadow-2xs">
        {/* Toggle between Schematic (Codes) and Real Artwork Proof */}
        {(artworkFront || artworkBack) && (
          <div className="flex items-center gap-0.5 bg-muted/70 p-0.5 rounded border border-border mr-0.5">
            <button
              type="button"
              onClick={() => setCellViewMode("schematic")}
              className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition-all ${
                cellViewMode === "schematic"
                  ? "bg-background text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sxema
            </button>
            <button
              type="button"
              onClick={() => setCellViewMode("artwork")}
              className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition-all ${
                cellViewMode === "artwork"
                  ? "bg-blue-600 text-white font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rasm
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
          onClick={zoomIn}
          title="Kattalashtirish"
        >
          <ZoomIn className="w-2.5 h-2.5" />
        </Button>
        <span className="font-mono text-[9px] w-8 text-center text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
          onClick={zoomOut}
          title="Kichiklashtirish"
        >
          <ZoomOut className="w-2.5 h-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
          onClick={resetView}
          title="Tiklash"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full flex items-center justify-center p-3 overflow-hidden ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.05s ease-out",
          }}
          className="flex items-center justify-center w-full h-full pointer-events-none"
        >
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

            {/* Prepress Slug Line (Order Name, Date, Plate Info, Side) */}
            <text
              x={baseLeft}
              y={slugY}
              fontSize={slugFontSize}
              fill={activeSide === "back" ? "#6d28d9" : "#1e40af"}
              fontWeight="bold"
              letterSpacing="0.3"
            >
              {`ORDER: ${docNo} | ${orderName} | ${activePlate.name} [${sideLabel}] (${activePlateIndex + 1}/${plates.length}) | Sheet: ${sheetW}x${sheetH}mm | Run: ${activePlate.requiredSheets.toLocaleString()} sheets | PRINTGOO PREPRESS`}
            </text>

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
                  shapeType={shapeType}
                  customShape={customShape}
                  parsedSvg={parsedSvg}
                  cornerType={cornerType}
                  artworkFront={artworkFront}
                  artworkBack={artworkBack}
                  viewMode={cellViewMode}
                />
              );
            })}

            {/* Kashirovka Split-Half Cut & Mount Axis Line */}
            {kashirovkaSummary?.enabled &&
              kashirovkaSummary.strategy === "split_half_sheet" &&
              kashirovkaSummary.splitCutAxisX !== undefined && (
                <g>
                  <line
                    x1={kashirovkaSummary.splitCutAxisX}
                    y1={effMarginTop}
                    x2={kashirovkaSummary.splitCutAxisX}
                    y2={sheetH - effMarginBottom}
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={kashirovkaSummary.splitCutAxisX + 3}
                    y={sheetH / 2}
                    fontSize={6}
                    fill="#7c3aed"
                    fontWeight="bold"
                    transform={`rotate(-90 ${kashirovkaSummary.splitCutAxisX + 3} ${sheetH / 2})`}
                  >
                    SPLIT CUT AXIS (FRONT / BACK)
                  </text>
                </g>
              )}

            {/* Outer Trim Marks */}
            {outerTrimMarks.map((tm, idx) => (
              <line
                key={idx}
                x1={tm.x1}
                y1={tm.y1}
                x2={tm.x2}
                y2={tm.y2}
                stroke="#18181b"
                strokeWidth={0.65}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
