"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useWorkspaceStore } from "@/store/workspaceStore";

const DataGrid = dynamic(
  () => import("@/components/grid/DataGrid").then((mod) => mod.DataGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">
        Loading Data Grid...
      </div>
    ),
  }
);

const CrmGrid = dynamic(
  () => import("@/components/grid/CrmGrid").then((mod) => mod.CrmGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">
        Loading CRM Grid...
      </div>
    ),
  }
);

const ProductionGrid = dynamic(
  () => import("@/components/grid/ProductionGrid").then((mod) => mod.ProductionGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">
        Loading Production Grid...
      </div>
    ),
  }
);

const WarehouseGrid = dynamic(
  () => import("@/components/grid/WarehouseGrid").then((mod) => mod.WarehouseGrid),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">
        Loading Warehouse Grid...
      </div>
    ),
  }
);

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, activeTabId, tabs } = useWorkspaceStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen w-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);
  let content = <DataGrid />; // Default

  if (activeTab?.module === "crm") {
    let crmType = "customers";
    if (activeTab.id.includes("customers")) crmType = "customers";
    else if (activeTab.id.includes("contacts")) crmType = "contacts";
    else if (activeTab.id.includes("leads")) crmType = "leads";
    else if (activeTab.id.includes("requests")) crmType = "requests";

    content = <CrmGrid type={crmType} />;
  } else if (activeTab?.module === "production") {
    if (activeTab.id.includes("planning")) {
      content = <ProductionGrid type="planning" />;
    } else if (activeTab.id.includes("history")) {
      content = <ProductionGrid type="history" />;
    } else if (activeTab.id.includes("machines")) {
      content = <ProductionGrid type="machines" />;
    } else if (activeTab.id.includes("bom")) {
      content = <ProductionGrid type="bom" />;
    } else if (activeTab.id.includes("materials")) {
      content = <ProductionGrid type="materials" />;
    }
  } else if (activeTab?.module === "warehouse") {
    if (activeTab.id.includes("stock-balance")) {
      content = <WarehouseGrid type="stock-balance" />;
    } else if (activeTab.id.includes("movements")) {
      content = <WarehouseGrid type="movements" />;
    } else if (activeTab.id.includes("inventory")) {
      content = <WarehouseGrid type="inventory" />;
    } else if (activeTab.id.includes("receipts")) {
      content = <WarehouseGrid type="receipts" />;
    } else if (activeTab.id.includes("shipments")) {
      content = <WarehouseGrid type="shipments" />;
    } else if (activeTab.id.includes("locations")) {
      content = <WarehouseGrid type="locations" />;
    }
  }

  return (
    <AppLayout>
      {content}
    </AppLayout>
  );
}

