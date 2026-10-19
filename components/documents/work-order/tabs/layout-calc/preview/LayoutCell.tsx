import React from "react";
import { GridCell } from "../types";

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
}: Props) {
  const pX1 = x + bleed;
  const pY1 = y + bleed;
  const pW = itemW - bleed * 2;
  const pH = itemH - bleed * 2;

  const primaryText = cellData.sizeCode || cellData.label || "";
  const modelText = cellData.model || "";
  const maxLabelW = pW * 0.85;
  const charCount = Math.max(1, primaryText.length);
  const autoFontSize = maxLabelW / (charCount * 0.58);
  const labelFontSize = Math.max(2.6, Math.min(autoFontSize, pH * 0.14, 7.5));
  const slotNumFontSize = Math.max(2, Math.min(labelFontSize * 0.68, 3.5));

  return (
    <g>
      {/* Bleed Area Box */}
      <rect
        x={x}
        y={y}
        width={itemW}
        height={itemH}
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
        stroke={cellData.sideBadge === "BACK" ? "#7c3aed" : "#3b82f6"}
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />

      {/* Optimized Centered Label and Meta */}
      {cellData.label && (
        <g>
          {pH > 35 ? (
            <>
              <text
                x={x + itemW / 2}
                y={y + itemH / 2 - labelFontSize * (modelText ? 1.15 : 0.75)}
                fontSize={slotNumFontSize}
                fill={cellData.sideBadge === "BACK" ? "#6d28d9" : "#6b7280"}
                textAnchor="middle"
                alignmentBaseline="middle"
                fontWeight="600"
              >
                {cellData.sideBadge
                  ? `#${index + 1} · ${cellData.sideBadge}`
                  : `#${index + 1}`}
              </text>
              {modelText && (
                <text
                  x={x + itemW / 2}
                  y={y + itemH / 2 - labelFontSize * 0.35}
                  fontSize={Math.max(2.2, slotNumFontSize * 1.05)}
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
                y={y + itemH / 2 + labelFontSize * (modelText ? 0.55 : 0.25)}
                fontSize={labelFontSize}
                fill="#111827"
                textAnchor="middle"
                alignmentBaseline="middle"
                fontWeight="bold"
              >
                {primaryText}
              </text>
              <text
                x={x + itemW / 2}
                y={y + itemH / 2 + labelFontSize * (modelText ? 1.45 : 1.25)}
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
              x={x + itemW / 2}
              y={y + itemH / 2 + labelFontSize * 0.35}
              fontSize={labelFontSize}
              fill="#111827"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontWeight="bold"
            >
              {cellData.sideBadge
                ? `#${index + 1} [${cellData.sideBadge}] ${cellData.label}`
                : `#${index + 1} ${cellData.label}`}
            </text>
          )}
        </g>
      )}
    </g>
  );
}
