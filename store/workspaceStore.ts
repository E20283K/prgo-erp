import { create } from "zustand";
import { toast } from "@/components/ui/toast";
import { MachineRecord } from "@/components/documents/machine/types";
import { PlantRecord, branchToPlantRecord, createEmptyPlant } from "@/components/documents/plant/types";
import { TariffRecord, createEmptyTariff } from "@/components/documents/tariff/types";
import { useLookupStore } from "@/store/lookupStore";
import {
  EmployeeRecord,
  AttendanceRecord,
  PieceworkRecord,
  PayrollRecord,
  DepartmentRecord,
  PositionRecord,
  ShiftRecord,
  BiometricDeviceRecord,
} from "@/components/documents/hr/types";
import { getMaterialImage } from "@/lib/materialImages";
import { getUserInitials } from "@/lib/utils";
import { getNextWorkOrderNo } from "@/components/documents/work-order/utils/workOrderNumbering";
import type { SystemUserRecord } from "@/components/documents/user/types";
import { INITIAL_SYSTEM_USERS } from "@/components/documents/user/data";
import type { SupplierRecord } from "@/lib/server/supplierService";
export type { SupplierRecord };
import type {
  TradingSaleRecord,
  TradingOrderRecord,
  YttTurnoverLimitRecord,
  TradingImportBatchRecord,
  TradingCatalogItemRecord,
  TradingSettlementLedgerEntry,
} from "@/components/documents/trading/types";
import type { ToastSoundConfig } from "@/lib/sound/soundService";
import {
  INITIAL_YTT_ENTITIES,
  INITIAL_TRADING_SALES,
  INITIAL_IMPORT_BATCHES,
  INITIAL_SETTLEMENT_LEDGERS,
  INITIAL_TRADING_CATALOG,
} from "@/components/documents/trading/data";

export interface DocumentTab {
  id: string;
  title: string;
  type: "registry" | "work-order" | "bom" | "product-spec" | "customer" | "supplier" | "delivery-act" | "warehouse-receipt" | "warehouse-shipment" | "planning-slot" | "machine-detail" | "warehouse-stock" | "plant-detail" | "tariff-detail" | "employee-detail" | "department-detail" | "position-detail" | "shift-detail" | "payroll-detail" | "trading-sale" | "trading-order" | "trading-settlement" | "trading-import" | "trading-catalog" | "trading-ytt-limit" | "user-detail";
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

export interface DieToolingRecord {
  id: string;
  code: string;
  name: string;
  dieType: "rotary_magnetic" | "solid_rotary" | "flatbed" | "hot_stamp" | "embossing";
  shape: "rectangle" | "rounded_rect" | "circle" | "oval" | "custom";
  widthMm: number | string;
  heightMm: number | string;
  cornerRadiusMm?: number | string;
  acrossCount: number;
  aroundCount: number;
  gapXMm?: number | string;
  gapYMm?: number | string;
  repeatLengthMm?: number | string;
  cylinderTeeth?: number;
  location?: string;
  status: "available" | "in_use" | "sharpening" | "retired";
  totalImpressions?: number;
  maxImpressions?: number;
  notes?: string;
  customerId?: string | null;
  customerName?: string | null;
  ownership?: "in_house" | "customer_owned";
  isDedicated?: boolean;
  isActive?: boolean;
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
  currency?: "UZS" | "USD";
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
  category?: string;
  department: "Offset" | "Flexo" | "Jacquard" | "Post-press";
  status?: string;
  version?: string;
  basePrice?: number | string;
  currency?: string;
  unit: string;
  description?: string;
  baseMaterial?: string;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    dimensionUnit?: string;
  };
  techSpecs?: Record<string, any>;
  materialsCount: number;
  estimatedCost: string;
  materials?: Array<{ id?: string; name: string; quantity: number; unit: string; spec?: string; unitPrice?: number; wastePercent?: number }>;
  operations?: Array<{ id?: string; name: string; machineStr: string; durationHours?: number; operator?: string }>;
  createdAt?: string;
  updatedAt?: string;
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
  workOrderId: string; // "WOOF-26-0351"
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
  id: string; // e.g. "WOOF-26-0351"
  docNo?: string;
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
  orderType?: string;
  sampleRequired?: boolean;
  sampleStatus?: "none" | "in_production" | "awaiting_approval" | "approved" | "revision_requested";
  sampleQty?: number;
  sampleData?: any;
  photoUrl?: string;
  photoUrls?: string[];
  attachments?: any[];
  site?: string;
  priceTotal?: number;
  status?: string;
  startDate?: string;
  recipe?: string;
  dimensions?: any;
  toolingItems?: any[];
  materials?: any[];
  colorsConfig?: any;
  paperStock?: string;
  coating?: string;
  lamination?: string;
  laminationSides?: "1s" | "2s";
  laminationMicron?: number;
  embellishment?: string;
  currency?: string;
  width?: number;
  height?: number;
  dimensionUnit?: string;
  bleed?: number;
  shapeType?: any;
  cornerType?: string;
  itemCategory?: string;
  boxDepth?: number;
  foldType?: string;
  boxType?: string;
  customShape?: string;
  customSvgPath?: string;
  holeSize?: number;
  holePosition?: string;
  holeOffset?: number;
  sizes?: any[];
  skuArtworks?: any[];
  kashirovkaMode?: any;
  kashirovkaStrategy?: any;
  kashirovkaLayers?: any[];
  kashirovkaGlueGsm?: number;
  kashirovkaMakeReadySheets?: number;
  kashirovkaCuringHours?: number;
  selectedToolingId?: string;
  selectedToolingName?: string;
  toolingProcurementNeeded?: boolean;
  toolingProcurementCost?: number;
  frontColors?: any;
  backColors?: any;
  spotColorItems?: any[];
  packagingData?: any;
  artworkFront?: string;
  artworkBack?: string;
  financials?: any;
  milestones?: any[];
  operations?: any[];
  events?: any[];
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotifSeverity = "info" | "success" | "warning" | "error";
export type NotifCategory = "production" | "warehouse" | "finance" | "crm" | "system";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  severity: NotifSeverity;
  category?: NotifCategory;
  eventType?: string;
  entityCode?: string;
  timestamp: number; // Date.now()
  read: boolean;
  link?: { module: string; subModule: string };
  targetTab?: DocumentTab;
  channel?: "inbox" | "toast" | "both";
  i18nKey?: string;
  i18nParams?: Record<string, string | number>;
}

export type AppTheme = "dark" | "light";

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  initials: string;
  defaultModule: string;
  avatar?: string;
  id?: string;
  code?: string;
  username?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  plant?: string;
  status?: string;
  language?: "uz" | "ru" | "en" | "tr";
  permissions?: import("@/components/documents/user/types").UserPermissions;
  scope?: import("@/components/documents/user/types").UserScope;
  security?: import("@/components/documents/user/types").UserSecurity;
}

export const DEMO_USERS: Record<string, UserProfile> = {
  admin: {
    id: "admin",
    name: "Administrator",
    fullName: "Administrator",
    email: "admin@printgoo.uz",
    role: "System Administrator",
    initials: "AD",
    defaultModule: "settings",
    avatar: undefined,
    permissions: {
      crm: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      trading: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      production: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      warehouse: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      finance: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      hr: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
      settings: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
    },
    scope: {
      allPlants: true,
      plantIds: [],
      viewCostPrice: true,
      viewMargin: true,
      maxDiscountPercent: 100,
      ownDocumentsOnly: false,
    },
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
  isCrmCustomersLoading?: boolean;
  loadCrmCustomers: (companyCode?: string) => Promise<void>;
  upsertCustomerAsync: (customer: CrmCustomerRecord, companyCode?: string) => Promise<any>;

  suppliers: SupplierRecord[];
  isSuppliersLoading: boolean;
  loadSuppliers: (companyCode?: string) => Promise<void>;
  upsertSupplierAsync: (supplier: Partial<SupplierRecord>, companyCode?: string) => Promise<any>;
  deleteSupplierAsync: (id: string, companyCode?: string) => Promise<boolean>;
  warehouseStock: WarehouseStockRecord[];
  isWarehouseStockLoading: boolean;
  loadWarehouseStock: (companyCode?: string) => Promise<void>;
  upsertWarehouseStockAsync: (stock: any, companyCode?: string) => Promise<boolean>;
  upsertCustomer: (customer: CrmCustomerRecord) => void;
  upsertWarehouseStock: (stock: WarehouseStockRecord) => void;
  reserveStockForOrder: (materialQuery: string, qty: number, orderDocNo: string) => void;
  upsertDeliveryAct: (act: DeliveryActRecord) => void;
  postDeliveryAct: (actId: string) => DeliveryActRecord | undefined;
  createDeliveryActFromOrder: (payload: {
    id?: string;
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
  isWarehouseShipmentsLoading: boolean;
  loadWarehouseShipments: (companyCode?: string) => Promise<void>;
  upsertWarehouseShipmentAsync: (shipment: any, companyCode?: string) => Promise<any>;

  warehouseReceipts: any[];
  isWarehouseReceiptsLoading: boolean;
  loadWarehouseReceipts: (companyCode?: string) => Promise<void>;
  upsertWarehouseReceiptAsync: (receipt: any, companyCode?: string) => Promise<any>;

  warehousesList: any[];
  isWarehousesLoading: boolean;
  loadWarehouses: (companyCode?: string) => Promise<void>;
  upsertWarehouseAsync: (wh: any, companyCode?: string) => Promise<boolean>;
  deleteWarehouseAsync: (id: string, companyCode?: string) => Promise<boolean>;

  inventoryCounts: any[];
  isInventoryCountsLoading: boolean;
  loadInventoryCounts: (companyCode?: string) => Promise<void>;
  upsertInventoryCountAsync: (count: any, companyCode?: string) => Promise<boolean>;

  warehouseMovements: WarehouseMovementRecord[];
  isWarehouseMovementsLoading: boolean;
  loadWarehouseMovements: (companyCode?: string) => Promise<void>;
  upsertWarehouseMovementAsync: (mov: any, companyCode?: string) => Promise<boolean>;
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
  isFinanceLoading: boolean;
  loadFinanceData: (companyCode?: string) => Promise<void>;
  recordPaymentAsync: (payload: {
    customer: string;
    amount: number;
    docNo?: string;
    note?: string;
    currency?: string;
    exchangeRate?: number;
    method?: "bank_transfer" | "cash" | "corporate_card" | "offset";
    contractNo?: string;
  }, companyCode?: string) => Promise<boolean>;
  saveDeliveryActAsync: (act: DeliveryActRecord, companyCode?: string) => Promise<boolean>;
  customerTooling: CustomerToolingItem[];
  upsertCustomerTooling: (tool: CustomerToolingItem) => void;

  // ── Customer Dedicated Finished Goods Stock (Mas'ul Saqlov / Zaxira) ──────
  finishedGoods: FinishedGoodStockRecord[];
  isFinishedGoodsLoading: boolean;
  loadFinishedGoods: (companyCode?: string) => Promise<void>;
  upsertFinishedGoodAsync: (item: any, companyCode?: string) => Promise<boolean>;
  upsertFinishedGood: (item: FinishedGoodStockRecord) => void;
  shipFromFinishedGood: (id: string, shipQty: number, shipmentDocNo?: string) => void;

  // ── Workshop Equipment Registry & Specifications ─────────────────────────
  masterSpecifications: MasterSpecificationRecord[];
  isSpecificationsLoading: boolean;
  loadSpecificationsAsync: () => Promise<void>;
  upsertMasterSpecification: (spec: MasterSpecificationRecord) => void;
  upsertSpecificationAsync: (spec: any) => Promise<any>;
  deleteSpecificationAsync: (idOrCode: string) => Promise<boolean>;
  machines: MachineRecord[];
  isMachinesLoading: boolean;
  loadMachines: () => Promise<void>;
  upsertMachine: (machine: MachineRecord) => void;
  upsertMachineAsync: (machine: MachineRecord) => Promise<any>;
  deleteMachineAsync: (id: string) => Promise<boolean>;

  // ── Dies & Tooling (Shtamplar, Pichoqlar va Qoliplar) ──────────────────────
  diesTooling: DieToolingRecord[];
  isDiesToolingLoading: boolean;
  loadDiesToolingAsync: (companyCode?: string) => Promise<void>;
  upsertDieToolingAsync: (tool: Partial<DieToolingRecord>, companyCode?: string) => Promise<DieToolingRecord | null>;
  deleteDieToolingAsync: (id: string, companyCode?: string) => Promise<boolean>;

  // ── Enterprise Branches & Plants ──────────────────────────────────────────
  plants: PlantRecord[];
  isPlantsLoading: boolean;
  upsertPlant: (plant: PlantRecord) => void;
  savePlantToDb: (plant: PlantRecord) => Promise<boolean>;
  deletePlantFromDb: (id: string) => Promise<boolean>;
  fetchPlants: () => Promise<void>;
  openNewPlantTab: () => string;

  // ── Tariffs & Pricing Rules (Settings & Production) ───────────────────────
  tariffs: TariffRecord[];
  isTariffsLoading: boolean;
  fetchTariffs: (companyCode?: string) => Promise<void>;
  saveTariffToDb: (tariff: Partial<TariffRecord>, companyCode?: string) => Promise<TariffRecord | null>;
  deleteTariffFromDb: (id: string, companyCode?: string) => Promise<boolean>;
  upsertTariff: (tariff: TariffRecord) => void;
  openNewTariffTab: () => string;

  // ── Users & Roles (Settings Module) ────────────────────────────────────────
  users: SystemUserRecord[];
  isUsersLoading: boolean;
  upsertUser: (user: SystemUserRecord) => void;
  deleteUser: (id: string) => void;
  fetchUsers: () => Promise<void>;
  saveUserToDb: (user: SystemUserRecord) => Promise<boolean>;
  deleteUserFromDb: (id: string) => Promise<boolean>;
  resetUserPasswordInDb: (id: string, newPassword: string) => Promise<boolean>;
  checkAuthSession: () => Promise<boolean>;

  // ── HR, Staff, Attendance & Payroll ───────────────────────────────────────
  employees: EmployeeRecord[];
  attendance: AttendanceRecord[];
  piecework: PieceworkRecord[];
  payrolls: PayrollRecord[];
  departmentsList: DepartmentRecord[];
  positionsList: PositionRecord[];
  shiftsList: ShiftRecord[];
  biometricDevices: BiometricDeviceRecord[];
  setBiometricDevices: (devices: BiometricDeviceRecord[]) => void;
  upsertBiometricDevice: (device: BiometricDeviceRecord) => void;
  removeBiometricDevice: (id: string) => void;
  setDepartmentsList: (departmentsList: DepartmentRecord[]) => void;
  setPositionsList: (positionsList: PositionRecord[]) => void;
  setEmployees: (employees: EmployeeRecord[]) => void;
  upsertEmployee: (emp: EmployeeRecord) => void;
  upsertAttendance: (att: AttendanceRecord) => void;
  upsertPiecework: (pw: PieceworkRecord) => void;
  upsertPayroll: (pay: PayrollRecord) => void;
  upsertDepartment: (dept: DepartmentRecord) => void;
  upsertPosition: (pos: PositionRecord) => void;
  upsertShift: (shift: ShiftRecord) => void;

  // ── Trading & Accessories (Aksessuarlar Savdosi va Import) ────────────────
  tradingSales: TradingSaleRecord[];
  tradingOrders: TradingOrderRecord[];
  tradingYttEntities: YttTurnoverLimitRecord[];
  tradingImports: TradingImportBatchRecord[];
  tradingCatalog: TradingCatalogItemRecord[];
  tradingSettlements: TradingSettlementLedgerEntry[];
  isTradingLoading: boolean;
  loadTradingData: (type: "sales" | "orders" | "ytt-limits" | "settlements" | "imports" | "catalog", companyCode?: string) => Promise<void>;
  upsertTradingSaleAsync: (sale: Partial<TradingSaleRecord>, companyCode?: string) => Promise<TradingSaleRecord | null>;
  deleteTradingSaleAsync: (id: string, companyCode?: string) => Promise<boolean>;
  upsertTradingOrderAsync: (order: Partial<TradingOrderRecord>, companyCode?: string) => Promise<TradingOrderRecord | null>;
  deleteTradingOrderAsync: (id: string, companyCode?: string) => Promise<boolean>;
  convertTradingOrderToSaleAsync: (orderId: string, companyCode?: string) => Promise<{ saleId: string; docNo: string } | null>;
  upsertTradingImportAsync: (batch: Partial<TradingImportBatchRecord>, companyCode?: string) => Promise<TradingImportBatchRecord | null>;
  allocateTradingImportToStockAsync: (batchId: string, companyCode?: string) => Promise<boolean>;
  upsertTradingCatalogItemAsync: (item: Partial<TradingCatalogItemRecord>, companyCode?: string) => Promise<TradingCatalogItemRecord | null>;
  deleteTradingCatalogItemAsync: (id: string, companyCode?: string) => Promise<boolean>;
  upsertYttEntityAsync: (ytt: Partial<YttTurnoverLimitRecord>, companyCode?: string) => Promise<YttTurnoverLimitRecord | null>;
  recordTradingPaymentAsync: (payload: any, companyCode?: string) => Promise<boolean>;

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
  isProductionQueueLoading?: boolean;
  loadProductionQueue: (companyCode?: string) => Promise<void>;
  upsertWorkOrderAsync: (payload: any, companyCode?: string) => Promise<any>;
  upsertProductionQueueItem: (item: Partial<ProductionQueueItem> & { id: string }) => void;

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: AppNotification[];
  isNotifPanelOpen: boolean;
  isNotifLoading: boolean;
  notificationRules: {
    woDeadlineEnabled: boolean;
    woDeadlineDays: number;
    woStatusEnabled: boolean;
    stockLowEnabled: boolean;
    financeDocsEnabled: boolean;
    telegramMessagesEnabled: boolean;
  };
  setNotifPanelOpen: (open: boolean) => void;
  loadNotifications: (companyCode?: string) => Promise<void>;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markNotificationRead: (id: string, read?: boolean, companyCode?: string) => Promise<void>;
  toggleNotificationRead: (id: string, companyCode?: string) => Promise<void>;
  markAllRead: (companyCode?: string) => Promise<void>;
  dismissNotification: (id: string, companyCode?: string) => Promise<void>;
  clearAllNotifications: (companyCode?: string) => Promise<void>;
  updateNotificationRules: (rules: Partial<{
    woDeadlineEnabled: boolean;
    woDeadlineDays: number;
    woStatusEnabled: boolean;
    stockLowEnabled: boolean;
    financeDocsEnabled: boolean;
    telegramMessagesEnabled: boolean;
  }>, companyCode?: string) => Promise<void>;

  // ── Toast Sound Configuration ──────────────────────────────────────────────
  toastSoundConfig: ToastSoundConfig;
  setToastSoundConfig: (config: Partial<ToastSoundConfig>) => void;

  // ── Telegram Active Chat State ─────────────────────────────────────────────
  activeTelegramChatId: string | null;
  setActiveTelegramChatId: (id: string | null) => void;

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
  replaceTabId: (oldId: string, newId: string, title?: string, documentData?: Record<string, any>) => void;
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
const INITIAL_DELIVERY_ACTS: DeliveryActRecord[] = [];

const INITIAL_WAREHOUSE_SHIPMENTS: WarehouseShipmentRecord[] = [];

export const INITIAL_FINISHED_GOODS: FinishedGoodStockRecord[] = [];

const INITIAL_CLIENT_SETTLEMENTS: ClientSettlementRecord[] = [];

export const INITIAL_CRM_CUSTOMERS: CrmCustomerRecord[] = [];

export const INITIAL_CUSTOMER_TOOLING: CustomerToolingItem[] = [];

const RAW_INITIAL_WAREHOUSE_STOCK: WarehouseStockRecord[] = [];

export const INITIAL_WAREHOUSE_STOCK: WarehouseStockRecord[] = [];

export const INITIAL_WAREHOUSE_MOVEMENTS: WarehouseMovementRecord[] = [];

export const INITIAL_PRODUCTION_QUEUE: ProductionQueueItem[] = [];

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [
    {
      id: "registry-work-orders",
      title: "Work Orders (Registry)",
      type: "registry",
      module: "production",
      isUnsaved: false,
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
  isCrmCustomersLoading: false,
  suppliers: [],
  isSuppliersLoading: false,
  isFinanceLoading: false,

  loadFinanceData: async (companyCode = "PRINTGOO") => {
    try {
      set({ isFinanceLoading: true });
      const [actsRes, stlRes] = await Promise.all([
        fetch("/api/v1/finance/delivery-acts?company=" + encodeURIComponent(companyCode)),
        fetch("/api/v1/finance/settlements?company=" + encodeURIComponent(companyCode)),
      ]);
      if (actsRes.ok) {
        const actsJson = await actsRes.json();
        if (actsJson.success && Array.isArray(actsJson.data)) {
          set({ deliveryActs: actsJson.data });
        }
      }
      if (stlRes.ok) {
        const stlJson = await stlRes.json();
        if (stlJson.success && Array.isArray(stlJson.data)) {
          set({ clientSettlements: stlJson.data });
        }
      }
    } catch (e) {
      console.error("Failed to load Finance data from server:", e);
    } finally {
      set({ isFinanceLoading: false });
    }
  },

  recordPaymentAsync: async (payload, companyCode = "PRINTGOO") => {
    try {
      get().recordClientPayment(payload.customer, payload.amount, payload.docNo, payload.note);
      const res = await fetch("/api/v1/finance/payments?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Balansni qayta yuklash
        await get().loadFinanceData(companyCode);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to record payment on server:", e);
      return false;
    }
  },

  saveDeliveryActAsync: async (act: DeliveryActRecord, companyCode = "PRINTGOO") => {
    try {
      get().upsertDeliveryAct(act);
      const res = await fetch("/api/v1/finance/delivery-acts?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(act),
      });
      if (res.ok) {
        await get().loadFinanceData(companyCode);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to persist delivery act to DB:", e);
      return false;
    }
  },

  loadCrmCustomers: async (companyCode = "PRINTGOO") => {
    try {
      set({ isCrmCustomersLoading: true });
      const res = await fetch("/api/v1/crm/clients?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ crmCustomers: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load CRM clients from server:", e);
    } finally {
      set({ isCrmCustomersLoading: false });
    }
  },

  upsertCustomerAsync: async (customer: CrmCustomerRecord, companyCode = "PRINTGOO") => {
    get().upsertCustomer(customer);
    try {
      const res = await fetch("/api/v1/crm/clients?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.client) {
          get().upsertCustomer(json.client);
          return json.client;
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to persist customer to database:", e);
      return null;
    }
  },

  loadSuppliers: async (companyCode = "PRINTGOO") => {
    try {
      set({ isSuppliersLoading: true });
      const res = await fetch("/api/v1/crm/suppliers?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ suppliers: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load suppliers from server:", e);
    } finally {
      set({ isSuppliersLoading: false });
    }
  },

  upsertSupplierAsync: async (supplier: Partial<SupplierRecord>, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/crm/suppliers?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplier),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          await get().loadSuppliers(companyCode);
          return json.supplier;
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to persist supplier to database:", e);
      return null;
    }
  },

  deleteSupplierAsync: async (id: string, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/crm/suppliers/${encodeURIComponent(id)}?company=` + encodeURIComponent(companyCode), {
        method: "DELETE",
      });
      if (res.ok) {
        await get().loadSuppliers(companyCode);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to delete supplier:", e);
      return false;
    }
  },
  warehouseStock: INITIAL_WAREHOUSE_STOCK,
  isWarehouseStockLoading: false,

  loadWarehouseStock: async (companyCode = "PRINTGOO") => {
    try {
      set({ isWarehouseStockLoading: true });
      const res = await fetch("/api/v1/warehouse/stock?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ warehouseStock: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load warehouse stock from DB:", e);
    } finally {
      set({ isWarehouseStockLoading: false });
    }
  },

  upsertWarehouseStockAsync: async (stock: any, companyCode = "PRINTGOO") => {
    get().upsertWarehouseStock(stock);
    try {
      const res = await fetch("/api/v1/warehouse/stock?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stock),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadWarehouseStock(companyCode);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to save warehouse stock:", e);
      return false;
    }
  },

  warehouseMovements: INITIAL_WAREHOUSE_MOVEMENTS,
  isWarehouseMovementsLoading: false,

  loadWarehouseMovements: async (companyCode = "PRINTGOO") => {
    try {
      set({ isWarehouseMovementsLoading: true });
      const res = await fetch("/api/v1/warehouse/movements?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ warehouseMovements: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load warehouse movements from DB:", e);
    } finally {
      set({ isWarehouseMovementsLoading: false });
    }
  },

  upsertWarehouseMovementAsync: async (mov: any, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/warehouse/movements?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mov),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadWarehouseMovements(companyCode);
          get().loadWarehouseStock(companyCode);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to save warehouse movement:", e);
      return false;
    }
  },

  warehouseReceipts: [],
  isWarehouseReceiptsLoading: false,

  loadWarehouseReceipts: async (companyCode = "PRINTGOO") => {
    try {
      set({ isWarehouseReceiptsLoading: true });
      const res = await fetch("/api/v1/warehouse/receipts?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ warehouseReceipts: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load warehouse receipts:", e);
    } finally {
      set({ isWarehouseReceiptsLoading: false });
    }
  },

  upsertWarehouseReceiptAsync: async (receipt: any, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/warehouse/receipts?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receipt),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadWarehouseReceipts(companyCode);
          get().loadWarehouseStock(companyCode);
          return {
            success: true,
            receipt: json.receipt,
            receiptNumber: json.receiptNumber || json.receipt?.receiptNumber,
          };
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to save warehouse receipt:", e);
      return null;
    }
  },

  isWarehouseShipmentsLoading: false,

  loadWarehouseShipments: async (companyCode = "PRINTGOO") => {
    try {
      set({ isWarehouseShipmentsLoading: true });
      const res = await fetch("/api/v1/warehouse/shipments?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ warehouseShipments: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load warehouse shipments:", e);
    } finally {
      set({ isWarehouseShipmentsLoading: false });
    }
  },

  upsertWarehouseShipmentAsync: async (shipment: any, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/warehouse/shipments?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipment),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadWarehouseShipments(companyCode);
          get().loadWarehouseStock(companyCode);
          return {
            success: true,
            shipment: json.shipment,
            shipmentNumber: json.shipmentNumber || json.shipment?.shipmentNumber,
          };
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to save warehouse shipment:", e);
      return null;
    }
  },

  warehousesList: [],
  isWarehousesLoading: false,

  loadWarehouses: async (companyCode = "PRINTGOO") => {
    try {
      set({ isWarehousesLoading: true });
      const res = await fetch("/api/v1/warehouse/locations?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ warehousesList: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load warehouses list:", e);
    } finally {
      set({ isWarehousesLoading: false });
    }
  },

  upsertWarehouseAsync: async (wh: any, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/warehouse/locations?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wh),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadWarehouses(companyCode);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to save warehouse:", e);
      return false;
    }
  },

  deleteWarehouseAsync: async (id: string, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/warehouse/locations?id=${encodeURIComponent(id)}&company=${encodeURIComponent(companyCode)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadWarehouses(companyCode);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to delete warehouse:", e);
      return false;
    }
  },

  isFinishedGoodsLoading: false,

  loadFinishedGoods: async (companyCode = "PRINTGOO") => {
    try {
      set({ isFinishedGoodsLoading: true });
      const res = await fetch("/api/v1/warehouse/finished-goods?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ finishedGoods: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load finished goods:", e);
    } finally {
      set({ isFinishedGoodsLoading: false });
    }
  },

  upsertFinishedGoodAsync: async (item: any, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/warehouse/finished-goods?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadFinishedGoods(companyCode);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to save finished good:", e);
      return false;
    }
  },

  inventoryCounts: [],
  isInventoryCountsLoading: false,

  loadInventoryCounts: async (companyCode = "PRINTGOO") => {
    try {
      set({ isInventoryCountsLoading: true });
      const res = await fetch("/api/v1/warehouse/inventory?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ inventoryCounts: json.data });
        }
      }
    } catch (e) {
      console.error("Failed to load inventory counts:", e);
    } finally {
      set({ isInventoryCountsLoading: false });
    }
  },

  upsertInventoryCountAsync: async (count: any, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch("/api/v1/warehouse/inventory?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(count),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadInventoryCounts(companyCode);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to save inventory count:", e);
      return false;
    }
  },
  productionQueue: INITIAL_PRODUCTION_QUEUE,
  isProductionQueueLoading: false,

  loadProductionQueue: async (companyCode = "PRINTGOO") => {
    try {
      set({ isProductionQueueLoading: true });
      const res = await fetch("/api/v1/production/work-orders?company=" + encodeURIComponent(companyCode));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({
            productionQueue: json.data.filter(
              (item: any) => !item.id?.startsWith("draft-") && !item.id?.startsWith("temp-")
            ),
          });
        }
      }
    } catch (e) {
      console.error("Failed to load production queue from DB:", e);
    } finally {
      set({ isProductionQueueLoading: false });
    }
  },

  upsertWorkOrderAsync: async (payload: any, companyCode = "PRINTGOO") => {
    try {
      const cu = get().currentUser;
      const bodyPayload = {
        ...payload,
        author: payload.author || (cu ? { id: cu.id, name: cu.name, role: cu.role } : undefined),
      };
      const res = await fetch("/api/v1/production/work-orders?company=" + encodeURIComponent(companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          get().loadProductionQueue(companyCode);
          return json.workOrder || true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to persist work order to DB:", e);
      return false;
    }
  },
  machines: [],
  isMachinesLoading: false,
  loadMachines: async () => {
    set({ isMachinesLoading: true });
    try {
      const res = await fetch("/api/v1/production/machines");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        set({ machines: json.data, isMachinesLoading: false });
      } else {
        set({ isMachinesLoading: false });
      }
    } catch (err) {
      console.error("loadMachines error:", err);
      set({ isMachinesLoading: false });
    }
  },
  upsertMachineAsync: async (machine: MachineRecord) => {
    try {
      const isExisting = Boolean(machine.id && !machine.id.startsWith("new-") && !machine.id.startsWith("MAC-NEW-"));
      const method = isExisting ? "PUT" : "POST";
      const url = isExisting
        ? `/api/v1/production/machines/${machine.id}`
        : `/api/v1/production/machines`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(machine),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const savedMachine = json.data;
        set((state) => {
          const exists = state.machines.some((m) => m.id === savedMachine.id || (machine.id && m.id === machine.id));
          return {
            machines: exists
              ? state.machines.map((m) => (m.id === savedMachine.id || m.id === machine.id ? savedMachine : m))
              : [savedMachine, ...state.machines],
          };
        });
        return savedMachine;
      }
    } catch (err) {
      console.error("upsertMachineAsync error:", err);
    }
    return null;
  },
  deleteMachineAsync: async (id: string) => {
    try {
      const res = await fetch(`/api/v1/production/machines/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        set((state) => ({
          machines: state.machines.filter((m) => m.id !== id),
        }));
        return true;
      }
    } catch (err) {
      console.error("deleteMachineAsync error:", err);
    }
    return false;
  },
  diesTooling: [],
  isDiesToolingLoading: false,
  loadDiesToolingAsync: async (companyCode = "PRINTGOO") => {
    set({ isDiesToolingLoading: true });
    try {
      const res = await fetch(`/api/v1/master/printing/dies?company=${companyCode}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        set({ diesTooling: json.data, isDiesToolingLoading: false });
      } else {
        set({ isDiesToolingLoading: false });
      }
    } catch (err) {
      console.error("loadDiesToolingAsync error:", err);
      set({ isDiesToolingLoading: false });
    }
  },
  upsertDieToolingAsync: async (tool: Partial<DieToolingRecord>, companyCode = "PRINTGOO") => {
    try {
      const isExisting = Boolean(tool.id && !tool.id.startsWith("new-") && !tool.id.startsWith("DIE-NEW-"));
      const method = isExisting ? "PUT" : "POST";
      const url = `/api/v1/master/printing/dies`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tool, companyCode }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const savedTool = json.data;
        set((state) => {
          const exists = state.diesTooling.some(
            (t) => t.id === savedTool.id || (tool.id && t.id === tool.id)
          );
          return {
            diesTooling: exists
              ? state.diesTooling.map((t) => (t.id === savedTool.id || t.id === tool.id ? savedTool : t))
              : [savedTool, ...state.diesTooling],
          };
        });
        return savedTool;
      }
    } catch (err) {
      console.error("upsertDieToolingAsync error:", err);
    }
    return null;
  },
  deleteDieToolingAsync: async (id: string, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/master/printing/dies?id=${id}&company=${companyCode}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        set((state) => ({
          diesTooling: state.diesTooling.filter((t) => t.id !== id && t.code !== id),
        }));
        return true;
      }
    } catch (err) {
      console.error("deleteDieToolingAsync error:", err);
    }
    return false;
  },
  plants: [],
  isPlantsLoading: false,
  tariffs: [],
  isTariffsLoading: false,
  users: INITIAL_SYSTEM_USERS,
  isUsersLoading: false,
  employees: [],
  attendance: [],
  piecework: [],
  payrolls: [],
  departmentsList: [],
  positionsList: [],
  shiftsList: [],
  biometricDevices: [],
  customerTooling: INITIAL_CUSTOMER_TOOLING,
  finishedGoods: INITIAL_FINISHED_GOODS,

  // ── Trading & Accessories State & Methods ─────────────────────────────────
  tradingSales: INITIAL_TRADING_SALES,
  tradingOrders: [],
  tradingYttEntities: INITIAL_YTT_ENTITIES,
  tradingImports: INITIAL_IMPORT_BATCHES,
  tradingCatalog: INITIAL_TRADING_CATALOG,
  tradingSettlements: INITIAL_SETTLEMENT_LEDGERS,
  isTradingLoading: false,

  loadTradingData: async (type, companyCode = "PRINTGOO") => {
    set({ isTradingLoading: true });
    try {
      if (type === "sales") {
        const res = await fetch(`/api/v1/trading/sales?company=${encodeURIComponent(companyCode)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) set({ tradingSales: json.data });
      } else if (type === "orders") {
        const res = await fetch(`/api/v1/trading/orders?company=${encodeURIComponent(companyCode)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) set({ tradingOrders: json.data });
      } else if (type === "ytt-limits") {
        const res = await fetch(`/api/v1/trading/ytt-limits?company=${encodeURIComponent(companyCode)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) set({ tradingYttEntities: json.data });
      } else if (type === "imports") {
        const res = await fetch(`/api/v1/trading/imports?company=${encodeURIComponent(companyCode)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) set({ tradingImports: json.data });
      } else if (type === "catalog") {
        const res = await fetch(`/api/v1/trading/catalog?company=${encodeURIComponent(companyCode)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) set({ tradingCatalog: json.data });
      } else if (type === "settlements") {
        const res = await fetch(`/api/v1/trading/settlements?company=${encodeURIComponent(companyCode)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) set({ tradingSettlements: json.data });
      }
    } catch (err) {
      console.error(`loadTradingData (${type}) error:`, err);
    } finally {
      set({ isTradingLoading: false });
    }
  },

  upsertTradingSaleAsync: async (sale, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/sales?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sale),
      });
      const json = await res.json();
      if (json.success && json.data) {
        get().loadTradingData("sales", companyCode);
        get().loadTradingData("ytt-limits", companyCode);
        get().loadTradingData("catalog", companyCode);
        get().loadTradingData("settlements", companyCode);
        return json.data;
      }
    } catch (err) {
      console.error("upsertTradingSaleAsync error:", err);
    }
    return null;
  },

  deleteTradingSaleAsync: async (id, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/sales?id=${id}&company=${encodeURIComponent(companyCode)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        set((state) => ({
          tradingSales: state.tradingSales.filter((s) => s.id !== id),
        }));
        return true;
      }
    } catch (err) {
      console.error("deleteTradingSaleAsync error:", err);
    }
    return false;
  },

  upsertTradingOrderAsync: async (order, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/orders?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      const json = await res.json();
      if (json.success && json.data) {
        get().loadTradingData("orders", companyCode);
        return json.data;
      }
    } catch (err) {
      console.error("upsertTradingOrderAsync error:", err);
    }
    return null;
  },

  deleteTradingOrderAsync: async (id, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/orders?id=${id}&company=${encodeURIComponent(companyCode)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        set((state) => ({
          tradingOrders: state.tradingOrders.filter((o) => o.id !== id),
        }));
        return true;
      }
    } catch (err) {
      console.error("deleteTradingOrderAsync error:", err);
    }
    return false;
  },

  convertTradingOrderToSaleAsync: async (orderId, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/orders/${orderId}/convert?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        get().loadTradingData("orders", companyCode);
        get().loadTradingData("sales", companyCode);
        return { saleId: json.saleId, docNo: json.docNo };
      }
    } catch (err) {
      console.error("convertTradingOrderToSaleAsync error:", err);
    }
    return null;
  },

  upsertTradingImportAsync: async (batch, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/imports?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      const json = await res.json();
      if (json.success && json.data) {
        get().loadTradingData("imports", companyCode);
        get().loadTradingData("catalog", companyCode);
        return json.data;
      }
    } catch (err) {
      console.error("upsertTradingImportAsync error:", err);
    }
    return null;
  },

  allocateTradingImportToStockAsync: async (batchId, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/imports/${batchId}/allocate?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        get().loadTradingData("imports", companyCode);
        get().loadTradingData("catalog", companyCode);
        return true;
      }
    } catch (err) {
      console.error("allocateTradingImportToStockAsync error:", err);
    }
    return false;
  },

  upsertTradingCatalogItemAsync: async (item, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/catalog?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const json = await res.json();
      if (json.success && json.data) {
        get().loadTradingData("catalog", companyCode);
        return json.data;
      }
    } catch (err) {
      console.error("upsertTradingCatalogItemAsync error:", err);
    }
    return null;
  },

  deleteTradingCatalogItemAsync: async (id, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/catalog?id=${id}&company=${encodeURIComponent(companyCode)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        set((state) => ({
          tradingCatalog: state.tradingCatalog.filter((c) => c.id !== id),
        }));
        return true;
      }
    } catch (err) {
      console.error("deleteTradingCatalogItemAsync error:", err);
    }
    return false;
  },

  upsertYttEntityAsync: async (ytt, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/ytt-limits?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ytt),
      });
      const json = await res.json();
      if (json.success && json.data) {
        get().loadTradingData("ytt-limits", companyCode);
        return json.data;
      }
    } catch (err) {
      console.error("upsertYttEntityAsync error:", err);
    }
    return null;
  },

  recordTradingPaymentAsync: async (payload, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/trading/settlements?company=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        get().loadTradingData("settlements", companyCode);
        return true;
      }
    } catch (err) {
      console.error("recordTradingPaymentAsync error:", err);
    }
    return false;
  },
  masterSpecifications: [],
  isSpecificationsLoading: false,

  loadSpecificationsAsync: async () => {
    set({ isSpecificationsLoading: true });
    try {
      const res = await fetch("/api/v1/production/specifications");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        set({ masterSpecifications: json.data, isSpecificationsLoading: false });
      } else {
        set({ isSpecificationsLoading: false });
      }
    } catch (err) {
      console.error("loadSpecificationsAsync error:", err);
      set({ isSpecificationsLoading: false });
    }
  },

  upsertMasterSpecification: (spec) =>
    set((state) => {
      const exists = state.masterSpecifications.some((s) => s.code === spec.code || s.id === spec.id);
      return {
        masterSpecifications: exists
          ? state.masterSpecifications.map((s) => (s.code === spec.code || s.id === spec.id ? { ...s, ...spec } : s))
          : [spec, ...state.masterSpecifications],
      };
    }),

  upsertSpecificationAsync: async (spec: any) => {
    try {
      const isExisting = Boolean(
        spec.id &&
        !String(spec.id).startsWith("new-") &&
        !String(spec.id).startsWith("SPEC-NEW-") &&
        !String(spec.id).startsWith("SPEC-00") &&
        String(spec.id).length > 20
      );

      const targetId = spec.id;
      const res = await fetch(`/api/v1/production/specifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spec),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const savedSpec = json.data;
        set((state) => {
          const exists = state.masterSpecifications.some(
            (s) => s.id === savedSpec.id || s.code === savedSpec.code || (targetId && s.id === targetId)
          );
          return {
            masterSpecifications: exists
              ? state.masterSpecifications.map((s) =>
                  s.id === savedSpec.id || s.code === savedSpec.code || (targetId && s.id === targetId) ? savedSpec : s
                )
              : [savedSpec, ...state.masterSpecifications],
          };
        });
        return savedSpec;
      }
    } catch (err) {
      console.error("upsertSpecificationAsync error:", err);
    }
    return null;
  },

  deleteSpecificationAsync: async (idOrCode: string) => {
    try {
      const res = await fetch(`/api/v1/production/specifications/${encodeURIComponent(idOrCode)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        set((state) => ({
          masterSpecifications: state.masterSpecifications.filter(
            (s) => s.id !== idOrCode && s.code !== idOrCode
          ),
        }));
        return true;
      }
    } catch (err) {
      console.error("deleteSpecificationAsync error:", err);
    }
    return false;
  },

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

  openNewPlantTab: () => {
    const plantsList = get().plants || [];
    const nextNum = plantsList.length + 1;
    const newId = `PLT-${String(nextNum).padStart(3, "0")}`;
    const newCode = `BRN-${String(nextNum).padStart(2, "0")}`;
    const newPlant: PlantRecord = createEmptyPlant(newId, newCode);

    // NOTE: We do not call upsertPlant here so unsaved drafts never appear as ghost rows in the grid.
    const tabId = `plant-${newPlant.id}`;
    get().openTab({
      id: tabId,
      title: "Yangi korxona / tashkilot *",
      type: "plant-detail",
      module: "settings",
      documentData: newPlant,
      isUnsaved: false,
    });
    return tabId;
  },

  fetchPlants: async () => {
    set({ isPlantsLoading: true });
    try {
      const res = await fetch("/api/v1/production/sites?companyCode=PRINTGOO");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const dbPlants = json.data.map(branchToPlantRecord);
        set({ plants: dbPlants, isPlantsLoading: false });
      } else {
        set({ isPlantsLoading: false });
      }
    } catch (e) {
      console.error("fetchPlants error:", e);
      set({ isPlantsLoading: false });
    }
  },

  savePlantToDb: async (plant) => {
    try {
      const isNewDraft = plant.id.startsWith("PLT-") && plant.id.length < 15;
      const res = await fetch("/api/v1/production/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyCode: "PRINTGOO",
          id: isNewDraft ? undefined : plant.id,
          name: plant.name.trim(),
          code: plant.code?.trim() || `BR-${Math.floor(1000 + Math.random() * 9000)}`,
          shortName: plant.shortName?.trim() || null,
          legalEntityName: plant.legalEntityName?.trim() || null,
          branchType: plant.branchType?.trim() || null,
          tin: plant.tin?.trim() || null,
          vatNumber: plant.vatNumber?.trim() || null,
          oked: plant.oked?.trim() || null,
          address: plant.address?.trim() || null,
          legalAddress: plant.legalAddress?.trim() || null,
          landmark: plant.landmark?.trim() || null,
          phone: plant.phone?.trim() || null,
          email: plant.email?.trim() || null,
          director: plant.director?.trim() || null,
          directorPhone: plant.directorPhone?.trim() || null,
          chiefAccountant: plant.chiefAccountant?.trim() || null,
          chiefAccountantPhone: plant.chiefAccountantPhone?.trim() || null,
          productionHead: plant.productionHead?.trim() || null,
          productionHeadPhone: plant.productionHeadPhone?.trim() || null,
          shiftRegime: plant.shiftRegime?.trim() || null,
          workingHours: plant.workingHours?.trim() || null,
          daysOfWeek: plant.daysOfWeek?.trim() || null,
          totalFloorAreaM2: Number(plant.totalFloorAreaM2) || 0,
          machinesCount: Number(plant.machinesCount) || 0,
          status: plant.status || "Active",
          isMain: !!plant.isMain,
          isActive: plant.status !== "Inactive",
          departments: Array.isArray(plant.departments) ? plant.departments : [],
          warehouses: Array.isArray(plant.warehouses) ? plant.warehouses : [],
          bankAccounts: Array.isArray(plant.bankAccounts) ? plant.bankAccounts : [],
          integration: plant.integration || {},
          notes: plant.notes?.trim() || null,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const savedBranch = json.data;
          const fullPlant: PlantRecord = branchToPlantRecord(savedBranch);

          // 1. Replace tab ID if open from draft to real DB ID
          if (plant.id !== savedBranch.id) {
            get().replaceTabId(`plant-${plant.id}`, `plant-${savedBranch.id}`, savedBranch.name, fullPlant);
          } else {
            get().updateTabData(`plant-${savedBranch.id}`, fullPlant, savedBranch.name);
          }

          // 2. Remove draft and clean in-memory plants list
          set((state) => ({
            plants: state.plants
              .filter((p) => p.id !== plant.id && p.id !== savedBranch.id)
              .concat(fullPlant),
          }));

          // 3. Sync lookup store (used in work order combobox)
          useLookupStore.getState().syncWithServer();

          // 4. Refresh full list from DB so no ghosts or duplicates exist
          await get().fetchPlants();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("savePlantToDb error:", err);
      return false;
    }
  },

  deletePlantFromDb: async (id) => {
    try {
      const res = await fetch(`/api/v1/production/sites?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          set((state) => ({
            plants: state.plants.filter((p) => p.id !== id),
          }));
          useLookupStore.getState().syncWithServer();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("deletePlantFromDb error:", err);
      return false;
    }
  },

  // ── Tariffs & Pricing Rules (Settings & Production) ───────────────────────
  fetchTariffs: async (companyCode = "PRINTGOO") => {
    set({ isTariffsLoading: true });
    try {
      const res = await fetch(`/api/v1/settings/tariffs?companyCode=${encodeURIComponent(companyCode)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        set({ tariffs: json.data, isTariffsLoading: false });
      } else {
        set({ isTariffsLoading: false });
      }
    } catch (e) {
      console.error("fetchTariffs error:", e);
      set({ isTariffsLoading: false });
    }
  },

  saveTariffToDb: async (tariff, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/settings/tariffs?companyCode=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tariff),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.tariff) {
          get().upsertTariff(json.tariff);
          await get().fetchTariffs(companyCode);
          return json.tariff;
        }
      }
      return null;
    } catch (err) {
      console.error("saveTariffToDb error:", err);
      return null;
    }
  },

  deleteTariffFromDb: async (id, companyCode = "PRINTGOO") => {
    try {
      const res = await fetch(`/api/v1/settings/tariffs?id=${encodeURIComponent(id)}&companyCode=${encodeURIComponent(companyCode)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          set((state) => ({
            tariffs: state.tariffs.filter((t) => t.id !== id && t.code !== id),
          }));
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("deleteTariffFromDb error:", err);
      return false;
    }
  },

  upsertTariff: (tariff) =>
    set((state) => {
      const exists = state.tariffs.some((t) => t.id === tariff.id || t.code === tariff.code);
      return {
        tariffs: exists
          ? state.tariffs.map((t) => (t.id === tariff.id || t.code === tariff.code ? tariff : t))
          : [tariff, ...state.tariffs],
      };
    }),

  openNewTariffTab: () => {
    const list = get().tariffs || [];
    const maxNum = list.reduce((max, t) => {
      const match = t.code.match(/TRF-(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    const newCode = `TRF-${String(maxNum + 1).padStart(3, "0")}`;
    const newTariff = createEmptyTariff(`tariff-${Date.now()}`, newCode);

    const tabId = `tariff-${newTariff.id}`;
    get().openTab({
      id: tabId,
      title: `${newTariff.code}: Yangi me'yoriy tarif *`,
      type: "tariff-detail",
      module: "settings",
      documentData: newTariff,
      isUnsaved: false,
    });
    return tabId;
  },

  upsertUser: (user) =>
    set((state) => {
      const exists = state.users.some((u) => u.id === user.id);
      const newUsers = exists
        ? state.users.map((u) => (u.id === user.id ? user : u))
        : [user, ...state.users];

      let updatedCurrentUser = state.currentUser;
      const isCurrent =
        state.currentUser &&
        (state.currentUser.id === user.id ||
          state.currentUser.id === user.code ||
          state.currentUser.username === user.username ||
          state.currentUser.email === user.email);

      if (isCurrent) {
        updatedCurrentUser = {
          ...state.currentUser,
          name: user.fullName || user.username || state.currentUser.name,
          fullName: user.fullName || state.currentUser.fullName,
          avatar: user.avatar,
          initials: getUserInitials(user.fullName || user.username || state.currentUser.name, "AD"),
          role: user.role || state.currentUser.role,
          department: user.department || state.currentUser.department,
          plant: user.plant || state.currentUser.plant,
        };
        try {
          localStorage.setItem("printgoo_user", JSON.stringify(updatedCurrentUser));
        } catch {}
      }

      return {
        users: newUsers,
        currentUser: updatedCurrentUser,
      };
    }),

  deleteUser: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id),
    })),

  fetchUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await fetch("/api/v1/settings/users");
      const json = await res.json();
      if (json.success && Array.isArray(json.users)) {
        set({ users: json.users, isUsersLoading: false });
      } else {
        set({ isUsersLoading: false });
      }
    } catch {
      set({ isUsersLoading: false });
    }
  },

  saveUserToDb: async (user) => {
    try {
      const isExisting = Boolean(user.id && !user.id.startsWith("user-new-"));
      const url = isExisting
        ? `/api/v1/settings/users/${encodeURIComponent(user.id)}`
        : "/api/v1/settings/users";
      const method = isExisting ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      const json = await res.json();
      if (json.success && json.user) {
        get().upsertUser(json.user);
        return true;
      }
      return false;
    } catch (e) {
      console.error("[saveUserToDb error]:", e);
      return false;
    }
  },

  deleteUserFromDb: async (id) => {
    try {
      const res = await fetch(`/api/v1/settings/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        get().deleteUser(id);
        return true;
      }
      return false;
    } catch (e) {
      console.error("[deleteUserFromDb error]:", e);
      return false;
    }
  },

  resetUserPasswordInDb: async (id, newPassword) => {
    try {
      const res = await fetch(`/api/v1/settings/users/${encodeURIComponent(id)}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      return Boolean(json.success);
    } catch (e) {
      console.error("[resetUserPasswordInDb error]:", e);
      return false;
    }
  },

  checkAuthSession: async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          const u = json.user;
          const userProfile: UserProfile = {
            id: u.id,
            code: u.code,
            username: u.username,
            name: u.fullName,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            role: u.role,
            department: u.department,
            plant: u.plant,
            initials: getUserInitials(u.fullName || u.username, "AD"),
            defaultModule: u.defaultModule,
            avatar: u.avatar,
            permissions: u.permissions,
            scope: u.scope,
            security: u.security,
          };
          get().login(userProfile);
          return true;
        }
      }
    } catch {}
    return false;
  },

  setEmployees: (employees) => set({ employees }),

  setBiometricDevices: (biometricDevices) => set({ biometricDevices }),

  upsertBiometricDevice: (device) =>
    set((state) => {
      const exists = state.biometricDevices.some((d) => d.id === device.id);
      return {
        biometricDevices: exists
          ? state.biometricDevices.map((d) => (d.id === device.id ? device : d))
          : [device, ...state.biometricDevices],
      };
    }),

  removeBiometricDevice: (id) =>
    set((state) => ({
      biometricDevices: state.biometricDevices.filter((d) => d.id !== id),
    })),

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

  setDepartmentsList: (departmentsList) => set({ departmentsList }),
  setPositionsList: (positionsList) => set({ positionsList }),

  upsertDepartment: (dept) =>
    set((state) => {
      const exists = state.departmentsList.some((d) => d.id === dept.id);
      return {
        departmentsList: exists
          ? state.departmentsList.map((d) => (d.id === dept.id ? dept : d))
          : [dept, ...state.departmentsList],
      };
    }),

  upsertPosition: (pos) =>
    set((state) => {
      const exists = state.positionsList.some((p) => p.id === pos.id);
      return {
        positionsList: exists
          ? state.positionsList.map((p) => (p.id === pos.id ? pos : p))
          : [pos, ...state.positionsList],
      };
    }),

  upsertShift: (shift) =>
    set((state) => {
      const exists = state.shiftsList.some((s) => s.id === shift.id);
      return {
        shiftsList: exists
          ? state.shiftsList.map((s) => (s.id === shift.id ? shift : s))
          : [shift, ...state.shiftsList],
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
    const newId = payload.id || `draft-sf-${Date.now()}`;
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
      workOrderId: payload.workOrderId || "WOOF-26-0351",
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

    const yearSuffix = new Date().getFullYear().toString().slice(-2);

    // If target has a draft ID, assign formal sequential SF-26-XXXX
    let finalActId = target.id;
    if (target.id.startsWith("draft-") || target.id.startsWith("new-") || target.id === "NEW") {
      let maxSf = 0;
      for (const a of state.deliveryActs) {
        const m = a.id?.match(new RegExp(`^SF-${yearSuffix}-(\\d+)$`, "i"));
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxSf) maxSf = n;
        }
      }
      finalActId = `SF-${yearSuffix}-${String(maxSf + 1).padStart(4, "0")}`;
    }

    let shipmentId = target.linkedShipmentId;
    if (!shipmentId) {
      let maxShp = 0;
      for (const s of state.warehouseShipments) {
        const m = s.id?.match(new RegExp(`^SHP-${yearSuffix}-(\\d+)$`, "i"));
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxShp) maxShp = n;
        }
      }
      shipmentId = `SHP-${yearSuffix}-${String(maxShp + 1).padStart(4, "0")}`;
    }

    const today = target.date || new Date().toISOString().split("T")[0];

    const newShipment: WarehouseShipmentRecord = {
      id: shipmentId,
      date: today,
      customer: target.customer,
      deliveryActId: finalActId,
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
      id: finalActId,
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

      const alreadyInLedger = c.ledger.some((l) => l.docNo === finalActId);
      if (alreadyInLedger) return c;

      const newDebit = Number((c.totalDebit + target.totalAmount).toFixed(2));
      const newClosing = Number((c.openingBalance + newDebit - c.totalCredit).toFixed(2));
      const newEntry: SettlementLedgerEntry = {
        id: `led-${Date.now()}`,
        date: today,
        docNo: finalActId,
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
            docNo: finalActId,
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
        t.id === actId
          ? {
              ...t,
              id: finalActId,
              title: `${finalActId}: ${postedAct.customer}`,
              documentData: postedAct,
              isUnsaved: false,
            }
          : t
      ),
      activeTabId: s.activeTabId === actId ? finalActId : s.activeTabId,
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
      // Disallow draft- or temp- placeholder IDs from entering productionQueue
      if (!item.id || item.id.startsWith("draft-") || item.id.startsWith("temp-")) {
        return state;
      }
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
  isNotifLoading: false,
  notificationRules: {
    woDeadlineEnabled: true,
    woDeadlineDays: 7,
    woStatusEnabled: true,
    stockLowEnabled: true,
    financeDocsEnabled: true,
    telegramMessagesEnabled: true,
  },
  notifications: [
    {
      id: "notif-1",
      entityCode: "WOOF-26-0351",
      category: "production",
      eventType: "wo_deadline",
      title: "WOOF-26-0351 dedlayn yaqinlashmoqda",
      description: "Hardcover Catalog buyurtmasi uchun 6 kun qoldi. Prepress: Tasdiqlangan.",
      severity: "warning",
      timestamp: Date.now() - 1000 * 60 * 8,
      read: false,
      link: { module: "production", subModule: "work-orders" },
      targetTab: {
        id: "wo-WOOF-26-0351",
        title: "WOOF-26-0351 (Buyurtma)",
        type: "work-order",
        module: "production",
      },
    },
    {
      id: "notif-2",
      entityCode: "PAP-GAS-150",
      category: "warehouse",
      eventType: "stock_low",
      title: "Ombor ogohlantirishi: Galerie Art Silk 150g",
      description: "Ombor qoldig'i reorder darajasidan past (42 varaq qoldi).",
      severity: "error",
      timestamp: Date.now() - 1000 * 60 * 35,
      read: false,
      link: { module: "warehouse", subModule: "stock-balance" },
      targetTab: {
        id: "stock-PAP-GAS-150",
        title: "PAP-GAS-150 (Qoldiq)",
        type: "warehouse-stock",
        module: "warehouse",
      },
    },
    {
      id: "notif-3",
      entityCode: "SF-8001",
      category: "finance",
      eventType: "invoice_posted",
      title: "Schet-faktura SF-8001 rasmiylashtirildi",
      description: "Alpha Media Group LLC — $14,850.00 (Ombor yuk xati: SHP-6000).",
      severity: "success",
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      read: false,
      link: { module: "finance", subModule: "delivery-acts" },
      targetTab: {
        id: "doc-delivery-act-SF-8001",
        title: "SF-8001 (Schet-faktura)",
        type: "delivery-act",
        module: "finance",
      },
    },
  ],

  setNotifPanelOpen: (open) => set({ isNotifPanelOpen: open }),

  loadNotifications: async (companyCode = "PRINTGOO") => {
    try {
      set({ isNotifLoading: true });
      const res = await fetch(`/api/v1/notifications?companyCode=${companyCode}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        const mapped: AppNotification[] = data.notifications.map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description || undefined,
          severity: n.severity || "info",
          category: n.category || "system",
          eventType: n.eventType,
          entityCode: n.entityCode || undefined,
          timestamp: new Date(n.createdAt).getTime(),
          read: Boolean(n.isRead),
          link: n.link || undefined,
          targetTab: n.targetTab || undefined,
          i18nKey: n.i18nKey || undefined,
          i18nParams: n.i18nParams || undefined,
        }));
        set({
          notifications: mapped,
          notificationRules: data.rules || get().notificationRules,
        });
      }
    } catch (e) {
      console.error("[loadNotifications] Failed:", e);
    } finally {
      set({ isNotifLoading: false });
    }
  },

  addNotification: (notif) => {
    // 1. Toast vs. Bell Inbox filtrlash
    const isToastOnly =
      notif.channel === "toast" ||
      (!notif.targetTab &&
        !notif.entityCode &&
        !notif.link &&
        (notif.severity === "info" || notif.severity === "success"));

    if (isToastOnly || notif.channel === "both") {
      try {
        const hasAction = Boolean(notif.targetTab || notif.link);
        toast.add({
          title: notif.title,
          description: notif.description,
          type:
            notif.severity === "error"
              ? "error"
              : notif.severity === "warning"
              ? "warning"
              : notif.severity === "success"
              ? "success"
              : "info",
          actionProps: hasAction
            ? {
                children: "Ochish",
                onClick: () => {
                  const targetTab = notif.targetTab;
                  const link = notif.link;
                  const targetModule = targetTab?.module || link?.module;
                  const targetSubMod =
                    link?.subModule ||
                    (targetTab?.id?.includes("telegram-inbox")
                      ? "telegram-inbox"
                      : undefined);
                  const chatId =
                    (targetTab as any)?.documentData?.chatId ||
                    (targetTab as any)?.chatId ||
                    notif.entityCode;

                  if (targetModule) {
                    get().setActiveModule(targetModule);
                    if (targetSubMod) {
                      get().setModule(targetModule, targetSubMod);
                    }
                  }

                  if (chatId && (notif.category === "crm" || notif.eventType === "telegram_message")) {
                    get().setActiveTelegramChatId(chatId);
                  }

                  if (targetTab) {
                    get().openTab(targetTab);
                  }
                },
              }
            : undefined,
        });
      } catch (e) {}
    }

    if (notif.channel === "toast") {
      return;
    }

    const newId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullItem: AppNotification = {
      ...notif,
      id: newId,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [fullItem, ...state.notifications],
    }));

    try {
      fetch("/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notif.title,
          description: notif.description,
          severity: notif.severity,
          category: notif.category || "system",
          eventType: notif.eventType || "user_action",
          entityCode: notif.entityCode,
          link: notif.link,
          targetTab: notif.targetTab,
          i18nKey: notif.i18nKey,
          i18nParams: notif.i18nParams,
        }),
      }).catch(() => {});
    } catch (_) {}
  },

  markNotificationRead: async (id, read = true, companyCode = "PRINTGOO") => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read } : n)),
    }));
    try {
      await fetch(`/api/v1/notifications?companyCode=${companyCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read }),
      });
    } catch (_) {}
  },

  toggleNotificationRead: async (id, companyCode = "PRINTGOO") => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target) return;
    const nextRead = !target.read;
    await get().markNotificationRead(id, nextRead, companyCode);
  },

  markAllRead: async (companyCode = "PRINTGOO") => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await fetch(`/api/v1/notifications?companyCode=${companyCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch (_) {}
  },

  dismissNotification: async (id, companyCode = "PRINTGOO") => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
    try {
      await fetch(`/api/v1/notifications?id=${id}&companyCode=${companyCode}`, {
        method: "DELETE",
      });
    } catch (_) {}
  },

  clearAllNotifications: async (companyCode = "PRINTGOO") => {
    set({ notifications: [] });
    try {
      await fetch(`/api/v1/notifications?all=true&companyCode=${companyCode}`, {
        method: "DELETE",
      });
    } catch (_) {}
  },

  updateNotificationRules: async (rules, companyCode = "PRINTGOO") => {
    set((state) => ({
      notificationRules: { ...state.notificationRules, ...rules },
    }));
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRules", rules, companyCode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rules) {
          set({ notificationRules: data.rules });
        }
      }
    } catch (_) {}
  },

  // ── Toast Sound Configuration state & actions ─────────────────────────────
  toastSoundConfig: {
    enabled: true,
    theme: "modern",
    volume: 0.75,
    telegramToastEnabled: true,
  },
  setToastSoundConfig: (config) => {
    set((state) => {
      const next = { ...state.toastSoundConfig, ...config };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("printgoo_toast_sound", JSON.stringify(next));
        } catch (e) {}
      }
      return { toastSoundConfig: next };
    });
  },

  // ── Telegram Active Chat State ─────────────────────────────────────────────
  activeTelegramChatId: null,
  setActiveTelegramChatId: (id) => set({ activeTelegramChatId: id }),
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
    const draftId = `draft-wo-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    get().openTab({
      id: draftId,
      title: "Yangi buyruq (Qoralama)",
      type: "work-order",
      module: "production",
      isUnsaved: false,
      activeLevel3Tab: "overview",
      documentData: {
        docNo: "",
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
      const normalizedTab = {
        ...tab,
        module: normalizedModule,
        isUnsaved: false,
      };

      // 1. Single Registry Tab Slot: Replace the existing registry tab in-place at index 0
      if (normalizedTab.type === "registry") {
        const docTabs = state.tabs.filter((t) => t.type !== "registry");
        return {
          tabs: [normalizedTab, ...docTabs],
          activeTabId: normalizedTab.id,
          ...(normalizedTab.module
            ? { activeModule: normalizedTab.module, currentModule: normalizedTab.module }
            : {}),
        };
      }

      // 2. If document tab already exists, activate it (and refresh documentData if not unsaved)
      const exists = state.tabs.find((t) => t.id === normalizedTab.id);
      if (exists) {
        const nextActiveLevel3Tab = normalizedTab.activeLevel3Tab || exists.activeLevel3Tab;
        return {
          tabs: state.tabs.map((t) =>
            t.id === normalizedTab.id
              ? {
                  ...t,
                  title: normalizedTab.title || t.title,
                  activeLevel3Tab: nextActiveLevel3Tab,
                  documentData:
                    !exists.isUnsaved && normalizedTab.documentData
                      ? { ...t.documentData, ...normalizedTab.documentData }
                      : t.documentData,
                }
              : t
          ),
          activeTabId: normalizedTab.id,
        };
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
        productionQueue: id.startsWith("draft-") || id.startsWith("temp-")
          ? state.productionQueue.filter((q) => q.id !== id)
          : state.productionQueue,
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

  replaceTabId: (oldId, newId, title, documentData) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === oldId
          ? {
              ...t,
              id: newId,
              title: title || t.title,
              documentData: { ...(t.documentData || {}), ...(documentData || {}) },
              isUnsaved: false,
            }
          : t
      ),
      activeTabId: state.activeTabId === oldId ? newId : state.activeTabId,
    })),

  setLevel3Tab: (tabId, level3Tab) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, activeLevel3Tab: level3Tab } : t
      ),
    })),

  updateGridStats: (selectedCount, totalCount, cellCoords) =>
    set((state) => {
      const targetCoords = cellCoords || state.activeCellCoords;
      if (
        state.selectedCount === selectedCount &&
        state.totalCount === totalCount &&
        state.activeCellCoords === targetCoords
      ) {
        return state;
      }
      return {
        selectedCount,
        totalCount,
        activeCellCoords: targetCoords,
      };
    }),

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
  currentUser: DEMO_USERS.admin,

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
      const baseUser = user ? { ...state.currentUser, ...user } : state.currentUser;
      const updatedUser = {
        ...baseUser,
        initials: getUserInitials(baseUser.fullName || baseUser.name || baseUser.username, "AD"),
      };
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
      fetch("/api/v1/auth/logout", { method: "POST" });
      localStorage.removeItem("printgoo_auth");
      localStorage.removeItem("printgoo_user");
    } catch (e) {}
    set({ isAuthenticated: false });
  },
}));
