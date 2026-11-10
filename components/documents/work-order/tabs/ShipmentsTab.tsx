"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Truck,
  Plus,
  Layers,
  Split,
  ExternalLink,
  Edit2,
  Trash2,
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  Printer,
  Boxes,
  CheckSquare,
  Square,
  Scale,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  WorkOrderFormData,
  WorkOrderDeliveryBatch,
  DeliveryBatchStatus,
  PackagingBoxItem,
  WorkOrderPackagingSummary,
  RouteStep,
  ShiftEvent,
} from "../types";
import { BatchEditDialog } from "../dialogs/BatchEditDialog";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

interface ShipmentsTabProps {
  formData: WorkOrderFormData;
  docNo: string;
  operations?: RouteStep[];
  shiftEvents?: ShiftEvent[];
  onUpdateBatches: (batches: WorkOrderDeliveryBatch[]) => void;
  onCreateShipment: (batch: WorkOrderDeliveryBatch, allocatedBoxIds?: string[]) => void;
  onOpenShipment: (shipmentId: string) => void;
  onOpenDeliveryAct?: (actId: string) => void;
  onOpenPackaging?: () => void;
  onOpenPrintLabels?: () => void;
  onUpdatePackaging?: (summary: WorkOrderPackagingSummary) => void;
}

const STATUS_CONFIG: Record<
  DeliveryBatchStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }
> = {
  scheduled: {
    label: "Rejalashtirilgan",
    variant: "outline",
    className: "border-border text-muted-foreground bg-muted/40",
  },
  in_production: {
    label: "Ishlab chiqarilmoqda",
    variant: "outline",
    className: "border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10",
  },
  ready: {
    label: "Tayyor (Omborda)",
    variant: "outline",
    className: "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  },
  dispatched: {
    label: "Jo'natilgan",
    variant: "outline",
    className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  },
  delivered: {
    label: "Yetkazib berildi",
    variant: "outline",
    className: "border-emerald-600/50 text-emerald-800 dark:text-emerald-300 bg-emerald-500/20",
  },
};

export function ShipmentsTab({
  formData,
  docNo,
  operations = [],
  shiftEvents = [],
  onUpdateBatches,
  onCreateShipment,
  onOpenShipment,
  onOpenDeliveryAct,
  onOpenPackaging,
  onOpenPrintLabels,
  onUpdatePackaging,
}: ShipmentsTabProps) {
  const warehouseShipments = useWorkspaceStore((state) => state.warehouseShipments);

  const batches = useMemo(() => {
    return formData.deliveryBatches || [];
  }, [formData.deliveryBatches]);

  const totalOrderQty = Number(formData.quantity) || 0;
  const orderUnit = formData.unit || "dona";

  // Packaging Boxes from formData.packagingData
  const packagingBoxes = useMemo(() => {
    return formData.packagingData?.boxes || [];
  }, [formData.packagingData?.boxes]);

  // Auto sync: match batches with warehouse shipments
  const syncedBatches = useMemo(() => {
    const rawWo = docNo.trim().toLowerCase();
    const relatedShipments = warehouseShipments.filter((s) => {
      const sWo = (s.workOrder || "").trim().toLowerCase();
      return sWo === rawWo;
    });

    return batches.map((b) => {
      const matched = relatedShipments.find(
        (s) =>
          (b.linkedShipmentId && s.id === b.linkedShipmentId) ||
          (s.batchNo && s.batchNo === b.batchNo) ||
          (s.notes && s.notes.includes(`Partiya #${b.batchNo}`))
      );

      if (matched) {
        const isDispatched = matched.status === "Dispatched" || matched.status === "Delivered";
        return {
          ...b,
          linkedShipmentId: matched.id,
          linkedShipmentNo: matched.id,
          dispatchedQty: matched.quantity || b.quantity,
          status: isDispatched
            ? matched.status === "Delivered"
              ? ("delivered" as DeliveryBatchStatus)
              : ("dispatched" as DeliveryBatchStatus)
            : b.status,
        };
      }
      return b;
    });
  }, [batches, docNo, warehouseShipments]);

  // Production Output from last operation / shiftEvents (MES Progress)
  const producedOutputQty = useMemo(() => {
    if (operations.length === 0) return 0;
    const lastOp = operations[operations.length - 1];
    const lastOpEvents = shiftEvents.filter((ev) => ev.opId === lastOp.id);

    if (lastOpEvents.length > 0) {
      const totalEventsGood = lastOpEvents.reduce((sum, ev) => sum + (ev.outputPiecesQty || ev.goodQty || 0), 0);
      if (totalEventsGood > 0) return totalEventsGood;
    }

    const match = (lastOp.qtyCompleted || "").match(/^([\d,\s]+)\s*\//);
    if (match) {
      const parsed = parseInt(match[1].replace(/[^\d]/g, ""), 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, [operations, shiftEvents]);

  // Packed Boxes Status
  const totalPackedQty = useMemo(() => {
    return packagingBoxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [packagingBoxes]);

  // Boxes already dispatched (either marked status==='dispatched' or linked to a dispatched batch)
  const dispatchedBatchIds = useMemo(() => {
    return new Set(
      syncedBatches
        .filter((b) => b.status === "dispatched" || b.status === "delivered")
        .map((b) => b.id)
    );
  }, [syncedBatches]);

  // Available boxes (ready in warehouse, not yet dispatched)
  const availableBoxes = useMemo(() => {
    return packagingBoxes.filter((b) => {
      if (b.status === "dispatched") return false;
      if (b.batchId && dispatchedBatchIds.has(b.batchId)) return false;
      return true;
    });
  }, [packagingBoxes, dispatchedBatchIds]);

  const availablePackedQty = useMemo(() => {
    return availableBoxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [availableBoxes]);

  // Dispatched Statistics
  const dispatchedQty = useMemo(() => {
    return syncedBatches
      .filter((b) => b.status === "dispatched" || b.status === "delivered")
      .reduce((sum, b) => sum + (Number(b.dispatchedQty || b.quantity) || 0), 0);
  }, [syncedBatches]);

  const remainingToShipQty = Math.max(0, totalOrderQty - dispatchedQty);
  const shippedPercent = totalOrderQty > 0 ? Math.min(100, Math.round((dispatchedQty / totalOrderQty) * 100)) : 0;
  const producedPercent = totalOrderQty > 0 ? Math.min(100, Math.round((producedOutputQty / totalOrderQty) * 100)) : 0;
  const packedPercent = totalOrderQty > 0 ? Math.min(100, Math.round((totalPackedQty / totalOrderQty) * 100)) : 0;

  // Selected boxes for batch assignment
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());

  const handleToggleBoxSelection = (boxId: string) => {
    setSelectedBoxIds((prev) => {
      const next = new Set(prev);
      if (next.has(boxId)) {
        next.delete(boxId);
      } else {
        next.add(boxId);
      }
      return next;
    });
  };

  const handleSelectAllAvailableBoxes = () => {
    if (selectedBoxIds.size === availableBoxes.length) {
      setSelectedBoxIds(new Set());
    } else {
      setSelectedBoxIds(new Set(availableBoxes.map((b) => b.id)));
    }
  };

  const selectedBoxesTotalQty = useMemo(() => {
    return packagingBoxes
      .filter((b) => selectedBoxIds.has(b.id))
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [packagingBoxes, selectedBoxIds]);

  // Dialog State for Batch Add/Edit
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingBatch, setEditingBatch] = useState<WorkOrderDeliveryBatch | null>(null);

  // Dialog State for Partial Ship / Auto-split confirmation
  const [splitDialogData, setSplitDialogData] = useState<{
    batch: WorkOrderDeliveryBatch;
    availableQty: number;
    targetBoxIds: string[];
  } | null>(null);

  const handleOpenAddBatch = () => {
    setEditingBatch(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditBatch = (batch: WorkOrderDeliveryBatch) => {
    setEditingBatch(batch);
    setIsDialogOpen(true);
  };

  const handleSaveBatch = (savedBatch: WorkOrderDeliveryBatch) => {
    const exists = batches.some((b) => b.id === savedBatch.id);
    let next: WorkOrderDeliveryBatch[];
    if (exists) {
      next = batches.map((b) => (b.id === savedBatch.id ? savedBatch : b));
    } else {
      next = [...batches, savedBatch];
    }
    next.sort((a, b) => a.batchNo - b.batchNo);
    onUpdateBatches(next);
  };

  const handleDeleteBatch = (batchId: string) => {
    const next = batches.filter((b) => b.id !== batchId);
    onUpdateBatches(next);
  };

  // Split Order into N parts equally
  const handleSplitEqually = useCallback(
    (partsCount: number) => {
      if (totalOrderQty <= 0 || partsCount < 2) return;

      const baseQty = Math.floor(totalOrderQty / partsCount);
      const remainder = totalOrderQty - baseQty * partsCount;
      const today = new Date();

      const newBatches: WorkOrderDeliveryBatch[] = [];
      for (let i = 1; i <= partsCount; i++) {
        const isLast = i === partsCount;
        const partQty = isLast ? baseQty + remainder : baseQty;
        const targetDateObj = new Date(today.getTime() + (i - 1) * 7 * 86400000);
        const targetDateStr = targetDateObj.toISOString().split("T")[0];

        let sizeItems = undefined;
        if (formData.sizes && formData.sizes.length > 0) {
          const totalSizesOriginal = formData.sizes.reduce(
            (sum, s) => sum + (Number(s.quantity) || 0),
            0
          );
          if (totalSizesOriginal > 0) {
            let runningSizeSum = 0;
            sizeItems = formData.sizes.map((s, sIdx) => {
              if (sIdx === formData.sizes!.length - 1) {
                return {
                  sizeId: s.id,
                  sizeName: s.size,
                  quantity: Math.max(0, partQty - runningSizeSum),
                };
              }
              const sq = Math.round(((Number(s.quantity) || 0) / totalSizesOriginal) * partQty);
              runningSizeSum += sq;
              return { sizeId: s.id, sizeName: s.size, quantity: sq };
            });
          }
        }

        newBatches.push({
          id: `batch-${Date.now()}-${i}`,
          batchNo: i,
          title: `Partiya #${i}`,
          targetDate: targetDateStr,
          quantity: partQty,
          status: i === 1 ? "in_production" : "scheduled",
          sizeItems,
          notes: `${partsCount} qismga teng bo'lingan`,
        });
      }

      onUpdateBatches(newBatches);
    },
    [totalOrderQty, formData.sizes, onUpdateBatches]
  );

  // Trigger Shipment dispatch with Real Stock Checking & Auto-split
  const handleRequestShipment = (batch: WorkOrderDeliveryBatch) => {
    const reqQty = Number(batch.quantity) || 0;

    // Check if user pre-selected specific boxes
    let candidateBoxes = availableBoxes;
    if (selectedBoxIds.size > 0) {
      candidateBoxes = availableBoxes.filter((b) => selectedBoxIds.has(b.id));
    }

    const currentAvail = candidateBoxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);

    if (currentAvail <= 0) {
      // No packed stock available!
      setSplitDialogData({
        batch,
        availableQty: 0,
        targetBoxIds: [],
      });
      return;
    }

    if (currentAvail < reqQty) {
      // Partial stock available -> Propose Auto-Split
      const boxIdsToUse = candidateBoxes.map((b) => b.id);
      setSplitDialogData({
        batch,
        availableQty: currentAvail,
        targetBoxIds: boxIdsToUse,
      });
      return;
    }

    // Exact or more stock available -> allocate boxes greedily up to reqQty
    let accumulated = 0;
    const allocatedBoxIds: string[] = [];
    for (const b of candidateBoxes) {
      allocatedBoxIds.push(b.id);
      accumulated += Number(b.quantity) || 0;
      if (accumulated >= reqQty) break;
    }

    // Dispatch immediately
    executeDispatchBatch(batch, allocatedBoxIds, reqQty);
  };

  // Perform actual dispatch and update packaging status
  const executeDispatchBatch = (
    batch: WorkOrderDeliveryBatch,
    boxIds: string[],
    dispatchedQtyValue: number
  ) => {
    // 1. Mark boxes as dispatched
    if (onUpdatePackaging && formData.packagingData) {
      const updatedBoxes: PackagingBoxItem[] = formData.packagingData.boxes.map((b) => {
        if (boxIds.includes(b.id)) {
          return {
            ...b,
            status: "dispatched" as const,
            batchId: batch.id,
            batchNo: batch.batchNo,
            shipmentId: `SHP-${docNo}-${batch.batchNo}`,
          };
        }
        return b;
      });

      onUpdatePackaging({
        ...formData.packagingData,
        boxes: updatedBoxes,
      });
    }

    // 2. Clear selected boxes
    setSelectedBoxIds(new Set());

    // 3. Create Warehouse Shipment
    onCreateShipment(
      {
        ...batch,
        boxIds,
        packedQty: dispatchedQtyValue,
      },
      boxIds
    );
  };

  // Handle Confirmed Auto-Split
  const handleConfirmAutoSplit = () => {
    if (!splitDialogData) return;
    const { batch, availableQty, targetBoxIds } = splitDialogData;
    const originalQty = Number(batch.quantity) || 0;
    const remainder = Math.max(0, originalQty - availableQty);

    const updatedBatch: WorkOrderDeliveryBatch = {
      ...batch,
      quantity: availableQty,
      packedQty: availableQty,
      boxIds: targetBoxIds,
      notes: `${batch.notes ? batch.notes + " • " : ""}Mavjud qadoq bo'yicha ${availableQty.toLocaleString()} dona chiqim qilindi`,
    };

    let nextBatches: WorkOrderDeliveryBatch[] = [];
    const maxNo = Math.max(...batches.map((b) => b.batchNo || 0), batch.batchNo);

    if (remainder > 0) {
      const remainderBatch: WorkOrderDeliveryBatch = {
        id: `batch-${Date.now()}-rem`,
        batchNo: maxNo + 1,
        title: `Partiya #${maxNo + 1} (Qoldiq)`,
        targetDate: batch.targetDate,
        quantity: remainder,
        status: "scheduled",
        destination: batch.destination,
        notes: `Partiya #${batch.batchNo} qoldig'i (${remainder.toLocaleString()} dona)`,
      };
      nextBatches = batches.map((b) => (b.id === batch.id ? updatedBatch : b));
      nextBatches.push(remainderBatch);
    } else {
      nextBatches = batches.map((b) => (b.id === batch.id ? updatedBatch : b));
    }

    nextBatches.sort((a, b) => a.batchNo - b.batchNo);
    onUpdateBatches(nextBatches);

    // Execute dispatch for the adjusted batch
    executeDispatchBatch(updatedBatch, targetBoxIds, availableQty);
    setSplitDialogData(null);
  };

  // Create Batch from Selected Boxes
  const handleCreateBatchFromSelectedBoxes = () => {
    if (selectedBoxIds.size === 0 || selectedBoxesTotalQty <= 0) return;

    const nextNo = batches.length > 0 ? Math.max(...batches.map((b) => b.batchNo || 0)) + 1 : 1;
    const selectedBoxes = packagingBoxes.filter((b) => selectedBoxIds.has(b.id));

    // Calculate size items if multi-size
    const sizeMap: Record<string, { sizeId: string; sizeName: string; quantity: number }> = {};
    for (const b of selectedBoxes) {
      if (b.sizeCode) {
        if (!sizeMap[b.sizeCode]) {
          sizeMap[b.sizeCode] = { sizeId: b.sizeCode, sizeName: b.sizeCode, quantity: 0 };
        }
        sizeMap[b.sizeCode].quantity += Number(b.quantity) || 0;
      }
    }
    const sizeItems = Object.values(sizeMap);

    const newBatch: WorkOrderDeliveryBatch = {
      id: `batch-${Date.now()}-${nextNo}`,
      batchNo: nextNo,
      title: `Partiya #${nextNo} (Tanlangan qutilar)`,
      targetDate: new Date().toISOString().split("T")[0],
      quantity: selectedBoxesTotalQty,
      status: "ready",
      boxIds: Array.from(selectedBoxIds),
      sizeItems: sizeItems.length > 0 ? sizeItems : undefined,
      notes: `${selectedBoxIds.size} ta quti tanlab biriktirildi`,
    };

    const nextBatches = [...batches, newBatch].sort((a, b) => a.batchNo - b.batchNo);
    onUpdateBatches(nextBatches);

    // Trigger immediate shipment
    executeDispatchBatch(newBatch, Array.from(selectedBoxIds), selectedBoxesTotalQty);
  };

  return (
    <TabsContent
      value="shipments"
      className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-y-auto p-4 space-y-4 focus-visible:outline-none data-[state=inactive]:hidden"
    >
      {/* ── 1. KPI Cards Bar (Linear Industrial Standard) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Order */}
        <div className="p-3 bg-card border border-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Umumiy tiraj</span>
            <Layers className="size-3.5" />
          </div>
          <div className="text-base font-semibold font-mono text-foreground">
            {totalOrderQty.toLocaleString()} <span className="text-xs text-muted-foreground">{orderUnit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Bosh buyurtma hajmi
          </div>
        </div>

        {/* Produced (MES Output) */}
        <div className="p-3 bg-card border border-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[11px]">
            <span>Ishlab chiqarildi</span>
            <CheckCircle2 className="size-3.5" />
          </div>
          <div className="text-base font-semibold font-mono text-blue-700 dark:text-blue-400">
            {producedOutputQty.toLocaleString()} <span className="text-xs text-muted-foreground">{orderUnit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Oxirgi bosqich ({producedPercent}%)
          </div>
        </div>

        {/* Ready in Stock (Packaging Boxes Available) */}
        <div className="p-3 bg-card border border-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[11px]">
            <span>Qadoqlangan (Omborda)</span>
            <PackageCheck className="size-3.5" />
          </div>
          <div className="text-base font-semibold font-mono text-amber-700 dark:text-amber-400">
            {availablePackedQty.toLocaleString()} <span className="text-xs text-muted-foreground">{orderUnit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {availableBoxes.length} ta bo&apos;sh quti ({packedPercent}%)
          </div>
        </div>

        {/* Dispatched */}
        <div className="p-3 bg-card border border-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px]">
            <span>Jo&apos;natilgan</span>
            <Truck className="size-3.5" />
          </div>
          <div className="text-base font-semibold font-mono text-emerald-700 dark:text-emerald-400">
            {dispatchedQty.toLocaleString()} <span className="text-xs text-muted-foreground">{orderUnit}</span>
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
            {shippedPercent}% bajarildi
          </div>
        </div>

        {/* Unassigned / Remaining */}
        <div className="p-3 bg-card border border-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Qoldiq tiraj</span>
            <AlertCircle className="size-3.5" />
          </div>
          <div className="text-base font-semibold font-mono text-muted-foreground">
            {remainingToShipQty.toLocaleString()}{" "}
            <span className="text-xs text-muted-foreground">{orderUnit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Jo&apos;natilishi lozim
          </div>
        </div>
      </div>

      {/* Progress Line */}
      <div className="p-3 bg-card border border-border rounded-lg space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Tayyorlik va jo&apos;natish zanjiri</span>
          <span className="font-mono text-muted-foreground">
            Qadoqlangan: {totalPackedQty.toLocaleString()} | Jo&apos;natilgan: {dispatchedQty.toLocaleString()} /{" "}
            {totalOrderQty.toLocaleString()} {orderUnit}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
          <div
            className="bg-emerald-600 h-full transition-all"
            style={{ width: `${shippedPercent}%` }}
            title={`Jo'natilgan: ${shippedPercent}%`}
          />
          <div
            className="bg-amber-500 h-full transition-all"
            style={{
              width: `${Math.max(
                0,
                Math.min(100 - shippedPercent, Math.round((availablePackedQty / Math.max(1, totalOrderQty)) * 100))
              )}%`,
            }}
            title={`Omborda tayyor: ${availablePackedQty} dona`}
          />
        </div>
      </div>

      {/* ── 2. Bo'lim: Qadoqlangan qutilar va Tayyor zaxira ── */}
      <div className="border border-border rounded-lg overflow-hidden bg-card space-y-0">
        {/* Section Header Toolbar */}
        <div className="p-3 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-foreground" />
            <span className="font-semibold text-xs text-foreground">
              Qadoqlangan qutilar va tayyor zaxira
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
              {availableBoxes.length} / {packagingBoxes.length} quti erkin
            </Badge>
            {formData.packagingData?.unitWeightGrams && formData.packagingData.unitWeightGrams > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono gap-1 text-muted-foreground">
                <Scale className="size-3 text-primary" />
                <span>1 dona: {formData.packagingData.unitWeightGrams} g</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedBoxIds.size > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleCreateBatchFromSelectedBoxes}
                className="h-7 text-xs px-2.5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Truck className="size-3.5" />
                <span>Tanlangan {selectedBoxIds.size} qutini jo&apos;natish ({selectedBoxesTotalQty.toLocaleString()})</span>
              </Button>
            )}

            {onOpenPrintLabels && packagingBoxes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPrintLabels}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <Printer className="size-3.5" />
                <span>Yorliqlar (100×150)</span>
              </Button>
            )}

            {onOpenPackaging && (
              <Button
                type="button"
                size="sm"
                onClick={onOpenPackaging}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <Boxes className="size-3.5" />
                <span>Qadoqlashni boshqarish</span>
              </Button>
            )}
          </div>
        </div>

        {/* Boxes Table */}
        {packagingBoxes.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <Package className="size-8 mx-auto text-muted-foreground/40" />
            <div className="text-xs font-medium text-foreground">
              Hali qutilarga qadoqlanmagan
            </div>
            <div className="text-[11px] text-muted-foreground max-w-md mx-auto">
              Mahsulotlarni qutilarga joylash, etiketka chop etish va omborga tayyor holatga keltirish uchun
              &ldquo;Qadoqlashni boshqarish&rdquo; tugmasidan foydalaning.
            </div>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 text-[11px] font-medium text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-1.5 px-3 w-8 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllAvailableBoxes}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {selectedBoxIds.size > 0 && selectedBoxIds.size === availableBoxes.length ? (
                        <CheckSquare className="size-3.5 text-primary" />
                      ) : (
                        <Square className="size-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="py-1.5 px-3">Quti #</th>
                  <th className="py-1.5 px-3">Barkod / Kod</th>
                  <th className="py-1.5 px-3">Model / Razmer</th>
                  <th className="py-1.5 px-3 text-right">Miqdor</th>
                  <th className="py-1.5 px-3 text-right">Vazn</th>
                  <th className="py-1.5 px-3">Qadoqlovchi</th>
                  <th className="py-1.5 px-3">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {packagingBoxes.map((box) => {
                  const isDispatched =
                    box.status === "dispatched" || (box.batchId && dispatchedBatchIds.has(box.batchId));
                  const isSelected = selectedBoxIds.has(box.id);

                  return (
                    <tr
                      key={box.id}
                      className={cn(
                        "hover:bg-muted/20 transition-colors",
                        isDispatched && "opacity-60 bg-muted/10",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {/* Select Checkbox */}
                      <td className="py-1.5 px-3 text-center">
                        {!isDispatched ? (
                          <button
                            type="button"
                            onClick={() => handleToggleBoxSelection(box.id)}
                            className="cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-3.5 text-primary" />
                            ) : (
                              <Square className="size-3.5" />
                            )}
                          </button>
                        ) : (
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        )}
                      </td>

                      {/* Box Number */}
                      <td className="py-1.5 px-3 font-mono font-medium">
                        Quti #{box.boxNumber}
                      </td>

                      {/* Code */}
                      <td className="py-1.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {box.boxCode || box.barcode}
                      </td>

                      {/* Model / Size */}
                      <td className="py-1.5 px-3">
                        {box.sizeCode ? (
                          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">
                            {box.model ? `${box.model} · ` : ""}
                            {box.sizeCode}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Yagona</span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1">
                          {box.countDeviation !== undefined && box.countDeviation !== 0 && (
                            <span
                              className={`text-[9px] font-mono px-1 rounded ${
                                box.countDeviation > 0
                                  ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
                                  : "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              }`}
                              title="Standart sig'imdan og'ish"
                            >
                              {box.countDeviation > 0 ? `+${box.countDeviation}` : box.countDeviation}
                            </span>
                          )}
                          <span>{(Number(box.quantity) || 0).toLocaleString()} {orderUnit}</span>
                        </div>
                      </td>

                      {/* Weight */}
                      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                        <div className="flex items-center justify-end gap-1">
                          {box.isWeighed && (
                            <span title="Tarozida tortib aniqlangan" className="inline-flex">
                              <Scale className="size-3 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          )}
                          <span>{box.grossWeightKg ? `${Number(box.grossWeightKg).toFixed(2)} kg` : "—"}</span>
                        </div>
                      </td>

                      {/* Packer */}
                      <td className="py-1.5 px-3 text-muted-foreground truncate max-w-[140px]">
                        {box.packerName || "Qadoqlash"}
                      </td>

                      {/* Status */}
                      <td className="py-1.5 px-3">
                        {isDispatched ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                          >
                            {box.batchNo ? `Partiya #${box.batchNo} da jo'natildi` : "Jo'natilgan"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                          >
                            Omborda tayyor
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. Bo'lim: Jo'natish partiyalari va Yuk xatlari ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAddBatch}
              className="h-8 text-xs gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Partiya qo&apos;shish</span>
            </Button>

            {/* Split Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Split className="size-3.5" />
                    <span>Teng bo&apos;lish</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="text-xs">
                <DropdownMenuItem onClick={() => handleSplitEqually(2)}>
                  2 qismga (50% / 50%)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSplitEqually(3)}>
                  3 qismga teng
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSplitEqually(4)}>
                  4 qismga (25% dan)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSplitEqually(6)}>
                  6 qismga teng
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span>Jami {batches.length} ta jo&apos;natma rejalashtirilgan</span>
          </div>
        </div>

        {/* Batches Table */}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {batches.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Truck className="size-8 mx-auto text-muted-foreground/40" />
              <div className="text-xs font-medium text-foreground">
                Partiyalar belgilanmagan
              </div>
              <div className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Buyurtmani bo&apos;lib jo&apos;natish uchun &ldquo;Partiya qo&apos;shish&rdquo; yoki &ldquo;Teng bo&apos;lish&rdquo; tugmasidan foydalaning.
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground">
                  <th className="py-2 px-3 w-12 text-center">#</th>
                  <th className="py-2 px-3">Partiya</th>
                  <th className="py-2 px-3">Muddati</th>
                  <th className="py-2 px-3 text-right">Reja miqdor</th>
                  <th className="py-2 px-3">Tayyor zaxira holati</th>
                  <th className="py-2 px-3">Razmerlar / Detallar</th>
                  <th className="py-2 px-3">Holati</th>
                  <th className="py-2 px-3">Hujjatlar (Chiqim / Faktura)</th>
                  <th className="py-2 px-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {syncedBatches.map((batch) => {
                  const statusCfg = STATUS_CONFIG[batch.status] || STATUS_CONFIG.scheduled;
                  const isDispatched = batch.status === "dispatched" || batch.status === "delivered";
                  const batchQty = Number(batch.quantity) || 0;

                  // Check readiness of this specific batch against available packed stock
                  const isFullyPacked = availablePackedQty >= batchQty && batchQty > 0;
                  const isPartiallyPacked = availablePackedQty > 0 && availablePackedQty < batchQty;

                  return (
                    <tr key={batch.id} className="hover:bg-muted/20 transition-colors">
                      {/* # */}
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-muted-foreground">
                        {batch.batchNo}
                      </td>

                      {/* Title & Notes */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground">{batch.title}</div>
                        {batch.destination && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                            {batch.destination}
                          </div>
                        )}
                      </td>

                      {/* Target Date */}
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {batch.targetDate || "—"}
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                        {batchQty.toLocaleString()} {orderUnit}
                      </td>

                      {/* Ready Stock Status for Batch */}
                      <td className="py-2.5 px-3">
                        {isDispatched ? (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Jo&apos;natildi
                          </span>
                        ) : isFullyPacked ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 gap-1"
                          >
                            <CheckCircle2 className="size-2.5" />
                            <span>To&apos;liq tayyor ({availablePackedQty.toLocaleString()})</span>
                          </Badge>
                        ) : isPartiallyPacked ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 gap-1"
                          >
                            <AlertCircle className="size-2.5" />
                            <span>Qisman: {availablePackedQty.toLocaleString()} dona</span>
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Qadoqlanmagan
                          </span>
                        )}
                      </td>

                      {/* Size breakdown or notes */}
                      <td className="py-2.5 px-3">
                        {batch.sizeItems && batch.sizeItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {batch.sizeItems
                              .filter((si) => si.quantity > 0)
                              .map((si) => (
                                <span
                                  key={si.sizeId}
                                  className="px-1 py-0.2 rounded bg-muted text-[10px] font-mono border border-border"
                                >
                                  {si.sizeName}: {si.quantity.toLocaleString()}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            {batch.notes || "Yagona partiya"}
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={statusCfg.variant}
                          className={cn("text-[10px] px-1.5 py-0 font-medium", statusCfg.className)}
                        >
                          {statusCfg.label}
                        </Badge>
                      </td>

                      {/* Linked Documents (Shipment & Delivery Act) */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          {batch.linkedShipmentId ? (
                            <button
                              type="button"
                              onClick={() => onOpenShipment(batch.linkedShipmentId!)}
                              className="flex items-center gap-1 font-mono text-primary hover:underline text-[11px]"
                              title="Ombor chiqim yuk xatini ochish"
                            >
                              <Truck className="size-3 shrink-0" />
                              <span>{batch.linkedShipmentId}</span>
                              <ExternalLink className="size-2.5 shrink-0" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">Chiqim yo&apos;q</span>
                          )}

                          {batch.linkedDeliveryActId ? (
                            <button
                              type="button"
                              onClick={() => onOpenDeliveryAct?.(batch.linkedDeliveryActId!)}
                              className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
                              title="Yetkazib berish akti / Schet-fakturani ochish"
                            >
                              <FileText className="size-3 shrink-0" />
                              <span>{batch.linkedDeliveryActId}</span>
                              <ExternalLink className="size-2.5 shrink-0" />
                            </button>
                          ) : null}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isDispatched && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRequestShipment(batch)}
                              className={cn(
                                "h-6 px-2 text-[10px] gap-1 font-medium",
                                isFullyPacked
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : isPartiallyPacked
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80 cursor-not-allowed"
                              )}
                              disabled={availablePackedQty <= 0}
                              title={
                                availablePackedQty <= 0
                                  ? "Omborda qadoqlangan mahsulot yo'q. Avval qadoqlang."
                                  : undefined
                              }
                            >
                              <Truck className="size-3" />
                              <span>Chiqim qilish</span>
                            </Button>
                          )}

                          {batch.linkedDeliveryActId && onOpenDeliveryAct && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onOpenDeliveryAct(batch.linkedDeliveryActId!)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                              title={`Schet-fakturani ochish (${batch.linkedDeliveryActId})`}
                            >
                              <FileText className="size-3" />
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditBatch(batch)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="size-3" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dialog for Edit / Add Batch */}
      {isDialogOpen && (
        <BatchEditDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          batch={editingBatch}
          orderTotalQty={totalOrderQty}
          orderUnit={orderUnit}
          existingBatches={batches}
          sizes={formData.sizes}
          onSave={handleSaveBatch}
        />
      )}

      {/* Auto-Split / Partial Stock Confirmation Dialog */}
      {splitDialogData && (
        <Dialog open={!!splitDialogData} onOpenChange={() => setSplitDialogData(null)}>
          <DialogContent className="max-w-md p-4 gap-3 bg-card border-border">
            <DialogHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-4 shrink-0" />
                <DialogTitle className="text-sm font-semibold text-foreground">
                  {splitDialogData.availableQty > 0
                    ? "Qisman jo'natish va qoldiqni ajratish"
                    : "Qadoqlangan mahsulot mavjud emas"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {splitDialogData.availableQty > 0 ? (
                  <>
                    Partiya #{splitDialogData.batch.batchNo} uchun reja{" "}
                    <strong className="font-mono text-foreground">
                      {(Number(splitDialogData.batch.quantity) || 0).toLocaleString()} {orderUnit}
                    </strong>
                    , ammo omborda hozircha faqat{" "}
                    <strong className="font-mono text-foreground text-amber-600 dark:text-amber-400">
                      {splitDialogData.availableQty.toLocaleString()} {orderUnit}
                    </strong>{" "}
                    tayyor qutilar mavjud.
                  </>
                ) : (
                  <>
                    Ushbu buyurtmada hali birorta quti qadoqlanmagan yoki barcha mavjud qutilar jo&apos;natilgan.
                    Haqiqiy chiqim qilish uchun avval mahsulotni qutilarga qadoqlang.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {splitDialogData.availableQty > 0 ? (
              <div className="p-3 rounded border border-border bg-muted/30 space-y-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-muted-foreground">Ushbu partiyadan chiqim:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {splitDialogData.availableQty.toLocaleString()} {orderUnit}
                  </span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span className="text-muted-foreground">Keyingi partiyaga qoldiq:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {Math.max(
                      0,
                      (Number(splitDialogData.batch.quantity) || 0) - splitDialogData.availableQty
                    ).toLocaleString()}{" "}
                    {orderUnit}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground border-t border-border/60 pt-1.5">
                  Partiya #{splitDialogData.batch.batchNo} {splitDialogData.availableQty.toLocaleString()} donaga
                  qisqartirilib chiqim qilinadi, qolgan qismi esa yangi qoldiq partiyaga ko&apos;chiriladi.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded border border-border bg-muted/30 text-xs text-muted-foreground">
                Yuqoridagi &ldquo;Qadoqlashni boshqarish&rdquo; tugmasi orqali qutilarni kiriting.
              </div>
            )}

            <DialogFooter className="p-0 gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSplitDialogData(null)}
                className="h-8 text-xs"
              >
                Bekor qilish
              </Button>
              {splitDialogData.availableQty > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmAutoSplit}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  <span>Tayyor qismini chiqim qilish</span>
                </Button>
              ) : (
                onOpenPackaging && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setSplitDialogData(null);
                      onOpenPackaging();
                    }}
                    className="h-8 text-xs"
                  >
                    <Boxes className="size-3.5 mr-1" />
                    <span>Qadoqlashni ochish</span>
                  </Button>
                )
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </TabsContent>
  );
}
