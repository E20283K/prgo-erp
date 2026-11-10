"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Upload,
  Layers,
  Sparkles,
  Download,
  ExternalLink,
  Paperclip,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  Sliders,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { OrderAttachment } from "@/components/documents/work-order/types";
import {
  fetchImpositionGears,
  analyzeImpositionPdf,
  analyzeImpositionPdfFromUrl,
  analyzeImpositionPdfsFromUrls,
  generateImposition,
} from "@/lib/flexo/imposition/api";
import {
  GearItem,
  AnalyzeResponse,
  DesignAnalysis,
  GenerateResponse,
  OutputFile,
} from "@/lib/flexo/imposition/types";

interface Props {
  defaultQuantity?: number;
  docNo?: string;
  orderName?: string;
  customer?: string;
  productName?: string;
  defaultProdW?: number;
  defaultProdH?: number;
  defaultBleed?: number;
  orderAttachments?: OrderAttachment[];
  setOrderAttachments?: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  onAuditLog?: (action: string, detail: string) => void;
  onFlexoSave?: (gearTeeth: number) => void;
  onSwitchTab?: (tabKey: string) => void;
  onMarkUnsaved?: () => void;
}

export function FlexoCalcTab({
  defaultQuantity = 10000,
  docNo = "WO-NEW",
  orderAttachments = [],
  setOrderAttachments,
  onAuditLog,
  onFlexoSave,
  onSwitchTab,
  onMarkUnsaved,
}: Props) {
  const t = useTranslations("flexoImposition");

  // Gears master list loaded from Python doc-service (gears.json SSOT)
  const [gears, setGears] = useState<GearItem[]>([]);
  const [isLoadingGears, setIsLoadingGears] = useState(false);

  // Selected source attachment or uploaded file
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Per-design overrides: design item_key -> { custom_gear, custom_copies }
  const [gearOverrides, setGearOverrides] = useState<Record<string, number>>({});
  const [copiesOverrides, setCopiesOverrides] = useState<Record<string, number>>({});

  // Imposition Configuration
  const [removeOuterBorder, setRemoveOuterBorder] = useState(true);
  const [separateColors, setSeparateColors] = useState(true);
  const [colorOutputMode, setColorOutputMode] = useState<"side_by_side" | "separate_files">("side_by_side");
  const [combineSameGear, setCombineSameGear] = useState(false);
  const [columnGapMm, setColumnGapMm] = useState<number>(5.0);
  const [maxCylinderWidthMm, setMaxCylinderWidthMm] = useState<number>(0);

  // Regmark settings (1:1 with Python imposition engine)
  const [regmarkEnabled, setRegmarkEnabled] = useState(true);
  const [regmarkStrokeMm, setRegmarkStrokeMm] = useState(0.2);
  const [regmarkTickMm, setRegmarkTickMm] = useState(0.7);
  const [regmarkWidthMm, setRegmarkWidthMm] = useState<number>(0);

  // Production yield block
  const [orderQty, setOrderQty] = useState<number>(defaultQuantity || 10000);
  const [allowancePercent, setAllowancePercent] = useState<number>(5);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateData, setGenerateData] = useState<GenerateResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Visual Preview states
  const [previewMode, setPreviewMode] = useState<"film" | "original">("film");
  const [activeDesignIndex, setActiveDesignIndex] = useState<number>(0);
  const [selectedOutputFileIndex, setSelectedOutputFileIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Attaching state
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachSuccessMsg, setAttachSuccessMsg] = useState<string | null>(null);

  // Gear combobox popover per design
  const [gearComboboxOpenKey, setGearComboboxOpenKey] = useState<string | null>(null);

  // Load gears from doc-service on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingGears(true);
    fetchImpositionGears()
      .then((data) => {
        if (isMounted) setGears(data);
      })
      .catch((err) => {
        console.error("Failed to load gears:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingGears(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter PDF files available in order attachments
  const pdfAttachments = useMemo(() => {
    return orderAttachments.filter((att) => {
      const name = (att.name || "").toLowerCase();
      const type = (att.type || "").toLowerCase();
      return name.endsWith(".pdf") || type.includes("pdf");
    });
  }, [orderAttachments]);

  // Active design
  const currentDesign: DesignAnalysis | undefined = useMemo(() => {
    if (!analyzeData || !analyzeData.designs.length) return undefined;
    return analyzeData.designs[activeDesignIndex] || analyzeData.designs[0];
  }, [analyzeData, activeDesignIndex]);

  // Selected Output file
  const activeOutputFile: OutputFile | undefined = useMemo(() => {
    if (!generateData || !generateData.all_files.length) return undefined;
    return generateData.all_files[selectedOutputFileIndex] || generateData.all_files[0];
  }, [generateData, selectedOutputFileIndex]);

  // Handle PDF file analysis from direct file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setGenerateData(null);
    setGenerateError(null);
    setAttachSuccessMsg(null);

    try {
      // 1. Analyze PDF with doc-service
      const result = await analyzeImpositionPdf(file);
      setAnalyzeData(result);
      setActiveDesignIndex(0);

      // 2. Also register file in work order attachments if handler exists
      if (setOrderAttachments) {
        const localUrl = URL.createObjectURL(file);
        const newAtt: OrderAttachment = {
          id: `att-pdf-${Date.now()}`,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: "application/pdf",
          date: new Date().toISOString().slice(0, 16).replace("T", " "),
          isImage: false,
          url: localUrl,
          category: "artwork",
        };
        setOrderAttachments((prev) => [newAtt, ...prev]);
        setSelectedAttachmentId(newAtt.id);
        onMarkUnsaved?.();
      }

      // Notify parent of selected optimal gear
      if (result.designs.length > 0 && onFlexoSave) {
        onFlexoSave(result.designs[0].suggested_gear);
      }
      onAuditLog?.("Flexo Imposition Analyzed", `${file.name} (${result.designs.length} designs)`);
    } catch (err: any) {
      setAnalyzeError(err?.message || "Tahlil jarayonida xatolik yuz berdi");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle PDF file analysis from existing attachment(s)
  const handleSelectAttachment = async (attId: string) => {
    setSelectedAttachmentId(attId);
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setGenerateData(null);
    setGenerateError(null);
    setAttachSuccessMsg(null);

    try {
      let result: AnalyzeResponse;
      if (attId === "ALL_ATTACHMENTS") {
        const items = pdfAttachments
          .filter((a) => a.url)
          .map((a) => ({ url: a.url!, name: a.name }));
        if (!items.length) {
          throw new Error("Biriktirilgan PDF fayllar topilmadi");
        }
        result = await analyzeImpositionPdfsFromUrls(items);
        onAuditLog?.("Flexo Imposition Analyzed", `Barcha fayllar (${items.length} ta, ${result.designs.length} stiker)`);
      } else {
        const att = pdfAttachments.find((a) => a.id === attId);
        if (!att || !att.url) return;
        result = await analyzeImpositionPdfFromUrl(att.url, att.name);
        onAuditLog?.("Flexo Imposition Analyzed", `${att.name} (${result.designs.length} designs)`);
      }

      setAnalyzeData(result);
      setActiveDesignIndex(0);

      if (result.designs.length > 0 && onFlexoSave) {
        onFlexoSave(result.designs[0].suggested_gear);
      }
    } catch (err: any) {
      setAnalyzeError(err?.message || "Faylni tahlil qilib bo'lmadi");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-analyze attachments on tab switch or mount if available
  const autoAnalyzedKeyRef = useRef<string>("");
  useEffect(() => {
    if (isAnalyzing || !pdfAttachments.length) return;

    const attachmentsKey = pdfAttachments.map((a) => a.id).sort().join(",");
    if (autoAnalyzedKeyRef.current === attachmentsKey) return;

    autoAnalyzedKeyRef.current = attachmentsKey;

    const masterAtt = pdfAttachments.find((a) => a.name.startsWith("[Master PDF]"));
    if (masterAtt) {
      handleSelectAttachment(masterAtt.id);
    } else if (pdfAttachments.length > 1) {
      handleSelectAttachment("ALL_ATTACHMENTS");
    } else {
      handleSelectAttachment(pdfAttachments[0].id);
    }
  }, [pdfAttachments]);

  // Execute Imposition Generation
  const handleGenerate = async () => {
    if (!analyzeData) return;

    setIsGenerating(true);
    setGenerateError(null);
    setAttachSuccessMsg(null);

    const overridesList = analyzeData.designs.map((d) => ({
      item_key: d.item_key,
      custom_gear: gearOverrides[d.item_key] || d.suggested_gear,
      custom_copies: copiesOverrides[d.item_key] || d.suggested_copies,
    }));

    try {
      const genRes = await generateImposition(analyzeData.job_id, {
        remove_outer_border: removeOuterBorder,
        separate_colors: separateColors,
        color_output_mode: colorOutputMode,
        combine_same_gear: combineSameGear,
        column_gap_mm: columnGapMm,
        max_cylinder_width_mm: maxCylinderWidthMm,
        regmark_enabled: regmarkEnabled,
        regmark_stroke_mm: regmarkStrokeMm,
        regmark_tick_mm: regmarkTickMm,
        regmark_custom_width_mm: regmarkWidthMm > 0 ? regmarkWidthMm : null,
        overrides: overridesList,
      });

      setGenerateData(genRes);
      setSelectedOutputFileIndex(0);
      setPreviewMode("film");

      // Notify parent of updated gear
      if (overridesList.length > 0 && onFlexoSave) {
        onFlexoSave(overridesList[0].custom_gear);
      }

      onAuditLog?.(
        "Flexo Imposition Generated",
        `Job ${analyzeData.job_id}: ${genRes.all_files.length} files created`
      );
    } catch (err: any) {
      setGenerateError(err?.message || "Montaj faylini yaratishda xatolik yuz berdi");
    } finally {
      setIsGenerating(false);
    }
  };

  // Attach generated Film PDF to Work Order files
  const handleAttachToOrder = async () => {
    if (!activeOutputFile || !analyzeData || !setOrderAttachments) return;

    setIsAttaching(true);
    setAttachSuccessMsg(null);

    try {
      // 1. Fetch binary PDF from doc-service proxy
      const downloadRes = await fetch(activeOutputFile.download_url);
      if (!downloadRes.ok) throw new Error("Faylni keshdan olib bo'lmadi");
      const fileBlob = await downloadRes.blob();

      // 2. Request presigned upload URL via work order files endpoint
      const metaRes = await fetch(
        `/api/v1/production/work-orders/${encodeURIComponent(docNo)}/files`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docNo,
            fileName: activeOutputFile.filename,
            fileType: "application/pdf",
            fileSize: `${(activeOutputFile.size_bytes / 1024).toFixed(1)} KB`,
            category: "proofs",
          }),
        }
      );

      let finalDownloadUrl = activeOutputFile.download_url;

      if (metaRes.ok) {
        const presignedData = await metaRes.json();
        if (presignedData?.success && presignedData.uploadUrl) {
          // Upload binary to S3
          const uploadRes = await fetch(presignedData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: fileBlob,
          });
          if (uploadRes.ok && presignedData.downloadUrl) {
            finalDownloadUrl = presignedData.downloadUrl;
          }
        }
      }

      // 3. Append to orderAttachments state
      const newAttachment: OrderAttachment = {
        id: `att-film-${Date.now()}`,
        name: activeOutputFile.filename,
        size: `${(activeOutputFile.size_bytes / 1024).toFixed(1)} KB`,
        type: "application/pdf",
        date: new Date().toISOString().slice(0, 16).replace("T", " "),
        isImage: false,
        url: finalDownloadUrl,
        category: "proofs",
      };

      setOrderAttachments((prev) => [newAttachment, ...prev]);
      onMarkUnsaved?.();
      setAttachSuccessMsg(t("attachedSuccess"));
      onAuditLog?.("Flexo Film Attached", `${activeOutputFile.filename}`);
    } catch (err: any) {
      console.error("Attach failed:", err);
      alert(`Biriktirishda xatolik: ${err?.message || err}`);
    } finally {
      setIsAttaching(false);
    }
  };

  // Production Calculations based on current selected/effective gear and N
  const productionMetrics = useMemo(() => {
    if (!analyzeData || !analyzeData.designs.length) return null;
    const targetQty = Math.ceil(orderQty * (1 + allowancePercent / 100));

    return analyzeData.designs.map((d) => {
      const activeGearNum = gearOverrides[d.item_key] || d.suggested_gear;
      const activeCopies = copiesOverrides[d.item_key] || d.suggested_copies;
      const matchedGear = gears.find((g) => g.gear === activeGearNum);
      const printLen = matchedGear ? matchedGear.printing_length : d.printing_length_mm;

      const revolutions = Math.ceil(targetQty / Math.max(1, activeCopies));
      const linearMeters = Math.round((revolutions * printLen) / 1000);

      return {
        key: d.item_key,
        name: d.display_name,
        targetQty,
        activeGearNum,
        activeCopies,
        revolutions,
        linearMeters,
      };
    });
  }, [analyzeData, orderQty, allowancePercent, gearOverrides, copiesOverrides, gears]);

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden text-xs">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: PREPRESS ENGINE CONTROLS & PRODUCTION BLOCK
      ───────────────────────────────────────────────────────────── */}
      <div className="w-[430px] shrink-0 bg-card border border-border rounded-lg flex flex-col overflow-hidden shadow-xs">
        {/* Panel Header */}
        <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-blue-600" />
            <div>
              <h2 className="font-semibold text-foreground text-xs leading-none">
                {t("title")}
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono">
                Narrow-Web Vector Cylinder Imposition
              </span>
            </div>
          </div>
          {analyzeData && (
            <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
              {analyzeData.design_count} {t("designsFound").toLowerCase()}
            </Badge>
          )}
        </div>

        {/* Scrollable Configuration Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Section 1: Source File Selection */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <span className="font-semibold text-foreground text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-blue-600" />
                {t("sourceFile")}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-medium text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="size-3" />
                {t("uploadNew")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </span>

            {/* Select from Order Attachments */}
            {pdfAttachments.length > 0 ? (
              <Select
                value={selectedAttachmentId}
                onValueChange={(val) => {
                  if (val) handleSelectAttachment(val);
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue placeholder={t("selectAttachment")} />
                </SelectTrigger>
                <SelectContent>
                  {pdfAttachments.length > 1 && (
                    <SelectItem value="ALL_ATTACHMENTS" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {t("allAttachedFiles")} ({pdfAttachments.length} ta)
                    </SelectItem>
                  )}
                  {pdfAttachments.map((att) => (
                    <SelectItem key={att.id} value={att.id} className="text-xs">
                      {att.name} ({att.size})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-3 border border-dashed border-border rounded bg-background hover:bg-muted/40 cursor-pointer flex flex-col items-center justify-center text-center gap-1 transition-colors"
              >
                <Upload className="size-4 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  {t("uploadPrompt")}
                </span>
              </div>
            )}

            {analyzeError && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[10px] flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>{analyzeError}</span>
              </div>
            )}
          </div>

          {/* Section 2: Detected Designs & Gear/Copies Overrides */}
          {analyzeData && analyzeData.designs.length > 0 && (
            <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                  <Layers className="size-3.5 text-blue-600" />
                  {t("designsFound")} ({analyzeData.designs.length})
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {analyzeData.filename}
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {analyzeData.designs.map((design, idx) => {
                  const effectiveGear = gearOverrides[design.item_key] || design.suggested_gear;
                  const effectiveCopies = copiesOverrides[design.item_key] || design.suggested_copies;
                  const isCurrent = activeDesignIndex === idx;

                  return (
                    <div
                      key={design.item_key}
                      onClick={() => setActiveDesignIndex(idx)}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-blue-50/70 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800"
                          : "bg-background border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-foreground text-[11px] truncate">
                          {design.display_name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono">
                            {design.width_mm} × {design.length_mm} mm
                          </Badge>
                          {design.has_outer_border && (
                            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                              {t("borderRemoved")}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Colors and Gear Row */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[10px]">
                        {/* Detected Color Dots */}
                        <div className="flex items-center gap-1 shrink-0">
                          {design.colors.map((c) => (
                            <span
                              key={c.name}
                              className="size-2.5 rounded-full border border-black/20"
                              style={{ backgroundColor: c.hex_code }}
                              title={`${c.name} (${c.object_count})`}
                            />
                          ))}
                          <span className="text-muted-foreground text-[9px]">
                            {design.colors.length} {t("colors").toLowerCase()}
                          </span>
                        </div>

                        {/* Cylinder Gear Popover Select */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Popover
                            open={gearComboboxOpenKey === design.item_key}
                            onOpenChange={(open) =>
                              setGearComboboxOpenKey(open ? design.item_key : null)
                            }
                          >
                            <PopoverTrigger
                              type="button"
                              role="combobox"
                              className="h-6 px-1.5 text-[10px] bg-background font-mono font-semibold border border-input rounded hover:bg-accent flex items-center gap-1 cursor-pointer"
                            >
                              <span>{effectiveGear}T</span>
                              <ChevronsUpDown className="size-3 opacity-50" />
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0 shadow-lg" align="end">
                              <Command>
                                <CommandInput placeholder="Val qidirish (45, 59, 100)..." className="h-7 text-xs" />
                                <CommandList className="max-h-48">
                                  <CommandEmpty>Val topilmadi.</CommandEmpty>
                                  <CommandGroup heading="Mavjud Vallar (gears.json)">
                                    {gears.map((g) => (
                                      <CommandItem
                                        key={g.gear}
                                        value={`${g.gear}T ${g.printing_length}mm ${g.available ? "mavjud" : ""}`}
                                        onSelect={() => {
                                          setGearOverrides((prev) => ({
                                            ...prev,
                                            [design.item_key]: g.gear,
                                          }));
                                          setGearComboboxOpenKey(null);
                                          onFlexoSave?.(g.gear);
                                        }}
                                        className="text-xs flex items-center justify-between py-1 px-2 cursor-pointer"
                                      >
                                        <div className="flex items-center gap-1.5 font-mono">
                                          <span className="font-bold">{g.gear}T</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {g.printing_length}mm (Film: {g.film_length}mm)
                                          </span>
                                          {g.available && (
                                            <span className="text-[8px] px-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                                              BOR
                                            </span>
                                          )}
                                        </div>
                                        <Check
                                          className={`size-3 text-blue-600 ${
                                            g.gear === effectiveGear ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {/* Copies Count N Input */}
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground uppercase">N:</span>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={effectiveCopies}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setCopiesOverrides((prev) => ({
                                  ...prev,
                                  [design.item_key]: val,
                                }));
                              }}
                              className="h-6 w-11 text-[10px] font-mono text-center px-1 bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Imposition Engine Settings */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
              <Sliders className="size-3.5 text-blue-600" />
              {t("settings")}
            </span>

            {/* Toggle: Remove Outer Border */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="text-[11px] text-foreground cursor-pointer">
                {t("removeBorder")}
              </label>
              <Switch
                checked={removeOuterBorder}
                onCheckedChange={setRemoveOuterBorder}
              />
            </div>

            {/* Toggle: Color Separation */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="text-[11px] text-foreground cursor-pointer">
                {t("colorSeparation")}
              </label>
              <Switch
                checked={separateColors}
                onCheckedChange={setSeparateColors}
              />
            </div>

            {/* Color Output Mode */}
            {separateColors && (
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-muted-foreground">Rejim:</span>
                <div className="flex bg-muted rounded p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setColorOutputMode("side_by_side")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      colorOutputMode === "side_by_side"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    {t("sideBySide")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorOutputMode("separate_files")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      colorOutputMode === "separate_files"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    {t("separateFiles")}
                  </button>
                </div>
              </div>
            )}

            {/* Toggle: Combine Same Gear */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="text-[11px] text-foreground cursor-pointer">
                {t("combineSameGear")}
              </label>
              <Switch
                checked={combineSameGear}
                onCheckedChange={setCombineSameGear}
              />
            </div>

            {/* Column Gap & Max Cylinder Width */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">
                  {t("columnGap")}
                </label>
                <Input
                  type="number"
                  step={0.5}
                  min={0}
                  value={columnGapMm}
                  onChange={(e) => setColumnGapMm(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-7 text-xs bg-background font-mono text-center"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">
                  {t("maxCylinderWidth")}
                </label>
                <Input
                  type="number"
                  step={5}
                  min={0}
                  value={maxCylinderWidthMm}
                  onChange={(e) => setMaxCylinderWidthMm(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-7 text-xs bg-background font-mono text-center"
                  placeholder="0 (Cheksiz)"
                />
              </div>
            </div>

            {/* Regmark Settings (1:1 with Python imposition engine) */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-foreground cursor-pointer flex items-center gap-1.5">
                  {t("regmarkEnabled")}
                </label>
                <Switch
                  checked={regmarkEnabled}
                  onCheckedChange={setRegmarkEnabled}
                />
              </div>

              {regmarkEnabled && (
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {t("regmarkStroke")}
                      </label>
                      <Input
                        type="number"
                        step={0.05}
                        min={0.05}
                        max={2.0}
                        value={regmarkStrokeMm}
                        onChange={(e) => setRegmarkStrokeMm(parseFloat(e.target.value) || 0.2)}
                        className="h-7 text-xs font-mono text-center bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {t("regmarkTick")}
                      </label>
                      <Input
                        type="number"
                        step={0.1}
                        min={0.2}
                        max={5.0}
                        value={regmarkTickMm}
                        onChange={(e) => setRegmarkTickMm(parseFloat(e.target.value) || 0.7)}
                        className="h-7 text-xs font-mono text-center bg-background"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] text-muted-foreground block">
                        {t("regmarkWidth")}
                      </label>
                      <span className="text-[9px] text-muted-foreground/70 font-mono">
                        {regmarkWidthMm === 0 ? "0 = Avto stiker eni" : `${regmarkWidthMm} mm`}
                      </span>
                    </div>
                    <Input
                      type="number"
                      step={1}
                      min={0}
                      max={100}
                      value={regmarkWidthMm}
                      onChange={(e) => setRegmarkWidthMm(parseFloat(e.target.value) || 0)}
                      className="h-7 text-xs font-mono text-center bg-background"
                      placeholder="0.0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Production Yield & Meter Calculation Block */}
          <div className="space-y-2 border border-border rounded-md p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <span className="font-semibold text-foreground text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-blue-600" />
                {t("production")}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">across = 1</span>
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">
                  {t("orderQty")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={orderQty}
                  onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-7 text-xs bg-background font-mono text-center font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">
                  {t("allowance")}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={allowancePercent}
                  onChange={(e) => setAllowancePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-7 text-xs bg-background font-mono text-center"
                />
              </div>
            </div>

            {/* Computed Per-Design Production Table */}
            {productionMetrics && productionMetrics.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border">
                {productionMetrics.map((pm) => (
                  <div
                    key={pm.key}
                    className="p-1.5 rounded bg-background border border-border flex items-center justify-between text-[10px]"
                  >
                    <span className="font-medium text-foreground truncate max-w-[150px]">
                      {pm.name}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">
                        {pm.revolutions.toLocaleString()} {t("revolutions").toLowerCase()} ({pm.activeCopies}x)
                      </span>
                      <span className="font-semibold text-blue-600">
                        {pm.linearMeters.toLocaleString()} m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-2.5 bg-muted/40 border-t border-border flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleGenerate}
            disabled={!analyzeData || isGenerating || isAnalyzing}
            className="w-full h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>{t("generating")}</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>{t("generate")}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: VISUAL CANVAS & PREPRESS ARTIFACT ACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-border p-3 flex flex-col overflow-hidden relative shadow-xs">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-border mb-2 shrink-0 flex-wrap gap-2">
          {/* View Switch: Original vs Film */}
          <div className="flex items-center gap-2">
            <div className="flex bg-card border border-border rounded-md shadow-xs p-0.5">
              <button
                type="button"
                onClick={() => setPreviewMode("original")}
                disabled={!analyzeData}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  previewMode === "original"
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                }`}
              >
                <Eye className="size-3.5" />
                <span>{t("originalView")}</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewMode("film")}
                disabled={!generateData}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  previewMode === "film"
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                }`}
              >
                <Layers className="size-3.5" />
                <span>{t("filmView")}</span>
              </button>
            </div>

            {/* Generated output files switcher */}
            {generateData && generateData.all_files.length > 1 && (
              <Select
                value={String(selectedOutputFileIndex)}
                onValueChange={(val) => {
                  if (val) setSelectedOutputFileIndex(parseInt(val));
                }}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-card w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateData.all_files.map((file, idx) => (
                    <SelectItem key={file.filename} value={String(idx)} className="text-xs font-mono">
                      {file.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Pure Black Grayscale Audit Badge */}
            {generateData && generateData.items.length > 0 && generateData.items[0].audit && (
              <Badge
                variant="outline"
                className={`text-[10px] font-mono h-6 px-2 ${
                  generateData.items[0].audit.passed
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {generateData.items[0].audit.passed ? t("auditPassed") : t("auditWarning")}
              </Badge>
            )}
          </div>

          {/* Right Action Buttons & Zoom */}
          <div className="flex items-center gap-1.5">
            {/* Zoom Controls */}
            <div className="flex items-center bg-card border border-border rounded-md shadow-xs p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setZoomLevel((prev) => Math.max(40, prev - 15))}
                title="Zoom Out"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <span className="px-1.5 font-mono text-[10px] text-muted-foreground w-11 text-center">
                {zoomLevel}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setZoomLevel((prev) => Math.min(250, prev + 15))}
                title="Zoom In"
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setZoomLevel(100)}
                title="Reset Zoom"
              >
                <Maximize2 className="size-3" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* External PDF Open */}
            {activeOutputFile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(activeOutputFile.download_url, "_blank")}
                className="h-7 text-xs gap-1"
                title={t("openPdf")}
              >
                <ExternalLink className="size-3.5" />
                <span>{t("openPdf")}</span>
              </Button>
            )}

            {/* Download PDF */}
            {activeOutputFile && (
              <a
                href={activeOutputFile.download_url}
                download={activeOutputFile.filename}
                className="inline-flex"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Download className="size-3.5" />
                  <span>{t("downloadPdf")}</span>
                </Button>
              </a>
            )}

            {/* Attach to Order Button */}
            {activeOutputFile && (
              <Button
                variant="default"
                size="sm"
                onClick={handleAttachToOrder}
                disabled={isAttaching}
                className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                <Paperclip className="size-3.5" />
                <span>{isAttaching ? t("attaching") : t("attachToOrder")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Technical Specs Strip: Live Imposition & Regmark Metrics */}
        {currentDesign && (
          <div className="mb-2 px-2.5 py-1.5 rounded bg-card border border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground flex-wrap gap-x-4 gap-y-1 shrink-0">
            <div className="flex items-center gap-3">
              <span>
                <span className="text-foreground font-semibold">Printing:</span>{" "}
                {currentDesign.printing_length_mm.toFixed(2)} mm
              </span>
              <span>
                <span className="text-foreground font-semibold">Film (K_y):</span>{" "}
                {currentDesign.film_length_mm.toFixed(2)} mm ({(currentDesign.compression_ratio * 100).toFixed(2)}%)
              </span>
              <span>
                <span className="text-foreground font-semibold">Slot:</span>{" "}
                {currentDesign.slot_film_length_mm.toFixed(3)} mm
              </span>
            </div>
            <div>
              {regmarkEnabled ? (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  Regmark: Har {currentDesign.slot_film_length_mm.toFixed(3)} mm da (Eni: {regmarkWidthMm > 0 ? `${regmarkWidthMm} mm` : `${currentDesign.width_mm} mm avto`}, {regmarkStrokeMm} mm, {regmarkTickMm} mm)
                </span>
              ) : (
                <span className="text-muted-foreground/60">
                  Regmark: O&apos;chirilgan
                </span>
              )}
            </div>
          </div>
        )}

        {/* Success message banner */}
        {attachSuccessMsg && (
          <div className="mb-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5" />
              {attachSuccessMsg}
            </span>
            {onSwitchTab && (
              <button
                type="button"
                onClick={() => onSwitchTab("files")}
                className="text-[11px] font-semibold underline cursor-pointer"
              >
                Fayllar bo'limida ko'rish →
              </button>
            )}
          </div>
        )}

        {/* Error banner */}
        {generateError && (
          <div className="mb-2 p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{generateError}</span>
          </div>
        )}

        {/* Visual Canvas Display */}
        <div className="flex-1 flex items-center justify-center p-3 relative overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {previewMode === "film" && activeOutputFile?.preview_url ? (
            <div
              className="transition-transform duration-150 ease-out origin-center flex items-center justify-center"
              style={{ transform: `scale(${zoomLevel / 100})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeOutputFile.preview_url}
                alt="Imposed Film Preview"
                className="max-h-[75vh] w-auto rounded border border-border shadow-md object-contain bg-white"
              />
            </div>
          ) : previewMode === "original" && currentDesign?.source_preview_url ? (
            <div
              className="transition-transform duration-150 ease-out origin-center flex items-center justify-center"
              style={{ transform: `scale(${zoomLevel / 100})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentDesign.source_preview_url}
                alt="Source Design Preview"
                className="max-h-[75vh] w-auto rounded border border-border shadow-md object-contain bg-white"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-2">
              <Layers className="size-8 opacity-30" />
              <span className="text-xs font-medium">
                {t("uploadPrompt")}
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                Faylni tanlang yoki chap paneldagi yuklash tugmasidan foydalaning
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
