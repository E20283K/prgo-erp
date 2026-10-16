import { create } from "zustand";

export interface DocumentTab {
  id: string;
  title: string;
  type: "registry" | "work-order" | "bom" | "product-spec" | "customer" | "invoice" | "client-order" | "sales-record" | "delivery-act" | "warehouse-receipt" | "planning-slot";
  module: string;
  isUnsaved?: boolean;
  documentData?: any;
  activeLevel3Tab?: string;
}

export interface DeliveryActItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface DeliveryActRecord {
  id: string;
  date: string;
  orderId: string;
  workOrderId: string;
  contractNo: string;
  customer: string;
  customerTin: string;
  product: string;
  quantity: number;
  unit: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  warehouse: string;
  carrier: string;
  driverName: string;
  recipientName: string;
  status: "Draft" | "Pending Signature" | "Signed & Stamped" | "Disputed";
  linkedShipmentId?: string;
  notes?: string;
  items: DeliveryActItem[];
}

export interface WarehouseShipmentRecord {
  id: string;
  date: string;
  customer: string;
  deliveryActId: string;
  workOrder: string;
  product: string;
  quantity: number;
  unit: string;
  from: string;
  carrier: string;
  trackingNo: string;
  status: "Packed" | "Dispatched" | "In Transit" | "Delivered";
}

export interface SettlementLedgerEntry {
  id: string;
  date: string;
  docNo: string;
  docType: "Schet-faktura" | "Payment" | "Opening Balance";
  description: string;
  debit: number;
  credit: number;
}

export interface ClientSettlementRecord {
  id: string;
  customer: string;
  customerTin: string;
  contractNo: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  currency: string;
  lastActivityDate: string;
  status: "Debt" | "Settled" | "Advance";
  ledger: SettlementLedgerEntry[];
}

export interface CrmCustomerRecord {
  id: string;
  name: string;
  tin: string;
  industry: string;
  contactPerson: string;
  phone: string;
  email: string;
  contractNo: string;
  paymentTerms: string;
  manager: string;
  status: "VIP" | "Active" | "New" | "Blocked";
}

export interface WarehouseStockRecord {
  sku: string;
  name: string;
  category: "Paper & Board" | "Roll & Label" | "Inks & Plates" | "Foil & Film" | "Adhesives & Binding";
  grammage?: number;
  sheetFormat?: string;
  unit: "sheets" | "rolls" | "kg" | "pcs" | "m²";
  location: string;
  stockLevel: number;
  reserved: number;
  available: number;
  reorder: number;
  unitPriceUsd: number;
  lastReceived: string;
  status: "In Stock" | "Low Stock" | "Critical";
}

// ─── Unified Production Queue & Readiness Checks ─────────────────────────────
export type GateStatus = "ready" | "pending" | "blocked";

export interface GateAuditRecord {
  status: GateStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
}

export type ReadinessCheckKey = "designReady" | "paperReady" | "platesReady" | "toolingReady";

export interface ProductionReadinessChecks {
  designReady: boolean;
  paperReady: boolean;
  platesReady: boolean;
  toolingReady: boolean;
  audit?: {
    designReady?: GateAuditRecord;
    paperReady?: GateAuditRecord;
    platesReady?: GateAuditRecord;
    toolingReady?: GateAuditRecord;
  };
}

export type ProductionQueueStage = "Queue" | "Ready to Print" | "In Production" | "Completed";

export interface ProductionQueueItem {
  id: string; // e.g. "WO-00351"
  clientOrderId?: string; // e.g. "CO-00041"
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  pressMachine: string; // e.g. "Heidelberg Speedmaster XL 106-8P"
  department: string;
  priority: "Normal" | "High" | "Urgent";
  stage: ProductionQueueStage;
  queueOrder: number;
  checks: ProductionReadinessChecks;
  deadline: string;
  plannedSheets?: number;
  completedSheets?: number;
  operator?: string;
  shift?: string;
  colors?: string;
  spotColors?: string[];
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotifSeverity = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  severity: NotifSeverity;
  timestamp: number; // Date.now()
  read: boolean;
  /** Optional deep-link: module + subModule to navigate to */
  link?: { module: string; subModule: string };
}

export type AppTheme = "dark" | "light";

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  initials: string;
  defaultModule: string;
  avatar?: string;
}

export const DEMO_USERS: Record<string, UserProfile> = {
  operator: {
    name: "Alexey Kovalev",
    email: "a.kovalev@printgoo.com",
    role: "Production Shift Lead",
    initials: "AK",
    defaultModule: "production",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
  sales: {
    name: "Elena Voronina",
    email: "e.voronina@printgoo.com",
    role: "Commercial & Order Manager",
    initials: "EV",
    defaultModule: "production",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
  },
  admin: {
    name: "Dmitry Morozov",
    email: "admin@printgoo.com",
    role: "System Administrator",
    initials: "DM",
    defaultModule: "settings",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
};

interface WorkspaceState {
  tabs: DocumentTab[];
  activeTabId: string;
  activeModule: string;      // top-level ERP module selected in the sidebar rail
  currentModule: string;     // sub-navigation module context
  currentSubModule: string;
  selectedCount: number;
  totalCount: number;
  activeCellCoords: string;
  theme: AppTheme;
  isCommandOpen: boolean;
  sidebarWidth: number;
  showStatusBar: boolean;
  setShowStatusBar: (show: boolean) => void;
  toggleStatusBar: () => void;
  isAuthenticated: boolean;
  currentUser: UserProfile;

  // ── Cross-module ERP Records (Schet-faktura, Shipments, Settlements, Customers, Stock) ──
  deliveryActs: DeliveryActRecord[];
  warehouseShipments: WarehouseShipmentRecord[];
  clientSettlements: ClientSettlementRecord[];
  crmCustomers: CrmCustomerRecord[];
  warehouseStock: WarehouseStockRecord[];
  upsertCustomer: (customer: CrmCustomerRecord) => void;
  upsertWarehouseStock: (stock: WarehouseStockRecord) => void;
  reserveStockForOrder: (materialQuery: string, qty: number, orderDocNo: string) => void;
  upsertDeliveryAct: (act: DeliveryActRecord) => void;
  postDeliveryAct: (actId: string) => DeliveryActRecord | undefined;
  createDeliveryActFromOrder: (payload: {
    orderId?: string;
    workOrderId?: string;
    customer: string;
    product: string;
    quantity: number;
    unit: string;
    priceTotal?: number;
    currency?: string;
  }) => DeliveryActRecord;
  addWarehouseShipment: (shipment: WarehouseShipmentRecord) => void;
  updateWarehouseShipmentStatus: (shipmentId: string, status: WarehouseShipmentRecord["status"]) => void;
  recordClientPayment: (customer: string, amount: number, docNo?: string, note?: string) => void;

  // ── Unified Production Queue & Readiness ─────────────────────────────────
  productionQueue: ProductionQueueItem[];
  toggleReadinessCheck: (
    idOrWoOrCo: string,
    checkKey: ReadinessCheckKey,
    auditMeta?: { verifiedBy?: string; note?: string; forceStatus?: GateStatus }
  ) => void;
  setProductionStage: (idOrWoOrCo: string, stage: ProductionQueueStage) => void;
  updateQueueMachine: (idOrWoOrCo: string, machine: string) => void;
  reorderQueueOrder: (idOrWoOrCo: string, direction: "up" | "down") => void;
  upsertProductionQueueItem: (item: Partial<ProductionQueueItem> & { id: string }) => void;

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: AppNotification[];
  isNotifPanelOpen: boolean;
  setNotifPanelOpen: (open: boolean) => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  dismissNotification: (id: string) => void;
  markAllRead: () => void;
  clearAllNotifications: () => void;

  // ── AI Copilot Chat ────────────────────────────────────────────────────────
  isAiChatOpen: boolean;
  setAiChatOpen: (open: boolean) => void;
  toggleAiChat: () => void;

  // ── Modals ───────────────────────────────────────────────────────────────
  isCreateOrderOpen: boolean;
  setCreateOrderOpen: (open: boolean) => void;
  isCreateWorkOrderOpen: boolean;
  setCreateWorkOrderOpen: (open: boolean) => void;

  // Actions
  openTab: (tab: DocumentTab) => void;
  closeTab: (id: string) => void;
  closeSavedTabs: () => void;
  closeAllDocumentTabs: () => void;
  setActiveTab: (id: string) => void;
  setActiveModule: (module: string) => void;
  setModule: (mod: string, subMod?: string) => void;
  setSubModule: (subMod: string) => void;
  setTabUnsaved: (id: string, isUnsaved: boolean) => void;
  setLevel3Tab: (tabId: string, level3Tab: string) => void;
  updateGridStats: (selectedCount: number, totalCount: number, cellCoords?: string) => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  setSidebarWidth: (width: number) => void;
  login: (user?: Partial<UserProfile>) => void;
  logout: () => void;
  switchTab: (direction?: "next" | "prev") => void;
}

export const MAX_OPEN_TABS = 8;

// ─── Seed Data for Schet-fakturas, Shipments & Settlements ────────────────────
const INITIAL_DELIVERY_ACTS: DeliveryActRecord[] = [
  {
    id: "SF-8001",
    date: "2026-10-12",
    orderId: "CO-00041",
    workOrderId: "WO-00351",
    contractNo: "CON-2026-101",
    customer: "Alpha Media Group LLC",
    customerTin: "305841920",
    product: "A4 Hardcover Catalog 96p",
    quantity: 5000,
    unit: "pcs",
    subtotal: 13258.93,
    vatRate: 12,
    vatAmount: 1591.07,
    totalAmount: 14850.0,
    currency: "USD",
    warehouse: "Main Factory — Tashkent",
    carrier: "PrintGoo Fleet #1",
    driverName: "R. Ismoilov (01 A 772 BB)",
    recipientName: "J. Rahimov (Ombor mudiri)",
    status: "Signed & Stamped",
    linkedShipmentId: "SHP-6000",
    notes: "To'liq tiraj (5000 dona) sifat nazoratidan o'tdi va palletsiz qadoqda topshirildi.",
    items: [
      {
        id: "item-1",
        sku: "PRN-CAT-01",
        name: "A4 Hardcover Catalog 96p (Galerie Art Silk 150g + Soft-Touch)",
        unit: "pcs",
        quantity: 5000,
        unitPrice: 2.6518,
        vatRate: 12,
      },
    ],
  },
  {
    id: "SF-8002",
    date: "2026-10-11",
    orderId: "CO-00042",
    workOrderId: "WO-00352",
    contractNo: "CON-2026-102",
    customer: "Nordic Print Co",
    customerTin: "308112450",
    product: "Woven Satin Labels 30x50",
    quantity: 15000,
    unit: "pcs",
    subtotal: 4200.0,
    vatRate: 12,
    vatAmount: 504.0,
    totalAmount: 4704.0,
    currency: "USD",
    warehouse: "Main Factory — Tashkent",
    carrier: "Customer Pickup",
    driverName: "Mijoz transporti",
    recipientName: "S. Lindqvist",
    status: "Pending Signature",
    notes: "Mijoz imzosi (E-faktura tasdig'i) kutilmoqda.",
    items: [
      {
        id: "item-2",
        sku: "PRN-LBL-03",
        name: "Woven Satin Labels 30x50mm (Ultrasonic Cut)",
        unit: "pcs",
        quantity: 15000,
        unitPrice: 0.28,
        vatRate: 12,
      },
    ],
  },
  {
    id: "SF-8003",
    date: "2026-10-09",
    orderId: "CO-00043",
    workOrderId: "WO-00353",
    contractNo: "CON-2026-103",
    customer: "Baltic Press LLC",
    customerTin: "309445112",
    product: "Nylon Taffeta Roll",
    quantity: 400,
    unit: "rolls",
    subtotal: 6800.0,
    vatRate: 12,
    vatAmount: 816.0,
    totalAmount: 7616.0,
    currency: "USD",
    warehouse: "Branch Warehouse — Samarkand",
    carrier: "Express Logistics UZ",
    driverName: "A. Toshmatov (30 B 410 AA)",
    recipientName: "M. Kovalenko",
    status: "Signed & Stamped",
    linkedShipmentId: "SHP-6002",
    items: [
      {
        id: "item-3",
        sku: "PRN-TAF-02",
        name: "Printed Nylon Taffeta Roll 40mmx200m",
        unit: "rolls",
        quantity: 400,
        unitPrice: 17.0,
        vatRate: 12,
      },
    ],
  },
  {
    id: "SF-8004",
    date: "2026-10-08",
    orderId: "CO-00044",
    workOrderId: "WO-00354",
    contractNo: "CON-2026-104",
    customer: "Apex Packaging",
    customerTin: "302998741",
    product: "E-Flute Packaging Boxes",
    quantity: 10000,
    unit: "pcs",
    subtotal: 11500.0,
    vatRate: 12,
    vatAmount: 1380.0,
    totalAmount: 12880.0,
    currency: "USD",
    warehouse: "Main Factory — Tashkent",
    carrier: "PrintGoo Fleet #2",
    driverName: "D. Karimov (01 Z 889 KA)",
    recipientName: "B. Alimov",
    status: "Signed & Stamped",
    linkedShipmentId: "SHP-6003",
    items: [
      {
        id: "item-4",
        sku: "PRN-BOX-02",
        name: "E-Flute Corrugated Packaging Boxes (4C UV + Matt)",
        unit: "pcs",
        quantity: 10000,
        unitPrice: 1.15,
        vatRate: 12,
      },
    ],
  },
  ...Array.from({ length: 26 }, (_, i) => {
    const idx = i + 5;
    const customers = [
      { name: "Alpha Media Group LLC", tin: "305841920", contract: "CON-2026-101" },
      { name: "Nordic Print Co", tin: "308112450", contract: "CON-2026-102" },
      { name: "Baltic Press LLC", tin: "309445112", contract: "CON-2026-103" },
      { name: "Apex Packaging", tin: "302998741", contract: "CON-2026-104" },
    ];
    const c = customers[i % customers.length];
    const prod = ["Offset Catalogs 100p (A4)", "Woven Satin Labels 30x50", "Nylon Taffeta Roll", "E-Flute Packaging Boxes"][i % 4];
    const qty = [1000, 5000, 200, 10000][i % 4];
    const sub = [3200, 1800, 3400, 9500][i % 4];
    const vat = Number((sub * 0.12).toFixed(2));
    const tot = Number((sub + vat).toFixed(2));
    const st = (["Signed & Stamped", "Pending Signature", "Signed & Stamped", "Draft"] as const)[i % 4];
    return {
      id: `SF-${String(8000 + idx).padStart(4, "0")}`,
      date: `2026-09-${String((i % 25) + 1).padStart(2, "0")}`,
      orderId: `CO-${String(41 + idx).padStart(5, "0")}`,
      workOrderId: `WO-${String(351 + idx).padStart(5, "0")}`,
      contractNo: c.contract,
      customer: c.name,
      customerTin: c.tin,
      product: prod,
      quantity: qty,
      unit: "pcs",
      subtotal: sub,
      vatRate: 12,
      vatAmount: vat,
      totalAmount: tot,
      currency: "USD",
      warehouse: "Main Factory — Tashkent",
      carrier: ["PrintGoo Fleet #1", "Customer Pickup", "Express Logistics UZ", "PrintGoo Fleet #2"][i % 4],
      driverName: "R. Ismoilov (01 A 772 BB)",
      recipientName: "Vakil (Ishonchnoma asosida)",
      status: st,
      linkedShipmentId: st === "Signed & Stamped" ? `SHP-${String(6000 + idx).padStart(4, "0")}` : undefined,
      items: [
        {
          id: `item-${idx}`,
          sku: `PRN-0${(i % 4) + 1}`,
          name: prod,
          unit: "pcs",
          quantity: qty,
          unitPrice: Number((sub / qty).toFixed(4)),
          vatRate: 12,
        },
      ],
    };
  }),
];

const INITIAL_WAREHOUSE_SHIPMENTS: WarehouseShipmentRecord[] = [
  {
    id: "SHP-6000",
    date: "2026-10-12",
    customer: "Alpha Media Group LLC",
    deliveryActId: "SF-8001",
    workOrder: "WO-00351",
    product: "A4 Hardcover Catalog 96p",
    quantity: 5000,
    unit: "pcs",
    from: "Main Factory — Tashkent",
    carrier: "PrintGoo Fleet #1",
    trackingNo: "TRK900001",
    status: "Delivered",
  },
  {
    id: "SHP-6002",
    date: "2026-10-09",
    customer: "Baltic Press LLC",
    deliveryActId: "SF-8003",
    workOrder: "WO-00353",
    product: "Nylon Taffeta Roll",
    quantity: 400,
    unit: "rolls",
    from: "Branch Warehouse — Samarkand",
    carrier: "Express Logistics UZ",
    trackingNo: "TRK900014",
    status: "In Transit",
  },
  {
    id: "SHP-6003",
    date: "2026-10-08",
    customer: "Apex Packaging",
    deliveryActId: "SF-8004",
    workOrder: "WO-00354",
    product: "E-Flute Packaging Boxes",
    quantity: 10000,
    unit: "pcs",
    from: "Main Factory — Tashkent",
    carrier: "PrintGoo Fleet #2",
    trackingNo: "TRK900021",
    status: "Dispatched",
  },
  ...Array.from({ length: 40 }, (_, i) => {
    const idx = i + 4;
    const customers = [
      "Alpha Media Group LLC", "Nordic Print Co", "Baltic Press LLC",
      "Apex Packaging", "Zenith Publishing", "Vanguard Fashion",
    ];
    const products = [
      { name: "A4 Hardcover Catalog 96p", qty: 5000, unit: "pcs" },
      { name: "A5 Wire-O Booklet 32p", qty: 3000, unit: "pcs" },
      { name: "Custom Folding Carton 350g", qty: 10000, unit: "pcs" },
      { name: "Offset Magazine Gloss 64p", qty: 8000, unit: "pcs" },
    ];
    const prod = products[i % products.length];
    const locs = ["Main Factory — Tashkent", "Branch Warehouse — Samarkand", "Finishing Shop — Bukhara"];
    const carriers = ["Express Logistics UZ", "DHL Freight", "Own Vehicle", "Customer Pickup"];
    return {
      id: `SHP-${String(6000 + idx).padStart(4, "0")}`,
      date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      customer: customers[i % customers.length],
      deliveryActId: `SF-${String(8000 + idx).padStart(4, "0")}`,
      workOrder: `WO-${String(350 + (i % 30)).padStart(5, "0")}`,
      product: prod.name,
      quantity: prod.qty,
      unit: prod.unit,
      from: locs[i % 3],
      carrier: carriers[i % 4],
      trackingNo: i % 4 === 3 ? "—" : `TRK${String(900000 + idx * 7)}`,
      status: (["Packed", "Dispatched", "In Transit", "Delivered"] as const)[i % 4],
    };
  }),
];

const INITIAL_CLIENT_SETTLEMENTS: ClientSettlementRecord[] = [
  {
    id: "STL-001",
    customer: "Alpha Media Group LLC",
    customerTin: "305841920",
    contractNo: "CON-2026-101",
    openingBalance: 2400.0,
    totalDebit: 14850.0,
    totalCredit: 10000.0,
    closingBalance: 7250.0,
    currency: "USD",
    lastActivityDate: "2026-10-12",
    status: "Debt",
    ledger: [
      {
        id: "led-1",
        date: "2026-10-01",
        docNo: "OPEN-2026",
        docType: "Opening Balance",
        description: "Oy boshiga qoldiq (Saldo)",
        debit: 2400.0,
        credit: 0,
      },
      {
        id: "led-2",
        date: "2026-10-03",
        docNo: "PAY-4091",
        docType: "Payment",
        description: "Shartnoma CON-2026-101 bo'yicha avans to'lovi (Bank o'tkazmasi)",
        debit: 0,
        credit: 10000.0,
      },
      {
        id: "led-3",
        date: "2026-10-12",
        docNo: "SF-8001",
        docType: "Schet-faktura",
        description: "Mahsulot realizatsiyasi: A4 Hardcover Catalog 96p (5,000 pcs)",
        debit: 14850.0,
        credit: 0,
      },
    ],
  },
  {
    id: "STL-002",
    customer: "Nordic Print Co",
    customerTin: "308112450",
    contractNo: "CON-2026-102",
    openingBalance: 0,
    totalDebit: 12400.0,
    totalCredit: 12400.0,
    closingBalance: 0,
    currency: "USD",
    lastActivityDate: "2026-10-10",
    status: "Settled",
    ledger: [
      {
        id: "led-201",
        date: "2026-09-25",
        docNo: "SF-7982",
        docType: "Schet-faktura",
        description: "Mahsulot realizatsiyasi: Woven Satin Labels (30,000 pcs)",
        debit: 12400.0,
        credit: 0,
      },
      {
        id: "led-202",
        date: "2026-10-10",
        docNo: "PAY-4105",
        docType: "Payment",
        description: "SF-7982 bo'yicha yakuniy hisob-kitob",
        debit: 0,
        credit: 12400.0,
      },
    ],
  },
  {
    id: "STL-003",
    customer: "Baltic Press LLC",
    customerTin: "309445112",
    contractNo: "CON-2026-103",
    openingBalance: 1200.0,
    totalDebit: 7616.0,
    totalCredit: 4000.0,
    closingBalance: 4816.0,
    currency: "USD",
    lastActivityDate: "2026-10-09",
    status: "Debt",
    ledger: [
      {
        id: "led-301",
        date: "2026-10-01",
        docNo: "OPEN-2026",
        docType: "Opening Balance",
        description: "Oy boshiga qoldiq",
        debit: 1200.0,
        credit: 0,
      },
      {
        id: "led-302",
        date: "2026-10-05",
        docNo: "PAY-4098",
        docType: "Payment",
        description: "Qisman to'lov (Bank ko'chirmasi №882)",
        debit: 0,
        credit: 4000.0,
      },
      {
        id: "led-303",
        date: "2026-10-09",
        docNo: "SF-8003",
        docType: "Schet-faktura",
        description: "Mahsulot realizatsiyasi: Nylon Taffeta Roll (400 rolls)",
        debit: 7616.0,
        credit: 0,
      },
    ],
  },
  {
    id: "STL-004",
    customer: "Apex Packaging",
    customerTin: "302998741",
    contractNo: "CON-2026-104",
    openingBalance: 0,
    totalDebit: 12880.0,
    totalCredit: 15000.0,
    closingBalance: -2120.0,
    currency: "USD",
    lastActivityDate: "2026-10-08",
    status: "Advance",
    ledger: [
      {
        id: "led-401",
        date: "2026-10-02",
        docNo: "PAY-4088",
        docType: "Payment",
        description: "100% oldindan to'lov va keyingi buyurtma uchun avans",
        debit: 0,
        credit: 15000.0,
      },
      {
        id: "led-402",
        date: "2026-10-08",
        docNo: "SF-8004",
        docType: "Schet-faktura",
        description: "Mahsulot realizatsiyasi: E-Flute Packaging Boxes (10,000 pcs)",
        debit: 12880.0,
        credit: 0,
      },
    ],
  },
  {
    id: "STL-005",
    customer: "City Publishing House",
    customerTin: "304519823",
    contractNo: "CON-2026-105",
    openingBalance: 5400.0,
    totalDebit: 9200.0,
    totalCredit: 6000.0,
    closingBalance: 8600.0,
    currency: "USD",
    lastActivityDate: "2026-10-04",
    status: "Debt",
    ledger: [
      {
        id: "led-501",
        date: "2026-10-01",
        docNo: "OPEN-2026",
        docType: "Opening Balance",
        description: "Oy boshiga qoldiq",
        debit: 5400.0,
        credit: 0,
      },
      {
        id: "led-502",
        date: "2026-10-03",
        docNo: "SF-7995",
        docType: "Schet-faktura",
        description: "Hardcover Book (A5) — 3,000 pcs",
        debit: 9200.0,
        credit: 0,
      },
      {
        id: "led-503",
        date: "2026-10-04",
        docNo: "PAY-4092",
        docType: "Payment",
        description: "Bank o'tkazmasi",
        debit: 0,
        credit: 6000.0,
      },
    ],
  },
];

export const INITIAL_CRM_CUSTOMERS: CrmCustomerRecord[] = [
  {
    id: "CUST-101",
    name: "Alpha Media Group LLC",
    tin: "305841920",
    industry: "Publishing & Media",
    contactPerson: "Sardor Alimov",
    phone: "+998 90 912-34-56",
    email: "procurement@alphamedia.uz",
    contractNo: "CON-2026-101",
    paymentTerms: "50% Advance / 50% Net 15",
    manager: "Elena Voronina",
    status: "VIP",
  },
  {
    id: "CUST-102",
    name: "Vanguard Fashion",
    tin: "308112459",
    industry: "Apparel & Textile",
    contactPerson: "Kamola Rustamova",
    phone: "+998 93 551-20-10",
    email: "supply@vanguardfashion.uz",
    contractNo: "CON-2026-102",
    paymentTerms: "100% Prepayment",
    manager: "Elena Voronina",
    status: "VIP",
  },
  {
    id: "CUST-103",
    name: "Baltic Press LLC",
    tin: "309445102",
    industry: "Retail & Garments",
    contactPerson: "Artur Kovalenko",
    phone: "+998 97 701-88-44",
    email: "orders@balticpress.com",
    contractNo: "CON-2026-103",
    paymentTerms: "Net 30 Days",
    manager: "T. Alimov",
    status: "Active",
  },
  {
    id: "CUST-104",
    name: "Apex Packaging",
    tin: "302998741",
    industry: "FMCG & Cosmetics",
    contactPerson: "Dilshod Karimov",
    phone: "+998 90 175-99-00",
    email: "d.karimov@apexpack.uz",
    contractNo: "CON-2026-104",
    paymentTerms: "100% Advance",
    manager: "M. Ivanova",
    status: "VIP",
  },
  {
    id: "CUST-105",
    name: "City Publishing House",
    tin: "304519823",
    industry: "Book Publishing",
    contactPerson: "Otabek Nazarov",
    phone: "+998 71 234-56-78",
    email: "print@citypub.uz",
    contractNo: "CON-2026-105",
    paymentTerms: "30% Advance / 70% Upon Delivery",
    manager: "K. Anderson",
    status: "Active",
  },
  {
    id: "CUST-106",
    name: "Nordic Print Co",
    tin: "306772310",
    industry: "Commercial Print Broker",
    contactPerson: "Henrik Lindqvist",
    phone: "+998 99 811-22-33",
    email: "henrik@nordicprint.io",
    contractNo: "CON-2026-106",
    paymentTerms: "Net 15 Days",
    manager: "Elena Voronina",
    status: "Active",
  },
  {
    id: "CUST-107",
    name: "Luxury Cosmetics Ltd",
    tin: "307881209",
    industry: "Perfumery & Cosmetics",
    contactPerson: "Madina Umarova",
    phone: "+998 90 330-45-67",
    email: "m.umarova@luxcosmetics.uz",
    contractNo: "CON-2026-107",
    paymentTerms: "50% Advance / 50% Before Dispatch",
    manager: "Elena Voronina",
    status: "VIP",
  },
  {
    id: "CUST-108",
    name: "Continental Pharma",
    tin: "301994827",
    industry: "Pharmaceuticals",
    contactPerson: "Ulugbek Toshmatov",
    phone: "+998 71 200-11-22",
    email: "qa.packaging@continentalpharma.uz",
    contractNo: "CON-2026-108",
    paymentTerms: "Net 30 Days",
    manager: "T. Alimov",
    status: "Active",
  },
];

export const INITIAL_WAREHOUSE_STOCK: WarehouseStockRecord[] = [
  {
    sku: "MAT-1010",
    name: "Galerie Art Silk 150g/m²",
    category: "Paper & Board",
    grammage: 150,
    sheetFormat: "700×1000",
    unit: "sheets",
    location: "Rack A-01 (Main Paper Hall)",
    stockLevel: 38500,
    reserved: 12000,
    available: 26500,
    reorder: 8000,
    unitPriceUsd: 0.19,
    lastReceived: "2026-10-08",
    status: "In Stock",
  },
  {
    sku: "MAT-1015",
    name: "Galerie Art Gloss 200g/m²",
    category: "Paper & Board",
    grammage: 200,
    sheetFormat: "700×1000",
    unit: "sheets",
    location: "Rack A-02 (Main Paper Hall)",
    stockLevel: 19200,
    reserved: 4500,
    available: 14700,
    reorder: 5000,
    unitPriceUsd: 0.25,
    lastReceived: "2026-10-05",
    status: "In Stock",
  },
  {
    sku: "MAT-1020",
    name: "Coated Cardboard 300g/m²",
    category: "Paper & Board",
    grammage: 300,
    sheetFormat: "700×1000",
    unit: "sheets",
    location: "Rack A-04 (Heavy Board Zone)",
    stockLevel: 44000,
    reserved: 9500,
    available: 34500,
    reorder: 6000,
    unitPriceUsd: 0.36,
    lastReceived: "2026-10-10",
    status: "In Stock",
  },
  {
    sku: "MAT-1025",
    name: "Kraft Board 350g/m²",
    category: "Paper & Board",
    grammage: 350,
    sheetFormat: "700×1000",
    unit: "sheets",
    location: "Rack B-01 (Heavy Board Zone)",
    stockLevel: 16500,
    reserved: 4000,
    available: 12500,
    reorder: 4000,
    unitPriceUsd: 0.42,
    lastReceived: "2026-10-03",
    status: "In Stock",
  },
  {
    sku: "MAT-1030",
    name: "Colorplan Ebony 270g/m²",
    category: "Paper & Board",
    grammage: 270,
    sheetFormat: "700×1000",
    unit: "sheets",
    location: "Rack B-04 (Designer Substrates)",
    stockLevel: 4800,
    reserved: 1800,
    available: 3000,
    reorder: 2500,
    unitPriceUsd: 0.88,
    lastReceived: "2026-09-29",
    status: "Low Stock",
  },
  {
    sku: "MAT-1035",
    name: "Offset Uncoated 80g/m²",
    category: "Paper & Board",
    grammage: 80,
    sheetFormat: "640×900",
    unit: "sheets",
    location: "Rack A-06 (Main Paper Hall)",
    stockLevel: 65000,
    reserved: 15000,
    available: 50000,
    reorder: 10000,
    unitPriceUsd: 0.08,
    lastReceived: "2026-10-11",
    status: "In Stock",
  },
  {
    sku: "MAT-2010",
    name: "White Satin Ribbon 60mm",
    category: "Roll & Label",
    unit: "rolls",
    location: "Rack C-01 (Ribbon & Narrow Web)",
    stockLevel: 420,
    reserved: 110,
    available: 310,
    reorder: 100,
    unitPriceUsd: 6.50,
    lastReceived: "2026-10-07",
    status: "In Stock",
  },
  {
    sku: "MAT-2020",
    name: "Nylon Taffeta Tape 50mm",
    category: "Roll & Label",
    unit: "rolls",
    location: "Rack C-02 (Ribbon & Narrow Web)",
    stockLevel: 540,
    reserved: 140,
    available: 400,
    reorder: 120,
    unitPriceUsd: 4.80,
    lastReceived: "2026-10-09",
    status: "In Stock",
  },
  {
    sku: "MAT-3010",
    name: "PVA Dispersion Glue (Kashirovka)",
    category: "Adhesives & Binding",
    unit: "kg",
    location: "Chem Store D-01",
    stockLevel: 620,
    reserved: 95,
    available: 525,
    reorder: 150,
    unitPriceUsd: 3.40,
    lastReceived: "2026-10-06",
    status: "In Stock",
  },
  {
    sku: "MAT-4010",
    name: "CTP Thermal Plates 1030×790mm",
    category: "Inks & Plates",
    unit: "pcs",
    location: "Prepress Vault E-01",
    stockLevel: 380,
    reserved: 64,
    available: 316,
    reorder: 100,
    unitPriceUsd: 7.20,
    lastReceived: "2026-10-10",
    status: "In Stock",
  },
  {
    sku: "MAT-4020",
    name: "Process CMYK Ink Set (Sheetfed Offset)",
    category: "Inks & Plates",
    unit: "kg",
    location: "Chem Store D-02",
    stockLevel: 290,
    reserved: 45,
    available: 245,
    reorder: 80,
    unitPriceUsd: 11.50,
    lastReceived: "2026-10-04",
    status: "In Stock",
  },
  {
    sku: "MAT-5010",
    name: "Soft-Touch Matte Lamination Film 28μm",
    category: "Foil & Film",
    unit: "rolls",
    location: "Finishing Store F-01",
    stockLevel: 28,
    reserved: 18,
    available: 10,
    reorder: 15,
    unitPriceUsd: 68.00,
    lastReceived: "2026-09-25",
    status: "Critical",
  },
];

export const INITIAL_PRODUCTION_QUEUE: ProductionQueueItem[] = [
  {
    id: "WO-00351",
    clientOrderId: "CO-00041",
    customer: "Alpha Media Group LLC",
    product: "A4 Hardcover Catalog 96p",
    quantity: 5000,
    unit: "pcs",
    pressMachine: "Heidelberg Speedmaster XL 106-8P",
    department: "Offset",
    priority: "High",
    stage: "In Production",
    queueOrder: 1,
    checks: {
      designReady: true,
      paperReady: true,
      platesReady: true,
      toolingReady: true,
      audit: {
        designReady: { status: "ready", verifiedBy: "D. Alimov (Prepress)", verifiedAt: "09:15" },
        paperReady: { status: "ready", verifiedBy: "S. Karimov (Warehouse)", verifiedAt: "09:40" },
        platesReady: { status: "ready", verifiedBy: "A. Kovalev (Press)", verifiedAt: "10:05" },
        toolingReady: { status: "ready", verifiedBy: "N. Rakhimov (Die Shop)", verifiedAt: "10:20" },
      },
    },
    deadline: "2026-10-18",
    plannedSheets: 12500,
    completedSheets: 8125,
    operator: "A. Kovalev (1-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "4+4",
    spotColors: [],
  },
  {
    id: "WO-00353",
    clientOrderId: "CO-00043",
    customer: "Apex Packaging",
    product: "E-Flute Perfume Folding Box",
    quantity: 8000,
    unit: "pcs",
    pressMachine: "Heidelberg Speedmaster XL 106-8P",
    department: "Offset",
    priority: "Urgent",
    stage: "Ready to Print",
    queueOrder: 2,
    checks: {
      designReady: true,
      paperReady: true,
      platesReady: true,
      toolingReady: true,
      audit: {
        designReady: { status: "ready", verifiedBy: "D. Alimov (Prepress)", verifiedAt: "08:30" },
        paperReady: { status: "ready", verifiedBy: "S. Karimov (Warehouse)", verifiedAt: "08:45" },
        platesReady: { status: "ready", verifiedBy: "A. Kovalev (Press)", verifiedAt: "09:10" },
        toolingReady: { status: "ready", verifiedBy: "N. Rakhimov (Die Shop)", verifiedAt: "09:20" },
      },
    },
    deadline: "2026-10-15",
    plannedSheets: 8000,
    completedSheets: 0,
    operator: "A. Kovalev (1-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "5+0",
    spotColors: ["PANTONE 021 C (Neon Orange)"],
  },
  {
    id: "WO-00357",
    clientOrderId: "CO-00047",
    customer: "Grand Retail Group",
    product: "Kraft Shopping Bags Medium",
    quantity: 25000,
    unit: "pcs",
    pressMachine: "Heidelberg Speedmaster XL 106-8P",
    department: "Offset",
    priority: "Normal",
    stage: "Queue",
    queueOrder: 3,
    checks: {
      designReady: true,
      paperReady: true,
      platesReady: false,
      toolingReady: false,
      audit: {
        designReady: { status: "ready", verifiedBy: "D. Alimov (Prepress)", verifiedAt: "11:00" },
        paperReady: { status: "ready", verifiedBy: "S. Karimov (Warehouse)", verifiedAt: "11:25" },
        platesReady: { status: "pending" },
        toolingReady: { status: "blocked", verifiedBy: "N. Rakhimov (Die Shop)", verifiedAt: "11:40", note: "Awaiting knife replacement" },
      },
    },
    deadline: "2026-10-22",
    plannedSheets: 25000,
    completedSheets: 0,
    operator: "A. Kovalev (1-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "1+0",
    spotColors: [],
  },
  {
    id: "WO-00354",
    clientOrderId: "CO-00044",
    customer: "Vanguard Fashion",
    product: "600g Duplex VIP Hangtags",
    quantity: 20000,
    unit: "pcs",
    pressMachine: "Komori Lithrone G40 (4-Color)",
    department: "Offset",
    priority: "High",
    stage: "Ready to Print",
    queueOrder: 1,
    checks: {
      designReady: true,
      paperReady: true,
      platesReady: true,
      toolingReady: true,
    },
    deadline: "2026-10-20",
    plannedSheets: 6000,
    completedSheets: 0,
    operator: "D. Karimov (2-smena)",
    shift: "Night Shift (20:00–08:00)",
    colors: "4+1",
    spotColors: [],
  },
  {
    id: "WO-00355",
    clientOrderId: "CO-00045",
    customer: "Baltic Press LLC",
    product: "A5 Promotional Brochure 16p",
    quantity: 10000,
    unit: "pcs",
    pressMachine: "Komori Lithrone G40 (4-Color)",
    department: "Offset",
    priority: "Normal",
    stage: "Queue",
    queueOrder: 2,
    checks: {
      designReady: true,
      paperReady: false,
      platesReady: true,
      toolingReady: false,
    },
    deadline: "2026-10-19",
    plannedSheets: 10000,
    completedSheets: 0,
    operator: "D. Karimov (2-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "4+0",
    spotColors: [],
  },
  {
    id: "WO-00352",
    clientOrderId: "CO-00042",
    customer: "Nordic Print Co",
    product: "Woven Satin Labels 30x50",
    quantity: 15000,
    unit: "pcs",
    pressMachine: "Mark Andy Performance Series P7",
    department: "Flexo",
    priority: "Normal",
    stage: "Ready to Print",
    queueOrder: 1,
    checks: {
      designReady: true,
      paperReady: true,
      platesReady: true,
      toolingReady: true,
    },
    deadline: "2026-10-16",
    plannedSheets: 15000,
    completedSheets: 0,
    operator: "R. Ismoilov (1-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "6+0",
    spotColors: ["PANTONE 871 Gold", "Pantone Reflex Blue"],
  },
  {
    id: "WO-00356",
    clientOrderId: "CO-00046",
    customer: "Apex Packaging",
    product: "Die-Cut Perfume Box blanks",
    quantity: 8000,
    unit: "pcs",
    pressMachine: "Bobst Novacut 106 E Autoplaten",
    department: "Post-press",
    priority: "Normal",
    stage: "Queue",
    queueOrder: 1,
    checks: {
      designReady: true,
      paperReady: false,
      platesReady: true,
      toolingReady: true,
    },
    deadline: "2026-10-21",
    plannedSheets: 8000,
    completedSheets: 0,
    operator: "B. Rahimov (1-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "4+0",
    spotColors: [],
  },
  {
    id: "WO-00358",
    clientOrderId: "CO-00048",
    customer: "Vanguard Fashion",
    product: "Woven Damask Garment Neck Labels 25×60",
    quantity: 50000,
    unit: "pcs",
    pressMachine: "Staubli LX 3202 High-Speed Jacquard Loom",
    department: "Jacquard",
    priority: "High",
    stage: "Ready to Print",
    queueOrder: 1,
    checks: {
      designReady: true,
      paperReady: true,
      platesReady: true,
      toolingReady: true,
    },
    deadline: "2026-10-23",
    plannedSheets: 50000,
    completedSheets: 0,
    operator: "N. Turgunov (1-smena)",
    shift: "Day Shift (08:00–20:00)",
    colors: "4-Weft",
    spotColors: [],
  },
];

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [
    {
      id: "registry-work-orders",
      title: "Work Orders (Registry)",
      type: "registry",
      module: "production",
      isUnsaved: false,
    },
    {
      id: "WO-00351",
      title: "WO-00351: Hardcover Catalog (5k)",
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "WO-00351",
        customer: "Alpha Media Group LLC",
        product: "A4 Hardcover Catalog 96p",
        quantity: 5000,
        unit: "pcs",
        status: "Active",
        priority: "High",
        orderType: "Production",
        linkedOrderId: "CO-00041",
        pressMachine: "Heidelberg Speedmaster XL 106",
        startDate: "2026-09-30",
        deadline: "2026-10-06",
        prepressStatus: "Approved by Client",
        paperStock: "Galerie Art Silk 150g/m²",
        coating: "Soft-Touch Matte + Spot UV",
        priceTotal: 14850.00,
        currency: "USD",
        responsible: "K. Anderson (Prepress Lead)",
      },
    },
    {
      id: "CO-00041",
      title: "CO-00041: Alpha Media — Catalog",
      type: "client-order",
      module: "crm",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "CO-00041",
        customer: "Alpha Media Group LLC",
        product: "A4 Hardcover Catalog 96p",
        quantity: 5000,
        unit: "pcs",
        orderType: "Production",
        approvalStatus: "Approved",
        currency: "USD",
        recipe: "OFFSET_STD_V1",
        department: "Offset",
        deadline: "2026-10-06",
        responsible: "Elena Voronina",
        linkedWoId: "WO-00351",
        sampleDispatched: true,
        sampleDispatchDate: "2026-09-27",
        sampleCourier: "Company driver",
        sampleRecipient: "John Smith",
        sampleQty: 5,
      },
    },
  ],
  activeTabId: "registry-work-orders",
  activeModule: "production",
  currentModule: "production",
  currentSubModule: "work-orders",
  selectedCount: 0,
  totalCount: 1250,
  activeCellCoords: "R1:C1",
  theme: "dark",
  isCommandOpen: false,
  sidebarWidth: 300,
  showStatusBar: true,

  // ── Cross-module ERP Records (Schet-faktura, Shipments, Settlements, Customers, Stock) ──
  deliveryActs: INITIAL_DELIVERY_ACTS,
  warehouseShipments: INITIAL_WAREHOUSE_SHIPMENTS,
  clientSettlements: INITIAL_CLIENT_SETTLEMENTS,
  crmCustomers: INITIAL_CRM_CUSTOMERS,
  warehouseStock: INITIAL_WAREHOUSE_STOCK,
  productionQueue: INITIAL_PRODUCTION_QUEUE,

  upsertCustomer: (customer) =>
    set((state) => {
      const exists = state.crmCustomers.some((c) => c.id === customer.id);
      const updatedCustomers = exists
        ? state.crmCustomers.map((c) => (c.id === customer.id ? customer : c))
        : [customer, ...state.crmCustomers];

      // Also ensure customer exists in clientSettlements so Finance & CRM stay in sync
      const inSettlements = state.clientSettlements.some(
        (s) => s.customer.toLowerCase() === customer.name.toLowerCase()
      );
      const updatedSettlements = inSettlements
        ? state.clientSettlements.map((s) =>
            s.customer.toLowerCase() === customer.name.toLowerCase()
              ? { ...s, customerTin: customer.tin, contractNo: customer.contractNo }
              : s
          )
        : [
            {
              id: `STL-00${state.clientSettlements.length + 1}`,
              customer: customer.name,
              customerTin: customer.tin,
              contractNo: customer.contractNo,
              openingBalance: 0,
              totalDebit: 0,
              totalCredit: 0,
              closingBalance: 0,
              currency: "USD",
              lastActivityDate: new Date().toISOString().split("T")[0],
              status: "Settled" as const,
              ledger: [],
            },
            ...state.clientSettlements,
          ];

      return {
        crmCustomers: updatedCustomers,
        clientSettlements: updatedSettlements,
      };
    }),

  upsertWarehouseStock: (stock) =>
    set((state) => {
      const available = Math.max(0, stock.stockLevel - stock.reserved);
      const computedStatus: WarehouseStockRecord["status"] =
        available <= stock.reorder * 0.5
          ? "Critical"
          : available <= stock.reorder
          ? "Low Stock"
          : "In Stock";
      const normalized: WarehouseStockRecord = {
        ...stock,
        available,
        status: computedStatus,
      };
      const exists = state.warehouseStock.some((s) => s.sku === normalized.sku);
      return {
        warehouseStock: exists
          ? state.warehouseStock.map((s) => (s.sku === normalized.sku ? normalized : s))
          : [normalized, ...state.warehouseStock],
      };
    }),

  reserveStockForOrder: (materialQuery, qty, orderDocNo) =>
    set((state) => {
      if (!materialQuery || qty <= 0) return state;
      const q = materialQuery.toLowerCase();
      let matchedName = "";
      const updatedStock = state.warehouseStock.map((item) => {
        const isMatch =
          item.name.toLowerCase().includes(q) ||
          q.includes(item.name.toLowerCase()) ||
          (item.grammage && q.includes(String(item.grammage)));
        if (!isMatch || matchedName) return item;
        matchedName = item.name;
        const newReserved = item.reserved + qty;
        const newAvailable = Math.max(0, item.stockLevel - newReserved);
        const newStatus: WarehouseStockRecord["status"] =
          newAvailable <= item.reorder * 0.5
            ? "Critical"
            : newAvailable <= item.reorder
            ? "Low Stock"
            : "In Stock";
        return {
          ...item,
          reserved: newReserved,
          available: newAvailable,
          status: newStatus,
        };
      });

      if (!matchedName) return state;

      return {
        warehouseStock: updatedStock,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Omborda xomashyo band qilindi (${orderDocNo})`,
            description: `${matchedName}: ${qty.toLocaleString()} varaq/birlik ishlab chiqarish uchun zahiraga olindi.`,
            severity: "info",
            timestamp: Date.now(),
            read: false,
            link: { module: "warehouse", subModule: "stock-balance" },
          },
          ...state.notifications,
        ],
      };
    }),

  upsertDeliveryAct: (act) =>
    set((state) => {
      const exists = state.deliveryActs.some((a) => a.id === act.id);
      const updatedActs = exists
        ? state.deliveryActs.map((a) => (a.id === act.id ? act : a))
        : [act, ...state.deliveryActs];
      const updatedTabs = state.tabs.map((t) =>
        t.id === act.id ? { ...t, documentData: act, isUnsaved: false } : t
      );
      return { deliveryActs: updatedActs, tabs: updatedTabs };
    }),

  createDeliveryActFromOrder: (payload) => {
    const state = get();
    const nextNum = 8031 + state.deliveryActs.length;
    const newId = `SF-${nextNum}`;
    const today = new Date().toISOString().split("T")[0];
    const qty = payload.quantity || 1000;
    const totalWithVat = payload.priceTotal && payload.priceTotal > 0 ? payload.priceTotal : qty * 2.5;
    const vatRate = 12;
    const subtotal = Number((totalWithVat / (1 + vatRate / 100)).toFixed(2));
    const vatAmount = Number((totalWithVat - subtotal).toFixed(2));
    const unitPrice = Number((subtotal / Math.max(qty, 1)).toFixed(4));

    const existingClient = state.clientSettlements.find(
      (c) => c.customer.toLowerCase().includes((payload.customer || "").toLowerCase()) ||
             (payload.customer || "").toLowerCase().includes(c.customer.toLowerCase())
    );

    const newAct: DeliveryActRecord = {
      id: newId,
      date: today,
      orderId: payload.orderId || "CO-00041",
      workOrderId: payload.workOrderId || "WO-00351",
      contractNo: existingClient?.contractNo || "CON-2026-101",
      customer: payload.customer || "Alpha Media Group LLC",
      customerTin: existingClient?.customerTin || "305841920",
      product: payload.product || "Printed Packaging / Catalog",
      quantity: qty,
      unit: payload.unit || "pcs",
      subtotal,
      vatRate,
      vatAmount,
      totalAmount: Number(totalWithVat.toFixed(2)),
      currency: payload.currency || "USD",
      warehouse: "Main Factory — Tashkent",
      carrier: "PrintGoo Fleet #1",
      driverName: "R. Ismoilov (01 A 772 BB)",
      recipientName: "Mijoz vakili (Ishonchnoma asosida)",
      status: "Draft",
      notes: `${payload.orderId || ""} / ${payload.workOrderId || ""} asosida shakllantirildi.`,
      items: [
        {
          id: `item-${Date.now()}`,
          sku: "PRN-JOB-01",
          name: payload.product || "Poligrafiya mahsuloti",
          unit: payload.unit || "pcs",
          quantity: qty,
          unitPrice,
          vatRate,
        },
      ],
    };

    set((s) => ({
      deliveryActs: [newAct, ...s.deliveryActs],
    }));

    return newAct;
  },

  postDeliveryAct: (actId) => {
    const state = get();
    const target = state.deliveryActs.find((a) => a.id === actId);
    if (!target) return undefined;

    // If already posted, just return it
    if (target.status === "Signed & Stamped" && target.linkedShipmentId) {
      return target;
    }

    const shipmentId = target.linkedShipmentId || `SHP-${6050 + state.warehouseShipments.length}`;
    const today = target.date || new Date().toISOString().split("T")[0];

    const newShipment: WarehouseShipmentRecord = {
      id: shipmentId,
      date: today,
      customer: target.customer,
      deliveryActId: target.id,
      workOrder: target.workOrderId || "—",
      product: target.product,
      quantity: target.quantity,
      unit: target.unit,
      from: target.warehouse || "Main Factory — Tashkent",
      carrier: target.carrier || "PrintGoo Fleet #1",
      trackingNo: `TRK${Math.floor(910000 + Math.random() * 80000)}`,
      status: "Packed",
    };

    const postedAct: DeliveryActRecord = {
      ...target,
      status: "Signed & Stamped",
      linkedShipmentId: shipmentId,
    };

    // Update or create client settlement record
    let matchedClient = false;
    const updatedSettlements = state.clientSettlements.map((c) => {
      const isMatch =
        c.customer.toLowerCase() === target.customer.toLowerCase() ||
        c.customer.toLowerCase().includes(target.customer.toLowerCase()) ||
        target.customer.toLowerCase().includes(c.customer.toLowerCase());
      if (!isMatch) return c;
      matchedClient = true;

      const alreadyInLedger = c.ledger.some((l) => l.docNo === target.id);
      if (alreadyInLedger) return c;

      const newDebit = Number((c.totalDebit + target.totalAmount).toFixed(2));
      const newClosing = Number((c.openingBalance + newDebit - c.totalCredit).toFixed(2));
      const newEntry: SettlementLedgerEntry = {
        id: `led-${Date.now()}`,
        date: today,
        docNo: target.id,
        docType: "Schet-faktura",
        description: `Mahsulot realizatsiyasi: ${target.product} (${target.quantity.toLocaleString()} ${target.unit})`,
        debit: target.totalAmount,
        credit: 0,
      };
      return {
        ...c,
        totalDebit: newDebit,
        closingBalance: newClosing,
        lastActivityDate: today,
        status: (newClosing > 0 ? "Debt" : newClosing < 0 ? "Advance" : "Settled") as ClientSettlementRecord["status"],
        ledger: [...c.ledger, newEntry],
      };
    });

    if (!matchedClient && target.customer) {
      updatedSettlements.unshift({
        id: `STL-00${updatedSettlements.length + 1}`,
        customer: target.customer,
        customerTin: target.customerTin || "305000000",
        contractNo: target.contractNo || "CON-2026-NEW",
        openingBalance: 0,
        totalDebit: target.totalAmount,
        totalCredit: 0,
        closingBalance: target.totalAmount,
        currency: target.currency || "USD",
        lastActivityDate: today,
        status: "Debt",
        ledger: [
          {
            id: `led-${Date.now()}`,
            date: today,
            docNo: target.id,
            docType: "Schet-faktura",
            description: `Mahsulot realizatsiyasi: ${target.product} (${target.quantity.toLocaleString()} ${target.unit})`,
            debit: target.totalAmount,
            credit: 0,
          },
        ],
      });
    }

    const shipmentExists = state.warehouseShipments.some((s) => s.id === shipmentId);

    set((s) => ({
      deliveryActs: s.deliveryActs.map((a) => (a.id === actId ? postedAct : a)),
      warehouseShipments: shipmentExists
        ? s.warehouseShipments
        : [newShipment, ...s.warehouseShipments],
      clientSettlements: updatedSettlements,
      tabs: s.tabs.map((t) =>
        t.id === actId ? { ...t, documentData: postedAct, isUnsaved: false } : t
      ),
      notifications: [
        {
          id: `notif-${Date.now()}`,
          title: `${postedAct.id} tasdiqlandi (O'tkazildi)`,
          description: `Omborga chiqim yuk xati (${shipmentId}) yuborildi va ${postedAct.customer} hisobiga +$${postedAct.totalAmount.toLocaleString()} yozildi.`,
          severity: "success",
          timestamp: Date.now(),
          read: false,
          link: { module: "finance", subModule: "settlements" },
        },
        ...s.notifications,
      ],
    }));

    return postedAct;
  },

  addWarehouseShipment: (shipment) =>
    set((state) => ({
      warehouseShipments: [shipment, ...state.warehouseShipments],
    })),

  updateWarehouseShipmentStatus: (shipmentId, status) =>
    set((state) => ({
      warehouseShipments: state.warehouseShipments.map((s) =>
        s.id === shipmentId ? { ...s, status } : s
      ),
    })),

  recordClientPayment: (customer, amount, docNo, note) =>
    set((state) => {
      const today = new Date().toISOString().split("T")[0];
      const payDocNo = docNo || `PAY-${Math.floor(4110 + Math.random() * 890)}`;
      const updated = state.clientSettlements.map((c) => {
        if (c.customer !== customer) return c;
        const newCredit = Number((c.totalCredit + amount).toFixed(2));
        const newClosing = Number((c.openingBalance + c.totalDebit - newCredit).toFixed(2));
        return {
          ...c,
          totalCredit: newCredit,
          closingBalance: newClosing,
          lastActivityDate: today,
          status: (newClosing > 0 ? "Debt" : newClosing < 0 ? "Advance" : "Settled") as ClientSettlementRecord["status"],
          ledger: [
            ...c.ledger,
            {
              id: `led-${Date.now()}`,
              date: today,
              docNo: payDocNo,
              docType: "Payment" as const,
              description: note || `Mijozdan to'lov qabul qilindi (${c.contractNo})`,
              debit: 0,
              credit: amount,
            },
          ],
        };
      });
      return { clientSettlements: updated };
    }),

  toggleReadinessCheck: (idOrWoOrCo, checkKey, auditMeta) =>
    set((state) => {
      const matchKey = idOrWoOrCo.trim().toLowerCase();
      let changedItemTitle = "";
      let newCheckVal = false;
      let newStageAutoPromoted = false;
      let isBlocked = false;

      const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const updated = state.productionQueue.map((item) => {
        const isMatch =
          item.id.toLowerCase() === matchKey ||
          (item.clientOrderId && item.clientOrderId.toLowerCase() === matchKey);
        if (!isMatch) return item;

        const currentVal = !!item.checks[checkKey];
        const existingAudit = item.checks.audit || {};
        const currentAudit = existingAudit[checkKey];

        let nextVal: boolean;
        let nextAuditRecord: GateAuditRecord;

        if (auditMeta?.forceStatus === "blocked") {
          nextVal = false;
          isBlocked = true;
          nextAuditRecord = {
            status: "blocked",
            verifiedBy: auditMeta.verifiedBy || "QC / Floor Lead",
            verifiedAt: nowTime,
            note: auditMeta.note || "Issue reported",
          };
        } else if (auditMeta?.forceStatus === "ready") {
          nextVal = true;
          nextAuditRecord = {
            status: "ready",
            verifiedBy: auditMeta.verifiedBy || "Operator",
            verifiedAt: nowTime,
            note: auditMeta.note,
          };
        } else if (auditMeta?.forceStatus === "pending") {
          nextVal = false;
          nextAuditRecord = {
            status: "pending",
          };
        } else {
          // Standard toggle
          if (currentAudit?.status === "blocked") {
            nextVal = true;
            nextAuditRecord = {
              status: "ready",
              verifiedBy: auditMeta?.verifiedBy || "Operator",
              verifiedAt: nowTime,
            };
          } else {
            nextVal = !currentVal;
            nextAuditRecord = nextVal
              ? {
                  status: "ready",
                  verifiedBy: auditMeta?.verifiedBy || "Operator",
                  verifiedAt: nowTime,
                  note: auditMeta?.note,
                }
              : {
                  status: "pending",
                };
          }
        }

        newCheckVal = nextVal;
        changedItemTitle = item.id;

        const nextChecks: ProductionReadinessChecks = {
          ...item.checks,
          [checkKey]: nextVal,
          audit: {
            ...existingAudit,
            [checkKey]: nextAuditRecord,
          },
        };

        const allReady =
          nextChecks.designReady &&
          nextChecks.paperReady &&
          nextChecks.platesReady &&
          nextChecks.toolingReady;

        let nextStage = item.stage;
        if (allReady && item.stage === "Queue") {
          nextStage = "Ready to Print";
          newStageAutoPromoted = true;
        } else if (!allReady && item.stage === "Ready to Print") {
          nextStage = "Queue";
        }

        return {
          ...item,
          checks: nextChecks,
          stage: nextStage,
        };
      });

      const notifs = changedItemTitle
        ? [
            {
              id: `notif-${Date.now()}`,
              title: `${changedItemTitle}: ${checkKey} ${isBlocked ? "BLOCKED" : "updated"}`,
              description: isBlocked
                ? `Gate ${checkKey} flagged as BLOCKED: ${auditMeta?.note || "Issue reported"}`
                : newStageAutoPromoted
                ? `All 4 checks are ready! Automatically moved to "Ready to Print".`
                : `${checkKey} is now ${newCheckVal ? "Ready (Green)" : "Waiting (Muted)"}.`,
              severity: (isBlocked ? "error" : newStageAutoPromoted ? "success" : "info") as NotifSeverity,
              timestamp: Date.now(),
              read: false,
              link: { module: "production", subModule: "planning" },
            },
            ...state.notifications,
          ]
        : state.notifications;

      return {
        productionQueue: updated,
        notifications: notifs,
      };
    }),

  setProductionStage: (idOrWoOrCo, stage) =>
    set((state) => {
      const matchKey = idOrWoOrCo.trim().toLowerCase();
      let changedItem: ProductionQueueItem | undefined;

      const updated = state.productionQueue.map((item) => {
        const isMatch =
          item.id.toLowerCase() === matchKey ||
          (item.clientOrderId && item.clientOrderId.toLowerCase() === matchKey);
        if (!isMatch) return item;
        changedItem = item;

        let completedSheets = item.completedSheets;
        if (stage === "Completed" && item.plannedSheets) {
          completedSheets = item.plannedSheets;
        } else if (stage === "In Production" && (!completedSheets || completedSheets === 0) && item.plannedSheets) {
          completedSheets = Math.round(item.plannedSheets * 0.1);
        }

        return {
          ...item,
          stage,
          completedSheets,
        };
      });

      const notifs = changedItem
        ? [
            {
              id: `notif-${Date.now()}`,
              title: `${changedItem.id} stage updated`,
              description: `Moved to "${stage}" on ${changedItem.pressMachine}`,
              severity: (stage === "Completed" ? "success" : "info") as NotifSeverity,
              timestamp: Date.now(),
              read: false,
              link: { module: "production", subModule: "planning" },
            },
            ...state.notifications,
          ]
        : state.notifications;

      return {
        productionQueue: updated,
        notifications: notifs,
      };
    }),

  updateQueueMachine: (idOrWoOrCo, machine) =>
    set((state) => {
      const matchKey = idOrWoOrCo.trim().toLowerCase();
      return {
        productionQueue: state.productionQueue.map((item) => {
          const isMatch =
            item.id.toLowerCase() === matchKey ||
            (item.clientOrderId && item.clientOrderId.toLowerCase() === matchKey);
          return isMatch ? { ...item, pressMachine: machine } : item;
        }),
      };
    }),

  reorderQueueOrder: (idOrWoOrCo, direction) =>
    set((state) => {
      const matchKey = idOrWoOrCo.trim().toLowerCase();
      const targetItem = state.productionQueue.find(
        (i) =>
          i.id.toLowerCase() === matchKey ||
          (i.clientOrderId && i.clientOrderId.toLowerCase() === matchKey)
      );
      if (!targetItem) return state;

      const machineItems = state.productionQueue
        .filter((i) => i.pressMachine === targetItem.pressMachine)
        .sort((a, b) => a.queueOrder - b.queueOrder);

      const currentIndex = machineItems.findIndex((i) => i.id === targetItem.id);
      if (currentIndex === -1) return state;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= machineItems.length) return state;

      const currentOrder = machineItems[currentIndex].queueOrder;
      const swapOrder = machineItems[targetIndex].queueOrder;

      const swappedMap = new Map<string, number>();
      swappedMap.set(machineItems[currentIndex].id, swapOrder);
      swappedMap.set(machineItems[targetIndex].id, currentOrder);

      return {
        productionQueue: state.productionQueue.map((i) =>
          swappedMap.has(i.id) ? { ...i, queueOrder: swappedMap.get(i.id)! } : i
        ),
      };
    }),

  upsertProductionQueueItem: (item) =>
    set((state) => {
      const exists = state.productionQueue.some((i) => i.id === item.id);
      if (exists) {
        return {
          productionQueue: state.productionQueue.map((i) =>
            i.id === item.id ? ({ ...i, ...item } as ProductionQueueItem) : i
          ),
        };
      }
      const newItem: ProductionQueueItem = {
        ...item,
        id: item.id,
        customer: item.customer || "New Customer",
        product: item.product || "Print Job",
        quantity: item.quantity || 1000,
        unit: item.unit || "pcs",
        pressMachine: item.pressMachine || "Heidelberg Speedmaster XL 106-8P",
        department: item.department || "Offset",
        priority: item.priority || "Normal",
        stage: item.stage || "Queue",
        queueOrder: state.productionQueue.filter((i) => i.pressMachine === item.pressMachine).length + 1,
        checks: item.checks || { designReady: false, paperReady: false, platesReady: false, toolingReady: false },
        deadline: item.deadline || new Date().toISOString().split("T")[0],
        plannedSheets: item.plannedSheets || item.quantity || 1000,
        completedSheets: item.completedSheets || 0,
        operator: item.operator,
        shift: item.shift,
      };
      return {
        productionQueue: [newItem, ...state.productionQueue],
      };
    }),

  // ── Notifications seed data ─────────────────────────────────────────────────
  isNotifPanelOpen: false,
  notifications: [
    {
      id: "notif-1",
      title: "WO-00351 deadline approaching",
      description: "Hardcover Catalog is due in 6 days. Prepress: Approved.",
      severity: "warning",
      timestamp: Date.now() - 1000 * 60 * 8,
      read: false,
      link: { module: "production", subModule: "work-orders" },
    },
    {
      id: "notif-2",
      title: "Stock alert: Galerie Art Silk 150g",
      description: "Warehouse stock below reorder point (42 sheets remaining).",
      severity: "error",
      timestamp: Date.now() - 1000 * 60 * 35,
      read: false,
      link: { module: "warehouse", subModule: "stock" },
    },
    {
      id: "notif-3",
      title: "Schet-faktura SF-8001 rasmiylashtirildi",
      description: "Alpha Media Group LLC — $14,850.00 (Ombor yuk xati: SHP-6000).",
      severity: "success",
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      read: false,
      link: { module: "finance", subModule: "delivery-acts" },
    },
    {
      id: "notif-4",
      title: "Sync completed",
      description: "All registries refreshed at 00:58.",
      severity: "info",
      timestamp: Date.now() - 1000 * 60 * 60 * 6,
      read: true,
    },
  ],

  setNotifPanelOpen: (open) => set({ isNotifPanelOpen: open }),

  addNotification: (notif) =>
    set((state) => ({
      notifications: [
        {
          ...notif,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          read: false,
        },
        ...state.notifications,
      ],
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAllNotifications: () => set({ notifications: [] }),

  // ── AI Copilot Chat state & actions ─────────────────────────────────────────
  isAiChatOpen: false,
  setAiChatOpen: (open) => set({ isAiChatOpen: open }),
  toggleAiChat: () => set((state) => ({ isAiChatOpen: !state.isAiChatOpen })),

  isCreateOrderOpen: false,
  setCreateOrderOpen: (open) => set({ isCreateOrderOpen: open }),
  isCreateWorkOrderOpen: false,
  setCreateWorkOrderOpen: (open) => set({ isCreateWorkOrderOpen: open }),

  openTab: (tab) =>
    set((state) => {
      // Normalize tab if referencing removed sales module
      const normalizedModule =
        tab.module === "sales"
          ? tab.type === "delivery-act"
            ? "finance"
            : "production"
          : tab.module;
      const normalizedTab = { ...tab, module: normalizedModule };

      // 1. Single Registry Tab Slot: Replace the existing registry tab in-place at index 0
      if (normalizedTab.type === "registry") {
        const docTabs = state.tabs.filter((t) => t.type !== "registry");
        return {
          tabs: [normalizedTab, ...docTabs],
          activeTabId: normalizedTab.id,
        };
      }

      // 2. If document tab already exists, activate it
      const exists = state.tabs.find((t) => t.id === normalizedTab.id);
      if (exists) {
        return { activeTabId: normalizedTab.id };
      }

      // 3. Smart Tab Limit: Auto-evict the oldest saved document tab when full
      const nextTabs = [...state.tabs];
      while (nextTabs.length >= MAX_OPEN_TABS) {
        let evictIdx = nextTabs.findIndex(
          (t) => t.type !== "registry" && !t.isUnsaved && t.id !== state.activeTabId
        );
        if (evictIdx === -1) {
          evictIdx = nextTabs.findIndex((t) => t.type !== "registry" && !t.isUnsaved);
        }
        if (evictIdx === -1) break; // All open documents have unsaved changes; preserve them
        nextTabs.splice(evictIdx, 1);
      }

      return {
        tabs: [...nextTabs, normalizedTab],
        activeTabId: normalizedTab.id,
      };
    }),

  closeTab: (id) =>
    set((state) => {
      // Keep at least the primary registry tab open so workspace is never empty
      if (state.tabs.length === 1 && state.tabs[0].id === id && state.tabs[0].type === "registry") {
        return state;
      }
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        const nextTab = newTabs[closedIndex] || newTabs[closedIndex - 1] || newTabs[0];
        newActiveId = nextTab ? nextTab.id : "";
      }
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    }),

  closeSavedTabs: () =>
    set((state) => {
      const keptTabs = state.tabs.filter((t) => t.type === "registry" || t.isUnsaved);
      const finalTabs = keptTabs.length > 0 ? keptTabs : state.tabs.slice(0, 1);
      const activeStillExists = finalTabs.some((t) => t.id === state.activeTabId);
      return {
        tabs: finalTabs,
        activeTabId: activeStillExists ? state.activeTabId : (finalTabs[0]?.id ?? ""),
      };
    }),

  closeAllDocumentTabs: () =>
    set((state) => {
      const registryTabs = state.tabs.filter((t) => t.type === "registry");
      const finalTabs =
        registryTabs.length > 0
          ? registryTabs
          : [
              {
                id: "registry-work-orders",
                title: "Work Orders (Registry)",
                type: "registry" as const,
                module: state.activeModule || "production",
                isUnsaved: false,
              },
            ];
      return {
        tabs: finalTabs,
        activeTabId: finalTabs[0].id,
      };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  setActiveModule: (module) =>
    set({ activeModule: module, currentModule: module }),

  setModule: (module, subMod = "work-orders") =>
    set((state) => {
      const regId = subMod === "work-orders" ? "registry-work-orders" : `tab-${module}-${subMod}`;
      const existingReg = state.tabs.find((t) => t.id === regId);
      const regTab: DocumentTab = existingReg ?? {
        id: regId,
        title: subMod,
        type: "registry",
        module,
        isUnsaved: false,
      };
      const docTabs = state.tabs.filter((t) => t.type !== "registry");
      return {
        activeModule: module,
        currentModule: module,
        currentSubModule: subMod,
        tabs: [regTab, ...docTabs],
        activeTabId: regId,
      };
    }),

  setSubModule: (subMod) => set({ currentSubModule: subMod }),

  setTabUnsaved: (id, isUnsaved) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, isUnsaved } : t)),
    })),

  setLevel3Tab: (tabId, level3Tab) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, activeLevel3Tab: level3Tab } : t
      ),
    })),

  updateGridStats: (selectedCount, totalCount, cellCoords) =>
    set((state) => ({
      selectedCount,
      totalCount,
      activeCellCoords: cellCoords || state.activeCellCoords,
    })),

  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      try {
        localStorage.setItem("printgoo_theme", theme);
      } catch (e) {}
    }
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        if (nextTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        try {
          localStorage.setItem("printgoo_theme", nextTheme);
        } catch (e) {}
      }
      return { theme: nextTheme };
    });
  },

  setCommandOpen: (open) => set({ isCommandOpen: open }),
  toggleCommand: () => set((state) => ({ isCommandOpen: !state.isCommandOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setShowStatusBar: (show) => {
    try {
      localStorage.setItem("printgoo_show_status_bar", String(show));
    } catch (e) {}
    set({ showStatusBar: show });
  },
  toggleStatusBar: () => {
    set((state) => {
      const next = !state.showStatusBar;
      try {
        localStorage.setItem("printgoo_show_status_bar", String(next));
      } catch (e) {}
      return { showStatusBar: next };
    });
  },

  isAuthenticated: false,
  currentUser: DEMO_USERS.operator,

  switchTab: (direction = "next") =>
    set((state) => {
      if (state.tabs.length <= 1) return state;
      const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
      const step = direction === "prev" ? -1 : 1;
      let nextIndex = 0;
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + step + state.tabs.length) % state.tabs.length;
      }
      const nextTab = state.tabs[nextIndex];
      if (!nextTab) return state;
      return {
        activeTabId: nextTab.id,
      };
    }),


  login: (user) => {
    set((state) => {
      const updatedUser = user ? { ...state.currentUser, ...user } : state.currentUser;
      const targetMod = updatedUser.defaultModule || state.activeModule || "production";
      const defaultSubMap: Record<string, string> = {
        production: "work-orders",
        warehouse: "stock-balance",
        crm: "customers",
        finance: "settlements",
        settings: "plants",
      };
      const targetSub = defaultSubMap[targetMod] || "work-orders";
      const regId = targetSub === "work-orders" ? "registry-work-orders" : `tab-${targetMod}-${targetSub}`;
      const regTab: DocumentTab = {
        id: regId,
        title: targetSub,
        type: "registry",
        module: targetMod,
        isUnsaved: false,
      };
      const docTabs = state.tabs.filter((t) => t.type !== "registry");
      try {
        localStorage.setItem("printgoo_auth", "true");
        localStorage.setItem("printgoo_user", JSON.stringify(updatedUser));
      } catch (e) {}
      return {
        isAuthenticated: true,
        currentUser: updatedUser,
        activeModule: targetMod,
        currentModule: targetMod,
        currentSubModule: targetSub,
        tabs: [regTab, ...docTabs],
        activeTabId: regId,
      };
    });
  },

  logout: () => {
    try {
      localStorage.removeItem("printgoo_auth");
    } catch (e) {}
    set({ isAuthenticated: false });
  },
}));
