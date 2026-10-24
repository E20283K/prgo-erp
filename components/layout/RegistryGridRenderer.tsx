"use client";
import React from "react";
import dynamic from "next/dynamic";
import { DocumentTab } from "@/store/workspaceStore";

const DataGrid = dynamic(() => import("@/components/grid/DataGrid").then((mod) => mod.DataGrid), { ssr: false });
const CrmGrid = dynamic(() => import("@/components/grid/CrmGrid").then((mod) => mod.CrmGrid), { ssr: false });
const ProductionGrid = dynamic(() => import("@/components/grid/ProductionGrid").then((mod) => mod.ProductionGrid), { ssr: false });
const WarehouseGrid = dynamic(() => import("@/components/grid/WarehouseGrid").then((mod) => mod.WarehouseGrid), { ssr: false });
const SalesGrid = dynamic(() => import("@/components/grid/SalesGrid").then((mod) => mod.SalesGrid), { ssr: false });
const FinanceGrid = dynamic(() => import("@/components/grid/FinanceGrid").then((mod) => mod.FinanceGrid), { ssr: false });
const TaskGrid = dynamic(() => import("@/components/grid/TaskGrid").then((mod) => mod.TaskGrid), { ssr: false });
const SettingsGrid = dynamic(() => import("@/components/grid/SettingsGrid").then((mod) => mod.SettingsGrid), { ssr: false });
const TradingGrid = dynamic(() => import("@/components/grid/TradingGrid").then((mod) => mod.TradingGrid), { ssr: false });

// HR Standalone High-Performance Grids
const EmployeesGrid = dynamic(() => import("@/components/documents/hr/employees/EmployeesGrid").then((mod) => mod.EmployeesGrid), { ssr: false });
const DepartmentsGrid = dynamic(() => import("@/components/documents/hr/departments/DepartmentsGrid").then((mod) => mod.DepartmentsGrid), { ssr: false });
const PositionsGrid = dynamic(() => import("@/components/documents/hr/positions/PositionsGrid").then((mod) => mod.PositionsGrid), { ssr: false });
const AttendanceGrid = dynamic(() => import("@/components/documents/hr/attendance/AttendanceGrid").then((mod) => mod.AttendanceGrid), { ssr: false });
const ShiftsGrid = dynamic(() => import("@/components/documents/hr/shifts/ShiftsGrid").then((mod) => mod.ShiftsGrid), { ssr: false });
const PieceworkGrid = dynamic(() => import("@/components/documents/hr/piecework/PieceworkGrid").then((mod) => mod.PieceworkGrid), { ssr: false });
const PayrollGrid = dynamic(() => import("@/components/documents/hr/payroll/PayrollGrid").then((mod) => mod.PayrollGrid), { ssr: false });
const TelegramInbox = dynamic(() => import("@/components/documents/crm/TelegramInbox").then((mod) => mod.TelegramInbox), { ssr: false });
const TelegramSettingsView = dynamic(() => import("@/components/documents/settings/TelegramSettingsView").then((mod) => mod.TelegramSettingsView), { ssr: false });
const NotificationSoundSettingsView = dynamic(() => import("@/components/documents/settings/NotificationSoundSettingsView").then((mod) => mod.NotificationSoundSettingsView), { ssr: false });

export function RegistryGridRenderer({ tab }: { tab: DocumentTab }) {
  if (tab.id.includes("tasks")) {
    return <TaskGrid />;
  }

  if (tab.module === "crm") {
    if (tab.id.includes("telegram-inbox")) return <TelegramInbox />;
    let crmType = "customers";
    if (tab.id.includes("tasks")) return <TaskGrid />;
    else if (tab.id.includes("customers")) crmType = "customers";
    else if (tab.id.includes("suppliers")) crmType = "suppliers";
    else if (tab.id.includes("leads")) crmType = "leads";
    return <CrmGrid type={crmType as any} />;
  } else if (tab.module === "production") {
    if (tab.id.includes("work-orders") || tab.id === "registry-work-orders") return <DataGrid />;
    if (tab.id.includes("planning")) return <ProductionGrid type="planning" />;
    if (tab.id.includes("machines")) return <ProductionGrid type="machines" />;
    if (tab.id.includes("bom") || tab.id.includes("products")) return <ProductionGrid type="bom" />;
    if (tab.id.includes("tooling")) return <ProductionGrid type="tooling" />;
    return <DataGrid />;
  } else if (tab.module === "warehouse") {
    if (tab.id.includes("requirements") || tab.id.includes("deficits")) return <WarehouseGrid type="requirements" />;
    if (tab.id.includes("finished-goods")) return <WarehouseGrid type="finished-goods" />;
    if (tab.id.includes("stock-balance")) return <WarehouseGrid type="stock-balance" />;
    if (tab.id.includes("movements")) return <WarehouseGrid type="movements" />;
    if (tab.id.includes("inventory")) return <WarehouseGrid type="inventory" />;
    if (tab.id.includes("receipts")) return <WarehouseGrid type="receipts" />;
    if (tab.id.includes("shipments")) return <WarehouseGrid type="shipments" />;
    return <WarehouseGrid type="stock-balance" />;
  } else if (tab.module === "finance") {
    if (tab.id.includes("delivery-acts")) return <SalesGrid type="delivery-acts" />;
    if (tab.id.includes("settlements")) return <FinanceGrid type="settlements" />;
    if (tab.id.includes("payments")) return <FinanceGrid type="payments" />;
    if (tab.id.includes("cost-analysis")) return <FinanceGrid type="cost-analysis" />;
    if (tab.id.includes("accounts")) return <FinanceGrid type="accounts" />;
    return <FinanceGrid type="settlements" />;
  } else if (tab.module === "settings") {
    if (tab.id.includes("notifications-sound") || tab.id.includes("sound")) return <NotificationSoundSettingsView />;
    if (tab.id.includes("telegram-settings")) return <TelegramSettingsView />;
    if (tab.id.includes("users")) return <SettingsGrid type="users" />;
    if (tab.id.includes("tariffs")) return <SettingsGrid type="tariffs" />;
    return <SettingsGrid type="plants" />;
  } else if (tab.module === "hr") {
    if (tab.id.includes("departments")) return <DepartmentsGrid />;
    if (tab.id.includes("positions")) return <PositionsGrid />;
    if (tab.id.includes("attendance")) return <AttendanceGrid />;
    if (tab.id.includes("shifts")) return <ShiftsGrid />;
    if (tab.id.includes("piecework")) return <PieceworkGrid />;
    if (tab.id.includes("payroll")) return <PayrollGrid />;
    return <EmployeesGrid />;
  } else if (tab.module === "trading") {
    if (tab.id.includes("trading-orders")) return <TradingGrid type="orders" />;
    if (tab.id.includes("trading-ytt-limits")) return <TradingGrid type="ytt-limits" />;
    if (tab.id.includes("trading-settlements")) return <TradingGrid type="settlements" />;
    if (tab.id.includes("trading-imports")) return <TradingGrid type="imports" />;
    if (tab.id.includes("trading-catalog")) return <TradingGrid type="catalog" />;
    return <TradingGrid type="sales" />;
  }
  return <DataGrid />;
}
