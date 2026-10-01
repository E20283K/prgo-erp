"use client";
import React from "react";
import dynamic from "next/dynamic";
import { DocumentTab } from "@/store/workspaceStore";

const DataGrid = dynamic(() => import("@/components/grid/DataGrid").then((mod) => mod.DataGrid), { ssr: false });
const CrmGrid = dynamic(() => import("@/components/grid/CrmGrid").then((mod) => mod.CrmGrid), { ssr: false });
const ProductionGrid = dynamic(() => import("@/components/grid/ProductionGrid").then((mod) => mod.ProductionGrid), { ssr: false });
const WarehouseGrid = dynamic(() => import("@/components/grid/WarehouseGrid").then((mod) => mod.WarehouseGrid), { ssr: false });
const SalesGrid = dynamic(() => import("@/components/grid/SalesGrid").then((mod) => mod.SalesGrid), { ssr: false });
const SalesPOS = dynamic(() => import("@/components/documents/SalesPOS").then((mod) => mod.SalesPOS), { ssr: false });

export function RegistryGridRenderer({ tab }: { tab: DocumentTab }) {
  if (tab.module === "crm") {
    let crmType = "customers";
    if (tab.id.includes("customers")) crmType = "customers";
    else if (tab.id.includes("contacts")) crmType = "contacts";
    else if (tab.id.includes("leads")) crmType = "leads";
    else if (tab.id.includes("requests")) crmType = "requests";
    else if (tab.id.includes("client-orders")) crmType = "client-orders";
    return <CrmGrid type={crmType as any} />;
  } else if (tab.module === "production") {
    if (tab.id.includes("work-orders") || tab.id === "registry-work-orders") return <DataGrid />;
    if (tab.id.includes("planning")) return <ProductionGrid type="planning" />;
    if (tab.id.includes("history")) return <ProductionGrid type="history" />;
    if (tab.id.includes("machines")) return <ProductionGrid type="machines" />;
    if (tab.id.includes("bom")) return <ProductionGrid type="bom" />;
    if (tab.id.includes("materials")) return <ProductionGrid type="materials" />;
    return <DataGrid />;
  } else if (tab.module === "warehouse") {
    if (tab.id.includes("stock-balance")) return <WarehouseGrid type="stock-balance" />;
    if (tab.id.includes("movements")) return <WarehouseGrid type="movements" />;
    if (tab.id.includes("inventory")) return <WarehouseGrid type="inventory" />;
    if (tab.id.includes("receipts")) return <WarehouseGrid type="receipts" />;
    if (tab.id.includes("shipments")) return <WarehouseGrid type="shipments" />;
    if (tab.id.includes("locations")) return <WarehouseGrid type="locations" />;
    return <WarehouseGrid type="stock-balance" />;
  } else if (tab.module === "sales") {
    if (tab.id.includes("pos")) return <SalesPOS />;
    if (tab.id.includes("quotations")) return <SalesGrid type="quotations" />;
    if (tab.id.includes("orders")) return <SalesGrid type="orders" />;
    if (tab.id.includes("invoices")) return <SalesGrid type="invoices" />;
    if (tab.id.includes("returns")) return <SalesGrid type="returns" />;
    if (tab.id.includes("price-lists")) return <SalesGrid type="price-lists" />;
    if (tab.id.includes("products")) return <SalesGrid type="products" />;
    if (tab.id.includes("discounts")) return <SalesGrid type="discounts" />;
    return <SalesGrid type="orders" />;
  }
  return <DataGrid />;
}
