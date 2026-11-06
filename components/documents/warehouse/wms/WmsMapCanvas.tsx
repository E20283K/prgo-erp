"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Rect, Text, Group, Line, Transformer } from "react-konva";
import { WmsRack, WmsZone, WmsBin, WmsDrawTool } from "./types";
import Konva from "konva";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface WmsMapCanvasProps {
  zones: WmsZone[];
  racks: WmsRack[];
  bins: WmsBin[];
  selectedRackId: string | null;
  selectedZoneId?: string | null;
  onSelectRack: (rack: WmsRack | null) => void;
  onSelectZone: (zone: WmsZone | null) => void;
  onOpenRackDetail: (rack: WmsRack) => void;
  onOpenEditRackModal: (rack: WmsRack) => void;
  onOpenEditZoneModal: (zone: WmsZone) => void;
  onOpenCreateModal: (
    type: "rack" | "zone" | "aisle" | "gate" | "obstacle",
    initialCoords: { x: number; y: number; width: number; depth: number }
  ) => void;
  onUpdatePositions: (
    updates: Array<{
      id: string;
      x: number;
      y: number;
      width?: number;
      depth?: number;
      height?: number;
      rotation?: number;
      isZone?: boolean;
    }>
  ) => Promise<void>;
  drawTool: WmsDrawTool;
  snapToGrid: boolean;
  scale: number;
  searchQuery: string;
}

export function WmsMapCanvas({
  zones,
  racks,
  bins,
  selectedRackId,
  selectedZoneId,
  onSelectRack,
  onSelectZone,
  onOpenRackDetail,
  onOpenEditRackModal,
  onOpenEditZoneModal,
  onOpenCreateModal,
  onUpdatePositions,
  drawTool,
  snapToGrid,
  scale,
  searchQuery,
}: WmsMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 700 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const transformerRef = useRef<Konva.Transformer>(null);
  const { theme } = useWorkspaceStore();
  const isDark = theme === "dark";

  // Yangi element chizish holati (drag box)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawBox, setDrawBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Oyna o'lchamiga moslashish (ResizeObserver bilan)
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

  // Transformer tanlangan elementga (stelaj, yo'lak, darvoza, ustun yoki zona) ulanadi
  useEffect(() => {
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage();
      if (!stage) return;
      let selectedNode: Konva.Node | null = null;

      if (selectedRackId) {
        selectedNode = stage.findOne(`#rack-${selectedRackId}`) || null;
      } else if (selectedZoneId) {
        selectedNode = stage.findOne(`#zone-${selectedZoneId}`) || null;
      }

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      } else {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedRackId, selectedZoneId]);

  // Setka chiziqlari (Grid)
  const gridSize = 40;
  const gridLines = [];
  const maxX = 3000;
  const maxY = 2000;
  const gridStroke = isDark ? "#1e293b" : "#e2e8f0";
  for (let x = 0; x < maxX; x += gridSize) {
    gridLines.push(
      <Line key={`vl-${x}`} points={[x, 0, x, maxY]} stroke={gridStroke} strokeWidth={0.5} opacity={isDark ? 0.35 : 0.6} />
    );
  }
  for (let y = 0; y < maxY; y += gridSize) {
    gridLines.push(
      <Line key={`hl-${y}`} points={[0, y, maxX, y]} stroke={gridStroke} strokeWidth={0.5} opacity={isDark ? 0.35 : 0.6} />
    );
  }

  // Chizish hodisalari (Mouse events)
  const handleMouseDown = (e: any) => {
    if (drawTool === "select") {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        onSelectRack(null);
        onSelectZone(null);
      }
      return;
    }

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const x = (pointerPos.x - stagePos.x) / scale;
    const y = (pointerPos.y - stagePos.y) / scale;
    setIsDrawing(true);
    setDrawBox({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !drawBox) return;
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const x = (pointerPos.x - stagePos.x) / scale;
    const y = (pointerPos.y - stagePos.y) / scale;
    setDrawBox({ ...drawBox, currentX: x, currentY: y });
  };

  const handleMouseUp = () => {
    if (isDrawing && drawBox) {
      setIsDrawing(false);
      let left = Math.min(drawBox.startX, drawBox.currentX);
      let top = Math.min(drawBox.startY, drawBox.currentY);
      let width = Math.abs(drawBox.currentX - drawBox.startX);
      let depth = Math.abs(drawBox.currentY - drawBox.startY);

      if (snapToGrid) {
        left = Math.round(left / gridSize) * gridSize;
        top = Math.round(top / gridSize) * gridSize;
        width = Math.max(gridSize, Math.round(width / gridSize) * gridSize);
        depth = Math.max(gridSize, Math.round(depth / gridSize) * gridSize);
      }

      setDrawBox(null);
      if (width >= 30 && depth >= 30) {
        const createType = drawTool === "select" ? "rack" : drawTool;
        onOpenCreateModal(createType, { x: left, y: top, width, depth });
      }
    }
  };

  // Drag tamomlanganda koordinatalarni yangilash (Stelaj / Element)
  const handleRackDragEnd = (e: any, rack: WmsRack) => {
    let newX = e.target.x();
    let newY = e.target.y();
    if (snapToGrid) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
      e.target.position({ x: newX, y: newY });
    }
    onUpdatePositions([{ id: rack.id, x: newX, y: newY }]);
  };

  // Drag tamomlanganda zonani yangilash
  const handleZoneDragEnd = (e: any, zone: WmsZone) => {
    let newX = e.target.x();
    let newY = e.target.y();
    if (snapToGrid) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
      e.target.position({ x: newX, y: newY });
    }
    onUpdatePositions([{ id: zone.id, isZone: true, x: newX, y: newY }]);
  };

  // Transformer orqali element o'lchamini va burilishini o'zgartirish
  const handleTransformEnd = (e: any, element: WmsRack | WmsZone, isZone: boolean = false) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const oldWidth = isZone ? (element as WmsZone).width : (element as WmsRack).width;
    const oldHeight = isZone ? (element as WmsZone).height : (element as WmsRack).depth;

    let newWidth = Math.max(30, Math.round(oldWidth * scaleX));
    let newHeight = Math.max(25, Math.round(oldHeight * scaleY));
    let newRotation = Math.round(node.rotation() || 0);
    let newX = Math.round(node.x());
    let newY = Math.round(node.y());

    if (snapToGrid) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
      newWidth = Math.round(newWidth / gridSize) * gridSize;
      newHeight = Math.round(newHeight / gridSize) * gridSize;
    }

    if (isZone) {
      onUpdatePositions([
        {
          id: element.id,
          isZone: true,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        },
      ]);
    } else {
      onUpdatePositions([
        {
          id: element.id,
          x: newX,
          y: newY,
          width: newWidth,
          depth: newHeight,
          rotation: newRotation,
        },
      ]);
    }
  };

  // Chizish qutisining rangi
  const getDrawBoxColors = () => {
    if (drawTool === "zone") return { fill: "#2563eb", stroke: "#2563eb" };
    if (drawTool === "aisle") return { fill: "#64748b", stroke: "#64748b" };
    if (drawTool === "gate") return { fill: "#d97706", stroke: "#d97706" };
    if (drawTool === "obstacle") return { fill: "#475569", stroke: "#334155" };
    return { fill: "#3b82f6", stroke: "#2563eb" };
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full absolute inset-0 overflow-hidden bg-background select-none"
      style={{ cursor: drawTool === "select" ? "default" : "crosshair" }}
    >
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={drawTool === "select"}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          {/* Koordinata to'ri */}
          {gridLines}

          {/* 1. Zonalar (Sektorlar) — to'liq interaktiv */}
          {zones.map((zone) => {
            const isSelected = selectedZoneId === zone.id;
            return (
              <Group
                key={zone.id}
                id={`zone-${zone.id}`}
                x={zone.x}
                y={zone.y}
                draggable={drawTool === "select"}
                onDragEnd={(e) => handleZoneDragEnd(e, zone)}
                onTransformEnd={(e) => handleTransformEnd(e, zone, true)}
                onClick={() => {
                  onSelectRack(null);
                  onSelectZone(zone);
                }}
                onDblClick={() => onOpenEditZoneModal(zone)}
              >
                <Rect
                  width={zone.width}
                  height={zone.height}
                  fill={zone.color}
                  opacity={isSelected ? (isDark ? 0.16 : 0.12) : isDark ? 0.08 : 0.05}
                  stroke={isSelected ? "#3b82f6" : zone.color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  dash={isSelected ? undefined : [6, 4]}
                  cornerRadius={4}
                />
                <Rect
                  x={0}
                  y={0}
                  width={Math.min(180, zone.width)}
                  height={22}
                  fill={zone.color}
                  opacity={0.9}
                  cornerRadius={[4, 0, 4, 0]}
                />
                <Text
                  x={6}
                  y={5}
                  text={zone.name}
                  width={Math.min(170, zone.width - 12)}
                  ellipsis={true}
                  fontSize={10}
                  fontStyle="bold"
                  fill="#ffffff"
                />
              </Group>
            );
          })}

          {/* 2. Stelajlar va maxsus xarita obyektlari */}
          {racks.map((rack) => {
            const isSelected = selectedRackId === rack.id;
            const rackBins = bins.filter((b) => b.rackId === rack.id);
            const occupiedCount = rackBins.filter((b) => b.status === "full" || b.status === "partial").length;
            const occupancyPct = rackBins.length > 0 ? Math.round((occupiedCount / rackBins.length) * 100) : 0;

            const isMatchedQuery = searchQuery && (
              rack.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
              rack.name.toLowerCase().includes(searchQuery.toLowerCase())
            );

            // Rampa / Darvoza
            if (rack.type === "gate") {
              return (
                <Group
                  key={rack.id}
                  id={`rack-${rack.id}`}
                  x={rack.x}
                  y={rack.y}
                  rotation={rack.rotation || 0}
                  draggable={drawTool === "select"}
                  onDragEnd={(e) => handleRackDragEnd(e, rack)}
                  onTransformEnd={(e) => handleTransformEnd(e, rack, false)}
                  onClick={() => {
                    onSelectZone(null);
                    onSelectRack(rack);
                  }}
                  onDblClick={() => onOpenEditRackModal(rack)}
                >
                  <Rect
                    width={rack.width}
                    height={rack.depth}
                    fill={isDark ? "#78350f" : "#fef3c7"}
                    opacity={isSelected ? 0.9 : isDark ? 0.45 : 0.7}
                    stroke={isSelected ? "#3b82f6" : "#d97706"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    cornerRadius={3}
                  />
                  <Text
                    x={8}
                    y={Math.max(4, rack.depth / 2 - 6)}
                    width={rack.width - 16}
                    text={`RAMPA: ${rack.code}`}
                    fontSize={11}
                    fontStyle="bold"
                    fill={isDark ? "#fde68a" : "#b45309"}
                    ellipsis={true}
                  />
                </Group>
              );
            }

            // Yo'lak (Aisle / Floor Stack)
            if (rack.type === "aisle" || rack.type === "floor_stack") {
              return (
                <Group
                  key={rack.id}
                  id={`rack-${rack.id}`}
                  x={rack.x}
                  y={rack.y}
                  rotation={rack.rotation || 0}
                  draggable={drawTool === "select"}
                  onDragEnd={(e) => handleRackDragEnd(e, rack)}
                  onTransformEnd={(e) => handleTransformEnd(e, rack, false)}
                  onClick={() => {
                    onSelectZone(null);
                    onSelectRack(rack);
                  }}
                  onDblClick={() => onOpenEditRackModal(rack)}
                >
                  <Rect
                    width={rack.width}
                    height={rack.depth}
                    fill={isSelected ? (isDark ? "#334155" : "#e2e8f0") : isDark ? "#1e293b" : "#f1f5f9"}
                    opacity={isSelected ? 0.75 : isDark ? 0.5 : 0.6}
                    stroke={isSelected ? "#3b82f6" : isDark ? "#475569" : "#cbd5e1"}
                    strokeWidth={isSelected ? 2 : 1}
                    dash={[8, 6]}
                    cornerRadius={2}
                  />
                  <Text
                    x={10}
                    y={Math.max(4, rack.depth / 2 - 5)}
                    width={rack.width - 20}
                    align="center"
                    text={`↔ ${rack.name || "TRANSPORT YO'LAGI"} ↔`}
                    fontSize={10}
                    fontStyle="bold"
                    fill={isSelected ? (isDark ? "#60a5fa" : "#2563eb") : isDark ? "#94a3b8" : "#64748b"}
                    ellipsis={true}
                  />
                </Group>
              );
            }

            // To'siq / Ustun
            if (rack.type === "obstacle") {
              return (
                <Group
                  key={rack.id}
                  id={`rack-${rack.id}`}
                  x={rack.x}
                  y={rack.y}
                  rotation={rack.rotation || 0}
                  draggable={drawTool === "select"}
                  onDragEnd={(e) => handleRackDragEnd(e, rack)}
                  onTransformEnd={(e) => handleTransformEnd(e, rack, false)}
                  onClick={() => {
                    onSelectZone(null);
                    onSelectRack(rack);
                  }}
                  onDblClick={() => onOpenEditRackModal(rack)}
                >
                  <Rect
                    width={rack.width}
                    height={rack.depth}
                    fill={isSelected ? "#ef4444" : isDark ? "#334155" : "#64748b"}
                    stroke={isSelected ? "#ffffff" : isDark ? "#475569" : "#334155"}
                    strokeWidth={isSelected ? 2 : 1.5}
                    cornerRadius={2}
                  />
                  <Text
                    x={2}
                    y={Math.max(2, rack.depth / 2 - 4)}
                    width={rack.width - 4}
                    align="center"
                    text={rack.code || "USTUN"}
                    fontSize={8}
                    fontStyle="bold"
                    fill="#ffffff"
                    ellipsis={true}
                  />
                </Group>
              );
            }

            // Standart Stelaj (Palet, Polka, Konsol, Rulon)
            const bays = rack.baysCount || 4;
            const bayWidth = rack.width / bays;

            let rackColor = "#64748b"; // Bo'sh
            if (occupancyPct >= 80) rackColor = "#f43f5e"; // To'la
            else if (occupancyPct > 0) rackColor = "#10b981"; // Qisman

            return (
              <Group
                key={rack.id}
                id={`rack-${rack.id}`}
                x={rack.x}
                y={rack.y}
                rotation={rack.rotation || 0}
                draggable={drawTool === "select"}
                onDragEnd={(e) => handleRackDragEnd(e, rack)}
                onTransformEnd={(e) => handleTransformEnd(e, rack, false)}
                onClick={() => {
                  onSelectZone(null);
                  onSelectRack(rack);
                }}
                onDblClick={() => onOpenRackDetail(rack)}
              >
                {/* Asosiy stelaj ramkasi */}
                <Rect
                  width={rack.width}
                  height={rack.depth}
                  fill={isDark ? "#1e293b" : "#ffffff"}
                  stroke={isSelected ? "#3b82f6" : isMatchedQuery ? "#f43f5e" : isDark ? "#334155" : "#cbd5e1"}
                  strokeWidth={isSelected ? 2.5 : isMatchedQuery ? 2 : 1}
                  cornerRadius={3}
                  shadowColor="#000000"
                  shadowBlur={isSelected ? 6 : 2}
                  shadowOpacity={isDark ? 0.35 : 0.1}
                />

                {/* Kataklar bo'linmasi */}
                {Array.from({ length: bays }).map((_, i) => (
                  <Rect
                    key={`bay-${i}`}
                    x={i * bayWidth}
                    y={0}
                    width={bayWidth}
                    height={rack.depth}
                    stroke={isDark ? "#334155" : "#e2e8f0"}
                    strokeWidth={0.8}
                    fill={
                      i % 2 === 0
                        ? isDark
                          ? "#0f172a"
                          : "#f8fafc"
                        : isDark
                        ? "#1e293b"
                        : "#ffffff"
                    }
                  />
                ))}

                {/* Bandlik progress bar chizig'i (yuqori chetida) */}
                <Rect
                  x={0}
                  y={0}
                  width={(rack.width * occupancyPct) / 100}
                  height={3}
                  fill={rackColor}
                />

                {/* Stelaj kodi va ma'lumotlari */}
                <Rect
                  x={4}
                  y={6}
                  width={34}
                  height={16}
                  fill={isSelected ? "#2563eb" : isDark ? "#0f172a" : "#0f172a"}
                  cornerRadius={2}
                />
                <Text
                  x={7}
                  y={9}
                  text={rack.code}
                  fontSize={10}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill="#ffffff"
                />

                <Text
                  x={42}
                  y={8}
                  text={rack.name}
                  width={Math.max(20, rack.width - 46)}
                  fontSize={10}
                  fontStyle="bold"
                  fill={isDark ? "#f8fafc" : "#1e293b"}
                  ellipsis={true}
                />

                <Text
                  x={6}
                  y={Math.max(10, rack.depth - 16)}
                  text={`${rack.levelsCount} qavat · ${occupancyPct}% band`}
                  fontSize={9}
                  fontFamily="monospace"
                  fill={isDark ? "#94a3b8" : "#64748b"}
                />
              </Group>
            );
          })}

          {/* Tanlangan element Transformer'i */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={!selectedZoneId}
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 30 || newBox.height < 25) {
                return oldBox;
              }
              return newBox;
            }}
          />

          {/* Jonli chizish to'rtburchagi */}
          {isDrawing && drawBox && (
            <Rect
              x={Math.min(drawBox.startX, drawBox.currentX)}
              y={Math.min(drawBox.startY, drawBox.currentY)}
              width={Math.abs(drawBox.currentX - drawBox.startX)}
              height={Math.abs(drawBox.currentY - drawBox.startY)}
              fill={getDrawBoxColors().fill}
              opacity={0.2}
              stroke={getDrawBoxColors().stroke}
              strokeWidth={1.5}
              dash={[4, 4]}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
