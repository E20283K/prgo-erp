import { useState, useMemo, useEffect, useRef } from "react";
import {
  KashirovkaMode,
  KashirovkaImpositionStrategy,
  getDefaultKashirovkaLayers,
  calculateKashirovkaTotals,
  parseModelAndSize,
} from "../../types";
import { 
  LayoutCalcTabProps, 
  PlateConfig, 
  GridCell, 
  GripperEdge, 
  Orientation, 
  OverproductionMode,
  LayoutCalcMode,
  SampleStockSource,
  PRECUT_STOCK_PRESETS,
  PrecutStockPreset,
  ParentCutResult,
  KashirovkaSummary,
  PlatePartitionStrategy,
} from "./types";
import {
  calculatePrepressMargins, 
  calculateImposition, 
  calculatePlateDistribution, 
  calculateOuterTrimMarks,
  calculateParentSheetCuts,
  buildPartitionedPlates,
} from "./engine";
import { exportSvg, exportPdf } from "./export";
import {
  calculatePrintPlanning,
  PrintMethod,
  PrintPlanningResult,
} from "../../planningEngine";

const COLOR_PALETTE = [
  "#dbeafe", // Blue
  "#dcfce7", // Emerald
  "#fef3c7", // Amber
  "#f3e8ff", // Purple
  "#fce7f3", // Pink
  "#ccfbf1", // Teal
  "#ffedd5", // Orange
  "#e0e7ff", // Indigo
  "#fae8ff", // Fuchsia
  "#ecfccb", // Lime
  "#cffafe", // Cyan
  "#ffe4e6", // Rose
];

export function useLayoutCalc({
  sizes = [],
  defaultQuantity,
  docNo = "CO-NEW",
  orderName = "Client Order",
  defaultProdW,
  defaultProdH,
  defaultBleed,
  frontColors = { c: true, m: true, y: true, k: true },
  backColors = { c: false, m: false, y: false, k: false },
  spotColors = [],
  printMethod: propPrintMethod,
  onPrintMethodChange,
  onApplyRouteToOperations,
  pressMachine = "Heidelberg Speedmaster XL 106",
  paperStock,
  lamination,
  embellishment,
  isOperator = false,
  onSwitchTab,
  kashirovkaMode: propKashMode = "none",
  kashirovkaStrategy: propKashStrategy = "split_half_sheet",
  kashirovkaLayers: propKashLayers,
  kashirovkaGlueGsm = 25,
  kashirovkaMakeReadySheets: propKashMakeReady = 50,
  onKashirovkaChange,
  sampleQty: propSampleQty,
  onSampleQtyChange,
}: LayoutCalcTabProps) {
  // Mode: Production vs Sample
  const [calcMode, setCalcMode] = useState<LayoutCalcMode>("production");

  // Kashirovka (Multi-Layer Mounting) state
  const [kashMode, setKashModeState] = useState<KashirovkaMode>(propKashMode);
  const [kashStrategy, setKashStrategyState] = useState<KashirovkaImpositionStrategy>(propKashStrategy);
  const [kashMakeReady, setKashMakeReadyState] = useState<number>(propKashMakeReady);

  useEffect(() => {
    setKashModeState(propKashMode || "none");
  }, [propKashMode]);

  useEffect(() => {
    if (propKashStrategy) setKashStrategyState(propKashStrategy);
  }, [propKashStrategy]);

  useEffect(() => {
    if (propKashMakeReady !== undefined) setKashMakeReadyState(propKashMakeReady);
  }, [propKashMakeReady]);

  const setKashMode = (mode: KashirovkaMode) => {
    setKashModeState(mode);
    onKashirovkaChange?.({ kashirovkaMode: mode });
  };

  const setKashStrategy = (strategy: KashirovkaImpositionStrategy) => {
    setKashStrategyState(strategy);
    onKashirovkaChange?.({ kashirovkaStrategy: strategy });
  };

  const setKashMakeReady = (sheets: number) => {
    const safe = Math.max(0, sheets);
    setKashMakeReadyState(safe);
    onKashirovkaChange?.({ kashirovkaMakeReadySheets: safe });
  };

  // Production settings cache
  const [prodSheetW, setProdSheetW] = useState(1000);
  const [prodSheetH, setProdSheetH] = useState(700);
  const [prodGripper, setProdGripper] = useState(15);
  const [prodOverproductionMode, setProdOverproductionMode] = useState<OverproductionMode>("percent");
  const [prodOverproductionValue, setProdOverproductionValue] = useState<number>(5);

  // Sample settings cache (Synced with Sample Proof tab when propSampleQty is provided)
  const [sampleQty, setSampleQty] = useState(propSampleQty && propSampleQty > 0 ? propSampleQty : 5);
  const [sampleStockSource, setSampleStockSource] = useState<SampleStockSource>("precut_stock");
  const [selectedPrecutId, setSelectedPrecutId] = useState("sra3");
  const [sampleSheetW, setSampleSheetW] = useState(450);
  const [sampleSheetH, setSampleSheetH] = useState(320);
  const [sampleGripper, setSampleGripper] = useState(5);
  const [parentSheetW, setParentSheetW] = useState(1000);
  const [parentSheetH, setParentSheetH] = useState(700);
  const [sampleCutW, setSampleCutW] = useState(450);
  const [sampleCutH, setSampleCutH] = useState(320);
  const [sampleMachineType, setSampleMachineType] = useState("digital_press");
  const [sampleBillingMode, setSampleBillingMode] = useState<"complimentary" | "billable">("complimentary");
  const [samplePrice, setSamplePrice] = useState(35);

  useEffect(() => {
    if (propSampleQty && propSampleQty > 0 && propSampleQty !== sampleQty) {
      setSampleQty(propSampleQty);
      if (calcMode === "sample") {
        setBaseQuantity(propSampleQty);
      }
    }
  }, [propSampleQty, calcMode, sampleQty]);

  // Active Parameters that drive the imposition engine
  const [sheetW, setSheetW] = useState(1000);
  const [sheetH, setSheetH] = useState(700);
  const [prodW, setProdW] = useState(defaultProdW || 210);
  const [prodH, setProdH] = useState(defaultProdH || 297);
  const [baseQuantity, setBaseQuantity] = useState(defaultQuantity || 1000);

  const [bleed, setBleed] = useState(defaultBleed !== undefined ? defaultBleed : 2);
  const [gap, setGap] = useState(4);
  const [marginTop, setMarginTop] = useState(10);
  const [marginBottom, setMarginBottom] = useState(10);
  const [marginLeft, setMarginLeft] = useState(10);
  const [marginRight, setMarginRight] = useState(10);
  const [gripper, setGripper] = useState(15);
  const [gripperEdge, setGripperEdge] = useState<GripperEdge>("Auto");

  const [orientation, setOrientation] = useState<Orientation>("A");

  // Auto-derive active color stations per plate from Specs & Drawing (SSOT)
  const derivedColorsPerPlate = useMemo(() => {
    const fProc = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
    const fSpot = spotColors.filter((s) => s.side === "front" || s.side === "both").length;
    const bProc = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);
    const bSpot = spotColors.filter((s) => s.side === "back" || s.side === "both").length;
    return Math.max(1, fProc + fSpot, bProc + bSpot);
  }, [frontColors, backColors, spotColors]);

  const [cmykColors, setCmykColors] = useState<number>(derivedColorsPerPlate);

  useEffect(() => {
    setCmykColors(derivedColorsPerPlate);
  }, [derivedColorsPerPlate]);

  // Overproduction
  const [overproductionMode, setOverproductionMode] = useState<OverproductionMode>("percent");
  const [overproductionValue, setOverproductionValue] = useState<number>(5);

  // Multi-Plate State
  const [plates, setPlates] = useState<PlateConfig[]>([
    { id: "plate-1", name: "Plate 1", manualSlots: {} },
  ]);
  const [activePlateIndex, setActivePlateIndex] = useState(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync with prop changes
  useEffect(() => {
    if (defaultQuantity > 0 && calcMode === "production") {
      setBaseQuantity(defaultQuantity);
    }
  }, [defaultQuantity, calcMode]);

  useEffect(() => {
    if (defaultProdW && defaultProdW > 0) {
      setProdW(defaultProdW);
    }
  }, [defaultProdW]);

  useEffect(() => {
    if (defaultProdH && defaultProdH > 0) {
      setProdH(defaultProdH);
    }
  }, [defaultProdH]);

  useEffect(() => {
    if (defaultBleed !== undefined) {
      setBleed(defaultBleed);
    }
  }, [defaultBleed]);

  // Mode Switch Handler
  const handleModeSwitch = (newMode: LayoutCalcMode) => {
    if (newMode === calcMode) return;
    setCalcMode(newMode);

    if (newMode === "sample") {
      // Save current production params
      setProdSheetW(sheetW);
      setProdSheetH(sheetH);
      setProdGripper(gripper);
      setProdOverproductionMode(overproductionMode);
      setProdOverproductionValue(overproductionValue);

      // Apply sample params
      setSheetW(sampleSheetW);
      setSheetH(sampleSheetH);
      setBaseQuantity(sampleQty);
      setGripper(sampleGripper);
      setOverproductionMode("exact");
      setOverproductionValue(0);
    } else {
      // Restore production params
      setSheetW(prodSheetW);
      setSheetH(prodSheetH);
      setBaseQuantity(defaultQuantity || 1000);
      setGripper(prodGripper);
      setOverproductionMode(prodOverproductionMode);
      setOverproductionValue(prodOverproductionValue);
    }
  };

  // Sample Stock Source handlers
  const handleSelectPrecutPreset = (preset: PrecutStockPreset) => {
    setSelectedPrecutId(preset.id);
    setSampleSheetW(preset.width);
    setSampleSheetH(preset.height);
    if (calcMode === "sample") {
      setSheetW(preset.width);
      setSheetH(preset.height);
    }
  };

  const handleStockSourceChange = (src: SampleStockSource) => {
    setSampleStockSource(src);
    if (src === "precut_stock") {
      const preset = PRECUT_STOCK_PRESETS.find((p) => p.id === selectedPrecutId) || PRECUT_STOCK_PRESETS[0];
      setSampleSheetW(preset.width);
      setSampleSheetH(preset.height);
      if (calcMode === "sample") {
        setSheetW(preset.width);
        setSheetH(preset.height);
      }
    } else {
      setSampleSheetW(sampleCutW);
      setSampleSheetH(sampleCutH);
      if (calcMode === "sample") {
        setSheetW(sampleCutW);
        setSheetH(sampleCutH);
      }
    }
  };

  const handleSampleCutDimChange = (w: number, h: number) => {
    setSampleCutW(w);
    setSampleCutH(h);
    setSampleSheetW(w);
    setSampleSheetH(h);
    if (calcMode === "sample") {
      setSheetW(w);
      setSheetH(h);
    }
  };

  const handleSampleQtyChange = (qty: number) => {
    const val = Math.max(1, qty);
    setSampleQty(val);
    onSampleQtyChange?.(val);
    if (calcMode === "sample") {
      setBaseQuantity(val);
    }
  };

  // Adjusted sizes with overproduction
  const adjustedSizes = useMemo(() => {
    if (sizes.length === 0) return [];
    return sizes.map((s) => {
      let adjQty = s.quantity;
      if (overproductionValue > 0) {
        if (overproductionMode === "percent") {
          adjQty = Math.ceil(s.quantity * (1 + overproductionValue / 100));
        } else {
          adjQty = s.quantity + overproductionValue;
        }
      }
      return {
        ...s,
        originalQuantity: s.quantity,
        quantity: adjQty,
      };
    });
  }, [sizes, overproductionMode, overproductionValue]);

  // Adjusted general quantity
  const adjustedGeneralQuantity = useMemo(() => {
    if (overproductionValue <= 0) return baseQuantity;
    if (overproductionMode === "percent") {
      return Math.ceil(baseQuantity * (1 + overproductionValue / 100));
    }
    return baseQuantity + overproductionValue;
  }, [baseQuantity, overproductionMode, overproductionValue]);

  // Prepress margins
  const prepressMargins = useMemo(() => {
    return calculatePrepressMargins(
      sheetW,
      sheetH,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      gripper,
      gripperEdge
    );
  }, [sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, gripper, gripperEdge]);

  // Imposition layout
  const layout = useMemo(() => {
    return calculateImposition(
      sheetW,
      sheetH,
      prodW,
      prodH,
      bleed,
      gap,
      orientation,
      prepressMargins
    );
  }, [sheetW, sheetH, prodW, prodH, bleed, gap, orientation, prepressMargins]);

  const switchOrientation = () => {
    setOrientation((prev) => (prev === "A" ? "B" : "A"));
  };

  const isKashirovkaEnabled = kashMode !== "none";
  const isSplitHalfKashirovka =
    isKashirovkaEnabled && kashStrategy === "split_half_sheet";

  const halfCols = useMemo(() => {
    if (!isSplitHalfKashirovka) return layout.cols;
    return Math.floor(layout.cols / 2);
  }, [isSplitHalfKashirovka, layout.cols]);

  // Effective product slots per press sheet (for split-half kashirovka, Left half = Front, Right half = Back)
  const effectivePieces = useMemo(() => {
    if (!isSplitHalfKashirovka) return layout.pieces;
    return Math.max(0, halfCols * layout.rows);
  }, [isSplitHalfKashirovka, halfCols, layout.rows, layout.pieces]);

  // Plate distributions
  const plateCalculations = useMemo(() => {
    return calculatePlateDistribution(
      effectivePieces,
      plates,
      adjustedSizes,
      adjustedGeneralQuantity
    );
  }, [effectivePieces, plates, adjustedSizes, adjustedGeneralQuantity]);

  const activePlate = plateCalculations[activePlateIndex] || plateCalculations[0];

  // Parent sheet cut yield calculation
  const parentCutResult = useMemo<ParentCutResult>(() => {
    const neededChildSheets = activePlate ? activePlate.requiredSheets : 1;
    return calculateParentSheetCuts(
      parentSheetW,
      parentSheetH,
      sampleCutW,
      sampleCutH,
      neededChildSheets
    );
  }, [parentSheetW, parentSheetH, sampleCutW, sampleCutH, activePlate]);

  const [partitionStrategy, setPartitionStrategy] = useState<PlatePartitionStrategy>("gang_capacity");

  const uniqueModels = useMemo(() => {
    const set = new Set<string>();
    adjustedSizes.forEach((s) => {
      const { model } = parseModelAndSize(s);
      if (model) set.add(model);
    });
    return Array.from(set);
  }, [adjustedSizes]);

  const hasMultipleModels = uniqueModels.length > 1;

  // Plate Actions
  const handleAddPlate = () => {
    const newIdx = plates.length + 1;
    const newPlate: PlateConfig = {
      id: `plate-${Date.now()}`,
      name: `Plate ${newIdx}`,
      manualSlots: {},
    };
    setPlates([...plates, newPlate]);
    setActivePlateIndex(plates.length);
  };

  const handleRemovePlate = (idxToRemove: number) => {
    if (plates.length <= 1) return;
    const updated = plates.filter((_, idx) => idx !== idxToRemove);
    setPlates(updated);
    if (activePlateIndex >= updated.length) {
      setActivePlateIndex(updated.length - 1);
    }
  };

  const handleAutoPartitionPlates = (strategyOverride?: PlatePartitionStrategy) => {
    if (effectivePieces === 0 || adjustedSizes.length === 0) return;
    const strat = strategyOverride || partitionStrategy;
    if (strategyOverride) {
      setPartitionStrategy(strategyOverride);
    }
    const newPlatesList = buildPartitionedPlates(strat, effectivePieces, adjustedSizes);
    setPlates(newPlatesList);
    setActivePlateIndex(0);
  };

  const handleManualSlotChange = (sizeId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setPlates((prev) =>
      prev.map((p, idx) => {
        if (idx !== activePlateIndex) return p;
        return {
          ...p,
          manualSlots: {
            ...p.manualSlots,
            [sizeId]: safeVal,
          },
        };
      })
    );
  };

  // Grid cells for SVG preview
  const gridCells = useMemo<GridCell[]>(() => {
    if (!activePlate) return [];

    const getCellColor = (assignment: { model?: string }, index: number) => {
      if (hasMultipleModels && assignment.model) {
        const mIdx = uniqueModels.indexOf(assignment.model);
        if (mIdx >= 0) {
          return COLOR_PALETTE[(mIdx * 2 + (index % 2)) % COLOR_PALETTE.length];
        }
      }
      return COLOR_PALETTE[index % COLOR_PALETTE.length];
    };

    // When Split-Half Kashirovka is active, Left Half = FRONT, Right Half = BACK (Mirror)
    if (isSplitHalfKashirovka && layout.cols >= 2) {
      const halfPool: GridCell[] = [];
      activePlate.assignments.forEach((assignment, index) => {
        for (let i = 0; i < assignment.slots; i++) {
          halfPool.push({
            label: assignment.sizeLabel,
            model: assignment.model,
            sizeCode: assignment.sizeCode,
            color: getCellColor(assignment, index),
            sizeId: assignment.sizeId,
          });
        }
      });
      while (halfPool.length < effectivePieces) {
        halfPool.push({ label: "Empty", color: "#f4f4f5", sizeId: "empty" });
      }

      const fullGrid: GridCell[] = [];
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          if (c < halfCols) {
            const slotIdx = r * halfCols + c;
            const base = halfPool[slotIdx] || { label: "Empty", color: "#f4f4f5", sizeId: "empty" };
            fullGrid.push({ ...base, sideBadge: "FRONT" });
          } else if (c >= layout.cols - halfCols) {
            // Mirrored column index so Side Lay (Верный угол) matches when folded/mounted back-to-back
            const rightLocalCol = c - (layout.cols - halfCols);
            const mirroredCol = halfCols - 1 - rightLocalCol;
            const slotIdx = r * halfCols + mirroredCol;
            const base = halfPool[slotIdx] || { label: "Empty", color: "#f4f4f5", sizeId: "empty" };
            fullGrid.push({
              ...base,
              color: base.sizeId === "empty" ? "#f4f4f5" : "#ede9fe",
              sideBadge: "BACK",
            });
          } else {
            // Odd middle column reserved for split cut trim
            fullGrid.push({
              label: "✂ SPLIT MARGIN",
              color: "#fef3c7",
              sizeId: "split-margin",
            });
          }
        }
      }
      return fullGrid;
    }

    const cells: GridCell[] = [];
    activePlate.assignments.forEach((assignment, index) => {
      for (let i = 0; i < assignment.slots; i++) {
        cells.push({
          label: assignment.sizeLabel,
          model: assignment.model,
          sizeCode: assignment.sizeCode,
          color: getCellColor(assignment, index),
          sizeId: assignment.sizeId,
        });
      }
    });

    while (cells.length < layout.pieces) {
      cells.push({ label: "Empty", color: "#f4f4f5", sizeId: "empty" });
    }

    return cells;
  }, [activePlate, layout.pieces, layout.cols, layout.rows, isSplitHalfKashirovka, halfCols, effectivePieces, hasMultipleModels, uniqueModels]);

  // Overall Statistics
  const baseSheetsRun = plateCalculations.reduce((sum, p) => sum + p.requiredSheets, 0);

  const kashirovkaSummary = useMemo<KashirovkaSummary>(() => {
    const resolvedLayers =
      propKashLayers && propKashLayers.length > 0
        ? propKashLayers
        : getDefaultKashirovkaLayers(kashMode);
    const totals = calculateKashirovkaTotals(kashMode, resolvedLayers, kashGlueGsmOrDefault(kashirovkaGlueGsm));

    if (!isKashirovkaEnabled) {
      return {
        enabled: false,
        mode: "none",
        strategy: kashStrategy,
        netPaperGsm: 300,
        totalMountedGsm: 300,
        estimatedCaliperMm: 0.4,
        effectiveCardsPerPressSheet: layout.pieces,
        mountedSheetsRequired: baseSheetsRun,
        makeReadySheets: 0,
        rawPrintedLinerSheets: baseSheetsRun,
        rawCoreSheets: 0,
        totalRawBoardSheets: baseSheetsRun,
        totalCtpPlates: plates.length * cmykColors,
        glueKgRequired: 0,
      };
    }

    const makeReady = calcMode === "sample" ? 5 : kashMakeReady;
    const mountedSheetsRequired = baseSheetsRun + makeReady;

    // In split_half_sheet: 1 full press sheet is cut in half (Left=Front, Right=Back) and glued into 1 half-size mounted board
    // In separate_sheets: 1 full Front sheet + 1 full Back sheet are glued into 1 full-size mounted board
    const rawPrintedLinerSheets =
      kashStrategy === "split_half_sheet"
        ? mountedSheetsRequired
        : mountedSheetsRequired * 2;

    const rawCoreSheets =
      kashMode === "triplex"
        ? kashStrategy === "split_half_sheet"
          ? Math.ceil(mountedSheetsRequired / 2)
          : mountedSheetsRequired
        : 0;

    const totalRawBoardSheets = rawPrintedLinerSheets + rawCoreSheets;

    const totalCtp =
      kashStrategy === "split_half_sheet"
        ? plates.length * cmykColors // 1 CTP set prints both Front (left) and Back (right)
        : plates.length * cmykColors * 2; // 2 CTP sets (Front set + Back set)

    const sheetAreaM2 = (sheetW / 1000) * (sheetH / 1000);
    const singleMountedAreaM2 =
      kashStrategy === "split_half_sheet" ? sheetAreaM2 * 0.5 : sheetAreaM2;
    const glueBonds = kashMode === "triplex" ? 2 : 1;
    const glueKgRequired = Number(
      (
        (mountedSheetsRequired *
          singleMountedAreaM2 *
          glueBonds *
          kashGlueGsmOrDefault(kashirovkaGlueGsm)) /
        1000
      ).toFixed(2)
    );

    const gridLeft = prepressMargins.gridLeft + layout.offsetX;
    const actualGridW =
      layout.cols > 0 ? layout.cols * layout.itemW + (layout.cols - 1) * gap : 0;
    const splitCutAxisX =
      kashStrategy === "split_half_sheet" && layout.cols >= 2
        ? gridLeft + actualGridW / 2
        : undefined;

    return {
      enabled: true,
      mode: kashMode,
      strategy: kashStrategy,
      netPaperGsm: totals.netPaperGsm,
      totalMountedGsm: totals.totalMountedGsm,
      estimatedCaliperMm: totals.estimatedCaliperMm,
      effectiveCardsPerPressSheet: effectivePieces,
      mountedSheetsRequired,
      makeReadySheets: makeReady,
      rawPrintedLinerSheets,
      rawCoreSheets,
      totalRawBoardSheets,
      totalCtpPlates: totalCtp,
      glueKgRequired,
      splitCutAxisX,
    };
  }, [
    propKashLayers,
    kashMode,
    kashStrategy,
    kashMakeReady,
    kashirovkaGlueGsm,
    isKashirovkaEnabled,
    layout,
    baseSheetsRun,
    plates.length,
    cmykColors,
    calcMode,
    sheetW,
    sheetH,
    effectivePieces,
    prepressMargins.gridLeft,
    gap,
  ]);

  const totalSheetsRun = isKashirovkaEnabled
    ? kashirovkaSummary.totalRawBoardSheets
    : baseSheetsRun;
  const [selectedPrintMethod, setSelectedPrintMethod] = useState<PrintMethod | undefined>(propPrintMethod);

  useEffect(() => {
    if (propPrintMethod) setSelectedPrintMethod(propPrintMethod);
  }, [propPrintMethod]);

  const handlePrintMethodChange = (m: PrintMethod) => {
    setSelectedPrintMethod(m);
    onPrintMethodChange?.(m);
  };

  const printPlan = useMemo<PrintPlanningResult>(() => {
    return calculatePrintPlanning({
      targetQuantity: baseQuantity,
      piecesPerSheet: effectivePieces,
      frontColors,
      backColors,
      spotColors,
      printMethod: selectedPrintMethod,
      parentSheetW,
      parentSheetH,
      pressSheetW: sheetW,
      pressSheetH: sheetH,
      paperGsm: 300,
    });
  }, [
    baseQuantity,
    effectivePieces,
    frontColors,
    backColors,
    spotColors,
    selectedPrintMethod,
    parentSheetW,
    parentSheetH,
    sheetW,
    sheetH,
  ]);

  const totalCtpPlates = isKashirovkaEnabled
    ? kashirovkaSummary.totalCtpPlates
    : printPlan.totalCtpPlates;
  const paperAreaWastePercent = Math.max(0, 100 - layout.utilization);

  // Outer crop marks
  const outerTrimMarks = useMemo(() => {
    return calculateOuterTrimMarks(layout, prepressMargins, gap, bleed);
  }, [layout, prepressMargins, gap, bleed]);

  // Export handlers
  const handleExportSVG = () => {
    const prefix = calcMode === "sample" ? `${docNo}_SAMPLE` : docNo;
    exportSvg(svgRef.current, `${prefix}_${activePlate.name.replace(/\s+/g, "_")}.svg`);
  };

  const handleExportPDF = (exportAll = false) => {
    const exportDocNo = calcMode === "sample" ? `${docNo}_SAMPLE` : docNo;
    const exportOrderName = calcMode === "sample" ? `[SAMPLE PROOF] ${orderName}` : orderName;

    exportPdf(
      sheetW,
      sheetH,
      exportDocNo,
      plateCalculations,
      activePlateIndex,
      {
        orderName: exportOrderName,
        sheetW,
        sheetH,
        gripper,
        activeGripperEdge: prepressMargins.activeGripperEdge,
        prepressMargins,
        layout,
        bleed,
        gap,
        outerTrimMarks,
      },
      exportAll
    );
  };

  return {
    // Mode
    calcMode,
    setCalcMode: handleModeSwitch,

    // Kashirovka (Multi-Layer Mounting)
    kashMode,
    setKashMode,
    kashStrategy,
    setKashStrategy,
    kashMakeReady,
    setKashMakeReady,
    kashirovkaSummary,
    effectivePieces,

    // Inputs & Setters
    sheetW,
    setSheetW,
    sheetH,
    setSheetH,
    prodW,
    setProdW,
    prodH,
    setProdH,
    baseQuantity,
    setBaseQuantity,
    bleed,
    setBleed,
    gap,
    setGap,
    marginTop,
    setMarginTop,
    marginBottom,
    setMarginBottom,
    marginLeft,
    setMarginLeft,
    marginRight,
    setMarginRight,
    gripper,
    setGripper,
    gripperEdge,
    setGripperEdge,
    orientation,
    switchOrientation,
    cmykColors,
    setCmykColors,
    overproductionMode,
    setOverproductionMode,
    overproductionValue,
    setOverproductionValue,

    // Sample Specific
    sampleQty,
    handleSampleQtyChange,
    sampleStockSource,
    handleStockSourceChange,
    selectedPrecutId,
    handleSelectPrecutPreset,
    parentSheetW,
    setParentSheetW,
    parentSheetH,
    setParentSheetH,
    sampleCutW,
    sampleCutH,
    handleSampleCutDimChange,
    parentCutResult,
    sampleMachineType,
    setSampleMachineType,
    sampleBillingMode,
    setSampleBillingMode,
    samplePrice,
    setSamplePrice,

    // Plates & Selection
    plates,
    activePlateIndex,
    setActivePlateIndex,
    activePlate,
    plateCalculations,
    partitionStrategy,
    hasMultipleModels,
    uniqueModelsCount: uniqueModels.length,
    handleAddPlate,
    handleRemovePlate,
    handleAutoPartitionPlates,
    handleManualSlotChange,

    // Print Planning Result & Actions
    printPlan,
    handlePrintMethodChange,
    onApplyRouteToOperations,
    frontColors,
    backColors,
    spotColors,
    pressMachine,
    lamination,
    embellishment,
    isOperator,
    onSwitchTab,

    // Computed / Visuals
    prepressMargins,
    layout,
    gridCells,
    outerTrimMarks,
    totalSheetsRun,
    totalCtpPlates,
    paperAreaWastePercent,

    // Canvas ref & exports
    svgRef,
    handleExportSVG,
    handleExportPDF,
  };
}

function kashGlueGsmOrDefault(val?: number): number {
  return val && val > 0 ? val : 25;
}
