"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import {
  useWorkspaceStore,
  generateNextMaterialSku,
  DocumentTab,
  WarehouseStockRecord,
  WarehouseMovementRecord,
} from "@/store/workspaceStore";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxSelect, type ComboboxOption } from "@/components/ui/combobox";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DocumentHeader,
  HeaderIconAction,
  DocumentSidebar,
  SidebarSummaryCard,
  InfoRow,
  DocumentNavItem,
} from "./common/DocumentShell";
import { ReturnOffcutDialog } from "@/components/grid/ReturnOffcutDialog";
import { WarehouseSelect } from "@/components/common/WarehouseSelect";
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
} from "lucide-react";

const DataEditor = dynamic(
  () => import("@glideapps/glide-data-grid").then((mod) => mod.DataEditor),
  { ssr: false }
);

const STOCK_CATEGORY_OPTIONS: ComboboxOption[] = [
  { value: "Foil & Film", label: "Foil & Film", description: "Laminatsiya plyonkalari va zar folgalar" },
  { value: "Inks & Plates", label: "Inks & Plates", description: "Bosma bo'yoqlari, laklar va CTP qoliplar" },
  { value: "Paper & Board", label: "Paper & Board", description: "Ofset qog'ozlari va bo'rlangan kartonlar" },
  { value: "Roll & Label", label: "Roll & Label", description: "Rulon xomashyolari va samokleykalar" },
  { value: "Adhesives & Binding", label: "Adhesives & Binding", description: "Kashirovka va termo yelimlar, iplar" },
  { value: "Offcuts & Scraps", label: "Offcuts & Scraps", description: "Ishlab chiqarishdan qaytgan delovoy otxodlar" },
];

const STOCK_UNIT_OPTIONS: ComboboxOption[] = [
  { value: "m", label: "Metr (m)", description: "Chiziqli uzunlik (plyonka va lenta)" },
  { value: "kg", label: "Kilogramm (kg)", description: "Bo'yoq, lak va yelim xomashyosi" },
  { value: "sheets", label: "Varaq (sheets)", description: "Listli qog'oz va karton" },
  { value: "rolls", label: "Rulon (rolls)", description: "Rulonli xomashyolar" },
  { value: "pcs", label: "Dona (pcs)", description: "Donali buyum va materiallar" },
  { value: "m²", label: "Kvadrat metr (m²)", description: "Maydon birligi" },
  { value: "liters", label: "Litr (liters)", description: "Suyuqlik hajmi" },
  { value: "drums", label: "Bochka (drums)", description: "Yirik hajmli idish" },
];

const GRAIN_DIRECTION_OPTIONS: ComboboxOption[] = [
  { value: "Long Grain", label: "Long Grain", description: "Bo'yiga tola yo'nalishi" },
  { value: "Short Grain", label: "Short Grain", description: "Eniga tola yo'nalishi" },
];

export function WarehouseStockDetail({ tab }: { tab: DocumentTab }) {
  const {
    warehouseStock,
    warehouseMovements,
    productionQueue,
    upsertWarehouseStock,
    upsertWarehouseStockAsync,
    openTab,
    closeTab,
    setTabUnsaved,
    addNotification,
    theme,
  } = useWorkspaceStore();

  const isDark = theme === "dark";

  // Match live stock record from store or documentData without any mock defaults
  const stockItem = useMemo<WarehouseStockRecord>(() => {
    const d = tab.documentData || {};
    const rawFromTab = tab.id.startsWith("stock-") ? tab.id.replace(/^stock-/, "") : "";
    const isGenericTabId = tab.id.startsWith("tab-") || (!d.sku && rawFromTab.startsWith("tab-"));
    const sku = isGenericTabId ? "" : (d.sku || rawFromTab);
    const found = warehouseStock.find((s) => s.sku === sku);
    if (found) {
      return {
        ...found,
        imageUrl: found.imageUrl || undefined,
      };
    }

    const fallbackRecord: WarehouseStockRecord = {
      sku: sku || generateNextMaterialSku(warehouseStock),
      name: d.name || "",
      category: d.category || "Paper & Board",
      grammage: d.grammage !== undefined && d.grammage !== "" ? Number(d.grammage) : undefined,
      sheetFormat: d.sheetFormat || "",
      unit: d.unit || "sheets",
      location: d.location || "",
      stockLevel: Number(d.stockLevel) || 0,
      reserved: Number(d.reserved) || 0,
      available: Number(d.available) || 0,
      reorder: Number(d.reorder) || 0,
      currency: d.currency || (d.unitPriceUzs && !d.unitPriceUsd ? "UZS" : "USD"),
      unitPrice: d.unitPrice !== undefined ? Number(d.unitPrice) : (Number(d.unitPriceUsd) || 0),
      unitPriceUsd: Number(d.unitPriceUsd) || 0,
      unitPriceUzs: d.unitPriceUzs ? Number(d.unitPriceUzs) : Math.round((Number(d.unitPriceUsd) || 0) * 12850),
      lastReceived: d.lastReceived || new Date().toISOString().split("T")[0],
      status: d.status || "In Stock",
      isOffcut: d.isOffcut,
      parentMaterialSku: d.parentMaterialSku,
      cutDimensions: d.cutDimensions,
      sourceWorkOrder: d.sourceWorkOrder,
      supplier: d.supplier || "",
      grainDirection: d.grainDirection || "Long Grain",
      rollWidthMm: d.rollWidthMm,
      rollLengthM: d.rollLengthM,
      batchNo: d.batchNo || "",
      expiryDate: d.expiryDate,
      imageUrl: d.imageUrl || undefined,
    };
    return fallbackRecord;
  }, [warehouseStock, tab.documentData, tab.id]);

  const [doc, setDoc] = useState<WarehouseStockRecord>(stockItem);
  // Default to specs (Texnik Pasport) - the logical primary tab
  const [activeTabKey, setActiveTabKey] = useState<string>("specs");
  const [isOffcutDialogOpen, setIsOffcutDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    setDoc(stockItem);
  }, [stockItem]);

  const handleFieldChange = (field: keyof WarehouseStockRecord, val: any) => {
    setDoc((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleSave = async () => {
    const rate = 12850;
    const cur: "USD" | "UZS" = doc.currency || "USD";
    let pUsd = Number(doc.unitPriceUsd) || 0;
    let pUzs = Number(doc.unitPriceUzs) || 0;
    let pBase = Number(doc.unitPrice);

    if (cur === "UZS") {
      if (!pBase && pUzs) pBase = pUzs;
      pUzs = pBase;
      pUsd = pBase > 0 ? Number((pBase / rate).toFixed(4)) : 0;
    } else {
      if (!pBase && pUsd) pBase = pUsd;
      pUsd = pBase;
      pUzs = Math.round(pBase * rate);
    }

    const updated: WarehouseStockRecord = {
      ...doc,
      currency: cur,
      unitPrice: pBase,
      unitPriceUsd: pUsd,
      unitPriceUzs: pUzs,
      stockLevel: Number(doc.stockLevel) || 0,
      reserved: Number(doc.reserved) || 0,
      available: Math.max(0, (Number(doc.stockLevel) || 0) - (Number(doc.reserved) || 0)),
      reorder: Number(doc.reorder) || 0,
      grammage: doc.grammage ? Number(doc.grammage) : undefined,
    };
    await upsertWarehouseStockAsync(updated);
    setDoc(updated);
    setTabUnsaved(tab.id, false);
    addNotification({
      title: "Xomashyo muvaffaqiyatli saqlandi",
      description: `${updated.sku}: ${updated.name || "Material"} bazaga yozildi.`,
      severity: "success",
    });
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    closeTab(tab.id);
  };

  // Find Parent Material if this is an Offcut
  const parentMaterial = useMemo(() => {
    if (!doc.isOffcut || !doc.parentMaterialSku) return null;
    return warehouseStock.find((s) => s.sku === doc.parentMaterialSku);
  }, [doc.isOffcut, doc.parentMaterialSku, warehouseStock]);

  // Find Derived Offcuts if this is a Parent Substrate
  const derivedOffcuts = useMemo(() => {
    if (doc.isOffcut || !doc.sku) return [];
    return warehouseStock.filter((s) => s.parentMaterialSku === doc.sku);
  }, [doc.isOffcut, doc.sku, warehouseStock]);

  // Filter movements strictly for this SKU or Name (no phantom matches)
  const itemMovements = useMemo(() => {
    const qSku = (doc.sku || "").trim().toLowerCase();
    const qName = (doc.name || "").trim().toLowerCase();
    const parentSku = (doc.parentMaterialSku || "").trim().toLowerCase();

    if (!qSku && !qName) return [];

    return warehouseMovements.filter((m) => {
      const mSku = (m.materialSku || "").toLowerCase();
      const mMat = (m.material || "").toLowerCase();
      const mParent = (m.parentMaterialSku || "").toLowerCase();

      return (
        (qSku && mSku === qSku) ||
        (qName.length >= 3 && (mMat.includes(qName) || qName.includes(mMat))) ||
        (doc.isOffcut && parentSku && mParent === parentSku && m.isOffcut)
      );
    });
  }, [warehouseMovements, doc.sku, doc.name, doc.parentMaterialSku, doc.isOffcut]);

  // Filter Work Orders where this material is genuinely used or reserved (no phantom matches)
  const linkedWorkOrders = useMemo(() => {
    const qName = (doc.name || "").trim().toLowerCase();
    const qSku = (doc.sku || "").trim().toLowerCase();

    if (!qSku && !qName) return [];

    return productionQueue.filter((wo) => {
      // Check if WO is explicitly mentioned in movements
      const usedInMovements = itemMovements.some((m) => m.workOrderId === wo.id);
      // Check if offcut was created from this WO
      const isSourceWo = Boolean(doc.sourceWorkOrder && doc.sourceWorkOrder === wo.id);
      // Check if WO product mentions the material name
      const matchesProduct = Boolean(
        qName.length >= 3 && wo.product.toLowerCase().includes(qName)
      );

      return usedInMovements || isSourceWo || matchesProduct;
    });
  }, [productionQueue, itemMovements, doc.name, doc.sku, doc.sourceWorkOrder]);

  // Offcut area ratio vs parent sheet
  const offcutAreaStats = useMemo(() => {
    if (!doc.isOffcut) return null;
    const cutDims = (doc.cutDimensions || doc.sheetFormat || "470×700").split("×");
    const cutArea = (parseFloat(cutDims[0]) || 470) * (parseFloat(cutDims[1]) || 700);

    const parentDims = (parentMaterial?.sheetFormat || "700×1000").split("×");
    const parentArea = (parseFloat(parentDims[0]) || 700) * (parseFloat(parentDims[1]) || 1000);

    const ratio = Math.round((cutArea / parentArea) * 100);
    const virginCost = parentMaterial?.unitPriceUsd || (parentMaterial?.unitPriceUzs ? Number((parentMaterial.unitPriceUzs / 12850).toFixed(4)) : 0.20);
    const offcutCost = doc.unitPriceUsd || (doc.unitPriceUzs ? Number((doc.unitPriceUzs / 12850).toFixed(4)) : 0.11);
    const savedPerSheet = Math.max(0, virginCost - offcutCost);
    const totalSavedUsd = Math.round(savedPerSheet * doc.stockLevel);
    const totalSavedUzs = Math.round(totalSavedUsd * 12850);

    return {
      ratio,
      cutFormat: doc.cutDimensions || doc.sheetFormat || "470×700",
      parentFormat: parentMaterial?.sheetFormat || "700×1000",
      savedPerSheet: Number(savedPerSheet.toFixed(3)),
      savedPerSheetUzs: Math.round(savedPerSheet * 12850),
      totalSavedUsd,
      totalSavedUzs,
    };
  }, [doc, parentMaterial]);

  // Quick Action: Open New Warehouse Receipt with this item pre-selected
  const handleCreateReceipt = () => {
    const newId = `RCV-${Date.now().toString().slice(-4)}`;
    openTab({
      id: newId,
      title: `${newId}: ${doc.name || "Kirim"}`,
      type: "warehouse-receipt",
      module: "warehouse",
      isUnsaved: false,
      documentData: {
        id: newId,
        date: new Date().toISOString().split("T")[0],
        supplier: doc.supplier || "Markaziy Yetkazib Beruvchi",
        material: doc.name,
        quantity: doc.reorder || 1000,
        unit: doc.unit,
        items: [
          {
            id: `line-${Date.now()}`,
            sku: doc.sku,
            name: doc.name,
            category: doc.category,
            sheetFormat: doc.sheetFormat || "",
            grammage: doc.grammage,
            quantity: doc.reorder || 1000,
            unit: doc.unit,
            unitPriceUsd: doc.unitPriceUsd,
          },
        ],
      },
    });
  };

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
      { id: "from", title: "Qayerdan", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "to", title: "Qayerga / Sex", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "operator", title: "Mas'ul Shaxs", width: 130, icon: GridColumnIcon.HeaderString },
      { id: "reason", title: "Izoh / Texnik sabab", width: 250, icon: GridColumnIcon.HeaderTextTemplate },
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
        return { kind: GridCellKind.Text, data: "—", displayData: "—", allowOverlay: false, contentAlign: "center" };
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
        return { kind: GridCellKind.Text, data: "—", displayData: "—", allowOverlay: false, contentAlign: "center" };
      }

      if (column.id === "movementType") {
        const mType = mov.movementType;
        let label: string = mType || "Operatsiya";
        let dark = "#38bdf8";
        let light = "#0284c7";

        if (mType === "ProductionIssue") {
          label = "Ishlab chiqarish sarfi";
          dark = "#f59e0b";
          light = "#b45309";
        } else if (mType === "CuttingReturn") {
          label = "Delovoy Otxod qaytarish";
          dark = "#ec4899";
          light = "#be185d";
        } else if (mType === "Transfer") {
          label = "Omborlararo ko'chirish";
          dark = "#a855f7";
          light = "#7e22ce";
        } else if (mType === "WriteOff") {
          label = "Spisaniye (Texnik brak)";
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
      { id: "customer", title: "Mijoz (Kontragent)", width: 180, icon: GridColumnIcon.HeaderString },
      { id: "product", title: "Mahsulot Nomi", width: 240, icon: GridColumnIcon.HeaderString },
      { id: "pressMachine", title: "Uskuna / Stanok", width: 200, icon: GridColumnIcon.HeaderLookup },
      { id: "stage", title: "Ishlab Chiqarish Bosqichi", width: 145, icon: GridColumnIcon.HeaderSingleValue },
      { id: "plannedSheets", title: "Reja Sarf", width: 105, icon: GridColumnIcon.HeaderNumber },
      { id: "completedSheets", title: "Fakt Sarf", width: 105, icon: GridColumnIcon.HeaderNumber },
      { id: "deadline", title: "Muddati (Deadline)", width: 110, icon: GridColumnIcon.HeaderDate },
      { id: "operator", title: "Smena / Usta", width: 140, icon: GridColumnIcon.HeaderString },
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
          displayData: `${num.toLocaleString()} ${doc.unit}`,
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
    [linkedWorkOrders, woColumns, isDark, doc.unit]
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

  // Vertical Navigation Items (Strict 1C Order: Specs -> Ledger -> Work Orders -> Offcuts / Savings)
  const navItems: DocumentNavItem[] = useMemo(() => {
    const list: DocumentNavItem[] = [
      {
        id: "specs",
        label: "Texnik Pasport va Parametrlar",
        icon: FileText,
      },
      {
        id: "ledger",
        label: "Kirim-Chiqim Tarixi (Ledger)",
        icon: History,
        badge: itemMovements.length > 0 ? itemMovements.length : null,
      },
      {
        id: "consumption",
        label: "Buyurtmalar Sarfi va Rezervlar",
        icon: Factory,
        badge: linkedWorkOrders.length > 0 ? linkedWorkOrders.length : null,
      },
    ];

    if (doc.category === "Paper & Board" && !doc.isOffcut) {
      list.push({
        id: "offcuts",
        label: "Hosil bo'lgan Delovoy Otxodlar",
        icon: Scissors,
        badge: derivedOffcuts.length > 0 ? derivedOffcuts.length : null,
      });
    }

    if (doc.isOffcut) {
      list.push({
        id: "savings",
        label: "Mos Formatlar va Tejamkorlik",
        icon: Sparkles,
      });
    }

    return list;
  }, [doc.category, doc.isOffcut, itemMovements.length, linkedWorkOrders.length, derivedOffcuts.length]);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs select-none font-sans">
      <Tabs
        value={activeTabKey}
        onValueChange={setActiveTabKey}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* ─── 1C Level-2 Document Workspace Header Bar ─────────────────────── */}
        <DocumentHeader
          icon={Boxes}
          title={doc.name || (tab.isUnsaved ? "Yangi Xomashyo / Material" : doc.sku)}
          docNo={doc.sku || "Yangi SKU"}
          date={doc.lastReceived}
          status={doc.status}
          actions={
            <>
              {doc.category === "Paper & Board" && !doc.isOffcut && (
                <Button
                  size="sm"
                  onClick={() => setIsOffcutDialogOpen(true)}
                  className="h-7 px-2.5 text-xs font-medium gap-1 rounded bg-amber-600 hover:bg-amber-700 text-white shadow-none cursor-pointer"
                >
                  <Scissors className="size-3.5" />
                  <span className="hidden sm:inline">Qoldiq (Otxod) qaytarish</span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleCreateReceipt}
                className="h-7 px-2.5 text-xs font-medium gap-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white shadow-none cursor-pointer"
              >
                <ArrowDownToLine className="size-3.5" />
                <span className="hidden sm:inline">Kirim qilish</span>
              </Button>

              <HeaderIconAction
                icon={Printer}
                label="Chop etish (Ctrl+P)"
                variant="outline"
                onClick={() => window.print()}
              />

              <Separator orientation="vertical" className="h-4 mx-0.5" />

              {/* Save Button */}
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-none cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Saqlash</span>
              </Button>

              {/* Save & Close Button */}
              <Button
                size="sm"
                onClick={handleSaveAndClose}
                className="h-7 px-2.5 text-xs font-medium gap-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white shadow-none cursor-pointer"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Saqlash va yopish</span>
              </Button>
            </>
          }
        />

        {/* ─── Main Workspace Body: Left Sub-Sidebar + Right Content Viewport ── */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Vertical Document Sidebar */}
          <DocumentSidebar
            sectionsLabel="Bo'limlar"
            activeId={activeTabKey}
            onSelect={(id: string) => setActiveTabKey(id)}
            summary={
              <SidebarSummaryCard
                icon={Boxes}
                title={doc.name || "Xomashyo kartochkasi"}
                subtitle={doc.sku || "SKU belgilanmagan"}
              >
                <InfoRow label="Toifa">
                  <span className="font-semibold text-foreground truncate">{doc.category}</span>
                </InfoRow>
                <InfoRow label="Birlik">
                  <span className="font-mono text-foreground">{doc.unit}</span>
                </InfoRow>
                <InfoRow label="Jami qoldiq">
                  <span className="font-mono font-bold text-foreground">
                    {doc.stockLevel.toLocaleString()} {doc.unit}
                  </span>
                </InfoRow>
                <InfoRow label="Zaxirada">
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {doc.available.toLocaleString()} {doc.unit}
                  </span>
                </InfoRow>
                <InfoRow label="Narx">
                  <div className="flex flex-col items-end text-right">
                    <span className="font-mono text-foreground font-semibold">
                      {doc.currency === "UZS"
                        ? `${(doc.unitPrice || doc.unitPriceUzs || 0).toLocaleString()} UZS`
                        : `$${doc.unitPriceUsd || doc.unitPrice || 0}`}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {doc.currency === "UZS"
                        ? `~$${(doc.unitPriceUsd || 0).toFixed(3)}`
                        : `~${(doc.unitPriceUzs || Math.round((doc.unitPriceUsd || 0) * 12850)).toLocaleString()} UZS`}
                    </span>
                  </div>
                </InfoRow>
                {doc.location && (
                  <InfoRow label="Joylashuv">
                    <span className="font-mono text-muted-foreground truncate max-w-[110px]" title={doc.location}>
                      {doc.location}
                    </span>
                  </InfoRow>
                )}
                {doc.reorder > 0 && (
                  <InfoRow label="Reorder">
                    <span className="font-mono text-muted-foreground">
                      {doc.reorder.toLocaleString()}
                    </span>
                  </InfoRow>
                )}
              </SidebarSummaryCard>
            }
            items={navItems}
          />

          {/* ─── Right Main Viewport ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
            {/* ── 1. Tab: Specs (Texnik Pasport va Parametrlar - Logical 1st) ── */}
            <TabsContent value="specs" className="flex-1 w-full h-full m-0 p-4 overflow-y-auto">
              <div className="max-w-4xl space-y-4">
                {/* Asosiy identifikatsiya kartochkasi */}
                <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono font-semibold">
                      {doc.sku || "Yangi SKU"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {doc.category}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    >
                      {doc.status || "In Stock"}
                    </Badge>
                    {doc.isOffcut && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold"
                      >
                        Delovoy Otxod
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Xomashyo / Mahsulot To&apos;liq Nomi *
                    </Label>
                    <Input
                      value={doc.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="Masalan: Galerie Art Silk 150g/m² (700×1000)"
                      className="h-8 text-xs font-medium bg-background"
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ushbu nom va parametrlar barcha ishlab chiqarish (Work Order BOM), ombor hisob-kitob va kirim hujjatlarida avtomatik tarzda aks etadi.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Texnik Xususiyatlar va Parametrlarni Tahrirlash
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Xomashyoning ishlab chiqarish standartlari, o&apos;lchov birligi va ombor parametrlari
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Artikul / SKU *</Label>
                    <Input
                      value={doc.sku}
                      onChange={(e) => handleFieldChange("sku", e.target.value)}
                      placeholder="Masalan: MAT-1010"
                      className="h-7 text-xs font-mono font-semibold"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Asosiy Toifa *</Label>
                    <ComboboxSelect
                      items={STOCK_CATEGORY_OPTIONS}
                      value={doc.category}
                      onValueChange={(val) => handleFieldChange("category", val)}
                      placeholder="Toifani tanlang..."
                      className="w-full h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">O&apos;lchov Birligi *</Label>
                    <ComboboxSelect
                      items={STOCK_UNIT_OPTIONS}
                      value={doc.unit}
                      onValueChange={(val) => handleFieldChange("unit", val)}
                      placeholder="O'lchov birligini tanlang..."
                      className="w-full h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Format / O&apos;lcham (mm)</Label>
                    <Input
                      value={doc.sheetFormat || ""}
                      onChange={(e) => handleFieldChange("sheetFormat", e.target.value)}
                      placeholder="Masalan: 700×1000"
                      className="h-7 text-xs font-mono"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Zichlik (Grammage, g/m²)</Label>
                    <Input
                      type="number"
                      value={doc.grammage !== undefined ? doc.grammage : ""}
                      onChange={(e) => handleFieldChange("grammage", e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Masalan: 150"
                      className="h-7 text-xs font-mono"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Boshlang&apos;ich Qoldiq ({doc.unit})</Label>
                    <Input
                      type="number"
                      value={doc.stockLevel || ""}
                      onChange={(e) => handleFieldChange("stockLevel", Number(e.target.value) || 0)}
                      placeholder="0"
                      className="h-7 text-xs font-mono font-bold text-foreground"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Minimal Chegara (Reorder Point)</Label>
                    <Input
                      type="number"
                      value={doc.reorder || ""}
                      onChange={(e) => handleFieldChange("reorder", Number(e.target.value) || 0)}
                      placeholder="0"
                      className="h-7 text-xs font-mono"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground font-semibold">Birlik narxi</Label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newCur = "USD";
                            const p = doc.unitPriceUsd || (doc.unitPriceUzs ? Number((doc.unitPriceUzs / 12850).toFixed(4)) : 0);
                            setDoc((prev) => ({
                              ...prev,
                              currency: newCur,
                              unitPrice: p,
                              unitPriceUsd: p,
                              unitPriceUzs: Math.round(p * 12850),
                            }));
                            setTabUnsaved(tab.id, true);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer",
                            doc.currency !== "UZS"
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          USD ($)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newCur = "UZS";
                            const p = doc.unitPriceUzs || Math.round((doc.unitPriceUsd || 0) * 12850);
                            setDoc((prev) => ({
                              ...prev,
                              currency: newCur,
                              unitPrice: p,
                              unitPriceUzs: p,
                              unitPriceUsd: p > 0 ? Number((p / 12850).toFixed(4)) : 0,
                            }));
                            setTabUnsaved(tab.id, true);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer",
                            doc.currency === "UZS"
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          UZS (so&apos;m)
                        </button>
                      </div>
                    </div>

                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={doc.currency === "UZS" ? 0 : 3}
                      value={doc.currency === "UZS" ? (doc.unitPriceUzs || doc.unitPrice || "") : (doc.unitPriceUsd || doc.unitPrice || "")}
                      onValueChange={(values) => {
                        const val = values.floatValue ?? 0;
                        if (doc.currency === "UZS") {
                          setDoc((prev) => ({
                            ...prev,
                            unitPrice: val,
                            unitPriceUzs: val,
                            unitPriceUsd: val > 0 ? Number((val / 12850).toFixed(4)) : 0,
                          }));
                        } else {
                          setDoc((prev) => ({
                            ...prev,
                            unitPrice: val,
                            unitPriceUsd: val,
                            unitPriceUzs: Math.round(val * 12850),
                          }));
                        }
                        setTabUnsaved(tab.id, true);
                      }}
                      placeholder={doc.currency === "UZS" ? "0" : "0.00"}
                      className="h-7 text-xs font-mono"
                    />

                    <div className="text-[10px] font-mono text-muted-foreground">
                      Ekvivalent:{" "}
                      <span className="font-semibold text-foreground">
                        {doc.currency === "UZS"
                          ? `$${(doc.unitPriceUsd || 0).toFixed(3)}`
                          : `${(doc.unitPriceUzs || Math.round((doc.unitPriceUsd || 0) * 12850)).toLocaleString()} UZS`}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Saqlash Joyi (Ombor) *</Label>
                    <WarehouseSelect
                      value={doc.location || ""}
                      onValueChange={(val) => handleFieldChange("location", val.warehouseName)}
                      placeholder="Omborni tanlang..."
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Yetkazib Beruvchi (Supplier)</Label>
                    <Input
                      value={doc.supplier || ""}
                      onChange={(e) => handleFieldChange("supplier", e.target.value)}
                      placeholder="Masalan: Antalis Central Asia"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Tola Yo&apos;nalishi (Grain Direction)</Label>
                    <ComboboxSelect
                      items={GRAIN_DIRECTION_OPTIONS}
                      value={doc.grainDirection || "Long Grain"}
                      onValueChange={(val) => handleFieldChange("grainDirection", val)}
                      placeholder="Yo'nalishni tanlang..."
                      className="w-full h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="p-3 rounded border border-border bg-card space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Partiya / Batch No</Label>
                    <Input
                      value={doc.batchNo || ""}
                      onChange={(e) => handleFieldChange("batchNo", e.target.value)}
                      placeholder="B-2026-001"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── 2. Tab: Stock Ledger (Movements - Logical 2nd) ───────────── */}
            <TabsContent value="ledger" className="flex-1 w-full h-full m-0 p-0 overflow-hidden relative">
              {itemMovements.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
                    <History className="size-6 text-muted-foreground/50" />
                  </div>
                  <div className="max-w-sm">
                    <h4 className="text-sm font-semibold text-foreground">
                      Kirim-chiqim operatsiyalari mavjud emas
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ushbu xomashyo bo&apos;yicha hali hech qanday kirim (Priyomka), chiqim yoki ichki ko&apos;chirish hujjati qayd etilmagan.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreateReceipt}
                    className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-none mt-1"
                  >
                    <ArrowDownToLine className="size-3.5" />
                    <span>Kirim rasmiylashtirish</span>
                  </Button>
                </div>
              ) : (
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
              )}
            </TabsContent>

            {/* ── 3. Tab: Work Order Consumption (Logical 3rd) ─────────────── */}
            <TabsContent value="consumption" className="flex-1 w-full h-full m-0 p-0 overflow-hidden relative">
              {linkedWorkOrders.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
                    <Factory className="size-6 text-muted-foreground/50" />
                  </div>
                  <div className="max-w-sm">
                    <h4 className="text-sm font-semibold text-foreground">
                      Ishlab chiqarish buyurtmalari bog&apos;lanmagan
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Hozirda hech qaysi faol buyurtma (Work Order) ushbu xomashyoni sarflayotgani yoki rezerv qilgani yo&apos;q.
                    </p>
                  </div>
                </div>
              ) : (
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
              )}
            </TabsContent>

            {/* ── 4. Tab: Derived Offcuts (For Parent Substrate) ───────────── */}
            {doc.category === "Paper & Board" && !doc.isOffcut && (
              <TabsContent value="offcuts" className="flex-1 w-full h-full m-0 p-4 overflow-y-auto">
                <div className="max-w-4xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Shu qog&apos;ozdan ({doc.sheetFormat || "Standart format"}) kesilgan Delovoy Otxodlar
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Gilotina kesimidan keyin omborga qayta kirim qilingan yaroqli qoldiqlar ro&apos;yxati
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
                        Ushbu formatdan hali delovoy otxodlar hosil qilinmagan
                      </p>
                      <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                        Ishlab chiqarishda qog&apos;oz kesilganda uning foydali qoldig&apos;ini Return Offcut dialogi orqali omborga qaytarishingiz mumkin.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {derivedOffcuts.map((off) => (
                        <div
                          key={off.sku}
                          className="p-3 rounded-lg border border-border bg-card space-y-2 hover:border-amber-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                                  {off.sku}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 bg-amber-500/10">
                                  Delovoy Otxod
                                </Badge>
                              </div>
                              <h4 className="text-xs font-semibold text-foreground mt-0.5">{off.name}</h4>
                            </div>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {off.stockLevel.toLocaleString()} {off.unit}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="size-3" />
                              {off.location || "Ombor"}
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

            {/* ── 5. Tab: Matching Jobs & Savings (For Offcut Record) ──────── */}
            {doc.isOffcut && offcutAreaStats && (
              <TabsContent value="savings" className="flex-1 w-full h-full m-0 p-4 overflow-y-auto">
                <div className="max-w-4xl space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                        Tejamkorlik hisoboti
                      </h3>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                        Kichik tirajlarda har bir varaqdan{" "}
                        <b>${offcutAreaStats.savedPerSheet} USD</b> (~{offcutAreaStats.savedPerSheetUzs.toLocaleString()} UZS) tejaladi.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-muted-foreground block">Jami tejam:</span>
                      <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        +${offcutAreaStats.totalSavedUsd.toLocaleString()} USD
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground block">
                        ~{offcutAreaStats.totalSavedUzs.toLocaleString()} UZS
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                      Ushbu {offcutAreaStats.cutFormat} o&apos;lchamga mos keluvchi tavsiya etilgan formatlar:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded border border-border bg-card space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>A4 Format (210×297)</span>
                          <Badge variant="outline" className="text-[10px]">2-up</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Bitta otxod varag&apos;iga 2 ta A4 bemalol joylashadi. Sertifikat, flayer va kichik blankalar uchun ideal.
                        </p>
                      </div>

                      <div className="p-3 rounded border border-border bg-card space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>A5 Buklet (148×210)</span>
                          <Badge variant="outline" className="text-[10px]">4-up</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Bitta varaqqa 4 ta A5 joylashadi. Reklama varaqalari va restoran menyulari uchun yangi qog&apos;oz kesish shart emas.
                        </p>
                      </div>

                      <div className="p-3 rounded border border-border bg-card space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Kiyim Yorliqlari / Birkalar</span>
                          <Badge variant="outline" className="text-[10px]">24-up</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          50×90mm o&apos;lchamdagi osma teglardan 20-24 ta sig&apos;adi. Qoldiqdan maksimal 94% foydali qoplama.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>

      <ReturnOffcutDialog open={isOffcutDialogOpen} onOpenChange={setIsOffcutDialogOpen} />
    </div>
  );
}
