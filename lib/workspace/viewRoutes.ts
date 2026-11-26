/**
 * Single source of truth for which view a workspace tab renders.
 *
 * RegistryGridRenderer and Workspace render from these tables, and the dev
 * tools (StatusBar, element inspector, sidebar menu) resolve the active file
 * from the same tables, so the two can no longer drift apart.
 *
 * Pure data: no React imports, safe to use from lib/ code.
 */

import type { DocumentTab } from "@/store/workspaceStore";

// ── Registry (grid) views ─────────────────────────────────────────────

/** Source file of every component RegistryGridRenderer can mount. */
export const REGISTRY_COMPONENT_FILES = {
  DataGrid: "components/grid/DataGrid.tsx",
  CrmGrid: "components/grid/CrmGrid.tsx",
  ProductionGrid: "components/grid/ProductionGrid.tsx",
  WarehouseGrid: "components/grid/WarehouseGrid.tsx",
  WarehouseWmsView: "components/documents/warehouse/wms/WarehouseWmsView.tsx",
  SalesGrid: "components/grid/SalesGrid.tsx",
  CashJournalGrid: "components/documents/finance/CashJournalGrid.tsx",
  MoneyAccountsGrid: "components/documents/finance/MoneyAccountsGrid.tsx",
  CashCategoriesGrid: "components/documents/finance/CashCategoriesGrid.tsx",
  CashFlowReport: "components/documents/finance/CashFlowReport.tsx",
  PnlReport: "components/documents/finance/PnlReport.tsx",
  FinanceGrid: "components/grid/FinanceGrid.tsx",
  TaskGrid: "components/grid/TaskGrid.tsx",
  SettingsGrid: "components/grid/SettingsGrid.tsx",
  WorkRatesGrid: "components/documents/work-rate/WorkRatesGrid.tsx",
  TradingGrid: "components/grid/TradingGrid.tsx",
  EmployeesGrid: "components/documents/hr/employees/EmployeesGrid.tsx",
  DepartmentsGrid: "components/documents/hr/departments/DepartmentsGrid.tsx",
  PositionsGrid: "components/documents/hr/positions/PositionsGrid.tsx",
  TimesheetGrid: "components/documents/hr/attendance/TimesheetGrid.tsx",
  AttendanceGrid: "components/documents/hr/attendance/AttendanceGrid.tsx",
  ShiftsGrid: "components/documents/hr/shifts/ShiftsGrid.tsx",
  PieceworkGrid: "components/documents/hr/piecework/PieceworkGrid.tsx",
  AdvancesGrid: "components/documents/hr/advances/AdvancesGrid.tsx",
  PayrollGrid: "components/documents/hr/payroll/PayrollGrid.tsx",
  DevicesGrid: "components/documents/hr/devices/DevicesGrid.tsx",
  TelegramInbox: "components/documents/crm/TelegramInbox.tsx",
  TelegramSettingsView: "components/documents/settings/TelegramSettingsView.tsx",
  NotificationSoundSettingsView: "components/documents/settings/NotificationSoundSettingsView.tsx",
  OperatorTerminal: "components/documents/work-order/terminal/OperatorTerminal.tsx",
  ToolingOrdersGrid: "components/grid/ToolingOrdersGrid.tsx",
} as const;

export type RegistryComponent = keyof typeof REGISTRY_COMPONENT_FILES;

export interface RegistryView {
  component: RegistryComponent;
  /** String props passed to the component (e.g. `type`). */
  props?: Record<string, string>;
  /** Component also receives the tab itself. */
  passTab?: boolean;
}

interface RegistryRoute {
  /** Tab module this route applies to; omitted = any module. */
  module?: string;
  /** Matches when tab.id contains any of these; empty = module fallback. */
  match: string[];
  view: RegistryView;
}

const v = (component: RegistryComponent, type?: string, passTab?: boolean): RegistryView => ({
  component,
  ...(type ? { props: { type } } : {}),
  ...(passTab ? { passTab } : {}),
});

/** Evaluated top to bottom; the first match wins. Order matters. */
export const REGISTRY_ROUTES: RegistryRoute[] = [
  { match: ["tasks"], view: v("TaskGrid") },

  { module: "crm", match: ["telegram-inbox"], view: v("TelegramInbox") },
  { module: "crm", match: ["customers"], view: v("CrmGrid", "customers") },
  { module: "crm", match: ["suppliers"], view: v("CrmGrid", "suppliers") },
  { module: "crm", match: ["leads"], view: v("CrmGrid", "leads") },
  { module: "crm", match: [], view: v("CrmGrid", "customers") },

  { module: "production", match: ["operator-terminal"], view: v("OperatorTerminal") },
  { module: "production", match: ["operation-catalog"], view: v("WorkRatesGrid") },
  { module: "production", match: ["work-orders"], view: v("DataGrid") },
  { module: "production", match: ["planning"], view: v("ProductionGrid", "planning") },
  { module: "production", match: ["machines"], view: v("ProductionGrid", "machines") },
  { module: "production", match: ["bom", "products"], view: v("ProductionGrid", "bom") },
  { module: "production", match: ["tooling-orders", "prepress-orders"], view: v("ToolingOrdersGrid") },
  { module: "production", match: ["tooling"], view: v("ProductionGrid", "tooling") },
  { module: "production", match: [], view: v("DataGrid") },

  { module: "warehouse", match: ["wms", "topology"], view: v("WarehouseWmsView", undefined, true) },
  { module: "warehouse", match: ["requirements", "deficits"], view: v("WarehouseGrid", "requirements") },
  { module: "warehouse", match: ["finished-goods"], view: v("WarehouseGrid", "finished-goods") },
  { module: "warehouse", match: ["trading-catalog", "accessories"], view: v("TradingGrid", "catalog") },
  { module: "warehouse", match: ["trading-imports", "imports"], view: v("TradingGrid", "imports") },
  { module: "warehouse", match: ["manifests"], view: v("WarehouseGrid", "manifests") },
  { module: "warehouse", match: ["stock-balance"], view: v("WarehouseGrid", "stock-balance") },
  { module: "warehouse", match: ["production-issue"], view: v("WarehouseGrid", "production-issue") },
  { module: "warehouse", match: ["write-offs"], view: v("WarehouseGrid", "write-offs") },
  { module: "warehouse", match: ["movements"], view: v("WarehouseGrid", "movements") },
  { module: "warehouse", match: ["inventory"], view: v("WarehouseGrid", "inventory") },
  { module: "warehouse", match: ["receipts"], view: v("WarehouseGrid", "receipts") },
  { module: "warehouse", match: ["shipments"], view: v("WarehouseGrid", "shipments") },
  { module: "warehouse", match: ["carriers"], view: v("WarehouseGrid", "carriers") },
  { module: "warehouse", match: [], view: v("WarehouseGrid", "stock-balance") },

  { module: "finance", match: ["cash-journal"], view: v("CashJournalGrid") },
  { module: "finance", match: ["money-accounts"], view: v("MoneyAccountsGrid") },
  { module: "finance", match: ["cash-categories"], view: v("CashCategoriesGrid") },
  { module: "finance", match: ["cash-flow"], view: v("CashFlowReport") },
  { module: "finance", match: ["pnl"], view: v("PnlReport") },
  { module: "finance", match: ["delivery-acts"], view: v("SalesGrid", "delivery-acts") },
  { module: "finance", match: ["settlements"], view: v("FinanceGrid", "settlements") },
  { module: "finance", match: ["payments"], view: v("FinanceGrid", "payments") },
  { module: "finance", match: ["cost-analysis"], view: v("FinanceGrid", "cost-analysis") },
  { module: "finance", match: ["accounts"], view: v("FinanceGrid", "accounts") },
  { module: "finance", match: [], view: v("FinanceGrid", "settlements") },

  { module: "settings", match: ["notifications-sound", "sound"], view: v("NotificationSoundSettingsView") },
  { module: "settings", match: ["telegram-settings"], view: v("TelegramSettingsView") },
  { module: "settings", match: ["companies"], view: v("SettingsGrid", "companies") },
  { module: "settings", match: ["users"], view: v("SettingsGrid", "users") },
  { module: "settings", match: ["tariffs"], view: v("SettingsGrid", "tariffs") },
  { module: "settings", match: [], view: v("SettingsGrid", "companies") },

  { module: "hr", match: ["departments"], view: v("DepartmentsGrid") },
  { module: "hr", match: ["positions"], view: v("PositionsGrid") },
  { module: "hr", match: ["timesheet"], view: v("TimesheetGrid") },
  { module: "hr", match: ["attendance"], view: v("AttendanceGrid") },
  { module: "hr", match: ["shifts"], view: v("ShiftsGrid") },
  { module: "hr", match: ["devices", "biometric"], view: v("DevicesGrid") },
  { module: "hr", match: ["piecework"], view: v("PieceworkGrid") },
  { module: "hr", match: ["advances"], view: v("AdvancesGrid") },
  { module: "hr", match: ["payroll"], view: v("PayrollGrid") },
  { module: "hr", match: [], view: v("EmployeesGrid") },

  { module: "trading", match: ["trading-imports", "imports"], view: v("TradingGrid", "imports") },
  { module: "trading", match: [], view: v("TradingGrid", "catalog") },
];

const DEFAULT_REGISTRY_VIEW: RegistryView = v("DataGrid");

export interface RegistryResolution {
  view: RegistryView;
  /** False when nothing matched and the global default was used. */
  matched: boolean;
}

export function resolveRegistryView(tab: { id: string; module: string }): RegistryResolution {
  for (const route of REGISTRY_ROUTES) {
    if (route.module && route.module !== tab.module) continue;
    if (route.match.length === 0 || route.match.some((m) => tab.id.includes(m))) {
      return { view: route.view, matched: true };
    }
  }
  return { view: DEFAULT_REGISTRY_VIEW, matched: false };
}

// ── Document views ────────────────────────────────────────────────────

/** Tab types with a document view. "bom" is declared on DocumentTab but never opened. */
export type DocumentViewType = Exclude<DocumentTab["type"], "registry" | "bom">;

export interface ViewFile {
  component: string;
  file: string;
}

export const DOCUMENT_VIEWS: Record<DocumentViewType, ViewFile> = {
  "work-order": { component: "WorkOrderDetail", file: "components/documents/work-order/WorkOrderDetail.tsx" },
  "product-spec": { component: "ProductSpecDetail", file: "components/documents/ProductSpecDetail.tsx" },
  "delivery-act": { component: "DeliveryActDetail", file: "components/documents/DeliveryActDetail.tsx" },
  customer: { component: "CustomerDetail", file: "components/documents/CustomerDetail.tsx" },
  supplier: { component: "SupplierDetail", file: "components/documents/SupplierDetail.tsx" },
  "warehouse-receipt": { component: "WarehouseReceiptDetail", file: "components/documents/WarehouseReceiptDetail.tsx" },
  "warehouse-shipment": { component: "WarehouseShipmentDetail", file: "components/documents/WarehouseShipmentDetail.tsx" },
  "warehouse-movement": { component: "WarehouseMovementDetail", file: "components/documents/WarehouseMovementDetail.tsx" },
  "warehouse-production-issue": { component: "WarehouseProductionIssueDetail", file: "components/documents/WarehouseProductionIssueDetail.tsx" },
  "warehouse-write-off": { component: "WarehouseWriteOffDetail", file: "components/documents/WarehouseWriteOffDetail.tsx" },
  "warehouse-inventory": { component: "WarehouseInventoryDetail", file: "components/documents/WarehouseInventoryDetail.tsx" },
  "warehouse-stock": { component: "WarehouseStockDetail", file: "components/documents/WarehouseStockDetail.tsx" },
  "planning-slot": { component: "PlanningSlotDetail", file: "components/documents/PlanningSlotDetail.tsx" },
  "machine-detail": { component: "MachineDetail", file: "components/documents/MachineDetail.tsx" },
  "company-detail": { component: "CompanyDetail", file: "components/documents/company/CompanyDetail.tsx" },
  "plant-detail": { component: "CompanyDetail", file: "components/documents/company/CompanyDetail.tsx" },
  "tariff-detail": { component: "TariffDetail", file: "components/documents/TariffDetail.tsx" },
  "user-detail": { component: "UserDetail", file: "components/documents/UserDetail.tsx" },
  "employee-detail": { component: "EmployeeDetail", file: "components/documents/hr/employees/EmployeeDetail.tsx" },
  "department-detail": { component: "DepartmentDetail", file: "components/documents/hr/departments/DepartmentDetail.tsx" },
  "position-detail": { component: "PositionDetail", file: "components/documents/hr/positions/PositionDetail.tsx" },
  "shift-detail": { component: "ShiftDetail", file: "components/documents/hr/shifts/ShiftDetail.tsx" },
  "payroll-detail": { component: "PayrollDetail", file: "components/documents/hr/payroll/PayrollDetail.tsx" },
  "trading-sale": { component: "TradingSaleDetail", file: "components/documents/trading/TradingSaleDetail.tsx" },
  "trading-order": { component: "TradingOrderDetail", file: "components/documents/trading/TradingOrderDetail.tsx" },
  "trading-settlement": { component: "TradingSettlementDetail", file: "components/documents/trading/TradingSettlementDetail.tsx" },
  "trading-import": { component: "TradingImportDetail", file: "components/documents/trading/TradingImportDetail.tsx" },
  "trading-catalog": { component: "TradingCatalogDetail", file: "components/documents/trading/TradingCatalogDetail.tsx" },
  "trading-ytt-limit": { component: "TradingYttLimitDetail", file: "components/documents/trading/TradingYttLimitDetail.tsx" },
};

const WO_TABS = "components/documents/work-order/tabs";

/** Inner tab (`tab.activeLevel3Tab`) → the component that renders it. */
export const DOCUMENT_SUBVIEWS: Partial<Record<DocumentViewType, Record<string, ViewFile>>> = {
  "work-order": {
    overview: { component: "OverviewTab", file: `${WO_TABS}/OverviewTab.tsx` },
    specs: { component: "SpecificationsTab", file: `${WO_TABS}/SpecificationsTab.tsx` },
    layout: { component: "LayoutCalcTab", file: `${WO_TABS}/layout-calc/LayoutCalcTab.tsx` },
    flexo: { component: "FlexoCalcTab", file: `${WO_TABS}/FlexoCalcTab.tsx` },
    die: { component: "DieLayoutTab", file: `${WO_TABS}/die-layout/DieLayoutTab.tsx` },
    "prepress-tooling": { component: "PrepressToolingTab", file: `${WO_TABS}/PrepressToolingTab.tsx` },
    materials: { component: "MaterialsTab", file: `${WO_TABS}/MaterialsTab.tsx` },
    operations: { component: "OperationsTab", file: `${WO_TABS}/OperationsTab.tsx` },
    timeline: { component: "ShiftTimelineTab", file: `${WO_TABS}/ShiftTimelineTab.tsx` },
    shipments: { component: "ShipmentsTab", file: `${WO_TABS}/ShipmentsTab.tsx` },
    financials: { component: "FinancialsTab", file: `${WO_TABS}/FinancialsTab.tsx` },
    files: { component: "FilesTab", file: "components/documents/common/FilesTab.tsx" },
    history: { component: "HistoryTab", file: `${WO_TABS}/HistoryTab.tsx` },
  },
};

export function isDocumentViewType(type: string): type is DocumentViewType {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_VIEWS, type);
}
