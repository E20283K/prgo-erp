"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { MachineRecord, MachineStatus } from "./machine/types";
import { getCleanBlankMachine } from "./machine/cleanBlankMachine";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
} from "./common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  Save,
  Printer,
  CheckCircle2,
  Zap,
  DollarSign,
  Layers,
  Wrench,
  User,
  PlayCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { MachineOverviewTab } from "./machine/tabs/MachineOverviewTab";
import { MachineEnergyTab } from "./machine/tabs/MachineEnergyTab";
import { MachineCostingTab } from "./machine/tabs/MachineCostingTab";
import { MachineQueueTab } from "./machine/tabs/MachineQueueTab";
import { MachineMaintenanceTab } from "./machine/tabs/MachineMaintenanceTab";

export { getCleanBlankMachine as getBlankMachine };

interface MachineDetailProps {
  tab: DocumentTab;
}

export function MachineDetail({ tab }: MachineDetailProps) {
  const {
    machines,
    upsertMachine,
    upsertMachineAsync,
    loadMachines,
    setTabUnsaved,
    updateTabData,
    productionQueue,
    openTab,
    addNotification,
  } = useWorkspaceStore();

  // Make sure machines are loaded from real DB
  useEffect(() => {
    if (machines.length === 0 && loadMachines) {
      loadMachines();
    }
  }, [machines.length, loadMachines]);

  // Resolve machine ID from tab id or tab data
  const machineId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("machine-")) return tab.id.replace("machine-", "");
    return tab.id;
  }, [tab]);

  // Find matching record from store, documentData, or initialize clean blank
  const initialMachine = useMemo(() => {
    // If explicit new tab
    if (tab.documentData?.isNew) {
      return getCleanBlankMachine(tab.documentData?.id || machineId, tab.documentData);
    }

    // Direct object passed via documentData
    if (tab.documentData?.rawMachine) {
      return tab.documentData.rawMachine as MachineRecord;
    }
    if (tab.documentData?.category && tab.documentData?.name !== undefined && tab.documentData?.costing) {
      return tab.documentData as MachineRecord;
    }

    // Match in store
    const found = machines.find(
      (m) =>
        m.id === machineId ||
        m.code.toLowerCase() === machineId.toLowerCase() ||
        (tab.title && m.name.toLowerCase() === tab.title.toLowerCase())
    );
    if (found) return found;

    // Fallback to completely clean blank machine
    return getCleanBlankMachine(machineId, tab.documentData);
  }, [machines, machineId, tab.documentData, tab.title]);

  // Local draft state for editing
  const [machineData, setMachineData] = useState<MachineRecord>(initialMachine);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync if store updates with newly fetched database record
  useEffect(() => {
    if (tab.documentData?.isNew) return;
    const found = machines.find(
      (m) =>
        m.id === machineId ||
        m.code.toLowerCase() === machineId.toLowerCase()
    );
    if (found && found.id !== machineData.id) {
      setMachineData(found);
    }
  }, [machines, machineId, tab.documentData?.isNew, machineData.id]);

  // Active level 3 sub-tab
  const [activeTab, setActiveTab] = useState<string>(
    tab.activeLevel3Tab || "overview"
  );

  const handleUpdate = useCallback((updated: Partial<MachineRecord>) => {
    setMachineData((prev) => ({
      ...prev,
      ...updated,
    }));
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  }, [setTabUnsaved, tab.id]);

  const handleStatusChange = (newStatus: MachineStatus) => {
    handleUpdate({ status: newStatus });
  };

  const handleSave = async () => {
    if (!machineData.name.trim()) {
      addNotification?.({
        title: "Xatolik",
        description: "Iltimos, uskuna nomi va modelini kiriting.",
        severity: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (upsertMachineAsync) {
        const saved = await upsertMachineAsync(machineData);
        const result = saved?.id ? saved : machineData;
        setMachineData(result);
        updateTabData(tab.id, result, result.name || result.id);
      } else {
        upsertMachine(machineData);
        updateTabData(tab.id, machineData, machineData.name || machineData.id);
      }

      setTabUnsaved(tab.id, false);
      setIsSaved(true);

      addNotification?.({
        title: "Uskuna Parametrlari Saqlandi",
        description: `${machineData.name} texnik ko'rsatkichlari bazada saqlandi.`,
        severity: "success",
      });

      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      console.error("Machine save error:", err);
      addNotification?.({
        title: "Saqlashda Xatolik",
        description: err?.message || "Uskunani saqlashda server xatoligi yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Find active running job for sidebar summary
  const activeJob = useMemo(() => {
    return productionQueue.find((item) => {
      const press = (item.pressMachine || "").toLowerCase();
      const macName = (machineData.name || "").toLowerCase();
      const macCode = (machineData.code || "").toLowerCase();
      return (
        macName &&
        (press.includes(macName) || macName.includes(press) || (macCode && press.includes(macCode))) &&
        item.stage === "In Production"
      );
    });
  }, [productionQueue, machineData]);

  const handlePrint = () => {
    window.print();
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Xususiyatlar", icon: Cpu },
    {
      id: "energy",
      label: "Elektr Sarfi",
      icon: Zap,
      badge: machineData.energy?.activePowerKw ? `${machineData.energy.activePowerKw} kW` : undefined,
    },
    {
      id: "costing",
      label: "Ishlab Chiqarish Narxi",
      icon: DollarSign,
      badge: machineData.costing?.standardHourlyRateUsd ? `$${machineData.costing.standardHourlyRateUsd}/h` : undefined,
    },
    {
      id: "queue",
      label: "Navbat & Yuklama",
      icon: Layers,
      badge: activeJob ? "1 Faol" : undefined,
    },
    {
      id: "maintenance",
      label: "Texnik Xizmat",
      icon: Wrench,
      badge: machineData.totalLifetimeCounter ? `${((machineData.totalLifetimeCounter || 0) / 1000000).toFixed(1)}M` : undefined,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* 1C Document Shell Header */}
      <DocumentHeader
        icon={Cpu}
        title={machineData.name || "Yangi Uskuna Pasporti"}
        docNo={machineData.code || machineData.id || "DRAFT"}
        status={machineData.status || "Idle"}
        priority={machineData.department || "Offset"}
        actions={
          <div className="flex items-center gap-2">
            {/* Quick Status Selector */}
            <Select
              value={machineData.status || "Idle"}
              onValueChange={(val: any) => handleStatusChange(val)}
            >
              <SelectTrigger className="h-7 w-32 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Running">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Running
                  </div>
                </SelectItem>
                <SelectItem value="Idle">
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    Idle
                  </div>
                </SelectItem>
                <SelectItem value="Maintenance">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Maintenance
                  </div>
                </SelectItem>
                <SelectItem value="Setup">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Setup / Priladka
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Print Passport Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-7 text-xs gap-1"
              title="Uskuna texnik pasportini chop etish"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pasport</span>
            </Button>

            {/* Save Button */}
            <Button
              variant={tab.isUnsaved ? "default" : "outline"}
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className={`h-7 text-xs gap-1 font-medium ${
                tab.isUnsaved ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : isSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Saqlandi</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Saqlash</span>
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Main Workspace Body with 1C Left Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Information Sidebar */}
        <DocumentSidebar
          summary={
            <div className="space-y-3">
              <SidebarSummaryCard
                icon={Cpu}
                title={machineData.name || "Yangi Uskuna"}
                subtitle={`${machineData.code || "Kodsiz"} • ${machineData.department || "Bo'limsiz"}`}
              >
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tijoriy Stavka:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ${(machineData.costing?.standardHourlyRateUsd || 0).toFixed(2)}/h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tannarxi:</span>
                    <span className="font-mono text-muted-foreground">
                      ${(machineData.costing?.totalBaseCostPerHourUsd || 0).toFixed(2)}/h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Elektr Quvvati:</span>
                    <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                      {machineData.energy?.activePowerKw || 0} kW
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bosh Operator:</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-500" />
                      {machineData.leadOperator ? machineData.leadOperator.split(" ")[0] : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">OEE Samaradorlik:</span>
                    <span className="font-mono font-bold text-foreground">
                      {machineData.overallEfficiency ?? 90}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Jami Odometer:</span>
                    <span className="font-mono text-muted-foreground">
                      {(((machineData.totalLifetimeCounter || 0) / 1000000)).toFixed(1)}M {machineData.counterUnit || "sheets"}
                    </span>
                  </div>
                </div>
              </SidebarSummaryCard>

              {activeJob && (
                <SidebarSummaryCard
                  icon={PlayCircle}
                  title={activeJob.id}
                  subtitle={activeJob.customer}
                >
                  <div className="space-y-1.5 text-[11px] pt-1">
                    <p className="font-medium text-foreground truncate">
                      {activeJob.product}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Jarayon:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {Math.round(
                          ((activeJob.completedSheets || 0) /
                            (activeJob.plannedSheets || activeJob.quantity || 1)) *
                            100
                        )}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.round(
                            ((activeJob.completedSheets || 0) /
                              (activeJob.plannedSheets || activeJob.quantity || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openTab({
                          id: activeJob.id,
                          title: `${activeJob.id}`,
                          type: "work-order",
                          module: "production",
                          activeLevel3Tab: "overview",
                        })
                      }
                      className="w-full h-6 text-[10px] gap-1 mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Buyurtmani Ko'rish
                    </Button>
                  </div>
                </SidebarSummaryCard>
              )}
            </div>
          }
          sectionsLabel="USKUNA BO'LIMLARI"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        {/* Right Main Viewport driven by left DocumentSidebar */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-4 bg-background">
          {activeTab === "overview" && (
            <MachineOverviewTab
              machine={machineData}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === "energy" && (
            <MachineEnergyTab
              machine={machineData}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === "costing" && (
            <MachineCostingTab
              machine={machineData}
              onUpdate={handleUpdate}
            />
          )}

          {activeTab === "queue" && (
            <MachineQueueTab machine={machineData} />
          )}

          {activeTab === "maintenance" && (
            <MachineMaintenanceTab
              machine={machineData}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
