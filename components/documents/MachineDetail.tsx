"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { MachineRecord, MachineStatus } from "./machine/types";
import { getCleanBlankMachine } from "./machine/cleanBlankMachine";
import { machineCostingGaps } from "./machine/costingGaps";
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
  AlertTriangle,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import type { TerminalJob } from "@/lib/server/operatorTerminalService";
import { MachineOverviewTab } from "./machine/tabs/MachineOverviewTab";
import { MachineEnergyTab } from "./machine/tabs/MachineEnergyTab";
import { MachineCostingTab } from "./machine/tabs/MachineCostingTab";
import { MachineQueueTab } from "./machine/tabs/MachineQueueTab";
import { MachineMaintenanceTab } from "./machine/tabs/MachineMaintenanceTab";
import { MachineCylindersTab } from "./machine/tabs/MachineCylindersTab";
import { MachineImageModal } from "./machine/MachineImageModal";

export { getCleanBlankMachine as getBlankMachine };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TERMINAL_REFRESH_MS = 60_000;

interface LiveState {
  label: string;
  icon: LucideIcon;
  textClass: string;
  barClass: string;
}

const LIVE_STATES = {
  maintenance: { label: "Ta'mirda", icon: Wrench, textClass: "text-amber-600 dark:text-amber-400", barClass: "bg-amber-500" },
  downtime: { label: "To'xtalish", icon: AlertTriangle, textClass: "text-red-600 dark:text-red-400", barClass: "bg-red-500" },
  run: { label: "Ishlamoqda", icon: PlayCircle, textClass: "text-emerald-600 dark:text-emerald-400", barClass: "bg-emerald-500" },
  setup: { label: "Priladka", icon: Clock, textClass: "text-blue-600 dark:text-blue-400", barClass: "bg-blue-500" },
  idle: { label: "Kutilmoqda", icon: PauseCircle, textClass: "text-muted-foreground", barClass: "bg-muted-foreground/40" },
} satisfies Record<string, LiveState>;

/**
 * What the machine is doing now. Maintenance is the one state set on the passport;
 * everything else comes from the shift journal of the jobs on this machine.
 */
function resolveLiveState(status: MachineStatus, jobs: TerminalJob[]): { state: LiveState; job: TerminalJob | null } {
  const downtimeJob = jobs.find((j) => j.openDowntime);
  const runJob = jobs.find((j) => j.phase === "run");
  const setupJob = jobs.find((j) => j.phase === "setup");
  const pausedJob = jobs.find((j) => j.phase === "paused");
  const job = downtimeJob || runJob || setupJob || pausedJob || null;

  if (status === "Maintenance") return { state: LIVE_STATES.maintenance, job };
  if (downtimeJob) return { state: LIVE_STATES.downtime, job };
  if (runJob) return { state: LIVE_STATES.run, job };
  if (setupJob) return { state: LIVE_STATES.setup, job };
  return { state: LIVE_STATES.idle, job };
}

interface MachineDetailProps {
  tab: DocumentTab;
}

export function MachineDetail({ tab }: MachineDetailProps) {
  const {
    machines,
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTriggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // The photo is stored as a file; only its URL goes into the machine record.
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/production/machines/image", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.url) {
        throw new Error(json?.error || `Server xatoligi (${res.status})`);
      }
      setMachineData((prev) => ({ ...prev, imageUrl: json.url }));
      setTabUnsaved(tab.id, true);
      setIsSaved(false);
    } catch (err) {
      addNotification?.({
        title: "Rasm yuklanmadi",
        description: err instanceof Error ? err.message : "Rasmni yuklab bo'lmadi.",
        severity: "error",
      });
    } finally {
      setIsUploadingImage(false);
    }
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
    if (!machineData.name.trim() || !machineData.code.trim()) {
      addNotification?.({
        title: "Xatolik",
        description: "Uskuna nomi va kodini kiriting.",
        severity: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Throws when the server rejects the save, so nothing below runs on failure.
      const saved: MachineRecord = await upsertMachineAsync(machineData);
      setMachineData(saved);
      updateTabData(tab.id, saved, saved.name || saved.id);
      setTabUnsaved(tab.id, false);
      setIsSaved(true);

      addNotification?.({
        title: "Saqlandi",
        description: `${saved.name} bazada saqlandi.`,
        severity: "success",
      });
      // Saving is allowed, but order costing cannot be exact until these are filled.
      const gaps = machineCostingGaps(saved);
      if (gaps.length > 0) {
        addNotification?.({
          title: "Tannarx uchun to'ldirilmagan",
          description: gaps.map((g) => g.label).join(", "),
          severity: "warning",
        });
      }

      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      addNotification?.({
        title: "Saqlashda xatolik",
        description: err instanceof Error ? err.message : "Uskunani saqlab bo'lmadi.",
        severity: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Jobs on this machine from the operator terminal (same source as the shift journal).
  const persistedMachineId = UUID_RE.test(machineData.id) ? machineData.id : null;
  const [terminalQueue, setTerminalQueue] = useState<{ machineId: string; jobs: TerminalJob[] } | null>(null);
  const terminalJobs = useMemo(
    () => (terminalQueue && terminalQueue.machineId === persistedMachineId ? terminalQueue.jobs : []),
    [terminalQueue, persistedMachineId]
  );

  useEffect(() => {
    if (!persistedMachineId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/production/terminal?machineId=${encodeURIComponent(persistedMachineId)}`);
        const json = await res.json();
        if (!cancelled && json?.success && Array.isArray(json.jobs)) {
          setTerminalQueue({ machineId: persistedMachineId, jobs: json.jobs });
        }
      } catch {
        // Keep the last known jobs; the next refresh retries.
      }
    };
    load();
    const timer = setInterval(load, TERMINAL_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [persistedMachineId]);

  const { state: liveState, job: activeJob } = useMemo(
    () => resolveLiveState(machineData.status, terminalJobs),
    [machineData.status, terminalJobs]
  );

  const handlePrint = () => {
    window.print();
  };

  const costingGaps = useMemo(() => machineCostingGaps(machineData), [machineData]);

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
      badge: terminalJobs.length ? `${terminalJobs.length} ta` : undefined,
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
        status={liveState.label}
        priority={machineData.department || "Offset"}
        actions={
          <div className="flex items-center gap-2">
            {/* Only availability is set here; running/setup/downtime come from the shift journal. */}
            <Select
              value={machineData.status === "Maintenance" ? "Maintenance" : "Idle"}
              onValueChange={(val) => handleStatusChange(val as MachineStatus)}
            >
              <SelectTrigger className="h-7 w-32 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Idle">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Ishga tayyor
                  </div>
                </SelectItem>
                <SelectItem value="Maintenance">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Ta&apos;mirda
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Direct Image File Picker Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerUpload}
              disabled={isUploadingImage}
              className="h-7 text-xs gap-1"
              title="Uskuna rasmi"
            >
              {isUploadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              )}
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
                  Math.max(0, Math.round((activeJob.goodQty / (activeJob.plannedQty || 1)) * 100))
                );
                return (
                  <SidebarSummaryCard
                    icon={liveState.icon}
                    title={activeJob.workOrderNo}
                    subtitle={activeJob.customerName}
                  >
                    <div className="space-y-1.5 text-[11px] pt-1">
                      <p className="font-medium text-foreground truncate">
                        {activeJob.productName}
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">{activeJob.opName}</span>
                        <span className={`font-semibold ${liveState.textClass}`}>
                          {liveState.label}
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
                          className={`h-full rounded-full ${liveState.barClass}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Open on the shift journal, with what the registry already loaded.
                          const item = useWorkspaceStore
                            .getState()
                            .productionQueue.find(
                              (q) => q.docNo === activeJob.workOrderNo || q.id === activeJob.workOrderNo
                            );
                          openTab({
                            id: activeJob.workOrderNo,
                            title: `${activeJob.workOrderNo}: ${activeJob.productName}`,
                            type: "work-order",
                            module: "production",
                            isUnsaved: false,
                            activeLevel3Tab: "timeline",
                            documentData: { ...(item || {}), docNo: activeJob.workOrderNo },
                          });
                        }}
                        className="w-full h-6 text-[10px] gap-1 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Buyurtma
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
          {costingGaps.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-500 mr-1">
                <TriangleAlert className="size-3.5" />
                Tannarx uchun to&apos;ldirilmagan
              </span>
              {costingGaps.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveTab(g.tab)}
                  className="h-5.5 px-2 rounded border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
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
                status: liveState.label,
                statusClass: liveState.textClass,
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
