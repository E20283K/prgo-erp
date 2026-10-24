"use client";

import React, { useMemo, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeftRight,
  Download,
  Ruler,
  AlertTriangle,
  Box,
  Layers,
  UploadCloud,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import {
  extractPdfPagesToImages,
  readFileAsDataUrl,
  getImageDimensions,
  generateSampleRedFlagArtwork,
} from "./utils/artworkExtractor";
import {
  ProductShapeType,
  ProductFoldType,
  ProductBoxType,
  ProductCustomShape,
} from "./types";
import { parseSvgContour, offsetPolygon, polygonToPathD } from "./utils/svgContour";

interface DieLinePreviewProps {
  width: number;
  height: number;
  bleed: number;
  dimensionUnit?: string;
  cornerType?: string;
  itemCategory?: string;
  shapeType?: ProductShapeType;
  foldType?: ProductFoldType;
  boxType?: ProductBoxType;
  boxDepth?: number;
  customShape?: ProductCustomShape;
  customSvgPath?: string;
  totalQuantity?: number;
  paperStock?: string;
  holeSize?: number;
  holePosition?: "top-center" | "top-left" | "top-right" | "left-center" | "right-center" | "both-sides-fold" | "none";
  holeOffset?: number;
  artworkFront?: string;
  artworkBack?: string;
  artworkBleedIncluded?: boolean;
  artworkDielineOpacity?: number;
  onArtworkChange?: (
    front: string, 
    back?: string, 
    sourcePdfName?: string, 
    detectedW?: number, 
    detectedH?: number,
    rawFile?: File
  ) => void;
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
  shapeType = "rectangle",
  foldType = "half_vertical",
  boxType = "tuck_end",
  boxDepth = 40,
  customShape = "arch",
  customSvgPath = "",
  totalQuantity = 5000,
  paperStock = "Galerie Art Silk 150g/m²",
  holeSize,
  holePosition,
  holeOffset,
  artworkFront,
  artworkBack,
  artworkBleedIncluded = true,
  artworkDielineOpacity = 0.85,
  onArtworkChange,
  onFlipOrientation,
  onOpenLayoutTab,
  className,
}: DieLinePreviewProps) {
  const t = useTranslations("DieLine");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"proof" | "front" | "back" | "cad">(
    artworkFront ? "proof" : "cad"
  );
  const [showDielineOverlay, setShowDielineOverlay] = useState<boolean>(true);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      if (isPdf) {
        const extracted = await extractPdfPagesToImages(file, { scale: 2.8, maxPages: 2, autoTrim: true });
        if (onArtworkChange) {
          onArtworkChange(
            extracted.front,
            extracted.back,
            file.name,
            extracted.detectedWidthMm,
            extracted.detectedHeightMm,
            file
          );
        }
        setViewMode("proof");
      } else {
        const imgInfo = await getImageDimensions(file);
        if (onArtworkChange) {
          if (viewMode === "back") {
            onArtworkChange(
              artworkFront || imgInfo.dataUrl,
              imgInfo.dataUrl,
              file.name,
              imgInfo.widthMm,
              imgInfo.heightMm,
              file
            );
          } else {
            onArtworkChange(
              imgInfo.dataUrl,
              artworkBack,
              file.name,
              imgInfo.widthMm,
              imgInfo.heightMm,
              file
            );
          }
        }
        setViewMode(viewMode === "back" ? "back" : "front");
      }
    } catch (err) {
      console.error("Artwork extraction error:", err);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLoadSample = () => {
    const sample = generateSampleRedFlagArtwork();
    if (onArtworkChange) {
      onArtworkChange(sample.front, sample.back, "red_flag_sample.pdf");
    }
    setViewMode("proof");
  };

  const safeW = Math.max(5, Number(width) || 50);
  const safeH = Math.max(5, Number(height) || 90);
  const safeBleed = Math.max(0, Number(bleed) || 0);
  const safeD = Math.max(10, Number(boxDepth) || 40);

  // Finishing feature flags
  const isRounded =
    cornerType?.toLowerCase().includes("round") ||
    cornerType?.toLowerCase().includes("radius");
  const isHangtag =
    itemCategory?.toLowerCase().includes("hangtag") ||
    cornerType?.toLowerCase().includes("eyelet") ||
    cornerType?.toLowerCase().includes("hole");

  // Effective shape resolution
  const resolvedShape: ProductShapeType = useMemo(() => {
    if (shapeType) return shapeType;
    if (itemCategory?.toLowerCase().includes("carton")) return "carton_box";
    if (itemCategory?.toLowerCase().includes("fold") || itemCategory?.toLowerCase().includes("flyer")) return "folded";
    return "rectangle";
  }, [shapeType, itemCategory]);

  const isFolded = resolvedShape === "folded";
  const isBox = resolvedShape === "carton_box";
  const isCircle = resolvedShape === "circle";
  const isOval = resolvedShape === "oval";
  const isCustom = resolvedShape === "custom_die";

  const hasHole =
    (holeSize !== undefined ? holeSize > 0 : isHangtag) && holePosition !== "none" && !isBox;
  const effectiveHoleDiameter = holeSize !== undefined ? holeSize : 4;
  const effectiveHolePos = holePosition || "top-center";
  const effectiveHoleOffset = holeOffset !== undefined ? holeOffset : 6;

  // Net Area calculation in cm²
  const netAreaCm2 = useMemo(() => {
    if (isCircle) {
      const r = safeW / 2;
      return ((Math.PI * r * r) / 100).toFixed(1);
    }
    if (isOval) {
      const rx = safeW / 2;
      const ry = safeH / 2;
      return ((Math.PI * rx * ry) / 100).toFixed(1);
    }
    if (isBox) {
      const totalW = (safeW * 2) + (safeD * 2) + 15;
      const totalH = safeH + (safeD * 2) + 24;
      return ((totalW * totalH) / 100).toFixed(1);
    }
    if (isCustom && customShape === "arch") {
      const r = safeW / 2;
      const rectH = Math.max(0, safeH - r);
      const area = (safeW * rectH) + (Math.PI * r * r / 2);
      return (area / 100).toFixed(1);
    }
    if (isCustom && customShape === "hexagon") {
      const s = safeW / 2;
      const area = ((3 * Math.sqrt(3)) / 2) * s * s;
      return (area / 100).toFixed(1);
    }
    return ((safeW * safeH) / 100).toFixed(1);
  }, [isCircle, isOval, isBox, isCustom, customShape, safeW, safeH, safeD]);

  // Parse Custom SVG contour if present
  const parsedSvg = useMemo(() => {
    if (resolvedShape === "custom_die" && customShape === "vector_svg" && customSvgPath) {
      return parseSvgContour(customSvgPath);
    }
    return null;
  }, [resolvedShape, customShape, customSvgPath]);

  // Preflight Sanity Warnings
  const warnings = useMemo(() => {
    const list: { id: string; text: string; severity: "amber" | "blue" }[] = [];
    if (safeBleed === 0 && !isBox) {
      list.push({ id: "zeroBleed", text: t("zeroBleedWarn"), severity: "amber" });
    }
    if ((safeW < 25 || safeH < 25) && !isBox) {
      list.push({ id: "narrowMargin", text: t("narrowMarginWarn"), severity: "amber" });
    }
    const isHeavy =
      /(3\d\d|4\d\d|5\d\d|6\d\d)\s*g/i.test(paperStock || "") ||
      /(board|cardboard|heavy|кашировка|дуплекс)/i.test(paperStock || "");
    if ((isFolded || isBox) && isHeavy) {
      list.push({ id: "heavyFold", text: t("heavyFoldWarn"), severity: "blue" });
    }
    return list;
  }, [safeBleed, safeW, safeH, isFolded, isBox, paperStock, t]);

  // Vector SVG Renderer

  // ── ARTWORK PROOF VIEW: FRONT & BACK SIDE-BY-SIDE (Exact Reference Image Match) ──
  const renderArtworkProofSvg = (cW: number, cH: number) => {
    // 2 cards side by side
    const cardGap = 28;
    const availableW = cW - 40;
    const maxCardW = (availableW - cardGap) / 2;
    const maxCardH = cH - 52; // leave room for top dimension line & bottom labels

    const aspect = safeW / safeH;
    let cardW = maxCardW;
    let cardH = cardW / aspect;

    if (cardH > maxCardH) {
      cardH = maxCardH;
      cardW = cardH * aspect;
    }

    const startY = 24;
    const totalGroupW = cardW * 2 + cardGap;
    const leftX = (cW - totalGroupW) / 2;
    const rightX = leftX + cardW + cardGap;

    const cornerRadius = isRounded ? Math.min(10, cardW * 0.18) : 0;
    const chamferCut = cornerType?.toLowerCase().includes("chamfer") ? Math.min(12, cardW * 0.2) : 0;

    const holeRelX = 0.5;
    const holeRadius = Math.max(3.5, (effectiveHoleDiameter / safeH) * cardH * 0.5);
    const holeDistance = Math.max(8, (effectiveHoleOffset / safeH) * cardH);

    const leftHoleCx = leftX + cardW * holeRelX;
    const leftHoleCy = startY + holeDistance;
    const rightHoleCx = rightX + cardW * holeRelX;
    const rightHoleCy = startY + holeDistance;

    const frontImg = artworkFront || "";
    const backImg = artworkBack || artworkFront || "";

    // Tag clip path D
    const getTagPathD = (x: number, y: number, w: number, h: number) => {
      if (chamferCut > 0) {
        return `M ${x + chamferCut} ${y} L ${x + w - chamferCut} ${y} L ${x + w} ${y + chamferCut} L ${x + w} ${y + h - cornerRadius} Q ${x + w} ${y + h} ${x + w - cornerRadius} ${y + h} L ${x + cornerRadius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - cornerRadius} L ${x} ${y + chamferCut} Z`;
      }
      if (cornerRadius > 0) {
        return `M ${x + cornerRadius} ${y} L ${x + w - cornerRadius} ${y} Q ${x + w} ${y} ${x + w} ${y + cornerRadius} L ${x + w} ${y + h - cornerRadius} Q ${x + w} ${y + h} ${x + w - cornerRadius} ${y + h} L ${x + cornerRadius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - cornerRadius} L ${x} ${y + cornerRadius} Q ${x} ${y} ${x + cornerRadius} ${y} Z`;
      }
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    };

    const frontClipId = "front-proof-clip";
    const backClipId = "back-proof-clip";

    return (
      <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-full overflow-visible select-none drop-shadow-sm">
        <defs>
          <clipPath id={frontClipId}>
            <path d={getTagPathD(leftX, startY, cardW, cardH)} />
          </clipPath>
          <clipPath id={backClipId}>
            <path d={getTagPathD(rightX, startY, cardW, cardH)} />
          </clipPath>
          <filter id="card-shadow" x="-8%" y="-8%" width="116%" height="116%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* ── 1. FRONT TAG (Left) ── */}
        <g>
          {/* Base card background with drop-shadow */}
          <rect
            x={leftX}
            y={startY}
            width={cardW}
            height={cardH}
            rx={cornerRadius}
            fill="#ffffff"
            stroke="#e4e4e7"
            strokeWidth="0.5"
            filter="url(#card-shadow)"
          />
          {/* Real Artwork Image (fills card naturally) */}
          {frontImg ? (
            <image
              href={frontImg}
              x={leftX}
              y={startY}
              width={cardW}
              height={cardH}
              preserveAspectRatio="xMidYMid slice"
              clipPath={cornerRadius > 0 || chamferCut > 0 ? `url(#${frontClipId})` : undefined}
            />
          ) : (
            <g>
              <rect x={leftX} y={startY} width={cardW} height={cardH} rx={cornerRadius} fill="#f4f4f5" />
              <text x={leftX + cardW / 2} y={startY + cardH / 2} textAnchor="middle" fontSize="9" fill="#a1a1aa" fontFamily="monospace">
                Old tomon (Bo&apos;sh)
              </text>
            </g>
          )}
        </g>

        {/* Front Dieline Overlay & Hole Punch */}
        {showDielineOverlay && (
          <path
            d={getTagPathD(leftX, startY, cardW, cardH)}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.2"
            strokeDasharray={cornerType?.toLowerCase().includes("chamfer") ? "none" : "3 1.5"}
            opacity={artworkDielineOpacity}
          />
        )}
        {showDielineOverlay && hasHole && holeSize && holeSize > 0 && (
          <g>
            <circle cx={leftHoleCx} cy={leftHoleCy} r={holeRadius} fill="#ffffff" stroke="#18181b" strokeWidth="1" />
            <circle cx={leftHoleCx} cy={leftHoleCy} r={holeRadius + 1.2} fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
          </g>
        )}

        {/* Dimension callout for Hole Offset (shows when overlay is ON) */}
        {showDielineOverlay && hasHole && holeSize && holeSize > 0 && (
          <g className="text-rose-500">
            {/* Guide line from top cut edge */}
            <line x1={leftHoleCx + holeRadius + 4} y1={startY} x2={leftX + cardW + 12} y2={startY} stroke="#ef4444" strokeWidth="0.75" strokeDasharray="2 2" />
            {/* Guide line from hole center */}
            <line x1={leftHoleCx + holeRadius + 4} y1={leftHoleCy} x2={leftX + cardW + 12} y2={leftHoleCy} stroke="#ef4444" strokeWidth="0.75" strokeDasharray="2 2" />
            {/* Dimension line with arrows */}
            <line x1={leftX + cardW + 10} y1={startY} x2={leftX + cardW + 10} y2={leftHoleCy} stroke="#ef4444" strokeWidth="0.9" />
            <polygon points={`${leftX + cardW + 8.5},${startY + 2.5} ${leftX + cardW + 11.5},${startY + 2.5} ${leftX + cardW + 10},${startY}`} fill="#ef4444" />
            <polygon points={`${leftX + cardW + 8.5},${leftHoleCy - 2.5} ${leftX + cardW + 11.5},${leftHoleCy - 2.5} ${leftX + cardW + 10},${leftHoleCy}`} fill="#ef4444" />
            {/* Dimension Text */}
            <text x={leftX + cardW + 15} y={startY + (leftHoleCy - startY) / 2 + 3} fontFamily="sans-serif" fontSize="8.5" fontWeight="bold" fill="#ef4444">
              {effectiveHoleOffset || 5.5} {dimensionUnit || "mm"}
            </text>
          </g>
        )}

        {/* Front Bottom Caption */}
        <g transform={`translate(${leftX + cardW / 2}, ${startY + cardH + 16})`}>
          <text textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="currentColor" className="fill-foreground">
            front
          </text>
          <text y="11" textAnchor="middle" fontFamily="sans-serif" fontSize="8.5" fontWeight="500" fill="currentColor" className="fill-muted-foreground">
            передняя часть
          </text>
        </g>

        {/* ── 2. BACK TAG (Right) ── */}
        <g>
          {/* Base card background with drop-shadow */}
          <rect
            x={rightX}
            y={startY}
            width={cardW}
            height={cardH}
            rx={cornerRadius}
            fill="#ffffff"
            stroke="#e4e4e7"
            strokeWidth="0.5"
            filter="url(#card-shadow)"
          />
          {/* Real Artwork Image */}
          {backImg ? (
            <image
              href={backImg}
              x={rightX}
              y={startY}
              width={cardW}
              height={cardH}
              preserveAspectRatio="xMidYMid slice"
              clipPath={cornerRadius > 0 || chamferCut > 0 ? `url(#${backClipId})` : undefined}
            />
          ) : (
            <g>
              <rect x={rightX} y={startY} width={cardW} height={cardH} rx={cornerRadius} fill="#f4f4f5" />
              <text x={rightX + cardW / 2} y={startY + cardH / 2} textAnchor="middle" fontSize="9" fill="#a1a1aa" fontFamily="monospace">
                Orqa tomon (Bo&apos;sh)
              </text>
            </g>
          )}
        </g>

        {/* Back Dieline Overlay & Hole Punch */}
        {showDielineOverlay && (
          <path
            d={getTagPathD(rightX, startY, cardW, cardH)}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.2"
            strokeDasharray={cornerType?.toLowerCase().includes("chamfer") ? "none" : "3 1.5"}
            opacity={artworkDielineOpacity}
          />
        )}
        {showDielineOverlay && hasHole && holeSize && holeSize > 0 && (
          <g>
            <circle cx={rightHoleCx} cy={rightHoleCy} r={holeRadius} fill="#ffffff" stroke="#18181b" strokeWidth="1" />
            <circle cx={rightHoleCx} cy={rightHoleCy} r={holeRadius + 1.2} fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
          </g>
        )}

        {/* Back Bottom Caption */}
        <g transform={`translate(${rightX + cardW / 2}, ${startY + cardH + 16})`}>
          <text textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="currentColor" className="fill-foreground">
            back
          </text>
          <text y="11" textAnchor="middle" fontFamily="sans-serif" fontSize="8.5" fontWeight="500" fill="currentColor" className="fill-muted-foreground">
            задняя часть
          </text>
        </g>
      </svg>
    );
  };

  // ── SINGLE ARTWORK VIEW (Large Front or Back with full CAD measurements) ──
  const renderSingleArtworkSvg = (side: "front" | "back", cW: number, cH: number) => {
    const imgUrl = side === "back" ? (artworkBack || "") : (artworkFront || "");
    const aspect = safeW / safeH;
    const maxW = cW - 70;
    const maxH = cH - 44;

    let cardW = maxW;
    let cardH = cardW / aspect;
    if (cardH > maxH) {
      cardH = maxH;
      cardW = cardH * aspect;
    }

    const tX = (cW - cardW) / 2;
    const tY = (cH - cardH) / 2;
    const cornerRadius = isRounded ? Math.min(14, cardW * 0.18) : 0;
    const clipId = `single-artwork-${side}-clip`;

    const holeRelX = 0.5;
    const holeRadius = Math.max(3.5, (effectiveHoleDiameter / safeH) * cardH * 0.5);
    const holeDistance = Math.max(8, (effectiveHoleOffset / safeH) * cardH);
    const holeCx = tX + cardW * holeRelX;
    const holeCy = tY + holeDistance;

    return (
      <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-full overflow-visible select-none drop-shadow-sm">
        <defs>
          <clipPath id={clipId}>
            <rect x={tX} y={tY} width={cardW} height={cardH} rx={cornerRadius} />
          </clipPath>
        </defs>

        {/* Artwork Image */}
        {imgUrl ? (
          <image
            href={imgUrl}
            x={tX}
            y={tY}
            width={cardW}
            height={cardH}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        ) : (
          <g>
            <rect x={tX} y={tY} width={cardW} height={cardH} rx={cornerRadius} fill="#f4f4f5" stroke="#e4e4e7" strokeWidth="0.8" />
            <text x={tX + cardW / 2} y={tY + cardH / 2} textAnchor="middle" fontSize="10" fill="#a1a1aa" fontFamily="monospace">
              {side === "front" ? "Old tomon (Fayl yuklanmagan)" : "Orqa tomon (Fayl yuklanmagan)"}
            </text>
          </g>
        )}

        {/* Die-line overlay if toggled */}
        {showDielineOverlay && (
          <rect
            x={tX}
            y={tY}
            width={cardW}
            height={cardH}
            rx={cornerRadius}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.6"
            strokeDasharray="4 2"
            opacity={artworkDielineOpacity}
          />
        )}

        {/* Drill hole */}
        {hasHole && (
          <g>
            <circle cx={holeCx} cy={holeCy} r={holeRadius} fill="#ffffff" stroke="#09090b" strokeWidth="1" />
            <circle cx={holeCx} cy={holeCy} r={holeRadius + 1.5} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2 1.5" />
          </g>
        )}

        {/* Dimensions callouts */}
        <g className="text-zinc-500 dark:text-zinc-400">
          <text x={tX + cardW / 2} y={tY - 6} textAnchor="middle" className="text-[10px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">
            {safeW} {dimensionUnit || "mm"}
          </text>
          <text x={tX + cardW + 12} y={tY + cardH / 2} textAnchor="middle" transform={`rotate(90, ${tX + cardW + 12}, ${tY + cardH / 2})`} className="text-[10px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">
            {safeH} {dimensionUnit || "mm"}
          </text>
          <text x={tX + cardW / 2} y={tY + cardH + 16} textAnchor="middle" className="text-[10px] font-mono font-semibold uppercase fill-primary">
            {side === "front" ? "Old tomon (Front)" : "Orqa tomon (Back)"}
          </text>
        </g>
      </svg>
    );
  };

  const renderSvgCanvas = (
    cW: number,
    cH: number,
    boxW: number,
    boxH: number,
    idSuffix: string
  ) => {
    const cx = cW / 2;
    const cy = cH / 2;

    const gridPatternId = `cadGrid-${idSuffix}`;
    const arrowStartId = `arrowStart-${idSuffix}`;
    const arrowEndId = `arrowEnd-${idSuffix}`;

    // Common SVG Defs
    const svgDefs = (
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
    );

    // ── CASE 1: CARTON BOX DIELINE NET (Unfolded CAD Packaging) ──
    if (isBox) {
      const glueTabMm = Math.max(8, Math.min(15, safeD * 0.35));
      const tuckLipMm = Math.max(7, Math.min(14, safeD * 0.28));
      const flapDepthMm = safeD * 0.85;

      const totalNetW = glueTabMm + (safeW * 2) + (safeD * 2);
      const totalNetH = safeH + ((flapDepthMm + tuckLipMm) * 2);

      const bScale = Math.min(boxW / totalNetW, boxH / totalNetH);

      const netW = totalNetW * bScale;
      const netH = totalNetH * bScale;
      const startX = cx - netW / 2;
      const startY = cy - netH / 2;

      const gPx = glueTabMm * bScale;
      const wPx = safeW * bScale;
      const dPx = safeD * bScale;
      const hPx = safeH * bScale;
      const flapPx = flapDepthMm * bScale;
      const tuckPx = tuckLipMm * bScale;

      const yBodyTop = startY + flapPx + tuckPx;
      const yBodyBottom = yBodyTop + hPx;

      const xGlue = startX;
      const xP1 = xGlue + gPx;          // Front
      const xS1 = xP1 + wPx;            // Side 1
      const xP2 = xS1 + dPx;            // Back
      const xS2 = xP2 + wPx;            // Side 2
      const xEnd = xS2 + dPx;

      return (
        <svg
          viewBox={`0 0 ${cW} ${cH}`}
          className="w-full h-full overflow-visible drop-shadow-sm select-none"
        >
          {svgDefs}
          <rect width={cW} height={cH} fill={`url(#${gridPatternId})`} />

          {/* Main 4 Body Panels + Glue Tab Fill */}
          <rect x={xGlue} y={yBodyTop} width={gPx} height={hPx} fill="rgba(16, 185, 129, 0.04)" />
          <rect x={xP1} y={yBodyTop} width={wPx} height={hPx} fill="rgba(16, 185, 129, 0.08)" />
          <rect x={xS1} y={yBodyTop} width={dPx} height={hPx} fill="rgba(16, 185, 129, 0.05)" />
          <rect x={xP2} y={yBodyTop} width={wPx} height={hPx} fill="rgba(16, 185, 129, 0.08)" />
          <rect x={xS2} y={yBodyTop} width={dPx} height={hPx} fill="rgba(16, 185, 129, 0.05)" />

          {/* Top Flaps Fills */}
          {/* Top Tuck Flap on Back panel (xP2) */}
          <rect x={xP2} y={yBodyTop - flapPx - tuckPx} width={wPx} height={flapPx + tuckPx} rx={4} fill="rgba(16, 185, 129, 0.06)" />
          {/* Top Dust Flaps on Side 1 & 2 */}
          <polygon points={`${xS1},${yBodyTop} ${xS1 + 3},${yBodyTop - flapPx} ${xS1 + dPx - 3},${yBodyTop - flapPx} ${xS1 + dPx},${yBodyTop}`} fill="rgba(16, 185, 129, 0.04)" />
          <polygon points={`${xS2},${yBodyTop} ${xS2 + 3},${yBodyTop - flapPx} ${xS2 + dPx - 3},${yBodyTop - flapPx} ${xS2 + dPx},${yBodyTop}`} fill="rgba(16, 185, 129, 0.04)" />

          {/* Bottom Flaps Fills */}
          {/* Bottom Tuck Flap on Front panel (xP1) */}
          <rect x={xP1} y={yBodyBottom} width={wPx} height={flapPx + tuckPx} rx={4} fill="rgba(16, 185, 129, 0.06)" />
          {/* Bottom Dust Flaps on Side 1 & 2 */}
          <polygon points={`${xS1},${yBodyBottom} ${xS1 + 3},${yBodyBottom + flapPx} ${xS1 + dPx - 3},${yBodyBottom + flapPx} ${xS1 + dPx},${yBodyBottom}`} fill="rgba(16, 185, 129, 0.04)" />
          <polygon points={`${xS2},${yBodyBottom} ${xS2 + 3},${yBodyBottom + flapPx} ${xS2 + dPx - 3},${yBodyBottom + flapPx} ${xS2 + dPx},${yBodyBottom}`} fill="rgba(16, 185, 129, 0.04)" />

          {/* CUT LINES (Green Solid #10b981) */}
          <g stroke="#10b981" strokeWidth="1.6" fill="none">
            {/* Outer box body boundary */}
            <line x1={xGlue} y1={yBodyTop + 5} x2={xGlue} y2={yBodyBottom - 5} />
            <line x1={xGlue} y1={yBodyTop + 5} x2={xP1} y2={yBodyTop} />
            <line x1={xGlue} y1={yBodyBottom - 5} x2={xP1} y2={yBodyBottom} />

            {/* Top Cut Profile */}
            <polyline points={`${xP1},${yBodyTop} ${xS1},${yBodyTop} ${xS1 + 3},${yBodyTop - flapPx} ${xS1 + dPx - 3},${yBodyTop - flapPx} ${xP2},${yBodyTop}`} />
            <path d={`M ${xP2} ${yBodyTop} L ${xP2} ${yBodyTop - flapPx - tuckPx + 4} Q ${xP2} ${yBodyTop - flapPx - tuckPx} ${xP2 + 4} ${yBodyTop - flapPx - tuckPx} L ${xP2 + wPx - 4} ${yBodyTop - flapPx - tuckPx} Q ${xP2 + wPx} ${yBodyTop - flapPx - tuckPx} ${xP2 + wPx} ${yBodyTop - flapPx - tuckPx + 4} L ${xP2 + wPx} ${yBodyTop}`} />
            <polyline points={`${xP2 + wPx},${yBodyTop} ${xS2 + 3},${yBodyTop - flapPx} ${xS2 + dPx - 3},${yBodyTop - flapPx} ${xEnd},${yBodyTop} ${xEnd},${yBodyBottom}`} />

            {/* Bottom Cut Profile */}
            <path d={`M ${xP1} ${yBodyBottom} L ${xP1} ${yBodyBottom + flapPx + tuckPx - 4} Q ${xP1} ${yBodyBottom + flapPx + tuckPx} ${xP1 + 4} ${yBodyBottom + flapPx + tuckPx} L ${xP1 + wPx - 4} ${yBodyBottom + flapPx + tuckPx} Q ${xP1 + wPx} ${yBodyBottom + flapPx + tuckPx} ${xP1 + wPx} ${yBodyBottom + flapPx + tuckPx - 4} L ${xP1 + wPx} ${yBodyBottom}`} />
            <polyline points={`${xP1 + wPx},${yBodyBottom} ${xS1 + 3},${yBodyBottom + flapPx} ${xS1 + dPx - 3},${yBodyBottom + flapPx} ${xP2},${yBodyBottom} ${xP2 + wPx},${yBodyBottom} ${xS2 + 3},${yBodyBottom + flapPx} ${xS2 + dPx - 3},${yBodyBottom + flapPx} ${xEnd},${yBodyBottom}`} />
          </g>

          {/* CREASE / BIGOVKA LINES (Pink Dashed #ec4899) */}
          <g stroke="#ec4899" strokeWidth="1.3" strokeDasharray="4 2">
            {/* Vertical fold creases */}
            <line x1={xP1} y1={yBodyTop} x2={xP1} y2={yBodyBottom} />
            <line x1={xS1} y1={yBodyTop} x2={xS1} y2={yBodyBottom} />
            <line x1={xP2} y1={yBodyTop} x2={xP2} y2={yBodyBottom} />
            <line x1={xS2} y1={yBodyTop} x2={xS2} y2={yBodyBottom} />

            {/* Horizontal body fold creases */}
            <line x1={xP1} y1={yBodyTop} x2={xEnd} y2={yBodyTop} />
            <line x1={xP1} y1={yBodyBottom} x2={xEnd} y2={yBodyBottom} />

            {/* Flap tuck-in crease lines */}
            <line x1={xP2} y1={yBodyTop - flapPx} x2={xP2 + wPx} y2={yBodyTop - flapPx} />
            <line x1={xP1} y1={yBodyBottom + flapPx} x2={xP1 + wPx} y2={yBodyBottom + flapPx} />
          </g>

          {/* Panel Labels */}
          <text x={xGlue + gPx / 2} y={yBodyTop + hPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[7px] font-mono fill-zinc-400">Glue</text>
          <text x={xP1 + wPx / 2} y={yBodyTop + hPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[9.5px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">Front</text>
          <text x={xS1 + dPx / 2} y={yBodyTop + hPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[8.5px] font-mono font-medium fill-zinc-500">Side 1</text>
          <text x={xP2 + wPx / 2} y={yBodyTop + hPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[9.5px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">Back</text>
          <text x={xS2 + dPx / 2} y={yBodyTop + hPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[8.5px] font-mono font-medium fill-zinc-500">Side 2</text>

          {/* Top Tuck Flap Label */}
          <text x={xP2 + wPx / 2} y={yBodyTop - flapPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[8px] font-mono fill-pink-500 font-semibold">Tuck Flap</text>
          <text x={xP1 + wPx / 2} y={yBodyBottom + flapPx / 2} textAnchor="middle" dominantBaseline="middle" className="text-[8px] font-mono fill-pink-500 font-semibold">Bottom Tuck</text>

          {/* Dimension Callouts: W, H, D */}
          <g className="text-zinc-500 dark:text-zinc-400">
            {/* Width callout across Front panel */}
            <line x1={xP1} y1={yBodyTop - 5} x2={xP1 + wPx} y2={yBodyTop - 5} stroke="currentColor" strokeWidth="0.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
            <text x={xP1 + wPx / 2} y={yBodyTop - 8} textAnchor="middle" className="text-[9px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">W: {safeW}mm</text>

            {/* Depth callout across Side 1 panel */}
            <line x1={xS1} y1={yBodyTop - 5} x2={xS1 + dPx} y2={yBodyTop - 5} stroke="currentColor" strokeWidth="0.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
            <text x={xS1 + dPx / 2} y={yBodyTop - 8} textAnchor="middle" className="text-[9px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">D: {safeD}mm</text>

            {/* Height callout along right edge */}
            <line x1={xEnd + 8} y1={yBodyTop} x2={xEnd + 8} y2={yBodyBottom} stroke="currentColor" strokeWidth="0.8" markerStart={`url(#${arrowStartId})`} markerEnd={`url(#${arrowEndId})`} />
            <text x={xEnd + 11} y={yBodyTop + hPx / 2} textAnchor="middle" transform={`rotate(90, ${xEnd + 11}, ${yBodyTop + hPx / 2})`} className="text-[9px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300">H: {safeH}mm</text>
          </g>
        </svg>
      );
    }

    // ── STANDARD 1-UP / FLAT SCALE CALCULATIONS (Rect, Circle, Oval, Folded, Custom) ──
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

    // Drill Hole Calculations (Supports Single & Dual Symmetrical Holes on Fold)
    const holeRadiusMm = effectiveHoleDiameter / 2;
    const holeRadiusPx = Math.max(3, holeRadiusMm * scale);
    const offsetPx = effectiveHoleOffset * scale;

    type HoleItem = { x: number; y: number; label?: string };
    const holes: HoleItem[] = [];

    if (effectiveHolePos === "both-sides-fold") {
      if (foldType === "half_horizontal") {
        // Horizontal fold: fold line at cy
        // Panel 1 (Top): hole just above fold line
        // Panel 2 (Bottom): hole just below fold line
        const topHoleY = cy - offsetPx - holeRadiusPx;
        const bottomHoleY = cy + offsetPx + holeRadiusPx;
        holes.push({ x: cx, y: topHoleY });
        holes.push({ x: cx, y: bottomHoleY });
      } else {
        // Default: half_vertical fold: fold line at cx
        // Panel 1 (Left panel): top-right corner near fold line
        // Panel 2 (Right panel): top-left corner near fold line
        const leftHoleX = cx - offsetPx - holeRadiusPx;
        const rightHoleX = cx + offsetPx + holeRadiusPx;
        const holeY = trimY + offsetPx + holeRadiusPx;
        holes.push({ x: leftHoleX, y: holeY });
        holes.push({ x: rightHoleX, y: holeY });
      }
    } else if (effectiveHolePos === "top-left") {
      holes.push({ x: trimX + offsetPx + holeRadiusPx, y: trimY + offsetPx + holeRadiusPx });
    } else if (effectiveHolePos === "top-right") {
      holes.push({ x: trimX + drawW - offsetPx - holeRadiusPx, y: trimY + offsetPx + holeRadiusPx });
    } else if (effectiveHolePos === "left-center") {
      holes.push({ x: trimX + offsetPx + holeRadiusPx, y: cy });
    } else if (effectiveHolePos === "right-center") {
      holes.push({ x: trimX + drawW - offsetPx - holeRadiusPx, y: cy });
    } else {
      holes.push({ x: cx, y: trimY + offsetPx + holeRadiusPx });
    }

    const topCalloutY = Math.max(14, bleedY - 14);
    const rightCalloutX = Math.min(cW - 14, bleedX + bleedW + 14);

    return (
      <svg
        viewBox={`0 0 ${cW} ${cH}`}
        className="w-full h-full overflow-visible drop-shadow-sm select-none"
      >
        {svgDefs}
        <rect width={cW} height={cH} fill={`url(#${gridPatternId})`} />

        {/* ── CASE 2: CIRCLE (Round / Disk) ── */}
        {isCircle && (
          <g>
            {safeBleed > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={drawW / 2 + drawBleed}
                fill="rgba(245, 158, 11, 0.05)"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={drawW / 2}
              fill="rgba(16, 185, 129, 0.08)"
              stroke="#10b981"
              strokeWidth="2"
            />
            {drawW > 20 && (
              <circle
                cx={cx}
                cy={cy}
                r={Math.max(3, drawW / 2 - safeMarginPx)}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.85"
              />
            )}
            {/* Center Crosshair for Die Alignment */}
            <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
            <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
          </g>
        )}

        {/* ── CASE 3: OVAL (Ellipse) ── */}
        {isOval && (
          <g>
            {safeBleed > 0 && (
              <ellipse
                cx={cx}
                cy={cy}
                rx={drawW / 2 + drawBleed}
                ry={drawH / 2 + drawBleed}
                fill="rgba(245, 158, 11, 0.05)"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
            )}
            <ellipse
              cx={cx}
              cy={cy}
              rx={drawW / 2}
              ry={drawH / 2}
              fill="rgba(16, 185, 129, 0.08)"
              stroke="#10b981"
              strokeWidth="2"
            />
            {drawW > 20 && drawH > 20 && (
              <ellipse
                cx={cx}
                cy={cy}
                rx={Math.max(3, drawW / 2 - safeMarginPx)}
                ry={Math.max(3, drawH / 2 - safeMarginPx)}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.85"
              />
            )}
            <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
            <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
          </g>
        )}

        {/* ── CASE 4: CUSTOM DIE CONTOURS (Arch, Hexagon, Star, Vector SVG) ── */}
        {isCustom && (
          <g>
            {customShape === "arch" && (
              <>
                {safeBleed > 0 && (
                  <path
                    d={`M ${bleedX} ${bleedY + bleedW / 2} A ${bleedW / 2} ${bleedW / 2} 0 0 1 ${bleedX + bleedW} ${bleedY + bleedW / 2} L ${bleedX + bleedW} ${bleedY + bleedH} L ${bleedX} ${bleedY + bleedH} Z`}
                    fill="rgba(245, 158, 11, 0.05)"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                )}
                <path
                  d={`M ${trimX} ${trimY + drawW / 2} A ${drawW / 2} ${drawW / 2} 0 0 1 ${trimX + drawW} ${trimY + drawW / 2} L ${trimX + drawW} ${trimY + drawH} L ${trimX} ${trimY + drawH} Z`}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth="2"
                />
                <path
                  d={`M ${safeX} ${safeY + safeWidth / 2} A ${safeWidth / 2} ${safeWidth / 2} 0 0 1 ${safeX + safeWidth} ${safeY + safeWidth / 2} L ${safeX + safeWidth} ${safeY + safeHeight} L ${safeX} ${safeY + safeHeight} Z`}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />
              </>
            )}

            {customShape === "hexagon" && (
              <>
                <polygon
                  points={`${cx},${trimY} ${trimX + drawW},${trimY + drawH * 0.25} ${trimX + drawW},${trimY + drawH * 0.75} ${cx},${trimY + drawH} ${trimX},${trimY + drawH * 0.75} ${trimX},${trimY + drawH * 0.25}`}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              </>
            )}

            {customShape === "star" && (
              <polygon
                points={`${cx},${trimY} ${cx + drawW * 0.15},${trimY + drawH * 0.3} ${trimX + drawW},${trimY + drawH * 0.35} ${cx + drawW * 0.25},${trimY + drawH * 0.6} ${trimX + drawW * 0.8},${trimY + drawH} ${cx},${trimY + drawH * 0.75} ${trimX + drawW * 0.2},${trimY + drawH} ${cx - drawW * 0.25},${trimY + drawH * 0.6} ${trimX},${trimY + drawH * 0.35} ${cx - drawW * 0.15},${trimY + drawH * 0.3}`}
                fill="rgba(16, 185, 129, 0.08)"
                stroke="#10b981"
                strokeWidth="2"
              />
            )}

            {customShape === "pillow" && (
              <>
                <rect x={trimX} y={trimY} width={drawW} height={drawH} rx={4} fill="rgba(16, 185, 129, 0.08)" stroke="#10b981" strokeWidth="2" />
                {/* Curved crease lines top and bottom */}
                <path d={`M ${trimX} ${trimY + 12} Q ${cx} ${trimY + 24} ${trimX + drawW} ${trimY + 12}`} fill="none" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2" />
                <path d={`M ${trimX} ${trimY + drawH - 12} Q ${cx} ${trimY + drawH - 24} ${trimX + drawW} ${trimY + drawH - 12}`} fill="none" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2" />
              </>
            )}

            {customShape === "vector_svg" && (
              parsedSvg ? (() => {
                const { pathD, polygonVertices } = parsedSvg;
                const vb = parsedSvg.computedBox || parsedSvg.viewBox;
                const scaleX = vb.width > 0 ? drawW / vb.width : 1;
                const scaleY = vb.height > 0 ? drawH / vb.height : 1;
                const autoScale = Math.min(scaleX, scaleY);
                const renderedW = vb.width * autoScale;
                const renderedH = vb.height * autoScale;
                const offsetX = trimX + (drawW - renderedW) / 2 - vb.x * autoScale;
                const offsetY = trimY + (drawH - renderedH) / 2 - vb.y * autoScale;

                // 1. True Parallel Geometric Offsets for Polygons (Exact 2mm Bleed & 3mm Safe)
                let bleedPathD = "";
                let safePathD = "";

                if (polygonVertices && polygonVertices.length >= 3) {
                  const screenCutPts: [number, number][] = polygonVertices.map(([x, y]) => [
                    offsetX + x * autoScale,
                    offsetY + y * autoScale,
                  ]);
                  if (safeBleed > 0) {
                    const bPts = offsetPolygon(screenCutPts, drawBleed);
                    bleedPathD = polygonToPathD(bPts);
                  }
                  if (drawW > 20 && drawH > 20) {
                    const sPts = offsetPolygon(screenCutPts, -safeMarginPx);
                    safePathD = polygonToPathD(sPts);
                  }
                }

                // Fallback for curves if polygon offset is not available
                const bleedScaleX = (renderedW + 2 * drawBleed) / (renderedW || 1);
                const bleedScaleY = (renderedH + 2 * drawBleed) / (renderedH || 1);
                const bleedOriginX = trimX + drawW / 2;
                const bleedOriginY = trimY + drawH / 2;

                const safeScaleX = Math.max(0.1, (renderedW - 6 * scale) / (renderedW || 1));
                const safeScaleY = Math.max(0.1, (renderedH - 6 * scale) / (renderedH || 1));

                return (
                  <g>
                    {/* Outer Bleed Contour for Custom SVG (+2mm parallel) */}
                    {safeBleed > 0 && (
                      bleedPathD ? (
                        <path
                          d={bleedPathD}
                          fill="rgba(245, 158, 11, 0.04)"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="5 3"
                        />
                      ) : (
                        <g
                          transform={`translate(${bleedOriginX}, ${bleedOriginY}) scale(${bleedScaleX}, ${bleedScaleY}) translate(${-bleedOriginX}, ${-bleedOriginY})`}
                          opacity="0.85"
                        >
                          <path
                            d={pathD}
                            transform={`translate(${offsetX}, ${offsetY}) scale(${autoScale})`}
                            fill="rgba(245, 158, 11, 0.05)"
                            stroke="#f59e0b"
                            strokeWidth={1.5}
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray="5 3"
                          />
                        </g>
                      )
                    )}

                    {/* Inner Safe Margin Contour for Custom SVG (-3mm parallel) */}
                    {drawW > 20 && drawH > 20 && (
                      safePathD ? (
                        <path
                          d={safePathD}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth={1.2}
                          strokeDasharray="3 3"
                        />
                      ) : (
                        <g
                          transform={`translate(${bleedOriginX}, ${bleedOriginY}) scale(${safeScaleX}, ${safeScaleY}) translate(${-bleedOriginX}, ${-bleedOriginY})`}
                          opacity="0.85"
                        >
                          <path
                            d={pathD}
                            transform={`translate(${offsetX}, ${offsetY}) scale(${autoScale})`}
                            fill="none"
                            stroke="#0284c7"
                            strokeWidth={1.2}
                            strokeDasharray="3 3"
                            vectorEffect="non-scaling-stroke"
                          />
                        </g>
                      )
                    )}

                    {/* Cut Contour Line (Green Solid #10b981) */}
                    <path
                      d={pathD}
                      transform={`translate(${offsetX}, ${offsetY}) scale(${autoScale})`}
                      fill="rgba(16, 185, 129, 0.08)"
                      stroke="#10b981"
                      strokeWidth={1.8}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })() : (
                /* Fallback if no SVG uploaded yet or parse failed */
                <rect
                  x={trimX}
                  y={trimY}
                  width={drawW}
                  height={drawH}
                  fill="rgba(16, 185, 129, 0.04)"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )
            )}
          </g>
        )}

        {/* ── CASE 5: RECTANGLE & FOLDED CARD (Default CAD Box) ── */}
        {!isCircle && !isOval && !isCustom && (
          <g>
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
          </g>
        )}

        {/* ── FOLD LINES / BIGOVKA OVERLAYS ── */}
        {isFolded && (
          <g>
            {foldType === "half_vertical" && (
              <>
                <line x1={cx} y1={trimY} x2={cx} y2={trimY + drawH} stroke="#ec4899" strokeWidth="1.6" strokeDasharray="5 3" />
                <text x={cx} y={trimY + 12} textAnchor="middle" className="text-[8px] font-mono fill-pink-600 dark:fill-pink-400 font-bold">FOLD (1/2)</text>
              </>
            )}

            {foldType === "half_horizontal" && (
              <>
                <line x1={trimX} y1={cy} x2={trimX + drawW} y2={cy} stroke="#ec4899" strokeWidth="1.6" strokeDasharray="5 3" />
                <text x={cx} y={cy - 4} textAnchor="middle" className="text-[8px] font-mono fill-pink-600 dark:fill-pink-400 font-bold">FOLD (1/2)</text>
              </>
            )}

            {(foldType === "tri_c" || foldType === "tri_z") && (
              <>
                <line x1={trimX + drawW / 3} y1={trimY} x2={trimX + drawW / 3} y2={trimY + drawH} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1={trimX + (2 * drawW) / 3} y1={trimY} x2={trimX + (2 * drawW) / 3} y2={trimY + drawH} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2" />
                <text x={trimX + drawW / 6} y={trimY + 12} textAnchor="middle" className="text-[7.5px] font-mono fill-pink-500 font-semibold">P1</text>
                <text x={cx} y={trimY + 12} textAnchor="middle" className="text-[7.5px] font-mono fill-pink-500 font-semibold">P2</text>
                <text x={trimX + (5 * drawW) / 6} y={trimY + 12} textAnchor="middle" className="text-[7.5px] font-mono fill-pink-500 font-semibold">P3</text>
              </>
            )}

            {foldType === "gate" && (
              <>
                <line x1={trimX + drawW * 0.25} y1={trimY} x2={trimX + drawW * 0.25} y2={trimY + drawH} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1={trimX + drawW * 0.75} y1={trimY} x2={trimX + drawW * 0.75} y2={trimY + drawH} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 2" />
                <text x={trimX + drawW * 0.125} y={trimY + 12} textAnchor="middle" className="text-[7px] font-mono fill-pink-500">Gate L</text>
                <text x={cx} y={trimY + 12} textAnchor="middle" className="text-[7px] font-mono fill-pink-500">Center</text>
                <text x={trimX + drawW * 0.875} y={trimY + 12} textAnchor="middle" className="text-[7px] font-mono fill-pink-500">Gate R</text>
              </>
            )}
          </g>
        )}

        {/* ── DRILL HOLE & EYELET (Supports 1 or 2 symmetrical holes) ── */}
        {hasHole && holes.map((h, hIdx) => (
          <g key={hIdx}>
            <circle
              cx={h.x}
              cy={h.y}
              r={holeRadiusPx + 2.5 * scale}
              fill="rgba(16, 185, 129, 0.05)"
              stroke="#10b981"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.75"
            />
            <circle
              cx={h.x}
              cy={h.y}
              r={holeRadiusPx}
              fill="currentColor"
              className="text-zinc-50 dark:text-zinc-950"
              stroke="#10b981"
              strokeWidth="1.6"
            />
            <line x1={h.x - holeRadiusPx - 2} y1={h.y} x2={h.x + holeRadiusPx + 2} y2={h.y} stroke="#10b981" strokeWidth="0.8" strokeDasharray="1 1" />
            <line x1={h.x} y1={h.y - holeRadiusPx - 2} x2={h.x} y2={h.y + holeRadiusPx + 2} stroke="#10b981" strokeWidth="0.8" strokeDasharray="1 1" />
            <text
              x={h.x}
              y={h.y > cy ? h.y + holeRadiusPx + 9 : h.y - holeRadiusPx - 3.5}
              textAnchor="middle"
              className="text-[8px] font-mono font-bold fill-emerald-600 dark:fill-emerald-400 select-none"
            >
              Ø{effectiveHoleDiameter}mm
            </text>
          </g>
        ))}

        {/* Center Product Title Watermark */}
        <text
          x={cx}
          y={isHangtag ? cy + 8 : cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[11px] font-sans font-medium fill-zinc-400 dark:fill-zinc-500/80 select-none pointer-events-none"
        >
          {isCircle ? `Ø${safeW} mm Circle` : itemCategory || "Product"}
        </text>

        {/* ── DIMENSION CALLOUTS ── */}
        {/* Width Dimension */}
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
          <line x1={trimX} y1={topCalloutY - 3} x2={trimX} y2={trimY} stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 2" opacity="0.6" />
          <line x1={trimX + drawW} y1={topCalloutY - 3} x2={trimX + drawW} y2={trimY} stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 2" opacity="0.6" />
          <text
            x={cx}
            y={topCalloutY - 4}
            textAnchor="middle"
            className="text-[10.5px] font-mono font-bold fill-zinc-700 dark:fill-zinc-300"
          >
            {isCircle ? `Ø ${safeW} ${dimensionUnit}` : `${safeW} ${dimensionUnit}`}
          </text>
        </g>

        {/* Height Dimension (Not needed for circle) */}
        {!isCircle && (
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
            <line x1={trimX + drawW} y1={trimY} x2={rightCalloutX + 3} y2={trimY} stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 2" opacity="0.6" />
            <line x1={trimX + drawW} y1={trimY + drawH} x2={rightCalloutX + 3} y2={trimY + drawH} stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 2" opacity="0.6" />
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
        )}
      </svg>
    );
  };

  const handleDownloadDielineSvg = () => {
    const exportW = safeW + safeBleed * 2 + 30;
    const exportH = safeH + safeBleed * 2 + 30;
    const pad = 15;
    const tX = pad + safeBleed;
    const tY = pad + safeBleed;

    let svgContent = "";
    if (customShape === "vector_svg" && parsedSvg) {
      const { pathD, polygonVertices } = parsedSvg;
      const vb = parsedSvg.computedBox || parsedSvg.viewBox;
      const scaleX = vb.width > 0 ? safeW / vb.width : 1;
      const scaleY = vb.height > 0 ? safeH / vb.height : 1;
      const aScale = Math.min(scaleX, scaleY);
      const rW = vb.width * aScale;
      const rH = vb.height * aScale;
      const offX = tX + (safeW - rW) / 2 - vb.x * aScale;
      const offY = tY + (safeH - rH) / 2 - vb.y * aScale;

      let expBleedPath = "";
      let expSafePath = "";
      let expCutPath = "";

      if (polygonVertices && polygonVertices.length >= 3) {
        const cutPtsMm: [number, number][] = polygonVertices.map(([x, y]) => [
          offX + x * aScale,
          offY + y * aScale,
        ]);
        expCutPath = polygonToPathD(cutPtsMm);
        if (safeBleed > 0) {
          expBleedPath = polygonToPathD(offsetPolygon(cutPtsMm, safeBleed));
        }
        expSafePath = polygonToPathD(offsetPolygon(cutPtsMm, -3));
      }

      const bScaleX = (rW + 2 * safeBleed) / (rW || 1);
      const bScaleY = (rH + 2 * safeBleed) / (rH || 1);
      const bOrigX = tX + safeW / 2;
      const bOrigY = tY + safeH / 2;

      const sScaleX = Math.max(0.1, (rW - 6) / (rW || 1));
      const sScaleY = Math.max(0.1, (rH - 6) / (rH || 1));

      svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${exportW} ${exportH}" width="${exportW}mm" height="${exportH}mm">
  <defs>
    <style>
      .cut { fill: rgba(16,185,129,0.1); stroke: #10b981; stroke-width: 0.5; }
      .bleed { fill: none; stroke: #f59e0b; stroke-width: 0.35; stroke-dasharray: 2, 1; }
      .safe { fill: none; stroke: #0284c7; stroke-width: 0.3; stroke-dasharray: 1.5, 1.5; }
      .dim { stroke: #6b7280; stroke-width: 0.25; }
      .txt { font-family: monospace; font-size: 3px; fill: #374151; font-weight: bold; }
    </style>
  </defs>

  <!-- 1. Bleed Contour (+${safeBleed}mm) -->
  ${expBleedPath ? `<path d="${expBleedPath}" class="bleed" />` : `
  <g transform="translate(${bOrigX}, ${bOrigY}) scale(${bScaleX}, ${bScaleY}) translate(${-bOrigX}, ${-bOrigY})">
    <path d="${pathD}" transform="translate(${offX}, ${offY}) scale(${aScale})" class="bleed" vector-effect="non-scaling-stroke" />
  </g>`}

  <!-- 2. Safe Margin (-3mm) -->
  ${expSafePath ? `<path d="${expSafePath}" class="safe" />` : `
  <g transform="translate(${bOrigX}, ${bOrigY}) scale(${sScaleX}, ${sScaleY}) translate(${-bOrigX}, ${-bOrigY})">
    <path d="${pathD}" transform="translate(${offX}, ${offY}) scale(${aScale})" class="safe" vector-effect="non-scaling-stroke" />
  </g>`}

  <!-- 3. Cut Contour (Trim Box) -->
  <path d="${expCutPath || pathD}" ${expCutPath ? "" : `transform="translate(${offX}, ${offY}) scale(${aScale})"`} class="cut" vector-effect="non-scaling-stroke" />

  <!-- 4. Dimensions & Title -->
  <text x="${tX + safeW / 2}" y="${tY + safeH / 2}" text-anchor="middle" font-family="sans-serif" font-size="3.5" fill="#9ca3af" font-weight="bold">${itemCategory || "Hangtag"}</text>
  <text x="${tX + safeW / 2}" y="${pad - 2}" text-anchor="middle" class="txt">${safeW} mm</text>
  <text x="${tX + safeW + 8}" y="${tY + safeH / 2}" text-anchor="middle" transform="rotate(90, ${tX + safeW + 8}, ${tY + safeH / 2})" class="txt">${safeH} mm</text>
</svg>`;
    }

    if (!svgContent) {
      const svgEl = document.querySelector("#dieline-canvas-svg") as SVGSVGElement | null;
      if (svgEl) {
        svgContent = new XMLSerializer().serializeToString(svgEl);
      }
    }

    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dieline_${safeW}x${safeH}mm.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5 select-none",
        className
      )}
    >
      {/* Top Inspector Header */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Ruler className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-xs text-foreground shrink-0 whitespace-nowrap">
            {t("title")}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border">
            {isBox ? "CAD Dieline (Net)" : isCircle ? "Circle Die" : isOval ? "Oval Die" : isFolded ? "Folded Sheet" : "1-Up"}
          </span>
        </div>

        <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleDownloadDielineSvg}
                  className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-foreground gap-1 cursor-pointer"
                  title="Shtansforma CAD SVG faylini yuklab olish"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>SVG Eksport</span>
                </Button>
              }
            />
            <TooltipContent side="top">
              <span className="text-xs">Shtansforma CAD SVG faylini yuklab olish</span>
            </TooltipContent>
          </Tooltip>

        {onFlipOrientation && !isCircle && (
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
        )}
      </div>

      {/* Hidden File Input for PDF / Image Artwork Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Mode Switcher Tabs + Artwork Toolbar */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap bg-muted/40 p-1 rounded-md border border-border text-[11px]">
        {/* Mode Toggle Pills */}
        <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded border border-border shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("proof")}
            className={cn(
              "px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer",
              viewMode === "proof"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Proof (Oldi & Orqasi)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("front")}
            className={cn(
              "px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer",
              viewMode === "front"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Oldi (Front)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("back")}
            className={cn(
              "px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer",
              viewMode === "back"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Orqasi (Back)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cad")}
            className={cn(
              "px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer",
              viewMode === "cad"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            CAD Chizma
          </button>
        </div>

        {/* Artwork Action Tools */}
        <div className="flex items-center gap-1">
          {viewMode !== "cad" && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowDielineOverlay(!showDielineOverlay)}
              className="h-6 px-1.5 text-[10.5px] text-zinc-600 dark:text-zinc-300 hover:text-foreground gap-1 cursor-pointer"
              title="Pichoq konturini ko'rsatish/yashirish"
            >
              {showDielineOverlay ? (
                <>
                  <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Pichoq ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                  <span>Pichoq OFF</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={isProcessingFile}
            onClick={() => fileInputRef.current?.click()}
            className="h-6 px-2 text-[10.5px] text-zinc-600 dark:text-zinc-300 hover:text-foreground gap-1 cursor-pointer bg-background"
            title="2-sahifali PDF yoki rasm yuklash"
          >
            <UploadCloud className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{isProcessingFile ? "Yuklanmoqda..." : "PDF / Rasm yuklash"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleLoadSample}
            className="h-6 px-1.5 text-[10.5px] text-zinc-500 hover:text-foreground gap-1 cursor-pointer"
            title="Red Flag hangtag namunasini tiklash"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Namuna</span>
          </Button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex items-center justify-center py-2 min-h-[220px] sm:min-h-[240px] w-full overflow-hidden bg-muted/20 dark:bg-muted/10 rounded-md border border-border">
        <div className="w-full max-w-[430px] h-[220px] sm:h-[240px] flex items-center justify-center">
          {viewMode === "proof" ? (
            renderArtworkProofSvg(420, 230)
          ) : viewMode === "front" ? (
            renderSingleArtworkSvg("front", 420, 230)
          ) : viewMode === "back" ? (
            renderSingleArtworkSvg("back", 420, 230)
          ) : (
            renderSvgCanvas(370, 190, 240, 134, "inCard")
          )}
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
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border text-[10.5px]">
        {/* Color Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2.5 h-0.5 bg-emerald-500 rounded-full inline-block" />
            <span>{t("trimLine")}</span>
          </div>

          {(isFolded || isBox || customShape === "pillow") && (
            <div className="flex items-center gap-1 text-pink-600 dark:text-pink-400">
              <span className="w-2.5 h-0.5 border-b border-dashed border-pink-500 inline-block" />
              <span>{t("foldLine")}</span>
            </div>
          )}

          {safeBleed > 0 && !isBox && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-0.5 border-b border-dashed border-amber-500 inline-block" />
              <span>{t("bleedLine", { bleed: safeBleed })}</span>
            </div>
          )}

          {!isBox && (
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <span className="w-2 h-0.5 border-b border-dotted border-sky-500 inline-block" />
              <span>{t("safeZone")}</span>
            </div>
          )}

          {hasHole && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full border border-emerald-500 inline-block" />
              <span>Ø{effectiveHoleDiameter}mm ({effectiveHolePos})</span>
            </div>
          )}
        </div>

        {/* Net Area calculation */}
        <div className="font-mono text-muted-foreground shrink-0 font-medium text-[11px]">
          {t("area")}: <span className="font-semibold text-foreground">{netAreaCm2} cm²</span>
        </div>
      </div>
    </div>
  );
}
