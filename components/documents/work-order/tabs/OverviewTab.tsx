"use client";

import React, { useState } from "react";
import {
  Tag,
  Factory,
  Boxes,
  DollarSign,
  Camera,
  Paperclip,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  Building2,
  Cpu,
  ChevronsUpDown,
  Download,
  Image as ImageIcon,
  Maximize2,
  UploadCloud,
  FileText,
  Ruler,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  WorkOrderFormData,
  MasterSpecification,
  SiteOption,
  TechOption,
  MachineOption,
  OrderAttachment,
  ProductionMilestone,
  MOCK_CUSTOMERS,
  SITE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  MACHINE_OPTIONS,
  MASTER_SPECIFICATIONS,
} from "../types";

interface OverviewTabProps {
  formData: WorkOrderFormData;
  handleFieldChange: (field: string, val: any) => void;
  handleDepartmentChange: (dept: string) => void;
  data: any;
  tabId: string;
  activeSpec: MasterSpecification | undefined;
  activeSite: SiteOption;
  activeTech: TechOption;
  activeMachine: MachineOption | undefined;
  currentDeptMachines: MachineOption[];
  currentRecipeMaterials: { name: string; req: number; unit: string; stock: number }[];
  hasShortage: boolean;
  orderAttachments: OrderAttachment[];
  setOrderAttachments: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  onOpenLightbox: () => void;
  onOpenTab: (tab: any) => void;
  onSwitchTab: (tabKey: string) => void;
  onMarkUnsaved: () => void;
  tOrder: (key: string) => string;
}

import { VerticalTaskTracker } from "@/components/ui/vertical-task-tracker";
import { FilePreviewDialog } from "@/components/file-viewer/FilePreviewDialog";
import { FILE_KIND_ICON, getFileKind, isPreviewable, downloadFile, ViewableFile } from "@/components/file-viewer/file-utils";

export function OverviewTab({
  formData,
  handleFieldChange,
  handleDepartmentChange,
  data,
  tabId,
  activeSpec,
  activeSite,
  activeTech,
  activeMachine,
  currentDeptMachines,
  currentRecipeMaterials,
  hasShortage,
  orderAttachments,
  setOrderAttachments,
  onOpenLightbox,
  onOpenTab,
  onSwitchTab,
  onMarkUnsaved,
  tOrder,
}: OverviewTabProps) {
  const [isSpecComboboxOpen, setIsSpecComboboxOpen] = useState(false);
  const [isSiteComboboxOpen, setIsSiteComboboxOpen] = useState(false);
  const [isTechComboboxOpen, setIsTechComboboxOpen] = useState(false);
  const [isMachineComboboxOpen, setIsMachineComboboxOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Array of proof photos (defaults to photoUrls array or single photoUrl)
  const photos = React.useMemo(() => {
    if (formData.photoUrls && formData.photoUrls.length > 0) {
      return formData.photoUrls;
    }
    return formData.photoUrl ? [formData.photoUrl] : [];
  }, [formData.photoUrls, formData.photoUrl]);

  // Sync active photo index with carousel API selection
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
      department: dept,
      status: "Pending" as const,
    };
    handleFieldChange("milestones", [...(formData.milestones || []), newM]);
  };

  const handleMilestonesReorder = (newMilestones: ProductionMilestone[]) => {
    handleFieldChange("milestones", newMilestones);
  };

  return (
    <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
      <FilePreviewDialog 
        isOpen={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile} 
      />
      {/* Document Status Header */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">{tOrder("status")}:</span>
            <Select value={formData.status} onValueChange={(val: any) => val && handleFieldChange("status", val)}>
              <SelectTrigger className="h-6 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded-full px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="In Production">In Production</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">{tOrder("priority")}:</span>
            <Select value={formData.priority} onValueChange={(val: any) => val && handleFieldChange("priority", val)}>
              <SelectTrigger className="h-6 text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-full px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-500">
            <span className="font-medium">Site:</span>
            <Badge variant="outline" className="font-semibold text-[10px] bg-zinc-50 dark:bg-zinc-800">
              {formData.site}
            </Badge>
          </div>

          {data.orderType && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">{tOrder("orderType") || "Type"}:</span>
              <Badge variant="outline" className={cn("h-6 text-[11px] font-semibold px-2.5", 
                data.orderType === "Sample" ? "bg-amber-50 text-amber-700 border-amber-300" :
                "bg-blue-50 text-blue-700 border-blue-300"
              )}>
                {data.orderType === "Sample" ? "SAMPLE ORDER" : "PRODUCTION ORDER"}
              </Badge>
            </div>
          )}
          
          {data.linkedOrderId && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">{tOrder("linkedOrder") || "Linked CO"}:</span>
              <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-violet-50 text-violet-700 border-violet-300 cursor-pointer hover:bg-violet-100">
                {data.linkedOrderId}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
          <span>{tOrder("docNo")}: <strong className="text-zinc-800 dark:text-zinc-200">{data.docNo || tabId}</strong></span>
          <span>{tOrder("created")}: 2026-09-29 14:20</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Order Photo & Sample Reference (Visual Standard first with Carousel) */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 flex flex-col">
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
                onClick={() => document.getElementById("wo-photo-add-input")?.click()}
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
                            alt={`Order Sample Proof ${index + 1}`}
                            className="w-full h-full object-contain select-none"
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    {/* Carousel Nav buttons (visible on hover or when multiple photos) */}
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
                        key={`thumb-${idx}`}
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
                      onClick={() => document.getElementById("wo-photo-add-input")?.click()}
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
                onClick={() => document.getElementById("wo-photo-add-input")?.click()}
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
              id="wo-photo-add-input"
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

        {/* Card 2: General Requisites & Customer */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>{tOrder("docRequisites")}</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">CRM Linked</Badge>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-zinc-500 font-medium block mb-1">{tOrder("customerLabel")}</label>
              <FieldCombobox
                value={formData.customer}
                onChange={(val) => handleFieldChange("customer", val)}
                options={MOCK_CUSTOMERS.map((c) => ({ value: c, label: c }))}
                placeholder="Select customer..."
                searchPlaceholder="Search customer..."
                className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                popoverClassName="w-auto min-w-[280px]"
              />
            </div>

            <div>
              <label className="text-zinc-500 font-medium block mb-1">{tOrder("productLabel")}</label>
              <Input 
                value={formData.product} 
                onChange={(e) => handleFieldChange("product", e.target.value)}
                className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-medium" 
                placeholder="Product specification name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">{tOrder("quantityLabel")}</label>
                <Input 
                  type="number"
                  value={formData.quantity} 
                  onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">{tOrder("unitLabel")}</label>
                <Select value={formData.unit} onValueChange={(val: any) => val && handleFieldChange("unit", val)}>
                  <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">pcs (Pieces)</SelectItem>
                    <SelectItem value="sets">sets (Sets)</SelectItem>
                    <SelectItem value="rolls">rolls (Rolls)</SelectItem>
                    <SelectItem value="m">m (Meters)</SelectItem>
                    <SelectItem value="kg">kg (Kilograms)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Production Equipment & Scheduling */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span>Technology & Facility Route</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
              {formData.department}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Production Site Combobox */}
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs block mb-1">
                  Production Site
                </label>
                <Popover open={isSiteComboboxOpen} onOpenChange={setIsSiteComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isSiteComboboxOpen}
                        className="w-full h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {activeSite.name}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search production site..." className="h-8 text-xs" />
                      <CommandList className="max-h-60">
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No site found.</CommandEmpty>
                        <CommandGroup heading="Manufacturing Facilities">
                          {SITE_OPTIONS.map((site) => {
                            const isSelected = formData.site === site.id || formData.site === site.name;
                            return (
                              <CommandItem
                                key={site.id}
                                value={`${site.name} ${site.label} ${site.facilities}`}
                                onSelect={() => {
                                  handleFieldChange("site", site.id);
                                  setIsSiteComboboxOpen(false);
                                }}
                                className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2"
                              >
                                <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">{site.name}</span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● Online</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">{site.label}</p>
                                  <p className="text-[10px] text-zinc-400">{site.location}</p>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Technology Combobox */}
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs block mb-1">
                  Technology
                </label>
                <Popover open={isTechComboboxOpen} onOpenChange={setIsTechComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isTechComboboxOpen}
                        className="w-full h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-medium shrink-0", activeTech.badgeClass)}>
                        {activeTech.id}
                      </Badge>
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {activeTech.name}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search printing technology..." className="h-8 text-xs" />
                      <CommandList className="max-h-64">
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No technology found.</CommandEmpty>
                        <CommandGroup heading="Production Technologies">
                          {TECHNOLOGY_OPTIONS.map((tech) => {
                            const isSelected = formData.department === tech.id;
                            return (
                              <CommandItem
                                key={tech.id}
                                value={`${tech.id} ${tech.name} ${tech.description}`}
                                onSelect={() => {
                                  handleDepartmentChange(tech.id);
                                  setIsTechComboboxOpen(false);
                                }}
                                className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2"
                              >
                                <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground">{tech.name}</span>
                                    <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-normal", tech.badgeClass)}>
                                      {tech.equipmentCount} lines
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">{tech.description}</p>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Assigned Press Machine Combobox */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs">
                  {tOrder("machineLabel")}
                </label>
                <span className="text-[10px] text-muted-foreground">Equipment line assignment</span>
              </div>
              <Popover open={isMachineComboboxOpen} onOpenChange={setIsMachineComboboxOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isMachineComboboxOpen}
                      className="w-full h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                    />
                  }
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                      {activeMachine?.name || formData.pressMachine}
                    </span>
                    {activeMachine && (
                      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline font-normal">
                        • {activeMachine.format} ({activeMachine.speed})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 shadow-none font-normal">
                      Ready
                    </Badge>
                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                  <Command className="w-full">
                    <CommandInput placeholder="Search machine name, model, speed, format..." className="h-8 text-xs" />
                    <CommandList className="max-h-72">
                      <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No machine matching search.</CommandEmpty>
                      
                      <CommandGroup heading={`${formData.department} Presses & Equipment`}>
                        {currentDeptMachines.map((mach) => {
                          const isSelected = formData.pressMachine === mach.name || formData.pressMachine === mach.code;
                          return (
                            <CommandItem
                              key={mach.code}
                              value={`${mach.code} ${mach.name} ${mach.department} ${mach.features} ${mach.format}`}
                              onSelect={() => {
                                handleFieldChange("pressMachine", mach.name);
                                setIsMachineComboboxOpen(false);
                              }}
                              className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5"
                            >
                              <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">{mach.name}</span>
                                  <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">{mach.code}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                                  <span className="font-medium text-zinc-600 dark:text-zinc-300">{mach.format}</span>
                                  <span>•</span>
                                  <span>{mach.speed}</span>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">● {mach.status}</span>
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>

                      {MACHINE_OPTIONS.filter((m) => m.department !== formData.department).length > 0 && (
                        <CommandGroup heading="Other Departments Equipment">
                          {MACHINE_OPTIONS.filter((m) => m.department !== formData.department).map((mach) => {
                            const isSelected = formData.pressMachine === mach.name || formData.pressMachine === mach.code;
                            return (
                              <CommandItem
                                key={mach.code}
                                value={`${mach.code} ${mach.name} ${mach.department} ${mach.features} ${mach.format}`}
                                onSelect={() => {
                                  handleFieldChange("pressMachine", mach.name);
                                  handleDepartmentChange(mach.department);
                                  setIsMachineComboboxOpen(false);
                                }}
                                className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5 opacity-80 hover:opacity-100"
                              >
                                <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">{mach.name}</span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">{mach.department}</Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                    <span>{mach.format}</span>
                                    <span>•</span>
                                    <span>{mach.speed}</span>
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">{tOrder("shiftStartLabel")}</label>
                <DatePicker 
                  value={formData.startDate} 
                  onChange={(val) => handleFieldChange("startDate", val)}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">{tOrder("deadlineLabel")}</label>
                <DatePicker 
                  value={formData.deadline} 
                  onChange={(val) => handleFieldChange("deadline", val)}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card: Planned Physical Specifications & Finishing */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-600" />
              <span>Physical Specifications & Finishing</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200">
                {formData.width || 50} × {formData.height || 90} {formData.dimensionUnit || "mm"}
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200">
                Floor Standard
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            {/* Quick Size Preset Selector */}
            <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
              <label className="text-[11px] font-medium text-zinc-500 mb-1.5 flex items-center justify-between">
                <span>Quick Size & Format Presets</span>
                <span className="text-[10px] text-zinc-400">Loads standard dimensions</span>
              </label>
              <SmartCombobox
                placeholder="⚡ Choose standard preset (e.g. Hangtag, Care label, Card)..."
                searchPlaceholder="Search standard print sizes..."
                onChange={(val) => {
                  const presetMap: Record<string, { w: number; h: number; cat: string }> = {
                    "hangtag_50x90": { w: 50, h: 90, cat: "Hangtag" },
                    "card_85x55": { w: 85, h: 55, cat: "Card" },
                    "label_30x70": { w: 30, h: 70, cat: "Label" },
                    "sticker_50x50": { w: 50, h: 50, cat: "Sticker" },
                    "circle_40x40": { w: 40, h: 40, cat: "Sticker" },
                    "a6_105x148": { w: 105, h: 148, cat: "Card" },
                    "a5_148x210": { w: 148, h: 210, cat: "Card" },
                    "ribbon_25x100": { w: 25, h: 100, cat: "Jacquard Ribbon" },
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Product Format</label>
                <SmartCombobox
                  value={formData.itemCategory || "Hangtag"}
                  onChange={(val) => handleFieldChange("itemCategory", val)}
                  searchPlaceholder="Format / category..."
                  allowCustom={true}
                  options={[
                    { value: "Hangtag", label: "Hangtag (Clothing / Retail Tag)" },
                    { value: "Label", label: "Label (Self-adhesive / Woven)" },
                    { value: "Card", label: "Card (Insert / Postcard)" },
                    { value: "Sticker", label: "Sticker (Die-cut roll/sheet)" },
                    { value: "Jacquard Ribbon", label: "Jacquard Ribbon (Woven band)" },
                    { value: "Carton", label: "Carton Box (Folding packaging)" },
                    { value: "Sleeve", label: "Packaging Sleeve (Belly band)" },
                  ]}
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1 text-xs">Cut / Finish</label>
                <SmartCombobox
                  value={formData.cornerType || "Square Cut"}
                  onChange={(val) => handleFieldChange("cornerType", val)}
                  searchPlaceholder="Cut or fold type..."
                  allowCustom={true}
                  options={[
                    { value: "Square Cut", label: "Square Cut (90° guillotine)" },
                    { value: "Round Corners (R3)", label: "Round Corners (R3)" },
                    { value: "Round Corners (R5)", label: "Round Corners (R5)" },
                    { value: "Die-cut Contour", label: "Die-cut Contour (Steel rule)" },
                    { value: "Center Fold", label: "Center Fold (Loop fold)" },
                    { value: "End Fold", label: "End Fold (Booklet fold)" },
                    { value: "Miter Fold", label: "Miter Fold (Hanger fold)" },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Width ({formData.dimensionUnit || "mm"})</label>
                <Input 
                  type="number"
                  value={formData.width ?? 50} 
                  onChange={(e) => handleFieldChange("width", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Height ({formData.dimensionUnit || "mm"})</label>
                <Input 
                  type="number"
                  value={formData.height ?? 90} 
                  onChange={(e) => handleFieldChange("height", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-zinc-500 font-medium block mb-1">Bleed (mm)</label>
                <Input 
                  type="number"
                  value={formData.bleed ?? 2} 
                  onChange={(e) => handleFieldChange("bleed", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
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

        {/* Card: Planned Size & Variation Breakdown */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>Planned Size Breakdown</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Total: {formData.quantity.toLocaleString()} {formData.unit}
            </span>
          </div>

          {formData.sizes && formData.sizes.length > 0 ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden max-h-[175px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Size / Variation</th>
                    <th className="px-3 py-1.5 font-medium text-right">Target Quantity</th>
                    <th className="px-3 py-1.5 font-medium text-right">Pack Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.sizes.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-3 py-1.5 font-semibold text-zinc-900 dark:text-zinc-100">{s.size}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">{s.quantity.toLocaleString()} pcs</td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-500">
                        {Math.round((s.quantity / formData.quantity) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800 font-semibold sticky bottom-0">
                  <tr>
                    <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">Total Planned:</td>
                    <td className="px-3 py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">
                      {formData.sizes.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()} pcs
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-400 text-xs italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-md">
              Single standard size ({formData.quantity.toLocaleString()} {formData.unit})
            </div>
          )}
        </div>

        {/* Card: Attached Files & Technical Documents */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5 flex flex-col">
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
                onClick={() => document.getElementById("wo-doc-upload-input")?.click()}
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
                onClick={() => document.getElementById("wo-doc-upload-input")?.click()}
              >
                <UploadCloud className="w-6 h-6 text-zinc-400 mb-1.5" />
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No attachments linked yet</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Click to attach vector die-lines, contracts, or customer specifications</p>
              </div>
            )}

            <input 
              type="file" 
              id="wo-doc-upload-input" 
              className="hidden" 
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const newFiles = Array.from(e.target.files).map((f, i) => ({
                    id: `att-new-${Date.now()}-${i}`,
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

        {/* Right Column (1/3 width) - Tasks & Routing */}
        <div className="lg:col-span-1 space-y-4">
          {/* Vertical Task Tracker */}
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <span className="text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-600" />
                Production Route Tasks
              </span>
              <Badge variant="outline" className="text-[10px] shadow-none bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:border-blue-900">
                {formData.milestones?.filter(m => m.status === "Done").length || 0} / {formData.milestones?.length || 0} Done
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

        {/* Card 3: Linked Recipe & Live Materials Availability */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>Recipe Specification & Stock Availability</span>
            </div>
            {hasShortage ? (
              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900">
                Stock Deficit
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900">
                All Materials In Stock
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {/* Active BOM Recipe / Specification Combobox */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs">
                  Master BOM Specification
                </label>
                <span className="text-[10px] text-muted-foreground">Searchable recipe catalog</span>
              </div>

              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <Popover open={isSpecComboboxOpen} onOpenChange={setIsSpecComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isSpecComboboxOpen}
                        className="flex-1 min-w-0 h-9 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shrink-0">
                        {activeSpec?.code || formData.recipe}
                      </Badge>
                      <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100 flex-1 min-w-0">
                        {activeSpec?.name || formData.recipe}
                      </span>
                      {activeSpec && (
                        <span className="text-[10px] text-muted-foreground shrink-0 hidden xl:inline">
                          ({activeSpec.materialsCount} mats)
                        </span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>

                  <PopoverContent className="w-[380px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search code, name, technology, or materials..." className="h-9 text-xs" />
                      <CommandList className="max-h-72">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No specification matching search.</CommandEmpty>
                        
                        {(["Offset", "Flexo", "Jacquard", "Post-press"] as const).map((dept) => {
                          const deptSpecs = MASTER_SPECIFICATIONS.filter((s) => s.department === dept);
                          if (deptSpecs.length === 0) return null;

                          return (
                            <CommandGroup key={dept} heading={`${dept} Technology Specifications`}>
                              {deptSpecs.map((spec) => {
                                const isSelected = formData.recipe === spec.code;
                                return (
                                  <CommandItem
                                    key={spec.code}
                                    value={`${spec.code} ${spec.name} ${spec.department} ${spec.description}`}
                                    onSelect={() => {
                                      handleFieldChange("recipe", spec.code);
                                      if (formData.department !== spec.department) {
                                        handleDepartmentChange(spec.department);
                                      }
                                      setIsSpecComboboxOpen(false);
                                    }}
                                    className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5"
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      <Check className={cn("h-4 w-4 text-blue-600", isSelected ? "opacity-100" : "opacity-0")} />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-[11px] text-blue-600 dark:text-blue-400">
                                          {spec.code}
                                        </span>
                                        <span className="font-medium text-foreground truncate">
                                          {spec.name}
                                        </span>
                                        <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 shrink-0 font-normal">
                                          {spec.department}
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                                        {spec.description}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                                        <span>{spec.materialsCount} raw materials</span>
                                        <span>•</span>
                                        <span>{spec.estimatedCost} standard batch</span>
                                      </div>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Quick Open Master Specification Tab Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 gap-1 text-xs shrink-0 border-zinc-200 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                  title="Open Master Product Specification document"
                  onClick={() => {
                    const specToOpen = activeSpec || MASTER_SPECIFICATIONS[0];
                    onOpenTab({
                      id: specToOpen.id,
                      title: `${specToOpen.id}: ${specToOpen.name}`,
                      type: "product-spec",
                      module: "production",
                      documentData: {
                        id: specToOpen.id,
                        name: specToOpen.name,
                        code: specToOpen.code,
                        department: specToOpen.department,
                        desc: specToOpen.description,
                      },
                    });
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Spec</span>
                </Button>
              </div>
            </div>

            {/* Materials Mini Table using official shadcn Table with horizontal scroll safety */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-x-auto bg-background">
              <Table className="text-xs w-full min-w-[280px]">
                <TableHeader className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <TableRow className="hover:bg-transparent border-b border-zinc-200 dark:border-zinc-800">
                    <TableHead className="h-7 px-2 text-[11px] font-medium text-muted-foreground">Material</TableHead>
                    <TableHead className="h-7 px-2 text-[11px] font-medium text-muted-foreground text-right">Required</TableHead>
                    <TableHead className="h-7 px-2 text-[11px] font-medium text-muted-foreground text-right">In Stock</TableHead>
                    <TableHead className="h-7 px-2 text-[11px] font-medium text-muted-foreground text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRecipeMaterials.map((mat, i) => {
                    const isShortage = mat.req > mat.stock;
                    return (
                      <TableRow 
                        key={i} 
                        className={cn(
                          "border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-muted/40",
                          isShortage && "bg-red-50/40 dark:bg-red-950/20"
                        )}
                      >
                        <TableCell className="p-2 px-2 font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]" title={mat.name}>
                          {mat.name}
                        </TableCell>
                        <TableCell className="p-2 px-2 text-right text-zinc-600 dark:text-zinc-400 font-mono text-[10px] whitespace-nowrap">
                          {mat.req.toLocaleString()} {mat.unit}
                        </TableCell>
                        <TableCell className="p-2 px-2 text-right text-zinc-600 dark:text-zinc-400 font-mono text-[10px] whitespace-nowrap">
                          {mat.stock.toLocaleString()} {mat.unit}
                        </TableCell>
                        <TableCell className="p-2 px-2 text-right whitespace-nowrap">
                          {isShortage ? (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900 text-[9px] px-1 py-0 shadow-none font-medium">Shortage</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 text-[9px] px-1 py-0 shadow-none font-medium">Available</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => onSwitchTab("materials")}
              className="w-full h-7 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open Full Materials BOM & Stock Allocations</span>
            </Button>
          </div>
        </div>

        {/* Card 4: Financial Calculation & Costing */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span>Cost Structure & Production Margin</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
              Margin: 38.4%
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-xs space-y-1.5">
              <div className="flex justify-between text-zinc-500">
                <span>Raw Materials Allocation:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">$6,420.00</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Press Run & Machine Time:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">$4,100.00</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Post-press & Finishing Operations:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">$2,830.00</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Packaging & Multi-site Logistics:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">$1,500.00</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-baseline font-bold text-sm">
                <span className="text-zinc-900 dark:text-zinc-100">Document Total:</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-base">${formData.priceTotal.toLocaleString("en-US")} {formData.currency}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 bg-zinc-100/60 dark:bg-zinc-900 p-2 rounded">
              <div>Payment Terms: <span className="font-semibold text-zinc-700 dark:text-zinc-300">Net 30</span></div>
              <div>Invoicing: <span className="font-semibold text-emerald-600">Pre-authorized</span></div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </TabsContent>
  );
}
