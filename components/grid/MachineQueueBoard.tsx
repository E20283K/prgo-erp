"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Palette,
  Layers,
  Printer,
  Scissors,
  Check,
  Circle,
  Clock,
  Sparkles,
  Play,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Cpu,
  User,
  Calendar,
  AlertCircle,
  ArrowRight,
  Plus,
  Factory,
  Search,
  Filter,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  useWorkspaceStore,
  ProductionQueueItem,
  ProductionReadinessChecks,
  ProductionQueueStage,
} from "@/store/workspaceStore";
import { MachineRecord } from "@/components/documents/machine/types";

export interface MachineQueueBoardProps {
  searchFilter: string;
  statusFilter: string;
  machineFilter: string;
  onMachineFilterChange?: (machine: string) => void;
  onOpenWorkOrder: (workOrderId: string, item: ProductionQueueItem) => void;
  onOpenMachineDetail?: (machineName: string) => void;
}

const getDepartmentIcon = (dept: string, className = "w-3.5 h-3.5") => {
  const d = dept?.toLowerCase() || "";
  if (d.includes("offset") || d.includes("ofset")) {
    return <Printer className={className} />;
  }
  if (d.includes("flexo") || d.includes("flekso")) {
    return <Palette className={className} />;
  }
  if (
    d.includes("cut") ||
    d.includes("vyrubka") ||
    d.includes("die") ||
    d.includes("qirqish") ||
    d.includes("trim") ||
    d.includes("post")
  ) {
    return <Scissors className={className} />;
  }
  if (d.includes("jacquard") || d.includes("to'qima") || d.includes("loom")) {
    return <Cpu className={className} />;
  }
  if (d.includes("kashir") || d.includes("lamin") || d.includes("mount") || d.includes("pack")) {
    return <Layers className={className} />;
  }
  return <Cpu className={className} />;
};

export function MachineQueueBoard({
  searchFilter,
  statusFilter,
  machineFilter,
  onMachineFilterChange,
  onOpenWorkOrder,
  onOpenMachineDetail,
}: MachineQueueBoardProps) {
  const tRoute = useTranslations("ProductionRoute");
  const tBoard = useTranslations("PlanningBoard");
  const {
    productionQueue,
    machines,
    loadMachines,
    loadProductionQueue,
    isMachinesLoading,
    isProductionQueueLoading,
    toggleReadinessCheck,
    setProductionStage,
    reorderQueueOrder,
  } = useWorkspaceStore();

  const [selectedMachine, setSelectedMachine] = useState<string>(machineFilter || "ALL");
  const [departmentTab, setDepartmentTab] = useState<string>("ALL");

  // Keep state in sync if parent prop changes
  useEffect(() => {
    setSelectedMachine(machineFilter || "ALL");
  }, [machineFilter]);

  // Ensure real machines and work orders are loaded from database on mount
  useEffect(() => {
    if (machines.length === 0 && loadMachines) {
      loadMachines();
    }
    if (productionQueue.length === 0 && loadProductionQueue) {
      loadProductionQueue();
    }
  }, [machines.length, loadMachines, productionQueue.length, loadProductionQueue]);

  // Combine real machines from database and any active machines from production queue
  const realMachineFleet = useMemo<MachineRecord[]>(() => {
    const map = new Map<string, MachineRecord>();
    (machines || []).forEach((m) => {
      if (m.name) map.set(m.name, m);
    });

    // If an active order in queue specifies a pressMachine not yet in machines table, create a safe fallback
    productionQueue.forEach((q) => {
      if (q.pressMachine && !map.has(q.pressMachine)) {
        map.set(q.pressMachine, {
          id: q.pressMachine,
          name: q.pressMachine,
          code: q.pressMachine.split(" ")[0] || "MAC",
          department: (q.department as any) || "Offset",
          category: "offset",
          status: "Running",
          manufacturer: "Industrial",
          country: "UZ",
          year: 2024,
          serialNo: "-",
          location: "Main Production Bay",
          overallEfficiency: 90,
          totalLifetimeCounter: 0,
          counterUnit: "sheets",
          leadOperator: q.operator || "Operator",
          assistantOperator: "-",
          shiftPattern: "Standard Shift",
          energy: {
            installedPowerKw: 50,
            activePowerKw: 35,
            standbyPowerKw: 5,
            dryerHeatingKw: 0,
            compressedAirBar: 7,
            compressedAirCfm: 20,
            chillerPowerKw: 10,
            electricityTariffUsd: 0.08,
            hourlyElectricityCostUsd: 2.8,
            monthlyHoursPlanned: 320,
            monthlyPowerCostUsd: 896,
          },
          costing: {
            investmentUsd: 150000,
            depreciationYears: 8,
            annualWorkHours: 3500,
            hourlyDepreciationUsd: 5.35,
            hourlyElectricityUsd: 2.8,
            hourlyMaintenanceReserveUsd: 3,
            operatorHourlyWageUsd: 7,
            assistantHourlyWageUsd: 4,
            factoryOverheadUsd: 5,
            totalBaseCostPerHourUsd: 27.15,
            standardHourlyRateUsd: 95,
            markupPercent: 250,
          },
          telemetry: { temperatureC: 22, vibrationMmS: 1.0, oilPressureBar: 4.5 },
          maintenanceLogs: [],
        });
      }
    });

    return Array.from(map.values());
  }, [machines, productionQueue]);

  // Dynamically collect real departments from the active machines
  const departmentTabs = useMemo(() => {
    const depts = new Set<string>();
    realMachineFleet.forEach((m) => {
      if (m.department) depts.add(m.department);
    });

    return [
      { id: "ALL", label: "Barchasi" },
      ...Array.from(depts).map((d) => ({
        id: d,
        label:
          d === "Offset"
            ? "Ofset"
            : d === "Flexo"
            ? "Flekso"
            : d === "Post-press"
            ? "Post-press"
            : d === "Packaging"
            ? "Qadoqlash"
            : d === "Jacquard"
            ? "To'qimachilik"
            : d,
      })),
    ];
  }, [realMachineFleet]);

  // Filter orders for a given machine based on search and status
  const getOrdersForMachine = (machineName: string, machineCode?: string) => {
    return productionQueue
      .filter((item) => {
        if (!item.pressMachine) return false;
        return (
          item.pressMachine === machineName ||
          (machineCode && item.pressMachine === machineCode) ||
          (machineCode && item.pressMachine.includes(`[${machineCode}]`)) ||
          item.pressMachine.toLowerCase() === machineName.toLowerCase()
        );
      })
      .filter((item) => {
        // Status filter
        if (statusFilter !== "ALL") {
          if (statusFilter === "Running") {
            if (item.stage !== "In Production") return false;
          } else if (statusFilter === "Scheduled" || statusFilter === "Ready to Print") {
            if (item.stage !== "Queue" && item.stage !== "Ready to Print") return false;
          } else if (statusFilter === "Completed") {
            if (item.stage !== "Completed") return false;
          } else if (item.stage !== statusFilter) {
            return false;
          }
        }

        // Search filter
        if (searchFilter) {
          const q = searchFilter.toLowerCase();
          const match =
            item.id.toLowerCase().includes(q) ||
            item.customer.toLowerCase().includes(q) ||
            item.product.toLowerCase().includes(q) ||
            (item.clientOrderId && item.clientOrderId.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => a.queueOrder - b.queueOrder);
  };

  // Compile rich summary metadata for all real machines
  const machineFleetData = useMemo(() => {
    return realMachineFleet.map((m) => {
      const orders = getOrdersForMachine(m.name, m.code);
      const totalSheets = orders.reduce((sum, o) => sum + (o.plannedSheets || o.quantity), 0);
      const completedSheets = orders.reduce((sum, o) => sum + (o.completedSheets || 0), 0);
      const progressPct = totalSheets > 0 ? Math.round((completedSheets / totalSheets) * 100) : 0;

      // Determine live machine status
      const hasRunning = orders.some((o) => o.stage === "In Production");
      const hasReady = orders.some((o) => o.stage === "Ready to Print");
      let liveStatus: "running" | "ready" | "queue" | "idle" = "idle";
      if (hasRunning) {
        liveStatus = "running";
      } else if (hasReady) {
        liveStatus = "ready";
      } else if (orders.length > 0) {
        liveStatus = "queue";
      } else {
        liveStatus = "idle";
      }

      return {
        id: m.id,
        name: m.name,
        code: m.code || m.id,
        shortName: m.name.length > 24 ? m.name.split("(")[0].trim() : m.name,
        department: m.department || "Offset",
        category: m.category || "machine",
        location: m.location,
        leadOperator: m.leadOperator || (orders[0]?.operator),
        speed: (m as any)?.speed || (m as any)?.practicalSpeed,
        efficiency: m.overallEfficiency,
        status: liveStatus,
        ordersCount: orders.length,
        totalSheets,
        completedSheets,
        progressPct,
        rawMachine: m,
      };
    });
  }, [realMachineFleet, productionQueue, searchFilter, statusFilter]);

  // Filter machine cards by department tab
  const filteredFleet = useMemo(() => {
    if (departmentTab === "ALL") return machineFleetData;
    return machineFleetData.filter((m) => m.department === departmentTab);
  }, [machineFleetData, departmentTab]);

  const totalAllOrders = useMemo(() => {
    return machineFleetData.reduce((sum, m) => sum + m.ordersCount, 0);
  }, [machineFleetData]);

  const activeMachinesCount = useMemo(() => {
    return machineFleetData.filter((m) => m.status === "running" || m.status === "ready").length;
  }, [machineFleetData]);

  const handleSelectMachine = (machineName: string) => {
    setSelectedMachine(machineName);
    onMachineFilterChange?.(machineName);
  };

  const getPriorityBadge = (priority: ProductionQueueItem["priority"]) => {
    if (priority === "Urgent") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 font-semibold"
        >
          Urgent
        </Badge>
      );
    }
    if (priority === "High") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold"
        >
          High
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
      >
        Normal
      </Badge>
    );
  };

  const getStageBadge = (stage: ProductionQueueStage) => {
    switch (stage) {
      case "In Production":
        return (
          <Badge className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-2 py-0.5 gap-1 shadow-none">
            <Play className="w-2.5 h-2.5 fill-current" />
            {tRoute("stageInProduction")}
          </Badge>
        );
      case "Ready to Print":
        return (
          <Badge className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 gap-1 shadow-none font-semibold">
            <Sparkles className="w-2.5 h-2.5" />
            {tRoute("stageReady")}
          </Badge>
        );
      case "Completed":
        return (
          <Badge className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] px-2 py-0.5 gap-1 shadow-none">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {tRoute("stageCompleted")}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 text-muted-foreground border-border gap-1"
          >
            <Clock className="w-2.5 h-2.5" />
            {tRoute("stageQueue")}
          </Badge>
        );
    }
  };

  // Helper to render order card
  const renderOrderCard = (item: ProductionQueueItem, index: number, machineOrdersCount: number) => {
    const readyCount =
      (item.checks.designReady ? 1 : 0) +
      (item.checks.paperReady ? 1 : 0) +
      (item.checks.platesReady ? 1 : 0) +
      (item.checks.toolingReady ? 1 : 0);
    const isAllReady = readyCount === 4;
    const planned = item.plannedSheets || item.quantity;
    const completed = item.completedSheets || 0;
    const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;

    return (
      <div
        key={item.id}
        className={cn(
          "p-3 rounded-lg border transition-all hover:shadow-xs",
          item.stage === "In Production"
            ? "bg-amber-500/[0.04] border-amber-500/30 dark:bg-amber-500/[0.06]"
            : item.stage === "Ready to Print"
            ? "bg-emerald-500/[0.04] border-emerald-500/30 dark:bg-emerald-500/[0.06]"
            : item.stage === "Completed"
            ? "bg-blue-500/[0.04] border-blue-500/20 opacity-80"
            : "bg-card border-border hover:border-border/90"
        )}
      >
        {/* Top Header: Queue #, ID link, badges, Stage */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Queue Reorder Buttons */}
            <div className="flex items-center bg-muted/60 rounded border border-border text-[11px] font-mono">
              <span className="px-1.5 font-bold text-foreground">#{item.queueOrder}</span>
              <div className="flex flex-col border-l border-border">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => reorderQueueOrder(item.id, "up")}
                  className="px-1 py-0 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                  title="Move up in queue"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === machineOrdersCount - 1}
                  onClick={() => reorderQueueOrder(item.id, "down")}
                  className="px-1 py-0 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed border-t border-border"
                  title="Move down in queue"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Work Order ID Link */}
            <button
              type="button"
              onClick={() => onOpenWorkOrder(item.id, item)}
              className="font-mono text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{item.id}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>

            {/* Priority */}
            {getPriorityBadge(item.priority)}

            {/* Printing Inks & Colors Stations Badge */}
            {item.colors && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 font-mono font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 flex items-center gap-1 cursor-default shrink-0 shadow-2xs"
                    >
                      <Palette className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                      <span>{item.colors}</span>
                      {item.spotColors && item.spotColors.length > 0 && (
                        <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                          +{item.spotColors.length} Spot
                        </span>
                      )}
                    </Badge>
                  }
                />
                <TooltipContent side="top" className="text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Palette className="w-3 h-3 text-blue-400" />
                    <span>Bosma Bo'yoqlari va Stansiyalari</span>
                  </div>
                  <div className="text-[11px] font-mono">
                    Formula: <strong>{item.colors}</strong>
                  </div>
                  {item.spotColors && item.spotColors.length > 0 ? (
                    <div className="text-[10px] text-amber-400">
                      Spot Stansiyalar: {item.spotColors.join(", ")}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400">Standart jarayon bo'yoqlari</div>
                  )}
                </TooltipContent>
              </Tooltip>
            )}

            {item.clientOrderId && (
              <span className="font-mono text-[11px] text-muted-foreground hidden md:inline">
                ({item.clientOrderId})
              </span>
            )}
          </div>

          {/* Stage Dropdown Selector & Quick Advance */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button type="button" className="cursor-pointer">
                    {getStageBadge(item.stage)}
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem
                  onClick={() => setProductionStage(item.id, "Queue")}
                  className="gap-2 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{tRoute("stageQueue")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setProductionStage(item.id, "Ready to Print")}
                  className="gap-2 cursor-pointer font-medium text-emerald-600"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{tRoute("stageReady")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setProductionStage(item.id, "In Production")}
                  className="gap-2 cursor-pointer font-medium text-amber-600"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{tRoute("stageInProduction")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setProductionStage(item.id, "Completed")}
                  className="gap-2 cursor-pointer font-medium text-blue-600"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{tRoute("stageCompleted")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Advance Prompt Button */}
            {isAllReady && item.stage === "Queue" && (
              <Button
                size="sm"
                onClick={() => setProductionStage(item.id, "Ready to Print")}
                className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shadow-none"
              >
                <Sparkles className="w-3 h-3" />
                <span>{tRoute("stageReady")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Mid Row: Product & Customer & Sheets Progress */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-foreground">{item.product}</span>
            <span className="text-muted-foreground ml-2">
              • {item.quantity.toLocaleString()} {item.unit}
            </span>
            {item.sampleRequired && (
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 text-[10px] px-1.5 py-0 font-medium inline-flex items-center gap-1 align-middle",
                  item.sampleStatus === "approved"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : item.sampleStatus === "revision_requested"
                    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                )}
              >
                {item.sampleStatus === "approved"
                  ? "✓ Namuna tasdiqlangan"
                  : `🧪 Namuna (${item.sampleQty || 5} dona)`}
              </Badge>
            )}
            <div className="text-[11px] text-muted-foreground">{item.customer}</div>
          </div>

          {/* Progress in sheets / units */}
          <div className="text-[11px] text-muted-foreground text-right shrink-0">
            <span className="font-mono font-medium text-foreground">
              {completed.toLocaleString()}
            </span>
            {" / "}
            <span className="font-mono">
              {planned.toLocaleString()} {item.department === "Offset" ? "sht" : item.unit || "pcs"}
            </span>
            <span className="ml-1 text-muted-foreground">({pct}%)</span>
          </div>
        </div>

        {/* Bottom Row: Pre-flight Readiness Checks (4 Gates) */}
        <div className="pt-2.5 mt-1 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">
              Pre-flight:
            </span>

            {/* 1. Design Check */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => toggleReadinessCheck(item.id, "designReady")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border",
                      item.checks.designReady
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Palette className="w-3 h-3" />
                    <span className="hidden md:inline">
                      {item.department === "Flexo"
                        ? tRoute("flexoDesign")
                        : item.department === "Jacquard"
                        ? tRoute("jacqDesign")
                        : tRoute("designReady")}
                    </span>
                    {item.checks.designReady && <Check className="w-2.5 h-2.5 ml-0.5" />}
                  </button>
                }
              />
              <TooltipContent side="top">
                <span className="text-xs">
                  {item.department === "Flexo"
                    ? tRoute("flexoDesign")
                    : item.department === "Jacquard"
                    ? tRoute("jacqDesign")
                    : tRoute("designReady")}{" "}
                  ({item.checks.designReady ? "Ready" : "Waiting"})
                </span>
              </TooltipContent>
            </Tooltip>

            {/* 2. Paper / Stock Check */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => toggleReadinessCheck(item.id, "paperReady")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border",
                      item.checks.paperReady
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Layers className="w-3 h-3" />
                    <span className="hidden md:inline">
                      {item.department === "Flexo"
                        ? tRoute("flexoPaper")
                        : item.department === "Jacquard"
                        ? tRoute("jacqPaper")
                        : tRoute("paperReady")}
                    </span>
                    {item.checks.paperReady && <Check className="w-2.5 h-2.5 ml-0.5" />}
                  </button>
                }
              />
              <TooltipContent side="top">
                <span className="text-xs">
                  {item.department === "Flexo"
                    ? tRoute("flexoPaper")
                    : item.department === "Jacquard"
                    ? tRoute("jacqPaper")
                    : tRoute("paperReady")}{" "}
                  ({item.checks.paperReady ? "Ready" : "Waiting"})
                </span>
              </TooltipContent>
            </Tooltip>

            {/* 3. Plates / Setup Check */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => toggleReadinessCheck(item.id, "platesReady")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border",
                      item.checks.platesReady
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {item.department === "Jacquard" ? (
                      <Cpu className="w-3 h-3" />
                    ) : (
                      <Printer className="w-3 h-3" />
                    )}
                    <span className="hidden md:inline">
                      {item.department === "Flexo"
                        ? tRoute("flexoPlates")
                        : item.department === "Jacquard"
                        ? tRoute("jacqPlates")
                        : tRoute("platesReady")}
                    </span>
                    {item.checks.platesReady && <Check className="w-2.5 h-2.5 ml-0.5" />}
                  </button>
                }
              />
              <TooltipContent side="top">
                <span className="text-xs">
                  {item.department === "Flexo"
                    ? tRoute("flexoPlates")
                    : item.department === "Jacquard"
                    ? tRoute("jacqPlates")
                    : tRoute("platesReady")}{" "}
                  ({item.checks.platesReady ? "Ready" : "Waiting"})
                </span>
              </TooltipContent>
            </Tooltip>

            {/* 4. Tooling Check */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => toggleReadinessCheck(item.id, "toolingReady")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border",
                      item.checks.toolingReady
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Scissors className="w-3 h-3" />
                    <span className="hidden md:inline">
                      {item.department === "Flexo"
                        ? tRoute("flexoTooling")
                        : item.department === "Jacquard"
                        ? tRoute("jacqTooling")
                        : tRoute("toolingReady")}
                    </span>
                    {item.checks.toolingReady && <Check className="w-2.5 h-2.5 ml-0.5" />}
                  </button>
                }
              />
              <TooltipContent side="top">
                <span className="text-xs">
                  {item.department === "Flexo"
                    ? tRoute("flexoTooling")
                    : item.department === "Jacquard"
                    ? tRoute("jacqTooling")
                    : tRoute("toolingReady")}{" "}
                  ({item.checks.toolingReady ? "Ready" : "Waiting"})
                </span>
              </TooltipContent>
            </Tooltip>

            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 font-medium ml-1",
                isAllReady
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                  : "text-muted-foreground border-border"
              )}
            >
              {readyCount}/4
            </Badge>
          </div>

          {/* Operator & Deadline info */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {item.operator && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground/70" />
                {item.operator}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground/70" />
              {item.deadline}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const activeMachineMeta = useMemo(() => {
    return machineFleetData.find((m) => m.name === selectedMachine);
  }, [machineFleetData, selectedMachine]);

  // Loading State
  if (isMachinesLoading && realMachineFleet.length === 0) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center bg-muted/20">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Real stanoklar va ishlab chiqarish buyruqlari yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-muted/15 select-none">
      {/* ── TOP SECTION: Real Machine Fleet Deck ── */}
      <div className="shrink-0 bg-background/95 border-b border-border/80 backdrop-blur-xs p-3 space-y-2">
        {/* Department Quick Filter & Overview Stats */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/60">
            {departmentTabs.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => setDepartmentTab(dept.id)}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer",
                  departmentTab === dept.id
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {dept.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Factory className="w-3.5 h-3.5 text-muted-foreground/80" />
              <span>
                Faol stanoklar: <strong className="text-foreground">{activeMachinesCount}</strong> /{" "}
                {realMachineFleet.length}
              </span>
            </span>
            <span>•</span>
            <span>
              Jami navbatda: <strong className="text-foreground">{totalAllOrders}</strong> ta ish
            </span>
          </div>
        </div>

        {/* Horizontal Scrollable Machine Cards Strip */}
        <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {/* Card 0: Barcha Stanoklar (All Fleet Overview) */}
          <button
            type="button"
            onClick={() => handleSelectMachine("ALL")}
            className={cn(
              "relative flex flex-col justify-between text-left p-2.5 rounded-lg border transition-all cursor-pointer shrink-0",
              "w-[190px] h-[92px] select-none",
              selectedMachine === "ALL"
                ? "bg-primary/[0.08] dark:bg-primary/[0.15] border-primary ring-2 ring-primary/40 shadow-xs"
                : "bg-card border-border/80 hover:bg-muted/40 hover:border-border text-foreground"
            )}
          >
            <div className="flex items-center justify-between gap-1 w-full">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "p-1 rounded",
                    selectedMachine === "ALL"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Factory className="w-3.5 h-3.5" />
                </span>
                <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                  FLEET
                </span>
              </div>
              <Badge variant="outline" className="text-[9px] px-1 py-0 font-medium">
                {activeMachinesCount} faol
              </Badge>
            </div>

            <div className="w-full">
              <div className="font-semibold text-xs text-foreground tracking-tight">
                Barcha Stanoklar
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Umumiy dispetcherlik
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground w-full pt-1 border-t border-border/40">
              <span className="font-mono font-medium text-foreground">
                {totalAllOrders} ta buyurtma
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {realMachineFleet.length} stanok
              </span>
            </div>
          </button>

          {/* Cards 1..N: Real Master Machine Cards */}
          {filteredFleet.map((m) => {
            const isSelected = selectedMachine === m.name;

            return (
              <button
                key={m.id || m.name}
                type="button"
                onClick={() => handleSelectMachine(m.name)}
                className={cn(
                  "relative flex flex-col justify-between text-left p-2.5 rounded-lg border transition-all cursor-pointer shrink-0",
                  "w-[210px] h-[92px] select-none",
                  isSelected
                    ? "bg-primary/[0.08] dark:bg-primary/[0.18] border-primary ring-2 ring-primary/50 shadow-xs"
                    : "bg-card border-border/80 hover:bg-muted/40 hover:border-border text-foreground"
                )}
              >
                {/* Top Row: Icon + Code + Live Status */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "p-1 rounded",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {getDepartmentIcon(m.department, "w-3 h-3")}
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase truncate">
                      {m.code}
                    </span>
                  </div>

                  {/* Status Indicator Badge */}
                  {m.status === "running" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ishlamoqda
                    </span>
                  ) : m.status === "ready" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Tayyor
                    </span>
                  ) : m.status === "queue" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Navbatda
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      Bo'sh
                    </span>
                  )}
                </div>

                {/* Middle: Short Name & Department */}
                <div className="w-full">
                  <div
                    className="font-semibold text-xs text-foreground truncate tracking-tight"
                    title={m.name}
                  >
                    {m.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {m.department}
                  </div>
                </div>

                {/* Bottom: Count & Progress */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground w-full pt-1 border-t border-border/40">
                  <span
                    className={cn(
                      "font-mono font-medium",
                      m.ordersCount > 0 ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {m.ordersCount} ta ish
                  </span>
                  {m.totalSheets > 0 ? (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {m.totalSheets >= 1000
                        ? `${Math.round(m.totalSheets / 1000)}k`
                        : m.totalSheets}{" "}
                      l/o
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM SECTION: Real Orders Queue ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedMachine !== "ALL" && activeMachineMeta ? (
          /* SINGLE REAL MACHINE DISPATCHER VIEW */
          <div className="space-y-3">
            {/* Active Real Machine Header Banner */}
            <div className="bg-card border border-border rounded-lg p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  {getDepartmentIcon(activeMachineMeta.department, "w-5 h-5")}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-sm text-foreground tracking-tight">
                      {activeMachineMeta.name}
                    </h2>
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                      {activeMachineMeta.code}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {activeMachineMeta.department}
                    </Badge>
                    {activeMachineMeta.status === "running" && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0 gap-1 shadow-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ishlamoqda
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    {activeMachineMeta.leadOperator && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground/70" />
                        Usta:{" "}
                        <strong className="text-foreground">{activeMachineMeta.leadOperator}</strong>
                      </span>
                    )}
                    {activeMachineMeta.location && (
                      <span className="hidden sm:inline">
                        Joylashuv: {activeMachineMeta.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress & Actions */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <div className="text-right text-xs">
                  <div className="text-[11px] text-muted-foreground">
                    Navbatda:{" "}
                    <strong className="text-foreground">
                      {getOrdersForMachine(activeMachineMeta.name, activeMachineMeta.code).length} ta buyurtma
                    </strong>
                    {activeMachineMeta.totalSheets > 0 &&
                      ` • ${activeMachineMeta.totalSheets.toLocaleString()} l/o`}
                  </div>
                  {activeMachineMeta.totalSheets > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${activeMachineMeta.progressPct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {activeMachineMeta.progressPct}%
                      </span>
                    </div>
                  )}
                </div>

                {onOpenMachineDetail && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenMachineDetail(activeMachineMeta.name)}
                    className="h-7 text-xs gap-1 border-border shadow-none cursor-pointer"
                    title="Stanok texnik pasportini ochish"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden md:inline">Stanok Pasporti</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Orders Queue List */}
            {(() => {
              const orders = getOrdersForMachine(activeMachineMeta.name, activeMachineMeta.code);

              if (orders.length === 0) {
                return (
                  <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {tBoard("noOrders")}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Hozirda ushbu stanok uchun rejalashtirilgan buyurtmalar mavjud emas. Yangi buyurtma
                      yaratish uchun yuqoridagi "+ Yaratish" tugmasini bosing.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  {orders.map((item, index) => renderOrderCard(item, index, orders.length))}
                </div>
              );
            })()}
          </div>
        ) : (
          /* ALL REAL MACHINES FLEET OVERVIEW */
          <div className="space-y-6">
            {filteredFleet.map((machineMeta) => {
              const orders = getOrdersForMachine(machineMeta.name, machineMeta.code);

              return (
                <div
                  key={machineMeta.id || machineMeta.name}
                  className="bg-card border border-border rounded-lg shadow-2xs overflow-hidden"
                >
                  {/* Machine Lane Header */}
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleSelectMachine(machineMeta.name)}
                        className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 hover:bg-primary/20 transition-colors cursor-pointer"
                        title="Fokus rejimiga o'tish"
                      >
                        {getDepartmentIcon(machineMeta.department, "w-4 h-4")}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectMachine(machineMeta.name)}
                            className="font-semibold text-xs text-foreground tracking-tight hover:text-primary transition-colors cursor-pointer text-left"
                          >
                            {machineMeta.name}
                          </button>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-muted-foreground font-mono"
                          >
                            {machineMeta.code}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {machineMeta.department}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {orders.length} {orders.length === 1 ? "buyurtma" : "ta buyurtma navbatda"}
                          {machineMeta.totalSheets > 0 &&
                            ` • Jami: ${machineMeta.totalSheets.toLocaleString()} l/o`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {orders.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[11px] text-muted-foreground">
                            {machineMeta.completedSheets.toLocaleString()} /{" "}
                            {machineMeta.totalSheets.toLocaleString()} l/o
                          </span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden border border-border">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${machineMeta.progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectMachine(machineMeta.name)}
                        className="h-6.5 text-[11px] gap-1 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <span>Fokuslash</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Machine Job Cards */}
                  <div className="p-3">
                    {orders.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        {tBoard("noOrders")}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {orders.map((item, index) => renderOrderCard(item, index, orders.length))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
