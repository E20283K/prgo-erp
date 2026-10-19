"use client";

import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useWorkspaceStore,
  DocumentTab,
  WarehouseStockRecord,
  WarehouseMovementRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReturnOffcutDialog } from "@/components/grid/ReturnOffcutDialog";
import { getMaterialImage } from "@/lib/materialImages";
import { MaterialImageModal } from "@/components/documents/MaterialImageModal";
import { MaterialImageUploadDialog } from "@/components/documents/MaterialImageUploadDialog";
import {
  Boxes,
  FileText,
  Scissors,
  ArrowDownToLine,
  Save,
  Printer,
  ExternalLink,
  Layers,
  Scale,
  Calendar,
  MapPin,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  Building2,
  Sparkles,
  History,
  Tag,
  Factory,
  Check,
  Camera,
  ZoomIn,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

export function WarehouseStockDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    warehouseMovements,
    productionQueue,
    upsertWarehouseStock,
    openTab,
    setTabUnsaved,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";
  const [activeTabKey, setActiveTabKey] = useState<string>("ledger");
  const [isOffcutDialogOpen, setIsOffcutDialogOpen] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);

  // Match live stock record from store or documentData
  const stockItem = useMemo<WarehouseStockRecord>(() => {
    const d = tab.documentData || {};
    const sku = d.sku || tab.id.replace(/^stock-/, "");
    const found = warehouseStock.find((s) => s.sku === sku);
    if (found) {
      return {
        ...found,
        imageUrl: found.imageUrl || getMaterialImage(found),
      };
    }

    const fallbackRecord = {
      sku: sku || "MAT-1010",
      name: d.name || "Galerie Art Silk 150g/m²",
      category: d.category || "Paper & Board",
      grammage: d.grammage || 150,
      sheetFormat: d.sheetFormat || "700×1000",
      unit: d.unit || "sheets",
      location: d.location || "Rack A-01 (Main Paper Hall)",
      stockLevel: Number(d.stockLevel) || 38500,
      reserved: Number(d.reserved) || 12000,
      available: Number(d.available) || 26500,
      reorder: Number(d.reorder) || 8000,
      unitPriceUsd: Number(d.unitPriceUsd) || 0.19,
      lastReceived: d.lastReceived || "2026-10-08",
      status: d.status || "In Stock",
      isOffcut: d.isOffcut,
      parentMaterialSku: d.parentMaterialSku,
      cutDimensions: d.cutDimensions,
      sourceWorkOrder: d.sourceWorkOrder,
      supplier: d.supplier,
      grainDirection: d.grainDirection,
      rollWidthMm: d.rollWidthMm,
      rollLengthM: d.rollLengthM,
      batchNo: d.batchNo,
      expiryDate: d.expiryDate,
      imageUrl: d.imageUrl,
    };
    return {
      ...fallbackRecord,
      imageUrl: fallbackRecord.imageUrl || getMaterialImage(fallbackRecord),
    };
  }, [warehouseStock, tab.documentData, tab.id]);

  // Find Parent Material if this is an Offcut
  const parentMaterial = useMemo(() => {
    if (!stockItem.isOffcut || !stockItem.parentMaterialSku) return null;
    return warehouseStock.find((s) => s.sku === stockItem.parentMaterialSku);
  }, [stockItem, warehouseStock]);

  // Find Derived Offcuts if this is a Parent Substrate
  const derivedOffcuts = useMemo(() => {
    if (stockItem.isOffcut) return [];
    return warehouseStock.filter((s) => s.parentMaterialSku === stockItem.sku);
  }, [stockItem, warehouseStock]);

  // Filter movements for this SKU or related names
  const itemMovements = useMemo(() => {
    const qSku = stockItem.sku.toLowerCase();
    const qName = stockItem.name.toLowerCase();
    const parentSku = stockItem.parentMaterialSku?.toLowerCase();

    return warehouseMovements.filter((m) => {
      const mSku = (m.materialSku || "").toLowerCase();
      const mMat = (m.material || "").toLowerCase();
      const mParent = (m.parentMaterialSku || "").toLowerCase();

      return (
        mSku === qSku ||
        mMat.includes(qName) ||
        qName.includes(mMat) ||
        (stockItem.isOffcut && mParent === parentSku && m.isOffcut)
      );
    });
  }, [warehouseMovements, stockItem]);

  // Filter Work Orders where this material is used or reserved
  const linkedWorkOrders = useMemo(() => {
    const qName = stockItem.name.toLowerCase();
    const qSku = stockItem.sku.toLowerCase();

    return productionQueue.filter((wo) => {
      // Check if WO is mentioned in movements
      const usedInMovements = itemMovements.some((m) => m.workOrderId === wo.id);
      // Check if offcut was created from this WO
      const isSourceWo = stockItem.sourceWorkOrder === wo.id;
      // Or if name matches general product substrates
      const matchesSubstrate =
        stockItem.category === "Paper & Board" || stockItem.category === "Offcuts & Scraps";

      return usedInMovements || isSourceWo || matchesSubstrate;
    });
  }, [productionQueue, itemMovements, stockItem]);

  // Calculate secondary metrics based on category
  const secondaryMetric = useMemo(() => {
    if (stockItem.category === "Paper & Board" || stockItem.category === "Offcuts & Scraps") {
      const dims = (stockItem.sheetFormat || stockItem.cutDimensions || "700×1000").split("×");
      const w = parseFloat(dims[0]) || 700;
      const h = parseFloat(dims[1]) || 1000;
      const g = stockItem.grammage || 150;
      // kg = (w/1000) * (h/1000) * (g/1000) * sheets
      const weightPerSheetKg = (w / 1000) * (h / 1000) * (g / 1000);
      const totalWeightKg = Math.round(weightPerSheetKg * stockItem.stockLevel);
      return {
        label: "Jami Og'irlik (Weight)",
        value: `${totalWeightKg.toLocaleString()} kg`,
        sub: `1 varaq: ${(weightPerSheetKg * 1000).toFixed(1)} g`,
        icon: Scale,
      };
    }

    if (stockItem.category === "Roll & Label") {
      const len = stockItem.rollLengthM || 200;
      const totalMeters = len * stockItem.stockLevel;
      return {
        label: "Jami Pogon Metr",
        value: `${totalMeters.toLocaleString()} m`,
        sub: `1 rulon: ${len} metr (${stockItem.rollWidthMm || 60}mm)`,
        icon: Layers,
      };
    }

    if (stockItem.category === "Inks & Plates") {
      if (stockItem.unit === "pcs") {
        return {
          label: "Komplekt Quvvati",
          value: `${Math.floor(stockItem.stockLevel / 4)} set (4C)`,
          sub: "1 buyurtmaga 4 ta qolip",
          icon: Boxes,
        };
      }
      return {
        label: "O'rtacha Bosma Qamrovi",
        value: `~${(stockItem.stockLevel * 350).toLocaleString()} m²`,
        sub: "Norma: ~2.8 g/m²",
        icon: Sparkles,
      };
    }

    return {
      label: "Ombor Qiymati",
      value: `$${(stockItem.stockLevel * stockItem.unitPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: `Birlik narxi: $${stockItem.unitPriceUsd}`,
      icon: Boxes,
    };
  }, [stockItem]);

  // Offcut area ratio vs parent sheet
  const offcutAreaStats = useMemo(() => {
    if (!stockItem.isOffcut) return null;
    const cutDims = (stockItem.cutDimensions || stockItem.sheetFormat || "470×700").split("×");
    const cutArea = (parseFloat(cutDims[0]) || 470) * (parseFloat(cutDims[1]) || 700);

    const parentDims = (parentMaterial?.sheetFormat || "700×1000").split("×");
    const parentArea = (parseFloat(parentDims[0]) || 700) * (parseFloat(parentDims[1]) || 1000);

    const ratio = Math.round((cutArea / parentArea) * 100);
    const virginCost = parentMaterial?.unitPriceUsd || 0.20;
    const offcutCost = stockItem.unitPriceUsd || 0.11;
    const savedPerSheet = Math.max(0, virginCost - offcutCost);
    const totalSavedUsd = Math.round(savedPerSheet * stockItem.stockLevel);

    return {
      ratio,
      cutFormat: stockItem.cutDimensions || stockItem.sheetFormat || "470×700",
      parentFormat: parentMaterial?.sheetFormat || "700×1000",
      savedPerSheet: Number(savedPerSheet.toFixed(3)),
      totalSavedUsd,
    };
  }, [stockItem, parentMaterial]);

  // ─── Glide Data Grid 1: Stock Ledger (Movements) ─────────────────────────
  const [ledgerSelection, setLedgerSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const ledgerColumns = useMemo<GridColumn[]>(
    () => [
      { id: "date", title: "Sana", width: 100, icon: GridColumnIcon.HeaderDate },
      { id: "id", title: "Hujjat ID", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "movementType", title: "Operatsiya Turi", width: 165, icon: GridColumnIcon.HeaderLookup },
      { id: "workOrderId", title: "Buyurtma / Asos", width: 135, icon: GridColumnIcon.HeaderReference },
      { id: "inQty", title: "Kirim (+)", width: 95, icon: GridColumnIcon.HeaderNumber },
      { id: "outQty", title: "Chiqim (-)", width: 95, icon: GridColumnIcon.HeaderNumber },
      { id: "unit", title: "Birlik", width: 75, icon: GridColumnIcon.HeaderString },
      { id: "from", title: "Qayerdan", width: 200, icon: GridColumnIcon.HeaderString },
      { id: "to", title: "Qayerga / Sex", width: 200, icon: GridColumnIcon.HeaderString },
      { id: "operator", title: "Mas'ul Shaxs", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "reason", title: "Izoh / Texnik sabab", width: 280, icon: GridColumnIcon.HeaderTextTemplate },
    ],
    []
  );

  const getLedgerCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const mov = itemMovements[row];
      const column = ledgerColumns[col];
      if (!mov || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const isOut =
        mov.movementType === "ProductionIssue" ||
        mov.movementType === "WriteOff" ||
        mov.reason.toLowerCase().includes("issue") ||
        mov.reason.toLowerCase().includes("sarf");

      if (column.id === "inQty") {
        if (!isOut) {
          return {
            kind: GridCellKind.Number,
            data: mov.quantity,
            displayData: `+${mov.quantity.toLocaleString()}`,
            allowOverlay: false,
            contentAlign: "right",
            themeOverride: {
              textDark: isDark ? "#4ade80" : "#15803d",
              baseFontStyle: "700 12px monospace",
            },
          };
        }
        return {
          kind: GridCellKind.Text,
          data: "—",
          displayData: "—",
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: { textDark: isDark ? "#71717a" : "#a1a1aa" },
        };
      }

      if (column.id === "outQty") {
        if (isOut) {
          return {
            kind: GridCellKind.Number,
            data: mov.quantity,
            displayData: `-${mov.quantity.toLocaleString()}`,
            allowOverlay: false,
            contentAlign: "right",
            themeOverride: {
              textDark: isDark ? "#f87171" : "#dc2626",
              baseFontStyle: "700 12px monospace",
            },
          };
        }
        return {
          kind: GridCellKind.Text,
          data: "—",
          displayData: "—",
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: { textDark: isDark ? "#71717a" : "#a1a1aa" },
        };
      }

      if (column.id === "movementType") {
        const mType = mov.movementType;
        let label = "🔄 Tokchalararo ko'chirish";
        let dark = "#a78bfa";
        let light = "#6d28d9";

        if (mType === "CuttingReturn" || mov.isOffcut) {
          label = "✂️ Delovoy Otxod kirimi";
          dark = "#fbbf24";
          light = "#b45309";
        } else if (mType === "ProductionIssue" || isOut) {
          label = "🏭 Sexga sarf (Ishlab chiqarish)";
          dark = "#38bdf8";
          light = "#0369a1";
        } else if (mType === "WriteOff") {
          label = "⚠️ Spisaniye (Texnik brak)";
          dark = "#f87171";
          light = "#dc2626";
        }

        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: label,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? dark : light,
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      const val = mov[column.id as keyof WarehouseMovementRecord] ?? "—";
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: false,
      };
    },
    [itemMovements, ledgerColumns, isDark]
  );

  const handleLedgerCellActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const mov = itemMovements[row];
      if (!mov) return;

      if (mov.workOrderId) {
        openTab({
          id: mov.workOrderId,
          title: `${mov.workOrderId}: Buyurtma`,
          type: "work-order",
          module: "production",
          documentData: { id: mov.workOrderId },
        });
      }
    },
    [itemMovements, openTab]
  );

  // ─── Glide Data Grid 2: Work Order Consumption ───────────────────────────
  const [woSelection, setWoSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const woColumns = useMemo<GridColumn[]>(
    () => [
      { id: "id", title: "Buyurtma ID", width: 110, icon: GridColumnIcon.HeaderReference },
      { id: "customer", title: "Mijoz (Kontragent)", width: 190, icon: GridColumnIcon.HeaderString },
      { id: "product", title: "Mahsulot Nomi", width: 260, icon: GridColumnIcon.HeaderString },
      { id: "pressMachine", title: "Uskuna / Stanok", width: 220, icon: GridColumnIcon.HeaderLookup },
      { id: "stage", title: "Ishlab Chiqarish Bosqichi", width: 145, icon: GridColumnIcon.HeaderSingleValue },
      { id: "plannedSheets", title: "Reja Sarf", width: 105, icon: GridColumnIcon.HeaderNumber },
      { id: "completedSheets", title: "Fakt Sarf", width: 105, icon: GridColumnIcon.HeaderNumber },
      { id: "deadline", title: "Muddati (Deadline)", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "operator", title: "Smena / Usta", width: 150, icon: GridColumnIcon.HeaderString },
    ],
    []
  );

  const getWoCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const wo = linkedWorkOrders[row];
      const column = woColumns[col];
      if (!wo || !column) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      if (column.id === "stage") {
        const stageColors: Record<string, { dark: string; light: string }> = {
          "In Production": { dark: "#38bdf8", light: "#0284c7" },
          "Ready to Print": { dark: "#4ade80", light: "#15803d" },
          Queue: { dark: "#fbbf24", light: "#b45309" },
          Completed: { dark: "#a1a1aa", light: "#52525b" },
        };
        const c = stageColors[wo.stage] || { dark: "#94a3b8", light: "#475569" };
        return {
          kind: GridCellKind.Text,
          data: wo.stage,
          displayData: wo.stage,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? c.dark : c.light,
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      if (column.id === "plannedSheets" || column.id === "completedSheets") {
        const num = Number(wo[column.id] || 0);
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: `${num.toLocaleString()} ${stockItem.unit}`,
          allowOverlay: false,
          contentAlign: "right",
          themeOverride: { baseFontStyle: "600 12px monospace" },
        };
      }

      const val = wo[column.id as keyof typeof wo] ?? "—";
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: false,
      };
    },
    [linkedWorkOrders, woColumns, isDark, stockItem.unit]
  );

  const handleWoCellActivated = useCallback(
    (cell: Item) => {
      const [, row] = cell;
      const wo = linkedWorkOrders[row];
      if (!wo) return;

      openTab({
        id: wo.id,
        title: `${wo.id}: ${wo.product}`,
        type: "work-order",
        module: "production",
        documentData: wo,
      });
    },
    [linkedWorkOrders, openTab]
  );

  // Quick Action: Open New Warehouse Receipt with this item pre-selected
  const handleCreateReceipt = () => {
    const newId = `RCV-${Date.now().toString().slice(-4)}`;
    openTab({
      id: newId,
      title: `${newId}: ${stockItem.name}`,
      type: "warehouse-receipt",
      module: "warehouse",
      isUnsaved: true,
      documentData: {
        id: newId,
        date: new Date().toISOString().split("T")[0],
        supplier: stockItem.supplier || "Markaziy Yetkazib Beruvchi",
        material: stockItem.name,
        quantity: stockItem.reorder,
        unit: stockItem.unit,
        items: [
          {
            id: `line-${Date.now()}`,
            sku: stockItem.sku,
            name: stockItem.name,
            category: stockItem.category,
            sheetFormat: stockItem.sheetFormat || "700×1000",
            grammage: stockItem.grammage || 150,
            quantity: stockItem.reorder,
            unit: stockItem.unit,
            unitPriceUsd: stockItem.unitPriceUsd,
          },
        ],
      },
    });
  };

  const handleSaveImage = useCallback(
    (newUrl: string) => {
      upsertWarehouseStock({
        ...stockItem,
        imageUrl: newUrl,
      });
      setTabUnsaved(tab.id, true);
    },
    [stockItem, upsertWarehouseStock, setTabUnsaved, tab.id]
  );

  const handleResetImage = useCallback(() => {
    upsertWarehouseStock({
      ...stockItem,
      imageUrl: undefined,
    });
    setTabUnsaved(tab.id, true);
  }, [stockItem, upsertWarehouseStock, setTabUnsaved, tab.id]);

  return (
    <div className="w-full h-full bg-background flex flex-col select-none overflow-hidden font-sans">
      {/* ─── Level 2 Toolbar / Document Header ────────────────────────────── */}
      <div className="h-11 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="size-8 rounded-md border border-border overflow-hidden bg-muted/40 flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500/40 transition-all shadow-sm relative group"
            onClick={() => setIsImageModalOpen(true)}
            title="Rasmni kattalashtirib ko'rish"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stockItem.imageUrl || getMaterialImage(stockItem)}
              alt={stockItem.name}
              className="size-full object-contain p-0.5 select-none"
            />
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setIsUploadDialogOpen(true);
              }}
              title="Rasmni o'zgartirish"
            >
              <Camera className="size-3.5 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono text-xs font-semibold text-foreground tracking-tight">
              {stockItem.sku}
            </span>
            <Separator orientation="vertical" className="h-3.5" />
            <h1 className="text-xs font-semibold text-foreground truncate">
              {stockItem.name}
            </h1>
          </div>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
            {stockItem.category}
          </Badge>
          {stockItem.isOffcut && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold"
            >
              ✂️ Delovoy Otxod
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={`text-[10px] py-0 px-1.5 shrink-0 font-medium ${
              stockItem.status === "In Stock"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : stockItem.status === "Low Stock"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
            }`}
          >
            {stockItem.status}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsUploadDialogOpen(true)}
            className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded"
            title="Material rasmini o'zgartirish yoki yangi rasm yuklash"
          >
            <Camera className="size-3.5 text-muted-foreground" />
            <span>Rasm yuklash</span>
          </Button>

          {stockItem.category === "Paper & Board" && !stockItem.isOffcut && (
            <Button
              size="sm"
              onClick={() => setIsOffcutDialogOpen(true)}
              className="h-7 px-2.5 text-xs font-medium gap-1 rounded bg-amber-600 hover:bg-amber-700 text-white shadow-none"
            >
              <Scissors className="size-3.5" />
              <span>Qoldiq (Otxod) qaytarish</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleCreateReceipt}
            className="h-7 px-2.5 text-xs font-medium gap-1 rounded bg-blue-600 hover:bg-blue-700 text-white shadow-none"
          >
            <ArrowDownToLine className="size-3.5" />
            <span>Kirim rasmiylashtirish</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-7 px-2 text-xs font-medium gap-1 rounded"
          >
            <Printer className="size-3.5 text-muted-foreground" />
            <span>Chop etish</span>
          </Button>
        </div>
      </div>

      {/* ─── Offcut Genealogy Banner (If Offcut SKU) ───────────────────────── */}
      {stockItem.isOffcut && offcutAreaStats && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Scissors className="size-3.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>Genealogiya: Bu xomashyo kesimdan hosil bo'lgan Delovoy Otxod hisoblanadi</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 font-mono">
                  Maydon nisbati: {offcutAreaStats.ratio}% ({offcutAreaStats.cutFormat})
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Ona xomashyo: <b>{parentMaterial?.name || stockItem.parentMaterialSku}</b> ({offcutAreaStats.parentFormat}).
                Manba buyurtma: <b>{stockItem.sourceWorkOrder || "Gilotina kesimi"}</b>.
                Qayta ishlatish orqali yangi qog'oz kesishga nisbatan har varaqdan <b>${offcutAreaStats.savedPerSheet}</b> tejaladi.
              </p>
            </div>
          </div>

          {parentMaterial && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openTab({
                  id: `stock-${parentMaterial.sku}`,
                  title: `${parentMaterial.sku}: ${parentMaterial.name}`,
                  type: "warehouse-stock",
                  module: "warehouse",
                  documentData: parentMaterial,
                })
              }
              className="h-7 text-xs gap-1 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
            >
              <ExternalLink className="size-3" />
              <span>Ona qog'ozni ochish ({parentMaterial.sku})</span>
            </Button>
          )}
        </div>
      )}

      {/* ─── KPI & Analytics Ribbon (5 Cards) ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-muted/30 border-b border-border shrink-0">
        {/* 1. Total Stock */}
        <div className="p-2.5 rounded border border-border bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Jami Ombor Qoldig'i</span>
            <Boxes className="size-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-1">
            <span className="text-base font-bold font-mono text-foreground">
              {stockItem.stockLevel.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">{stockItem.unit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
            Jami qiymat: ${(stockItem.stockLevel * stockItem.unitPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* 2. Reserved for Production */}
        <div className="p-2.5 rounded border border-border bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Buyurtmalarga Band (Reserved)</span>
            <Factory className="size-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-1">
            <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
              {stockItem.reserved.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">{stockItem.unit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
            {stockItem.stockLevel > 0
              ? `${Math.round((stockItem.reserved / stockItem.stockLevel) * 100)}% band qilingan`
              : "0%"}
          </div>
        </div>

        {/* 3. Available for New Jobs */}
        <div className="p-2.5 rounded border border-border bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Erkin Qoldiq (Available)</span>
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1">
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {stockItem.available.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">{stockItem.unit}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
            Yangi buyurtmalarga ochiq
          </div>
        </div>

        {/* 4. Category-specific Metric (kg / m / sets / value) */}
        <div className="p-2.5 rounded border border-border bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>{secondaryMetric.label}</span>
            <secondaryMetric.icon className="size-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-1">
            <span className="text-base font-bold font-mono text-foreground">
              {secondaryMetric.value}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 font-medium truncate">
            {secondaryMetric.sub}
          </div>
        </div>

        {/* 5. Health & Location */}
        <div className="p-2.5 rounded border border-border bg-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Saqlash Joyi & Zaxira</span>
            <MapPin className="size-3.5 text-zinc-500" />
          </div>
          <div className="mt-1 truncate">
            <span className="text-xs font-semibold text-foreground font-mono">
              {stockItem.location}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 font-medium flex items-center gap-1">
            <span>Reorder: {stockItem.reorder.toLocaleString()}</span>
            <span>•</span>
            <span>Oxirgi kirim: {stockItem.lastReceived}</span>
          </div>
        </div>
      </div>

      {/* ─── Level 3 Workspace Tabs ────────────────────────────────────────── */}
      <Tabs
        value={activeTabKey}
        onValueChange={setActiveTabKey}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        <div className="h-9 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
          <TabsList className="h-7 bg-muted/60 p-0.5 text-xs">
            <TabsTrigger value="ledger" className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background">
              <History className="size-3.5" />
              <span>Kirim-Chiqim Tarixi (Ledger)</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center font-mono">
                {itemMovements.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="consumption" className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background">
              <Factory className="size-3.5" />
              <span>Buyurtmalar Sarfi va Rezervlar</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center font-mono">
                {linkedWorkOrders.length}
              </Badge>
            </TabsTrigger>

            {stockItem.category === "Paper & Board" && !stockItem.isOffcut && (
              <TabsTrigger value="offcuts" className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background">
                <Scissors className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Hosil bo'lgan Delovoy Otxodlar</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center font-mono">
                  {derivedOffcuts.length}
                </Badge>
              </TabsTrigger>
            )}

            {stockItem.isOffcut && (
              <TabsTrigger value="savings" className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background">
                <Sparkles className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Mos Formatlar va Tejamkorlik</span>
              </TabsTrigger>
            )}

            <TabsTrigger value="specs" className="h-6 px-2.5 text-xs gap-1.5 data-[state=active]:bg-background">
              <FileText className="size-3.5" />
              <span>Texnik Pasport va Parametrlar</span>
            </TabsTrigger>
          </TabsList>

          <span className="text-[11px] text-muted-foreground font-mono">
            {activeTabKey === "ledger" && `${itemMovements.length} ta operatsiya qayd etilgan`}
            {activeTabKey === "consumption" && `${linkedWorkOrders.length} ta faol buyurtmaga bog'langan`}
          </span>
        </div>

        {/* ── Tab 1: Stock Ledger (Glide Data Grid) ───────────────────────── */}
        <TabsContent value="ledger" className="flex-1 w-full h-full m-0 p-0 overflow-hidden relative">
          <DataEditor
            getCellContent={getLedgerCellContent}
            onCellActivated={handleLedgerCellActivated}
            columns={ledgerColumns}
            rows={itemMovements.length}
            rowMarkers="both"
            freezeColumns={1}
            smoothScrollX={true}
            smoothScrollY={true}
            width="100%"
            height="100%"
            gridSelection={ledgerSelection}
            onGridSelectionChange={setLedgerSelection}
            headerHeight={28}
            rowHeight={30}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          />
        </TabsContent>

        {/* ── Tab 2: Work Order Consumption (Glide Data Grid) ─────────────── */}
        <TabsContent value="consumption" className="flex-1 w-full h-full m-0 p-0 overflow-hidden relative">
          <DataEditor
            getCellContent={getWoCellContent}
            onCellActivated={handleWoCellActivated}
            columns={woColumns}
            rows={linkedWorkOrders.length}
            rowMarkers="both"
            freezeColumns={1}
            smoothScrollX={true}
            smoothScrollY={true}
            width="100%"
            height="100%"
            gridSelection={woSelection}
            onGridSelectionChange={setWoSelection}
            headerHeight={28}
            rowHeight={30}
            theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
          />
        </TabsContent>

        {/* ── Tab 3: Derived Offcuts (For Parent Substrate) ───────────────── */}
        {stockItem.category === "Paper & Board" && !stockItem.isOffcut && (
          <TabsContent value="offcuts" className="flex-1 w-full h-full m-0 p-4 overflow-y-auto">
            <div className="max-w-4xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Shu qog'ozdan ({stockItem.sheetFormat || "700×1000"}) kesilgan Delovoy Otxodlar
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gilotina kesimidan keyin omborga qayta kirim qilingan yaroqli qoldiqlar ro'yxati
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsOffcutDialogOpen(true)}
                  className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-none"
                >
                  <Scissors className="size-3.5" />
                  <span>Yangi qoldiqni kirim qilish</span>
                </Button>
              </div>

              {derivedOffcuts.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-lg text-center space-y-2">
                  <Scissors className="size-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-medium text-foreground">
                    Hozircha ushbu qog'ozdan hosil bo'lgan delovoy otxodlar yo'q
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Sexda bu qog'oz kesilgach, qolgan yaroqli qoldiqlarni "Qoldiqni kirim qilish" tugmasi orqali hisobga olishingiz mumkin.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {derivedOffcuts.map((off) => (
                    <div
                      key={off.sku}
                      className="p-3.5 rounded-lg border border-border bg-card hover:border-amber-500/50 transition-colors flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-mono text-amber-700 dark:text-amber-300 border-amber-500/40">
                              {off.sku}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground">
                              {off.cutDimensions || off.sheetFormat}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {off.name}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {off.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/50 text-[11px]">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Zaxirada:</span>
                          <span className="font-mono font-bold text-foreground">
                            {off.stockLevel.toLocaleString()} {off.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Erkin:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {off.available.toLocaleString()} {off.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Tannarxi:</span>
                          <span className="font-mono font-bold text-foreground">
                            ${off.unitPriceUsd}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3" />
                          {off.location}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openTab({
                              id: `stock-${off.sku}`,
                              title: `${off.sku}: ${off.name}`,
                              type: "warehouse-stock",
                              module: "warehouse",
                              documentData: off,
                            })
                          }
                          className="h-7 text-xs gap-1"
                        >
                          <ExternalLink className="size-3 text-muted-foreground" />
                          <span>Kartochkani ochish</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ── Tab 4: Matching Jobs & Savings (For Offcut Record) ──────────── */}
        {stockItem.isOffcut && offcutAreaStats && (
          <TabsContent value="savings" className="flex-1 w-full h-full m-0 p-4 overflow-y-auto">
            <div className="max-w-4xl space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Iqtisodiy Samaradorlik va Tejamkorlik Hisoboti
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                    Ushbu delovoy otxod yangi katta qog'oz kesish o'rniga kichik tirajlarga ishlatilganda har bir varaqdan{" "}
                    <b>${offcutAreaStats.savedPerSheet} USD</b> tejaladi.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground block">Mavjud zaxiradan jami tejam:</span>
                  <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    +${offcutAreaStats.totalSavedUsd.toLocaleString()} USD
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  Ushbu {offcutAreaStats.cutFormat} o'lchamga mos keluvchi tavsiya etilgan formatlar:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>A4 Format (210×297)</span>
                      <Badge variant="outline" className="text-[10px]">2-up</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Bitta otxod varag'iga 2 ta A4 bemalol joylashadi. Sertifikat, flayer va kichik blankalar uchun ideal.
                    </p>
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>A5 Buklet (148×210)</span>
                      <Badge variant="outline" className="text-[10px]">4-up</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Bitta varaqqa 4 ta A5 joylashadi. Reklama varaqalari va restoran menyulari uchun yangi qog'oz kesish shart emas.
                    </p>
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Kiyim Yorliqlari / Birkalar</span>
                      <Badge variant="outline" className="text-[10px]">24-up</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      50×90mm o'lchamdagi osma teglardan 20-24 ta sig'adi. Qoldiqdan maksimal 94% foydali qoplama.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ── Tab 5: Technical Specifications Card ────────────────────────── */}
        <TabsContent value="specs" className="flex-1 w-full h-full m-0 p-4 overflow-y-auto">
          <div className="max-w-4xl space-y-4">
            {/* Visual Passport & Material Image Card */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col sm:flex-row gap-5 items-start">
              <div className="relative group shrink-0 self-center sm:self-start">
                <div
                  className="w-44 h-44 rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center p-2 cursor-pointer shadow-inner relative transition-all group-hover:border-blue-500/50"
                  onClick={() => setIsImageModalOpen(true)}
                  title="Rasmni to'liq o'lchamda ko'rish uchun bosing"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stockItem.imageUrl || getMaterialImage(stockItem)}
                    alt={stockItem.name}
                    className="size-full object-contain select-none transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <span className="text-white text-xs font-medium flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded backdrop-blur-sm">
                      <ZoomIn className="size-3.5" />
                      Kattalashtirish
                    </span>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="mt-2 text-[10px] w-full justify-center font-mono py-0.5 truncate"
                >
                  {stockItem.imageUrl?.startsWith("data:")
                    ? "Maxsus grafik rasm"
                    : stockItem.imageUrl?.startsWith("http")
                    ? "Tashqi URL havola"
                    : "Vektorli SVG shablon"}
                </Badge>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono font-semibold">
                      {stockItem.sku}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {stockItem.category}
                    </Badge>
                    {stockItem.isOffcut && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      >
                        ✂️ Delovoy Otxod
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        stockItem.status === "In Stock"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : stockItem.status === "Low Stock"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {stockItem.status}
                    </Badge>
                  </div>
                  <h2 className="text-base font-bold text-foreground mt-2 leading-snug">
                    {stockItem.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ushbu rasm ish varaqalarida (Work Order BOM), ombor qoldiqlari ro'yxatida, kirim hujjatlarida va nomenklatura tanlagichlarida avtomatik tarzda aks ettiriladi.
                  </p>
                </div>

                <div className="pt-4 flex items-center gap-2 flex-wrap border-t border-border/60 mt-3">
                  <Button
                    size="sm"
                    onClick={() => setIsUploadDialogOpen(true)}
                    className="h-8 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-none"
                  >
                    <Camera className="size-3.5" />
                    <span>Rasm yuklash / O'zgartirish</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsImageModalOpen(true)}
                    className="h-8 px-3 text-xs gap-1.5"
                  >
                    <ZoomIn className="size-3.5 text-muted-foreground" />
                    <span>To'liq o'lchamda ko'rish</span>
                  </Button>

                  {stockItem.imageUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleResetImage}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive gap-1"
                      title="Standart tizim SVG shabloniga qaytarish"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Standartga qaytarish</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Texnik Xususiyatlar va Parametrlar
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Xomashyoning ishlab chiqarish standartlari va ombor parametrlari
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Nomenklatura SKU:</span>
                <p className="font-mono font-semibold text-foreground">{stockItem.sku}</p>
              </div>

              <div className="p-3 rounded border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Asosiy Toifa:</span>
                <p className="font-semibold text-foreground">{stockItem.category}</p>
              </div>

              <div className="p-3 rounded border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">O'lchov Birligi:</span>
                <p className="font-semibold text-foreground">{stockItem.unit}</p>
              </div>

              {stockItem.sheetFormat && (
                <div className="p-3 rounded border border-border bg-card space-y-1">
                  <span className="text-[11px] text-muted-foreground">Format / O'lcham:</span>
                  <p className="font-mono font-semibold text-foreground">{stockItem.sheetFormat} mm</p>
                </div>
              )}

              {stockItem.grammage && (
                <div className="p-3 rounded border border-border bg-card space-y-1">
                  <span className="text-[11px] text-muted-foreground">Zichlik (Grammage):</span>
                  <p className="font-mono font-semibold text-foreground">{stockItem.grammage} g/m²</p>
                </div>
              )}

              {stockItem.grainDirection && (
                <div className="p-3 rounded border border-border bg-card space-y-1">
                  <span className="text-[11px] text-muted-foreground">Tola Yo'nalishi:</span>
                  <p className="font-semibold text-foreground">{stockItem.grainDirection}</p>
                </div>
              )}

              {stockItem.rollWidthMm && (
                <div className="p-3 rounded border border-border bg-card space-y-1">
                  <span className="text-[11px] text-muted-foreground">Rulon Eni / Uzunligi:</span>
                  <p className="font-mono font-semibold text-foreground">
                    {stockItem.rollWidthMm} mm × {stockItem.rollLengthM || 200} m
                  </p>
                </div>
              )}

              {stockItem.batchNo && (
                <div className="p-3 rounded border border-border bg-card space-y-1">
                  <span className="text-[11px] text-muted-foreground">Partiya / Batch No:</span>
                  <p className="font-mono font-semibold text-foreground">{stockItem.batchNo}</p>
                </div>
              )}

              {stockItem.expiryDate && (
                <div className="p-3 rounded border border-border bg-card space-y-1">
                  <span className="text-[11px] text-muted-foreground">Yaroqlilik Muddati:</span>
                  <p className="font-mono font-semibold text-foreground">{stockItem.expiryDate}</p>
                </div>
              )}

              <div className="p-3 rounded border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Yetkazib Beruvchi (Supplier):</span>
                <p className="font-semibold text-foreground">{stockItem.supplier || "Asosiy Shartnoma"}</p>
              </div>

              <div className="p-3 rounded border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Minimal Chegara (Reorder):</span>
                <p className="font-mono font-semibold text-foreground">
                  {stockItem.reorder.toLocaleString()} {stockItem.unit}
                </p>
              </div>

              <div className="p-3 rounded border border-border bg-card space-y-1">
                <span className="text-[11px] text-muted-foreground">Oxirgi Kirim Sanasi:</span>
                <p className="font-mono font-semibold text-foreground">{stockItem.lastReceived}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ReturnOffcutDialog open={isOffcutDialogOpen} onOpenChange={setIsOffcutDialogOpen} />
      <MaterialImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        data={{
          imageUrl: stockItem.imageUrl || getMaterialImage(stockItem),
          title: stockItem.name,
          sku: stockItem.sku,
          category: stockItem.category,
          spec: stockItem.sheetFormat ? `${stockItem.sheetFormat} mm` : stockItem.cutDimensions,
          stock: stockItem.available,
          unit: stockItem.unit,
          location: stockItem.location,
          supplier: stockItem.supplier,
          status: stockItem.status,
        }}
      />
      <MaterialImageUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        materialName={stockItem.name}
        materialSku={stockItem.sku}
        currentImageUrl={stockItem.imageUrl || getMaterialImage(stockItem)}
        onSave={handleSaveImage}
      />
    </div>
  );
}
