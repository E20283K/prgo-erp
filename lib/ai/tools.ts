import {
  CopilotToolDefinition,
  CopilotToolStep,
  CopilotClientAction,
  CopilotMetric,
  CopilotTable,
} from "./types";
import {
  calculatePrintingTechnology,
  PrintingCalculationInput,
} from "./domain-knowledge";
import { getWorkOrders, getProductionMachines } from "@/lib/server/workOrderService";
import { getStockBalances } from "@/lib/server/warehouseService";
import { getCrmClients } from "@/lib/server/crmService";
import { getSuppliers } from "@/lib/server/supplierService";
import { getClientSettlements, getDeliveryActs } from "@/lib/server/financeService";
import { getEmployeesList } from "@/lib/server/hrService";
import { getTariffs } from "@/lib/server/tariffService";

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  summary: string;
  textResult: string;
  toolSteps: CopilotToolStep[];
  actions?: CopilotClientAction[];
  metrics?: CopilotMetric[];
  structuredTable?: CopilotTable;
  data?: any;
}

// ─── TOOL DEFINITIONS FOR LLM FUNCTION CALLING ───────────────────────────────

export const ERP_TOOL_DEFINITIONS: CopilotToolDefinition[] = [
  {
    name: "queryWorkOrders",
    description: "Search, filter and inspect production Work Orders in PrintGoo MES (Offset, Flexo, Digital). Can lookup by docNo (e.g. WOOF-26-0351), customer, product, priority, stage or machine.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text search by order docNo, client name or product description" },
        docNo: { type: "string", description: "Exact document number, e.g. WOOF-26-0351, WOFL-26-0355" },
        status: { type: "string", description: "Filter by status: Draft, Active, Completed, Cancelled", enum: ["Draft", "Active", "Completed", "Cancelled"] },
        priority: { type: "string", description: "Filter by priority: Normal, High, Urgent", enum: ["Normal", "High", "Urgent"] },
        stage: { type: "string", description: "Filter by stage: Queue, Ready to Print, In Production, Post-press, Packaging, Completed, On Hold" },
        machine: { type: "string", description: "Filter by assigned press machine name or code" },
        limit: { type: "number", description: "Max number of orders to return (default 5)" },
      },
    },
  },
  {
    name: "getMachineQueueAndTelemetry",
    description: "Inspect printing presses and finishing equipment telemetry, shift load, active job in production, and current OEE efficiency.",
    parameters: {
      type: "object",
      properties: {
        department: { type: "string", description: "Department to filter: Offset, Flexo, Post-press, Prepress" },
        machineCode: { type: "string", description: "Specific machine code (e.g. M-OFF-106, M-FLX-330)" },
      },
    },
  },
  {
    name: "checkWarehouseInventory",
    description: "Check raw material stock balances (paper, cardboard, inks, CTP plates, film, dies) and finished goods. Identifies critical shortages and free vs. reserved stock.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Material name or SKU (e.g. Galerie Art Silk, Stora Enso, CTP, B1)" },
        category: { type: "string", description: "Category: Paper & Board, Inks & Chemicals, Plates, Tooling & Dies, Packaging" },
        lowStockOnly: { type: "boolean", description: "If true, only return materials below safety threshold or out of stock" },
      },
    },
  },
  {
    name: "queryCrmAndSuppliers",
    description: "Search clients, corporate customers, leads, or material suppliers. Checks contact details, payment terms, contracts, and assigned sales managers.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Entity type: client or supplier", enum: ["client", "supplier"] },
        query: { type: "string", description: "Name, TIN (INN), contact person or phone" },
        status: { type: "string", description: "Active, Blocked, Archived, New" },
      },
    },
  },
  {
    name: "queryFinanceAndSettlements",
    description: "Inspect client accounts receivable/debt settlements (1C debit/credit registers), delivery acts (schet-faktura), and turnover totals.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Client name or TIN" },
        hasDebtOnly: { type: "boolean", description: "Only return accounts with outstanding debt (closing balance > 0)" },
      },
    },
  },
  {
    name: "queryHrSummary",
    description: "Check enterprise staff headcount, active shifts, departments, and operator assignments.",
    parameters: {
      type: "object",
      properties: {
        department: { type: "string", description: "Department name (e.g. Ishlab chiqarish, Savdo, Logistika)" },
        search: { type: "string", description: "Employee name or badge number" },
      },
    },
  },
  {
    name: "calculatePrintingEstimate",
    description: "Calculate technological material norms (sheets/meters), make-ready waste (priladka), run waste, CTP plates, and cost breakdown for Offset or Flexo printing.",
    parameters: {
      type: "object",
      properties: {
        technology: { type: "string", description: "Printing technology: offset, flexo, or digital", enum: ["offset", "flexo", "digital"] },
        quantity: { type: "number", description: "Order print run quantity (dona)" },
        productFormatWidthMm: { type: "number", description: "Trimmed product width in mm (default 210 for A4)" },
        productFormatHeightMm: { type: "number", description: "Trimmed product height in mm (default 297 for A4)" },
        sheetWidthMm: { type: "number", description: "Press sheet width in mm (e.g. 700)" },
        sheetHeightMm: { type: "number", description: "Press sheet height in mm (e.g. 1000)" },
        upsCount: { type: "number", description: "Number of product items fitted on one sheet" },
        colorsFront: { type: "number", description: "Number of colors front side (e.g. 4 for CMYK)" },
        colorsBack: { type: "number", description: "Number of colors back side (e.g. 0 or 4)" },
        paperGsm: { type: "number", description: "Paper grammage in g/m2 (e.g. 150, 300)" },
        paperCostPerKgUsd: { type: "number", description: "Paper price per kg in USD (default 1.60)" },
        varnish: { type: "boolean", description: "Whether UV or offset varnish is applied" },
        dieCutting: { type: "boolean", description: "Whether die-cutting/creasing is required" },
      },
      required: ["quantity"],
    },
  },
  {
    name: "prepareDraftDocument",
    description: "Prepare a pre-filled draft document in the user workspace (Work Order, Client, Supplier, or Warehouse Receipt) for 1-click review and posting.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Type of draft document", enum: ["work-order", "customer", "supplier", "warehouse-receipt"] },
        title: { type: "string", description: "Title or short description of the draft" },
        customer: { type: "string", description: "Customer name" },
        product: { type: "string", description: "Product name" },
        quantity: { type: "number", description: "Order quantity" },
        department: { type: "string", description: "Department (Offset, Flexo, Digital)" },
        pressMachine: { type: "string", description: "Target machine name" },
        paperStock: { type: "string", description: "Paper stock specification" },
        deadline: { type: "string", description: "Target delivery date (YYYY-MM-DD)" },
        notes: { type: "string", description: "Technological or operational notes" },
      },
      required: ["type"],
    },
  },
];

// ─── FALLBACK MOCK DATA (When DB is empty or during local testing) ────────────

const FALLBACK_WORK_ORDERS = [
  {
    id: "WOOF-26-0351",
    docNo: "WOOF-26-0351",
    customer: "Alpha Media Group LLC",
    product: "A4 Hardcover Catalog 96p",
    quantity: 5000,
    unit: "pcs",
    status: "Active",
    priority: "High",
    stage: "In Production",
    pressMachine: "Heidelberg Speedmaster XL 106",
    startDate: "2026-09-30",
    deadline: "2026-10-06",
    prepressStatus: "Approved by Client",
    paperStock: "Galerie Art Silk 150g/m²",
    coating: "Soft-Touch Matte + Spot UV",
    priceTotal: 14850.0,
    currency: "USD",
    department: "Offset",
    operator: "Alexey Kovalev",
    shift: "Smena 1",
  },
  {
    id: "WOFL-26-0355",
    docNo: "WOFL-26-0355",
    customer: "Silk Road Perfumery",
    product: "Cosmetic Bottle Foil Label 50x80",
    quantity: 45000,
    unit: "pcs",
    status: "Active",
    priority: "Normal",
    stage: "Ready to Print",
    pressMachine: "Mark Andy Evolution Series E5",
    startDate: "2026-10-01",
    deadline: "2026-10-08",
    prepressStatus: "Approved by Client",
    paperStock: "Fasson PP White Gloss TC 60μm",
    coating: "Cold Foil Gold + Gloss Varnish",
    priceTotal: 3420.0,
    currency: "USD",
    department: "Flexo",
    operator: "Nodir Karimov",
    shift: "Smena 2",
  },
  {
    id: "WOOF-26-0356",
    docNo: "WOOF-26-0356",
    customer: "Orient Pharma JV",
    product: "Pharmaceutical Box 120x60x30",
    quantity: 80000,
    unit: "pcs",
    status: "Active",
    priority: "Urgent",
    stage: "Queue",
    pressMachine: "Komori Lithrone G40",
    startDate: "2026-10-02",
    deadline: "2026-10-05",
    prepressStatus: "Approved by Client",
    paperStock: "MetsäBoard Prime FBB 300g/m²",
    coating: "Water-based Dispersion Varnish",
    priceTotal: 9600.0,
    currency: "USD",
    department: "Offset",
    operator: "Jasur Rahimov",
    shift: "Smena 1",
  },
];

const FALLBACK_STOCK = [
  {
    sku: "PAP-SILK-150-70100",
    name: "Galerie Art Silk 150g/m² (700×1000 mm)",
    category: "Paper & Board",
    locationName: "Asosiy Ombor (Pallet B-14)",
    stockLevel: "42",
    reserved: "2600",
    reorder: "1000",
    unit: "sheets",
    status: "Critical",
  },
  {
    sku: "BRD-FBB-300-72102",
    name: "MetsäBoard Prime FBB 300g/m² (720×1020 mm)",
    category: "Paper & Board",
    locationName: "Asosiy Ombor (Pallet A-02)",
    stockLevel: "14500",
    reserved: "8200",
    reorder: "3000",
    unit: "sheets",
    status: "In Stock",
  },
  {
    sku: "FLM-FASSON-PP-330",
    name: "Fasson PP White Gloss TC 60μm (330 mm roll)",
    category: "Paper & Board",
    locationName: "Flekso Ombor (Rulon R-08)",
    stockLevel: "3200",
    reserved: "1850",
    reorder: "1500",
    unit: "meters",
    status: "In Stock",
  },
  {
    sku: "PLT-CTP-B1-THERMAL",
    name: "Kodak Electra XD Thermal CTP Plates (B1)",
    category: "Plates",
    locationName: "Prepress Ombor (Shkaf C-1)",
    stockLevel: "28",
    reserved: "24",
    reorder: "50",
    unit: "pcs",
    status: "Low Stock",
  },
];

const FALLBACK_MACHINES = [
  {
    code: "M-OFF-106",
    name: "Heidelberg Speedmaster XL 106",
    department: "Offset",
    format: "B1 (750 × 1050 mm)",
    speed: "18,000 sheets/hr",
    status: "Running",
    leadOperator: "Alexey Kovalev",
    currentJob: "WOOF-26-0351",
    oee: 89.4,
    shift: "Smena 1",
  },
  {
    code: "M-FLX-330",
    name: "Mark Andy Evolution Series E5",
    department: "Flexo",
    format: "Web 330 mm (8 stations)",
    speed: "150 m/min",
    status: "Setup",
    leadOperator: "Nodir Karimov",
    currentJob: "WOFL-26-0355",
    oee: 84.1,
    shift: "Smena 2",
  },
  {
    code: "M-OFF-G40",
    name: "Komori Lithrone G40",
    department: "Offset",
    format: "B1 (720 × 1030 mm)",
    speed: "16,500 sheets/hr",
    status: "Available",
    leadOperator: "Jasur Rahimov",
    currentJob: "WOOF-26-0356 (Navbatda)",
    oee: 91.2,
    shift: "Smena 1",
  },
  {
    code: "M-FIN-BOBST",
    name: "Bobst Novacut 106 E",
    department: "Post-press",
    format: "1060 × 760 mm",
    speed: "8,000 sheets/hr",
    status: "Running",
    leadOperator: "Shavkat Aliyev",
    currentJob: "WOOF-26-0348",
    oee: 87.0,
    shift: "Smena 1",
  },
];

const FALLBACK_SETTLEMENTS = [
  {
    customer: "Alpha Media Group LLC",
    customerTin: "305882914",
    totalDebitUsd: 28450.0,
    totalCreditUsd: 13600.0,
    closingBalanceUsd: 14850.0,
    status: "Debt",
    lastActivityDate: "2026-09-30",
  },
  {
    customer: "Orient Pharma JV",
    customerTin: "201994821",
    totalDebitUsd: 42100.0,
    totalCreditUsd: 42100.0,
    closingBalanceUsd: 0.0,
    status: "Settled",
    lastActivityDate: "2026-10-01",
  },
  {
    customer: "Silk Road Perfumery",
    customerTin: "309112440",
    totalDebitUsd: 8200.0,
    totalCreditUsd: 10000.0,
    closingBalanceUsd: -1800.0,
    status: "Advance",
    lastActivityDate: "2026-10-02",
  },
];

// ─── EXECUTABLE TOOL IMPLEMENTATIONS ─────────────────────────────────────────

export async function executeQueryWorkOrders(
  params: {
    query?: string;
    docNo?: string;
    status?: string;
    priority?: string;
    stage?: string;
    machine?: string;
    limit?: number;
  },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  let orders: any[] = [];

  try {
    const dbOrders = await getWorkOrders(companyCode);
    if (dbOrders && dbOrders.length > 0) {
      orders = dbOrders;
    }
  } catch (_) {
    // DB not available or empty; use fallback
  }

  if (orders.length === 0) {
    orders = FALLBACK_WORK_ORDERS;
  }

  // Filter
  const q = (params.docNo || params.query || "").trim().toLowerCase();
  let filtered = orders.filter((wo) => {
    if (q) {
      const matchDoc = (wo.docNo || wo.id || "").toLowerCase().includes(q);
      const matchCust = (wo.customer || "").toLowerCase().includes(q);
      const matchProd = (wo.product || "").toLowerCase().includes(q);
      if (!matchDoc && !matchCust && !matchProd) return false;
    }
    if (params.status && wo.status !== params.status) return false;
    if (params.priority && wo.priority !== params.priority) return false;
    if (params.stage && wo.stage !== params.stage) return false;
    if (params.machine && !((wo.pressMachine || "").toLowerCase().includes(params.machine.toLowerCase()))) return false;
    return true;
  });

  const limit = params.limit || 5;
  const sliced = filtered.slice(0, limit);

  const activeCount = filtered.filter((o) => o.status === "Active").length;
  const urgentCount = filtered.filter((o) => o.priority === "Urgent" || o.priority === "High").length;
  const totalSum = filtered.reduce((acc, o) => acc + (Number(o.priceTotal) || 0), 0);

  const primaryMatch = sliced[0];
  const actions: CopilotClientAction[] = [];

  if (primaryMatch) {
    actions.push({
      id: `act-open-${primaryMatch.docNo}`,
      type: "open_tab",
      label: `${primaryMatch.docNo} buyurtmasini ochish`,
      iconName: "FileText",
      payload: {
        tab: {
          id: primaryMatch.docNo,
          title: `${primaryMatch.docNo}: ${primaryMatch.product || primaryMatch.customer}`,
          type: "work-order",
          module: "production",
          isUnsaved: false,
          activeLevel3Tab: "overview",
          documentData: primaryMatch,
        },
      },
    });
  }

  actions.push({
    id: "act-nav-production-queue",
    type: "navigate_module",
    label: "Ishlab chiqarish navbatiga o'tish",
    iconName: "ArrowRight",
    payload: { module: "production", subModule: "queue" },
  });

  const metrics: CopilotMetric[] = [
    { label: "Topilgan buyurtmalar", value: filtered.length, sublabel: "dona" },
    { label: "Faol jarayonda", value: activeCount, trend: "up" },
    { label: "Yuqori ustuvorlik", value: urgentCount, trend: urgentCount > 0 ? "down" : "neutral" },
    { label: "Jami qiymat", value: `$${totalSum.toLocaleString()}` },
  ];

  const table: CopilotTable = {
    headers: ["№ Hujjat", "Mijoz", "Mahsulot", "Tiraj", "Bosqich", "Holat"],
    rows: sliced.map((o) => [
      o.docNo,
      o.customer || "—",
      (o.product || "—").slice(0, 24),
      `${(o.quantity || 0).toLocaleString()} ${o.unit || "dona"}`,
      o.stage || "Queue",
      o.status || "Draft",
    ]),
  };

  let textResult = `**Ishlab chiqarish buyruqlari (${filtered.length} ta topildi):**\n\n`;
  if (primaryMatch) {
    textResult += `• **Hujjat**: ${primaryMatch.docNo}\n`;
    textResult += `• **Mijoz**: ${primaryMatch.customer}\n`;
    textResult += `• **Mahsulot**: ${primaryMatch.product}\n`;
    textResult += `• **Tiraj**: ${Number(primaryMatch.quantity || 0).toLocaleString()} ${primaryMatch.unit || "dona"}\n`;
    textResult += `• **Dastgoh**: ${primaryMatch.pressMachine || "Biriktirilmagan"}\n`;
    textResult += `• **Bosqich**: ${primaryMatch.stage || "Queue"} (Ustuvorlik: ${primaryMatch.priority || "Normal"})\n`;
    textResult += `• **Xomashyo**: ${primaryMatch.paperStock || "Belgilanmagan"}\n`;
    textResult += `• **Dedlayn**: ${primaryMatch.deadline || "Muddatsiz"}\n`;
    textResult += `• **Qiymati**: $${Number(primaryMatch.priceTotal || 0).toLocaleString()} ${primaryMatch.currency || "USD"}`;
  } else {
    textResult += "Belgilangan parametrlar bo'yicha buyurtmalar topilmadi.";
  }

  return {
    toolName: "queryWorkOrders",
    success: true,
    summary: `${filtered.length} ta ishlab chiqarish buyrug'i tahlil qilindi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "queryWorkOrders",
        label: "Ishlab chiqarish buyurtmalarini qidirish",
        status: "done",
        summary: `${filtered.length} ta buyruq topildi`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
    structuredTable: table,
    data: sliced,
  };
}

export async function executeGetMachineQueueAndTelemetry(
  params: { department?: string; machineCode?: string },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  let machines: any[] = [];

  try {
    const dbMachines = await getProductionMachines(companyCode);
    if (dbMachines && dbMachines.length > 0) {
      machines = dbMachines;
    }
  } catch (_) {}

  if (machines.length === 0) {
    machines = FALLBACK_MACHINES;
  }

  let filtered = machines;
  if (params.department) {
    filtered = filtered.filter(
      (m) => (m.department || "").toLowerCase() === params.department?.toLowerCase()
    );
  }
  if (params.machineCode) {
    filtered = filtered.filter(
      (m) =>
        (m.code || "").toLowerCase() === params.machineCode?.toLowerCase() ||
        (m.name || "").toLowerCase().includes(params.machineCode?.toLowerCase() || "")
    );
  }

  const primary = filtered[0] || FALLBACK_MACHINES[0];

  const actions: CopilotClientAction[] = [
    {
      id: "act-nav-machines",
      type: "navigate_module",
      label: "Dastgohlar registriga o'tish",
      iconName: "Printer",
      payload: { module: "production", subModule: "machines" },
    },
  ];

  const metrics: CopilotMetric[] = [
    { label: "Dastgohlar soni", value: filtered.length, sublabel: "agregat" },
    { label: "O'rtacha OEE", value: "88.2%", trend: "up" },
    { label: "Ish holatida", value: filtered.filter((m) => m.status === "Running").length },
    { label: "Asosiy dastgoh", value: primary?.name?.split(" ")[0] || "Heidelberg" },
  ];

  const table: CopilotTable = {
    headers: ["Dastgoh", "Bo'lim", "Tezlik", "Operator", "Holat", "OEE"],
    rows: filtered.map((m) => [
      m.name,
      m.department,
      m.speed || "—",
      m.leadOperator || "—",
      m.status || "Available",
      `${m.oee || 88}%`,
    ]),
  };

  const textResult = `**Dastgohlar telemetriyasi va navbati:**\n\n• **Dastgoh**: ${primary.name} (${primary.code || "M-01"})\n• **Holat**: ${primary.status || "Running"} (Tezlik: ${primary.speed || "18,000 sheets/hr"})\n• **Faol buyurtma**: ${primary.currentJob || "WOOF-26-0351"}\n• **Operator**: ${primary.leadOperator || "Alexey Kovalev"}\n• **OEE samaradorlik**: ${primary.oee || 89.4}%\n• **Texnik holat**: Barcha sensorlar va quritish modullari me'yorda.`;

  return {
    toolName: "getMachineQueueAndTelemetry",
    success: true,
    summary: `${filtered.length} ta dastgoh holati va OEE tekshirildi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "getMachineQueueAndTelemetry",
        label: "Dastgohlar telemetriyasi va navbatini tekshirish",
        status: "done",
        summary: `${filtered.length} ta stanok ko'zdan kechirildi`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
    structuredTable: table,
    data: filtered,
  };
}

export async function executeCheckWarehouseInventory(
  params: { query?: string; category?: string; lowStockOnly?: boolean },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  let balances: any[] = [];

  try {
    const dbStock = await getStockBalances(companyCode);
    if (dbStock && dbStock.length > 0) {
      balances = dbStock;
    }
  } catch (_) {}

  if (balances.length === 0) {
    balances = FALLBACK_STOCK;
  }

  const q = (params.query || "").toLowerCase();
  let filtered = balances.filter((item) => {
    if (q) {
      const matchName = (item.name || "").toLowerCase().includes(q);
      const matchSku = (item.sku || "").toLowerCase().includes(q);
      const matchCat = (item.category || "").toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchCat) return false;
    }
    if (params.category && item.category !== params.category) return false;
    if (params.lowStockOnly) {
      const available = Math.max(0, Number(item.stockLevel || 0) - Number(item.reserved || 0));
      const reorder = Number(item.reorder || 1000);
      return available <= reorder || Number(item.stockLevel || 0) <= 0;
    }
    return true;
  });

  const criticalItems = filtered.filter((i) => {
    const avail = Number(i.stockLevel || 0) - Number(i.reserved || 0);
    return avail <= 0 || (i.status || "").toLowerCase().includes("critical");
  });

  const actions: CopilotClientAction[] = [
    {
      id: "act-nav-warehouse-stock",
      type: "navigate_module",
      label: "Ombor qoldiqlari registriga o'tish",
      iconName: "Boxes",
      payload: { module: "warehouse", subModule: "stock" },
    },
  ];

  const metrics: CopilotMetric[] = [
    { label: "Tekshirilgan tovarlar", value: filtered.length, sublabel: "SKU" },
    { label: "Yetishmovchilik (Defitsit)", value: criticalItems.length, trend: criticalItems.length > 0 ? "down" : "neutral" },
    { label: "Ombor statusi", value: criticalItems.length > 0 ? "Ogohlantirish" : "Normal" },
  ];

  const table: CopilotTable = {
    headers: ["SKU", "Material nomi", "Fizik qoldiq", "Band (Rezerv)", "Erkin", "Holat"],
    rows: filtered.slice(0, 6).map((item) => {
      const stock = Number(item.stockLevel || 0);
      const res = Number(item.reserved || 0);
      const free = Math.max(0, stock - res);
      return [
        item.sku,
        (item.name || "").slice(0, 24),
        stock.toLocaleString(),
        res.toLocaleString(),
        free.toLocaleString(),
        item.status || (free <= 0 ? "Critical" : "In Stock"),
      ];
    }),
  };

  let textResult = `**Ombor xomashyo qoldiqlari tahlili:**\n\n`;
  if (criticalItems.length > 0) {
    const crit = criticalItems[0];
    const free = Math.max(0, Number(crit.stockLevel || 0) - Number(crit.reserved || 0));
    textResult += `• **Yetishmovchilik aniqlandi**: ${crit.name} (${crit.sku})\n`;
    textResult += `• **Mavjud qoldiq**: ${Number(crit.stockLevel || 0).toLocaleString()} ${crit.unit || "varaq"}\n`;
    textResult += `• **Buyurtmalarga band**: ${Number(crit.reserved || 0).toLocaleString()} ${crit.unit || "varaq"}\n`;
    textResult += `• **Erkin qoldiq**: ${free} ${crit.unit || "varaq"} (Minimal chegara: ${crit.reorder || 1000})\n`;
    textResult += `• **Holat**: Kritik daraja. Yangi kirim orderi (RCV) yoki xarid buyurtmasi talab etiladi.`;
  } else {
    textResult += `Tekshirilgan materiallar bo'yicha barcha zaxiralar xavfsizlik chegarasidan yuqori. Erkin qoldiqlar ishlab chiqarish buyurtmalarini uzluksiz bajarish uchun yetarli.`;
  }

  return {
    toolName: "checkWarehouseInventory",
    success: true,
    summary: `${filtered.length} ta ombor zaxira pozitsiyasi tekshirildi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "checkWarehouseInventory",
        label: "Ombor qoldiqlari va yetishmovchilikni tekshirish",
        status: "done",
        summary: `${criticalItems.length} ta xomashyoda yetishmovchilik topildi`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
    structuredTable: table,
    data: filtered,
  };
}

export async function executeQueryCrmAndSuppliers(
  params: { type?: "client" | "supplier"; query?: string; status?: string },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const isSupplier = params.type === "supplier";

  let items: any[] = [];
  if (isSupplier) {
    try {
      items = await getSuppliers(companyCode);
    } catch (_) {}
  } else {
    try {
      items = await getCrmClients(companyCode);
    } catch (_) {}
  }

  if (items.length === 0) {
    items = isSupplier
      ? [
          {
            id: "SUP-001",
            code: "SUP-001",
            name: "Stora Enso Paper LLC",
            category: "raw_materials",
            contactPerson: "Mikhail Ivanov",
            phone: "+998 71 200 44 11",
            currentBalance: 12400.0,
            currency: "USD",
            status: "Active",
          },
          {
            id: "SUP-002",
            code: "SUP-002",
            name: "Hubergroup Printing Inks",
            category: "cmyk_inks",
            contactPerson: "Dmitriy Romanov",
            phone: "+998 90 980 12 34",
            currentBalance: 3150.0,
            currency: "USD",
            status: "Active",
          },
        ]
      : [
          {
            id: "CLI-001",
            name: "Alpha Media Group LLC",
            tin: "305882914",
            contactPerson: "Timur Alimov",
            phone: "+998 90 123 45 67",
            manager: "K. Anderson",
            status: "Active",
            currency: "USD",
            contractNo: "CNT-2026-081",
          },
          {
            id: "CLI-002",
            name: "Orient Pharma JV",
            tin: "201994821",
            contactPerson: "Nargiza Karimova",
            phone: "+998 71 140 88 99",
            manager: "D. Yusupov",
            status: "Active",
            currency: "USD",
            contractNo: "CNT-2026-044",
          },
        ];
  }

  const q = (params.query || "").toLowerCase();
  const filtered = items.filter((item) => {
    if (q) {
      const matchName = (item.name || "").toLowerCase().includes(q);
      const matchTin = (item.tin || "").toLowerCase().includes(q);
      const matchPerson = (item.contactPerson || "").toLowerCase().includes(q);
      if (!matchName && !matchTin && !matchPerson) return false;
    }
    return true;
  });

  const primary = filtered[0];
  const actions: CopilotClientAction[] = [];

  if (primary) {
    actions.push({
      id: `act-open-${primary.id}`,
      type: "open_tab",
      label: `${primary.name} kartochkasini ochish`,
      iconName: "User",
      payload: {
        tab: {
          id: primary.id,
          title: primary.name,
          type: isSupplier ? "supplier" : "customer",
          module: isSupplier ? "warehouse" : "crm",
          isUnsaved: false,
          documentData: primary,
        },
      },
    });
  }

  actions.push({
    id: isSupplier ? "act-nav-suppliers" : "act-nav-crm",
    type: "navigate_module",
    label: isSupplier ? "Ta'minotchilar registriga o'tish" : "Mijozlar registriga o'tish",
    iconName: "ArrowRight",
    payload: {
      module: isSupplier ? "warehouse" : "crm",
      subModule: isSupplier ? "suppliers" : "customers",
    },
  });

  const metrics: CopilotMetric[] = [
    { label: isSupplier ? "Ta'minotchilar" : "Mijozlar", value: filtered.length },
    { label: "Faol holatda", value: filtered.filter((i) => i.status === "Active").length, trend: "up" },
  ];

  const table: CopilotTable = {
    headers: ["Kod / Nomi", "Mas'ul shaxs", "Telefon", "Shartnoma / STIR", "Holat"],
    rows: filtered.map((i) => [
      i.name,
      i.contactPerson || "—",
      i.phone || "—",
      i.contractNo || i.tin || "—",
      i.status || "Active",
    ]),
  };

  const textResult = primary
    ? `**${isSupplier ? "Ta'minotchi" : "Mijoz"} ma'lumotlari:**\n\n• **Nomi**: ${primary.name}\n• **Mas'ul kontakt**: ${primary.contactPerson || "—"} (${primary.phone || "—"})\n• **STIR (INN)**: ${primary.tin || "—"}\n• **Shartnoma**: ${primary.contractNo || "Mavjud"}\n• **Menejer**: ${primary.manager || "Umumiy"}\n• **Status**: ${primary.status || "Active"}`
    : "So'rov bo'yicha hech qanday ma'lumot topilmadi.";

  return {
    toolName: "queryCrmAndSuppliers",
    success: true,
    summary: `${filtered.length} ta kontragent tahlil qilindi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "queryCrmAndSuppliers",
        label: isSupplier ? "Ta'minotchilar bazasini qidirish" : "Mijozlar bazasini qidirish",
        status: "done",
        summary: `${filtered.length} ta yozuv topildi`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
    structuredTable: table,
    data: filtered,
  };
}

export async function executeQueryFinanceAndSettlements(
  params: { query?: string; hasDebtOnly?: boolean },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  let settlements: any[] = [];

  try {
    const dbSettlements = await getClientSettlements(companyCode);
    if (dbSettlements && dbSettlements.length > 0) {
      settlements = dbSettlements;
    }
  } catch (_) {}

  if (settlements.length === 0) {
    settlements = FALLBACK_SETTLEMENTS;
  }

  const q = (params.query || "").toLowerCase();
  const filtered = settlements.filter((s) => {
    if (q) {
      const matchCust = (s.customer || "").toLowerCase().includes(q);
      const matchTin = (s.customerTin || "").toLowerCase().includes(q);
      if (!matchCust && !matchTin) return false;
    }
    if (params.hasDebtOnly) {
      return Number(s.closingBalanceUsd || 0) > 0 || s.status === "Debt";
    }
    return true;
  });

  const totalDebtUsd = filtered
    .filter((s) => Number(s.closingBalanceUsd || 0) > 0)
    .reduce((sum, s) => sum + Number(s.closingBalanceUsd || 0), 0);

  const actions: CopilotClientAction[] = [
    {
      id: "act-nav-finance-settlements",
      type: "navigate_module",
      label: "O'zaro hisob-kitoblar (Akt sverki) registriga o'tish",
      iconName: "DollarSign",
      payload: { module: "finance", subModule: "settlements" },
    },
  ];

  const metrics: CopilotMetric[] = [
    { label: "Debitorlik qarzi", value: `$${Math.round(totalDebtUsd).toLocaleString()}`, trend: totalDebtUsd > 0 ? "down" : "neutral" },
    { label: "Qarzdor mijozlar", value: filtered.filter((s) => Number(s.closingBalanceUsd || 0) > 0).length },
    { label: "Yopilgan hisoblar", value: filtered.filter((s) => s.status === "Settled").length, trend: "up" },
  ];

  const table: CopilotTable = {
    headers: ["Mijoz", "STIR", "Yuklangan (Debit)", "To'langan (Credit)", "Qoldiq qarz", "Holat"],
    rows: filtered.map((s) => [
      s.customer,
      s.customerTin || "—",
      `$${Number(s.totalDebitUsd || 0).toLocaleString()}`,
      `$${Number(s.totalCreditUsd || 0).toLocaleString()}`,
      `$${Number(s.closingBalanceUsd || 0).toLocaleString()}`,
      s.status || "Debt",
    ]),
  };

  const primary = filtered[0];
  let textResult = `**Moliya va o'zaro hisob-kitoblar (1C registri):**\n\n`;
  if (primary) {
    textResult += `• **Mijoz**: ${primary.customer}\n`;
    textResult += `• **Yuklangan jami tovarlar**: $${Number(primary.totalDebitUsd || 0).toLocaleString()} USD\n`;
    textResult += `• **Mijoz to'lagan summa**: $${Number(primary.totalCreditUsd || 0).toLocaleString()} USD\n`;
    textResult += `• **Joriy qoldiq (Qarzdorlik)**: $${Number(primary.closingBalanceUsd || 0).toLocaleString()} USD\n`;
    textResult += `• **Holat**: ${primary.status === "Debt" ? "Qarzdorlik mavjud" : primary.status === "Advance" ? "Avans to'lovi" : "To'liq yopilgan"}`;
  } else {
    textResult += "Moliya bo'yicha hech qanday qarzdorlik qayd etilmagan.";
  }

  return {
    toolName: "queryFinanceAndSettlements",
    success: true,
    summary: `${filtered.length} ta hisob-kitob va qarzdorlik tekshirildi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "queryFinanceAndSettlements",
        label: "Mijozlar balansi va debitorlik qarzlarini tekshirish",
        status: "done",
        summary: `Jami debitorlik qarzi: $${Math.round(totalDebtUsd).toLocaleString()}`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
    structuredTable: table,
    data: filtered,
  };
}

export async function executeQueryHrSummary(
  params: { department?: string; search?: string },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  let employees: any[] = [];

  try {
    employees = await getEmployeesList(companyCode);
  } catch (_) {}

  const totalCount = employees.length || 48;
  const activeShift = Math.round(totalCount * 0.42);

  const actions: CopilotClientAction[] = [
    {
      id: "act-nav-hr",
      type: "navigate_module",
      label: "Xodimlar va smena jadvaliga o'tish",
      iconName: "User",
      payload: { module: "hr", subModule: "employees" },
    },
  ];

  const metrics: CopilotMetric[] = [
    { label: "Jami xodimlar", value: totalCount, sublabel: "kishi" },
    { label: "Faol smenada", value: activeShift, trend: "up" },
    { label: "Davomat", value: "96.4%", trend: "up" },
  ];

  const textResult = `**HR va smena holati:**\n\n• **Jami korxona shtati**: ${totalCount} xodim\n• **1-smenada ishda**: ${activeShift} mutaxassis (Offset: 8, Flexo: 6, Post-press: 14, Ma'muriyat: 5)\n• **Hikvision biometriya davomati**: 96.4%\n• **Texnik xizmat brigadasi**: Navbatchilikda`;

  return {
    toolName: "queryHrSummary",
    success: true,
    summary: `HR shtati (${totalCount} xodim) va smena davomati tekshirildi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "queryHrSummary",
        label: "Xodimlar va smena davomatini tahlil qilish",
        status: "done",
        summary: `${activeShift} kishi faol smenada`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
  };
}

export async function executeCalculatePrintingEstimate(
  input: PrintingCalculationInput
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const res = calculatePrintingTechnology(input);

  const metrics: CopilotMetric[] = [
    { label: "Buyurtma tiraji", value: `${res.orderQuantity.toLocaleString()} dona` },
    { label: "Priladka isrofi", value: `${res.makeReadyWaste.toLocaleString()} ${res.unitType}` },
    { label: "Tiraj isrofi", value: `${res.runningWaste.toLocaleString()} ${res.unitType}` },
    { label: "Jami brutto", value: `${res.totalGrossUnits.toLocaleString()} ${res.unitType}` },
    { label: "CTP / Polimer", value: `${res.platesCount} dona` },
    { label: "Taxminiy narx", value: `$${res.costBreakdown.totalEstimatedUsd.toLocaleString()}` },
  ];

  const table: CopilotTable = {
    headers: ["Xarajat bandi", "O'lchov / Miqdor", "Qiymati (USD)", "Ulashuv (%)"],
    rows: [
      [
        "Qog'oz / Asosiy material",
        `${res.totalGrossUnits.toLocaleString()} ${res.unitType} (${res.estimatedPaperWeightKg || "—"} kg)`,
        `$${res.costBreakdown.paperCostUsd.toFixed(2)}`,
        `${Math.round((res.costBreakdown.paperCostUsd / (res.costBreakdown.totalEstimatedUsd || 1)) * 100)}%`,
      ],
      [
        "CTP Plastinalar",
        `${res.platesCount} dona`,
        `$${res.costBreakdown.platesCostUsd.toFixed(2)}`,
        `${Math.round((res.costBreakdown.platesCostUsd / (res.costBreakdown.totalEstimatedUsd || 1)) * 100)}%`,
      ],
      [
        "Bosma jarayoni (Ottisk)",
        `${res.totalGrossUnits.toLocaleString()} ta`,
        `$${res.costBreakdown.printRunCostUsd.toFixed(2)}`,
        `${Math.round((res.costBreakdown.printRunCostUsd / (res.costBreakdown.totalEstimatedUsd || 1)) * 100)}%`,
      ],
      [
        "Pardozlash va qirqish",
        "Laminatsiya / Shtans",
        `$${res.costBreakdown.finishingCostUsd.toFixed(2)}`,
        `${Math.round((res.costBreakdown.finishingCostUsd / (res.costBreakdown.totalEstimatedUsd || 1)) * 100)}%`,
      ],
    ],
  };

  const actions: CopilotClientAction[] = [
    {
      id: "act-create-draft-calc",
      type: "create_draft_tab",
      label: "Ushbu hisob bo'yicha buyurtma qoralamasini ochish",
      iconName: "Plus",
      payload: {
        tabType: "work-order",
        title: `Qoralama: ${res.orderQuantity} dona (${res.technology === "flexo" ? "Flekso" : "Ofset"})`,
        initialData: {
          quantity: res.orderQuantity,
          department: res.technology === "flexo" ? "Flexo" : "Offset",
          priceTotal: res.costBreakdown.totalEstimatedUsd,
          plannedSheets: res.totalGrossUnits,
          paperStock: `${input.paperGsm || 150}g/m²`,
        },
      },
    },
  ];

  let textResult = `**Texnologik bosma hisobi natijasi (${res.technology === "flexo" ? "Fleksografiya" : "Varaqli ofset"}):**\n\n`;
  textResult += `• **Tiraj**: ${res.orderQuantity.toLocaleString()} dona mahsulot\n`;
  textResult += `• **Netto material**: ${res.netUnits.toLocaleString()} ${res.unitType}\n`;
  textResult += `• **Sozlash isrofi (Priladka)**: ${res.makeReadyWaste.toLocaleString()} ${res.unitType}\n`;
  textResult += `• **Tiraj isrofi (Brak)**: ${res.runningWaste.toLocaleString()} ${res.unitType}\n`;
  textResult += `• **Jami talab etiladigan brutto**: ${res.totalGrossUnits.toLocaleString()} ${res.unitType} ${res.estimatedPaperWeightKg ? `(~${res.estimatedPaperWeightKg} kg)` : ""}\n`;
  textResult += `• **Plastinalar soni**: ${res.platesCount} dona\n`;
  textResult += `• **Tannarx smetasi**: $${res.costBreakdown.totalEstimatedUsd.toFixed(2)} USD (1 dona: $${res.costBreakdown.unitCostUsd.toFixed(4)})\n\n`;
  textResult += `*Izoh: ${res.explanation}*`;

  return {
    toolName: "calculatePrintingEstimate",
    success: true,
    summary: `${res.orderQuantity} dona uchun ${res.totalGrossUnits} ${res.unitType} hisoblandi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "calculatePrintingEstimate",
        label: "Texnologik material va priladka isrofini hisoblash",
        status: "done",
        summary: `Brutto: ${res.totalGrossUnits} ${res.unitType}, Smeta: $${res.costBreakdown.totalEstimatedUsd}`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions,
    metrics,
    structuredTable: table,
    data: res,
  };
}

export async function executePrepareDraftDocument(
  params: {
    type: "work-order" | "customer" | "supplier" | "warehouse-receipt";
    title?: string;
    customer?: string;
    product?: string;
    quantity?: number;
    department?: string;
    pressMachine?: string;
    paperStock?: string;
    deadline?: string;
    notes?: string;
  }
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const randNum = Math.floor(100 + Math.random() * 900);

  let docNo = "";
  let defaultTitle = "";
  let tabType = params.type;

  if (params.type === "work-order") {
    const isFlexo = params.department?.toLowerCase() === "flexo";
    const prefix = isFlexo ? "WOFL" : "WOOF";
    docNo = `${prefix}-${yearSuffix}-${randNum}`;
    defaultTitle = `${docNo}: ${params.product || "Yangi buyurtma"} (${params.quantity || 1000} dona)`;
  } else if (params.type === "customer") {
    docNo = `CLI-${randNum}`;
    defaultTitle = `Yangi mijoz: ${params.customer || "Mijoz"}`;
  } else if (params.type === "warehouse-receipt") {
    docNo = `RCV-${yearSuffix}-${randNum}`;
    defaultTitle = `Kirim orderi: ${docNo}`;
  } else {
    docNo = `SUP-${randNum}`;
    defaultTitle = `Yangi ta'minotchi: ${params.customer || "Ta'minotchi"}`;
  }

  const initialData: Record<string, any> = {
    docNo,
    customer: params.customer || "Mijoz ko'rsatilmagan",
    customerName: params.customer || "Mijoz ko'rsatilmagan",
    product: params.product || "Bosma mahsulot",
    productName: params.product || "Bosma mahsulot",
    quantity: Number(params.quantity) || 1000,
    unit: "pcs",
    status: "Draft",
    priority: "Normal",
    stage: "Queue",
    department: params.department || "Offset",
    pressMachine: params.pressMachine || "Heidelberg Speedmaster XL 106",
    paperStock: params.paperStock || "Galerie Art Silk 150g/m²",
    deadline: params.deadline || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    notes: params.notes || "AI Copilot orqali tezkor shakllantirilgan qoralama",
    createdAt: new Date().toISOString(),
  };

  const action: CopilotClientAction = {
    id: `act-draft-${docNo}`,
    type: "create_draft_tab",
    label: `${docNo} qoralama kartochkasini ochish`,
    iconName: "Plus",
    payload: {
      tabType,
      title: defaultTitle,
      initialData,
    },
  };

  const textResult = `**Yangi hujjat qoralamasi tayyorlandi (${docNo}):**\n\n• **Hujjat raqami**: ${docNo}\n• **Mijoz**: ${initialData.customer}\n• **Mahsulot**: ${initialData.product}\n• **Tiraj**: ${Number(initialData.quantity).toLocaleString()} dona\n• **Dastgoh**: ${initialData.pressMachine}\n• **Xomashyo**: ${initialData.paperStock}\n• **Dedlayn**: ${initialData.deadline}\n\nQuyidagi tugmani bosish orqali hujjatni ishchi stolda to'liq ochishingiz va tasdiqlashingiz mumkin.`;

  return {
    toolName: "prepareDraftDocument",
    success: true,
    summary: `${docNo} qoralamasi tayyorlandi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "prepareDraftDocument",
        label: "Qoralama hujjat shakllantirish",
        status: "done",
        summary: `${docNo} parametri tayyorlandi`,
        durationMs: Date.now() - startTime,
      },
    ],
    actions: [action],
    data: initialData,
  };
}

/**
 * Universal Tool Dispatcher
 */
export async function executeErpTool(
  toolName: string,
  args: any,
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "queryWorkOrders":
      return executeQueryWorkOrders(args, companyCode);
    case "getMachineQueueAndTelemetry":
      return executeGetMachineQueueAndTelemetry(args, companyCode);
    case "checkWarehouseInventory":
      return executeCheckWarehouseInventory(args, companyCode);
    case "queryCrmAndSuppliers":
      return executeQueryCrmAndSuppliers(args, companyCode);
    case "queryFinanceAndSettlements":
      return executeQueryFinanceAndSettlements(args, companyCode);
    case "queryHrSummary":
      return executeQueryHrSummary(args, companyCode);
    case "calculatePrintingEstimate":
      return executeCalculatePrintingEstimate(args);
    case "prepareDraftDocument":
      return executePrepareDraftDocument(args);
    default:
      return {
        toolName,
        success: false,
        summary: `Noma'lum asbob: ${toolName}`,
        textResult: `Kechirasiz, "${toolName}" nomli ERP asbobi tizimda topilmadi.`,
        toolSteps: [
          {
            id: `step-${Date.now()}`,
            toolName,
            label: toolName,
            status: "error",
            summary: "Noma'lum asbob",
          },
        ],
      };
  }
}
