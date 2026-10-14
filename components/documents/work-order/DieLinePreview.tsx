"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  Maximize2,
  Ruler,
  Layers,
  AlertTriangle,
  ExternalLink,
  Grid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

interface DieLinePreviewProps {
  width: number;
  height: number;
  bleed: number;
  dimensionUnit?: string;
  cornerType?: string;
  itemCategory?: string;
  totalQuantity?: number;
  paperStock?: string;
  holeSize?: number;
  holePosition?: "top-center" | "top-left" | "top-right" | "left-center" | "right-center" | "none";
  holeOffset?: number;
  onFlipOrientation?: () => void;
  onOpenLayoutTab?: () => void;
  className?: string;
}

export function DieLinePreview({
  width = 50,
  height = 90,
  bleed = 2,
  dimensionUnit = "mm",
  cornerType = "Square Cut",
  itemCategory = "Hangtag",
  totalQuantity = 5000,
  paperStock = "Galerie Art Silk 150g/m²",
  holeSize,
  holePosition,
  holeOffset,
  onFlipOrientation,
  onOpenLayoutTab,
  className,
}: DieLinePreviewProps) {
  const t = useTranslations("DieLine");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"unit" | "yield">("unit");
  const [sheetFormat, setSheetFormat] = useState<"B1" | "B2" | "A1">("B1");

  // Zoom & Pan State for in-card preview
  const [cardZoom, setCardZoom] = useState(1);
  const [cardPan, setCardPan] = useState({ x: 0, y: 0 });
  const [isCardDragging, setIsCardDragging] = useState(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const cardDragStartRef = useRef({ x: 0, y: 0 });

  // Zoom & Pan State for Fullscreen Modal
  const [modalZoom, setModalZoom] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalDragStartRef = useRef({ x: 0, y: 0 });

  // Wheel Zoom Listener with non-passive preventDefault for in-card preview
  useEffect(() => {
    const el = cardContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      setCardZoom((prev) => {
        const next = Math.min(4, Math.max(0.5, Number((prev * zoomFactor).toFixed(2))));
        return next;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Wheel Zoom Listener for Fullscreen Modal
  useEffect(() => {
    if (!isModalOpen) return;
    const el = modalContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      setModalZoom((prev) => {
        const next = Math.min(5, Math.max(0.5, Number((prev * zoomFactor).toFixed(2))));
        return next;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [isModalOpen]);

  // Card Mouse Drag / Pan Handlers
  const handleCardMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsCardDragging(true);
    cardDragStartRef.current = { x: e.clientX - cardPan.x, y: e.clientY - cardPan.y };
  };

  const handleCardMouseMove = (e: React.MouseEvent) => {
    if (!isCardDragging) return;
    setCardPan({
      x: e.clientX - cardDragStartRef.current.x,
      y: e.clientY - cardDragStartRef.current.y,
    });
  };

  const handleCardMouseUp = () => {
    setIsCardDragging(false);
  };

  const handleCardDoubleClick = () => {
    if (cardZoom !== 1 || cardPan.x !== 0 || cardPan.y !== 0) {
      setCardZoom(1);
      setCardPan({ x: 0, y: 0 });
    } else {
      setCardZoom(1.75);
    }
  };

  // Modal Mouse Drag / Pan Handlers
  const handleModalMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsModalDragging(true);
    modalDragStartRef.current = { x: e.clientX - modalPan.x, y: e.clientY - modalPan.y };
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (!isModalDragging) return;
    setModalPan({
      x: e.clientX - modalDragStartRef.current.x,
      y: e.clientY - modalDragStartRef.current.y,
    });
  };

  const handleModalMouseUp = () => {
    setIsModalDragging(false);
  };

  const handleModalDoubleClick = () => {
    if (modalZoom !== 1 || modalPan.x !== 0 || modalPan.y !== 0) {
      setModalZoom(1);
      setModalPan({ x: 0, y: 0 });
    } else {
      setModalZoom(1.75);
    }
  };

  const handleViewModeChange = (mode: "unit" | "yield") => {
    setViewMode(mode);
    setCardZoom(1);
    setCardPan({ x: 0, y: 0 });
    setModalZoom(1);
    setModalPan({ x: 0, y: 0 });
  };

  const safeW = Math.max(5, Number(width) || 50);
  const safeH = Math.max(5, Number(height) || 90);
  const safeBleed = Math.max(0, Number(bleed) || 0);

  // Aspect ratio & Orientation
  const ratio = (safeW / safeH).toFixed(2);
  const orientation =
    safeW > safeH ? t("landscape") : safeW < safeH ? t("portrait") : t("square");

  // Area in cm²
  const netAreaCm2 = ((safeW * safeH) / 100).toFixed(1);

  // Finishing feature flags
  const isRounded =
    cornerType?.toLowerCase().includes("round") ||
    cornerType?.toLowerCase().includes("radius");
  const isHangtag =
    itemCategory?.toLowerCase().includes("hangtag") ||
    cornerType?.toLowerCase().includes("eyelet") ||
    cornerType?.toLowerCase().includes("hole");
  const isFolded =
    itemCategory?.toLowerCase().includes("fold") ||
    cornerType?.toLowerCase().includes("crease");

  const hasHole =
    (holeSize !== undefined ? holeSize > 0 : isHangtag) && holePosition !== "none";
  const effectiveHoleDiameter = holeSize !== undefined ? holeSize : 4;
  const effectiveHolePos = holePosition || "top-center";
  const effectiveHoleOffset = holeOffset !== undefined ? holeOffset : 6;

  // Preflight Sanity Warnings
  const warnings = useMemo(() => {
    const list: { id: string; text: string; severity: "amber" | "blue" }[] = [];
    if (safeBleed === 0) {
      list.push({ id: "zeroBleed", text: t("zeroBleedWarn"), severity: "amber" });
    }
    if (safeW < 25 || safeH < 25) {
      list.push({ id: "narrowMargin", text: t("narrowMarginWarn"), severity: "amber" });
    }
    const isHeavy =
      /(3\d\d|4\d\d|5\d\d|6\d\d)\s*g/i.test(paperStock || "") ||
      /(board|cardboard|heavy|кашировка|дуплекс)/i.test(paperStock || "");
    if (isFolded && isHeavy) {
      list.push({ id: "heavyFold", text: t("heavyFoldWarn"), severity: "blue" });
    }
    return list;
  }, [safeBleed, safeW, safeH, isFolded, paperStock, t]);

  // Mini-Imposition Sheet Yield Math
  const sheetDimensions = {
    B1: { w: 1000, h: 700, name: "B1 (700 × 1000 mm)" },
    B2: { w: 700, h: 500, name: "B2 (500 × 700 mm)" },
    A1: { w: 860, h: 610, name: "A1 (610 × 860 mm)" },
  };

  const currentSheet = sheetDimensions[sheetFormat];
  const itemWithBleedW = safeW + 2 * safeBleed;
  const itemWithBleedH = safeH + 2 * safeBleed;

  // Offset press sheet margins: 15mm gripper along bottom, 10mm top & sides
  const marginSide = 10;
  const marginTop = 10;
  const marginGripper = 15;
  const printableW = Math.max(10, currentSheet.w - 2 * marginSide);
  const printableH = Math.max(10, currentSheet.h - marginTop - marginGripper);

  // 2mm cutter gutter gap between pieces
  const stepW = itemWithBleedW + 2;
  const stepH = itemWithBleedH + 2;

  // Orientation 1: Normal
  const cols1 = Math.max(1, Math.floor((printableW + 2) / stepW));
  const rows1 = Math.max(1, Math.floor((printableH + 2) / stepH));
  const count1 = cols1 * rows1;

  // Orientation 2: Rotated 90°
  const cols2 = Math.max(1, Math.floor((printableW + 2) / stepH));
  const rows2 = Math.max(1, Math.floor((printableH + 2) / stepW));
  const count2 = cols2 * rows2;

  const isRotated = count2 > count1;
  const cols = isRotated ? cols2 : cols1;
  const rows = isRotated ? rows2 : rows1;
  const yieldCount = isRotated ? count2 : count1;
  const cellItemW = isRotated ? itemWithBleedH : itemWithBleedW;
  const cellItemH = isRotated ? itemWithBleedW : itemWithBleedH;

  const utilizationPct = Math.min(
    99.9,
    Number(((yieldCount * safeW * safeH) / (currentSheet.w * currentSheet.h) * 100).toFixed(1))
  );

  const targetRun = totalQuantity && totalQuantity > 0 ? totalQuantity : 5000;
  const netSheets = Math.ceil(targetRun / (yieldCount || 1));
  const grossSheets = Math.ceil(netSheets * 1.05) + 50;

  // 1-Up Die-Line Vector SVG Renderer
  const renderSvgCanvas = (
    cW: number,
    cH: number,
    boxW: number,
    boxH: number,
    idSuffix: string
  ) => {
    const cx = cW / 2;
    const cy = cH / 2;

    const totalW = safeW + 2 * safeBleed;
    const totalH = safeH + 2 * safeBleed;

    const scale = Math.min(boxW / totalW, boxH / totalH);

    const drawW = safeW * scale;
    const drawH = safeH * scale;
    const drawBleed = safeBleed * scale;

    const trimX = cx - drawW / 2;
    const trimY = cy - drawH / 2;
    const trimRadius = isRounded ? Math.min(12, Math.min(drawW, drawH) * 0.25) : 0;

    const bleedX = trimX - drawBleed;
    const bleedY = trimY - drawBleed;
    const bleedW = drawW + 2 * drawBleed;
    const bleedH = drawH + 2 * drawBleed;
    const bleedRadius = isRounded ? Math.min(14, trimRadius + drawBleed) : 0;

    const safeMarginMm = Math.min(3, Math.min(safeW, safeH) * 0.15);
    const safeMarginPx = safeMarginMm * scale;
    const safeX = trimX + safeMarginPx;
    const safeY = trimY + safeMarginPx;
    const safeWidth = Math.max(2, drawW - 2 * safeMarginPx);
    const safeHeight = Math.max(2, drawH - 2 * safeMarginPx);
    const safeRadius = isRounded ? Math.max(0, trimRadius - safeMarginPx) : 0;

    const holeRadiusMm = effectiveHoleDiameter / 2;
    const holeRadiusPx = Math.max(3, holeRadiusMm * scale);
    const offsetPx = effectiveHoleOffset * scale;

    let hx = cx;
    let hy = trimY + offsetPx + holeRadiusPx;

    if (effectiveHolePos === "top-left") {
      hx = trimX + offsetPx + holeRadiusPx;
      hy = trimY + offsetPx + holeRadiusPx;
    } else if (effectiveHolePos === "top-right") {
      hx = trimX + drawW - offsetPx - holeRadiusPx;
      hy = trimY + offsetPx + holeRadiusPx;
    } else if (effectiveHolePos === "left-center") {
      hx = trimX + offsetPx + holeRadiusPx;
      hy = cy;
    } else if (effectiveHolePos === "right-center") {
      hx = trimX + drawW - offsetPx - holeRadiusPx;
      hy = cy;
    } else {
      hx = cx;
      hy = trimY + offsetPx + holeRadiusPx;
    }

    const topCalloutY = Math.max(16, bleedY - 12);
    const rightCalloutX = Math.min(cW - 16, bleedX + bleedW + 14);

    const gridPatternId = `cadGrid-${idSuffix}`;
    const arrowStartId = `arrowStart-${idSuffix}`;
    const arrowEndId = `arrowEnd-${idSuffix}`;

    return (
      <svg
        viewBox={`0 0 ${cW} ${cH}`}
        className="w-full h-full overflow-visible drop-shadow-sm select-none"
      >
        <defs>
          <pattern
            id={gridPatternId}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 14 0 L 0 0 0 14"
              fill="none"
              stroke="currentColor"
              className="text-zinc-200/50 dark:text-zinc-800/40"
              strokeWidth="0.5"
            />
          </pattern>
          <marker
            id={arrowStartId}
            viewBox="0 0 6 6"
            refX="1"
            refY="3"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 5 0 L 0 3 L 5 6 z" fill="currentColor" className="text-zinc-400 dark:text-zinc-500" />
          </marker>
          <marker
            id={arrowEndId}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M 0 0 L 5 3 L 0 6 z" fill="currentColor" className="text-zinc-400 dark:text-zinc-500" />
          </marker>
        </defs>

        <rect width={cW} height={cH} fill={`url(#${gridPatternId})`} />

        {safeBleed > 0 && (
          <rect
            x={bleedX}
            y={bleedY}
            width={bleedW}
            height={bleedH}
            rx={bleedRadius}
            ry={bleedRadius}
            fill="rgba(245, 158, 11, 0.05)"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />
        )}

        <rect
          x={trimX}
          y={trimY}
          width={drawW}
          height={drawH}
          rx={trimRadius}
          ry={trimRadius}
          fill="rgba(16, 185, 129, 0.08)"
          stroke="#10b981"
          strokeWidth="2"
        />

        {safeWidth > 10 && safeHeight > 10 && (
          <rect
            x={safeX}
            y={safeY}
            width={safeWidth}
            height={safeHeight}
            rx={safeRadius}
            ry={safeRadius}
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.85"
          />
        )}

        {hasHole && (
          <g>
            {/* Safety clearance ring (2.5mm around hole) */}
            <circle
              cx={hx}
              cy={hy}
              r={holeRadiusPx + 2.5 * scale}
              fill="rgba(16, 185, 129, 0.05)"
              stroke="#10b981"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.75"
            />
            {/* Cut circle */}
            <circle
              cx={hx}
              cy={hy}
              r={holeRadiusPx}
              fill="currentColor"
              className="text-zinc-50 dark:text-zinc-950"
              stroke="#10b981"
              strokeWidth="1.6"
            />
            {/* Crosshair horizontal */}
            <line
              x1={hx - holeRadiusPx - 2}
              y1={hy}
              x2={hx + holeRadiusPx + 2}
              y2={hy}
              stroke="#10b981"
              strokeWidth="0.8"
              strokeDasharray="1 1"
            />
            {/* Crosshair vertical */}
            <line
              x1={hx}
              y1={hy - holeRadiusPx - 2}
              x2={hx}
              y2={hy + holeRadiusPx + 2}
              stroke="#10b981"
              strokeWidth="0.8"
              strokeDasharray="1 1"
            />
            {/* Dimension tag */}
            <text
              x={hx}
              y={hy > cy ? hy + holeRadiusPx + 9 : hy - holeRadiusPx - 3.5}
              textAnchor="middle"
              className="text-[8px] font-mono font-bold fill-emerald-600 dark:fill-emerald-400 select-none"
            >
              Ø{effectiveHoleDiameter}mm
            </text>
          </g>
        )}

        {isFolded && (
          <g>
            <line
              x1={trimX}
              y1={cy}
              x2={trimX + drawW}
              y2={cy}
              stroke="#ec4899"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            <text
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              className="text-[8.5px] font-mono fill-pink-500 font-semibold"
            >
              FOLD / СГИБ
            </text>
          </g>
        )}

        <text
          x={cx}
          y={isHangtag ? cy + 8 : cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[11px] font-sans font-medium fill-zinc-400 dark:fill-zinc-500/80 select-none pointer-events-none"
        >
          {itemCategory || "Product"}
        </text>

        {/* Dimension: Width */}
        <g className="text-zinc-500 dark:text-zinc-400">
          <line
            x1={trimX}
            y1={topCalloutY}
            x2={trimX + drawW}
            y2={topCalloutY}
            stroke="currentColor"
            strokeWidth="0.9"
            markerStart={`url(#${arrowStartId})`}
            markerEnd={`url(#${arrowEndId})`}
          />
          <line
            x1={trimX}
            y1={topCalloutY - 3}
            x2={trimX}
            y2={trimY}
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="1 2"
            opacity="0.6"
          />
          <line
            x1={trimX + drawW}
            y1={topCalloutY - 3}
            x2={trimX + drawW}
            y2={trimY}
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="1 2"
            opacity="0.6"
          />
          <text
            x={cx}
            y={topCalloutY - 4}
            textAnchor="middle"
            className="text-[10.5px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300"
          >
            {safeW} {dimensionUnit}
          </text>
        </g>

        {/* Dimension: Height */}
        <g className="text-zinc-500 dark:text-zinc-400">
          <line
            x1={rightCalloutX}
            y1={trimY}
            x2={rightCalloutX}
            y2={trimY + drawH}
            stroke="currentColor"
            strokeWidth="0.9"
            markerStart={`url(#${arrowStartId})`}
            markerEnd={`url(#${arrowEndId})`}
          />
          <line
            x1={trimX + drawW}
            y1={trimY}
            x2={rightCalloutX + 3}
            y2={trimY}
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="1 2"
            opacity="0.6"
          />
          <line
            x1={trimX + drawW}
            y1={trimY + drawH}
            x2={rightCalloutX + 3}
            y2={trimY + drawH}
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="1 2"
            opacity="0.6"
          />
          <text
            x={rightCalloutX + 5}
            y={cy}
            textAnchor="middle"
            transform={`rotate(90, ${rightCalloutX + 5}, ${cy})`}
            className="text-[10.5px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300"
          >
            {safeH} {dimensionUnit}
          </text>
        </g>
      </svg>
    );
  };

  // Sheet Imposition Vector SVG Renderer
  const renderSheetCanvas = (
    cW: number,
    cH: number,
    idSuffix: string
  ) => {
    const padX = 28;
    const padY = 24;
    const availW = cW - padX * 2;
    const availH = cH - padY * 2;

    const scale = Math.min(availW / currentSheet.w, availH / currentSheet.h);
    const drawSheetW = currentSheet.w * scale;
    const drawSheetH = currentSheet.h * scale;

    const sx = (cW - drawSheetW) / 2;
    const sy = (cH - drawSheetH) / 2;

    const gripperPx = marginGripper * scale;
    const marginSidePx = marginSide * scale;
    const marginTopPx = marginTop * scale;

    const printableDrawW = drawSheetW - 2 * marginSidePx;
    const printableDrawH = drawSheetH - marginTopPx - gripperPx;

    const cellW_px = cellItemW * scale;
    const cellH_px = cellItemH * scale;
    const gutterPx = 2 * scale;

    // Centering the grid within the printable area
    const gridTotalW = cols * cellW_px + (cols - 1) * gutterPx;
    const gridTotalH = rows * cellH_px + (rows - 1) * gutterPx;
    const startX = sx + marginSidePx + Math.max(0, (printableDrawW - gridTotalW) / 2);
    const startY = sy + marginTopPx + Math.max(0, (printableDrawH - gridTotalH) / 2);

    const stripePatternId = `gripperStripe-${idSuffix}`;
    const arrowStartId = `sheetArrowStart-${idSuffix}`;
    const arrowEndId = `sheetArrowEnd-${idSuffix}`;

    return (
      <svg
        viewBox={`0 0 ${cW} ${cH}`}
        className="w-full h-full overflow-visible drop-shadow-sm select-none"
      >
        <defs>
          <pattern
            id={stripePatternId}
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" className="text-zinc-400 dark:text-zinc-600" strokeWidth="1.5" />
          </pattern>
          <marker
            id={arrowStartId}
            viewBox="0 0 6 6"
            refX="1"
            refY="3"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 5 0 L 0 3 L 5 6 z" fill="currentColor" className="text-zinc-400 dark:text-zinc-500" />
          </marker>
          <marker
            id={arrowEndId}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M 0 0 L 5 3 L 0 6 z" fill="currentColor" className="text-zinc-400 dark:text-zinc-500" />
          </marker>
        </defs>

        {/* Sheet Outline */}
        <rect
          x={sx}
          y={sy}
          width={drawSheetW}
          height={drawSheetH}
          stroke="currentColor"
          strokeWidth="1.5"
          className="fill-white dark:fill-zinc-900 text-zinc-300 dark:text-zinc-700"
          rx="2"
        />

        {/* Gripper Margin along bottom */}
        <rect
          x={sx}
          y={sy + drawSheetH - gripperPx}
          width={drawSheetW}
          height={gripperPx}
          fill={`url(#${stripePatternId})`}
          opacity="0.25"
        />
        <line
          x1={sx}
          y1={sy + drawSheetH - gripperPx}
          x2={sx + drawSheetW}
          y2={sy + drawSheetH - gripperPx}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <text
          x={sx + drawSheetW / 2}
          y={sy + drawSheetH - gripperPx / 2 + 3}
          textAnchor="middle"
          className="text-[8px] font-mono font-bold fill-red-500 tracking-wider"
        >
          GRIPPER 15mm / КЛАПАН
        </text>

        {/* Grid of Items */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const ix = startX + c * (cellW_px + gutterPx);
            const iy = startY + r * (cellH_px + gutterPx);
            const itemNumber = r * cols + c + 1;

            return (
              <g key={`item-${r}-${c}`}>
                <rect
                  x={ix}
                  y={iy}
                  width={cellW_px}
                  height={cellH_px}
                  rx="1"
                  fill="rgba(16, 185, 129, 0.12)"
                  stroke="#10b981"
                  strokeWidth="0.8"
                />
                {cellW_px > 14 && cellH_px > 12 && (
                  <text
                    x={ix + cellW_px / 2}
                    y={iy + cellH_px / 2 + 2.5}
                    textAnchor="middle"
                    className="text-[8px] font-mono font-semibold fill-emerald-700 dark:fill-emerald-300 pointer-events-none"
                  >
                    {itemNumber}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* Sheet Width Dimension (Top) */}
        <g className="text-zinc-400 dark:text-zinc-500">
          <line
            x1={sx}
            y1={sy - 7}
            x2={sx + drawSheetW}
            y2={sy - 7}
            stroke="currentColor"
            strokeWidth="0.8"
            markerStart={`url(#${arrowStartId})`}
            markerEnd={`url(#${arrowEndId})`}
          />
          <text
            x={sx + drawSheetW / 2}
            y={sy - 10}
            textAnchor="middle"
            className="text-[9.5px] font-mono font-bold fill-zinc-600 dark:fill-zinc-300"
          >
            {currentSheet.w} mm ({currentSheet.name.split(" ")[0]})
          </text>
        </g>

        {/* Sheet Height Dimension (Right) */}
        <g className="text-zinc-400 dark:text-zinc-500">
          <line
            x1={sx + drawSheetW + 8}
            y1={sy}
            x2={sx + drawSheetW + 8}
            y2={sy + drawSheetH}
            stroke="currentColor"
            strokeWidth="0.8"
            markerStart={`url(#${arrowStartId})`}
            markerEnd={`url(#${arrowEndId})`}
          />
          <text
            x={sx + drawSheetW + 10}
            y={sy + drawSheetH / 2}
            textAnchor="middle"
            transform={`rotate(90, ${sx + drawSheetW + 10}, ${sy + drawSheetH / 2})`}
            className="text-[9.5px] font-mono font-bold fill-zinc-600 dark:fill-zinc-300"
          >
            {currentSheet.h} mm
          </text>
        </g>
      </svg>
    );
  };

  return (
    <>
      <div
        className={cn(
          "p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3 flex flex-col justify-between select-none min-h-[380px]",
          className
        )}
      >
        {/* Top Inspector Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Ruler className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 shrink-0 whitespace-nowrap">
              {t("title")}
            </span>

            {/* View Mode Switcher: 1-Up Unit vs Sheet Yield */}
            <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0">
              <button
                type="button"
                onClick={() => handleViewModeChange("unit")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer flex items-center gap-1",
                  viewMode === "unit"
                    ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Ruler className="w-3 h-3" />
                <span>{t("unitView")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("yield")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer flex items-center gap-1",
                  viewMode === "yield"
                    ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid className="w-3 h-3" />
                <span>{t("yieldView")}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {viewMode === "yield" ? (
              <div className="flex items-center gap-1">
                {(["B1", "B2", "A1"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setSheetFormat(fmt)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-mono font-semibold rounded border transition-colors cursor-pointer",
                      sheetFormat === fmt
                        ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                        : "border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            ) : (
              onFlipOrientation && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={onFlipOrientation}
                        className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-foreground gap-1.5 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{t("flipOrientation")}</span>
                      </Button>
                    }
                  />
                  <TooltipContent side="top">
                    <span className="text-xs">{t("flipOrientation")}</span>
                  </TooltipContent>
                </Tooltip>
              )
            )}

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="h-6 w-6 p-0 text-zinc-600 dark:text-zinc-300 hover:text-foreground cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3 text-zinc-500" />
                  </Button>
                }
              />
              <TooltipContent side="top">
                <span className="text-xs">{t("fullscreen")}</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Center SVG Stage with Zoom & Pan */}
        <div
          ref={cardContainerRef}
          onMouseDown={handleCardMouseDown}
          onMouseMove={handleCardMouseMove}
          onMouseUp={handleCardMouseUp}
          onMouseLeave={handleCardMouseUp}
          onDoubleClick={handleCardDoubleClick}
          className={cn(
            "relative flex-1 flex items-center justify-center py-2.5 min-h-[260px] sm:min-h-[290px] w-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50 rounded-md border border-zinc-200/60 dark:border-zinc-800/80 select-none group",
            isCardDragging ? "cursor-grabbing" : cardZoom > 1 ? "cursor-grab" : "cursor-crosshair"
          )}
        >
          {/* Mini Hint Badge */}
          <div className="absolute top-2 left-2 z-10 pointer-events-none opacity-0 group-hover:opacity-85 transition-opacity duration-200">
            <span className="text-[9.5px] font-mono text-zinc-500 dark:text-zinc-400 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xs px-1.5 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 shadow-2xs">
              {t("zoomHint")}
            </span>
          </div>

          {/* Floating Zoom & Pan Controls Overlay */}
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-0.5 p-0.5 rounded-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
              }}
              disabled={cardZoom <= 0.5}
              className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title={t("zoomOut")}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardZoom(1);
                setCardPan({ x: 0, y: 0 });
              }}
              className="px-1.5 h-6 rounded font-mono text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              title={t("resetZoom")}
            >
              {Math.round(cardZoom * 100)}%
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))));
              }}
              disabled={cardZoom >= 4}
              className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title={t("zoomIn")}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {(cardZoom !== 1 || cardPan.x !== 0 || cardPan.y !== 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCardZoom(1);
                  setCardPan({ x: 0, y: 0 });
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                title={t("resetZoom")}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <div
            className="w-full max-w-[420px] h-[255px] sm:h-[285px] transition-transform duration-75 origin-center will-change-transform"
            style={{
              transform: `translate(${cardPan.x}px, ${cardPan.y}px) scale(${cardZoom})`,
            }}
          >
            {viewMode === "unit"
              ? renderSvgCanvas(380, 260, 260, 180, "inCard")
              : renderSheetCanvas(380, 260, "inCardSheet")}
          </div>
        </div>

        {/* Preflight Sanity Warnings Bar */}
        {warnings.length > 0 && (
          <div className="space-y-1 pt-1">
            {warnings.map((w) => (
              <div
                key={w.id}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border font-medium",
                  w.severity === "amber"
                    ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60"
                    : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{w.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Legend & Area Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 text-[10.5px]">
          {viewMode === "unit" ? (
            <>
              {/* Color Legend */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <span className="w-2.5 h-0.5 bg-emerald-500 rounded-full inline-block" />
                  <span>{t("trimLine")}</span>
                </div>

                {safeBleed > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span className="w-2.5 h-0.5 border-b border-dashed border-amber-500 inline-block" />
                    <span>{t("bleedLine", { bleed: safeBleed })}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <span className="w-2 h-0.5 border-b border-dotted border-sky-500 inline-block" />
                  <span>{t("safeZone")}</span>
                </div>

                {hasHole && (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full border border-emerald-500 inline-block" />
                    <span>Ø{effectiveHoleDiameter}mm ({effectiveHolePos})</span>
                  </div>
                )}

                {isFolded && (
                  <div className="flex items-center gap-1 text-pink-600 dark:text-pink-400">
                    <span className="w-2.5 h-0.5 border-b border-dashed border-pink-500 inline-block" />
                    <span>{t("foldLine")}</span>
                  </div>
                )}
              </div>

              {/* Net Area calculation */}
              <div className="font-mono text-muted-foreground shrink-0 font-medium text-[11px]">
                {t("area")}: <span className="font-semibold text-foreground">{netAreaCm2} cm²</span>
              </div>
            </>
          ) : (
            <>
              {/* Sheet Yield Stats */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400">
                  ⚡ {t("yieldResult", { count: yieldCount })}
                </Badge>
                <span className="text-zinc-500 font-mono text-[11px]">
                  {t("utilization")}: <strong className="text-foreground">{utilizationPct}%</strong>
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="text-zinc-500 font-mono text-[11px]">
                  {t("grossSheets")}: <strong className="text-foreground">{grossSheets.toLocaleString()} sht</strong>
                </span>
              </div>

              {onOpenLayoutTab && (
                <button
                  type="button"
                  onClick={onOpenLayoutTab}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer text-[11px]"
                >
                  <span>{t("openLayout")}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fullscreen HD Modal Inspector */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-4xl p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3 pr-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <DialogTitle className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {t("title")}
                </DialogTitle>
                <div className="inline-flex items-center p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("unit")}
                    className={cn(
                      "px-2.5 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1",
                      viewMode === "unit"
                        ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>{t("unitView")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("yield")}
                    className={cn(
                      "px-2.5 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1",
                      viewMode === "yield"
                        ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>{t("yieldView")}</span>
                  </button>
                </div>
              </div>

              {viewMode === "yield" ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">{t("parentSheet")}:</span>
                  {(["B1", "B2", "A1"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSheetFormat(fmt)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-mono font-semibold rounded border transition-colors cursor-pointer",
                        sheetFormat === fmt
                          ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                          : "border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              ) : (
                onFlipOrientation && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={onFlipOrientation}
                    className="h-7 px-2.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-foreground gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{t("flipOrientation")}</span>
                  </Button>
                )
              )}
            </div>
          </DialogHeader>

          {/* Large HD Canvas in Modal with Zoom & Pan */}
          <div
            ref={modalContainerRef}
            onMouseDown={handleModalMouseDown}
            onMouseMove={handleModalMouseMove}
            onMouseUp={handleModalMouseUp}
            onMouseLeave={handleModalMouseUp}
            onDoubleClick={handleModalDoubleClick}
            className={cn(
              "relative flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950/70 rounded-lg border border-zinc-200 dark:border-zinc-800 min-h-[380px] sm:min-h-[460px] overflow-hidden select-none group",
              isModalDragging ? "cursor-grabbing" : modalZoom > 1 ? "cursor-grab" : "cursor-crosshair"
            )}
          >
            {/* Mini Hint Badge */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none opacity-0 group-hover:opacity-85 transition-opacity duration-200">
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xs px-2 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 shadow-2xs">
                {t("zoomHint")}
              </span>
            </div>

            {/* Floating Zoom & Pan Controls in Modal */}
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 p-1 rounded-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
                }}
                disabled={modalZoom <= 0.5}
                className="w-7 h-7 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title={t("zoomOut")}
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalZoom(1);
                  setModalPan({ x: 0, y: 0 });
                }}
                className="px-2 h-7 rounded font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                title={t("resetZoom")}
              >
                {Math.round(modalZoom * 100)}%
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))));
                }}
                disabled={modalZoom >= 5}
                className="w-7 h-7 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title={t("zoomIn")}
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {(modalZoom !== 1 || modalPan.x !== 0 || modalPan.y !== 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalZoom(1);
                    setModalPan({ x: 0, y: 0 });
                  }}
                  className="w-7 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  title={t("resetZoom")}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div
              className="w-full max-w-[640px] h-[360px] sm:h-[440px] transition-transform duration-75 origin-center will-change-transform"
              style={{
                transform: `translate(${modalPan.x}px, ${modalPan.y}px) scale(${modalZoom})`,
              }}
            >
              {viewMode === "unit"
                ? renderSvgCanvas(640, 440, 460, 320, "modal")
                : renderSheetCanvas(640, 440, "modalSheet")}
            </div>
          </div>

          {/* Modal Legend / Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            {viewMode === "unit" ? (
              <>
                <div className="flex items-center gap-3.5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" />
                    <span>{t("trimLine")}</span>
                  </div>

                  {safeBleed > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <span className="w-3 h-0.5 border-b border-dashed border-amber-500 inline-block" />
                      <span>{t("bleedLine", { bleed: safeBleed })}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                    <span className="w-3 h-0.5 border-b border-dotted border-sky-500 inline-block" />
                    <span>{t("safeZone")}</span>
                  </div>

                  {hasHole && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full border border-emerald-500 inline-block" />
                      <span>Ø{effectiveHoleDiameter}mm ({effectiveHolePos})</span>
                    </div>
                  )}

                  {isFolded && (
                    <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
                      <span className="w-3 h-0.5 border-b border-dashed border-pink-500 inline-block" />
                      <span>{t("foldLine")}</span>
                    </div>
                  )}
                </div>

                <div className="font-mono text-muted-foreground shrink-0 font-medium text-xs">
                  {t("area")}: <span className="font-bold text-foreground">{netAreaCm2} cm²</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400">
                    ⚡ {t("yieldResult", { count: yieldCount })} ({isRotated ? "Rotated 90°" : "Standard"})
                  </Badge>
                  <span className="text-zinc-600 dark:text-zinc-400 font-mono">
                    {t("utilization")}: <strong className="text-foreground">{utilizationPct}%</strong>
                  </span>
                  <span>•</span>
                  <span className="text-zinc-600 dark:text-zinc-400 font-mono">
                    {t("grossSheets")}: <strong className="text-foreground">{grossSheets.toLocaleString()} sheets</strong>
                  </span>
                </div>

                {onOpenLayoutTab && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      onOpenLayoutTab();
                    }}
                    className="h-7 text-xs gap-1.5 text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <span>{t("openLayout")}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
