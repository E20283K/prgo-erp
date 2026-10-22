"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  RotateCw,
  Download,
  FileDown,
  Sparkles,
  Percent,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  FlaskConical,
  Cog,
  Ruler,
  Eye,
  Disc,
  Play,
  Pause,
  LayoutTemplate,
  Sliders,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";

import {
  FlexoInputs,
  FlexoLayoutResult,
  FlexoRenderOptions,
  FlexoCylinderRecommendation,
} from "@/lib/flexo/types";
import { JR_1521_CYLINDERS, FLEXO_MACHINES, FLEXO_MATERIALS } from "@/lib/flexo/masterData";
import { calculateFlexoLayout, findCylinderCandidates } from "@/lib/flexo/calculator";
import { renderFlexoSVG } from "@/lib/flexo/svgRenderer";
import { renderFlexoCylinder2DSVG } from "@/lib/flexo/cylinder2DRenderer";
import { exportFlexoPDF } from "@/lib/flexo/pdfExport";

interface Props {
  defaultQuantity: number;
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
  defaultProdW?: number;
  defaultProdH?: number;
  defaultBleed?: number;
  shapeType?: any;
  customShape?: any;
  customSvgPath?: string;
  cornerType?: string;
  onAuditLog?: (action: string, detail: string) => void;
  onFlexoSave?: (result: FlexoLayoutResult) => void;
  onSwitchTab?: (tabKey: string) => void;
}

export function FlexoCalcTab({
  defaultQuantity = 10000,
  docNo = "CO-NEW",
  orderName = "Flexo Order",
  customer = "Client",
  productName = "Care Label",
  defaultProdW = 30,
  defaultProdH = 65,
  defaultBleed = 1.5,
  onAuditLog,
  onFlexoSave,
  onSwitchTab,
}: Props) {
  // Prepress & Machine Inputs
  const [machineId, setMachineId] = useState<string>("JR-1521");
  const [materialId, setMaterialId] = useState<string>("satin-white");

  // Initial dimensions: ensure product fits standard web width
  const initialProdW = defaultProdW && defaultProdW > 0 ? defaultProdW : 30;
  const initialProdH = defaultProdH && defaultProdH > 0 ? defaultProdH : 65;
  const initialWebW = Math.max(35, Math.ceil((initialProdW + 6) / 5) * 5);

  const [webWidth, setWebWidth] = useState<number>(initialWebW);
  const [sideMarginLeft, setSideMarginLeft] = useState<number>(1.5);
  const [sideMarginRight, setSideMarginRight] = useState<number>(1.5);

  const [prodW, setProdW] = useState<number>(initialProdW);
  const [prodH, setProdH] = useState<number>(initialProdH);
  const [orientation, setOrientation] = useState<"normal" | "rotated">("normal");

  const [bleedX, setBleedX] = useState<number>(defaultBleed !== undefined ? defaultBleed : 1.0);
  const [bleedY, setBleedY] = useState<number>(defaultBleed !== undefined ? defaultBleed : 1.0);
  const [gapX, setGapX] = useState<number>(2.0);
  const [gapY, setGapY] = useState<number>(2.5);

  // Default to 100T cylinder (271.07 mm repeat, 82.78 mm diameter)
  const [cylinderTeeth, setCylinderTeeth] = useState<number>(100);
  const [plateThickness, setPlateThickness] = useState<number>(1.7);
  const [colors, setColors] = useState<number>(4);

  // Overproduction
  const [overproductionMode, setOverproductionMode] = useState<"percent" | "exact">("percent");
  const [overproductionValue, setOverproductionValue] = useState<number>(5);
  const [baseQuantity, setBaseQuantity] = useState<number>(defaultQuantity || 10000);

  // Preview Mode: Flat Web vs 2D Cylinder Engineering Drawing
  const [previewType, setPreviewType] = useState<"flat" | "cylinder">("flat");
  const [displayOrientation, setDisplayOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [cylinderRotation, setCylinderRotation] = useState<number>(0);
  const [isAutoSpinning, setIsAutoSpinning] = useState<boolean>(false);

  // SVG Viewer States
  const [viewMode, setViewMode] = useState<"production" | "plate" | "technical">("production");
  const [repeatMode, setRepeatMode] = useState<"single" | "run">("single");
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showMarks, setShowMarks] = useState<boolean>(true);
  const [showGaps, setShowGaps] = useState<boolean>(true);
  const [showPlate, setShowPlate] = useState<boolean>(false);
  const [activeColorSeparation, setActiveColorSeparation] = useState<string>("all");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Optimizer modal
  const [showOptimizer, setShowOptimizer] = useState<boolean>(false);
  const [cylinderComboboxOpen, setCylinderComboboxOpen] = useState<boolean>(false);
  const [webWidthComboboxOpen, setWebWidthComboboxOpen] = useState<boolean>(false);

  // Selected Machine & Material
  const selectedMachine = useMemo(
    () => FLEXO_MACHINES.find((m) => m.id === machineId) || FLEXO_MACHINES[0],
    [machineId]
  );
  const selectedMaterial = useMemo(
    () => FLEXO_MATERIALS.find((m) => m.id === materialId) || FLEXO_MATERIALS[0],
    [materialId]
  );

  // Sync inputs from props
  useEffect(() => {
    if (defaultQuantity > 0) setBaseQuantity(defaultQuantity);
  }, [defaultQuantity]);

  useEffect(() => {
    if (defaultProdW && defaultProdW > 0) {
      setProdW(defaultProdW);
      // Auto-adjust web width if product + bleed exceeds current web width
      const minNeeded = defaultProdW + 5;
      if (webWidth < minNeeded) {
        const candidate = selectedMaterial.standardWidths.find((w) => w >= minNeeded) || Math.ceil(minNeeded / 10) * 10;
        setWebWidth(candidate);
      }
    }
  }, [defaultProdW, selectedMaterial, webWidth]);

  useEffect(() => {
    if (defaultProdH && defaultProdH > 0) setProdH(defaultProdH);
  }, [defaultProdH]);

  // Cylinder 3D rotation animation
  useEffect(() => {
    if (!isAutoSpinning || previewType !== "cylinder") return;
    const interval = setInterval(() => {
      setCylinderRotation((prev) => (prev + 2) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, [isAutoSpinning, previewType]);

  // Auto-fit web width function
  const handleAutoFitWeb = () => {
    const placedW = orientation === "normal" ? prodW : prodH;
    const requiredMin = placedW + bleedX * 2 + sideMarginLeft + sideMarginRight;
    const candidate =
      selectedMaterial.standardWidths.find((w) => w >= requiredMin) ||
      Math.ceil(requiredMin / 5) * 5;
    setWebWidth(candidate);
    if (onAuditLog) {
      onAuditLog("Auto-Fit Web Width", `${webWidth}mm -> ${candidate}mm`);
    }
  };

  // Handle Material change
  const handleMaterialChange = (newMatId: string) => {
    setMaterialId(newMatId);
    const mat = FLEXO_MATERIALS.find((m) => m.id === newMatId);
    if (mat) {
      const placedW = orientation === "normal" ? prodW : prodH;
      const minReq = placedW + bleedX * 2 + sideMarginLeft + sideMarginRight;
      const matchingWidth = mat.standardWidths.find((w) => w >= minReq) || mat.defaultWebWidth;
      setWebWidth(matchingWidth);
      if (onAuditLog) {
        onAuditLog("Material Changed", `${mat.name} (${matchingWidth}mm)`);
      }
    }
  };

  // Build inputs object
  const inputs: FlexoInputs = useMemo(
    () => ({
      machineId,
      materialId,
      webWidth,
      sideMarginLeft,
      sideMarginRight,
      productWidth: prodW,
      productHeight: prodH,
      orientation,
      bleedX,
      bleedY,
      gapX,
      gapY,
      cylinderTeeth,
      plateThickness,
      colors,
      requiredQuantity: baseQuantity,
      overproductionMode,
      overproductionValue,
    }),
    [
      machineId,
      materialId,
      webWidth,
      sideMarginLeft,
      sideMarginRight,
      prodW,
      prodH,
      orientation,
      bleedX,
      bleedY,
      gapX,
      gapY,
      cylinderTeeth,
      plateThickness,
      colors,
      baseQuantity,
      overproductionMode,
      overproductionValue,
    ]
  );

  // Calculate layout result
  const layoutResult: FlexoLayoutResult = useMemo(() => {
    return calculateFlexoLayout(inputs);
  }, [inputs]);

  // Notify parent safely in effect
  useEffect(() => {
    if (onFlexoSave) {
      onFlexoSave(layoutResult);
    }
  }, [layoutResult, onFlexoSave]);

  // Cylinder candidate recommendations
  const cylinderRecommendations: FlexoCylinderRecommendation[] = useMemo(() => {
    return findCylinderCandidates(
      {
        productWidth: prodW,
        productHeight: prodH,
        orientation,
        bleedY,
        gapY,
      },
      selectedMachine.availableCylinders
    );
  }, [prodW, prodH, orientation, bleedY, gapY, selectedMachine]);

  // SVG Render Options
  const renderOptions: FlexoRenderOptions = useMemo(
    () => ({
      view: viewMode,
      previewType,
      displayOrientation,
      cylinderRotation,
      repeatMode,
      previewRepeats: 3,
      showDimensions,
      showMarks,
      showGaps,
      showPlate,
      activeColorSeparation,
    }),
    [
      viewMode,
      previewType,
      displayOrientation,
      cylinderRotation,
      repeatMode,
      showDimensions,
      showMarks,
      showGaps,
      showPlate,
      activeColorSeparation,
    ]
  );

  // Generate SVG string (Flat Web or 2D Cylinder Engineering Drawing)
  const svgContent = useMemo(() => {
    const meta = { docNo, orderName, customer, productName };
    if (previewType === "cylinder") {
      return renderFlexoCylinder2DSVG(layoutResult, renderOptions, meta);
    }
    return renderFlexoSVG(layoutResult, renderOptions, meta);
  }, [previewType, layoutResult, renderOptions, docNo, orderName, customer, productName]);

  // Handle Exports
  const handleDownloadSVG = () => {
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Flexo_${previewType === "cylinder" ? "Cylinder" : "Layout"}_${docNo}_${cylinderTeeth}T.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onAuditLog) onAuditLog("Exported SVG", `${docNo} (${cylinderTeeth}T)`);
  };

  const handleDownloadPDF = () => {
    exportFlexoPDF(layoutResult, {
      docNo,
      orderName,
      customer,
      productName,
    });
    if (onAuditLog) onAuditLog("Exported PDF Spec", `${docNo} (${cylinderTeeth}T)`);
  };

  const handleApplyRecommendedCylinder = (rec: FlexoCylinderRecommendation) => {
    setCylinderTeeth(rec.cylinder.teeth);
    setShowOptimizer(false);
    if (onAuditLog) {
      onAuditLog("Optimized Cylinder Applied", `${rec.cylinder.teeth}T (Fit: ${rec.verticalFitEfficiency}%)`);
    }
  };

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden text-xs">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: FLEXO PREPRESS & CALCULATION INPUTS
      ───────────────────────────────────────────────────────────── */}
      <div className="w-[410px] shrink-0 bg-card border border-border rounded-lg flex flex-col overflow-hidden shadow-xs">
        {/* Panel Header */}
        <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Cog className="w-4 h-4 text-blue-600" />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-foreground text-xs leading-none">Flexo Layout Engine</h2>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] font-normal py-0 px-1">
                  Reja &amp; Simulyatsiya
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Narrow-Web Cylinder Repeat (Faqat rejalashtirish)</span>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] ${layoutResult.acrossCount > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {layoutResult.acrossCount > 0 ? `${layoutResult.acrossCount} across × ${layoutResult.aroundCount} around` : "0 across (Exceeds Web)"}
          </Badge>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Quick Auto-Fit Action if Product Exceeds Web */}
          {layoutResult.acrossCount === 0 && (
            <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Product exceeds web width ({prodW}mm &gt; {webWidth}mm)</span>
              </div>
              <p className="text-[10px] text-red-600 dark:text-red-400">
                The product plus bleed does not fit on the current {webWidth}mm web width.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleAutoFitWeb}
                className="h-6 w-full text-[10px] bg-red-600 hover:bg-red-700 text-white font-semibold gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Auto-Fit Web Width Now
              </Button>
            </div>
          )}

          {/* Section 1: Machine & Substrate */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-blue-600" />
              Machine & Material Substrate
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">Press</label>
                <Select value={machineId} onValueChange={(val) => val && setMachineId(val)}>
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLEXO_MACHINES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">Substrate</label>
                <Select value={materialId} onValueChange={(val) => val && handleMaterialChange(val)}>
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLEXO_MATERIALS.map((mat) => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Web Width with Searchable Combobox & Auto-Fit */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Web Width (mm)</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500">
                    Usable: {layoutResult.usablePrintWidth} mm
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoFitWeb}
                    className="text-[9px] font-semibold text-blue-600 hover:underline px-1"
                  >
                    Auto-Fit
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Searchable Web Width Combobox */}
                <div className="flex-1">
                  <Popover open={webWidthComboboxOpen} onOpenChange={setWebWidthComboboxOpen}>
                    <PopoverTrigger
                      type="button"
                      role="combobox"
                      aria-expanded={webWidthComboboxOpen}
                      className="w-full h-7 text-xs bg-background font-mono font-medium justify-between px-2 flex items-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer shadow-xs transition-colors"
                    >
                      <span className="truncate">
                        {webWidth} mm {selectedMaterial.standardWidths.includes(webWidth) ? "(Standard Ribbon)" : "(Custom Width)"}
                      </span>
                      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0 shadow-lg" align="start">
                      <Command>
                        <CommandInput placeholder="Search width (e.g. 20, 60)..." className="h-8 text-xs" />
                        <CommandList className="max-h-56">
                          <CommandEmpty>No preset found.</CommandEmpty>
                          <CommandGroup heading="Standard Material Widths">
                            {selectedMaterial.standardWidths.map((w) => {
                              const isSelected = w === webWidth;
                              return (
                                <CommandItem
                                  key={w}
                                  value={`${w}mm ${w}`}
                                  onSelect={() => {
                                    setWebWidth(w);
                                    setWebWidthComboboxOpen(false);
                                  }}
                                  className="text-xs cursor-pointer flex items-center justify-between py-1.5 px-2 font-mono"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{w} mm</span>
                                    <span className="text-[10px] text-muted-foreground">Standard roll</span>
                                  </div>
                                  <Check
                                    className={`h-3.5 w-3.5 text-blue-600 ${
                                      isSelected ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Direct Manual Numeric Input */}
                <div className="w-20">
                  <Input
                    type="number"
                    min={5}
                    value={webWidth}
                    onChange={(e) => setWebWidth(Math.max(1, Number(e.target.value)))}
                    className="h-7 text-xs bg-background font-mono text-center font-semibold"
                    title="Direct numeric entry"
                  />
                </div>
              </div>
            </div>

            {/* Side Margins */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">Margin L (mm)</label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={sideMarginLeft}
                  onChange={(e) => setSideMarginLeft(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-xs bg-background"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">Margin R (mm)</label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={sideMarginRight}
                  onChange={(e) => setSideMarginRight(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Product Dimensions (SSOT) & Flexo Gaps */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-blue-600" />
                Product Specs (SSOT) & Gaps
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOrientation(orientation === "normal" ? "rotated" : "normal")}
                className="h-6 text-[10px] px-1.5 gap-1 font-mono cursor-pointer"
              >
                <RotateCw className="w-2.5 h-2.5" />
                {orientation === "normal" ? "Normal (0°)" : "Rotated (90°)"}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-background border border-border">
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono">
                  {prodW} × {prodH} mm
                </Badge>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono">
                  Bleed: {bleedX} mm
                </Badge>
              </div>
              {onSwitchTab && (
                <button
                  type="button"
                  onClick={() => onSwitchTab("specs")}
                  className="text-[10px] text-primary hover:underline font-medium cursor-pointer shrink-0"
                >
                  Edit in Specs →
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                Flexo Step Gaps X / Y (mm)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step={0.5}
                  value={gapX}
                  onChange={(e) => setGapX(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-xs bg-background text-center px-1 font-mono"
                  title="Horizontal Gap across Web (X)"
                />
                <Input
                  type="number"
                  step={0.5}
                  value={gapY}
                  onChange={(e) => setGapY(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-xs bg-background text-center px-1 font-mono"
                  title="Vertical Repeat Gap along Web (Y)"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Cylinder & Gear Selection */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                <Cog className="w-3.5 h-3.5 text-blue-600" />
                Cylinder & Gear System
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowOptimizer(!showOptimizer)}
                className="h-6 text-[10px] px-2 gap-1 text-blue-700 dark:text-blue-300 border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                {showOptimizer ? "Hide Optimizer" : "Suggest Cylinder"}
              </Button>
            </div>

            {/* Cylinder Combobox with Search */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                  Select Gear Teeth (T)
                </label>
                <Popover open={cylinderComboboxOpen} onOpenChange={setCylinderComboboxOpen}>
                  <PopoverTrigger
                    type="button"
                    role="combobox"
                    aria-expanded={cylinderComboboxOpen}
                    className="w-full h-7 text-xs bg-background font-mono font-medium justify-between px-2 flex items-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer shadow-xs transition-colors"
                  >
                    <span className="truncate">
                      {cylinderTeeth}T — {layoutResult.printingLength}mm (Ø {layoutResult.cylinderDiameter}mm)
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[310px] p-0 shadow-lg" align="start">
                    <Command>
                      <CommandInput placeholder="Search teeth (e.g. 50, 100), repeat, diameter..." className="h-8 text-xs" />
                      <CommandList className="max-h-60">
                        <CommandEmpty>No cylinder found.</CommandEmpty>
                        <CommandGroup heading="Available Cylinders (JR-1521 Data)">
                          {selectedMachine.availableCylinders.map((cyl) => {
                            const isSelected = cyl.teeth === cylinderTeeth;
                            return (
                              <CommandItem
                                key={cyl.teeth}
                                value={`${cyl.teeth}T ${cyl.printingLength}mm ${cyl.cylinderDiameter}mm`}
                                onSelect={() => {
                                  setCylinderTeeth(cyl.teeth);
                                  setCylinderComboboxOpen(false);
                                  if (onAuditLog) {
                                    onAuditLog("Cylinder Changed", `${cylinderTeeth}T -> ${cyl.teeth}T`);
                                  }
                                }}
                                className="text-xs cursor-pointer flex items-center justify-between py-1.5 px-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-foreground w-9">{cyl.teeth}T</span>
                                  <span className="text-muted-foreground text-[11px]">
                                    Repeat: <strong className="text-foreground">{cyl.printingLength}mm</strong> (Ø {cyl.cylinderDiameter}mm)
                                  </span>
                                  {cyl.needsVerification && (
                                    <span className="text-[10px] text-amber-500 font-semibold" title="Human verification recommended">
                                      ⚠ Check
                                    </span>
                                  )}
                                </div>
                                <Check
                                  className={`h-3.5 w-3.5 text-blue-600 ${
                                    isSelected ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="w-24">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                  Plate (mm)
                </label>
                <Input
                  type="number"
                  step={0.1}
                  value={plateThickness}
                  onChange={(e) => setPlateThickness(Number(e.target.value))}
                  className="h-7 text-xs bg-background font-mono text-center"
                />
              </div>
            </div>

            {/* Cylinder Technical Parameters Card */}
            <div className="grid grid-cols-4 gap-1 p-2 rounded bg-background border border-border text-[10px]">
              <div>
                <span className="text-muted-foreground block text-[9px] uppercase">Cylinder Ø</span>
                <span className="font-semibold font-mono text-foreground">{layoutResult.cylinderDiameter} mm</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[9px] uppercase">Repeat Len</span>
                <span className="font-semibold font-mono text-blue-600">{layoutResult.printingLength} mm</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[9px] uppercase">Film Len</span>
                <span className="font-semibold font-mono text-foreground">{layoutResult.filmLength} mm</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[9px] uppercase">Pitch Circle</span>
                <span className="font-semibold font-mono text-foreground">{layoutResult.pitchCircleDiameter} mm</span>
              </div>
            </div>

            {/* Optimizer Recommendations Drawer */}
            {showOptimizer && (
              <div className="p-2 border border-blue-300 dark:border-blue-800 rounded bg-blue-50/80 dark:bg-blue-950/50 space-y-1.5 mt-1">
                <span className="font-semibold text-blue-900 dark:text-blue-200 text-[10px] block">
                  Top Recommended Cylinders (Minimal Waste):
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {cylinderRecommendations.slice(0, 4).map((rec) => (
                    <div
                      key={rec.cylinder.teeth}
                      onClick={() => handleApplyRecommendedCylinder(rec)}
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer border text-[10px] transition-all ${
                        rec.cylinder.teeth === cylinderTeeth
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-background text-foreground border-border hover:bg-blue-100/60 dark:hover:bg-blue-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono">{rec.cylinder.teeth}T</span>
                        <span className="opacity-80 font-mono text-[9px]">Repeat: {rec.cylinder.printingLength}mm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px]">{rec.aroundCount} around</span>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[9px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          {rec.verticalFitEfficiency}% fit
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Production Quantities & Overproduction */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                Order Quantity & Overproduction
              </span>
              <div className="flex bg-muted rounded p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setOverproductionMode("percent")}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    overproductionMode === "percent" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setOverproductionMode("exact")}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    overproductionMode === "exact" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Exact pcs
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                  Order Qty (SSOT)
                </label>
                <div className="h-7 px-2 rounded border border-border bg-muted/50 flex items-center justify-between text-xs font-mono font-semibold text-foreground">
                  <span>{baseQuantity.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">pcs</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                  Allowance ({overproductionMode === "percent" ? "%" : "pcs"})
                </label>
                <Input
                  type="number"
                  min={0}
                  value={overproductionValue}
                  onChange={(e) => setOverproductionValue(Math.max(0, Number(e.target.value)))}
                  className="h-7 text-xs bg-background font-mono"
                />
              </div>
            </div>
          </div>

          {/* Warnings List */}
          {layoutResult.warnings.length > 0 && (
            <div className="space-y-1">
              {layoutResult.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-[10px] flex items-start gap-1.5 border ${
                    w.severity === "error"
                      ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                      : w.severity === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-tight">{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Production Summary Footer */}
        <div className="bg-muted/50 p-2.5 space-y-1.5 shrink-0 border-t border-border">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Total Production Yield</span>
            <span className="font-semibold text-sm text-foreground font-mono">
              {layoutResult.actualYieldQuantity.toLocaleString()} pcs
            </span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Cylinder Revolutions</span>
            <span className="font-medium text-foreground font-mono">
              {layoutResult.repeatCount.toLocaleString()} revs ({layoutResult.totalPerRepeat} pcs/rev)
            </span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Linear Substrate Run</span>
            <span className="font-medium text-foreground font-mono">
              {layoutResult.materialConsumptionMeters.toLocaleString()} m ({layoutResult.materialConsumptionSqM} m²)
            </span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">Substrate Efficiency / Trim Waste</span>
            <span className="font-medium font-mono text-foreground">
              {layoutResult.yieldPercent}% usable · {layoutResult.sideWasteWidth} mm trim
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: INTERACTIVE SVG VIEWER & EXPORT ACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col overflow-hidden relative shadow-xs">
        {/* Top Control Bar with Preview Type Switcher, Toggles & Export Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-border mb-2 shrink-0 flex-wrap gap-2">
          {/* Main Mode: Flat Web vs 3D Cylinder Roller */}
          <div className="flex items-center gap-1.5">
            <div className="flex bg-card border border-border rounded-md shadow-xs p-0.5">
              <button
                type="button"
                onClick={() => setPreviewType("flat")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  previewType === "flat"
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>Flat Web</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewType("cylinder")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  previewType === "cylinder"
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Disc className="w-3.5 h-3.5 text-cyan-300" />
                <span>Cylinder</span>
              </button>
            </div>

            {/* Flat Web Orientation: Horizontal vs Vertical */}
            {previewType === "flat" && (
              <div className="flex bg-card border border-border rounded-md shadow-xs p-0.5">
                <button
                  type="button"
                  onClick={() => setDisplayOrientation("horizontal")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                    displayOrientation === "horizontal"
                      ? "bg-zinc-800 text-white dark:bg-zinc-700 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Horizontal (Feed Left to Right)"
                >
                  <MoveHorizontal className="w-3 h-3" />
                  <span>Horizontal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayOrientation("vertical")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                    displayOrientation === "vertical"
                      ? "bg-zinc-800 text-white dark:bg-zinc-700 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Vertical (Feed Top to Bottom)"
                >
                  <MoveVertical className="w-3 h-3" />
                  <span>Vertical</span>
                </button>
              </div>
            )}

            {/* View Mode Selector */}
            <div className="flex bg-card border border-border rounded-md shadow-xs p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("production")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  viewMode === "production" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Production
              </button>
              {previewType === "flat" && (
                <button
                  type="button"
                  onClick={() => setViewMode("plate")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    viewMode === "plate" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Plate Prepress
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode("technical")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  viewMode === "technical" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Technical
              </button>
            </div>

            {/* 1 Repeat vs Preview Run Mode (Flat Web only) */}
            {previewType === "flat" && (
              <div className="flex bg-card border border-border rounded-md shadow-xs p-0.5">
                <button
                  type="button"
                  onClick={() => setRepeatMode("single")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    repeatMode === "single" ? "bg-zinc-800 text-white dark:bg-zinc-700 shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  1 Repeat
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatMode("run")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    repeatMode === "run" ? "bg-zinc-800 text-white dark:bg-zinc-700 shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Preview Run (3x)
                </button>
              </div>
            )}
          </div>

          {/* Quick Visibility Toggles & Zoom Controls */}
          <div className="flex items-center gap-1.5">
            {/* Dimensions Toggle */}
            <Button
              variant={showDimensions ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDimensions(!showDimensions)}
              className={`h-7 px-2 text-[10px] font-medium gap-1 ${showDimensions ? "bg-slate-800 text-white" : ""}`}
              title="Toggle Dimensions"
            >
              <Ruler className="w-3 h-3" />
              <span className="hidden sm:inline">Dim</span>
            </Button>

            {previewType === "flat" && (
              <>
                <Button
                  variant={showMarks ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowMarks(!showMarks)}
                  className={`h-7 px-2 text-[10px] font-medium gap-1 ${showMarks ? "bg-slate-800 text-white" : ""}`}
                  title="Toggle Registration Marks"
                >
                  <Eye className="w-3 h-3" />
                  <span className="hidden sm:inline">Marks</span>
                </Button>

                <Button
                  variant={showGaps ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowGaps(!showGaps)}
                  className={`h-7 px-2 text-[10px] font-medium gap-1 ${showGaps ? "bg-slate-800 text-white" : ""}`}
                  title="Toggle Gap Indicators"
                >
                  <span className="font-mono text-[9px] font-bold">X/Y</span>
                </Button>
              </>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center bg-card border border-border rounded-md shadow-xs p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setZoomLevel((prev) => Math.max(50, prev - 15))}
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="px-1.5 font-mono text-[10px] text-muted-foreground w-11 text-center">
                {zoomLevel}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setZoomLevel((prev) => Math.min(250, prev + 15))}
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setZoomLevel(100)}
                title="Reset Zoom"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Export Buttons */}
            <Button onClick={handleDownloadSVG} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>SVG</span>
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF Spec</span>
            </Button>
          </div>
        </div>

        {/* Cylinder Roller Sub-Bar: Interactive 360 Rotation Slider & Controls (Clean Neutral Theme) */}
        {previewType === "cylinder" && (
          <div className="flex items-center justify-between pb-2 border-b border-border shrink-0 text-[10px] bg-muted/40 p-2 rounded-md mb-2">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="font-semibold text-foreground whitespace-nowrap flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5 text-blue-600" /> Rotate Cylinder:
              </span>
              <input
                type="range"
                min="0"
                max="360"
                value={cylinderRotation}
                onChange={(e) => setCylinderRotation(Number(e.target.value))}
                className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg"
              />
              <span className="font-mono font-bold text-foreground w-10 text-right">
                {Math.round(cylinderRotation)}°
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={isAutoSpinning ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAutoSpinning(!isAutoSpinning)}
                className={`h-6 text-[10px] px-2 gap-1 ${isAutoSpinning ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
              >
                {isAutoSpinning ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                <span>{isAutoSpinning ? "Pause" : "Auto-Spin"}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Color Separations Sub-Bar (When multiple colors configured) */}
        {layoutResult.colors.length > 1 && (
          <div className="flex items-center gap-1 pb-2 border-b border-border/50 shrink-0 text-[10px]">
            <span className="text-muted-foreground mr-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Color Plates:
            </span>
            <button
              type="button"
              onClick={() => setActiveColorSeparation("all")}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                activeColorSeparation === "all" ? "bg-zinc-800 text-white dark:bg-zinc-700" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              All Plates
            </button>
            {layoutResult.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setActiveColorSeparation(c.name)}
                className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors ${
                  activeColorSeparation === c.name
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.colorCode }} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Visual Canvas Display: Clean SVG Canvas (Flat Web & 2D Technical Drawing) */}
        <div className="flex-1 flex items-center justify-center p-3 relative overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div
            className="transition-transform duration-150 ease-out origin-center flex items-center justify-center w-full max-h-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[70vh] [&>svg]:rounded-md [&>svg]:shadow-md"
            style={{ transform: `scale(${zoomLevel / 100})` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
    </div>
  );
}
