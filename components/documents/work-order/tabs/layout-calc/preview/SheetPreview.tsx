import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
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
import { COLOR_PALETTE } from "../useLayoutCalc";

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
  splitCutAxisX?: number;
  isWorkAndTurn?: boolean;
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
  splitCutAxisX,
  isWorkAndTurn = false,
  shapeType,
  customShape,
  customSvgPath,
  cornerType,
  artworkFront,
  artworkBack,
  activeSide = "front",
}: Props) {
  const hasAnyCellArtwork = useMemo(
    () => Boolean(artworkFront || artworkBack || gridCells.some((c) => c.artworkUrl)),
    [artworkFront, artworkBack, gridCells]
  );

  const [cellViewMode, setCellViewMode] = useState<"schematic" | "artwork">(
    hasAnyCellArtwork ? "artwork" : "schematic"
  );

  useEffect(() => {
    if (hasAnyCellArtwork) {
      setCellViewMode("artwork");
    }
  }, [hasAnyCellArtwork]);

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
    x: activeGripperEdge === "Left" ? 0 : activeGripperEdge === "Right" ? sheetW - gripper : 0,
    y: activeGripperEdge === "Top" ? 0 : activeGripperEdge === "Bottom" ? sheetH - gripper : 0,
    w: activeGripperEdge === "Left" || activeGripperEdge === "Right" ? gripper : sheetW,
    h: activeGripperEdge === "Top" || activeGripperEdge === "Bottom" ? gripper : sheetH,
  };

  const gText = {
    x:
      activeGripperEdge === "Left"
        ? gripper / 2
        : activeGripperEdge === "Right"
        ? sheetW - gripper / 2
        : sheetW / 2,
    y:
      activeGripperEdge === "Bottom"
        ? sheetH - gripper / 2 + 2.5
        : activeGripperEdge === "Top"
        ? gripper / 2 + 2.5
        : sheetH / 2,
    transform:
      activeGripperEdge === "Left"
        ? `rotate(-90 ${gripper / 2} ${sheetH / 2})`
        : activeGripperEdge === "Right"
        ? `rotate(-90 ${sheetW - gripper / 2} ${sheetH / 2})`
        : undefined,
    label: `KLAPAN / GRIPPER (${gripper}mm - ${activeGripperEdge.toUpperCase()})`,
  };

  const slugY = activeGripperEdge === "Top" ? sheetH - Math.max(2.5, effMarginBottom / 2) : Math.max(5.5, (effMarginTop + gTop) / 2 + 1.5);
  const slugFontSize = Math.max(5.5, Math.min(sheetW * 0.011, 9.5));

  const sideLabel = isWorkAndTurn
    ? "WORK & TURN (CHAP: OLDI / O'NG: ORQA)"
    : activeSide === "back"
    ? "ORQA TOMON"
    : "OLDI TOMON";

  const effectiveAxisX =
    splitCutAxisX !== undefined
      ? splitCutAxisX
      : kashirovkaSummary?.enabled && kashirovkaSummary.strategy === "split_half_sheet"
      ? kashirovkaSummary.splitCutAxisX
      : undefined;

  const axisLabel = isWorkAndTurn
    ? "QAYTARMA O'QI (WORK & TURN)"
    : "KASHIROVKA KESISH O'QI (OLDI / ORQA)";

  // Legend items for the bottom bar
  const legendItems = useMemo(() => {
    if (!activePlate || !activePlate.assignments) return [];
    return activePlate.assignments
      .map((a, idx) => ({
        id: a.sizeId,
        code: a.sizeCode || a.sizeLabel,
        slots: a.slots,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }))
      .filter((item) => item.slots > 0);
  }, [activePlate]);

  const gridLeft = baseLeft + layout.offsetX;
  const gridTop = baseTop + layout.offsetY;
  const gridRight = gridLeft + layout.cols * layout.itemW + Math.max(0, layout.cols - 1) * gap;
  const gridBottom = gridTop + layout.rows * layout.itemH + Math.max(0, layout.rows - 1) * gap;

  const regPoints = [
    { cx: Math.max(4, gridLeft - 3.5), cy: Math.max(4, gridTop - 3.5) },
    { cx: Math.min(sheetW - 4, gridRight + 3.5), cy: Math.max(4, gridTop - 3.5) },
    { cx: Math.max(4, gridLeft - 3.5), cy: Math.min(sheetH - 4, gridBottom + 3.5) },
    { cx: Math.min(sheetW - 4, gridRight + 3.5), cy: Math.min(sheetH - 4, gridBottom + 3.5) },
  ];

  return (
    <div className="relative flex-1 bg-zinc-100/80 dark:bg-zinc-950 rounded-md overflow-hidden flex flex-col border border-border select-none">
      {/* Main Canvas Viewport */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {/* Bottom-Right Zoom & View Mode Controls */}
        <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-background/90 backdrop-blur-xs px-1.5 py-0.5 rounded border border-border shadow-2xs">
          {hasAnyCellArtwork && (
            <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded border border-border mr-1">
              <button
                type="button"
                onClick={() => setCellViewMode("schematic")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
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
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                  cellViewMode === "artwork"
                    ? "bg-blue-600 text-white font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Maket
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={zoomIn}
            title="Kattalashtirish"
          >
            <ZoomIn className="w-3 h-3" />
          </Button>
          <span className="font-mono text-[10px] w-9 text-center text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={zoomOut}
            title="Kichiklashtirish"
          >
            <ZoomOut className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={resetView}
            title="Asliga qaytarish"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>

        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${
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
              style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.12))" }}
            >
              {/* Sheet Background */}
              <rect width={sheetW} height={sheetH} fill="white" stroke="#9ca3af" strokeWidth="1.2" />

              {/* Gripper Area */}
              {gripper > 0 && (
                <g>
                  <rect
                    x={gripperRect.x}
                    y={gripperRect.y}
                    width={gripperRect.w}
                    height={gripperRect.h}
                    fill="#fee2e2"
                    opacity="0.7"
                  />
                  <text
                    x={gText.x}
                    y={gText.y}
                    transform={gText.transform}
                    fontSize={Math.max(6, Math.min(gripper * 0.45, 9))}
                    fill="#dc2626"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {gText.label}
                  </text>
                </g>
              )}

              {/* Usable Area Boundary */}
              <rect
                x={baseLeft}
                y={baseTop}
                width={Math.max(0, sheetW - effMarginLeft - effMarginRight - gLeft - gRight)}
                height={Math.max(0, sheetH - effMarginTop - effMarginBottom - gTop - gBottom)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.8"
                strokeDasharray="3.5 3.5"
              />

              {/* Compact Prepress Slug Line (fits within sheetW) */}
              <text
                x={baseLeft}
                y={slugY}
                fontSize={slugFontSize}
                fill="#1e40af"
                fontWeight="bold"
              >
                {`${docNo} · ${activePlate.name} (${activePlateIndex + 1}/${plates.length}) [${sideLabel}] · ${sheetW}×${sheetH}mm · Tiraj: ${activePlate.requiredSheets.toLocaleString()} list`}
              </text>

              {/* Layout Items */}
              {Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
                const row = Math.floor(i / layout.cols);
                const col = i % layout.cols;

                const x = gridLeft + col * (layout.itemW + gap);
                const y = gridTop + row * (layout.itemH + gap);

                const cellData = gridCells[i];
                if (!cellData || i >= layout.pieces) return null;

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

              {/* Split Axis Line (Work-and-Turn OR Split-Half Kashirovka) */}
              {effectiveAxisX !== undefined && (
                <g>
                  <line
                    x1={effectiveAxisX}
                    y1={effMarginTop}
                    x2={effectiveAxisX}
                    y2={sheetH - effMarginBottom}
                    stroke="#2563eb"
                    strokeWidth={1.3}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={effectiveAxisX + 3}
                    y={sheetH / 2}
                    fontSize={Math.max(5.5, slugFontSize * 0.8)}
                    fill="#1d4ed8"
                    fontWeight="bold"
                    textAnchor="middle"
                    transform={`rotate(-90 ${effectiveAxisX + 3} ${sheetH / 2})`}
                  >
                    {axisLabel}
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
                  strokeWidth={0.55}
                />
              ))}

              {/* Corner Registration Crosshairs */}
              {layout.pieces > 0 &&
                regPoints.map((pt, idx) => (
                  <g key={`reg-${idx}`} stroke="#18181b" strokeWidth={0.4} fill="none">
                    <circle cx={pt.cx} cy={pt.cy} r={1.8} />
                    <line x1={pt.cx - 2.8} y1={pt.cy} x2={pt.cx + 2.8} y2={pt.cy} />
                    <line x1={pt.cx} y1={pt.cy - 2.8} x2={pt.cx} y2={pt.cy + 2.8} />
                  </g>
                ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Compact Color Legend Bar */}
      {legendItems.length > 0 && (
        <div className="h-6 px-2.5 bg-card border-t border-border flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
          <span className="text-[10px] font-medium text-muted-foreground shrink-0">
            Joylashuv:
          </span>
          {legendItems.map((item) => (
            <div
              key={item.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-background shrink-0 font-mono text-[10px]"
            >
              <span
                className="w-2.5 h-2.5 rounded-xs border border-zinc-400/60 shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-semibold text-foreground">{item.code}</span>
              <span className="text-muted-foreground">({item.slots})</span>
            </div>
          ))}
          {activePlate.unassignedSlots > 0 && (
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 shrink-0">
              Bo&apos;sh: {activePlate.unassignedSlots} joy
            </span>
          )}
          {activePlate.unassignedSlots < 0 && (
            <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-semibold shrink-0">
              Limitdan oshdi: +{Math.abs(activePlate.unassignedSlots)} joy
            </span>
          )}
        </div>
      )}
    </div>
  );
}
