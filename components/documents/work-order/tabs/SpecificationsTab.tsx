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
  Maximize2,
  Tag,
  ShieldCheck,
  Check,
  Boxes,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { DieLinePreview } from "../DieLinePreview";
import { PantoneColorPickerModal, SpotStationSelection } from "../dialogs/PantoneColorPickerModal";
import { useLookupStore } from "@/store/lookupStore";
import { WorkOrderFormData, SpotColorItem } from "../types";

interface SpecificationsTabProps {
  formData: WorkOrderFormData;
  handleFieldChange: (field: string, val: any) => void;
  onMarkUnsaved: () => void;
  isOperator?: boolean;
  onSwitchTab?: (tabKey: string) => void;
}

export function SpecificationsTab({
  formData,
  handleFieldChange,
  onMarkUnsaved,
  isOperator = false,
  onSwitchTab,
}: SpecificationsTabProps) {
  const { paperStocks, addPaperStock, coatings, addCoating } = useLookupStore();
  const [isPantoneModalOpen, setIsPantoneModalOpen] = useState(false);

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

  return (
    <TabsContent value="specs" className="@container flex-1 overflow-y-auto p-4 m-0 space-y-4">
      {/* Pantone Modal */}
      <PantoneColorPickerModal
        isOpen={isPantoneModalOpen}
        onOpenChange={setIsPantoneModalOpen}
        onSelectColor={handleAddSpotColor}
      />

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-card border border-border rounded-lg shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xs text-foreground">
                Mahsulot Konstruksiyasi, Asos va Pardozlash (Technical Specs & Die-Line)
              </h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                {formData.width || 50}×{formData.height || 90} {formData.dimensionUnit || "mm"}
              </Badge>
              {isLaminationActive && (
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]">
                  {currentLamination} ({laminationSides.toUpperCase()})
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Geometriya, qog&apos;oz, plyonkali laminatsiya, lak/folga va bo&apos;yoq stansiyalari parametrlari
            </p>
          </div>
        </div>

        {onSwitchTab && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSwitchTab("materials")}
            className="h-8 text-xs gap-1.5 cursor-pointer shrink-0"
          >
            <Boxes className="w-3.5 h-3.5 text-primary" />
            <span>Xomashyo (BOM) ga o&apos;tish &rarr;</span>
          </Button>
        )}
      </div>

      {/* Main Grid: Left 2 Cols (Specs + Finishing + Colors) & Right 1 Col (Interactive 2D Die-Line) */}
      <div className="grid grid-cols-1 @5xl:grid-cols-12 gap-4 items-start">
        {/* Left Column (7 cols): Form Sections */}
        <div className="@container @5xl:col-span-7 space-y-4 min-w-0">
          {/* Card 1: Geometry & Dimensions */}
          <div className="p-3.5 bg-card border border-border rounded-lg shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Size & shape
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Kesim chegarasi: +{formData.bleed ?? 2}mm
              </span>
            </div>

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
                  Width ({formData.dimensionUnit || "mm"})
                </label>
                <Input
                  type="number"
                  value={formData.width ?? 50}
                  disabled={isOperator}
                  onChange={(e) => {
                    handleFieldChange("width", Number(e.target.value));
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
                  value={formData.height ?? 90}
                  disabled={isOperator}
                  onChange={(e) => {
                    handleFieldChange("height", Number(e.target.value));
                    onMarkUnsaved();
                  }}
                  className="h-8 text-xs bg-muted/20 font-mono font-semibold"
                />
              </div>

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
            </div>

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

          {/* Card 2: Substrate & Dedicated Lamination / Finishing */}
          <div className="p-3.5 bg-card border border-border rounded-lg shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
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
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
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

          {/* Card 3: Color Stations & Inks */}
          <div className="p-3.5 bg-card border border-border rounded-lg shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Print colors
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formData.colorsConfig || "4+0 (CMYK)"}
              </span>
            </div>

            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              {/* Front Colors */}
              <div className="p-2.5 rounded-md border border-border bg-muted/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Old tomon (Front / 1+0)</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    CMYK
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
              </div>

              {/* Back Colors */}
              <div className="p-2.5 rounded-md border border-border bg-muted/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Orqa tomon (Back / 0+1)</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    CMYK
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Pantone Spot Colors */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  <span>Pantone Spot Bo&apos;yoqlar ({spotColorItems.length})</span>
                </label>
                {!isOperator && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPantoneModalOpen(true)}
                    className="h-6 text-[11px] px-2 gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-primary" />
                    <span>+ Pantone qo&apos;shish</span>
                  </Button>
                )}
              </div>

              {spotColorItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {spotColorItems.map((spot) => (
                    <div
                      key={spot.id}
                      className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-md border border-border bg-card text-xs font-medium shadow-2xs"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: spot.hex }}
                      />
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        {spot.name}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-mono uppercase">
                        {spot.side}
                      </Badge>
                      {!isOperator && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpotColor(spot.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded border border-dashed border-border text-center">
                  No Pantone colors — CMYK only
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Interactive 2D Die-Line & Dimensions Inspector */}
        <div className="@container @5xl:col-span-5 space-y-4 min-w-0 @5xl:sticky @5xl:top-0">
          <div className="p-3.5 bg-card border border-border rounded-lg shadow-2xs space-y-3 sticky top-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground">
                  Die-line preview
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                SVG Live Inspector
              </Badge>
            </div>

            {/* Interactive DieLine Preview */}
            <div className="rounded-lg border border-border overflow-hidden bg-background">
              <DieLinePreview
                width={formData.width ?? 50}
                height={formData.height ?? 90}
                bleed={formData.bleed ?? 2}
                dimensionUnit={formData.dimensionUnit || "mm"}
                cornerType={formData.cornerType || "Square"}
                itemCategory={formData.itemCategory || "Hangtag"}
                totalQuantity={formData.quantity || 5000}
                paperStock={formData.paperStock || "Galerie Art Silk 150g/m²"}
                holeSize={effectiveHoleSize}
                holePosition={effectiveHolePos}
                holeOffset={effectiveHoleOffset}
                onOpenLayoutTab={() => onSwitchTab && onSwitchTab("layout")}
              />
            </div>

            {/* Die & Cut Specs Summary Pill */}
            <div className="p-2.5 rounded-md border border-border bg-muted/20 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Net size:</span>
                <span className="font-mono font-bold text-foreground">
                  {formData.width ?? 50} × {formData.height ?? 90} mm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chiqish chegarasi (Gross):</span>
                <span className="font-mono text-foreground">
                  {(formData.width ?? 50) + (formData.bleed ?? 2) * 2} × {(formData.height ?? 90) + (formData.bleed ?? 2) * 2} mm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Burchak & Qolip:</span>
                <span className="font-medium text-foreground">{formData.cornerType || "Square"}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Laminatsiya plyonkasi:</span>
                <span className="font-medium text-primary">
                  {isLaminationActive ? `${currentLamination} (${laminationSides.toUpperCase()})` : "Yo'q"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
