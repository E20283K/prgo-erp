export interface MasterSpecification {
  id: string;
  code: string;
  name: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  description: string;
  materialsCount: number;
  estimatedCost: string;
  unit: string;
}

export interface SiteOption {
  id: string;
  name: string;
  label: string;
  location: string;
  facilities: string;
  status: string;
}

export interface TechOption {
  id: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  name: string;
  code: string;
  description: string;
  badgeClass: string;
  equipmentCount: number;
}

export interface MachineOption {
  code: string;
  name: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  speed: string;
  format: string;
  features: string;
  status: string;
  isAvailable: boolean;
}

export interface RouteStep {
  id: string;
  stepNumber: number;
  name: string;
  machine: string;
  operator: string;
  duration: number;
  qtyCompleted: string;
  status: "Queued" | "In Progress" | "Finished";
}

export interface ShiftEvent {
  id: string;
  opId: string;
  time: string;
  type: "Setup" | "Run" | "Delay" | "Maintenance" | "QC";
  note: string;
  operator: string;
}

export interface OrderAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  isImage?: boolean;
  /** Public or blob URL of the file contents (used for preview & download) */
  url?: string;
}

export interface ProductionMilestone {
  id: string;
  name: string;
  department: string;
  status: "Pending" | "In Progress" | "Done" | "Issue";
  assignedTo?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface WorkOrderFormData {
  customer: string;
  product: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  site: string;
  recipe: string;
  quantity: number;
  unit: string;
  status: string;
  priority: string;
  pressMachine: string;
  startDate: string;
  deadline: string;
  paperStock: string;
  coating: string;
  priceTotal: number;
  currency: string;
  photoUrl: string;
  milestones: ProductionMilestone[];
  // Physical Item Specifications from planned Client Order
  itemCategory?: string;
  width?: number;
  height?: number;
  dimensionUnit?: string;
  cornerType?: string;
  bleed?: number;
  attachments?: OrderAttachment[];
  sizes?: { id: string; size: string; quantity: number }[];
}

export const FLOOR_OPERATORS = [
  "Prepress Dept",
  "Press Dept",
  "Finishing Dept",
  "Warehouse Dept",
  "K. Anderson (Prepress)",
  "M. Ivanova (Press)",
  "A. Becker (Lamination)",
  "S. Petrov (Die-cut)",
];

export const MOCK_CUSTOMERS = [
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

export const MACHINE_MAP: Record<string, string[]> = {
  Offset: ["Heidelberg XL 106", "Komori Lithrone G40", "Heidelberg SX 74"],
  Flexo: ["Mark Andy Performance", "Nilpeter FA-Line", "Gallus ECS 340"],
  Jacquard: ["Staubli Jacquard Loom", "Muller Martini Loom", "Dornier PTV"],
  "Post-press": ["Kolbus BF 513", "Bobst Novacut 106"]
};

export const RECIPE_MATERIALS: Record<string, { name: string; req: number; unit: string; stock: number }[]> = {
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

export const RECIPE_ROUTES: Record<string, { name: string; machineStr: string }[]> = {
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

export const MASTER_SPECIFICATIONS: MasterSpecification[] = [
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

export const SITE_OPTIONS: SiteOption[] = [
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

export const TECHNOLOGY_OPTIONS: TechOption[] = [
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

export const MACHINE_OPTIONS: MachineOption[] = [
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

export const getInitialOperations = (
  recipeId: string,
  pressMachine: string,
  department: string,
  quantity: number = 5000
): RouteStep[] => {
  const route = RECIPE_ROUTES[recipeId];
  if (route) {
    return route.map((step, index) => ({
      id: String(index + 1),
      stepNumber: (index + 1) * 10,
      name: step.name,
      machine: step.machineStr === "PRESS_MACHINE" ? pressMachine : step.machineStr,
      operator: ["K. Anderson", "M. Ivanova", "A. Becker", "S. Petrov"][index % 4],
      duration: [0.5, 2.5, 1.0, 1.2, 0.8][index % 5],
      qtyCompleted:
        index === 0
          ? `${quantity.toLocaleString()} / ${quantity.toLocaleString()}`
          : index === 1
          ? `3,200 / ${quantity.toLocaleString()}`
          : `0 / ${quantity.toLocaleString()}`,
      status: index === 0 ? "Finished" : index === 1 ? "In Progress" : "Queued",
    }));
  }
  // Fallback if recipe not found
  if (department === "Flexo") {
    return [
      { id: "1", stepNumber: 10, name: "Flexo Plate Making", machine: "Esko CDI Crystal", operator: "K. Anderson", duration: 0.5, qtyCompleted: "12 / 12 sets", status: "Finished" },
      { id: "2", stepNumber: 20, name: "Roll-to-Roll Flexo Printing", machine: pressMachine, operator: "M. Ivanova", duration: 3.5, qtyCompleted: "12,000 / 25,000 m", status: "In Progress" },
      { id: "3", stepNumber: 30, name: "Slitting & Rewinding", machine: "Rotoflex Slitter", operator: "S. Petrov", duration: 1.5, qtyCompleted: "0 / 25,000 m", status: "Queued" }
    ];
  }
  if (department === "Jacquard") {
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
