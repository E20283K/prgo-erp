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

  const labelText = cellData.label || "";
  const maxLabelW = pW * 0.82;
  const charCount = Math.max(1, labelText.length);
  const autoFontSize = maxLabelW / (charCount * 0.6);
  const labelFontSize = Math.max(2.4, Math.min(autoFontSize, pH * 0.13, 7));
  const slotNumFontSize = Math.max(2, Math.min(labelFontSize * 0.7, 3.6));

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
                y={y + itemH / 2 - labelFontSize * 0.75}
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
              <text
                x={x + itemW / 2}
                y={y + itemH / 2 + labelFontSize * 0.25}
                fontSize={labelFontSize}
                fill="#111827"
                textAnchor="middle"
                alignmentBaseline="middle"
                fontWeight="bold"
              >
                {cellData.label}
              </text>
              <text
                x={x + itemW / 2}
                y={y + itemH / 2 + labelFontSize * 1.25}
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
