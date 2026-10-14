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
    <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 px-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{tOrder("status")}:</span>
            <Select value={formData.status} onValueChange={(val: any) => val && handleFieldChange("status", val)}>
              <SelectTrigger
                className={cn(
                  "h-7 text-xs font-semibold rounded-full px-3 border shadow-2xs cursor-pointer transition-colors",
                  formData.status === "Draft" && "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
                  (formData.status === "Active" || formData.status === "In Production") && "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800",
                  formData.status === "Completed" && "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800",
                  formData.status === "Cancelled" && "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800"
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

          {/* Priority selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{tOrder("priority")}:</span>
            <Select value={formData.priority} onValueChange={(val: any) => val && handleFieldChange("priority", val)}>
              <SelectTrigger
                className={cn(
                  "h-7 text-xs font-semibold rounded-full px-3 border shadow-2xs cursor-pointer transition-colors",
                  formData.priority === "Urgent" && "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800",
                  formData.priority === "High" && "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
                  formData.priority === "Normal" && "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
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

          <div className="hidden sm:block h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* Site & Order Type (Clean text, no badge clutter) */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="font-medium text-foreground">{formData.site || "Building 1"}</span>
            <span className="text-zinc-300 dark:text-zinc-700 mx-0.5">•</span>
            <span>{data.orderType === "Sample" ? "Sample Order" : "Production Order"}</span>
          </div>

          {/* Linked Order (Functional jump button) */}
          {data.linkedOrderId && (
            <>
              <div className="hidden md:block h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
              <button
                type="button"
                onClick={() => onOpenTab?.({ id: data.linkedOrderId, title: data.linkedOrderId, type: "client-order" })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors cursor-pointer border border-violet-200 dark:border-violet-800"
                title="Open linked Client Order"
              >
                <ExternalLink className="w-3 h-3 text-violet-500 shrink-0" />
                <span>{data.linkedOrderId}</span>
              </button>
            </>
          )}

          <div className="hidden md:block h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* View Mode Switcher (👔 Manager View vs 👷 Operator View) */}
          <div className="inline-flex items-center p-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("manager")}
              className={cn(
                "px-2.5 py-0.5 text-[11px] font-semibold rounded-full transition-colors cursor-pointer flex items-center gap-1",
                viewMode === "manager"
                  ? "bg-white dark:bg-zinc-900 text-foreground shadow-xs"
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
          <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">•</span>
          <span className="hidden md:inline">{tOrder("created")}: 2026-09-29 14:20</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left Column (2/3 width on xl screens) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Order Photo & Sample Reference */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{tOrder("sampleProofTitle")}</span>
              {photos.length > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  {activePhotoIndex + 1}/{photos.length}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              title={tOrder("addPhoto")}
              onClick={() => document.getElementById("wo-photo-add-input")?.click()}
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
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-zinc-600 dark:text-zinc-300"
                    title={tOrder("fullScreenView")}
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
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-zinc-500 hover:text-red-600"
                    title={tOrder("removePhoto")}
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
                        key={`thumb-${idx}`}
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
                onClick={() => document.getElementById("wo-photo-add-input")?.click()}
              >
                <ImageIcon className="w-4 h-4 text-zinc-400 mb-1.5" />
                <p className="text-xs text-zinc-500">{tOrder("attachSamplePhoto")}</p>
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
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>{tOrder("docRequisites")}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">{tOrder("customerLabel")}</label>
              <FieldCombobox
                value={formData.customer}
                onChange={(val) => {
                  handleFieldChange("customer", val);
                  onMarkUnsaved();
                }}
                allowCustom={true}
                onAddNew={(newCust) => addCustomer(newCust)}
                options={customers.map((c) => ({ value: c, label: c }))}
                placeholder="Select customer..."
                searchPlaceholder="Search or type new customer..."
                className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                popoverClassName="w-auto min-w-[280px]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">{tOrder("productLabel")}</label>
              <Input 
                value={formData.product} 
                onChange={(e) => handleFieldChange("product", e.target.value)}
                className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-medium" 
                placeholder="Product specification name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">{tOrder("quantityLabel")}</label>
                <Input 
                  type="number"
                  value={formData.quantity} 
                  onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">{tOrder("unitLabel")}</label>
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

        {/* Card 3: Planned Physical Specifications & Finishing */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-600" />
              <span>Physical Specifications & Finishing</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {formData.width || 50} × {formData.height || 90} {formData.dimensionUnit || "mm"}
            </span>
          </div>

          <div className="space-y-3">
            {/* Quick Size Preset Selector */}
            <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>Quick Size & Format Presets</span>
                <span className="text-[10px] text-zinc-400">Loads standard dimensions</span>
              </label>
              <SmartCombobox
                placeholder="⚡ Choose standard preset (e.g. Hangtag, Care label, Card)..."
                searchPlaceholder="Search or add format preset..."
                onChange={(val) => {
                  const p = sizePresets.find((sp) => sp.value === val);
                  if (p) {
                    if (p.width) handleFieldChange("width", p.width);
                    if (p.height) handleFieldChange("height", p.height);
                    if (p.category) handleFieldChange("itemCategory", p.category);
                    onMarkUnsaved();
                  }
                }}
                allowCustom={true}
                onAddNew={(customStr) => {
                  const match = customStr.match(/(\d+)\s*[x×*]\s*(\d+)/i);
                  const w = match ? Number(match[1]) : formData.width || 50;
                  const h = match ? Number(match[2]) : formData.height || 90;
                  addSizePreset({
                    value: customStr,
                    label: `${customStr} (${w}×${h} mm)`,
                    description: "Custom user-defined format preset",
                    badge: "Custom",
                    width: w,
                    height: h,
                    category: formData.itemCategory || "Custom",
                  });
                  handleFieldChange("width", w);
                  handleFieldChange("height", h);
                  onMarkUnsaved();
                }}
                options={sizePresets}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Product Format</label>
                <SmartCombobox
                  value={formData.itemCategory || "Hangtag"}
                  onChange={(val) => {
                    handleFieldChange("itemCategory", val);
                    onMarkUnsaved();
                  }}
                  onAddNew={(newFmt) => addFormat(newFmt)}
                  searchPlaceholder="Search or type new format..."
                  allowCustom={true}
                  options={formats}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Cut / Finish</label>
                <SmartCombobox
                  value={formData.cornerType || "Square Cut"}
                  onChange={(val) => {
                    handleFieldChange("cornerType", val);
                    onMarkUnsaved();
                  }}
                  onAddNew={(newCut) => addCornerType(newCut)}
                  searchPlaceholder="Search or type new cut..."
                  allowCustom={true}
                  options={cornerTypes}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Width ({formData.dimensionUnit || "mm"})</label>
                <Input 
                  type="number"
                  value={formData.width ?? 50} 
                  onChange={(e) => handleFieldChange("width", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Height ({formData.dimensionUnit || "mm"})</label>
                <Input 
                  type="number"
                  value={formData.height ?? 90} 
                  onChange={(e) => handleFieldChange("height", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Bleed (mm)</label>
                <Input 
                  type="number"
                  value={formData.bleed ?? 2} 
                  onChange={(e) => handleFieldChange("bleed", Number(e.target.value))}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Paper / Substrate Stock</label>
                <SmartCombobox
                  value={formData.paperStock || "Galerie Art Silk 150g/m²"}
                  onChange={(val) => {
                    handleFieldChange("paperStock", val);
                    onMarkUnsaved();
                  }}
                  onAddNew={(newStock) => addPaperStock(newStock)}
                  searchPlaceholder="Search or type new stock..."
                  allowCustom={true}
                  options={paperStocks}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Surface Coating / Finish</label>
                <SmartCombobox
                  value={formData.coating || "Soft-Touch Matte + Spot UV"}
                  onChange={(val) => {
                    handleFieldChange("coating", val);
                    onMarkUnsaved();
                  }}
                  onAddNew={(newCoating) => addCoating(newCoating)}
                  searchPlaceholder="Search or type new finish..."
                  allowCustom={true}
                  options={coatings}
                />
              </div>
            </div>

            {/* Drill Hole & Eyelet Punch Specifications */}
            <div className="pt-2.5 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5 text-blue-600" />
                  <span>{tEnhance("holeSpecsTitle")}</span>
                </label>
                {effectiveHoleSize > 0 && effectiveHolePos !== "none" ? (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    Ø{effectiveHoleSize}mm • {effectiveHolePos} (+{effectiveHoleOffset}mm)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono text-zinc-500">
                    {tEnhance("posNone")}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                    {tEnhance("holeSize")} (mm)
                  </label>
                  <Select
                    value={String(effectiveHoleSize)}
                    onValueChange={(val) => {
                      const sizeNum = Number(val);
                      handleFieldChange("holeSize", sizeNum);
                      if (sizeNum === 0) {
                        handleFieldChange("holePosition", "none");
                      } else if (effectiveHolePos === "none") {
                        handleFieldChange("holePosition", "top-center");
                      }
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 mm ({tEnhance("posNone")})</SelectItem>
                      <SelectItem value="3">Ø3 mm (Cord)</SelectItem>
                      <SelectItem value="4">Ø4 mm (Standard)</SelectItem>
                      <SelectItem value="5">Ø5 mm (Heavy Cord)</SelectItem>
                      <SelectItem value="6">Ø6 mm (Grommet)</SelectItem>
                      <SelectItem value="8">Ø8 mm (Euro Slot)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                    {tEnhance("holePosition")}
                  </label>
                  <Select
                    value={effectiveHolePos}
                    onValueChange={(val: any) => {
                      handleFieldChange("holePosition", val);
                      if (val !== "none" && effectiveHoleSize === 0) {
                        handleFieldChange("holeSize", 4);
                      }
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-center">{tEnhance("posTopCenter")}</SelectItem>
                      <SelectItem value="top-left">{tEnhance("posTopLeft")}</SelectItem>
                      <SelectItem value="top-right">{tEnhance("posTopRight")}</SelectItem>
                      <SelectItem value="left-center">{tEnhance("posLeftCenter")}</SelectItem>
                      <SelectItem value="right-center">{tEnhance("posRightCenter")}</SelectItem>
                      <SelectItem value="none">{tEnhance("posNone")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-500 block mb-1">
                    {tEnhance("holeOffset")} (mm)
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    disabled={effectiveHolePos === "none" || effectiveHoleSize === 0}
                    value={effectiveHoleOffset}
                    onChange={(e) => {
                      handleFieldChange("holeOffset", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Card: Printing Inks & Colors Stations */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              <span>{tEnhance("colorStationsTitle")}</span>
            </div>

                {/* Dynamic Channel Dots & Notation */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700/60 text-[11px] font-mono shadow-2xs">
                    <span className="text-[10px] text-zinc-500 font-sans uppercase font-bold mr-0.5">F:</span>
                    {frontColors.c && <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block shadow-2xs" title="Cyan (C) - Face" />}
                    {frontColors.m && <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block shadow-2xs" title="Magenta (M) - Face" />}
                    {frontColors.y && <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-2xs" title="Yellow (Y) - Face" />}
                    {frontColors.k && <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 dark:bg-zinc-100 border border-zinc-400 inline-block shadow-2xs" title="Key / Black (K) - Face" />}
                    {frontSpots.map((spot) => (
                      <span
                        key={`dot-f-${spot.id}`}
                        className="w-2.5 h-2.5 rounded-full inline-block shadow-2xs border border-white/50"
                        style={{ backgroundColor: spot.hex }}
                        title={`${spot.name} - Face`}
                      />
                    ))}
                    {frontTotal === 0 && <span className="text-zinc-400 text-[10px]">0</span>}

                    <span className="text-zinc-300 dark:text-zinc-600 mx-0.5 font-sans">/</span>

                    <span className="text-[10px] text-zinc-500 font-sans uppercase font-bold mr-0.5">R:</span>
                    {backColors.c && <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block shadow-2xs" title="Cyan (C) - Reverse" />}
                    {backColors.m && <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block shadow-2xs" title="Magenta (M) - Reverse" />}
                    {backColors.y && <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-2xs" title="Yellow (Y) - Reverse" />}
                    {backColors.k && <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 dark:bg-zinc-100 border border-zinc-400 inline-block shadow-2xs" title="Key / Black (K) - Reverse" />}
                    {backSpots.map((spot) => (
                      <span
                        key={`dot-b-${spot.id}`}
                        className="w-2.5 h-2.5 rounded-full inline-block shadow-2xs border border-white/50"
                        style={{ backgroundColor: spot.hex }}
                        title={`${spot.name} - Reverse`}
                      />
                    ))}
                    {backTotal === 0 && <span className="text-zinc-400 text-[10px]">0</span>}
                  </div>

                  <Badge variant="outline" className="h-6 px-2 text-xs font-mono font-bold bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    {dynamicColorNotation}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                {/* Preset Selector + Add Spot Button Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-medium">Preset:</span>
                  <div className="w-48">
                    <Select
                      value={
                        dynamicColorNotation === "4+0" && spotColorItems.length === 0
                          ? "4+0"
                          : dynamicColorNotation === "4+4" && spotColorItems.length === 0
                          ? "4+4"
                          : dynamicColorNotation === "4+1" && spotColorItems.length === 0
                          ? "4+1"
                          : dynamicColorNotation === "1+0" && spotColorItems.length === 0
                          ? "1+0"
                          : dynamicColorNotation === "1+1" && spotColorItems.length === 0
                          ? "1+1"
                          : dynamicColorNotation === "5+0"
                          ? "5+0"
                          : "custom"
                      }
                      onValueChange={(val: any) => val && handleApplyColorPreset(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-medium">
                        <SelectValue placeholder="Preset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4+0">4+0 (CMYK Single-Side)</SelectItem>
                        <SelectItem value="4+4">4+4 (CMYK Both Sides)</SelectItem>
                        <SelectItem value="4+1">4+1 (CMYK Face / K Reverse)</SelectItem>
                        <SelectItem value="1+0">1+0 (Monochrome Black)</SelectItem>
                        <SelectItem value="1+1">1+1 (Black Both Sides)</SelectItem>
                        <SelectItem value="5+0">5+0 (CMYK + 1 Spot)</SelectItem>
                        <SelectItem value="custom">Custom Configuration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPantoneModalOpen(true)}
                  className="h-8 px-2.5 text-xs text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  <span>{tEnhance("addSpotColor")}</span>
                </Button>
              </div>

              {/* Side Channels & Spots Configuration */}
              <div className="space-y-2 pt-1">
                {/* Face (Front Side) */}
                <div className="p-2.5 rounded-md bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>{tEnhance("frontSide")}</span>
                      <span className="text-[11px] font-mono text-zinc-400 font-normal">({frontTotal} stations)</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Channel Toggles */}
                    <button
                      type="button"
                      onClick={() => handleToggleFrontChannel("c")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        frontColors.c
                          ? "bg-cyan-500 text-white border-cyan-600"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Cyan (Face)"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFrontChannel("m")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        frontColors.m
                          ? "bg-pink-500 text-white border-pink-600"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Magenta (Face)"
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFrontChannel("y")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        frontColors.y
                          ? "bg-amber-400 text-zinc-950 border-amber-500"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Yellow (Face)"
                    >
                      Y
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFrontChannel("k")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        frontColors.k
                          ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-800 dark:border-zinc-300"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Black (Face)"
                    >
                      K
                    </button>

                    {/* Front Spots */}
                    {frontSpots.map((spot) => (
                      <Badge
                        key={`front-spot-${spot.id}`}
                        variant="outline"
                        className="h-7 px-2 text-xs font-mono font-medium bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-foreground gap-1.5 shadow-2xs"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                          style={{ backgroundColor: spot.hex }}
                        />
                        <span className="truncate max-w-[150px]">{spot.name}</span>
                        {spot.side === "both" && (
                          <span className="text-[10px] text-zinc-400 font-sans">(both)</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveSpotStation(spot.id)}
                          className="text-zinc-400 hover:text-red-500 cursor-pointer ml-0.5"
                          title="Remove spot station"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Reverse (Back Side) */}
                <div className="p-2.5 rounded-md bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      <span>{tEnhance("backSide")}</span>
                      <span className="text-[11px] font-mono text-zinc-400 font-normal">({backTotal} stations)</span>
                    </span>

                    {backTotal === 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleFieldChange("backColors", { c: false, m: false, y: false, k: true });
                          onMarkUnsaved();
                        }}
                        className="h-5 text-[11px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                      >
                        {tEnhance("addBackPrint")}
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Channel Toggles */}
                    <button
                      type="button"
                      onClick={() => handleToggleBackChannel("c")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        backColors.c
                          ? "bg-cyan-500 text-white border-cyan-600"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Cyan (Reverse)"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBackChannel("m")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        backColors.m
                          ? "bg-pink-500 text-white border-pink-600"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Magenta (Reverse)"
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBackChannel("y")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        backColors.y
                          ? "bg-amber-400 text-zinc-950 border-amber-500"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Yellow (Reverse)"
                    >
                      Y
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBackChannel("k")}
                      className={cn(
                        "w-7 h-7 rounded text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer border shadow-2xs",
                        backColors.k
                          ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-800 dark:border-zinc-300"
                          : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 line-through opacity-60"
                      )}
                      title="Toggle Black (Reverse)"
                    >
                      K
                    </button>

                    {/* Back Spots */}
                    {backSpots.map((spot) => (
                      <Badge
                        key={`back-spot-${spot.id}`}
                        variant="outline"
                        className="h-7 px-2 text-xs font-mono font-medium bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-foreground gap-1.5 shadow-2xs"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                          style={{ backgroundColor: spot.hex }}
                        />
                        <span className="truncate max-w-[150px]">{spot.name}</span>
                        {spot.side === "both" && (
                          <span className="text-[10px] text-zinc-400 font-sans">(both)</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveSpotStation(spot.id)}
                          className="text-zinc-400 hover:text-red-500 cursor-pointer ml-0.5"
                          title="Remove spot station"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}

                    {backTotal === 0 && (
                      <span className="text-xs text-muted-foreground italic font-sans ml-2">
                        {tEnhance("blankBack")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Card 4: Standalone 2D Die-Line & Dimension Inspector */}
        <DieLinePreview
          width={Number(formData.width) || 50}
          height={Number(formData.height) || 90}
          bleed={Number(formData.bleed) ?? 2}
          dimensionUnit={formData.dimensionUnit || "mm"}
          cornerType={formData.cornerType || "Square Cut"}
          itemCategory={formData.itemCategory || "Hangtag"}
          totalQuantity={formData.quantity}
          paperStock={formData.paperStock}
          holeSize={effectiveHoleSize}
          holePosition={effectiveHolePos}
          holeOffset={effectiveHoleOffset}
          onOpenLayoutTab={() => onSwitchTab("layout")}
          onFlipOrientation={() => {
            const currentW = formData.width || 50;
            const currentH = formData.height || 90;
            handleFieldChange("width", currentH);
            handleFieldChange("height", currentW);
            onMarkUnsaved();
          }}
        />

        {/* Card 5: Production Equipment & Scheduling */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
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
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
                          <span>No site found.</span>
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
                            className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-medium mt-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add new facility site</span>
                          </button>
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
                            className="py-1.5 px-2.5 cursor-pointer text-xs flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium border-t border-zinc-100 dark:border-zinc-800 mt-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add new facility site...</span>
                          </CommandItem>
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
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium shrink-0", activeTech.badgeClass)}>
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
                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-normal", tech.badgeClass)}>
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
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Ready
                    </span>
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
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">{mach.department}</Badge>
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
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">{tOrder("shiftStartLabel")}</label>
                <DatePicker 
                  value={formData.startDate} 
                  onChange={(val) => handleFieldChange("startDate", val)}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">{tOrder("deadlineLabel")}</label>
                <DatePicker 
                  value={formData.deadline} 
                  onChange={(val) => handleFieldChange("deadline", val)}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" 
                />
              </div>
            </div>
          </div>
        </div>



        {/* Card: Planned Size & Variation Breakdown */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
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
        <div className="md:col-span-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5 flex flex-col">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <span>Attached Files & Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">
                ({orderAttachments.length})
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5 gap-1.5 rounded cursor-pointer"
                onClick={() => document.getElementById("wo-doc-upload-input")?.click()}
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
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
                      <AttachmentActions className="shrink-0 ml-2 flex items-center gap-1.5">
                        {file.url && (
                          <AttachmentAction 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(file);
                            }}
                            className="h-7 w-7 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded cursor-pointer"
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
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive text-zinc-400 rounded cursor-pointer"
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

        {/* Right Column (1/3 width on xl screens, stacks gracefully on smaller screens) */}
        <div className="xl:col-span-1 space-y-4">
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
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
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
                        className="flex-1 min-w-0 h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                      />
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shrink-0">
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
                                        <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 shrink-0 font-normal">
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
                  className="h-8 px-2.5 gap-1.5 text-xs shrink-0 border-zinc-200 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
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
                        <TableCell className="p-2 px-2 font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]" title={mat.name}>
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
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900 text-[10px] px-1.5 py-0.5 shadow-none font-medium">Shortage</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 text-[10px] px-1.5 py-0.5 shadow-none font-medium">Available</Badge>
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
              className="w-full h-8 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Full Materials BOM & Stock Allocations</span>
            </Button>
          </div>
        </div>

        {/* Card 4: Financial Calculation & Costing (Manager View) OR Operator Notice (Operator View) */}
        {viewMode === "operator" ? (
          <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-lg shadow-2xs space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>{tEnhance("operatorNotice")}</span>
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold text-[10px]">OPERATOR MODE</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tEnhance("operatorNoticeDesc")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/20 text-xs font-mono">
              <div className="bg-white/60 dark:bg-zinc-900/60 p-2 rounded border border-amber-500/20">
                <span className="text-[10px] text-muted-foreground block">Assigned Equipment</span>
                <span className="font-bold text-foreground truncate block">{formData.pressMachine}</span>
              </div>
              <div className="bg-white/60 dark:bg-zinc-900/60 p-2 rounded border border-amber-500/20">
                <span className="text-[10px] text-muted-foreground block">Target Run Quantity</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 block">{formData.quantity.toLocaleString()} {formData.unit}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3.5">
            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
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
        )}

        {/* Card 5: Shift Handover Notes Log */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xs space-y-3 flex flex-col">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>{tEnhance("shiftNotesTitle")}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {((formData.shiftNotes && formData.shiftNotes.length > 0) ? formData.shiftNotes : defaultShiftNotes).length} notes
            </span>
          </div>

          {/* New note input form */}
          <div className="space-y-2 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-2">
              <Select value={newShiftType} onValueChange={(val: any) => setNewShiftType(val)}>
                <SelectTrigger className="h-7 text-xs bg-white dark:bg-zinc-900">
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
                className="h-7 text-xs bg-white dark:bg-zinc-900"
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
                className="h-7 text-xs bg-white dark:bg-zinc-900 flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddShiftNote}
                disabled={!newNoteText.trim()}
                className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>{tEnhance("addNote")}</span>
              </Button>
            </div>
          </div>

          {/* Existing notes list */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {((formData.shiftNotes && formData.shiftNotes.length > 0) ? formData.shiftNotes : defaultShiftNotes).map((note) => (
              <div
                key={note.id}
                className="p-2 rounded bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-1 py-0 text-[9.5px]",
                        note.shift === "Morning" && "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40",
                        note.shift === "Evening" && "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/40",
                        note.shift === "Night" && "text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/40"
                      )}
                    >
                      {note.shift}
                    </Badge>
                    <span className="font-semibold text-foreground">{note.author}</span>
                  </div>
                  <span>{note.time}</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 leading-snug">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </TabsContent>
  );
}
