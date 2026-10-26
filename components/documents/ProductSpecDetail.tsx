"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { 
  Save, 
  Check, 
  Layers, 
  Boxes, 
  Factory, 
  Plus, 
  Trash2, 
  Edit3,
  FileText,
  Sliders,
  DollarSign,
  Package,
  Cpu,
  Stamp,
  Sparkles,
  Disc,
  Ruler,
  Scissors,
  BookmarkCheck,
  Building2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Warehouse,
  AlertCircle,
  ChevronsUpDown,
  CheckCircle2,
  Lock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  DataEditor, 
  GridCell, 
  GridCellKind, 
  GridColumn, 
  Item, 
  GridColumnIcon, 
  EditableGridCell,
  GridSelection,
  CompactSelection
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "@/components/grid/DataGrid";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { 
  DocumentHeader, 
  DocumentSidebar, 
  SidebarSummaryCard, 
  InfoRow, 
  StatusBadge,
  HeaderIconAction,
  getCurrencySymbol,
  formatMoney 
} from "@/components/documents/common/DocumentShell";
import { cn } from "@/lib/utils";
import { getNextWorkOrderNo } from "@/components/documents/work-order/utils/workOrderNumbering";

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($) — AQSH Dollari", symbol: "$" },
  { value: "UZS", label: "UZS (so'm) — O'zbekiston So'mi", symbol: "so'm" },
  { value: "EUR", label: "EUR (€) — Yevro", symbol: "€" },
  { value: "RUB", label: "RUB (₽) — Rossiya Rubli", symbol: "₽" },
];

const CATEGORY_OPTIONS = [
  "Commercial Print",
  "Packaging",
  "Labels & Tags",
  "Publishing",
  "Stationery",
  "Textile & Garment"
];

const UNIT_OPTIONS = [
  "kg",
  "Sheets",
  "Rolls",
  "pcs",
  "1k pcs",
  "10k pcs",
  "meters",
  "sets",
  "spools",
  "m²"
];

const PRODUCT_UNIT_OPTIONS = [
  { value: "pcs", label: "pcs (dona)" },
  { value: "1k pcs", label: "1k pcs (1 000 dona)" },
  { value: "10k pcs", label: "10k pcs (10 000 dona)" },
  { value: "Sheets", label: "Sheets (varaq)" },
  { value: "Rolls", label: "Rolls (rulon)" },
  { value: "sets", label: "sets (to'plam)" },
  { value: "meters", label: "meters (metr)" },
  { value: "m²", label: "m² (kv. metr)" },
  { value: "kg", label: "kg (kilogramm)" },
  { value: "spools", label: "spools (bobina)" },
];

const STANDARD_PROCESS_STEPS = [
  "Pre-press & CTP Plate Imaging",
  "4-Color Sheetfed Offset Printing",
  "Rotary Flexo Printing",
  "Jacquard Loom Weaving",
  "Surface Lamination",
  "Spot UV Coating",
  "Die-cutting & Creasing",
  "Slitting & Rewinding",
  "Folder Gluer & Boxing",
  "QC Inspection & Packaging",
];

export function ProductSpecDetail({ tab }: { tab: DocumentTab }) {
  const { 
    setTabUnsaved, 
    closeTab, 
    setLevel3Tab, 
    theme, 
    upsertMasterSpecification, 
    upsertSpecificationAsync,
    deleteSpecificationAsync,
    replaceTabId,
    addNotification, 
    openTab,
    machines,
    warehouseStock,
    tariffs,
    fetchTariffs,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const data = tab.documentData || {};
  const dims = data.dimensions || {};
  const specs = data.techSpecs || {};

  const [dbItems, setDbItems] = useState<any[]>([]);

  // Real bazadagi xomashyo nomenklaturasini olish (/api/v1/master/items)
  useEffect(() => {
    let active = true;
    fetch("/api/v1/master/items?company=PRINTGOO")
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.data)) {
          setDbItems(json.data);
        }
      })
      .catch((err) => console.error("Error fetching master items:", err));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if ((!tariffs || tariffs.length === 0) && fetchTariffs) {
      fetchTariffs();
    }
  }, [tariffs, fetchTariffs]);

  const tariffOptions = useMemo(() => {
    return (tariffs || []).map((t) => ({
      value: t.id,
      label: `${t.code} — ${t.operationName} [${t.machineOrDept || t.category}] ($${t.rateUsd}/${t.unit})`,
    }));
  }, [tariffs]);

  // Ombor qoldig'i (Stock Balance) va Baza xomashyolarini birlashtirish
  const combinedStock = useMemo(() => {
    const list = [...(warehouseStock || [])];
    if (Array.isArray(dbItems) && dbItems.length > 0) {
      for (const item of dbItems) {
        const itemCode = item.code || item.id;
        const exists = list.some(
          (s) => s.sku === itemCode || s.name.toLowerCase() === item.name.toLowerCase()
        );
        if (!exists) {
          const minStockNum = Number(item.minStock) || 0;
          const costNum = Number(item.standardCost) || 0;
          const unitCode = typeof item.unit === "object" ? item.unit?.code || item.unit?.shortName || "pcs" : (item.unit || "pcs");
          list.push({
            sku: itemCode,
            name: item.name,
            category: (item.category as any) || "Paper & Board",
            grammage: item.properties?.densityGsm || undefined,
            sheetFormat: item.properties?.format || undefined,
            unit: unitCode,
            location: "Main Warehouse (Baza)",
            stockLevel: minStockNum > 0 ? minStockNum * 3 : 1000,
            reserved: 0,
            available: minStockNum > 0 ? minStockNum * 3 : 1000,
            reorder: minStockNum,
            unitPriceUsd: item.currency === "USD" ? costNum : Number((costNum / 12850).toFixed(2)),
            supplier: "Asosiy Ta'minotchi",
            status: "In Stock",
            lastReceived: "2026-10-01",
          });
        }
      }
    }
    return list;
  }, [warehouseStock, dbItems]);

  const stockCategories = useMemo(() => {
    const set = new Set<string>();
    combinedStock.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [combinedStock]);

  const realMachineNames = useMemo(() => {
    return (machines || []).map((m) => m.name);
  }, [machines]);

  const realStockMaterialNames = useMemo(() => {
    return combinedStock.map((s) => s.name);
  }, [combinedStock]);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1-bo'lim: Umumiy va Mahsulot parametrlari
  const [formData, setFormData] = useState({
    code: data.code || (tab.id && !tab.id.startsWith("new-") && !tab.id.startsWith("draft-") ? tab.id : ""),
    name: data.name || "",
    category: data.category || "Commercial Print",
    department: (data.department as "Offset" | "Flexo" | "Jacquard" | "Post-press") || "Offset",
    status: data.status || "Draft",
    version: data.version || "1.0",
    description: data.description || data.desc || "",
    basePrice: Number(data.basePrice) || 0,
    currency: data.currency || "USD",
    unit: data.unit || "1k pcs",
    
    // 4-bo'lim: Texnik Spetsifikatsiya & Geometriya (Barcha texnologiyalar uchun)
    width: Number(dims.width ?? data.width) || 0,
    height: Number(dims.height ?? data.height) || 0,
    depth: Number(dims.depth ?? data.depth) || 0,
    dimensionUnit: dims.dimensionUnit || data.dimensionUnit || "mm",
    baseMaterial: data.baseMaterial || specs.baseMaterial || "",
    
    // Ofset Parametrlari
    sheetFormat: specs.sheetFormat || data.sheetFormat || "",
    grammage: Number(specs.grammage ?? data.grammage) || 0,
    colorsConfig: specs.colorsConfig || data.colorsConfig || "",
    lamination: specs.lamination || data.lamination || "",
    coating: specs.coating || data.coating || "",
    kashirovkaMode: specs.kashirovkaMode || data.kashirovkaMode || "none",
    toolingCode: specs.toolingCode || data.toolingCode || "",
    boxType: specs.boxType || data.boxType || "none",

    // Flekso Parametrlari (Flexo Narrow-Web)
    flexoWebWidth: Number(specs.flexoWebWidth ?? data.flexoWebWidth) || 0,
    flexoGearTeeth: Number(specs.flexoGearTeeth ?? data.flexoGearTeeth) || 0,
    flexoCoreDiameter: specs.flexoCoreDiameter || data.flexoCoreDiameter || "",
    flexoWindingDirection: Number(specs.flexoWindingDirection ?? data.flexoWindingDirection) || 1,
    flexoLabelsPerRoll: Number(specs.flexoLabelsPerRoll ?? data.flexoLabelsPerRoll) || 0,
    flexoPlateThickness: specs.flexoPlateThickness || data.flexoPlateThickness || "",
    flexoWashResistance: specs.flexoWashResistance || data.flexoWashResistance || "",

    // Jakkard Parametrlari (Jacquard Loom Woven)
    jacquardWeaveQuality: specs.jacquardWeaveQuality || data.jacquardWeaveQuality || "",
    jacquardWarpYarn: specs.jacquardWarpYarn || data.jacquardWarpYarn || "",
    jacquardWeftYarn: specs.jacquardWeftYarn || data.jacquardWeftYarn || "",
    jacquardPicksPerCm: Number(specs.jacquardPicksPerCm ?? data.jacquardPicksPerCm) || 0,
    jacquardFoldType: specs.jacquardFoldType || data.jacquardFoldType || "none",
    jacquardSewingAllowance: Number(specs.jacquardSewingAllowance ?? data.jacquardSewingAllowance) || 0,
  });

  // Flekso silindr aylanasi / Takrorlanish uzunligi (Repeat Length mm = Z * 3.175)
  const flexoRepeatLengthMm = useMemo(() => {
    return Number(((formData.flexoGearTeeth || 0) * 3.175).toFixed(2));
  }, [formData.flexoGearTeeth]);

  // 2-bo'lim: BOM Materiallar (Baza ma'lumotlari yoki toza bo'sh ro'yxat)
  const [materials, setMaterials] = useState(() => {
    if (Array.isArray(data.materials) && data.materials.length > 0) {
      return data.materials.map((m: any, idx: number) => ({
        id: String(m.id || idx + 1),
        name: m.name || "",
        spec: m.spec || "",
        quantity: Number(m.quantity ?? m.actualQty ?? m.planQty ?? m.qty ?? 1),
        unit: m.unit || "kg",
        unitPrice: Number(m.unitPrice) || 0,
        wastePercent: Number(m.wastePercent) || 0,
      }));
    }
    return [];
  });

  // 3-bo'lim: Routing Marshrut operatsiyalari (Baza ma'lumotlari yoki toza bo'sh ro'yxat)
  const [operations, setOperations] = useState(() => {
    if (Array.isArray(data.operations) && data.operations.length > 0) {
      return data.operations.map((op: any, idx: number) => ({
        id: String(op.id || idx + 1),
        step: (idx + 1) * 10,
        name: op.name || "",
        machineStr: op.machineStr || op.machine || "",
        durationHours: Number(op.durationHours || op.duration || 1.0),
        operator: op.operator || "",
        tariffId: op.tariffId,
        tariffCode: op.tariffCode,
        rateUsd: op.rateUsd,
        setupFeeUsd: op.setupFeeUsd,
        pieceworkRateUsd: op.pieceworkRateUsd,
        calcUnit: op.calcUnit,
        unitDivisor: op.unitDivisor,
      }));
    }
    return [];
  });

  // Selections
  const [matSelection, setMatSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [opSelection, setOpSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Dialog states
  const [isMatDialogOpen, setIsMatDialogOpen] = useState(false);
  const [editingMatIndex, setEditingMatIndex] = useState<number | null>(null);
  const [isMatSelectOpen, setIsMatSelectOpen] = useState(false);
  const [matDialogForm, setMatDialogForm] = useState({
    name: "",
    spec: "",
    quantity: 1,
    unit: "pcs",
    unitPrice: 0,
    wastePercent: 0,
  });

  const selectedStockItem = useMemo(() => {
    if (!matDialogForm.name) return null;
    const q = matDialogForm.name.toLowerCase().trim();
    return combinedStock.find(
      (s) => s.name.toLowerCase().trim() === q || s.sku.toLowerCase().trim() === q
    ) || null;
  }, [matDialogForm.name, combinedStock]);

  const handleSelectStockMaterial = (stock: any) => {
    const formattedSpec = stock.sheetFormat 
      ? `${stock.sheetFormat} mm${stock.grammage ? `, ${stock.grammage} g/m²` : ""}`
      : (stock.grammage ? `${stock.grammage} g/m²` : stock.spec || "");

    let price = Number(stock.unitPriceUsd ?? stock.unitPrice ?? stock.standardCost) || 0;
    if (formData.currency === "UZS" && price < 100) {
      price = Math.round(price * 12850);
    } else if (formData.currency === "USD" && price > 1000) {
      price = Number((price / 12850).toFixed(3));
    }

    setMatDialogForm((prev) => ({
      ...prev,
      name: stock.name,
      spec: formattedSpec || prev.spec,
      unit: stock.unit?.code || stock.unit || prev.unit,
      unitPrice: price > 0 ? price : prev.unitPrice,
    }));
  };

  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [editingOpIndex, setEditingOpIndex] = useState<number | null>(null);
  const [opDialogForm, setOpDialogForm] = useState({
    name: "",
    machineStr: "",
    durationHours: 1.0,
    operator: "",
    tariffId: undefined as string | undefined,
    tariffCode: undefined as string | undefined,
    rateUsd: 0,
    setupFeeUsd: 0,
    pieceworkRateUsd: 0,
    calcUnit: "1,000 sheets",
    unitDivisor: 1000,
  });

  const activeTab = tab.activeLevel3Tab || "overview";

  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleDepartmentChange = (dept: "Offset" | "Flexo" | "Jacquard" | "Post-press") => {
    setFormData((prev) => ({
      ...prev,
      department: dept,
      category: dept === "Flexo" || dept === "Jacquard" ? "Labels & Tags" : prev.category,
    }));
    setTabUnsaved(tab.id, true);
  };

  // Hisoblangan moddiy tannarx
  const totalMaterialCost = useMemo(() => {
    return materials.reduce((acc: number, m: any) => {
      const q = Number(m.quantity) || 0;
      const p = Number(m.unitPrice) || 0;
      return acc + (q * p);
    }, 0);
  }, [materials]);

  const totalRoutingHours = useMemo(() => {
    return operations.reduce((acc: number, op: any) => acc + (Number(op.durationHours) || 0), 0);
  }, [operations]);

  const isOffset = formData.department === "Offset";
  const isFlexo = formData.department === "Flexo";
  const isJacquard = formData.department === "Jacquard";
  const isPostPress = formData.department === "Post-press";
  const isDraft = !formData.code || tab.id.startsWith("draft-") || tab.id.startsWith("new-") || formData.code.startsWith("SPEC-NEW-");

  const persistSpecification = async () => {
    setIsSaving(true);
    try {
      const payload = {
        id: (data.id && !String(data.id).startsWith("SPEC-00") && !String(data.id).startsWith("SPEC-NEW-") && !String(data.id).startsWith("new-"))
          ? data.id
          : undefined,
        code: formData.code,
        name: formData.name,
        category: formData.category,
        department: formData.department,
        status: formData.status,
        version: formData.version,
        basePrice: formData.basePrice,
        currency: formData.currency,
        unit: formData.unit,
        description: formData.description,
        baseMaterial: formData.baseMaterial,
        width: formData.width,
        height: formData.height,
        depth: formData.depth,
        dimensionUnit: formData.dimensionUnit,
        sheetFormat: formData.sheetFormat,
        grammage: formData.grammage,
        colorsConfig: formData.colorsConfig,
        lamination: formData.lamination,
        coating: formData.coating,
        kashirovkaMode: formData.kashirovkaMode,
        toolingCode: formData.toolingCode,
        boxType: formData.boxType,
        flexoWebWidth: formData.flexoWebWidth,
        flexoGearTeeth: formData.flexoGearTeeth,
        flexoCoreDiameter: formData.flexoCoreDiameter,
        flexoWindingDirection: formData.flexoWindingDirection,
        flexoLabelsPerRoll: formData.flexoLabelsPerRoll,
        flexoPlateThickness: formData.flexoPlateThickness,
        flexoWashResistance: formData.flexoWashResistance,
        jacquardWeaveQuality: formData.jacquardWeaveQuality,
        jacquardWarpYarn: formData.jacquardWarpYarn,
        jacquardWeftYarn: formData.jacquardWeftYarn,
        jacquardPicksPerCm: formData.jacquardPicksPerCm,
        jacquardFoldType: formData.jacquardFoldType,
        jacquardSewingAllowance: formData.jacquardSewingAllowance,
        estimatedCost: formatMoney(totalMaterialCost, formData.currency),
        materials: materials.map((m: any) => ({
          id: m.id,
          name: m.name,
          spec: m.spec,
          quantity: m.quantity,
          unit: m.unit,
          unitPrice: m.unitPrice,
          wastePercent: m.wastePercent,
        })),
        operations: operations.map((op: any) => ({
          id: op.id,
          name: op.name,
          machineStr: op.machineStr,
          durationHours: op.durationHours,
          operator: op.operator,
        })),
      };

      const saved = await upsertSpecificationAsync(payload);
      if (saved) {
        const assignedCode = saved.code || formData.code;
        setFormData((prev) => ({ ...prev, code: assignedCode }));
        setTabUnsaved(tab.id, false);
        if (isDraft || tab.id !== assignedCode) {
          replaceTabId(tab.id, assignedCode, `${assignedCode}: ${formData.name || "Shablon"}`, saved);
        }
        addNotification({
          title: "Bazada saqlandi",
          description: `${assignedCode}: ${formData.name} muvaffaqiyatli PostgreSQL bazasiga yozildi`,
          severity: "success",
        });
      } else {
        addNotification({
          title: "Xatolik",
          description: "Shablonni bazaga saqlashda xatolik yuz berdi",
          severity: "error",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSpecification = async () => {
    setIsDeleting(true);
    try {
      const targetId = data.id || formData.code;
      const success = await deleteSpecificationAsync(targetId);
      if (success) {
        addNotification({
          title: "O'chirildi",
          description: `${formData.code} bazadan butunlay o'chirildi`,
          severity: "info",
        });
        closeTab(tab.id);
      } else {
        addNotification({
          title: "Xatolik",
          description: "Shablonni o'chirishda xatolik yuz berdi",
          severity: "error",
        });
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCreateWorkOrderFromSpec = () => {
    const newWoId = `draft-wo-${Date.now()}`;
    openTab({
      id: newWoId,
      title: `${newWoId} (${formData.name.slice(0, 16)}...)`,
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        id: newWoId,
        docNo: "",
        product: formData.name,
        recipe: formData.code,
        department: formData.department,
        quantity: 0,
        unit: formData.unit || "pcs",
        status: "Draft",
        priority: "Normal",
        paperStock: formData.baseMaterial,
        width: formData.width,
        height: formData.height,
        dimensionUnit: formData.dimensionUnit,
        lamination: formData.lamination,
        coating: formData.coating,
        colorsConfig: formData.colorsConfig,
        priceTotal: formData.basePrice,
        currency: formData.currency || "USD",
        materials: materials,
        operations: operations.map((op: any, idx: number) => ({
          id: String(idx + 1),
          stepNumber: (idx + 1) * 10,
          name: op.name,
          machine: op.machineStr,
          operator: op.operator,
          duration: op.durationHours,
          qtyCompleted: "0",
          status: "Queued",
          tariffId: op.tariffId,
          tariffCode: op.tariffCode,
          calcUnit: op.calcUnit,
          unitDivisor: op.unitDivisor,
          rateUsd: op.rateUsd,
          setupFeeUsd: op.setupFeeUsd,
          pieceworkRateUsd: op.pieceworkRateUsd,
          plannedCostUsd: op.rateUsd ? Number(((op.setupFeeUsd || 0) + (1000 / (op.unitDivisor || 1000)) * op.rateUsd).toFixed(2)) : 0,
          pieceworkTotalUsd: op.pieceworkRateUsd ? Number(((1000 / (op.unitDivisor || 1000)) * op.pieceworkRateUsd).toFixed(2)) : 0,
        })),
      },
    });
    addNotification({
      title: "Yangi Ish buyrug'i yaratildi",
      description: `${newWoId} spetsifikatsiya (${formData.code}) asosida ochildi`,
      severity: "info",
    });
  };

  // --- Material Dialog Handlers ---
  const handleOpenAddMaterial = () => {
    setEditingMatIndex(null);
    const firstStock = combinedStock[0];
    if (firstStock) {
      const formattedSpec = firstStock.sheetFormat 
        ? `${firstStock.sheetFormat} mm${firstStock.grammage ? `, ${firstStock.grammage} g/m²` : ""}`
        : (firstStock.grammage ? `${firstStock.grammage} g/m²` : "");

      let price = Number(firstStock.unitPriceUsd ?? (firstStock as any).unitPrice ?? (firstStock as any).standardCost) || 0;
      if (formData.currency === "UZS" && price < 100) {
        price = Math.round(price * 12850);
      } else if (formData.currency === "USD" && price > 1000) {
        price = Number((price / 12850).toFixed(3));
      }

      setMatDialogForm({
        name: firstStock.name,
        spec: formattedSpec,
        quantity: 1,
        unit: (typeof firstStock.unit === "object" ? (firstStock.unit as any)?.code : firstStock.unit) || "kg",
        unitPrice: price,
        wastePercent: 0,
      });
    } else {
      setMatDialogForm({
        name: "",
        spec: "",
        quantity: 1,
        unit: "pcs",
        unitPrice: 0,
        wastePercent: 0,
      });
    }
    setIsMatDialogOpen(true);
  };

  const handleOpenEditMaterial = (index: number) => {
    const item = materials[index];
    if (!item) return;
    setEditingMatIndex(index);
    setMatDialogForm({
      name: item.name,
      spec: item.spec || "",
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice || 0,
      wastePercent: item.wastePercent || 0,
    });
    setIsMatDialogOpen(true);
  };

  const handleSaveMaterialDialog = () => {
    if (editingMatIndex !== null) {
      const updated = [...materials];
      updated[editingMatIndex] = {
        ...updated[editingMatIndex],
        ...matDialogForm,
        quantity: Number(matDialogForm.quantity) || 1,
        unitPrice: Number(matDialogForm.unitPrice) || 0,
        wastePercent: Number(matDialogForm.wastePercent) || 0,
      };
      setMaterials(updated);
    } else {
      setMaterials([
        ...materials,
        {
          id: String(Date.now()),
          ...matDialogForm,
          quantity: Number(matDialogForm.quantity) || 1,
          unitPrice: Number(matDialogForm.unitPrice) || 0,
          wastePercent: Number(matDialogForm.wastePercent) || 0,
        },
      ]);
    }
    setTabUnsaved(tab.id, true);
    setIsMatDialogOpen(false);
  };

  const handleDeleteSelectedMaterial = () => {
    const selectedRows = matSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = materials.filter((_: any, idx: number) => !selectedRows.includes(idx));
    setMaterials(remaining);
    setMatSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // --- Route Dialog Handlers ---
  const handleSelectTariffInBOM = (tariffId: string) => {
    const selected = tariffs.find((t) => t.id === tariffId);
    if (!selected) {
      setOpDialogForm((p) => ({ ...p, tariffId: undefined, tariffCode: undefined }));
      return;
    }
    setOpDialogForm((p) => ({
      ...p,
      tariffId: selected.id,
      tariffCode: selected.code,
      name: selected.operationName,
      machineStr: selected.machineOrDept || p.machineStr,
      rateUsd: selected.rateUsd,
      setupFeeUsd: selected.setupFeeUsd,
      pieceworkRateUsd: selected.pieceworkRateUsd,
      calcUnit: selected.unit,
      unitDivisor: selected.unitDivisor,
    }));
  };

  const handleOpenAddOperation = () => {
    setEditingOpIndex(null);
    setOpDialogForm({
      name: STANDARD_PROCESS_STEPS[0] || "",
      machineStr: realMachineNames[0] || "",
      durationHours: 1.0,
      operator: "",
      tariffId: undefined,
      tariffCode: undefined,
      rateUsd: 0,
      setupFeeUsd: 0,
      pieceworkRateUsd: 0,
      calcUnit: "1,000 sheets",
      unitDivisor: 1000,
    });
    setIsOpDialogOpen(true);
  };

  const handleOpenEditOperation = (index: number) => {
    const item = operations[index];
    if (!item) return;
    setEditingOpIndex(index);
    setOpDialogForm({
      name: item.name,
      machineStr: item.machineStr,
      durationHours: item.durationHours || 1.0,
      operator: item.operator || "",
      tariffId: item.tariffId,
      tariffCode: item.tariffCode,
      rateUsd: item.rateUsd || 0,
      setupFeeUsd: item.setupFeeUsd || 0,
      pieceworkRateUsd: item.pieceworkRateUsd || 0,
      calcUnit: item.calcUnit || "1,000 sheets",
      unitDivisor: item.unitDivisor || 1000,
    });
    setIsOpDialogOpen(true);
  };

  const handleSaveOperationDialog = () => {
    if (editingOpIndex !== null) {
      const updated = [...operations];
      updated[editingOpIndex] = {
        ...updated[editingOpIndex],
        ...opDialogForm,
        durationHours: Number(opDialogForm.durationHours) || 1.0,
      };
      setOperations(updated);
    } else {
      setOperations([
        ...operations,
        {
          id: String(Date.now()),
          step: (operations.length + 1) * 10,
          ...opDialogForm,
          durationHours: Number(opDialogForm.durationHours) || 1.0,
        },
      ]);
    }
    setTabUnsaved(tab.id, true);
    setIsOpDialogOpen(false);
  };

  const handleDeleteSelectedOperation = () => {
    const selectedRows = opSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = operations.filter((_: any, idx: number) => !selectedRows.includes(idx));
    setOperations(remaining);
    setOpSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // --- Grid Configurations ---
  const currSymbol = getCurrencySymbol(formData.currency);

  const matColumns = useMemo<GridColumn[]>(() => [
    { id: "index", title: "#", width: 45, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Xomashyo / Material", width: 280, icon: GridColumnIcon.HeaderString },
    { id: "spec", title: "Spetsifikatsiya / Xususiyat", width: 220, icon: GridColumnIcon.HeaderTextTemplate },
    { id: "quantity", title: "Sarf Normasi", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "unit", title: "Birlik", width: 85, icon: GridColumnIcon.HeaderString },
    { id: "wastePercent", title: "Chiqindi %", width: 95, icon: GridColumnIcon.HeaderNumber },
    { id: "unitPrice", title: `Birlik Narxi (${currSymbol})`, width: 125, icon: GridColumnIcon.HeaderNumber },
    { id: "totalPrice", title: `Jami Qiymat (${currSymbol})`, width: 125, icon: GridColumnIcon.HeaderNumber },
  ], [currSymbol]);

  const getMatCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const mat = materials[row];
    if (!mat) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    const q = Number(mat.quantity) || 0;
    const p = Number(mat.unitPrice) || 0;
    const total = q * p;

    if (col === 0) return { kind: GridCellKind.Number, data: row + 1, displayData: String(row + 1), allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: mat.name, displayData: mat.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Text, data: mat.spec || "—", displayData: mat.spec || "—", allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Number, data: q, displayData: q.toLocaleString(), allowOverlay: true };
    if (col === 4) return { kind: GridCellKind.Text, data: mat.unit, displayData: mat.unit, allowOverlay: true };
    if (col === 5) return { kind: GridCellKind.Number, data: mat.wastePercent || 0, displayData: `+${mat.wastePercent || 0}%`, allowOverlay: true };
    if (col === 6) return { kind: GridCellKind.Number, data: p, displayData: formatMoney(p, formData.currency), allowOverlay: true };
    if (col === 7) return { kind: GridCellKind.Number, data: total, displayData: formatMoney(total, formData.currency), allowOverlay: false };
    
    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [materials, formData.currency]);

  const onMatCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const newMats = [...materials];
    if (col === 1 && newValue.kind === GridCellKind.Text) {
      newMats[row].name = newValue.data.toString();
    } else if (col === 2 && newValue.kind === GridCellKind.Text) {
      newMats[row].spec = newValue.data.toString();
    } else if (col === 3 && newValue.kind === GridCellKind.Number) {
      newMats[row].quantity = Number(newValue.data);
    } else if (col === 4 && newValue.kind === GridCellKind.Text) {
      newMats[row].unit = newValue.data.toString();
    } else if (col === 5 && newValue.kind === GridCellKind.Number) {
      newMats[row].wastePercent = Number(newValue.data);
    } else if (col === 6 && newValue.kind === GridCellKind.Number) {
      newMats[row].unitPrice = Number(newValue.data);
    }
    setMaterials(newMats);
    setTabUnsaved(tab.id, true);
  }, [materials, tab.id, setTabUnsaved]);

  const opColumns = useMemo<GridColumn[]>(() => [
    { id: "step", title: "Bosqich", width: 75, icon: GridColumnIcon.HeaderNumber },
    { id: "tariffCode", title: "Tarif", width: 105, icon: GridColumnIcon.HeaderString },
    { id: "name", title: "Operatsiya Tavsifi", width: 300, icon: GridColumnIcon.HeaderString },
    { id: "machineStr", title: "Biriktirilgan Uskuna / Stanok", width: 240, icon: GridColumnIcon.HeaderLookup },
    { id: "rate", title: "Stavka", width: 125, icon: GridColumnIcon.HeaderNumber },
    { id: "durationHours", title: "Vaqt Normasi (soat)", width: 130, icon: GridColumnIcon.HeaderNumber },
    { id: "operator", title: "Mas'ul / Malaka", width: 160, icon: GridColumnIcon.HeaderString },
  ], []);

  const getOpCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const op = operations[row];
    if (!op) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: op.step || (row + 1) * 10, displayData: String(op.step || (row + 1) * 10), allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: op.tariffCode || "—", displayData: op.tariffCode || "—", allowOverlay: false };
    if (col === 2) return { kind: GridCellKind.Text, data: op.name, displayData: op.name, allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Text, data: op.machineStr, displayData: op.machineStr, allowOverlay: true };
    if (col === 4) {
      const rateText = op.rateUsd ? `$${op.rateUsd}/${op.calcUnit || "unit"}` : "—";
      return { kind: GridCellKind.Text, data: rateText, displayData: rateText, allowOverlay: false };
    }
    if (col === 5) return { kind: GridCellKind.Number, data: op.durationHours || 1, displayData: `${op.durationHours || 1} soat`, allowOverlay: true };
    if (col === 6) return { kind: GridCellKind.Text, data: op.operator || "—", displayData: op.operator || "—", allowOverlay: true };
    
    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [operations]);

  const onOpCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const newOps = [...operations];
    if (col === 2 && newValue.kind === GridCellKind.Text) {
      newOps[row].name = newValue.data.toString();
    } else if (col === 3 && newValue.kind === GridCellKind.Text) {
      newOps[row].machineStr = newValue.data.toString();
    } else if (col === 5 && newValue.kind === GridCellKind.Number) {
      newOps[row].durationHours = Number(newValue.data);
    } else if (col === 6 && newValue.kind === GridCellKind.Text) {
      newOps[row].operator = newValue.data.toString();
    }
    setOperations(newOps);
    setTabUnsaved(tab.id, true);
  }, [operations, tab.id, setTabUnsaved]);

  const selectedMatRow = matSelection.rows.toArray()[0];
  const hasSelectedMat = selectedMatRow !== undefined && materials[selectedMatRow] !== undefined;

  const selectedOpRow = opSelection.rows.toArray()[0];
  const hasSelectedOp = selectedOpRow !== undefined && operations[selectedOpRow] !== undefined;

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden text-xs">
      {/* 1. Yuqori hujjat Header boshqaruvi */}
      <DocumentHeader
        icon={Layers}
        docNo={isDraft ? "Yangi (Avtomatik)" : (formData.code || "Yangi")}
        title={formData.name || "(Nomsiz Shablon)"}
        status={formData.status}
        priority={formData.department}
        actions={
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-background/80 border border-border/80 rounded px-1.5 h-7">
              <span className="text-[11px] font-medium text-muted-foreground">Valyuta:</span>
              <Select
                value={formData.currency || "USD"}
                onValueChange={(val: string) => val && handleFieldChange("currency", val)}
              >
                <SelectTrigger className="h-5 text-xs font-mono font-semibold px-1 py-0 border-0 bg-transparent shadow-none focus:ring-0 w-[85px] cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreateWorkOrderFromSpec}
              className="h-7 text-xs gap-1.5 font-medium border-primary/40 text-primary hover:bg-primary/10 cursor-pointer shrink-0"
              title="Shu texkarta asosida yangi ishlab chiqarish buyrug'i yaratish"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ish Buyrug'i ochish</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isSaving || isDeleting}
              className="h-7 px-2.5 text-xs gap-1.5 font-medium border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
              title="Shablonni bazadan butunlay o'chirish"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>O'chirish</span>
            </Button>

            <Button 
              onClick={persistSpecification} 
              disabled={isSaving || isDeleting}
              size="sm" 
              className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none rounded cursor-pointer shrink-0"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? "Saqlanmoqda..." : "Saqlash"}</span>
            </Button>
          </div>
        }
      />

      {/* 2. Vertikal Sidebar va Asosiy Oyna (WorkOrderDetail arxitekturasi) */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
        <DocumentSidebar
          sectionsLabel="Spetsifikatsiya Bo'limlari"
          activeId={activeTab}
          onSelect={(id) => setLevel3Tab(tab.id, id)}
          summary={
            <SidebarSummaryCard
              icon={Layers}
              title={formData.name || "(Nomsiz Shablon)"}
              subtitle={`${formData.code || "Kodsiz"} • ${formData.category}`}
            >
              <InfoRow label="Sex / Texnologiya">
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-medium text-primary">
                  {formData.department}
                </Badge>
              </InfoRow>

              <InfoRow label="Valyuta">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                  {formData.currency || "USD"} ({getCurrencySymbol(formData.currency)})
                </Badge>
              </InfoRow>

              <InfoRow label="Bazaviy narx">
                <span className="font-mono font-bold text-foreground">
                  {formatMoney(formData.basePrice, formData.currency)} / {formData.unit || "1k"}
                </span>
              </InfoRow>

              <InfoRow label="Moddiy tannarx">
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(totalMaterialCost, formData.currency)}
                </span>
              </InfoRow>

              <InfoRow label="BOM moddalari">
                <span className="font-mono text-muted-foreground">
                  {materials.length} xil xomashyo
                </span>
              </InfoRow>

              <InfoRow label="Marshrut vaqti">
                <span className="font-mono text-muted-foreground">
                  {totalRoutingHours} soat
                </span>
              </InfoRow>

              <InfoRow label="Holati">
                <StatusBadge status={formData.status} />
              </InfoRow>
            </SidebarSummaryCard>
          }
          items={[
            { id: "overview", label: "Umumiy & Mahsulot", icon: FileText },
            { 
              id: "materials", 
              label: "BOM (Xomashyo & Sarf)", 
              icon: Boxes, 
              badge: materials.length > 0 ? materials.length : undefined 
            },
            { 
              id: "operations", 
              label: "Marshrut (Routing)", 
              icon: Factory, 
              badge: operations.length > 0 ? operations.length : undefined 
            },
            { 
              id: "specs", 
              label: "Texnik Spetsifikatsiya", 
              icon: Sliders,
              badge: isFlexo 
                ? (formData.flexoWebWidth ? `${formData.flexoWebWidth}mm` : undefined) 
                : (formData.width && formData.height ? `${formData.width}×${formData.height}` : undefined)
            },
          ]}
        />

        {/* ─── O'NG TOMONDAGI ASOSIY VIEWPORT ─── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
          {/* ─── 1-BO'LIM: UMUMIY & MAHSULOT ─── */}
          {activeTab === "overview" && (
            <div className="flex-1 overflow-y-auto p-4 m-0 space-y-4 max-w-4xl">
              <div className="p-4 bg-card border border-border rounded-lg space-y-4 shadow-2xs">
                <div className="font-semibold text-foreground flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Mahsulot Pasporti va Boshlang'ich Ma'lumotlar</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {formData.department} Texnologiyasi
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Shablon / Texkarta Kodi</label>
                    <Input 
                      value={formData.code} 
                      onChange={(e) => handleFieldChange("code", e.target.value)} 
                      className="h-8 text-xs font-mono font-semibold" 
                      placeholder="masalan, SPEC-001"
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Texnologiya / Bo'lim</label>
                    <Select 
                      value={formData.department} 
                      onValueChange={(val: any) => handleDepartmentChange(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-primary/5 font-semibold text-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Offset">Ofset Bosma (Offset Sheetfed)</SelectItem>
                        <SelectItem value="Flexo">Fleksografiya (Flexo Narrow-Web)</SelectItem>
                        <SelectItem value="Jacquard">Jakkard To'quv (Jacquard Loom)</SelectItem>
                        <SelectItem value="Post-press">Qadoq & Bichiq (Post-press)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Holati (Status)</label>
                    <Select value={formData.status} onValueChange={(val) => handleFieldChange("status", val)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Faol (Active)</SelectItem>
                        <SelectItem value="Draft">Qoralama (Draft)</SelectItem>
                        <SelectItem value="Obsolete">Eskirgan (Obsolete)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-muted-foreground font-medium block mb-1">Mahsulot / Shablon Nomi</label>
                    <Input 
                      value={formData.name} 
                      onChange={(e) => handleFieldChange("name", e.target.value)} 
                      className="h-8 text-xs font-semibold" 
                      placeholder="Mahsulot yoki shablon nomini kiriting..."
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Mahsulot Kategoriyasi</label>
                    <Select value={formData.category} onValueChange={(val) => handleFieldChange("category", val)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">
                      Bazaviy Sotish Narxi ({getCurrencySymbol(formData.currency)})
                    </label>
                    <div className="relative">
                      <MoneyInput
                        thousandSeparator=" "
                        decimalScale={formData.currency === "UZS" ? 0 : 2}
                        value={formData.basePrice} 
                        onValueChange={(values) => handleFieldChange("basePrice", values.floatValue ?? 0)} 
                        className="h-8 text-xs font-mono font-semibold pr-10" 
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground pointer-events-none">
                        {getCurrencySymbol(formData.currency)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Valyuta</label>
                    <Select 
                      value={formData.currency || "USD"} 
                      onValueChange={(val: string) => val && handleFieldChange("currency", val)}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono font-semibold bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">O'lchov Birligi</label>
                    <FieldCombobox
                      value={formData.unit}
                      onChange={(val) => handleFieldChange("unit", val)}
                      options={PRODUCT_UNIT_OPTIONS}
                      allowCustom={true}
                      placeholder="Birlik tanlang yoki yozing..."
                      searchPlaceholder="Birlik qidirish..."
                      className="h-8 text-xs font-mono bg-background"
                      popoverClassName="w-[240px]"
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Versiya</label>
                    <Input 
                      value={formData.version} 
                      onChange={(e) => handleFieldChange("version", e.target.value)} 
                      className="h-8 text-xs font-mono" 
                      placeholder="v1.0"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="text-muted-foreground font-medium block mb-1">Texnologik Tavsif va Qisqacha Izoh</label>
                    <Input 
                      value={formData.description} 
                      onChange={(e) => handleFieldChange("description", e.target.value)} 
                      className="h-8 text-xs" 
                      placeholder="Texnologik karta tavsifi..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── 2-BO'LIM: BOM MATERIALAR (XOMASHYO & SARF NORMALARI) ─── */}
          {activeTab === "materials" && (
            <div className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background">
              <div className="h-8 border-b border-border bg-card px-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    onClick={handleOpenAddMaterial}
                    size="sm"
                    className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Material Qo'shish</span>
                  </Button>
                  {hasSelectedMat && (
                    <>
                      <Button
                        onClick={() => handleOpenEditMaterial(selectedMatRow)}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs gap-1 font-medium cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Tahrirlash</span>
                      </Button>
                      <Button
                        onClick={handleDeleteSelectedMaterial}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs gap-1 font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>O'chirish</span>
                      </Button>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Jami Xomashyo Tannarxi: <strong className="text-foreground">{formatMoney(totalMaterialCost, formData.currency)}</strong>
                </div>
              </div>

              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div 
                    className="flex-1 w-full h-full relative" 
                    id="glide-spec-materials-root"
                    onKeyDown={(e) => {
                      if (e.key === "Insert") {
                        e.preventDefault();
                        handleOpenAddMaterial();
                      } else if (e.key === "Delete" && hasSelectedMat) {
                        e.preventDefault();
                        handleDeleteSelectedMaterial();
                      }
                    }}
                  >
                    <DataEditor
                      getCellContent={getMatCellContent}
                      columns={matColumns}
                      rows={materials.length}
                      onCellEdited={onMatCellEdited}
                      gridSelection={matSelection}
                      onGridSelectionChange={setMatSelection}
                      onCellContextMenu={(cell) => {
                        const [, row] = cell;
                        setMatSelection({
                          columns: CompactSelection.empty(),
                          rows: CompactSelection.fromSingleSelection(row),
                        });
                      }}
                      onCellActivated={(cell) => {
                        const [, row] = cell;
                        handleOpenEditMaterial(row);
                      }}
                      rowMarkers="both"
                      width="100%"
                      height="100%"
                      headerHeight={28}
                      rowHeight={32}
                      theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                    />
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56 text-xs">
                  <ContextMenuItem onClick={handleOpenAddMaterial} className="gap-2 cursor-pointer">
                    <Plus className="w-3.5 h-3.5 text-blue-500" />
                    <span>Material qo'shish</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
                  </ContextMenuItem>
                  {hasSelectedMat && (
                    <>
                      <ContextMenuItem onClick={() => handleOpenEditMaterial(selectedMatRow)} className="gap-2 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Tahrirlash</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={handleDeleteSelectedMaterial} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>O'chirish</span>
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            </div>
          )}

          {/* ─── 3-BO'LIM: MARSHRUT (TEXNOLOGIK BOSQICHLAR) ─── */}
          {activeTab === "operations" && (
            <div className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background">
              <div className="h-8 border-b border-border bg-card px-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    onClick={handleOpenAddOperation}
                    size="sm"
                    className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Bosqich Qo'shish</span>
                  </Button>
                  {hasSelectedOp && (
                    <>
                      <Button
                        onClick={() => handleOpenEditOperation(selectedOpRow)}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs gap-1 font-medium cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Tahrirlash</span>
                      </Button>
                      <Button
                        onClick={handleDeleteSelectedOperation}
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-2 text-xs gap-1 font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>O'chirish</span>
                      </Button>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Jami Ishlov Vaqti: <strong className="text-foreground">{totalRoutingHours} soat</strong>
                </div>
              </div>

              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div 
                    className="flex-1 w-full h-full relative" 
                    id="glide-spec-routes-root"
                    onKeyDown={(e) => {
                      if (e.key === "Insert") {
                        e.preventDefault();
                        handleOpenAddOperation();
                      } else if (e.key === "Delete" && hasSelectedOp) {
                        e.preventDefault();
                        handleDeleteSelectedOperation();
                      }
                    }}
                  >
                    <DataEditor
                      getCellContent={getOpCellContent}
                      columns={opColumns}
                      rows={operations.length}
                      onCellEdited={onOpCellEdited}
                      gridSelection={opSelection}
                      onGridSelectionChange={setOpSelection}
                      onCellContextMenu={(cell) => {
                        const [, row] = cell;
                        setOpSelection({
                          columns: CompactSelection.empty(),
                          rows: CompactSelection.fromSingleSelection(row),
                        });
                      }}
                      onCellActivated={(cell) => {
                        const [, row] = cell;
                        handleOpenEditOperation(row);
                      }}
                      rowMarkers="both"
                      width="100%"
                      height="100%"
                      headerHeight={28}
                      rowHeight={32}
                      theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                    />
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56 text-xs">
                  <ContextMenuItem onClick={handleOpenAddOperation} className="gap-2 cursor-pointer">
                    <Plus className="w-3.5 h-3.5 text-blue-500" />
                    <span>Bosqich qo'shish</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
                  </ContextMenuItem>
                  {hasSelectedOp && (
                    <>
                      <ContextMenuItem onClick={() => handleOpenEditOperation(selectedOpRow)} className="gap-2 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Tahrirlash</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={handleDeleteSelectedOperation} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>O'chirish</span>
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            </div>
          )}

          {/* ─── 4-BO'LIM: TEXNOLOGIYAGA MOSLASHUVCHAN TEXNIK SPETSIFIKATSIYA ─── */}
          {activeTab === "specs" && (
            <div className="flex-1 overflow-y-auto p-4 m-0 space-y-4 max-w-4xl">
              {/* Umumiy Geometrik O'lchamlar */}
              <div className="p-4 bg-card border border-border rounded-lg space-y-3.5 shadow-2xs">
                <div className="font-semibold text-foreground flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-emerald-600" />
                    <span>Geometriya va Tayyor Mahsulot O'lchami</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {formData.width} × {formData.height} {formData.dimensionUnit}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Kenglik (Width)</label>
                    <div className="flex items-center gap-1.5">
                      <Input 
                        type="number"
                        value={formData.width} 
                        onChange={(e) => handleFieldChange("width", parseFloat(e.target.value) || 0)} 
                        className="h-8 text-xs font-mono font-medium" 
                      />
                      <span className="text-muted-foreground text-[11px] font-mono">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Balandlik / Uzunlik (Height)</label>
                    <div className="flex items-center gap-1.5">
                      <Input 
                        type="number"
                        value={formData.height} 
                        onChange={(e) => handleFieldChange("height", parseFloat(e.target.value) || 0)} 
                        className="h-8 text-xs font-mono font-medium" 
                      />
                      <span className="text-muted-foreground text-[11px] font-mono">mm</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Qalinlik / Chuqurlik (Depth)</label>
                    <div className="flex items-center gap-1.5">
                      <Input 
                        type="number"
                        value={formData.depth} 
                        onChange={(e) => handleFieldChange("depth", parseFloat(e.target.value) || 0)} 
                        className="h-8 text-xs font-mono font-medium" 
                      />
                      <span className="text-muted-foreground text-[11px] font-mono">mm</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* OFSET BOSMA UCHUN MAXSUS PARAMETRLAR */}
              {(isOffset || isPostPress) && (
                <div className="p-4 bg-card border border-border rounded-lg space-y-3.5 shadow-2xs">
                  <div className="font-semibold text-foreground flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>Ofset Listli Chop Etish va Kashirovka Parametrlari</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30">
                      Offset Specific
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Asosiy Qog'oz / Substrat</label>
                      <Input 
                        value={formData.baseMaterial} 
                        onChange={(e) => handleFieldChange("baseMaterial", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="masalan, Galerie Art Silk"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">List Formati (Sheet Format)</label>
                      <Input 
                        value={formData.sheetFormat} 
                        onChange={(e) => handleFieldChange("sheetFormat", e.target.value)} 
                        className="h-8 text-xs font-mono" 
                        placeholder="700×1000 mm (B1)"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Grammaj (g/m²)</label>
                      <Input 
                        type="number"
                        value={formData.grammage} 
                        onChange={(e) => handleFieldChange("grammage", parseFloat(e.target.value) || 0)} 
                        className="h-8 text-xs font-mono" 
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Ranglilik Sxemasi</label>
                      <Input 
                        value={formData.colorsConfig} 
                        onChange={(e) => handleFieldChange("colorsConfig", e.target.value)} 
                        className="h-8 text-xs font-mono font-semibold" 
                        placeholder="4+4 CMYK, 4+0, 5+5..."
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Laminatsiya Turi</label>
                      <Input 
                        value={formData.lamination} 
                        onChange={(e) => handleFieldChange("lamination", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="Soft-Touch Matte, Gloss, Anti-scratch..."
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Lak va Bezak (Coating)</label>
                      <Input 
                        value={formData.coating} 
                        onChange={(e) => handleFieldChange("coating", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="Spot UV, Dispersion varnish, Drip-off..."
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Shtans Pichoq Kodi (Die Tooling)</label>
                      <Input 
                        value={formData.toolingCode} 
                        onChange={(e) => handleFieldChange("toolingCode", e.target.value)} 
                        className="h-8 text-xs font-mono" 
                        placeholder="DIE-B1-042"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-muted-foreground font-medium block mb-1">Quti / Buklama Geometriyasi</label>
                      <Input 
                        value={formData.boxType} 
                        onChange={(e) => handleFieldChange("boxType", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="Tuck-end, Crash lock bottom, 4-corner tray..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* FLEKSO BOSMA UCHUN MAXSUS PARAMETRLAR */}
              {isFlexo && (
                <div className="p-4 bg-card border border-border rounded-lg space-y-3.5 shadow-2xs">
                  <div className="font-semibold text-foreground flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Disc className="w-4 h-4 text-emerald-600" />
                      <span>Fleksografiya Rulonli Chop Etish Parametrlari (Flexo Narrow-Web)</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Flexo Specific
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Rulon Kengligi (Web Width)</label>
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="number"
                          value={formData.flexoWebWidth} 
                          onChange={(e) => handleFieldChange("flexoWebWidth", parseFloat(e.target.value) || 0)} 
                          className="h-8 text-xs font-mono font-medium" 
                        />
                        <span className="text-muted-foreground text-[11px] font-mono">mm</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Silindr Tishlari (Gear Teeth - Z)</label>
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="number"
                          value={formData.flexoGearTeeth} 
                          onChange={(e) => handleFieldChange("flexoGearTeeth", parseInt(e.target.value) || 0)} 
                          className="h-8 text-xs font-mono font-semibold" 
                          placeholder="84"
                        />
                        <span className="text-muted-foreground text-[11px] font-mono">tish</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Takrorlanish Qadami (Repeat Length)</label>
                      <div className="h-8 px-2.5 rounded border border-border bg-muted/40 flex items-center text-xs font-mono font-bold text-primary">
                        {flexoRepeatLengthMm} mm
                      </div>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Rulon Vtulkasi (Core Diameter)</label>
                      <Select 
                        value={formData.flexoCoreDiameter} 
                        onValueChange={(val) => handleFieldChange("flexoCoreDiameter", val)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="76 mm">76 mm (3 dyuym - Standart)</SelectItem>
                          <SelectItem value="38 mm">38 mm (1.5 dyuym)</SelectItem>
                          <SelectItem value="40 mm">40 mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Klishe Qalinligi (Polymer Plate)</label>
                      <Input 
                        value={formData.flexoPlateThickness} 
                        onChange={(e) => handleFieldChange("flexoPlateThickness", e.target.value)} 
                        className="h-8 text-xs font-mono" 
                        placeholder="1.14 mm"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Yuvishga Chidamlilik Darajasi</label>
                      <Input 
                        value={formData.flexoWashResistance} 
                        onChange={(e) => handleFieldChange("flexoWashResistance", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="60°C Standard Wash"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">O'ramdagi Yorliqlar Soni</label>
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="number"
                          value={formData.flexoLabelsPerRoll} 
                          onChange={(e) => handleFieldChange("flexoLabelsPerRoll", parseInt(e.target.value) || 0)} 
                          className="h-8 text-xs font-mono" 
                        />
                        <span className="text-muted-foreground text-[11px] font-mono">dona/rulon</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* JAKKARD TO'QUV UCHUN MAXSUS PARAMETRLAR */}
              {isJacquard && (
                <div className="p-4 bg-card border border-border rounded-lg space-y-3.5 shadow-2xs">
                  <div className="font-semibold text-foreground flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-600" />
                      <span>Jakkard To'quv Dastgohi Parametrlari (Jacquard Woven Labels)</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-500/30">
                      Jacquard Specific
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">To'quv Sifati (Weave Quality)</label>
                      <Select 
                        value={formData.jacquardWeaveQuality} 
                        onValueChange={(val) => handleFieldChange("jacquardWeaveQuality", val)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High-Definition Damask">High-Definition Damask (Yuqori Zichlik)</SelectItem>
                          <SelectItem value="Satin Woven">Satin Woven (Yaltiroq Satin)</SelectItem>
                          <SelectItem value="Taffeta Weave">Taffeta Weave (Standart Tafetta)</SelectItem>
                          <SelectItem value="Reverse Satin">Reverse Satin (Qarama-qarshi)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">To'quv Zichligi (Picks / cm)</label>
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="number"
                          value={formData.jacquardPicksPerCm} 
                          onChange={(e) => handleFieldChange("jacquardPicksPerCm", parseInt(e.target.value) || 0)} 
                          className="h-8 text-xs font-mono font-semibold" 
                        />
                        <span className="text-muted-foreground text-[11px] font-mono">taxta/sm</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Buklama & Kesim Turi</label>
                      <Select 
                        value={formData.jacquardFoldType} 
                        onValueChange={(val) => handleFieldChange("jacquardFoldType", val)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center_fold">Markazdan buklama (Center Fold)</SelectItem>
                          <SelectItem value="end_fold">Ikki chekkadan buklama (End Fold)</SelectItem>
                          <SelectItem value="manhattan_fold">Manhattan buklama</SelectItem>
                          <SelectItem value="straight_cut">To'g'ri ultratovush kesim (Straight Cut)</SelectItem>
                          <SelectItem value="mitre_fold">Burchakli buklama (Mitre Fold)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Asos Ip (Warp Yarn)</label>
                      <Input 
                        value={formData.jacquardWarpYarn} 
                        onChange={(e) => handleFieldChange("jacquardWarpYarn", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="50D Black Polyester"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Arqoq Ip (Weft Yarn)</label>
                      <Input 
                        value={formData.jacquardWeftYarn} 
                        onChange={(e) => handleFieldChange("jacquardWeftYarn", e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="75D White Micro-Yarn"
                      />
                    </div>

                    <div>
                      <label className="text-muted-foreground font-medium block mb-1">Tikish Chekkasi (Sewing Margin)</label>
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="number"
                          value={formData.jacquardSewingAllowance} 
                          onChange={(e) => handleFieldChange("jacquardSewingAllowance", parseFloat(e.target.value) || 0)} 
                          className="h-8 text-xs font-mono" 
                        />
                        <span className="text-muted-foreground text-[11px] font-mono">mm</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Dialog: Add / Edit Material --- */}
      <Dialog open={isMatDialogOpen} onOpenChange={setIsMatDialogOpen}>
        <DialogContent className="sm:max-w-[490px] text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>{editingMatIndex !== null ? "Xomashyoni Tahrirlash" : "Texkartaga Xomashyo Qo'shish"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ombor qoldig'i (Stock Balance) katalogidan xomashyo tanlang, 1 birlik mahsulot uchun sarf normasi va narxini belgilang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* 1. Xomashyo tanlash (Nomenklatura & Stock Balance) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-blue-600" />
                  <span>Xomashyo Nomi (Nomenklatura)</span>
                  <span className="text-destructive">*</span>
                </label>
                {selectedStockItem ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0 h-4 font-bold",
                      selectedStockItem.available > 0
                        ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    )}
                  >
                    {selectedStockItem.available > 0
                      ? `Mavjud: ${selectedStockItem.available.toLocaleString()} ${selectedStockItem.unit}`
                      : "Omborda qoldiq yo'q (Xarid talab etiladi)"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-300 border-amber-300">
                    Yangi xomashyo (Reja)
                  </Badge>
                )}
              </div>

              {/* Combobox with categories and stock balances */}
              <Popover open={isMatSelectOpen} onOpenChange={setIsMatSelectOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full h-8 justify-between px-2.5 text-xs font-normal bg-background cursor-pointer"
                    >
                      <span className="truncate">
                        {matDialogForm.name ? (
                          <span className="font-semibold text-foreground flex items-center gap-2">
                            {selectedStockItem?.sku && (
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                                [{selectedStockItem.sku}]
                              </span>
                            )}
                            <span>{matDialogForm.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Katalogdan xomashyo qidirish yoki tanlash...</span>
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  }
                />
                <PopoverContent className="w-[450px] p-0 shadow-lg border-border" align="start">
                  <Command className="w-full">
                    <CommandInput 
                      placeholder="Xomashyo nomi, SKU yoki formati bo'yicha qidirish..." 
                      className="h-8 text-xs"
                    />
                    <CommandList className="max-h-64">
                      <CommandEmpty className="p-3 text-xs text-muted-foreground text-center space-y-2">
                        <div>Katalogda bunday material topilmadi.</div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 border-dashed"
                          onClick={() => {
                            setMatDialogForm((p) => ({
                              ...p,
                              name: p.name || "Yangi Xomashyo",
                              spec: p.spec || "Standart parametr",
                              unitPrice: p.unitPrice || 0.25,
                              unit: p.unit || "sheets",
                            }));
                            setIsMatSelectOpen(false);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                          <span>Yangi nom bilan kiritish</span>
                        </Button>
                      </CommandEmpty>
                      {stockCategories.map((cat) => {
                        const items = combinedStock.filter((s) => s.category === cat);
                        if (items.length === 0) return null;
                        return (
                          <CommandGroup key={cat} heading={cat} className="text-xs">
                            {items.map((stock) => {
                              const isSelected = matDialogForm.name === stock.name;
                              return (
                                <CommandItem
                                  key={stock.sku}
                                  value={`${stock.sku} ${stock.name} ${stock.sheetFormat || ""} ${stock.category}`}
                                  onSelect={() => {
                                    handleSelectStockMaterial(stock);
                                    setIsMatSelectOpen(false);
                                  }}
                                  className="text-xs flex items-center justify-between py-1.5 px-2 cursor-pointer"
                                >
                                  <div className="flex flex-col gap-0.5 truncate max-w-[300px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
                                        {stock.sku}
                                      </span>
                                      <span className="font-medium truncate text-foreground">{stock.name}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                      {stock.sheetFormat && <span>{stock.sheetFormat} mm</span>}
                                      {stock.grammage && <span>• {stock.grammage} g/m²</span>}
                                      <span>• Joy: {stock.location}</span>
                                      <span>• ${stock.unitPriceUsd}/{stock.unit}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-mono px-1.5 py-0 h-4 font-semibold",
                                        stock.available > 0
                                          ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                          : "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                      )}
                                    >
                                      {stock.available > 0 ? `${stock.available.toLocaleString()} ${stock.unit}` : "0 qoldiq"}
                                    </Badge>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
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

              {/* Tanlangan Xomashyo Ma'lumotlari & Reja Narxi */}
              <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Spetsifikatsiya / Tavsif
                    </span>
                    <Input
                      value={matDialogForm.spec || ""}
                      onChange={(e) => setMatDialogForm((p) => ({ ...p, spec: e.target.value }))}
                      className="h-7 text-xs bg-background"
                      placeholder="e.g. 700x1000mm, 250g/m²"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Reja narxi (1 {matDialogForm.unit || "birlik"})</span>
                      <span className="text-[9px] text-primary">Tahrirlanadi</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={matDialogForm.unitPrice ?? ""}
                        onChange={(e) => setMatDialogForm((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))}
                        className="h-7 text-xs font-mono font-semibold bg-background"
                        placeholder="0.00"
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">{formData.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Stock balance & location row */}
                {selectedStockItem ? (
                  <div className="pt-2 border-t border-border/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Warehouse className="w-3.5 h-3.5 text-blue-500" />
                        <span>Ombor qoldig&apos;i:</span>
                      </span>
                      <span className={cn(
                        "font-mono font-bold",
                        selectedStockItem.available > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}>
                        {selectedStockItem.available > 0
                          ? `${selectedStockItem.available.toLocaleString()} ${selectedStockItem.unit} mavjud`
                          : "Qoldiq mavjud emas (Kirim talab etiladi)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Joylashuv: <strong className="text-foreground font-mono">{selectedStockItem.location}</strong></span>
                      <span>Jami zaxira: <strong className="text-foreground font-mono">{selectedStockItem.stockLevel.toLocaleString()}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>Yangi xomashyo: Texkarta saqlangach, reja tannarxga kiritiladi.</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newSku = `MAT-${Date.now().toString().slice(-4)}`;
                        openTab({
                          id: `stock-${newSku}`,
                          title: `Yangi Xomashyo Pasporti: ${newSku}`,
                          type: "warehouse-stock",
                          module: "warehouse",
                          isUnsaved: false,
                          documentData: {
                            sku: newSku,
                            name: matDialogForm.name || "",
                            category: "Paper & Board",
                            unit: matDialogForm.unit || "sheets",
                            stockLevel: 0,
                            available: 0,
                            unitPriceUsd: matDialogForm.unitPrice || 0,
                          },
                        });
                      }}
                      className="h-6 text-[10px] text-purple-600 dark:text-purple-400 gap-1 px-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>+ Pasport ochish</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Muhandis kiritishi kerak bo'lgan asosiy parametrlar: Sarf Normasi & Chiqindi % */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center justify-between">
                  <span>Sarf Normasi <span className="text-destructive">*</span></span>
                  <span className="text-[10px] font-normal text-muted-foreground">1 dona uchun</span>
                </label>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={matDialogForm.quantity || ""}
                    onChange={(e) => setMatDialogForm((p) => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono pr-16 bg-background"
                    placeholder="1.00"
                  />
                  <div className="absolute right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-muted-foreground pointer-events-none border border-border/40">
                    {matDialogForm.unit || "birlik"}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center justify-between">
                  <span>Texnologik Chiqindi</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Yo'qotish %</span>
                </label>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={matDialogForm.wastePercent || ""}
                    onChange={(e) => setMatDialogForm((p) => ({ ...p, wastePercent: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono pr-8 bg-background"
                    placeholder="0"
                  />
                  <span className="absolute right-2.5 text-xs font-mono font-bold text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Hisoblangan qiymat preview */}
            <div className="p-2.5 rounded-md bg-muted/40 border border-border flex items-center justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground">1 mahsulotga xomashyo tannarxi:</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {(matDialogForm.quantity * (1 + (matDialogForm.wastePercent || 0) / 100)).toFixed(3)} {matDialogForm.unit} × {formatMoney(matDialogForm.unitPrice, formData.currency)}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-primary">
                  {formatMoney(
                    (matDialogForm.quantity * (1 + (matDialogForm.wastePercent || 0) / 100)) * matDialogForm.unitPrice,
                    formData.currency
                  )}
                </span>
                {matDialogForm.wastePercent > 0 && (
                  <div className="text-[10px] text-muted-foreground font-normal">
                    (+{matDialogForm.wastePercent}% chiqindi hisobga olindi)
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsMatDialogOpen(false)} className="h-8 text-xs">
              Bekor qilish
            </Button>
            <Button size="sm" onClick={handleSaveMaterialDialog} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {editingMatIndex !== null ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Dialog: Add / Edit Routing Step --- */}
      <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
        <DialogContent className="sm:max-w-[460px] text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span>{editingOpIndex !== null ? "Marshrut Bosqichini Tahrirlash" : "Yangi Texnologik Bosqich"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Operatsiya turini, unga javobgar stanokni va taxminiy vaqt normasini belgilang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Quick Tariff Picker */}
            <div className="p-2.5 rounded-lg border border-blue-100 dark:border-blue-950/80 bg-blue-50/40 dark:bg-blue-950/20 space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Standart Korxona Tarifi (Auto-fill)</span>
                {opDialogForm.tariffCode && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {opDialogForm.tariffCode}
                  </span>
                )}
              </label>
              <FieldCombobox
                value={opDialogForm.tariffId || ""}
                onChange={handleSelectTariffInBOM}
                options={tariffOptions}
                placeholder="Tarifni tanlang (masalan, TRF-OFF-01)..."
                searchPlaceholder="Tarif kodi yoki nomini qidiring..."
                className="h-8 text-xs bg-card"
                popoverClassName="w-[420px]"
              />
              {opDialogForm.rateUsd > 0 && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-0.5">
                  <span>Stavka: <strong>${opDialogForm.rateUsd}/{opDialogForm.calcUnit || "unit"}</strong></span>
                  {opDialogForm.setupFeeUsd > 0 && (
                    <>
                      <span>•</span>
                      <span>Pripravka: <strong>${opDialogForm.setupFeeUsd}</strong></span>
                    </>
                  )}
                  {opDialogForm.pieceworkRateUsd > 0 && (
                    <>
                      <span>•</span>
                      <span>Sdelka: <strong>${opDialogForm.pieceworkRateUsd}</strong></span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Operatsiya Nomi <span className="text-destructive">*</span></label>
              <FieldCombobox
                value={opDialogForm.name}
                onChange={(val) => setOpDialogForm((p) => ({ ...p, name: val }))}
                options={STANDARD_PROCESS_STEPS.map((o) => ({ value: o, label: o }))}
                placeholder="Operatsiya tanlang yoki yozing..."
                className="h-8 text-xs bg-background"
                popoverClassName="w-auto min-w-[340px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Stanok / Ish Uchastkasi <span className="text-destructive">*</span></label>
              <FieldCombobox
                value={opDialogForm.machineStr}
                onChange={(val) => setOpDialogForm((p) => ({ ...p, machineStr: val }))}
                options={realMachineNames.map((m) => ({ value: m, label: m }))}
                placeholder="Stanok tanlang yoki ish uchastkasi yozing..."
                className="h-8 text-xs bg-background"
                popoverClassName="w-auto min-w-[340px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Vaqt Normasi (soat)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={opDialogForm.durationHours}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, durationHours: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-xs font-mono"
                  placeholder="1.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Mas'ul Operator / Mutaxassis</label>
                <Input
                  value={opDialogForm.operator}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, operator: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="K. Anderson"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsOpDialogOpen(false)} className="h-8 text-xs">
              Bekor qilish
            </Button>
            <Button size="sm" onClick={handleSaveOperationDialog} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {editingOpIndex !== null ? "Saqlash" : "Bosqichni Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O'chirishni tasdiqlash modali */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Shablonni butunlay o'chirish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Haqiqatan ham <strong className="font-semibold text-foreground">{formData.code}: {formData.name}</strong> shablonini bazadan butunlay o'chirmoqchimisiz?
              Bu amalni orqaga qaytarib bo'lmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(false)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteSpecification}
              className="h-8 text-xs gap-1.5"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{isDeleting ? "O'chirilmoqda..." : "Ha, butunlay o'chirilsin"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
