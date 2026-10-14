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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
import { Switch } from "@/components/ui/switch";
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
  parseGrammageFromStock,
  getDefaultKashirovkaLayers,
  calculateKashirovkaTotals,
} from "../types";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";
import { OrderReadinessRouteCard } from "@/components/documents/work-order/OrderReadinessRouteCard";
import { DieLinePreview } from "@/components/documents/work-order/DieLinePreview";
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
}: Props) {
  const t = useTranslations("ClientOrder");
  const { crmCustomers, warehouseStock, openTab, reserveStockForOrder } = useWorkspaceStore();
  const [newSize, setNewSize] = useState("");
  const [newSizeQty, setNewSizeQty] = useState("");
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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
      <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">{t("status") || "Status"}:</span>
            <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-300">
              {formData.status}
            </Badge>
          </div>
          {formData.linkedWoId ? (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">Linked WO:</span>
              <Badge
                variant="outline"
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
                className="h-6 text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800 cursor-pointer hover:bg-blue-100"
              >
                {formData.linkedWoId} ↗
              </Badge>
            </div>
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
              className="h-6 px-2 text-[11px] font-medium gap-1 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
            >
              <Factory className="w-3 h-3" />
              <span>Create Work Order & Reserve Stock</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
          <span>{t("docNo") || "Doc No"}: <strong className="text-zinc-800 dark:text-zinc-200">{docNo}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Main Details */}
        <div className="space-y-4 md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Order Photo & Sample Reference */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{t("sampleProofTitle")}</span>
              {photos.length > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  {activePhotoIndex + 1}/{photos.length}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              title={t("addPhoto")}
              onClick={() => document.getElementById("client-photo-add-input")?.click()}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 flex flex-col">
            {photos.length > 0 ? (
              <div className="relative group w-full flex-1 min-h-[156px] rounded overflow-hidden bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/80">
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
                    size="icon-xs"
                    variant="secondary"
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-zinc-600 dark:text-zinc-300"
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
                    size="icon-xs"
                    variant="secondary"
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-zinc-500 hover:text-red-600"
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
                            ? "border-blue-600 opacity-100"
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
                className="border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 rounded p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-50/40 dark:bg-zinc-950/30 transition-colors flex-1 min-h-[156px]"
                onClick={() => document.getElementById("client-photo-add-input")?.click()}
              >
                <ImageIcon className="w-4 h-4 text-zinc-400 mb-1.5" />
                <p className="text-xs text-zinc-500">{t("attachSamplePhoto")}</p>
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

        {/* Order Requisites */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <FileText className="w-4 h-4 text-blue-600" />
            Order Requisites
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-zinc-500 font-medium block mb-1 text-xs">Customer</label>
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
              <label className="text-zinc-500 font-medium block mb-1">Product</label>
              <Input value={formData.product} onChange={e => handleFieldChange("product", e.target.value)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Total Quantity</label>
                <Input 
                  type="number" 
                  value={formData.quantity} 
                  onChange={e => handleFieldChange("quantity", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                  readOnly={sizes.length > 0} 
                  title={sizes.length > 0 ? "Calculated from Size Breakdown" : ""}
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Unit</label>
                <Select value={formData.unit} onValueChange={(val) => handleFieldChange("unit", val)}>
                  <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"><SelectValue /></SelectTrigger>
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
        
        {/* Production Parameters */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Factory className="w-4 h-4 text-blue-600" />
            <span>Production Parameters</span>
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-500 font-medium text-xs">Master Specification (Recipe)</label>
                <span className="text-[10px] text-muted-foreground font-mono">BOM Catalog</span>
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
              <label className="text-zinc-500 font-medium block mb-1 text-xs">Department / Technology</label>
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
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Deadline</label>
                <DatePicker value={formData.deadline} onChange={(val) => handleFieldChange("deadline", val)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Responsible Operator</label>
                <Input value={formData.responsible} readOnly className="h-8 text-xs bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Card: Size / Variation Breakdown */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-600" />
              <span>Size Breakdown</span>
            </h3>
            <span className="text-[10px] text-muted-foreground font-normal">
              For apparel, cards, stickers
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Add Size Form */}
            <div className="flex items-end gap-2 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Size / Variation</label>
                <Input 
                  value={newSize} 
                  onChange={(e) => setNewSize(e.target.value)} 
                  placeholder="e.g. S, M, XL, 42" 
                  className="h-7 text-xs bg-white dark:bg-zinc-900"
                  onKeyDown={(e) => e.key === 'Enter' && addSize()}
                />
              </div>
              <div className="w-24">
                <label className="text-[10px] uppercase font-semibold text-zinc-500 mb-0.5 block">Quantity</label>
                <Input 
                  type="number"
                  value={newSizeQty} 
                  onChange={(e) => setNewSizeQty(e.target.value)} 
                  placeholder="0" 
                  className="h-7 text-xs bg-white dark:bg-zinc-900"
                  onKeyDown={(e) => e.key === 'Enter' && addSize()}
                />
              </div>
              <Button onClick={addSize} type="button" size="sm" className="h-7 px-2.5 gap-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            {/* Sizes List */}
            {sizes.length > 0 ? (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden max-h-[160px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">Size</th>
                      <th className="px-2.5 py-1.5 font-medium w-24 text-right">Quantity</th>
                      <th className="px-2.5 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="px-2.5 py-1.5 font-medium">{item.size}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">{item.quantity.toLocaleString()}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <button 
                            type="button" 
                            onClick={() => removeSize(item.id)}
                            className="text-zinc-400 hover:text-red-500 p-0.5 rounded transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 font-semibold sticky bottom-0">
                    <tr>
                      <td className="px-2.5 py-1.5 text-right">Total:</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">
                        {sizes.reduce((acc, s) => acc + s.quantity, 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-5 text-zinc-400 text-xs italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-md">
                No size breakdown specified. Using total order quantity.
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Physical Item Specifications */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>Physical Specifications</span>
            </h3>
            <div className="flex items-center gap-1.5">
              {kashirovkaMode !== "none" && (
                <Badge variant="outline" className="font-mono text-[10px] bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 shadow-none">
                  {kashirovkaTotals.netPaperGsm}g ({kashirovkaTotals.totalMountedGsm}g/m² · {kashirovkaTotals.estimatedCaliperMm}mm)
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shadow-none">
                {formData.width || 50} × {formData.height || 90} {formData.dimensionUnit || "mm"}
              </Badge>
            </div>
          </div>

          <div className="space-y-2.5">
              {/* Quick Format Presets in a clean, compact dropdown combobox */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Format Preset:</span>
              </div>
              <div className="w-48">
                <SmartCombobox
                  value=""
                  placeholder="⚡ Quick Size Preset..."
                  searchPlaceholder="Search format or size (e.g. 50x90, card)..."
                  onChange={(val) => {
                    const presetMap: Record<string, { w: number; h: number; cat: string }> = {
                      "hangtag_50x90": { w: 50, h: 90, cat: "Hangtag" },
                      "card_85x55": { w: 85, h: 55, cat: "Card" },
                      "label_30x70": { w: 30, h: 70, cat: "Label" },
                      "sticker_50x50": { w: 50, h: 50, cat: "Sticker" },
                      "a6_105x148": { w: 105, h: 148, cat: "Card" },
                      "a5_148x210": { w: 148, h: 210, cat: "Card" },
                      "ribbon_25x100": { w: 25, h: 100, cat: "Jacquard Ribbon" },
                      "circle_40x40": { w: 40, h: 40, cat: "Sticker" },
                    };
                    const p = presetMap[val];
                    if (p) {
                      handleFieldChange("width", p.w);
                      handleFieldChange("height", p.h);
                      handleFieldChange("itemCategory", p.cat);
                    }
                  }}
                  options={[
                    { value: "hangtag_50x90", label: "Hangtag 50×90 mm", description: "Standard clothing retail tag", badge: "Retail" },
                    { value: "card_85x55", label: "Business Card 85×55 mm", description: "Standard ISO business card", badge: "Card" },
                    { value: "label_30x70", label: "Care Label 30×70 mm", description: "Apparel satin wash care label", badge: "Textile" },
                    { value: "sticker_50x50", label: "Square Sticker 50×50 mm", description: "Die-cut adhesive label", badge: "Adhesive" },
                    { value: "circle_40x40", label: "Round Sticker Ø 40 mm", description: "Circular sealing sticker", badge: "Round" },
                    { value: "a6_105x148", label: "Postcard / A6 105×148 mm", description: "Box insert / promotional card", badge: "Paper" },
                    { value: "a5_148x210", label: "Flyer / A5 148×210 mm", description: "Instruction sheet or booklet cover", badge: "Paper" },
                    { value: "ribbon_25x100", label: "Jacquard Ribbon 25×100 mm", description: "Woven branding ribbon", badge: "Woven" },
                  ]}
                />
              </div>
            </div>

            {/* Product Type / Category */}
            <div>
              <label className="text-zinc-500 font-medium block mb-1 text-xs">Product Format / Type</label>
              <SmartCombobox
                value={formData.itemCategory || "Hangtag"}
                onChange={(val) => handleFieldChange("itemCategory", val)}
                searchPlaceholder="Select or type custom product format..."
                allowCustom={true}
                options={[
                  { value: "Hangtag", label: "Hangtag (Clothing / Retail Tag)", description: "Punched hole, string attached retail tag" },
                  { value: "Label", label: "Label (Self-adhesive / Woven / Care)", description: "Product identification & wash instructions" },
                  { value: "Card", label: "Card (Business / Insert / Postcard)", description: "Heavy board promotional card" },
                  { value: "Sticker", label: "Sticker (Vinyl / Paper Die-cut)", description: "Self-adhesive roll or sheet sticker" },
                  { value: "Jacquard Ribbon", label: "Jacquard Ribbon (Woven band)", description: "High-definition loom woven tape" },
                  { value: "Carton", label: "Carton Box (Folding packaging)", description: "Creased and folded product packaging" },
                  { value: "Sleeve", label: "Packaging Sleeve (Belly band)", description: "Wraparound belly band for boxes" },
                ]}
              />
            </div>

            {/* Dimensions Grid (W, H, Unit) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Width ({formData.dimensionUnit || "mm"})</label>
                <Input 
                  type="number" 
                  value={formData.width ?? 50} 
                  onChange={(e) => handleFieldChange("width", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Height ({formData.dimensionUnit || "mm"})</label>
                <Input 
                  type="number" 
                  value={formData.height ?? 90} 
                  onChange={(e) => handleFieldChange("height", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Unit</label>
                <Select 
                  value={formData.dimensionUnit || "mm"} 
                  onValueChange={(val) => handleFieldChange("dimensionUnit", val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cutting, Shape & Bleed */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Cut / Finish</label>
                <SmartCombobox
                  value={formData.cornerType || "Square"}
                  onChange={(val) => handleFieldChange("cornerType", val)}
                  searchPlaceholder="Search finish / corner type..."
                  allowCustom={true}
                  options={[
                    { value: "Square", label: "Square Cut", description: "Standard 90° guillotine cut" },
                    { value: "Rounded (R3)", label: "Round Corners (R3)", description: "3mm radius rounded corners" },
                    { value: "Rounded (R5)", label: "Round Corners (R5)", description: "5mm radius rounded corners" },
                    { value: "Die-cut", label: "Die-cut Contour", description: "Custom steel rule contour shape" },
                    { value: "Center Fold", label: "Center Fold (Loop)", description: "Folded in half for sewing in seam" },
                    { value: "End Fold", label: "End Fold (Booklet)", description: "Both edges folded inward" },
                    { value: "Miter Fold", label: "Miter Fold (Hanger)", description: "V-shaped neck hanger fold" },
                  ]}
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Bleed (mm)</label>
                <Input 
                  type="number" 
                  value={formData.bleed ?? 2} 
                  onChange={(e) => handleFieldChange("bleed", Number(e.target.value))} 
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
            </div>

            {/* Paper Stock & Coating - Connected to Live Warehouse Stock */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-500 font-medium text-xs">Paper / Substrate Stock</label>
                  {selectedMaterialStock && (
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.2 rounded border",
                        selectedMaterialStock.status === "In Stock"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      )}
                      title={`Ombor joylashuvi: ${selectedMaterialStock.location} | Band qilingan: ${selectedMaterialStock.reserved.toLocaleString()} ${selectedMaterialStock.unit}`}
                    >
                      Ombor: {selectedMaterialStock.available.toLocaleString()} {selectedMaterialStock.unit}
                    </span>
                  )}
                </div>
                {kashirovkaMode !== "none" ? (
                  <div className="h-8 px-2.5 rounded-md border border-amber-300/70 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-mono font-semibold text-amber-900 dark:text-amber-200 truncate" title={t("kashirovkaManagedNotice")}>
                        {kashirovkaMode === "triplex" ? "3-Ply Triplex" : "2-Ply Duplex"} · {kashirovkaTotals.netPaperGsm}g ({kashirovkaTotals.totalMountedGsm}g/m²)
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-background/80 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 shrink-0">
                      ~{kashirovkaTotals.estimatedCaliperMm}mm
                    </Badge>
                  </div>
                ) : (
                  <SmartCombobox
                    value={formData.paperStock || "Galerie Art Silk 150g/m²"}
                    onChange={(val) => {
                      if (val.startsWith("Duplex Kashirovka")) {
                        handleKashirovkaModeChange("duplex");
                      } else if (val.startsWith("Triplex Kashirovka")) {
                        handleKashirovkaModeChange("triplex");
                      } else {
                        handleFieldChange("paperStock", val);
                      }
                    }}
                    searchPlaceholder="Search substrate, density or warehouse stock..."
                    allowCustom={true}
                    options={[
                      ...warehouseStock
                        .filter((s) => s.category === "Paper & Board" || s.category === "Roll & Label")
                        .map((s) => ({
                          value: s.name,
                          label: s.name,
                          description: `Bo'sh qoldiq: ${s.available.toLocaleString()} ${s.unit} (Band: ${s.reserved.toLocaleString()}) · ${s.location}`,
                          badge: `${s.available.toLocaleString()} ${s.unit}`,
                        })),
                      { value: "Duplex Kashirovka 600g/m² (300g + 300g)", label: "Duplex Kashirovka 600g/m² (2×300g)", description: "Front & Back printed separately & mounted", badge: "600g+" },
                      { value: "Triplex Kashirovka 900g/m² (300g+300g+300g)", label: "Triplex Kashirovka 900g/m² (3×300g)", description: "3-layer sandwich board with colored core", badge: "900g+" },
                    ]}
                  />
                )}
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Surface Coating / Finish</label>
                <SmartCombobox
                  value={formData.coating || "Soft-Touch Matte + Spot UV"}
                  onChange={(val) => handleFieldChange("coating", val)}
                  searchPlaceholder="Search coating, varnish, foil..."
                  allowCustom={true}
                  options={[
                    { value: "None / Uncoated", label: "None / Uncoated", description: "Raw natural paper surface" },
                    { value: "Matte Lamination (1S)", label: "Matte Lamination (1S)", description: "1-sided scratch-resistant matte film" },
                    { value: "Gloss Lamination (1S)", label: "Gloss Lamination (1S)", description: "1-sided high-shine protective film" },
                    { value: "Soft-Touch Matte + Spot UV", label: "Soft-Touch Matte + Spot UV", description: "Velvet touch film with raised gloss UV" },
                    { value: "Overall Water-based Matte Varnish", label: "Overall WB Matte Varnish", description: "Machine seal coating against rub" },
                    { value: "Gold Hot Foil Stamping", label: "Gold Hot Foil Stamping", description: "Metallic foil block embossed" },
                    { value: "Silver Hot Foil Stamping", label: "Silver Hot Foil Stamping", description: "Brilliant silver chrome foil" },
                    { value: "Blind Embossing / Debossing", label: "Blind Embossing / Debossing", description: "Raised 3D relief without ink" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Standalone Card: 2D Die-Line & Dimension Inspector */}
        <DieLinePreview
          width={Number(formData.width) || 50}
          height={Number(formData.height) || 90}
          bleed={Number(formData.bleed) ?? 2}
          dimensionUnit={formData.dimensionUnit || "mm"}
          cornerType={formData.cornerType || "Square"}
          itemCategory={formData.itemCategory || "Hangtag"}
          onFlipOrientation={() => {
            const currentW = formData.width || 50;
            const currentH = formData.height || 90;
            handleFieldChange("width", currentH);
            handleFieldChange("height", currentW);
          }}
        />

        {/* Dedicated Card: Multi-Layer Substrate & Kashirovka (Duplex / Triplex Mounting) */}
        <div
          className={cn(
            "md:col-span-2 p-3 bg-white dark:bg-zinc-900 border rounded-md transition-colors",
            kashirovkaMode !== "none"
              ? "border-amber-300/80 dark:border-amber-800/70 space-y-3"
              : "border-zinc-200 dark:border-zinc-800"
          )}
        >
          {/* Card Header with Master Switch & Segmented Ply Selector */}
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2",
              kashirovkaMode !== "none" && "pb-2.5 border-b border-zinc-100 dark:border-zinc-800"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center shrink-0 border",
                  kashirovkaMode !== "none"
                    ? "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                    : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-400"
                )}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    {t("kashirovkaTitle")}
                  </h3>
                  {kashirovkaMode !== "none" && (
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shadow-none"
                    >
                      {t("kashirovkaNetGsm")}: {kashirovkaTotals.netPaperGsm}g · {t("kashirovkaTotalGsm")}: {kashirovkaTotals.totalMountedGsm}g/m² (~{kashirovkaTotals.estimatedCaliperMm}mm)
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {t("kashirovkaCardDesc")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Subtle Segmented Control for 2-Ply vs 3-Ply (only visible when Kashirovka is ON) */}
              {kashirovkaMode !== "none" && (
                <div className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-700/70">
                  <button
                    type="button"
                    onClick={() => handleKashirovkaModeChange("duplex")}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                      kashirovkaMode === "duplex"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    )}
                  >
                    {t("kashirovkaDuplex")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKashirovkaModeChange("triplex")}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                      kashirovkaMode === "triplex"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    )}
                  >
                    {t("kashirovkaTriplex")}
                  </button>
                </div>
              )}

              {/* Primary Activation Switch */}
              <div className="flex items-center gap-1.5 pl-1">
                <Switch
                  checked={kashirovkaMode !== "none"}
                  onCheckedChange={(checked) =>
                    handleKashirovkaModeChange(checked ? "duplex" : "none")
                  }
                />
              </div>
            </div>
          </div>

          {/* Expanded Workspace Body when Kashirovka is Active */}
          {kashirovkaMode !== "none" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-0.5">
              {/* LEFT SIDE (7 cols): Multi-Layer Sandwich Stack Builder */}
              <div className="lg:col-span-7 space-y-1.5">
                {kashirovkaLayers.map((layer, idx) => {
                  const roleTitle =
                    layer.role === "top_liner"
                      ? t("kashirovkaLayerTop")
                      : layer.role === "core_board"
                        ? t("kashirovkaLayerCore")
                        : `${idx + 1}. ${t("kashirovkaLayerBottom")}`;
                  return (
                    <React.Fragment key={layer.id}>
                      {idx > 0 && (
                        <div className="flex items-center gap-2 px-3 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-400">
                          <div className="h-2.5 border-l-2 border-dashed border-amber-400 dark:border-amber-600 ml-1" />
                          <span>+ PVA Glue ({formData.kashirovkaGlueGsm ?? 25} g/m²)</span>
                        </div>
                      )}
                      <div className="p-2 rounded-md bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/90 dark:border-zinc-800 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center",
                                layer.role === "top_liner"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : layer.role === "core_board"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                              )}
                            >
                              L{idx + 1}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                              {roleTitle}
                            </span>
                          </div>

                          {/* Quick 1-Click Color Mode Pills (4+0 | 1+0 | 0+0) */}
                          <div className="inline-flex items-center bg-zinc-200/70 dark:bg-zinc-900 p-0.5 rounded border border-zinc-300/60 dark:border-zinc-800">
                            {(["4+0", "1+0", "0+0"] as const).map((colorMode) => (
                              <button
                                key={colorMode}
                                type="button"
                                onClick={() =>
                                  handleUpdateKashirovkaLayer(layer.id, {
                                    colors: colorMode,
                                  })
                                }
                                className={cn(
                                  "px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono transition-colors cursor-pointer",
                                  layer.colors === colorMode
                                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                                )}
                                title={
                                  colorMode === "4+0"
                                    ? "Full CMYK 4+0"
                                    : colorMode === "1+0"
                                      ? "1-Color / Pantone 1+0"
                                      : "Unprinted 0+0"
                                }
                              >
                                {colorMode}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 items-center">
                          <div className="col-span-9">
                            <SmartCombobox
                              value={layer.paperStock}
                              onChange={(val) =>
                                handleUpdateKashirovkaLayer(layer.id, {
                                  paperStock: val,
                                })
                              }
                              searchPlaceholder="Select layer board..."
                              allowCustom={true}
                              options={[
                                {
                                  value: "Coated Cardboard 300g/m²",
                                  label: "Coated Cardboard 300g/m²",
                                  description: "Max press board (SBB/GZ)",
                                  badge: "300g",
                                },
                                {
                                  value: "Coated Cardboard 250g/m²",
                                  label: "Coated Cardboard 250g/m²",
                                  description: "Medium coated board",
                                  badge: "250g",
                                },
                                {
                                  value: "Kraft Board Brown 280g/m²",
                                  label: "Kraft Board Brown 280g/m²",
                                  description: "Natural kraft liner",
                                  badge: "280g",
                                },
                                {
                                  value: "Colorplan Ebony Black Core 300g/m²",
                                  label: "Colorplan Ebony 300g/m²",
                                  description: "Dyed black seam filler board",
                                  badge: "Core",
                                },
                                {
                                  value: "Galerie Art Silk 150g/m²",
                                  label: "Galerie Art Silk 150g/m²",
                                  description: "Coated silk liner",
                                  badge: "150g",
                                },
                              ]}
                            />
                          </div>
                          <div className="col-span-3 relative">
                            <Input
                              type="number"
                              value={layer.grammage}
                              onChange={(e) =>
                                handleUpdateKashirovkaLayer(layer.id, {
                                  grammage: Number(e.target.value),
                                })
                              }
                              className="h-8 pr-6 text-xs font-mono font-semibold bg-white dark:bg-zinc-900"
                              title="Layer Grammage (g/m²)"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 pointer-events-none">
                              g
                            </span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Quick Add / Remove 3rd Inner Core Layer Button */}
                <button
                  type="button"
                  onClick={() =>
                    handleKashirovkaModeChange(
                      kashirovkaMode === "duplex" ? "triplex" : "duplex"
                    )
                  }
                  className="w-full py-1.5 px-2.5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-600 text-[11px] font-medium text-zinc-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {kashirovkaMode === "duplex" ? (
                    <span>{t("kashirovkaAddCoreLayer")}</span>
                  ) : (
                    <span>{t("kashirovkaRemoveCoreLayer")}</span>
                  )}
                </button>
              </div>

              {/* RIGHT SIDE (5 cols): Imposition Strategy Cards & Technological Norms */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 bg-zinc-50/70 dark:bg-zinc-950/50 p-2.5 rounded-md border border-zinc-200/80 dark:border-zinc-800">
                <div className="space-y-2">
                  <label className="text-zinc-500 dark:text-zinc-400 font-semibold block text-[11px]">
                    {t("kashirovkaStrategyLabel")}
                  </label>

                  {/* Interactive 2-Card Strategy Selector (replaces raw SelectValue) */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleFieldChange("kashirovkaStrategy", "split_half_sheet")
                      }
                      className={cn(
                        "w-full text-left p-2 rounded-md border transition-all cursor-pointer flex items-start justify-between gap-2",
                        kashirovkaStrategy === "split_half_sheet"
                          ? "bg-white dark:bg-zinc-900 border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/20"
                          : "bg-white/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                          {t("kashirovkaStrategySplitShort")}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                          {t("kashirovkaStrategySplit")}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[9px] h-4 px-1 shrink-0",
                          kashirovkaStrategy === "split_half_sheet"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                            : "text-zinc-400"
                        )}
                      >
                        1× CTP
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleFieldChange("kashirovkaStrategy", "separate_sheets")
                      }
                      className={cn(
                        "w-full text-left p-2 rounded-md border transition-all cursor-pointer flex items-start justify-between gap-2",
                        kashirovkaStrategy === "separate_sheets"
                          ? "bg-white dark:bg-zinc-900 border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/20"
                          : "bg-white/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                          {t("kashirovkaStrategySeparateShort")}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                          {t("kashirovkaStrategySeparate")}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[9px] h-4 px-1 shrink-0",
                          kashirovkaStrategy === "separate_sheets"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                            : "text-zinc-400"
                        )}
                      >
                        2× CTP
                      </Badge>
                    </button>
                  </div>
                </div>

                {/* Glue, Make-Ready & Curing Pause Inputs */}
                <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5 truncate" title={t("kashirovkaGlueLabel")}>
                        {t("kashirovkaGlueLabel")}
                      </label>
                      <Input
                        type="number"
                        value={formData.kashirovkaGlueGsm ?? 25}
                        onChange={(e) =>
                          handleFieldChange("kashirovkaGlueGsm", Number(e.target.value))
                        }
                        className="h-7 text-xs font-mono bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5 truncate" title={t("kashirovkaMakeReadyLabel")}>
                        {t("kashirovkaMakeReadyLabel")}
                      </label>
                      <Input
                        type="number"
                        value={formData.kashirovkaMakeReadySheets ?? 50}
                        onChange={(e) =>
                          handleFieldChange(
                            "kashirovkaMakeReadySheets",
                            Number(e.target.value)
                          )
                        }
                        className="h-7 text-xs font-mono bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5 truncate" title={t("kashirovkaCuringLabel")}>
                        {t("kashirovkaCuringLabel")}
                      </label>
                      <Input
                        type="number"
                        value={formData.kashirovkaCuringHours ?? 12}
                        onChange={(e) =>
                          handleFieldChange(
                            "kashirovkaCuringHours",
                            Number(e.target.value)
                          )
                        }
                        className="h-7 text-xs font-mono bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>

                  {/* Technical Side-Lay Notice */}
                  <div className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-800/70 rounded px-2 py-1 leading-snug">
                    {t("kashirovkaSideLayNotice")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>



        {/* Card: Attached Files & Technical Documents */}
        <div className="md:col-span-2 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 flex flex-col">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <span>Attached Files & Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono shadow-none">
                {orderAttachments.length} file{orderAttachments.length === 1 ? "" : "s"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 gap-1 rounded cursor-pointer"
                onClick={() => document.getElementById("client-doc-upload-input")?.click()}
              >
                <Plus className="w-3 h-3 text-blue-600" />
                <span>Attach</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {orderAttachments.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col gap-1.5">
                {orderAttachments.map((file) => {
                  const fKind = getFileKind(file);
                  const fMeta = FILE_KIND_ICON[fKind];
                  const Icon = fMeta.icon;
                  const isLinkable = isPreviewable(file);

                  return (
                    <Attachment 
                      key={file.id} 
                      size="sm" 
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors shadow-none",
                        isLinkable && "cursor-pointer"
                      )}
                      onClick={isLinkable ? () => setPreviewFile(file) : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <AttachmentMedia variant={file.isImage ? "image" : "icon"} className="w-7 h-7 rounded shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                          <Icon className={cn("w-3.5 h-3.5", fMeta.className)} />
                        </AttachmentMedia>
                        <AttachmentContent className="min-w-0 flex-1">
                          <AttachmentTitle className={cn("text-xs font-medium truncate block text-zinc-900 dark:text-zinc-100", isLinkable && "hover:underline hover:text-blue-600 dark:hover:text-blue-400")}>{file.name}</AttachmentTitle>
                          <AttachmentDescription className="text-[10px] text-zinc-500 block">
                            {file.size} • {file.type} {file.date ? `• ${file.date}` : ""}
                          </AttachmentDescription>
                        </AttachmentContent>
                      </div>
                      <AttachmentActions className="shrink-0 ml-2 flex items-center gap-1">
                        {file.url && (
                          <AttachmentAction 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(file);
                            }}
                            className="h-6 w-6 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded cursor-pointer"
                            title="Download document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </AttachmentAction>
                        )}
                        <AttachmentAction 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderAttachments(prev => prev.filter(f => f.id !== file.id));
                            onMarkUnsaved();
                          }}
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive text-zinc-400 rounded cursor-pointer"
                          title="Remove attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  );
                })}
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-md p-6 text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-blue-50/30 transition-all flex-1 flex flex-col items-center justify-center min-h-[140px]"
                onClick={() => document.getElementById("client-doc-upload-input")?.click()}
              >
                <UploadCloud className="w-6 h-6 text-zinc-400 mb-1.5" />
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No attachments linked yet</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Click to attach vector die-lines, contracts, or customer specifications</p>
              </div>
            )}

            <input 
              type="file" 
              id="client-doc-upload-input" 
              className="hidden" 
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const newFiles = Array.from(e.target.files).map((f, i) => ({
                    id: `att-client-${Date.now()}-${i}`,
                    name: f.name,
                    size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
                    type: f.type || "Document",
                    date: new Date().toISOString().slice(0, 16).replace("T", " "),
                    isImage: f.type.startsWith("image/"),
                  }));
                  setOrderAttachments(prev => [...prev, ...newFiles]);
                  onMarkUnsaved();
                }
              }} 
            />
          </div>
        </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Pre-Flight Readiness & Production Route Card */}
        <div className="md:col-span-1 space-y-4">
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
        </div>
      </div>
    </>
  );
}
