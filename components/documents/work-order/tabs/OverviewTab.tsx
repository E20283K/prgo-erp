"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
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
  Printer,
  MessageSquare,
  Sparkles,
  Palette,
  CircleDot,
  ArrowRight,
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
  TableFooter,
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
  ShiftNote,
  SpotColorItem,
  SideColorConfig,
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

import { OrderReadinessRouteCard } from "../OrderReadinessRouteCard";
import { DieLinePreview } from "../DieLinePreview";
import { JobTicketDialog } from "../dialogs/JobTicketDialog";
import { PantoneColorPickerModal, SpotStationSelection } from "../dialogs/PantoneColorPickerModal";
import { FilePreviewDialog } from "@/components/file-viewer/FilePreviewDialog";
import { FILE_KIND_ICON, getFileKind, isPreviewable, downloadFile, ViewableFile } from "@/components/file-viewer/file-utils";
import { useLookupStore } from "@/store/lookupStore";

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
  const {
    customers,
    sites,
    formats,
    cornerTypes,
    paperStocks,
    coatings,
    sizePresets,
    addCustomer,
    addSite,
    addFormat,
    addCornerType,
    addPaperStock,
    addCoating,
    addSizePreset,
  } = useLookupStore();

  const [isSpecComboboxOpen, setIsSpecComboboxOpen] = useState(false);
  const [isSiteComboboxOpen, setIsSiteComboboxOpen] = useState(false);
  const [isTechComboboxOpen, setIsTechComboboxOpen] = useState(false);
  const [isMachineComboboxOpen, setIsMachineComboboxOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const tJobTicket = useTranslations("JobTicket");
  const tEnhance = useTranslations("OverviewEnhancements");

  const [viewMode, setViewMode] = useState<"manager" | "operator">("manager");
  const isOperator = viewMode === "operator";
  const [isJobTicketOpen, setIsJobTicketOpen] = useState(false);
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

  const defaultShiftNotes: ShiftNote[] = React.useMemo(() => [
    {
      id: "sn-1",
      author: "M. Ivanova (Press Lead)",
      shift: "Morning",
      time: "Today 11:45",
      text: "Cyan & Magenta densities locked at 1.45 D. Viscosity 23s DIN4 cup. Running speed steady at 14,000 sht/h.",
    },
    {
      id: "sn-2",
      author: "S. Petrov (Die-Cut Lead)",
      shift: "Evening",
      time: "Yesterday 19:30",
      text: "Steel cutting rule aligned with 0.4mm crease channel. Test sample approved by Shift Lead.",
    },
  ], []);

  const [newShiftType, setNewShiftType] = useState<string>("Morning");
  const [newNoteAuthor, setNewNoteAuthor] = useState<string>("M. Ivanova");
  const [newNoteText, setNewNoteText] = useState<string>("");

  const handleAddShiftNote = () => {
    if (!newNoteText.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newNote: ShiftNote = {
      id: `sn-${Date.now()}`,
      author: newNoteAuthor.trim() || "Operator",
      shift: newShiftType,
      time: `Today ${timeStr}`,
      text: newNoteText.trim(),
    };
    const currentNotes = formData.shiftNotes && formData.shiftNotes.length > 0 ? formData.shiftNotes : defaultShiftNotes;
    handleFieldChange("shiftNotes", [newNote, ...currentNotes]);
    setNewNoteText("");
    onMarkUnsaved();
  };

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
    <TabsContent value="overview" className="@container flex-1 overflow-y-auto p-4 m-0 space-y-4">
      <FilePreviewDialog 
        isOpen={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile} 
      />
      <JobTicketDialog
        isOpen={isJobTicketOpen}
        onOpenChange={setIsJobTicketOpen}
        workOrderId={data?.docNo || tabId}
        formData={formData}
        activeSpec={activeSpec}
        activeMachine={activeMachine}
      />
      <PantoneColorPickerModal
        isOpen={isPantoneModalOpen}
        onOpenChange={setIsPantoneModalOpen}
        onSelectColor={handleAddSpotStation}
      />
      {/* Document Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 px-3.5 bg-card border border-border rounded-lg shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Status selector (Disabled for Operator) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{tOrder("status")}:</span>
            <Select 
              value={formData.status} 
              onValueChange={(val: any) => val && handleFieldChange("status", val)}
              disabled={isOperator}
            >
              <SelectTrigger
                className={cn(
                  "h-7 text-xs font-semibold rounded-full px-3 border shadow-2xs transition-colors",
                  isOperator ? "cursor-default opacity-85" : "cursor-pointer",
                  formData.status === "Draft" && "bg-muted text-muted-foreground border-border",
                  (formData.status === "Active" || formData.status === "In Production") && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                  formData.status === "Completed" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  formData.status === "Cancelled" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                )}
              >
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

          {/* Priority selector (Disabled for Operator) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{tOrder("priority")}:</span>
            <Select 
              value={formData.priority} 
              onValueChange={(val: any) => val && handleFieldChange("priority", val)}
              disabled={isOperator}
            >
              <SelectTrigger
                className={cn(
                  "h-7 text-xs font-semibold rounded-full px-3 border shadow-2xs transition-colors",
                  isOperator ? "cursor-default opacity-85" : "cursor-pointer",
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

          {/* Site & Order Type (Clean text, no badge clutter) */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground">{formData.site || "Building 1"}</span>
            <span className="text-border mx-0.5">•</span>
            <span>{data.orderType === "Sample" ? "Sample Order" : "Production Order"}</span>
          </div>

          {/* Linked Order (Functional jump button) */}
          {data.linkedOrderId && (
            <>
              <div className="hidden md:block h-4 w-px bg-border" />
              <button
                type="button"
                onClick={() => onOpenTab?.({ id: data.linkedOrderId, title: data.linkedOrderId, type: "client-order" })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors cursor-pointer border border-violet-200 dark:border-violet-800"
                title="Open linked Client Order"
              >
                <ExternalLink className="w-3 h-3 text-violet-500 shrink-0" />
                <span className="font-mono">{data.linkedOrderId}</span>
              </button>
            </>
          )}

          <div className="hidden md:block h-4 w-px bg-border" />

          {/* View Mode Switcher (👔 Manager View vs 👷 Operator View) */}
          <div className="inline-flex items-center p-0.5 rounded-full bg-muted border border-border shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("manager")}
              className={cn(
                "px-2.5 py-0.5 text-[11px] font-semibold rounded-full transition-colors cursor-pointer flex items-center gap-1",
                viewMode === "manager"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>👔 {tEnhance("managerView")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("operator")}
              className={cn(
                "px-2.5 py-0.5 text-[11px] font-semibold rounded-full transition-colors cursor-pointer flex items-center gap-1",
                viewMode === "operator"
                  ? "bg-amber-500 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>👷 {tEnhance("operatorView")}</span>
            </button>
          </div>

          {/* Job Ticket (Техкарта / Наряд-заказ) Dialog Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsJobTicketOpen(true)}
            className="h-7 text-xs px-2.5 gap-1.5 rounded cursor-pointer border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{tJobTicket("button")}</span>
          </Button>
        </div>

        {/* Right Doc metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono ml-auto">
          <span>{tOrder("docNo")}: <strong className="text-foreground">{data.docNo || tabId}</strong></span>
          <span className="text-border hidden md:inline">•</span>
          <span className="hidden md:inline">{tOrder("created")}: 2026-09-29 14:20</span>
        </div>
      </div>

      <div className="grid grid-cols-1 @7xl:grid-cols-3 gap-4">
        {/* Left Column (2/3 width on xl screens) */}
        <div className="@container @7xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
        {/* Card 1: Order Photo & Sample Reference */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">{tOrder("sampleProofTitle")}</span>
              {photos.length > 0 && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {activePhotoIndex + 1}/{photos.length}
                </span>
              )}
            </div>
            {!isOperator && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title={tOrder("addPhoto")}
                onClick={() => document.getElementById("wo-photo-add-input")?.click()}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
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
                          alt={`${tOrder("sampleProofTitle")} ${index + 1}`}
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
                    title={tOrder("fullScreenView")}
                    onClick={() => {
                      handleFieldChange("photoUrl", photos[activePhotoIndex] || photos[0]);
                      onOpenLightbox();
                    }}
                  >
                    <Maximize2 className="w-3 h-3" />
                  </Button>
                  {!isOperator && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-muted-foreground hover:text-destructive"
                      title={tOrder("removePhoto")}
                      onClick={() => handleRemovePhoto(activePhotoIndex)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Minimalist Floating Thumbnails */}
                {photos.length > 1 && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1 py-0.5 rounded bg-background/80 backdrop-blur-xs border border-border/60 shadow-2xs max-w-[90%] overflow-x-auto">
                    {photos.map((src, idx) => (
                      <button
                        type="button"
                        key={`thumb-${idx}`}
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
                className={cn(
                  "border border-dashed border-border rounded p-4 flex flex-col items-center justify-center text-center bg-muted/20 transition-colors flex-1 min-h-[156px]",
                  !isOperator && "hover:border-border/80 cursor-pointer"
                )}
                onClick={!isOperator ? () => document.getElementById("wo-photo-add-input")?.click() : undefined}
              >
                <ImageIcon className="w-4 h-4 text-muted-foreground mb-1.5" />
                <p className="text-xs text-muted-foreground">{tOrder("attachSamplePhoto")}</p>
              </div>
            )}

            {!isOperator && (
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
            )}
          </div>
        </div>

        {/* Card 2: General Requisites & Customer */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">{tOrder("docRequisites")}</span>
            </div>
            {isOperator && (
              <span className="text-[11px] font-mono text-muted-foreground">🔒 Read-only</span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("customerLabel")}</label>
              <FieldCombobox
                value={formData.customer}
                onChange={(val) => {
                  handleFieldChange("customer", val);
                  onMarkUnsaved();
                }}
                disabled={isOperator}
                allowCustom={!isOperator}
                onAddNew={(newCust) => addCustomer(newCust)}
                options={customers.map((c) => ({ value: c, label: c }))}
                placeholder="Select customer..."
                searchPlaceholder="Search or type new customer..."
                className="h-8 text-xs bg-muted/30"
                popoverClassName="w-auto min-w-[280px]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("productLabel")}</label>
              <Input 
                value={formData.product} 
                onChange={(e) => handleFieldChange("product", e.target.value)}
                disabled={isOperator}
                className="h-8 text-xs bg-muted/30 font-medium disabled:opacity-85" 
                placeholder="Product specification name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("quantityLabel")}</label>
                <Input 
                  type="number"
                  value={formData.quantity} 
                  onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                  disabled={isOperator}
                  className="h-8 text-xs bg-muted/30 font-mono font-semibold disabled:opacity-85" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("unitLabel")}</label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(val: any) => val && handleFieldChange("unit", val)}
                  disabled={isOperator}
                >
                  <SelectTrigger className="h-8 text-xs bg-muted/30 font-mono disabled:opacity-85">
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

        {/* Card 3: High-Level Technical Specifications & CAD Snapshot */}
        <div className="@container @3xl:col-span-2 p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
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
                {formData.paperStock || "Galerie Art Silk 150g/m²"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formData.department}
              </p>
            </div>

            {/* Lamination & Surface Treatment */}
            <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Lamination</span>
              </span>
              <p className="font-semibold text-foreground text-xs truncate" title={formData.lamination}>
                {formData.lamination && formData.lamination !== "none" ? formData.lamination : "None"}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono">
                  {formData.laminationSides ? formData.laminationSides.toUpperCase() : "1S"}
                </Badge>
                <span>{formData.laminationMicron || 28}µm</span>
                {formData.embellishment && formData.embellishment !== "none" && (
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
                  {frontSpots.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block shadow-2xs" title={`+${frontSpots.length} Spot`} />
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {frontSpots.length > 0 ? `+${frontSpots.length} Pantone` : "CMYK"}
              </p>
            </div>
          </div>

          {/* Sub-row: Holes & Quick Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-muted/20 border border-border text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <CircleDot className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Hole:</span>
                <span className="font-medium text-foreground">
                  {effectiveHolePos !== "none" && effectiveHoleSize > 0 ? (
                    <Badge variant="outline" className="text-[10px] h-4.5 bg-background border-border">
                      Ø{effectiveHoleSize}mm · {effectiveHolePos} · {effectiveHoleOffset}mm
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </span>
              </div>
            </div>

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
          </div>
        </div>

        {/* Card 5: Production Equipment & Scheduling */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">Production</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formData.department}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              {/* Production Site Combobox */}
              <div>
                <label className="text-muted-foreground font-medium text-xs block mb-1">
                  Production Site
                </label>
                <Popover open={!isOperator && isSiteComboboxOpen} onOpenChange={isOperator ? undefined : setIsSiteComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={isOperator}
                        aria-expanded={isSiteComboboxOpen}
                        className={cn(
                          "w-full h-8 justify-between px-2.5 text-xs bg-muted/30 font-normal shadow-none border-border transition-colors",
                          isOperator ? "opacity-85 cursor-not-allowed" : "hover:border-primary/50"
                        )}
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate font-medium text-foreground">
                        {activeSite.name}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0 shadow-xl border border-border bg-popover" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search production site..." className="h-8 text-xs" />
                      <CommandList className="max-h-60">
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
                          <span>No site found.</span>
                          {!isOperator && (
                            <button
                              type="button"
                              onClick={() => {
                                const newName = window.prompt("Enter new facility site name (e.g. Building 3 — Digital Lab):");
                                if (newName && newName.trim()) {
                                  const created = addSite({ name: newName.trim() });
                                  handleFieldChange("site", created.id);
                                  setIsSiteComboboxOpen(false);
                                  onMarkUnsaved();
                                }
                              }}
                              className="text-primary hover:underline flex items-center gap-1 text-[11px] font-medium mt-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add new facility site</span>
                            </button>
                          )}
                        </CommandEmpty>
                        <CommandGroup heading="Manufacturing Facilities">
                          {sites.map((site) => {
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
                                <Check className={cn("mt-0.5 h-4 w-4 text-primary shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">{site.name}</span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● Online</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">{site.label}</p>
                                  <p className="text-[10px] text-muted-foreground">{site.location}</p>
                                </div>
                              </CommandItem>
                            );
                          })}

                          {!isOperator && (
                            <CommandItem
                              value="__add_new_facility_site_action__"
                              onSelect={() => {
                                const newName = window.prompt("Enter new facility site name (e.g. Building 3 — Digital Lab):");
                                if (newName && newName.trim()) {
                                  const created = addSite({ name: newName.trim() });
                                  handleFieldChange("site", created.id);
                                  setIsSiteComboboxOpen(false);
                                  onMarkUnsaved();
                                }
                              }}
                              className="py-1.5 px-2.5 cursor-pointer text-xs flex items-center gap-1.5 text-primary font-medium border-t border-border mt-1"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add new facility site...</span>
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Technology Combobox */}
              <div>
                <label className="text-muted-foreground font-medium text-xs block mb-1">
                  Technology
                </label>
                <Popover open={!isOperator && isTechComboboxOpen} onOpenChange={isOperator ? undefined : setIsTechComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={isOperator}
                        aria-expanded={isTechComboboxOpen}
                        className={cn(
                          "w-full h-8 justify-between px-2.5 text-xs bg-muted/30 font-normal shadow-none border-border transition-colors",
                          isOperator ? "opacity-85 cursor-not-allowed" : "hover:border-primary/50"
                        )}
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <span className="truncate font-medium text-foreground">
                        {activeTech.name}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0 shadow-xl border border-border bg-popover" align="start">
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
                                <Check className={cn("mt-0.5 h-4 w-4 text-primary shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground">{tech.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {tech.equipmentCount} lines
                                    </span>
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
                <label className="text-muted-foreground font-medium text-xs">
                  {tOrder("machineLabel")}
                </label>
                
              </div>
              <Popover open={!isOperator && isMachineComboboxOpen} onOpenChange={isOperator ? undefined : setIsMachineComboboxOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={isOperator}
                      aria-expanded={isMachineComboboxOpen}
                      className={cn(
                        "w-full h-8 justify-between px-2.5 text-xs bg-muted/30 font-normal shadow-none border-border transition-colors",
                        isOperator ? "opacity-85 cursor-not-allowed" : "hover:border-primary/50"
                      )}
                    />
                  }
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    <Cpu className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate font-semibold text-foreground">
                      {activeMachine?.name || formData.pressMachine}
                    </span>
                    {activeMachine && (
                      <span className="text-[11px] text-muted-foreground shrink-0 hidden @lg:inline font-mono">
                        • {activeMachine.format} ({activeMachine.speed})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Ready
                    </span>
                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0 shadow-xl border border-border bg-popover" align="start">
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
                              <Check className={cn("mt-0.5 h-4 w-4 text-primary shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">{mach.name}</span>
                                  <span className="font-mono text-[10px] text-primary">{mach.code}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                                  <span className="font-medium text-foreground">{mach.format}</span>
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
                                <Check className={cn("mt-0.5 h-4 w-4 text-primary shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">{mach.name}</span>
                                    <span className="text-[10px] font-mono text-muted-foreground">{mach.department}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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

            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("shiftStartLabel")}</label>
                <DatePicker 
                  value={formData.startDate} 
                  disabled={isOperator}
                  onChange={(val) => handleFieldChange("startDate", val)}
                  className="h-8 text-xs bg-muted/30 disabled:opacity-85" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("deadlineLabel")}</label>
                <DatePicker 
                  value={formData.deadline} 
                  disabled={isOperator}
                  onChange={(val) => handleFieldChange("deadline", val)}
                  className="h-8 text-xs bg-muted/30 disabled:opacity-85" 
                />
              </div>
            </div>
          </div>
        </div>



        {/* Card 6: Quick Attached Files Snapshot */}
        <div className="@container @3xl:col-span-2 p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">
                Files ({orderAttachments.length})
              </span>
            </div>
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
                    onClick={() => onSwitchTab("files")}
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
        </div>

        {/* Right Column (1/3 width on xl screens, stacks gracefully on smaller screens) */}
        <div className="grid grid-cols-1 @3xl:grid-cols-2 @7xl:grid-cols-1 gap-4 content-start">
          {/* Pre-Flight Readiness & Production Route */}
          <OrderReadinessRouteCard
            workOrderId={data?.docNo || tabId}
            fallbackData={{
              customer: formData.customer,
              product: formData.product,
              machine: formData.pressMachine,
              department: formData.department,
              quantity: formData.quantity,
              deadline: formData.deadline,
            }}
          />

        {/* Card 3: Linked Recipe & Live Materials Availability */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">Materials</span>
            </div>
            {hasShortage ? (
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span>Shortage</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>In stock</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* Active BOM Recipe / Specification Combobox */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-muted-foreground font-medium text-xs">
                  Master BOM Specification
                </label>
                
              </div>

              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <Popover open={!isOperator && isSpecComboboxOpen} onOpenChange={isOperator ? undefined : setIsSpecComboboxOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={isOperator}
                        aria-expanded={isSpecComboboxOpen}
                        className={cn(
                          "flex-1 min-w-0 h-8 justify-between px-2.5 text-xs bg-muted/30 font-normal shadow-none border-border transition-colors",
                          isOperator ? "opacity-85 cursor-not-allowed" : "hover:border-primary/50"
                        )}
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                        {activeSpec?.code || formData.recipe}
                      </span>
                      <span className="truncate text-xs font-medium text-foreground flex-1 min-w-0">
                        {activeSpec?.name || formData.recipe}
                      </span>
                      {activeSpec && (
                        <span className="text-[11px] text-muted-foreground shrink-0 hidden xl:inline font-mono">
                          ({activeSpec.materialsCount} mats)
                        </span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </PopoverTrigger>

                  <PopoverContent className="w-[380px] p-0 shadow-xl border border-border bg-popover" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search code, name, technology, or materials..." className="h-8 text-xs" />
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
                                      <Check className={cn("h-4 w-4 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-[11px] text-primary">
                                          {spec.code}
                                        </span>
                                        <span className="font-medium text-foreground truncate">
                                          {spec.name}
                                        </span>
                                        <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 shrink-0 font-normal">
                                          {spec.department}
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                                        {spec.description}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5 font-mono">
                                        <span>{spec.materialsCount} raw materials</span>
                                        <span>•</span>
                                        <span>{spec.estimatedCost} batch</span>
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
                  className="h-8 px-2.5 gap-1.5 text-xs shrink-0 cursor-pointer"
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
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Spec</span>
                </Button>
              </div>
            </div>

            {/* Materials Mini Table using official shadcn Table */}
            <div className="border border-border rounded-md overflow-x-auto bg-card">
              <Table className="text-xs w-full min-w-[280px]">
                <TableHeader className="bg-muted/50 border-b border-border">
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground">Material</TableHead>
                    <TableHead className="h-7 px-2 text-[11px] font-medium text-muted-foreground text-right">Required</TableHead>
                    <TableHead className="h-7 px-2 text-[11px] font-medium text-muted-foreground text-right">In Stock</TableHead>
                    <TableHead className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRecipeMaterials.map((mat, i) => {
                    const isShortage = mat.req > mat.stock;
                    return (
                      <TableRow 
                        key={i} 
                        className={cn(
                          "border-b border-border/50 last:border-0 hover:bg-muted/40",
                          isShortage && "bg-destructive/5"
                        )}
                      >
                        <TableCell className="p-2 px-2.5 font-medium text-foreground truncate max-w-[140px]" title={mat.name}>
                          {mat.name}
                        </TableCell>
                        <TableCell className="p-2 px-2 text-right text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                          {mat.req.toLocaleString()} {mat.unit}
                        </TableCell>
                        <TableCell className="p-2 px-2 text-right text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                          {mat.stock.toLocaleString()} {mat.unit}
                        </TableCell>
                        <TableCell className="p-2 px-2.5 text-right whitespace-nowrap">
                          {isShortage ? (
                            <span className="inline-flex items-center text-[10px] font-medium text-destructive">
                              Shortage
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Available
                            </span>
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
              className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full BOM & Stock Allocation</span>
            </Button>
          </div>
        </div>

        {/* Card 4: Financial Calculation (Manager) OR Shift Production Target (Operator) */}
        {isOperator ? (
          <div className="p-3.5 bg-card border border-amber-500/30 rounded-lg shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">Shift Production Target</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Operator Mode
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tEnhance("operatorNoticeDesc")}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div className="bg-muted/30 p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">Assigned Equipment</span>
                  <span className="font-semibold text-foreground truncate block mt-0.5">{formData.pressMachine}</span>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">Target Run Quantity</span>
                  <span className="font-bold text-primary block mt-0.5">{formData.quantity.toLocaleString()} {formData.unit}</span>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSwitchTab("operations")}
                  className="w-full h-8 text-xs gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open Operations Log & Shift Tracker</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">Cost Structure & Margin</span>
              </div>
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Margin: 38.4%
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 bg-muted/30 rounded-md border border-border font-mono text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">Raw Materials:</span>
                  <span className="text-foreground font-medium">$6,420.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">Machine Run Time:</span>
                  <span className="text-foreground font-medium">$4,100.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">Post-press & Finishing:</span>
                  <span className="text-foreground font-medium">$2,830.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-sans">Packaging & Logistics:</span>
                  <span className="text-foreground font-medium">$1,500.00</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between items-baseline font-bold">
                  <span className="text-foreground font-sans">Document Total:</span>
                  <span className="text-primary font-semibold text-sm font-mono">
                    ${formData.priceTotal.toLocaleString("en-US")} {formData.currency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-border">
                <div>Terms: <span className="font-semibold text-foreground">Net 30</span></div>
                <div>Billing: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pre-authorized</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Card 5: Shift Handover Notes Log (Always active & editable for Operators and Managers) */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm text-foreground truncate">{tEnhance("shiftNotesTitle")}</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {((formData.shiftNotes && formData.shiftNotes.length > 0) ? formData.shiftNotes : defaultShiftNotes).length} notes
            </span>
          </div>

          {/* New note input form */}
          <div className="space-y-2 bg-muted/30 p-2.5 rounded-md border border-border">
            <div className="grid grid-cols-2 gap-2">
              <Select value={newShiftType} onValueChange={(val: any) => setNewShiftType(val)}>
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning">{tEnhance("shiftMorning")}</SelectItem>
                  <SelectItem value="Evening">{tEnhance("shiftEvening")}</SelectItem>
                  <SelectItem value="Night">{tEnhance("shiftNight")}</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={newNoteAuthor}
                onChange={(e) => setNewNoteAuthor(e.target.value)}
                placeholder={tEnhance("author")}
                className="h-7 text-xs bg-background"
              />
            </div>

            <div className="flex gap-2">
              <Input
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddShiftNote();
                }}
                placeholder={tEnhance("notePlaceholder")}
                className="h-7 text-xs bg-background flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddShiftNote}
                disabled={!newNoteText.trim()}
                className="h-7 px-2.5 text-xs gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tEnhance("addNote")}</span>
              </Button>
            </div>
          </div>

          {/* Existing notes list */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {((formData.shiftNotes && formData.shiftNotes.length > 0) ? formData.shiftNotes : defaultShiftNotes).map((note) => (
              <div
                key={note.id}
                className="p-2 rounded-md bg-muted/20 border border-border text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[10px] font-semibold border",
                        note.shift === "Morning" && "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
                        note.shift === "Evening" && "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10",
                        note.shift === "Night" && "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10"
                      )}
                    >
                      {note.shift}
                    </span>
                    <span className="font-semibold text-foreground">{note.author}</span>
                  </div>
                  <span className="font-mono text-[10px]">{note.time}</span>
                </div>
                <p className="text-foreground/90 leading-snug">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </TabsContent>
  );
}
