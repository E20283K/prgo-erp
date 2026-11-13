"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  X,
  Grid3X3,
  Copy,
  Sparkles,
  LayoutTemplate,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FlaskConical,
  ArrowRight,
  FileText,
  Printer,
  Check,
  CheckCircle2,
  Upload,
  Eye,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Palette,
  GripVertical,
} from "lucide-react";
import { analyzeImpositionPdf } from "@/lib/flexo/imposition/api";
import { AnalyzeResponse, DesignAnalysis } from "@/lib/flexo/imposition/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";
import { Progress } from "@/components/ui/progress";
import {
  SizeDistribution,
  SIZE_SCALE_PRESETS,
  parseModelAndSize,
  formatModelAndSize,
  SkuArtwork,
  OrderAttachment,
} from "../types";
import {
  extractPdfPagesToImages,
  readFileAsDataUrl,
} from "../utils/artworkExtractor";

interface ArtworkUploadTask {
  progress: number;
  state: "uploading" | "processing" | "done" | "error";
  fileName: string;
  fileSize: string;
  errorMessage?: string;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface SizeMatrixCardProps {
  sizes: SizeDistribution[];
  unit: string;
  totalQuantity: number;
  width?: number;
  height?: number;
  printSides?: string;
  isOperator?: boolean;
  onSizesChange: (newSizes: SizeDistribution[]) => void;
  onQuantityChange?: (qty: number) => void;
  onSwitchTab?: (tabKey: string) => void;
  impositionTabKey?: string;
  impositionLabel?: string;
  orderType?: string;
  sampleTargetSize?: string;
  onSampleTargetSizeChange?: (targetSize: string) => void;
  sampleQty?: number;
  onSampleQtyChange?: (qty: number) => void;
  skuArtworks?: SkuArtwork[];
  onSkuArtworksChange?: (artworks: SkuArtwork[]) => void;
  orderAttachments?: OrderAttachment[];
  setOrderAttachments?: React.Dispatch<React.SetStateAction<OrderAttachment[]>>;
  workOrderId?: string;
  isStickerMode?: boolean;
}

export function SizeMatrixCard({
  sizes,
  unit = "pcs",
  totalQuantity,
  width,
  height,
  printSides,
  isOperator = false,
  onSizesChange,
  onQuantityChange,
  onSwitchTab,
  impositionTabKey = "layout",
  impositionLabel,
  orderType,
  sampleTargetSize,
  onSampleTargetSizeChange,
  sampleQty = 5,
  onSampleQtyChange,
  skuArtworks = [],
  onSkuArtworksChange,
  orderAttachments = [],
  setOrderAttachments,
  workOrderId,
  isStickerMode,
}: SizeMatrixCardProps) {
  const isSticker = isStickerMode ?? (impositionTabKey === "flexo" || orderType === "flexo");
  const [viewMode, setViewMode] = useState<"sticker_list" | "matrix">("matrix");
  // Parse existing sizes to detect if multi-model data already exists
  const parsedItems = useMemo(() => {
    return sizes.map((item) => {
      const { model, sizeCode } = parseModelAndSize(item);
      return {
        ...item,
        resolvedModel: model,
        resolvedSize: sizeCode || item.size,
      };
    });
  }, [sizes]);

  // ── Matrix State (Models = Rows, SizeCodes = Columns) ──
  const [models, setModels] = useState<string[]>(() => {
    const rawModels = Array.from(
      new Set(parsedItems.map((i) => i.resolvedModel).filter(Boolean))
    );
    const cleanModels = isSticker
      ? rawModels.filter(
          (m) =>
            !m.toLowerCase().startsWith("stiker #") &&
            !m.toLowerCase().startsWith("sticker #") &&
            true
        )
      : rawModels;
    return cleanModels.length > 0 ? cleanModels : ["Model 1"];
  });

  const [sizeColumns, setSizeColumns] = useState<string[]>(() => {
    const rawCols = Array.from(
      new Set(parsedItems.map((i) => i.resolvedSize).filter(Boolean))
    );
    const cleanCols = isSticker
      ? rawCols
      : rawCols;
    return cleanCols.length > 0
      ? cleanCols
      : ["S", "M", "L", "XL", "2XL"];
  });

  // Sync models & columns if external sizes change significantly
  useEffect(() => {
    const rawModels = Array.from(
      new Set(parsedItems.map((i) => i.resolvedModel).filter(Boolean))
    );
    const cleanModels = isSticker
      ? rawModels.filter(
          (m) =>
            !m.toLowerCase().startsWith("stiker #") &&
            !m.toLowerCase().startsWith("sticker #") &&
            true
        )
      : rawModels;

    const rawCols = Array.from(
      new Set(parsedItems.map((i) => i.resolvedSize).filter(Boolean))
    );
    const cleanCols = isSticker
      ? rawCols
      : rawCols;

    if (cleanModels.length > 0) {
      setModels((prev) => Array.from(new Set([...prev, ...cleanModels])));
    }
    if (cleanCols.length > 0) {
      setSizeColumns((prev) => Array.from(new Set([...prev, ...cleanCols])));
    }
  }, [parsedItems, isSticker]);

  // ── General / Standard Models (Brand logo, Care instruction, etc.) ──
  const [generalModels, setGeneralModels] = useState<string[]>(() => {
    const list: string[] = [];
    parsedItems.forEach((i) => {
      const isStd =
        i.sizeCode === "STD" ||
        (i.size && (i.size.toLowerCase().includes("standart") || i.size.toLowerCase() === "std"));
      if (isStd && i.resolvedModel && !list.includes(i.resolvedModel)) {
        list.push(i.resolvedModel);
      }
    });
    return list;
  });

  const isGeneralModel = React.useCallback(
    (m: string) => {
      const lower = m.toLowerCase();
      return (
        generalModels.includes(m) ||
        lower.includes("brend") ||
        lower.includes("logo") ||
        lower.includes("instruk") ||
        lower.includes("care") ||
        lower.includes("etiketka") ||
        lower.includes("standart") ||
        lower.includes("yagona")
      );
    },
    [generalModels]
  );

  // Build quick lookup map: key = `${model}___${sizeCode}` -> quantity
  const cellQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    const effectiveModelFallback = models[0] || "Model 1";
    parsedItems.forEach((item) => {
      const m = item.resolvedModel || effectiveModelFallback;
      const isStd =
        item.sizeCode === "STD" ||
        item.resolvedSize?.toLowerCase() === "standart" ||
        item.resolvedSize?.toLowerCase() === "std";
      const s = isStd ? "STD" : item.resolvedSize;
      const key = `${m}___${s}`;
      map[key] = (map[key] || 0) + (Number(item.quantity) || 0);
    });
    return map;
  }, [parsedItems, models]);

  // Total quantity of garment sizes only (excluding standard general labels)
  const garmentTotal = useMemo(() => {
    let sum = 0;
    models.forEach((m) => {
      if (!isGeneralModel(m)) {
        sizeColumns.forEach((col) => {
          sum += cellQuantities[`${m}___${col}`] || 0;
        });
      }
    });
    return sum;
  }, [models, sizeColumns, cellQuantities, isGeneralModel]);

  // Row total calculator
  const getRowTotal = React.useCallback(
    (m: string) => {
      if (isGeneralModel(m)) {
        return cellQuantities[`${m}___STD`] || 0;
      }
      return sizeColumns.reduce(
        (sum, col) => sum + (cellQuantities[`${m}___${col}`] || 0),
        0
      );
    },
    [isGeneralModel, cellQuantities, sizeColumns]
  );

  // List of all distinct sizes across matrix columns and parsed items
  const allAvailableSizes = useMemo(() => {
    const fromCols = sizeColumns.filter(Boolean);
    const fromList = sizes.map((s) => s.sizeCode || s.size).filter(Boolean);
    const merged = Array.from(new Set([...fromCols, ...fromList]));
    return merged.length > 0 ? merged : ["S", "M", "L", "XL", "2XL"];
  }, [sizeColumns, sizes]);

  const effectiveTargetSize = useMemo(() => {
    if (sampleTargetSize && sampleTargetSize !== "all" && allAvailableSizes.includes(sampleTargetSize)) {
      return sampleTargetSize;
    }
    return allAvailableSizes[0] || "M";
  }, [sampleTargetSize, allAvailableSizes]);

  // Check if order has no sizes or is a single copy / generic item
  const isInitiallyStandard = useMemo(() => {
    if (orderType === "Sample" || (sampleTargetSize && sampleTargetSize !== "all")) {
      return false;
    }
    if (!sizes || sizes.length === 0) return true;
    if (sizes.length === 1) {
      const s = (sizes[0].size || "").trim().toLowerCase();
      if (!s || s === "standart" || s === "standard" || s === "std" || s === "yagona" || s === "-" || s === "1 dona" || s === "dona" || s === "n/a") {
        return true;
      }
      if (Number(sizes[0].quantity) <= 1 && totalQuantity <= 1) {
        return true;
      }
    }
    return false;
  }, [orderType, sampleTargetSize, sizes, totalQuantity]);

  // Production scope: "standard" (1 copy, no sizes, 1+0), "full" (all sizes / serial), or "single_sample" (only 1 target size for sample run)
  const [scope, setScope] = useState<"standard" | "full" | "single_sample">(() => {
    if (orderType === "Sample" || (sampleTargetSize && sampleTargetSize !== "all")) {
      return "single_sample";
    }
    if (isInitiallyStandard) {
      return "standard";
    }
    return "full";
  });

  const handleConvertToStandard = () => {
    setScope("standard");
    onSizesChange([
      {
        id: "size-std-1",
        size: "Standart",
        sizeCode: "STD",
        quantity: totalQuantity || 1,
      },
    ]);
  };

  const handleConvertToMatrix = () => {
    setScope("full");
    onSampleTargetSizeChange?.("all");
    if (!sizes || sizes.length === 0 || (sizes.length === 1 && (sizes[0].size === "Standart" || !sizes[0].size))) {
      const baseQty = Math.max(0, Number(totalQuantity) || 0);
      const perSize = baseQty > 0 ? Math.floor(baseQty / 4) : 0;
      const remainder = baseQty > 0 ? baseQty - perSize * 4 : 0;
      onSizesChange([
        { id: `size-${Date.now()}-1`, size: "S", sizeCode: "S", quantity: perSize + remainder },
        { id: `size-${Date.now()}-2`, size: "M", sizeCode: "M", quantity: perSize },
        { id: `size-${Date.now()}-3`, size: "L", sizeCode: "L", quantity: perSize },
        { id: `size-${Date.now()}-4`, size: "XL", sizeCode: "XL", quantity: perSize },
      ]);
    }
  };

  // Popover state for adding size columns
  const [isAddSizeOpen, setIsAddSizeOpen] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState("");

  // Popover state for quick actions / mass fill
  const [isQuickFillOpen, setIsQuickFillOpen] = useState(false);
  const [quickFillQty, setQuickFillQty] = useState("500");

  // Helper to build cellDesignMap from skuArtworks, sizes, and models
  const buildCellDesignMap = React.useCallback(
    (artworks: SkuArtwork[], currentSizes: SizeDistribution[], currentModels: string[]) => {
      const map: Record<string, DesignAnalysis> = {};
      const fallbackModel = currentModels[0] || "Model 1";

      artworks.forEach((a, idx) => {
        const url = a.frontArtworkThumb || a.frontArtworkUrl;
        if (!url) return;

        const matchingSize = currentSizes.find(
          (s) => s.id === a.skuId || (s.model === a.model && (s.sizeCode === a.sizeCode || s.size === a.sizeCode))
        ) || (currentModels.length === 1 ? currentSizes.find((s) => s.sizeCode === a.sizeCode || s.size === a.sizeCode) : undefined);

        const targetModel = matchingSize?.model || (currentModels.includes(a.model || "") ? a.model : fallbackModel);
        const targetSize = a.sizeCode || matchingSize?.sizeCode || matchingSize?.size || "STD";

        const designItem: DesignAnalysis = {
          item_key: a.skuId || `art-${idx}`,
          display_name: a.frontArtworkName || `${targetModel} - ${targetSize}`,
          output_stem: a.skuId || `stem-${idx}`,
          page_index: 0,
          sub_index: idx,
          total_sub_designs: artworks.length,
          width_mm: matchingSize?.width ?? width ?? 0,
          length_mm: matchingSize?.height ?? height ?? 0,
          has_outer_border: false,
          border_stroke_width_pt: 0,
          vector_paths_count: 0,
          text_blocks_count: 0,
          suggested_gear: 0,
          suggested_copies: 1,
          printing_length_mm: 0,
          film_length_mm: 0,
          slot_printing_length_mm: 0,
          slot_film_length_mm: 0,
          per_copy_diff_mm: 0,
          total_diff_mm: 0,
          compression_ratio: 1,
          colors: [],
          source_preview_url: url,
          source_pdf_url: a.frontArtworkUrl,
          source_pdf_filename: a.frontArtworkName,
        };

        if (a.model && a.sizeCode) {
          map[`${a.model}___${a.sizeCode}`] = designItem;
        }
        if (targetModel && targetSize) {
          map[`${targetModel}___${targetSize}`] = designItem;
        }
        if (a.skuId) {
          map[a.skuId] = designItem;
        }
      });

      return map;
    },
    [width, height]
  );

  // Cell to design map: key = `${model}___${sizeCode}`
  const [cellDesignMap, setCellDesignMap] = useState<Record<string, DesignAnalysis>>(() => {
    return buildCellDesignMap(skuArtworks, sizes, models);
  });

  // Re-synchronize cellDesignMap whenever skuArtworks or sizes change
  useEffect(() => {
    if (!skuArtworks || skuArtworks.length === 0) return;
    setCellDesignMap((prev) => {
      const synced = buildCellDesignMap(skuArtworks, sizes, models);
      return { ...prev, ...synced };
    });
  }, [skuArtworks, sizes, models, buildCellDesignMap]);

  // Sync matrix state -> SizeDistribution[]
  const commitMatrix = (
    nextModels: string[],
    nextCols: string[],
    nextMap: Record<string, number>,
    overrideDesignMap?: Record<string, DesignAnalysis>
  ) => {
    const activeDesignMap = overrideDesignMap || cellDesignMap;
    const useModelPrefix = nextModels.length > 1 || parsedItems.some((i) => Boolean(i.resolvedModel));
    const result: SizeDistribution[] = [];

    nextModels.forEach((m, mIdx) => {
      if (isGeneralModel(m)) {
        const cellKey = `${m}___STD`;
        const qty = Number(nextMap[cellKey]) || 0;
        const design = activeDesignMap[cellKey];
        result.push({
          id: `sku-${mIdx}-std`,
          model: m,
          sizeCode: "STD",
          size: "Standart",
          quantity: qty,
          width: design?.width_mm ?? width,
          height: design?.length_mm ?? height,
        });
      } else {
        nextCols.forEach((col, cIdx) => {
          const cellKey = `${m}___${col}`;
          const qty = Number(nextMap[cellKey]) || 0;
          const design = activeDesignMap[cellKey];
          if (qty > 0 || (isSticker && design)) {
            result.push({
              id: `sku-${mIdx}-${cIdx}-${col}`,
              model: useModelPrefix ? m : undefined,
              sizeCode: col,
              size: useModelPrefix ? formatModelAndSize(m, col) : col,
              quantity: qty,
              width: design?.width_mm ?? width,
              height: design?.length_mm ?? height,
            });
          }
        });
      }
    });

    onSizesChange(result);
  };

  // Update a single cell in the matrix
  const handleCellChange = (modelName: string, sizeCol: string, valStr: string) => {
    if (isOperator) return;
    const num = Math.max(0, parseInt(valStr, 10) || 0);
    const nextMap = {
      ...cellQuantities,
      [`${modelName}___${sizeCol}`]: num,
    };
    commitMatrix(models, sizeColumns, nextMap);
  };

  // Keyboard navigation for spreadsheet-like entry
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextRow = rowIdx + 1;
      if (nextRow < models.length) {
        const el = document.querySelector<HTMLInputElement>(
          `input[data-matrix-cell="${nextRow}-${colIdx}"]`
        );
        if (el) {
          el.focus();
          el.select();
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevRow = rowIdx - 1;
      if (prevRow >= 0) {
        const el = document.querySelector<HTMLInputElement>(
          `input[data-matrix-cell="${prevRow}-${colIdx}"]`
        );
        if (el) {
          el.focus();
          el.select();
        }
      }
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget;
      if (input.selectionStart === input.value.length) {
        const nextCol = colIdx + 1;
        if (nextCol < sizeColumns.length) {
          e.preventDefault();
          const el = document.querySelector<HTMLInputElement>(
            `input[data-matrix-cell="${rowIdx}-${nextCol}"]`
          );
          if (el) {
            el.focus();
            el.select();
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      if (input.selectionStart === 0) {
        const prevCol = colIdx - 1;
        if (prevCol >= 0) {
          e.preventDefault();
          const el = document.querySelector<HTMLInputElement>(
            `input[data-matrix-cell="${rowIdx}-${prevCol}"]`
          );
          if (el) {
            el.focus();
            el.select();
          }
        }
      }
    }
  };

  // Add custom size column(s) — supports comma/space separated batch e.g. "112, 116, 122, XL, 2XL"
  const handleAddSizeColumns = () => {
    if (isOperator || !customSizeInput.trim()) return;
    const tokens = customSizeInput
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;

    const nextCols = [...sizeColumns];
    const nextMap = { ...cellQuantities };

    tokens.forEach((tok) => {
      if (!nextCols.includes(tok)) {
        nextCols.push(tok);
        models.forEach((m) => {
          if (nextMap[`${m}___${tok}`] === undefined) {
            nextMap[`${m}___${tok}`] = 0;
          }
        });
      }
    });

    setSizeColumns(nextCols);
    setCustomSizeInput("");
    setIsAddSizeOpen(false);
    commitMatrix(models, nextCols, nextMap);
  };

  // Apply a preset scale (replace columns or append)
  const handleApplyScalePreset = (presetSizes: string[]) => {
    if (isOperator) return;
    const nextCols = [...presetSizes];
    const nextMap: Record<string, number> = {};

    models.forEach((m) => {
      nextCols.forEach((col) => {
        const existing = cellQuantities[`${m}___${col}`];
        nextMap[`${m}___${col}`] = existing !== undefined ? existing : 0;
      });
    });

    setSizeColumns(nextCols);
    commitMatrix(models, nextCols, nextMap);
  };

  // Remove a size column
  const handleRemoveSizeColumn = (colToRemove: string) => {
    if (isOperator || sizeColumns.length <= 1) return;
    const nextCols = sizeColumns.filter((c) => c !== colToRemove);
    const nextMap = { ...cellQuantities };
    models.forEach((m) => {
      delete nextMap[`${m}___${colToRemove}`];
    });
    setSizeColumns(nextCols);
    commitMatrix(models, nextCols, nextMap);
  };

  // Rename a size column inline
  const handleRenameSizeColumn = (oldCol: string, newColRaw: string) => {
    if (isOperator) return;
    const newCol = newColRaw.trim();
    if (!newCol || newCol === oldCol || sizeColumns.includes(newCol)) return;
    const nextCols = sizeColumns.map((c) => (c === oldCol ? newCol : c));
    const nextMap: Record<string, number> = {};
    Object.entries(cellQuantities).forEach(([k, v]) => {
      const [m, s] = k.split("___");
      nextMap[`${m}___${s === oldCol ? newCol : s}`] = v;
    });
    setSizeColumns(nextCols);
    commitMatrix(models, nextCols, nextMap);
  };

  // Add 1 or N models
  const handleAddModels = (count = 1) => {
    if (isOperator) return;
    const nextModels = [...models];
    const nextMap = { ...cellQuantities };

    for (let i = 0; i < count; i++) {
      const nextNum = nextModels.length + 1;
      const name = `Model ${nextNum}`;
      if (!nextModels.includes(name)) {
        nextModels.push(name);
        sizeColumns.forEach((col) => {
          nextMap[`${name}___${col}`] = 0;
        });
      }
    }

    setModels(nextModels);
    commitMatrix(nextModels, sizeColumns, nextMap);
  };

  // Remove a model row
  const handleRemoveModel = (modelToRemove: string) => {
    if (isOperator || models.length <= 1) return;
    const nextModels = models.filter((m) => m !== modelToRemove);
    const nextMap = { ...cellQuantities };
    const nextDesignMap = { ...cellDesignMap };
    sizeColumns.forEach((col) => {
      delete nextMap[`${modelToRemove}___${col}`];
      delete nextDesignMap[`${modelToRemove}___${col}`];
    });
    delete nextMap[`${modelToRemove}___STD`];
    delete nextDesignMap[`${modelToRemove}___STD`];
    setGeneralModels((prev) => prev.filter((g) => g !== modelToRemove));
    setModels(nextModels);
    setCellDesignMap(nextDesignMap);
    const nextArtworks = skuArtworks.filter((a) => a.model !== modelToRemove);
    onSkuArtworksChange?.(nextArtworks);
    commitMatrix(nextModels, sizeColumns, nextMap, nextDesignMap);
  };

  // Rename a model row
  const handleRenameModel = (oldModel: string, newModelRaw: string) => {
    if (isOperator) return;
    const newModel = newModelRaw.trim();
    if (!newModel || newModel === oldModel || models.includes(newModel)) return;
    const nextModels = models.map((m) => (m === oldModel ? newModel : m));
    const nextMap: Record<string, number> = {};
    const nextDesignMap: Record<string, DesignAnalysis> = {};

    Object.entries(cellQuantities).forEach(([k, v]) => {
      const [m, s] = k.split("___");
      nextMap[`${m === oldModel ? newModel : m}___${s}`] = v;
    });

    Object.entries(cellDesignMap).forEach(([k, v]) => {
      const [m, s] = k.split("___");
      nextDesignMap[`${m === oldModel ? newModel : m}___${s}`] = v;
    });

    const nextArtworks = skuArtworks.map((a) => {
      if (a.model === oldModel) {
        return { ...a, model: newModel };
      }
      return a;
    });

    setGeneralModels((prev) => prev.map((g) => (g === oldModel ? newModel : g)));
    setModels(nextModels);
    setCellDesignMap(nextDesignMap);
    onSkuArtworksChange?.(nextArtworks);
    commitMatrix(nextModels, sizeColumns, nextMap, nextDesignMap);
  };

  // Copy Row 1 quantities to all other models
  const handleCopyFirstModelToAll = () => {
    if (isOperator || models.length < 2) return;
    const firstModel = models[0];
    const nextMap = { ...cellQuantities };
    models.slice(1).forEach((m) => {
      sizeColumns.forEach((col) => {
        nextMap[`${m}___${col}`] = cellQuantities[`${firstModel}___${col}`] || 0;
      });
    });
    commitMatrix(models, sizeColumns, nextMap);
  };

  // Fill all cells in the matrix with quickFillQty
  const handleFillAllCells = () => {
    if (isOperator) return;
    const q = Math.max(0, parseInt(quickFillQty, 10) || 0);
    const nextMap: Record<string, number> = {};
    models.forEach((m) => {
      sizeColumns.forEach((col) => {
        nextMap[`${m}___${col}`] = q;
      });
    });
    commitMatrix(models, sizeColumns, nextMap);
  };

  // Clear all cells to 0
  const handleClearAllCells = () => {
    if (isOperator) return;
    const nextMap: Record<string, number> = {};
    models.forEach((m) => {
      sizeColumns.forEach((col) => {
        nextMap[`${m}___${col}`] = 0;
      });
    });
    commitMatrix(models, sizeColumns, nextMap);
  };

  // ── Artwork State ──
  const [isArtworkOpen, setIsArtworkOpen] = React.useState(!isSticker);
  const [uploadTasks, setUploadTasks] = React.useState<Record<string, ArtworkUploadTask>>({});
  const activeUploadsRef = React.useRef<Map<string, XMLHttpRequest>>(new Map());
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewName, setPreviewName] = React.useState<string>("");

  // ── Drag & Drop state for Matrix Cells ──
  const [draggedDesign, setDraggedDesign] = React.useState<DesignAnalysis | null>(null);
  const [dragOverCell, setDragOverCell] = React.useState<string | null>(null);

  // ── Hover Image Preview (Work Orders DataGrid style) ──
  const [hoveredPreview, setHoveredPreview] = React.useState<{
    url: string;
    x: number;
    y: number;
    name?: string;
  } | null>(null);

  const getCursorCardPosition = React.useCallback((clientX: number, clientY: number) => {
    const cardWidth = 380;
    const cardHeight = 380;
    let x = clientX + 16;
    let y = clientY + 12;

    if (typeof window !== "undefined") {
      if (x + cardWidth > window.innerWidth - 16) {
        x = clientX - cardWidth - 16;
      }
      if (x < 16) x = 16;

      if (y + cardHeight > window.innerHeight - 16) {
        y = clientY - cardHeight - 12;
      }
      if (y < 16) y = 16;
    }
    return { x, y };
  }, []);

  React.useEffect(() => {
    return () => {
      activeUploadsRef.current.forEach((xhr) => xhr.abort());
      activeUploadsRef.current.clear();
    };
  }, []);

  const artworkMap = React.useMemo(() => {
    const map: Record<string, SkuArtwork> = {};
    const fallbackModel = models[0] || "Model 1";
    skuArtworks.forEach((a) => {
      if (a.skuId) map[a.skuId] = a;
      if (a.model && a.sizeCode) {
        map[`${a.model}___${a.sizeCode}`] = a;
      }
      if (a.sizeCode) {
        map[a.sizeCode] = a;
        if (models.length === 1) {
          map[`${fallbackModel}___${a.sizeCode}`] = a;
        }
      }
    });
    return map;
  }, [skuArtworks, models]);

  // ── Master PDF (Multi-design Sheet) State & Handlers ──
  const masterFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isAnalyzingMaster, setIsAnalyzingMaster] = React.useState(false);
  const [masterAnalyzeData, setMasterAnalyzeData] = React.useState<AnalyzeResponse | null>(null);
  const [masterError, setMasterError] = React.useState<string | null>(null);
  const [isSyncedToMatrix, setIsSyncedToMatrix] = React.useState(false);

  const existingMasterAttachment = React.useMemo(() => {
    return orderAttachments?.find((a) => a.name.startsWith("[Master PDF]"));
  }, [orderAttachments]);

  // All designs available in the tray (from analysis or existing artworks)
  const allTrayDesigns = React.useMemo<DesignAnalysis[]>(() => {
    if (masterAnalyzeData?.designs && masterAnalyzeData.designs.length > 0) {
      return masterAnalyzeData.designs;
    }
    const uniqueMap = new Map<string, DesignAnalysis>();
    skuArtworks.forEach((art, idx) => {
      const url = art.frontArtworkThumb || art.frontArtworkUrl;
      if (url && !uniqueMap.has(url)) {
        const matchingSize = sizes.find(
          (s) => s.model === art.model && (s.sizeCode === art.sizeCode || s.size === art.sizeCode)
        );
        uniqueMap.set(url, {
          item_key: art.skuId || `art-${idx}`,
          display_name: art.frontArtworkName || (art.model ? `${art.model} ${art.sizeCode}` : `Stiker #${idx + 1}`),
          output_stem: `stem-${idx}`,
          page_index: 0,
          sub_index: idx,
          total_sub_designs: skuArtworks.length,
          width_mm: matchingSize?.width ?? width ?? 0,
          length_mm: matchingSize?.height ?? height ?? 0,
          has_outer_border: false,
          border_stroke_width_pt: 0,
          vector_paths_count: 0,
          text_blocks_count: 0,
          suggested_gear: 0,
          suggested_copies: 1,
          printing_length_mm: 0,
          film_length_mm: 0,
          slot_printing_length_mm: 0,
          slot_film_length_mm: 0,
          per_copy_diff_mm: 0,
          total_diff_mm: 0,
          compression_ratio: 1,
          colors: [],
          source_preview_url: url,
        });
      }
    });
    return Array.from(uniqueMap.values());
  }, [masterAnalyzeData, skuArtworks, sizes, width, height]);

  const assignedStickersCount = React.useMemo(() => {
    const urls = new Set<string>();
    Object.values(cellDesignMap).forEach((d) => {
      if (d.source_preview_url) urls.add(d.source_preview_url);
    });
    skuArtworks.forEach((a) => {
      if (a.frontArtworkUrl) urls.add(a.frontArtworkUrl);
      if (a.frontArtworkThumb) urls.add(a.frontArtworkThumb);
    });
    return allTrayDesigns.filter((d) => urls.has(d.source_preview_url)).length;
  }, [cellDesignMap, skuArtworks, allTrayDesigns]);

  const getAssignedCellForDesign = React.useCallback(
    (design: DesignAnalysis) => {
      for (const [key, d] of Object.entries(cellDesignMap)) {
        if (d.source_preview_url === design.source_preview_url || d.item_key === design.item_key) {
          if (key.includes("___")) {
            const [m, col] = key.split("___");
            return { model: m, sizeCode: col, key };
          }
        }
      }
      const art = skuArtworks.find(
        (a) => a.frontArtworkUrl === design.source_preview_url || a.frontArtworkThumb === design.source_preview_url
      );
      if (art && art.sizeCode) {
        const effectiveModel = art.model && models.includes(art.model) ? art.model : (models[0] || art.model || "Model 1");
        return { model: effectiveModel, sizeCode: art.sizeCode, key: `${effectiveModel}___${art.sizeCode}` };
      }
      return null;
    },
    [cellDesignMap, skuArtworks, models]
  );

  const handleAssignStickerToCell = React.useCallback(
    (modelName: string, sizeCol: string, design: DesignAnalysis) => {
      if (isOperator) return;
      const targetKey = `${modelName}___${sizeCol}`;

      const prevAssignment = getAssignedCellForDesign(design);
      const nextDesignMap = { ...cellDesignMap };
      if (prevAssignment && prevAssignment.key !== targetKey) {
        delete nextDesignMap[prevAssignment.key];
      }
      const enrichedDesign: DesignAnalysis = {
        ...design,
        item_key: targetKey,
        display_name: `${modelName} - ${sizeCol}`,
      };
      nextDesignMap[targetKey] = enrichedDesign;
      setCellDesignMap(nextDesignMap);

      const mIdx = models.indexOf(modelName);
      const cIdx = sizeColumns.indexOf(sizeCol);
      const skuId = sizeCol === "STD"
        ? `sku-${mIdx >= 0 ? mIdx : 0}-std`
        : `sku-${mIdx >= 0 ? mIdx : 0}-${cIdx >= 0 ? cIdx : 0}-${sizeCol}`;

      let nextArtworks = skuArtworks.filter(
        (a) =>
          !(a.model === modelName && a.sizeCode === sizeCol) &&
          !(models.length === 1 && a.sizeCode === sizeCol) &&
          a.skuId !== targetKey &&
          a.skuId !== skuId &&
          (prevAssignment ? a.skuId !== prevAssignment.key : true)
      );

      const pdfUrl = design.source_pdf_url || design.source_preview_url;
      const pdfName = design.source_pdf_filename || `${modelName}_${sizeCol}.pdf`;

      nextArtworks.push({
        skuId,
        model: modelName,
        sizeCode: sizeCol,
        frontArtworkUrl: pdfUrl,
        frontArtworkThumb: design.source_preview_url,
        frontArtworkName: pdfName,
      });

      onSkuArtworksChange?.(nextArtworks);
      commitMatrix(models, sizeColumns, cellQuantities, nextDesignMap);
    },
    [isOperator, getAssignedCellForDesign, cellDesignMap, models, sizeColumns, skuArtworks, onSkuArtworksChange, cellQuantities]
  );

  const handleUnassignStickerFromCell = React.useCallback(
    (modelName: string, sizeCol: string) => {
      if (isOperator) return;
      const cellKey = `${modelName}___${sizeCol}`;

      const nextDesignMap = { ...cellDesignMap };
      delete nextDesignMap[cellKey];
      setCellDesignMap(nextDesignMap);

      const mIdx = models.indexOf(modelName);
      const cIdx = sizeColumns.indexOf(sizeCol);
      const skuId = sizeCol === "STD"
        ? `sku-${mIdx >= 0 ? mIdx : 0}-std`
        : `sku-${mIdx >= 0 ? mIdx : 0}-${cIdx >= 0 ? cIdx : 0}-${sizeCol}`;

      const nextArtworks = skuArtworks.filter(
        (a) =>
          !(a.model === modelName && a.sizeCode === sizeCol) &&
          !(models.length === 1 && a.sizeCode === sizeCol) &&
          a.skuId !== cellKey &&
          a.skuId !== skuId
      );
      onSkuArtworksChange?.(nextArtworks);
      commitMatrix(models, sizeColumns, cellQuantities, nextDesignMap);
    },
    [isOperator, cellDesignMap, models, sizeColumns, skuArtworks, onSkuArtworksChange, cellQuantities]
  );

  const handleAutoAssignSequentially = React.useCallback(() => {
    if (isOperator || allTrayDesigns.length === 0) return;

    let designIdx = 0;
    const nextDesignMap = { ...cellDesignMap };
    let nextArtworks = [...skuArtworks];

    const assignedUrls = new Set(
      Object.values(nextDesignMap).map((d) => d.source_preview_url)
    );

    for (const m of models) {
      if (isGeneralModel(m)) {
        const cellKey = `${m}___STD`;
        if (!nextDesignMap[cellKey]) {
          while (
            designIdx < allTrayDesigns.length &&
            assignedUrls.has(allTrayDesigns[designIdx].source_preview_url)
          ) {
            designIdx++;
          }
          if (designIdx < allTrayDesigns.length) {
            const design = allTrayDesigns[designIdx];
            assignedUrls.add(design.source_preview_url);
            nextDesignMap[cellKey] = design;

            const mIdx = models.indexOf(m);
            const skuId = `sku-${mIdx >= 0 ? mIdx : 0}-std`;

            nextArtworks = nextArtworks.filter(
              (a) =>
                !(a.model === m && a.sizeCode === "STD") &&
                a.skuId !== cellKey &&
                a.skuId !== skuId
            );

            const pdfUrl = design.source_pdf_url || design.source_preview_url;
            const pdfName = design.source_pdf_filename || `${m}_STD.pdf`;

            nextArtworks.push({
              skuId,
              model: m,
              sizeCode: "STD",
              frontArtworkUrl: pdfUrl,
              frontArtworkThumb: design.source_preview_url,
              frontArtworkName: pdfName,
            });

            designIdx++;
          }
        }
      } else {
        for (const col of sizeColumns) {
          const cellKey = `${m}___${col}`;
          if (nextDesignMap[cellKey]) continue;

          while (
            designIdx < allTrayDesigns.length &&
            assignedUrls.has(allTrayDesigns[designIdx].source_preview_url)
          ) {
            designIdx++;
          }
          if (designIdx >= allTrayDesigns.length) break;

          const design = allTrayDesigns[designIdx];
          assignedUrls.add(design.source_preview_url);
          nextDesignMap[cellKey] = design;

          const mIdx = models.indexOf(m);
          const cIdx = sizeColumns.indexOf(col);
          const skuId = `sku-${mIdx >= 0 ? mIdx : 0}-${cIdx >= 0 ? cIdx : 0}-${col}`;

          nextArtworks = nextArtworks.filter(
            (a) =>
              !(a.model === m && a.sizeCode === col) &&
              a.skuId !== cellKey &&
              a.skuId !== skuId
          );

          const pdfUrl = design.source_pdf_url || design.source_preview_url;
          const pdfName = design.source_pdf_filename || `${m}_${col}.pdf`;

          nextArtworks.push({
            skuId,
            model: m,
            sizeCode: col,
            frontArtworkUrl: pdfUrl,
            frontArtworkThumb: design.source_preview_url,
            frontArtworkName: pdfName,
          });

          designIdx++;
        }
      }
      if (designIdx >= allTrayDesigns.length) break;
    }

    setCellDesignMap(nextDesignMap);
    onSkuArtworksChange?.(nextArtworks);
    commitMatrix(models, sizeColumns, cellQuantities, nextDesignMap);
  }, [isOperator, allTrayDesigns, cellDesignMap, skuArtworks, models, sizeColumns, isGeneralModel, onSkuArtworksChange, cellQuantities]);

  const handleUnassignAll = React.useCallback(() => {
    if (isOperator) return;
    setCellDesignMap({});
    onSkuArtworksChange?.([]);
    commitMatrix(models, sizeColumns, cellQuantities, {});
  }, [isOperator, onSkuArtworksChange, models, sizeColumns, cellQuantities]);

  const handleMasterPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMasterError("Faqat PDF vektor fayllari qabul qilinadi");
      return;
    }

    setIsAnalyzingMaster(true);
    setMasterError(null);
    setIsSyncedToMatrix(false);

    try {
      const analysis = await analyzeImpositionPdf(file);
      setMasterAnalyzeData(analysis);

      const localUrl = URL.createObjectURL(file);
      let finalUrl = localUrl;

      // Persist to MinIO storage if workOrderId is present
      if (workOrderId) {
        try {
          const res = await fetch(`/api/v1/production/work-orders/${workOrderId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docNo: workOrderId,
              fileName: file.name,
              fileType: file.type,
              fileSize: formatBytes(file.size),
              category: "artwork",
            }),
          });
          const resData = await res.json();
          if (resData.success && resData.uploadUrl) {
            await fetch(resData.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file,
            });
            if (resData.downloadUrl) {
              finalUrl = resData.downloadUrl;
            }
          }
        } catch {
          // fallback to localUrl
        }
      }

      const newAtt: OrderAttachment = {
        id: `att-master-pdf-${Date.now()}`,
        name: `[Master PDF] ${file.name}`,
        size: formatBytes(file.size),
        type: "application/pdf",
        date: new Date().toISOString().slice(0, 16).replace("T", " "),
        isImage: false,
        url: finalUrl,
        category: "artwork",
      };

      setOrderAttachments?.((prev) => {
        const filtered = prev.filter((a) => !a.name.startsWith("[Master PDF]"));
        return [newAtt, ...filtered];
      });

      // Synchronize with matrix or sticker list
      if (analysis.designs.length > 0) {
        setIsSyncedToMatrix(true);

        if (viewMode === "sticker_list") {
          const newSizes: SizeDistribution[] = analysis.designs.map((d, idx) => {
            let label = d.display_name;
            if (label.includes("(") && label.includes(")")) {
              const match = label.match(/\((.*?)\)/);
              if (match) label = match[1];
            } else if (label.includes("[")) {
              const match = label.match(/\[(.*?)\]/);
              if (match) label = `Stiker ${match[1]}`;
            }
            return {
              id: `sz-stk-${Date.now()}-${idx}`,
              model: label || `Stiker ${idx + 1}`,
              size: `${d.width_mm}x${d.length_mm}mm`,
              quantity: 0,
              width: d.width_mm,
              height: d.length_mm,
            };
          });

          const newArtworks: SkuArtwork[] = analysis.designs.map((d, idx) => {
            const row = newSizes[idx];
            const pdfUrl = d.source_pdf_url || d.source_preview_url;
            const pdfName = d.source_pdf_filename || `${row.model}.pdf`;
            return {
              skuId: row.id,
              model: row.model,
              sizeCode: row.size,
              frontArtworkUrl: pdfUrl,
              frontArtworkThumb: d.source_preview_url,
              frontArtworkName: pdfName,
            };
          });

          onSizesChange(newSizes);
          onSkuArtworksChange?.(newArtworks);
        } else {
          // Matrix Mode: assign sequentially to empty cells in existing matrix!
          let designIdx = 0;
          const nextDesignMap = { ...cellDesignMap };
          let nextArtworks = [...skuArtworks];

          for (const m of models) {
            if (isGeneralModel(m)) {
              const cellKey = `${m}___STD`;
              if (!nextDesignMap[cellKey]) {
                if (designIdx < analysis.designs.length) {
                  const design = analysis.designs[designIdx];
                  nextDesignMap[cellKey] = design;

                  const mIdx = models.indexOf(m);
                  const skuId = `sku-${mIdx >= 0 ? mIdx : 0}-std`;

                  nextArtworks = nextArtworks.filter(
                    (a) => !(a.model === m && a.sizeCode === "STD") && a.skuId !== cellKey && a.skuId !== skuId
                  );

                  const pdfUrl = design.source_pdf_url || design.source_preview_url;
                  const pdfName = design.source_pdf_filename || `${m}_STD.pdf`;

                  nextArtworks.push({
                    skuId,
                    model: m,
                    sizeCode: "STD",
                    frontArtworkUrl: pdfUrl,
                    frontArtworkThumb: design.source_preview_url,
                    frontArtworkName: pdfName,
                  });

                  designIdx++;
                }
              }
            } else {
              for (const col of sizeColumns) {
                const cellKey = `${m}___${col}`;
                if (nextDesignMap[cellKey]) continue;
                if (designIdx >= analysis.designs.length) break;

                const design = analysis.designs[designIdx];
                nextDesignMap[cellKey] = design;

                const mIdx = models.indexOf(m);
                const cIdx = sizeColumns.indexOf(col);
                const skuId = `sku-${mIdx >= 0 ? mIdx : 0}-${cIdx >= 0 ? cIdx : 0}-${col}`;

                nextArtworks = nextArtworks.filter(
                  (a) => !(a.model === m && a.sizeCode === col) && a.skuId !== cellKey && a.skuId !== skuId
                );

                const pdfUrl = design.source_pdf_url || design.source_preview_url;
                const pdfName = design.source_pdf_filename || `${m}_${col}.pdf`;

                nextArtworks.push({
                  skuId,
                  model: m,
                  sizeCode: col,
                  frontArtworkUrl: pdfUrl,
                  frontArtworkThumb: design.source_preview_url,
                  frontArtworkName: pdfName,
                });

                designIdx++;
              }
            }
            if (designIdx >= analysis.designs.length) break;
          }

          setCellDesignMap(nextDesignMap);
          onSkuArtworksChange?.(nextArtworks);
          commitMatrix(models, sizeColumns, cellQuantities, nextDesignMap);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setMasterError("PDF montaj xizmati bilan aloqa o'rnatilmadi (Doc-service 404)");
      } else {
        setMasterError(msg || "PDF tahlilida xatolik yuz berdi");
      }
    } finally {
      setIsAnalyzingMaster(false);
      if (masterFileInputRef.current) masterFileInputRef.current.value = "";
    }
  };

  const handleSyncMasterToMatrix = () => {
    if (!masterAnalyzeData || !masterAnalyzeData.designs.length) return;

    const newSizes: SizeDistribution[] = masterAnalyzeData.designs.map((d, idx) => {
      let label = d.display_name;
      if (label.includes("(") && label.includes(")")) {
        const match = label.match(/\((.*?)\)/);
        if (match) label = match[1];
      }
      return {
        id: `sz-master-${Date.now()}-${idx}`,
        model: label || `Stiker ${idx + 1}`,
        size: `${d.width_mm}x${d.length_mm}mm`,
        quantity: 0,
        width: d.width_mm,
        height: d.length_mm,
      };
    });

    const newArtworks: SkuArtwork[] = masterAnalyzeData.designs.map((d, idx) => {
      const row = newSizes[idx];
      return {
        skuId: row.id,
        model: row.model,
        sizeCode: row.size,
        frontArtworkUrl: d.source_preview_url,
        frontArtworkThumb: d.source_preview_url,
        frontArtworkName: `${row.model}.png`,
      };
    });

    onSizesChange(newSizes);
    onSkuArtworksChange?.(newArtworks);
    setIsSyncedToMatrix(true);
  };

  // ── Sticker List Specific Handlers ──
  const [massFillQty, setMassFillQty] = React.useState<string>("");

  const handleApplyMassFill = () => {
    const qty = parseInt(massFillQty, 10);
    if (isNaN(qty) || qty < 0) return;
    const updated = sizes.map((s) => ({ ...s, quantity: qty }));
    onSizesChange(updated);
    onQuantityChange?.(qty * updated.length);
  };

  const handleUpdateStickerItem = (id: string, updates: Partial<SizeDistribution>) => {
    const updated = sizes.map((s) => (s.id === id ? { ...s, ...updates } : s));
    onSizesChange(updated);
    if ("quantity" in updates) {
      const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      onQuantityChange?.(newTotal);
    }
  };

  const handleAddStickerRow = () => {
    const idx = sizes.length + 1;
    const newRow: SizeDistribution = {
      id: `sz-stk-${Date.now()}`,
      model: `Stiker ${idx}`,
      size: `${width || 30}x${height || 50}mm`,
      quantity: 0,
      width: width || 30,
      height: height || 50,
    };
    onSizesChange([...sizes, newRow]);
  };

  const handleDeleteStickerRow = (id: string) => {
    const updated = sizes.filter((s) => s.id !== id);
    onSizesChange(updated);
    const newTotal = updated.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    onQuantityChange?.(newTotal);
    onSkuArtworksChange?.(skuArtworks.filter((a) => a.skuId !== id));
  };

  const cancelUpload = React.useCallback((key: string) => {
    const xhr = activeUploadsRef.current.get(key);
    if (xhr) {
      xhr.abort();
      activeUploadsRef.current.delete(key);
    }
    setUploadTasks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleArtworkUpload = (
    skuItem: { id: string; model?: string; sizeCode?: string; size?: string },
    side: "front" | "back",
    file: File
  ) => {
    const skuId = skuItem.id;
    const key = `${skuId}-${side}`;

    const existingXhr = activeUploadsRef.current.get(key);
    if (existingXhr) {
      existingXhr.abort();
      activeUploadsRef.current.delete(key);
    }

    // Start generating thumbnail in parallel for instant client-side rendering
    let localThumbPromise: Promise<string | null> = Promise.resolve(null);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      localThumbPromise = extractPdfPagesToImages(file, { scale: 1.5, maxPages: 1, autoTrim: false })
        .then((res) => res.front)
        .catch(() => null);
    } else {
      localThumbPromise = readFileAsDataUrl(file).catch(() => null);
    }

    setUploadTasks((prev) => ({
      ...prev,
      [key]: {
        progress: 8,
        state: "uploading",
        fileName: file.name,
        fileSize: formatBytes(file.size),
      },
    }));

    const xhr = new XMLHttpRequest();
    activeUploadsRef.current.set(key, xhr);

    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.min(95, Math.max(8, Math.round((evt.loaded / evt.total) * 95)));
        setUploadTasks((prev) =>
          prev[key] ? { ...prev, [key]: { ...prev[key], progress: pct, state: "uploading" } } : prev
        );
      }
    });

    xhr.addEventListener("load", async () => {
      activeUploadsRef.current.delete(key);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result: { url: string; name: string; thumbUrl?: string } = JSON.parse(xhr.responseText);
          const localThumb = await localThumbPromise;
          const finalThumb = result.thumbUrl || localThumb || undefined;

          setUploadTasks((prev) =>
            prev[key] ? { ...prev, [key]: { ...prev[key], progress: 100, state: "done" } } : prev
          );

          const existing = artworkMap[skuId] || {
            skuId,
            model: skuItem.model,
            sizeCode: skuItem.sizeCode || skuItem.size || "",
          };
          const updated: SkuArtwork = {
            ...existing,
            model: skuItem.model || existing.model,
            sizeCode: skuItem.sizeCode || skuItem.size || existing.sizeCode,
            ...(side === "front"
              ? {
                  frontArtworkUrl: result.url,
                  frontArtworkName: result.name,
                  frontArtworkThumb: finalThumb,
                }
              : {
                  backArtworkUrl: result.url,
                  backArtworkName: result.name,
                  backArtworkThumb: finalThumb,
                }),
          };
          const newArtworks = skuArtworks.filter((a) => a.skuId !== skuId).concat(updated);
          onSkuArtworksChange?.(newArtworks);

          // Synchronize with orderAttachments so uploaded files appear in FilesTab
          setOrderAttachments?.((prev) => {
            const filtered = prev.filter((a) => a.url !== result.url);
            const sideLabel = side === "front" ? "Oldi" : "Orqa";
            const skuLabel = skuItem.model
              ? `${skuItem.model} ${skuItem.sizeCode || skuItem.size || ""}`
              : skuItem.sizeCode || skuItem.size || "SKU";
            const newAtt: OrderAttachment = {
              id: `att-art-${skuId}-${side}-${Date.now()}`,
              name: `[${skuLabel} / ${sideLabel}] ${result.name}`,
              size: formatBytes(file.size),
              type: file.type || (result.name.endsWith(".svg") ? "image/svg+xml" : "application/pdf"),
              date: new Date().toISOString().slice(0, 16).replace("T", " "),
              isImage: file.type.startsWith("image/") || result.name.endsWith(".svg"),
              category: "artwork",
              url: result.url,
            };
            return [newAtt, ...filtered];
          });

          setTimeout(() => {
            setUploadTasks((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }, 600);
        } catch {
          setUploadTasks((prev) =>
            prev[key] ? { ...prev, [key]: { ...prev[key], state: "error", errorMessage: "Javobni o'qib bo'lmadi" } } : prev
          );
        }
      } else {
        let msg = "Yuklashda xatolik";
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson?.error) msg = errJson.error;
        } catch (_) {}
        setUploadTasks((prev) =>
          prev[key] ? { ...prev, [key]: { ...prev[key], state: "error", errorMessage: msg } } : prev
        );
      }
    });

    xhr.addEventListener("error", () => {
      activeUploadsRef.current.delete(key);
      setUploadTasks((prev) =>
        prev[key] ? { ...prev, [key]: { ...prev[key], state: "error", errorMessage: "Tarmoqda xatolik" } } : prev
      );
    });

    xhr.addEventListener("abort", () => {
      activeUploadsRef.current.delete(key);
    });

    const fd = new FormData();
    fd.append("file", file);
    fd.append("workOrderId", workOrderId || "WO");
    fd.append("skuId", skuId);
    fd.append("side", side);

    xhr.open("POST", "/api/artwork/upload");
    xhr.send(fd);
  };

  const handleArtworkRemove = async (skuId: string, side: "front" | "back") => {
    const key = `${skuId}-${side}`;
    cancelUpload(key);

    const existing = artworkMap[skuId];
    if (!existing) return;
    const urlToDelete = side === "front" ? existing.frontArtworkUrl : existing.backArtworkUrl;
    if (urlToDelete) {
      setOrderAttachments?.((prev) => prev.filter((a) => a.url !== urlToDelete));
      try {
        await fetch(`/api/artwork/upload?path=${encodeURIComponent(urlToDelete)}`, { method: "DELETE" });
      } catch (_) {}
    }
    const updated: SkuArtwork = {
      ...existing,
      ...(side === "front"
        ? { frontArtworkUrl: undefined, frontArtworkName: undefined, frontArtworkThumb: undefined }
        : { backArtworkUrl: undefined, backArtworkName: undefined, backArtworkThumb: undefined }),
    };
    const hasFront = !!updated.frontArtworkUrl;
    const hasBack = !!updated.backArtworkUrl;
    const newArtworks = hasFront || hasBack
      ? skuArtworks.filter((a) => a.skuId !== skuId).concat(updated)
      : skuArtworks.filter((a) => a.skuId !== skuId);
    onSkuArtworksChange?.(newArtworks);
  };

  // List of all SKUs available for artwork assignment
  const artworkItems = useMemo(() => {
    if (scope === "standard") {
      return [
        {
          id: sizes[0]?.id || "size-std-1",
          model: "Standart",
          sizeCode: "STD",
          size: "Standart",
          quantity: totalQuantity || 1,
        },
      ];
    }
    const activeSizes = sizes.filter((s) => {
      const { model, sizeCode } = parseModelAndSize(s);
      const cellKey = model ? `${model}___${sizeCode}` : s.id;
      const hasArt = Boolean(
        artworkMap[s.id]?.frontArtworkUrl ||
        artworkMap[cellKey]?.frontArtworkUrl ||
        (sizeCode && artworkMap[sizeCode]?.frontArtworkUrl)
      );
      return (Number(s.quantity) || 0) > 0 || hasArt || (model && isGeneralModel(model));
    });
    const targetList = activeSizes.length > 0 ? activeSizes : sizes;
    if (targetList.length > 0) {
      return targetList.map((s) => {
        const { model, sizeCode } = parseModelAndSize(s);
        return {
          id: s.id,
          model,
          sizeCode: sizeCode || s.size,
          size: s.size,
          quantity: Number(s.quantity) || 0,
        };
      });
    }
    // Fallback if matrix is not yet saved to sizes
    const fallbackList: Array<{ id: string; model?: string; sizeCode: string; size: string; quantity: number }> = [];
    models.forEach((m, mIdx) => {
      if (isGeneralModel(m)) {
        fallbackList.push({
          id: `sku-${mIdx}-std`,
          model: m,
          sizeCode: "STD",
          size: "Standart",
          quantity: cellQuantities[`${m}___STD`] || 0,
        });
      } else {
        sizeColumns.forEach((col, cIdx) => {
          const qty = cellQuantities[`${m}___${col}`] || 0;
          fallbackList.push({
            id: `sku-${mIdx}-${cIdx}-${col}`,
            model: models.length > 1 ? m : undefined,
            sizeCode: col,
            size: models.length > 1 ? formatModelAndSize(m, col) : col,
            quantity: qty,
          });
        });
      }
    });
    return fallbackList;
  }, [scope, sizes, totalQuantity, models, sizeColumns, cellQuantities, isGeneralModel, artworkMap]);

  // Copy first SKU's front artwork to all other SKUs (common front logo)
  const handleApplyFrontToAll = () => {
    if (artworkItems.length <= 1) return;
    const firstItem = artworkItems[0];
    const firstArt = artworkMap[firstItem.id];
    if (!firstArt?.frontArtworkUrl) return;

    const nextArtworks = [...skuArtworks];
    artworkItems.slice(1).forEach((item) => {
      const idx = nextArtworks.findIndex((a) => a.skuId === item.id);
      if (idx >= 0) {
        nextArtworks[idx] = {
          ...nextArtworks[idx],
          model: item.model || nextArtworks[idx].model,
          sizeCode: item.sizeCode || nextArtworks[idx].sizeCode,
          frontArtworkUrl: firstArt.frontArtworkUrl,
          frontArtworkName: firstArt.frontArtworkName,
          frontArtworkThumb: firstArt.frontArtworkThumb,
        };
      } else {
        nextArtworks.push({
          skuId: item.id,
          model: item.model,
          sizeCode: item.sizeCode || item.size || "",
          frontArtworkUrl: firstArt.frontArtworkUrl,
          frontArtworkName: firstArt.frontArtworkName,
          frontArtworkThumb: firstArt.frontArtworkThumb,
        });
      }
    });
    onSkuArtworksChange?.(nextArtworks);
  };

  const totalBatchQty = sizes.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
  const activeSkusCount = sizes.filter((s) => (Number(s.quantity) || 0) > 0).length;

  return (
    <div className="bg-card border border-border rounded-lg shadow-2xs overflow-hidden">
      {/* ── Top Header Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-muted/20 border-b border-border">
        {/* Left: Title & Summary Stats */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {isSticker ? (
              <Layers className="w-3.5 h-3.5" />
            ) : scope === "standard" ? (
              <FileText className="w-3.5 h-3.5" />
            ) : (
              <Tag className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">
                {isSticker && viewMode === "sticker_list"
                  ? "Stikerlar va etiketkalar ro'yxati"
                  : "Model & O'lchamlar taqsimoti"}
              </span>
              <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                {isSticker && viewMode === "sticker_list"
                  ? `${sizes.length} ta stiker`
                  : scope === "standard"
                  ? "Standart (Razmersiz)"
                  : scope === "single_sample"
                  ? "1 SKU (Namuna)"
                  : `${activeSkusCount} SKU`}
              </Badge>
            </div>
            {scope === "standard" ? (
              <p className="text-[11px] text-muted-foreground font-mono">
                Yagona ekzemplyar:{" "}
                <strong className="text-foreground font-semibold">
                  {totalQuantity || 1} {unit}
                </strong>{" "}
                <span className="text-muted-foreground">· 1-tomonlama (1+0)</span>
              </p>
            ) : scope === "single_sample" ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                Sinov namunasi:{" "}
                <strong className="text-foreground font-semibold">
                  {sampleQty} {unit}
                </strong>{" "}
                <span className="text-muted-foreground">({effectiveTargetSize} razmer) · Seriya: {totalBatchQty.toLocaleString()} {unit}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground font-mono">
                Jami:{" "}
                <strong className="text-foreground font-semibold">
                  {(totalBatchQty || totalQuantity).toLocaleString()} {unit}
                </strong>
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions & View Switcher */}
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-0.5 bg-muted/80 p-0.5 rounded-md border border-border">
            <button
              type="button"
              onClick={() => {
                setViewMode("matrix");
                handleConvertToMatrix();
              }}
              className={cn(
                "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1.5 transition-all cursor-pointer",
                (isSticker ? viewMode === "matrix" : (viewMode === "matrix" && scope === "full"))
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="To'liq o'lchamlar matritsasi"
            >
              <Grid3X3 className="w-3 h-3 text-primary" />
              <span>Matritsa</span>
            </button>
            {isSticker && (
              <button
                type="button"
                onClick={() => setViewMode("sticker_list")}
                className={cn(
                  "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1.5 transition-all cursor-pointer",
                  viewMode === "sticker_list"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Stikerlar va etiketkalar ro'yxati"
              >
                <Layers className="w-3 h-3 text-primary" />
                <span>Stikerlar ro&apos;yxati</span>
              </button>
            )}
            {/* Available in all technologies including Flexo */ true && (
              <>
                <button
                  type="button"
                  onClick={handleConvertToStandard}
                  className={cn(
                    "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1.5 transition-all cursor-pointer",
                    scope === "standard"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="O'lchamsiz yagona ekzemplyar (1 dona, 1+0 bir tomonlama bosma)"
                >
                  <FileText className="w-3 h-3 text-primary" />
                  <span>Standart (1 dona)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScope("single_sample");
                    onSampleTargetSizeChange?.(effectiveTargetSize);
                  }}
                  className={cn(
                    "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1.5 transition-all cursor-pointer",
                    scope === "single_sample"
                      ? "bg-background text-amber-700 dark:text-amber-300 shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Namuna / sinov uchun faqat bitta tanlangan razmerni chiqarish"
                >
                  <FlaskConical className="w-3 h-3 text-amber-500" />
                  <span>Namuna (1 razmer)</span>
                </button>
              </>
            )}
          </div>

          {!isOperator && viewMode === "matrix" && scope !== "standard" && (
            <>
              {/* Shablonlar (Presets) Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Shablonlar</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-64 p-1.5 text-xs">
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold px-2 py-1">
                    Standart o&apos;lcham shablonlari
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SIZE_SCALE_PRESETS.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => handleApplyScalePreset(preset.sizes)}
                      className="flex flex-col items-start px-2 py-1.5 cursor-pointer rounded-sm hover:bg-accent"
                    >
                      <span className="font-semibold text-xs text-foreground">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate w-full">
                        {preset.sizes.join(", ")}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tezkor to'ldirish & Amallar Popover */}
              <Popover open={isQuickFillOpen} onOpenChange={setIsQuickFillOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Amallar</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                  }
                />
                <PopoverContent align="end" className="w-72 p-3 space-y-3">
                  <div className="font-semibold text-xs text-foreground border-b border-border pb-1.5">
                    Tirajni to&apos;ldirish &amp; Amallar
                  </div>

                  {/* Mass Fill */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground block font-medium">
                      Barcha katakchalarga tiraj yozish:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={quickFillQty}
                        onChange={(e) => setQuickFillQty(e.target.value)}
                        className="h-7 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          handleFillAllCells();
                          setIsQuickFillOpen(false);
                        }}
                        className="h-7 px-2.5 text-xs shrink-0 cursor-pointer"
                      >
                        To&apos;ldirish
                      </Button>
                    </div>
                  </div>

                  {models.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleCopyFirstModelToAll();
                        setIsQuickFillOpen(false);
                      }}
                      className="w-full h-7 text-xs justify-start gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-primary" />
                      <span>1-model tirajini hammaga nusxalash</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleClearAllCells();
                      setIsQuickFillOpen(false);
                    }}
                    className="w-full h-7 text-xs justify-start gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Barcha katakchalarni tozalash (0)</span>
                  </Button>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* ── STICKER ITEMS LIST VIEW (FLAT TABLE) ── */}
      {isSticker && viewMode === "sticker_list" ? (
        <div className="space-y-0">
          {/* Master PDF Dropzone / Status Bar */}
          <div className="p-2.5 px-3 bg-muted/15 border-b border-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-xs">
                    Master PDF / Umumiy varaq
                  </span>
                  {masterAnalyzeData ? (
                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                      {masterAnalyzeData.design_count} ta stiker aniqlandi va jadvalga joylashtirildi
                    </Badge>
                  ) : existingMasterAttachment ? (
                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono text-muted-foreground">
                      {existingMasterAttachment.name}
                    </Badge>
                  ) : sizes && sizes.length > 0 ? (
                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono bg-muted text-muted-foreground">
                      {sizes.length} ta stiker ro&apos;yxatda
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      (Barcha stikerlar bitta PDF varaqda bo&apos;lsa, bu yerga yuklang)
                    </span>
                  )}
                </div>
                {masterError && !masterAnalyzeData && (!sizes || sizes.length === 0) && (
                  <span className="text-[10px] text-destructive block font-mono">
                    {masterError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={masterFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleMasterPdfUpload}
                className="hidden"
              />

              {isAnalyzingMaster ? (
                <Button size="sm" variant="outline" disabled className="h-7 text-xs gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Tahlil qilinmoqda...</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => masterFileInputRef.current?.click()}
                  className="h-7 text-xs gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-muted-foreground" />
                  <span>{masterAnalyzeData || existingMasterAttachment ? "Boshqa varaq yuklash" : "Master PDF yuklash"}</span>
                </Button>
              )}

              {onSwitchTab && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSwitchTab(impositionTabKey || "flexo")}
                  className="h-7 text-xs gap-1 cursor-pointer text-blue-600 hover:text-blue-700"
                >
                  <span>Spuskka o&apos;tish</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Secondary Action Bar: Add Row & Mass Fill */}
          <div className="p-2 px-3 bg-muted/10 border-b border-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {!isOperator && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddStickerRow}
                  className="h-7 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Stiker qo&apos;shish</span>
                </Button>
              )}

              {/* Mass Fill */}
              {!isOperator && sizes.length > 0 && (
                <div className="flex items-center gap-1.5 bg-background pl-2 pr-1 py-0.5 rounded border border-border">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Barchasiga tiraj yozish:
                  </span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="masalan 1000"
                    value={massFillQty}
                    onChange={(e) => setMassFillQty(e.target.value)}
                    className="h-6 w-24 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyMassFill}
                    className="h-6 px-2 text-[11px] cursor-pointer"
                  >
                    Yozish
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                Stikerlar: <strong className="text-foreground">{sizes.length} ta</strong> · Jami:{" "}
                <strong className="text-foreground font-bold">{totalBatchQty.toLocaleString()} {unit}</strong>
              </span>
            </div>
          </div>

          {/* Sticker Items Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="h-7 border-b border-border">
                  <TableHead className="w-10 text-center font-mono text-[10px] text-muted-foreground">#</TableHead>
                  <TableHead className="w-14 text-center text-[11px]">Eskiz</TableHead>
                  <TableHead className="text-[11px]">Stiker nomi / Turi</TableHead>
                  <TableHead className="w-32 text-center text-[11px]">O&apos;lchami (W×H mm)</TableHead>
                  <TableHead className="w-36 text-right text-[11px]">Tiraji ({unit})</TableHead>
                  <TableHead className="w-16 text-center text-[11px]">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sizes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Layers className="w-6 h-6 text-muted-foreground/40" />
                        <span>Stikerlar ro&apos;yxati bo&apos;sh. Yuqoridagi tugma orqali Master PDF yuklang yoki stiker qo&apos;shing.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sizes.map((item, idx) => {
                    const art =
                      artworkMap[item.id] ||
                      (item.model && item.sizeCode ? artworkMap[`${item.model}___${item.sizeCode}`] : undefined) ||
                      (item.sizeCode ? artworkMap[item.sizeCode] : undefined);
                    const thumb = art?.frontArtworkThumb || art?.frontArtworkUrl;
                    return (
                      <TableRow key={item.id} className="h-9 border-b border-border/70 hover:bg-muted/20">
                        {/* Number */}
                        <TableCell className="text-center font-mono text-[11px] text-muted-foreground p-1">
                          {idx + 1}
                        </TableCell>

                        {/* Thumbnail */}
                        <TableCell className="p-1 text-center">
                          {thumb ? (
                            <div
                              onMouseEnter={(e) => {
                                const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                                setHoveredPreview({
                                  url: thumb,
                                  x,
                                  y,
                                  name: item.model || `Stiker ${idx + 1}`,
                                });
                              }}
                              onMouseMove={(e) => {
                                const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                                setHoveredPreview((prev) => (prev ? { ...prev, x, y } : null));
                              }}
                              onMouseLeave={() => setHoveredPreview(null)}
                              className="w-7 h-7 rounded border border-border bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors mx-auto"
                            >
                              <img src={thumb} alt={item.model} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded border border-dashed border-border/80 flex items-center justify-center mx-auto text-muted-foreground/30">
                              <Tag className="w-3 h-3" />
                            </div>
                          )}
                        </TableCell>

                        {/* Name / Type input */}
                        <TableCell className="p-1 px-2">
                          <Input
                            value={item.model || ""}
                            onChange={(e) => handleUpdateStickerItem(item.id, { model: e.target.value })}
                            placeholder="Brend logotipi, Razmer S, Instruksiya..."
                            className="h-7 text-xs bg-background"
                            disabled={isOperator}
                          />
                        </TableCell>

                        {/* Dimensions */}
                        <TableCell className="p-1 px-2 text-center">
                          {item.width && item.height ? (
                            <Badge variant="outline" className="font-mono text-[11px] h-5 px-1.5">
                              {item.width} × {item.height} mm
                            </Badge>
                          ) : (
                            <Input
                              value={item.size || ""}
                              onChange={(e) => handleUpdateStickerItem(item.id, { size: e.target.value })}
                              placeholder="WxH mm"
                              className="h-7 text-xs font-mono text-center bg-background"
                              disabled={isOperator}
                            />
                          )}
                        </TableCell>

                        {/* Quantity input */}
                        <TableCell className="p-1 px-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity === 0 ? "" : item.quantity}
                            onChange={(e) => handleUpdateStickerItem(item.id, { quantity: Number(e.target.value) || 0 })}
                            placeholder="0"
                            className="h-7 text-xs font-mono text-right bg-background"
                            disabled={isOperator}
                            onFocus={(e) => e.target.select()}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="p-1 text-center">
                          {!isOperator && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStickerRow(item.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <>

      {/* ── Single Size (Sample) Control Bar ── */}
      {scope === "single_sample" && (
        <div className="p-2.5 px-3 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FlaskConical className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-950 dark:text-amber-200 text-xs">
                  Namuna / Sinov rejimi (Faqat bitta razmer)
                </span>
                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-mono">
                  1 ta razmer sinovda
                </Badge>
              </div>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-400/80">
                Ushbu buyurtmada to&apos;liq matritsa emas, faqat tanlangan razmer sinov uchun chop etiladi. To&apos;liq matritsa saqlanadi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Target Size Select */}
            <div className="flex items-center gap-1.5 bg-background/80 px-2 py-0.5 rounded-md border border-amber-500/30">
              <label className="text-[11px] font-medium text-amber-900 dark:text-amber-300">
                Sinov razmeri:
              </label>
              <Select
                value={effectiveTargetSize}
                onValueChange={(val) => {
                  if (val) onSampleTargetSizeChange?.(val);
                }}
                disabled={isOperator}
              >
                <SelectTrigger className="h-6.5 min-w-[85px] text-xs font-mono font-bold bg-background">
                  <SelectValue placeholder="Tanlang..." />
                </SelectTrigger>
                <SelectContent>
                  {allAvailableSizes.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono text-xs">
                      {s} razmer
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sample Quantity */}
            <div className="flex items-center gap-1.5 bg-background/80 px-2 py-0.5 rounded-md border border-amber-500/30">
              <label className="text-[11px] font-medium text-amber-900 dark:text-amber-300">
                Sinov soni:
              </label>
              <Input
                type="number"
                min={1}
                value={sampleQty || 5}
                onChange={(e) => onSampleQtyChange?.(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isOperator}
                className="h-6.5 w-16 text-xs font-mono font-bold bg-background text-right"
              />
              <span className="text-[11px] font-mono text-muted-foreground">{unit}</span>
            </div>

            {onSwitchTab && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSwitchTab("overview")}
                className="h-6.5 px-2 text-[10px] border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 cursor-pointer"
              >
                <span>Overview</span>
                <ArrowRight className="w-2.5 h-2.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      {scope === "standard" ? (
        <div className="p-3.5 bg-background space-y-3">
          {/* Main Informational Notice Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-muted/20 border border-border/80 rounded-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">
                    Yagona bosma ekzemplyar (Standart / Razmersiz)
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5 border-primary/30 bg-primary/5 text-primary">
                    1+0 (Bir tomonlama)
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ushbu buyurtmada o&apos;lchamlar (S, M, L...) taqsimoti talab etilmaydi. Mahsulot 1 dona yagona nusxada, faqat bir tomoniga bosiladigan standart formatda ishlab chiqariladi.
                </p>
              </div>
            </div>

            {!isOperator && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConvertToMatrix}
                className="h-7 text-xs gap-1.5 shrink-0 cursor-pointer"
              >
                <Grid3X3 className="w-3.5 h-3.5 text-primary" />
                <span>O&apos;lchamlar matritsasini kiritish (S, M, L...)</span>
              </Button>
            )}
          </div>

          {/* Key Parameters Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1: Bosma yuzi */}
            <div className="p-2.5 bg-muted/10 border border-border rounded-md shadow-2xs space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Bosma tarafi (Print Side):
              </span>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="font-mono text-[11px] font-semibold px-2 py-0.5">
                  {printSides === "2s" ? "2-tomonlama (1+1)" : "1-tomonlama (1+0)"}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {printSides === "2s" ? "Old & Orqa" : "Faqat old yuzi"}
                </span>
              </div>
            </div>

            {/* 2: Mahsulot o'lchami */}
            <div className="p-2.5 bg-muted/10 border border-border rounded-md shadow-2xs space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Gabarit o&apos;lchami (W × H):
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-foreground">
                  {width ?? 70} × {height ?? 30} mm
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">(Dona format)</span>
              </div>
            </div>

            {/* 3: Tiraj / Ekzemplyar */}
            <div className="p-2.5 bg-muted/10 border border-border rounded-md shadow-2xs space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Ekzemplyar miqdori:
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={totalQuantity || 1}
                  disabled={isOperator}
                  onChange={(e) => {
                    const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                    onQuantityChange?.(q);
                    onSizesChange([{ id: "size-std-1", size: "Standart", sizeCode: "STD", quantity: q }]);
                  }}
                  className="h-7 w-20 text-xs font-mono font-bold bg-background text-right"
                />
                <span className="text-xs font-mono font-semibold text-foreground">{unit}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {(totalQuantity || 1) === 1 ? "(1 ekzemplyar)" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* ── STICKER TRAY (Aniqlangan stikerlar paneli) ── */}
          {(isSticker || allTrayDesigns.length > 0 || masterAnalyzeData || existingMasterAttachment) && (
            <div className="p-2.5 px-3 bg-muted/20 border-b border-border space-y-2">
              {/* Tray Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Layers className="size-3.5" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-xs">
                      Aniqlangan stikerlar paneli
                    </span>
                    {allTrayDesigns.length > 0 ? (
                      <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono bg-background">
                        {assignedStickersCount} / {allTrayDesigns.length} biriktirilgan
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        (Master PDF yuklanganda bu yerda stikerlar paydo bo&apos;ladi)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    ref={masterFileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleMasterPdfUpload}
                    className="hidden"
                  />

                  {isAnalyzingMaster ? (
                    <Button size="sm" variant="outline" disabled className="h-6.5 text-xs gap-1.5">
                      <Loader2 className="size-3 animate-spin" />
                      <span>Tahlil qilinmoqda...</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => masterFileInputRef.current?.click()}
                      className="h-6.5 text-xs gap-1.5 cursor-pointer"
                    >
                      <Upload className="size-3 text-muted-foreground" />
                      <span>{allTrayDesigns.length > 0 ? "Boshqa varaq yuklash" : "Master PDF yuklash"}</span>
                    </Button>
                  )}

                  {!isOperator && allTrayDesigns.length > 0 && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleAutoAssignSequentially}
                        title="Stikerlarni matritsadagi bo'sh kataklarga ketma-ket joylashtirish"
                        className="h-6.5 text-xs gap-1 cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                      >
                        <Sparkles className="size-3 text-primary" />
                        <span>Ketma-ket biriktirish</span>
                      </Button>

                      {assignedStickersCount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleUnassignAll}
                          title="Barcha biriktirilgan stikerlarni kataklardan uzish"
                          className="h-6.5 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                          <span>Barchasini uzish</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Horizontal Scrollable Sticker Chips Tray */}
              {allTrayDesigns.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  {allTrayDesigns.map((d, idx) => {
                    const assigned = getAssignedCellForDesign(d);
                    const isDragging = draggedDesign?.source_preview_url === d.source_preview_url;

                    return (
                      <div
                        key={d.item_key || idx}
                        draggable={!isOperator}
                        onDragStart={(e) => {
                          setDraggedDesign(d);
                          e.dataTransfer.setData("application/json", JSON.stringify(d));
                          e.dataTransfer.effectAllowed = "copyMove";
                        }}
                        onDragEnd={() => setDraggedDesign(null)}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded-md border text-xs transition-all select-none shrink-0 min-w-[150px] shadow-2xs group/card",
                          isDragging && "opacity-40 border-dashed border-primary",
                          assigned
                            ? "opacity-60 hover:opacity-100 bg-muted/30 border-border/70 hover:border-border cursor-grab active:cursor-grabbing"
                            : "bg-card border-border hover:border-primary/70 cursor-grab active:cursor-grabbing"
                        )}
                      >
                        <GripVertical className="size-3 text-muted-foreground/30 group-hover/card:text-muted-foreground shrink-0" />

                        {/* Miniature Thumbnail */}
                        <div
                          onMouseEnter={(e) => {
                            const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                            setHoveredPreview({
                              url: d.source_preview_url,
                              x,
                              y,
                              name: `${d.display_name || `Stiker #${idx + 1}`} (${d.width_mm}×${d.length_mm} mm)`,
                            });
                          }}
                          onMouseMove={(e) => {
                            const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                            setHoveredPreview((prev) => (prev ? { ...prev, x, y } : null));
                          }}
                          onMouseLeave={() => setHoveredPreview(null)}
                          className="relative w-9 h-9 rounded border border-border bg-background flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary transition-colors"
                        >
                          <img
                            src={d.source_preview_url}
                            alt={d.display_name}
                            className="max-w-full max-h-full object-contain"
                          />
                          {assigned && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-tl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="size-2 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* Text / Status Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 leading-tight">
                            <span className="font-mono font-semibold text-[11px] text-foreground truncate">
                              #{idx + 1}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                              {d.width_mm}×{d.length_mm}mm
                            </span>
                          </div>

                          <div className="mt-1">
                            {assigned ? (
                              <div className="flex items-center justify-between gap-1">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 h-4 font-mono font-medium bg-background text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 truncate max-w-[100px]"
                                  title={`${assigned.model} - ${assigned.sizeCode} ga biriktirilgan`}
                                >
                                  <span className="truncate">{assigned.model} / {assigned.sizeCode}</span>
                                </Badge>
                                {!isOperator && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnassignStickerFromCell(assigned.model, assigned.sizeCode);
                                    }}
                                    title="Katakdan uzish"
                                    className="text-muted-foreground hover:text-destructive p-0.5 rounded cursor-pointer transition-colors"
                                  >
                                    <X className="size-2.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] font-mono text-primary/80 font-medium block">
                                Katakka torting
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2D Table */}
          <div className="overflow-x-auto">
            <Table className="w-full text-xs">
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="h-8 px-3 font-semibold text-xs text-foreground min-w-[130px] sticky left-0 bg-muted/90 z-10 border-r border-border">
                    Model / Artikul
                  </TableHead>

                  {/* Size Columns */}
                  {sizeColumns.map((col) => {
                    const isTargetSampleCol = scope === "single_sample" && col === effectiveTargetSize;
                    return (
                      <TableHead
                        key={col}
                        className={cn(
                          "h-8 px-1 text-center font-mono font-semibold text-xs min-w-[72px] transition-colors",
                          isTargetSampleCol
                            ? "bg-amber-500/20 text-amber-950 dark:text-amber-200 border-x border-amber-500/40"
                            : "text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-center gap-1 group">
                          {isTargetSampleCol && (
                            <FlaskConical className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          )}
                          <input
                            type="text"
                            defaultValue={col}
                            disabled={isOperator}
                            onBlur={(e) => handleRenameSizeColumn(col, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            title="Nomini o'zgartirish uchun tahrirlang"
                            className={cn(
                              "w-12 text-center bg-transparent hover:bg-muted/60 focus:bg-background font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 transition-colors",
                              isTargetSampleCol ? "text-amber-950 dark:text-amber-200" : "text-foreground"
                            )}
                          />
                          {isTargetSampleCol && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/30 text-amber-900 dark:text-amber-200 font-sans font-bold">
                              Namuna
                            </span>
                          )}
                          {!isOperator && sizeColumns.length > 1 && !isTargetSampleCol && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSizeColumn(col)}
                              title={`${col} ustunini o'chirish`}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer p-0.5 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}

                  {/* Add Size Column Popover Button (Inline at the end of columns) */}
                  {!isOperator && (
                    <TableHead className="h-8 px-1 text-center min-w-[70px]">
                      <Popover open={isAddSizeOpen} onOpenChange={setIsAddSizeOpen}>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-primary hover:text-primary-foreground hover:bg-primary/90 bg-primary/10 rounded border border-dashed border-primary/30 transition-all cursor-pointer"
                              title="Yangi o'lcham ustuni qo'shish"
                            >
                              <Plus className="w-3 h-3" />
                              <span>O&apos;lcham</span>
                            </button>
                          }
                        />
                        <PopoverContent align="center" className="w-72 p-3 space-y-2.5">
                          <div className="font-semibold text-xs text-foreground">
                            Yangi o&apos;lcham ustuni qo&apos;shish
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Bitta yoki vergul bilan bir nechta o&apos;lcham yozing:
                          </p>
                          <div className="flex gap-1.5">
                            <Input
                              autoFocus
                              value={customSizeInput}
                              onChange={(e) => setCustomSizeInput(e.target.value)}
                              placeholder="Masalan: 112, 116, 122 yoki 4XL"
                              className="h-7 text-xs font-mono"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddSizeColumns();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAddSizeColumns}
                              className="h-7 px-2.5 text-xs shrink-0 cursor-pointer"
                            >
                              Qo&apos;shish
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableHead>
                  )}

                  <TableHead className="h-8 px-3 text-right font-semibold text-xs text-muted-foreground min-w-[80px] border-l border-border">
                    Jami
                  </TableHead>
                  {!isOperator && <TableHead className="h-8 px-1 w-8"></TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {models.map((m, mIdx) => {
                  const isGeneral = isGeneralModel(m);
                  const rowTotal = getRowTotal(m);
                  return (
                    <TableRow
                      key={m}
                      className={cn(
                        "border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors",
                        isGeneral && "bg-muted/10 hover:bg-muted/25"
                      )}
                    >
                      {/* Model Name Cell */}
                      <TableCell className="p-1 px-2.5 font-medium text-foreground sticky left-0 bg-card z-10 border-r border-border">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "w-4 h-4 rounded font-mono text-[10px] font-bold flex items-center justify-center shrink-0",
                              isGeneral
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            {mIdx + 1}
                          </span>
                          <input
                            type="text"
                            defaultValue={m}
                            disabled={isOperator}
                            onBlur={(e) => handleRenameModel(m, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full min-w-[80px] bg-transparent hover:bg-muted/50 focus:bg-background font-semibold text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 transition-colors"
                          />
                          {isGeneral && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono px-1 h-4 bg-background text-amber-700 dark:text-amber-300 border-amber-300/40 shrink-0"
                              title="Standart (Razmersiz) etiketka qatori"
                            >
                              Standart
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Content Cells: Merged row if isGeneral, else sizeColumns */}
                      {isGeneral ? (
                        <TableCell
                          colSpan={sizeColumns.length}
                          onDragOver={(e) => {
                            if (isOperator) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                            if (dragOverCell !== `${m}___STD`) setDragOverCell(`${m}___STD`);
                          }}
                          onDragLeave={() => {
                            if (dragOverCell === `${m}___STD`) setDragOverCell(null);
                          }}
                          onDrop={(e) => {
                            if (isOperator) return;
                            e.preventDefault();
                            setDragOverCell(null);
                            try {
                              const raw = e.dataTransfer.getData("application/json");
                              if (raw) {
                                const design = JSON.parse(raw) as DesignAnalysis;
                                handleAssignStickerToCell(m, "STD", design);
                              } else if (draggedDesign) {
                                handleAssignStickerToCell(m, "STD", draggedDesign);
                              }
                            } catch {
                              if (draggedDesign) handleAssignStickerToCell(m, "STD", draggedDesign);
                            }
                          }}
                          className={cn(
                            "p-1.5 transition-all",
                            dragOverCell === `${m}___STD` && "ring-2 ring-primary ring-inset bg-primary/15"
                          )}
                        >
                          {(() => {
                            const cellKey = `${m}___STD`;
                            const val = cellQuantities[cellKey] ?? 0;
                            const matchingSize = sizes.find(
                              (s) => s.model === m && (s.sizeCode === "STD" || s.size === "Standart")
                            );
                            const directArt =
                              cellDesignMap[cellKey] ||
                              artworkMap[cellKey] ||
                              (matchingSize?.id ? artworkMap[matchingSize.id] : undefined) ||
                              artworkMap["STD"];

                            const artAny = directArt as any;
                            const cellArt = directArt
                              ? {
                                  source_preview_url:
                                    artAny.source_preview_url ||
                                    artAny.frontArtworkThumb ||
                                    artAny.frontArtworkUrl ||
                                    "",
                                  display_name:
                                    artAny.display_name ||
                                    artAny.frontArtworkName ||
                                    `${m} (Standart)`,
                                  width_mm: artAny.width_mm || matchingSize?.width || width || 0,
                                  length_mm: artAny.length_mm || matchingSize?.height || height || 0,
                                }
                              : null;

                            return (
                              <div className="flex items-center justify-between gap-3 px-2">
                                {/* Attached Sticker Thumbnail / Drop Zone */}
                                <div className="flex items-center gap-2 min-w-0">
                                  {cellArt && cellArt.source_preview_url ? (
                                    <div className="relative shrink-0 group/stdthumb flex items-center gap-1.5">
                                      <div
                                        onMouseEnter={(e) => {
                                          const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                                          setHoveredPreview({
                                            url: cellArt.source_preview_url,
                                            x,
                                            y,
                                            name: `${m} (Standart / Yagona format)`,
                                          });
                                        }}
                                        onMouseMove={(e) => {
                                          const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                                          setHoveredPreview((prev) => (prev ? { ...prev, x, y } : null));
                                        }}
                                        onMouseLeave={() => setHoveredPreview(null)}
                                        className="w-7 h-7 rounded border border-border bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary shadow-2xs"
                                      >
                                        <img
                                          src={cellArt.source_preview_url}
                                          alt={m}
                                          className="max-w-full max-h-full object-contain"
                                        />
                                      </div>
                                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                                        {cellArt.width_mm && cellArt.length_mm
                                          ? `${cellArt.width_mm}×${cellArt.length_mm}mm`
                                          : ""}
                                      </span>
                                      {!isOperator && (
                                        <button
                                          type="button"
                                          onClick={() => handleUnassignStickerFromCell(m, "STD")}
                                          title="Stikerni uzish"
                                          className="w-4 h-4 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border border-dashed border-border px-2 py-0.5 rounded bg-background/50">
                                      <Layers className="size-3 text-muted-foreground/60" />
                                      <span>Stikerni shu yerga torting</span>
                                    </div>
                                  )}
                                </div>

                                {/* Quantity Input & Quick Match Button */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium">
                                    Tiraj:
                                  </span>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={val === 0 ? "" : val}
                                    placeholder="0"
                                    disabled={isOperator}
                                    onChange={(e) => handleCellChange(m, "STD", e.target.value)}
                                    className="h-7 w-24 text-xs font-mono font-bold text-center bg-background border-border"
                                  />
                                  <span className="text-[11px] font-mono text-muted-foreground">{unit}</span>

                                  {!isOperator && garmentTotal > 0 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCellChange(m, "STD", String(garmentTotal))}
                                      className="h-6.5 px-2 text-[10px] font-medium text-primary hover:bg-primary/10 gap-1 border-primary/30 cursor-pointer"
                                      title="Matritsadagi barcha kiyimlar jami soniga tenglashtirish"
                                    >
                                      <Copy className="size-2.5" />
                                      <span>= Kiyim jami ({garmentTotal.toLocaleString()})</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                      ) : (
                        sizeColumns.map((col, cIdx) => {
                          const cellKey = `${m}___${col}`;
                          const val = cellQuantities[cellKey] ?? 0;
                          const isTargetSampleCol = scope === "single_sample" && col === effectiveTargetSize;
                          const matchingSize = sizes.find(
                            (s) =>
                              (s.model === m || (!s.model && models.length === 1)) &&
                              (s.sizeCode === col || s.size === col)
                          );
                          const directArt =
                            cellDesignMap[cellKey] ||
                            artworkMap[cellKey] ||
                            (matchingSize?.id ? artworkMap[matchingSize.id] : undefined) ||
                            (models.length === 1 ? artworkMap[col] : undefined);

                          const artAny = directArt as any;
                          const cellArt = directArt
                            ? {
                                source_preview_url:
                                  artAny.source_preview_url ||
                                  artAny.frontArtworkThumb ||
                                  artAny.frontArtworkUrl ||
                                  "",
                                display_name:
                                  artAny.display_name ||
                                  artAny.frontArtworkName ||
                                  `${m} ${col}`,
                                width_mm: artAny.width_mm || matchingSize?.width || width || 0,
                                length_mm: artAny.length_mm || matchingSize?.height || height || 0,
                              }
                            : null;
                          const isCellDragOver = dragOverCell === cellKey;

                          return (
                            <TableCell
                              key={col}
                              onDragOver={(e) => {
                                if (isOperator) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "copy";
                                if (dragOverCell !== cellKey) setDragOverCell(cellKey);
                              }}
                              onDragLeave={() => {
                                if (dragOverCell === cellKey) setDragOverCell(null);
                              }}
                              onDrop={(e) => {
                                if (isOperator) return;
                                e.preventDefault();
                                setDragOverCell(null);
                                try {
                                  const raw = e.dataTransfer.getData("application/json");
                                  if (raw) {
                                    const design = JSON.parse(raw) as DesignAnalysis;
                                    handleAssignStickerToCell(m, col, design);
                                  } else if (draggedDesign) {
                                    handleAssignStickerToCell(m, col, draggedDesign);
                                  }
                                } catch {
                                  if (draggedDesign) {
                                    handleAssignStickerToCell(m, col, draggedDesign);
                                  }
                                }
                              }}
                              className={cn(
                                "p-1 text-center transition-all relative",
                                isCellDragOver && "ring-2 ring-primary ring-inset bg-primary/15",
                                isTargetSampleCol && "bg-amber-500/10 border-x border-amber-500/30"
                              )}
                            >
                              <div className="flex items-center gap-1 justify-center">
                                {/* Attached Sticker Thumbnail */}
                                {cellArt && cellArt.source_preview_url && (
                                  <div className="relative shrink-0 group/cellthumb">
                                    <div
                                      onMouseEnter={(e) => {
                                        const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                                        setHoveredPreview({
                                          url: cellArt.source_preview_url,
                                          x,
                                          y,
                                          name: `${m} - ${col} (${cellArt.width_mm || width || ""}×${cellArt.length_mm || height || ""} mm)`,
                                        });
                                      }}
                                      onMouseMove={(e) => {
                                        const { x, y } = getCursorCardPosition(e.clientX, e.clientY);
                                        setHoveredPreview((prev) => (prev ? { ...prev, x, y } : null));
                                      }}
                                      onMouseLeave={() => setHoveredPreview(null)}
                                      className="w-6 h-7 rounded border border-border bg-background flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary shadow-2xs transition-colors"
                                    >
                                      <img
                                        src={cellArt.source_preview_url}
                                        alt={`${m} ${col}`}
                                        className="max-w-full max-h-full object-contain"
                                      />
                                    </div>
                                    {!isOperator && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnassignStickerFromCell(m, col);
                                        }}
                                        title="Stikerni uzish"
                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/cellthumb:opacity-100 flex items-center justify-center text-[9px] font-bold shadow-xs transition-opacity cursor-pointer z-20"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                )}

                                <Input
                                  type="number"
                                  min={0}
                                  disabled={isOperator}
                                  data-matrix-cell={`${mIdx}-${cIdx}`}
                                  value={val === 0 ? "" : val}
                                  placeholder="—"
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => handleCellKeyDown(e, mIdx, cIdx)}
                                  onChange={(e) => handleCellChange(m, col, e.target.value)}
                                  title={
                                    isTargetSampleCol
                                      ? `Sinov uchun tanlangan razmer (${sampleQty} dona)`
                                      : cellArt
                                      ? `${m} - ${col} (${cellArt.width_mm}×${cellArt.length_mm} mm)`
                                      : undefined
                                  }
                                  className={cn(
                                    "h-7 text-xs font-mono text-center px-1 rounded transition-colors flex-1 min-w-[36px]",
                                    isTargetSampleCol
                                      ? "font-bold text-amber-950 dark:text-amber-200 bg-amber-500/20 border-amber-500 focus:ring-1 focus:ring-amber-500"
                                      : val > 0
                                      ? "font-semibold text-foreground bg-primary/10 border-primary/40 focus:ring-1 focus:ring-primary"
                                      : "text-muted-foreground/40 border-border/40 hover:border-border/80 bg-background/50 focus:bg-background"
                                  )}
                                />
                              </div>
                            </TableCell>
                          );
                        })
                      )}

                      {/* Empty cell for column header alignment if add button is present */}
                      {!isOperator && <TableCell className="p-1" />}

                      {/* Row Total */}
                      <TableCell className="p-1 px-3 text-right font-mono font-semibold text-xs text-foreground border-l border-border whitespace-nowrap">
                        {rowTotal.toLocaleString()}
                      </TableCell>

                      {/* Delete Model Row */}
                      {!isOperator && (
                        <TableCell className="p-1 text-center">
                          {models.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveModel(m)}
                              title={`${m} qatorini o'chirish`}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {/* Column Totals Footer Row */}
                <TableRow className="bg-muted/40 font-mono text-xs border-t border-border">
                  <TableCell className="p-2 px-3 font-sans font-semibold text-muted-foreground sticky left-0 bg-muted/90 z-10 border-r border-border">
                    O&apos;lcham jami:
                  </TableCell>
                  {sizeColumns.map((col) => {
                    const colSum = models.reduce(
                      (sum, m) => sum + (!isGeneralModel(m) ? (cellQuantities[`${m}___${col}`] || 0) : 0),
                      0
                    );
                    return (
                      <TableCell
                        key={col}
                        className="p-2 text-center font-mono font-semibold text-foreground"
                      >
                        {colSum.toLocaleString()}
                      </TableCell>
                    );
                  })}
                  {!isOperator && <TableCell className="p-2" />}
                  <TableCell className="p-2 px-3 text-right font-mono font-bold text-primary border-l border-border">
                    {totalBatchQty.toLocaleString()}
                  </TableCell>
                  {!isOperator && <TableCell className="p-2" />}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* ── Bottom Controls: Add Model & Imposition Link ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/10 border-t border-border">
            <div className="flex items-center gap-2">
              {!isOperator && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddModels(1)}
                    className="h-7 px-2.5 text-xs text-primary hover:bg-primary/10 gap-1.5 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Model qo&apos;shish</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const need = Math.max(1, 5 - models.length);
                      handleAddModels(need);
                    }}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    title="5 tagacha model qatorlarini qo'shish"
                  >
                    +5 Model
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const count = models.filter((m) => isGeneralModel(m)).length + 1;
                      const name = count === 1 ? "Brend logotipi" : `Brend logotipi ${count}`;
                      const nextModels = [...models, name];
                      setGeneralModels((prev) => Array.from(new Set([...prev, name])));
                      const nextMap = {
                        ...cellQuantities,
                        [`${name}___STD`]: garmentTotal > 0 ? garmentTotal : 0,
                      };
                      setModels(nextModels);
                      commitMatrix(nextModels, sizeColumns, nextMap);
                    }}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Brend logotipi yoki umumiy etiketka uchun alohida qator qo'shish"
                  >
                    + Umumiy etiketka (Logo)
                  </Button>
                </>
              )}
              <span className="text-[11px] text-muted-foreground ml-2">
                {models.length} model × {sizeColumns.length} o&apos;lcham ={" "}
                <strong className="text-foreground">{activeSkusCount} faol SKU</strong>
              </span>
            </div>

            {onSwitchTab && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onSwitchTab(impositionTabKey)}
                  className="h-7 px-2.5 text-xs gap-1.5 font-medium text-primary cursor-pointer"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  <span>{impositionLabel || "Spusk / Qoliplarga bo'lish (Imposition)"}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Artwork (Model × Razmer SKU bo'yicha Fayllar) ── */}
      <div className="border-t border-border bg-card">
        {/* Header toggle */}
        <div className="flex items-center justify-between p-2.5 px-3 bg-muted/30 border-b border-border/80">
          <div
            onClick={() => setIsArtworkOpen((v) => !v)}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>SKU Artwork fayllari</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5">
              {skuArtworks.length} ta yuklangan
            </Badge>
            {Object.keys(uploadTasks).length > 0 && (
              <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5 animate-pulse text-primary">
                {Object.keys(uploadTasks).length} ta yuklanmoqda
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground font-mono">
              ({isArtworkOpen ? "yashirish" : "ko'rish"})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {artworkItems.length > 1 && artworkMap[artworkItems[0]?.id]?.frontArtworkUrl && !isOperator && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyFrontToAll}
                className="h-6 px-2 text-[10px] gap-1 text-primary cursor-pointer"
                title="1-SKU oldi tarafi artwork faylini barcha razmerlarga qo'llash"
              >
                <Copy className="w-3 h-3" />
                <span>1-SKU oldini nusxalash</span>
              </Button>
            )}
            <button
              type="button"
              onClick={() => setIsArtworkOpen((v) => !v)}
              className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors cursor-pointer"
            >
              {isArtworkOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isArtworkOpen && (
          <div className="p-3 space-y-2">
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>
                Har bir Model va Razmer uchun 1:1 real masshtabdagi PDF yoki SVG faylini yuklang. Odatda old tarafi bir xil, orqa tarafi esa razmerga xos bo&apos;ladi.
              </span>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-2">
                PDF / SVG (Maks. 50MB)
              </span>
            </div>

            <div className="border border-border rounded-md overflow-hidden bg-background">
              <Table className="w-full text-xs">
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-7 px-2.5 text-xs font-semibold text-foreground w-[160px]">
                      Model / Artikul
                    </TableHead>
                    <TableHead className="h-7 px-2 text-center text-xs font-semibold text-foreground w-[80px]">
                      Razmer
                    </TableHead>
                    <TableHead className="h-7 px-2 text-right text-xs font-semibold text-muted-foreground w-[80px]">
                      Tiraj
                    </TableHead>
                    <TableHead className="h-7 px-3 text-xs font-semibold text-foreground min-w-[240px]">
                      Oldi tarafi
                    </TableHead>
                    <TableHead className="h-7 px-3 text-xs font-semibold text-foreground min-w-[240px]">
                      Orqa tarafi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artworkItems.map((item) => {
                    const art =
                      artworkMap[item.id] ||
                      (item.model && item.sizeCode ? artworkMap[`${item.model}___${item.sizeCode}`] : undefined) ||
                      (item.sizeCode ? artworkMap[item.sizeCode] : undefined);
                    const frontKey = `${item.id}-front`;
                    const backKey = `${item.id}-back`;
                    const frontTask = uploadTasks[frontKey];
                    const backTask = uploadTasks[backKey];
                    const isUploadingFront = !!frontTask && (frontTask.state === "uploading" || frontTask.state === "processing");
                    const isUploadingBack = !!backTask && (backTask.state === "uploading" || backTask.state === "processing");

                    return (
                      <TableRow key={item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        {/* Model */}
                        <TableCell className="px-2.5 py-1.5 font-medium text-foreground">
                          {item.model || "—"}
                        </TableCell>
                        {/* Size code */}
                        <TableCell className="px-2 py-1.5 text-center font-mono font-bold text-foreground">
                          <Badge variant="secondary" className="font-mono text-[11px] h-5 px-1.5">
                            {item.sizeCode}
                          </Badge>
                        </TableCell>
                        {/* Qty */}
                        <TableCell className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                          {item.quantity ? item.quantity.toLocaleString() : "—"}
                        </TableCell>

                        {/* Front Artwork Slot */}
                        <TableCell className="px-3 py-1.5 min-w-[240px]">
                          {frontTask && (frontTask.state === "uploading" || frontTask.state === "processing" || frontTask.state === "error") ? (
                            <Attachment
                              size="xs"
                              state={frontTask.state}
                              className="w-full max-w-[260px] bg-card border-border shadow-none"
                            >
                              <AttachmentMedia variant="icon" className="size-6 shrink-0">
                                {frontTask.state === "uploading" ? (
                                  <Loader2 className="size-3.5 animate-spin text-primary" />
                                ) : frontTask.state === "processing" ? (
                                  <RefreshCw className="size-3.5 animate-spin text-amber-500" />
                                ) : (
                                  <AlertCircle className="size-3.5 text-destructive" />
                                )}
                              </AttachmentMedia>
                              <AttachmentContent className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center justify-between gap-1 leading-none">
                                  <AttachmentTitle className="text-[11px] font-mono truncate max-w-[130px]" title={frontTask.fileName}>
                                    {frontTask.fileName}
                                  </AttachmentTitle>
                                  <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
                                    {frontTask.progress}%
                                  </span>
                                </div>
                                <AttachmentDescription className="text-[10px] text-muted-foreground leading-none">
                                  {frontTask.state === "uploading" && (frontTask.fileSize ? `${frontTask.fileSize} · Yuklanmoqda` : "Yuklanmoqda...")}
                                  {frontTask.state === "processing" && "Saqlanmoqda..."}
                                  {frontTask.state === "error" && (frontTask.errorMessage || "Xatolik")}
                                </AttachmentDescription>
                                {frontTask.state !== "error" && (
                                  <div className="w-full pt-0.5">
                                    <Progress value={frontTask.progress} className="h-1" />
                                  </div>
                                )}
                              </AttachmentContent>
                              <AttachmentActions>
                                <AttachmentAction
                                  type="button"
                                  size="icon-xs"
                                  onClick={() => cancelUpload(frontKey)}
                                  title="Bekor qilish"
                                  className="text-muted-foreground hover:text-destructive cursor-pointer size-5"
                                >
                                  <X className="size-3" />
                                </AttachmentAction>
                              </AttachmentActions>
                            </Attachment>
                          ) : art?.frontArtworkUrl ? (
                            <Attachment
                              size="xs"
                              state="done"
                              className="w-full max-w-[260px] bg-card border-border shadow-none"
                            >
                              <AttachmentMedia variant="icon" className="size-6 shrink-0 bg-primary/10 text-primary">
                                <FileText className="size-3.5" />
                              </AttachmentMedia>
                              <AttachmentContent className="min-w-0 flex-1">
                                <AttachmentTitle
                                  className="text-[11px] font-mono truncate cursor-pointer hover:text-primary transition-colors block"
                                  title={art.frontArtworkName || "front.pdf"}
                                  onClick={() => {
                                    setPreviewUrl(art.frontArtworkUrl!);
                                    setPreviewName(`${item.model || ""} ${item.sizeCode} (Oldi)`);
                                  }}
                                >
                                  {art.frontArtworkName || "front.pdf"}
                                </AttachmentTitle>
                                <AttachmentDescription className="text-[10px] text-muted-foreground">
                                  PDF / SVG
                                </AttachmentDescription>
                              </AttachmentContent>
                              <AttachmentActions className="gap-0.5">
                                <AttachmentAction
                                  type="button"
                                  size="icon-xs"
                                  onClick={() => {
                                    setPreviewUrl(art.frontArtworkUrl!);
                                    setPreviewName(`${item.model || ""} ${item.sizeCode} (Oldi)`);
                                  }}
                                  title="Ko'rish"
                                  className="text-muted-foreground hover:text-foreground cursor-pointer size-5"
                                >
                                  <Eye className="size-3" />
                                </AttachmentAction>
                                {!isOperator && (
                                  <AttachmentAction
                                    type="button"
                                    size="icon-xs"
                                    onClick={() => handleArtworkRemove(item.id, "front")}
                                    title="O'chirish"
                                    className="text-muted-foreground hover:text-destructive cursor-pointer size-5"
                                  >
                                    <X className="size-3" />
                                  </AttachmentAction>
                                )}
                              </AttachmentActions>
                            </Attachment>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept=".pdf,.svg,application/pdf,image/svg+xml"
                                id={`file-input-${item.id}-front`}
                                className="hidden"
                                disabled={isOperator || isUploadingFront}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleArtworkUpload(item, "front", file);
                                  e.target.value = "";
                                }}
                              />
                              <label
                                htmlFor={`file-input-${item.id}-front`}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md border border-dashed transition-colors",
                                  isOperator
                                    ? "text-muted-foreground border-border cursor-not-allowed opacity-50"
                                    : "text-muted-foreground hover:text-foreground border-border hover:border-primary cursor-pointer hover:bg-muted/40"
                                )}
                              >
                                <Upload className="size-3 text-muted-foreground" />
                                <span>PDF / SVG yuklash</span>
                              </label>
                            </div>
                          )}
                        </TableCell>

                        {/* Back Artwork Slot */}
                        <TableCell className="px-3 py-1.5 min-w-[240px]">
                          {backTask && (backTask.state === "uploading" || backTask.state === "processing" || backTask.state === "error") ? (
                            <Attachment
                              size="xs"
                              state={backTask.state}
                              className="w-full max-w-[260px] bg-card border-border shadow-none"
                            >
                              <AttachmentMedia variant="icon" className="size-6 shrink-0">
                                {backTask.state === "uploading" ? (
                                  <Loader2 className="size-3.5 animate-spin text-primary" />
                                ) : backTask.state === "processing" ? (
                                  <RefreshCw className="size-3.5 animate-spin text-amber-500" />
                                ) : (
                                  <AlertCircle className="size-3.5 text-destructive" />
                                )}
                              </AttachmentMedia>
                              <AttachmentContent className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center justify-between gap-1 leading-none">
                                  <AttachmentTitle className="text-[11px] font-mono truncate max-w-[130px]" title={backTask.fileName}>
                                    {backTask.fileName}
                                  </AttachmentTitle>
                                  <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
                                    {backTask.progress}%
                                  </span>
                                </div>
                                <AttachmentDescription className="text-[10px] text-muted-foreground leading-none">
                                  {backTask.state === "uploading" && (backTask.fileSize ? `${backTask.fileSize} · Yuklanmoqda` : "Yuklanmoqda...")}
                                  {backTask.state === "processing" && "Saqlanmoqda..."}
                                  {backTask.state === "error" && (backTask.errorMessage || "Xatolik")}
                                </AttachmentDescription>
                                {backTask.state !== "error" && (
                                  <div className="w-full pt-0.5">
                                    <Progress value={backTask.progress} className="h-1" />
                                  </div>
                                )}
                              </AttachmentContent>
                              <AttachmentActions>
                                <AttachmentAction
                                  type="button"
                                  size="icon-xs"
                                  onClick={() => cancelUpload(backKey)}
                                  title="Bekor qilish"
                                  className="text-muted-foreground hover:text-destructive cursor-pointer size-5"
                                >
                                  <X className="size-3" />
                                </AttachmentAction>
                              </AttachmentActions>
                            </Attachment>
                          ) : art?.backArtworkUrl ? (
                            <Attachment
                              size="xs"
                              state="done"
                              className="w-full max-w-[260px] bg-card border-border shadow-none"
                            >
                              <AttachmentMedia variant="icon" className="size-6 shrink-0 bg-primary/10 text-primary">
                                <FileText className="size-3.5" />
                              </AttachmentMedia>
                              <AttachmentContent className="min-w-0 flex-1">
                                <AttachmentTitle
                                  className="text-[11px] font-mono truncate cursor-pointer hover:text-primary transition-colors block"
                                  title={art.backArtworkName || "back.pdf"}
                                  onClick={() => {
                                    setPreviewUrl(art.backArtworkUrl!);
                                    setPreviewName(`${item.model || ""} ${item.sizeCode} (Orqa)`);
                                  }}
                                >
                                  {art.backArtworkName || "back.pdf"}
                                </AttachmentTitle>
                                <AttachmentDescription className="text-[10px] text-muted-foreground">
                                  PDF / SVG
                                </AttachmentDescription>
                              </AttachmentContent>
                              <AttachmentActions className="gap-0.5">
                                <AttachmentAction
                                  type="button"
                                  size="icon-xs"
                                  onClick={() => {
                                    setPreviewUrl(art.backArtworkUrl!);
                                    setPreviewName(`${item.model || ""} ${item.sizeCode} (Orqa)`);
                                  }}
                                  title="Ko'rish"
                                  className="text-muted-foreground hover:text-foreground cursor-pointer size-5"
                                >
                                  <Eye className="size-3" />
                                </AttachmentAction>
                                {!isOperator && (
                                  <AttachmentAction
                                    type="button"
                                    size="icon-xs"
                                    onClick={() => handleArtworkRemove(item.id, "back")}
                                    title="O'chirish"
                                    className="text-muted-foreground hover:text-destructive cursor-pointer size-5"
                                  >
                                    <X className="size-3" />
                                  </AttachmentAction>
                                )}
                              </AttachmentActions>
                            </Attachment>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept=".pdf,.svg,application/pdf,image/svg+xml"
                                id={`file-input-${item.id}-back`}
                                className="hidden"
                                disabled={isOperator || isUploadingBack}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleArtworkUpload(item, "back", file);
                                  e.target.value = "";
                                }}
                              />
                              <label
                                htmlFor={`file-input-${item.id}-back`}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md border border-dashed transition-colors",
                                  isOperator
                                    ? "text-muted-foreground border-border cursor-not-allowed opacity-50"
                                    : "text-muted-foreground hover:text-foreground border-border hover:border-primary cursor-pointer hover:bg-muted/40"
                                )}
                              >
                                <Upload className="size-3 text-muted-foreground" />
                                <span>PDF / SVG yuklash</span>
                              </label>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── Artwork Preview Modal ── */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-3 px-4 border-b border-border flex flex-row items-center justify-between shrink-0">
            <DialogTitle className="text-sm font-semibold truncate flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>Artwork Preview: {previewName}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {previewUrl && (
                <a
                  href={previewUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-border bg-background hover:bg-muted text-foreground transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Yuklab olish</span>
                </a>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 overflow-auto flex items-center justify-center p-2">
            {previewUrl && previewUrl.toLowerCase().endsWith(".svg") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewName}
                className="max-w-full max-h-full object-contain shadow-md rounded border border-border bg-white"
              />
            ) : previewUrl ? (
              <iframe
                src={`${previewUrl}#toolbar=1`}
                title={previewName}
                className="w-full h-full border-0 rounded"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Hover Image Preview (Work Orders DataGrid style) ── */}
      {hoveredPreview && (
        <div
          style={{ left: `${hoveredPreview.x}px`, top: `${hoveredPreview.y}px` }}
          className="fixed z-50 pointer-events-none rounded-lg bg-popover/95 backdrop-blur-xs border border-border shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 duration-75 max-w-[400px] max-h-[400px] flex flex-col items-center justify-center overflow-hidden"
        >
          <img
            src={hoveredPreview.url}
            alt={hoveredPreview.name || "Stiker eskizi"}
            className="max-w-[370px] max-h-[350px] w-auto h-auto object-contain rounded select-none bg-white"
          />
          {hoveredPreview.name && (
            <span className="text-[10px] font-mono font-medium text-foreground mt-1 truncate max-w-[360px]">
              {hoveredPreview.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
