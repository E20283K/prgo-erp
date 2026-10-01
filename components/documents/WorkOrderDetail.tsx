"use client";

import React, { useState, useCallback, useMemo } from "react";
import { 
  Save, 
  Check, 
  Printer, 
  ArrowLeft, 
  Clock, 
  Layers, 
  FileText, 
  History, 
  AlertCircle,
  Calendar,
  DollarSign,
  User,
  Factory,
  Boxes,
  Tag,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Camera,
  Paperclip,
  UploadCloud,
  Download,
  Image as ImageIcon,
  Maximize2,
  ChevronsUpDown,
  Building2,
  Cpu
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from "@/components/ui/attachment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useWorkspaceStore, DocumentTab } from "@/store/workspaceStore";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

const BomMaterialsGrid = dynamic(
  () => import("./BomMaterialsGrid").then((mod) => mod.BomMaterialsGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
        Loading BOM & Materials Grid...
      </div>
    ),
  }
);

const MOCK_CUSTOMERS = [
  "Alpha Media Group",
  "Nordic Print Co",
  "Baltic Press LLC",
  "Apex Packaging",
  "Global Apparel Brand",
  "Zenith Publishing",
  "Vanguard Fashion",
  "Metropolis Books",
  "Urban Outfit Labels",
  "Pacific Craft Goods",
];

const MACHINE_MAP: Record<string, string[]> = {
  Offset: ["Heidelberg XL 106", "Komori Lithrone G40", "Heidelberg SX 74"],
  Flexo: ["Mark Andy Performance", "Nilpeter FA-Line", "Gallus ECS 340"],
  Jacquard: ["Staubli Jacquard Loom", "Muller Martini Loom", "Dornier PTV"],
  "Post-press": ["Kolbus BF 513", "Bobst Novacut 106"]
};

const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; stock: number }[]> = {
  "OFFSET_STD_V1": [
    { name: "Galerie Art Silk Paper 150g", req: 12500, unit: "Sheets", stock: 45000 },
    { name: "Hubergroup CMYK Ink", req: 36, unit: "kg", stock: 120 },
    { name: "Agfa CTP Plates", req: 24, unit: "pcs", stock: 8 },
  ],
  "OFFSET_PREM_V2": [
    { name: "LumiForte Premium 250g", req: 5000, unit: "Sheets", stock: 2000 },
    { name: "Spot UV Varnish", req: 15, unit: "kg", stock: 50 },
  ],
  "FLEXO_NYLON_V1": [
    { name: "Nylon Taffeta Tape 30mm", req: 45, unit: "Rolls", stock: 120 },
    { name: "Wash-Resistant Ink Black", req: 2, unit: "kg", stock: 1 },
  ],
  "FLEXO_SATIN_V2": [
    { name: "Premium Satin Ribbon 40mm", req: 30, unit: "Rolls", stock: 200 },
    { name: "Metallic Gold Ink", req: 1.5, unit: "kg", stock: 5 },
  ],
  "JACQ_WOVEN_V1": [
    { name: "Polyester Warp Yarn Black", req: 120, unit: "kg", stock: 500 },
    { name: "Polyester Weft Yarn White", req: 85, unit: "kg", stock: 400 },
  ],
  "JACQ_TAFFETA_V2": [
    { name: "High-density Taffeta Yarn", req: 200, unit: "kg", stock: 50 },
  ],
  "POST_GENERIC_V1": [
    { name: "Packaging Straps", req: 10, unit: "Rolls", stock: 80 },
    { name: "Carton Boxes Double-wall", req: 100, unit: "pcs", stock: 500 },
  ]
};

const RECIPE_ROUTES: Record<string, { name: string; machineStr: string }[]> = {
  "OFFSET_STD_V1": [
    { name: "Pre-press & CTP Plate Imaging", machineStr: "Screen PlateRite 8600" },
    { name: "4-Color Offset Printing", machineStr: "PRESS_MACHINE" },
    { name: "Die-cutting", machineStr: "Bobst Novacut 106" }
  ],
  "OFFSET_PREM_V2": [
    { name: "Pre-press & CTP Plate Imaging", machineStr: "Screen PlateRite 8600" },
    { name: "4-Color Offset Printing", machineStr: "PRESS_MACHINE" },
    { name: "Spot UV Varnish Coating", machineStr: "Steinemann Hibis 104" },
    { name: "Die-cutting", machineStr: "Bobst Novacut 106" },
    { name: "Folder Gluer", machineStr: "Bobst Visionfold" }
  ],
  "FLEXO_NYLON_V1": [
    { name: "Flexo Plate Making", machineStr: "Esko CDI Crystal" },
    { name: "1-Color Flexo Printing", machineStr: "PRESS_MACHINE" },
    { name: "Slitting & Rewinding", machineStr: "Rotoflex Slitter" }
  ],
  "FLEXO_SATIN_V2": [
    { name: "Flexo Plate Making", machineStr: "Esko CDI Crystal" },
    { name: "Multi-Color Flexo Printing", machineStr: "PRESS_MACHINE" },
    { name: "Hot Foil Stamping", machineStr: "Pantec Rhino" },
    { name: "Slitting & Rewinding", machineStr: "Rotoflex Slitter" }
  ],
  "JACQ_WOVEN_V1": [
    { name: "Warp Preparation", machineStr: "Karl Mayer Warper" },
    { name: "Jacquard Weaving", machineStr: "PRESS_MACHINE" },
    { name: "Standard Ultrasonic Cutting", machineStr: "Focus Label Cut/Fold" }
  ],
  "JACQ_TAFFETA_V2": [
    { name: "Warp Preparation", machineStr: "Karl Mayer Warper" },
    { name: "High-density Weaving", machineStr: "PRESS_MACHINE" },
    { name: "Laser Cutting & End Folding", machineStr: "Focus Label Laser" }
  ],
  "POST_GENERIC_V1": [
    { name: "Folding & Gluing", machineStr: "Bobst Visionfold" },
    { name: "Packing", machineStr: "Manual Station" }
  ]
};

interface MasterSpecification {
  id: string;
  code: string;
  name: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  description: string;
  materialsCount: number;
  estimatedCost: string;
  unit: string;
}

const MASTER_SPECIFICATIONS: MasterSpecification[] = [
  {
    id: "SPEC-OFF-01",
    code: "OFFSET_STD_V1",
    name: "Standard CMYK Folding Carton",
    department: "Offset",
    description: "4-color offset on 150g Art Silk paper with die-cutting",
    materialsCount: 3,
    estimatedCost: "$5,250",
    unit: "pcs",
  },
  {
    id: "SPEC-OFF-02",
    code: "OFFSET_PREM_V2",
    name: "Premium Spot UV Booklet & Box",
    department: "Offset",
    description: "Multi-color offset with soft-touch lamination & Spot UV",
    materialsCount: 2,
    estimatedCost: "$3,800",
    unit: "pcs",
  },
  {
    id: "SPEC-FLX-01",
    code: "FLEXO_NYLON_V1",
    name: "Nylon Taffeta Care Label",
    department: "Flexo",
    description: "Wash-resistant thermal flexo tape 30mm, slitted rolls",
    materialsCount: 2,
    estimatedCost: "$652",
    unit: "rolls",
  },
  {
    id: "SPEC-FLX-02",
    code: "FLEXO_SATIN_V2",
    name: "Premium Satin Luxury Ribbon",
    department: "Flexo",
    description: "Metallic gold & black flexo printing on satin 40mm",
    materialsCount: 2,
    estimatedCost: "$890",
    unit: "rolls",
  },
  {
    id: "SPEC-FLX-03",
    code: "FLEXO_TYVEK_V3",
    name: "Tear-Resistant Tyvek Label",
    department: "Flexo",
    description: "DuPont Tyvek 1073D weather-proof label printing",
    materialsCount: 2,
    estimatedCost: "$1,120",
    unit: "rolls",
  },
  {
    id: "SPEC-JCQ-01",
    code: "JACQ_WOVEN_V1",
    name: "Standard Damask Woven Label",
    department: "Jacquard",
    description: "Black/White polyester damask weave, ultrasonic cut",
    materialsCount: 2,
    estimatedCost: "$1,032",
    unit: "pcs",
  },
  {
    id: "SPEC-JCQ-02",
    code: "JACQ_TAFFETA_V2",
    name: "High-Density Woven Brand Tag",
    department: "Jacquard",
    description: "High-density micro-yarn taffeta with laser cut & fold",
    materialsCount: 1,
    estimatedCost: "$1,450",
    unit: "pcs",
  },
  {
    id: "SPEC-PST-01",
    code: "POST_GENERIC_V1",
    name: "Standard Die-cutting & Folder Gluer",
    department: "Post-press",
    description: "Automated Bobst die-cutting and carton assembly boxing",
    materialsCount: 2,
    estimatedCost: "$580",
    unit: "sets",
  },
];

interface SiteOption {
  id: string;
  name: string;
  label: string;
  location: string;
  facilities: string;
  status: string;
}

const SITE_OPTIONS: SiteOption[] = [
  {
    id: "Building 1",
    name: "Building 1 (HQ)",
    label: "Main Press Plant & HQ",
    location: "Campus North • 12,000 m²",
    facilities: "Offset Sheetfed, Post-press, CTP Pre-press",
    status: "Active (4 presses online)",
  },
  {
    id: "Building 2",
    name: "Building 2 (Annex)",
    label: "Packaging & Flexo Facility",
    location: "Campus South • 6,500 m²",
    facilities: "Narrow Web Flexo, Jacquard Looms, Finishing",
    status: "Active (6 lines online)",
  },
];

interface TechOption {
  id: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  name: string;
  code: string;
  description: string;
  badgeClass: string;
  equipmentCount: number;
}

const TECHNOLOGY_OPTIONS: TechOption[] = [
  {
    id: "Offset",
    name: "Offset Sheetfed Printing",
    code: "TECH-OFF",
    description: "High-speed commercial sheetfed, brochures, catalogs & folding cartons",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200",
    equipmentCount: 3,
  },
  {
    id: "Flexo",
    name: "Flexographic Rotary Printing",
    code: "TECH-FLX",
    description: "Roll-to-roll narrow-web printing for self-adhesive labels & packaging tapes",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    equipmentCount: 3,
  },
  {
    id: "Jacquard",
    name: "Jacquard Weaving Looms",
    code: "TECH-JCQ",
    description: "High-density micro-yarn damask, satin & taffeta woven brand labels",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200",
    equipmentCount: 3,
  },
  {
    id: "Post-press",
    name: "Post-press & Assembly Lines",
    code: "TECH-PST",
    description: "Automated die-cutting, folding, gluing, foil stamping & case binding",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    equipmentCount: 3,
  },
];

interface MachineOption {
  code: string;
  name: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  speed: string;
  format: string;
  features: string;
  status: string;
  isAvailable: boolean;
}

const MACHINE_OPTIONS: MachineOption[] = [
  // Offset
  {
    code: "M-OFF-106",
    name: "Heidelberg Speedmaster XL 106",
    department: "Offset",
    speed: "18,000 sheets/hr",
    format: "B1 (750 × 1050 mm)",
    features: "6-Color + Inline Coater • Inpress Control 3",
    status: "Ready for shift",
    isAvailable: true,
  },
  {
    code: "M-OFF-G40",
    name: "Komori Lithrone G40",
    department: "Offset",
    speed: "16,500 sheets/hr",
    format: "B1 (720 × 1030 mm)",
    features: "5-Color + H-UV Curing • KHS-AI Automation",
    status: "Busy (Job #WO-00278)",
    isAvailable: true,
  },
  {
    code: "M-OFF-SX74",
    name: "Heidelberg Speedmaster SX 74",
    department: "Offset",
    speed: "15,000 sheets/hr",
    format: "B2 (530 × 740 mm)",
    features: "4-Color Perfector (2/2 or 4/0)",
    status: "Available",
    isAvailable: true,
  },
  // Flexo
  {
    code: "M-FLX-01",
    name: "Mark Andy Performance P7",
    department: "Flexo",
    speed: "300 m/min",
    format: "Web width 330 mm",
    features: "8 UV Flexo Units + Cold Foil + Rotary Die",
    status: "Available",
    isAvailable: true,
  },
  {
    code: "M-FLX-02",
    name: "Nilpeter FA-Line",
    department: "Flexo",
    speed: "200 m/min",
    format: "Web width 420 mm",
    features: "Multi-substrate Sleeve Technology • 6-Color",
    status: "Ready",
    isAvailable: true,
  },
  {
    code: "M-FLX-03",
    name: "Gallus ECS 340",
    department: "Flexo",
    speed: "165 m/min",
    format: "Web width 340 mm",
    features: "Granite Core • 8-Color UV & LED Curing",
    status: "Ready",
    isAvailable: true,
  },
  // Jacquard
  {
    code: "M-JCQ-01",
    name: "Staubli Jacquard Loom DX",
    department: "Jacquard",
    speed: "1,200 rpm",
    format: "16 Harness Taffeta",
    features: "Electronic Jacquard • 2,688 Hooks",
    status: "Available",
    isAvailable: true,
  },
  {
    code: "M-JCQ-02",
    name: "Muller Martini Loom",
    department: "Jacquard",
    speed: "950 rpm",
    format: "Narrow Woven Ribbons",
    features: "16 Shafts Needle Loom • Thermal Selvedge",
    status: "Available",
    isAvailable: true,
  },
  {
    code: "M-JCQ-03",
    name: "Dornier PTV Weaving Loom",
    department: "Jacquard",
    speed: "800 rpm",
    format: "High-density Damask",
    features: "Airjet Weft Insertion • Electronic Dobby",
    status: "Available",
    isAvailable: true,
  },
  // Post-press
  {
    code: "M-PST-01",
    name: "Bobst Novacut 106 E",
    department: "Post-press",
    speed: "8,000 sheets/hr",
    format: "B1 (760 × 1060 mm)",
    features: "Autoplaten Die-cutter & Stripping station",
    status: "Ready",
    isAvailable: true,
  },
  {
    code: "M-PST-02",
    name: "Kolbus BF 513 Casing Line",
    department: "Post-press",
    speed: "30 cycles/min",
    format: "Hardcover Book Binding",
    features: "Rounding, Backing, Headbanding & Casing-in",
    status: "Available",
    isAvailable: true,
  },
  {
    code: "M-PST-03",
    name: "Bobst Visionfold 110",
    department: "Post-press",
    speed: "450 m/min",
    format: "Carton folding & gluing",
    features: "Straight-line, Crash-lock bottom & 4/6-corners",
    status: "Available",
    isAvailable: true,
  },
];

export function WorkOrderDetail({ tab }: { tab: DocumentTab }) {
  const tOrder = useTranslations("WorkOrderDetail");
  const tCommon = useTranslations("Common");
  const { setTabUnsaved, closeTab, setLevel3Tab, theme, openTab } = useWorkspaceStore();
  const [isSpecComboboxOpen, setIsSpecComboboxOpen] = useState(false);
  const [isSiteComboboxOpen, setIsSiteComboboxOpen] = useState(false);
  const [isTechComboboxOpen, setIsTechComboboxOpen] = useState(false);
  const [isMachineComboboxOpen, setIsMachineComboboxOpen] = useState(false);
  const isDark = theme === "dark";
  const data = tab.documentData || {};
  
  const [formData, setFormData] = useState({
    customer: data.customer || "Alpha Media Group",
    product: data.product || "A4 Catalog 96 pages",
    department: data.department || "Offset",
    site: data.site || "Building 1",
    recipe: data.recipe || (data.department === "Flexo" ? "FLEXO_NYLON_V1" : data.department === "Jacquard" ? "JACQ_WOVEN_V1" : "OFFSET_STD_V1"),
    quantity: data.quantity || 5000,
    unit: data.unit || "pcs",
    status: data.status || "Active",
    priority: data.priority || "High",
    pressMachine: data.pressMachine || "Heidelberg Speedmaster XL 106",
    startDate: data.startDate || "2026-09-30",
    deadline: data.deadline || "2026-10-06",
    paperStock: data.paperStock || "Galerie Art Silk 150g/m²",
    coating: data.coating || "Soft-Touch Matte + Spot UV",
    priceTotal: data.priceTotal || 14850.00,
    currency: data.currency || "USD",
    photoUrl: data.photoUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
  });

  const [orderAttachments, setOrderAttachments] = useState<Array<{
    id: string;
    name: string;
    size: string;
    type: string;
    date: string;
    isImage?: boolean;
  }>>([
    { id: "att-1", name: "DieLine_Packaging_Box_v3.ai", size: "4.8 MB", type: "Adobe Illustrator", date: "2026-09-29 14:22" },
    { id: "att-2", name: "Client_Approved_Proof_Signed.pdf", size: "2.1 MB", type: "PDF Document", date: "2026-09-29 15:10" },
    { id: "att-3", name: "Official_Purchase_Order_PO-8921.pdf", size: "840 KB", type: "PDF Document", date: "2026-09-29 14:15" },
  ]);

  const activeSpec = useMemo(
    () => MASTER_SPECIFICATIONS.find((s) => s.code === formData.recipe),
    [formData.recipe]
  );

  const activeSite = useMemo(
    () => SITE_OPTIONS.find((s) => s.id === formData.site || s.name === formData.site) || SITE_OPTIONS[0],
    [formData.site]
  );

  const activeTech = useMemo(
    () => TECHNOLOGY_OPTIONS.find((t) => t.id === formData.department) || TECHNOLOGY_OPTIONS[0],
    [formData.department]
  );

  const activeMachine = useMemo(
    () => MACHINE_OPTIONS.find((m) => m.name === formData.pressMachine || m.code === formData.pressMachine),
    [formData.pressMachine]
  );

  const currentDeptMachines = useMemo(
    () => MACHINE_OPTIONS.filter((m) => m.department === formData.department),
    [formData.department]
  );

  interface RouteStep {
    id: string;
    stepNumber: number;
    name: string;
    machine: string;
    operator: string;
    duration: number;
    qtyCompleted: string;
    status: "Queued" | "In Progress" | "Finished";
  }

  const getInitialOperations = (recipeId: string, pressMachine: string): RouteStep[] => {
    const route = RECIPE_ROUTES[recipeId];
    if (route) {
      return route.map((step, index) => ({
        id: String(index + 1),
        stepNumber: (index + 1) * 10,
        name: step.name,
        machine: step.machineStr === "PRESS_MACHINE" ? pressMachine : step.machineStr,
        operator: ["K. Anderson", "M. Ivanova", "A. Becker", "S. Petrov"][index % 4],
        duration: [0.5, 2.5, 1.0, 1.2, 0.8][index % 5],
        qtyCompleted: index === 0 ? `${(formData.quantity || 5000).toLocaleString()} / ${(formData.quantity || 5000).toLocaleString()}` : index === 1 ? `3,200 / ${(formData.quantity || 5000).toLocaleString()}` : `0 / ${(formData.quantity || 5000).toLocaleString()}`,
        status: index === 0 ? "Finished" : index === 1 ? "In Progress" : "Queued"
      }));
    }
    // Fallback if recipe not found
    if (formData.department === "Flexo") {
      return [
        { id: "1", stepNumber: 10, name: "Flexo Plate Making", machine: "Esko CDI Crystal", operator: "K. Anderson", duration: 0.5, qtyCompleted: "12 / 12 sets", status: "Finished" },
        { id: "2", stepNumber: 20, name: "Roll-to-Roll Flexo Printing", machine: pressMachine, operator: "M. Ivanova", duration: 3.5, qtyCompleted: "12,000 / 25,000 m", status: "In Progress" },
        { id: "3", stepNumber: 30, name: "Slitting & Rewinding", machine: "Rotoflex Slitter", operator: "S. Petrov", duration: 1.5, qtyCompleted: "0 / 25,000 m", status: "Queued" }
      ];
    }
    if (formData.department === "Jacquard") {
      return [
        { id: "1", stepNumber: 10, name: "Woven Label Production", machine: pressMachine, operator: "A. Becker", duration: 4.0, qtyCompleted: "15,000 / 20,000 pcs", status: "In Progress" },
        { id: "2", stepNumber: 20, name: "Ultrasonic Cutting & Folding", machine: "Focus Label Cut/Fold", operator: "S. Petrov", duration: 2.0, qtyCompleted: "0 / 20,000 pcs", status: "Queued" }
      ];
    }
    return [
      { id: "1", stepNumber: 10, name: "Pre-press & CTP Plate Imaging", machine: "Screen PlateRite 8600", operator: "K. Anderson", duration: 0.5, qtyCompleted: "8 / 8 plates", status: "Finished" },
      { id: "2", stepNumber: 20, name: "4+4 Offset Printing", machine: pressMachine, operator: "M. Ivanova", duration: 2.5, qtyCompleted: "3,200 / 5,000", status: "In Progress" },
      { id: "3", stepNumber: 30, name: "Thermal Lamination", machine: "Autobond Mini 76", operator: "A. Becker", duration: 1.0, qtyCompleted: "0 / 5,000", status: "Queued" },
      { id: "4", stepNumber: 40, name: "Die-cutting", machine: "Bobst Novacut 106", operator: "S. Petrov", duration: 1.2, qtyCompleted: "0 / 5,000", status: "Queued" }
    ];
  };

  const [operations, setOperations] = useState<RouteStep[]>(getInitialOperations(formData.recipe, formData.pressMachine));

  // Automatically regenerate operations route if recipe changes
  React.useEffect(() => {
    if (formData.recipe) {
      setOperations(getInitialOperations(formData.recipe, formData.pressMachine));
    }
  }, [formData.recipe, formData.pressMachine]);

  // Selection & Dialog state for Route Glide Data Grid
  const [opSelection, setOpSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [editingOpIndex, setEditingOpIndex] = useState<number | null>(null);
  const [opDialogForm, setOpDialogForm] = useState<Omit<RouteStep, "id">>({
    stepNumber: 10,
    name: "",
    machine: formData.pressMachine,
    operator: "K. Anderson",
    duration: 1,
    qtyCompleted: "0 / 5,000",
    status: "Queued",
  });

  const handleOpenAddOperation = () => {
    setEditingOpIndex(null);
    const nextStepNum = (operations.length + 1) * 10;
    setOpDialogForm({
      stepNumber: nextStepNum,
      name: "",
      machine: formData.pressMachine || "Heidelberg Speedmaster XL 106",
      operator: "K. Anderson",
      duration: 1,
      qtyCompleted: `0 / ${(formData.quantity || 5000).toLocaleString()}`,
      status: "Queued",
    });
    setIsOpDialogOpen(true);
  };

  const handleOpenEditOperation = (index: number) => {
    const item = operations[index];
    if (!item) return;
    setEditingOpIndex(index);
    setOpDialogForm({
      stepNumber: item.stepNumber,
      name: item.name,
      machine: item.machine,
      operator: item.operator,
      duration: item.duration,
      qtyCompleted: item.qtyCompleted,
      status: item.status,
    });
    setIsOpDialogOpen(true);
  };

  const handleSaveOperationDialog = () => {
    if (editingOpIndex !== null) {
      const updated = [...operations];
      updated[editingOpIndex] = {
        ...updated[editingOpIndex],
        ...opDialogForm,
      };
      setOperations(updated);
    } else {
      setOperations([
        ...operations,
        {
          id: String(Date.now()),
          ...opDialogForm,
        },
      ]);
    }
    setTabUnsaved(tab.id, true);
    setIsOpDialogOpen(false);
  };

  const handleDeleteSelectedOperation = () => {
    const selectedRows = opSelection.rows.toArray();
    if (selectedRows.length === 0) return;
    const remaining = operations.filter((_, idx) => !selectedRows.includes(idx));
    setOperations(remaining);
    setOpSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
    setTabUnsaved(tab.id, true);
  };

  // Grid column definitions for Route
  const opColumns = useMemo<GridColumn[]>(() => [
    { id: "step", title: "Step", width: 65, icon: GridColumnIcon.HeaderNumber },
    { id: "name", title: "Operation Description", width: 280, icon: GridColumnIcon.HeaderString },
    { id: "machine", title: "Machine / Work Center", width: 230, icon: GridColumnIcon.HeaderLookup },
    { id: "operator", title: "Operator", width: 140, icon: GridColumnIcon.HeaderString },
    { id: "duration", title: "Duration (hrs)", width: 110, icon: GridColumnIcon.HeaderNumber },
    { id: "progress", title: "Progress (Qty)", width: 130, icon: GridColumnIcon.HeaderString },
    { id: "status", title: "Status", width: 120, icon: GridColumnIcon.HeaderSingleValue },
  ], []);

  const getOpCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const op = operations[row];
    if (!op) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };

    if (col === 0) return { kind: GridCellKind.Number, data: op.stepNumber, displayData: String(op.stepNumber), allowOverlay: false };
    if (col === 1) return { kind: GridCellKind.Text, data: op.name, displayData: op.name, allowOverlay: true };
    if (col === 2) return { kind: GridCellKind.Text, data: op.machine, displayData: op.machine, allowOverlay: true };
    if (col === 3) return { kind: GridCellKind.Text, data: op.operator || "Unassigned", displayData: op.operator || "Unassigned", allowOverlay: true };
    if (col === 4) return { kind: GridCellKind.Number, data: op.duration || 1, displayData: `${op.duration || 1}h`, allowOverlay: true };
    if (col === 5) return { kind: GridCellKind.Text, data: op.qtyCompleted || "0 / 0", displayData: op.qtyCompleted || "0 / 0", allowOverlay: true };
    if (col === 6) {
      const statusColor = op.status === "Finished" 
        ? (isDark ? "#4ade80" : "#15803d") 
        : op.status === "In Progress" 
        ? (isDark ? "#60a5fa" : "#2563eb") 
        : (isDark ? "#9ca3af" : "#64748b");
      return {
        kind: GridCellKind.Text,
        data: op.status,
        displayData: op.status,
        allowOverlay: false,
        themeOverride: {
          textDark: statusColor,
          baseFontStyle: "600 12px sans-serif",
        }
      };
    }

    return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
  }, [operations, isDark]);

  const onOpCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const updated = [...operations];
    if (col === 1 && newValue.kind === GridCellKind.Text) {
      updated[row].name = newValue.data.toString();
    } else if (col === 2 && newValue.kind === GridCellKind.Text) {
      updated[row].machine = newValue.data.toString();
    } else if (col === 3 && newValue.kind === GridCellKind.Text) {
      updated[row].operator = newValue.data.toString();
    } else if (col === 4 && newValue.kind === GridCellKind.Number) {
      updated[row].duration = Number(newValue.data);
    }
    setOperations(updated);
    setTabUnsaved(tab.id, true);
  }, [operations, tab.id, setTabUnsaved]);

  const activeTab = tab.activeLevel3Tab || "overview";

  const handleFieldChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTabUnsaved(tab.id, true);
  };

  const handleDepartmentChange = (newDept: string) => {
    const defaultRecipe = newDept === "Flexo" ? "FLEXO_NYLON_V1" : newDept === "Jacquard" ? "JACQ_WOVEN_V1" : newDept === "Post-press" ? "POST_GENERIC_V1" : "OFFSET_STD_V1";
    const available = MACHINE_MAP[newDept] || [];
    const defaultMachine = available[0] || formData.pressMachine;
    setFormData((prev) => ({
      ...prev,
      department: newDept,
      recipe: defaultRecipe,
      pressMachine: defaultMachine,
    }));
    setTabUnsaved(tab.id, true);
  };

  const selectedOpRow = opSelection.rows.toArray()[0];
  const hasSelectedOp = selectedOpRow !== undefined && operations[selectedOpRow] !== undefined;

  const handleSave = () => {
    setTabUnsaved(tab.id, false);
  };

  const handleSaveAndClose = () => {
    setTabUnsaved(tab.id, false);
    closeTab(tab.id);
  };

  const currentRecipeMaterials = RECIPE_MATERIALS[formData.recipe] || [];
  const hasShortage = currentRecipeMaterials.some((m) => m.req > m.stock);
  const availableMachines = MACHINE_MAP[formData.department] || [];

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-xs">
      {/* Level 3 Tabs Navigation & Document Actions Bar */}
      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setLevel3Tab(tab.id, val)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between h-10 gap-2">
          <TabsList className="bg-transparent h-10 p-0 gap-1.5 shrink-0">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{tOrder("tabOverview")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="materials" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <Boxes className="w-4 h-4" />
              <span>{tOrder("tabMaterials")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="operations" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <Factory className="w-4 h-4" />
              <span>{tOrder("tabOperations")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="timeline" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{tOrder("tabTimeline")}</span>
            </TabsTrigger>

            <TabsTrigger 
              value="history" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-none h-10 text-xs px-3.5 font-medium gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>{tOrder("tabHistory")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs font-medium gap-1.5 text-zinc-600 dark:text-zinc-300 rounded cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tOrder("printSpec")}</span>
            </Button>

            <Button 
              onClick={handleSave}
              variant="outline" 
              size="sm" 
              className="h-7 border-zinc-300 dark:border-zinc-700 text-xs font-medium gap-1.5 rounded cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>{tOrder("save")}</span>
            </Button>

            <Button 
              onClick={handleSaveAndClose}
              size="sm" 
              className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-none rounded cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{tOrder("postAndClose")}</span>
            </Button>
          </div>
        </div>


        {/* Tab 1: Overview Form */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
          {/* Document Status Header */}
          <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">{tOrder("status")}:</span>
                <Select value={formData.status} onValueChange={(val: any) => val && handleFieldChange("status", val)}>
                  <SelectTrigger className="h-6 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded-full px-2.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="In Production">In Production</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">{tOrder("priority")}:</span>
                <Select value={formData.priority} onValueChange={(val: any) => val && handleFieldChange("priority", val)}>
                  <SelectTrigger className="h-6 text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-full px-2.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5 text-zinc-500">
                <span className="font-medium">Site:</span>
                <Badge variant="outline" className="font-semibold text-[10px] bg-zinc-50 dark:bg-zinc-800">
                  {formData.site}
                </Badge>
              </div>

              {data.orderType && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-medium">{tOrder("orderType") || "Type"}:</span>
                  <Badge variant="outline" className={cn("h-6 text-[11px] font-semibold px-2.5", 
                    data.orderType === "Sample" ? "bg-amber-50 text-amber-700 border-amber-300" :
                    "bg-blue-50 text-blue-700 border-blue-300"
                  )}>
                    {data.orderType === "Sample" ? "SAMPLE ORDER" : "PRODUCTION ORDER"}
                  </Badge>
                </div>
              )}
              
              {data.linkedOrderId && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-medium">{tOrder("linkedOrder") || "Linked CO"}:</span>
                  <Badge variant="outline" className="h-6 text-[11px] font-semibold bg-violet-50 text-violet-700 border-violet-300 cursor-pointer hover:bg-violet-100">
                    {data.linkedOrderId}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
              <span>{tOrder("docNo")}: <strong className="text-zinc-800 dark:text-zinc-200">{data.docNo || tab.id}</strong></span>
              <span>{tOrder("created")}: 2026-09-29 14:20</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Card 1: General Requisites & Customer */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>{tOrder("docRequisites")}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">CRM Linked</Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{tOrder("customerLabel")}</label>
                  <FieldCombobox
                    value={formData.customer}
                    onChange={(val) => handleFieldChange("customer", val)}
                    options={MOCK_CUSTOMERS.map((c) => ({ value: c, label: c }))}
                    placeholder="Select customer..."
                    searchPlaceholder="Search customer..."
                    className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                    popoverClassName="w-auto min-w-[280px]"
                  />
                </div>

                <div>
                  <label className="text-zinc-500 font-medium block mb-1">{tOrder("productLabel")}</label>
                  <Input 
                    value={formData.product} 
                    onChange={(e) => handleFieldChange("product", e.target.value)}
                    className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-medium" 
                    placeholder="Product specification name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("quantityLabel")}</label>
                    <Input 
                      type="number"
                      value={formData.quantity} 
                      onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                      className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono font-semibold" 
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("unitLabel")}</label>
                    <Select value={formData.unit} onValueChange={(val: any) => val && handleFieldChange("unit", val)}>
                      <SelectTrigger className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">pcs (Pieces)</SelectItem>
                        <SelectItem value="sets">sets (Sets)</SelectItem>
                        <SelectItem value="rolls">rolls (Rolls)</SelectItem>
                        <SelectItem value="m">m (Meters)</SelectItem>
                        <SelectItem value="kg">kg (Kilograms)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Production Equipment & Scheduling */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-blue-600" />
                  <span>Technology & Facility Route</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                  {formData.department}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Production Site Combobox */}
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs block mb-1">
                      Production Site
                    </label>
                    <Popover open={isSiteComboboxOpen} onOpenChange={setIsSiteComboboxOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isSiteComboboxOpen}
                            className="w-full h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                          />
                        }
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {activeSite.name}
                          </span>
                        </div>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                        <Command className="w-full">
                          <CommandInput placeholder="Search production site..." className="h-8 text-xs" />
                          <CommandList className="max-h-60">
                            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No site found.</CommandEmpty>
                            <CommandGroup heading="Manufacturing Facilities">
                              {SITE_OPTIONS.map((site) => {
                                const isSelected = formData.site === site.id || formData.site === site.name;
                                return (
                                  <CommandItem
                                    key={site.id}
                                    value={`${site.name} ${site.label} ${site.facilities}`}
                                    onSelect={() => {
                                      handleFieldChange("site", site.id);
                                      setIsSiteComboboxOpen(false);
                                    }}
                                    className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2"
                                  >
                                    <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-foreground">{site.name}</span>
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● Online</span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground">{site.label}</p>
                                      <p className="text-[10px] text-zinc-400">{site.location}</p>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Technology Combobox */}
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs block mb-1">
                      Technology
                    </label>
                    <Popover open={isTechComboboxOpen} onOpenChange={setIsTechComboboxOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isTechComboboxOpen}
                            className="w-full h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                          />
                        }
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-medium shrink-0", activeTech.badgeClass)}>
                            {activeTech.id}
                          </Badge>
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {activeTech.name}
                          </span>
                        </div>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[360px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                        <Command className="w-full">
                          <CommandInput placeholder="Search printing technology..." className="h-8 text-xs" />
                          <CommandList className="max-h-64">
                            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No technology found.</CommandEmpty>
                            <CommandGroup heading="Production Technologies">
                              {TECHNOLOGY_OPTIONS.map((tech) => {
                                const isSelected = formData.department === tech.id;
                                return (
                                  <CommandItem
                                    key={tech.id}
                                    value={`${tech.id} ${tech.name} ${tech.description}`}
                                    onSelect={() => {
                                      handleDepartmentChange(tech.id);
                                      setIsTechComboboxOpen(false);
                                    }}
                                    className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2"
                                  >
                                    <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground">{tech.name}</span>
                                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-normal", tech.badgeClass)}>
                                          {tech.equipmentCount} lines
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">{tech.description}</p>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Assigned Press Machine Combobox */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs">
                      {tOrder("machineLabel")}
                    </label>
                    <span className="text-[10px] text-muted-foreground">Equipment line assignment</span>
                  </div>
                  <Popover open={isMachineComboboxOpen} onOpenChange={setIsMachineComboboxOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={isMachineComboboxOpen}
                          className="w-full h-8 justify-between px-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                        />
                      }
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                        <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                          {activeMachine?.name || formData.pressMachine}
                        </span>
                        {activeMachine && (
                          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline font-normal">
                            • {activeMachine.format} ({activeMachine.speed})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 shadow-none font-normal">
                          Ready
                        </Badge>
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[460px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                      <Command className="w-full">
                        <CommandInput placeholder="Search machine name, model, speed, format..." className="h-8 text-xs" />
                        <CommandList className="max-h-72">
                          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No machine matching search.</CommandEmpty>
                          
                          {/* Active Technology Machines */}
                          <CommandGroup heading={`${formData.department} Presses & Equipment`}>
                            {currentDeptMachines.map((mach) => {
                              const isSelected = formData.pressMachine === mach.name || formData.pressMachine === mach.code;
                              return (
                                <CommandItem
                                  key={mach.code}
                                  value={`${mach.code} ${mach.name} ${mach.department} ${mach.features} ${mach.format}`}
                                  onSelect={() => {
                                    handleFieldChange("pressMachine", mach.name);
                                    setIsMachineComboboxOpen(false);
                                  }}
                                  className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5"
                                >
                                  <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-foreground">{mach.name}</span>
                                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">{mach.code}</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                                      <span className="font-medium text-zinc-600 dark:text-zinc-300">{mach.format}</span>
                                      <span>•</span>
                                      <span>{mach.speed}</span>
                                      <span>•</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">● {mach.status}</span>
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>

                          {/* Other Department Machines */}
                          {MACHINE_OPTIONS.filter((m) => m.department !== formData.department).length > 0 && (
                            <CommandGroup heading="Other Departments Equipment">
                              {MACHINE_OPTIONS.filter((m) => m.department !== formData.department).map((mach) => {
                                const isSelected = formData.pressMachine === mach.name || formData.pressMachine === mach.code;
                                return (
                                  <CommandItem
                                    key={mach.code}
                                    value={`${mach.code} ${mach.name} ${mach.department} ${mach.features} ${mach.format}`}
                                    onSelect={() => {
                                      handleFieldChange("pressMachine", mach.name);
                                      handleDepartmentChange(mach.department);
                                      setIsMachineComboboxOpen(false);
                                    }}
                                    className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5 opacity-80 hover:opacity-100"
                                  >
                                    <Check className={cn("mt-0.5 h-4 w-4 text-blue-600 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-foreground">{mach.name}</span>
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">{mach.department}</Badge>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">{mach.features}</p>
                                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                        <span>{mach.format}</span>
                                        <span>•</span>
                                        <span>{mach.speed}</span>
                                      </div>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("shiftStartLabel")}</label>
                    <DatePicker 
                      value={formData.startDate} 
                      onChange={(val) => handleFieldChange("startDate", val)}
                      className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" 
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 font-medium block mb-1">{tOrder("deadlineLabel")}</label>
                    <DatePicker 
                      value={formData.deadline} 
                      onChange={(val) => handleFieldChange("deadline", val)}
                      className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Order Photo & Sample Reference */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5 flex flex-col">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Order Photo & Sample Proof</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shadow-none">
                  Visual Standard
                </Badge>
              </div>

              <div className="flex-1 flex flex-col justify-between space-y-3">
                {formData.photoUrl ? (
                  <div className="space-y-2.5">
                    <div className="relative group w-full h-44 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-950/5 dark:bg-zinc-950 flex items-center justify-center">
                      <img 
                        src={formData.photoUrl} 
                        alt="Order Sample Proof" 
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 text-xs gap-1.5 shadow-md cursor-pointer"
                          onClick={() => window.open(formData.photoUrl, "_blank")}
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Full Screen</span>
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 text-xs gap-1.5 shadow-md cursor-pointer"
                          onClick={() => document.getElementById("wo-photo-change-input")?.click()}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Change Photo</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 font-medium">
                          Approved Match Proof
                        </Badge>
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Color Reference Standard</span>
                      </div>
                      <span className="font-mono text-[10px]">Target: ISO 12647-2</span>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all flex-1 min-h-[140px]"
                    onClick={() => document.getElementById("wo-photo-change-input")?.click()}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">No Sample Photo Attached</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Click to upload physical sample or packaging mockup</p>
                  </div>
                )}

                <input 
                  type="file" 
                  id="wo-photo-change-input" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      handleFieldChange("photoUrl", url);
                      setTabUnsaved(tab.id, true);
                    }
                  }} 
                />
              </div>
            </div>

            {/* Card: Attached Files & Technical Documents */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5 flex flex-col">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  <span>Attached Files & Documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono shadow-none">
                    {orderAttachments.length} file{orderAttachments.length === 1 ? "" : "s"}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 gap-1 rounded cursor-pointer"
                    onClick={() => document.getElementById("wo-doc-upload-input")?.click()}
                  >
                    <Plus className="w-3 h-3 text-blue-600" />
                    <span>Attach</span>
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between space-y-2.5">
                {orderAttachments.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {orderAttachments.map((file) => (
                      <Attachment 
                        key={file.id} 
                        size="sm" 
                        className="w-full flex items-center justify-between p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors shadow-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <AttachmentMedia variant={file.isImage ? "image" : "icon"} className="w-7 h-7 rounded shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                          </AttachmentMedia>
                          <AttachmentContent className="min-w-0 flex-1">
                            <AttachmentTitle className="text-xs font-medium truncate block text-zinc-900 dark:text-zinc-100">{file.name}</AttachmentTitle>
                            <AttachmentDescription className="text-[10px] text-zinc-500 block">
                              {file.size} • {file.type} • {file.date}
                            </AttachmentDescription>
                          </AttachmentContent>
                        </div>
                        <AttachmentActions className="shrink-0 ml-2 flex items-center gap-1">
                          <AttachmentAction 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Simple download trigger
                              const link = document.createElement("a");
                              link.href = "#";
                              link.download = file.name;
                              link.click();
                            }}
                            className="h-6 w-6 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded cursor-pointer"
                            title="Download document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </AttachmentAction>
                          <AttachmentAction 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderAttachments(prev => prev.filter(f => f.id !== file.id));
                              setTabUnsaved(tab.id, true);
                            }}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive text-zinc-400 rounded cursor-pointer"
                            title="Remove attachment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </AttachmentAction>
                        </AttachmentActions>
                      </Attachment>
                    ))}
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-md p-6 text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-blue-50/30 transition-all flex-1 flex flex-col items-center justify-center min-h-[140px]"
                    onClick={() => document.getElementById("wo-doc-upload-input")?.click()}
                  >
                    <UploadCloud className="w-6 h-6 text-zinc-400 mb-1.5" />
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No attachments linked yet</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Click to attach vector die-lines, contracts, or customer specifications</p>
                  </div>
                )}

                <input 
                  type="file" 
                  id="wo-doc-upload-input" 
                  className="hidden" 
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files).map((f, i) => ({
                        id: `att-new-${Date.now()}-${i}`,
                        name: f.name,
                        size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
                        type: f.type || "Document",
                        date: new Date().toISOString().slice(0, 16).replace("T", " "),
                        isImage: f.type.startsWith("image/"),
                      }));
                      setOrderAttachments(prev => [...prev, ...newFiles]);
                      setTabUnsaved(tab.id, true);
                    }
                  }} 
                />
              </div>
            </div>

            {/* Card 3: Linked Recipe & Live Materials Availability */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  <span>Recipe Specification & Stock Availability</span>
                </div>
                {hasShortage ? (
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900">
                    Stock Deficit
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900">
                    All Materials In Stock
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {/* Active BOM Recipe / Specification Combobox */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-600 dark:text-zinc-400 font-medium text-xs">
                      Master BOM Specification
                    </label>
                    <span className="text-[10px] text-muted-foreground">Searchable recipe catalog</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Popover open={isSpecComboboxOpen} onOpenChange={setIsSpecComboboxOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isSpecComboboxOpen}
                            className="flex-1 h-9 justify-between px-3 text-xs bg-zinc-50 dark:bg-zinc-950 font-normal shadow-none border-zinc-200 dark:border-zinc-800 hover:border-blue-400 transition-colors"
                          />
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                          <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 shrink-0">
                            {activeSpec?.code || formData.recipe}
                          </Badge>
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {activeSpec?.name || formData.recipe}
                          </span>
                          {activeSpec && (
                            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                              ({activeSpec.materialsCount} mats • {activeSpec.department})
                            </span>
                          )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </PopoverTrigger>

                      <PopoverContent className="w-[460px] p-0 shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
                        <Command className="w-full">
                          <CommandInput placeholder="Search code, name, technology, or materials..." className="h-9 text-xs" />
                          <CommandList className="max-h-72">
                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No specification matching search.</CommandEmpty>
                            
                            {(["Offset", "Flexo", "Jacquard", "Post-press"] as const).map((dept) => {
                              const deptSpecs = MASTER_SPECIFICATIONS.filter((s) => s.department === dept);
                              if (deptSpecs.length === 0) return null;

                              return (
                                <CommandGroup key={dept} heading={`${dept} Technology Specifications`}>
                                  {deptSpecs.map((spec) => {
                                    const isSelected = formData.recipe === spec.code;
                                    return (
                                      <CommandItem
                                        key={spec.code}
                                        value={`${spec.code} ${spec.name} ${spec.department} ${spec.description}`}
                                        onSelect={() => {
                                          handleFieldChange("recipe", spec.code);
                                          if (formData.department !== spec.department) {
                                            handleDepartmentChange(spec.department);
                                          }
                                          setIsSpecComboboxOpen(false);
                                        }}
                                        className="py-2 px-2.5 cursor-pointer text-xs flex items-start gap-2.5"
                                      >
                                        <div className="mt-0.5 shrink-0">
                                          <Check className={cn("h-4 w-4 text-blue-600", isSelected ? "opacity-100" : "opacity-0")} />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold text-[11px] text-blue-600 dark:text-blue-400">
                                              {spec.code}
                                            </span>
                                            <span className="font-medium text-foreground truncate">
                                              {spec.name}
                                            </span>
                                            <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 shrink-0 font-normal">
                                              {spec.department}
                                            </Badge>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                                            {spec.description}
                                          </p>
                                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                                            <span>{spec.materialsCount} raw materials</span>
                                            <span>•</span>
                                            <span>{spec.estimatedCost} standard batch</span>
                                          </div>
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

                    {/* Quick Open Master Specification Tab Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-2.5 gap-1.5 text-xs shrink-0 border-zinc-200 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                      title="Open Master Product Specification document"
                      onClick={() => {
                        const specToOpen = activeSpec || MASTER_SPECIFICATIONS[0];
                        openTab({
                          id: specToOpen.id,
                          title: `${specToOpen.id}: ${specToOpen.name}`,
                          type: "product-spec",
                          module: "production",
                          documentData: {
                            id: specToOpen.id,
                            name: specToOpen.name,
                            code: specToOpen.code,
                            department: specToOpen.department,
                            desc: specToOpen.description,
                          },
                        });
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">Open Spec</span>
                    </Button>
                  </div>
                </div>

                {/* Materials Mini Table using official shadcn Table */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-background">
                  <Table className="text-xs">
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <TableRow className="hover:bg-transparent border-b border-zinc-200 dark:border-zinc-800">
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground">Material</TableHead>
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground">Required</TableHead>
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground">In Stock</TableHead>
                        <TableHead className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRecipeMaterials.map((mat, i) => {
                        const isShortage = mat.req > mat.stock;
                        return (
                          <TableRow 
                            key={i} 
                            className={cn(
                              "border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-muted/40",
                              isShortage && "bg-red-50/40 dark:bg-red-950/20"
                            )}
                          >
                            <TableCell className="p-2 px-2.5 font-medium text-zinc-900 dark:text-zinc-100">{mat.name}</TableCell>
                            <TableCell className="p-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">{mat.req.toLocaleString()} {mat.unit}</TableCell>
                            <TableCell className="p-2 px-2.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">{mat.stock.toLocaleString()} {mat.unit}</TableCell>
                            <TableCell className="p-2 px-2.5 text-right">
                              {isShortage ? (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900 text-[9px] px-1 py-0 shadow-none font-medium">Shortage</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 text-[9px] px-1 py-0 shadow-none font-medium">Available</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLevel3Tab(tab.id, "materials")}
                  className="w-full h-7 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-900"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Full Materials BOM & Stock Allocations</span>
                </Button>
              </div>
            </div>

            {/* Card 4: Financial Calculation & Costing */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3.5">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span>Cost Structure & Production Margin</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                  Margin: 38.4%
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-xs space-y-1.5">
                  <div className="flex justify-between text-zinc-500">
                    <span>Raw Materials Allocation:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">$6,420.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Press Run & Machine Time:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">$4,100.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Post-press & Finishing Operations:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">$2,830.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Packaging & Multi-site Logistics:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">$1,500.00</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-baseline font-bold text-sm">
                    <span className="text-zinc-900 dark:text-zinc-100">Document Total:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-base">${formData.priceTotal.toLocaleString("en-US")} {formData.currency}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 bg-zinc-100/60 dark:bg-zinc-900 p-2 rounded">
                  <div>Payment Terms: <span className="font-semibold text-zinc-700 dark:text-zinc-300">Net 30</span></div>
                  <div>Invoicing: <span className="font-semibold text-emerald-600">Pre-authorized</span></div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Materials BOM (Glide Data Grid) */}
        <TabsContent value="materials" className="flex-1 overflow-hidden p-0 m-0 h-full flex flex-col data-[state=inactive]:hidden">
          <BomMaterialsGrid tabId={tab.id} department={formData.department} />
        </TabsContent>

        {/* Tab 3: Technological Route (Glide Data Grid) */}
        <TabsContent value="operations" className="flex-1 overflow-hidden p-0 m-0 flex flex-col bg-background">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div 
                className="flex-1 w-full h-full relative" 
                id="glide-wo-route-grid-root"
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
                  freezeColumns={1}
                  smoothScrollX={true}
                  smoothScrollY={true}
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
                <span>Add Routing Step</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ins</span>
              </ContextMenuItem>

              {hasSelectedOp && (
                <ContextMenuItem onClick={() => handleOpenEditOperation(selectedOpRow)} className="gap-2 cursor-pointer">
                  <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit Step Details</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">Enter</span>
                </ContextMenuItem>
              )}

              {hasSelectedOp && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem 
                    onClick={() => {
                      const updated = [...operations];
                      updated[selectedOpRow].status = updated[selectedOpRow].status === "Finished" ? "In Progress" : "Finished";
                      setOperations(updated);
                      setTabUnsaved(tab.id, true);
                    }} 
                    className="gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Toggle Finished Status</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleDeleteSelectedOperation} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Step</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">Del</span>
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 p-4 m-0 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Shift Allocation & Timeline
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">Est. Time: 4h 15m</Badge>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-none text-[10px]">On Schedule</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Shift Assignment Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3 col-span-1">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Assignment Details
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Assigned Shift</label>
                  <Select defaultValue="day-shift">
                    <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day-shift">Day Shift (08:00 - 20:00)</SelectItem>
                      <SelectItem value="night-shift">Night Shift (20:00 - 08:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Shift Lead / Operator</label>
                  <Select defaultValue="k-anderson">
                    <SelectTrigger className="h-7 text-xs bg-zinc-50 dark:bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="k-anderson">K. Anderson (Senior Pressman)</SelectItem>
                      <SelectItem value="m-ivanova">M. Ivanova</SelectItem>
                      <SelectItem value="a-petrov">A. Petrov</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-500 font-medium block mb-1 text-[11px]">Machine</label>
                  <Input disabled value={formData.pressMachine} className="h-7 text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-500" />
                </div>
              </div>
            </div>

            {/* Timeline Visualizer Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-4 col-span-1 lg:col-span-2">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs pb-2 border-b border-zinc-100 dark:border-zinc-800 flex justify-between">
                <span>Execution Timeline (14:00 - 18:15)</span>
                <span className="text-zinc-500 font-mono text-[10px]">Current Time: 15:30</span>
              </div>
              
              <div className="space-y-1">
                {/* Visual Bar */}
                <div className="h-6 w-full rounded overflow-hidden flex font-mono text-[9px] font-bold text-white text-center leading-6 shadow-inner">
                  <div className="bg-amber-500 w-[15%]" title="Setup / Make-Ready: 40 mins">SETUP</div>
                  <div className="bg-blue-600 w-[75%] relative" title="Print Run: 3 hrs 20 mins">
                    RUN
                    {/* Current time indicator */}
                    <div className="absolute top-0 bottom-0 left-[45%] w-0.5 bg-black/50 z-10 shadow-[0_0_2px_rgba(255,255,255,0.5)]"></div>
                  </div>
                  <div className="bg-emerald-500 w-[10%]" title="Wash-up / Maintenance: 15 mins">WASH</div>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>14:00</span>
                  <span>14:40</span>
                  <span className="text-blue-600 font-bold ml-10">15:30 (Now)</span>
                  <span>18:00</span>
                  <span>18:15</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Completed (Est)</span>
                  <span className="font-mono text-sm font-semibold text-emerald-600">38%</span>
                </div>
                <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Impressions</span>
                  <span className="font-mono text-sm font-semibold text-blue-600">1,900 / 5,000</span>
                </div>
                <div className="p-2 border border-zinc-100 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Speed</span>
                  <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">12,500 sh/hr</span>
                </div>
              </div>
            </div>
          </div>

          {/* Downtime / Delay Log */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-950 font-semibold border-b border-zinc-200 dark:border-zinc-800 text-xs flex justify-between items-center">
              <span>Shift Event & Downtime Log</span>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 py-0 border-zinc-300">
                Log Event
              </Button>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]">
              <div className="p-2.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">14:00</span>
                  <Badge variant="outline" className="text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200">Setup</Badge>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">Machine setup & plates loaded</span>
                </div>
                <span className="text-zinc-400 font-mono">K. Anderson</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">14:15</span>
                  <Badge variant="outline" className="text-[9px] bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200">Delay</Badge>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium text-red-600 dark:text-red-400">Waiting for paper delivery from warehouse</span>
                </div>
                <span className="text-zinc-400 font-mono">K. Anderson</span>
              </div>
              <div className="p-2.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-12">14:40</span>
                  <Badge variant="outline" className="text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200">Run</Badge>
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">Print run started</span>
                </div>
                <span className="text-zinc-400 font-mono">K. Anderson</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 p-4 m-0">
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-500 font-mono text-[11px]">
            [2026-09-29 14:20:00] Document created by K. Anderson (Prepress Lead)<br/>
            [2026-09-29 15:45:12] Status changed to &quot;Active&quot; by Shift Supervisor<br/>
            [2026-09-29 16:30:00] Material Reservation confirmed in Warehouse DB
          </div>
        </TabsContent>
      </Tabs>

      {/* --- Dialog: Add / Edit Routing Operation in Work Order --- */}
      <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
        <DialogContent className="sm:max-w-[460px] text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <span>{editingOpIndex !== null ? "Edit Routing Operation" : "Add Routing Step to Work Order"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the operation sequence, equipment, operator, and planned run duration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-xs font-medium">Step #</label>
                <Input
                  type="number"
                  step="10"
                  value={opDialogForm.stepNumber}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, stepNumber: parseInt(e.target.value) || 10 }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium">Operation Description *</label>
                <Input
                  value={opDialogForm.name}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-8 text-xs font-medium"
                  placeholder="e.g. 4+4 Offset Printing"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Assigned Machine / Work Center *</label>
              <Input
                value={opDialogForm.machine}
                onChange={(e) => setOpDialogForm((p) => ({ ...p, machine: e.target.value }))}
                className="h-8 text-xs"
                placeholder="e.g. Heidelberg Speedmaster XL 106"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium">Assigned Operator</label>
                <Input
                  value={opDialogForm.operator}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, operator: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Operator name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Planned Duration (hrs)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={opDialogForm.duration}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, duration: parseFloat(e.target.value) || 1 }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium">Progress / Output</label>
                <Input
                  value={opDialogForm.qtyCompleted}
                  onChange={(e) => setOpDialogForm((p) => ({ ...p, qtyCompleted: e.target.value }))}
                  className="h-8 text-xs font-mono"
                  placeholder="e.g. 3,200 / 5,000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Status</label>
                <Select
                  value={opDialogForm.status}
                  onValueChange={(val: any) => val && setOpDialogForm((p) => ({ ...p, status: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Queued">Queued</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Finished">Finished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsOpDialogOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveOperationDialog} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {editingOpIndex !== null ? "Save Changes" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
