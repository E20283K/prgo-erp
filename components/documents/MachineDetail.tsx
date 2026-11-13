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
  PauseCircle,
  Clock,
  ExternalLink,
  Loader2,
  CircleDot,
  Camera,
} from "lucide-react";
import { MachineOverviewTab } from "./machine/tabs/MachineOverviewTab";
import { MachineEnergyTab } from "./machine/tabs/MachineEnergyTab";
import { MachineCostingTab } from "./machine/tabs/MachineCostingTab";
import { MachineQueueTab } from "./machine/tabs/MachineQueueTab";
import { MachineMaintenanceTab } from "./machine/tabs/MachineMaintenanceTab";
import { MachineCylindersTab } from "./machine/tabs/MachineCylindersTab";
import { MachineImageModal } from "./machine/MachineImageModal";

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
    companiesList,
    loadCompanies,
    plants,
    fetchPlants,
    departmentsList,
    loadDepartments,
    setDepartmentsList,
    employees,
    loadEmployees,
    setTabUnsaved,
    updateTabData,
    productionQueue,
    openTab,
    addNotification,
  } = useWorkspaceStore();

  // Make sure machines, plants, companies, departments and employees are loaded
  useEffect(() => {
    if (machines.length === 0 && loadMachines) loadMachines();
    if (companiesList.length === 0 && loadCompanies) loadCompanies();
    if (plants.length === 0 && fetchPlants) fetchPlants();
    if (employees.length === 0 && loadEmployees) loadEmployees();
    if (departmentsList.length === 0) {
      if (loadDepartments) {
        loadDepartments();
      } else {
        fetch("/api/v1/hr/departments")
          .then((r) => r.json())
          .then((j) => {
            if (j.success && Array.isArray(j.data)) setDepartmentsList(j.data);
          })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTriggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addNotification?.({
        title: "Xatolik",
        description: "Faqat rasm formatidagi fayllarni yuklash mumkin (PNG, JPG, WEBP).",
        severity: "warning",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setMachineData((prev) => ({ ...prev, imageUrl: dataUrl }));
        setTabUnsaved(tab.id, true);
        addNotification?.({
          title: "Rasm biriktirildi",
          description: "Uskuna fotosurati muvaffaqiyatli yuklandi.",
          severity: "success",
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [addNotification, setTabUnsaved, tab.id]);

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
      const press = (item.pressMachine || "").trim().toLowerCase();
      if (!press) return false;
      const macName = (machineData.name || "").trim().toLowerCase();
      const macCode = (machineData.code || "").trim().toLowerCase();
      const matchesMachine =
        (macName && (press.includes(macName) || macName.includes(press))) ||
        (macCode && press.includes(macCode));
      return matchesMachine && item.stage === "In Production";
    });
  }, [productionQueue, machineData]);

  const activeJobMeta = useMemo(() => {
    const status = machineData.status || "Idle";
    if (status === "Running") {
      return {
        icon: PlayCircle,
        label: "Ishlamoqda",
        textClass: "text-emerald-600 dark:text-emerald-400",
        barClass: "bg-emerald-500",
      };
    }
    if (status === "Setup") {
      return {
        icon: Clock,
        label: "Priladka",
        textClass: "text-blue-600 dark:text-blue-400",
        barClass: "bg-blue-500",
      };
    }
    if (status === "Maintenance") {
      return {
        icon: PauseCircle,
        label: "Ta'mirda",
        textClass: "text-amber-600 dark:text-amber-400",
        barClass: "bg-amber-500",
      };
    }
    return {
      icon: PauseCircle,
      label: "Kutilmoqda",
      textClass: "text-muted-foreground",
      barClass: "bg-muted-foreground/40",
    };
  }, [machineData.status]);

  const handlePrint = () => {
    window.print();
  };

  const navItems: DocumentNavItem[] = [
    { id: "overview", label: "Xususiyatlar", icon: Cpu },
    ...(machineData.category === "flexo"
      ? [
          {
            id: "cylinders",
            label: "Silindrlar (Vallar)",
            icon: CircleDot,
            badge: `${machineData.flexoSpecs?.ownedCylinders?.length || machineData.flexoSpecs?.ownedCylinderTeeth?.length || 0} ta`,
          },
        ]
      : []),
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
      badge: activeJob ? (machineData.status === "Running" ? "1 Faol" : "1 Navbat") : undefined,
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

            {/* Direct Image File Picker Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerUpload}
              className="h-7 text-xs gap-1"
              title="Uskuna fotosuratini yuklash yoki almashtirish"
            >
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{machineData.imageUrl ? "Almashtirish" : "Rasm"}</span>
            </Button>

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
                {/* Equipment Thumbnail Photo */}
                <div
                  className="w-full h-28 rounded-md border border-border bg-muted/20 overflow-hidden flex flex-col items-center justify-center relative group cursor-pointer shadow-2xs mb-2 transition-colors hover:border-primary/50"
                  onClick={() => {
                    if (machineData.imageUrl) {
                      setIsImageModalOpen(true);
                    } else {
                      handleTriggerUpload();
                    }
                  }}
                  title={machineData.imageUrl ? "Rasmni to'liq ko'rish" : "Uskuna rasmini yuklash"}
                >
                  {machineData.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={machineData.imageUrl}
                        alt={machineData.name || "Uskuna"}
                        className="size-full object-contain p-1 select-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                        <Camera className="size-4" />
                        <span className="text-[10px] font-medium">Ko&apos;rish</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground p-2 text-center">
                      <Camera className="size-5 text-muted-foreground/50" />
                      <span className="text-[10px]">Rasm yuklash</span>
                    </div>
                  )}
                </div>

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

              {activeJob && (() => {
                const progressPct = Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(
                      ((activeJob.completedSheets || 0) /
                        (activeJob.plannedSheets || activeJob.quantity || 1)) *
                        100
                    )
                  )
                );
                return (
                  <SidebarSummaryCard
                    icon={activeJobMeta.icon}
                    title={activeJob.id}
                    subtitle={activeJob.customer}
                  >
                    <div className="space-y-1.5 text-[11px] pt-1">
                      <p className="font-medium text-foreground truncate">
                        {activeJob.product}
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Holat:</span>
                        <span className={`font-semibold ${activeJobMeta.textClass}`}>
                          {activeJobMeta.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Jarayon:</span>
                        <span className="font-mono font-semibold text-foreground">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${activeJobMeta.barClass}`}
                          style={{ width: `${progressPct}%` }}
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
                );
              })()}
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
              onUploadImage={handleTriggerUpload}
              onOpenPreviewModal={() => setIsImageModalOpen(true)}
              machine={machineData}
              onUpdate={handleUpdate}

            />
          )}

          {activeTab === "cylinders" && (
            <MachineCylindersTab
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


      <MachineImageModal
        isOpen={isImageModalOpen && Boolean(machineData.imageUrl)}
        onClose={() => setIsImageModalOpen(false)}
        onEditImage={handleTriggerUpload}
        data={
          machineData.imageUrl
            ? {
                imageUrl: machineData.imageUrl,
                name: machineData.name,
                code: machineData.code,
                department: machineData.department,
                category: machineData.category,
                status: machineData.status,
                hourlyRate: machineData.costing?.standardHourlyRateUsd,
                speed: machineData.offsetSpecs?.practicalSpeedSph
                  ? `${machineData.offsetSpecs.practicalSpeedSph.toLocaleString()} varaq/soat`
                  : undefined,
                location: machineData.location,
                leadOperator: machineData.leadOperator,
              }
            : null
        }
      />

      {/* Hidden file input for direct OS native file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}
