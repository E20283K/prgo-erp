"use client";

export function getDisplayImageUrl(src?: string | null): string {
  if (!src) return "";
  if (src.startsWith("/api/v1/storage/file") || src.startsWith("blob:") || src.startsWith("data:") || src.startsWith("/")) {
    return src;
  }
  if (src.includes(":9000/") || src.includes("X-Amz-Signature") || src.includes("printgoo-prepress")) {
    try {
      const parsed = new URL(src.startsWith("http") ? src : `http://localhost:9000${src.startsWith("/") ? "" : "/"}${src}`);
      let key = parsed.pathname.replace(/^\/+/, "");
      if (key.startsWith("printgoo-prepress/")) {
        key = key.replace(/^printgoo-prepress\//, "");
      }
      return `/api/v1/storage/file?path=${encodeURIComponent(key)}`;
    } catch (_) {}
    return `/api/v1/storage/file?path=${encodeURIComponent(src.split("?")[0])}`;
  }
  return src;
}

import React, { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Tag,
  Factory,
  Boxes,
  Layers,
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
  Calculator,
  Scissors,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, type CrmCustomerRecord } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
  SizeDistribution,
  parseModelAndSize,
  MasterSpecification,
  SiteOption,
  TechOption,
  MachineOption,
  OrderAttachment,
  ProductionMilestone,
  ShiftNote,
  SpotColorItem,
  SideColorConfig,
  SITE_OPTIONS,
  TECHNOLOGY_OPTIONS,
  MACHINE_OPTIONS,
  MASTER_SPECIFICATIONS,
  calculateKashirovkaTotals,
  getDefaultKashirovkaLayers,
  WorkOrderSampleData,
  generateSuggestedProductName,
  ProductNameNamingPreset,
  RouteStep,
} from "../types";
import { BomItem } from "../../BomMaterialsGrid";
import { formatMoney, getCurrencySymbol } from "../../common/DocumentShell";

interface OverviewTabProps {
  onSelectProductTemplate?: (spec: MasterSpecification) => void;
  formData: WorkOrderFormData;
  handleFieldChange: (field: string, val: any) => void;
  handleSizesChange?: (newSizes: SizeDistribution[]) => void;
  handleDepartmentChange: (dept: string) => void;
  data: any;
  tabId: string;
  activeSpec: MasterSpecification | undefined;
  activeSite: SiteOption;
  activeTech: TechOption;
  activeMachine: MachineOption | undefined;
  currentDeptMachines: MachineOption[];
  currentRecipeMaterials: { name: string; req: number; unit: string; stock: number }[];
  materials?: BomItem[];
  operations?: RouteStep[];
  hasShortage: boolean;
  orderAttachments: OrderAttachment[];
  setOrderAttachments: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  sampleData?: WorkOrderSampleData;
  onSampleChange?: (field: keyof WorkOrderSampleData, val: any) => void;
  onOpenLightbox: () => void;
  onOpenTab: (tab: any) => void;
  onSwitchTab: (tabKey: string) => void;
  onMarkUnsaved: () => void;
  isOperator?: boolean;
  onToggleOperatorMode?: (mode: "manager" | "operator") => void;
  tOrder: (key: string) => string;
}

import { OrderReadinessRouteCard } from "../OrderReadinessRouteCard";
import { FilePreviewDialog } from "@/components/file-viewer/FilePreviewDialog";
import { FILE_KIND_ICON, getFileKind, isPreviewable, downloadFile, ViewableFile } from "@/components/file-viewer/file-utils";
import { useLookupStore } from "@/store/lookupStore";
import { calculatePrintPlanning } from "../planningEngine";

const FOLD_TYPE_LABELS: Record<string, string> = {
  center_fold: "Markazdan buklama (Center fold)",
  end_fold: "Ikki chekkadan (End fold)",
  straight_cut: "To'g'ri kesim (Straight cut)",
  manhattan_fold: "Kitobcha (Manhattan fold)",
  mitre_fold: "Manjetli (Mitre fold)",
  roll: "Rulonda (Continuous roll)",
};

const CUT_TYPE_LABELS: Record<string, string> = {
  ultrasonic: "Ultrasonik (Soft edge)",
  laser: "Lazerli kesim",
  hot_knife: "Issiq pichoq (Hot cut)",
  cold_knife: "Sovuq pichoq (Cold cut)",
};

const WEAVE_QUALITY_LABELS: Record<string, string> = {
  damask_50d: "Damask 50D (High Density)",
  damask_100d: "Damask 100D (Standart)",
  woven_satin: "To'qima satin (Satin)",
  taffeta: "Taffeta (Yupqa asos)",
  hd_microfiber: "HD Microfiber",
};

const RIBBON_MATERIAL_LABELS: Record<string, string> = {
  nylon_taffeta: "Neylon Taffeta (Oq)",
  polyester_satin_white: "Poliester Satin (Oq)",
  polyester_satin_black: "Poliester Satin (Qora)",
  cotton_tape: "Paxta lentasi (100% Cotton)",
  recycled_poly: "Qayta ishlangan poliester (Eco)",
};

const WASH_RESISTANCE_LABELS: Record<string, string> = {
  "40c": "40°C Standart",
  "60c": "60°C Yuqori harorat",
  "90c_boil": "90°C Qaynatish / Toshli",
  dry_clean: "Kimyoviy tozalash (Dry clean)",
};

export function OverviewTab({
  onSelectProductTemplate,
  formData,
  handleFieldChange,
  handleSizesChange,
  handleDepartmentChange,
  data,
  tabId,
  activeSpec,
  activeSite,
  activeTech,
  activeMachine,
  currentDeptMachines,
  currentRecipeMaterials,
  materials = [],
  operations = [],
  hasShortage,
  orderAttachments,
  setOrderAttachments,
  sampleData,
  onSampleChange,
  onOpenLightbox,
  onOpenTab,
  onSwitchTab,
  onMarkUnsaved,
  isOperator: initialIsOperator,
  onToggleOperatorMode,
  tOrder,
}: OverviewTabProps) {
  const {
    customers,
    sites,
    addCustomer,
    addSite,
    syncWithServer,
  } = useLookupStore();
  const {
    masterSpecifications,
    crmCustomers,
    loadCrmCustomers,
    upsertCustomerAsync,
    openTab,
  } = useWorkspaceStore();

  useEffect(() => {
    loadCrmCustomers();
    syncWithServer();
  }, [loadCrmCustomers, syncWithServer]);

  // Real customer options from CRM database (PostgreSQL)
  const customerOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    // 1. Database CRM Clients
    for (const c of crmCustomers) {
      const name = c.name?.trim();
      if (!name) continue;
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push({ value: c.name, label: c.name });
      }
    }

    // 2. Locally cached/synced customers
    for (const name of customers) {
      const clean = name?.trim();
      if (!clean) continue;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push({ value: clean, label: clean });
      }
    }

    // 3. Ensure current formData.customer is present
    if (formData.customer) {
      const current = formData.customer.trim();
      if (current && !seen.has(current.toLowerCase())) {
        list.unshift({ value: current, label: current });
      }
    }

    return list;
  }, [crmCustomers, customers, formData.customer]);

  const handleAddNewCustomer = async (newCust: string) => {
    const clean = newCust.trim();
    if (!clean) return;
    addCustomer(clean);
    const existingIds = crmCustomers
      .map((c) => parseInt(c.id.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : Math.floor(100 + Math.random() * 899);
    const newRecord: CrmCustomerRecord = {
      id: `CUST-${nextNum}`,
      name: clean,
      tin: "",
      industry: "General",
      contactPerson: "",
      phone: "",
      email: "",
      contractNo: "",
      paymentTerms: "",
      manager: "",
      status: "New",
      contacts: [],
      contracts: [],
    };
    await upsertCustomerAsync(newRecord);
    handleFieldChange("customer", clean);
    onMarkUnsaved();

    // Open CustomerDetail tab
    openTab({
      id: newRecord.id,
      title: `${newRecord.id}: ${clean}`,
      type: "customer",
      module: "crm",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: newRecord,
    });
  };

  const handleOpenNewCustomer = (initialName?: string) => {
    const clean = (initialName || "").trim();
    const existingIds = crmCustomers
      .map((c) => parseInt(c.id.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : Math.floor(100 + Math.random() * 899);
    const newId = `CUST-${nextNum}`;

    const newRecord: CrmCustomerRecord = {
      id: newId,
      name: clean,
      tin: "",
      industry: "General",
      contactPerson: "",
      phone: "",
      email: "",
      contractNo: "",
      paymentTerms: "",
      manager: "",
      status: "New",
      contacts: [],
      contracts: [],
    };

    if (clean) {
      addCustomer(clean);
      upsertCustomerAsync(newRecord);
      handleFieldChange("customer", clean);
      onMarkUnsaved();
    }

    // Open CustomerDetail tab
    openTab({
      id: newRecord.id,
      title: clean ? `${newRecord.id}: ${clean}` : `${newRecord.id}: ${tOrder("newCustomer") || "Yangi mijoz"}`,
      type: "customer",
      module: "crm",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: newRecord,
    });
  };

  const handleOpenCurrentCustomer = () => {
    if (!formData.customer) return;
    const clean = formData.customer.trim().toLowerCase();
    const matched = crmCustomers.find(
      (c) =>
        c.name.toLowerCase() === clean ||
        c.name.toLowerCase().includes(clean) ||
        clean.includes(c.name.toLowerCase())
    );

    const custId = matched?.id || `CUST-${Math.floor(100 + Math.random() * 899)}`;
    const custRecord: CrmCustomerRecord = matched || {
      id: custId,
      name: formData.customer,
      tin: "",
      industry: "General",
      contactPerson: "",
      phone: "",
      email: "",
      contractNo: "",
      paymentTerms: "",
      manager: "",
      status: "Active",
      contacts: [],
      contracts: [],
    };

    openTab({
      id: custRecord.id,
      title: `${custRecord.id}: ${custRecord.name}`,
      type: "customer",
      module: "crm",
      activeLevel3Tab: "overview",
      documentData: custRecord,
    });
  };

  const [isSiteComboboxOpen, setIsSiteComboboxOpen] = useState(false);
  const [isTechComboboxOpen, setIsTechComboboxOpen] = useState(false);
  const [isMachineComboboxOpen, setIsMachineComboboxOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ViewableFile | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const tEnhance = useTranslations("OverviewEnhancements");

  const [viewMode, setViewMode] = useState<"manager" | "operator">(
    initialIsOperator ? "operator" : "manager"
  );
  const isOperator = viewMode === "operator";

  // Department technology flags
  const isFlexo = formData.department === "Flexo" || (formData.recipe ? formData.recipe.startsWith("FLEXO_") : false);
  const isJacquard = formData.department === "Jacquard" || (formData.recipe ? formData.recipe.startsWith("JACQ_") : false);
  const isOffset = !isFlexo && !isJacquard;

  // Dynamic Inks & Printing Stations (Read-only summary derived from Specs & Drawing)
  const frontColors: SideColorConfig = formData.frontColors || { c: false, m: false, y: false, k: false };
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
      : []
  );

  const frontProcessCount = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
  const frontSpots = spotColorItems.filter((s) => s.side === "front" || s.side === "both");
  const frontTotal = frontProcessCount + frontSpots.length;

  const backProcessCount = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);
  const backSpots = spotColorItems.filter((s) => s.side === "back" || s.side === "both");
  const backTotal = backProcessCount + backSpots.length;

  const dynamicColorNotation = `${frontTotal}+${backTotal}`;

  // Effective Hole Parameters
  const effectiveHoleSize = formData.holeSize !== undefined
    ? formData.holeSize
    : (formData.itemCategory === "Hangtag" ? 4 : 0);
  const effectiveHolePos = (formData.holePosition || (formData.itemCategory === "Hangtag" ? "top-center" : "none")) as "top-center" | "top-left" | "top-right" | "left-center" | "right-center" | "both-sides-fold" | "none";
  const effectiveHoleOffset = formData.holeOffset ?? 6;

  // Multi-Layer Mounting (Kashirovka) Calculations
  const kashirovkaMode = formData.kashirovkaMode || "none";
  const kashirovkaLayers = useMemo(() => {
    if (kashirovkaMode === "none") return [];
    if (formData.kashirovkaLayers && formData.kashirovkaLayers.length > 0) {
      return formData.kashirovkaLayers;
    }
    return getDefaultKashirovkaLayers(kashirovkaMode, formData.paperStock, formData.coating);
  }, [kashirovkaMode, formData.kashirovkaLayers, formData.paperStock, formData.coating]);

  const kashirovkaTotals = useMemo(
    () => calculateKashirovkaTotals(kashirovkaMode, kashirovkaLayers, formData.kashirovkaGlueGsm ?? 25),
    [kashirovkaMode, kashirovkaLayers, formData.kashirovkaGlueGsm]
  );

  // Size Breakdown Calculations
  const hasSizes = Boolean(formData.sizes && formData.sizes.length > 0);
  const totalSizesQty = formData.sizes?.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0) ?? 0;

  // Print Planning Engine calculation (Front/Back printing, CTP plates, sheets, impressions)
  const printPlan = useMemo(() => {
    return calculatePrintPlanning({
      targetQuantity: formData.quantity || 0,
      piecesPerSheet: hasSizes && formData.sizes ? formData.sizes.length : 10,
      frontColors: formData.frontColors || { c: false, m: false, y: false, k: false },
      backColors: formData.backColors || { c: false, m: false, y: false, k: false },
      spotColors: spotColorItems,
      printMethod: formData.printMethod,
      parentSheetW: formData.parentSheetW || 1000,
      parentSheetH: formData.parentSheetH || 700,
      pressSheetW: formData.pressSheetW || 500,
      pressSheetH: formData.pressSheetH || 700,
      paperGsm: 300,
    });
  }, [
    formData.quantity,
    hasSizes,
    formData.sizes,
    formData.frontColors,
    formData.backColors,
    spotColorItems,
    formData.printMethod,
    formData.parentSheetW,
    formData.parentSheetH,
    formData.pressSheetW,
    formData.pressSheetH,
  ]);

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

  // Auto-suggested product name calculations based on ERP order parameters
  const suggestedProductName = useMemo(() => {
    return generateSuggestedProductName(formData, "standard");
  }, [
    formData.customer,
    formData.itemCategory,
    formData.boxType,
    formData.foldType,
    formData.width,
    formData.height,
    formData.boxDepth,
    formData.dimensionUnit,
    formData.department,
    formData.paperStock,
    formData.colorsConfig,
    formData.lamination,
    formData.coating,
  ]);

  const compactSuggestedName = useMemo(() => {
    return generateSuggestedProductName(formData, "compact");
  }, [
    formData.customer,
    formData.itemCategory,
    formData.boxType,
    formData.foldType,
    formData.width,
    formData.height,
    formData.boxDepth,
    formData.dimensionUnit,
    formData.department,
  ]);

  const technicalSuggestedName = useMemo(() => {
    return generateSuggestedProductName(formData, "technical");
  }, [
    formData.itemCategory,
    formData.boxType,
    formData.foldType,
    formData.width,
    formData.height,
    formData.boxDepth,
    formData.dimensionUnit,
    formData.department,
    formData.paperStock,
    formData.colorsConfig,
    formData.lamination,
    formData.coating,
  ]);

  const [isNamingPopoverOpen, setIsNamingPopoverOpen] = useState(false);

  const handleApplySuggestedName = (preset: ProductNameNamingPreset = "standard") => {
    let chosen = "";
    if (preset === "compact") chosen = compactSuggestedName;
    else if (preset === "technical") chosen = technicalSuggestedName;
    else chosen = suggestedProductName;

    // Retain custom quote suffix if present, e.g. — "Brand / Notes"
    const currentName = formData.product || "";
    const quoteMatch = currentName.match(/(?:—|-)\s*"([^"]+)"\s*$/);
    if (quoteMatch && quoteMatch[1]) {
      chosen = generateSuggestedProductName(formData, preset, quoteMatch[1]);
    }

    handleFieldChange("product", chosen);
    onMarkUnsaved();
    setIsNamingPopoverOpen(false);
  };


  return (
    <TabsContent value="overview" className="@container flex-1 overflow-y-auto p-4 m-0 space-y-4">
      <FilePreviewDialog 
        isOpen={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile} 
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

          <div className="hidden md:block h-4 w-px bg-border" />

          {/* View Mode Switcher (👔 Manager View vs 👷 Operator View) */}
          <div className="inline-flex items-center p-0.5 rounded-full bg-muted border border-border shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode("manager");
                onToggleOperatorMode?.("manager");
              }}
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
              onClick={() => {
                setViewMode("operator");
                onToggleOperatorMode?.("operator");
              }}
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
        </div>
      </div>

      <div className="grid grid-cols-1 @7xl:grid-cols-3 gap-4">
        {/* Left Column (2/3 width on xl screens) */}
        <div className="@container @7xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4 items-start">
        {/* Card 1: Order Photo & Sample Reference (Strict Square Aspect Ratio) */}
        <div className="@container p-4 bg-card border border-border rounded-lg flex flex-col w-full aspect-square self-start">
          <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
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

          <div className="flex-1 min-h-0 flex flex-col pt-2">
            {photos.length > 0 ? (
              <div className="relative group w-full h-full flex-1 min-h-0 rounded overflow-hidden bg-muted/30 border border-border/80">
                <Carousel
                  setApi={setCarouselApi}
                  className="w-full h-full"
                  opts={{ loop: true }}
                >
                  <CarouselContent className="h-full ml-0">
                    {photos.map((src, index) => (
                      <CarouselItem key={`${src}-${index}`} className="pl-0 h-full relative flex items-center justify-center">
                        <img
                          src={getDisplayImageUrl(src)}
                          alt={`${tOrder("sampleProofTitle")} ${index + 1}`}
                          className="w-full h-full object-cover select-none cursor-pointer"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            if (target.src !== "/sample-proof.jpg" && !target.src.endsWith("/sample-proof.jpg")) {
                              target.src = "/sample-proof.jpg";
                            }
                          }}
                          onClick={() => {
                            handleFieldChange("photoUrl", photos[activePhotoIndex] || photos[0]);
                            onOpenLightbox();
                          }}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  {photos.length > 1 && (
                    <>
                      <CarouselPrevious
                        variant="secondary"
                        size="icon-xs"
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/90 hover:bg-background shadow-xs border-border opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      />
                      <CarouselNext
                        variant="secondary"
                        size="icon-xs"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/90 hover:bg-background shadow-xs border-border opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      />
                    </>
                  )}
                </Carousel>

                {/* Hover Actions */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-foreground cursor-pointer"
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
                      className="h-6 w-6 rounded bg-background/90 hover:bg-background shadow-xs text-muted-foreground hover:text-destructive cursor-pointer"
                      title={tOrder("removePhoto")}
                      onClick={() => handleRemovePhoto(activePhotoIndex)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Minimalist Floating Thumbnails */}
                {photos.length > 1 && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1 py-0.5 rounded bg-background/80 backdrop-blur-xs border border-border/60 shadow-2xs max-w-[90%] overflow-x-auto z-10">
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
                        <img
                          src={getDisplayImageUrl(src)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            if (target.src !== "/sample-proof.jpg" && !target.src.endsWith("/sample-proof.jpg")) {
                              target.src = "/sample-proof.jpg";
                            }
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "border border-dashed border-border rounded p-4 flex flex-col items-center justify-center text-center bg-muted/20 transition-colors w-full h-full flex-1",
                  !isOperator && "hover:border-border/80 cursor-pointer"
                )}
                onClick={!isOperator ? () => document.getElementById("wo-photo-add-input")?.click() : undefined}
              >
                <ImageIcon className="w-5 h-5 text-muted-foreground mb-1.5" />
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
                onChange={async (e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    const uploadedUrls: string[] = [];
                    const newAttachments: OrderAttachment[] = [];
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      let finalUrl = "";
                      try {
                        const res = await fetch(`/api/v1/production/work-orders/${data?.docNo || tabId}/files`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            docNo: data?.docNo || tabId,
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: `${(file.size / 1024).toFixed(1)} KB`,
                            category: "proofs",
                          }),
                        });
                        const resData = await res.json();
                        if (resData.success && resData.uploadUrl) {
                          await fetch(resData.uploadUrl, {
                            method: "PUT",
                            headers: { "Content-Type": file.type },
                            body: file,
                          });
                          finalUrl = resData.downloadUrl;
                          uploadedUrls.push(finalUrl);
                        } else {
                          finalUrl = URL.createObjectURL(file);
                          uploadedUrls.push(finalUrl);
                        }
                      } catch {
                        // Fallback to durable base64 DataURL if S3/network is unreachable
                        finalUrl = await new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => resolve(ev.target?.result as string || "");
                          reader.readAsDataURL(file);
                        });
                        uploadedUrls.push(finalUrl);
                      }

                      newAttachments.push({
                        id: `att-proof-${Date.now()}-${i}`,
                        name: file.name,
                        size: `${(file.size / 1024).toFixed(1)} KB`,
                        type: file.type || "image/jpeg",
                        date: new Date().toISOString().slice(0, 16).replace("T", " "),
                        isImage: true,
                        url: finalUrl,
                      });
                    }

                    // 1. Yangilangan rasmlar galereyasi
                    const updatedPhotos = [...photos, ...uploadedUrls];
                    handleFieldChange("photoUrls", updatedPhotos);
                    if (!formData.photoUrl && uploadedUrls[0]) {
                      handleFieldChange("photoUrl", uploadedUrls[0]);
                    }

                    // 2. "Fayllar va hujjatlar" (FilesTab) bo'limiga biriktirish
                    if (setOrderAttachments) {
                      setOrderAttachments((prev) => [...newAttachments, ...prev]);
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
                onAddNew={handleAddNewCustomer}
                options={customerOptions}
                placeholder={tOrder("selectCustomer") || "Select customer..."}
                searchPlaceholder={tOrder("searchCustomer") || "Search or type new customer..."}
                actionLabel={tOrder("addCustomer") || "Yangi mijoz qo'shish"}
                onAction={(search) => handleOpenNewCustomer(search)}
                className="h-8 text-xs bg-muted/30 w-full"
                popoverClassName="w-auto min-w-[280px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">{tOrder("productLabel")}</label>
                {!isOperator && (
                  <Popover open={isNamingPopoverOpen} onOpenChange={setIsNamingPopoverOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-5 px-1.5 text-[11px] text-primary hover:text-primary hover:bg-primary/10 gap-1 font-medium transition-colors cursor-pointer"
                          title={tOrder("autoNamingTooltip")}
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>{tOrder("autoNaming")}</span>
                          <ChevronsUpDown className="w-2.5 h-2.5 opacity-60" />
                        </Button>
                      }
                    />
                    <PopoverContent align="end" className="w-80 p-2 text-xs space-y-2 bg-popover border border-border shadow-lg z-50">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{tOrder("namingFormats")}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => handleApplySuggestedName("standard")}
                          className="w-full text-left p-2 rounded-md hover:bg-muted text-xs transition-colors cursor-pointer group border border-transparent hover:border-border"
                        >
                          <div className="font-semibold text-foreground group-hover:text-primary flex items-center justify-between">
                            <span>{tOrder("namingStandard")}</span>
                            <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono text-primary border-primary/30">
                              Tavsiya
                            </Badge>
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground line-clamp-2 mt-1">
                            {suggestedProductName}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplySuggestedName("compact")}
                          className="w-full text-left p-2 rounded-md hover:bg-muted text-xs transition-colors cursor-pointer group border border-transparent hover:border-border"
                        >
                          <div className="font-semibold text-foreground group-hover:text-primary">
                            {tOrder("namingCompact")}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground truncate mt-1">
                            {compactSuggestedName}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplySuggestedName("technical")}
                          className="w-full text-left p-2 rounded-md hover:bg-muted text-xs transition-colors cursor-pointer group border border-transparent hover:border-border"
                        >
                          <div className="font-semibold text-foreground group-hover:text-primary">
                            {tOrder("namingTechnical")}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground line-clamp-2 mt-1">
                            {technicalSuggestedName}
                          </div>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Input 
                    value={formData.product} 
                    onChange={(e) => handleFieldChange("product", e.target.value)}
                    disabled={isOperator}
                    className="h-8 text-xs bg-muted/30 font-medium disabled:opacity-85 pr-8" 
                    placeholder="Mahsulot nomi yoki texkartani tanlang"
                  />
                  {!isOperator && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleApplySuggestedName("standard")}
                      title={tOrder("autoNamingTooltip")}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-amber-500 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {!isOperator && onSelectProductTemplate && (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs gap-1.5 bg-card hover:bg-muted font-normal border-border shrink-0 cursor-pointer"
                          title="Tayyor shablon / texkarta (BOM) tanlash"
                        >
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          <span className="hidden sm:inline font-medium">Shablon / BOM</span>
                        </Button>
                      }
                    />
                    <PopoverContent className="w-[380px] p-0 shadow-xl border border-border bg-popover" align="end">
                      <Command className="w-full">
                        <CommandInput placeholder="Mahsulot yoki texkarta qidirish..." className="h-8 text-xs" />
                        <CommandList className="max-h-72">
                          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            Mos shablon topilmadi.
                          </CommandEmpty>

                          {(["Offset", "Flexo", "Jacquard"] as const).map((dept) => {
                            const deptSpecs = (masterSpecifications || []).filter((s) => s.department === dept);
                            if (deptSpecs.length === 0) return null;

                            return (
                              <CommandGroup key={dept} heading={`${dept} Texkartalari`}>
                                {deptSpecs.map((spec) => {
                                  const isSelected = formData.recipe === spec.code;
                                  return (
                                    <CommandItem
                                      key={spec.code}
                                      value={`${spec.code} ${spec.name} ${spec.department} ${spec.description}`}
                                      onSelect={() => onSelectProductTemplate && onSelectProductTemplate(spec as any)}
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
                                          <span>{spec.materialsCount} xomashyo</span>
                                          <span>•</span>
                                          <span>{spec.estimatedCost}</span>
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
                )}
              </div>

              {/* Recommendation pill if current product name is empty or differs from standard suggestion */}
              {!isOperator && suggestedProductName && suggestedProductName !== formData.product && (
                <div className="flex items-center justify-between gap-2 mt-1.5 p-1.5 px-2 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-muted-foreground shrink-0">{tOrder("namingSuggestion")}</span>
                    <span className="font-mono font-medium text-foreground truncate">{suggestedProductName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleApplySuggestedName("standard")}
                    className="h-5 px-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shrink-0 cursor-pointer"
                  >
                    {tOrder("namingApply")}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tOrder("quantityLabel")}</label>
                <Input 
                  type="number"
                  min={0}
                  value={hasSizes && totalSizesQty > 0 ? totalSizesQty : formData.quantity} 
                  onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                  disabled={isOperator || (hasSizes && totalSizesQty > 0)}
                  title={
                    hasSizes && totalSizesQty > 0
                      ? "Miqdor o'lchamlar matritsasi orqali avtomatik hisoblanadi"
                      : undefined
                  }
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

            {/* Matritsa Button directly after Quantity & Unit */}
            <div>
              <Button
                type="button"
                variant={hasSizes ? "secondary" : "outline"}
                onClick={() => onSwitchTab("specs")}
                className={cn(
                  "w-full h-8.5 text-xs px-3 font-medium cursor-pointer transition-colors shadow-2xs flex items-center justify-between",
                  hasSizes
                    ? "bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25"
                    : "border-dashed border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
                title="Spetsifikatsiyalar bo'limidagi O'lchamlar matritsasiga o'tish"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-foreground truncate">
                    {hasSizes ? "O'lchamlar matritsasi" : "O'lchamlar matritsasini kiritish"}
                  </span>
                  {hasSizes && (
                    <Badge variant="outline" className="h-4.5 px-1.5 text-[10px] font-mono bg-background text-primary border-primary/30">
                      {formData.sizes!.length} razmer
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                  {hasSizes ? (
                    <span className="font-bold text-foreground">
                      {totalSizesQty.toLocaleString()} {formData.unit}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">+ Kiritish</span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </Button>
            </div>

            {!isOperator && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Buyurtma umumiy summasi ({getCurrencySymbol(formData.currency)})
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      step={formData.currency === "UZS" ? "1" : "0.01"}
                      value={formData.priceTotal || ""}
                      onChange={(e) => handleFieldChange("priceTotal", Number(e.target.value))}
                      className="h-8 text-xs bg-muted/30 font-mono font-semibold pr-14"
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground pointer-events-none">
                      {getCurrencySymbol(formData.currency)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Valyuta</label>
                  <Select
                    value={formData.currency || "USD"}
                    onValueChange={(val: any) => val && handleFieldChange("currency", val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/30 font-mono font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="UZS">UZS (so&apos;m)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="RUB">RUB (₽)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Active Sample Sync Banner (if Order is in Sample Mode or Sample Required) */}
            {(formData.orderType === "Sample" || sampleData?.isRequired) && (
              <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FlaskConical className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-amber-800 dark:text-amber-300 block truncate text-[11px]">
                      Namuna rejimi faol
                    </span>
                    <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90 block truncate">
                      {sampleData?.sampleTargetSize && sampleData.sampleTargetSize !== "all"
                        ? `Faqat ${sampleData.sampleTargetSize} razmeri sinovdan o'tmoqda (${sampleData?.sampleQty || 5} ${formData.unit})`
                        : `Sinov tiraji: ${sampleData?.sampleQty || 5} ${formData.unit} (SampleTab)`}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSwitchTab("sample")}
                  className="h-6 px-2 text-[10px] border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 shrink-0"
                >
                  <span>SampleTab</span>
                  <ArrowRight className="w-2.5 h-2.5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: High-Level Technical Specifications Snapshot (Read-Only SSOT from Specs & Drawing) */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">
                  Technical specs
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isFlexo && (
                  <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    Flexo Label
                  </Badge>
                )}
                {isJacquard && (
                  <Badge variant="outline" className="font-mono text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                    Jacquard Woven
                  </Badge>
                )}
                {isOffset && (
                  <Badge variant="outline" className="font-mono text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Offset Print
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSwitchTab("specs")}
                  className="h-6 px-1.5 text-[11px] text-primary hover:text-primary/90 hover:bg-primary/10 gap-0.5 cursor-pointer"
                >
                  <span>Edit in Specs</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* ─── 1. FLEXO TEXTILE & CARE LABEL SPECS ─── */}
            {isFlexo && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Ribbon Dimensions & Fold Type */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Lenta o&apos;lchami (Ribbon)
                    </span>
                    <p className="font-mono font-bold text-foreground text-sm">
                      {formData.width || 30} × {formData.height || 70}{" "}
                      <span className="text-xs font-normal text-muted-foreground">mm</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate font-medium">
                      {FOLD_TYPE_LABELS[formData.labelFoldType || "center_fold"] || "Markazdan buklama"}
                    </p>
                  </div>

                  {/* Ribbon Substrate Material */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Tasma materiali (Substrate)
                    </span>
                    <p className="font-semibold text-foreground text-xs truncate" title={formData.labelMaterialType || formData.paperStock}>
                      {RIBBON_MATERIAL_LABELS[formData.labelMaterialType || ""] || formData.paperStock || "Polyester Satin (Oq)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Tekstil lentasi · Flexobosma
                    </p>
                  </div>

                  {/* Wash Resistance & Cut Technology */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-blue-500 shrink-0" />
                      <span>Yuvish &amp; Kesim</span>
                    </span>
                    <p className="font-semibold text-foreground text-xs truncate">
                      {WASH_RESISTANCE_LABELS[formData.labelWashResistance || "60c"] || "60°C Chidamli"}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono">
                        {CUT_TYPE_LABELS[formData.labelCutType || "ultrasonic"] || "Ultrasonik"}
                      </Badge>
                      <span className="truncate">chet tikuvsiz</span>
                    </div>
                  </div>

                  {/* Rotary Flexo Inks & Printing Sides */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Flexo ranglar (Inks)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground text-sm">
                        {dynamicColorNotation}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {formData.labelPrintSides === "2s" ? "2-tomonlama" : "1-tomonlama"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-0.5">
                        {frontColors.k && <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-zinc-100 inline-block shadow-2xs" title="Black" />}
                        {frontSpots.length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block shadow-2xs" title={`+${frontSpots.length} Spot Pantone`} />
                        )}
                        {frontColors.c && <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block shadow-2xs" title="Cyan" />}
                        {frontColors.m && <span className="w-2 h-2 rounded-full bg-pink-500 inline-block shadow-2xs" title="Magenta" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {frontSpots.length > 0 ? `+${frontSpots.length} Pantone` : "Tekstil siyohi"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Flexo Sub-row */}
                <div className="space-y-1.5 p-2 rounded-md bg-muted/20 border border-border text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Scissors className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                      <span>Tikuv zaxirasi:</span>
                    </div>
                    <span className="font-medium text-foreground">
                      <Badge variant="outline" className="text-[10px] h-4.5 bg-background border-border font-mono">
                        {formData.labelSewingMarginMm ?? 7}mm yuqori/pastki chet
                      </Badge>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                      <span>SKU Taqsimoti:</span>
                    </div>
                    <span className="font-medium text-foreground truncate">
                      {hasSizes ? (
                        <span className="font-mono text-primary font-semibold text-[11px]">
                          {formData.sizes!.length} SKU ({totalSizesQty.toLocaleString()} {formData.unit || "pcs"})
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono">{(formData.quantity || 0).toLocaleString()} {formData.unit || "pcs"}</span>
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ─── 2. JACQUARD WOVEN LABEL SPECS ─── */}
            {isJacquard && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Woven Dimensions & Fold Type */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      To&apos;qima o&apos;lchami (Woven)
                    </span>
                    <p className="font-mono font-bold text-foreground text-sm">
                      {formData.width || 35} × {formData.height || 65}{" "}
                      <span className="text-xs font-normal text-muted-foreground">mm</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate font-medium">
                      {FOLD_TYPE_LABELS[formData.labelFoldType || "end_fold"] || "Ikki chekkadan buklama"}
                    </p>
                  </div>

                  {/* Weave Quality & Ground Color */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      To&apos;qish sifati (Weave)
                    </span>
                    <p className="font-semibold text-foreground text-xs truncate">
                      {WEAVE_QUALITY_LABELS[formData.weaveQuality || "damask_50d"] || "Damask 50D (High Density)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Asos: {formData.weaveGroundColor || "Oq/Qora"} · {formData.weaveThreadCount || 52} picks/cm
                    </p>
                  </div>

                  {/* Edge Processing & Lurex */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                      <span>Qirra &amp; Maxsus ip</span>
                    </span>
                    <p className="font-semibold text-foreground text-xs truncate">
                      {CUT_TYPE_LABELS[formData.labelCutType || "ultrasonic"] || "Ultrasonik yumshoq qirra"}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {formData.hasLurexThread ? (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                          ✨ Lurex ({formData.lurexColor || "Oltin"})
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Standart to&apos;quv ipi</span>
                      )}
                    </div>
                  </div>

                  {/* Weft Yarn Colors */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Arqoq iplari (Yarn Colors)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground text-sm">
                        {Math.max(1, spotColorItems.length + 1)} rang
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        (1 Asos + {Math.max(1, spotColorItems.length)} Naqsh)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-border shrink-0" title="Asos ipi" />
                      {spotColorItems.map((s, idx) => (
                        <span
                          key={s.id || idx}
                          className="w-2.5 h-2.5 rounded-full border border-border shrink-0"
                          style={{ backgroundColor: s.hex || "#3b82f6" }}
                          title={s.name}
                        />
                      ))}
                      {spotColorItems.length === 0 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" title="Logo ipi" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Jacquard Sub-row */}
                <div className="space-y-1.5 p-2 rounded-md bg-muted/20 border border-border text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Scissors className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                      <span>Tikuv zaxirasi:</span>
                    </div>
                    <span className="font-medium text-foreground">
                      <Badge variant="outline" className="text-[10px] h-4.5 bg-background border-border font-mono">
                        {formData.labelSewingMarginMm ?? 7}mm kiyim ichiga
                      </Badge>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                      <span>SKU Taqsimoti:</span>
                    </div>
                    <span className="font-medium text-foreground truncate">
                      {hasSizes ? (
                        <span className="font-mono text-primary font-semibold text-[11px]">
                          {formData.sizes!.length} SKU ({totalSizesQty.toLocaleString()} {formData.unit || "pcs"})
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono">{(formData.quantity || 0).toLocaleString()} {formData.unit || "pcs"}</span>
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ─── 3. OFFSET PRINTING & PACKAGING SPECS ─── */}
            {isOffset && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Dimensions */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Size ({formData.dimensionUnit || "mm"})
                    </span>
                    <p className="font-mono font-bold text-foreground text-sm">
                      {formData.width && formData.height ? (
                        <>
                          {formData.width} × {formData.height}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {formData.dimensionUnit || "mm"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs font-normal">Kiritilmagan</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {formData.bleed ? `Bleed ${formData.bleed}mm · ` : ""}{formData.cornerType || "Square"}
                    </p>
                  </div>

                  {/* Substrate / Paper Stock */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Material
                    </span>
                    <p className="font-semibold text-foreground text-xs truncate" title={formData.paperStock}>
                      {formData.paperStock || "Kiritilmagan"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {formData.itemCategory ? `${formData.itemCategory} · ${formData.department}` : formData.department}
                    </p>
                  </div>

                  {/* Lamination & Surface Treatment */}
                  <div className="p-2.5 rounded-md bg-muted/30 border border-border space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>Lamination</span>
                    </span>
                    <p className="font-semibold text-foreground text-xs truncate" title={formData.lamination}>
                      {formData.lamination && formData.lamination !== "none" ? formData.lamination : "None / Uncoated"}
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
                      Colors (Inks)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground text-sm">
                        {dynamicColorNotation}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-0.5">
                        {frontColors.c && <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block shadow-2xs" title="Cyan" />}
                        {frontColors.m && <span className="w-2 h-2 rounded-full bg-pink-500 inline-block shadow-2xs" title="Magenta" />}
                        {frontColors.y && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-2xs" title="Yellow" />}
                        {frontColors.k && <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-zinc-100 inline-block shadow-2xs" title="Black" />}
                        {frontSpots.length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block shadow-2xs" title={`+${frontSpots.length} Spot`} />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {frontSpots.length > 0 ? `+${frontSpots.length} Pantone` : "CMYK"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-row: Holes, Multi-Layer Mounting & Sizes (Stacked vertically for compact card) */}
                <div className="space-y-1.5 p-2 rounded-md bg-muted/20 border border-border text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CircleDot className="w-3.5 h-3.5 shrink-0" />
                      <span>Hole:</span>
                    </div>
                    <span className="font-medium text-foreground truncate">
                      {effectiveHolePos !== "none" && effectiveHoleSize > 0 ? (
                        <Badge variant="outline" className="text-[10px] h-4.5 bg-background border-border">
                          Ø{effectiveHoleSize}mm · {effectiveHolePos}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Mounting:</span>
                    </div>
                    <span className="font-medium text-foreground truncate">
                      {kashirovkaMode !== "none" ? (
                        <Badge variant="outline" className="text-[10px] h-4.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300">
                          {kashirovkaMode === "triplex" ? "Triplex" : "Duplex"} · {kashirovkaTotals.totalMountedGsm}g
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                      <span>Sizes:</span>
                    </div>
                    <span className="font-medium text-foreground truncate">
                      {hasSizes ? (
                        <span className="font-mono text-primary font-semibold text-[11px]">
                          {formData.sizes!.length} sizes ({totalSizesQty.toLocaleString()} {formData.unit})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Single batch</span>
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSwitchTab("specs")}
            className="w-full mt-2 h-7.5 text-xs gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/10"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Open Specs & Drawing</span>
          </Button>
        </div>


        {/* Card 4: Production Equipment & Scheduling */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">Production & Tech Route</span>
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
                        {activeMachine
                          ? `[${activeMachine.code}] ${activeMachine.name}`
                          : formData.pressMachine
                          ? formData.pressMachine
                          : "Uskunani tanlang..."}
                      </span>
                      {activeMachine && activeMachine.format && (
                        <span className="text-[11px] text-muted-foreground shrink-0 hidden @lg:inline font-mono">
                          • {activeMachine.format} {activeMachine.speed ? `(${activeMachine.speed})` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium",
                        (activeMachine?.status === "Running" || activeMachine?.status === "Ready" || activeMachine?.status === "Available") && "text-emerald-600 dark:text-emerald-400",
                        activeMachine?.status === "Idle" && "text-amber-600 dark:text-amber-400",
                        activeMachine?.status === "Maintenance" && "text-rose-600 dark:text-rose-400",
                        activeMachine?.status && !["Running", "Ready", "Available", "Idle", "Maintenance"].includes(activeMachine.status) && "text-blue-600 dark:text-blue-400"
                      )}>
                        <span className={cn(
                          "size-1.5 rounded-full shrink-0",
                          (activeMachine?.status === "Running" || activeMachine?.status === "Ready" || activeMachine?.status === "Available") && "bg-emerald-500",
                          activeMachine?.status === "Idle" && "bg-amber-500",
                          activeMachine?.status === "Maintenance" && "bg-rose-500",
                          activeMachine?.status && !["Running", "Ready", "Available", "Idle", "Maintenance"].includes(activeMachine.status) && "bg-blue-500"
                        )} />
                        {activeMachine?.status || "Tanlanmagan"}
                      </span>
                      <ChevronsUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] p-0 shadow-xl border border-border bg-popover" align="start">
                    <Command className="w-full">
                      <CommandInput placeholder="Search machine name, model, speed, format..." className="h-8 text-xs" />
                      <CommandList className="max-h-72">
                        <CommandEmpty className="py-6 px-4 text-center space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {formData.department} bo&apos;limida uskuna topilmadi.
                          </p>
                          {!isOperator && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const res = await fetch("/api/v1/production/machines?nextCode=true");
                                  const json = await res.json();
                                  const nextCode = json?.nextCode || "MAC-0001";
                                  openTab({
                                    id: `machine-new-${Date.now()}`,
                                    title: `Yangi Uskuna (${nextCode})`,
                                    type: "machine-detail",
                                    module: "production",
                                    isUnsaved: true,
                                    activeLevel3Tab: "overview",
                                    documentData: {
                                      isNew: true,
                                      name: "",
                                      code: nextCode,
                                      department: formData.department || "Offset",
                                      category: formData.department === "Flexo" ? "flexo" : formData.department === "Jacquard" ? "jacquard" : "offset",
                                      status: "Idle",
                                    },
                                  });
                                  setIsMachineComboboxOpen(false);
                                } catch (e) {
                                  console.error("Open new machine error", e);
                                }
                              }}
                              className="h-7 text-xs gap-1.5 font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Yangi uskuna pasportini yaratish</span>
                            </Button>
                          )}
                        </CommandEmpty>
                        
                        <CommandGroup heading={`${formData.department} Presses & Equipment (Database)`}>
                          {currentDeptMachines.map((mach: any) => {
                            const isSelected = formData.pressMachine === mach.name || formData.pressMachine === mach.code;
                            return (
                              <CommandItem
                                key={mach.code || mach.id}
                                value={`${mach.code || ""} ${mach.name} ${mach.department || ""} ${mach.features || ""} ${mach.format || ""}`}
                                onSelect={() => {
                                  handleFieldChange("pressMachine", mach.code || mach.name);
                                  setIsMachineComboboxOpen(false);
                                  onMarkUnsaved();
                                }}
                                className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5"
                              >
                                <Check className={cn("mt-0.5 h-4 w-4 text-primary shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      {mach.code && (
                                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">
                                          {mach.code}
                                        </span>
                                      )}
                                      <span className="font-semibold text-foreground">{mach.name}</span>
                                    </div>
                                    <span className={cn(
                                      "font-medium text-[10px]",
                                      (mach.status === "Running" || mach.status === "Ready" || mach.status === "Available") && "text-emerald-600 dark:text-emerald-400",
                                      mach.status === "Maintenance" && "text-rose-600 dark:text-rose-400",
                                      mach.status === "Idle" && "text-amber-600 dark:text-amber-400"
                                    )}>● {mach.status || "Idle"}</span>
                                  </div>
                                  {mach.features && <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>}
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                                    {mach.format && <span className="font-medium text-foreground">{mach.format}</span>}
                                    {mach.speed && (
                                      <>
                                        <span>•</span>
                                        <span>{mach.speed}</span>
                                      </>
                                    )}
                                    {mach.hourlyRate ? (
                                      <>
                                        <span>•</span>
                                        <span className="font-mono text-primary">${mach.hourlyRate}/soat</span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>

                        {!isOperator && (
                          <CommandItem
                            value="__add_new_machine_action__"
                            onSelect={async () => {
                              try {
                                const res = await fetch("/api/v1/production/machines?nextCode=true");
                                const json = await res.json();
                                const nextCode = json?.nextCode || "MAC-0001";
                                openTab({
                                  id: `machine-new-${Date.now()}`,
                                  title: `Yangi Uskuna (${nextCode})`,
                                  type: "machine-detail",
                                  module: "production",
                                  isUnsaved: true,
                                  activeLevel3Tab: "overview",
                                  documentData: {
                                    isNew: true,
                                    name: "",
                                    code: nextCode,
                                    department: formData.department || "Offset",
                                    category: formData.department === "Flexo" ? "flexo" : formData.department === "Jacquard" ? "jacquard" : "offset",
                                    status: "Idle",
                                  },
                                });
                                setIsMachineComboboxOpen(false);
                              } catch (e) {
                                console.error("Machine open error", e);
                              }
                            }}
                            className="py-2 px-2.5 cursor-pointer text-xs flex items-center gap-2 text-primary font-medium border-t border-border mt-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Yangi uskuna pasportini yaratish (To&apos;liq texnik karta)...</span>
                          </CommandItem>
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
              {/* Compact Pre-Flight Readiness & Stage Indicator */}
              <OrderReadinessRouteCard
                variant="compact"
                workOrderId={data?.docNo || tabId}
                onOpenFullRoute={() => onSwitchTab("operations")}
                fallbackData={{
                  customer: formData.customer,
                  product: formData.product,
                  machine: formData.pressMachine,
                  department: formData.department,
                  quantity: formData.quantity,
                  deadline: formData.deadline,
                }}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSwitchTab("operations")}
            className="w-full mt-2 h-7.5 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Open Technological Route</span>
          </Button>
        </div>


          </div>
        </div>

        {/* Right Column (1/3 width on xl screens, stacks gracefully on smaller screens) */}
        <div className="grid grid-cols-1 @3xl:grid-cols-2 @7xl:grid-cols-1 gap-4 content-start">
          {/* Card 5: Live Materials & Stock Availability Summary (Read-Only Snapshot) */}
        <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground truncate">Materials (BOM)</span>
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

            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-muted/30 border border-border text-xs">
              <span className="text-muted-foreground text-[11px]">Active Recipe (SSOT: Materials):</span>
              <button
                type="button"
                onClick={() => onSwitchTab("materials")}
                className="font-mono text-[11px] font-semibold text-primary hover:underline truncate max-w-[190px] cursor-pointer"
                title={`${activeSpec?.code || formData.recipe} · ${activeSpec?.name || ""} (Click to change in Materials tab)`}
              >
                {activeSpec?.code || formData.recipe} · {activeSpec?.name}
              </button>
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
          </div>

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => onSwitchTab("materials")}
            className="w-full mt-2 h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Full BOM & Stock Allocation</span>
          </Button>
        </div>

        {/* Card 4: Financial Calculation */}
        {!isOperator && (() => {
          const revenue = Number(formData.priceTotal) || 0;
          const currency = formData.currency || "USD";
          const qty = Number(formData.quantity) || 0;

          // 1. Real Material Costs (from BOM Materials or PrintPlan estimation)
          const bomMaterialsCost = (materials || []).reduce(
            (sum, item) => sum + (Number(item.totalPrice) || 0),
            0
          );
          const rawMaterialCost = bomMaterialsCost > 0
            ? bomMaterialsCost
            : (printPlan ? (printPlan.estimatedPaperCost + printPlan.estimatedPlatesCost) : 0);

          // 2. Real Operations / Machine Cost
          const operationsCost = (operations && operations.length > 0)
            ? operations.reduce((sum, op) => sum + ((Number(op.duration) || 1) * 20), 0)
            : (printPlan ? printPlan.estimatedPressCost : 0);

          // 3. Direct Production Cost
          const directCost = Number((rawMaterialCost + operationsCost).toFixed(2));
          const hasCosts = directCost > 0;
          const costPerUnit = qty > 0 && directCost > 0 ? Number((directCost / qty).toFixed(2)) : 0;

          // 4. Margin Calculation
          let margin = 0;
          let marginLabel = "0%";
          let statusText = "Reja kiritilmagan";
          let isProfitable = false;

          if (revenue > 0 && hasCosts) {
            margin = Number((((revenue - directCost) / revenue) * 100).toFixed(1));
            marginLabel = `Margin: ${margin}%`;
            isProfitable = margin >= 20;
            statusText = isProfitable
              ? `Foydali (+${formatMoney(revenue - directCost, currency)})`
              : `Past marja (+${formatMoney(revenue - directCost, currency)})`;
          } else if (revenue > 0 && !hasCosts) {
            marginLabel = "Tannarx belgilanmagan";
            statusText = "BOM materiallari kiritilmagan";
          } else {
            marginLabel = "0%";
            statusText = "Reja kiritilmagan";
          }

          return (
            <div className="@container p-4 bg-card border border-border rounded-lg space-y-3 min-w-0">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm text-foreground truncate">Cost Structure & Margin</span>
                </div>
                <span
                  className={cn(
                    "text-xs font-mono font-medium px-2 py-0.5 rounded-full border",
                    revenue === 0 || !hasCosts
                      ? "text-muted-foreground bg-muted border-border"
                      : isProfitable
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                  )}
                >
                  {marginLabel}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="p-2.5 bg-muted/30 rounded-md border border-border font-mono text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="font-sans">
                      {isJacquard
                        ? "Xomashyo va To'quv Iplari:"
                        : isFlexo
                        ? "Tekstil Lentasi & Bo'yoqlar:"
                        : bomMaterialsCost > 0
                        ? `BOM Xomashyosi (${materials?.length || 0} xil):`
                        : `Qog'oz va Xomashyo:`}
                    </span>
                    <span className="text-foreground font-medium">
                      {formatMoney(rawMaterialCost, currency)}
                    </span>
                  </div>

                  <div className="flex justify-between text-muted-foreground">
                    <span className="font-sans">
                      {isJacquard
                        ? "To'quv Dasturi & Rapoport Sozlash:"
                        : isFlexo
                        ? "Fotopolimer Klishelar & Formalar:"
                        : "CTP Formalar & Qoliplar:"}
                    </span>
                    <span className="text-foreground font-medium">
                      {formatMoney(printPlan ? printPlan.estimatedPlatesCost : 0, currency)}
                    </span>
                  </div>

                  <div className="flex justify-between text-muted-foreground">
                    <span className="font-sans">
                      {isJacquard
                        ? "To'quv Dastgohi va Operatsiyalar:"
                        : isFlexo
                        ? "Flexo Stanok va Operatsiyalar:"
                        : "Stanok Soati va Operatsiyalar:"}
                    </span>
                    <span className="text-foreground font-medium">
                      {formatMoney(operationsCost, currency)}
                    </span>
                  </div>

                  <div className="flex justify-between text-muted-foreground text-[11px] pt-0.5 border-t border-border/50">
                    <span className="font-sans">To&apos;g&apos;ri Ishlab Chiqarish Tannarxi:</span>
                    <span className="font-bold text-foreground font-mono">
                      {formatMoney(directCost, currency)}
                    </span>
                  </div>

                  <Separator className="my-1.5" />

                  <div className="flex justify-between items-baseline font-bold">
                    <span className="text-foreground font-sans">Document Total (Buyurtma):</span>
                    <span className="text-primary font-semibold text-sm font-mono">
                      {formatMoney(revenue, currency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-border">
                  <div>
                    Tannarx / dona:{" "}
                    <span className="font-semibold text-foreground font-mono">
                      {costPerUnit > 0 ? formatMoney(costPerUnit, currency, currency === "UZS" ? 0 : 3) : "—"}
                    </span>
                  </div>
                  <div>
                    Status:{" "}
                    <span
                      className={cn(
                        "font-semibold font-mono",
                        revenue > 0 && hasCosts
                          ? isProfitable
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {statusText}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        </div>
      </div>
    </TabsContent>
  );
}
