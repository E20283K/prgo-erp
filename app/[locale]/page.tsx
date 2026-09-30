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
    // Determine type from activeTab.id (e.g. "tab-crm-customers" -> "customers")
    let crmType = "customers";
    if (activeTab.id.includes("customers")) crmType = "customers";
    else if (activeTab.id.includes("contacts")) crmType = "contacts";
    else if (activeTab.id.includes("leads")) crmType = "leads";
    else if (activeTab.id.includes("requests")) crmType = "requests";

    content = <CrmGrid type={crmType} />;
  }

  return (
    <AppLayout>
      {content}
    </AppLayout>
  );
}

