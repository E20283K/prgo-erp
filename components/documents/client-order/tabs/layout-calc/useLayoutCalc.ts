import { useState, useMemo, useEffect, useRef } from "react";
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
  ParentCutResult
} from "./types";
import { 
  calculatePrepressMargins, 
  calculateImposition, 
  calculatePlateDistribution, 
  calculateOuterTrimMarks,
  calculateParentSheetCuts 
} from "./engine";
import { exportSvg, exportPdf } from "./export";

const COLOR_PALETTE = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#ffedd5",
  "#f3e8ff",
  "#fce7f3",
  "#ccfbf1",
  "#e0e7ff",
];

export function useLayoutCalc({
  sizes = [],
  defaultQuantity,
  docNo = "CO-NEW",
  orderName = "Client Order",
  defaultProdW,
  defaultProdH,
  defaultBleed,
}: LayoutCalcTabProps) {
  // Mode: Production vs Sample
  const [calcMode, setCalcMode] = useState<LayoutCalcMode>("production");

  // Production settings cache
  const [prodSheetW, setProdSheetW] = useState(1000);
  const [prodSheetH, setProdSheetH] = useState(700);
  const [prodGripper, setProdGripper] = useState(15);
  const [prodOverproductionMode, setProdOverproductionMode] = useState<OverproductionMode>("percent");
  const [prodOverproductionValue, setProdOverproductionValue] = useState<number>(5);

  // Sample settings cache
  const [sampleQty, setSampleQty] = useState(5);
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
  const [cmykColors, setCmykColors] = useState<number>(4);

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

  // Plate distributions
  const plateCalculations = useMemo(() => {
    return calculatePlateDistribution(
      layout.pieces,
      plates,
      adjustedSizes,
      adjustedGeneralQuantity
    );
  }, [layout.pieces, plates, adjustedSizes, adjustedGeneralQuantity]);

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

  const handleAutoPartitionPlates = () => {
    if (layout.pieces === 0 || adjustedSizes.length === 0) return;
    const needed = Math.max(1, Math.ceil(adjustedSizes.length / layout.pieces));
    const newPlatesList: PlateConfig[] = [];
    for (let i = 0; i < needed; i++) {
      newPlatesList.push({
        id: `plate-${i + 1}-${Date.now()}`,
        name: `Plate ${i + 1}`,
        manualSlots: {},
      });
    }
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
    const cells: GridCell[] = [];

    activePlate.assignments.forEach((assignment, index) => {
      for (let i = 0; i < assignment.slots; i++) {
        cells.push({
          label: assignment.sizeLabel,
          color: COLOR_PALETTE[index % COLOR_PALETTE.length],
          sizeId: assignment.sizeId,
        });
      }
    });

    while (cells.length < layout.pieces) {
      cells.push({ label: "Empty", color: "#f4f4f5", sizeId: "empty" });
    }

    return cells;
  }, [activePlate, layout.pieces]);

  // Overall Statistics
  const totalSheetsRun = plateCalculations.reduce((sum, p) => sum + p.requiredSheets, 0);
  const totalCtpPlates = plates.length * cmykColors;
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
    handleAddPlate,
    handleRemovePlate,
    handleAutoPartitionPlates,
    handleManualSlotChange,

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
