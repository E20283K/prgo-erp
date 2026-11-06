"use client";

import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import { WmsRack, WmsBin, WmsBinItem } from "./types";
import { Button } from "@/components/ui/button";
import { Split, Combine } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface WmsRackCanvasProps {
  rack: WmsRack;
  bins: WmsBin[];
  binItems: WmsBinItem[];
  selectedBinId: string | null;
  onSelectBin: (bin: WmsBin | null) => void;
  onOpenBinDetail: (bin: WmsBin) => void;
  onMergeBins: (primaryBinId: string, secondaryBinId: string) => Promise<void>;
  onSplitBin: (binId: string, secondaryBinId?: string) => Promise<void>;
}

export function WmsRackCanvas({
  rack,
  bins,
  binItems,
  selectedBinId,
  onSelectBin,
  onOpenBinDetail,
  onMergeBins,
  onSplitBin,
}: WmsRackCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 600 });
  const [multiSelectedBinIds, setMultiSelectedBinIds] = useState<string[]>([]);
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

  const levels = rack.levelsCount || 4;
  const bays = rack.baysCount || 4;

  // Canvas ichidagi stelaj chizmasining joylashuvi
  const paddingX = 80;
  const paddingY = 60;
  const availableW = Math.max(600, stageSize.width - paddingX * 2);
  const availableH = Math.max(350, stageSize.height - paddingY * 2);

  const bayWidth = availableW / bays;
  const levelHeight = availableH / levels;

  // Stelajdagi kataklar
  const rackBins = bins.filter((b) => b.rackId === rack.id);

  // Tanlangan katak
  const selectedBin = rackBins.find((b) => b.id === selectedBinId);

  // Birlashtirish yoki bo'lish imkoniyati
  const handleToggleMultiSelect = (bin: WmsBin, e: any) => {
    if (e.evt.shiftKey || e.evt.ctrlKey) {
      if (multiSelectedBinIds.includes(bin.id)) {
        setMultiSelectedBinIds(multiSelectedBinIds.filter((id) => id !== bin.id));
      } else if (multiSelectedBinIds.length < 2) {
        setMultiSelectedBinIds([...multiSelectedBinIds, bin.id]);
      }
    } else {
      setMultiSelectedBinIds([bin.id]);
      onSelectBin(bin);
    }
  };

  const canMerge = multiSelectedBinIds.length === 2;
  const canSplit = selectedBin && (selectedBin.colSpan > 1 || selectedBin.rowSpan > 1);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0 overflow-hidden bg-background select-none flex flex-col">
      {/* Stelaj darajasidagi tezkor boshqaruv paneli */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-xs p-1.5 px-3 rounded-md border border-border shadow-xs text-xs">
        <span className="font-semibold text-foreground">{rack.name} ({rack.code})</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground font-mono">{levels} qavat × {bays} katak</span>

        <div className="h-4 w-px bg-border mx-1" />

        {canMerge && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] gap-1 px-2 border-primary text-primary"
            onClick={async () => {
              await onMergeBins(multiSelectedBinIds[0], multiSelectedBinIds[1]);
              setMultiSelectedBinIds([]);
            }}
          >
            <Combine className="size-3" />
            <span>Kataklarni birlashtirish</span>
          </Button>
        )}

        {canSplit && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] gap-1 px-2 border-amber-600 text-amber-600"
            onClick={async () => {
              await onSplitBin(selectedBin.id);
            }}
          >
            <Split className="size-3" />
            <span>Katakni ajratish</span>
          </Button>
        )}

        <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">
          (Shift bosib 2 ta katakni tanlab birlashtirish mumkin · 2 marta bosish: katak ichiga kirish)
        </span>
      </div>

      <Stage width={stageSize.width} height={stageSize.height}>
        <Layer>
          {/* Metall ramka: Chap va o'ng vertikal ustunlar (Uprights) */}
          <Rect
            x={paddingX - 16}
            y={paddingY - 10}
            width={14}
            height={availableH + 20}
            fill="#334155"
            stroke="#1e293b"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          <Rect
            x={paddingX + availableW + 2}
            y={paddingY - 10}
            width={14}
            height={availableH + 20}
            fill="#334155"
            stroke="#1e293b"
            strokeWidth={1.5}
            cornerRadius={2}
          />

          {/* Har bir oraliq ustun */}
          {Array.from({ length: bays - 1 }).map((_, i) => (
            <Rect
              key={`upright-${i}`}
              x={paddingX + (i + 1) * bayWidth - 4}
              y={paddingY}
              width={8}
              height={availableH}
              fill="#475569"
              opacity={0.8}
            />
          ))}

          {/* Qavatlar va kataklar chizmasi (pastdan yuqoriga: Level 1 = eng pastki) */}
          {Array.from({ length: levels }).map((_, lIdx) => {
            const currentLevelNum = levels - lIdx; // Yuqoridan pastga chiziladi
            const rowY = paddingY + lIdx * levelHeight;

            return (
              <Group key={`lvl-${currentLevelNum}`}>
                {/* Gorizontal travers balka (Beam) */}
                <Rect
                  x={paddingX - 10}
                  y={rowY + levelHeight - 6}
                  width={availableW + 20}
                  height={8}
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth={1}
                  cornerRadius={1}
                />

                {/* Qavat raqami belgisi */}
                <Rect
                  x={paddingX - 55}
                  y={rowY + levelHeight / 2 - 10}
                  width={34}
                  height={20}
                  fill="#0f172a"
                  cornerRadius={3}
                />
                <Text
                  x={paddingX - 50}
                  y={rowY + levelHeight / 2 - 6}
                  text={`L${String(currentLevelNum).padStart(2, "0")}`}
                  fontSize={11}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill="#ffffff"
                />

                {/* Ushbu qavatdagi kataklar (Bays) */}
                {Array.from({ length: bays }).map((_, bIdx) => {
                  const bayNum = bIdx + 1;
                  const binX = paddingX + bIdx * bayWidth + 3;
                  const binY = rowY + 3;
                  const binW = bayWidth - 6;
                  const binH = levelHeight - 10;

                  // Mos keluvchi WmsBin ob'ekti
                  const binObj = rackBins.find((b) => b.level === currentLevelNum && b.bay === bayNum);
                  if (!binObj) return null;

                  // Agar katak birlashtirilgan bo'lsa (ikkinchi qismi bo'lsa) chizmaymiz
                  if (binObj.status === "blocked" && binObj.notes?.includes("birlashtirilgan")) {
                    return null;
                  }

                  const isColSpan2 = binObj.colSpan >= 2;
                  const effectiveW = isColSpan2 ? bayWidth * 2 - 6 : binW;

                  const isSelected = selectedBinId === binObj.id || multiSelectedBinIds.includes(binObj.id);
                  const itemsInThisBin = binItems.filter((it) => it.binId === binObj.id);
                  const itemsCount = itemsInThisBin.length;

                  // Status rangi
                  let binBg = isDark ? "#1e293b" : "#ffffff";
                  let statusBadgeColor = "#94a3b8";
                  if (binObj.status === "full") {
                    binBg = isDark ? "#4c0519" : "#fff1f2";
                    statusBadgeColor = "#f43f5e";
                  } else if (binObj.status === "partial") {
                    binBg = isDark ? "#064e3b" : "#f0fdf4";
                    statusBadgeColor = "#10b981";
                  } else if (binObj.status === "blocked") {
                    binBg = isDark ? "#334155" : "#f1f5f9";
                    statusBadgeColor = "#64748b";
                  }

                  return (
                    <Group
                      key={binObj.id}
                      x={binX}
                      y={binY}
                      onClick={(e) => handleToggleMultiSelect(binObj, e)}
                      onDblClick={() => onOpenBinDetail(binObj)}
                    >
                      {/* Katak foni */}
                      <Rect
                        width={effectiveW}
                        height={binH}
                        fill={binBg}
                        stroke={isSelected ? "#3b82f6" : isDark ? "#334155" : "#cbd5e1"}
                        strokeWidth={isSelected ? 2.5 : 1}
                        cornerRadius={3}
                        shadowColor="#000000"
                        shadowBlur={isSelected ? 6 : 1}
                        shadowOpacity={isDark ? 0.3 : 0.08}
                      />

                      {/* Katak kodi */}
                      <Rect
                        x={4}
                        y={4}
                        width={effectiveW - 8}
                        height={18}
                        fill={isDark ? "#0f172a" : "#f8fafc"}
                        stroke={isDark ? "#334155" : "#e2e8f0"}
                        strokeWidth={0.5}
                        cornerRadius={2}
                      />
                      <Text
                        x={8}
                        y={8}
                        text={binObj.code}
                        fontSize={10}
                        fontFamily="monospace"
                        fontStyle="bold"
                        fill={isDark ? "#f8fafc" : "#0f172a"}
                      />

                      {/* Bandlik indikator nuqtasi */}
                      <Rect
                        x={effectiveW - 14}
                        y={8}
                        width={8}
                        height={8}
                        fill={statusBadgeColor}
                        cornerRadius={4}
                      />

                      {/* Katak ichidagi mahsulotlar silueti */}
                      {itemsCount > 0 ? (
                        <Group x={6} y={26}>
                          {itemsInThisBin.slice(0, 3).map((it, idx) => (
                            <Group key={it.id} x={idx * 34} y={binH - 58}>
                              <Rect
                                width={30}
                                height={24}
                                fill={it.color || "#2563eb"}
                                stroke="#1e293b"
                                strokeWidth={0.8}
                                cornerRadius={2}
                              />
                              <Text
                                x={3}
                                y={7}
                                text={it.containerType === "pallet" ? "PAL" : it.containerType === "roll" ? "ROL" : "BOX"}
                                fontSize={8}
                                fontStyle="bold"
                                fill="#ffffff"
                              />
                            </Group>
                          ))}
                        </Group>
                      ) : (
                        <Text
                          x={effectiveW / 2 - 20}
                          y={binH / 2 - 4}
                          text="BO'SH"
                          fontSize={9}
                          fontStyle="bold"
                          fill="#cbd5e1"
                        />
                      )}

                      {/* Pastki ko'rsatkichlar: Yuk va Bandlik */}
                      <Text
                        x={6}
                        y={binH - 14}
                        text={`${binObj.currentWeightKg || 0} / ${binObj.maxWeightKg} kg`}
                        fontSize={9}
                        fontFamily="monospace"
                        fill="#64748b"
                      />

                      <Text
                        x={effectiveW - 35}
                        y={binH - 14}
                        text={`${binObj.occupancyPct}%`}
                        fontSize={9}
                        fontFamily="monospace"
                        fontStyle="bold"
                        fill={statusBadgeColor}
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
