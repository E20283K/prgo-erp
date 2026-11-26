"use client";
import React from "react";
import dynamic from "next/dynamic";
import { DocumentTab } from "@/store/workspaceStore";
import { resolveRegistryView, type RegistryComponent } from "@/lib/workspace/viewRoutes";

const DataGrid = dynamic(() => import("@/components/grid/DataGrid").then((mod) => mod.DataGrid), { ssr: false });
const CrmGrid = dynamic(() => import("@/components/grid/CrmGrid").then((mod) => mod.CrmGrid), { ssr: false });
const ProductionGrid = dynamic(() => import("@/components/grid/ProductionGrid").then((mod) => mod.ProductionGrid), { ssr: false });
const WarehouseGrid = dynamic(() => import("@/components/grid/WarehouseGrid").then((mod) => mod.WarehouseGrid), { ssr: false });
const WarehouseWmsView = dynamic(() => import("@/components/documents/warehouse/wms/WarehouseWmsView").then((mod) => mod.WarehouseWmsView), { ssr: false });
const SalesGrid = dynamic(() => import("@/components/grid/SalesGrid").then((mod) => mod.SalesGrid), { ssr: false });
const CashJournalGrid = dynamic(() => import("@/components/documents/finance/CashJournalGrid").then((m) => m.CashJournalGrid), { ssr: false });
const MoneyAccountsGrid = dynamic(() => import("@/components/documents/finance/MoneyAccountsGrid").then((m) => m.MoneyAccountsGrid), { ssr: false });
const CashCategoriesGrid = dynamic(() => import("@/components/documents/finance/CashCategoriesGrid").then((m) => m.CashCategoriesGrid), { ssr: false });
const CashFlowReport = dynamic(() => import("@/components/documents/finance/CashFlowReport").then((m) => m.CashFlowReport), { ssr: false });
const PnlReport = dynamic(() => import("@/components/documents/finance/PnlReport").then((m) => m.PnlReport), { ssr: false });
const FinanceGrid = dynamic(() => import("@/components/grid/FinanceGrid").then((mod) => mod.FinanceGrid), { ssr: false });
const TaskGrid = dynamic(() => import("@/components/grid/TaskGrid").then((mod) => mod.TaskGrid), { ssr: false });
const SettingsGrid = dynamic(() => import("@/components/grid/SettingsGrid").then((mod) => mod.SettingsGrid), { ssr: false });
const WorkRatesGrid = dynamic(() => import("@/components/documents/work-rate/WorkRatesGrid").then((mod) => mod.WorkRatesGrid), { ssr: false });
const TradingGrid = dynamic(() => import("@/components/grid/TradingGrid").then((mod) => mod.TradingGrid), { ssr: false });

// HR Standalone High-Performance Grids
const EmployeesGrid = dynamic(() => import("@/components/documents/hr/employees/EmployeesGrid").then((mod) => mod.EmployeesGrid), { ssr: false });
const DepartmentsGrid = dynamic(() => import("@/components/documents/hr/departments/DepartmentsGrid").then((mod) => mod.DepartmentsGrid), { ssr: false });
const PositionsGrid = dynamic(() => import("@/components/documents/hr/positions/PositionsGrid").then((mod) => mod.PositionsGrid), { ssr: false });
const TimesheetGrid = dynamic(() => import("@/components/documents/hr/attendance/TimesheetGrid").then((mod) => mod.TimesheetGrid), { ssr: false });
const AttendanceGrid = dynamic(() => import("@/components/documents/hr/attendance/AttendanceGrid").then((mod) => mod.AttendanceGrid), { ssr: false });
const ShiftsGrid = dynamic(() => import("@/components/documents/hr/shifts/ShiftsGrid").then((mod) => mod.ShiftsGrid), { ssr: false });
const PieceworkGrid = dynamic(() => import("@/components/documents/hr/piecework/PieceworkGrid").then((mod) => mod.PieceworkGrid), { ssr: false });
const AdvancesGrid = dynamic(() => import("@/components/documents/hr/advances/AdvancesGrid").then((mod) => mod.AdvancesGrid), { ssr: false });
const PayrollGrid = dynamic(() => import("@/components/documents/hr/payroll/PayrollGrid").then((mod) => mod.PayrollGrid), { ssr: false });
const DevicesGrid = dynamic(() => import("@/components/documents/hr/devices/DevicesGrid").then((mod) => mod.DevicesGrid), { ssr: false });
const TelegramInbox = dynamic(() => import("@/components/documents/crm/TelegramInbox").then((mod) => mod.TelegramInbox), { ssr: false });
const TelegramSettingsView = dynamic(() => import("@/components/documents/settings/TelegramSettingsView").then((mod) => mod.TelegramSettingsView), { ssr: false });
const NotificationSoundSettingsView = dynamic(() => import("@/components/documents/settings/NotificationSoundSettingsView").then((mod) => mod.NotificationSoundSettingsView), { ssr: false });
const OperatorTerminal = dynamic(() => import("@/components/documents/work-order/terminal/OperatorTerminal").then((mod) => mod.OperatorTerminal), { ssr: false });
const ToolingOrdersGrid = dynamic(() => import("@/components/grid/ToolingOrdersGrid").then((mod) => mod.ToolingOrdersGrid), { ssr: false });

// Every component a registry route can name. The Record type makes a route
// without a component here a compile error.
const REGISTRY_COMPONENTS: Record<RegistryComponent, React.ComponentType<any>> = {
  DataGrid, CrmGrid, ProductionGrid, WarehouseGrid, WarehouseWmsView, SalesGrid,
  CashJournalGrid, MoneyAccountsGrid, CashCategoriesGrid, CashFlowReport, PnlReport, FinanceGrid,
  TaskGrid, SettingsGrid, WorkRatesGrid, TradingGrid,
  EmployeesGrid, DepartmentsGrid, PositionsGrid, TimesheetGrid, AttendanceGrid, ShiftsGrid,
  PieceworkGrid, AdvancesGrid, PayrollGrid, DevicesGrid,
  TelegramInbox, TelegramSettingsView, NotificationSoundSettingsView, OperatorTerminal, ToolingOrdersGrid,
};

export function RegistryGridRenderer({ tab }: { tab: DocumentTab }) {
  const { view } = resolveRegistryView(tab);
  const Component = REGISTRY_COMPONENTS[view.component];
  return <Component {...view.props} {...(view.passTab ? { tab } : {})} />;
}
