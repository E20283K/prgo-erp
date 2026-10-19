"use client";

import React from "react";
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

interface MachineQueueBoardProps {
  searchFilter: string;
  statusFilter: string;
  machineFilter: string;
  onOpenWorkOrder: (workOrderId: string, item: ProductionQueueItem) => void;
}

const MACHINE_CONFIG: Record<
  string,
  { shortName: string; type: string; color: string }
> = {
  "Heidelberg Speedmaster XL 106-8P": {
    shortName: "Heidelberg XL 106",
    type: "Offset Press (B1)",
    color: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  },
  "Komori Lithrone G40 (4-Color)": {
    shortName: "Komori Lithrone G40",
    type: "Offset Press (B1)",
    color: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400",
  },
  "Mark Andy Performance Series P7": {
    shortName: "Mark Andy P7",
    type: "Flexo Roll Printing",
    color: "border-purple-500/40 text-purple-600 dark:text-purple-400",
  },
  "Bobst Novacut 106 E Autoplaten": {
    shortName: "Bobst Novacut 106",
    type: "Die-Cutting / Vyrubka",
    color: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  },
  "Stock Sheet-to-Sheet Kashirovka Line": {
    shortName: "Stock Kashirovka",
    type: "Mounting / Duplex",
    color: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  },
  "Polar N 115 Plus High-Speed Guillotine": {
    shortName: "Polar N 115 Guillotine",
    type: "Cutting & Trimming",
    color: "border-zinc-500/40 text-zinc-600 dark:text-zinc-400",
  },
  "Staubli LX 3202 High-Speed Jacquard Loom": {
    shortName: "Staubli Jacquard Loom",
    type: "Jacquard Weaving (Woven Labels)",
    color: "border-teal-500/40 text-teal-600 dark:text-teal-400",
  },
  "Nilpeter FA-Line Multi-Substrate": {
    shortName: "Nilpeter FA-Line",
    type: "Flexo Roll Printing",
    color: "border-purple-500/40 text-purple-600 dark:text-purple-400",
  },
};

export function MachineQueueBoard({
  searchFilter,
  statusFilter,
  machineFilter,
  onOpenWorkOrder,
}: MachineQueueBoardProps) {
  const tRoute = useTranslations("ProductionRoute");
  const tBoard = useTranslations("PlanningBoard");
  const {
    productionQueue,
    toggleReadinessCheck,
    setProductionStage,
    reorderQueueOrder,
  } = useWorkspaceStore();

  // Extract all distinct machines from queue + known configs
  const machineList = React.useMemo(() => {
    const list = new Set<string>();
    Object.keys(MACHINE_CONFIG).forEach((m) => list.add(m));
    productionQueue.forEach((q) => {
      if (q.pressMachine) list.add(q.pressMachine);
    });
    return Array.from(list);
  }, [productionQueue]);

  const displayedMachines = React.useMemo(() => {
    if (machineFilter === "ALL") return machineList;
    return machineList.filter((m) => m === machineFilter);
  }, [machineList, machineFilter]);

  // Filter items for a specific machine
  const getOrdersForMachine = (machineName: string) => {
    return productionQueue
      .filter((item) => item.pressMachine === machineName)
      .filter((item) => {
        // Status filter
        if (statusFilter !== "ALL") {
          if (statusFilter === "Running") {
            if (item.stage !== "In Production") return false;
          } else if (statusFilter === "Scheduled") {
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

  return (
    <div className="flex-1 w-full h-full overflow-y-auto p-4 space-y-6 bg-muted/20 select-none">
      {displayedMachines.map((machineName) => {
        const orders = getOrdersForMachine(machineName);
        const meta = MACHINE_CONFIG[machineName] || {
          shortName: machineName,
          type: "Workshop Machine",
          color: "border-border text-foreground",
        };

        const totalSheets = orders.reduce((sum, o) => sum + (o.plannedSheets || o.quantity), 0);
        const completedSheets = orders.reduce((sum, o) => sum + (o.completedSheets || 0), 0);

        return (
          <div
            key={machineName}
            className="bg-card border border-border rounded-lg shadow-2xs overflow-hidden"
          >
            {/* Machine Lane Header */}
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground tracking-tight">
                      {machineName}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      {meta.type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {orders.length} {orders.length === 1 ? "order queued" : "orders queued"}
                    {totalSheets > 0 && ` • Total: ${totalSheets.toLocaleString()} sht`}
                  </p>
                </div>
              </div>

              {orders.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    {completedSheets.toLocaleString()} / {totalSheets.toLocaleString()} sht done
                  </span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${totalSheets > 0 ? Math.min(100, Math.round((completedSheets / totalSheets) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Machine Queue Job Cards */}
            <div className="p-3">
              {orders.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {tBoard("noOrders")}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orders.map((item, index) => {
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
                          "p-3 rounded-md border transition-all hover:shadow-xs",
                          item.stage === "In Production"
                            ? "bg-amber-500/[0.04] border-amber-500/30"
                            : item.stage === "Ready to Print"
                            ? "bg-emerald-500/[0.04] border-emerald-500/30"
                            : item.stage === "Completed"
                            ? "bg-blue-500/[0.04] border-blue-500/20 opacity-80"
                            : "bg-card border-border/80 hover:border-border"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
                          {/* Queue position & WO link */}
                          <div className="flex items-center gap-2">
                            {/* Queue Reorder Buttons */}
                            <div className="flex items-center bg-muted/60 rounded border border-border text-[11px] font-mono">
                              <span className="px-1.5 font-bold text-foreground">
                                #{item.queueOrder}
                              </span>
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
                                  disabled={index === orders.length - 1}
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
                                    <span>Printing Inks & Colors Stations</span>
                                  </div>
                                  <div className="text-[11px] font-mono">
                                    Notation: <strong>{item.colors}</strong>
                                  </div>
                                  {item.spotColors && item.spotColors.length > 0 ? (
                                    <div className="text-[10px] text-amber-400">
                                      Spot Stations: {item.spotColors.join(", ")}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-zinc-400">
                                      Standard Process Inks
                                    </div>
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

                          {/* Stage Dropdown Selector */}
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

                        {/* Mid Row: Product & Customer */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground">
                              {item.product}
                            </span>
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
                            <div className="text-[11px] text-muted-foreground">
                              {item.customer}
                            </div>
                          </div>

                          {/* Progress in sheets / units */}
                          <div className="text-[11px] text-muted-foreground text-right shrink-0">
                            <span className="font-mono font-medium text-foreground">
                              {completed.toLocaleString()}
                            </span>
                            {" / "}
                            <span className="font-mono">{planned.toLocaleString()} {item.department === "Offset" ? "sht" : item.unit || "pcs"}</span>
                            <span className="ml-1 text-muted-foreground">({pct}%)</span>
                          </div>
                        </div>

                        {/* Bottom Row: The 4 1-Click Readiness Check Buttons */}
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

                            {/* 2. Paper / Substrate Check */}
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
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
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
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
