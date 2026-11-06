"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WmsRack, WmsZone, WmsBin, WmsBinItem } from "./types";
import { Layers, Box, MoveRight, Trash2, Check, ArrowRightLeft, Info, LayoutGrid } from "lucide-react";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";

// ─── 1. Yagona Stelaj Yaratish / Tahrirlash Moduli ──────────────────────────────

interface RackUpsertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rack: Partial<WmsRack> | null;
  zones: WmsZone[];
  warehouseId: string;
  onSave: (rackData: any) => Promise<void>;
  onDelete?: (rackId: string) => Promise<void>;
}

export function RackUpsertModal({
  open,
  onOpenChange,
  rack,
  zones,
  warehouseId,
  onSave,
  onDelete,
}: RackUpsertModalProps) {
  const [formData, setFormData] = useState<Partial<WmsRack>>({
    code: "",
    name: "",
    zoneId: "",
    type: "pallet",
    levelsCount: 4,
    baysCount: 4,
    maxWeightKg: 10000,
    width: 280,
    depth: 85,
    rotation: 0,
    status: "active",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (rack) {
      setFormData({
        id: rack.id,
        code: rack.code || "",
        name: rack.name || "",
        zoneId: rack.zoneId || (zones[0]?.id || ""),
        type: rack.type || "pallet",
        levelsCount: rack.levelsCount || 4,
        baysCount: rack.baysCount || 4,
        maxWeightKg: rack.maxWeightKg || 10000,
        x: rack.x !== undefined ? rack.x : 80,
        y: rack.y !== undefined ? rack.y : 80,
        width: rack.width || 280,
        depth: rack.depth || 85,
        rotation: rack.rotation || 0,
        status: rack.status || "active",
      });
    } else {
      const activeZone = zones[0]?.code || "A";
      const initialType = "pallet";
      const initialCode = "06";
      const initialName = `Stelaj ${activeZone}-06`;
      setFormData({
        code: initialCode,
        name: initialName,
        zoneId: zones[0]?.id || "",
        type: initialType,
        levelsCount: 4,
        baysCount: 4,
        maxWeightKg: 10000,
        x: 80,
        y: 80,
        width: 280,
        depth: 85,
        rotation: 0,
        status: "active",
      });
    }
  }, [rack, zones, open]);

  // Tanlangan zonani topish
  const selectedZone = zones.find((z) => z.id === formData.zoneId) || zones[0];
  const zoneLetter = selectedZone?.code || "A";
  const cleanRackCode = (formData.code || "01").replace(/^[a-zA-Z]+-?/, "") || "01";
  const rackPad = cleanRackCode.length === 1 ? `0${cleanRackCode}` : cleanRackCode;

  const totalCalculatedBins = (Number(formData.levelsCount) || 1) * (Number(formData.baysCount) || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) return;
    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        warehouseId,
        levelsCount: Number(formData.levelsCount) || 4,
        baysCount: Number(formData.baysCount) || 4,
        maxWeightKg: Number(formData.maxWeightKg) || 10000,
        width: Number(formData.width) || 280,
        depth: Number(formData.depth) || 85,
        rotation: Number(formData.rotation) || 0,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStructuralElement = formData.type === "gate" || formData.type === "aisle" || formData.type === "obstacle";

  const modalTitle = formData.type === "gate"
    ? (formData.id ? "Rampa / Darvozani tahrirlash" : "Yangi rampa / darvoza")
    : formData.type === "aisle"
    ? (formData.id ? "Yo'lakni tahrirlash" : "Yangi transport yo'lagi")
    : formData.type === "obstacle"
    ? (formData.id ? "Ustun / To'siqni tahrirlash" : "Yangi ustun / to'siq")
    : (formData.id ? "Stelajni tahrirlash" : "Yangi stelaj yaratish");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 bg-card border-border">
        <DialogHeader className="p-0 pb-2 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Layers className="size-4 text-primary" />
            <span>{modalTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Element kodi</Label>
              <Input
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="R01, GATE-01, AISLE-1"
                required
                className="h-8 text-xs font-mono font-medium"
              />
            </div>
            <div>
              <Label className="text-xs">Turi</Label>
              <Select
                value={formData.type || "pallet"}
                onValueChange={(val: any) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pallet">Palet stelaji</SelectItem>
                  <SelectItem value="shelf">Polka stelaj</SelectItem>
                  <SelectItem value="cantilever">Konsol stelaj</SelectItem>
                  <SelectItem value="roll_stand">Rulon stendi</SelectItem>
                  <SelectItem value="gate">Rampa / Darvoza</SelectItem>
                  <SelectItem value="aisle">Yo'lak</SelectItem>
                  <SelectItem value="obstacle">Ustun / To'siq</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Nomi</Label>
            <Input
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Masalan: Stelaj A-01 (Karton)"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Zona / Sektor</Label>
              <Select
                value={formData.zoneId || "none"}
                onValueChange={(val) => setFormData({ ...formData, zoneId: val === "none" ? null : val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Zonani tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Zonasiz</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} - {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Holati</Label>
              <Select
                value={formData.status || "active"}
                onValueChange={(val) => setFormData({ ...formData, status: val || "active" })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Faol</SelectItem>
                  <SelectItem value="maintenance">Ta'mirda</SelectItem>
                  <SelectItem value="full">To'lgan</SelectItem>
                  <SelectItem value="blocked">Bloklangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isStructuralElement && (
            <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Struktura va Kataklar</span>
                <span className="font-mono text-primary font-bold">{totalCalculatedBins} ta katak</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 px-2 rounded bg-primary/10 border border-primary/20 text-[11px] text-primary">
                <Info className="size-3.5 shrink-0" />
                <span>
                  Avtomatik manzillash (Sanoat standarti):{" "}
                  <strong className="font-mono font-bold">
                    {zoneLetter}-{rackPad}-1-1
                  </strong>{" "}
                  dan{" "}
                  <strong className="font-mono font-bold">
                    {zoneLetter}-{rackPad}-{formData.levelsCount || 4}-{formData.baysCount || 4}
                  </strong>{" "}
                  gacha
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Qavatlar</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={formData.levelsCount || 4}
                    onChange={(e) => setFormData({ ...formData, levelsCount: parseInt(e.target.value) || 1 })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Ustun/Katak</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={formData.baysCount || 4}
                    onChange={(e) => setFormData({ ...formData, baysCount: parseInt(e.target.value) || 1 })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Maks. yuk (kg)</Label>
                  <Input
                    type="number"
                    value={formData.maxWeightKg || 10000}
                    onChange={(e) => setFormData({ ...formData, maxWeightKg: parseInt(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Eni (px)</Label>
              <Input
                type="number"
                value={formData.width || 280}
                onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 50 })}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Chuqurligi (px)</Label>
              <Input
                type="number"
                value={formData.depth || 85}
                onChange={(e) => setFormData({ ...formData, depth: parseInt(e.target.value) || 30 })}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Burchak</Label>
              <Select
                value={String(formData.rotation || 0)}
                onValueChange={(val) => setFormData({ ...formData, rotation: parseInt(val || "0") || 0 })}
              >
                <SelectTrigger className="h-7 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0°</SelectItem>
                  <SelectItem value="90">90°</SelectItem>
                  <SelectItem value="180">180°</SelectItem>
                  <SelectItem value="270">270°</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between">
            {formData.id && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (confirm("Stelajni o'chirishni tasdiqlaysizmi?")) {
                    await onDelete(formData.id!);
                    onOpenChange(false);
                  }
                }}
                className="h-8 text-xs gap-1"
              >
                <Trash2 className="size-3.5" />
                <span>O'chirish</span>
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Bekor qilish
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs gap-1">
                <Check className="size-3.5" />
                <span>Saqlash</span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 2. Katakka Mahsulot Joylash / Amallar Moduli ──────────────────────────────

interface BinItemActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "putaway" | "transfer" | "pick";
  bin: WmsBin | null;
  binsList: WmsBin[];
  item?: WmsBinItem | null;
  stockBalances: any[];
  finishedGoods: any[];
  onAction: (actionData: any) => Promise<void>;
}

export function BinItemActionModal({
  open,
  onOpenChange,
  mode,
  bin,
  binsList,
  item,
  stockBalances,
  finishedGoods,
  onAction,
}: BinItemActionModalProps) {
  const [targetBinId, setTargetBinId] = useState<string>("");
  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1000");
  const [containerType, setContainerType] = useState<string>("pallet");
  const [weightKg, setWeightKg] = useState<string>("500");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stockOptions: ComboboxItem[] = useMemo(() => {
    const list: ComboboxItem[] = [];
    for (const s of stockBalances) {
      const avail = s.available ?? s.quantity ?? 0;
      list.push({
        value: s.id,
        label: `${s.sku} — ${s.name}`,
        description: `Xomashyo (${s.category || "Qog'oz"}) · Qoldiq: ${avail} ${s.unit || "dona"}`,
        badge: `${avail} ${s.unit || ""}`,
        icon: Box,
      });
    }
    for (const f of finishedGoods) {
      const qty = f.quantity ?? 0;
      list.push({
        value: f.id,
        label: `${f.sku} — ${f.productName || f.name}`,
        description: `Tayyor Mahsulot · Qoldiq: ${qty} ${f.unit || "dona"}`,
        badge: `${qty} ${f.unit || ""}`,
        icon: Check,
      });
    }
    return list;
  }, [stockBalances, finishedGoods]);

  const binOptions: ComboboxItem[] = useMemo(() => {
    return binsList
      .filter((b) => b.id !== bin?.id && b.status !== "blocked")
      .map((b) => {
        const statusLabel = b.status === "empty" ? "Bo'sh" : b.status === "partial" ? "Qisman" : "To'la";
        return {
          value: b.id,
          label: b.code,
          description: `${b.occupancyPct || 0}% band · Yuk: ${b.currentWeightKg || 0}/${b.maxWeightKg || 1000} kg`,
          badge: statusLabel,
          icon: Layers,
        };
      });
  }, [binsList, bin?.id]);

  const handleStockSelect = (id: string) => {
    setSelectedStockId(id);
    const s = stockBalances.find((item) => item.id === id);
    if (s) {
      const avail = s.available ?? s.quantity ?? 100;
      setQuantity(String(avail));
      return;
    }
    const f = finishedGoods.find((item) => item.id === id);
    if (f) {
      setQuantity(String(f.quantity ?? 100));
    }
  };

  useEffect(() => {
    if (mode === "transfer" && binsList.length > 0) {
      const otherBins = binsList.filter((b) => b.id !== bin?.id);
      if (otherBins.length > 0) setTargetBinId(otherBins[0].id);
    }
  }, [mode, bin, binsList, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "putaway") {
        const selectedStock = stockBalances.find((s) => s.id === selectedStockId);
        const selectedFg = finishedGoods.find((f) => f.id === selectedStockId);
        await onAction({
          mode: "putaway",
          binId: bin?.id,
          warehouseId: bin?.warehouseId,
          rackId: bin?.rackId,
          stockBalanceId: selectedStock?.id || null,
          finishedGoodId: selectedFg?.id || null,
          sku: selectedStock?.sku || selectedFg?.sku || "SKU-AUTO",
          name: selectedStock?.name || selectedFg?.productName || "Xomashyo",
          category: selectedStock?.category || "Paper & Board",
          quantity: Number(quantity) || 1,
          weightKg: Number(weightKg) || 100,
          containerType,
          unit: selectedStock?.unit || "sheets",
        });
      } else if (mode === "transfer") {
        await onAction({
          mode: "transfer",
          itemId: item?.id,
          targetBinId,
        });
      } else if (mode === "pick") {
        await onAction({
          mode: "pick",
          itemId: item?.id,
        });
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 bg-card border-border">
        <DialogHeader className="p-0 pb-2 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
            {mode === "putaway" && <Box className="size-4 text-primary" />}
            {mode === "transfer" && <ArrowRightLeft className="size-4 text-amber-500" />}
            {mode === "pick" && <MoveRight className="size-4 text-rose-500" />}
            <span>
              {mode === "putaway" && "Katakka mahsulot joylash"}
              {mode === "transfer" && "Boshqa katakka ko'chirish"}
              {mode === "pick" && "Katakdan chiqarish (Pick)"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="p-2 rounded bg-muted/30 border border-border text-xs flex justify-between">
            <span className="text-muted-foreground">Katak manzil:</span>
            <span className="font-mono font-semibold">{bin?.code}</span>
          </div>

          {mode === "putaway" && (
            <>
              <div>
                <Label className="text-xs mb-1 block">Ombor qoldig'idan tanlang (SKU / Nomi)</Label>
                <SmartCombobox
                  value={selectedStockId}
                  onChange={handleStockSelect}
                  options={stockOptions}
                  placeholder="Xomashyo yoki mahsulot tanlang yoki qidiring..."
                  searchPlaceholder="SKU yoki tovar nomini yozing..."
                  allowCustom={false}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Konteyner turi</Label>
                  <Select value={containerType} onValueChange={(val) => setContainerType(val || "pallet")}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pallet">Palet (120x80)</SelectItem>
                      <SelectItem value="box">Quti / Gofratara</SelectItem>
                      <SelectItem value="roll">Rulon / Bobina</SelectItem>
                      <SelectItem value="drum">Bochka / Idish</SelectItem>
                      <SelectItem value="bundle">Bog'lam / Pachka</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Miqdor</Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Og'irligi (kg)</Label>
                <Input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </>
          )}

          {mode === "transfer" && (
            <>
              <div className="p-2 rounded bg-card border border-border text-xs space-y-1">
                <div className="text-muted-foreground">Ko'chiriladigan mahsulot:</div>
                <div className="font-semibold text-foreground">{item?.name}</div>
                <div className="font-mono text-muted-foreground">{item?.sku} — {item?.quantity} {item?.unit}</div>
              </div>

              <div>
                <Label className="text-xs mb-1 block">Maqsadli katak (Sektor-Stelaj-Qavat-Katak)</Label>
                <SmartCombobox
                  value={targetBinId}
                  onChange={setTargetBinId}
                  options={binOptions}
                  placeholder="Katakni tanlang yoki qidiring..."
                  searchPlaceholder="Katak kodi (masalan: A-01-2-3)..."
                  allowCustom={false}
                  className="h-8 text-xs font-mono font-medium"
                />
              </div>
            </>
          )}

          {mode === "pick" && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
              Ushbu mahsulot katakdan chiqariladi va ombor tranzitiga yoki ishlab chiqarishga o'tkaziladi:
              <div className="font-semibold mt-1">{item?.name} ({item?.quantity} {item?.unit})</div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs gap-1">
              <Check className="size-3.5" />
              <span>Tasdiqlash</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 3. Sektor / Zona Yaratish / Tahrirlash Moduli ──────────────────────────────

interface ZoneUpsertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: Partial<WmsZone> | null;
  warehouseId: string;
  onSave: (zoneData: any) => Promise<void>;
  onDelete?: (zoneId: string) => Promise<void>;
}

export function ZoneUpsertModal({
  open,
  onOpenChange,
  zone,
  warehouseId,
  onSave,
  onDelete,
}: ZoneUpsertModalProps) {
  const [formData, setFormData] = useState<Partial<WmsZone>>({
    code: "",
    name: "",
    type: "storage",
    color: "#2563eb",
    x: 50,
    y: 50,
    width: 500,
    height: 380,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (zone) {
      setFormData({
        id: zone.id,
        code: zone.code || "",
        name: zone.name || "",
        type: zone.type || "storage",
        color: zone.color || "#2563eb",
        x: zone.x !== undefined ? zone.x : 50,
        y: zone.y !== undefined ? zone.y : 50,
        width: zone.width || 500,
        height: zone.height || 380,
        notes: zone.notes || "",
      });
    } else {
      setFormData({
        code: "C",
        name: "C Sektor",
        type: "storage",
        color: "#2563eb",
        x: 50,
        y: 50,
        width: 500,
        height: 380,
        notes: "",
      });
    }
  }, [zone, open]);

  const colorPresets = [
    { label: "Ko'k", hex: "#2563eb" },
    { label: "Yashil", hex: "#059669" },
    { label: "Amber", hex: "#d97706" },
    { label: "Binafsha", hex: "#7c3aed" },
    { label: "Pushti", hex: "#db2777" },
    { label: "Havorang", hex: "#0284c7" },
    { label: "Kulrang", hex: "#475569" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) return;
    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        warehouseId,
        x: Number(formData.x) || 50,
        y: Number(formData.y) || 50,
        width: Number(formData.width) || 500,
        height: Number(formData.height) || 380,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 bg-card border-border">
        <DialogHeader className="p-0 pb-2 border-b border-border">
          <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
            <LayoutGrid className="size-4 text-primary" />
            <span>{formData.id ? "Zonani tahrirlash" : "Yangi zona yaratish"}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Zona kodi</Label>
              <Input
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="A, B, RCV"
                required
                className="h-8 text-xs font-mono font-medium"
              />
            </div>
            <div>
              <Label className="text-xs">Turi</Label>
              <Select
                value={formData.type || "storage"}
                onValueChange={(val: any) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storage">Saqlash sektori</SelectItem>
                  <SelectItem value="receiving">Qabul qilish / Kirim</SelectItem>
                  <SelectItem value="shipping">Yuklash / Chiqim</SelectItem>
                  <SelectItem value="staging">Vaqtinchalik / Bufer</SelectItem>
                  <SelectItem value="quarantine">Karantin / Brak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Nomi</Label>
            <Input
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Masalan: A Sektor — Qog'oz va karton"
              className="h-8 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Rang</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {colorPresets.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c.hex })}
                    className={`size-6 rounded-full border transition-all ${
                      formData.color === c.hex ? "scale-110 border-primary ring-2 ring-primary/30" : "border-border"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
              <Input
                value={formData.color || "#2563eb"}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-7 w-24 text-[11px] font-mono ml-auto"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Eni (px)</Label>
              <Input
                type="number"
                value={formData.width || 500}
                onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 100 })}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Bo'yi (px)</Label>
              <Input
                type="number"
                value={formData.height || 380}
                onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 100 })}
                className="h-7 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between">
            {formData.id && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (confirm("Zonani o'chirishni tasdiqlaysizmi?")) {
                    await onDelete(formData.id!);
                    onOpenChange(false);
                  }
                }}
                className="h-8 text-xs gap-1"
              >
                <Trash2 className="size-3.5" />
                <span>O'chirish</span>
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Bekor qilish
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs gap-1">
                <Check className="size-3.5" />
                <span>Saqlash</span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
