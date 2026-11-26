"use client";

import React, { useCallback, useRef, useState } from "react";
import type { GridColumn, GridMouseEventArgs } from "@glideapps/glide-data-grid";

interface HoverPreview {
  url: string;
  x: number;
  y: number;
  title?: string;
}

const CARD_SIZE = 380;
const MARGIN = 16;
const DEFAULT_IMAGE_COLUMNS = ["image", "imageUrl", "preview"] as const;

function cardPosition(clientX: number, clientY: number) {
  const vpW = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 1080;
  let x = clientX + MARGIN;
  let y = clientY + MARGIN;
  if (x + CARD_SIZE > vpW - MARGIN) x = clientX - CARD_SIZE - MARGIN;
  if (y + CARD_SIZE > vpH - MARGIN) y = clientY - CARD_SIZE - MARGIN;
  return { x: Math.max(MARGIN, x), y: Math.max(MARGIN, y) };
}

function pickImage(row: any): string | null {
  const raw = row?.imageUrl || row?.image || row?.preview;
  if (Array.isArray(raw)) return raw[0] || null;
  return raw || null;
}

/**
 * Hover image preview for Glide grids — same card as the Work Orders grid.
 * Spread `containerProps` on the grid's wrapper, pass `onItemHovered` to DataEditor
 * and render `preview` next to it.
 */
export function useGridImageHover(
  columns: readonly GridColumn[],
  rows: readonly any[],
  imageColumnIds: readonly string[] = DEFAULT_IMAGE_COLUMNS
) {
  const [hovered, setHovered] = useState<HoverPreview | null>(null);
  const mouse = useRef({ x: 0, y: 0 });

  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind === "cell") {
        const [col, row] = args.location;
        const colId = (columns[col] as any)?.id;
        if (colId && imageColumnIds.includes(colId)) {
          const rowData = rows[row];
          const url = pickImage(rowData);
          if (url) {
            setHovered({
              url,
              ...cardPosition(mouse.current.x, mouse.current.y),
              title: rowData?.name || rowData?.sku || rowData?.code || "",
            });
            return;
          }
        }
      }
      setHovered(null);
    },
    [columns, rows, imageColumnIds]
  );

  const containerProps = {
    onMouseMove: (e: React.MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (hovered) {
        const pos = cardPosition(e.clientX, e.clientY);
        setHovered((prev) => (prev ? { ...prev, ...pos } : null));
      }
    },
    onMouseLeave: () => setHovered(null),
  };

  const preview = hovered ? (
    <div
      style={{ left: `${hovered.x}px`, top: `${hovered.y}px` }}
      className="fixed z-50 pointer-events-none rounded-lg bg-popover/95 backdrop-blur-xs border border-border shadow-2xl p-1 animate-in fade-in-0 zoom-in-95 duration-75 max-w-[430px] max-h-[430px] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hovered.url}
        alt={hovered.title || "Rasm"}
        className="max-w-[415px] max-h-[400px] w-auto h-auto object-contain rounded select-none"
      />
      {hovered.title && (
        <span className="text-[11px] font-medium text-foreground py-0.5 truncate max-w-full">
          {hovered.title}
        </span>
      )}
    </div>
  ) : null;

  return { onItemHovered, containerProps, preview };
}
