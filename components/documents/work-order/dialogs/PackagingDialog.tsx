"use client";

import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "../types";

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
  onSavePackaging,
  onOpenPrintModal,
}: PackagingDialogProps) {
  const [standardCapacity, setStandardCapacity] = useState<number>(500);
  const [boxType, setBoxType] = useState<string>(BOX_TYPE_OPTIONS[0].value);
  const [packerName, setPackerName] = useState<string>("N. Fedorov (Packaging)");
  const [boxes, setBoxes] = useState<PackagingBoxItem[]>([]);

  // Detect whether size matrix is active
  const hasValidSizeMatrix = useMemo(() => {
    return (sizes || []).some((s) => Number(s.quantity) > 0);
  }, [sizes]);

  // Load existing or pre-generate on open
  useEffect(() => {
    if (isOpen) {
      if (existingPackaging && existingPackaging.boxes && existingPackaging.boxes.length > 0) {
        setBoxes(existingPackaging.boxes);
        setStandardCapacity(existingPackaging.standardBoxCapacity || 500);
        setBoxType(existingPackaging.boxType || BOX_TYPE_OPTIONS[0].value);
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
        setBoxes(generated);
      }
    }
  }, [isOpen, existingPackaging, workOrderNo, targetQuantity, hasValidSizeMatrix, sizes, packerName]);

  // Handle auto-split click
  const handleAutoSplit = () => {
    const generated = autoGeneratePackagingBoxes({
      workOrderNo,
      targetQuantity,
      standardCapacity,
      sizes: hasValidSizeMatrix ? sizes : undefined,
      defaultPacker: packerName,
    });
    setBoxes(generated);
  };

  // Add manual box
  const handleAddManualBox = () => {
    const nextNum = boxes.length + 1;
    const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");
    const defaultSize = hasValidSizeMatrix && sizes.length > 0 ? sizes[0].size : undefined;
    const defaultModel = hasValidSizeMatrix && sizes.length > 0 ? sizes[0].model : undefined;
    const newBox: PackagingBoxItem = {
      id: `box-manual-${Date.now()}-${nextNum}`,
      boxNumber: nextNum,
      boxCode: `BX-${cleanWo}-${String(nextNum).padStart(2, "0")}`,
      model: defaultModel,
      sizeCode: defaultSize,
      quantity: standardCapacity,
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

  // Box cell edits
  const handleBoxQtyChange = (boxId: string, val: number) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, quantity: Math.max(0, val) } : b))
    );
  };

  const handleBoxWeightChange = (boxId: string, val: number) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, grossWeightKg: val > 0 ? val : undefined } : b))
    );
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

  const handleClearAllBoxes = () => {
    setBoxes([]);
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
      boxes,
    };
  }, [standardCapacity, boxType, boxes, totalPackedQty, targetQuantity, existingPackaging]);

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
      <DialogContent className="sm:max-w-[880px] max-h-[92vh] flex flex-col p-0 overflow-hidden text-xs">
        {/* Header */}
        <DialogHeader className="p-3 pr-12 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-md border border-border bg-muted flex items-center justify-center text-foreground shrink-0">
                <Package className="size-4" />
              </div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Qadoqlash va sifat qabuli
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
                <span>Yorliqlar</span>
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
                    <th className="py-1 px-2.5 text-left border-l border-border font-medium">O&apos;lchamlar taqsimoti</th>
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
                  <span className="text-muted-foreground text-[11px]">Jami brutto:</span>
                  <strong className="font-mono text-xs">{totalGrossWeight.toFixed(1)}</strong>
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
                  <TableHead className="w-32">Quti kodi</TableHead>
                  {hasValidSizeMatrix && <TableHead className="w-28">Model</TableHead>}
                  {hasValidSizeMatrix && <TableHead className="w-28">O&apos;lcham</TableHead>}
                  <TableHead className="w-24 text-right">Miqdor (dona)</TableHead>
                  <TableHead className="w-24 text-right">Brutto (kg)</TableHead>
                  <TableHead className="w-36">Mas&apos;ul xodim</TableHead>
                  <TableHead className="w-28">Izoh</TableHead>
                  <TableHead className="w-16 text-center">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.map((box) => (
                  <TableRow key={box.id} className="h-8 hover:bg-muted/40 text-xs">
                    <TableCell className="text-center font-mono font-bold text-muted-foreground">
                      {box.boxNumber}
                    </TableCell>
                    <TableCell className="font-mono font-medium text-foreground">
                      {box.boxCode}
                    </TableCell>
                    {hasValidSizeMatrix && (
                      <TableCell className="font-medium text-foreground truncate max-w-[110px]">
                        {box.model || "—"}
                      </TableCell>
                    )}
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
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={box.quantity}
                        onChange={(e) => handleBoxQtyChange(box.id, Number(e.target.value) || 0)}
                        className="h-6 w-20 text-right font-mono font-bold ml-auto text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        value={box.grossWeightKg ?? ""}
                        onChange={(e) =>
                          handleBoxWeightChange(
                            box.id,
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                        className="h-6 w-18 text-right font-mono text-xs ml-auto"
                      />
                    </TableCell>
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
                    <TableCell>
                      <Input
                        type="text"
                        placeholder="Izoh..."
                        value={box.notes || ""}
                        onChange={(e) => handleBoxNotesChange(box.id, e.target.value)}
                        className="h-6 text-[11px] bg-background px-1.5"
                      />
                    </TableCell>
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
                ))}
              </TableBody>
              <TableFooter className="bg-muted/70 sticky bottom-0 z-10 text-xs font-semibold border-t border-border">
                <TableRow className="h-8 hover:bg-transparent">
                  <TableCell colSpan={hasValidSizeMatrix ? 4 : 2} className="text-left font-medium">
                    Jami ({boxes.length} ta quti)
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {totalPackedQty.toLocaleString()} {unit}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {totalGrossWeight > 0 ? `${totalGrossWeight.toFixed(1)} kg` : "—"}
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
              Qoralama saqlash
            </Button>
            {boxes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintLabelsClick}
                className="h-8 text-xs font-medium gap-1.5 cursor-pointer text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
              >
                <Printer className="size-3.5" />
                <span>Chop etish</span>
              </Button>
            )}
            {boxes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllBoxes}
                className="h-8 text-xs text-muted-foreground hover:text-destructive cursor-pointer gap-1"
                title="Barcha qutilarni tozalash"
              >
                <RotateCcw className="size-3" />
                <span>Tozalash</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-medium cursor-pointer"
            >
              Bekor qilish
            </Button>
            <Button
              onClick={handleCompletePackaging}
              size="sm"
              className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
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
