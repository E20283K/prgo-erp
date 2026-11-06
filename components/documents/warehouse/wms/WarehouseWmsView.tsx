"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  WmsMode,
  WmsRack,
  WmsZone,
  WmsBin,
  WmsBinItem,
  WmsLayoutData,
  WmsDrawTool,
} from "./types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import {
  Layers,
  Map,
  Box,
  Plus,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  ChevronRight,
  ChevronDown,
  MousePointer,
  RefreshCw,
  Warehouse,
  LayoutGrid,
  Split,
  DoorOpen,
  Square,
  Edit3,
  Trash2,
} from "lucide-react";
import { RackUpsertModal, BinItemActionModal, ZoneUpsertModal } from "./WmsUnifiedDialogs";

// Konva va Glide Data Grid komponentlarini SSR dan ajratilgan holda dinamik yuklash
const WmsMapCanvas = dynamic(
  () => import("./WmsMapCanvas").then((mod) => mod.WmsMapCanvas),
  { ssr: false }
);
const WmsRackCanvas = dynamic(
  () => import("./WmsRackCanvas").then((mod) => mod.WmsRackCanvas),
  { ssr: false }
);
const WmsBinCanvas = dynamic(
  () => import("./WmsBinCanvas").then((mod) => mod.WmsBinCanvas),
  { ssr: false }
);
const WmsContextGrid = dynamic(
  () => import("./WmsContextGrid").then((mod) => mod.WmsContextGrid),
  { ssr: false }
);

export function WarehouseWmsView({ tab }: { tab?: any } = {}) {
  const { warehousesList, warehouseStock, finishedGoods, loadWarehouses } = useWorkspaceStore();

  const docData = tab?.documentData;
  const targetWarehouseId = docData?.targetWarehouseId;
  const targetRackId = docData?.targetRackId;
  const targetBinCode = docData?.targetBin;
  const targetSku = docData?.targetSku;

  // 1. Asosiy Holatlar (State)
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(targetWarehouseId || "");
  const [mode, setMode] = useState<WmsMode>("map");
  const [layoutData, setLayoutData] = useState<WmsLayoutData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Tanlangan elementlar
  const [selectedRack, setSelectedRack] = useState<WmsRack | null>(null);
  const [selectedZone, setSelectedZone] = useState<WmsZone | null>(null);
  const [selectedBin, setSelectedBin] = useState<WmsBin | null>(null);
  const [selectedBinItem, setSelectedBinItem] = useState<WmsBinItem | null>(null);

  // Canvas sozlamalari
  const [drawTool, setDrawTool] = useState<WmsDrawTool>("select");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [scale, setScale] = useState(0.85);
  const [searchQuery, setSearchQuery] = useState(targetSku || "");

  // Modallar
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [rackModalData, setRackModalData] = useState<Partial<WmsRack> | null>(null);

  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [zoneModalData, setZoneModalData] = useState<Partial<WmsZone> | null>(null);

  const [isItemActionModalOpen, setIsItemActionModalOpen] = useState(false);
  const [itemActionModalMode, setItemActionModalMode] = useState<"putaway" | "transfer" | "pick">("putaway");
  const [activeActionItem, setActiveActionItem] = useState<WmsBinItem | null>(null);

  // Omborlar ro'yxatini yuklash
  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (!activeWarehouseId && warehousesList.length > 0) {
      setActiveWarehouseId(warehousesList[0].id);
    }
  }, [warehousesList, activeWarehouseId]);

  // WMS ma'lumotlarini serverdan yuklash
  const fetchLayout = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = activeWarehouseId
        ? `/api/v1/warehouse/wms?warehouseId=${encodeURIComponent(activeWarehouseId)}`
        : `/api/v1/warehouse/wms`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setLayoutData(json.data);
        if (!activeWarehouseId && json.data.warehouse?.id) {
          setActiveWarehouseId(json.data.warehouse.id);
        }
      }
    } catch (err) {
      console.error("WMS ma'lumotlarini yuklashda xatolik:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWarehouseId]);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  // Agar targetBinCode yoki targetRackId berilgan bo'lsa, xaritada avtomatik fokuslash
  useEffect(() => {
    if (!layoutData) return;
    if (targetBinCode) {
      const foundBin = layoutData.bins?.find((b: any) => b.code === targetBinCode);
      if (foundBin) {
        const foundRack = layoutData.racks?.find((r: any) => r.id === foundBin.rackId);
        if (foundRack) {
          setSelectedRack(foundRack);
          setSelectedBin(foundBin);
          setMode("bin");
          return;
        }
      }
    }
    if (targetRackId) {
      const foundRack = layoutData.racks?.find((r: any) => r.id === targetRackId);
      if (foundRack) {
        setSelectedRack(foundRack);
        setMode("rack");
      }
    }
  }, [layoutData, targetBinCode, targetRackId]);

  // ─── Rejimlar o'rtasida navigatsiya ──────────────────────────────────────────

  // Xarita -> Stelaj
  const handleNavigateToRack = (rack: WmsRack) => {
    setSelectedRack(rack);
    setSelectedBin(null);
    setSelectedBinItem(null);
    setMode("rack");
  };

  // Stelaj -> Katak
  const handleNavigateToBin = (bin: WmsBin) => {
    setSelectedBin(bin);
    setSelectedBinItem(null);
    setMode("bin");
  };

  // Xaritaga qaytish
  const handleNavigateToMap = () => {
    setSelectedRack(null);
    setSelectedZone(null);
    setSelectedBin(null);
    setSelectedBinItem(null);
    setMode("map");
  };

  // ─── API Amallari ─────────────────────────────────────────────────────────────

  // 1. Stelaj / Konstruktiv element saqlash (Yaratish / Tahrirlash)
  const handleSaveRack = async (rackData: any) => {
    try {
      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert-rack",
          data: { ...rackData, warehouseId: activeWarehouseId },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLayout();
      }
    } catch (err) {
      console.error("Stelajni saqlashda xatolik:", err);
    }
  };

  // 1.1. Sektor / Zona saqlash (Yaratish / Tahrirlash)
  const handleSaveZone = async (zoneData: any) => {
    try {
      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert-zone",
          data: { ...zoneData, warehouseId: activeWarehouseId },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLayout();
      }
    } catch (err) {
      console.error("Zonani saqlashda xatolik:", err);
    }
  };

  // 1.2. Zona o'chirish
  const handleDeleteZone = async (zoneId: string) => {
    try {
      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-zone",
          zoneId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (selectedZone?.id === zoneId) {
          setSelectedZone(null);
        }
        await fetchLayout();
      }
    } catch (err) {
      console.error("Zonani o'chirishda xatolik:", err);
    }
  };

  // 2. Stelaj / Element o'chirish
  const handleDeleteRack = async (rackId: string) => {
    try {
      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-rack",
          rackId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (selectedRack?.id === rackId) {
          handleNavigateToMap();
        }
        await fetchLayout();
      }
    } catch (err) {
      console.error("Stelajni o'chirishda xatolik:", err);
    }
  };

  // 3. Batch pozitsiyalar yangilanishi
  const handleUpdatePositions = async (updates: any[]) => {
    try {
      await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch-positions",
          updates,
        }),
      });
      // Mahalliy holatni yangilash
      if (layoutData) {
        let updatedRacks = layoutData.racks;
        let updatedZones = layoutData.zones;

        const rackUpdates = updates.filter((u) => !u.isZone);
        const zoneUpdates = updates.filter((u) => u.isZone);

        if (rackUpdates.length > 0) {
          updatedRacks = layoutData.racks.map((r) => {
            const up = rackUpdates.find((u) => u.id === r.id);
            return up ? { ...r, ...up } : r;
          });
        }

        if (zoneUpdates.length > 0) {
          updatedZones = layoutData.zones.map((z) => {
            const up = zoneUpdates.find((u) => u.id === z.id);
            return up ? { ...z, ...up } : z;
          });
        }

        setLayoutData({ ...layoutData, racks: updatedRacks, zones: updatedZones });
      }
    } catch (err) {
      console.error("Pozitsiyalarni yangilashda xatolik:", err);
    }
  };

  // 3.1. Xaritada chizish tugagandan so'ng modalni ochish
  const handleOpenCreateModal = (
    type: "rack" | "zone" | "aisle" | "gate" | "obstacle",
    coords: { x: number; y: number; width: number; depth: number }
  ) => {
    if (type === "zone") {
      setZoneModalData({
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.depth,
      });
      setIsZoneModalOpen(true);
    } else {
      const rackType = type === "aisle" ? "floor_stack" : type === "rack" ? "pallet" : type;
      setRackModalData({
        type: rackType,
        x: coords.x,
        y: coords.y,
        width: coords.width,
        depth: coords.depth,
      });
      setIsRackModalOpen(true);
    }
  };

  // 4. Kataklarni birlashtirish (Merge)
  const handleMergeBins = async (primaryBinId: string, secondaryBinId: string) => {
    try {
      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "modify-bin",
          subAction: "merge",
          data: { primaryBinId, secondaryBinId, colSpan: 2 },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLayout();
      }
    } catch (err) {
      console.error("Kataklarni birlashtirishda xatolik:", err);
    }
  };

  // 5. Katakni ajratish (Split)
  const handleSplitBin = async (binId: string, secondaryBinId?: string) => {
    try {
      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "modify-bin",
          subAction: "split",
          data: { binId, secondaryBinId },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLayout();
      }
    } catch (err) {
      console.error("Katakni ajratishda xatolik:", err);
    }
  };

  // 6. Mahsulot amallari (Putaway / Transfer / Pick)
  const handleItemAction = async (actionData: any) => {
    try {
      let action = "upsert-bin-item";
      if (actionData.mode === "transfer") action = "move-bin-item";
      else if (actionData.mode === "pick") action = "remove-bin-item";

      const res = await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          data: actionData,
          itemId: actionData.itemId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchLayout();
      }
    } catch (err) {
      console.error("Mahsulot amalini bajarishda xatolik:", err);
    }
  };

  // 7. Mahsulot koordinatasini yangilash
  const handleUpdateItemPosition = async (itemId: string, posX: number, posY: number) => {
    try {
      await fetch("/api/v1/warehouse/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert-bin-item",
          data: { id: itemId, posX, posY, binId: selectedBin?.id, warehouseId: activeWarehouseId, rackId: selectedRack?.id },
        }),
      });
    } catch (err) {
      console.error("Mahsulot pozitsiyasini saqlashda xatolik:", err);
    }
  };

  const zones = layoutData?.zones || [];
  const racks = layoutData?.racks || [];
  const bins = layoutData?.bins || [];
  const binItems = layoutData?.binItems || [];
  const stats = layoutData?.stats || {
    totalRacks: 0,
    totalBins: 0,
    occupiedBins: 0,
    emptyBins: 0,
    avgOccupancy: 0,
    totalItemsCount: 0,
  };

  const displayWarehouses = useMemo(() => {
    if (warehousesList.length > 0) return warehousesList;
    if (layoutData?.warehouse) return [layoutData.warehouse];
    return [];
  }, [warehousesList, layoutData?.warehouse]);

  const warehouseOptions: ComboboxItem[] = useMemo(() => {
    return displayWarehouses.map((w: any) => {
      let typeLabel = "Umumiy ombor";
      if (w.type === "finished_goods") typeLabel = "Tayyor mahsulot";
      else if (w.type === "raw_materials") typeLabel = "Xomashyo";
      else if (w.type === "general" || w.type === "retail") typeLabel = "Savdo";
      else if (w.type) typeLabel = w.type;

      return {
        value: w.id,
        label: w.name || w.code || "Ombor",
        code: w.code || undefined,
        description: w.branch?.name ? `Filial: ${w.branch.name}` : (w.company?.name ? `Korxona: ${w.company.name}` : undefined),
        badge: typeLabel,
        group: w.branch?.name || (w.company?.name || "Omborlar"),
        icon: Warehouse,
      };
    });
  }, [displayWarehouses]);

  const handleWarehouseChange = (newWarehouseId: string) => {
    if (!newWarehouseId || newWarehouseId === activeWarehouseId) return;
    setActiveWarehouseId(newWarehouseId);
    setSelectedRack(null);
    setSelectedBin(null);
    setSelectedBinItem(null);
    setMode("map");
  };

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      {/* ─── Top Control Toolbar (Kompakt 1C/Linear Standart) ────────────────────── */}
      <div className="h-10 px-3 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
        {/* Chap qism: Ombor tanlagich va Interaktiv Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-64 sm:w-72 shrink-0">
            <SmartCombobox
              value={activeWarehouseId}
              onChange={handleWarehouseChange}
              options={warehouseOptions}
              placeholder="Omborni tanlang..."
              searchPlaceholder="Ombor nomi, kodi yoki filiali..."
              emptyText="Bunday ombor topilmadi"
              allowCustom={false}
              popoverWidth="w-[360px]"
              className="h-7.5 text-xs font-semibold px-2.5"
            />
          </div>

          <div className="h-4 w-px bg-border mx-1 shrink-0" />

          {/* Breadcrumb navigatsiya */}
          <div className="flex items-center gap-1 text-xs truncate">
            <Button
              variant={mode === "map" ? "secondary" : "ghost"}
              size="sm"
              onClick={handleNavigateToMap}
              className="h-7 text-xs px-2 gap-1 font-medium"
            >
              <Map className="size-3.5" />
              <span>Xarita</span>
            </Button>

            {selectedRack && (
              <>
                <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                <Button
                  variant={mode === "rack" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setMode("rack")}
                  className="h-7 text-xs px-2 gap-1 font-mono font-medium"
                >
                  <Layers className="size-3.5" />
                  <span>{selectedRack.code}</span>
                </Button>
              </>
            )}

            {selectedBin && (
              <>
                <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                <Button
                  variant={mode === "bin" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setMode("bin")}
                  className="h-7 text-xs px-2 gap-1 font-mono font-medium text-primary"
                >
                  <Box className="size-3.5" />
                  <span>{selectedBin.code}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* O'rta qism: Konstruktor va Ko'rish asboblari */}
        <div className="flex items-center gap-1.5 shrink-0">
          {mode === "map" && (
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
              <Button
                variant={drawTool === "select" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setDrawTool("select")}
                title="Tanlash"
              >
                <MousePointer className="size-3.5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant={drawTool !== "select" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-6 px-1.5 text-[11px] gap-1 font-medium"
                      title="Xaritada element chizish"
                    >
                      <Plus className="size-3" />
                      <span>
                        {drawTool === "zone"
                          ? "Zona chizish"
                          : drawTool === "aisle"
                          ? "Yo'lak chizish"
                          : drawTool === "gate"
                          ? "Rampa chizish"
                          : drawTool === "obstacle"
                          ? "Ustun chizish"
                          : "Stelaj chizish"}
                      </span>
                      <ChevronDown className="size-2.5 opacity-60" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-44 text-xs">
                  <DropdownMenuItem
                    onClick={() => setDrawTool("rack")}
                    className={drawTool === "rack" ? "bg-accent font-semibold" : ""}
                  >
                    <Layers className="size-3.5 mr-2" />
                    <span>Stelaj chizish</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDrawTool("zone")}
                    className={drawTool === "zone" ? "bg-accent font-semibold" : ""}
                  >
                    <LayoutGrid className="size-3.5 mr-2" />
                    <span>Sektor / Zona chizish</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDrawTool("aisle")}
                    className={drawTool === "aisle" ? "bg-accent font-semibold" : ""}
                  >
                    <Split className="size-3.5 mr-2" />
                    <span>Yo'lak chizish</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDrawTool("gate")}
                    className={drawTool === "gate" ? "bg-accent font-semibold" : ""}
                  >
                    <DoorOpen className="size-3.5 mr-2" />
                    <span>Rampa / Darvoza</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDrawTool("obstacle")}
                    className={drawTool === "obstacle" ? "bg-accent font-semibold" : ""}
                  >
                    <Square className="size-3.5 mr-2" />
                    <span>Ustun / To'siq</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {mode === "map" && (
            <Button
              variant={snapToGrid ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSnapToGrid(!snapToGrid)}
              className="h-7 text-xs px-2 gap-1"
              title="Setkaga yopishish"
            >
              <Grid className="size-3.5" />
              <span className="hidden sm:inline">Setka</span>
            </Button>
          )}

          {/* Masshtab */}
          <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.4, s - 0.15))}
              className="h-6 w-6 p-0"
            >
              <ZoomOut className="size-3" />
            </Button>
            <span className="text-[10px] font-mono px-1 min-w-[36px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="h-6 w-6 p-0"
            >
              <ZoomIn className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScale(1)}
              className="h-6 w-6 p-0"
              title="100%"
            >
              <Maximize2 className="size-3" />
            </Button>
          </div>

          {/* Qidiruv */}
          <div className="relative w-44">
            <Search className="size-3 absolute left-2 top-2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SKU / Stelaj..."
              className="h-7 pl-6 text-xs bg-background"
            />
          </div>
        </div>

        {/* O'ng qism: Asosiy Yaratish amallari va Tanlangan element amallari */}
        <div className="flex items-center gap-1.5 shrink-0">
          {mode === "map" && selectedRack && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRackModalData(selectedRack);
                  setIsRackModalOpen(true);
                }}
                className="h-7 text-xs gap-1 font-medium"
              >
                <Edit3 className="size-3" />
                <span>Tahrirlash</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteRack(selectedRack.id)}
                className="h-7 text-xs px-2 gap-1"
                title="O'chirish"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}

          {mode === "map" && selectedZone && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setZoneModalData(selectedZone);
                  setIsZoneModalOpen(true);
                }}
                className="h-7 text-xs gap-1 font-medium"
              >
                <Edit3 className="size-3" />
                <span>Zonani tahrirlash</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteZone(selectedZone.id)}
                className="h-7 text-xs px-2 gap-1"
                title="O'chirish"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}

          {mode === "map" && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="sm" className="h-7 text-xs gap-1 font-medium">
                    <Plus className="size-3.5" />
                    <span>Qo'shish</span>
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuItem
                  onClick={() => {
                    setRackModalData({ type: "pallet" });
                    setIsRackModalOpen(true);
                  }}
                >
                  <Layers className="size-3.5 mr-2" />
                  <span>Stelaj qo'shish</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setZoneModalData(null);
                    setIsZoneModalOpen(true);
                  }}
                >
                  <LayoutGrid className="size-3.5 mr-2" />
                  <span>Sektor / Zona qo'shish</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setRackModalData({ type: "floor_stack", name: "Transport yo'lagi", code: "AISLE-01" });
                    setIsRackModalOpen(true);
                  }}
                >
                  <Split className="size-3.5 mr-2" />
                  <span>Yo'lak qo'shish</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRackModalData({ type: "gate", name: "Rampa 1", code: "GATE-01" });
                    setIsRackModalOpen(true);
                  }}
                >
                  <DoorOpen className="size-3.5 mr-2" />
                  <span>Rampa / Darvoza qo'shish</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRackModalData({ type: "obstacle", name: "Beton ustun", code: "PIL-01" });
                    setIsRackModalOpen(true);
                  }}
                >
                  <Square className="size-3.5 mr-2" />
                  <span>Ustun / To'siq qo'shish</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {mode === "bin" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setItemActionModalMode("putaway");
                setActiveActionItem(null);
                setIsItemActionModalOpen(true);
              }}
              className="h-7 text-xs gap-1 font-medium"
            >
              <Box className="size-3.5" />
              <span>Mahsulot joylash</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchLayout}
            className="h-7 w-7 p-0"
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ─── Asosiy Split-View: Yuqori/Chap Canvas (Konva) + Pastki/O'ng Glide Data Grid ─── */}
      <div className="flex-1 min-h-0 relative">
        <ResizablePanelGroup orientation="vertical" className="h-full w-full">
          {/* Panel 1: Konva Canvas (3 rejimli) */}
          <ResizablePanel defaultSize={58} minSize={30} className="relative h-full w-full overflow-hidden">
            {mode === "map" && (
              <WmsMapCanvas
                zones={zones}
                racks={racks}
                bins={bins}
                selectedRackId={selectedRack?.id || null}
                selectedZoneId={selectedZone?.id || null}
                onSelectRack={(r) => {
                  setSelectedRack(r);
                  if (r) setSelectedZone(null);
                }}
                onSelectZone={(z) => {
                  setSelectedZone(z);
                  if (z) setSelectedRack(null);
                }}
                onOpenRackDetail={handleNavigateToRack}
                onOpenEditRackModal={(r) => {
                  setRackModalData(r);
                  setIsRackModalOpen(true);
                }}
                onOpenEditZoneModal={(z) => {
                  setZoneModalData(z);
                  setIsZoneModalOpen(true);
                }}
                onOpenCreateModal={handleOpenCreateModal}
                onUpdatePositions={handleUpdatePositions}
                drawTool={drawTool}
                snapToGrid={snapToGrid}
                scale={scale}
                searchQuery={searchQuery}
              />
            )}

            {mode === "rack" && selectedRack && (
              <WmsRackCanvas
                rack={selectedRack}
                bins={bins}
                binItems={binItems}
                selectedBinId={selectedBin?.id || null}
                onSelectBin={(b) => setSelectedBin(b)}
                onOpenBinDetail={handleNavigateToBin}
                onMergeBins={handleMergeBins}
                onSplitBin={handleSplitBin}
              />
            )}

            {mode === "bin" && selectedBin && (
              <WmsBinCanvas
                bin={selectedBin}
                rack={selectedRack || undefined}
                items={binItems}
                selectedItemId={selectedBinItem?.id || null}
                onSelectItem={(it) => setSelectedBinItem(it)}
                onOpenPutawayModal={() => {
                  setItemActionModalMode("putaway");
                  setActiveActionItem(null);
                  setIsItemActionModalOpen(true);
                }}
                onOpenTransferModal={(it) => {
                  setItemActionModalMode("transfer");
                  setActiveActionItem(it);
                  setIsItemActionModalOpen(true);
                }}
                onOpenPickModal={(it) => {
                  setItemActionModalMode("pick");
                  setActiveActionItem(it);
                  setIsItemActionModalOpen(true);
                }}
                onUpdateItemPosition={handleUpdateItemPosition}
              />
            )}
          </ResizablePanel>

          {/* Bo'linish chizig'i */}
          <ResizableHandle withHandle />

          {/* Panel 2: Kontekstual Glide Data Grid */}
          <ResizablePanel defaultSize={42} minSize={20} className="relative h-full w-full overflow-hidden">
            <WmsContextGrid
              mode={mode}
              racks={racks}
              bins={bins}
              binItems={binItems}
              zones={zones}
              selectedRack={selectedRack}
              selectedBin={selectedBin}
              onSelectRack={(r) => setSelectedRack(r)}
              onSelectBin={(b) => setSelectedBin(b)}
              onSelectBinItem={(it) => setSelectedBinItem(it)}
              onOpenCreateRackModal={() => {
                setRackModalData(null);
                setIsRackModalOpen(true);
              }}
              onOpenPutawayModal={() => {
                setItemActionModalMode("putaway");
                setActiveActionItem(null);
                setIsItemActionModalOpen(true);
              }}
              onNavigateToRack={handleNavigateToRack}
              onNavigateToBin={handleNavigateToBin}
              onRefresh={fetchLayout}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ─── Yagona Stelaj Moduli (Dialog) ────────────────────────────────────────── */}
      <RackUpsertModal
        open={isRackModalOpen}
        onOpenChange={setIsRackModalOpen}
        rack={rackModalData}
        zones={zones}
        warehouseId={activeWarehouseId}
        onSave={handleSaveRack}
        onDelete={rackModalData?.id ? handleDeleteRack : undefined}
      />

      {/* ─── Sektor / Zona Moduli (Dialog) ─────────────────────────────────────────── */}
      <ZoneUpsertModal
        open={isZoneModalOpen}
        onOpenChange={setIsZoneModalOpen}
        zone={zoneModalData}
        warehouseId={activeWarehouseId}
        onSave={handleSaveZone}
        onDelete={zoneModalData?.id ? handleDeleteZone : undefined}
      />

      {/* ─── Mahsulot Joylash / Ko'chirish / Chiqim Moduli (Dialog) ──────────────── */}
      <BinItemActionModal
        open={isItemActionModalOpen}
        onOpenChange={setIsItemActionModalOpen}
        mode={itemActionModalMode}
        bin={selectedBin}
        binsList={bins}
        item={activeActionItem}
        stockBalances={warehouseStock}
        finishedGoods={finishedGoods}
        onAction={handleItemAction}
      />
    </div>
  );
}
