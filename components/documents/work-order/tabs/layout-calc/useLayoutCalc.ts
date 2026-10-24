import { useState, useMemo, useEffect, useRef } from "react";
import {
  KashirovkaMode,
  KashirovkaImpositionStrategy,
  getDefaultKashirovkaLayers,
  calculateKashirovkaTotals,
  parseModelAndSize,
  parseGrammageFromStock,
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
  CtpSideRelation,
  OptimizerGoal,
  LayoutCalcViewMode,
  ActivePlateSide,
  SheetCutOption,
} from "./types";
import {
  calculatePrepressMargins, 
  calculateImposition, 
  calculatePlateDistribution, 
  calculateOuterTrimMarks,
  calculateParentSheetCuts,
  buildPartitionedPlates,
  resolveMachineConstraints,
  calculateSheetCutOptions,
  pickOptimalCutOption,
  doesSheetFitMachine,
  computeTotalCtpPlatesForConfig,
  compareImpositionPlans,
} from "./engine";
import { exportSvg, exportPdf } from "./export";
import {
  calculatePrintPlanning,
  PrintMethod,
  PrintPlanningResult,
} from "../../planningEngine";
import { WarehouseStockRecord } from "@/store/workspaceStore";

export const COLOR_PALETTE = [
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

function parseFormatString(format?: string): [number, number] | null {
  if (!format) return null;
  const parts = format
    .split(/[×xX*]/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  if (parts.length >= 2) {
    return [Math.max(parts[0], parts[1]), Math.min(parts[0], parts[1])];
  }
  return null;
}

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
  activeMachine,
  paperStock,
  warehouseStock = [],
  parentSheetW: propParentW,
  parentSheetH: propParentH,
  pressSheetW: propPressW,
  pressSheetH: propPressH,
  plannedSheets: propPlannedSheets,
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
  artworkFront,
  artworkBack,
  skuArtworks = [],
  impositionState,
  onImpositionStateChange,
  onApplyToOrder,
}: LayoutCalcTabProps) {
  // Machine Format Constraints (SM 52, GTO 52, SX 74, XL 106, Komori G40, etc.)
  const machineConstraints = useMemo(
    () => resolveMachineConstraints(pressMachine, activeMachine),
    [pressMachine, activeMachine]
  );

  // Front & Back color stations count
  const frontColorsCount = useMemo(() => {
    const fProc =
      (frontColors.c ? 1 : 0) +
      (frontColors.m ? 1 : 0) +
      (frontColors.y ? 1 : 0) +
      (frontColors.k ? 1 : 0);
    const fSpot = spotColors.filter((s) => s.side === "front" || s.side === "both").length;
    return Math.max(1, fProc + fSpot);
  }, [frontColors, spotColors]);

  const backColorsCount = useMemo(() => {
    const bProc =
      (backColors.c ? 1 : 0) +
      (backColors.m ? 1 : 0) +
      (backColors.y ? 1 : 0) +
      (backColors.k ? 1 : 0);
    const bSpot = spotColors.filter((s) => s.side === "back" || s.side === "both").length;
    return bProc + bSpot;
  }, [backColors, spotColors]);

  // Default CTP Side Relation derived from Specifications colors & printMethod
  const derivedDefaultRelation = useMemo<CtpSideRelation>(() => {
    if (backColorsCount <= 0) return "single_sided";
    if (propPrintMethod === "work_and_turn") return "work_and_turn";
    return "shared_front_variable_back";
  }, [backColorsCount, propPrintMethod]);

  const [viewMode, setViewMode] = useState<LayoutCalcViewMode>("phoenix");
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);

  // Default to "front" (Oldi) on initial load
  const [activeSide, setActiveSide] = useState<ActivePlateSide>("front");
  const [calcMode, setCalcMode] = useState<LayoutCalcMode>("production");

  const [ctpSideRelation, setCtpSideRelation] = useState<CtpSideRelation>(
    impositionState?.ctpSideRelation || derivedDefaultRelation
  );

  // Sync ctpSideRelation when backColorsCount changes (e.g. 4+0 vs 4+4)
  useEffect(() => {
    if (backColorsCount <= 0 && ctpSideRelation !== "single_sided") {
      setCtpSideRelation("single_sided");
    } else if (backColorsCount > 0 && ctpSideRelation === "single_sided") {
      setCtpSideRelation(propPrintMethod === "work_and_turn" ? "work_and_turn" : "shared_front_variable_back");
    }
  }, [backColorsCount, ctpSideRelation, propPrintMethod]);

  const [optimizerGoal, setOptimizerGoal] = useState<OptimizerGoal>(
    impositionState?.optimizerGoal || "min_waste"
  );
  const [targetPlateCount, setTargetPlateCount] = useState<number | undefined>(undefined);
  const [isJobTicketOpen, setIsJobTicketOpen] = useState(false);

  // Kashirovka state
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

  // Resolve initial Parent Sheet from Warehouse Stock or WorkOrder props
  const matchedWarehousePaper = useMemo(() => {
    if (!paperStock || warehouseStock.length === 0) return undefined;
    return warehouseStock.find(
      (w) =>
        w.name.toLowerCase() === paperStock.toLowerCase() ||
        w.sku.toLowerCase() === paperStock.toLowerCase()
    );
  }, [paperStock, warehouseStock]);

  const initialParentDims = useMemo<[number, number]>(() => {
    if (impositionState?.parentSheetW && impositionState?.parentSheetH) {
      return [
        Math.max(impositionState.parentSheetW, impositionState.parentSheetH),
        Math.min(impositionState.parentSheetW, impositionState.parentSheetH),
      ];
    }
    if (propParentW && propParentH) {
      return [Math.max(propParentW, propParentH), Math.min(propParentW, propParentH)];
    }
    const fromStock = parseFormatString(
      matchedWarehousePaper?.cutDimensions || matchedWarehousePaper?.sheetFormat
    );
    if (fromStock) return fromStock;
    return [1000, 700];
  }, [impositionState, propParentW, propParentH, matchedWarehousePaper]);

  const [selectedPaperName, setSelectedPaperName] = useState<string>(paperStock || "");
  useEffect(() => {
    if (paperStock && paperStock !== selectedPaperName) {
      setSelectedPaperName(paperStock);
    }
  }, [paperStock]);

  const [parentSheetW, setParentSheetW] = useState<number>(initialParentDims[0]);
  const [parentSheetH, setParentSheetH] = useState<number>(initialParentDims[1]);
  const [cutDivisor, setCutDivisor] = useState<number>(impositionState?.cutDivisor || 1);

  const [prodW, setProdW] = useState(defaultProdW || 75);
  const [prodH, setProdH] = useState(defaultProdH || 120);
  const [baseQuantity, setBaseQuantity] = useState(defaultQuantity || 1000);
  const [bleed, setBleed] = useState(defaultBleed !== undefined ? defaultBleed : 2);
  const [gap, setGap] = useState(impositionState?.gap ?? 4);
  const [marginTop, setMarginTop] = useState(impositionState?.marginTop ?? 10);
  const [marginBottom, setMarginBottom] = useState(impositionState?.marginBottom ?? 10);
  const [marginLeft, setMarginLeft] = useState(impositionState?.marginLeft ?? 10);
  const [marginRight, setMarginRight] = useState(impositionState?.marginRight ?? 10);
  const [gripper, setGripper] = useState(impositionState?.gripper ?? machineConstraints.defaultGripper);
  const [gripperEdge, setGripperEdge] = useState<GripperEdge>(impositionState?.gripperEdge ?? "Auto");

  // Compute all guillotine cut options from parent sheet against active press machine constraints
  const sheetCutOptions = useMemo<SheetCutOption[]>(() => {
    return calculateSheetCutOptions(
      parentSheetW,
      parentSheetH,
      prodW,
      prodH,
      bleed,
      gap,
      {
        top: marginTop,
        bottom: marginBottom,
        left: marginLeft,
        right: marginRight,
        gripper,
        gripperEdge,
      },
      machineConstraints
    );
  }, [
    parentSheetW,
    parentSheetH,
    prodW,
    prodH,
    bleed,
    gap,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    gripper,
    gripperEdge,
    machineConstraints,
  ]);

  const optimalCutOption = useMemo(() => pickOptimalCutOption(sheetCutOptions), [sheetCutOptions]);

  const [sheetW, setSheetW] = useState<number>(
    impositionState?.sheetW || propPressW || optimalCutOption.pressW
  );
  const [sheetH, setSheetH] = useState<number>(
    impositionState?.sheetH || propPressH || optimalCutOption.pressH
  );

  // Automatically adjust Press Sheet when machine or parent sheet changes and current press sheet doesn't fit machine
  useEffect(() => {
    const currentFits = doesSheetFitMachine(sheetW, sheetH, machineConstraints);
    if (!currentFits || (cutDivisor === 1 && !doesSheetFitMachine(parentSheetW, parentSheetH, machineConstraints))) {
      setCutDivisor(optimalCutOption.divisor);
      setSheetW(optimalCutOption.pressW);
      setSheetH(optimalCutOption.pressH);
    }
  }, [machineConstraints.machineName, machineConstraints.maxW, machineConstraints.maxH, parentSheetW, parentSheetH]);

  // Select a cut option (1/1, 1/2, 1/3, 1/4, 1/6, 1/8)
  const handleSelectCutOption = (opt: SheetCutOption) => {
    setCutDivisor(opt.divisor);
    setSheetW(opt.pressW);
    setSheetH(opt.pressH);
  };

  // Select a paper or offcut from warehouse stock
  const handleSelectWarehousePaper = (stock: WarehouseStockRecord) => {
    setSelectedPaperName(stock.name);
    const dims = parseFormatString(stock.cutDimensions || stock.sheetFormat);
    if (dims) {
      const [pW, pH] = dims;
      setParentSheetW(pW);
      setParentSheetH(pH);
      const nextOpts = calculateSheetCutOptions(
        pW,
        pH,
        prodW,
        prodH,
        bleed,
        gap,
        { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight, gripper, gripperEdge },
        machineConstraints
      );
      const best = pickOptimalCutOption(nextOpts);
      setCutDivisor(best.divisor);
      setSheetW(best.pressW);
      setSheetH(best.pressH);
    }
  };

  // Update parent dimensions manually
  const handleParentSheetDimChange = (w: number, h: number) => {
    const safeW = Math.max(100, w);
    const safeH = Math.max(100, h);
    setParentSheetW(safeW);
    setParentSheetH(safeH);
    const nextOpts = calculateSheetCutOptions(
      safeW,
      safeH,
      prodW,
      prodH,
      bleed,
      gap,
      { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight, gripper, gripperEdge },
      machineConstraints
    );
    const matchedDiv = nextOpts.find((o) => o.divisor === cutDivisor && o.fitsMachine) || pickOptimalCutOption(nextOpts);
    setCutDivisor(matchedDiv.divisor);
    setSheetW(matchedDiv.pressW);
    setSheetH(matchedDiv.pressH);
  };

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

  // Auto-pick best initial orientation (A vs B)
  const initialOrientation = useMemo<Orientation>(() => {
    if (impositionState?.orientation) return impositionState.orientation;
    const layA = calculateImposition(sheetW, sheetH, prodW, prodH, bleed, gap, "A", prepressMargins);
    const layB = calculateImposition(sheetW, sheetH, prodW, prodH, bleed, gap, "B", prepressMargins);
    return layB.pieces > layA.pieces ? "B" : "A";
  }, []);

  const [orientation, setOrientation] = useState<Orientation>(initialOrientation);

  const [cmykColors, setCmykColors] = useState<number>(Math.max(frontColorsCount, backColorsCount));
  useEffect(() => {
    setCmykColors(Math.max(frontColorsCount, backColorsCount));
  }, [frontColorsCount, backColorsCount]);

  // Overproduction
  const [overproductionMode, setOverproductionMode] = useState<OverproductionMode>(
    impositionState?.overproductionMode || "percent"
  );
  const [overproductionValue, setOverproductionValue] = useState<number>(
    impositionState?.overproductionValue ?? 0
  );

  // Sample legacy state (kept for compatibility with any sub-panels)
  const [sampleQty, setSampleQty] = useState(propSampleQty && propSampleQty > 0 ? propSampleQty : 5);
  const [sampleStockSource, setSampleStockSource] = useState<SampleStockSource>("precut_stock");
  const [selectedPrecutId, setSelectedPrecutId] = useState("sra3");
  const [sampleCutW, setSampleCutW] = useState(450);
  const [sampleCutH, setSampleCutH] = useState(320);
  const [sampleMachineType, setSampleMachineType] = useState("digital_press");
  const [sampleBillingMode, setSampleBillingMode] = useState<"complimentary" | "billable">("complimentary");
  const [samplePrice, setSamplePrice] = useState(35);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync with prop changes from Specification tab
  useEffect(() => {
    if (defaultQuantity > 0 && calcMode === "production") {
      setBaseQuantity(defaultQuantity);
    }
  }, [defaultQuantity, calcMode]);

  useEffect(() => {
    if (defaultProdW && defaultProdW > 0) setProdW(defaultProdW);
  }, [defaultProdW]);

  useEffect(() => {
    if (defaultProdH && defaultProdH > 0) setProdH(defaultProdH);
  }, [defaultProdH]);

  useEffect(() => {
    if (defaultBleed !== undefined) setBleed(defaultBleed);
  }, [defaultBleed]);

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

  const adjustedGeneralQuantity = useMemo(() => {
    if (overproductionValue <= 0) return baseQuantity;
    if (overproductionMode === "percent") {
      return Math.ceil(baseQuantity * (1 + overproductionValue / 100));
    }
    return baseQuantity + overproductionValue;
  }, [baseQuantity, overproductionMode, overproductionValue]);

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
  const isSplitHalfKashirovka = isKashirovkaEnabled && kashStrategy === "split_half_sheet";
  const isWorkAndTurn = !isKashirovkaEnabled && ctpSideRelation === "work_and_turn";
  const isSplitSheetLayout = isSplitHalfKashirovka || isWorkAndTurn;

  const halfCols = useMemo(() => {
    if (!isSplitSheetLayout) return layout.cols;
    return Math.floor(layout.cols / 2);
  }, [isSplitSheetLayout, layout.cols]);

  // Effective product slots per press sheet (for Split-Half Kashirovka OR Work-and-Turn, Left half = Front, Right half = Back)
  const effectivePieces = useMemo(() => {
    if (!isSplitSheetLayout) return layout.pieces;
    return Math.max(0, halfCols * layout.rows);
  }, [isSplitSheetLayout, halfCols, layout.rows, layout.pieces]);

  // Multi-Plate State (auto-initialized using smart_gang_optimizer if no persisted plates exist)
  const [plates, setPlates] = useState<PlateConfig[]>(() => {
    if (impositionState?.plates && impositionState.plates.length > 0) {
      return impositionState.plates;
    }
    if (adjustedSizes.length > 0 && effectivePieces > 0) {
      return buildPartitionedPlates("smart_gang_optimizer", effectivePieces, adjustedSizes, {
        capacity: effectivePieces,
        goal: "min_waste",
      });
    }
    return [{ id: "plate-1", name: "Forma 1", manualSlots: {} }];
  });
  const [activePlateIndex, setActivePlateIndex] = useState(0);
  const [partitionStrategy, setPartitionStrategy] = useState<PlatePartitionStrategy>("smart_gang_optimizer");

  // Persist imposition state back to WorkOrderFormData whenever key state changes
  useEffect(() => {
    onImpositionStateChange?.({
      sheetW,
      sheetH,
      parentSheetW,
      parentSheetH,
      cutDivisor,
      orientation,
      gap,
      gripper,
      gripperEdge,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      overproductionMode,
      overproductionValue,
      ctpSideRelation,
      optimizerGoal,
      plates,
    });
  }, [
    sheetW,
    sheetH,
    parentSheetW,
    parentSheetH,
    cutDivisor,
    orientation,
    gap,
    gripper,
    gripperEdge,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    overproductionMode,
    overproductionValue,
    ctpSideRelation,
    optimizerGoal,
    plates,
  ]);

  // Plate distributions with full accounting
  const plateCalculations = useMemo(() => {
    return calculatePlateDistribution(
      effectivePieces,
      plates,
      adjustedSizes,
      adjustedGeneralQuantity,
      {
        ctpSideRelation,
        frontColorsCount,
        backColorsCount,
      }
    );
  }, [
    effectivePieces,
    plates,
    adjustedSizes,
    adjustedGeneralQuantity,
    ctpSideRelation,
    frontColorsCount,
    backColorsCount,
  ]);

  const activePlate = plateCalculations[activePlateIndex] || plateCalculations[0];

  const uniqueModels = useMemo(() => {
    const set = new Set<string>();
    adjustedSizes.forEach((s) => {
      const { model } = parseModelAndSize(s);
      if (model) set.add(model);
    });
    return Array.from(set);
  }, [adjustedSizes]);

  const hasMultipleModels = uniqueModels.length > 1;

  // Pre-calculated Plan Comparison Options (for the compact Plan Select)
  const planComparisonOptions = useMemo(() => {
    return compareImpositionPlans(
      effectivePieces,
      adjustedSizes,
      adjustedGeneralQuantity,
      cutDivisor,
      ctpSideRelation,
      frontColorsCount,
      backColorsCount,
      hasMultipleModels
    );
  }, [
    effectivePieces,
    adjustedSizes,
    adjustedGeneralQuantity,
    cutDivisor,
    ctpSideRelation,
    frontColorsCount,
    backColorsCount,
    hasMultipleModels,
  ]);

  // Lookup map for per-SKU artwork
  const skuArtworkMap = useMemo(() => {
    const map = new Map<string, { front?: string; back?: string }>();
    skuArtworks.forEach((art) => {
      map.set(art.skuId, {
        front: art.frontArtworkThumb || art.frontArtworkUrl,
        back: art.backArtworkThumb || art.backArtworkUrl,
      });
    });
    return map;
  }, [skuArtworks]);

  // Plate Actions
  const handleAddPlate = () => {
    const newIdx = plates.length + 1;
    const newPlate: PlateConfig = {
      id: `plate-${Date.now()}`,
      name: `Forma ${newIdx}`,
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

  const handleRenamePlate = (plateIdx: number, newName: string) => {
    setPlates((prev) =>
      prev.map((p, idx) => (idx === plateIdx ? { ...p, name: newName } : p))
    );
  };

  const handleDuplicatePlate = (plateIdx: number) => {
    const target = plates[plateIdx];
    if (!target) return;
    const newIdx = plates.length + 1;
    const copy: PlateConfig = {
      id: `plate-${Date.now()}`,
      name: `Forma ${newIdx} (Nusxa)`,
      manualSlots: { ...target.manualSlots },
      assignedSizeIds: target.assignedSizeIds ? [...target.assignedSizeIds] : undefined,
    };
    setPlates([...plates, copy]);
    setActivePlateIndex(plates.length);
  };

  const handleAutoPartitionPlates = (
    strategyOverride?: PlatePartitionStrategy,
    goalOverride?: OptimizerGoal,
    targetCountOverride?: number
  ) => {
    if (effectivePieces === 0 || adjustedSizes.length === 0) return;
    const strat = strategyOverride || partitionStrategy;
    const goal = goalOverride || optimizerGoal;
    const count = targetCountOverride !== undefined ? targetCountOverride : targetPlateCount;

    if (strategyOverride) setPartitionStrategy(strategyOverride);
    if (goalOverride) setOptimizerGoal(goalOverride);
    if (targetCountOverride !== undefined) setTargetPlateCount(targetCountOverride);

    const newPlatesList = buildPartitionedPlates(strat, effectivePieces, adjustedSizes, {
      capacity: effectivePieces,
      goal,
      targetPlateCount: count,
    });
    setPlates(newPlatesList);
    setActivePlateIndex(0);
  };

  // Safe manual slot change: preserves all other SKUs' current computed slots instead of resetting them to 0
  const handleManualSlotChange = (sizeId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setPlates((prev) =>
      prev.map((p, idx) => {
        if (idx !== activePlateIndex) return p;
        const calcPlate = plateCalculations[idx];
        const baseSlots: Record<string, number> = {};
        if (calcPlate) {
          calcPlate.assignments.forEach((a) => {
            baseSlots[a.sizeId] = a.slots;
          });
        }
        return {
          ...p,
          manualSlots: {
            ...baseSlots,
            ...p.manualSlots,
            [sizeId]: safeVal,
          },
        };
      })
    );
  };

  const handleReassignSkuPlate = (sizeId: string, targetPlateIdx: number) => {
    setPlates((prev) => {
      let currentPlates = [...prev];

      if (targetPlateIdx >= currentPlates.length) {
        const newPlateNum = currentPlates.length + 1;
        const newPlate: PlateConfig = {
          id: `plate-${Date.now()}`,
          name: `Forma ${newPlateNum}`,
          assignedSizeIds: [sizeId],
          manualSlots: { [sizeId]: 1 },
        };
        currentPlates = currentPlates.map((p) => {
          const filtered = (p.assignedSizeIds || []).filter((id) => id !== sizeId);
          const newManual = { ...p.manualSlots };
          delete newManual[sizeId];
          return {
            ...p,
            assignedSizeIds: filtered,
            manualSlots: newManual,
          };
        });
        return [...currentPlates, newPlate];
      }

      return currentPlates.map((p, pIdx) => {
        const currentAssigned = p.assignedSizeIds || [];
        const isTarget = pIdx === targetPlateIdx;
        const contains = currentAssigned.includes(sizeId);

        if (isTarget) {
          const nextAssigned = contains ? currentAssigned : [...currentAssigned, sizeId];
          const currentSlot = p.manualSlots[sizeId] ?? 1;
          return {
            ...p,
            assignedSizeIds: nextAssigned,
            manualSlots: {
              ...p.manualSlots,
              [sizeId]: Math.max(1, currentSlot),
            },
          };
        } else if (contains) {
          const filtered = currentAssigned.filter((id) => id !== sizeId);
          const newManual = { ...p.manualSlots };
          delete newManual[sizeId];
          return {
            ...p,
            assignedSizeIds: filtered,
            manualSlots: newManual,
          };
        }
        return p;
      });
    });
  };

  const handleSetSkuSlots = (sizeId: string, slots: number, plateIdx?: number) => {
    const safeSlots = Math.max(0, slots);
    setPlates((prev) =>
      prev.map((p, pIndex) => {
        if (plateIdx !== undefined && pIndex !== plateIdx) return p;
        const hasSku = p.assignedSizeIds ? p.assignedSizeIds.includes(sizeId) : pIndex === activePlateIndex;
        if (!hasSku) return p;
        const calcPlate = plateCalculations[pIndex];
        const baseSlots: Record<string, number> = {};
        if (calcPlate) {
          calcPlate.assignments.forEach((a) => {
            baseSlots[a.sizeId] = a.slots;
          });
        }
        return {
          ...p,
          manualSlots: {
            ...baseSlots,
            ...p.manualSlots,
            [sizeId]: safeSlots,
          },
        };
      })
    );
  };

  // Grid cells for SVG preview: Column-First contiguous blocks + per-SKU artwork + Work-and-Turn / Kashirovka split
  const gridCells = useMemo<GridCell[]>(() => {
    if (!activePlate || layout.cols === 0 || layout.rows === 0) return [];

    const getCellColor = (assignment: { model?: string }, index: number) => {
      if (hasMultipleModels && assignment.model) {
        const mIdx = uniqueModels.indexOf(assignment.model);
        if (mIdx >= 0) {
          return COLOR_PALETTE[(mIdx * 2 + (index % 2)) % COLOR_PALETTE.length];
        }
      }
      return COLOR_PALETTE[index % COLOR_PALETTE.length];
    };

    const getSkuArt = (sizeId: string, side: "front" | "back") => {
      const skuEntry = skuArtworkMap.get(sizeId);
      if (side === "front") {
        return skuEntry?.front || artworkFront;
      }
      return skuEntry?.back || artworkBack || skuEntry?.front || artworkFront;
    };

    // 1. Split-Half Kashirovka OR Work-and-Turn: Left Half = FRONT, Right Half = BACK (Mirrored horizontally)
    if (isSplitSheetLayout && layout.cols >= 2) {
      const halfPool: GridCell[] = [];
      activePlate.assignments.forEach((assignment, index) => {
        for (let i = 0; i < assignment.slots; i++) {
          halfPool.push({
            label: assignment.sizeCode || assignment.sizeLabel,
            model: assignment.model,
            sizeCode: assignment.sizeCode || assignment.sizeLabel,
            color: getCellColor(assignment, index),
            sizeId: assignment.sizeId,
            slotsCount: assignment.slots,
          });
        }
      });
      while (halfPool.length < effectivePieces) {
        halfPool.push({ label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" });
      }

      // Arrange halfPool in column-first order across the left half (rows x halfCols)
      const leftHalfGrid: GridCell[] = new Array(layout.rows * halfCols);
      let poolIdx = 0;
      for (let c = 0; c < halfCols; c++) {
        for (let r = 0; r < layout.rows; r++) {
          leftHalfGrid[r * halfCols + c] = halfPool[poolIdx++] || { label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" };
        }
      }

      const fullGrid: GridCell[] = [];
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          if (c < halfCols) {
            const base = leftHalfGrid[r * halfCols + c] || { label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" };
            fullGrid.push({
              ...base,
              sideBadge: "FRONT",
              artworkUrl: base.sizeId !== "empty" ? getSkuArt(base.sizeId, "front") : undefined,
            });
          } else if (c >= layout.cols - halfCols) {
            const mirrorCol = layout.cols - 1 - c;
            const base = leftHalfGrid[r * halfCols + mirrorCol] || { label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" };
            fullGrid.push({
              ...base,
              sideBadge: "BACK",
              artworkUrl: base.sizeId !== "empty" ? getSkuArt(base.sizeId, "back") : undefined,
            });
          } else {
            // Odd center column when cols is odd
            fullGrid.push({ label: "Zaxira", color: "#f4f4f5", sizeId: "empty" });
          }
        }
      }
      return fullGrid;
    }

    // 2. Build Column-First (vertical lane) pool for full sheet
    const linearPool: GridCell[] = [];
    activePlate.assignments.forEach((assignment, index) => {
      const isSharedFrontView =
        activeSide === "front" &&
        ctpSideRelation === "shared_front_variable_back" &&
        backColorsCount > 0;

      for (let i = 0; i < assignment.slots; i++) {
        linearPool.push({
          label: isSharedFrontView ? `${assignment.sizeCode || assignment.sizeLabel}` : (assignment.sizeCode || assignment.sizeLabel),
          model: assignment.model,
          sizeCode: assignment.sizeCode || assignment.sizeLabel,
          color: getCellColor(assignment, index),
          sizeId: assignment.sizeId,
          slotsCount: assignment.slots,
          sideBadge: activeSide === "front" ? "FRONT" : "BACK",
          artworkUrl: getSkuArt(assignment.sizeId, activeSide),
        });
      }
    });

    while (linearPool.length < layout.pieces) {
      linearPool.push({ label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" });
    }

    // Fill column by column (vertical strips for straight guillotine cutting)
    const colOrderedGrid: GridCell[] = new Array(layout.pieces);
    let pIdx = 0;
    for (let c = 0; c < layout.cols; c++) {
      for (let r = 0; r < layout.rows; r++) {
        colOrderedGrid[r * layout.cols + c] = linearPool[pIdx++];
      }
    }

    // Mirror horizontally when viewing BACK side in sheetwise printing
    if (activeSide === "back" && layout.cols >= 2 && layout.rows >= 1) {
      const mirroredBackGrid: GridCell[] = [];
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          const mirrorCol = layout.cols - 1 - c;
          const cell = colOrderedGrid[r * layout.cols + mirrorCol] || { label: "Bo'sh", color: "#f4f4f5", sizeId: "empty" };
          mirroredBackGrid.push(cell);
        }
      }
      return mirroredBackGrid;
    }

    return colOrderedGrid;
  }, [
    activePlate,
    activeSide,
    ctpSideRelation,
    backColorsCount,
    layout.pieces,
    layout.cols,
    layout.rows,
    hasMultipleModels,
    uniqueModels,
    isSplitSheetLayout,
    halfCols,
    effectivePieces,
    artworkFront,
    artworkBack,
    skuArtworkMap,
  ]);

  // Overall Production totals
  const baseSheetsRun = useMemo(() => {
    return plateCalculations.reduce((sum, p) => sum + p.requiredSheets, 0);
  }, [plateCalculations]);

  const totalProducedYield = useMemo(() => {
    return plateCalculations.reduce((sum, p) => sum + (p.totalYield || 0), 0);
  }, [plateCalculations]);

  const totalOverproduction = useMemo(() => {
    return plateCalculations.reduce((sum, p) => sum + (p.totalOverproduction || 0), 0);
  }, [plateCalculations]);

  const overallOverproductionPercent = useMemo(() => {
    const totalTarget = plateCalculations.reduce((sum, p) => sum + (p.totalTarget || 0), 0);
    return totalTarget > 0 ? (totalOverproduction / totalTarget) * 100 : 0;
  }, [plateCalculations, totalOverproduction]);

  // Split Axis X coordinate (used for both Split-Half Kashirovka and Work-and-Turn)
  const splitCutAxisX = useMemo(() => {
    if (!isSplitSheetLayout || layout.cols < 2) return undefined;
    const gridLeft = prepressMargins.gridLeft + layout.offsetX;
    const actualGridW = layout.cols * layout.itemW + (layout.cols - 1) * gap;
    return gridLeft + actualGridW / 2;
  }, [isSplitSheetLayout, layout.cols, layout.offsetX, layout.itemW, prepressMargins.gridLeft, gap]);

  // Kashirovka Material Consumptions
  const kashirovkaSummary = useMemo<KashirovkaSummary>(() => {
    if (!isKashirovkaEnabled) {
      return {
        enabled: false,
        mode: "none",
        strategy: "split_half_sheet",
        netPaperGsm: 0,
        totalMountedGsm: 0,
        estimatedCaliperMm: 0,
        effectiveCardsPerPressSheet: effectivePieces,
        mountedSheetsRequired: 0,
        makeReadySheets: 0,
        rawPrintedLinerSheets: 0,
        rawCoreSheets: 0,
        totalRawBoardSheets: 0,
        totalCtpPlates: 0,
        glueKgRequired: 0,
        splitCutAxisX,
      };
    }

    const defaultLayers = getDefaultKashirovkaLayers(kashMode);
    const layersToUse =
      propKashLayers && propKashLayers.length > 0 ? propKashLayers : defaultLayers;
    const totals = calculateKashirovkaTotals(kashMode, layersToUse, kashirovkaGlueGsm);

    const mountedSheetsRequired = baseSheetsRun;
    const makeReady = kashMakeReady;
    const totalBoardPerLayer = mountedSheetsRequired + makeReady;

    let rawPrintedLinerSheets = 0;
    let totalCtp = 0;

    if (kashStrategy === "split_half_sheet") {
      rawPrintedLinerSheets = totalBoardPerLayer;
      totalCtp = plates.length * frontColorsCount;
    } else {
      rawPrintedLinerSheets = totalBoardPerLayer * 2;
      totalCtp = computeTotalCtpPlatesForConfig(
        plates.length,
        ctpSideRelation,
        frontColorsCount,
        backColorsCount > 0 ? backColorsCount : frontColorsCount
      );
    }

    const rawCoreSheets = kashMode === "triplex" ? totalBoardPerLayer : 0;
    const totalRawBoardSheets =
      rawPrintedLinerSheets + (kashMode === "triplex" ? rawCoreSheets : 0);

    const sheetAreaM2 = (sheetW * sheetH) / 1_000_000;
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
    baseSheetsRun,
    plates.length,
    frontColorsCount,
    backColorsCount,
    ctpSideRelation,
    sheetW,
    sheetH,
    effectivePieces,
    splitCutAxisX,
  ]);

  // Total Press Sheets Run
  const totalSheetsRun = isKashirovkaEnabled
    ? kashirovkaSummary.totalRawBoardSheets
    : baseSheetsRun;

  // Total Parent Sheets Needed from Warehouse (accounting for 1/2, 1/4, etc. guillotine cut)
  const totalParentSheetsNeeded = useMemo(() => {
    return Math.ceil(totalSheetsRun / Math.max(1, cutDivisor));
  }, [totalSheetsRun, cutDivisor]);

  const parentCutResult = useMemo<ParentCutResult>(() => {
    const neededChildSheets = activePlate ? activePlate.requiredSheets : 1;
    return calculateParentSheetCuts(
      parentSheetW,
      parentSheetH,
      sheetW,
      sheetH,
      neededChildSheets
    );
  }, [parentSheetW, parentSheetH, sheetW, sheetH, activePlate]);

  const [selectedPrintMethod, setSelectedPrintMethod] = useState<PrintMethod | undefined>(propPrintMethod);
  useEffect(() => {
    if (propPrintMethod) setSelectedPrintMethod(propPrintMethod);
  }, [propPrintMethod]);

  const handlePrintMethodChange = (m: PrintMethod) => {
    setSelectedPrintMethod(m);
    onPrintMethodChange?.(m);
  };

  const resolvedPaperGsm = useMemo(() => {
    if (matchedWarehousePaper?.grammage) return matchedWarehousePaper.grammage;
    return parseGrammageFromStock(selectedPaperName || paperStock, 300);
  }, [matchedWarehousePaper, selectedPaperName, paperStock]);

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
      paperGsm: resolvedPaperGsm,
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
    resolvedPaperGsm,
  ]);

  // Accurate CTP plate counting according to ctpSideRelation and 4+0 vs 4+4
  const totalCtpPlates = useMemo(() => {
    if (calcMode === "sample") return 0;
    if (isKashirovkaEnabled) {
      return kashirovkaSummary.totalCtpPlates;
    }
    return computeTotalCtpPlatesForConfig(
      plates.length,
      ctpSideRelation,
      frontColorsCount,
      backColorsCount
    );
  }, [
    calcMode,
    isKashirovkaEnabled,
    kashirovkaSummary.totalCtpPlates,
    plates.length,
    ctpSideRelation,
    frontColorsCount,
    backColorsCount,
  ]);

  const paperAreaWastePercent = Math.max(0, 100 - layout.utilization);

  const outerTrimMarks = useMemo(() => {
    return calculateOuterTrimMarks(layout, prepressMargins, gap, bleed);
  }, [layout, prepressMargins, gap, bleed]);

  // Check if current imposition differs from saved WorkOrder values
  const hasUnappliedChanges = useMemo(() => {
    if (!onApplyToOrder) return false;
    return (
      propPlannedSheets !== totalParentSheetsNeeded ||
      propPressW !== sheetW ||
      propPressH !== sheetH ||
      propParentW !== parentSheetW ||
      propParentH !== parentSheetH ||
      (selectedPaperName && selectedPaperName !== paperStock)
    );
  }, [
    onApplyToOrder,
    propPlannedSheets,
    totalParentSheetsNeeded,
    propPressW,
    sheetW,
    propPressH,
    sheetH,
    propParentW,
    parentSheetW,
    propParentH,
    parentSheetH,
    selectedPaperName,
    paperStock,
  ]);

  const handleApplyToOrder = () => {
    if (!onApplyToOrder) return;
    const colorSummary =
      backColorsCount > 0 ? `${frontColorsCount}+${backColorsCount}` : `${frontColorsCount}+0`;
    const ctpSpecDetails = `Qolip: ${machineConstraints.plateW}×${machineConstraints.plateH} mm · Bosma list: ${sheetW}×${sheetH} mm (${plates.length} forma, ${colorSummary} rang)`;
    const mappedMethod: PrintMethod =
      isKashirovkaEnabled
        ? "kashirovka"
        : backColorsCount <= 0
        ? "single_sided"
        : ctpSideRelation === "work_and_turn"
        ? "work_and_turn"
        : "sheetwise";

    onApplyToOrder({
      paperStock: selectedPaperName || paperStock,
      parentSheetW,
      parentSheetH,
      pressSheetW: sheetW,
      pressSheetH: sheetH,
      plannedParentSheets: totalParentSheetsNeeded,
      plannedPressSheets: totalSheetsRun,
      totalCtpPlates,
      ctpSpecDetails,
      printMethod: mappedMethod,
    });
  };

  // Export handlers
  const handleExportSVG = () => {
    const sideSuffix = activeSide === "back" ? "ORQA" : "OLDI";
    exportSvg(svgRef.current, `${docNo}_${activePlate.name.replace(/\s+/g, "_")}_${sideSuffix}.svg`);
  };

  const handleExportPDF = (exportAll = false) => {
    const splitLabel = isWorkAndTurn
      ? "WORK & TURN (QAYTARMA O'QI)"
      : isSplitHalfKashirovka
      ? "KASHIROVKA KESISH O'QI"
      : undefined;

    exportPdf(
      sheetW,
      sheetH,
      docNo,
      plateCalculations,
      activePlateIndex,
      {
        orderName,
        sheetW,
        sheetH,
        gripper,
        activeGripperEdge: prepressMargins.activeGripperEdge,
        prepressMargins,
        layout,
        bleed,
        gap,
        outerTrimMarks,
        gridCells,
        splitCutAxisX,
        splitAxisLabel: splitLabel,
        activeSideLabel: activeSide === "back" ? "ORQA" : "OLDI",
      },
      exportAll
    );
  };

  return {
    // Mode & Views
    viewMode,
    setViewMode,
    isMatrixOpen,
    setIsMatrixOpen,
    activeSide,
    setActiveSide,
    calcMode,
    setCalcMode,
    ctpSideRelation,
    setCtpSideRelation,
    optimizerGoal,
    setOptimizerGoal,
    targetPlateCount,
    setTargetPlateCount,
    isJobTicketOpen,
    setIsJobTicketOpen,

    // Machine & Paper Cutting
    machineConstraints,
    sheetCutOptions,
    optimalCutOption,
    cutDivisor,
    setCutDivisor,
    handleSelectCutOption,
    selectedPaperName,
    matchedWarehousePaper,
    warehouseStock,
    handleSelectWarehousePaper,
    handleParentSheetDimChange,
    totalParentSheetsNeeded,
    isWorkAndTurn,
    isSplitSheetLayout,
    splitCutAxisX,

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
    adjustedSizes,
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
    frontColorsCount,
    backColorsCount,
    overproductionMode,
    setOverproductionMode,
    overproductionValue,
    setOverproductionValue,

    // Sample Specific (legacy compatibility)
    sampleQty,
    handleSampleQtyChange: (q: number) => {
      setSampleQty(q);
      onSampleQtyChange?.(q);
    },
    sampleStockSource,
    handleStockSourceChange: setSampleStockSource,
    selectedPrecutId,
    handleSelectPrecutPreset: (p: PrecutStockPreset) => setSelectedPrecutId(p.id),
    parentSheetW,
    setParentSheetW,
    parentSheetH,
    setParentSheetH,
    sampleCutW,
    sampleCutH,
    handleSampleCutDimChange: (w: number, h: number) => {
      setSampleCutW(w);
      setSampleCutH(h);
    },
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
    planComparisonOptions,
    hasMultipleModels,
    uniqueModelsCount: uniqueModels.length,
    handleAddPlate,
    handleRemovePlate,
    handleRenamePlate,
    handleDuplicatePlate,
    handleAutoPartitionPlates,
    handleManualSlotChange,
    handleReassignSkuPlate,
    handleSetSkuSlots,

    // Print Planning Result & Actions
    printPlan,
    handlePrintMethodChange,
    onApplyRouteToOperations,
    frontColors,
    backColors,
    spotColors,
    pressMachine,
    paperStock: selectedPaperName || paperStock,
    lamination,
    embellishment,
    isOperator,
    onSwitchTab,
    hasUnappliedChanges,
    handleApplyToOrder,

    // Computed / Visuals
    prepressMargins,
    layout,
    gridCells,
    outerTrimMarks,
    totalSheetsRun,
    totalProducedYield,
    totalOverproduction,
    overallOverproductionPercent,
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
