"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  DataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  GridSelection,
  CompactSelection,
  GridColumnIcon,
  Theme,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Download,
  Printer,
  Search,
  ExternalLink,
  ChevronDown,
  Check,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Cpu,
  Stamp,
  Save,
  Wrench,
  Layers,
  Palette,
  LayoutGrid,
  Table as TableIcon,
  Boxes,
  Trash2,
  Building,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { useWorkspaceStore } from "@/store/workspaceStore";
import { getNextWorkOrderNo } from "@/components/documents/work-order/utils/workOrderNumbering";
import { useTranslations } from "next-intl";
import { GLIDE_LIGHT_THEME, GLIDE_DARK_THEME } from "./DataGrid";
import { MachineQueueBoard } from "./MachineQueueBoard";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SmartCombobox } from "@/components/ui/smart-combobox";
import { formatMoney } from "@/components/documents/common/DocumentShell";

interface ProductionGridProps {
  type: string; // "planning" | "machines" | "bom" | "tooling"
}

export interface PlanningSlotRecord {
  id: string;
  queuePos: string;
  orderType: "Production" | "Sample";
  workOrder: string;
  parentOrder: string;
  customer: string;
  product: string;
  operation: string;
  machine: string;
  shift: string;
  operator: string;
  startTime: string;
  endTime: string;
  makeReadyMin: number;
  runTimeHrs: number;
  washUpMin: number;
  plannedSheets: number;
  makeReadySheets: number;
  completedSheets: number;
  wasteSheets: number;
  paperReady: boolean;
  platesReady: boolean;
  toolingReady: boolean;
  sampleApproved: boolean;
  downtimeReason: string;
  status: string;
  colors?: string;
}

const INITIAL_MACHINES: any[] = [];
const INITIAL_TOOLING: any[] = [];
const INITIAL_PLANNING_SLOTS: PlanningSlotRecord[] = [];

export function ProductionGrid({ type }: ProductionGridProps) {
  const tCommon = useTranslations("Common");
  const tGrid = useTranslations("DataGrid");
  const {
    updateGridStats,
    theme,
    openTab,
    addNotification,
    productionQueue,
    loadProductionQueue,
    isProductionQueueLoading,
    setCreateWorkOrderOpen,
    machines,
    loadMachines,
    isMachinesLoading,
    upsertMachineAsync,
    diesTooling,
    loadDiesToolingAsync,
    isDiesToolingLoading,
    upsertDieToolingAsync,
    deleteDieToolingAsync,
    crmCustomers,
    loadCrmCustomers,
    masterSpecifications,
    loadSpecificationsAsync,
    isSpecificationsLoading,
    deleteSpecificationAsync,
  } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [specToDelete, setSpecToDelete] = useState<any | null>(null);
  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [toolFormData, setToolFormData] = useState<any>(null);
  const [toolToDelete, setToolToDelete] = useState<any>(null);
  const [isToolSaving, setIsToolSaving] = useState(false);

  useEffect(() => {
    if (loadProductionQueue) {
      loadProductionQueue();
    }
    if (loadMachines) {
      loadMachines();
    }
    if (type === "bom" && loadSpecificationsAsync) {
      loadSpecificationsAsync();
    }
    if (type === "tooling") {
      if (loadDiesToolingAsync) loadDiesToolingAsync();
      if (loadCrmCustomers) loadCrmCustomers();
    }
  }, [loadProductionQueue, loadMachines, loadSpecificationsAsync, loadDiesToolingAsync, loadCrmCustomers, type]);

  // Status colorful rows toggle (persisted in localStorage, default true)
  const [enableStatusColors, setEnableStatusColors] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("printgoo_planning_color_rows");
      if (saved !== null) return saved === "true";
    }
    return true;
  });

  const handleToggleColorRows = useCallback((checked: boolean) => {
    setEnableStatusColors(checked);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("printgoo_planning_color_rows", String(checked));
      } catch (e) {}
    }
  }, []);

  const [planningData, setPlanningData] = useState<PlanningSlotRecord[]>(INITIAL_PLANNING_SLOTS);
  const [machinesData, setMachinesData] = useState<any[]>(INITIAL_MACHINES);
  const [toolingData, setToolingData] = useState(INITIAL_TOOLING);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editParam1, setEditParam1] = useState("");
  const [editParam2, setEditParam2] = useState("");

  const mappedMachines = useMemo(() => {
    const list = machines || [];
    return list.map((m: any) => {
      let maxFormat = m.format || "Standart";
      let maxGrammage = "Standart";
      let makeReady = 50;

      if (m.offsetSpecs) {
        maxFormat = m.offsetSpecs.maxSheetMm || maxFormat;
        maxGrammage = m.offsetSpecs.grammageRange || maxGrammage;
        makeReady = m.offsetSpecs.makeReadyWasteSheets || makeReady;
      } else if (m.flexoSpecs) {
        maxFormat = `${m.flexoSpecs.maxWebWidthMm || 0} mm Web`;
        maxGrammage = "BOPP / Film";
        makeReady = m.flexoSpecs.makeReadyWasteMeters || makeReady;
      } else if (m.dieCuttingSpecs) {
        maxFormat = m.dieCuttingSpecs.maxSheetMm || maxFormat;
        maxGrammage = (m.dieCuttingSpecs.substrateRange || "").slice(0, 20) || maxGrammage;
        makeReady = m.dieCuttingSpecs.makeReadyWasteSheets || makeReady;
      } else if (m.laminationSpecs) {
        maxFormat = m.laminationSpecs.maxSheetMm || maxFormat;
        maxGrammage = m.laminationSpecs.grammageRange || maxGrammage;
        makeReady = m.laminationSpecs.makeReadyWasteSheets || makeReady;
      } else if (m.guillotineSpecs) {
        maxFormat = `${m.guillotineSpecs.cuttingWidthMm || 0} mm Cut`;
        maxGrammage = "1200 g/m²";
        makeReady = 10;
      } else if (m.jacquardSpecs) {
        maxFormat = `${m.jacquardSpecs.reedWidthMm || 0} mm / ${m.jacquardSpecs.hooksCount || 0} H`;
        maxGrammage = "Damask / Yarn";
        makeReady = m.jacquardSpecs.wasteMeters || makeReady;
      } else if (m.mountingSpecs) {
        maxFormat = m.mountingSpecs.maxSheetMm || maxFormat;
        maxGrammage = "Corrugated";
        makeReady = m.mountingSpecs.makeReadyWasteSheets || makeReady;
      } else if (m.casingInSpecs) {
        maxFormat = m.casingInSpecs.maxBookFormatMm || maxFormat;
        maxGrammage = "Hardcover";
        makeReady = m.casingInSpecs.makeReadyWasteBooks || makeReady;
      }

      const hourlyRate = m.costing?.standardHourlyRateUsd ?? Number(m.hourlyRate ?? 0);
      const efficiency = m.overallEfficiency ?? 90;

      return {
        id: m.code || m.id,
        realId: m.id,
        code: m.code,
        name: m.name,
        type: `${m.department || "Production"} (${m.category || "machine"})`,
        maxFormat,
        maxGrammage,
        makeReadySheets: makeReady,
        hourlyRate,
        efficiency,
        status: m.status || "Idle",
        rawMachine: m,
      };
    });
  }, [machines, machinesData]);

  const mappedTooling = useMemo(() => {
    return (diesTooling || []).map((t: any) => {
      const across = Number(t.acrossCount) || 1;
      const around = Number(t.aroundCount) || 1;
      const typeLabels: Record<string, string> = {
        rotary_magnetic: "Rotary Magnetic (Магнитный)",
        solid_rotary: "Solid Rotary (Цельный)",
        flatbed: "Flatbed Die (Штанцформа)",
        hot_stamp: "Hot-Foil Stamp (Тиснение)",
        embossing: "Embossing Cliché (Конгрев)",
      };
      const shapeLabels: Record<string, string> = {
        rectangle: "To'rtburchak (Rect)",
        rounded_rect: `Radiusli (R=${t.cornerRadiusMm || 0}mm)`,
        circle: `Aylana (Ø ${t.widthMm}mm)`,
        oval: "Oval",
        custom: "Figurali kontur",
      };
      const statusLabels: Record<string, string> = {
        available: "Available (Tayyor)",
        in_use: "In Press (Stanokda)",
        sharpening: "Sharpening (Ta'mirda)",
        retired: "Retired (Chiqarilgan)",
      };

      const customerDisplay = t.customerName
        ? `${t.customerName}${t.isDedicated ? " (Eksklyuziv)" : ""}`
        : "Universal (Umumiy)";
      const ownershipDisplay =
        t.ownership === "customer_owned"
          ? "Mijoz mulki"
          : "In-House (Bizniki)";

      return {
        id: t.code || t.id,
        realId: t.id,
        code: t.code,
        name: t.name,
        customer: customerDisplay,
        customerName: t.customerName || "",
        customerId: t.customerId || null,
        ownership: ownershipDisplay,
        rawOwnership: t.ownership || "in_house",
        isDedicated: Boolean(t.isDedicated),
        toolType: typeLabels[t.dieType] || t.dieType || "Flatbed Die",
        shape: shapeLabels[t.shape] || t.shape || "rectangle",
        itemSize: `${t.widthMm} × ${t.heightMm} mm`,
        cavitiesUp: `${across}×${around} (${across * around}-up)`,
        format: t.cylinderTeeth ? `Z=${t.cylinderTeeth} (${t.repeatLengthMm || "-"} mm)` : "Flatbed",
        cylinderTeeth: t.cylinderTeeth || "-",
        rack: t.location || "-",
        location: t.location || "-",
        strikesUsed: Number(t.totalImpressions) || 0,
        maxStrikes: Number(t.maxImpressions) || 0,
        status: statusLabels[t.status] || t.status || "Ready",
        notes: t.notes || "",
        rawTool: t,
      };
    });
  }, [diesTooling]);

  const handleCreateNew = useCallback(() => {
    if (type === "bom") {
      const draftTabId = `draft-spec-${Date.now()}`;
      openTab({
        id: draftTabId,
        title: "Yangi Shablon (Qoralama)",
        type: "product-spec",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          code: "",
          name: "",
          department: "Offset",
          category: "Commercial Print",
          status: "Draft",
          version: "1.0",
          basePrice: 0,
          currency: "USD",
          unit: "1k pcs",
          description: "",
          baseMaterial: "",
          materials: [],
          operations: [],
        },
      });
    } else if (type === "planning") {
      const draftId = `draft-wo-${Date.now()}`;
      openTab({
        id: draftId,
        title: "Yangi buyruq (Qoralama)",
        type: "work-order",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          id: draftId,
          docNo: "",
          customer: "",
          product: "",
          department: "Offset",
          quantity: 0,
          unit: "pcs",
          status: "Draft",
          priority: "Normal",
          pressMachine: "",
          deadline: "",
          paperStock: "",
          priceTotal: 0,
          currency: "UZS",
        },
      });
    } else if (type === "tooling") {
      let maxNum = 0;
      for (const d of (diesTooling || [])) {
        const match = d.code?.match(/^DIE-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextCode = `DIE-${String(maxNum + 1).padStart(4, "0")}`;
      setToolFormData({
        isNew: true,
        code: nextCode,
        name: "",
        dieType: "rotary_magnetic",
        shape: "rectangle",
        widthMm: 50,
        heightMm: 90,
        cornerRadiusMm: 0,
        acrossCount: 2,
        aroundCount: 1,
        gapXMm: 3,
        gapYMm: 3,
        repeatLengthMm: "",
        cylinderTeeth: "",
        location: "",
        status: "available",
        totalImpressions: 0,
        maxImpressions: 100000,
        notes: "",
        customerId: "",
        customerName: "",
        ownership: "in_house",
        isDedicated: false,
      });
      setToolModalOpen(true);
    } else if (type === "machines") {
      let maxNum = 0;
      for (const m of (machines || [])) {
        const match = m.code?.match(/^MAC-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextCode = `MAC-${String(maxNum + 1).padStart(4, "0")}`;

      openTab({
        id: `machine-new-${Date.now()}`,
        title: `Yangi Uskuna (${nextCode})`,
        type: "machine-detail",
        module: "production",
        isUnsaved: false,
        activeLevel3Tab: "overview",
        documentData: {
          isNew: true,
          name: "",
          code: nextCode,
          department: "Offset",
          category: "offset",
          status: "Idle",
        },
      });
    } else {
      setCreateWorkOrderOpen(true);
    }
  }, [type, openTab, setCreateWorkOrderOpen, planningData.length, diesTooling, machinesData.length, machines]);

  // Keyboard shortcut: Ins to Create New
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Insert" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleCreateNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNew]);

  const { columns, rows } = useMemo(() => {
    let cols: GridColumn[] = [];
    let mockRows: any[] = [];

    if (type === "planning") {
      cols = [
        { id: "queuePos", title: "Navbat", width: 75, icon: GridColumnIcon.HeaderString },
        { id: "workOrder", title: "Work Order", width: 125, icon: GridColumnIcon.HeaderReference },
        { id: "customer", title: "Buyurtmachi", width: 175, icon: GridColumnIcon.HeaderString },
        { id: "product", title: "Mahsulot", width: 230, icon: GridColumnIcon.HeaderString },
        { id: "colors", title: "Ranglar (Colors)", width: 115, icon: GridColumnIcon.HeaderSingleValue },
        { id: "machine", title: "Stanok / Uskuna", width: 220, icon: GridColumnIcon.HeaderLookup },
        { id: "operator", title: "Smena & Operator", width: 165, icon: GridColumnIcon.HeaderString },
        { id: "readiness", title: "Tayyorgarlik", width: 135, icon: GridColumnIcon.HeaderSingleValue },
        { id: "progress", title: "Fakt / Reja (List)", width: 155, icon: GridColumnIcon.HeaderString },
        { id: "deadline", title: "Muddat", width: 120, icon: GridColumnIcon.HeaderDate },
        { id: "priority", title: "Prioritet", width: 100, icon: GridColumnIcon.HeaderSingleValue },
        { id: "status", title: "Status", width: 135, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = (productionQueue || [])
        .filter((item) => !item.id?.startsWith("draft-") && !item.id?.startsWith("temp-"))
        .map((item) => {
        const readyCount =
          (item.checks.designReady ? 1 : 0) +
          (item.checks.paperReady ? 1 : 0) +
          (item.checks.platesReady ? 1 : 0) +
          (item.checks.toolingReady ? 1 : 0);
        const planned = item.plannedSheets || item.quantity;
        const completed = item.completedSheets || 0;
        const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
        return {
          id: item.id,
          queuePos: `#${item.queueOrder}`,
          workOrder: item.id,
          customer: item.customer,
          product: item.product,
          colors: item.colors ? (item.spotColors && item.spotColors.length > 0 ? `${item.colors} (+${item.spotColors.length}s)` : item.colors) : "4+4",
          machine: item.pressMachine,
          operator: item.operator || "A. Kovalev (1-smena)",
          readiness: readyCount === 4 ? "✅ 4/4 Tayyor" : `⚠️ ${readyCount}/4 Kutilmoqda`,
          progress: `${completed.toLocaleString()} / ${planned.toLocaleString()} (${pct}%)`,
          deadline: item.deadline,
          priority: item.priority,
          status: item.stage,
        };
      });
    } else if (type === "machines") {
      cols = [
        { id: "id", title: "Machine ID", width: 105, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Equipment Name / Model", width: 255, icon: GridColumnIcon.HeaderString },
        { id: "type", title: "Process Type", width: 165, icon: GridColumnIcon.HeaderLookup },
        { id: "maxFormat", title: "Max Sheet / Web", width: 165, icon: GridColumnIcon.HeaderString },
        { id: "maxGrammage", title: "Max Stock", width: 135, icon: GridColumnIcon.HeaderString },
        { id: "makeReadySheets", title: "Make-Ready (sht)", width: 130, icon: GridColumnIcon.HeaderNumber },
        { id: "hourlyRate", title: "Rate ($/hr)", width: 105, icon: GridColumnIcon.HeaderNumber },
        { id: "efficiency", title: "OEE (%)", width: 95, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 115, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = mappedMachines;
    } else if (type === "bom") {
      cols = [
        { id: "id", title: "Shablon / BOM Kodi", width: 135, icon: GridColumnIcon.HeaderReference },
        { id: "productName", title: "Mahsulot & Xizmat Nomi", width: 270, icon: GridColumnIcon.HeaderTextTemplate },
        { id: "category", title: "Kategoriya", width: 150, icon: GridColumnIcon.HeaderLookup },
        { id: "department", title: "Sex / Texnologiya", width: 135, icon: GridColumnIcon.HeaderLookup },
        { id: "baseMaterial", title: "Asosiy Xomashyo", width: 200, icon: GridColumnIcon.HeaderString },
        { id: "componentsCount", title: "BOM (moddalar)", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "basePrice", title: "Narx / 1k", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 110, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = (masterSpecifications || []).map((s) => ({
        id: s.code || s.id,
        realId: s.id,
        productName: s.name,
        category: s.category || "Commercial Print",
        department: s.department || "Offset",
        version: s.version || "1.0",
        baseMaterial: s.baseMaterial || (s.techSpecs as any)?.baseMaterial || "-",
        componentsCount: s.materialsCount ?? (s.materials?.length || 0),
        basePrice: Number(s.basePrice) || 0,
        currency: s.currency || "USD",
        status: s.status || "Active",
        width: s.dimensions?.width,
        height: s.dimensions?.height,
        depth: s.dimensions?.depth,
        dimensionUnit: s.dimensions?.dimensionUnit,
        unit: s.unit,
        description: s.description,
        techSpecs: s.techSpecs,
        materials: s.materials,
        operations: s.operations,
      }));
    } else {
      cols = [
        { id: "id", title: "Tool Code", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Die / Cliché Description", width: 260, icon: GridColumnIcon.HeaderString },
        { id: "customer", title: "Mijoz (Client / Dedicated)", width: 190, icon: GridColumnIcon.HeaderLookup },
        { id: "ownership", title: "Egalik Turi", width: 130, icon: GridColumnIcon.HeaderSingleValue },
        { id: "toolType", title: "Tooling Type", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "shape", title: "Shape (Forma)", width: 135, icon: GridColumnIcon.HeaderLookup },
        { id: "itemSize", title: "Cut Size (W×H mm)", width: 140, icon: GridColumnIcon.HeaderString },
        { id: "cavitiesUp", title: "Imposition (Across×Around)", width: 160, icon: GridColumnIcon.HeaderString },
        { id: "format", title: "Format / Teeth", width: 135, icon: GridColumnIcon.HeaderString },
        { id: "rack", title: "Storage Rack", width: 120, icon: GridColumnIcon.HeaderReference },
        { id: "strikesUsed", title: "Strikes Used", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "maxStrikes", title: "Max Strikes", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 140, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = mappedTooling;
    }

    return { columns: cols, rows: mockRows };
  }, [type, planningData, machinesData, mappedMachines, mappedTooling, productionQueue, masterSpecifications]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("ALL");
  const [machineFilter, setMachineFilter] = useState<string>("ALL");

  const availableMachines = useMemo(() => {
    const map = new Map<string, { id: string; code?: string; name: string; department?: string }>();
    (machines || []).forEach((m) => {
      if (m.name) {
        map.set(m.name, {
          id: m.id,
          code: m.code,
          name: m.name,
          department: m.department,
        });
      }
    });
    productionQueue.forEach((q) => {
      if (q.pressMachine && !map.has(q.pressMachine)) {
        map.set(q.pressMachine, {
          id: q.pressMachine,
          name: q.pressMachine,
          department: q.department || "Production",
        });
      }
    });
    return Array.from(map.values());
  }, [machines, productionQueue]);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const searchStr = Object.values(r).join(" ").toLowerCase();
      const matchesSearch = !searchFilter || searchStr.includes(searchFilter.toLowerCase());

      let matchesStatus = true;
      if (type === "planning") {
        if (statusFilter === "ALL") {
          matchesStatus = true;
        } else if (statusFilter === "Running") {
          matchesStatus = ["Running", "Make-Ready", "Printing Sample", "In Press"].includes(r.status);
        } else if (statusFilter === "Scheduled") {
          matchesStatus = ["Scheduled", "Ready for Client"].includes(r.status);
        } else if (statusFilter === "Delayed") {
          matchesStatus = ["Delayed", "Awaiting Sample Approval"].includes(r.status);
        } else {
          matchesStatus = r.status === statusFilter;
        }
      } else {
        matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      }

      const matchesMachine = machineFilter === "ALL" || r.machine === machineFilter;
      return matchesSearch && matchesStatus && matchesMachine;
    });
  }, [rows, searchFilter, statusFilter, machineFilter, type]);

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return rows.find((r) => r.id === selectedRecordId) || null;
  }, [rows, selectedRecordId]);

  const handleOpenRow = useCallback(
    (rowIndex: number) => {
      const selectedRow = filteredRows[rowIndex];
      if (!selectedRow) return;

      if (type === "bom") {
        const specItem = (masterSpecifications || []).find(
          (s) => s.id === selectedRow.realId || s.code === selectedRow.id || s.id === selectedRow.id
        );
        openTab({
          id: selectedRow.id,
          title: `${selectedRow.id}: ${selectedRow.productName}`,
          type: "product-spec",
          module: "production",
          isUnsaved: false,
          activeLevel3Tab: "overview",
          documentData: specItem || {
            id: selectedRow.realId || selectedRow.id,
            code: selectedRow.id,
            name: selectedRow.productName,
            category: selectedRow.category,
            department: selectedRow.department,
            status: selectedRow.status,
            version: selectedRow.version,
            baseMaterial: selectedRow.baseMaterial,
            basePrice: selectedRow.basePrice,
            currency: (selectedRow as any).currency || "USD",
            width: selectedRow.width,
            height: selectedRow.height,
            depth: selectedRow.depth,
            dimensionUnit: selectedRow.dimensionUnit,
            unit: selectedRow.unit,
            description: selectedRow.description,
            techSpecs: selectedRow.techSpecs || {},
            materials: selectedRow.materials || [],
            operations: selectedRow.operations || [],
          },
        });
      } else if (type === "planning") {
        const item = productionQueue.find((q) => q.id === selectedRow.id || q.id === selectedRow.workOrder);
        const docId = item?.id || selectedRow.workOrder || selectedRow.id;
        const cust = item?.customer || selectedRow.customer;
        openTab({
          id: docId,
          title: `${docId} (${cust.split(" ")[0]})`,
          type: "work-order",
          module: "production",
          activeLevel3Tab: "timeline",
          documentData: {
            ...item,
            id: docId,
            docNo: docId,
            customer: cust,
            product: item?.product || selectedRow.product,
            pressMachine: item?.pressMachine || selectedRow.machine,
            quantity: item?.quantity || selectedRow.plannedSheets || 5000,
            status: item?.stage || selectedRow.status,
          },
        });
        addNotification({
          title: "Work Order Ochildi",
          description: `${docId} buyurtmasi ochildi (${item?.product || selectedRow.product})`,
          severity: "info",
        });
      } else if (type === "machines") {
        openTab({
          id: `machine-${selectedRow.realId || selectedRow.id}`,
          title: selectedRow.name || selectedRow.id,
          type: "machine-detail",
          module: "production",
          activeLevel3Tab: "overview",
          documentData: selectedRow.rawMachine || selectedRow,
        });
        addNotification({
          title: "Uskuna Pasporti Ochildi",
          description: `${selectedRow.name || selectedRow.id} (${selectedRow.id}) texnik pasporti ochildi`,
          severity: "info",
        });
      } else if (type === "tooling") {
        const raw = selectedRow.rawTool || selectedRow;
        setToolFormData({
          ...raw,
          isNew: false,
          widthMm: raw.widthMm || "",
          heightMm: raw.heightMm || "",
          cornerRadiusMm: raw.cornerRadiusMm ?? "",
          acrossCount: raw.acrossCount || 1,
          aroundCount: raw.aroundCount || 1,
          gapXMm: raw.gapXMm ?? 3,
          gapYMm: raw.gapYMm ?? 3,
          repeatLengthMm: raw.repeatLengthMm || "",
          cylinderTeeth: raw.cylinderTeeth || "",
          location: raw.location || "",
          status: raw.status || "available",
          totalImpressions: raw.totalImpressions || 0,
          maxImpressions: raw.maxImpressions || 100000,
          notes: raw.notes || "",
          customerId: raw.customerId || "",
          customerName: raw.customerName || "",
          ownership: raw.ownership || "in_house",
          isDedicated: Boolean(raw.isDedicated),
        });
        setToolModalOpen(true);
      }
    },
    [filteredRows, type, openTab, planningData, productionQueue, addNotification, masterSpecifications]
  );

  const handleSaveToolModal = async () => {
    if (!toolFormData) return;
    if (!toolFormData.name?.trim()) {
      addNotification({
        title: "Xatolik",
        description: "Iltimos, shtamp/pichoq tavsifi yoki nomini kiriting.",
        severity: "warning",
      });
      return;
    }
    setIsToolSaving(true);
    try {
      if (upsertDieToolingAsync) {
        const saved = await upsertDieToolingAsync(toolFormData);
        if (saved) {
          addNotification({
            title: "Shtamp Saqlandi",
            description: `${saved.name} (${saved.code}) muvaffaqiyatli saqlandi.`,
            severity: "success",
          });
          setToolModalOpen(false);
          setToolFormData(null);
        } else {
          addNotification({
            title: "Saqlashda Xatolik",
            description: "Serverdan kutilmagan javob qaytdi.",
            severity: "error",
          });
        }
      }
    } catch (err: any) {
      console.error("Save tool error:", err);
      addNotification({
        title: "Xatolik",
        description: err?.message || "Shtampni saqlashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsToolSaving(false);
    }
  };

  const handleDeleteTool = async () => {
    if (!toolToDelete) return;
    try {
      const targetId = toolToDelete.realId || toolToDelete.id;
      if (deleteDieToolingAsync) {
        await deleteDieToolingAsync(targetId);
        addNotification({
          title: "Shtamp O'chirildi",
          description: `${toolToDelete.code || toolToDelete.id} bazadan butunlay o'chirildi.`,
          severity: "info",
        });
        setToolToDelete(null);
        setToolModalOpen(false);
      }
    } catch (err: any) {
      console.error("Delete tool error:", err);
      addNotification({
        title: "O'chirishda Xatolik",
        description: err?.message || "Shtampni o'chirishda xatolik yuz berdi.",
        severity: "error",
      });
    }
  };

  const handleSaveDrawer = () => {
    if (!selectedRecord) return;
    if (type === "machines") {
      const existing = machines.find((m) => m.id === selectedRecord.id);
      if (existing && upsertMachineAsync) {
        const updated = {
          ...existing,
          name: editTitle || existing.name,
          costing: {
            ...existing.costing,
            standardHourlyRateUsd: Number(editParam1) || existing.costing.standardHourlyRateUsd,
          },
        };
        upsertMachineAsync(updated);
      }
      setMachinesData((prev) =>
        prev.map((m) =>
          m.id === selectedRecord.id
            ? {
                ...m,
                name: editTitle || m.name,
                hourlyRate: Number(editParam1) || m.hourlyRate,
                makeReadySheets: Number(editParam2) || m.makeReadySheets,
              }
            : m
        )
      );
    } else if (type === "tooling") {
      setToolingData((prev) =>
        prev.map((t) =>
          t.id === selectedRecord.id
            ? {
                ...t,
                name: editTitle || t.name,
                itemSize: editParam1 || t.itemSize,
                rack: editParam2 || t.rack,
              }
            : t
        )
      );
    }
    setIsDrawerOpen(false);
  };

  // Keep Workspace Status Bar in sync
  useEffect(() => {
    const selectedRowsCount = selection.rows.length;
    let coords = "R1:C1";
    if (selection.current?.cell) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title;
      coords = colTitle ? `R${row + 1}:C${col + 1} (${colTitle})` : `R${row + 1}:C${col + 1}`;
    }
    updateGridStats(selectedRowsCount, filteredRows.length, coords);
  }, [selection, filteredRows.length, columns, updateGridStats]);

  const getContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = filteredRows[row];
      if (!rowData) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const column = columns[col];
      const val = rowData[column.id as keyof typeof rowData];

      if (column.id === "orderType") {
        const isSample = val === "Sample";
        return {
          kind: GridCellKind.Text,
          data: String(val),
          displayData: isSample ? "🧪 Sample Proof" : "Production Run",
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? (isSample ? "#fbbf24" : "#60a5fa") : (isSample ? "#b45309" : "#1d4ed8"),
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      if (column.id === "colors") {
        const colorStr = String(val || "4+4");
        const hasSpot = colorStr.includes("Spot") || colorStr.includes("s)") || colorStr.startsWith("5+") || colorStr.startsWith("6+");
        return {
          kind: GridCellKind.Text,
          data: colorStr,
          displayData: colorStr,
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? (hasSpot ? "#fb923c" : "#38bdf8") : (hasSpot ? "#ea580c" : "#0284c7"),
            baseFontStyle: "bold 12px monospace",
          },
        };
      }

      if (column.id === "status") {
        let colorDark = "#facc15";
        let colorLight = "#a16207";

        if (
          val === "Running" ||
          val === "Active" ||
          val === "In Stock" ||
          val === "Approved" ||
          val === "Ready" ||
          val === "Completed"
        ) {
          colorDark = "#4ade80";
          colorLight = "#15803d";
        } else if (
          val === "Delayed" ||
          val === "Maintenance" ||
          val === "Out of Stock" ||
          val === "Obsolete" ||
          val === "Needs Re-knifing"
        ) {
          colorDark = "#f87171";
          colorLight = "#b91c1c";
        } else if (val === "Awaiting Sample Approval") {
          colorDark = "#fb7185";
          colorLight = "#be123c";
        } else if (
          val === "Printing Sample" ||
          val === "Ready for Client" ||
          val === "In Press" ||
          val === "Make-Ready"
        ) {
          colorDark = "#fbbf24";
          colorLight = "#b45309";
        }

        return {
          kind: GridCellKind.Text,
          data: String(val),
          displayData: String(val),
          allowOverlay: false,
          themeOverride: {
            textDark: isDark ? colorDark : colorLight,
            baseFontStyle: "600 12px sans-serif",
          },
        };
      }

      if (column.id === "basePrice") {
        const num = Number(val) || 0;
        const curr = (rowData as any).currency || "USD";
        return {
          kind: GridCellKind.Number,
          data: num,
          displayData: formatMoney(num, curr),
          allowOverlay: true,
          contentAlign: "right",
        };
      }

      return {
        kind: typeof val === "number" ? GridCellKind.Number : GridCellKind.Text,
        data: val,
        displayData: typeof val === "number" ? val.toLocaleString() : String(val),
        allowOverlay: true,
        contentAlign: typeof val === "number" ? "right" : "left",
      };
    },
    [filteredRows, columns, isDark]
  );

  const getRowThemeOverride = useCallback(
    (row: number): Partial<Theme> | undefined => {
      if (!enableStatusColors || type !== "planning") return undefined;

      const item = filteredRows[row];
      if (!item || !item.status) return undefined;

      const status = item.status;

      // 1. Running / Active in press
      if (status === "Running" || status === "In Press" || status === "Active") {
        return {
          bgCell: isDark ? "rgba(34, 197, 94, 0.10)" : "#f0fdf4",
          bgCellMedium: isDark ? "rgba(34, 197, 94, 0.16)" : "#dcfce7",
          borderColor: isDark ? "rgba(34, 197, 94, 0.22)" : "#bbf7d0",
        };
      }

      // 2. Delayed / Down-time / Problem
      if (status === "Delayed" || status === "Maintenance" || status === "Needs Re-knifing") {
        return {
          bgCell: isDark ? "rgba(239, 68, 68, 0.10)" : "#fef2f2",
          bgCellMedium: isDark ? "rgba(239, 68, 68, 0.16)" : "#fee2e2",
          borderColor: isDark ? "rgba(239, 68, 68, 0.22)" : "#fecaca",
        };
      }

      // 3. Awaiting Sample Approval (Client proof review hold)
      if (status === "Awaiting Sample Approval") {
        return {
          bgCell: isDark ? "rgba(244, 63, 94, 0.10)" : "#fff1f2",
          bgCellMedium: isDark ? "rgba(244, 63, 94, 0.16)" : "#ffe4e6",
          borderColor: isDark ? "rgba(244, 63, 94, 0.22)" : "#fecdd3",
        };
      }

      // 4. Make-Ready / In prep / Printing Sample
      if (status === "Make-Ready" || status === "Printing Sample") {
        return {
          bgCell: isDark ? "rgba(245, 158, 11, 0.10)" : "#fffbeb",
          bgCellMedium: isDark ? "rgba(245, 158, 11, 0.16)" : "#fef3c7",
          borderColor: isDark ? "rgba(245, 158, 11, 0.22)" : "#fde68a",
        };
      }

      // 5. Completed / Approved / Ready
      if (status === "Completed" || status === "Approved" || status === "Ready") {
        return {
          bgCell: isDark ? "rgba(56, 189, 248, 0.08)" : "#f0f9ff",
          bgCellMedium: isDark ? "rgba(56, 189, 248, 0.14)" : "#e0f2fe",
          borderColor: isDark ? "rgba(56, 189, 248, 0.20)" : "#bae6fd",
        };
      }

      // 6. Scheduled in queue / Ready for client review
      if (status === "Scheduled" || status === "Ready for Client") {
        return {
          bgCell: isDark ? "rgba(168, 85, 247, 0.08)" : "#faf5ff",
          bgCellMedium: isDark ? "rgba(168, 85, 247, 0.14)" : "#f3e8ff",
          borderColor: isDark ? "rgba(168, 85, 247, 0.20)" : "#e9d5ff",
        };
      }

      return undefined;
    },
    [enableStatusColors, type, filteredRows, isDark]
  );

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((r) => {
      if (r.status) statuses.add(r.status);
    });
    return Array.from(statuses);
  }, [rows]);

  const { primaryStatuses, overflowStatuses } = useMemo(() => {
    if (availableStatuses.length <= 4) {
      return { primaryStatuses: availableStatuses, overflowStatuses: [] };
    }
    const PRIORITY_ORDER = ["Scheduled", "Running", "Make-Ready", "Delayed", "Active", "Ready", "In Press"];
    const prioritized = availableStatuses.filter((s) => PRIORITY_ORDER.includes(s));
    const topPrimary = (prioritized.length > 0 ? prioritized : availableStatuses).slice(0, 3);
    const overflow = availableStatuses.filter((s) => !topPrimary.includes(s));
    return { primaryStatuses: topPrimary, overflowStatuses: overflow };
  }, [availableStatuses]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="w-full h-full bg-card flex flex-col select-none overflow-hidden">
            {/* Toolbar */}
            <div className="h-8 border-b border-border bg-card px-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 shrink overflow-x-auto no-scrollbar">
                {type === "planning" ? (
                  <>
                    {/* Primary Action: Create Work Order */}
                    <Button
                      onClick={handleCreateNew}
                      size="sm"
                      className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tCommon("create")}</span>
                    </Button>

                    <Separator orientation="vertical" className="h-3.5 mx-0.5 shrink-0" />

                    {/* View Mode Toggle (Machine Queues vs Data Table) */}
                    <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewMode("board")}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          viewMode === "board"
                            ? "bg-background text-primary font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Stanoklar Navbati (Board)"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Navbat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          viewMode === "table"
                            ? "bg-background text-primary font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Jadval (Table)"
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>Jadval</span>
                      </button>
                    </div>

                    {/* Machine Selector: Only in Table Mode (in Board mode, machine cards are on the board) */}
                    {viewMode === "table" && (
                      <>
                        <Separator orientation="vertical" className="h-3.5 mx-0.5 shrink-0" />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium pl-0.5 shrink-0">
                            <Cpu className="w-3.5 h-3.5 text-blue-500" />
                            <span className="hidden md:inline">Stanok:</span>
                          </span>
                          <Select
                            value={machineFilter}
                            onValueChange={(val) => setMachineFilter(val ?? "ALL")}
                          >
                            <SelectTrigger className="h-6.5 text-xs w-[130px] sm:w-[150px] bg-background shrink-0">
                              <SelectValue placeholder="Barcha stanoklar" />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                              <SelectItem value="ALL">Barcha Stanoklar (All)</SelectItem>
                              {(machines || []).map((m) => (
                                <SelectItem key={m.code || m.id} value={m.name}>
                                  {m.code ? `[${m.code}] ` : ""}{m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <Separator orientation="vertical" className="h-3.5 mx-0.5 shrink-0" />

                    {/* Operational Status Filters */}
                    <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium shrink-0">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("ALL")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          statusFilter === "ALL"
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Barchasi
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("Running")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          statusFilter === "Running"
                            ? "bg-background text-amber-600 dark:text-amber-400 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Jarayonda
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("Ready to Print")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          statusFilter === "Ready to Print"
                            ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Chopga tayyor
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("Queue")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          statusFilter === "Queue"
                            ? "bg-background text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Navbatda
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("Completed")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          statusFilter === "Completed"
                            ? "bg-background text-zinc-600 dark:text-zinc-300 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Bajarilgan
                      </button>
                    </div>

                    {/* Color Rows Feature Toggle: Only in Table Mode */}
                    {viewMode === "table" && (
                      <>
                        <Separator orientation="vertical" className="h-3.5 mx-0.5 shrink-0" />
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors cursor-pointer select-none whitespace-nowrap shrink-0 ${
                            enableStatusColors
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-medium"
                              : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleToggleColorRows(!enableStatusColors)}
                          title={tGrid("toggleColorRowsTip")}
                        >
                          <Palette className="w-3 h-3" />
                          <span className="text-[11px] hidden xl:inline">
                            {tGrid("statusColors")}
                          </span>
                          <Switch
                            checked={enableStatusColors}
                            onCheckedChange={handleToggleColorRows}
                            className="scale-75 h-4 w-7 data-[state=checked]:bg-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleCreateNew}
                      size="sm"
                      className="h-6.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tCommon("create")}</span>
                    </Button>
                    <Separator orientation="vertical" className="h-3.5 mx-0.5 shrink-0" />

                    {/* Status Filters */}
                    {availableStatuses.length > 0 && (
                      <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium shrink-0">
                        <button
                          onClick={() => setStatusFilter("ALL")}
                          className={`px-1.5 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                            statusFilter === "ALL"
                              ? "bg-background text-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          ALL
                        </button>
                        {primaryStatuses.map((status) => (
                          <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-1.5 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                              statusFilter === status
                                ? "bg-background text-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {status}
                          </button>
                        ))}

                        {overflowStatuses.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                                    overflowStatuses.includes(statusFilter)
                                      ? "bg-background text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                />
                              }
                            >
                              <span className="truncate max-w-[130px]">
                                {overflowStatuses.includes(statusFilter)
                                  ? statusFilter
                                  : `More (${overflowStatuses.length})`}
                              </span>
                              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52 text-xs">
                              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
                                Additional Statuses
                              </DropdownMenuLabel>
                              {overflowStatuses.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() => setStatusFilter(status)}
                                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                                >
                                  <span>{status}</span>
                                  {statusFilter === status && (
                                    <Check className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <div className="relative w-36 sm:w-44">
                  <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={`Search ${type}...`}
                    className="pl-7 h-6.5 text-xs bg-background border-input rounded"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6.5 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">{tCommon("export")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Content: Machine Queue Board or Data Table */}
            {type === "planning" && viewMode === "board" ? (
              <MachineQueueBoard
                searchFilter={searchFilter}
                statusFilter={statusFilter}
                machineFilter={machineFilter}
                onMachineFilterChange={setMachineFilter}
                onOpenWorkOrder={(woId, item) => {
                  openTab({
                    id: woId,
                    title: `${woId} (${item.customer.split(" ")[0]})`,
                    type: "work-order",
                    module: "production",
                    activeLevel3Tab: "timeline",
                    documentData: {
                      ...item,
                      id: woId,
                      docNo: woId,
                      customer: item.customer,
                      product: item.product,
                      pressMachine: item.pressMachine,
                      quantity: item.quantity,
                      status: item.stage,
                    },
                  });
                }}
                onOpenMachineDetail={(machineName) => {
                  const mac = (machines || []).find(
                    (m) => m.name === machineName || m.code === machineName
                  );
                  if (mac) {
                    openTab({
                      id: `machine-${mac.id}`,
                      title: mac.name || mac.code,
                      type: "machine-detail",
                      module: "production",
                      activeLevel3Tab: "overview",
                      documentData: mac,
                    });
                    addNotification({
                      title: "Uskuna Pasporti Ochildi",
                      description: `${mac.name} (${mac.code}) texnik pasporti ochildi`,
                      severity: "info",
                    });
                  }
                }}
              />
            ) : (
              <div className="flex-1 w-full h-full relative" id="production-grid-root">
                <DataEditor
                  getCellContent={getContent}
                  columns={columns}
                  rows={filteredRows.length}
                  rowMarkers="both"
                  freezeColumns={1}
                  smoothScrollX={true}
                  smoothScrollY={true}
                  width="100%"
                  height="100%"
                  gridSelection={selection}
                  onGridSelectionChange={setSelection}
                  onCellActivated={(cell) => handleOpenRow(cell[1])}
                  getRowThemeOverride={getRowThemeOverride}
                  headerHeight={28}
                  rowHeight={32}
                  theme={isDark ? GLIDE_DARK_THEME : GLIDE_LIGHT_THEME}
                />
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 text-xs">
          <ContextMenuItem onClick={handleCreateNew} className="gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            <span>{tCommon("create")}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
          </ContextMenuItem>
          {type === "planning" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => handleToggleColorRows(!enableStatusColors)}
                className="gap-2 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {enableStatusColors
                    ? "Hide " + tGrid("statusColors")
                    : "Show " + tGrid("statusColors")}
                </span>
              </ContextMenuItem>
            </>
          )}
          {type === "bom" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  const selectedRowIdx = selection.rows.toArray()[0];
                  const targetRow = filteredRows[selectedRowIdx];
                  if (targetRow) {
                    setSpecToDelete(targetRow);
                  }
                }}
                disabled={selection.rows.toArray().length === 0}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bazadan o'chirish</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Inspector Drawer for Machines & Tooling */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 pr-6">
              {type === "machines" ? (
                <Cpu className="w-4 h-4 text-primary" />
              ) : (
                <Stamp className="w-4 h-4 text-primary" />
              )}
              <SheetTitle className="text-sm font-semibold font-mono">
                {selectedRecord?.id}
              </SheetTitle>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {selectedRecord?.status}
              </Badge>
            </div>
            <SheetDescription className="text-xs">
              {type === "machines"
                ? "Equipment Technical Passport & Costing Rates"
                : "Die-Cut Shtamp / Flexo Cliché Tooling Passport"}
            </SheetDescription>
          </SheetHeader>

          {/* ── MACHINES & TOOLING INSPECTOR ── */}
          {selectedRecord && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {type === "machines" ? "Machine / Line Name" : "Tooling / Shtamp Description"}
                </Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {type === "machines" ? "Hourly Rate ($ USD/hr)" : "Cut / Item Size (W×H)"}
                  </Label>
                  <Input
                    value={editParam1}
                    onChange={(e) => setEditParam1(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {type === "machines" ? "Make-Ready Waste (sheets)" : "Warehouse Storage Rack"}
                  </Label>
                  <Input
                    value={editParam2}
                    onChange={(e) => setEditParam2(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {type === "machines" ? (
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Process Type:</span>
                    <span className="font-medium">{selectedRecord.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Sheet / Web Format:</span>
                    <span className="font-mono">{selectedRecord.maxFormat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Stock Grammage:</span>
                    <span className="font-mono">{selectedRecord.maxGrammage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OEE Efficiency:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {selectedRecord.efficiency}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tooling Type:</span>
                    <span className="font-medium">{selectedRecord.toolType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Imposition / Cavities:</span>
                    <span className="font-mono font-semibold">{selectedRecord.cavitiesUp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Press Sheet / Cylinder:</span>
                    <span className="font-mono">{selectedRecord.format}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned Client:</span>
                    <span className="font-medium">{selectedRecord.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Knife Lifecycle Strikes:</span>
                    <span className="font-mono">
                      {selectedRecord.strikesUsed?.toLocaleString()} /{" "}
                      {selectedRecord.maxStrikes?.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsDrawerOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={handleSaveDrawer}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{tCommon("save")}</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* BOM Shablonini o'chirish dialogi */}
      <Dialog open={Boolean(specToDelete)} onOpenChange={(open) => !open && setSpecToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Shablonni butunlay o'chirish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Haqiqatan ham <strong className="font-semibold text-foreground">{specToDelete?.id}: {specToDelete?.productName}</strong> shablonini bazadan butunlay o'chirmoqchimisiz?
              Bu amalni orqaga qaytarib bo'lmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSpecToDelete(null)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (specToDelete) {
                  const target = specToDelete.realId || specToDelete.id;
                  await deleteSpecificationAsync(target);
                  setSpecToDelete(null);
                  addNotification({
                    title: "O'chirildi",
                    description: `${specToDelete.id} bazadan butunlay o'chirildi`,
                    severity: "info",
                  });
                }
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Ha, o'chirilsin</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dies & Tooling Yaratish / Tahrirlash Dialogi ── */}
      <Dialog open={toolModalOpen} onOpenChange={(open) => !open && setToolModalOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Stamp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {toolFormData?.isNew
                ? "Yangi Shtamp / Pichoq Ro'yxatdan O'tkazish"
                : `Shtamp / Pichoq Pasporti: ${toolFormData?.code || ""}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Texnologik pichoq, magnit shtamp yoki klishe parametrlarini real bazada saqlash.
            </DialogDescription>
          </DialogHeader>

          {toolFormData && (
            <div className="space-y-4 py-1 text-xs">
              {/* Asosiy ma'lumotlar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Shtamp Kodi *
                  </Label>
                  <Input
                    value={toolFormData.code || ""}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="DIE-0001"
                    className="h-8 text-xs font-mono font-medium"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Nomi & Tavsifi *
                  </Label>
                  <Input
                    value={toolFormData.name || ""}
                    onChange={(e) => setToolFormData({ ...toolFormData, name: e.target.value })}
                    placeholder="Masalan: VIP Hangtag 50×90mm R3 magnit pichoq"
                    className="h-8 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Turi va Shakli */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Shtamp Turi (Technology)
                  </Label>
                  <Select
                    value={toolFormData.dieType || "rotary_magnetic"}
                    onValueChange={(val) => setToolFormData({ ...toolFormData, dieType: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rotary_magnetic">Rotary Magnetic (Магнитный)</SelectItem>
                      <SelectItem value="solid_rotary">Solid Rotary (Цельный ротационный)</SelectItem>
                      <SelectItem value="flatbed">Flatbed (Tekis shtansforma)</SelectItem>
                      <SelectItem value="hot_stamp">Hot Foil Cliché (Zarb klishesi)</SelectItem>
                      <SelectItem value="embossing">Embossing (Kongrev / Bo'rtma)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Shakli (Die Shape)
                  </Label>
                  <Select
                    value={toolFormData.shape || "rectangle"}
                    onValueChange={(val) => setToolFormData({ ...toolFormData, shape: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">To'rtburchak (Rectangle)</SelectItem>
                      <SelectItem value="rounded_rect">Radiusli to'rtburchak</SelectItem>
                      <SelectItem value="circle">Aylana / Doira (Circle)</SelectItem>
                      <SelectItem value="oval">Oval</SelectItem>
                      <SelectItem value="custom">Maxsus figurali (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Holati (Status)
                  </Label>
                  <Select
                    value={toolFormData.status || "available"}
                    onValueChange={(val) => setToolFormData({ ...toolFormData, status: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available (Tayyor / Omborda)</SelectItem>
                      <SelectItem value="in_use">In Press (Stanokda o'rnatilgan)</SelectItem>
                      <SelectItem value="sharpening">Sharpening (O'tkirlashda)</SelectItem>
                      <SelectItem value="retired">Retired (Hisobdan chiqarilgan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mijozga biriktirish & Egalik huquqi */}
              <div className="p-3 rounded-lg border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                    <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Mijozga biriktirish & Egalik Huquqi</span>
                  </div>
                  {toolFormData.customerId ? (
                    <Badge variant="outline" className="text-[10px] bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700">
                      Mijoz pichog'i
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Universal (Umumiy)
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Biriktirilgan Mijoz (CRM)
                    </Label>
                    <SmartCombobox
                      value={toolFormData.customerId || "none"}
                      onChange={(val) => {
                        if (val === "none" || !val) {
                          setToolFormData({
                            ...toolFormData,
                            customerId: "",
                            customerName: "",
                            ownership: "in_house",
                            isDedicated: false,
                          });
                        } else {
                          const client = (crmCustomers || []).find(
                            (c) => c.id === val || c.name.toLowerCase() === val.toLowerCase()
                          );
                          setToolFormData({
                            ...toolFormData,
                            customerId: client?.id || val,
                            customerName: client?.name || val,
                            ownership: "customer_owned",
                            isDedicated: true,
                          });
                        }
                      }}
                      onAddNew={(newVal) => {
                        setToolFormData({
                          ...toolFormData,
                          customerId: newVal,
                          customerName: newVal,
                          ownership: "customer_owned",
                          isDedicated: true,
                        });
                      }}
                      options={[
                        {
                          value: "none",
                          label: "Universal (Barcha mijozlar uchun ochiq)",
                          badge: "Umumiy",
                        },
                        ...(crmCustomers || []).map((c) => ({
                          value: c.id,
                          label: c.name,
                          description: c.tin ? `STIR: ${c.tin}` : c.industry || undefined,
                          badge: c.status,
                        })),
                      ]}
                      placeholder="Mijozni tanlang yoki Universal..."
                      searchPlaceholder="Mijoz nomi yoki STIR..."
                      allowCustom={true}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Egalik Turi (Ownership)
                    </Label>
                    <Select
                      value={toolFormData.ownership || "in_house"}
                      onValueChange={(val) => setToolFormData({ ...toolFormData, ownership: val })}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_house">
                          Bizning mulkimiz (In-House / Korxona aktivi)
                        </SelectItem>
                        <SelectItem value="customer_owned">
                          Mijoz mulki (Customer Owned / Mas'ul saqlov)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {toolFormData.customerId && (
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    <Checkbox
                      id="isDedicatedCheck"
                      checked={Boolean(toolFormData.isDedicated)}
                      onCheckedChange={(checked) =>
                        setToolFormData({ ...toolFormData, isDedicated: Boolean(checked) })
                      }
                    />
                    <label
                      htmlFor="isDedicatedCheck"
                      className="text-muted-foreground cursor-pointer select-none font-medium leading-none"
                    >
                      Faqat shu mijoz buyurtmalari uchun eksklyuziv cheklansin (Boshqa buyurtmalarda ko&apos;rinmaydi)
                    </label>
                  </div>
                )}
              </div>

              {/* O'lchamlar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Eni (Width mm) *
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.widthMm ?? ""}
                    onChange={(e) => setToolFormData({ ...toolFormData, widthMm: e.target.value })}
                    placeholder="50"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Bo'yi (Height mm) *
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.heightMm ?? ""}
                    onChange={(e) => setToolFormData({ ...toolFormData, heightMm: e.target.value })}
                    placeholder="90"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Radius (Corner R mm)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.cornerRadiusMm ?? ""}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, cornerRadiusMm: e.target.value })
                    }
                    placeholder="0"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Stellaj / Quti (Rack)
                  </Label>
                  <Input
                    value={toolFormData.location || ""}
                    onChange={(e) => setToolFormData({ ...toolFormData, location: e.target.value })}
                    placeholder="Masalan: SHELF-A2"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Ruxlar va Oraliqlar (Imposition) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Ko'ndalang rux (Across)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.acrossCount ?? 1}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, acrossCount: Number(e.target.value) || 1 })
                    }
                    min={1}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Bo'ylama rux (Around)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.aroundCount ?? 1}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, aroundCount: Number(e.target.value) || 1 })
                    }
                    min={1}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Oraliq X (Gap X mm)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.gapXMm ?? 3}
                    onChange={(e) => setToolFormData({ ...toolFormData, gapXMm: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Oraliq Y (Gap Y mm)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.gapYMm ?? 3}
                    onChange={(e) => setToolFormData({ ...toolFormData, gapYMm: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Silindr & Resurs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Silindr Tishlari (Z)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.cylinderTeeth ?? ""}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, cylinderTeeth: e.target.value })
                    }
                    placeholder="Masalan: 70"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Takrorlanish (Repeat mm)
                  </Label>
                  <Input
                    value={toolFormData.repeatLengthMm ?? ""}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, repeatLengthMm: e.target.value })
                    }
                    placeholder="93.000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Zarblar Soni (Ishlagan)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.totalImpressions ?? 0}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, totalImpressions: e.target.value })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Maksimal Zarblar (Resurs)
                  </Label>
                  <Input
                    type="number"
                    value={toolFormData.maxImpressions ?? 100000}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, maxImpressions: e.target.value })
                    }
                    placeholder="100000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Izohlar */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Qo'shimcha Izohlar (Notes)
                </Label>
                <Textarea
                  value={toolFormData.notes || ""}
                  onChange={(e) => setToolFormData({ ...toolFormData, notes: e.target.value })}
                  placeholder="Pichoq xususiyatlari, qaysi qog'oz va mahsulotlarga mosligi..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 justify-between items-center pt-2 border-t border-border">
            <div>
              {!toolFormData?.isNew && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setToolToDelete(toolFormData)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>O'chirish</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setToolModalOpen(false)}
                className="h-8 text-xs"
              >
                Bekor qilish
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveToolModal}
                disabled={isToolSaving}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isToolSaving ? "Saqlanmoqda..." : "Bazaga Saqlash"}</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shtampni o'chirish tasdiqlash dialogi */}
      <Dialog open={Boolean(toolToDelete)} onOpenChange={(open) => !open && setToolToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Shtampni bazadan butunlay o'chirish
            </DialogTitle>
            <DialogDescription className="text-xs">
              Haqiqatan ham <strong className="font-semibold text-foreground">{toolToDelete?.code}: {toolToDelete?.name}</strong> shtampini bazadan o'chirmoqchimisiz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setToolToDelete(null)}
              className="h-8 text-xs"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteTool}
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Ha, o'chirilsin</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
