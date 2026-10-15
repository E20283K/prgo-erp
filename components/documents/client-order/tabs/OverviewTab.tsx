"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { 
  FileText, 
  Factory, 
  Ruler, 
  Plus, 
  X, 
  Tag, 
  Sparkles,
  Camera,
  Paperclip,
  Maximize2,
  Download,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Layers,
  ExternalLink,
  DollarSign,
  CreditCard,
  Check,
  Palette,
  CircleDot,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";
import {
  ClientOrderFormData,
  SizeDistribution,
  OrderAttachment,
  MOCK_CUSTOMERS,
  KashirovkaMode,
  KashirovkaImpositionStrategy,
  SubstrateLayer,
  SideColorConfig,
  SpotColorItem,
  parseGrammageFromStock,
  getDefaultKashirovkaLayers,
  calculateKashirovkaTotals,
} from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";
import { OrderReadinessRouteCard } from "@/components/documents/work-order/OrderReadinessRouteCard";
import { DieLinePreview } from "@/components/documents/work-order/DieLinePreview";
import { PantoneColorPickerModal, SpotStationSelection } from "@/components/documents/work-order/dialogs/PantoneColorPickerModal";
import { FilePreviewDialog } from "@/components/file-viewer/FilePreviewDialog";
import { FILE_KIND_ICON, getFileKind, isPreviewable, downloadFile, fileToAttachment, ViewableFile } from "@/components/file-viewer/file-utils";

interface Props {
  formData: ClientOrderFormData;
  handleFieldChange: (field: keyof ClientOrderFormData, val: any) => void;
  sizes: SizeDistribution[];
  handleSizesChange: (sizes: SizeDistribution[]) => void;
  docNo: string;
  orderAttachments: OrderAttachment[];
  setOrderAttachments: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  onOpenLightbox: () => void;
  onMarkUnsaved: () => void;
  onSwitchTab?: (tabKey: string) => void;
}

export function OverviewTab({ 
  formData, 
  handleFieldChange, 
  sizes, 
  handleSizesChange, 
  docNo,
  orderAttachments,
  setOrderAttachments,
  onOpenLightbox,
  onMarkUnsaved,
  onSwitchTab,
}: Props) {
  const t = useTranslations("ClientOrder");
  const tEnhance = useTranslations("OverviewEnhancements");
  const { crmCustomers, warehouseStock, openTab, reserveStockForOrder } = useWorkspaceStore();
  const [newSize, setNewSize] = useState("");
  const [newSizeQty, setNewSizeQty] = useState("");
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isPantoneModalOpen, setIsPantoneModalOpen] = useState(false);

  // Dynamic Inks & Printing Stations
  const frontColors: SideColorConfig = formData.frontColors || { c: true, m: true, y: true, k: true };
  const backColors: SideColorConfig = formData.backColors || { c: false, m: false, y: false, k: false };
  const spotColorItems: SpotColorItem[] = formData.spotColorItems || (
    formData.spotColors && formData.spotColors.length > 0
      ? formData.spotColors.map((name, i) => ({
          id: `spot-${i}`,
          name,
          code: name.split(" ")[1] || "PMS",
          hex: name.includes("021") ? "#fe5000" : name.includes("871") ? "#84754e" : "#2563eb",
          side: "front" as const,
        }))
      : [
          {
            id: "spot-1",
            name: "PANTONE 021 C (Neon Orange)",
            code: "021 C",
            hex: "#fe5000",
            side: "front" as const,
          },
        ]
  );

  const frontProcessCount = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
  const frontSpots = spotColorItems.filter((s) => s.side === "front" || s.side === "both");
  const frontTotal = frontProcessCount + frontSpots.length;

  const backProcessCount = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);
  const backSpots = spotColorItems.filter((s) => s.side === "back" || s.side === "both");
  const backTotal = backProcessCount + backSpots.length;

  const dynamicColorNotation = `${frontTotal}+${backTotal}`;

  const handleToggleFrontChannel = (channel: keyof SideColorConfig) => {
    const updated = { ...frontColors, [channel]: !frontColors[channel] };
    handleFieldChange("frontColors", updated);
    onMarkUnsaved();
  };

  const handleToggleBackChannel = (channel: keyof SideColorConfig) => {
    const updated = { ...backColors, [channel]: !backColors[channel] };
    handleFieldChange("backColors", updated);
    onMarkUnsaved();
  };

  const handleApplyColorPreset = (preset: string) => {
    let newFront: SideColorConfig = { c: true, m: true, y: true, k: true };
    let newBack: SideColorConfig = { c: false, m: false, y: false, k: false };
    let newSpots = spotColorItems;

    if (preset === "4+0") {
      newFront = { c: true, m: true, y: true, k: true };
      newBack = { c: false, m: false, y: false, k: false };
    } else if (preset === "4+4") {
      newFront = { c: true, m: true, y: true, k: true };
      newBack = { c: true, m: true, y: true, k: true };
    } else if (preset === "4+1") {
      newFront = { c: true, m: true, y: true, k: true };
      newBack = { c: false, m: false, y: false, k: true };
    } else if (preset === "1+0") {
      newFront = { c: false, m: false, y: false, k: true };
      newBack = { c: false, m: false, y: false, k: false };
    } else if (preset === "1+1") {
      newFront = { c: false, m: false, y: false, k: true };
      newBack = { c: false, m: false, y: false, k: true };
    } else if (preset === "5+0") {
      newFront = { c: true, m: true, y: true, k: true };
      newBack = { c: false, m: false, y: false, k: false };
      if (newSpots.length === 0) {
        newSpots = [
          {
            id: `spot-${Date.now()}`,
            name: "PANTONE 021 C (Neon Orange)",
            code: "021 C",
            hex: "#fe5000",
            side: "front",
          },
        ];
      }
    }

    handleFieldChange("frontColors", newFront);
    handleFieldChange("backColors", newBack);
    handleFieldChange("spotColorItems", newSpots);
    handleFieldChange("spotColors", newSpots.map((s) => s.name));
    handleFieldChange("colorsConfig", `${preset} (${preset === "4+0" ? "CMYK" : preset === "4+4" ? "CMYK / CMYK" : preset === "4+1" ? "CMYK / K" : preset === "1+0" ? "K" : preset === "1+1" ? "K / K" : "Custom"})`);
    onMarkUnsaved();
  };

  const handleAddSpotStation = (spot: SpotStationSelection) => {
    const newItem: SpotColorItem = {
      id: `spot-${Date.now()}`,
      name: spot.name,
      code: spot.code,
      hex: spot.hex,
      side: spot.side,
    };
    const updated = [...spotColorItems, newItem];
    handleFieldChange("spotColorItems", updated);
    handleFieldChange("spotColors", updated.map((s) => s.name));
    onMarkUnsaved();
  };

  const handleRemoveSpotStation = (id: string) => {
    const updated = spotColorItems.filter((s) => s.id !== id);
    handleFieldChange("spotColorItems", updated);
    handleFieldChange("spotColors", updated.map((s) => s.name));
    onMarkUnsaved();
  };

  // Effective Hole Parameters
  const effectiveHoleSize = formData.holeSize !== undefined
    ? formData.holeSize
    : (formData.itemCategory === "Hangtag" ? 4 : 0);
  const effectiveHolePos = (formData.holePosition || (formData.itemCategory === "Hangtag" ? "top-center" : "none")) as "top-center" | "top-left" | "top-right" | "left-center" | "right-center" | "none";
  const effectiveHoleOffset = formData.holeOffset ?? 6;

  // Live customer options from CRM store + fallback
  const customerComboboxOptions = React.useMemo<ComboboxItem[]>(() => {
    const fromStore: ComboboxItem[] = crmCustomers.map((c) => ({
      value: c.name,
      label: c.name,
      description: `STIR: ${c.tin} · ${c.contractNo} · ${c.paymentTerms}`,
      badge: c.status,
    }));
    const existingNames = new Set(fromStore.map((i) => i.value.toLowerCase()));
    MOCK_CUSTOMERS.forEach((mc) => {
      if (!existingNames.has(mc.toLowerCase())) {
        fromStore.push({
          value: mc,
          label: mc,
          description: "Verified CRM Client Account",
          badge: "Client",
        });
      }
    });
    return fromStore;
  }, [crmCustomers]);

  // Live warehouse stock lookup for currently selected substrate
  const selectedMaterialStock = React.useMemo(() => {
    const query = (
      formData.kashirovkaMode && formData.kashirovkaMode !== "none"
        ? formData.kashirovkaLayers?.[0]?.paperStock || "Coated Cardboard 300g/m²"
        : formData.paperStock || "Galerie Art Silk 150g/m²"
    ).toLowerCase();
    return warehouseStock.find(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        query.includes(item.name.toLowerCase()) ||
        (item.grammage && query.includes(`${item.grammage}g`))
    );
  }, [formData.paperStock, formData.kashirovkaMode, formData.kashirovkaLayers, warehouseStock]);

  // Array of proof photos
  const photos = React.useMemo(() => {
    if (formData.photoUrls && formData.photoUrls.length > 0) {
      return formData.photoUrls;
    }
    return formData.photoUrl ? [formData.photoUrl] : [];
  }, [formData.photoUrls, formData.photoUrl]);

  // Sync active photo index with carousel selection
  React.useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setActivePhotoIndex(carouselApi.selectedScrollSnap());
    };
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const handleRemovePhoto = (indexToRemove: number) => {
    const updated = photos.filter((_, idx) => idx !== indexToRemove);
    handleFieldChange("photoUrls", updated);
    handleFieldChange("photoUrl", updated[0] || "");
    onMarkUnsaved();
  };

  const addSize = () => {
    if (!newSize || !newSizeQty) return;
    const qty = parseInt(newSizeQty);
    if (isNaN(qty) || qty <= 0) return;
    
    handleSizesChange([
      ...sizes,
      { id: Date.now().toString(), size: newSize, quantity: qty }
    ]);
    
    setNewSize("");
    setNewSizeQty("");
  };

  const removeSize = (id: string) => {
    handleSizesChange(sizes.filter(s => s.id !== id));
  };

  const handleMilestoneStatusChange = (milestoneId: string, newStatus: any) => {
    const updated = (formData.milestones || []).map((m) =>
      m.id === milestoneId ? { ...m, status: newStatus } : m
    );
    handleFieldChange("milestones", updated);
  };

  const handleMilestoneAssign = (id: string, assignee: string) => {
    const updated = (formData.milestones || []).map((m) =>
      m.id === id ? { ...m, assignedTo: assignee } : m
    );
    handleFieldChange("milestones", updated);
  };

  const handleMilestoneRemove = (id: string) => {
    const updated = (formData.milestones || []).filter((m) => m.id !== id);
    handleFieldChange("milestones", updated);
  };

  const handleMilestoneAdd = (name: string, dept: string) => {
    const newM = {
      id: `m-custom-${Date.now()}`,
      name,
      department: dept || "General",
      status: "Pending" as const,
      assignedTo: "",
    };
    handleFieldChange("milestones", [...(formData.milestones || []), newM]);
  };

  const handleMilestonesReorder = (newMilestones: any[]) => {
    handleFieldChange("milestones", newMilestones);
  };

  const kashirovkaMode: KashirovkaMode = formData.kashirovkaMode || "none";
  const kashirovkaStrategy: KashirovkaImpositionStrategy =
    formData.kashirovkaStrategy || "split_half_sheet";
  const kashirovkaLayers: SubstrateLayer[] = React.useMemo(() => {
    if (kashirovkaMode === "none") return [];
    if (formData.kashirovkaLayers && formData.kashirovkaLayers.length > 0) {
      return formData.kashirovkaLayers;
    }
    return getDefaultKashirovkaLayers(kashirovkaMode, formData.paperStock, formData.coating);
  }, [kashirovkaMode, formData.kashirovkaLayers, formData.paperStock, formData.coating]);

  const kashirovkaTotals = React.useMemo(
    () =>
      calculateKashirovkaTotals(
        kashirovkaMode,
        kashirovkaLayers,
        formData.kashirovkaGlueGsm ?? 25
      ),
    [kashirovkaMode, kashirovkaLayers, formData.kashirovkaGlueGsm]
  );

  const handleKashirovkaModeChange = (mode: KashirovkaMode) => {
    handleFieldChange("kashirovkaMode", mode);
    if (mode === "none") {
      handleFieldChange("kashirovkaLayers", []);
      handleFieldChange("paperStock", "Coated Cardboard 300g/m²");
      if (formData.recipe === "OFFSET_KASHIROVKA_V1") {
        handleFieldChange("recipe", "OFFSET_STD_V1");
      }
    } else {
      const nextLayers = getDefaultKashirovkaLayers(
        mode,
        "Coated Cardboard 300g/m²",
        formData.coating
      );
      const totals = calculateKashirovkaTotals(
        mode,
        nextLayers,
        formData.kashirovkaGlueGsm ?? 25
      );
      handleFieldChange("kashirovkaLayers", nextLayers);
      if (!formData.kashirovkaStrategy) {
        handleFieldChange("kashirovkaStrategy", "split_half_sheet");
      }
      if (formData.kashirovkaGlueGsm === undefined) {
        handleFieldChange("kashirovkaGlueGsm", 25);
      }
      if (formData.kashirovkaMakeReadySheets === undefined) {
        handleFieldChange("kashirovkaMakeReadySheets", 50);
      }
      if (formData.kashirovkaCuringHours === undefined) {
        handleFieldChange("kashirovkaCuringHours", 12);
      }
      const layerGsmStr = nextLayers.map((l) => `${l.grammage}g`).join(" + ");
      const labelPrefix = mode === "triplex" ? "Triplex Kashirovka" : "Duplex Kashirovka";
      handleFieldChange(
        "paperStock",
        `${labelPrefix} ${totals.netPaperGsm}g/m² (${layerGsmStr} → ${totals.totalMountedGsm}g w/glue)`
      );
      handleFieldChange("recipe", "OFFSET_KASHIROVKA_V1");
      handleFieldChange("department", "Offset");

      // Ensure Kashirovka milestone exists in production tracker
      const existing = formData.milestones || [];
      const hasKash = existing.some((m) =>
        m.name.toLowerCase().includes("kashirovka") || m.name.toLowerCase().includes("кашировка")
      );
      if (!hasKash) {
        const nextMilestones = [...existing];
        const postPressIdx = nextMilestones.findIndex((m) => m.name === "Post-press");
        const kashMilestone = {
          id: `m-kash-${Date.now()}`,
          name: "Kashirovka & Press Curing (12h)",
          department: "Finishing",
          status: "Pending" as const,
          assignedTo: "A. Becker (Lamination)",
        };
        if (postPressIdx >= 0) {
          nextMilestones.splice(postPressIdx, 0, kashMilestone);
        } else {
          nextMilestones.push(kashMilestone);
        }
        handleFieldChange("milestones", nextMilestones);
      }
    }
    onMarkUnsaved();
  };

  const handleUpdateKashirovkaLayer = (
    layerId: string,
    patch: Partial<SubstrateLayer>
  ) => {
    const updated = kashirovkaLayers.map((layer) => {
      if (layer.id !== layerId) return layer;
      const merged = { ...layer, ...patch };
      if (patch.paperStock && patch.grammage === undefined) {
        merged.grammage = parseGrammageFromStock(patch.paperStock, layer.grammage);
      }
      return merged;
    });
    handleFieldChange("kashirovkaLayers", updated);
    const totals = calculateKashirovkaTotals(
      kashirovkaMode,
      updated,
      formData.kashirovkaGlueGsm ?? 25
    );
    const layerGsmStr = updated.map((l) => `${l.grammage}g`).join(" + ");
    const labelPrefix = kashirovkaMode === "triplex" ? "Triplex Kashirovka" : "Duplex Kashirovka";
    handleFieldChange(
      "paperStock",
      `${labelPrefix} ${totals.netPaperGsm}g/m² (${layerGsmStr} → ${totals.totalMountedGsm}g w/glue)`
    );
    onMarkUnsaved();
  };

  return (
    <>
      <FilePreviewDialog 
        isOpen={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile} 
      />
      <PantoneColorPickerModal
        isOpen={isPantoneModalOpen}
        onOpenChange={setIsPantoneModalOpen}
        onSelectColor={handleAddSpotStation}
      />
      {/* Top Document Status & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-card border border-border rounded-lg shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{t("status") || "Status"}:</span>
            <Select
              value={formData.status}
              onValueChange={(val: any) => handleFieldChange("status", val)}
            >
              <SelectTrigger
                className={cn(
                  "h-7 text-xs font-semibold rounded-full px-3 border shadow-2xs cursor-pointer transition-colors",
                  formData.status === "In Production" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  formData.status === "Delivered" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                  formData.status === "Draft" && "bg-muted text-muted-foreground border-border",
                  formData.status === "Pending" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Production">In Production</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Priority:</span>
            <Select
              value={formData.priority || "Normal"}
              onValueChange={(val: any) => handleFieldChange("priority", val)}
            >
              <SelectTrigger
                className={cn(
                  "h-7 text-xs font-semibold rounded-full px-3 border shadow-2xs cursor-pointer transition-colors",
                  formData.priority === "Urgent" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
                  formData.priority === "High" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  formData.priority === "Normal" && "bg-muted text-muted-foreground border-border"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:block h-4 w-px bg-border" />

          {/* Linked Work Order */}
          {formData.linkedWoId ? (
            <button
              type="button"
              onClick={() =>
                openTab({
                  id: formData.linkedWoId!,
                  title: `${formData.linkedWoId}: ${formData.product || "Work Order"}`,
                  type: "work-order",
                  module: "production",
                  isUnsaved: false,
                  activeLevel3Tab: "overview",
                  documentData: {
                    docNo: formData.linkedWoId,
                    customer: formData.customer,
                    product: formData.product,
                    quantity: formData.quantity,
                    unit: formData.unit,
                    status: "Active",
                    priority: formData.priority || "High",
                    orderType: "Production",
                    linkedOrderId: docNo,
                    pressMachine:
                      formData.department === "Flexo"
                        ? "Flexo Label Master 4C"
                        : "Heidelberg Speedmaster XL 106",
                    deadline: formData.deadline,
                    paperStock: formData.paperStock,
                    coating: formData.coating,
                    colorsConfig: formData.colorsConfig || dynamicColorNotation,
                    spotColors: formData.spotColors || spotColorItems.map((s) => s.name),
                    spotColorItems: formData.spotColorItems || spotColorItems,
                    frontColors: formData.frontColors || frontColors,
                    backColors: formData.backColors || backColors,
                    holeSize: effectiveHoleSize,
                    holePosition: effectiveHolePos,
                    holeOffset: effectiveHoleOffset,
                    kashirovkaMode: formData.kashirovkaMode,
                    kashirovkaStrategy: formData.kashirovkaStrategy,
                    kashirovkaLayers: formData.kashirovkaLayers,
                    kashirovkaGlueGsm: formData.kashirovkaGlueGsm,
                    kashirovkaMakeReadySheets: formData.kashirovkaMakeReadySheets,
                    kashirovkaCuringHours: formData.kashirovkaCuringHours,
                    priceTotal: formData.priceTotal,
                    currency: formData.currency,
                    responsible: formData.responsible,
                  },
                })
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
              title="Open linked Work Order"
            >
              <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
              <span>Linked WO:</span>
              <span className="font-mono font-semibold">{formData.linkedWoId}</span>
            </button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const newWoId = `WO-00${Math.floor(358 + Math.random() * 140)}`;
                handleFieldChange("linkedWoId", newWoId);
                handleFieldChange("status", "In Production");
                const estimatedSheets = Math.max(250, Math.ceil((formData.quantity || 1000) / 16) + 150);
                const multiplier =
                  formData.kashirovkaMode === "triplex"
                    ? 3
                    : formData.kashirovkaMode === "duplex"
                    ? 2
                    : 1;
                const stockQuery =
                  formData.kashirovkaMode && formData.kashirovkaMode !== "none"
                    ? formData.kashirovkaLayers?.[0]?.paperStock || "Coated Cardboard 300g/m²"
                    : formData.paperStock || "Galerie Art Silk 150g/m²";
                reserveStockForOrder(stockQuery, estimatedSheets * multiplier, newWoId);
                openTab({
                  id: newWoId,
                  title: `${newWoId}: ${formData.product || "Production Job"}`,
                  type: "work-order",
                  module: "production",
                  isUnsaved: true,
                  activeLevel3Tab: "overview",
                  documentData: {
                    docNo: newWoId,
                    customer: formData.customer,
                    product: formData.product,
                    quantity: formData.quantity,
                    unit: formData.unit,
                    status: "Active",
                    priority: formData.priority || "High",
                    orderType: "Production",
                    linkedOrderId: docNo,
                    pressMachine:
                      formData.department === "Flexo"
                        ? "Flexo Label Master 4C"
                        : "Heidelberg Speedmaster XL 106",
                    deadline: formData.deadline,
                    paperStock: formData.paperStock,
                    coating: formData.coating,
                    colorsConfig: formData.colorsConfig || dynamicColorNotation,
                    spotColors: formData.spotColors || spotColorItems.map((s) => s.name),
                    spotColorItems: formData.spotColorItems || spotColorItems,
                    frontColors: formData.frontColors || frontColors,
                    backColors: formData.backColors || backColors,
                    holeSize: effectiveHoleSize,
                    holePosition: effectiveHolePos,
                    holeOffset: effectiveHoleOffset,
                    kashirovkaMode: formData.kashirovkaMode,
                    kashirovkaStrategy: formData.kashirovkaStrategy,
                    kashirovkaLayers: formData.kashirovkaLayers,
                    kashirovkaGlueGsm: formData.kashirovkaGlueGsm,
                    kashirovkaMakeReadySheets: formData.kashirovkaMakeReadySheets,
                    kashirovkaCuringHours: formData.kashirovkaCuringHours,
                    priceTotal: formData.priceTotal,
                    currency: formData.currency,
                    responsible: formData.responsible,
                  },
                });
              }}
              className="h-7 px-2.5 text-xs font-medium gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
            >
              <Factory className="w-3.5 h-3.5" />
              <span>Create Work Order & Reserve Stock</span>
            </Button>
          )}
        </div>

        {/* Right Doc metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono ml-auto">
          <span>{t("docNo") || "Doc No"}: <strong className="text-foreground">{docNo}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 @7xl:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Main Details */}
        <div className="@container space-y-4 @7xl:col-span-2 min-w-0">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
        {/* Card 1: Order Photo & Sample Reference */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 flex flex-col min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">{t("sampleProofTitle")}</span>
              {photos.length > 0 && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {activePhotoIndex + 1}/{photos.length}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title={t("addPhoto")}
              onClick={() => document.getElementById("client-photo-add-input")?.click()}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 flex flex-col">
            {photos.length > 0 ? (
              <div className="relative group w-full flex-1 min-h-[156px] rounded overflow-hidden bg-muted/30 border border-border/80">
                <Carousel
                  setApi={setCarouselApi}
                  className="w-full h-full"
                  opts={{ loop: true }}
                >
                  <CarouselContent className="h-40 ml-0">
                    {photos.map((src, index) => (
                      <CarouselItem key={`${src}-${index}`} className="pl-0 h-40 relative flex items-center justify-center">
                        <img
                          src={src}
                          alt={`${t("sampleProofTitle")} ${index + 1}`}
                          className="w-full h-full object-contain select-none p-1"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  {photos.length > 1 && (
                    <>
                      <CarouselPrevious
                        variant="secondary"
                        size="icon-xs"
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/90 hover:bg-background shadow-xs border-border opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                      <CarouselNext
                        variant="secondary"
                        size="icon-xs"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/90 hover:bg-background shadow-xs border-border opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </>
                  )}
                </Carousel>

                {/* Hover Actions */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-foreground"
                    title={t("fullScreenView")}
                    onClick={() => {
                      handleFieldChange("photoUrl", photos[activePhotoIndex] || photos[0]);
                      onOpenLightbox();
                    }}
                  >
                    <Maximize2 className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-muted-foreground hover:text-destructive"
                    title={t("removePhoto")}
                    onClick={() => handleRemovePhoto(activePhotoIndex)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* Minimalist Floating Thumbnails */}
                {photos.length > 1 && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1 py-0.5 rounded bg-background/80 backdrop-blur-xs border border-border/60 shadow-2xs max-w-[90%] overflow-x-auto">
                    {photos.map((src, idx) => (
                      <button
                        type="button"
                        key={`thumb-client-${idx}`}
                        onClick={() => carouselApi?.scrollTo(idx)}
                        className={cn(
                          "relative shrink-0 w-6 h-6 rounded-[3px] overflow-hidden border transition-all cursor-pointer",
                          activePhotoIndex === idx
                            ? "border-primary opacity-100"
                            : "border-transparent opacity-50 hover:opacity-90"
                        )}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="border border-dashed border-border hover:border-muted-foreground/50 rounded-md p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/20 transition-colors flex-1 min-h-[156px]"
                onClick={() => document.getElementById("client-photo-add-input")?.click()}
              >
                <ImageIcon className="w-5 h-5 text-muted-foreground mb-1.5" />
                <p className="text-xs text-muted-foreground">{t("attachSamplePhoto")}</p>
              </div>
            )}

            <input
              type="file"
              id="client-photo-add-input"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const newUrls = Array.from(files).map((f) => URL.createObjectURL(f));
                  const updatedPhotos = [...photos, ...newUrls];
                  handleFieldChange("photoUrls", updatedPhotos);
                  if (!formData.photoUrl && newUrls[0]) {
                    handleFieldChange("photoUrl", newUrls[0]);
                  }
                  onMarkUnsaved();
                }
              }}
            />
          </div>
        </div>

        {/* Card 2: Order Requisites */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">Order Requisites</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">Customer & Order Data</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground font-medium block mb-1 text-xs">Customer</label>
              <SmartCombobox
                value={formData.customer}
                onChange={(val) => handleFieldChange("customer", val)}
                placeholder="Select or enter customer..."
                searchPlaceholder="Search customer by name, STIR or Contract..."
                allowCustom={true}
                options={customerComboboxOptions}
              />
            </div>
            <div>
              <label className="text-muted-foreground font-medium block mb-1 text-xs">Product</label>
              <Input 
                value={formData.product} 
                onChange={e => handleFieldChange("product", e.target.value)} 
                className="h-8 text-xs bg-muted/30 border-border" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1 text-xs">Total Quantity</label>
                <Input 
                  type="number" 
                  value={formData.quantity} 
                  onChange={e => handleFieldChange("quantity", Number(e.target.value))} 
                  className="h-8 text-xs bg-muted/30 border-border font-mono font-medium"
                  readOnly={sizes.length > 0} 
                  title={sizes.length > 0 ? "Calculated from Size Breakdown" : ""}
                />
              </div>
              <div>
                <label className="text-muted-foreground font-medium block mb-1 text-xs">Unit</label>
                <Select value={formData.unit} onValueChange={(val) => handleFieldChange("unit", val)}>
                  <SelectTrigger className="h-8 text-xs bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">pcs</SelectItem>
                    <SelectItem value="rolls">rolls</SelectItem>
                    <SelectItem value="sets">sets</SelectItem>
                    <SelectItem value="sheets">sheets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Card 3: Production Parameters */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">Production Route & Spec</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">BOM Specs</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-muted-foreground font-medium text-xs">Master Specification (Recipe)</label>
                <span className="text-[11px] text-muted-foreground font-mono">Catalog</span>
              </div>
              <SmartCombobox
                value={formData.recipe || "OFFSET_STD_V1"}
                onChange={(val) => {
                  handleFieldChange("recipe", val);
                  if (val === "OFFSET_KASHIROVKA_V1" && kashirovkaMode === "none") {
                    handleKashirovkaModeChange("duplex");
                  }
                }}
                searchPlaceholder="Search recipe code, technology or product..."
                options={[
                  { value: "OFFSET_STD_V1", label: "OFFSET_STD_V1 (Folding Carton)", description: "Coated board, 4-color offset, standard die-cut", badge: "Offset" },
                  { value: "OFFSET_KASHIROVKA_V1", label: "OFFSET_KASHIROVKA_V1 (Duplex/Triplex 600g+ Card)", description: "Multi-layer 300g+300g printed & mounted (Кашировка)", badge: "Kashirovka" },
                  { value: "OFFSET_PREM_V2", label: "OFFSET_PREM_V2 (Premium Booklet)", description: "Silk paper, Spot UV, saddle stitch", badge: "Offset" },
                  { value: "FLEXO_NYLON_V1", label: "FLEXO_NYLON_V1 (Taffeta / Nylon Tape)", description: "High-density ribbon, thermal wash care", badge: "Flexo" },
                  { value: "FLEXO_SATIN_V2", label: "FLEXO_SATIN_V2 (Woven Edge Satin)", description: "Double-sided satin, ultrasonic cold cut", badge: "Flexo" },
                  { value: "JACQ_WOVEN_V1", label: "JACQ_WOVEN_V1 (High-Def Damask)", description: "Taffeta base, lurex metallic yarns", badge: "Jacquard" },
                ]}
              />
            </div>

            <div>
              <label className="text-muted-foreground font-medium block mb-1 text-xs">Department / Technology</label>
              <SmartCombobox
                value={formData.department || "Flexo"}
                onChange={(val) => handleFieldChange("department", val)}
                searchPlaceholder="Select production department..."
                options={[
                  { value: "Offset", label: "Offset Lithography", description: "Sheetfed offset printing for paper & cartons", badge: "Sheets" },
                  { value: "Flexo", label: "Flexographic Printing", description: "Rotary web press for roll labels & tapes", badge: "Rolls" },
                  { value: "Jacquard", label: "Jacquard Weaving", description: "Woven fabric clothing labels and ribbons", badge: "Looms" },
                  { value: "Post-press", label: "Post-press & Finishing", description: "Die-cutting, folding, lamination, foiling", badge: "Finish" },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1 text-xs">Deadline</label>
                <DatePicker 
                  value={formData.deadline} 
                  onChange={(val) => handleFieldChange("deadline", val)} 
                  className="h-8 text-xs bg-muted/30 border-border" 
                />
              </div>
              <div>
                <label className="text-muted-foreground font-medium block mb-1 text-xs">Responsible Operator</label>
                <Input 
                  value={formData.responsible} 
                  readOnly 
                  className="h-8 text-xs bg-muted/20 border-border text-muted-foreground" 
                />
              </div>
            </div>
          </div>
        </div>

              </div>

          {/* Card 3: High-Level Technical Specifications & CAD Snapshot */}
          <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">
                  Technical specs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {formData.width || 50}×{formData.height || 90} {formData.dimensionUnit || "mm"}
                </Badge>
                {onSwitchTab && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSwitchTab("specs")}
                    className="h-6 px-2 text-[11px] text-primary hover:text-primary/90 hover:bg-primary/10 gap-1 cursor-pointer"
                  >
                    <span>Edit</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2 text-xs">
              {/* Dimensions */}
              <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Size
                </span>
                <p className="font-mono font-bold text-foreground text-sm">
                  {formData.width || 50} × {formData.height || 90} <span className="text-xs font-normal text-muted-foreground">{formData.dimensionUnit || "mm"}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Bleed {formData.bleed || 2}mm · {formData.cornerType || "Square"}
                </p>
              </div>

              {/* Substrate / Paper Stock */}
              <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Material
                </span>
                <p className="font-semibold text-foreground text-xs truncate" title={formData.paperStock}>
                  {formData.paperStock || "Not set"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {parseGrammageFromStock(formData.paperStock || "")} g/m²
                </p>
              </div>

              {/* Lamination & Surface Treatment */}
              <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>Lamination</span>
                </span>
                <p className="font-semibold text-foreground text-xs truncate" title={formData.lamination}>
                  {formData.lamination && formData.lamination !== "None" ? formData.lamination : "None"}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono">
                    {formData.laminationSides ? formData.laminationSides.toUpperCase() : "1S"}
                  </Badge>
                  <span>{formData.laminationMicron || 28}µm</span>
                  {formData.embellishment && formData.embellishment !== "None" && (
                    <span className="text-primary truncate font-medium">• {formData.embellishment}</span>
                  )}
                </div>
              </div>

              {/* Colors / Inks */}
              <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Colors
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-foreground text-sm">
                    {dynamicColorNotation}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {frontColors.c && <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block shadow-2xs" title="Cyan" />}
                    {frontColors.m && <span className="w-2 h-2 rounded-full bg-pink-500 inline-block shadow-2xs" title="Magenta" />}
                    {frontColors.y && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-2xs" title="Yellow" />}
                    {frontColors.k && <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-zinc-100 inline-block shadow-2xs" title="Black" />}
                    {spotColorItems.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 inline-block shadow-2xs" title={`+${spotColorItems.length} Spot`} />
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {spotColorItems.length > 0 ? `+${spotColorItems.length} Pantone` : "CMYK"}
                </p>
              </div>
            </div>

            {/* Kashirovka & Sizes Sub-row */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-muted/20 border border-border text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Mounting:</span>
                  <span className="font-medium text-foreground">
                    {kashirovkaMode !== "none" ? (
                      <Badge variant="outline" className="text-[10px] h-4.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300">
                        {kashirovkaTotals.totalMountedGsm} gsm · {kashirovkaTotals.estimatedCaliperMm} mm
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Sizes:</span>
                  <span className="font-medium text-foreground">
                    {sizes.length > 0 ? (
                      <span className="font-mono text-primary font-semibold">
                        {sizes.length} sizes ({sizes.reduce((a, s) => a + s.quantity, 0).toLocaleString()} {formData.unit})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Single batch ({formData.quantity.toLocaleString()} {formData.unit})</span>
                    )}
                  </span>
                </div>
              </div>

              {onSwitchTab && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSwitchTab("specs")}
                  className="h-7 text-xs gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Open die-line</span>
                </Button>
              )}
            </div>
          </div>

          {/* Card 4: Quick Attached Files Snapshot */}
          <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">
                  Files ({orderAttachments.length})
                </span>
              </div>
              {onSwitchTab && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSwitchTab("files")}
                  className="h-6 px-2 text-[11px] text-primary hover:text-primary/90 hover:bg-primary/10 gap-1 cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Quick file chips list */}
            {orderAttachments.length > 0 ? (
              <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-2">
                {orderAttachments.slice(0, 3).map((file) => {
                  const fKind = getFileKind(file);
                  const fMeta = FILE_KIND_ICON[fKind];
                  const Icon = fMeta.icon;
                  return (
                    <div
                      key={file.id}
                      onClick={() => onSwitchTab?.("files")}
                      className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs"
                    >
                      <div className="w-6 h-6 rounded bg-background border border-border flex items-center justify-center shrink-0">
                        <Icon className={cn("w-3.5 h-3.5", fMeta.className)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate text-[11px]">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{file.size}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No files attached.</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Pre-Flight Readiness, Production Route Card & Commercial Summary */}
        <div className="grid grid-cols-1 @3xl:grid-cols-2 @7xl:grid-cols-1 gap-4 content-start">
          <OrderReadinessRouteCard
            workOrderId={formData.linkedWoId || docNo}
            fallbackData={{
              customer: formData.customer,
              product: formData.product,
              department: formData.department,
              quantity: formData.quantity,
              deadline: formData.deadline,
            }}
          />

          {/* Commercial & Contract Terms Card */}
          <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">Commercial Pricing & Terms</span>
              </div>
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Verified CRM Order
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 bg-muted/30 rounded-md border border-border font-mono text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">Target Quantity:</span>
                  <span className="text-foreground font-medium">{formData.quantity?.toLocaleString()} {formData.unit}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">Unit Estimated Price:</span>
                  <span className="text-foreground font-medium">
                    ${(formData.priceTotal && formData.quantity ? (formData.priceTotal / formData.quantity).toFixed(3) : "0.00")} {formData.currency}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">VAT / Sales Tax (12%):</span>
                  <span className="text-foreground font-medium">
                    ${((formData.priceTotal || 0) * 0.12).toFixed(2)} {formData.currency}
                  </span>
                </div>
                <div className="h-px bg-border my-1.5" />
                <div className="flex justify-between items-baseline font-bold">
                  <span className="text-foreground font-sans">Document Total:</span>
                  <span className="text-primary font-semibold text-sm font-mono">
                    ${formData.priceTotal?.toLocaleString("en-US")} {formData.currency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-border">
                <div>Terms: <span className="font-semibold text-foreground">Net 30</span></div>
                <div>Account: <span className="font-semibold text-primary font-mono truncate">{formData.customer?.slice(0, 10) || "CRM Client"}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
