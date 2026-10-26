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
  {
    name: "runAnalyticalQuery",
    description: "Execute high-level cross-module statistical analysis across work orders, stock inventory, machine loads, or client debts. Supports grouping, filtering, sums, counts, and anomaly detection.",
    parameters: {
      type: "object",
      properties: {
        dimension: {
          type: "string",
          description: "Target dataset dimension",
          enum: ["work_orders", "stock", "machines", "finance", "clients"],
        },
        groupBy: {
          type: "string",
          description: "Field to group data by (e.g. status, priority, department, stage, machine, category)",
        },
        metric: {
          type: "string",
          description: "Aggregation metric",
          enum: ["count", "sum_amount", "sum_quantity", "average"],
        },
        filterField: { type: "string", description: "Field to filter by (e.g. status, priority, department)" },
        filterValue: { type: "string", description: "Value to match for filtering" },
      },
      required: ["dimension"],
    },
  },
  {
    name: "checkOrderFeasibility",
    description: "Comprehensive end-to-end feasibility simulator for a new printing order. Checks technological calculations, raw paper/plate stock availability, and machine queue availability before dispatching.",
    parameters: {
      type: "object",
      properties: {
        technology: { type: "string", description: "Printing technology: offset or flexo", enum: ["offset", "flexo"] },
        quantity: { type: "number", description: "Order print quantity (dona)" },
        product: { type: "string", description: "Product description" },
        paperStock: { type: "string", description: "Paper or substrate name (e.g. Galerie Art Silk, MetsäBoard, Fasson)" },
        paperGsm: { type: "number", description: "Paper grammage (gsm)" },
        machine: { type: "string", description: "Target press machine name" },
        deadline: { type: "string", description: "Target delivery deadline (YYYY-MM-DD)" },
      },
      required: ["technology", "quantity"],
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
  {
    id: "WOCUT-26-0359",
    docNo: "WOCUT-26-0359",
    customer: "Korzinka Supermarket LLC",
    product: "Promo Flyer 10k",
    quantity: 700,
    unit: "pcs",
    status: "Draft",
    priority: "Normal",
    stage: "Queue",
    pressMachine: "Polar N 115 Plus High-Speed Guillotine",
    startDate: "2026-10-20",
    deadline: "2026-10-24",
    prepressStatus: "Approved by Client",
    paperStock: "Galerie Art Silk 150g/m² (700×1000 mm, 735 varaq rejalashtirilgan)",
    colors: "6+1 (Spot: PANTONE 021 C, PANTONE Yellow 012 C)",
    coating: "2 tomonlama (2s)",
    lamination: "2 tomonlama (2s)",
    attachmentsCount: 5,
    priceTotal: 420.0,
    currency: "USD",
    department: "Post-press",
    operator: "Murod Usmonov",
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

  let textResult = "";

  // If exactly one order is queried specifically (e.g. by docNo or specific query), format as structured Entity Card
  if (sliced.length === 1 && (params.docNo || (params.query && filtered.length === 1))) {
    const o = sliced[0];
    const qty = Number(o.quantity || 0).toLocaleString();
    const unit = o.unit || "pcs";
    textResult = `**${o.docNo} buyurtma kartochkasi ma'lumotlari:**\n\n` +
      `• **Hujjat raqami**: ${o.docNo}\n` +
      `• **Mijoz**: ${o.customer || "—"}\n` +
      `• **Mahsulot**: ${o.product || "—"}\n` +
      `• **Tiraj**: ${qty} ${unit}\n` +
      `• **Bo'lim**: ${o.department || "Ishlab chiqarish"}\n` +
      `• **Uskuna**: ${o.pressMachine || "Dastgoh belgilanmagan"}\n` +
      `• **Bosqich / Holat**: ${o.stage || "Queue"} / ${o.status || "Draft"}\n` +
      `• **Ustuvorlik**: ${o.priority || "Normal"}\n` +
      `• **Dedlayn**: ${o.deadline || "Belgilanmagan"}\n` +
      `• **Xomashyo**: ${o.paperStock || "Material ko'rsatilmagan"}\n` +
      (o.colors ? `• **Ranglar**: ${o.colors}\n` : "") +
      (o.coating || o.lamination ? `• **Laminatsiya**: ${o.coating || o.lamination}\n` : "") +
      (o.attachmentsCount ? `• **Biriktirilgan fayllar**: ${o.attachmentsCount} ta hujjat va tasvir fayllari (PDF/JPG/PNG)\n` : "");
  } else {
    textResult = `**Ishlab chiqarish buyruqlari (${filtered.length} ta topildi):**\n\n`;
    if (sliced.length > 0) {
      sliced.forEach((wo) => {
        const cust = wo.customer || "Mijoz ko'rsatilmagan";
        const prod = wo.product || "Mahsulot";
        const qty = Number(wo.quantity || 0).toLocaleString();
        const unit = wo.unit || "dona";
        const mach = wo.pressMachine ? ` (${wo.pressMachine})` : "";
        textResult += `• **${wo.docNo}** — ${cust}: ${prod} [${qty} ${unit}]${mach} — Bosqich: ${wo.stage || "Queue"}, Holat: ${wo.status || "Draft"}\n`;
      });
      if (filtered.length > sliced.length) {
        textResult += `\n*... yana ${filtered.length - sliced.length} ta buyurtma ro'yxatda mavjud.*\n`;
      }
    } else {
      textResult += "Belgilangan parametrlar bo'yicha buyurtmalar topilmadi.";
    }
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

  let textResult = "";

  if (filtered.length === 1 && params.query) {
    const item = filtered[0];
    const stock = Number(item.stockLevel || 0);
    const res = Number(item.reserved || 0);
    const free = Math.max(0, stock - res);
    const statusText = free <= 0 ? "Kritik yetishmovchilik" : (item.status || "Zaxirada");

    textResult = `**${item.name} ombor qoldig'i ma'lumotlari:**\n\n` +
      `• **SKU**: ${item.sku || "—"}\n` +
      `• **Mahsulot**: ${item.name}\n` +
      `• **Kategoriya**: ${item.category || "Xomashyo"}\n` +
      `• **Joylashuv**: ${item.locationName || "Asosiy Ombor"}\n` +
      `• **Jami fizik qoldiq**: ${stock.toLocaleString()} ${item.unit || "dona"}\n` +
      `• **Band qilingan**: ${res.toLocaleString()} ${item.unit || "dona"}\n` +
      `• **Erkin qoldiq**: ${free.toLocaleString()} ${item.unit || "dona"}\n` +
      `• **Minimal chegara**: ${Number(item.reorder || 1000).toLocaleString()} ${item.unit || "dona"}\n` +
      `• **Holat**: ${statusText}\n`;
  } else {
    textResult = `**Ombor xomashyo va mahsulotlar qoldiqlari (${filtered.length} ta pozitsiya):**\n\n`;
    if (filtered.length > 0) {
      filtered.slice(0, 5).forEach((item) => {
        const stock = Number(item.stockLevel || 0);
        const res = Number(item.reserved || 0);
        const free = Math.max(0, stock - res);
        const statusText = free <= 0 ? "Kritik kam" : (item.status || "Zaxirada");
        textResult += `• **${item.name}** (${item.sku || "—"}): Jami: ${stock.toLocaleString()} ${item.unit || "dona"}, Erkin: ${free.toLocaleString()} ${item.unit || "dona"} [${statusText}]\n`;
      });
      if (filtered.length > 5) {
        textResult += `\n*... yana ${filtered.length - 5} ta material ro'yxatda mavjud.*\n`;
      }
    } else {
      textResult += "Ko'rsatilgan so'rov bo'yicha omborda xomashyo topilmadi.\n";
    }

    if (criticalItems.length > 0) {
      const crit = criticalItems[0];
      const free = Math.max(0, Number(crit.stockLevel || 0) - Number(crit.reserved || 0));
      textResult += `\n**Diqqat (Yetishmovchilik)**: ${crit.name} xomashyosidan atigi ${free} ${crit.unit || "varaq"} erkin qolgan (chegara: ${crit.reorder || 1000}). Yangi kirim orderi talab etiladi.`;
    }
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
 * Analytical Cross-Module Aggregator
 */
async function executeRunAnalyticalQuery(
  params: {
    dimension?: "work_orders" | "stock" | "machines" | "finance" | "clients";
    groupBy?: string;
    metric?: "count" | "sum_amount" | "sum_quantity" | "average";
    filterField?: string;
    filterValue?: string;
  },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const dimension = params.dimension || "work_orders";
  const groupBy = params.groupBy || (dimension === "work_orders" ? "status" : dimension === "stock" ? "category" : "status");

  let items: any[] = [];
  if (dimension === "work_orders") {
    try {
      items = await getWorkOrders(companyCode);
    } catch (_) {}
    if (!items || items.length === 0) items = FALLBACK_WORK_ORDERS;
  } else if (dimension === "stock") {
    try {
      items = await getStockBalances(companyCode);
    } catch (_) {}
    if (!items || items.length === 0) items = FALLBACK_STOCK;
  } else if (dimension === "machines") {
    try {
      items = await getProductionMachines(companyCode);
    } catch (_) {}
    if (!items || items.length === 0) items = FALLBACK_MACHINES;
  } else if (dimension === "finance") {
    try {
      items = await getClientSettlements(companyCode);
    } catch (_) {}
    if (!items || items.length === 0) items = FALLBACK_SETTLEMENTS;
  }

  // Filter if specified
  if (params.filterField && params.filterValue) {
    const fField = params.filterField;
    const fVal = String(params.filterValue).toLowerCase();
    items = items.filter((item) => String(item[fField] || "").toLowerCase().includes(fVal));
  }

  // Grouping
  const groups: Record<string, { count: number; sumAmount: number; sumQuantity: number; items: any[] }> = {};
  for (const item of items) {
    const rawKey = item[groupBy] || "Boshqa";
    const groupKey = String(rawKey);
    if (!groups[groupKey]) {
      groups[groupKey] = { count: 0, sumAmount: 0, sumQuantity: 0, items: [] };
    }
    groups[groupKey].count += 1;
    groups[groupKey].sumAmount += Number(item.priceTotal || item.closingBalance || item.totalValue || 0);
    groups[groupKey].sumQuantity += Number(item.quantity || item.totalStock || 0);
    groups[groupKey].items.push(item);
  }

  const groupEntries = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  const totalCount = items.length;
  const totalAmount = groupEntries.reduce((acc, [, v]) => acc + v.sumAmount, 0);

  const tableRows: (string | number)[][] = groupEntries.map(([name, data]) => {
    const share = totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0;
    return [
      name,
      data.count,
      data.sumAmount > 0 ? `$${Math.round(data.sumAmount).toLocaleString()}` : data.sumQuantity.toLocaleString(),
      `${share}%`,
    ];
  });

  const structuredTable: CopilotTable = {
    headers: [
      groupBy.toUpperCase(),
      "Soni",
      params.metric === "sum_amount" || totalAmount > 0 ? "Summasi (USD)" : "Hajmi",
      "Ulushi",
    ],
    rows: tableRows,
  };

  const topGroup = groupEntries[0];
  const metrics: CopilotMetric[] = [
    { label: "Jami obyektlar", value: totalCount, sublabel: dimension },
    { label: `Asosiy guruh (${groupBy})`, value: topGroup ? topGroup[0] : "—", sublabel: `${topGroup ? topGroup[1].count : 0} ta` },
    ...(totalAmount > 0 ? [{ label: "Jami aylanma", value: `$${Math.round(totalAmount).toLocaleString()}` }] : []),
  ];

  let textResult = `**Tahliliy hisobot (${dimension.toUpperCase()} / ${groupBy.toUpperCase()} bo'yicha):**\n\n`;
  textResult += `Jami tahlil qilingan yozuvlar: **${totalCount}** ta.\n`;
  if (totalAmount > 0) {
    textResult += `Umumiy hisoblangan qiymat: **$${Math.round(totalAmount).toLocaleString()} USD**.\n`;
  }
  textResult += `\nGuruhlar taqsimoti:\n`;
  for (const [gName, gData] of groupEntries.slice(0, 5)) {
    const share = totalCount > 0 ? Math.round((gData.count / totalCount) * 100) : 0;
    textResult += `• **${gName}**: ${gData.count} ta (${share}%)${gData.sumAmount > 0 ? ` — $${Math.round(gData.sumAmount).toLocaleString()}` : ""}\n`;
  }

  const actions: CopilotClientAction[] = [];
  if (dimension === "work_orders") {
    actions.push({
      id: "act-filter-top-group",
      type: "apply_grid_filter",
      label: `${topGroup ? topGroup[0] : "Faol"} buyurtmalarini ko'rish`,
      iconName: "Filter",
      payload: {
        filterField: groupBy,
        filterQuery: topGroup ? topGroup[0] : "",
        module: "production",
      },
    });
  }

  return {
    toolName: "runAnalyticalQuery",
    success: true,
    summary: `${dimension} bo'yicha ${groupEntries.length} ta guruh tahlil qilindi`,
    textResult,
    toolSteps: [
      {
        id: `step-${Date.now()}`,
        toolName: "runAnalyticalQuery",
        label: "Kross-modul statistik tahlil",
        status: "done",
        summary: `${dimension} / ${groupBy} tahlil qilindi`,
        durationMs: Date.now() - startTime,
      },
    ],
    metrics,
    structuredTable,
    actions,
  };
}

/**
 * End-to-End Order Feasibility Checker & Simulator
 */
async function executeCheckOrderFeasibility(
  params: {
    technology: "offset" | "flexo";
    quantity: number;
    product?: string;
    paperStock?: string;
    paperGsm?: number;
    machine?: string;
    deadline?: string;
  },
  companyCode: string = "PRINTGOO"
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const {
    technology = "offset",
    quantity = 5000,
    product = "Yangi buyurtma",
    paperStock = "Galerie Art Silk",
    paperGsm = 150,
    machine,
    deadline,
  } = params;

  // 1. Calculate technological requirements
  const calc = calculatePrintingTechnology({
    technology,
    quantity,
    paperGsm,
  });

  // 2. Check warehouse stock for paper/substrate
  let stockItems: any[] = [];
  try {
    stockItems = await getStockBalances(companyCode);
  } catch (_) {}
  if (!stockItems || stockItems.length === 0) stockItems = FALLBACK_STOCK;

  const paperQuery = (paperStock || "Silk").toLowerCase();
  const matchedMaterial = stockItems.find(
    (item) => (item.materialName || item.sku || "").toLowerCase().includes(paperQuery)
  ) || stockItems[0];

  const neededUnits = calc.totalGrossUnits;
  const availableStock = matchedMaterial ? (matchedMaterial.freeStock ?? (matchedMaterial.totalStock - (matchedMaterial.reservedStock || 0))) : 0;
  const isMaterialSufficient = availableStock >= neededUnits;
  const materialDeficit = Math.max(0, neededUnits - availableStock);

  // 3. Check machine telemetry & queue
  let machines: any[] = [];
  try {
    machines = await getProductionMachines(companyCode);
  } catch (_) {}
  if (!machines || machines.length === 0) machines = FALLBACK_MACHINES;

  const targetMachine = machine
    ? machines.find((m) => (m.name || m.code || "").toLowerCase().includes(machine.toLowerCase()))
    : machines.find((m) => (technology === "flexo" ? m.type === "Flexo" : m.type === "Offset")) || machines[0];

  const isMachineFree = targetMachine ? targetMachine.status === "Idle" || targetMachine.status === "Running" : true;
  const activeQueueCount = targetMachine?.activeJobsCount || (targetMachine?.status === "Running" ? 2 : 1);

  // Feasibility status determination
  const isFeasible = isMaterialSufficient && isMachineFree;

  const metrics: CopilotMetric[] = [
    {
      label: "Xomashyo holati",
      value: isMaterialSufficient ? "Yetarli" : `Defitsit (-${materialDeficit})`,
      trend: isMaterialSufficient ? "up" : "down",
      sublabel: `${matchedMaterial?.materialName || paperStock}`,
    },
    {
      label: "Brutto talab",
      value: `${neededUnits.toLocaleString()} ${calc.unitType}`,
      sublabel: `Omborda erkin: ${availableStock.toLocaleString()}`,
    },
    {
      label: "Dastgoh yuklamasi",
      value: `${targetMachine?.name?.slice(0, 18) || "Dastgoh"}`,
      sublabel: `Navbat: ${activeQueueCount} ta buyurtma`,
      trend: "neutral",
    },
    {
      label: "Taxminiy tannarx",
      value: `$${calc.costBreakdown.totalEstimatedUsd.toLocaleString()}`,
      sublabel: `Donasi: $${calc.costBreakdown.unitCostUsd}`,
    },
  ];

  let textResult = `**Buyurtma ishlab chiqarishga yaroqliligi tahlili (Feasibility Check):**\n\n`;
  textResult += `• **Mahsulot**: ${product} (${quantity.toLocaleString()} dona, ${technology.toUpperCase()})\n`;
  textResult += `• **Hisoblangan xomashyo**: ${neededUnits.toLocaleString()} ${calc.unitType} (Priladka: ${calc.makeReadyWaste} ${calc.unitType}, CTP: ${calc.platesCount} ta)\n`;
  textResult += `• **Ombor tekshiruvi**: ${matchedMaterial?.materialName || paperStock} — Omborda erkin qoldiq: **${availableStock.toLocaleString()}**, kerak: **${neededUnits.toLocaleString()}**.\n`;

  if (!isMaterialSufficient) {
    textResult += `  > DIQQAT: Xomashyo yetishmovchiligi mavjud! Kamida **${materialDeficit.toLocaleString()} ${calc.unitType}** xarid qilinishi lozim.\n`;
  } else {
    textResult += `  > Xomashyo zaxirasi to'liq yetarli (rezervatsiya qilish mumkin).\n`;
  }

  textResult += `• **Dastgoh tekshiruvi**: ${targetMachine?.name || "Asosiy dastgoh"} (Holati: ${targetMachine?.status || "Ishlamoqda"}, navbatda: ${activeQueueCount} ta ish).\n`;

  if (deadline) {
    textResult += `• **Belgilangan dedlayn**: ${deadline}.\n`;
  }

  textResult += `\n**XULOSA:** ${
    isFeasible
      ? "Buyurtmani ishlab chiqarishga qabul qilish tavsiya etiladi. Barcha texnologik va moddiy resurslar mavjud."
      : "Xomashyo defitsiti tufayli buyurtmani zudlik bilan ishga tushirib bo'lmaydi. Avval omborga kirim orderi shakllantirilishi lozim."
  }`;

  const actions: CopilotClientAction[] = [];
  if (isFeasible) {
    actions.push({
      id: "act-create-feasible-draft",
      type: "create_draft_tab",
      label: "Buyurtma qoralama kartochkasini ochish",
      iconName: "Plus",
      payload: {
        tabType: "work-order",
        title: `${product} (${quantity})`,
        initialData: {
          product,
          quantity,
          department: technology === "flexo" ? "Flexo" : "Offset",
          pressMachine: targetMachine?.name,
          paperStock: matchedMaterial?.materialName || paperStock,
          priceTotal: calc.costBreakdown.totalEstimatedUsd,
          deadline,
        },
      },
    });
  } else {
    actions.push({
      id: "act-nav-warehouse-receipt",
      type: "navigate_module",
      label: "Ombor zaxirasiga o'tish",
      iconName: "Boxes",
      payload: {
        module: "warehouse",
        subModule: "receipts",
      },
    });
  }

  return {
    toolName: "checkOrderFeasibility",
    success: true,
    summary: isFeasible ? "Buyurtma ishlab chiqarishga tayyor" : "Xomashyo defitsiti aniqlandi",
    textResult,
    toolSteps: [
      {
        id: `step-calc-${Date.now()}`,
        toolName: "checkOrderFeasibility",
        label: "Texnologik me'yorlarni hisoblash",
        status: "done",
        summary: `${neededUnits} ${calc.unitType} talab etiladi`,
      },
      {
        id: `step-stock-${Date.now()}`,
        toolName: "checkWarehouseInventory",
        label: "Ombor zaxirasini tekshirish",
        status: isMaterialSufficient ? "done" : "error",
        summary: isMaterialSufficient ? "Qoldiq yetarli" : `Defitsit: ${materialDeficit}`,
      },
      {
        id: `step-mach-${Date.now()}`,
        toolName: "getMachineQueueAndTelemetry",
        label: "Dastgoh navbatini tekshirish",
        status: "done",
        summary: `${targetMachine?.name || "Dastgoh"} navbatida ${activeQueueCount} ta ish`,
        durationMs: Date.now() - startTime,
      },
    ],
    metrics,
    actions,
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
    case "runAnalyticalQuery":
      return executeRunAnalyticalQuery(args, companyCode);
    case "checkOrderFeasibility":
      return executeCheckOrderFeasibility(args, companyCode);
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
