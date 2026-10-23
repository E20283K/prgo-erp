"use client";

import React from "react";
import {
  Palette,
  Layers,
  Printer,
  Scissors,
  Check,
  Cpu,
  ArrowRight,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Clock,
  Play,
  CheckCircle2,
  Info,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useWorkspaceStore,
  ProductionReadinessChecks,
  ProductionQueueStage,
  ReadinessCheckKey,
  GateAuditRecord,
} from "@/store/workspaceStore";

interface OrderReadinessRouteCardProps {
  workOrderId: string;
  fallbackData?: {
    customer?: string;
    product?: string;
    machine?: string;
    quantity?: number;
    deadline?: string;
    department?: string;
  };
  variant?: "full" | "compact" | "horizontal";
  onOpenFullRoute?: () => void;
  className?: string;
}

export function OrderReadinessRouteCard({
  workOrderId,
  fallbackData,
  variant = "full",
  onOpenFullRoute,
  className,
}: OrderReadinessRouteCardProps) {
  const t = useTranslations("ProductionRoute");
  const {
    productionQueue,
    toggleReadinessCheck,
    setProductionStage,
    openTab,
    setLevel3Tab,
    setModule,
    upsertProductionQueueItem,
  } = useWorkspaceStore();

  const normalizedKey = (workOrderId || "").trim().toLowerCase();

  const currentItem = React.useMemo(() => {
    return productionQueue.find((item) => {
      const idMatch = item.id.toLowerCase() === normalizedKey;
      const coMatch = item.clientOrderId && item.clientOrderId.toLowerCase() === normalizedKey;
      return idMatch || coMatch;
    });
  }, [productionQueue, normalizedKey]);

  // Ensure an item exists if opening an ad-hoc work order
  React.useEffect(() => {
    if (!currentItem && workOrderId) {
      upsertProductionQueueItem({
        id: workOrderId,
        customer: fallbackData?.customer || "Customer",
        product: fallbackData?.product || "Production Job",
        pressMachine: fallbackData?.machine || "Heidelberg Speedmaster XL 106-8P",
        quantity: fallbackData?.quantity || 5000,
        deadline: fallbackData?.deadline || new Date().toISOString().split("T")[0],
        department: fallbackData?.department || "Offset",
        stage: "Queue",
        checks: {
          designReady: true,
          paperReady: false,
          platesReady: false,
          toolingReady: false,
        },
      });
    }
  }, [currentItem, workOrderId, fallbackData, upsertProductionQueueItem]);

  const checks: ProductionReadinessChecks = currentItem?.checks || {
    designReady: false,
    paperReady: false,
    platesReady: false,
    toolingReady: false,
  };

  const auditMap: Record<ReadinessCheckKey, GateAuditRecord | undefined> =
    checks.audit || ({} as any);

  const currentStage: ProductionQueueStage = currentItem?.stage || "Queue";
  const machineName = currentItem?.pressMachine || fallbackData?.machine || "Heidelberg Speedmaster XL 106-8P";

  // Blocker modal dialog state
  const [blockerModalKey, setBlockerModalKey] = React.useState<ReadinessCheckKey | null>(null);
  const [blockerReason, setBlockerReason] = React.useState("");

  const readyCount =
    (checks.designReady ? 1 : 0) +
    (checks.paperReady ? 1 : 0) +
    (checks.platesReady ? 1 : 0) +
    (checks.toolingReady ? 1 : 0);

  const blockedCount =
    (auditMap.designReady?.status === "blocked" ? 1 : 0) +
    (auditMap.paperReady?.status === "blocked" ? 1 : 0) +
    (auditMap.platesReady?.status === "blocked" ? 1 : 0) +
    (auditMap.toolingReady?.status === "blocked" ? 1 : 0);

  const isAllReady = readyCount === 4;

  const handleToggle = (key: ReadinessCheckKey) => {
    const targetId = currentItem?.id || workOrderId;
    toggleReadinessCheck(targetId, key);
  };

  const handleSetReady = (key: ReadinessCheckKey) => {
    const targetId = currentItem?.id || workOrderId;
    toggleReadinessCheck(targetId, key, { forceStatus: "ready" });
  };

  const handleResetPending = (key: ReadinessCheckKey) => {
    const targetId = currentItem?.id || workOrderId;
    toggleReadinessCheck(targetId, key, { forceStatus: "pending" });
  };

  const handleOpenBlocker = (key: ReadinessCheckKey) => {
    setBlockerModalKey(key);
    setBlockerReason("");
  };

  const handleConfirmBlocker = () => {
    if (!blockerModalKey) return;
    const targetId = currentItem?.id || workOrderId;
    toggleReadinessCheck(targetId, blockerModalKey, {
      forceStatus: "blocked",
      note: blockerReason.trim() || undefined,
    });
    setBlockerModalKey(null);
    setBlockerReason("");
  };

  const handleStageChange = (stage: ProductionQueueStage) => {
    const targetId = currentItem?.id || workOrderId;
    setProductionStage(targetId, stage);
  };

  const handleOpenPlanning = () => {
    setModule("production", "planning");
    openTab({
      id: "tab-production-planning",
      title: "Planning",
      type: "registry",
      module: "production",
      isUnsaved: false,
    });
  };

  const STAGES: {
    stage: ProductionQueueStage;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
    { stage: "Queue", label: t("stageQueue"), shortLabel: t("stageShortQueue"), icon: <Clock className="w-3.5 h-3.5 shrink-0" /> },
    { stage: "Ready to Print", label: t("stageReady"), shortLabel: t("stageShortReady"), icon: <Sparkles className="w-3.5 h-3.5 shrink-0" /> },
    { stage: "In Production", label: t("stageInProduction"), shortLabel: t("stageShortInProd"), icon: <Play className="w-3.5 h-3.5 shrink-0" /> },
    { stage: "Completed", label: t("stageCompleted"), shortLabel: t("stageShortDone"), icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> },
  ];

  const effectiveDept = currentItem?.department || fallbackData?.department || "Offset";

  const CHECK_ITEMS: {
    key: ReadinessCheckKey;
    stepNumber: number;
    title: string;
    desc: string;
    covers: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "designReady",
      stepNumber: 1,
      title:
        effectiveDept === "Flexo"
          ? t("flexoDesign")
          : effectiveDept === "Jacquard"
          ? t("jacqDesign")
          : t("designReady"),
      desc:
        effectiveDept === "Flexo"
          ? t("flexoDesignDesc")
          : effectiveDept === "Jacquard"
          ? t("jacqDesignDesc")
          : t("designDesc"),
      covers:
        effectiveDept === "Flexo"
          ? t("step1FlexoCovers")
          : effectiveDept === "Jacquard"
          ? t("step1JacqCovers")
          : t("step1OffsetCovers"),
      icon: <Palette className="w-3.5 h-3.5" />,
    },
    {
      key: "paperReady",
      stepNumber: 2,
      title:
        effectiveDept === "Flexo"
          ? t("flexoPaper")
          : effectiveDept === "Jacquard"
          ? t("jacqPaper")
          : t("paperReady"),
      desc:
        effectiveDept === "Flexo"
          ? t("flexoPaperDesc")
          : effectiveDept === "Jacquard"
          ? t("jacqPaperDesc")
          : t("paperDesc"),
      covers:
        effectiveDept === "Flexo"
          ? t("step2FlexoCovers")
          : effectiveDept === "Jacquard"
          ? t("step2JacqCovers")
          : t("step2OffsetCovers"),
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      key: "platesReady",
      stepNumber: 3,
      title:
        effectiveDept === "Flexo"
          ? t("flexoPlates")
          : effectiveDept === "Jacquard"
          ? t("jacqPlates")
          : t("platesReady"),
      desc:
        effectiveDept === "Flexo"
          ? t("flexoPlatesDesc")
          : effectiveDept === "Jacquard"
          ? t("jacqPlatesDesc")
          : t("platesDesc"),
      covers:
        effectiveDept === "Flexo"
          ? t("step3FlexoCovers")
          : effectiveDept === "Jacquard"
          ? t("step3JacqCovers")
          : t("step3OffsetCovers"),
      icon: effectiveDept === "Jacquard" ? <Cpu className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />,
    },
    {
      key: "toolingReady",
      stepNumber: 4,
      title:
        effectiveDept === "Flexo"
          ? t("flexoTooling")
          : effectiveDept === "Jacquard"
          ? t("jacqTooling")
          : t("toolingReady"),
      desc:
        effectiveDept === "Flexo"
          ? t("flexoToolingDesc")
          : effectiveDept === "Jacquard"
          ? t("jacqToolingDesc")
          : t("toolingDesc"),
      covers:
        effectiveDept === "Flexo"
          ? t("step4FlexoCovers")
          : effectiveDept === "Jacquard"
          ? t("step4JacqCovers")
          : t("step4OffsetCovers"),
      icon: <Scissors className="w-3.5 h-3.5" />,
    },
  ];

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "p-2.5 bg-muted/30 border border-border rounded-md space-y-2 select-none",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground truncate">
              {t("cardTitle")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 font-medium text-muted-foreground"
            >
              {currentStage}
            </Badge>
            <Badge
              variant="outline"
              onClick={onOpenFullRoute}
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0 h-5 transition-colors gap-1 shrink-0",
                onOpenFullRoute && "cursor-pointer hover:opacity-85",
                blockedCount > 0
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                  : isAllReady
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              )}
            >
              {blockedCount > 0 ? (
                <AlertTriangle className="w-3 h-3 text-rose-500" />
              ) : isAllReady ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Clock className="w-3 h-3 text-amber-600" />
              )}
              {blockedCount > 0
                ? `${blockedCount} ${t("statusBlocked")}`
                : t("readyScore", { ready: readyCount, total: 4 })}
            </Badge>
          </div>
        </div>

        {/* 4-Segment Compact Gate Pills */}
        <div className="grid grid-cols-4 gap-1.5">
          {CHECK_ITEMS.map((item) => {
            const isReady = !!checks[item.key];
            const audit = auditMap[item.key];
            const isBlocked = audit?.status === "blocked";
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onOpenFullRoute?.()}
                      className={cn(
                        "flex flex-col gap-1 p-1.5 rounded border text-left transition-colors min-w-0",
                        onOpenFullRoute ? "cursor-pointer" : "cursor-default",
                        isBlocked
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                          : isReady
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-background/70 hover:bg-background border-border/80 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="text-[10px] font-mono font-bold leading-none">
                          G{item.stepNumber}
                        </span>
                        {isBlocked ? (
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                        ) : isReady ? (
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
                        ) : (
                          <Clock className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] font-medium truncate w-full text-foreground/90 leading-tight">
                        {item.title}
                      </span>
                      <div
                        className={cn(
                          "h-1 w-full rounded-full",
                          isBlocked
                            ? "bg-rose-500"
                            : isReady
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/25"
                        )}
                      />
                    </button>
                  }
                />
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-semibold text-xs">
                    {t("stepBadge", { num: item.stepNumber })}: {item.title}
                  </p>
                  <p className="text-[11px] opacity-90">
                    {isBlocked
                      ? t("auditBlocked", { note: audit?.note || "Issue reported" })
                      : isReady
                      ? t("auditVerified", {
                          name: audit?.verifiedBy || "Operator",
                          time: audit?.verifiedAt || "Ready",
                        })
                      : item.desc}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  const isHorizontal = variant === "horizontal";

  return (
    <div
      className={cn(
        isHorizontal
          ? "px-3 py-2.5 bg-card/60 border-b border-border space-y-2.5 select-none shrink-0"
          : "p-4 bg-card border border-border rounded-lg shadow-2xs space-y-3.5 select-none",
        className
      )}
    >
      {/* Header: Title, Department Badge, Readiness Score & (in horizontal mode) Stage Stepper */}
      <div className={cn("space-y-2", !isHorizontal && "pb-2.5 border-b border-border/80")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground truncate">
              {t("cardTitle")}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-muted-foreground shrink-0">
              {effectiveDept}
            </Badge>
            {currentItem?.sampleRequired && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 font-medium shrink-0",
                  currentItem.sampleStatus === "approved"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : currentItem.sampleStatus === "revision_requested"
                    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                )}
              >
                {currentItem.sampleStatus === "approved"
                  ? "✓ Namuna tasdiqlangan"
                  : `🧪 Namuna (${currentItem.sampleQty || 5} dona)`}
              </Badge>
            )}

            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 transition-colors gap-1 shrink-0",
                blockedCount > 0
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                  : isAllReady
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              )}
            >
              {blockedCount > 0 ? (
                <AlertTriangle className="w-3 h-3 text-rose-500" />
              ) : isAllReady ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Clock className="w-3 h-3 text-amber-600" />
              )}
              {blockedCount > 0
                ? `${blockedCount} Blocked`
                : t("readyScore", { ready: readyCount, total: 4 })}
            </Badge>
          </div>

          {isHorizontal && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/60">
                {STAGES.map((s) => {
                  const isActive = currentStage === s.stage;
                  return (
                    <Tooltip key={s.stage}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => handleStageChange(s.stage)}
                            className={cn(
                              "flex items-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-all cursor-pointer",
                              isActive
                                ? s.stage === "Completed"
                                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                                  : s.stage === "In Production"
                                  ? "bg-amber-600 text-white shadow-xs font-semibold"
                                  : s.stage === "Ready to Print"
                                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                                  : "bg-background text-foreground shadow-xs font-semibold border border-border"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                          >
                            {s.icon}
                            <span>{s.shortLabel}</span>
                          </button>
                        }
                      />
                      <TooltipContent side="top">
                        <span className="text-xs">{s.label}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPlanning}
                      className="h-7 text-xs shrink-0 gap-1.5 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      <span>{t("openPlanning")}</span>
                    </Button>
                  }
                />
                <TooltipContent side="top">
                  <span className="text-xs">{machineName}</span>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 4-Segment Progress Bar (shown in full vertical mode) */}
        {!isHorizontal && (
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            {CHECK_ITEMS.map((item) => {
              const isReady = !!checks[item.key];
              const isBlocked = auditMap[item.key]?.status === "blocked";
              return (
                <div
                  key={item.key}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    isBlocked
                      ? "bg-rose-500"
                      : isReady
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/20"
                  )}
                  title={`${item.title}: ${isBlocked ? "Blocked" : isReady ? "Ready" : "Pending"}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 4 Compact Enterprise Stage-Gate Rows / Columns */}
      <div
        className={cn(
          isHorizontal
            ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2"
            : "flex flex-col gap-1.5"
        )}
      >
        {CHECK_ITEMS.map((item) => {
          const isReady = !!checks[item.key];
          const audit = auditMap[item.key];
          const isBlocked = audit?.status === "blocked";

          return (
            <div
              key={item.key}
              className={cn(
                "group relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border transition-all text-xs",
                isBlocked
                  ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 shadow-2xs"
                  : isReady
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60"
                  : "bg-muted/20 border-border/70"
              )}
            >
              {/* Left Column: Non-clickable Step Icon + Gate Badge + Title & Subtitle */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className={cn(
                    "w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors",
                    isBlocked
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      : isReady
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground border border-border"
                  )}
                >
                  {isBlocked ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : isReady ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    item.icon
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9.5px] font-bold px-1 py-0 shrink-0 font-mono tracking-tight",
                        isBlocked
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          : isReady
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {t("stepBadge", { num: item.stepNumber })}
                    </Badge>

                    <span
                      className={cn(
                        "font-semibold text-xs leading-none truncate",
                        isBlocked
                          ? "text-rose-950 dark:text-rose-200"
                          : isReady
                          ? "text-foreground"
                          : "text-foreground/90"
                      )}
                    >
                      {item.title}
                    </span>
                  </div>

                  {/* Dynamic Subtitle: Shows Audit Stamp if verified, Blocker Note if blocked, or Default Desc */}
                  <p
                    className={cn(
                      "text-[11px] leading-tight pt-0.5 truncate",
                      isBlocked
                        ? "text-rose-600 dark:text-rose-400 font-medium"
                        : isReady
                        ? "text-emerald-700 dark:text-emerald-400 font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {isBlocked ? (
                      t("auditBlocked", { note: audit?.note || "Issue reported" })
                    ) : isReady ? (
                      t("auditVerified", {
                        name: audit?.verifiedBy || "Operator",
                        time: audit?.verifiedAt || "Ready",
                      })
                    ) : (
                      item.desc
                    )}
                  </p>
                </div>
              </div>

              {/* Right Column: Scope Info Popover + Unified Status Select Dropdown */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Scope Info Popover (i) */}
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                        title={t("scopeDetails")}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    }
                  />
                  <PopoverContent align="end" side="bottom" className="w-72 p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span>{item.title}</span>
                      </div>
                      <Badge variant="outline" className="text-[9.5px] px-1 py-0">
                        {effectiveDept}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10.5px] font-semibold text-foreground/80 block">
                        {t("scopeDetails")}:
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed pl-1.5 border-l-2 border-primary/40">
                        {item.covers}
                      </p>
                    </div>

                    {audit?.verifiedBy && (
                      <div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>{t("auditVerified", { name: audit.verifiedBy, time: audit.verifiedAt || "" })}</span>
                      </div>
                    )}

                    {(item.key === "platesReady" || item.key === "toolingReady") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setLevel3Tab(workOrderId, "prepress-tooling")}
                        className="w-full h-6 text-[10px] gap-1 cursor-pointer font-medium mt-1 text-primary border-primary/30 hover:bg-primary/10"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Prepress & Jihozlarni ochish</span>
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Intentional Status Select Dropdown (Pending / Ready / Blocked) */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          "h-6 px-2 rounded border text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer select-none",
                          isBlocked
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25"
                            : isReady
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/60"
                        )}
                      >
                        {isBlocked ? (
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                        ) : isReady ? (
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                        <span>
                          {isBlocked
                            ? t("statusBlocked")
                            : isReady
                            ? t("statusReady")
                            : t("statusPending")}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end" side="bottom" className="w-44">
                    <DropdownMenuItem
                      onClick={() => handleResetPending(item.key)}
                      className="flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{t("statusPending")}</span>
                      </span>
                      {!isReady && !isBlocked && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => handleSetReady(item.key)}
                      className="flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t("statusReady")}</span>
                      </span>
                      {isReady && !isBlocked && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => handleOpenBlocker(item.key)}
                      className="flex items-center justify-between text-xs cursor-pointer text-rose-600 dark:text-rose-400"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>{t("flagBlocker")}</span>
                      </span>
                      {isBlocked && <Check className="w-3.5 h-3.5 text-rose-500" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-Prompt Notice when all 4 checks are ready */}
      {isAllReady && currentStage === "Queue" && (
        <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{t("advancePrompt")}</span>
          </div>
          <Button
            size="sm"
            onClick={() => handleStageChange("Ready to Print")}
            className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2 shrink-0 ml-2"
          >
            {t("stageReady")}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Production Stage Stepper & Machine Jump Bar (shown in full vertical mode) */}
      {!isHorizontal && (
        <>
          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-muted-foreground">{t("currentStage")}</span>
              <span className="font-semibold text-foreground text-xs">{currentStage}</span>
            </div>

            <div className="grid grid-cols-4 gap-1 bg-muted/60 p-1 rounded-md border border-border/60">
              {STAGES.map((s) => {
                const isActive = currentStage === s.stage;
                return (
                  <Tooltip key={s.stage}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => handleStageChange(s.stage)}
                          className={cn(
                            "flex items-center justify-center gap-1 py-1.5 px-1 rounded text-xs font-medium transition-all cursor-pointer min-w-0",
                            isActive
                              ? s.stage === "Completed"
                                ? "bg-blue-600 text-white shadow-xs font-semibold"
                                : s.stage === "In Production"
                                ? "bg-amber-600 text-white shadow-xs font-semibold"
                                : s.stage === "Ready to Print"
                                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                                : "bg-background text-foreground shadow-xs font-semibold border border-border"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                          )}
                        >
                          {s.icon}
                          <span className="truncate text-[11px]">{s.shortLabel}</span>
                        </button>
                      }
                    />
                    <TooltipContent side="top">
                      <span className="text-xs">{s.label}</span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-border/60 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground block text-[10.5px] leading-tight">{t("scheduledMachine")}</span>
              <span className="font-semibold text-foreground truncate block text-xs" title={machineName}>
                {machineName}
              </span>
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPlanning}
                    className="h-7 text-xs shrink-0 gap-1.5 font-medium self-start sm:self-auto"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-primary" />
                    <span>{t("openPlanning")}</span>
                  </Button>
                }
              />
              <TooltipContent side="top">
                <span className="text-xs">Navigate to Machine Queues & Shift Planning</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}

      {/* Blocker Modal Dialog */}
      <Dialog open={!!blockerModalKey} onOpenChange={(open) => !open && setBlockerModalKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              {t("blockerDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {blockerModalKey &&
                t("blockerDialogDesc", {
                  num: CHECK_ITEMS.find((c) => c.key === blockerModalKey)?.stepNumber || 1,
                  title: CHECK_ITEMS.find((c) => c.key === blockerModalKey)?.title || "",
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Input
              value={blockerReason}
              onChange={(e) => setBlockerReason(e.target.value)}
              placeholder={t("blockerReasonPlaceholder")}
              className="text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmBlocker();
                }
              }}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockerModalKey(null)}
              className="h-8 text-xs"
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmBlocker}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {t("saveBlocker")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
