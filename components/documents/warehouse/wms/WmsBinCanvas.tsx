"use client";

import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import { WmsBin, WmsBinItem, WmsRack } from "./types";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRightLeft, Trash2, Box, QrCode } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface WmsBinCanvasProps {
  bin: WmsBin;
  rack?: WmsRack;
  items: WmsBinItem[];
  selectedItemId: string | null;
  onSelectItem: (item: WmsBinItem | null) => void;
  onOpenPutawayModal: () => void;
  onOpenTransferModal: (item: WmsBinItem) => void;
  onOpenPickModal: (item: WmsBinItem) => void;
  onUpdateItemPosition: (itemId: string, posX: number, posY: number) => Promise<void>;
}

export function WmsBinCanvas({
  bin,
  rack,
  items,
  selectedItemId,
  onSelectItem,
  onOpenPutawayModal,
  onOpenTransferModal,
  onOpenPickModal,
  onUpdateItemPosition,
}: WmsBinCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 600 });
  const { theme } = useWorkspaceStore();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setStageSize({ width: w, height: h });
        }
      }
    };
    updateSize();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          setStageSize({ width: Math.round(cr.width), height: Math.round(cr.height) });
        }
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const binItems = items.filter((it) => it.binId === bin.id);
  const selectedItem = binItems.find((it) => it.id === selectedItemId);

  // Katak ichki maydoni o'lchamlari
  const padX = 60;
  const padY = 70;
  const binW = Math.max(500, stageSize.width - padX * 2);
  const binH = Math.max(350, stageSize.height - padY * 2);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0 overflow-hidden bg-background select-none flex flex-col">
      {/* Yuqori Katak Pasporti va Boshqaruv paneli */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between bg-card/90 backdrop-blur-xs p-2 px-3 rounded-md border border-border shadow-xs text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-foreground">
            <QrCode className="size-4 text-primary" />
            <span>{bin.code}</span>
          </div>

          <span className="text-muted-foreground">·</span>

          <span className="text-muted-foreground">
            O'lcham: <span className="font-mono font-semibold text-foreground">{bin.widthCm}×{bin.heightCm}×{bin.depthCm} sm</span>
          </span>

          <span className="text-muted-foreground">·</span>

          <span className="text-muted-foreground">
            Yuk: <span className="font-mono font-semibold text-foreground">{bin.currentWeightKg || 0} / {bin.maxWeightKg} kg</span>
          </span>

          <span className="text-muted-foreground">·</span>

          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
            bin.occupancyPct >= 80
              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
              : bin.occupancyPct > 0
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-muted text-muted-foreground"
          }`}>
            {bin.occupancyPct}% band
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedItem && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-amber-600 text-amber-600"
                onClick={() => onOpenTransferModal(selectedItem)}
              >
                <ArrowRightLeft className="size-3.5" />
                <span>Ko'chirish</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-rose-600 text-rose-600"
                onClick={() => onOpenPickModal(selectedItem)}
              >
                <Trash2 className="size-3.5" />
                <span>Chiqim (Pick)</span>
              </Button>

              <div className="h-4 w-px bg-border mx-1" />
            </>
          )}

          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onOpenPutawayModal}
          >
            <Plus className="size-3.5" />
            <span>Mahsulot joylash</span>
          </Button>
        </div>
      </div>

      <Stage width={stageSize.width} height={stageSize.height}>
        <Layer>
          {/* Katakning 3D/2D ichki javoni devorlari va polkasi */}
          <Group x={padX} y={padY}>
            {/* Orqa fon devori */}
            <Rect
              width={binW}
              height={binH}
              fill={isDark ? "#0f172a" : "#f8fafc"}
              stroke={isDark ? "#334155" : "#cbd5e1"}
              strokeWidth={1.5}
              cornerRadius={4}
            />

            {/* Javon metall polkasi (pastki mustahkam planka) */}
            <Rect
              x={0}
              y={binH - 12}
              width={binW}
              height={12}
              fill={isDark ? "#1e293b" : "#e2e8f0"}
              stroke={isDark ? "#475569" : "#94a3b8"}
              strokeWidth={1}
            />

            {/* Santimetr o'lchov shkalasi chiziqlari */}
            {Array.from({ length: 11 }).map((_, i) => (
              <Group key={`scale-${i}`} x={(binW / 10) * i} y={binH - 12}>
                <Line points={[0, 0, 0, 8]} stroke="#64748b" strokeWidth={1} />
                <Text
                  x={-10}
                  y={-14}
                  text={`${i * 10}%`}
                  fontSize={8}
                  fontFamily="monospace"
                  fill="#94a3b8"
                />
              </Group>
            ))}

            {/* Agar katak bo'sh bo'lsa ko'rsatma matni */}
            {binItems.length === 0 && (
              <Text
                x={binW / 2 - 120}
                y={binH / 2 - 20}
                text="KATAK BO'SH — Mahsulot joylash uchun yuqoridagi tugmani bosing"
                fontSize={11}
                fontStyle="bold"
                fill="#94a3b8"
              />
            )}

            {/* Katak ichidagi Mahsulotlar (Palet, Quti, Rulon) */}
            {binItems.map((item, idx) => {
              const isSelected = selectedItemId === item.id;
              const w = item.widthPx || 120;
              const h = item.heightPx || 100;
              // Boshlang'ich yoki saqlangan koordinatalar
              const itemX = item.posX !== undefined ? item.posX : 40 + idx * 160;
              const itemY = item.posY !== undefined ? item.posY : binH - h - 16;

              let typeLabel = "PALET";
              if (item.containerType === "box") typeLabel = "QUTI";
              else if (item.containerType === "roll") typeLabel = "RULON";
              else if (item.containerType === "drum") typeLabel = "BOCHKA";

              return (
                <Group
                  key={item.id}
                  x={itemX}
                  y={itemY}
                  draggable={true}
                  onDragEnd={(e) => {
                    const newX = Math.max(10, Math.min(binW - w - 10, e.target.x()));
                    const newY = Math.max(10, Math.min(binH - h - 14, e.target.y()));
                    e.target.position({ x: newX, y: newY });
                    onUpdateItemPosition(item.id, newX, newY);
                  }}
                  onClick={() => onSelectItem(item)}
                >
                  {/* Mahsulot konteyneri asosi */}
                  <Rect
                    width={w}
                    height={h}
                    fill={item.color || "#2563eb"}
                    stroke={isSelected ? "#0f172a" : "#1e293b"}
                    strokeWidth={isSelected ? 3 : 1}
                    cornerRadius={4}
                    shadowColor="#000000"
                    shadowBlur={isSelected ? 8 : 3}
                    shadowOpacity={0.15}
                  />

                  {/* Konteyner yorlig'i (Turi) */}
                  <Rect
                    x={6}
                    y={6}
                    width={w - 12}
                    height={16}
                    fill="#000000"
                    opacity={0.25}
                    cornerRadius={2}
                  />
                  <Text
                    x={10}
                    y={9}
                    text={`${typeLabel} · ${item.weightKg} kg`}
                    fontSize={9}
                    fontStyle="bold"
                    fill="#ffffff"
                  />

                  {/* SKU va Nomi */}
                  <Text
                    x={8}
                    y={28}
                    text={item.sku}
                    fontSize={11}
                    fontFamily="monospace"
                    fontStyle="bold"
                    fill="#ffffff"
                  />

                  <Text
                    x={8}
                    y={44}
                    text={item.name}
                    width={w - 16}
                    fontSize={10}
                    fontStyle="bold"
                    fill="#ffffff"
                    ellipsis={true}
                  />

                  {/* Miqdor */}
                  <Rect
                    x={6}
                    y={h - 22}
                    width={w - 12}
                    height={16}
                    fill="#ffffff"
                    cornerRadius={2}
                  />
                  <Text
                    x={10}
                    y={h - 19}
                    text={`${item.quantity} ${item.unit}`}
                    fontSize={10}
                    fontFamily="monospace"
                    fontStyle="bold"
                    fill="#0f172a"
                  />
                </Group>
              );
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
