import { create } from "zustand";
import { MachineRecord } from "@/components/documents/machine/types";
import { INITIAL_MACHINES_RECORD } from "@/components/documents/machine/data";
import { PlantRecord } from "@/components/documents/plant/types";
import { INITIAL_PLANTS_RECORD } from "@/components/documents/plant/data";
import {
  EmployeeRecord,
  AttendanceRecord,
  PieceworkRecord,
  PayrollRecord,
  DepartmentRecord,
  ShiftRecord,
} from "@/components/documents/hr/types";
import {
  INITIAL_EMPLOYEES,
  INITIAL_ATTENDANCE,
  INITIAL_PIECEWORK,
  INITIAL_PAYROLL,
  INITIAL_DEPARTMENTS,
  INITIAL_SHIFTS,
} from "@/components/documents/hr/data";
import { getMaterialImage } from "@/lib/materialImages";
import { MASTER_SPECIFICATIONS } from "@/components/documents/work-order/types";

export interface DocumentTab {
  id: string;
  title: string;
  type: "registry" | "work-order" | "bom" | "product-spec" | "customer" | "invoice" | "client-order" | "sales-record" | "delivery-act" | "warehouse-receipt" | "warehouse-shipment" | "planning-slot" | "machine-detail" | "warehouse-stock" | "plant-detail" | "employee-detail" | "payroll-detail" | "trading-sale" | "trading-order" | "trading-settlement" | "trading-import" | "trading-catalog";
  module: string;
  isUnsaved?: boolean;
  documentData?: any;
  activeLevel3Tab?: string;
}

export interface DeliveryActItem {
  id: string;
  sku: string;
  name: string;
  size?: string;
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

export interface ShipmentLineItem {
  id: string;
  sku: string;
  name: string;
  orderQty: number;
  shippedQty: number;
  unit: string;
  packageCount?: number;
  packageType?: string;
  palletNo?: string;
  notes?: string;
}

export type ShipmentType = "CustomerDelivery" | "Outsourcing" | "BranchTransfer" | "VendorReturn" | "MaterialSale";

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
  driverName?: string;
  driverPhone?: string;
  vehicleNo?: string;
  recipientName?: string;
  powerOfAttorney?: string;
  packagesCount?: number;
  grossWeightKg?: number;
  volumeM3?: number;
  notes?: string;
  status: "Draft" | "Packed" | "Dispatched" | "In Transit" | "Delivered";
  shipmentType?: ShipmentType;
  items?: ShipmentLineItem[];
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

export interface CustomerToolingItem {
  id: string;
  customerId?: string;
  customerName?: string;
  name: string;
  toolType: string;
  format: string;
  cavities: string;
  location: string;
  impressionsUsed: number;
  maxLife: number;
  status: "Ready" | "Re-knifing Soon" | "Damaged" | "In Maintenance";
}

export interface CustomerContactPerson {
  id: string;
  role: "director" | "accountant" | "procurement" | "warehouse" | "manager" | "other";
  roleLabel: string;
  name: string;
  phone: string;
  email?: string;
  telegram?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface CustomerContractRecord {
  id: string;
  contractNo: string;
  title: string;
  type: "frame" | "order_spec" | "tender" | "annual";
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "terminated";
  isDefault: boolean;
  amountUsd?: number;
  paymentTerms?: string;
  notes?: string;
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
  legalAddress?: string;
  deliveryAddress?: string;
  bankName?: string;
  bankAccount?: string;
  mfo?: string;
  oked?: string;
  vatPayer?: boolean;
  vatNumber?: string;
  creditLimitUsd?: number;
  contractDate?: string;
  contractExpiry?: string;
  notes?: string;
  contacts?: CustomerContactPerson[];
  contracts?: CustomerContractRecord[];
  receivingHours?: string;
  requiresPowerOfAttorney?: boolean;
  deliveryTransportNote?: string;
  specialRequirements?: string;
}

export interface MasterSpecificationRecord {
  id: string;
  code: string;
  name: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  description: string;
  materialsCount: number;
  estimatedCost: string;
  unit: string;
  materials?: Array<{ id?: string; name: string; quantity: number; unit: string; spec?: string; unitPrice?: number }>;
  operations?: Array<{ id?: string; name: string; machineStr: string }>;
}

export interface WarehouseStockRecord {
  sku: string;
  name: string;
  category: "Paper & Board" | "Roll & Label" | "Inks & Plates" | "Foil & Film" | "Adhesives & Binding" | "Offcuts & Scraps";
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
  isOffcut?: boolean;
  parentMaterialSku?: string;
  cutDimensions?: string;
  sourceWorkOrder?: string;
  rollWidthMm?: number;
  rollLengthM?: number;
  batchNo?: string;
  expiryDate?: string;
  supplier?: string;
  grainDirection?: "Long Grain" | "Short Grain";
  imageUrl?: string;
}

export interface WarehouseMovementRecord {
  id: string;
  date: string;
  material: string;
  materialSku?: string;
  sheetFormat?: string;
  quantity: number;
  receivedQty: number;
  unit: string;
  from: string;
  to: string;
  reason: string;
  status: "Completed" | "In Transit" | "Pending";
  operator: string;
  isOffcut?: boolean;
  movementType?: "Transfer" | "CuttingReturn" | "WriteOff" | "ProductionIssue";
  parentMaterialSku?: string;
  cutDimensions?: string;
  workOrderId?: string;
}

export interface FinishedGoodStockRecord {
  id: string; // e.g. "FG-3001"
  workOrderId: string; // "WO-00351"
  clientOrderId?: string; // "CO-0041"
  customerId: string; // "CUST-101"
  customerName: string; // "Alpha Media Group LLC"
  customerTin?: string; // "305841920"
  productName: string; // "A4 Hardcover Catalog 96p"
  batchNo: string; // "B-2026-108"
  orderDate: string; // "2026-10-05"
  completionDate: string; // "2026-10-11"
  orderedQty: number; // 10000
  producedQty: number; // 15000
  shippedQty: number; // 10000
  stockQty: number; // 5000 (producedQty - shippedQty)
  unit: string; // "dona"
  costPricePerUnit: number; // 0.42
  totalStockValue: number; // 2100.00
  location: string; // "Tayyor Mahsulot Ombori — Rampa 2, Pallet P-04"
  palletCount?: number; // 3
  daysInStock: number; // 7
  status: "In Stock" | "Ready for Dispatch" | "Partially Shipped" | "Reserved";
  notes?: string;
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
  sampleRequired?: boolean;
  sampleStatus?: "none" | "in_production" | "awaiting_approval" | "approved" | "revision_requested";
  sampleQty?: number;
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
  isInspectorActive: boolean;
  setInspectorActive: (active: boolean) => void;
  toggleInspectorMode: () => void;
  lastInspectedElement: {
    elementLabel: string;
    componentName: string;
    moduleName: string;
    relativePath: string;
    fileName: string;
    lineRangeLabel: string;
    startLine: number;
    vscodeUrl: string;
    aiPromptText: string;
  } | null;
  setLastInspectedElement: (
    info: {
      elementLabel: string;
      componentName: string;
      moduleName: string;
      relativePath: string;
      fileName: string;
      lineRangeLabel: string;
      startLine: number;
      vscodeUrl: string;
      aiPromptText: string;
    } | null
  ) => void;
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
  upsertWarehouseShipment: (shipment: WarehouseShipmentRecord) => void;
  updateWarehouseShipmentStatus: (shipmentId: string, status: WarehouseShipmentRecord["status"]) => void;
  warehouseMovements: WarehouseMovementRecord[];
  addWarehouseMovement: (movement: WarehouseMovementRecord) => void;
  returnOffcutToStock: (payload: {
    parentSku: string;
    parentName: string;
    cutDimensions: string;
    quantity: number;
    unit?: "sheets" | "rolls" | "kg" | "pcs" | "m²";
    location?: string;
    workOrderId?: string;
    operator?: string;
    unitPriceUsd?: number;
  }) => void;
  recordClientPayment: (customer: string, amount: number, docNo?: string, note?: string) => void;
  customerTooling: CustomerToolingItem[];
  upsertCustomerTooling: (tool: CustomerToolingItem) => void;

  // ── Customer Dedicated Finished Goods Stock (Mas'ul Saqlov / Zaxira) ──────
  finishedGoods: FinishedGoodStockRecord[];
  upsertFinishedGood: (item: FinishedGoodStockRecord) => void;
  shipFromFinishedGood: (id: string, shipQty: number, shipmentDocNo?: string) => void;

  // ── Workshop Equipment Registry & Specifications ─────────────────────────
  masterSpecifications: MasterSpecificationRecord[];
  upsertMasterSpecification: (spec: MasterSpecificationRecord) => void;
  machines: MachineRecord[];
  upsertMachine: (machine: MachineRecord) => void;

  // ── Enterprise Branches & Plants ──────────────────────────────────────────
  plants: PlantRecord[];
  upsertPlant: (plant: PlantRecord) => void;

  // ── HR, Staff, Attendance & Payroll ───────────────────────────────────────
  employees: EmployeeRecord[];
  attendance: AttendanceRecord[];
  piecework: PieceworkRecord[];
  payrolls: PayrollRecord[];
  departmentsList: DepartmentRecord[];
  shiftsList: ShiftRecord[];
  upsertEmployee: (emp: EmployeeRecord) => void;
  upsertAttendance: (att: AttendanceRecord) => void;
  upsertPiecework: (pw: PieceworkRecord) => void;
  upsertPayroll: (pay: PayrollRecord) => void;

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

  // Tab actions & confirmation state
  tabToConfirmClose: DocumentTab | null;
  setTabToConfirmClose: (tab: DocumentTab | null) => void;
  openTab: (tab: DocumentTab) => void;
  requestCloseTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeSavedTabs: () => void;
  closeAllDocumentTabs: () => void;
  setActiveTab: (id: string) => void;
  setActiveModule: (module: string) => void;
  setModule: (mod: string, subMod?: string) => void;
  setSubModule: (subMod: string) => void;
  setTabUnsaved: (id: string, isUnsaved: boolean) => void;
  updateTabData: (id: string, documentData: Record<string, any>, title?: string) => void;
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
    driverName: "R. Ismoilov (+998 90 123-45-67)",
    vehicleNo: "01 A 772 BB (ISUZU Furgon)",
    recipientName: "Karimova M. (Bosh hisobchi)",
    powerOfAttorney: "№ 184 / 12.10.2026 dan",
    packagesCount: 10,
    grossWeightKg: 145,
    volumeM3: 0.85,
    status: "Delivered",
    shipmentType: "CustomerDelivery",
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
    from: "Main Factory — Tashkent",
    carrier: "Express Logistics UZ",
    trackingNo: "TRK900014",
    status: "In Transit",
    shipmentType: "CustomerDelivery",
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
    shipmentType: "CustomerDelivery",
  },
  {
    id: "SHP-6005",
    date: "2026-10-11",
    customer: "Samarkand Branch (Filial ombori)",
    deliveryActId: "TRN-901",
    workOrder: "—",
    product: "Gold Foil — Hot Stamp 220mm (FIN-001)",
    quantity: 4,
    unit: "rolls",
    from: "Main Factory — Tashkent",
    carrier: "Express Logistics UZ",
    trackingNo: "TRK900015",
    driverName: "K. Boboyev (+998 93 456-78-90)",
    vehicleNo: "01 845 VAA (Furgon)",
    recipientName: "B. Salimov (Samarqand filiali mudiri)",
    powerOfAttorney: "Ichki yuk xati № 41/26",
    packagesCount: 1,
    grossWeightKg: 28,
    volumeM3: 0.15,
    status: "In Transit",
    shipmentType: "BranchTransfer",
    items: [
      {
        id: "line-tr-1",
        sku: "FIN-001",
        name: "Gold Foil — Hot Stamp 220mm",
        orderQty: 4,
        shippedQty: 4,
        unit: "rolls",
        packageCount: 1,
        packageType: "Karton quti",
        palletNo: "Pallet T-01",
        notes: "Samarqand filialiga ehtiyoj uchun yuborildi",
      },
    ],
  },
  {
    id: "SHP-6006",
    date: "2026-10-09",
    customer: "Bukhara Finishing Shop (Buxoro filiali)",
    deliveryActId: "TRN-902",
    workOrder: "—",
    product: "CTP Plate Fuji Brillia 790×1030 (PLT-001)",
    quantity: 50,
    unit: "pcs",
    from: "Main Factory — Tashkent",
    carrier: "PrintGoo Fleet #1",
    trackingNo: "TRK900018",
    driverName: "R. Ismoilov (+998 90 123-45-67)",
    vehicleNo: "01 A 772 BB",
    recipientName: "Sh. Qodirov (Buxoro sexi mudiri)",
    powerOfAttorney: "Ichki yuk xati № 42/26",
    packagesCount: 2,
    grossWeightKg: 65,
    volumeM3: 0.35,
    status: "Delivered",
    shipmentType: "BranchTransfer",
    items: [
      {
        id: "line-tr-2",
        sku: "PLT-001",
        name: "CTP Plate Fuji Brillia 790×1030",
        orderQty: 50,
        shippedQty: 50,
        unit: "pcs",
        packageCount: 2,
        packageType: "Maxsus qadoq (Plastinka)",
        palletNo: "Pallet B-02",
        notes: "Oylik ehtiyoj uchun Buxoroga yetkazildi",
      },
    ],
  },
  {
    id: "SHP-6007",
    date: "2026-10-14",
    customer: "Master UV & Foil Co (Subpudrat)",
    deliveryActId: "SUB-104",
    workOrder: "WO-00351",
    product: "A4 Katalog muqovasi (Tilla folga va UF-lak uchun)",
    quantity: 5200,
    unit: "sheets",
    from: "Main Factory — Tashkent",
    carrier: "PrintGoo Fleet #2",
    trackingNo: "TRK900028",
    driverName: "A. Xalilov (+998 90 987-65-43)",
    vehicleNo: "01 B 334 CC",
    recipientName: "N. Sobirov (Autsorsing ustasi)",
    powerOfAttorney: "Subpudrat dalolatnomasi № 12",
    packagesCount: 6,
    grossWeightKg: 110,
    volumeM3: 0.6,
    status: "Dispatched",
    shipmentType: "Outsourcing",
    items: [
      {
        id: "line-out-1",
        sku: "PRN-WO-00351-COV",
        name: "A4 Katalog muqovasi (Qisman bosilgan B2 varaqlar)",
        orderQty: 5200,
        shippedQty: 5200,
        unit: "sheets",
        packageCount: 6,
        packageType: "Gofroquti",
        palletNo: "Pallet O-01",
        notes: "Tilla folga bosish uchun autsorserga yuborildi",
      },
    ],
  },
  ...Array.from({ length: 37 }, (_, i) => {
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

export const INITIAL_FINISHED_GOODS: FinishedGoodStockRecord[] = [
  {
    id: "FG-3001",
    workOrderId: "WO-00351",
    clientOrderId: "CO-0041",
    customerId: "CUST-101",
    customerName: "Alpha Media Group LLC",
    customerTin: "305841920",
    productName: "A4 Hardcover Catalog 96p",
    batchNo: "B-2026-108",
    orderDate: "2026-10-05",
    completionDate: "2026-10-11",
    orderedQty: 10000,
    producedQty: 15000,
    shippedQty: 10000,
    stockQty: 5000,
    unit: "pcs",
    costPricePerUnit: 0.42,
    totalStockValue: 2100.0,
    location: "Tayyor Mahsulot Ombori — Rampa 2, Pallet P-04",
    palletCount: 3,
    daysInStock: 7,
    status: "In Stock",
    notes: "Ortiqcha tiraj mijoz talabnomasi (call-off) bo'yicha mas'ul saqlovda saqlanmoqda.",
  },
  {
    id: "FG-3002",
    workOrderId: "WO-00368",
    clientOrderId: "CO-0055",
    customerId: "CUST-101",
    customerName: "Alpha Media Group LLC",
    customerTin: "305841920",
    productName: "Korporativ Buklet A5 (Soft-touch)",
    batchNo: "B-2026-114",
    orderDate: "2026-10-12",
    completionDate: "2026-10-15",
    orderedQty: 5000,
    producedQty: 6200,
    shippedQty: 5000,
    stockQty: 1200,
    unit: "pcs",
    costPricePerUnit: 0.38,
    totalStockValue: 456.0,
    location: "Tayyor Mahsulot Ombori — Rampa 1, Pallet P-11",
    palletCount: 1,
    daysInStock: 3,
    status: "In Stock",
    notes: "Tirajdan ortgan qoldiq, navbatdagi yetkazib berish uchun saqlanmoqda.",
  },
  {
    id: "FG-3003",
    workOrderId: "WO-00362",
    clientOrderId: "CO-0049",
    customerId: "CUST-102",
    customerName: "Nordic Print Co",
    customerTin: "307192834",
    productName: "Shokolad qutilari 250g (Zarhal & Kongrev)",
    batchNo: "B-2026-099",
    orderDate: "2026-10-01",
    completionDate: "2026-10-06",
    orderedQty: 20000,
    producedQty: 23500,
    shippedQty: 15000,
    stockQty: 8500,
    unit: "pcs",
    costPricePerUnit: 0.45,
    totalStockValue: 3825.0,
    location: "Tayyor Mahsulot Ombori — Rampa 3, Pallet FG-09",
    palletCount: 4,
    daysInStock: 12,
    status: "Partially Shipped",
    notes: "15,000 dona topshirilgan, qolgan 8,500 dona talabnoma bo'yicha yetkaziladi.",
  },
  {
    id: "FG-3004",
    workOrderId: "WO-00354",
    clientOrderId: "CO-0044",
    customerId: "CUST-103",
    customerName: "Apex Packaging",
    customerTin: "308291045",
    productName: "E-Flute Kraft Quti 350x250x120",
    batchNo: "B-2026-102",
    orderDate: "2026-10-03",
    completionDate: "2026-10-08",
    orderedQty: 10000,
    producedQty: 11800,
    shippedQty: 10000,
    stockQty: 1800,
    unit: "pcs",
    costPricePerUnit: 0.7,
    totalStockValue: 1260.0,
    location: "Tayyor Mahsulot Ombori — Bino 2, Sektor C, Pallet P-02",
    palletCount: 2,
    daysInStock: 10,
    status: "In Stock",
    notes: "Mijoz zaxirasi: mas'ul saqlov shartnomasi asosida omborda saqlanmoqda.",
  },
  {
    id: "FG-3005",
    workOrderId: "WO-00375",
    clientOrderId: "CO-0060",
    customerId: "CUST-104",
    customerName: "Zenith Publishing",
    customerTin: "309384756",
    productName: "Maktab darsligi 160 bet (Ofset)",
    batchNo: "B-2026-118",
    orderDate: "2026-10-08",
    completionDate: "2026-10-13",
    orderedQty: 50000,
    producedQty: 52400,
    shippedQty: 50000,
    stockQty: 2400,
    unit: "pcs",
    costPricePerUnit: 0.8,
    totalStockValue: 1920.0,
    location: "Asosiy Ombor — Sektor D, Pallet P-22",
    palletCount: 2,
    daysInStock: 5,
    status: "In Stock",
    notes: "Ofset mashinasida texnologik ortiqcha chiqqan tiraj.",
  },
  {
    id: "FG-3006",
    workOrderId: "WO-00380",
    clientOrderId: "CO-0063",
    customerId: "CUST-106",
    customerName: "Vanguard Fashion",
    customerTin: "311502938",
    productName: "Premium Brending Paketlar (Laminatsiya)",
    batchNo: "B-2026-121",
    orderDate: "2026-10-10",
    completionDate: "2026-10-14",
    orderedQty: 8000,
    producedQty: 9500,
    shippedQty: 6000,
    stockQty: 3500,
    unit: "pcs",
    costPricePerUnit: 0.45,
    totalStockValue: 1575.0,
    location: "Tayyor Mahsulot Ombori — Rampa 1, Pallet FG-18",
    palletCount: 2,
    daysInStock: 4,
    status: "Ready for Dispatch",
    notes: "Ishonchnoma olindi, navbatdagi reysda yuklanadi.",
  },
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
    legalAddress: "Toshkent sh., Mirobod tumani, Nukus ko'chasi 77",
    deliveryAddress: "Toshkent sh., Sergeli tumani, Yangi Sergeli 14-ombor",
    receivingHours: "Dush-Juma: 09:00 - 18:00 (Tushlik 13:00 - 14:00)",
    requiresPowerOfAttorney: true,
    deliveryTransportNote: "Fura va Gazel bemalol kiradi, rampa mavjud",
    specialRequirements: "Mijoz logotipi Pantone 286C rangida qat'iy tekshirilsin. Qadoqlash 50 tadan bo'lsin.",
    contacts: [
      {
        id: "CONT-101-1",
        role: "director",
        roleLabel: "Bosh direktor",
        name: "Farhod Karimov",
        phone: "+998 90 111-22-33",
        email: "director@alphamedia.uz",
        telegram: "farhod_karimov",
        isPrimary: false,
        notes: "Shartnoma va strategik masalalar",
      },
      {
        id: "CONT-101-2",
        role: "accountant",
        roleLabel: "Bosh buxgalter",
        name: "Nigora Umarova",
        phone: "+998 97 450-11-22",
        email: "bux@alphamedia.uz",
        telegram: "nigora_bux",
        isPrimary: false,
        notes: "Akt sverka, hisob-faktura va to'lovlar",
      },
      {
        id: "CONT-101-3",
        role: "procurement",
        roleLabel: "Ta'minot boshlig'i",
        name: "Sardor Alimov",
        phone: "+998 90 912-34-56",
        email: "procurement@alphamedia.uz",
        telegram: "sardor_alimov",
        isPrimary: true,
        notes: "Buyurtmalar, maketlar va tiraj tasdiqlash",
      },
      {
        id: "CONT-101-4",
        role: "warehouse",
        roleLabel: "Ombor mudiri",
        name: "Bahodir Mirzayev",
        phone: "+998 93 888-99-00",
        email: "ombor@alphamedia.uz",
        telegram: "bahodir_ombor",
        isPrimary: false,
        notes: "Mahsulot qabul qilish va ishonchnoma (doverennost)",
      },
    ],
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
    legalAddress: "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi",
    deliveryAddress: "Toshkent vil., Zangiota tumani, Markaziy ombor №3",
    receivingHours: "Dush-Shanba: 08:30 - 17:30 (Tushlik 12:30 - 13:30)",
    requiresPowerOfAttorney: true,
    deliveryTransportNote: "Faqat Gazel yoki Isuzu (Darvoza balandligi 3.2m), rampa yo'q (qo'lda tushiriladi)",
    specialRequirements: "Trikotaj qadoq yorliqlari 100 tadan rezinka lenta bilan bog'lansin, namlikdan himoya qiluvchi plyonka shart.",
    contacts: [
      {
        id: "CONT-102-1",
        role: "director",
        roleLabel: "Bosh direktor",
        name: "Sherzod Toshmatov",
        phone: "+998 90 333-44-55",
        email: "ceo@vanguardfashion.uz",
        telegram: "sherzod_vanguard",
        isPrimary: false,
        notes: "Yillik shartnomalar va narx siyosati",
      },
      {
        id: "CONT-102-2",
        role: "accountant",
        roleLabel: "Bosh buxgalter",
        name: "Malika Sobirova",
        phone: "+998 91 777-66-55",
        email: "finance@vanguardfashion.uz",
        telegram: "malika_finance",
        isPrimary: false,
        notes: "To'lovlar, schyot-fakturalar va akt sverka",
      },
      {
        id: "CONT-102-3",
        role: "procurement",
        roleLabel: "Buyurtmalar koordinatori",
        name: "Kamola Rustamova",
        phone: "+998 93 551-20-10",
        email: "supply@vanguardfashion.uz",
        telegram: "kamola_rustamova",
        isPrimary: true,
        notes: "Kiyim yorliqlari va qadoq buyurtmalari",
      },
      {
        id: "CONT-102-4",
        role: "warehouse",
        roleLabel: "Markaziy ombor mudiri",
        name: "Jasur Aliyev",
        phone: "+998 99 770-88-99",
        email: "warehouse@vanguardfashion.uz",
        telegram: "jasur_zangiota",
        isPrimary: false,
        notes: "Markaziy ombor №3, tayyor mahsulotni qabul qilish",
      },
    ],
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

export const INITIAL_CUSTOMER_TOOLING: CustomerToolingItem[] = [
  {
    id: "FOIL-301",
    customerName: "Alpha Media Group LLC",
    name: "Hot Foil Brass Cliché — Luxury Perfume & Catalog Cover",
    toolType: "Hot Foil Cliché (Brass 7mm)",
    format: "180×120 mm",
    cavities: "2-up",
    location: "Cabinet C-01",
    impressionsUsed: 18500,
    maxLife: 300000,
    status: "Ready",
  },
  {
    id: "DIE-004",
    customerName: "Alpha Media Group LLC",
    name: "A4 Presentation Folder Die w/ Business Card Slot",
    toolType: "Flatbed Die (Штанцформа)",
    format: "640×460 mm (B2)",
    cavities: "2-up",
    location: "Rack A-05",
    impressionsUsed: 42000,
    maxLife: 150000,
    status: "Ready",
  },
  {
    id: "DIE-001",
    customerName: "Apex Packaging",
    name: "FEFCO 0201 Master Carton Die (400×300×250)",
    toolType: "Flatbed Die (Штанцформа)",
    format: "1020×720 mm (B1)",
    cavities: "2-up",
    location: "Rack A-01",
    impressionsUsed: 64200,
    maxLife: 150000,
    status: "Ready",
  },
  {
    id: "DIE-002",
    customerName: "Apex Packaging",
    name: "Pharma Folding Box 60×40×110 (Tuck-End)",
    toolType: "Flatbed Die (Штанцформа)",
    format: "700×1000 mm",
    cavities: "18-up",
    location: "Rack A-02",
    impressionsUsed: 138500,
    maxLife: 150000,
    status: "Re-knifing Soon",
  },
  {
    id: "CL-204",
    customerName: "Nordic Print Co",
    name: "Flexo Photopolymer Plate Set (CMYK + White) — Satin Label",
    toolType: "Flexo Cliché (Флексоклише 1.14mm)",
    format: "Z=96 (304.8 mm)",
    cavities: "6-up",
    location: "Cabinet B-04",
    impressionsUsed: 210000,
    maxLife: 500000,
    status: "Ready",
  },
  {
    id: "DIE-008",
    customerName: "Baltic Press LLC",
    name: "Retail Hanging Box Die with Euro-Slot",
    toolType: "Flatbed Die (Штанцформа)",
    format: "500×700 mm (B2)",
    cavities: "6-up",
    location: "Rack B-02",
    impressionsUsed: 31000,
    maxLife: 150000,
    status: "Ready",
  },
  {
    id: "DIE-005",
    customerName: "Vanguard Fashion",
    name: "Garment Swing Tag 50×90 with Eyelet Hole",
    toolType: "Steel Rule Die (Штанцформа)",
    format: "350×500 mm (B3)",
    cavities: "12-up",
    location: "Cabinet A-03",
    impressionsUsed: 12000,
    maxLife: 100000,
    status: "Ready",
  },
];

const RAW_INITIAL_WAREHOUSE_STOCK: WarehouseStockRecord[] = [
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
    supplier: "Antalis Central Asia",
    grainDirection: "Long Grain",
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
    supplier: "Igepa Group GmbH",
    grainDirection: "Long Grain",
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
    supplier: "Mondi Syktyvkar",
    grainDirection: "Short Grain",
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
    supplier: "Segezha Group",
    grainDirection: "Long Grain",
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
    supplier: "GF Smith London",
    grainDirection: "Long Grain",
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
    supplier: "Sylvamo Svetogorsk",
    grainDirection: "Long Grain",
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
    rollWidthMm: 60,
    rollLengthM: 200,
    supplier: "Zhejiang Narrow Fabrics Co",
    batchNo: "SAT-2026-09B",
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
    rollWidthMm: 50,
    rollLengthM: 250,
    supplier: "Zhejiang Narrow Fabrics Co",
    batchNo: "TAF-4011-A",
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
    supplier: "Henkel Adhesives",
    batchNo: "HNK-PVA-8812",
    expiryDate: "2027-04-15",
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
    sheetFormat: "1030×790",
    supplier: "Fujifilm CIS",
    batchNo: "FJ-CTP-2026-4",
    expiryDate: "2027-10-01",
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
    supplier: "Toyo Ink Uzbekistan",
    batchNo: "TY-CMYK-9910",
    expiryDate: "2028-01-20",
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
    rollWidthMm: 320,
    rollLengthM: 1000,
    supplier: "Cosmo Films Europe",
    batchNo: "CSM-ST-28-09",
  },
  {
    sku: "MAT-1010-OFF",
    name: "Galerie Art Silk 150g/m² (470×700) [Delovoy otxod]",
    category: "Offcuts & Scraps",
    grammage: 150,
    sheetFormat: "470×700",
    unit: "sheets",
    location: "Rack A-01-B (Offcuts / Qoldiqlar zonasi)",
    stockLevel: 2400,
    reserved: 400,
    available: 2000,
    reorder: 500,
    unitPriceUsd: 0.11,
    lastReceived: "2026-10-12",
    status: "In Stock",
    isOffcut: true,
    parentMaterialSku: "MAT-1010",
    cutDimensions: "470×700",
    sourceWorkOrder: "WO-00351",
    supplier: "Ichki kesim sexi (Polar 115)",
  },
  {
    sku: "MAT-1020-OFF",
    name: "Coated Cardboard 300g/m² (350×700) [Delovoy otxod]",
    category: "Offcuts & Scraps",
    grammage: 300,
    sheetFormat: "350×700",
    unit: "sheets",
    location: "Rack A-04-B (Offcuts / Qoldiqlar zonasi)",
    stockLevel: 3100,
    reserved: 0,
    available: 3100,
    reorder: 600,
    unitPriceUsd: 0.18,
    lastReceived: "2026-10-14",
    status: "In Stock",
    isOffcut: true,
    parentMaterialSku: "MAT-1020",
    cutDimensions: "350×700",
    sourceWorkOrder: "WO-00365",
    supplier: "Ichki kesim sexi (Wohlenberg)",
  },
  {
    sku: "MAT-1025-OFF",
    name: "Kraft Board 350g/m² (500×700) [Delovoy otxod]",
    category: "Offcuts & Scraps",
    grammage: 350,
    sheetFormat: "500×700",
    unit: "sheets",
    location: "Rack B-01-B (Offcuts / Qoldiqlar zonasi)",
    stockLevel: 1200,
    reserved: 300,
    available: 900,
    reorder: 300,
    unitPriceUsd: 0.22,
    lastReceived: "2026-10-15",
    status: "In Stock",
    isOffcut: true,
    parentMaterialSku: "MAT-1025",
    cutDimensions: "500×700",
    sourceWorkOrder: "WO-00370",
    supplier: "Ichki kesim sexi (Wohlenberg)",
  },
];

export const INITIAL_WAREHOUSE_STOCK: WarehouseStockRecord[] = RAW_INITIAL_WAREHOUSE_STOCK.map((item) => ({
  ...item,
  imageUrl: item.imageUrl || getMaterialImage(item),
}));

export const INITIAL_WAREHOUSE_MOVEMENTS: WarehouseMovementRecord[] = [
  {
    id: "MOV-4018",
    date: "2026-10-16",
    material: "Galerie Art Silk 150g/m² (470×700) [Delovoy otxod]",
    materialSku: "MAT-1010-OFF",
    sheetFormat: "470×700",
    quantity: 400,
    receivedQty: 400,
    unit: "sheets",
    from: "Rack A-01-B (Offcuts / Qoldiqlar zonasi)",
    to: "Digital Press Room — Canon imagePRESS V1000",
    reason: "Delovoy otxodni qayta ishlatish: WO-00378 kiyim yorliqlari uchun sarf (Tejaldi: $44)",
    status: "Completed",
    operator: "N. Yusupova",
    isOffcut: true,
    movementType: "ProductionIssue",
    parentMaterialSku: "MAT-1010",
    cutDimensions: "470×700",
    workOrderId: "WO-00378",
  },
  {
    id: "MOV-4017",
    date: "2026-10-16",
    material: "White Satin Ribbon 60mm",
    materialSku: "MAT-2010",
    quantity: 80,
    receivedQty: 80,
    unit: "rolls",
    from: "Rack C-01 (Ribbon & Narrow Web)",
    to: "Label Weaving Dept — Muller Barudan",
    reason: "Sexga sarf: WO-00352 (Woven Satin Labels) uchun to'qima lenta berildi",
    status: "Completed",
    operator: "S. Abdullayev",
    movementType: "ProductionIssue",
    workOrderId: "WO-00352",
  },
  {
    id: "MOV-4016",
    date: "2026-10-15",
    material: "CTP Thermal Plates 1030×790mm",
    materialSku: "MAT-4010",
    sheetFormat: "1030×790",
    quantity: 32,
    receivedQty: 32,
    unit: "pcs",
    from: "Prepress Vault E-01",
    to: "CTP Room — Heidelberg Suprasetter 106",
    reason: "Prepress sarfi: WO-00353 (Perfume Folding Box) qoliplar komplekti (4C)",
    status: "Completed",
    operator: "D. Alimov",
    movementType: "ProductionIssue",
    workOrderId: "WO-00353",
  },
  {
    id: "MOV-4015",
    date: "2026-10-15",
    material: "Kraft Board 350g/m² (500×700) [Delovoy otxod]",
    materialSku: "MAT-1025-OFF",
    sheetFormat: "500×700",
    quantity: 1200,
    receivedQty: 1200,
    unit: "sheets",
    from: "Cutting Section — Wohlenberg Guillotine",
    to: "Rack B-01-B (Offcuts / Qoldiqlar zonasi)",
    reason: "Kesimdan qolgan qog'oz (Delovoy otxod) kirimi — WO-00370",
    status: "Completed",
    operator: "D. Karimov",
    isOffcut: true,
    movementType: "CuttingReturn",
    parentMaterialSku: "MAT-1025",
    cutDimensions: "500×700",
    workOrderId: "WO-00370",
  },
  {
    id: "MOV-4014",
    date: "2026-10-15",
    material: "Toyo Hyplus Cyan (Process)",
    materialSku: "INK-001",
    quantity: 15,
    receivedQty: 15,
    unit: "kg",
    from: "Main Factory — Tashkent (Rack C-02)",
    to: "Press Room — Heidelberg XL 106",
    reason: "Production issue for WO-00351",
    status: "Completed",
    operator: "S. Abdullayev",
    movementType: "ProductionIssue",
    workOrderId: "WO-00351",
  },
  {
    id: "MOV-4013",
    date: "2026-10-14",
    material: "Soft-Touch Matte Lamination Film 28μm",
    materialSku: "MAT-5010",
    quantity: 6,
    receivedQty: 6,
    unit: "rolls",
    from: "Finishing Store F-01",
    to: "Laminating Line — Autobond Mini 76",
    reason: "Laminatsiya sarfi: WO-00351 Hardcover Catalog muqovasi uchun",
    status: "Completed",
    operator: "R. Ismoilov",
    movementType: "ProductionIssue",
    workOrderId: "WO-00351",
  },
  {
    id: "MOV-4012",
    date: "2026-10-14",
    material: "Coated Cardboard 300g/m² (350×700) [Delovoy otxod]",
    materialSku: "MAT-1020-OFF",
    sheetFormat: "350×700",
    quantity: 3100,
    receivedQty: 3100,
    unit: "sheets",
    from: "Cutting Section — Wohlenberg Guillotine",
    to: "Rack A-04-B (Offcuts / Qoldiqlar zonasi)",
    reason: "Kesimdan qolgan qog'oz (Delovoy otxod) kirimi — WO-00365",
    status: "Completed",
    operator: "S. Abdullayev",
    isOffcut: true,
    movementType: "CuttingReturn",
    parentMaterialSku: "MAT-1020",
    cutDimensions: "350×700",
    workOrderId: "WO-00365",
  },
  {
    id: "MOV-4011",
    date: "2026-10-13",
    material: "PVA Dispersion Glue (Kashirovka)",
    materialSku: "MAT-3010",
    quantity: 45,
    receivedQty: 45,
    unit: "kg",
    from: "Chem Store D-01",
    to: "Casing-in & Bindery — Kolbus BF 513",
    reason: "Muqovalash sarfi: WO-00351 kitob bloklarini yelimlash",
    status: "Completed",
    operator: "N. Yusupova",
    movementType: "ProductionIssue",
    workOrderId: "WO-00351",
  },
  {
    id: "MOV-4010",
    date: "2026-10-13",
    material: "Galerie Art Silk 150g/m²",
    materialSku: "MAT-1010",
    sheetFormat: "700×1000",
    quantity: 10000,
    receivedQty: 10000,
    unit: "sheets",
    from: "Main Factory — Tashkent (Rack A-01)",
    to: "Cutting Section — Polar 115",
    reason: "Transfer for slitting to WO-00351",
    status: "Completed",
    operator: "D. Karimov",
    movementType: "Transfer",
    workOrderId: "WO-00351",
  },
  {
    id: "MOV-4008",
    date: "2026-10-12",
    material: "Galerie Art Silk 150g/m² (470×700) [Delovoy otxod]",
    materialSku: "MAT-1010-OFF",
    sheetFormat: "470×700",
    quantity: 2400,
    receivedQty: 2400,
    unit: "sheets",
    from: "Cutting Section — Polar 115 Guillotine",
    to: "Rack A-01-B (Offcuts / Qoldiqlar zonasi)",
    reason: "Kesimdan qolgan qog'oz (Delovoy otxod) kirimi — WO-00351",
    status: "Completed",
    operator: "N. Yusupova",
    isOffcut: true,
    movementType: "CuttingReturn",
    parentMaterialSku: "MAT-1010",
    cutDimensions: "470×700",
    workOrderId: "WO-00351",
  },
  {
    id: "MOV-4005",
    date: "2026-10-11",
    material: "Munken Polar Rough 120g/m² (A4)",
    materialSku: "PAP-002",
    quantity: 150,
    receivedQty: 150,
    unit: "sheets",
    from: "Offset Press Room — Heidelberg XL 106",
    to: "Scrap & Waste Area (Makulatura)",
    reason: "Pritirka va sozlash jarayonidagi texnologik chiqindi (Akt spisaniya #14)",
    status: "Completed",
    operator: "A. Kovalev",
    movementType: "WriteOff",
  },
  {
    id: "MOV-4003",
    date: "2026-10-10",
    material: "Toyo Hyplus Black (Process)",
    materialSku: "INK-004",
    quantity: 10,
    receivedQty: 10,
    unit: "kg",
    from: "Rack C-02 (Central Ink Storage)",
    to: "Mixing Station M-01 (Ichki ko'chirish)",
    reason: "Rang qorish stansiyasiga ichki ko'chirish",
    status: "Completed",
    operator: "S. Abdullayev",
    movementType: "Transfer",
  },
  {
    id: "MOV-4001",
    date: "2026-10-09",
    material: "CTP Plate Fuji Brillia 790×1030",
    materialSku: "PLT-001",
    quantity: 24,
    receivedQty: 24,
    unit: "pcs",
    from: "Main Paper Hall (Rack A-01)",
    to: "Prepress & CTP Room",
    reason: "Sexga sarf: WO-00351 uchun CTP qoliplar chiqarish",
    status: "Completed",
    operator: "D. Alimov",
    movementType: "ProductionIssue",
    workOrderId: "WO-00351",
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
  isInspectorActive: false,
  lastInspectedElement: null,

  // ── Cross-module ERP Records (Schet-faktura, Shipments, Settlements, Customers, Stock) ──
  deliveryActs: INITIAL_DELIVERY_ACTS,
  warehouseShipments: INITIAL_WAREHOUSE_SHIPMENTS,
  clientSettlements: INITIAL_CLIENT_SETTLEMENTS,
  crmCustomers: INITIAL_CRM_CUSTOMERS,
  warehouseStock: INITIAL_WAREHOUSE_STOCK,
  warehouseMovements: INITIAL_WAREHOUSE_MOVEMENTS,
  productionQueue: INITIAL_PRODUCTION_QUEUE,
  machines: INITIAL_MACHINES_RECORD,
  plants: INITIAL_PLANTS_RECORD,
  employees: INITIAL_EMPLOYEES,
  attendance: INITIAL_ATTENDANCE,
  piecework: INITIAL_PIECEWORK,
  payrolls: INITIAL_PAYROLL,
  departmentsList: INITIAL_DEPARTMENTS,
  shiftsList: INITIAL_SHIFTS,
  customerTooling: INITIAL_CUSTOMER_TOOLING,
  finishedGoods: INITIAL_FINISHED_GOODS,
  masterSpecifications: MASTER_SPECIFICATIONS as MasterSpecificationRecord[],

  upsertMasterSpecification: (spec) =>
    set((state) => {
      const exists = state.masterSpecifications.some((s) => s.code === spec.code || s.id === spec.id);
      return {
        masterSpecifications: exists
          ? state.masterSpecifications.map((s) => (s.code === spec.code || s.id === spec.id ? { ...s, ...spec } : s))
          : [spec, ...state.masterSpecifications],
      };
    }),

  upsertFinishedGood: (item) =>
    set((state) => {
      const exists = state.finishedGoods.some((fg) => fg.id === item.id);
      return {
        finishedGoods: exists
          ? state.finishedGoods.map((fg) => (fg.id === item.id ? item : fg))
          : [item, ...state.finishedGoods],
      };
    }),

  shipFromFinishedGood: (id, shipQty, shipmentDocNo) =>
    set((state) => {
      const updated = state.finishedGoods.map((fg) => {
        if (fg.id !== id) return fg;
        const newShipped = fg.shippedQty + shipQty;
        const newStock = Math.max(0, fg.producedQty - newShipped);
        const newStatus: FinishedGoodStockRecord["status"] =
          newStock === 0 ? "Partially Shipped" : "In Stock";
        return {
          ...fg,
          shippedQty: newShipped,
          stockQty: newStock,
          totalStockValue: Number((newStock * fg.costPricePerUnit).toFixed(2)),
          status: newStatus,
          notes: shipmentDocNo
            ? `${fg.notes ? fg.notes + " • " : ""}${shipmentDocNo} orqali ${shipQty} dona yuklandi.`
            : fg.notes,
        };
      });
      return { finishedGoods: updated };
    }),

  upsertMachine: (machine) =>
    set((state) => {
      const exists = state.machines.some((m) => m.id === machine.id);
      return {
        machines: exists
          ? state.machines.map((m) => (m.id === machine.id ? machine : m))
          : [machine, ...state.machines],
      };
    }),

  upsertPlant: (plant) =>
    set((state) => {
      const exists = state.plants.some((p) => p.id === plant.id);
      return {
        plants: exists
          ? state.plants.map((p) => (p.id === plant.id ? plant : p))
          : [plant, ...state.plants],
      };
    }),

  upsertEmployee: (emp) =>
    set((state) => {
      const exists = state.employees.some((e) => e.id === emp.id);
      return {
        employees: exists
          ? state.employees.map((e) => (e.id === emp.id ? emp : e))
          : [emp, ...state.employees],
      };
    }),

  upsertAttendance: (att) =>
    set((state) => {
      const exists = state.attendance.some((a) => a.id === att.id);
      return {
        attendance: exists
          ? state.attendance.map((a) => (a.id === att.id ? att : a))
          : [att, ...state.attendance],
      };
    }),

  upsertPiecework: (pw) =>
    set((state) => {
      const exists = state.piecework.some((p) => p.id === pw.id);
      return {
        piecework: exists
          ? state.piecework.map((p) => (p.id === pw.id ? pw : p))
          : [pw, ...state.piecework],
      };
    }),

  upsertPayroll: (pay) =>
    set((state) => {
      const exists = state.payrolls.some((p) => p.id === pay.id);
      return {
        payrolls: exists
          ? state.payrolls.map((p) => (p.id === pay.id ? pay : p))
          : [pay, ...state.payrolls],
      };
    }),

  upsertCustomerTooling: (tool) =>
    set((state) => {
      const exists = state.customerTooling.some((t) => t.id === tool.id);
      return {
        customerTooling: exists
          ? state.customerTooling.map((t) => (t.id === tool.id ? tool : t))
          : [tool, ...state.customerTooling],
      };
    }),

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
        imageUrl: stock.imageUrl || getMaterialImage(stock),
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

  upsertWarehouseShipment: (shipment) =>
    set((state) => {
      const exists = state.warehouseShipments.some((s) => s.id === shipment.id);
      const updatedShipments = exists
        ? state.warehouseShipments.map((s) => (s.id === shipment.id ? shipment : s))
        : [shipment, ...state.warehouseShipments];
      const updatedTabs = state.tabs.map((t) =>
        t.id === shipment.id ? { ...t, documentData: shipment, isUnsaved: false } : t
      );
      return { warehouseShipments: updatedShipments, tabs: updatedTabs };
    }),

  updateWarehouseShipmentStatus: (shipmentId, status) =>
    set((state) => ({
      warehouseShipments: state.warehouseShipments.map((s) =>
        s.id === shipmentId ? { ...s, status } : s
      ),
    })),

  addWarehouseMovement: (movement) =>
    set((state) => ({
      warehouseMovements: [movement, ...state.warehouseMovements],
    })),

  returnOffcutToStock: (payload) =>
    set((state) => {
      const today = new Date().toISOString().split("T")[0];
      const offcutSku = `${payload.parentSku}-OFF`;
      const offcutName = `${payload.parentName} (${payload.cutDimensions}) [Delovoy otxod]`;
      const targetLocation = payload.location || "Rack A-01-B (Offcuts / Qoldiqlar zonasi)";
      const existing = state.warehouseStock.find((s) => s.sku === offcutSku);

      let updatedStockList: WarehouseStockRecord[];
      if (existing) {
        const newStockLevel = existing.stockLevel + payload.quantity;
        const newAvailable = Math.max(0, newStockLevel - existing.reserved);
        const updatedOffcut: WarehouseStockRecord = {
          ...existing,
          stockLevel: newStockLevel,
          available: newAvailable,
          lastReceived: today,
          status: newAvailable <= existing.reorder * 0.5 ? "Critical" : newAvailable <= existing.reorder ? "Low Stock" : "In Stock",
        };
        updatedStockList = state.warehouseStock.map((s) => (s.sku === offcutSku ? updatedOffcut : s));
      } else {
        const newOffcut: WarehouseStockRecord = {
          sku: offcutSku,
          name: offcutName,
          category: "Offcuts & Scraps",
          sheetFormat: payload.cutDimensions,
          unit: payload.unit || "sheets",
          location: targetLocation,
          stockLevel: payload.quantity,
          reserved: 0,
          available: payload.quantity,
          reorder: Math.max(200, Math.round(payload.quantity * 0.2)),
          unitPriceUsd: payload.unitPriceUsd || 0.12,
          lastReceived: today,
          status: "In Stock",
          isOffcut: true,
          parentMaterialSku: payload.parentSku,
          cutDimensions: payload.cutDimensions,
          sourceWorkOrder: payload.workOrderId,
          imageUrl: getMaterialImage({ isOffcut: true, name: offcutName, sku: offcutSku }),
        };
        updatedStockList = [newOffcut, ...state.warehouseStock];
      }

      const nextMovId = `MOV-${4016 + state.warehouseMovements.length}`;
      const newMovement: WarehouseMovementRecord = {
        id: nextMovId,
        date: today,
        material: offcutName,
        materialSku: offcutSku,
        sheetFormat: payload.cutDimensions,
        quantity: payload.quantity,
        receivedQty: payload.quantity,
        unit: payload.unit || "sheets",
        from: "Cutting Section — Guillotine (Rezka sexi)",
        to: targetLocation,
        reason: `Kesimdan qolgan qog'oz (Delovoy otxod) kirimi — ${payload.workOrderId || "Rezka"}`,
        status: "Completed",
        operator: payload.operator || "D. Karimov",
        isOffcut: true,
        movementType: "CuttingReturn",
        parentMaterialSku: payload.parentSku,
        cutDimensions: payload.cutDimensions,
        workOrderId: payload.workOrderId,
      };

      return {
        warehouseStock: updatedStockList,
        warehouseMovements: [newMovement, ...state.warehouseMovements],
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Delovoy otxod kirim qilindi (${offcutSku})`,
            description: `${offcutName}: ${payload.quantity.toLocaleString()} ${payload.unit || "varaq"} omborga qo'shildi.`,
            severity: "info",
            timestamp: Date.now(),
            read: false,
            link: { module: "warehouse", subModule: "stock-balance" },
          },
          ...state.notifications,
        ],
      };
    }),

  recordClientPayment: (customer, amount, docNo, note) =>
    set((state) => {
      const today = new Date().toISOString().split("T")[0];
      const payDocNo = docNo || `PAY-${Math.floor(4110 + Math.random() * 890)}`;
      const cleanCustomer = customer.trim().toLowerCase();
      const inSettlements = state.clientSettlements.some(
        (c) =>
          c.customer.trim().toLowerCase() === cleanCustomer ||
          c.customer.toLowerCase().includes(cleanCustomer) ||
          cleanCustomer.includes(c.customer.toLowerCase())
      );

      if (inSettlements) {
        const updated = state.clientSettlements.map((c) => {
          const match =
            c.customer.trim().toLowerCase() === cleanCustomer ||
            c.customer.toLowerCase().includes(cleanCustomer) ||
            cleanCustomer.includes(c.customer.toLowerCase());
          if (!match) return c;
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
      } else {
        const matchedCust = state.crmCustomers.find(
          (cust) =>
            cust.name.trim().toLowerCase() === cleanCustomer ||
            cust.name.toLowerCase().includes(cleanCustomer)
        );
        const newRecord: ClientSettlementRecord = {
          id: `STL-00${state.clientSettlements.length + 1}`,
          customer: matchedCust?.name || customer,
          customerTin: matchedCust?.tin || "300000000",
          contractNo: matchedCust?.contractNo || "CON-2026-NEW",
          openingBalance: 0,
          totalDebit: 0,
          totalCredit: amount,
          closingBalance: -amount,
          currency: "USD",
          lastActivityDate: today,
          status: "Advance",
          ledger: [
            {
              id: `led-${Date.now()}`,
              date: today,
              docNo: payDocNo,
              docType: "Payment" as const,
              description: note || `Mijozdan to'lov qabul qilindi`,
              debit: 0,
              credit: amount,
            },
          ],
        };
        return { clientSettlements: [newRecord, ...state.clientSettlements] };
      }
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
  setCreateOrderOpen: (open) => {
    if (open) {
      get().setCreateWorkOrderOpen(true);
    } else {
      set({ isCreateOrderOpen: false });
    }
  },
  isCreateWorkOrderOpen: false,
  setCreateWorkOrderOpen: (open) => {
    if (!open) {
      set({ isCreateWorkOrderOpen: false });
      return;
    }
    const newWoId = `WO-00${Math.floor(360 + Math.random() * 639)}`;
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    get().openTab({
      id: newWoId,
      title: `${newWoId}: New Work Order`,
      type: "work-order",
      module: "production",
      isUnsaved: true,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: newWoId,
        orderType: "Production",
        customer: "",
        product: "New Print Order",
        department: "Offset",
        site: "Building 1",
        recipe: "OFFSET_STD_V1",
        quantity: 5000,
        unit: "pcs",
        status: "Draft",
        priority: "Normal",
        pressMachine: "Heidelberg Speedmaster XL 106",
        startDate: today,
        deadline: nextWeek,
        currency: "USD",
        priceTotal: 0,
      },
    });
  },

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

  tabToConfirmClose: null,
  setTabToConfirmClose: (tab) => set({ tabToConfirmClose: tab }),

  requestCloseTab: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab.isUnsaved) {
      set({ tabToConfirmClose: tab });
    } else {
      get().closeTab(id);
    }
  },

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
        tabToConfirmClose: state.tabToConfirmClose?.id === id ? null : state.tabToConfirmClose,
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

  updateTabData: (id, documentData, title) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              documentData: { ...(t.documentData || {}), ...documentData },
              ...(title ? { title } : {}),
            }
          : t
      ),
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
  setInspectorActive: (active) => set({ isInspectorActive: active }),
  toggleInspectorMode: () =>
    set((state) => ({ isInspectorActive: !state.isInspectorActive })),
  setLastInspectedElement: (info) => set({ lastInspectedElement: info }),

  isAuthenticated: false,
  currentUser: DEMO_USERS.sales,

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
