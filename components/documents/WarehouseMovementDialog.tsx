"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  ArrowRight,
  Warehouse,
  Boxes,
  Save,
  Check,
  Lock,
  X,
  User,
  FileText,
} from "lucide-react";
import { WarehouseSelect } from "@/components/common/WarehouseSelect";
import { useWorkspaceStore, WarehouseMovementRecord } from "@/store/workspaceStore";

interface WarehouseMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: WarehouseMovementRecord | null;
  onSave?: (data: Partial<WarehouseMovementRecord>) => Promise<void> | void;
  onConfirm?: (recordId: string) => Promise<void> | void;
}

export function WarehouseMovementDialog({
  open,
  onOpenChange,
  record,
  onSave,
  onConfirm,
}: WarehouseMovementDialogProps) {
  const { warehouseStock, employees } = useWorkspaceStore();

  const uniqueStock = useMemo(() => {
    const seen = new Set<string>();
    return warehouseStock.filter((s) => {
      if (!s.name || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }, [warehouseStock]);

  const isEdit = Boolean(record?.id && !record.id.startsWith("draft-"));
  const isLocked = record?.status === "Completed";
  const isPending = record?.status === "Pending" || record?.status === "In Transit";

  const [formData, setFormData] = useState<Partial<WarehouseMovementRecord>>({
    id: "",
    date: new Date().toISOString().split("T")[0],
    from: "",
    to: "",
    material: "",
    materialSku: "",
    quantity: 0,
    unit: "sheets",
    movementType: "Transfer",
    reason: "",
    operator: "",
    status: "Pending",
  });

  useEffect(() => {
    if (record) {
      setFormData({
        id: record.id || "",
        date: record.date || new Date().toISOString().split("T")[0],
        from: record.from || "",
        to: record.to || "",
        material: record.material || "",
        materialSku: record.materialSku || "",
        quantity: Number(record.quantity) || 0,
        unit: record.unit || "sheets",
        movementType: record.movementType || "Transfer",
        reason: record.reason || "",
        operator: record.operator || "",
        status: record.status || "Pending",
      });
    } else {
      setFormData({
        id: `MOV-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split("T")[0],
        from: "",
        to: "",
        material: "",
        materialSku: "",
        quantity: 100,
        unit: "sheets",
        movementType: "Transfer",
        reason: "",
        operator: employees[0]?.fullName || "Ombor mudiri",
        status: "Pending",
      });
    }
  }, [record, open, employees]);

  // Material selection handler
  const handleMaterialChange = (materialName: string | null) => {
    if (!materialName) return;
    const selected = warehouseStock.find((s) => s.name === materialName);
    setFormData((prev) => ({
      ...prev,
      material: materialName,
      materialSku: selected?.sku || prev.materialSku,
      unit: (selected?.unit as any) || prev.unit,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (!formData.from?.trim()) {
      alert("Chiquvchi omborni tanlash shart!");
      return;
    }
    if (!formData.to?.trim()) {
      alert("Qabul qiluvchi omborni tanlash shart!");
      return;
    }
    if (!formData.material?.trim()) {
      alert("Materialni kiritish yoki tanlash shart!");
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      alert("Miqdorni to'g'ri kiritish shart!");
      return;
    }

    if (onSave) {
      await onSave({
        ...formData,
        quantity: Number(formData.quantity) || 0,
        receivedQty: Number(formData.quantity) || 0,
      });
    }
    onOpenChange(false);
  };

  const handleConfirmMovement = async () => {
    if (!record?.id || isLocked) return;
    if (onConfirm) {
      await onConfirm(record.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden border border-border shadow-2xl bg-card">
        <form onSubmit={handleSave}>
          {/* Header */}
          <DialogHeader className="p-4 bg-muted/30 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <ArrowRightLeft className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-semibold text-foreground">
                    {isEdit ? `Ko'chirish hujjati: ${formData.id}` : "Yangi ichki ko'chirish hujjati"}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                    Omborlararo tovar harakati va moddiy hisob o'tkazmasi
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isLocked ? (
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-medium">
                    <Lock className="size-3" />
                    <span>Bajarildi</span>
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formData.status === "Completed" ? "Bajarildi" : "Kutilmoqda"}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Form Content */}
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
            {/* Row 1: Document ID and Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Hujjat raqami</Label>
                <Input
                  value={formData.id || ""}
                  readOnly
                  className="h-8 text-xs font-mono bg-muted/40 text-muted-foreground"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">O'tkazma sanasi</Label>
                <DatePicker
                  value={formData.date || ""}
                  disabled={isLocked}
                  onChange={(val) => setFormData((prev) => ({ ...prev, date: val }))}
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>
            </div>

            {/* Row 2: Origin and Destination Warehouses with visual transfer cue */}
            <div className="p-3 rounded-lg border border-border bg-muted/15 space-y-3">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Omborlar yo'nalishi</span>
                <span className="text-[10px] font-normal text-muted-foreground font-mono">
                  Ierarxik tanlov
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Warehouse className="size-3 text-amber-600 dark:text-amber-400" />
                    <span>Chiquvchi ombor (Qayerdan) *</span>
                  </Label>
                  <WarehouseSelect
                    value={formData.from}
                    disabled={isLocked}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, from: val.warehouseName }))}
                    placeholder="Chiqish omborini tanlang..."
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Warehouse className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Qabul qiluvchi ombor (Qayerga) *</span>
                  </Label>
                  <WarehouseSelect
                    value={formData.to}
                    disabled={isLocked}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, to: val.warehouseName }))}
                    placeholder="Qabul omborini tanlang..."
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Material and Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Boxes className="size-3 text-primary" />
                  <span>Ko'chirilayotgan material *</span>
                </Label>
                {isLocked ? (
                  <Input
                    value={formData.material || ""}
                    readOnly
                    className="h-8 text-xs font-medium bg-muted/40"
                  />
                ) : (
                  <Select
                    value={formData.material || ""}
                    onValueChange={handleMaterialChange}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Materialni tanlang..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {uniqueStock.map((s, idx) => (
                        <SelectItem key={`${s.id || s.sku}-${idx}`} value={s.name} className="text-xs">
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-1 text-muted-foreground font-mono">({s.sku})</span>
                          <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                            Qoldiq: {s.stockLevel?.toLocaleString()} {s.unit}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Miqdori *</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    disabled={isLocked}
                    value={formData.quantity || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono pr-12 bg-background"
                    required
                  />
                  <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">
                    {formData.unit || "dona"}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 4: Operation Type & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Operatsiya turi</Label>
                <Select
                  value={formData.movementType || "Transfer"}
                  disabled={isLocked}
                  onValueChange={(val: any) => setFormData((prev) => ({ ...prev, movementType: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transfer" className="text-xs">Tokchalararo / Omborlararo ko'chirish</SelectItem>
                    <SelectItem value="ProductionIssue" className="text-xs">Sexga sarf (Ishlab chiqarishga berish)</SelectItem>
                    <SelectItem value="WriteOff" className="text-xs">Spisaniye (Yaroqsiz/Brakka chiqarish)</SelectItem>
                    <SelectItem value="CuttingReturn" className="text-xs">Qirqim qoldig'i (Otxod qaytarish)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Mas'ul shaxs (Operator)</Label>
                <Input
                  value={formData.operator || ""}
                  disabled={isLocked}
                  onChange={(e) => setFormData((prev) => ({ ...prev, operator: e.target.value }))}
                  placeholder="Operator ismi..."
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Row 5: Notes / Work Order */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Izoh yoki Buyruq № (Sababi)</Label>
              <Input
                value={formData.reason || ""}
                disabled={isLocked}
                onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Masalan: Buyruq WO-26-0351 uchun qog'oz berildi"
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-3 bg-muted/20 border-t border-border flex items-center justify-between sm:justify-between gap-2">
            <div>
              {isEdit && isPending && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmMovement}
                  className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-none cursor-pointer"
                >
                  <Check className="size-3.5" />
                  <span>Tasdiqlash va o'tkazish</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-7 text-xs px-2.5"
              >
                {isLocked ? "Yopish" : "Bekor qilish"}
              </Button>

              {!isLocked && (
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-none cursor-pointer"
                >
                  <Save className="size-3.5" />
                  <span>Saqlash</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
