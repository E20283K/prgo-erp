"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Package,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  CheckCircle2,
  AlertCircle,
  Copy,
  UserCheck,
  RotateCcw,
  Scale,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import {
  PackagingBoxItem,
  WorkOrderPackagingSummary,
  SizeDistribution,
  autoGeneratePackagingBoxes,
  FLOOR_OPERATORS,
  KashirovkaMode,
  SubstrateLayer,
} from "../types";
import {
  calculateTheoreticalUnitWeight,
  calibrateFromScaleSample,
  calculatePiecesFromWeight,
  calculateWeightFromPieces,
} from "../utils/weightCountingEngine";

const BOX_TYPE_OPTIONS: ComboboxItem[] = [
  { value: "Gofrokarobka T-23 (300×200×150 mm)", label: "Gofrokarobka T-23 (300×200×150 mm)", badge: "T-23" },
  { value: "Gofrokarobka T-24 (400×300×250 mm)", label: "Gofrokarobka T-24 (400×300×250 mm)", badge: "T-24" },
  { value: "Mikrogofro E-Flute (250×200×100 mm)", label: "Mikrogofro E-Flute (250×200×100 mm)", badge: "E-Flute" },
  { value: "Termoplyonka (Shrink Film Roll)", label: "Termoplyonka (Shrink Film Roll)", badge: "Plyonka" },
  { value: "Plastik quti / Konteyner", label: "Plastik quti / Konteyner", badge: "Konteyner" },
  { value: "Maxsus o'ram / Qop", label: "Maxsus o'ram / Qop", badge: "Qop" },
];

const OPERATOR_OPTIONS: ComboboxItem[] = FLOOR_OPERATORS.map((op) => ({
  value: op,
  label: op,
  icon: UserCheck,
}));

const CAPACITY_PRESETS = [100, 250, 500, 1000];
const SAMPLE_PCS_PRESETS = [50, 100, 200];

interface PackagingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderNo: string;
  clientOrderNo?: string;
  customer: string;
  product: string;
  targetQuantity: number;
  unit?: string;
  sizes?: SizeDistribution[];
  existingPackaging?: WorkOrderPackagingSummary;
  width?: number;
  height?: number;
  paperDensity?: number;
  kashirovkaMode?: KashirovkaMode;
  kashirovkaLayers?: SubstrateLayer[];
  lamination?: string;
  coating?: string;
  onSavePackaging: (summary: WorkOrderPackagingSummary, markComplete: boolean) => void;
  onOpenPrintModal: (summary: WorkOrderPackagingSummary) => void;
}

export function PackagingDialog({
  isOpen,
  onOpenChange,
  workOrderNo,
  clientOrderNo,
  customer,
  product,
  targetQuantity,
  unit = "dona",
  sizes = [],
  existingPackaging,
  width,
  height,
  paperDensity,
  kashirovkaMode,
  kashirovkaLayers,
  lamination,
  coating,
  onSavePackaging,
  onOpenPrintModal,
}: PackagingDialogProps) {
  const [standardCapacity, setStandardCapacity] = useState<number>(500);
  const [boxType, setBoxType] = useState<string>(BOX_TYPE_OPTIONS[0].value);
  const [packerName, setPackerName] = useState<string>("N. Fedorov (Packaging)");
  const [boxes, setBoxes] = useState<PackagingBoxItem[]>([]);

  // Theoretical 1 pc weight calculated from order specs
  const theoreticalUnitWeight = useMemo(() => {
    return calculateTheoreticalUnitWeight({
      widthMm: width,
      heightMm: height,
      paperDensity,
      kashirovkaMode,
      kashirovkaLayers,
      lamination,
      coating,
    });
  }, [width, height, paperDensity, kashirovkaMode, kashirovkaLayers, lamination, coating]);

  // Calibration state (Derived when theoretical, explicit when scale calibrated)
  const [calibratedWeight, setCalibratedWeight] = useState<number | null>(() => {
    if (existingPackaging?.calibrationMethod === "scale_sample" && existingPackaging.unitWeightGrams) {
      return existingPackaging.unitWeightGrams;
    }
    return null;
  });
  const [samplePcs, setSamplePcs] = useState<number>(existingPackaging?.samplePcs || 100);
  const [sampleWeightInput, setSampleWeightInput] = useState<string>(
    existingPackaging?.sampleWeightGrams ? String(existingPackaging.sampleWeightGrams) : ""
  );
  const [isCalibratePopoverOpen, setIsCalibratePopoverOpen] = useState<boolean>(false);

  const calibrationMethod: "theoretical" | "scale_sample" =
    calibratedWeight !== null ? "scale_sample" : "theoretical";

  const unitWeightGrams = calibratedWeight !== null ? calibratedWeight : theoreticalUnitWeight;

  // Express Weigh input state
  const [isExpressWeighOpen, setIsExpressWeighOpen] = useState<boolean>(false);
  const [expressWeightInput, setExpressWeightInput] = useState<string>("");
  const expressInputRef = useRef<HTMLInputElement>(null);

  // Detect whether size matrix is active
  const hasValidSizeMatrix = useMemo(() => {
    return (sizes || []).some((s) => Number(s.quantity) > 0);
  }, [sizes]);

  const prevIsOpenRef = useRef(false);

  // Load existing or pre-generate on dialog open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setTimeout(() => {
        if (existingPackaging && existingPackaging.boxes && existingPackaging.boxes.length > 0) {
          setBoxes(existingPackaging.boxes);
          setStandardCapacity(existingPackaging.standardBoxCapacity || 500);
          setBoxType(existingPackaging.boxType || BOX_TYPE_OPTIONS[0].value);
          if (existingPackaging.calibrationMethod === "scale_sample" && existingPackaging.unitWeightGrams) {
            setCalibratedWeight(existingPackaging.unitWeightGrams);
            setSamplePcs(existingPackaging.samplePcs || 100);
            if (existingPackaging.sampleWeightGrams) {
              setSampleWeightInput(String(existingPackaging.sampleWeightGrams));
            }
          } else {
            setCalibratedWeight(null);
          }
        } else {
          const initialCapacity = targetQuantity >= 20000 ? 1000 : targetQuantity >= 5000 ? 500 : 250;
          setStandardCapacity(initialCapacity);
          const generated = autoGeneratePackagingBoxes({
            workOrderNo,
            targetQuantity,
            standardCapacity: initialCapacity,
            sizes: hasValidSizeMatrix ? sizes : undefined,
            defaultPacker: packerName,
          });

          // Pre-fill gross weight from theoretical unit weight
          const filled = generated.map((b) => ({
            ...b,
            grossWeightKg: calculateWeightFromPieces(b.quantity, theoreticalUnitWeight),
            unitWeightGrams: theoreticalUnitWeight,
            countDeviation: 0,
          }));
          setBoxes(filled);
          setCalibratedWeight(null);
        }
      }, 0);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, existingPackaging, workOrderNo, targetQuantity, hasValidSizeMatrix, sizes, packerName, theoreticalUnitWeight]);

  // Apply Scale Sample Calibration
  const handleApplyCalibration = () => {
    const w = parseFloat(sampleWeightInput);
    if (!isNaN(w) && w > 0 && samplePcs > 0) {
      const calibratedUnit = calibrateFromScaleSample(samplePcs, w);
      setCalibratedWeight(calibratedUnit);
      setIsCalibratePopoverOpen(false);

      // Recalculate quantities for weighed boxes
      setBoxes((prev) =>
        prev.map((b) => {
          if (b.grossWeightKg && b.grossWeightKg > 0) {
            const calculatedQty = calculatePiecesFromWeight(b.grossWeightKg, calibratedUnit);
            return {
              ...b,
              quantity: calculatedQty,
              unitWeightGrams: calibratedUnit,
              isWeighed: true,
              countDeviation: calculatedQty - standardCapacity,
            };
          }
          return {
            ...b,
            unitWeightGrams: calibratedUnit,
          };
        })
      );
    }
  };

  const handleResetToTheoretical = () => {
    setCalibratedWeight(null);
    setSampleWeightInput("");
    setIsCalibratePopoverOpen(false);
  };

  // Handle auto-split click
  const handleAutoSplit = () => {
    const generated = autoGeneratePackagingBoxes({
      workOrderNo,
      targetQuantity,
      standardCapacity,
      sizes: hasValidSizeMatrix ? sizes : undefined,
      defaultPacker: packerName,
    });
    const filled = generated.map((b) => ({
      ...b,
      grossWeightKg: calculateWeightFromPieces(b.quantity, unitWeightGrams),
      unitWeightGrams,
      countDeviation: 0,
    }));
    setBoxes(filled);
  };

  // Add manual box
  const handleAddManualBox = () => {
    const nextNum = boxes.length + 1;
    const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");
    const defaultSize = hasValidSizeMatrix && sizes.length > 0 ? sizes[0].size : undefined;
    const defaultModel = hasValidSizeMatrix && sizes.length > 0 ? sizes[0].model : undefined;
    const defaultWeight = calculateWeightFromPieces(standardCapacity, unitWeightGrams);

    const newBox: PackagingBoxItem = {
      id: `box-manual-${Date.now()}-${nextNum}`,
      boxNumber: nextNum,
      boxCode: `BX-${cleanWo}-${String(nextNum).padStart(2, "0")}`,
      model: defaultModel,
      sizeCode: defaultSize,
      quantity: standardCapacity,
      grossWeightKg: defaultWeight,
      unitWeightGrams,
      countDeviation: 0,
      packerName,
      packedAt: new Date().toISOString(),
      barcode: `${cleanWo}-B${String(nextNum).padStart(2, "0")}`,
    };
    setBoxes((prev) => [...prev, newBox]);
  };

  // Duplicate box
  const handleDuplicateBox = (box: PackagingBoxItem) => {
    const nextNum = boxes.length + 1;
    const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");
    const newBox: PackagingBoxItem = {
      ...box,
      id: `box-dup-${Date.now()}-${nextNum}`,
      boxNumber: nextNum,
      boxCode: `BX-${cleanWo}-${String(nextNum).padStart(2, "0")}`,
      barcode: `${cleanWo}-B${String(nextNum).padStart(2, "0")}`,
      packedAt: new Date().toISOString(),
    };
    setBoxes((prev) => [...prev, newBox]);
  };

  // Interactive 2-Way Box Edits:
  // 1) When Weight is edited -> calculate quantity
  const handleBoxWeightChange = (boxId: string, val: number) => {
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== boxId) return b;
        if (val <= 0) {
          return { ...b, grossWeightKg: undefined, countDeviation: 0, isWeighed: false };
        }
        if (unitWeightGrams > 0) {
          const calculatedQty = calculatePiecesFromWeight(val, unitWeightGrams);
          return {
            ...b,
            grossWeightKg: val,
            quantity: calculatedQty,
            unitWeightGrams,
            isWeighed: true,
            countDeviation: calculatedQty - standardCapacity,
          };
        }
        return { ...b, grossWeightKg: val };
      })
    );
  };

  // 2) When Quantity is edited manually -> recalculate theoretical weight
  const handleBoxQtyChange = (boxId: string, val: number) => {
    const nextQty = Math.max(0, val);
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== boxId) return b;
        const estWeight = unitWeightGrams > 0 ? calculateWeightFromPieces(nextQty, unitWeightGrams) : b.grossWeightKg;
        return {
          ...b,
          quantity: nextQty,
          grossWeightKg: estWeight,
          isWeighed: false,
          countDeviation: nextQty - standardCapacity,
        };
      })
    );
  };

  // Express Weigh: Add box from scale weight input directly
  const handleAddExpressWeighBox = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const weightKg = parseFloat(expressWeightInput);
    if (isNaN(weightKg) || weightKg <= 0) return;

    const nextNum = boxes.length + 1;
    const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");
    const defaultSize = hasValidSizeMatrix && sizes.length > 0 ? sizes[0].size : undefined;
    const defaultModel = hasValidSizeMatrix && sizes.length > 0 ? sizes[0].model : undefined;
    const calculatedQty = calculatePiecesFromWeight(weightKg, unitWeightGrams);

    const newBox: PackagingBoxItem = {
      id: `box-weighed-${Date.now()}-${nextNum}`,
      boxNumber: nextNum,
      boxCode: `BX-${cleanWo}-${String(nextNum).padStart(2, "0")}`,
      model: defaultModel,
      sizeCode: defaultSize,
      quantity: calculatedQty,
      grossWeightKg: weightKg,
      unitWeightGrams,
      isWeighed: true,
      countDeviation: calculatedQty - standardCapacity,
      packerName,
      packedAt: new Date().toISOString(),
      barcode: `${cleanWo}-B${String(nextNum).padStart(2, "0")}`,
    };

    setBoxes((prev) => [...prev, newBox]);
    setExpressWeightInput("");
    if (expressInputRef.current) {
      expressInputRef.current.focus();
    }
  };

  const handleBoxPackerChange = (boxId: string, newPacker: string) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, packerName: newPacker } : b))
    );
  };

  const handleBoxSizeCodeChange = (boxId: string, newSize: string) => {
    const matchedSize = sizes.find((s) => s.size === newSize);
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId
          ? {
              ...b,
              sizeCode: newSize === "all" ? undefined : newSize,
              model: matchedSize?.model || b.model,
            }
          : b
      )
    );
  };

  const handleBoxNotesChange = (boxId: string, notes: string) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, notes } : b))
    );
  };

  const handleDeleteBox = (boxId: string) => {
    const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");
    setBoxes((prev) =>
      prev
        .filter((b) => b.id !== boxId)
        .map((b, idx) => ({
          ...b,
          boxNumber: idx + 1,
          boxCode: `BX-${cleanWo}-${String(idx + 1).padStart(2, "0")}`,
          barcode: `${cleanWo}-B${String(idx + 1).padStart(2, "0")}`,
        }))
    );
  };

  // Bulk actions
  const handleApplyPackerToAll = () => {
    setBoxes((prev) => prev.map((b) => ({ ...b, packerName })));
  };

  // Calculations
  const totalPackedQty = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [boxes]);

  const totalGrossWeight = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.grossWeightKg) || 0), 0);
  }, [boxes]);

  const diffQty = totalPackedQty - targetQuantity;
  const isExactMatch = totalPackedQty === targetQuantity;
  const completionPercent = targetQuantity > 0 ? Math.min(100, Math.round((totalPackedQty / targetQuantity) * 100)) : 0;

  const currentSummary: WorkOrderPackagingSummary = useMemo(() => {
    return {
      standardBoxCapacity: standardCapacity,
      boxType,
      totalBoxes: boxes.length,
      totalPackedQty,
      targetQty: targetQuantity,
      isCompleted: existingPackaging?.isCompleted || false,
      completedAt: existingPackaging?.completedAt,
      unitWeightGrams,
      calibrationMethod,
      samplePcs,
      sampleWeightGrams: sampleWeightInput ? parseFloat(sampleWeightInput) : undefined,
      boxes,
    };
  }, [standardCapacity, boxType, boxes, totalPackedQty, targetQuantity, existingPackaging, unitWeightGrams, calibrationMethod, samplePcs, sampleWeightInput]);

  const handleSaveDraft = () => {
    onSavePackaging(currentSummary, false);
    onOpenChange(false);
  };

  const handleCompletePackaging = () => {
    const completedSummary: WorkOrderPackagingSummary = {
      ...currentSummary,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
    onSavePackaging(completedSummary, true);
    onOpenChange(false);
  };

  const handlePrintLabelsClick = () => {
    onOpenPrintModal(currentSummary);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[940px] max-h-[92vh] flex flex-col p-0 overflow-hidden text-xs">
        {/* Header */}
        <DialogHeader className="p-3 pr-12 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-md border border-border bg-muted flex items-center justify-center text-foreground shrink-0">
                <Package className="size-4" />
              </div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Qadoqlash va tarozi orqali qabul
              </DialogTitle>
              {hasValidSizeMatrix ? (
                <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
                  O&apos;lchamli tiraj
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                  Yagona tiraj
                </Badge>
              )}
            </div>

            {boxes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintLabelsClick}
                className="h-7 text-xs font-medium gap-1.5 shrink-0 cursor-pointer mr-1"
              >
                <Printer className="size-3.5" />
                <span>Yorliqlar (100×150)</span>
              </Button>
            )}
          </div>

          <DialogDescription className="sr-only">
            Buyurtma: {workOrderNo}, Mijoz: {customer}, Reja: {targetQuantity} {unit}
          </DialogDescription>

          {/* Mini Order Specs Table */}
          <div className="rounded border border-border overflow-hidden bg-background">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/60 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-1 px-2.5 text-left border-r border-border font-medium w-32">Buyurtma</th>
                  <th className="py-1 px-2.5 text-left border-r border-border font-medium">Mijoz</th>
                  <th className="py-1 px-2.5 text-left border-r border-border font-medium">Mahsulot</th>
                  <th className="py-1 px-2.5 text-right font-medium w-28">Reja miqdori</th>
                  {hasValidSizeMatrix && (
                    <th className="py-1 px-2.5 text-left border-l border-border font-medium">O&apos;lchamlar</th>
                  )}
                </tr>
              </thead>
              <tbody className="text-[11px]">
                <tr className="h-6.5">
                  <td className="py-1 px-2.5 border-r border-border font-mono font-medium text-foreground whitespace-nowrap">
                    {workOrderNo}
                    {clientOrderNo && (
                      <span className="text-muted-foreground text-[10px] ml-1">({clientOrderNo})</span>
                    )}
                  </td>
                  <td className="py-1 px-2.5 border-r border-border font-medium text-foreground truncate max-w-[150px]" title={customer}>
                    {customer || "—"}
                  </td>
                  <td className="py-1 px-2.5 border-r border-border text-muted-foreground truncate max-w-[240px]" title={product}>
                    {product || "—"}
                  </td>
                  <td className="py-1 px-2.5 text-right font-mono font-bold text-foreground whitespace-nowrap">
                    {targetQuantity.toLocaleString()}{" "}
                    <span className="font-normal text-[10px] text-muted-foreground">{unit}</span>
                  </td>
                  {hasValidSizeMatrix && (
                    <td className="py-1 px-2.5 border-l border-border">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sizes.filter((s) => Number(s.quantity) > 0).map((s) => (
                          <span
                            key={s.id || s.size}
                            className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded border border-border/70"
                          >
                            <span className="font-semibold text-foreground">{s.size}:</span>
                            <span className="text-muted-foreground">{Number(s.quantity).toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </DialogHeader>

        {/* ── Counting Scale & Calibration Control Bar ── */}
        <div className="p-2.5 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Unit Weight & Method Indicator */}
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded border border-border bg-muted flex items-center justify-center text-foreground shrink-0">
              <Scale className="size-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">
                  1 dona birlik og&apos;irligi:
                </span>
                <span className="font-mono font-bold text-xs text-primary">
                  {unitWeightGrams > 0 ? `${unitWeightGrams} g` : "0 g"}
                </span>
                <Badge
                  variant="outline"
                  className={
                    calibrationMethod === "scale_sample"
                      ? "text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-mono"
                      : "text-[9px] px-1 py-0 text-muted-foreground font-mono"
                  }
                >
                  {calibrationMethod === "scale_sample" ? "Etalon kalibrovka" : "Nazariy hisob"}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {width && height ? `${width}×${height} mm` : "Standart format"} •{" "}
                {paperDensity ? `${paperDensity} g/m²` : "Qog'oz"}
                {calibrationMethod === "scale_sample" && sampleWeightInput
                  ? ` (Etalon: ${samplePcs} dona = ${sampleWeightInput} g)`
                  : ""}
              </div>
            </div>
          </div>

          {/* Scale Actions */}
          <div className="flex items-center gap-1.5">
            {/* Popover: Calibrate with scale sample */}
            <Popover open={isCalibratePopoverOpen} onOpenChange={setIsCalibratePopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                  >
                    <Scale className="size-3.5" />
                    <span>Etalondan kalibrovka</span>
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-72 p-3 space-y-2.5 text-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-xs flex items-center gap-1 text-foreground">
                    <Scale className="size-3.5" />
                    <span>Etalon namuna tortish</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Taroziga 50 yoki 100 dona kesilgan mahsulotni qo&apos;ying va sof vaznini kiriting.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Namuna donasi:</span>
                    <div className="flex items-center gap-1">
                      {SAMPLE_PCS_PRESETS.map((pcs) => (
                        <button
                          key={pcs}
                          type="button"
                          onClick={() => setSamplePcs(pcs)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                            samplePcs === pcs
                              ? "bg-primary text-primary-foreground border-primary font-bold"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                          }`}
                        >
                          {pcs}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      Tarozidagi vazn (gramm):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="masalan: 142.5"
                        value={sampleWeightInput}
                        onChange={(e) => setSampleWeightInput(e.target.value)}
                        className="h-7.5 text-xs font-mono font-semibold"
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground font-mono">g</span>
                    </div>
                  </div>

                  {sampleWeightInput && parseFloat(sampleWeightInput) > 0 && (
                    <div className="p-1.5 rounded bg-muted text-[10px] font-mono flex items-center justify-between">
                      <span className="text-muted-foreground">1 dona natija:</span>
                      <strong className="text-foreground">
                        {(parseFloat(sampleWeightInput) / samplePcs).toFixed(3)} g
                      </strong>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetToTheoretical}
                    className="h-7 text-[10px] text-muted-foreground px-2"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Nazariyga qaytish
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyCalibration}
                    disabled={!sampleWeightInput || parseFloat(sampleWeightInput) <= 0}
                    className="h-7 text-xs px-2.5"
                  >
                    <Check className="size-3.5 mr-1" />
                    Kalibrovka
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Toggle Express Weigh Mode */}
            <Button
              type="button"
              variant={isExpressWeighOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setIsExpressWeighOpen((prev) => !prev);
                setTimeout(() => expressInputRef.current?.focus(), 50);
              }}
              className="h-7 text-xs gap-1.5"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Tezkor tortish</span>
            </Button>
          </div>
        </div>

        {/* ── Express Weigh Input Bar (When Active) ── */}
        {isExpressWeighOpen && (
          <form
            onSubmit={handleAddExpressWeighBox}
            className="p-2.5 bg-muted/60 border-b border-border flex items-center gap-3 shrink-0"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground shrink-0">
              <Scale className="size-4 text-primary" />
              <span>Quti sof vazni (kg):</span>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Input
                ref={expressInputRef}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Tarozidagi vazn (masalan: 7.12)"
                value={expressWeightInput}
                onChange={(e) => setExpressWeightInput(e.target.value)}
                className="h-7.5 text-xs font-mono font-bold bg-background"
                autoFocus
              />
              <span className="text-xs text-muted-foreground font-mono">kg</span>
            </div>

            {expressWeightInput && parseFloat(expressWeightInput) > 0 && unitWeightGrams > 0 && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Hisoblandi:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {calculatePiecesFromWeight(parseFloat(expressWeightInput), unitWeightGrams).toLocaleString()} {unit}
                </strong>
                <span className="text-[10px] text-muted-foreground">
                  (Og&apos;ish:{" "}
                  {calculatePiecesFromWeight(parseFloat(expressWeightInput), unitWeightGrams) - standardCapacity >= 0
                    ? `+${calculatePiecesFromWeight(parseFloat(expressWeightInput), unitWeightGrams) - standardCapacity}`
                    : calculatePiecesFromWeight(parseFloat(expressWeightInput), unitWeightGrams) - standardCapacity})
                </span>
              </div>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={!expressWeightInput || parseFloat(expressWeightInput) <= 0}
              className="h-7.5 text-xs px-3 ml-auto gap-1"
            >
              <Plus className="size-3.5" />
              <span>Qutini qo&apos;shish (Enter)</span>
            </Button>
          </form>
        )}

        {/* Configuration Bar */}
        <div className="p-3 bg-muted/40 border-b border-border grid grid-cols-1 sm:grid-cols-4 gap-2.5 shrink-0 items-end">
          {/* Capacity */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground">
                Quti sig&apos;imi (dona):
              </label>
              <div className="flex items-center gap-1">
                {CAPACITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStandardCapacity(preset)}
                    className={`text-[10px] px-1 py-0.2 rounded border font-mono transition-colors cursor-pointer ${
                      standardCapacity === preset
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              step="50"
              min="1"
              value={standardCapacity}
              onChange={(e) => setStandardCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="h-7.5 text-xs font-mono font-bold bg-background"
            />
          </div>

          {/* Box Type Combobox */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              Tara turi:
            </label>
            <SmartCombobox
              value={boxType}
              onChange={setBoxType}
              options={BOX_TYPE_OPTIONS}
              placeholder="Tara turini tanlang..."
              searchPlaceholder="Tara turi bo'yicha qidirish..."
              allowCustom={true}
              className="h-7.5 text-xs bg-background"
              popoverWidth="w-[320px]"
            />
          </div>

          {/* Packer Combobox */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground block">
                Mas&apos;ul xodim:
              </label>
              {boxes.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyPackerToAll}
                  className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                  title="Ushbu mas'ulni jadvaldagi barcha qutilarga biriktirish"
                >
                  Barchasiga
                </button>
              )}
            </div>
            <SmartCombobox
              value={packerName}
              onChange={setPackerName}
              options={OPERATOR_OPTIONS}
              placeholder="Xodimni tanlang..."
              searchPlaceholder="Xodim qidirish..."
              allowCustom={true}
              className="h-7.5 text-xs bg-background"
              popoverWidth="w-[280px]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              onClick={handleAutoSplit}
              size="sm"
              variant="secondary"
              className="h-7.5 text-xs font-medium gap-1.5 flex-1 cursor-pointer"
              title="Kiritilgan quti sig'imi bo'yicha qayta taqsimlash"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Avto-taqsimlash</span>
            </Button>
            <Button
              onClick={handleAddManualBox}
              size="sm"
              variant="outline"
              className="h-7.5 text-xs font-medium gap-1 shrink-0 cursor-pointer"
              title="Yangi quti qo'shish"
            >
              <Plus className="size-3.5" />
              <span>Quti</span>
            </Button>
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="border-b border-border bg-card shrink-0">
          <div className="px-4 py-2 flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground text-[11px]">Reja:</span>
                <strong className="font-mono text-xs">{targetQuantity.toLocaleString()}</strong>
                <span className="text-[10px] text-muted-foreground">{unit}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground text-[11px]">Qadoqlandi:</span>
                <strong
                  className={`font-mono text-xs ${
                    isExactMatch
                      ? "text-emerald-600 dark:text-emerald-400"
                      : diffQty > 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {totalPackedQty.toLocaleString()}
                </strong>
                <span className="text-[10px] text-muted-foreground">{unit}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground text-[11px]">Qutilar:</span>
                <Badge variant="secondary" className="font-mono text-[11px] h-5 px-1.5 font-bold">
                  {boxes.length} ta
                </Badge>
              </div>
              {totalGrossWeight > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="text-muted-foreground text-[11px]">Jami sof vazn:</span>
                  <strong className="font-mono text-xs">{totalGrossWeight.toFixed(2)}</strong>
                  <span className="text-[10px] text-muted-foreground">kg</span>
                </div>
              )}
            </div>

            <div className="shrink-0">
              {isExactMatch ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-medium py-0.5">
                  <CheckCircle2 className="size-3.5" />
                  <span>Mos keldi</span>
                </Badge>
              ) : diffQty > 0 ? (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[11px] font-medium py-0.5">
                  +{diffQty.toLocaleString()} {unit} ortiqcha
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-medium py-0.5">
                  <AlertCircle className="size-3.5" />
                  <span>-{Math.abs(diffQty).toLocaleString()} {unit} yetishmayapti</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Completion Progress Bar */}
          <div className="h-0.5 w-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isExactMatch
                  ? "bg-emerald-600"
                  : diffQty > 0
                  ? "bg-blue-600"
                  : "bg-amber-500"
              }`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Table of Boxes */}
        <div className="flex-1 overflow-y-auto p-0 bg-background">
          {boxes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="size-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium text-xs">Hozircha birorta ham quti shakllantirilmadi.</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAutoSplit}
                  className="h-7 text-xs font-medium gap-1.5 cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>Avto-taqsimlash</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddManualBox}
                  className="h-7 text-xs font-medium gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Quti qo&apos;shish</span>
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/70 sticky top-0 z-10 text-[11px]">
                <TableRow className="h-7 hover:bg-transparent">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="w-28">Quti kodi</TableHead>
                  {hasValidSizeMatrix && <TableHead className="w-28">Model</TableHead>}
                  {hasValidSizeMatrix && <TableHead className="w-28">O&apos;lcham</TableHead>}
                  <TableHead className="w-28 text-right">Tarozida (kg)</TableHead>
                  <TableHead className="w-32 text-right">Miqdor (dona)</TableHead>
                  <TableHead className="w-36">Mas&apos;ul xodim</TableHead>
                  <TableHead className="w-24">Izoh</TableHead>
                  <TableHead className="w-16 text-center">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.map((box) => {
                  const hasDeviation = box.countDeviation !== undefined && box.countDeviation !== 0;

                  return (
                    <TableRow key={box.id} className="h-8 hover:bg-muted/40 text-xs">
                      {/* Box Number */}
                      <TableCell className="text-center font-mono font-bold text-muted-foreground">
                        {box.boxNumber}
                      </TableCell>

                      {/* Box Code */}
                      <TableCell className="font-mono font-medium text-foreground">
                        {box.boxCode}
                      </TableCell>

                      {/* Size Matrix: Model */}
                      {hasValidSizeMatrix && (
                        <TableCell className="font-medium text-foreground truncate max-w-[110px]">
                          {box.model || "—"}
                        </TableCell>
                      )}

                      {/* Size Matrix: Size Code */}
                      {hasValidSizeMatrix && (
                        <TableCell>
                          <Select
                            value={box.sizeCode || "all"}
                            onValueChange={(val) => handleBoxSizeCodeChange(box.id, val || "all")}
                          >
                            <SelectTrigger className="h-6 w-24 text-[11px] font-mono bg-background px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs font-mono">
                                Barchasi
                              </SelectItem>
                              {sizes.map((s) => (
                                <SelectItem key={s.id || s.size} value={s.size} className="text-xs font-mono">
                                  {s.size} ({Number(s.quantity).toLocaleString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}

                      {/* Net Weight (kg) with Scale indication */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {box.isWeighed && (
                            <span title="Tarozida tortib aniqlangan" className="inline-flex">
                              <Scale className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            </span>
                          )}
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={box.grossWeightKg ?? ""}
                            onChange={(e) =>
                              handleBoxWeightChange(
                                box.id,
                                e.target.value === "" ? 0 : Number(e.target.value)
                              )
                            }
                            className="h-6 w-20 text-right font-mono text-xs ml-auto"
                            title="Tarozidagi sof og'irlik (kg)"
                          />
                        </div>
                      </TableCell>

                      {/* Quantity (dona) with deviation indicator */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasDeviation && (
                            <span
                              className={`text-[9px] font-mono px-1 rounded ${
                                box.countDeviation! > 0
                                  ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
                                  : "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              }`}
                              title={`Standart ${standardCapacity} ga nisbatan farq`}
                            >
                              {box.countDeviation! > 0 ? `+${box.countDeviation}` : box.countDeviation}
                            </span>
                          )}
                          <Input
                            type="number"
                            min="0"
                            value={box.quantity}
                            onChange={(e) => handleBoxQtyChange(box.id, Number(e.target.value) || 0)}
                            className="h-6 w-20 text-right font-mono font-bold ml-auto text-xs"
                          />
                        </div>
                      </TableCell>

                      {/* Packer Name */}
                      <TableCell>
                        <Select
                          value={box.packerName || packerName}
                          onValueChange={(val) => handleBoxPackerChange(box.id, val || packerName)}
                        >
                          <SelectTrigger className="h-6 w-34 text-[11px] bg-background px-2 truncate">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FLOOR_OPERATORS.map((op) => (
                              <SelectItem key={op} value={op} className="text-xs">
                                {op}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Notes */}
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="Izoh..."
                          value={box.notes || ""}
                          onChange={(e) => handleBoxNotesChange(box.id, e.target.value)}
                          className="h-6 text-[11px] bg-background px-1.5"
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicateBox(box)}
                            className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Nusxalash"
                          >
                            <Copy className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBox(box.id)}
                            className="size-6 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter className="bg-muted/70 sticky bottom-0 z-10 text-xs font-semibold border-t border-border">
                <TableRow className="h-8 hover:bg-transparent">
                  <TableCell colSpan={hasValidSizeMatrix ? 4 : 2} className="text-left font-medium">
                    Jami ({boxes.length} ta quti)
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {totalGrossWeight > 0 ? `${totalGrossWeight.toFixed(2)} kg` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {totalPackedQty.toLocaleString()} {unit}
                  </TableCell>
                  <TableCell colSpan={3} className="text-muted-foreground text-[11px]">
                    {isExactMatch ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Rejaga to&apos;liq mos
                      </span>
                    ) : (
                      <span>
                        {diffQty > 0
                          ? `+${diffQty.toLocaleString()} ortiqcha`
                          : `${Math.abs(diffQty).toLocaleString()} yetishmayapti`}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="m-0 px-4 py-2.5 border-t border-border bg-card shrink-0 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              className="h-8 text-xs font-medium cursor-pointer"
            >
              Qoralamani saqlash
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs text-muted-foreground cursor-pointer"
            >
              Bekor qilish
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCompletePackaging}
              disabled={boxes.length === 0}
              className="h-8 text-xs font-medium gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Qadoqlashni yakunlash</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
