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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartCombobox, ComboboxItem } from "@/components/ui/smart-combobox";
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
import { ClientOrderFormData, SizeDistribution, OrderAttachment, MOCK_CUSTOMERS } from "../types";
import { cn } from "@/lib/utils";
import { VerticalTaskTracker } from "@/components/ui/vertical-task-tracker";
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
  const [newSize, setNewSize] = useState("");
  const [newSizeQty, setNewSizeQty] = useState("");
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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
              <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-100">
                {formData.linkedWoId}
              </Badge>
            </div>
          ) : (
            <div className="text-zinc-400 italic text-[11px]">No Linked Work Order</div>
          )}
        </div>
        <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
          <span>{t("docNo") || "Doc No"}: <strong className="text-zinc-800 dark:text-zinc-200">{docNo}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Main Details */}
        <div className={cn("space-y-4", formData.milestones && formData.milestones.length > 0 ? "md:col-span-2" : "md:col-span-3")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Order Photo & Sample Reference (Visual Standard first with Carousel) */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 flex flex-col">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Order Photo & Sample Proof</span>
              {photos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                  {photos.length} photos
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shadow-none">
                Visual Standard
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                title="Add photo"
                onClick={() => document.getElementById("client-photo-add-input")?.click()}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between space-y-2.5">
            {photos.length > 0 ? (
              <div className="space-y-2">
                {/* Carousel Container */}
                <div className="relative group w-full h-44 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950/5 dark:bg-zinc-950">
                  <Carousel
                    setApi={setCarouselApi}
                    className="w-full h-full"
                    opts={{ loop: true }}
                  >
                    <CarouselContent className="h-44 ml-0">
                      {photos.map((src, index) => (
                        <CarouselItem key={`${src}-${index}`} className="pl-0 h-44 relative flex items-center justify-center">
                          <img
                            src={src}
                            alt={`Sample Proof ${index + 1}`}
                            className="w-full h-full object-contain select-none"
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    {/* Carousel Nav buttons */}
                    {photos.length > 1 && (
                      <>
                        <CarouselPrevious
                          variant="secondary"
                          size="icon-xs"
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-md border-border opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <CarouselNext
                          variant="secondary"
                          size="icon-xs"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 hover:bg-background shadow-md border-border opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      </>
                    )}
                  </Carousel>

                  {/* Overlay Action Bar */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-zinc-700 dark:text-zinc-300"
                      title="Full Screen View"
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
                      className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-red-600 hover:text-red-700"
                      title="Remove Current Photo"
                      onClick={() => handleRemovePhoto(activePhotoIndex)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Slide Counter Indicator */}
                  {photos.length > 1 && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono leading-none">
                      {activePhotoIndex + 1} / {photos.length}
                    </div>
                  )}
                </div>

                {/* Thumbnails row if multiple photos */}
                {photos.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-h-11">
                    {photos.map((src, idx) => (
                      <button
                        type="button"
                        key={`thumb-client-${idx}`}
                        onClick={() => carouselApi?.scrollTo(idx)}
                        className={cn(
                          "relative shrink-0 w-10 h-9 rounded overflow-hidden border transition-all cursor-pointer bg-muted/40",
                          activePhotoIndex === idx
                            ? "border-blue-600 ring-2 ring-blue-500/30"
                            : "border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100"
                        )}
                      >
                        <img src={src} alt="thumbnail" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => document.getElementById("client-photo-add-input")?.click()}
                      className="shrink-0 w-9 h-9 rounded border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:border-blue-500 transition-colors"
                      title="Add another proof photo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 font-medium">
                      Approved Match Proof
                    </Badge>
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Color Reference Standard</span>
                  </div>
                  <span className="font-mono text-[10px]">Target: ISO 12647-2</span>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all flex-1 min-h-[140px]"
                onClick={() => document.getElementById("client-photo-add-input")?.click()}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">No Sample Photo Attached</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Click to upload physical sample or packaging mockup</p>
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
                searchPlaceholder="Search customer by name or CRM..."
                allowCustom={true}
                options={MOCK_CUSTOMERS.map((c) => ({
                  value: c,
                  label: c,
                  description: "Verified CRM Client Account",
                  badge: "Client"
                }))}
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
                onChange={(val) => handleFieldChange("recipe", val)}
                searchPlaceholder="Search recipe code, technology or product..."
                options={[
                  { value: "OFFSET_STD_V1", label: "OFFSET_STD_V1 (Folding Carton)", description: "Coated board, 4-color offset, standard die-cut", badge: "Offset" },
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

        {/* Card 3: Physical Item Specifications */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>Physical Specifications</span>
            </h3>
            <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shadow-none">
              {formData.width || 50} × {formData.height || 90} {formData.dimensionUnit || "mm"}
            </Badge>
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

            {/* Paper Stock & Coating - Converted to Searchable SmartCombobox */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Paper / Substrate Stock</label>
                <SmartCombobox
                  value={formData.paperStock || "Galerie Art Silk 150g/m²"}
                  onChange={(val) => handleFieldChange("paperStock", val)}
                  searchPlaceholder="Search substrate or density..."
                  allowCustom={true}
                  options={[
                    { value: "Galerie Art Silk 150g/m²", label: "Galerie Art Silk 150g/m²", description: "Premium coated semi-matte paper", badge: "Paper" },
                    { value: "Coated Cardboard 300g/m²", label: "Coated Cardboard 300g/m²", description: "Solid bleached board (SBB/GZ)", badge: "Board" },
                    { value: "Kraft Board Brown 280g/m²", label: "Kraft Board Brown 280g/m²", description: "Natural unbleached eco kraft paper", badge: "Kraft" },
                    { value: "Offset Woodfree 80g/m²", label: "Offset Woodfree 80g/m²", description: "Standard uncoated office book paper", badge: "Paper" },
                    { value: "White Satin Ribbon 60mm", label: "White Satin Ribbon 60mm", description: "Polyester woven edge soft satin", badge: "Flexo" },
                    { value: "Nylon Taffeta Tape 50mm", label: "Nylon Taffeta Tape 50mm", description: "Tear-resistant heat sealable tape", badge: "Flexo" },
                    { value: "Gloss Art Paper 130g/m²", label: "Gloss Art Paper 130g/m²", description: "High-gloss magazine/flyer paper", badge: "Paper" },
                  ]}
                />
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

        {/* Card 4: Size / Variation Breakdown */}
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

        {/* Card 6: Attached Files & Technical Documents */}
        <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 flex flex-col">
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

        {/* RIGHT COLUMN: Route & Tasks Tracker (1/3 width) */}
        {formData.milestones && formData.milestones.length > 0 && (
          <div className="md:col-span-1 space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <span className="text-sm flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  Live Production Route
                </span>
                <Badge variant="outline" className="text-[10px] shadow-none bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:border-blue-900">
                  {formData.linkedWoId ? `Linked to ${formData.linkedWoId}` : "Pre-production Route"}
                </Badge>
              </div>
              <div className="pt-2">
                <VerticalTaskTracker
                  milestones={formData.milestones || []}
                  onStatusChange={handleMilestoneStatusChange}
                  onAssign={handleMilestoneAssign}
                  onRemove={handleMilestoneRemove}
                  onAdd={handleMilestoneAdd}
                  onReorder={handleMilestonesReorder}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
