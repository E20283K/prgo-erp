import React from "react";
import { GridCell } from "../types";
import { ProductShapeType, ProductCustomShape } from "../../../types";
import { ParsedSvgContour } from "../../../utils/svgContour";

interface Props {
  index: number;
  x: number;
  y: number;
  itemW: number;
  itemH: number;
  bleed: number;
  prodW: number;
  prodH: number;
  cellData: GridCell;
  shapeType?: ProductShapeType;
  customShape?: ProductCustomShape;
  parsedSvg?: ParsedSvgContour | null;
  cornerType?: string;
  artworkFront?: string;
  artworkBack?: string;
  viewMode?: "schematic" | "artwork";
}

export function LayoutCell({
  index,
  x,
  y,
  itemW,
  itemH,
  bleed,
  prodW,
  prodH,
  cellData,
  shapeType,
  customShape,
  parsedSvg,
  cornerType,
  artworkFront,
  artworkBack,
  viewMode = "schematic",
}: Props) {
  const pX1 = x + bleed;
  const pY1 = y + bleed;
  const pW = itemW - bleed * 2;
  const pH = itemH - bleed * 2;

  const isEmpty = cellData.sizeId === "empty";
  const primaryText = cellData.sizeCode || cellData.label || "";
  const modelText = cellData.model || "";
  const maxLabelW = pW * 0.88;
  const charCount = Math.max(1, primaryText.length);
  const autoFontSize = maxLabelW / (charCount * 0.55);
  const labelFontSize = Math.max(4.5, Math.min(autoFontSize, Math.min(pW, pH) * 0.34, 18));
  const metaFontSize = Math.max(3, Math.min(labelFontSize * 0.55, 7));

  const strokeColor = isEmpty ? "#d4d4d8" : "#2563eb";
  const dieStrokeColor = "#059669";

  const renderCutBoundary = () => {
    if (isEmpty) {
      return (
        <rect
          x={pX1}
          y={pY1}
          width={pW}
          height={pH}
          fill="none"
          stroke="#d4d4d8"
          strokeWidth={0.4}
          strokeDasharray="2 2"
        />
      );
    }

    // 1. Custom Vector SVG Die-line
    if (shapeType === "custom_die" && customShape === "vector_svg" && parsedSvg) {
      const { pathD } = parsedSvg;
      const vb = parsedSvg.computedBox || parsedSvg.viewBox;
      const scaleX = vb.width > 0 ? pW / vb.width : 1;
      const scaleY = vb.height > 0 ? pH / vb.height : 1;
      const autoScale = Math.min(scaleX, scaleY);
      const renderedW = vb.width * autoScale;
      const renderedH = vb.height * autoScale;
      const offsetX = pX1 + (pW - renderedW) / 2 - vb.x * autoScale;
      const offsetY = pY1 + (pH - renderedH) / 2 - vb.y * autoScale;

      return (
        <path
          d={pathD}
          transform={`translate(${offsetX}, ${offsetY}) scale(${autoScale})`}
          fill="rgba(16, 185, 129, 0.1)"
          stroke={dieStrokeColor}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="3 1.5"
        />
      );
    }

    // 2. Arch tag shape
    if (shapeType === "custom_die" && customShape === "arch") {
      const r = pW / 2;
      const archPath = `M ${pX1} ${pY1 + r} A ${r} ${r} 0 0 1 ${pX1 + pW} ${pY1 + r} L ${pX1 + pW} ${pY1 + pH} L ${pX1} ${pY1 + pH} Z`;
      return (
        <path
          d={archPath}
          fill="rgba(16, 185, 129, 0.1)"
          stroke={dieStrokeColor}
          strokeWidth={0.7}
          strokeDasharray="2.5 1.5"
        />
      );
    }

    // 3. Ticket notch / pillow shape
    if (shapeType === "custom_die" && ((customShape as any) === "ticket" || customShape === "pillow")) {
      const notchR = Math.min(pW, pH) * 0.12;
      const ticketPath = `M ${pX1} ${pY1} L ${pX1 + pW} ${pY1} L ${pX1 + pW} ${pY1 + pH / 2 - notchR} A ${notchR} ${notchR} 0 0 0 ${pX1 + pW} ${pY1 + pH / 2 + notchR} L ${pX1 + pW} ${pY1 + pH} L ${pX1} ${pY1 + pH} L ${pX1} ${pY1 + pH / 2 + notchR} A ${notchR} ${notchR} 0 0 0 ${pX1} ${pY1 + pH / 2 - notchR} Z`;
      return (
        <path
          d={ticketPath}
          fill="rgba(16, 185, 129, 0.1)"
          stroke={dieStrokeColor}
          strokeWidth={0.7}
          strokeDasharray="2.5 1.5"
        />
      );
    }

    // 4. Star shape
    if (shapeType === "custom_die" && customShape === "star") {
      const cx = pX1 + pW / 2;
      const cy = pY1 + pH / 2;
      const rOut = Math.min(pW, pH) / 2;
      const rIn = rOut * 0.45;
      let starPts = "";
      for (let p = 0; p < 10; p++) {
        const rad = (p * Math.PI) / 5 - Math.PI / 2;
        const dist = p % 2 === 0 ? rOut : rIn;
        const px = cx + dist * Math.cos(rad);
        const py = cy + dist * Math.sin(rad);
        starPts += `${px},${py} `;
      }
      return (
        <polygon
          points={starPts}
          fill="rgba(16, 185, 129, 0.1)"
          stroke={dieStrokeColor}
          strokeWidth={0.7}
          strokeDasharray="2.5 1.5"
        />
      );
    }

    // 5. Circle
    if (shapeType === "circle") {
      return (
        <circle
          cx={pX1 + pW / 2}
          cy={pY1 + pH / 2}
          r={Math.min(pW, pH) / 2}
          fill="rgba(16, 185, 129, 0.1)"
          stroke={dieStrokeColor}
          strokeWidth={0.7}
          strokeDasharray="2.5 1.5"
        />
      );
    }

    // 6. Oval
    if (shapeType === "oval") {
      return (
        <ellipse
          cx={pX1 + pW / 2}
          cy={pY1 + pH / 2}
          rx={pW / 2}
          ry={pH / 2}
          fill="rgba(16, 185, 129, 0.1)"
          stroke={dieStrokeColor}
          strokeWidth={0.7}
          strokeDasharray="2.5 1.5"
        />
      );
    }

    // 7. Rounded corners
    if (cornerType && cornerType.toLowerCase().includes("rounded")) {
      const radius = cornerType.includes("R5") ? 5 : 3;
      return (
        <rect
          x={pX1}
          y={pY1}
          width={pW}
          height={pH}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={0.6}
          strokeDasharray="2 2"
        />
      );
    }

    // 8. Standard rectangle
    return (
      <rect
        x={pX1}
        y={pY1}
        width={pW}
        height={pH}
        fill="none"
        stroke={strokeColor}
        strokeWidth={0.55}
        strokeDasharray="2 2"
      />
    );
  };

  const imageSrc =
    cellData.artworkUrl ||
    (cellData.sideBadge === "BACK" ? artworkBack || artworkFront : artworkFront || artworkBack);

  const hasVisibleArtwork = !isEmpty && viewMode === "artwork" && Boolean(imageSrc);

  return (
    <g>
      {/* Bleed Area Box */}
      <rect
        x={x}
        y={y}
        width={itemW}
        height={itemH}
        fill={cellData.color}
        stroke={isEmpty ? "#e4e4e7" : "#93c5fd"}
        strokeWidth={0.5}
      />

      {/* Product Real Cut Boundary & Artwork */}
      {hasVisibleArtwork && (
        <image
          href={imageSrc}
          x={pX1}
          y={pY1}
          width={pW}
          height={pH}
          preserveAspectRatio="xMidYMid slice"
          opacity={0.94}
        />
      )}
      {renderCutBoundary()}

      {/* Top-Left Slot Index Badge */}
      {!isEmpty && pW >= 18 && pH >= 18 && (
        <text
          x={pX1 + 2}
          y={pY1 + metaFontSize + 1.5}
          fontSize={metaFontSize}
          fill="#475569"
          fontWeight="600"
        >
          {`#${index + 1}`}
        </text>
      )}

      {/* Centered High-Contrast Label Pill */}
      {primaryText && (
        <g>
          {hasVisibleArtwork && (
            <rect
              x={x + itemW / 2 - Math.min(pW * 0.44, (charCount * labelFontSize * 0.36) + 4)}
              y={y + itemH / 2 - labelFontSize * 0.72}
              width={Math.min(pW * 0.88, (charCount * labelFontSize * 0.72) + 8)}
              height={labelFontSize * 1.44}
              rx={2}
              fill="rgba(255, 255, 255, 0.88)"
              stroke="#cbd5e1"
              strokeWidth={0.35}
            />
          )}

          {modelText && pH > 32 && !hasVisibleArtwork && (
            <text
              x={x + itemW / 2}
              y={y + itemH / 2 - labelFontSize * 0.65}
              fontSize={metaFontSize}
              fill="#1e40af"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontWeight="700"
            >
              {modelText}
            </text>
          )}

          <text
            x={x + itemW / 2}
            y={y + itemH / 2 + (modelText && pH > 32 && !hasVisibleArtwork ? labelFontSize * 0.25 : 0)}
            fontSize={labelFontSize}
            fill={isEmpty ? "#a1a1aa" : "#0f172a"}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontWeight="800"
          >
            {primaryText}
          </text>
        </g>
      )}
    </g>
  );
}
