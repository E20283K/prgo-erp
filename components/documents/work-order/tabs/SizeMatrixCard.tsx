"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  X,
  Grid3X3,
  List,
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
  CheckCircle2,
  Upload,
  Eye,
  Download,
  ExternalLink,
} from "lucide-react";
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
  SizeDistribution,
  SIZE_SCALE_PRESETS,
  parseModelAndSize,
  formatModelAndSize,
  SkuArtwork,
} from "../types";

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
  workOrderId?: string;
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
  workOrderId,
}: SizeMatrixCardProps) {
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

  const hasExistingModels = useMemo(
    () => parsedItems.some((i) => Boolean(i.resolvedModel)),
    [parsedItems]
  );

  const [mode, setMode] = useState<"list" | "matrix">(
    hasExistingModels ? "matrix" : "matrix"
  );

  // ── Matrix State (Models = Rows, SizeCodes = Columns) ──
  const [models, setModels] = useState<string[]>(() => {
    const uniqueModels = Array.from(
      new Set(parsedItems.map((i) => i.resolvedModel).filter(Boolean))
    );
    return uniqueModels.length > 0 ? uniqueModels : ["Model 1"];
  });

  const [sizeColumns, setSizeColumns] = useState<string[]>(() => {
    const uniqueCols = Array.from(
      new Set(parsedItems.map((i) => i.resolvedSize).filter(Boolean))
    );
    return uniqueCols.length > 0
      ? uniqueCols
      : ["S", "M", "L", "XL", "2XL"];
  });

  // Sync models & columns if external sizes change significantly
  useEffect(() => {
    const extModels = Array.from(
      new Set(parsedItems.map((i) => i.resolvedModel).filter(Boolean))
    );
    const extCols = Array.from(
      new Set(parsedItems.map((i) => i.resolvedSize).filter(Boolean))
    );
    if (extModels.length > 0) {
      setModels((prev) => Array.from(new Set([...prev, ...extModels])));
    }
    if (extCols.length > 0) {
      setSizeColumns((prev) => Array.from(new Set([...prev, ...extCols])));
    }
  }, [parsedItems]);

  // Build quick lookup map: key = `${model}___${sizeCode}` -> quantity
  const cellQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    const effectiveModelFallback = models[0] || "Model 1";
    parsedItems.forEach((item) => {
      const m = item.resolvedModel || effectiveModelFallback;
      const s = item.resolvedSize;
      const key = `${m}___${s}`;
      map[key] = (map[key] || 0) + (Number(item.quantity) || 0);
    });
    return map;
  }, [parsedItems, models]);

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
      onSizesChange([
        { id: `size-${Date.now()}-1`, size: "S", sizeCode: "S", quantity: 0 },
        { id: `size-${Date.now()}-2`, size: "M", sizeCode: "M", quantity: 0 },
        { id: `size-${Date.now()}-3`, size: "L", sizeCode: "L", quantity: 0 },
        { id: `size-${Date.now()}-4`, size: "XL", sizeCode: "XL", quantity: 0 },
      ]);
    }
  };

  // Popover state for adding size columns
  const [isAddSizeOpen, setIsAddSizeOpen] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState("");

  // Popover state for quick actions / mass fill
  const [isQuickFillOpen, setIsQuickFillOpen] = useState(false);
  const [quickFillQty, setQuickFillQty] = useState("500");

  // Inputs for Simple List Mode
  const [newListSize, setNewListSize] = useState("");
  const [newListQty, setNewListQty] = useState("");

  // Sync matrix state -> SizeDistribution[]
  const commitMatrix = (
    nextModels: string[],
    nextCols: string[],
    nextMap: Record<string, number>
  ) => {
    const useModelPrefix = nextModels.length > 1 || hasExistingModels;
    const result: SizeDistribution[] = [];

    nextModels.forEach((m, mIdx) => {
      nextCols.forEach((col, cIdx) => {
        const qty = Number(nextMap[`${m}___${col}`]) || 0;
        if (qty > 0) {
          result.push({
            id: `sku-${mIdx}-${cIdx}-${col}`,
            model: useModelPrefix ? m : undefined,
            sizeCode: col,
            size: useModelPrefix ? formatModelAndSize(m, col) : col,
            quantity: qty,
          });
        }
      });
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
    sizeColumns.forEach((col) => {
      delete nextMap[`${modelToRemove}___${col}`];
    });
    setModels(nextModels);
    commitMatrix(nextModels, sizeColumns, nextMap);
  };

  // Rename a model row
  const handleRenameModel = (oldModel: string, newModelRaw: string) => {
    if (isOperator) return;
    const newModel = newModelRaw.trim();
    if (!newModel || newModel === oldModel || models.includes(newModel)) return;
    const nextModels = models.map((m) => (m === oldModel ? newModel : m));
    const nextMap: Record<string, number> = {};
    Object.entries(cellQuantities).forEach(([k, v]) => {
      const [m, s] = k.split("___");
      nextMap[`${m === oldModel ? newModel : m}___${s}`] = v;
    });
    setModels(nextModels);
    commitMatrix(nextModels, sizeColumns, nextMap);
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

  // ── Simple List Mode Handlers ──
  const handleAddListItem = () => {
    if (isOperator || !newListSize.trim() || !newListQty.trim()) return;
    const qty = parseInt(newListQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    const tokens = newListSize
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const added: SizeDistribution[] = tokens.map((tok, idx) => {
      const { model, sizeCode } = parseModelAndSize({ id: "", size: tok, quantity: qty });
      return {
        id: `size-${Date.now()}-${idx}`,
        size: tok,
        model: model || undefined,
        sizeCode: sizeCode || tok,
        quantity: qty,
      };
    });

    onSizesChange([...sizes, ...added]);
    setNewListSize("");
    setNewListQty("");
  };

  const handleUpdateListItemQty = (id: string, valStr: string) => {
    if (isOperator) return;
    const qty = Math.max(0, parseInt(valStr, 10) || 0);
    onSizesChange(
      sizes.map((s) => (s.id === id ? { ...s, quantity: qty } : s))
    );
  };

  const handleRemoveListItem = (id: string) => {
    if (isOperator) return;
    onSizesChange(sizes.filter((s) => s.id !== id));
  };

  // ── Artwork State ──
  const [isArtworkOpen, setIsArtworkOpen] = React.useState(true);
  const [uploadingKey, setUploadingKey] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewName, setPreviewName] = React.useState<string>("");

  const artworkMap = React.useMemo(() => {
    const map: Record<string, SkuArtwork> = {};
    skuArtworks.forEach((a) => {
      map[a.skuId] = a;
    });
    return map;
  }, [skuArtworks]);

  const handleArtworkUpload = async (
    skuItem: { id: string; model?: string; sizeCode?: string; size?: string },
    side: "front" | "back",
    file: File
  ) => {
    const skuId = skuItem.id;
    const key = `${skuId}-${side}`;
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workOrderId", workOrderId || "WO");
      fd.append("skuId", skuId);
      fd.append("side", side);
      const res = await fetch("/api/artwork/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const result: { url: string; name: string; thumbUrl?: string } = await res.json();
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
              frontArtworkThumb: result.thumbUrl,
            }
          : {
              backArtworkUrl: result.url,
              backArtworkName: result.name,
              backArtworkThumb: result.thumbUrl,
            }),
      };
      const newArtworks = skuArtworks.filter((a) => a.skuId !== skuId).concat(updated);
      onSkuArtworksChange?.(newArtworks);
    } catch (e) {
      console.error("Artwork upload error:", e);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleArtworkRemove = async (skuId: string, side: "front" | "back") => {
    const existing = artworkMap[skuId];
    if (!existing) return;
    const urlToDelete = side === "front" ? existing.frontArtworkUrl : existing.backArtworkUrl;
    if (urlToDelete) {
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
    const activeSizes = sizes.filter((s) => (Number(s.quantity) || 0) > 0);
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
    });
    return fallbackList;
  }, [scope, sizes, totalQuantity, models, sizeColumns, cellQuantities]);

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
            {scope === "standard" ? (
              <FileText className="w-3.5 h-3.5" />
            ) : (
              <Tag className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">
                Model &amp; O&apos;lchamlar taqsimoti
              </span>
              <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                {scope === "standard"
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
          {/* Scope Switcher: Standard vs Full Matrix vs Single Size Sample */}
          <div className="flex items-center bg-muted/80 p-0.5 rounded-md border border-border">
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
              <span>Standart (1 dona, 1+0)</span>
            </button>
            <button
              type="button"
              onClick={handleConvertToMatrix}
              className={cn(
                "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1.5 transition-all cursor-pointer",
                scope === "full"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Barcha razmerlar bo'yicha to'liq seriyali ishlab chiqarish matritsasi"
            >
              <Grid3X3 className="w-3 h-3 text-primary" />
              <span>To&apos;liq o&apos;lchamlar</span>
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
          </div>

          {!isOperator && scope !== "standard" && mode === "matrix" && (
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

          {/* Mode Switcher */}
          {scope !== "standard" && (
            <div className="flex items-center bg-muted p-0.5 rounded-md border border-border">
              <button
                type="button"
                onClick={() => setMode("matrix")}
                className={cn(
                  "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1 transition-all cursor-pointer",
                  mode === "matrix"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid3X3 className="w-3 h-3" />
                <span>Matritsa</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                className={cn(
                  "h-6 px-2 text-[11px] font-medium rounded-sm flex items-center gap-1 transition-all cursor-pointer",
                  mode === "list"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="w-3 h-3" />
                <span>Ro&apos;yxat</span>
              </button>
            </div>
          )}
        </div>
      </div>

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
                onClick={() => onSwitchTab("sample")}
                className="h-6.5 px-2 text-[10px] border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 cursor-pointer"
              >
                <span>SampleTab</span>
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
      ) : mode === "matrix" ? (
        <div>
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
                  const rowTotal = sizeColumns.reduce(
                    (sum, col) => sum + (cellQuantities[`${m}___${col}`] || 0),
                    0
                  );
                  return (
                    <TableRow
                      key={m}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      {/* Model Name Cell */}
                      <TableCell className="p-1 px-2.5 font-medium text-foreground sticky left-0 bg-card z-10 border-r border-border">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded bg-primary/10 text-primary font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
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
                        </div>
                      </TableCell>

                      {/* Size Quantity Cells */}
                      {sizeColumns.map((col, cIdx) => {
                        const val = cellQuantities[`${m}___${col}`] ?? 0;
                        const isTargetSampleCol = scope === "single_sample" && col === effectiveTargetSize;
                        return (
                          <TableCell
                            key={col}
                            className={cn(
                              "p-1 text-center transition-colors",
                              isTargetSampleCol && "bg-amber-500/10 border-x border-amber-500/30"
                            )}
                          >
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
                                  : undefined
                              }
                              className={cn(
                                "h-7 text-xs font-mono text-center px-1 rounded transition-colors",
                                isTargetSampleCol
                                  ? "font-bold text-amber-950 dark:text-amber-200 bg-amber-500/20 border-amber-500 focus:ring-1 focus:ring-amber-500"
                                  : val > 0
                                  ? "font-bold text-foreground bg-primary/10 border-primary/40 focus:ring-1 focus:ring-primary"
                                  : "text-muted-foreground/40 border-border/40 hover:border-border/80 bg-background/50 focus:bg-background"
                              )}
                            />
                          </TableCell>
                        );
                      })}

                      {/* Empty cell for column header alignment if add button is present */}
                      {!isOperator && <TableCell className="p-1" />}

                      {/* Row Total */}
                      <TableCell className="p-1 px-3 text-right font-mono font-bold text-xs text-foreground border-l border-border whitespace-nowrap">
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
                      (sum, m) => sum + (cellQuantities[`${m}___${col}`] || 0),
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
                </>
              )}
              <span className="text-[11px] text-muted-foreground ml-2">
                {models.length} model × {sizeColumns.length} o&apos;lcham ={" "}
                <strong className="text-foreground">{activeSkusCount} faol SKU</strong>
              </span>
            </div>

            {onSwitchTab && (
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
            )}
          </div>
        </div>
      ) : (
        /* ── Simple 1D List View ── */
        <div className="p-3 space-y-3">
          {!isOperator && (
            <div className="flex items-end gap-2 bg-muted/20 p-2.5 rounded-md border border-border">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                  Model / O&apos;lcham (vergul bilan bir nechta yozish mumkin)
                </label>
                <Input
                  value={newListSize}
                  onChange={(e) => setNewListSize(e.target.value)}
                  placeholder="Masalan: 112, 116, 122 yoki Model 1 · XL"
                  className="h-7 text-xs bg-background"
                  onKeyDown={(e) => e.key === "Enter" && handleAddListItem()}
                />
              </div>
              <div className="w-28">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5 block">
                  Tiraj (Qty)
                </label>
                <Input
                  type="number"
                  value={newListQty}
                  onChange={(e) => setNewListQty(e.target.value)}
                  placeholder="0"
                  className="h-7 text-xs bg-background font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleAddListItem()}
                />
              </div>
              <Button
                onClick={handleAddListItem}
                type="button"
                size="sm"
                className="h-7 px-2.5 gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Qo&apos;shish</span>
              </Button>
            </div>
          )}

          {sizes.length > 0 ? (
            <div className="border border-border rounded-md overflow-hidden max-h-[260px] overflow-y-auto bg-card">
              <Table className="w-full text-xs">
                <TableHeader className="bg-muted/50 border-b border-border sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="h-7 px-2.5 font-medium text-[11px] text-muted-foreground">
                      Model / O&apos;lcham (SKU)
                    </TableHead>
                    <TableHead className="h-7 px-2.5 font-medium text-[11px] text-muted-foreground text-right w-32">
                      Quantity ({unit})
                    </TableHead>
                    <TableHead className="h-7 px-2.5 font-medium text-[11px] text-muted-foreground text-right w-16">
                      Ulushi
                    </TableHead>
                    {!isOperator && <TableHead className="h-7 px-2 w-8"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizes.map((item) => {
                    const sharePct =
                      totalBatchQty > 0
                        ? Math.round(((item.quantity || 0) / totalBatchQty) * 100)
                        : 0;
                    const { model, sizeCode } = parseModelAndSize(item);
                    return (
                      <TableRow
                        key={item.id}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/40"
                      >
                        <TableCell className="px-2.5 py-1 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5">
                            {model && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1.5 font-medium"
                              >
                                {model}
                              </Badge>
                            )}
                            <span className="font-mono">{sizeCode || item.size}</span>
                            {scope === "single_sample" && (sizeCode === effectiveTargetSize || item.size === effectiveTargetSize) && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 font-mono">
                                ★ Namuna ({sampleQty} {unit})
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-right font-mono font-medium text-foreground">
                          {isOperator ? (
                            <span>
                              {item.quantity.toLocaleString()} {unit}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleUpdateListItemQty(item.id, e.target.value)
                              }
                              className="h-6 w-24 ml-auto text-right font-mono text-xs px-1.5 bg-background"
                            />
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 py-1 text-right font-mono text-[10px] text-muted-foreground">
                          {sharePct}%
                        </TableCell>
                        {!isOperator && (
                          <TableCell className="px-2 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveListItem(item.id)}
                              className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground italic bg-muted/10 p-2.5 rounded border border-dashed border-border text-center">
              O&apos;lchamlar taqsimotisiz yagona partiya ({(totalBatchQty || totalQuantity).toLocaleString()} {unit}).
            </div>
          )}
        </div>
      )}

      {/* ── Artwork (Model × Razmer SKU bo'yicha Fayllar) ── */}
      <div className="border-t border-border bg-card">
        {/* Header toggle */}
        <div className="flex items-center justify-between p-2.5 px-3 bg-muted/30 border-b border-border/80">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <span>🎨 SKU Artwork fayllari (Old &amp; Orqa PDF / SVG)</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5">
              {skuArtworks.length} ta yuklangan
            </Badge>
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
                <span>1-SKU oldini hammaga nusxalash</span>
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
                    <TableHead className="h-7 px-3 text-xs font-semibold text-foreground">
                      Oldi tarafi (Front Artwork)
                    </TableHead>
                    <TableHead className="h-7 px-3 text-xs font-semibold text-foreground">
                      Orqa tarafi (Back Artwork)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artworkItems.map((item) => {
                    const art = artworkMap[item.id];
                    const frontKey = `${item.id}-front`;
                    const backKey = `${item.id}-back`;
                    const isUploadingFront = uploadingKey === frontKey;
                    const isUploadingBack = uploadingKey === backKey;

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
                        <TableCell className="px-3 py-1.5">
                          {art?.frontArtworkUrl ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewUrl(art.frontArtworkUrl!);
                                  setPreviewName(`${item.model || ""} ${item.sizeCode} (Oldi / Front)`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-[11px] font-mono text-foreground transition-colors cursor-pointer truncate max-w-[200px]"
                                title="Ko'rish (Preview)"
                              >
                                <Eye className="w-3 h-3 text-primary shrink-0" />
                                <span className="truncate">{art.frontArtworkName || "front.pdf"}</span>
                              </button>
                              {!isOperator && (
                                <button
                                  type="button"
                                  onClick={() => handleArtworkRemove(item.id, "front")}
                                  className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                                  title="O'chirish"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
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
                                  "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-dashed transition-colors",
                                  isOperator
                                    ? "text-muted-foreground border-border cursor-not-allowed opacity-50"
                                    : "text-muted-foreground hover:text-foreground border-border hover:border-primary cursor-pointer hover:bg-muted/40"
                                )}
                              >
                                <Upload className="w-3 h-3" />
                                <span>{isUploadingFront ? "Yuklanmoqda..." : "PDF / SVG yuklash"}</span>
                              </label>
                            </div>
                          )}
                        </TableCell>

                        {/* Back Artwork Slot */}
                        <TableCell className="px-3 py-1.5">
                          {art?.backArtworkUrl ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewUrl(art.backArtworkUrl!);
                                  setPreviewName(`${item.model || ""} ${item.sizeCode} (Orqa / Back)`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-[11px] font-mono text-foreground transition-colors cursor-pointer truncate max-w-[200px]"
                                title="Ko'rish (Preview)"
                              >
                                <Eye className="w-3 h-3 text-primary shrink-0" />
                                <span className="truncate">{art.backArtworkName || "back.pdf"}</span>
                              </button>
                              {!isOperator && (
                                <button
                                  type="button"
                                  onClick={() => handleArtworkRemove(item.id, "back")}
                                  className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                                  title="O'chirish"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
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
                                  "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-dashed transition-colors",
                                  isOperator
                                    ? "text-muted-foreground border-border cursor-not-allowed opacity-50"
                                    : "text-muted-foreground hover:text-foreground border-border hover:border-primary cursor-pointer hover:bg-muted/40"
                                )}
                              >
                                <Upload className="w-3 h-3" />
                                <span>{isUploadingBack ? "Yuklanmoqda..." : "PDF / SVG yuklash"}</span>
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
    </div>
  );
}
