"use client";

import React, { useState, useMemo } from "react";
import {
  Ruler,
  Layers,
  Palette,
  CircleDot,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  FileCode,
  Tag,
  Shirt,
  Scissors,
  RotateCw,
  Stamp,
  Wrench,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { DieLinePreview } from "../DieLinePreview";
import { TextileLabelPreview } from "../TextileLabelPreview";
import { PantoneColorPickerModal, SpotStationSelection } from "../dialogs/PantoneColorPickerModal";
import { useLookupStore } from "@/store/lookupStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  WorkOrderFormData,
  SizeDistribution,
  SpotColorItem,
  KashirovkaMode,
  SubstrateLayer,
  getDefaultKashirovkaLayers,
  calculateKashirovkaTotals,
  WorkOrderSampleData,
} from "../types";
import { SizeMatrixCard } from "./SizeMatrixCard";

interface SpecificationsTabProps {
  formData: WorkOrderFormData;
  handleFieldChange: (field: string, val: any) => void;
  handleSizesChange?: (newSizes: SizeDistribution[]) => void;
  onMarkUnsaved: () => void;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
  sampleData?: WorkOrderSampleData;
  onSampleChange?: (field: keyof WorkOrderSampleData, val: any) => void;
}

export function SpecificationsTab({
  formData,
  handleFieldChange,
  handleSizesChange,
  onMarkUnsaved,
  isOperator = false,
  onSwitchTab,
  sampleData,
  onSampleChange,
}: SpecificationsTabProps) {
  const tDie = useTranslations("DieLine");
  const { paperStocks, addPaperStock, coatings, addCoating } = useLookupStore();
  const { customerTooling, upsertCustomerTooling, addNotification } = useWorkspaceStore();
  const [isPantoneModalOpen, setIsPantoneModalOpen] = useState(false);
  const [pantoneTargetSide, setPantoneTargetSide] = useState<"front" | "back" | "both">("front");
  const [isSvgModalOpen, setIsSvgModalOpen] = useState(false);
  const [svgInputDraft, setSvgInputDraft] = useState(formData.customSvgPath || "");
  const [isNewToolingModalOpen, setIsNewToolingModalOpen] = useState(false);
  const [newToolForm, setNewToolForm] = useState({
    name: "",
    toolType: "Flatbed Die (Штанцформа)",
    format: `${formData.width || 700}×${formData.height || 1000} mm`,
    cavities: "4-up",
    estimatedCost: 65,
  });

  // Matched customer tools
  const availableCustomerTools = useMemo(() => {
    const cust = (formData.customer || "").trim().toLowerCase();
    if (!cust) return customerTooling;
    const cleanCust = cust.replace(" llc", "").replace(" mchj", "").trim();
    return customerTooling.filter((t) => {
      if (!t.customerName) return false;
      const c = t.customerName.toLowerCase();
      return c === cleanCust || c.includes(cleanCust) || cleanCust.includes(c);
    });
  }, [customerTooling, formData.customer]);

  const selectedTool = useMemo(() => {
    if (!formData.selectedToolingId) return null;
    return customerTooling.find((t) => t.id === formData.selectedToolingId) || null;
  }, [customerTooling, formData.selectedToolingId]);

  const handleOrderNewTooling = () => {
    const newToolId = `DIE-${Math.floor(100 + Math.random() * 899)}`;
    const createdTool = {
      id: newToolId,
      customerName: formData.customer || "Alpha Media Group LLC",
      name: newToolForm.name || `${formData.product || "Buyurtma"} Shtansformasi`,
      toolType: newToolForm.toolType,
      format: newToolForm.format || `${formData.width || 700}×${formData.height || 1000} mm`,
      cavities: newToolForm.cavities || "1-up",
      location: "Kutilmoqda (Pudratda)",
      impressionsUsed: 0,
      maxLife: 150000,
      status: "Ready" as const,
    };
    upsertCustomerTooling(createdTool);
    handleFieldChange("selectedToolingId", newToolId);
    handleFieldChange("selectedToolingName", createdTool.name);
    handleFieldChange("toolingProcurementNeeded", true);
    handleFieldChange("toolingProcurementCost", newToolForm.estimatedCost || 65);
    onMarkUnsaved();
    setIsNewToolingModalOpen(false);

    addNotification({
      title: "Shtansforma tayyorlashga buyurtma kiritildi",
      description: `${newToolId}: ${createdTool.name} xaridlar va texkartaga biriktirildi.`,
      severity: "success",
    });
  };

  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const pathMatch = text.match(/<path[^>]*d=["']([^"']+)["']/i);
      const val = pathMatch && pathMatch[1] ? pathMatch[1] : text;
      handleFieldChange("customSvgPath", val);
      setSvgInputDraft(val);
      onMarkUnsaved();
    };
    reader.readAsText(file);
  };

  const handleOpenPantoneModal = (side: "front" | "back") => {
    if (isOperator) return;
    setPantoneTargetSide(side);
    setIsPantoneModalOpen(true);
  };

  // Department technology flags
  const isFlexo = formData.department === "Flexo" || (formData.recipe ? formData.recipe.startsWith("FLEXO_") : false);
  const isJacquard = formData.department === "Jacquard" || (formData.recipe ? formData.recipe.startsWith("JACQ_") : false);
  const isOffset = !isFlexo && !isJacquard;

  // Hole calculation
  const effectiveHoleSize = formData.holeSize !== undefined
    ? formData.holeSize
    : (formData.itemCategory === "Hangtag" ? 4 : 0);
  const effectiveHolePos = (formData.holePosition || (formData.itemCategory === "Hangtag" ? "top-center" : "none")) as
    | "top-center"
    | "top-left"
    | "top-right"
    | "left-center"
    | "right-center"
    | "none";
  const effectiveHoleOffset = formData.holeOffset ?? 6;

  // Lamination active check
  const currentLamination = formData.lamination || "Soft-Touch Matte";
  const isLaminationActive = currentLamination !== "none" && currentLamination !== "None / Uncoated";
  const laminationSides = formData.laminationSides || "1s";
  const laminationMicron = formData.laminationMicron || 28;
  const embellishment = formData.embellishment || "Spot UV (3D)";

  // Color config helpers
  const frontColors = formData.frontColors || { c: true, m: true, y: true, k: true };
  const backColors = formData.backColors || { c: false, m: false, y: false, k: false };
  const spotColorItems: SpotColorItem[] = formData.spotColorItems || [
    { id: "spot-1", name: "PANTONE 021 C (Neon Orange)", code: "021 C", hex: "#fe5000", side: "front" },
  ];

  const frontSpots = spotColorItems.filter((s) => s.side === "front" || s.side === "both");
  const backSpots = spotColorItems.filter((s) => s.side === "back" || s.side === "both");
  const frontProcessCount = (frontColors.c ? 1 : 0) + (frontColors.m ? 1 : 0) + (frontColors.y ? 1 : 0) + (frontColors.k ? 1 : 0);
  const backProcessCount = (backColors.c ? 1 : 0) + (backColors.m ? 1 : 0) + (backColors.y ? 1 : 0) + (backColors.k ? 1 : 0);
  const frontTotalCount = frontProcessCount + frontSpots.length;
  const backTotalCount = backProcessCount + backSpots.length;

  const handleToggleFrontColor = (color: "c" | "m" | "y" | "k") => {
    if (isOperator) return;
    const updated = { ...frontColors, [color]: !frontColors[color] };
    handleFieldChange("frontColors", updated);
    onMarkUnsaved();
  };

  const handleToggleBackColor = (color: "c" | "m" | "y" | "k") => {
    if (isOperator) return;
    const updated = { ...backColors, [color]: !backColors[color] };
    handleFieldChange("backColors", updated);
    onMarkUnsaved();
  };

  const handleAddSpotColor = (selection: SpotStationSelection) => {
    const newItem: SpotColorItem = {
      id: `spot-${Date.now()}`,
      name: selection.name,
      code: selection.code,
      hex: selection.hex,
      side: selection.side,
    };
    const updated = [...spotColorItems, newItem];
    handleFieldChange("spotColorItems", updated);
    handleFieldChange("spotColors", updated.map((s) => s.name));
    onMarkUnsaved();
  };

  const handleRemoveSpotColor = (id: string) => {
    if (isOperator) return;
    const updated = spotColorItems.filter((s) => s.id !== id);
    handleFieldChange("spotColorItems", updated);
    handleFieldChange("spotColors", updated.map((s) => s.name));
    onMarkUnsaved();
  };

  // Kashirovka Mounting state and calculations
  const kashirovkaMode: KashirovkaMode = formData.kashirovkaMode || "none";
  const kashirovkaLayers: SubstrateLayer[] = useMemo(() => {
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

  const handleKashirovkaModeChange = (mode: KashirovkaMode) => {
    if (isOperator) return;
    handleFieldChange("kashirovkaMode", mode);
    if (mode === "none") {
      handleFieldChange("kashirovkaLayers", []);
    } else {
      const nextLayers = getDefaultKashirovkaLayers(mode, formData.paperStock, formData.coating);
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
    }
    onMarkUnsaved();
  };

  // Size Breakdown state
  const sizes = formData.sizes || [];

  return (
    <TabsContent value="specs" className="@container flex-1 overflow-y-auto p-4 m-0 space-y-4">
      {/* Pantone Modal */}
      <PantoneColorPickerModal
        isOpen={isPantoneModalOpen}
        onOpenChange={setIsPantoneModalOpen}
        onSelectColor={handleAddSpotColor}
        defaultSide={pantoneTargetSide}
      />

      {/* Custom Vector SVG Upload Modal */}
      <Dialog open={isSvgModalOpen} onOpenChange={setIsSvgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              <span>{tDie("svgUploadTitle")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {tDie("svgUploadDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                {tDie("uploadSvg")} (.svg)
              </label>
              <Input
                type="file"
                accept=".svg"
                disabled={isOperator}
                onChange={handleSvgFileUpload}
                className="h-8 text-xs file:mr-2 file:h-6 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground block">
                {tDie("customSvgPlaceholder")}
              </label>
              <textarea
                value={svgInputDraft}
                disabled={isOperator}
                onChange={(e) => setSvgInputDraft(e.target.value)}
                placeholder="M 10 10 L 90 10 L 90 90 L 10 90 Z"
                rows={4}
                className="w-full p-2 rounded-md border border-input bg-background font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {formData.customSvgPath && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={() => {
                  handleFieldChange("customSvgPath", "");
                  setSvgInputDraft("");
                  setIsSvgModalOpen(false);
                  onMarkUnsaved();
                }}
              >
                {tDie("clearSvg")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs cursor-pointer"
              onClick={() => {
                handleFieldChange("customSvgPath", svgInputDraft.trim());
                setIsSvgModalOpen(false);
                onMarkUnsaved();
              }}
            >
              Saqlash (Apply)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── First Section: Model & O'lchamlar taqsimoti (Size & Model Matrix) ── */}
      <SizeMatrixCard
        sizes={sizes}
        unit={formData.unit || "pcs"}
        totalQuantity={formData.quantity}
        isOperator={isOperator}
        onSwitchTab={isJacquard ? undefined : onSwitchTab}
        impositionTabKey={isFlexo ? "flexo" : "layout"}
        impositionLabel={isFlexo ? "Flexo Imposition (Silindr & Tasma)" : "Spusk / Qoliplarga bo'lish (Imposition)"}
        orderType={formData.orderType}
        sampleTargetSize={sampleData?.sampleTargetSize || formData.sampleTargetSize}
        onSampleTargetSizeChange={(size) => {
          handleFieldChange("sampleTargetSize", size);
          onSampleChange?.("sampleTargetSize", size);
          onMarkUnsaved();
        }}
        sampleQty={sampleData?.sampleQty || 5}
        onSampleQtyChange={(q) => {
          onSampleChange?.("sampleQty", q);
          onMarkUnsaved();
        }}
        onSizesChange={(nextSizes) => {
          if (handleSizesChange) {
            handleSizesChange(nextSizes);
          } else {
            handleFieldChange("sizes", nextSizes);
            const total = nextSizes.reduce((acc, s) => acc + (s.quantity || 0), 0);
            if (nextSizes.length > 0) {
              handleFieldChange("quantity", total);
            }
          }
          onMarkUnsaved();
        }}
      />

      {/* 2-Column Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
        {/* Left Column: Dimensions, Substrate & Multi-Layer Mounting */}
        <div className="space-y-3">
          {/* ════════════════════════════════════════════════════════════════
              1. FLEXO TEXTILE & RIBBON LABEL CARDS (NYLON, SATIN, COTTON)
          ════════════════════════════════════════════════════════════════ */}
          {isFlexo && (
            <>
              {/* Flexo Card 1: Ribbon Dimensions & Label Fold */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      Flexo lenta o&apos;lchamlari va Buklash (Label Geometry)
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    Tasma: {formData.width ?? 30}mm × {formData.height ?? 70}mm
                  </Badge>
                </div>

                {/* Primary Ribbon Width & Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Tasma kengligi (Ribbon Width mm):
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">Standart kengliklar</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[15, 20, 25, 30, 35, 40, 50, 60, 70].map((w) => {
                      const active = (formData.width ?? 30) === w;
                      return (
                        <button
                          key={w}
                          type="button"
                          disabled={isOperator}
                          onClick={() => {
                            handleFieldChange("width", w);
                            handleFieldChange("flexoWebWidth", w);
                            onMarkUnsaved();
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-mono font-medium border transition-colors cursor-pointer",
                            active
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          {w}mm
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid: Cut Length, Fold Type, Cut Technology, Sewing Margin */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kesim uzunligi (Cut Length mm):
                    </label>
                    <Input
                      type="number"
                      value={formData.height ?? 70}
                      disabled={isOperator}
                      onChange={(e) => {
                        handleFieldChange("height", Number(e.target.value));
                        onMarkUnsaved();
                      }}
                      className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                      placeholder="Masalan: 70"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Buklash turi (Fold Type):
                    </label>
                    <Select
                      value={formData.labelFoldType || "center_fold"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelFoldType", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center_fold">Markazdan buklama (Center / Loop fold)</SelectItem>
                        <SelectItem value="end_fold">Ikki chekkadan buklama (End fold)</SelectItem>
                        <SelectItem value="straight_cut">To&apos;g&apos;ri kesim (Straight cut / Dona)</SelectItem>
                        <SelectItem value="manhattan_fold">Kitobcha buklama (Manhattan fold)</SelectItem>
                        <SelectItem value="mitre_fold">Manjetli buklama (Mitre fold)</SelectItem>
                        <SelectItem value="roll">Rulonda uzluksiz (Roll / Kesilmagan)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kesish usuli (Cut Method):
                    </label>
                    <Select
                      value={formData.labelCutType || "ultrasonic"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelCutType", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ultrasonic">Ultrasonik kesim (Yumshoq, terini qichitmaydi)</SelectItem>
                        <SelectItem value="hot_knife">Issiq pichoq (Hot knife - erigan qirra)</SelectItem>
                        <SelectItem value="cold_knife">Sovuq pichoq (Cold knife)</SelectItem>
                        <SelectItem value="laser">Lazerli kesim (Laser cut)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Tikish xoshiyasi (Sewing Margin):
                    </label>
                    <Select
                      value={String(formData.labelSewingMarginMm ?? 5)}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("labelSewingMarginMm", Number(val));
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 mm (Xoshiyasiz)</SelectItem>
                        <SelectItem value="3">3 mm (Tor chok)</SelectItem>
                        <SelectItem value="5">5 mm (Standart tikuv)</SelectItem>
                        <SelectItem value="7">7 mm (Keng tikuv)</SelectItem>
                        <SelectItem value="10">10 mm (Qalin kiyimlar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Flexo Card 2: Textile Substrate, Ink & Wash Care */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      Lenta xomashyosi va Bo&apos;yoq (Textile Substrate & Inks)
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formData.labelPrintSides === "2s" ? "2-tomonlama (1+1)" : "1-tomonlama (1+0)"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Lenta turi (Ribbon Material):
                    </label>
                    <Select
                      value={formData.labelMaterialType || (formData.paperStock?.toLowerCase().includes("satin") ? "polyester_satin_white" : "nylon_taffeta")}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        if (!val) return;
                        handleFieldChange("labelMaterialType", val);
                        const labelStockMap: Record<string, string> = {
                          nylon_taffeta: "Nylon Taffeta Care Ribbon",
                          polyester_satin_white: "Satin Ribbon (White Woven Edge)",
                          polyester_satin_black: "Satin Ribbon (Black Dyed Woven Edge)",
                          cotton_tape: "Organic Cotton Tape (Herringbone)",
                          self_adhesive_pp: "Self-Adhesive PP Roll Film",
                          semi_gloss_paper: "Semi-Gloss Label Paper",
                        };
                        handleFieldChange("paperStock", labelStockMap[val] || val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nylon_taffeta">Neylon (Nylon Taffeta) — Parvarish va o&apos;lcham yorlig&apos;i</SelectItem>
                        <SelectItem value="polyester_satin_white">Oq Satin (Polyester Satin) — Ipaksimon yumshoq</SelectItem>
                        <SelectItem value="polyester_satin_black">Qora Satin (Black Satin) — Premium to&apos;qilgan qirra</SelectItem>
                        <SelectItem value="cotton_tape">Organik Paxta (Cotton Tape) — Eko mato</SelectItem>
                        <SelectItem value="self_adhesive_pp">O&apos;ziyelimli Polipropilen (PP Film)</SelectItem>
                        <SelectItem value="semi_gloss_paper">Yarim yaltiroq qog&apos;oz (Semi-gloss)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Lenta qirrasi (Ribbon Edge):
                    </label>
                    <Select
                      value={formData.labelEdgeType || "woven_edge"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelEdgeType", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="woven_edge">To&apos;qilgan qirra (Woven edge — eng mayin)</SelectItem>
                        <SelectItem value="hot_slit">Issiq kesilgan (Hot slit edge)</SelectItem>
                        <SelectItem value="ultrasonic_slit">Ultrasonik kesilgan (Ultrasonic slit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Yuvishga bardoshlilik (Wash Resistance):
                    </label>
                    <Select
                      value={formData.labelWashResistance || "60c"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelWashResistance", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40c">Standart yuvish (40°C)</SelectItem>
                        <SelectItem value="60c">Yuqori harorat (60°C - Kiyimlar)</SelectItem>
                        <SelectItem value="90c_boil">Qaynatishga chidamli (90°C - Tibbiy / Ish kiyimlari)</SelectItem>
                        <SelectItem value="dry_clean">Kimyoviy tozalash (Dry clean)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Bosma tomoni (Print Sides):
                    </label>
                    <Select
                      value={formData.labelPrintSides || "1s"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelPrintSides", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1s">1-tomonlama (1+0 / Faqat yuzi)</SelectItem>
                        <SelectItem value="2s">2-tomonlama (1+1 / Oldi logotip, orqasi tarkib)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              2. JACQUARD WOVEN LABEL CARDS (DAMASK, SATIN, TAFFETA)
          ════════════════════════════════════════════════════════════════ */}
          {isJacquard && (
            <>
              {/* Jacquard Card 1: Woven Label Geometry & Fold */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      To&apos;qima etiketka o&apos;lchamlari va Buklash (Woven Geometry)
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                    To&apos;qima: {formData.width ?? 35}mm × {formData.height ?? 65}mm
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kenglik (Width mm):
                    </label>
                    <Input
                      type="number"
                      value={formData.width ?? 35}
                      disabled={isOperator}
                      onChange={(e) => {
                        handleFieldChange("width", Number(e.target.value));
                        onMarkUnsaved();
                      }}
                      className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Kesim uzunligi (Cut Length mm):
                    </label>
                    <Input
                      type="number"
                      value={formData.height ?? 65}
                      disabled={isOperator}
                      onChange={(e) => {
                        handleFieldChange("height", Number(e.target.value));
                        onMarkUnsaved();
                      }}
                      className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Buklash turi (Fold Type):
                    </label>
                    <Select
                      value={formData.labelFoldType || "end_fold"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelFoldType", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end_fold">Ikki chekkadan buklama (End fold — kiyim ichiga)</SelectItem>
                        <SelectItem value="center_fold">Markazdan buklama (Center / Loop fold)</SelectItem>
                        <SelectItem value="straight_cut">To&apos;g&apos;ri kesim (Straight cut / 4 tomonlama tikuv)</SelectItem>
                        <SelectItem value="manhattan_fold">Kitobcha buklama (Manhattan fold)</SelectItem>
                        <SelectItem value="mitre_fold">Manjetli buklama (Mitre fold)</SelectItem>
                        <SelectItem value="roll">Rulonda (Roll / Uzluksiz)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Qirralarni kesish (Edge Processing):
                    </label>
                    <Select
                      value={formData.labelCutType || "ultrasonic"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("labelCutType", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ultrasonic">Ultrasonik kesim (Soft ultrasonic edge — terini achitmaydi)</SelectItem>
                        <SelectItem value="laser">Lazerli kesim (Laser contour)</SelectItem>
                        <SelectItem value="hot_knife">Issiq pichoq (Hot knife cut)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Jacquard Card 2: Weave Quality & Thread Specs */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">
                      To&apos;qish sifati va Iplar (Weave & Thread Specs)
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formData.weaveQuality || "damask_50d"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      To&apos;qish zichligi (Weave Quality):
                    </label>
                    <Select
                      value={formData.weaveQuality || "damask_50d"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("weaveQuality", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="damask_50d">Damask 50D (High Definition — juda mayda detallar)</SelectItem>
                        <SelectItem value="damask_100d">Damask 100D (Standart yuqori sifat)</SelectItem>
                        <SelectItem value="woven_satin">Satin to&apos;qish (Woven Satin — atlas jiloli)</SelectItem>
                        <SelectItem value="taffeta">Tafta (Taffeta — yengil va tejamkor)</SelectItem>
                        <SelectItem value="hd_microfiber">HD Mikrofibra (Ekstra mayin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Lurex metall ip (Metallic Thread):
                    </label>
                    <Select
                      value={formData.lurexColor || "none"}
                      disabled={isOperator}
                      onValueChange={(val: any) => {
                        handleFieldChange("lurexColor", val);
                        handleFieldChange("hasLurexThread", val !== "none");
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Yo&apos;q (Standart poliester ip)</SelectItem>
                        <SelectItem value="gold">Oltin Lurex (Gold Metallic)</SelectItem>
                        <SelectItem value="silver">Kumush Lurex (Silver Metallic)</SelectItem>
                        <SelectItem value="copper">Mis / Bronza (Copper Metallic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════
              3. OFFSET PACKAGING & SHEETFED PRINT CARDS
          ════════════════════════════════════════════════════════════════ */}
          {isOffset && (
            <>
              {/* Card 1: Geometry & Dimensions */}
              <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Size & shape
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Kesim chegarasi: +{formData.bleed ?? 2}mm
              </span>
            </div>

            {/* Row 1: Primary Dimensions & Shape */}
            <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Type
                </label>
                <Select
                  value={formData.itemCategory || "Hangtag"}
                  disabled={isOperator}
                  onValueChange={(val) => {
                    handleFieldChange("itemCategory", val);
                    if (val === "Hangtag") {
                      handleFieldChange("holeSize", 4);
                      handleFieldChange("holePosition", "top-center");
                    } else if (val === "Carton") {
                      handleFieldChange("shapeType", "carton_box");
                    } else if (val === "Flyer") {
                      handleFieldChange("shapeType", "folded");
                    }
                    onMarkUnsaved();
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-muted/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hangtag">Hangtag (Yorliq)</SelectItem>
                    <SelectItem value="Label">Label (Stiker/Etiketka)</SelectItem>
                    <SelectItem value="Card">Business Card / Postcard</SelectItem>
                    <SelectItem value="Carton">Carton Box (Quti)</SelectItem>
                    <SelectItem value="Flyer">Flyer / Buklet</SelectItem>
                    <SelectItem value="Other">Custom Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {tDie("shape")}
                </label>
                <Select
                  value={formData.shapeType || "rectangle"}
                  disabled={isOperator}
                  onValueChange={(val) => {
                    if (!val) return;
                    handleFieldChange("shapeType", val);
                    if (val === "circle") {
                      handleFieldChange("height", formData.width ?? 50);
                    }
                    onMarkUnsaved();
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-muted/20 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rectangle">{tDie("shapeRect")}</SelectItem>
                    <SelectItem value="circle">{tDie("shapeCircle")}</SelectItem>
                    <SelectItem value="oval">{tDie("shapeOval")}</SelectItem>
                    <SelectItem value="folded">{tDie("shapeFolded")}</SelectItem>
                    <SelectItem value="carton_box">{tDie("shapeCarton")}</SelectItem>
                    <SelectItem value="custom_die">{tDie("shapeCustom")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {formData.shapeType === "circle" ? `Diameter (${formData.dimensionUnit || "mm"})` : `Width (${formData.dimensionUnit || "mm"})`}
                </label>
                <Input
                  type="number"
                  value={formData.width ?? 50}
                  disabled={isOperator}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    handleFieldChange("width", num);
                    if (formData.shapeType === "circle") {
                      handleFieldChange("height", num);
                    }
                    onMarkUnsaved();
                  }}
                  className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Height ({formData.dimensionUnit || "mm"})
                </label>
                <Input
                  type="number"
                  value={formData.shapeType === "circle" ? (formData.width ?? 50) : (formData.height ?? 90)}
                  disabled={isOperator || formData.shapeType === "circle"}
                  onChange={(e) => {
                    handleFieldChange("height", Number(e.target.value));
                    onMarkUnsaved();
                  }}
                  className={cn(
                    "h-8 text-xs font-mono font-semibold",
                    formData.shapeType === "circle" ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-muted/20"
                  )}
                />
              </div>
            </div>

            {/* Row 2: Secondary Shape & Finishing Parameters (Dynamic per shape) */}
            <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3 pt-1 border-t border-border/50">
              {/* Secondary Field 1 */}
              {(formData.shapeType === "rectangle" || !formData.shapeType) && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Corners
                  </label>
                  <Select
                    value={formData.cornerType || "Square"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      handleFieldChange("cornerType", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Square">To&apos;g&apos;ri burchak (Square)</SelectItem>
                      <SelectItem value="Rounded (R3)">Aylana R3 (Rounded)</SelectItem>
                      <SelectItem value="Rounded (R5)">Aylana R5 (Rounded)</SelectItem>
                      <SelectItem value="Die-cut">Shtansforma (Custom Die)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.shapeType === "circle" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Contour
                  </label>
                  <div className="h-8 px-2.5 rounded-md bg-muted/30 border border-border flex items-center text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    Doira 360° (Ø{formData.width ?? 50}mm)
                  </div>
                </div>
              )}

              {formData.shapeType === "oval" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Contour
                  </label>
                  <div className="h-8 px-2.5 rounded-md bg-muted/30 border border-border flex items-center text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium truncate">
                    Oval {formData.width ?? 50}×{formData.height ?? 90}
                  </div>
                </div>
              )}

              {formData.shapeType === "folded" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("foldType")}
                  </label>
                  <Select
                    value={formData.foldType || "half_vertical"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      if (!val) return;
                      handleFieldChange("foldType", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="half_vertical">{tDie("foldHalfV")}</SelectItem>
                      <SelectItem value="half_horizontal">{tDie("foldHalfH")}</SelectItem>
                      <SelectItem value="tri_c">{tDie("foldTriC")}</SelectItem>
                      <SelectItem value="tri_z">{tDie("foldTriZ")}</SelectItem>
                      <SelectItem value="gate">{tDie("foldGate")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.shapeType === "carton_box" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("boxType")}
                  </label>
                  <Select
                    value={formData.boxType || "tuck_end"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      if (!val) return;
                      handleFieldChange("boxType", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tuck_end">{tDie("boxTuckEnd")}</SelectItem>
                      <SelectItem value="snap_lock">{tDie("boxSnapLock")}</SelectItem>
                      <SelectItem value="auto_bottom">{tDie("boxAutoBottom")}</SelectItem>
                      <SelectItem value="sleeve">{tDie("boxSleeve")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.shapeType === "custom_die" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("customShape")}
                  </label>
                  <Select
                    value={formData.customShape || "arch"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      if (!val) return;
                      handleFieldChange("customShape", val);
                      if (val === "vector_svg") {
                        setIsSvgModalOpen(true);
                      }
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arch">{tDie("customArch")}</SelectItem>
                      <SelectItem value="hexagon">{tDie("customHexagon")}</SelectItem>
                      <SelectItem value="star">{tDie("customStar")}</SelectItem>
                      <SelectItem value="pillow">{tDie("customPillow")}</SelectItem>
                      <SelectItem value="vector_svg">{tDie("customSvg")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Secondary Field 2 */}
              {formData.shapeType === "carton_box" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {tDie("boxDepth")} ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    value={formData.boxDepth ?? 40}
                    disabled={isOperator}
                    onChange={(e) => {
                      handleFieldChange("boxDepth", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                  />
                </div>
              ) : formData.shapeType === "folded" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Corners
                  </label>
                  <Select
                    value={formData.cornerType || "Square"}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      handleFieldChange("cornerType", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Square">To&apos;g&apos;ri burchak (Square)</SelectItem>
                      <SelectItem value="Rounded (R3)">Aylana R3 (Rounded)</SelectItem>
                      <SelectItem value="Rounded (R5)">Aylana R5 (Rounded)</SelectItem>
                      <SelectItem value="Die-cut">Shtansforma (Custom Die)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : formData.shapeType === "custom_die" && formData.customShape === "vector_svg" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    SVG Data
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSvgInputDraft(formData.customSvgPath || "");
                      setIsSvgModalOpen(true);
                    }}
                    className="h-8 w-full text-xs gap-1.5 cursor-pointer justify-start font-mono truncate"
                  >
                    <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{formData.customSvgPath ? "SVG OK" : tDie("uploadSvg")}</span>
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Bleed ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    value={formData.bleed ?? 2}
                    disabled={isOperator}
                    onChange={(e) => {
                      handleFieldChange("bleed", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono"
                  />
                </div>
              )}

              {/* Secondary Field 3 */}
              {(formData.shapeType === "carton_box" || formData.shapeType === "folded" || (formData.shapeType === "custom_die" && formData.customShape === "vector_svg")) && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Bleed ({formData.dimensionUnit || "mm"})
                  </label>
                  <Input
                    type="number"
                    value={formData.bleed ?? 2}
                    disabled={isOperator}
                    onChange={(e) => {
                      handleFieldChange("bleed", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Technological Tooling / Shtansforma (Die-Cutting) Management */}
            {(formData.shapeType === "carton_box" ||
              formData.shapeType === "custom_die" ||
              formData.shapeType === "folded" ||
              formData.shapeType === "circle" ||
              formData.shapeType === "oval" ||
              formData.cornerType === "Die-cut") && (
              <div className="pt-2.5 space-y-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Stamp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Texkartadagi Jihoz: Kesish Shtansformasi (Die Tooling)</span>
                  </label>
                  {selectedTool && (
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-300">
                      Ombor: {selectedTool.location} ({selectedTool.impressionsUsed.toLocaleString()} / {selectedTool.maxLife.toLocaleString()})
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 @md:grid-cols-3 gap-3 items-end">
                  <div className="@md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Mijozning mavjud shtansformalari
                    </label>
                    <Select
                      value={formData.selectedToolingId || "none"}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        if (val === "none") {
                          handleFieldChange("selectedToolingId", undefined);
                          handleFieldChange("selectedToolingName", undefined);
                          handleFieldChange("toolingProcurementNeeded", false);
                        } else {
                          const t = customerTooling.find((x) => x.id === val);
                          handleFieldChange("selectedToolingId", val);
                          handleFieldChange("selectedToolingName", t?.name);
                          handleFieldChange("toolingProcurementNeeded", false);
                        }
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue placeholder="Mavjud shtansformani tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Shtansforma tanlanmagan (Yangi / Standart)</SelectItem>
                        {availableCustomerTools.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.id} — {t.name} ({t.format}, {t.location})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isOperator}
                      onClick={() => {
                        setNewToolForm({
                          name: `${formData.product || "Mahsulot"} Shtansformasi`,
                          toolType: "Flatbed Die (Штанцформа)",
                          format: `${formData.width || 700}×${formData.height || 1000} mm`,
                          cavities: "4-up",
                          estimatedCost: 65,
                        });
                        setIsNewToolingModalOpen(true);
                      }}
                      className="h-8 w-full text-xs gap-1.5 border-dashed border-amber-500/60 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Yangi buyurtma berish</span>
                    </Button>
                  </div>
                </div>

                {formData.toolingProcurementNeeded && (
                  <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Pudratchiga yangi shtansforma buyurtmasi kiritildi (Tannarxga: <strong>${formData.toolingProcurementCost || 65}</strong> qo&apos;shiladi).
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300">
                      Xarid talab qilinadi
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Drill Hole Specifications */}
            <div className="pt-2.5 space-y-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5 text-primary" />
                  <span>Teshik / Lyuvers (Drill Hole & Eyelet Punch)</span>
                </label>
                {effectiveHoleSize > 0 && effectiveHolePos !== "none" ? (
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Ø{effectiveHoleSize}mm • {effectiveHolePos} (+{effectiveHoleOffset}mm)
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">Teshiksiz (None)</span>
                )}
              </div>

              <div className="grid grid-cols-1 @md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Hole size
                  </label>
                  <Select
                    value={String(effectiveHoleSize)}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      const num = Number(val);
                      handleFieldChange("holeSize", num);
                      if (num === 0) handleFieldChange("holePosition", "none");
                      else if (effectiveHolePos === "none") handleFieldChange("holePosition", "top-center");
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 mm (Teshiksiz)</SelectItem>
                      <SelectItem value="3">Ø3 mm (Ip/Shnur)</SelectItem>
                      <SelectItem value="4">Ø4 mm (Standart)</SelectItem>
                      <SelectItem value="5">Ø5 mm (Katta)</SelectItem>
                      <SelectItem value="6">Ø6 mm (Lyuvers grommet)</SelectItem>
                      <SelectItem value="8">Ø8 mm (Evro-slott)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Position
                  </label>
                  <Select
                    value={effectiveHolePos}
                    disabled={isOperator || effectiveHoleSize === 0}
                    onValueChange={(val) => {
                      handleFieldChange("holePosition", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Yo&apos;q (None)</SelectItem>
                      <SelectItem value="top-center">Tepada markazda (Top Center)</SelectItem>
                      <SelectItem value="top-left">Tepada chapda (Top Left)</SelectItem>
                      <SelectItem value="top-right">Tepada o&apos;ngda (Top Right)</SelectItem>
                      <SelectItem value="left-center">Yon chapda (Left Center)</SelectItem>
                      <SelectItem value="right-center">Yon o&apos;ngda (Right Center)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Offset
                  </label>
                  <Input
                    type="number"
                    value={effectiveHoleOffset}
                    disabled={isOperator || effectiveHoleSize === 0}
                    onChange={(e) => {
                      handleFieldChange("holeOffset", Number(e.target.value));
                      onMarkUnsaved();
                    }}
                    className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Substrate & Dedicated Lamination / Finishing */}
          <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Material & lamination
                </span>
              </div>
              {isLaminationActive ? (
                <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  {currentLamination} · {laminationSides.toUpperCase()} ({laminationMicron}µm)
                </Badge>
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground">
                  No lamination
                </span>
              )}
            </div>

            {/* Paper Stock Row */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Paper / material
              </label>
              <SmartCombobox
                value={formData.paperStock || "Galerie Art Silk 150g/m²"}
                disabled={isOperator}
                onChange={(val) => {
                  handleFieldChange("paperStock", val);
                  onMarkUnsaved();
                }}
                onAddNew={(newStock) => addPaperStock(newStock)}
                searchPlaceholder="Qog'oz markasi yoki zichligini qidiring..."
                allowCustom={!isOperator}
                options={paperStocks}
              />
            </div>

            {/* DEDICATED LAMINATION & FINISHING SECTION */}
            <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Lamination
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Holati:</span>
                  <Badge
                    variant={isLaminationActive ? "default" : "outline"}
                    className={cn(
                      "text-[10px] font-mono",
                      isLaminationActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {isLaminationActive ? "Aktiv" : "Yo'q"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Film type
                  </label>
                  <Select
                    value={currentLamination}
                    disabled={isOperator}
                    onValueChange={(val) => {
                      handleFieldChange("lamination", val);
                      handleFieldChange("coating", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Yo&apos;q / Laminatsiyasiz (Uncoated)</SelectItem>
                      <SelectItem value="Soft-Touch Matte">Soft-Touch Matte (Baxmal/Velvet 30µm)</SelectItem>
                      <SelectItem value="Matte Lamination">Matte Lamination (Xira plyonka 25µm)</SelectItem>
                      <SelectItem value="Gloss Lamination">Gloss Lamination (Yaltiroq plyonka 25µm)</SelectItem>
                      <SelectItem value="Anti-Scuff Matte">Anti-Scuff Matte (Tirnalishga chidamli 28µm)</SelectItem>
                      <SelectItem value="Thermal Metallized Silver">Metallized Silver (Kumush folga plyonka)</SelectItem>
                      <SelectItem value="Thermal Metallized Gold">Metallized Gold (Oltin folga plyonka)</SelectItem>
                      <SelectItem value="Holographic Film">Golografik plyonka (Holographic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Sides
                  </label>
                  <Select
                    value={laminationSides}
                    disabled={isOperator || !isLaminationActive}
                    onValueChange={(val: any) => {
                      handleFieldChange("laminationSides", val);
                      onMarkUnsaved();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1s">1-tomonlama (Front / 1S / 1+0)</SelectItem>
                      <SelectItem value="2s">2-tomonlama (Both sides / 2S / 1+1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLaminationActive && (
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 pt-1 border-t border-border/50">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Thickness (µm)
                    </label>
                    <Select
                      value={String(laminationMicron)}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("laminationMicron", Number(val));
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 µm (Yengil / Standart BOPP)</SelectItem>
                        <SelectItem value="28">28 µm (Mustahkam / O&apos;rtacha)</SelectItem>
                        <SelectItem value="30">30 µm (Soft-Touch Velvet PET)</SelectItem>
                        <SelectItem value="32">32 µm (Qalin / Qattiq himoya)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Finishing
                    </label>
                    <Select
                      value={embellishment}
                      disabled={isOperator}
                      onValueChange={(val) => {
                        handleFieldChange("embellishment", val);
                        onMarkUnsaved();
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">Qo&apos;shimcha pardozsiz (None)</SelectItem>
                        <SelectItem value="Spot UV (3D)">Tanlanma 3D UF lak (Spot UV)</SelectItem>
                        <SelectItem value="Gold Hot Foil">Oltin issiq folga (Gold Foil)</SelectItem>
                        <SelectItem value="Silver Hot Foil">Kumush issiq folga (Silver Foil)</SelectItem>
                        <SelectItem value="Blind Emboss">Relyefli bosish (Blind Emboss)</SelectItem>
                        <SelectItem value="Overall WB Varnish">Umumiy suvli lak (WB Varnish)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Multi-Layer Substrate & Kashirovka (Duplex / Triplex) */}
          <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Multi-layer mounting (Кашировка)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {kashirovkaMode !== "none" && (
                  <Badge variant="outline" className="font-mono text-[10px] text-amber-600 dark:text-amber-400 border-amber-300">
                    {kashirovkaMode === "triplex" ? "3-Ply Triplex" : "2-Ply Duplex"} · {kashirovkaTotals.totalMountedGsm}g/m²
                  </Badge>
                )}
                <Switch
                  checked={kashirovkaMode !== "none"}
                  disabled={isOperator}
                  onCheckedChange={(checked) => {
                    handleKashirovkaModeChange(checked ? "duplex" : "none");
                  }}
                />
              </div>
            </div>

            {kashirovkaMode !== "none" ? (
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Mounting Type:</span>
                  <div className="inline-flex items-center bg-muted p-0.5 rounded-full border border-border">
                    <button
                      type="button"
                      disabled={isOperator}
                      onClick={() => handleKashirovkaModeChange("duplex")}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                        kashirovkaMode === "duplex"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Duplex (2-Ply)
                    </button>
                    <button
                      type="button"
                      disabled={isOperator}
                      onClick={() => handleKashirovkaModeChange("triplex")}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer",
                        kashirovkaMode === "triplex"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Triplex (3-Ply Sandwich)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Net Paper Stock:</span>
                    <span className="font-mono font-bold text-foreground">{kashirovkaTotals.netPaperGsm} gsm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Adhesive Bond:</span>
                    <span className="font-mono font-bold text-foreground">+{kashirovkaTotals.totalGlueGsm} gsm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Caliper:</span>
                    <span className="font-mono font-bold text-primary">~{kashirovkaTotals.estimatedCaliperMm} mm</span>
                  </div>
                </div>

                {/* Substrate Layers Breakdown */}
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Mounted Layers Composition:
                  </span>
                  <div className="space-y-1">
                    {kashirovkaLayers.map((layer, idx) => (
                      <div
                        key={layer.id || idx}
                        className="flex items-center justify-between p-1.5 rounded bg-background border border-border text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono shrink-0">
                            L{idx + 1}
                          </Badge>
                          <span className="font-medium truncate text-foreground">{layer.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground shrink-0">
                          <span>{layer.grammage} gsm</span>
                          <span className="text-border">|</span>
                          <Badge variant="outline" className="h-3.5 px-1 text-[9px]">
                            {layer.colors}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground italic bg-muted/10 p-2.5 rounded border border-dashed border-border text-center">
                Standard single-ply substrate (No mounting/lamination onto secondary carrier).
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Right Column: Visual Die-Line / Textile Label Preview, Print Inks & Sizes */}
        <div className="space-y-3">
          {/* Visual Preview: 2D Die-Line (Offset) OR Textile Care Label Preview (Flexo / Jacquard) */}
          {isOffset ? (
            <DieLinePreview
              width={formData.width ?? 50}
              height={formData.height ?? 90}
              bleed={formData.bleed ?? 2}
              dimensionUnit={formData.dimensionUnit || "mm"}
              cornerType={formData.cornerType || "Square"}
              itemCategory={formData.itemCategory || "Hangtag"}
              shapeType={formData.shapeType || "rectangle"}
              foldType={formData.foldType || "half_vertical"}
              boxType={formData.boxType || "tuck_end"}
              boxDepth={formData.boxDepth || 40}
              customShape={formData.customShape || "arch"}
              customSvgPath={formData.customSvgPath || ""}
              totalQuantity={formData.quantity || 5000}
              paperStock={formData.paperStock || "Galerie Art Silk 150g/m²"}
              holeSize={effectiveHoleSize}
              holePosition={effectiveHolePos}
              holeOffset={effectiveHoleOffset}
              onFlipOrientation={!isOperator && formData.shapeType !== "circle" ? () => {
                const currentW = formData.width ?? 50;
                const currentH = formData.height ?? 90;
                handleFieldChange("width", currentH);
                handleFieldChange("height", currentW);
                onMarkUnsaved();
              } : undefined}
            />
          ) : (
            <TextileLabelPreview
              width={formData.width ?? (isFlexo ? 30 : 35)}
              height={formData.height ?? (isFlexo ? 70 : 65)}
              materialType={formData.labelMaterialType || (formData.paperStock?.toLowerCase().includes("satin") ? "polyester_satin_white" : isJacquard ? "polyester_satin_black" : "nylon_taffeta")}
              foldType={formData.labelFoldType || (isFlexo ? "center_fold" : "end_fold")}
              cutType={formData.labelCutType || "ultrasonic"}
              sewingMarginMm={formData.labelSewingMarginMm ?? 5}
              printSides={formData.labelPrintSides || "1s"}
              department={formData.department}
              weaveQuality={formData.weaveQuality || "damask_50d"}
              hasLurex={formData.hasLurexThread || false}
              lurexColor={formData.lurexColor || "gold"}
              colorsConfig={formData.colorsConfig || "1+0"}
              brandName={formData.product || (isJacquard ? "DAMASK WOVEN" : "CARE INSTRUCTION")}
            />
          )}

          {/* Card 3: Color Stations & Inks */}
          <div className="p-3 bg-card border border-border rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Print colors
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-xs">
                <span className="font-bold text-foreground">
                  {frontTotalCount}+{backTotalCount}
                </span>
                <span className="text-[11px] text-muted-foreground font-sans">
                  ({frontProcessCount + backProcessCount} CMYK{spotColorItems.length > 0 ? ` + ${spotColorItems.length} Spot` : ""})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              {/* Front Colors (Old tomon) */}
              <div className="p-2.5 rounded-md border border-border bg-muted/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Old tomon (Front)</span>
                    <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                      {frontTotalCount} ta rang
                    </Badge>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {frontProcessCount > 0 ? `${frontProcessCount} CMYK` : "0 CMYK"}
                    {frontSpots.length > 0 ? ` + ${frontSpots.length} Spot` : ""}
                  </span>
                </div>

                {/* CMYK Buttons */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "c", label: "C", bg: "bg-cyan-500", text: "text-white" },
                    { key: "m", label: "M", bg: "bg-pink-500", text: "text-white" },
                    { key: "y", label: "Y", bg: "bg-yellow-400", text: "text-black" },
                    { key: "k", label: "K", bg: "bg-zinc-900", text: "text-white" },
                  ].map((ink) => {
                    const active = (frontColors as any)[ink.key];
                    return (
                      <button
                        key={ink.key}
                        type="button"
                        disabled={isOperator}
                        onClick={() => handleToggleFrontColor(ink.key as any)}
                        className={cn(
                          "flex-1 h-7 rounded text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer border",
                          active
                            ? `${ink.bg} ${ink.text} border-transparent shadow-xs scale-[1.02]`
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {ink.label}
                      </button>
                    );
                  })}
                </div>

                {/* Front Pantone Spot Colors */}
                <div className="pt-2 border-t border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Pantone / Spot ({frontSpots.length})
                    </span>
                    {!isOperator && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenPantoneModal("front")}
                        className="h-5 px-1.5 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Pantone qo&apos;shish</span>
                      </Button>
                    )}
                  </div>

                  {frontSpots.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {frontSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className="flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded border border-border bg-card text-xs font-medium shadow-2xs group"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: spot.hex }}
                          />
                          <span className="font-mono text-[11px] font-semibold text-foreground truncate max-w-[150px]">
                            {spot.name}
                          </span>
                          {!isOperator && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSpotColor(spot.id)}
                              className="text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isOperator && (
                      <button
                        type="button"
                        onClick={() => handleOpenPantoneModal("front")}
                        className="w-full py-1 text-[11px] text-muted-foreground/70 hover:text-primary hover:bg-background/80 border border-dashed border-border/70 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Old tomonga Pantone qo&apos;shish</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Back Colors (Orqa tomon) */}
              <div className="p-2.5 rounded-md border border-border bg-muted/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Orqa tomon (Back)</span>
                    <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                      {backTotalCount} ta rang
                    </Badge>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {backProcessCount > 0 ? `${backProcessCount} CMYK` : "0 CMYK"}
                    {backSpots.length > 0 ? ` + ${backSpots.length} Spot` : ""}
                  </span>
                </div>

                {/* CMYK Buttons */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "c", label: "C", bg: "bg-cyan-500", text: "text-white" },
                    { key: "m", label: "M", bg: "bg-pink-500", text: "text-white" },
                    { key: "y", label: "Y", bg: "bg-yellow-400", text: "text-black" },
                    { key: "k", label: "K", bg: "bg-zinc-900", text: "text-white" },
                  ].map((ink) => {
                    const active = (backColors as any)[ink.key];
                    return (
                      <button
                        key={ink.key}
                        type="button"
                        disabled={isOperator}
                        onClick={() => handleToggleBackColor(ink.key as any)}
                        className={cn(
                          "flex-1 h-7 rounded text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer border",
                          active
                            ? `${ink.bg} ${ink.text} border-transparent shadow-xs scale-[1.02]`
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {ink.label}
                      </button>
                    );
                  })}
                </div>

                {/* Back Pantone Spot Colors */}
                <div className="pt-2 border-t border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Pantone / Spot ({backSpots.length})
                    </span>
                    {!isOperator && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenPantoneModal("back")}
                        className="h-5 px-1.5 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Pantone qo&apos;shish</span>
                      </Button>
                    )}
                  </div>

                  {backSpots.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {backSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className="flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded border border-border bg-card text-xs font-medium shadow-2xs group"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: spot.hex }}
                          />
                          <span className="font-mono text-[11px] font-semibold text-foreground truncate max-w-[150px]">
                            {spot.name}
                          </span>
                          {!isOperator && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSpotColor(spot.id)}
                              className="text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isOperator && (
                      <button
                        type="button"
                        onClick={() => handleOpenPantoneModal("back")}
                        className="w-full py-1 text-[11px] text-muted-foreground/70 hover:text-primary hover:bg-background/80 border border-dashed border-border/70 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Orqa tomonga Pantone qo&apos;shish</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Tooling Procurement Order Dialog */}
      <Dialog open={isNewToolingModalOpen} onOpenChange={setIsNewToolingModalOpen}>
        <DialogContent className="sm:max-w-[425px] text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Stamp className="w-4 h-4 text-amber-600" />
              <span>Yangi Shtansforma Tayyorlashga Buyurtma</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Mijozning ushbu buyurtmasi uchun yangi kesish qolipi (штанцформа) yasash xaridini shakllantiring.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium block mb-1">Mijoz</label>
              <Input
                value={formData.customer || ""}
                disabled
                className="h-8 text-xs bg-muted/40 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Shtansforma Nomi / Modeli *</label>
              <Input
                value={newToolForm.name}
                onChange={(e) => setNewToolForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="masalan, Standart Quti 100x60 FEFCO"
                className="h-8 text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium block mb-1">Qolip turi</label>
                <Select
                  value={newToolForm.toolType}
                  onValueChange={(val) => setNewToolForm((p) => ({ ...p, toolType: val || "Flatbed Die (Штанцформа)" }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flatbed Die (Штанцформа)">Flatbed Die (Yassi)</SelectItem>
                    <SelectItem value="Rotary Die (Aylanma)">Rotary Die (Rotatsion)</SelectItem>
                    <SelectItem value="Hot Foil Cliché (Brass)">Hot Foil Klishe (Jez)</SelectItem>
                    <SelectItem value="Embossing Cliché (Magnesium)">Kongrev Klishe (Magniy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Format / Razmer</label>
                <Input
                  value={newToolForm.format}
                  onChange={(e) => setNewToolForm((p) => ({ ...p, format: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium block mb-1">Kassetalar soni (Cavities)</label>
                <Input
                  value={newToolForm.cavities}
                  onChange={(e) => setNewToolForm((p) => ({ ...p, cavities: e.target.value }))}
                  placeholder="masalan, 4-up, 6-up"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Taxminiy narxi (USD)</label>
                <Input
                  type="number"
                  value={newToolForm.estimatedCost}
                  onChange={(e) => setNewToolForm((p) => ({ ...p, estimatedCost: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-xs font-mono font-medium"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewToolingModalOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              size="sm"
              onClick={handleOrderNewTooling}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              Buyurtma berish & Biriktirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
