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
  CtpSideRelation,
  OptimizerGoal,
  LayoutCalcViewMode,
  ActivePlateSide,
} from "./types";
import {
  calculatePrepressMargins, 
  calculateImposition, 
  calculatePlateDistribution, 
  calculateOuterTrimMarks,
  calculateParentSheetCuts,
  buildPartitionedPlates,
  smartGangRunOptimizer,
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
  artworkFront,
  artworkBack,
}: LayoutCalcTabProps) {
  // View Mode: Phoenix (Default Visual Studio) vs Master Matrix vs Visualizer vs Economics
  const [viewMode, setViewMode] = useState<LayoutCalcViewMode>("phoenix");

  // Active Side: Front (Oldi) vs Back (Orqa)
  const [activeSide, setActiveSide] = useState<ActivePlateSide>("back");

  // Mode: Production vs Sample
  const [calcMode, setCalcMode] = useState<LayoutCalcMode>("production");

  // CTP Side Relation: Shared Front + Variable Back vs Independent vs Work & Turn
  const [ctpSideRelation, setCtpSideRelation] = useState<CtpSideRelation>("shared_front_variable_back");

  // Optimizer Goal: Min Waste vs Min Plates
  const [optimizerGoal, setOptimizerGoal] = useState<OptimizerGoal>("min_waste");
  const [targetPlateCount, setTargetPlateCount] = useState<number | undefined>(undefined);

  // Job Ticket Modal Open state
  const [isJobTicketOpen, setIsJobTicketOpen] = useState(false);

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
  const [prodW, setProdW] = useState(defaultProdW || 75);
  const [prodH, setProdH] = useState(defaultProdH || 120);
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

  // Front & Back color stations count
  const frontColorsCount = useMemo(() => {
    const fProc = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
    const fSpot = spotColors.filter((s) => s.side === "front" || s.side === "both").length;
    return Math.max(1, fProc + fSpot);
  }, [frontColors, spotColors]);

  const backColorsCount = useMemo(() => {
    const bProc = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);
    const bSpot = spotColors.filter((s) => s.side === "back" || s.side === "both").length;
    return bProc + bSpot;
  }, [backColors, spotColors]);

  const [cmykColors, setCmykColors] = useState<number>(Math.max(frontColorsCount, backColorsCount));

  useEffect(() => {
    setCmykColors(Math.max(frontColorsCount, backColorsCount));
  }, [frontColorsCount, backColorsCount]);

  // Overproduction
  const [overproductionMode, setOverproductionMode] = useState<OverproductionMode>("percent");
  const [overproductionValue, setOverproductionValue] = useState<number>(5);

  // Multi-Plate State
  const [plates, setPlates] = useState<PlateConfig[]>([
    { id: "plate-1", name: "Forma 1", manualSlots: {} },
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

  const [partitionStrategy, setPartitionStrategy] = useState<PlatePartitionStrategy>("smart_gang_optimizer");

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
      name: `Forma ${newIdx} (Copy)`,
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

    if (strategyOverride) {
      setPartitionStrategy(strategyOverride);
    }
    if (goalOverride) {
      setOptimizerGoal(goalOverride);
    }
    if (targetCountOverride !== undefined) {
      setTargetPlateCount(targetCountOverride);
    }

    const newPlatesList = buildPartitionedPlates(strat, effectivePieces, adjustedSizes, {
      capacity: effectivePieces,
      goal,
      targetPlateCount: count,
    });
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

  // Move an SKU to a specific plate (or a new plate)
  const handleReassignSkuPlate = (sizeId: string, targetPlateIdx: number) => {
    setPlates((prev) => {
      let currentPlates = [...prev];

      // If moving to a new plate (targetPlateIdx >= length)
      if (targetPlateIdx >= currentPlates.length) {
        const newPlateNum = currentPlates.length + 1;
        const newPlate: PlateConfig = {
          id: `plate-${Date.now()}`,
          name: `Forma ${newPlateNum}`,
          assignedSizeIds: [sizeId],
          manualSlots: { [sizeId]: 1 },
        };
        // Remove from all existing plates
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

      // Reassign to existing targetPlateIdx
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

  // Change SKU slots directly in the table for whatever plate it belongs to
  const handleSetSkuSlots = (sizeId: string, slots: number, plateIdx?: number) => {
    const safeSlots = Math.max(0, slots);
    setPlates((prev) =>
      prev.map((p, pIndex) => {
        if (plateIdx !== undefined && pIndex !== plateIdx) return p;
        const hasSku = p.assignedSizeIds ? p.assignedSizeIds.includes(sizeId) : pIndex === activePlateIndex;
        if (!hasSku) return p;
        return {
          ...p,
          manualSlots: {
            ...p.manualSlots,
            [sizeId]: safeSlots,
          },
        };
      })
    );
  };

  // Grid cells for SVG preview: fully supports FRONT vs BACK view!
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
            fullGrid.push({
              ...base,
              label: base.sizeCode ? `${base.sizeCode} (F)` : base.label,
              sideBadge: "FRONT",
              artworkUrl: artworkFront,
            });
          } else {
            const mirrorCol = layout.cols - 1 - c;
            const slotIdx = r * halfCols + mirrorCol;
            const base = halfPool[slotIdx] || { label: "Empty", color: "#f4f4f5", sizeId: "empty" };
            fullGrid.push({
              ...base,
              label: base.sizeCode ? `${base.sizeCode} (B)` : base.label,
              sideBadge: "BACK",
              artworkUrl: artworkBack,
            });
          }
        }
      }
      return fullGrid;
    }

    // ── 2-SIDED SHEETWISE PRINTING ──
    // FRONT SIDE VIEW:
    if (activeSide === "front") {
      if (ctpSideRelation === "shared_front_variable_back") {
        // Universal Front Plate (all 12 slots have the universal front art)
        const frontCells: GridCell[] = [];
        for (let i = 0; i < layout.pieces; i++) {
          frontCells.push({
            label: "Umumiy Oldi Tomon",
            model: orderName || "Oldi Yuz",
            sizeCode: "OLDI / FRONT",
            color: "#dbeafe",
            sizeId: "shared-front",
            sideBadge: "FRONT",
            artworkUrl: artworkFront,
          });
        }
        return frontCells;
      }

      // Independent Front Plate for this plate
      const frontPool: GridCell[] = [];
      activePlate.assignments.forEach((assignment, index) => {
        for (let i = 0; i < assignment.slots; i++) {
          frontPool.push({
            label: assignment.sizeLabel,
            model: assignment.model,
            sizeCode: assignment.model ? `${assignment.model} (Oldi)` : "Oldi (Front)",
            color: getCellColor(assignment, index),
            sizeId: assignment.sizeId,
            sideBadge: "FRONT",
            artworkUrl: artworkFront,
          });
        }
      });
      while (frontPool.length < layout.pieces) {
        frontPool.push({ label: "Empty", color: "#f4f4f5", sizeId: "empty" });
      }
      return frontPool.slice(0, layout.pieces);
    }

    // BACK SIDE VIEW (The variable SKUs & sizes!):
    // In offset sheetwise printing, back columns are horizontally mirrored to align upon flip
    const backPool: GridCell[] = [];
    activePlate.assignments.forEach((assignment, index) => {
      for (let i = 0; i < assignment.slots; i++) {
        backPool.push({
          label: assignment.sizeLabel,
          model: assignment.model,
          sizeCode: assignment.sizeCode || assignment.sizeLabel,
          color: getCellColor(assignment, index),
          sizeId: assignment.sizeId,
          sideBadge: "BACK",
          artworkUrl: artworkBack,
        });
      }
    });

    while (backPool.length < layout.pieces) {
      backPool.push({ label: "Empty", color: "#f4f4f5", sizeId: "empty" });
    }

    if (layout.cols >= 2 && layout.rows >= 1) {
      const mirroredBackGrid: GridCell[] = [];
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          const mirrorCol = layout.cols - 1 - c;
          const sourceIdx = r * layout.cols + mirrorCol;
          const cell = backPool[sourceIdx] || { label: "Empty", color: "#f4f4f5", sizeId: "empty" };
          mirroredBackGrid.push(cell);
        }
      }
      return mirroredBackGrid.slice(0, layout.pieces);
    }

    return backPool.slice(0, layout.pieces);
  }, [
    activePlate,
    activeSide,
    ctpSideRelation,
    layout.pieces,
    layout.cols,
    layout.rows,
    hasMultipleModels,
    uniqueModels,
    isSplitHalfKashirovka,
    halfCols,
    effectivePieces,
    artworkFront,
    artworkBack,
    orderName,
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
      };
    }

    const defaultLayers = getDefaultKashirovkaLayers(kashMode);
    const layersToUse =
      propKashLayers && propKashLayers.length > 0 ? propKashLayers : defaultLayers;
    const totals = calculateKashirovkaTotals(
      kashMode,
      layersToUse,
      kashirovkaGlueGsm
    );

    const mountedSheetsRequired = baseSheetsRun;
    const makeReady = kashMakeReady;
    const totalBoardPerLayer = mountedSheetsRequired + makeReady;

    let rawPrintedLinerSheets = 0;
    let totalCtp = 0;

    if (kashStrategy === "split_half_sheet") {
      rawPrintedLinerSheets = totalBoardPerLayer;
      totalCtp = plates.length * cmykColors;
    } else {
      rawPrintedLinerSheets = totalBoardPerLayer * 2;
      totalCtp = plates.length * cmykColors * 2;
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

  // Accurate CTP plate counting according to ctpSideRelation
  const totalCtpPlates = useMemo(() => {
    if (calcMode === "sample") return 0;
    if (isKashirovkaEnabled) {
      return kashirovkaSummary.totalCtpPlates;
    }
    const numPlates = plates.length;
    if (numPlates === 0) return 0;

    if (ctpSideRelation === "work_and_turn") {
      return numPlates * Math.max(frontColorsCount, backColorsCount);
    }
    if (ctpSideRelation === "shared_front_variable_back") {
      // 1 front set + numPlates * back set
      return frontColorsCount + numPlates * backColorsCount;
    }
    // Independent per plate
    return numPlates * (frontColorsCount + backColorsCount);
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

  // Outer crop marks
  const outerTrimMarks = useMemo(() => {
    return calculateOuterTrimMarks(layout, prepressMargins, gap, bleed);
  }, [layout, prepressMargins, gap, bleed]);

  // Export handlers
  const handleExportSVG = () => {
    const prefix = calcMode === "sample" ? `${docNo}_SAMPLE` : docNo;
    const sideSuffix = activeSide === "back" ? "BACK" : "FRONT";
    exportSvg(svgRef.current, `${prefix}_${activePlate.name.replace(/\s+/g, "_")}_${sideSuffix}.svg`);
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
    // Mode & Views
    viewMode,
    setViewMode,
    activeSide,
    setActiveSide,
    calcMode,
    setCalcMode: handleModeSwitch,
    ctpSideRelation,
    setCtpSideRelation,
    optimizerGoal,
    setOptimizerGoal,
    targetPlateCount,
    setTargetPlateCount,
    isJobTicketOpen,
    setIsJobTicketOpen,

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
    paperStock,
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
