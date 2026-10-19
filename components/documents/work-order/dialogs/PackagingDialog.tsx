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
  Tag,
  Layers,
  Box,
  Scale,
  UserCheck,
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
} from "@/components/ui/table";
import {
  PackagingBoxItem,
  WorkOrderPackagingSummary,
  SizeDistribution,
  autoGeneratePackagingBoxes,
  FLOOR_OPERATORS,
} from "../types";

const BOX_TYPE_OPTIONS = [
  "Gofrokarobka T-23 (300×200×150 mm)",
  "Gofrokarobka T-24 (400×300×250 mm)",
  "Mikrogofro E-Flute (250×200×100 mm)",
  "Termoplyonka (Shrink Film Roll)",
  "Plastik quti / Konteyner",
  "Maxsus o'ram / Qop",
];

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
  const [boxType, setBoxType] = useState<string>(BOX_TYPE_OPTIONS[0]);
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
        setBoxType(existingPackaging.boxType || BOX_TYPE_OPTIONS[0]);
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

  const handleDeleteBox = (boxId: string) => {
    setBoxes((prev) =>
      prev
        .filter((b) => b.id !== boxId)
        .map((b, idx) => ({ ...b, boxNumber: idx + 1, boxCode: `BX-${workOrderNo}-${String(idx + 1).padStart(2, "0")}` }))
    );
  };

  const handleAddManualBox = () => {
    const nextNum = boxes.length + 1;
    const cleanWo = (workOrderNo || "WO").replace(/[^a-zA-Z0-9_-]/g, "");
    const newBox: PackagingBoxItem = {
      id: `box-manual-${Date.now()}`,
      boxNumber: nextNum,
      boxCode: `BX-${cleanWo}-${String(nextNum).padStart(2, "0")}`,
      quantity: standardCapacity,
      packerName,
      packedAt: new Date().toISOString(),
      barcode: `${cleanWo}-B${String(nextNum).padStart(2, "0")}`,
    };
    setBoxes((prev) => [...prev, newBox]);
  };

  // Calculations
  const totalPackedQty = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [boxes]);

  const diffQty = totalPackedQty - targetQuantity;
  const isExactMatch = totalPackedQty === targetQuantity;

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
      <DialogContent className="sm:max-w-[840px] max-h-[92vh] flex flex-col p-0 overflow-hidden text-xs">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                <Box className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>Qadoqlash va Sifat Qabuli (Final Packaging & QC)</span>
                  {hasValidSizeMatrix ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30 font-medium">
                      Model va O&apos;lcham (Size Matrix) rejimi
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-neutral-500/10 text-neutral-600 border-neutral-500/30 font-medium">
                      Monotip Tiraj rejimi
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Buyurtma: <strong className="text-foreground">{workOrderNo}</strong> · Mijoz:{" "}
                  <strong className="text-foreground">{customer}</strong> · Reja:{" "}
                  <strong className="text-foreground">{targetQuantity.toLocaleString()} {unit}</strong>
                </DialogDescription>
              </div>
            </div>

            {/* Quick Print Button in Header if boxes exist */}
            {boxes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintLabelsClick}
                className="h-7 text-xs font-medium gap-1 text-blue-600 border-blue-600/30 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Yorliqlarni chop etish</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Configuration Bar */}
        <div className="p-3 bg-muted/40 border-b border-border grid grid-cols-4 gap-2.5 shrink-0 items-end">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Standart quti sig&apos;imi (dona):
            </label>
            <Input
              type="number"
              step="50"
              value={standardCapacity}
              onChange={(e) => setStandardCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="h-7.5 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Qadoq / Tara turi:
            </label>
            <select
              value={boxType}
              onChange={(e) => setBoxType(e.target.value)}
              className="w-full h-7.5 text-xs bg-background border border-border rounded px-2 font-medium"
            >
              {BOX_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Mas&apos;ul Qadoqlovchi:
            </label>
            <select
              value={packerName}
              onChange={(e) => setPackerName(e.target.value)}
              className="w-full h-7.5 text-xs bg-background border border-border rounded px-2 font-medium"
            >
              {FLOOR_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              onClick={handleAutoSplit}
              size="sm"
              variant="secondary"
              className="h-7.5 text-xs font-medium gap-1 flex-1 cursor-pointer"
              title="Kiritilgan quti sig'imi bo'yicha qayta taqsimlash"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Avto-taqsimlash</span>
            </Button>
            <Button
              onClick={handleAddManualBox}
              size="sm"
              variant="outline"
              className="h-7.5 text-xs font-medium gap-1 shrink-0 cursor-pointer"
              title="Yangi bo'sh quti qo'shish"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quti</span>
            </Button>
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="px-4 py-2 bg-card border-b border-border flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground text-[11px]">Reja: </span>
              <strong className="font-mono text-sm">{targetQuantity.toLocaleString()}</strong> {unit}
            </div>
            <div>
              <span className="text-muted-foreground text-[11px]">Qadoqlandi: </span>
              <strong
                className={`font-mono text-sm ${
                  isExactMatch
                    ? "text-emerald-600 dark:text-emerald-400"
                    : diffQty > 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {totalPackedQty.toLocaleString()}
              </strong>{" "}
              {unit}
            </div>
            <div>
              <span className="text-muted-foreground text-[11px]">Jami qutilar: </span>
              <Badge variant="secondary" className="font-mono font-bold text-xs h-5">
                {boxes.length} ta
              </Badge>
            </div>
          </div>

          <div>
            {isExactMatch ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Rejaga 100% mos keldi</span>
              </span>
            ) : diffQty > 0 ? (
              <span className="text-blue-600 dark:text-blue-400 font-medium text-[11px]">
                +{diffQty.toLocaleString()} {unit} ortiqcha qadoq
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Qoldiq: {Math.abs(diffQty).toLocaleString()} {unit} yetishmayapti</span>
              </span>
            )}
          </div>
        </div>

        {/* Table of Boxes */}
        <div className="flex-1 overflow-y-auto p-0 bg-background">
          {boxes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Box className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium text-xs">Hozircha birorta ham quti shakllantirilmadi.</p>
              <p className="text-[11px] mt-1">
                Yuqoridagi &quot;Avto-taqsimlash&quot; tugmasini bosing yoki qo&apos;lda quti qo&apos;shing.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/60 sticky top-0 z-10 text-[11px]">
                <TableRow className="h-7 hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-32">Quti Kori</TableHead>
                  {hasValidSizeMatrix && <TableHead className="w-32">Model / Artikul</TableHead>}
                  {hasValidSizeMatrix && <TableHead className="w-24">O&apos;lcham (Size)</TableHead>}
                  <TableHead className="w-28 text-right">Miqdori (dona)</TableHead>
                  <TableHead className="w-28 text-right">Brutto (kg)</TableHead>
                  <TableHead className="w-36">Mas&apos;ul xodim</TableHead>
                  <TableHead className="w-10 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.map((box, index) => (
                  <TableRow key={box.id} className="h-8.5 hover:bg-muted/40 text-xs">
                    <TableCell className="text-center font-mono font-bold text-muted-foreground">
                      {box.boxNumber}
                    </TableCell>
                    <TableCell className="font-mono font-medium text-foreground">
                      {box.boxCode}
                    </TableCell>
                    {hasValidSizeMatrix && (
                      <TableCell className="font-medium text-foreground truncate max-w-[120px]">
                        {box.model || "—"}
                      </TableCell>
                    )}
                    {hasValidSizeMatrix && (
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/30"
                        >
                          {box.sizeCode || "All"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={box.quantity}
                        onChange={(e) => handleBoxQtyChange(box.id, Number(e.target.value) || 0)}
                        className="h-6 w-24 text-right font-mono font-bold ml-auto text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={box.grossWeightKg || ""}
                        onChange={(e) => handleBoxWeightChange(box.id, Number(e.target.value) || 0)}
                        className="h-6 w-20 text-right font-mono text-xs ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[140px]">
                      {box.packerName || packerName}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBox(box.id)}
                        className="w-6 h-6 text-muted-foreground hover:text-red-600 cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border bg-card shrink-0 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              className="h-8 text-xs font-medium cursor-pointer"
            >
              Qoralama saqlash
            </Button>
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
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Qadoqlashni Yakunlash (Tayyor Omboriga)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
