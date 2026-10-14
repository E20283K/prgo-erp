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
} from "lucide-react";

import { useWorkspaceStore } from "@/store/workspaceStore";
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
import { CreateWorkOrderPickerModal } from "@/components/documents/work-order/dialogs/CreateWorkOrderPickerModal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

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

const INITIAL_MACHINES = [
  { id: "MAC-101", name: "Heidelberg Speedmaster XL 106-8P", type: "Offset Printing", maxFormat: "750×1060 mm (B1)", maxGrammage: "400 g/m²", makeReadySheets: 150, hourlyRate: 185, status: "Running", efficiency: 92 },
  { id: "MAC-102", name: "Komori Lithrone G40 (4-Color)", type: "Offset Printing", maxFormat: "720×1030 mm (B1)", maxGrammage: "350 g/m²", makeReadySheets: 120, hourlyRate: 145, status: "Running", efficiency: 88 },
  { id: "MAC-103", name: "Heidelberg Printmaster GTO 52", type: "Offset Printing", maxFormat: "360×520 mm (B3)", maxGrammage: "300 g/m²", makeReadySheets: 60, hourlyRate: 65, status: "Idle", efficiency: 84 },
  { id: "MAC-104", name: "Mark Andy Performance Series P7", type: "Flexo Roll Printing", maxFormat: "430 mm Web (Z=64..120)", maxGrammage: "250 g/m²", makeReadySheets: 50, hourlyRate: 130, status: "Running", efficiency: 91 },
  { id: "MAC-105", name: "Stock Sheet-to-Sheet Kashirovka Line", type: "Kashirovka / Mounting", maxFormat: "1000×1400 mm", maxGrammage: "1200 g/m² (Triplex)", makeReadySheets: 50, hourlyRate: 75, status: "Running", efficiency: 89 },
  { id: "MAC-106", name: "Bobst Novacut 106 E Autoplaten", type: "Flatbed Die-Cutting", maxFormat: "760×1060 mm", maxGrammage: "1500 g/m²", makeReadySheets: 40, hourlyRate: 110, status: "Idle", efficiency: 94 },
  { id: "MAC-107", name: "Autobond Mini 76 TH Thermal", type: "Lamination & Coating", maxFormat: "760×1020 mm", maxGrammage: "450 g/m²", makeReadySheets: 25, hourlyRate: 60, status: "Running", efficiency: 90 },
  { id: "MAC-108", name: "Kolbus BF 513 Hardcover Line", type: "Bindery & Casing-In", maxFormat: "310×380×80 mm", maxGrammage: "N/A", makeReadySheets: 30, hourlyRate: 125, status: "Maintenance", efficiency: 76 },
  { id: "MAC-109", name: "Polar N 115 Plus High-Speed Guillotine", type: "Guillotine Cutting", maxFormat: "1150 mm Cut Width", maxGrammage: "1200 g/m²", makeReadySheets: 10, hourlyRate: 45, status: "Running", efficiency: 96 },
  { id: "MAC-110", name: "Staubli LX 3202 High-Speed Jacquard Loom", type: "Jacquard Weaving", maxFormat: "2400 mm / 6144 Hooks", maxGrammage: "Polyester / Taffeta", makeReadySheets: 15, hourlyRate: 115, status: "Running", efficiency: 94 },
  { id: "MAC-111", name: "Nilpeter FA-Line Multi-Substrate", type: "Flexo Roll Printing", maxFormat: "420 mm Web (8-Color)", maxGrammage: "300 g/m²", makeReadySheets: 45, hourlyRate: 140, status: "Running", efficiency: 92 },
];

const INITIAL_TOOLING = [
  { id: "DIE-0101", name: "VIP Hangtag & Card Duplex Die (Rounded 3mm + Ø5mm Eyelet)", toolType: "Flatbed Steel-Rule Die (Штанцформа)", itemSize: "90×50 mm", cavitiesUp: "24-up (4×6)", format: "B2 (500×707 mm)", customer: "Vanguard Fashion", rack: "Rack A-04", strikesUsed: 14500, maxStrikes: 100000, status: "Ready" },
  { id: "DIE-0102", name: "E-Flute Perfume Folding Box FEFCO 0215", toolType: "Flatbed Steel-Rule Die (Штанцформа)", itemSize: "85×85×140 mm", cavitiesUp: "6-up (2×3)", format: "B1 (700×1000 mm)", customer: "Apex Packaging", rack: "Rack A-11", strikesUsed: 68200, maxStrikes: 120000, status: "In Press" },
  { id: "DIE-0103", name: "A4 Presentation Folder w/ 5mm Spine & Business Card Slot", toolType: "Flatbed Steel-Rule Die (Штанцформа)", itemSize: "220×310 mm (Closed)", cavitiesUp: "2-up", format: "B1 (700×1000 mm)", customer: "Alpha Media Group", rack: "Rack B-02", strikesUsed: 94000, maxStrikes: 100000, status: "Needs Re-knifing" },
  { id: "DIE-0104", name: "Kraft Shopping Bag Medium (260×320×120 mm)", toolType: "Flatbed Steel-Rule Die (Штанцформа)", itemSize: "780×460 mm (Open)", cavitiesUp: "1-up", format: "B1 (700×1000 mm)", customer: "Global Retailers Ltd", rack: "Rack B-09", strikesUsed: 31000, maxStrikes: 100000, status: "Ready" },
  { id: "ROT-0201", name: "Rotary Magnetic Die — Waterproof PP Roll Label", toolType: "Rotary Die (Магнитный штамп)", itemSize: "60×40 mm (R=2mm)", cavitiesUp: "12-up (3×4)", format: "Z=88 (279.4 mm)", customer: "Nordic Print Co", rack: "Cabinet M-02", strikesUsed: 145000, maxStrikes: 500000, status: "Ready" },
  { id: "FLX-0301", name: "DuPont Cyrel 1.14mm Photopolymer Set (5 Colors)", toolType: "Flexo Plate Set (Флексоклише)", itemSize: "30×50 mm Satin", cavitiesUp: "8-up", format: "Z=76 (241.3 mm)", customer: "Boutique Threads", rack: "Archive C-15", strikesUsed: 42000, maxStrikes: 150000, status: "Ready" },
  { id: "CLH-0401", name: "Brass 7mm Hot-Foil & Blind Emboss Cliché (Logo)", toolType: "Brass Cliché (Латунное клише)", itemSize: "65×35 mm", cavitiesUp: "4-up", format: "B2 / SRA3", customer: "Vanguard Fashion", rack: "Safe D-01", strikesUsed: 8000, maxStrikes: 250000, status: "Ready" },
  { id: "JAC-0501", name: "Staubli 6144-Hook Harness & Ultrasonic Slitter Cassette", toolType: "Jacquard Harness & Cassette (Жаккардовая оснастка)", itemSize: "15-50 mm Woven Tape", cavitiesUp: "16-tape ribbon", format: "6144 Hooks", customer: "Vanguard Fashion", rack: "Loom Bay 01", strikesUsed: 125000, maxStrikes: 600000, status: "Ready" },
];

const INITIAL_PLANNING_SLOTS: PlanningSlotRecord[] = Array.from({ length: 40 }, (_, i) => {
  const isSample = i % 5 === 0;
  const customers = ["Alpha Media Group", "Apex Packaging", "Nordic Print Co", "Vanguard Fashion", "Baltic Press LLC"];
  const products = [
    "A4 Hardcover Catalog 96p (150g Silk)",
    "E-Flute Perfume Box + Kashirovka",
    "Woven Satin Roll Labels (30×50)",
    "600g Duplex VIP Hangtag + Hot Foil",
    "350g Pharma Folding Carton Box",
  ];

  const operationsList = [
    { op: "1-bosqich: Qirqish & Formatlash", mac: "Polar N 115 Plus High-Speed Guillotine" },
    { op: "2-bosqich: 4+4 CMYK Ofset Bosma", mac: "Heidelberg Speedmaster XL 106-8P" },
    { op: "3-bosqich: Soft-Touch Matte Laminatsiya", mac: "Autobond Mini 76 TH Thermal" },
    { op: "4-bosqich: Sheet-to-Sheet Kashirovka (300g+300g)", mac: "Stock Sheet-to-Sheet Kashirovka Line" },
    { op: "5-bosqich: Bobst Shtansovka & Vyrubka", mac: "Bobst Novacut 106 E Autoplaten" },
    { op: "2-bosqich: 4+0 Ofset Bosma (Komori)", mac: "Komori Lithrone G40 (4-Color)" },
  ];

  const samplePairs = [
    { op: "Raqamli Express Namuna (Proof)", mac: "Xerox Iridesse Digital" },
    { op: "Plotter Qirqish Namuna (Mockup)", mac: "Ricoh Pro C9200" },
    { op: "Rang Namunasi (Color Proof)", mac: "Epson SureColor Proofer" },
  ];

  const pair = isSample ? samplePairs[i % samplePairs.length] : operationsList[i % operationsList.length];
  const operators = ["A. Kovalev (1-smena)", "R. Ismoilov (1-smena)", "D. Karimov (2-smena)", "B. Rahimov (1-smena)"];
  const planned = isSample ? 50 : [12500, 8000, 15000, 6000, 20000][i % 5];
  const status = isSample
    ? ["Printing Sample", "Ready for Client", "Approved"][i % 3]
    : i % 7 === 1
    ? "Awaiting Sample Approval"
    : ["Running", "Scheduled", "Make-Ready", "Delayed", "Completed"][i % 5];

  const completed =
    status === "Completed" || status === "Approved"
      ? planned
      : status === "Running" || status === "Printing Sample"
      ? Math.round(planned * 0.65)
      : 0;

  return {
    id: `SCH-${String(1000 + i).padStart(4, "0")}`,
    queuePos: `#${(i % 4) + 1}`,
    orderType: isSample ? "Sample" : "Production",
    workOrder: `WO-${String(350 + (i % 20)).padStart(5, "0")}${isSample ? "-SMP" : ""}`,
    parentOrder: `CO-${String(41 + (i % 20)).padStart(5, "0")}`,
    customer: customers[i % customers.length],
    product: products[i % products.length],
    operation: pair.op,
    machine: pair.mac,
    shift: isSample ? "Express Run" : ["Day Shift (08:00–20:00)", "Night Shift (20:00–08:00)"][i % 2],
    operator: operators[i % operators.length],
    startTime: `2026-10-${String((i % 10) + 10).padStart(2, "0")} 08:00`,
    endTime: `2026-10-${String((i % 10) + 10).padStart(2, "0")} ${isSample ? "10:30" : "15:30"}`,
    makeReadyMin: isSample ? 15 : 45,
    runTimeHrs: isSample ? 1.0 : 4.5,
    washUpMin: isSample ? 10 : 20,
    plannedSheets: planned,
    makeReadySheets: isSample ? 15 : 150,
    completedSheets: completed,
    wasteSheets: completed > 0 ? Math.round(completed * 0.012) : 0,
    paperReady: status !== "Delayed",
    platesReady: true,
    toolingReady: i % 4 !== 3,
    sampleApproved: status !== "Awaiting Sample Approval",
    downtimeReason:
      status === "Delayed"
        ? "Qog'oz namligi / akklimatizatsiya kutilmoqda"
        : status === "Awaiting Sample Approval"
        ? "Mijoz etalon namuna tasdig'ini kutish"
        : "Yo'q (Me'yorda ishlamoqda)",
    status,
    colors: ["4+4", "4+0", "5+0", "1+0", "4+1"][i % 5],
  };
});

export function ProductionGrid({ type }: ProductionGridProps) {
  const tCommon = useTranslations("Common");
  const tGrid = useTranslations("DataGrid");
  const { updateGridStats, theme, openTab, addNotification, productionQueue } = useWorkspaceStore();
  const isDark = theme === "dark";
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [isWorkOrderPickerOpen, setIsWorkOrderPickerOpen] = useState(false);

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
  const [machinesData, setMachinesData] = useState(INITIAL_MACHINES);
  const [toolingData, setToolingData] = useState(INITIAL_TOOLING);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editParam1, setEditParam1] = useState("");
  const [editParam2, setEditParam2] = useState("");

  const handleCreateNew = useCallback(() => {
    if (type === "bom") {
      const newId = `SPEC-00${Math.floor(100 + Math.random() * 900)}`;
      openTab({
        id: newId,
        title: `New Spec`,
        type: "product-spec",
        module: "production",
        isUnsaved: true,
        activeLevel3Tab: "overview",
        documentData: {
          code: newId,
          name: "New Master Recipe",
          department: "Offset",
          status: "Draft",
          version: "1.0",
        },
      });
    } else if (type === "planning") {
      setIsWorkOrderPickerOpen(true);
    } else if (type === "tooling") {
      const newTool = {
        id: `DIE-0${105 + toolingData.length}`,
        name: "New Custom Die-Cut Shtamp / Cliché",
        toolType: "Flatbed Steel-Rule Die (Штанцформа)",
        itemSize: "100×100 mm",
        cavitiesUp: "8-up (2×4)",
        format: "B2 (500×707 mm)",
        customer: "Alpha Media Group",
        rack: "Rack A-15",
        strikesUsed: 0,
        maxStrikes: 100000,
        status: "Ready",
      };
      setToolingData((prev) => [newTool, ...prev]);
      setSelectedRecordId(newTool.id);
      setEditTitle(newTool.name);
      setEditParam1(newTool.itemSize);
      setEditParam2(newTool.rack);
      setIsDrawerOpen(true);
    } else if (type === "machines") {
      const newMac = {
        id: `MAC-${101 + machinesData.length}`,
        name: "New Workshop Press / Finisher",
        type: "Post-Press",
        maxFormat: "700×1000 mm",
        maxGrammage: "400 g/m²",
        makeReadySheets: 50,
        hourlyRate: 85,
        status: "Idle",
        efficiency: 90,
      };
      setMachinesData((prev) => [newMac, ...prev]);
      setSelectedRecordId(newMac.id);
      setEditTitle(newMac.name);
      setEditParam1(String(newMac.hourlyRate));
      setEditParam2(String(newMac.makeReadySheets));
      setIsDrawerOpen(true);
    } else {
      setIsWorkOrderPickerOpen(true);
    }
  }, [type, openTab, planningData.length, toolingData.length, machinesData.length]);

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
      mockRows = productionQueue.map((item) => {
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
      mockRows = machinesData;
    } else if (type === "bom") {
      cols = [
        { id: "id", title: "BOM ID", width: 100, icon: GridColumnIcon.HeaderReference },
        { id: "productName", title: "Product Template", width: 250, icon: GridColumnIcon.HeaderString },
        { id: "version", title: "Version", width: 100, icon: GridColumnIcon.HeaderNumber },
        { id: "baseMaterial", title: "Base Material", width: 200, icon: GridColumnIcon.HeaderLookup },
        { id: "componentsCount", title: "Components", width: 120, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = [
        { id: "OFFSET_KASHIROVKA_V1", productName: "Duplex / Triplex Mounted Card & Box (Kashirovka 300g+300g)", version: "v2.0", baseMaterial: "2× 300g Coated Matt + PVA Glue", componentsCount: 7, status: "Active" },
        { id: "OFFSET_STD_V1", productName: "Standard Sheetfed Offset Commercial Print", version: "v1.4", baseMaterial: "Galerie Art Silk 150g", componentsCount: 5, status: "Active" },
        { id: "FLEXO_SATIN_V2", productName: "Woven Satin Garment Care Label (Rotary Flexo)", version: "v2.1", baseMaterial: "Satin Ribbon 30mm White", componentsCount: 4, status: "Active" },
        { id: "FLEXO_NYLON_V1", productName: "Coated Nylon Taffeta Wash-Care Roll", version: "v1.2", baseMaterial: "Nylon Taffeta 40mm", componentsCount: 4, status: "Active" },
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `BOM-${String(1001 + i).padStart(4, "0")}`,
          productName: ["Hardcover Catalog 96p", "A5 Booklet 32p", "Offset Magazine", "Folding Carton Box 350g"][i % 4] + ` - Type ${i + 1}`,
          version: `v1.${i % 5}`,
          baseMaterial: ["Galerie Art Silk 150g", "Munken Polar 120g", "Kraft Board 350g"][i % 3],
          componentsCount: 4 + (i % 5),
          status: ["Active", "Draft", "Obsolete"][i % 3],
        })),
      ];
    } else {
      cols = [
        { id: "id", title: "Tool Code", width: 105, icon: GridColumnIcon.HeaderReference },
        { id: "name", title: "Die / Cliché Description", width: 290, icon: GridColumnIcon.HeaderString },
        { id: "toolType", title: "Tooling Type", width: 220, icon: GridColumnIcon.HeaderLookup },
        { id: "itemSize", title: "Cut Size (W×H)", width: 135, icon: GridColumnIcon.HeaderString },
        { id: "cavitiesUp", title: "Imposition (Up)", width: 115, icon: GridColumnIcon.HeaderString },
        { id: "format", title: "Sheet / Cylinder", width: 145, icon: GridColumnIcon.HeaderString },
        { id: "customer", title: "Client Owner", width: 175, icon: GridColumnIcon.HeaderString },
        { id: "rack", title: "Storage Rack", width: 110, icon: GridColumnIcon.HeaderReference },
        { id: "strikesUsed", title: "Strikes Used", width: 115, icon: GridColumnIcon.HeaderNumber },
        { id: "status", title: "Status", width: 135, icon: GridColumnIcon.HeaderSingleValue },
      ];
      mockRows = toolingData;
    }

    return { columns: cols, rows: mockRows };
  }, [type, planningData, machinesData, toolingData, productionQueue]);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("ALL");
  const [machineFilter, setMachineFilter] = useState<string>("ALL");
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
        openTab({
          id: selectedRow.id,
          title: selectedRow.id,
          type: "product-spec",
          module: "production",
          isUnsaved: false,
          activeLevel3Tab: "overview",
          documentData: {
            code: selectedRow.id,
            name: selectedRow.productName,
            department: "Offset",
            status: selectedRow.status,
            version: selectedRow.version,
            baseMaterial: selectedRow.baseMaterial,
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
          activeLevel3Tab: "overview",
          documentData: {
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
        setSelectedRecordId(selectedRow.id);
        setEditTitle(selectedRow.name);
        setEditParam1(String(selectedRow.hourlyRate));
        setEditParam2(String(selectedRow.makeReadySheets));
        setIsDrawerOpen(true);
      } else if (type === "tooling") {
        setSelectedRecordId(selectedRow.id);
        setEditTitle(selectedRow.name);
        setEditParam1(selectedRow.itemSize);
        setEditParam2(selectedRow.rack);
        setIsDrawerOpen(true);
      }
    },
    [filteredRows, type, openTab, planningData, productionQueue]
  );

  const handleOpen = useCallback(() => {
    if (selection.rows.length === 0) return;
    const rowIndex = selection.rows.toArray()[0];
    handleOpenRow(rowIndex);
  }, [selection.rows, handleOpenRow]);

  const handleSaveDrawer = () => {
    if (!selectedRecord) return;
    if (type === "machines") {
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
            <div className="h-10 border-b border-border bg-card px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                {type === "planning" ? (
                  <>
                    {/* View Mode Toggle (Machine Queues vs Data Table) */}
                    <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium mr-1">
                      <button
                        type="button"
                        onClick={() => setViewMode("board")}
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                          viewMode === "board"
                            ? "bg-background text-primary font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Stanoklar Navbati</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                          viewMode === "table"
                            ? "bg-background text-primary font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>Jadval (Table)</span>
                      </button>
                    </div>

                    <Separator orientation="vertical" className="h-4 mx-1" />

                    {/* Machine Dispatch Selector */}
                    <div className="flex items-center gap-1.5 mr-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium pl-0.5 shrink-0">
                        <Cpu className="w-3.5 h-3.5 text-blue-500" />
                        <span className="hidden sm:inline">Stanok:</span>
                      </span>
                      <Select value={machineFilter} onValueChange={(val) => setMachineFilter(val ?? "ALL")}>
                        <SelectTrigger className="h-7 text-xs w-[190px] bg-background">
                          <SelectValue placeholder="Barcha stanoklar" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="ALL">Barcha Stanoklar (All)</SelectItem>
                          <SelectItem value="Heidelberg Speedmaster XL 106-8P">Heidelberg XL 106 (Ofset)</SelectItem>
                          <SelectItem value="Komori Lithrone G40 (4-Color)">Komori Lithrone G40 (Ofset)</SelectItem>
                          <SelectItem value="Mark Andy Performance Series P7">Mark Andy P7 (Flexo)</SelectItem>
                          <SelectItem value="Staubli LX 3202 High-Speed Jacquard Loom">Staubli Loom (Jakkard)</SelectItem>
                          <SelectItem value="Bobst Novacut 106 E Autoplaten">Bobst Novacut 106 (Shtans)</SelectItem>
                          <SelectItem value="Stock Sheet-to-Sheet Kashirovka Line">Kashirovka Line (Duplex)</SelectItem>
                          <SelectItem value="Autobond Mini 76 TH Thermal">Autobond Mini 76 (Laminatsiya)</SelectItem>
                          <SelectItem value="Polar N 115 Plus High-Speed Guillotine">Polar N 115 (Qirqish)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator orientation="vertical" className="h-4 mx-1" />

                    {/* Operational Status Filters */}
                    <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                      <button
                        onClick={() => setStatusFilter("ALL")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          statusFilter === "ALL"
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Barchasi
                      </button>
                      <button
                        onClick={() => setStatusFilter("Running")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          statusFilter === "Running"
                            ? "bg-background text-amber-600 dark:text-amber-400 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Jarayonda
                      </button>
                      <button
                        onClick={() => setStatusFilter("Ready to Print")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          statusFilter === "Ready to Print"
                            ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Chopga Tayyor
                      </button>
                      <button
                        onClick={() => setStatusFilter("Queue")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          statusFilter === "Queue"
                            ? "bg-background text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Navbatda
                      </button>
                      <button
                        onClick={() => setStatusFilter("Completed")}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          statusFilter === "Completed"
                            ? "bg-background text-zinc-600 dark:text-zinc-300 font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Bajarilgan
                      </button>
                    </div>

                    {viewMode === "table" && (
                      <>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        {/* Color Rows Feature Toggle */}
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors cursor-pointer select-none ${
                            enableStatusColors
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-medium"
                              : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleToggleColorRows(!enableStatusColors)}
                          title={tGrid("toggleColorRowsTip")}
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden sm:inline">
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
                      className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1 shadow-none rounded"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tCommon("create")}</span>
                    </Button>
                    <Button
                      onClick={handleOpen}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium gap-1 rounded"
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      <span>Open</span>
                    </Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />

                    {/* Status Filters */}
                    {availableStatuses.length > 0 && (
                      <div className="flex items-center bg-muted p-0.5 rounded text-[11px] font-medium">
                        <button
                          onClick={() => setStatusFilter("ALL")}
                          className={`px-2 py-0.5 rounded transition-colors ${
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
                            className={`px-2 py-0.5 rounded transition-colors ${
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
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
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

              <div className="flex items-center gap-2">
                <div className="relative w-52">
                  <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={`Search ${type}...`}
                    className="pl-7 h-7 text-xs bg-background border-input rounded"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>{tCommon("export")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
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
                onOpenWorkOrder={(woId, item) => {
                  openTab({
                    id: woId,
                    title: `${woId} (${item.customer.split(" ")[0]})`,
                    type: "work-order",
                    module: "production",
                    activeLevel3Tab: "overview",
                    documentData: {
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
          <ContextMenuItem onClick={handleOpen} className="gap-2 cursor-pointer">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Open Selected</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
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

      {/* Lightweight Picker for Production Work Orders */}
      <CreateWorkOrderPickerModal
        isOpen={isWorkOrderPickerOpen}
        onOpenChange={setIsWorkOrderPickerOpen}
      />
    </>
  );
}
