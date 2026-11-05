"use client";

import React, { useState, useMemo, useEffect } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import {
  TariffRecord,
  TariffVolumeTier,
  TariffMatrixItem,
  TARIFF_CATEGORIES,
  TARIFF_CALC_UNITS,
  computeTariffEstimate,
  createEmptyTariff,
} from "./tariff/types";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "./common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  Layers,
  Award,
  History,
  Save,
  CheckCircle2,
  Trash2,
  Plus,
  Calculator,
  Percent,
  Clock,
  Sparkles,
  Cpu,
  Building2,
  FileText,
  AlertTriangle,
  Zap,
  TrendingUp,
  Gauge,
  ShieldCheck,
  DollarSign,
  Boxes,
  ChevronRight,
} from "lucide-react";

interface TariffDetailProps {
  tab: DocumentTab;
}

const DEFAULT_DEPARTMENTS = [
  "Offset",
  "Flexo",
  "Jacquard",
  "Prepress",
  "Post-press",
  "Packaging",
];

const GRADE_METADATA = [
  { grade: "3", label: "Kichik operator", defaultMult: 1.0 },
  { grade: "4", label: "O'rta toifali usta", defaultMult: 1.15 },
  { grade: "5", label: "Yetakchi usta", defaultMult: 1.3 },
  { grade: "6", label: "Bosh usta", defaultMult: 1.5 },
];

export function TariffDetail({ tab }: TariffDetailProps) {
  const {
    saveTariffToDb,
    deleteTariffFromDb,
    setTabUnsaved,
    updateTabData,
    closeTab,
    openTab,
    addNotification,
    machines,
    loadMachines,
    departmentsList,
    loadDepartments,
    productionQueue,
    masterSpecifications,
    loadSpecificationsAsync,
    currentUser,
  } = useWorkspaceStore();

  const [tariffData, setTariffData] = useState<TariffRecord>(() => {
    if (tab.documentData && tab.documentData.code) {
      return tab.documentData as TariffRecord;
    }
    return createEmptyTariff(tab.id);
  });

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if ((!machines || machines.length === 0) && loadMachines) {
      loadMachines();
    }
    if ((!departmentsList || departmentsList.length === 0) && loadDepartments) {
      loadDepartments();
    }
    if ((!masterSpecifications || masterSpecifications.length === 0) && loadSpecificationsAsync) {
      loadSpecificationsAsync();
    }
  }, [
    machines?.length,
    departmentsList?.length,
    masterSpecifications?.length,
    loadMachines,
    loadDepartments,
    loadSpecificationsAsync,
  ]);

  const availableDepartments = useMemo(() => {
    const dynamicNames = (departmentsList || [])
      .map((d: any) => d.name)
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_DEPARTMENTS, ...dynamicNames]));
  }, [departmentsList]);

  // Live Simulator interactive state
  const [simQty, setSimQty] = useState<number>(1000);
  const [simCustomerTier, setSimCustomerTier] = useState<"standard" | "vip" | "wholesale">("standard");
  const [simIsUrgent, setSimIsUrgent] = useState<boolean>(false);
  const [simFormat, setSimFormat] = useState<string>("");
  const [simColors, setSimColors] = useState<string>("");
  const [simOperatorGrade, setSimOperatorGrade] = useState<number>(3);
  const [simIsNightShift, setSimIsNightShift] = useState<boolean>(false);
  const [simIsOvertime, setSimIsOvertime] = useState<boolean>(false);

  // Active matrix edit state (Clean initial inputs, no mock data)
  const [newMatrixFormat, setNewMatrixFormat] = useState("");
  const [newMatrixColors, setNewMatrixColors] = useState("");
  const [newMatrixWeight, setNewMatrixWeight] = useState<"light" | "standard" | "heavy" | "microflute">("standard");
  const [newMatrixRate, setNewMatrixRate] = useState("");
  const [newMatrixSetup, setNewMatrixSetup] = useState("");
  const [newMatrixSpeed, setNewMatrixSpeed] = useState("1.0");

  const matrixFormats = useMemo(() => {
    return Array.from(new Set((tariffData.pricingMatrix || []).map((m) => m.format).filter(Boolean)));
  }, [tariffData.pricingMatrix]);

  const matrixColors = useMemo(() => {
    return Array.from(new Set((tariffData.pricingMatrix || []).map((m) => m.colors).filter(Boolean)));
  }, [tariffData.pricingMatrix]);

  // Linked items
  const linkedOrders = useMemo(() => {
    return (productionQueue || []).filter((wo: any) => {
      const ops = wo.operations || wo.routeSteps || [];
      return ops.some((op: any) => op.tariffId === tariffData.id || op.tariffCode === tariffData.code);
    });
  }, [productionQueue, tariffData.id, tariffData.code]);

  const linkedSpecs = useMemo(() => {
    return (masterSpecifications || []).filter((spec: any) => {
      const ops = spec.operations || [];
      return ops.some((op: any) => op.tariffId === tariffData.id || op.tariffCode === tariffData.code);
    });
  }, [masterSpecifications, tariffData.id, tariffData.code]);

  const actorName = currentUser?.fullName || currentUser?.name || currentUser?.username || "Texnolog";

  const handleUpdate = (patch: Partial<TariffRecord>) => {
    setTariffData((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      const displayTitle = next.code ? `${next.code}: ${next.operationName || "Tarif"}` : next.operationName;
      updateTabData(tab.id, next, displayTitle);
      return next;
    });
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    if (!tariffData.operationName?.trim()) {
      addNotification?.({
        title: "Operatsiya nomi kiritilmagan",
        description: "Me'yoriy operatsiya nomini to'ldiring.",
        severity: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const updatedLifecycle = {
        version: tariffData.lifecycle?.version || "v1.0",
        effectiveFrom: tariffData.lifecycle?.effectiveFrom || now.slice(0, 10),
        effectiveTo: tariffData.lifecycle?.effectiveTo || null,
        approvedBy: tariffData.lifecycle?.approvedBy || null,
        approvedAt: tariffData.lifecycle?.approvedAt || null,
        approvalStatus: tariffData.lifecycle?.approvalStatus || ("Draft" as const),
        auditLog: [
          ...(tariffData.lifecycle?.auditLog || []),
          {
            date: now,
            user: actorName,
            action: "SAQLANDI",
            details: `${tariffData.operationName} (${tariffData.lifecycle?.version || "v1.0"}) bazaga saqlandi.`,
          },
        ],
      };

      const payloadToSave: TariffRecord = {
        ...tariffData,
        lifecycle: updatedLifecycle,
      };

      const result = await saveTariffToDb(payloadToSave);
      if (result) {
        setTariffData(result);
        updateTabData(tab.id, result, `${result.code}: ${result.operationName}`);
        setTabUnsaved(tab.id, false);
        setIsSaved(true);
        addNotification?.({
          title: "Tarif saqlandi",
          description: `${result.code} — ${result.operationName}`,
          severity: "success",
        });
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err) {
      console.error("Tariff save error:", err);
      addNotification?.({
        title: "Xatolik",
        description: "Tarifni saqlashda xatolik yuz berdi.",
        severity: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Haqiqatan ham "${tariffData.code} — ${tariffData.operationName}" tarifini o'chirmoqchimisiz?`)) {
      return;
    }
    const ok = await deleteTariffFromDb(tariffData.id);
    if (ok) {
      addNotification?.({
        title: "Tarif o'chirildi",
        description: `${tariffData.code} o'chirildi.`,
        severity: "info",
      });
      closeTab(tab.id);
    }
  };

  // Matrix handlers
  const handleAddMatrixRow = () => {
    if (!newMatrixFormat.trim()) {
      addNotification?.({
        title: "Format kiritilmagan",
        description: "Matritsa uchun formatni kiriting.",
        severity: "warning",
      });
      return;
    }
    const newRow: TariffMatrixItem = {
      id: `m-${Date.now()}`,
      format: newMatrixFormat.trim(),
      colors: newMatrixColors.trim() || "-",
      weightBand: newMatrixWeight,
      rateUsd: parseFloat(newMatrixRate) || tariffData.rateUsd || 0,
      setupFeeUsd: parseFloat(newMatrixSetup) || tariffData.setupFeeUsd || 0,
      speedFactor: parseFloat(newMatrixSpeed) || 1.0,
      note: "",
    };
    handleUpdate({ pricingMatrix: [...(tariffData.pricingMatrix || []), newRow] });
    setNewMatrixFormat("");
    setNewMatrixColors("");
    setNewMatrixRate("");
    setNewMatrixSetup("");
    setNewMatrixSpeed("1.0");
  };

  const handleDeleteMatrixRow = (rowId: string) => {
    const list = (tariffData.pricingMatrix || []).filter((r) => r.id !== rowId);
    handleUpdate({ pricingMatrix: list });
  };

  const handleUpdateMatrixRow = (rowId: string, patch: Partial<TariffMatrixItem>) => {
    const list = (tariffData.pricingMatrix || []).map((r) => (r.id === rowId ? { ...r, ...patch } : r));
    handleUpdate({ pricingMatrix: list });
  };

  // Volume tier handlers
  const handleAddTier = () => {
    const tiers = [...(tariffData.volumeTiers || [])];
    const lastTier = tiers[tiers.length - 1];
    const nextMin = lastTier ? (lastTier.maxQty || 10000) + 1 : 1;
    const baseRate = lastTier ? lastTier.rateUsd : tariffData.rateUsd || 0;
    const newTier: TariffVolumeTier = {
      id: `tier-${Date.now()}`,
      minQty: nextMin,
      maxQty: nextMin + 9999,
      rateUsd: baseRate,
      setupFeeUsd: lastTier ? lastTier.setupFeeUsd : tariffData.setupFeeUsd || 0,
      discountPct: 0,
      note: "",
    };
    handleUpdate({ volumeTiers: [...tiers, newTier] });
  };

  const handleUpdateTier = (idx: number, updated: Partial<TariffVolumeTier>) => {
    const tiers = [...(tariffData.volumeTiers || [])];
    if (!tiers[idx]) return;
    tiers[idx] = { ...tiers[idx], ...updated };
    handleUpdate({ volumeTiers: tiers });
  };

  const handleDeleteTier = (idx: number) => {
    const tiers = [...(tariffData.volumeTiers || [])];
    tiers.splice(idx, 1);
    handleUpdate({ volumeTiers: tiers });
  };

  // Operator Grade multiplier handler
  const handleUpdateGradeMultiplier = (grade: string, mult: number) => {
    const currentMultipliers = tariffData.operatorGrid?.gradeMultipliers || {
      "3": 1.0,
      "4": 1.15,
      "5": 1.3,
      "6": 1.5,
    };
    handleUpdate({
      operatorGrid: {
        baseGrade: tariffData.operatorGrid?.baseGrade ?? 3,
        nightShiftSurchargePct: tariffData.operatorGrid?.nightShiftSurchargePct ?? 0,
        overtimeMultiplier: tariffData.operatorGrid?.overtimeMultiplier ?? 1.0,
        helperSharePct: tariffData.operatorGrid?.helperSharePct ?? 0,
        gradeMultipliers: {
          ...currentMultipliers,
          [grade]: mult,
        },
      },
    });
  };

  // Approve revision
  const handleApproveRevision = () => {
    const now = new Date().toISOString();
    const updatedLifecycle = {
      version: tariffData.lifecycle?.version || "v1.0",
      effectiveFrom: tariffData.lifecycle?.effectiveFrom || now.slice(0, 10),
      effectiveTo: tariffData.lifecycle?.effectiveTo || null,
      approvalStatus: "Approved" as const,
      approvedAt: now,
      approvedBy: actorName,
      auditLog: [
        ...(tariffData.lifecycle?.auditLog || []),
        {
          date: now,
          user: actorName,
          action: "TASDIQLANDI",
          details: `Tarif ${tariffData.lifecycle?.version || "v1.0"} tasdiqlandi.`,
        },
      ],
    };
    handleUpdate({ lifecycle: updatedLifecycle, status: "Active" });
    addNotification?.({
      title: "Tarif tasdiqlandi",
      description: `${tariffData.code} faol holatga o'tkazildi.`,
      severity: "success",
    });
  };

  // Live simulation calculation
  const simResult = useMemo(() => {
    return computeTariffEstimate(tariffData, simQty, {
      customerTier: simCustomerTier,
      isUrgent: simIsUrgent,
      matrixFormat: simFormat || undefined,
      matrixColors: simColors || undefined,
      operatorGrade: simOperatorGrade,
      isNightShift: simIsNightShift,
      isOvertime: simIsOvertime,
    });
  }, [
    tariffData,
    simQty,
    simCustomerTier,
    simIsUrgent,
    simFormat,
    simColors,
    simOperatorGrade,
    simIsNightShift,
    simIsOvertime,
  ]);

  const navItems: DocumentNavItem[] = [
    {
      id: "overview",
      label: "Pasport va me'yorlar",
      icon: Coins,
      badge: tariffData.rateUsd ? `$${tariffData.rateUsd}` : undefined,
    },
    {
      id: "matrix",
      label: "Narx matritsasi",
      icon: Layers,
      badge: tariffData.pricingMatrix?.length ? `${tariffData.pricingMatrix.length}` : undefined,
    },
    {
      id: "costing",
      label: "Tannarx",
      icon: Calculator,
      badge: tariffData.costBreakdown?.depreciationHourlyUsd
        ? `$${tariffData.costBreakdown.depreciationHourlyUsd}/s`
        : undefined,
    },
    {
      id: "labor",
      label: "Mehnat setkasi",
      icon: Award,
      badge: tariffData.pieceworkRateUsd ? `$${tariffData.pieceworkRateUsd}` : undefined,
    },
    {
      id: "simulator",
      label: "Simulyator",
      icon: Sparkles,
    },
    {
      id: "lifecycle",
      label: "Audit va muddat",
      icon: History,
      badge: tariffData.lifecycle?.version || "v1.0",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background select-none overflow-hidden text-xs">
      {/* Document Header */}
      <DocumentHeader
        icon={Coins}
        title={tariffData.operationName || "Yangi me'yoriy tarif"}
        docNo={tariffData.code || "TRF-NEW"}
        status={tariffData.status}
        actions={
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="h-6.5 font-mono text-[11px] px-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900"
            >
              {tariffData.lifecycle?.version || "v1.0"}
            </Badge>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-6.5 px-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saqlanmoqda..." : isSaved ? "Saqlandi" : "Saqlash"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="h-6.5 px-2 text-[11px] font-medium text-destructive hover:bg-destructive/10 border-destructive/30 rounded cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>O&apos;chirish</span>
            </Button>
          </div>
        }
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              icon={Coins}
              title={tariffData.code || "TRF"}
              subtitle={tariffData.category || "Me'yoriy tarif"}
            >
              <InfoRow label="Bazaviy stavka">
                <span className="font-mono font-medium">${tariffData.rateUsd ?? 0} / {tariffData.unit}</span>
              </InfoRow>
              <InfoRow label="Pripravka">
                <span className="font-mono font-medium">${tariffData.setupFeeUsd ?? 0}</span>
              </InfoRow>
              <InfoRow label="Sozlash vaqti">
                <span className="font-mono text-foreground">{tariffData.techNorms?.makeReadyMinutes ?? 0} daq.</span>
              </InfoRow>
              <InfoRow label="Pripravka chiqindisi">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {tariffData.techNorms?.makeReadyWasteSheets ?? 0} list
                </span>
              </InfoRow>
              <InfoRow label="Sdelka">
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  ${tariffData.pieceworkRateUsd ?? 0}
                </span>
              </InfoRow>
              <InfoRow label="Rejaviy marja">
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  {tariffData.costBreakdown?.targetMarginPercent ?? 0}%
                </span>
              </InfoRow>
              <InfoRow label="Dastgoh / Sex">
                <span className="truncate">{tariffData.machineOrDept || tariffData.department || "Universal"}</span>
              </InfoRow>
            </SidebarSummaryCard>
          }
          sectionsLabel="BO'LIMLAR"
          items={navItems}
          activeId={activeTab}
          onSelect={setActiveTab}
        />

        {/* Right Tab Content */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-card/40 p-4">
          {/* TAB 1: OVERVIEW & TECH NORMS */}
          {activeTab === "overview" && (
            <div className="max-w-4xl space-y-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Operatsiya pasporti</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <Select
                      value={tariffData.status}
                      onValueChange={(val: any) => {
                        if (val) handleUpdate({ status: val });
                      }}
                    >
                      <SelectTrigger className="h-6 text-[11px] w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active" className="text-xs">Faol</SelectItem>
                        <SelectItem value="Review" className="text-xs">Ko&apos;rib chiqishda</SelectItem>
                        <SelectItem value="Archived" className="text-xs">Arxivlangan</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {tariffData.code}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Operatsiya kodi</Label>
                    <Input
                      value={tariffData.code}
                      onChange={(e) => handleUpdate({ code: e.target.value })}
                      placeholder="TRF-001"
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Operatsiya nomi *</Label>
                    <Input
                      value={tariffData.operationName}
                      onChange={(e) => handleUpdate({ operationName: e.target.value })}
                      placeholder="Operatsiya nomi"
                      className="h-7 text-xs font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Jarayon guruhi</Label>
                    <Select
                      value={tariffData.category}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ category: val });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue placeholder="Guruhni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARIFF_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Sex / Bo&apos;lim</Label>
                    <Select
                      value={tariffData.department}
                      onValueChange={(val) => {
                        if (val) handleUpdate({ department: val });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue placeholder="Bo'limni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept} className="text-xs">
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Biriktirilgan dastgoh</Label>
                    <Select
                      value={tariffData.machineOrDept || "none"}
                      onValueChange={(val) => {
                        if (val !== null) handleUpdate({ machineOrDept: val === "none" ? "" : val });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue placeholder="Dastgohni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">Universal</SelectItem>
                        {(machines || []).map((m: any) => (
                          <SelectItem key={m.id || m.code} value={m.name || m.code} className="text-xs">
                            {m.name} ({m.code || m.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">O&apos;lchov birligi</Label>
                    <Select
                      value={tariffData.unit}
                      onValueChange={(val) => {
                        if (val) {
                          const matched = TARIFF_CALC_UNITS.find((u) => u.value === val);
                          handleUpdate({
                            unit: val,
                            unitDivisor: matched ? matched.divisor : 1000,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue placeholder="Birlikni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARIFF_CALC_UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value} className="text-xs">
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Bazaviy stavka ($)</Label>
                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={2}
                      value={tariffData.rateUsd}
                      onValueChange={(values) => handleUpdate({ rateUsd: values.floatValue ?? 0 })}
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Pripravka ($)</Label>
                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={2}
                      value={tariffData.setupFeeUsd}
                      onValueChange={(values) => handleUpdate({ setupFeeUsd: values.floatValue ?? 0 })}
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Minimal to&apos;lov ($)</Label>
                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={2}
                      value={tariffData.minChargeUsd || 0}
                      onValueChange={(values) => handleUpdate({ minChargeUsd: values.floatValue ?? 0 })}
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">QQS stavkasi (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={tariffData.vatRate ?? 12}
                      onChange={(e) => handleUpdate({ vatRate: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                </div>

                {/* Pricing Rules (Discounts & Urgent Surcharge) */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">VIP mijoz chegirmasi (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.pricingRules?.vipDiscountPct ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          pricingRules: {
                            vipDiscountPct: parseFloat(e.target.value) || 0,
                            wholesaleDiscountPct: tariffData.pricingRules?.wholesaleDiscountPct ?? 0,
                            urgentSurchargePct: tariffData.pricingRules?.urgentSurchargePct ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Ulgurji chegirma (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.pricingRules?.wholesaleDiscountPct ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          pricingRules: {
                            vipDiscountPct: tariffData.pricingRules?.vipDiscountPct ?? 0,
                            wholesaleDiscountPct: parseFloat(e.target.value) || 0,
                            urgentSurchargePct: tariffData.pricingRules?.urgentSurchargePct ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Shoshilinch ustamasi (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.pricingRules?.urgentSurchargePct ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          pricingRules: {
                            vipDiscountPct: tariffData.pricingRules?.vipDiscountPct ?? 0,
                            wholesaleDiscountPct: tariffData.pricingRules?.wholesaleDiscountPct ?? 0,
                            urgentSurchargePct: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: TECH NORMS & TECHNICAL SCRAP */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                    <Gauge className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Texnologik me&apos;yorlar</span>
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>Pripravka vaqti (daq.)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.techNorms?.makeReadyMinutes ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            makeReadyMinutes: parseInt(e.target.value, 10) || 0,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 0,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 0,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 0,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span>Pripravka chiqindisi (list)</span>
                    </Label>
                    <Input
                      type="number"
                      step="5"
                      value={tariffData.techNorms?.makeReadyWasteSheets ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            makeReadyWasteSheets: parseInt(e.target.value, 10) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 0,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 0,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 0,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Percent className="w-3 h-3 text-muted-foreground" />
                      <span>Tiraj chiqindisi (%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tariffData.techNorms?.runningWastePercent ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            runningWastePercent: parseFloat(e.target.value) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 0,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 0,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 0,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Pasport tezligi (soatiga)</Label>
                    <Input
                      type="number"
                      step="500"
                      value={tariffData.techNorms?.ratedSpeedPerHour ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            ratedSpeedPerHour: parseInt(e.target.value, 10) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 0,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 0,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 0,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground font-semibold">
                      Me&apos;yoriy tezlik (soatiga)
                    </Label>
                    <Input
                      type="number"
                      step="500"
                      value={tariffData.techNorms?.effectiveSpeedPerHour ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            effectiveSpeedPerHour: parseInt(e.target.value, 10) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 0,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 0,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 0,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Smena normasi (8 soat)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={tariffData.normOutputPerShift ?? 0}
                      onChange={(e) => handleUpdate({ normOutputPerShift: parseInt(e.target.value, 10) || 0 })}
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Texnologik izoh</Label>
                <Textarea
                  value={tariffData.notes || ""}
                  onChange={(e) => handleUpdate({ notes: e.target.value })}
                  placeholder="Dastgoh va jarayon bo'yicha texnik eslatmalar..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: MULTI-PARAMETRIC PRICING MATRIX */}
          {activeTab === "matrix" && (
            <div className="max-w-5xl space-y-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Narx matritsasi</span>
                  </h3>
                  <Button
                    size="sm"
                    onClick={handleAddMatrixRow}
                    className="h-6.5 px-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Qo&apos;shish</span>
                  </Button>
                </div>

                {/* Inline New Matrix Row Form */}
                <div className="p-2.5 rounded-lg border border-dashed border-border/80 bg-muted/20 grid grid-cols-7 gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Format</Label>
                    <Input
                      value={newMatrixFormat}
                      onChange={(e) => setNewMatrixFormat(e.target.value)}
                      className="h-7 text-[11px] font-mono mt-0.5"
                      placeholder="Format (masalan, B1)"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Rangdorlik</Label>
                    <Input
                      value={newMatrixColors}
                      onChange={(e) => setNewMatrixColors(e.target.value)}
                      className="h-7 text-[11px] font-mono mt-0.5"
                      placeholder="Rang (masalan, 4+0)"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Grammaj</Label>
                    <Select
                      value={newMatrixWeight}
                      onValueChange={(val: any) => setNewMatrixWeight(val)}
                    >
                      <SelectTrigger className="h-7 text-[11px] mt-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light" className="text-xs">&lt;120g</SelectItem>
                        <SelectItem value="standard" className="text-xs">120-300g</SelectItem>
                        <SelectItem value="heavy" className="text-xs">&gt;300g</SelectItem>
                        <SelectItem value="microflute" className="text-xs">Mikrogofr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Stavka ($)</Label>
                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={2}
                      value={newMatrixRate}
                      onValueChange={(values) => setNewMatrixRate(values.value)}
                      className="h-7 text-[11px] font-mono mt-0.5"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Pripravka ($)</Label>
                    <MoneyInput
                      thousandSeparator=" "
                      decimalScale={2}
                      value={newMatrixSetup}
                      onValueChange={(values) => setNewMatrixSetup(values.value)}
                      className="h-7 text-[11px] font-mono mt-0.5"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Tezlik koef.</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={newMatrixSpeed}
                      onChange={(e) => setNewMatrixSpeed(e.target.value)}
                      className="h-7 text-[11px] font-mono mt-0.5"
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <Button
                      size="sm"
                      onClick={handleAddMatrixRow}
                      variant="outline"
                      className="h-7 w-full text-xs font-medium cursor-pointer"
                    >
                      Qo&apos;shish
                    </Button>
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-muted-foreground font-medium h-7 text-[11px]">
                        <th className="px-2.5 py-1 font-medium">Format</th>
                        <th className="px-2.5 py-1 font-medium">Ranglar</th>
                        <th className="px-2.5 py-1 font-medium">Grammaj</th>
                        <th className="px-2.5 py-1 font-medium text-right">Stavka ($)</th>
                        <th className="px-2.5 py-1 font-medium text-right">Pripravka ($)</th>
                        <th className="px-2.5 py-1 font-medium text-right">Tezlik koef.</th>
                        <th className="px-2.5 py-1 font-medium text-right w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {(tariffData.pricingMatrix || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-5 text-center text-muted-foreground font-sans text-xs">
                            Matritsa satrlari kiritilmagan
                          </td>
                        </tr>
                      ) : (
                        (tariffData.pricingMatrix || []).map((row) => (
                          <tr key={row.id} className="hover:bg-muted/30 transition-colors h-8">
                            <td className="px-2 py-1">
                              <Input
                                value={row.format}
                                onChange={(e) => handleUpdateMatrixRow(row.id, { format: e.target.value })}
                                className="h-6.5 text-[11px] font-mono"
                              />
                            </td>
                            <td className="px-2 py-1 w-28">
                              <Input
                                value={row.colors}
                                onChange={(e) => handleUpdateMatrixRow(row.id, { colors: e.target.value })}
                                className="h-6.5 text-[11px] font-mono"
                              />
                            </td>
                            <td className="px-2 py-1 w-32 font-sans">
                              <Select
                                value={row.weightBand}
                                onValueChange={(val: any) => handleUpdateMatrixRow(row.id, { weightBand: val })}
                              >
                                <SelectTrigger className="h-6.5 text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="light" className="text-xs">&lt;120g</SelectItem>
                                  <SelectItem value="standard" className="text-xs">120-300g</SelectItem>
                                  <SelectItem value="heavy" className="text-xs">&gt;300g</SelectItem>
                                  <SelectItem value="microflute" className="text-xs">Mikrogofr</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1 w-28">
                              <MoneyInput
                                thousandSeparator=" "
                                decimalScale={2}
                                value={row.rateUsd}
                                onValueChange={(values) =>
                                  handleUpdateMatrixRow(row.id, { rateUsd: values.floatValue ?? 0 })
                                }
                                className="h-6.5 text-[11px] font-mono font-bold text-right"
                              />
                            </td>
                            <td className="px-2 py-1 w-28">
                              <MoneyInput
                                thousandSeparator=" "
                                decimalScale={2}
                                value={row.setupFeeUsd}
                                onValueChange={(values) =>
                                  handleUpdateMatrixRow(row.id, { setupFeeUsd: values.floatValue ?? 0 })
                                }
                                className="h-6.5 text-[11px] font-mono text-right"
                              />
                            </td>
                            <td className="px-2 py-1 w-24">
                              <Input
                                type="number"
                                step="0.05"
                                value={row.speedFactor}
                                onChange={(e) =>
                                  handleUpdateMatrixRow(row.id, { speedFactor: parseFloat(e.target.value) || 1.0 })
                                }
                                className="h-6.5 text-[11px] font-mono text-right"
                              />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteMatrixRow(row.id)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Volume Tiers */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tiraj pog&apos;onalari</span>
                  </h3>
                  <Button
                    size="sm"
                    onClick={handleAddTier}
                    variant="outline"
                    className="h-6.5 px-2 text-xs font-medium rounded cursor-pointer gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pog&apos;ona qo&apos;shish</span>
                  </Button>
                </div>

                {(tariffData.volumeTiers || []).length === 0 ? (
                  <div className="py-5 text-center text-muted-foreground text-xs border border-dashed border-border rounded-lg">
                    Tiraj pog&apos;onalari kiritilmagan
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(tariffData.volumeTiers || []).map((tier, idx) => (
                      <div
                        key={tier.id || idx}
                        className="p-2.5 rounded-lg border border-border/80 bg-muted/20 grid grid-cols-12 gap-2 items-end text-xs"
                      >
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Min. miqdor</Label>
                          <Input
                            type="number"
                            value={tier.minQty}
                            onChange={(e) =>
                              handleUpdateTier(idx, { minQty: Math.max(1, parseInt(e.target.value, 10) || 1) })
                            }
                            className="h-6.5 text-[11px] font-mono mt-0.5"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Maks. miqdor</Label>
                          <Input
                            type="number"
                            value={tier.maxQty ?? ""}
                            placeholder="Cheksiz"
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              handleUpdateTier(idx, {
                                maxQty: raw === "" ? null : Math.max(1, parseInt(raw, 10) || 1),
                              });
                            }}
                            className="h-6.5 text-[11px] font-mono mt-0.5"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Stavka ($)</Label>
                          <MoneyInput
                            thousandSeparator=" "
                            decimalScale={2}
                            value={tier.rateUsd}
                            onValueChange={(values) => handleUpdateTier(idx, { rateUsd: values.floatValue ?? 0 })}
                            className="h-6.5 text-[11px] font-mono font-bold mt-0.5"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Pripravka ($)</Label>
                          <MoneyInput
                            thousandSeparator=" "
                            decimalScale={2}
                            value={tier.setupFeeUsd ?? tariffData.setupFeeUsd ?? 0}
                            onValueChange={(values) => handleUpdateTier(idx, { setupFeeUsd: values.floatValue ?? 0 })}
                            className="h-6.5 text-[11px] font-mono mt-0.5"
                          />
                        </div>

                        <div className="col-span-3">
                          <Label className="text-[10px] text-muted-foreground">Izoh</Label>
                          <Input
                            value={tier.note || ""}
                            onChange={(e) => handleUpdateTier(idx, { note: e.target.value })}
                            className="h-6.5 text-[11px] mt-0.5"
                          />
                        </div>

                        <div className="col-span-1 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTier(idx)}
                            className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COSTING & COST BREAKDOWN */}
          {activeTab === "costing" && (
            <div className="max-w-4xl space-y-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Normo-soat va tannarx</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-emerald-600 dark:text-emerald-400">
                    Marja: {tariffData.costBreakdown?.targetMarginPercent ?? 0}%
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-muted-foreground" />
                      <span>Amortizatsiya ($/soat)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={tariffData.costBreakdown?.depreciationHourlyUsd ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            depreciationHourlyUsd: parseFloat(e.target.value) || 0,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 0,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 0,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Elektr sarfi (kW/soat)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={tariffData.costBreakdown?.powerKwPerHour ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            powerKwPerHour: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 0,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 0,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span>1 kW narxi ($)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tariffData.costBreakdown?.powerCostPerKwh ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            powerCostPerKwh: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 0,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 0,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 0,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Boxes className="w-3 h-3 text-muted-foreground" />
                      <span>Yordamchi kimyo ($/birlik)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            auxiliaryMaterialsPerUnit: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 0,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 0,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 0,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <span>Sex ustamasi (%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.costBreakdown?.overheadPercent ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            overheadPercent: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 0,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 0,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                      <span>Rejaviy marja (%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.costBreakdown?.targetMarginPercent ?? 0}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            targetMarginPercent: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 0,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 0,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 0,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* AUTOMATED COST SHEET PREVIEW */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h4 className="font-semibold text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>Kalkulyatsiya kartasi</span>
                  </h4>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Normo-soat:{" "}
                    <strong className="text-foreground">
                      $
                      {(
                        (tariffData.costBreakdown?.depreciationHourlyUsd ?? 0) +
                        (tariffData.costBreakdown?.powerKwPerHour ?? 0) *
                          (tariffData.costBreakdown?.powerCostPerKwh ?? 0)
                      ).toFixed(2)}
                      /soat
                    </strong>
                  </span>
                </div>

                {(() => {
                  const effectiveSpeed = tariffData.techNorms?.effectiveSpeedPerHour ?? 0;
                  const divisor = tariffData.unitDivisor > 0 ? tariffData.unitDivisor : 1000;
                  const hoursPerUnit = effectiveSpeed > 0 ? divisor / effectiveSpeed : 0;
                  const depr1k = hoursPerUnit * (tariffData.costBreakdown?.depreciationHourlyUsd ?? 0);
                  const power1k =
                    hoursPerUnit *
                    (tariffData.costBreakdown?.powerKwPerHour ?? 0) *
                    (tariffData.costBreakdown?.powerCostPerKwh ?? 0);
                  const aux1k = tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 0;
                  const labor1k = (tariffData.pieceworkRateUsd ?? 0) + (tariffData.helperPieceworkRateUsd ?? 0);
                  const direct1k = depr1k + power1k + aux1k + labor1k;
                  const overhead1k = direct1k * ((tariffData.costBreakdown?.overheadPercent ?? 0) / 100);
                  const totalCost1k = direct1k + overhead1k;
                  const targetMarginPct = tariffData.costBreakdown?.targetMarginPercent ?? 0;
                  const targetPrice1k = totalCost1k * (1 + targetMarginPct / 100);
                  const actualRate = tariffData.rateUsd ?? 0;
                  const safeActualRate = actualRate > 0 ? actualRate : targetPrice1k > 0 ? targetPrice1k : 1;

                  return (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 border-r border-border/60 pr-4">
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>1. Stanok amortizatsiyasi ({hoursPerUnit.toFixed(3)}s):</span>
                            <span className="font-mono text-foreground">${depr1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>2. Elektr energiyasi:</span>
                            <span className="font-mono text-foreground">${power1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>3. Yordamchi kimyo:</span>
                            <span className="font-mono text-foreground">${aux1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>4. Operator va yordamchi sdelkasi:</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              ${labor1k.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5 font-semibold text-foreground pt-1">
                            <span>Bevosita xarajatlar:</span>
                            <span className="font-mono">${direct1k.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-2">
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>5. Sex ustamasi ({tariffData.costBreakdown?.overheadPercent ?? 0}%):</span>
                            <span className="font-mono text-foreground">${overhead1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 font-semibold text-foreground">
                            <span>Jami tannarx:</span>
                            <span className="font-mono text-foreground font-bold">${totalCost1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>Tavsiya etilgan narx (+{targetMarginPct}%):</span>
                            <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                              ${targetPrice1k.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5 font-bold text-xs pt-1">
                            <span>Amaldagi stavka:</span>
                            <span
                              className={`font-mono ${
                                actualRate >= targetPrice1k
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              ${actualRate.toFixed(2)} / {tariffData.unit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Margin Bar */}
                      <div className="pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Rentabellik tuzilishi:</span>
                          <span className="font-mono">
                            Tannarx: ${totalCost1k.toFixed(2)} • Foyda: $
                            {Math.max(0, actualRate - totalCost1k).toFixed(2)} (
                            {actualRate > 0 ? (((actualRate - totalCost1k) / actualRate) * 100).toFixed(1) : "0.0"}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
                          <div
                            className="bg-blue-600"
                            style={{ width: `${Math.min(100, safeActualRate > 0 ? (direct1k / safeActualRate) * 100 : 0)}%` }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{ width: `${Math.min(100, safeActualRate > 0 ? (overhead1k / safeActualRate) * 100 : 0)}%` }}
                          />
                          <div className="bg-emerald-500 flex-1" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 4: LABOR & OPERATOR GRID */}
          {activeTab === "labor" && (
            <div className="max-w-4xl space-y-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Mehnat tarif setkasi</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 border-r border-border/60 pr-4">
                    <h4 className="font-semibold text-xs text-foreground">Sdelka stavkalari</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Bosh usta sdelkasi ($)</Label>
                        <MoneyInput
                          thousandSeparator=" "
                          decimalScale={3}
                          value={tariffData.pieceworkRateUsd}
                          onValueChange={(values) => handleUpdate({ pieceworkRateUsd: values.floatValue ?? 0 })}
                          className="h-7 text-xs font-mono font-bold mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">Yordamchi sdelkasi ($)</Label>
                        <MoneyInput
                          thousandSeparator=" "
                          decimalScale={3}
                          value={tariffData.helperPieceworkRateUsd}
                          onValueChange={(values) => handleUpdate({ helperPieceworkRateUsd: values.floatValue ?? 0 })}
                          className="h-7 text-xs font-mono font-bold mt-1"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <h4 className="font-semibold text-xs text-foreground">Smena ustamalari</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Tungi smena (%)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={tariffData.operatorGrid?.nightShiftSurchargePct ?? 0}
                            onChange={(e) =>
                              handleUpdate({
                                operatorGrid: {
                                  ...tariffData.operatorGrid,
                                  nightShiftSurchargePct: parseInt(e.target.value, 10) || 0,
                                  baseGrade: tariffData.operatorGrid?.baseGrade ?? 3,
                                  gradeMultipliers: tariffData.operatorGrid?.gradeMultipliers ?? {
                                    "3": 1.0,
                                    "4": 1.15,
                                    "5": 1.3,
                                    "6": 1.5,
                                  },
                                  overtimeMultiplier: tariffData.operatorGrid?.overtimeMultiplier ?? 1.0,
                                  helperSharePct: tariffData.operatorGrid?.helperSharePct ?? 0,
                                },
                              })
                            }
                            className="h-7 text-xs font-mono mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground">Dam olish koef.</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={tariffData.operatorGrid?.overtimeMultiplier ?? 1.0}
                            onChange={(e) =>
                              handleUpdate({
                                operatorGrid: {
                                  ...tariffData.operatorGrid,
                                  overtimeMultiplier: parseFloat(e.target.value) || 1.0,
                                  baseGrade: tariffData.operatorGrid?.baseGrade ?? 3,
                                  gradeMultipliers: tariffData.operatorGrid?.gradeMultipliers ?? {
                                    "3": 1.0,
                                    "4": 1.15,
                                    "5": 1.3,
                                    "6": 1.5,
                                  },
                                  nightShiftSurchargePct: tariffData.operatorGrid?.nightShiftSurchargePct ?? 0,
                                  helperSharePct: tariffData.operatorGrid?.helperSharePct ?? 0,
                                },
                              })
                            }
                            className="h-7 text-xs font-mono mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground">Yordamchi ulushi (%)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={tariffData.operatorGrid?.helperSharePct ?? 0}
                            onChange={(e) =>
                              handleUpdate({
                                operatorGrid: {
                                  ...tariffData.operatorGrid,
                                  helperSharePct: parseInt(e.target.value, 10) || 0,
                                  baseGrade: tariffData.operatorGrid?.baseGrade ?? 3,
                                  gradeMultipliers: tariffData.operatorGrid?.gradeMultipliers ?? {
                                    "3": 1.0,
                                    "4": 1.15,
                                    "5": 1.3,
                                    "6": 1.5,
                                  },
                                  nightShiftSurchargePct: tariffData.operatorGrid?.nightShiftSurchargePct ?? 0,
                                  overtimeMultiplier: tariffData.operatorGrid?.overtimeMultiplier ?? 1.0,
                                },
                              })
                            }
                            className="h-7 text-xs font-mono mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Editable Razryadlar matritsasi */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-xs text-foreground">Malaka razryadlari</h4>
                    <div className="border border-border rounded-lg overflow-hidden font-mono text-xs">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/60 text-muted-foreground font-sans text-[11px] h-7">
                            <th className="px-2.5 py-1 text-left font-medium">Razryad</th>
                            <th className="px-2.5 py-1 text-left font-medium">Toifa</th>
                            <th className="px-2.5 py-1 text-right font-medium">Koeffitsient</th>
                            <th className="px-2.5 py-1 text-right font-medium">Sdelka ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {GRADE_METADATA.map((item) => {
                            const mult =
                              tariffData.operatorGrid?.gradeMultipliers?.[item.grade] ?? item.defaultMult;
                            const calculatedRate = (tariffData.pieceworkRateUsd || 0) * mult;
                            return (
                              <tr key={item.grade} className="h-8 hover:bg-muted/30">
                                <td className="px-2.5 py-1 font-semibold">{item.grade}-razryad</td>
                                <td className="px-2.5 py-1 font-sans text-[11px] text-muted-foreground">
                                  {item.label}
                                </td>
                                <td className="px-2.5 py-1 text-right w-24">
                                  <Input
                                    type="number"
                                    step="0.05"
                                    value={mult}
                                    onChange={(e) =>
                                      handleUpdateGradeMultiplier(
                                        item.grade,
                                        parseFloat(e.target.value) || 1.0
                                      )
                                    }
                                    className="h-6.5 text-[11px] font-mono text-right"
                                  />
                                </td>
                                <td className="px-2.5 py-1 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  ${calculatedRate.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LIVE SIMULATOR */}
          {activeTab === "simulator" && (
            <div className="max-w-4xl space-y-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Kalkulyatsiya simulyatori</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-xs">
                    Tiraj: {simQty.toLocaleString()}
                  </Badge>
                </div>

                {/* Simulation Controls */}
                <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Tiraj miqdori</Label>
                    <Input
                      type="number"
                      step="500"
                      value={simQty}
                      onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value, 10) || 1000))}
                      className="h-7 text-xs font-mono font-bold mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Format</Label>
                    {matrixFormats.length > 0 ? (
                      <Select value={simFormat} onValueChange={(val: any) => setSimFormat(val)}>
                        <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                          <SelectValue placeholder="Barchasi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-xs">Barchasi (Standart)</SelectItem>
                          {matrixFormats.map((fmt) => (
                            <SelectItem key={fmt} value={fmt} className="text-xs">
                              {fmt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={simFormat}
                        onChange={(e) => setSimFormat(e.target.value)}
                        placeholder="Standart"
                        className="h-7 text-xs mt-1 bg-background"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Rangdorlik</Label>
                    {matrixColors.length > 0 ? (
                      <Select value={simColors} onValueChange={(val: any) => setSimColors(val)}>
                        <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                          <SelectValue placeholder="Barchasi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-xs">Barchasi (Standart)</SelectItem>
                          {matrixColors.map((clr) => (
                            <SelectItem key={clr} value={clr} className="text-xs">
                              {clr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={simColors}
                        onChange={(e) => setSimColors(e.target.value)}
                        placeholder="Standart"
                        className="h-7 text-xs mt-1 bg-background"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Mijoz toifasi</Label>
                    <Select value={simCustomerTier} onValueChange={(val: any) => setSimCustomerTier(val)}>
                      <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard" className="text-xs">Standart</SelectItem>
                        <SelectItem value="vip" className="text-xs">
                          VIP (-{tariffData.pricingRules?.vipDiscountPct ?? 0}%)
                        </SelectItem>
                        <SelectItem value="wholesale" className="text-xs">
                          Ulgurji (-{tariffData.pricingRules?.wholesaleDiscountPct ?? 0}%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Operator razryadi</Label>
                    <Select
                      value={String(simOperatorGrade)}
                      onValueChange={(val: any) => setSimOperatorGrade(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_METADATA.map((g) => {
                          const mult =
                            tariffData.operatorGrid?.gradeMultipliers?.[g.grade] ?? g.defaultMult;
                          return (
                            <SelectItem key={g.grade} value={g.grade} className="text-xs">
                              {g.grade}-razryad ({mult}x)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <Label className="text-[11px] text-muted-foreground">Tungi smena</Label>
                    <Switch checked={simIsNightShift} onCheckedChange={setSimIsNightShift} />
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <Label className="text-[11px] text-muted-foreground">Dam olish kuni</Label>
                    <Switch checked={simIsOvertime} onCheckedChange={setSimIsOvertime} />
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <Label className="text-[11px] text-muted-foreground">Shoshilinch</Label>
                    <Switch checked={simIsUrgent} onCheckedChange={setSimIsUrgent} />
                  </div>
                </div>

                {/* Key Simulation KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Mijoz narxi</span>
                    <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                      ${simResult.netCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      1 dona: ${simResult.unitCost.toFixed(4)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Ishlab chiqarish tannarxi</span>
                    <span className="font-mono text-base font-bold text-foreground">
                      ${simResult.totalFactoryCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      Tavsiya: ${simResult.recommendedPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Sof foyda</span>
                    <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                      ${simResult.profitMarginAmount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono font-semibold">
                      Marja: {simResult.actualMarginPct}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Vaqt va chiqindi</span>
                    <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                      {simResult.totalMachineHours} soat
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-mono">
                      Chiqindi: {simResult.totalWasteSheets} list
                    </span>
                  </div>
                </div>

                {/* Detailed Breakdown Rows */}
                <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2 text-xs">
                  <h4 className="font-semibold text-foreground text-xs">Xarajatlar tarkibi</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Pripravka vaqti:</span>
                        <span className="font-mono text-foreground">
                          {simResult.machineSetupHours}s ({tariffData.techNorms?.makeReadyMinutes ?? 0} daq.)
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Ish vaqti:</span>
                        <span className="font-mono text-foreground">{simResult.machineRunHours}s</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Amortizatsiya:</span>
                        <span className="font-mono text-foreground">${simResult.depreciationCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Elektr energiyasi:</span>
                        <span className="font-mono text-foreground">${simResult.powerCost.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Operator sdelkasi:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          ${simResult.pieceworkTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Yordamchi sdelkasi:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          ${simResult.helperPieceworkTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Texnologik chiqindi:</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {simResult.totalWasteSheets} list ({simResult.makeReadyScrapSheets} + {simResult.runningScrapSheets})
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Sex ustamasi:</span>
                        <span className="font-mono text-foreground">${simResult.overheadCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LIFECYCLE, VERSIONS & AUDIT */}
          {activeTab === "lifecycle" && (
            <div className="max-w-4xl space-y-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Amal qilish muddati</span>
                  </h3>
                  <Button
                    size="sm"
                    onClick={handleApproveRevision}
                    className="h-6.5 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tasdiqlash</span>
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Versiya</Label>
                    <Input
                      value={tariffData.lifecycle?.version || "v1.0"}
                      onChange={(e) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            version: e.target.value,
                            effectiveFrom: tariffData.lifecycle?.effectiveFrom || "",
                            effectiveTo: tariffData.lifecycle?.effectiveTo || null,
                            approvedBy: tariffData.lifecycle?.approvedBy || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Draft",
                            auditLog: tariffData.lifecycle?.auditLog || [],
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Kuchga kirish sanasi</Label>
                    <DatePicker
                      value={tariffData.lifecycle?.effectiveFrom || ""}
                      onChange={(val) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            effectiveFrom: val,
                            version: tariffData.lifecycle?.version || "v1.0",
                            effectiveTo: tariffData.lifecycle?.effectiveTo || null,
                            approvedBy: tariffData.lifecycle?.approvedBy || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Draft",
                            auditLog: tariffData.lifecycle?.auditLog || [],
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Tugash sanasi</Label>
                    <DatePicker
                      value={tariffData.lifecycle?.effectiveTo || ""}
                      onChange={(val) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            effectiveTo: val || null,
                            version: tariffData.lifecycle?.version || "v1.0",
                            effectiveFrom: tariffData.lifecycle?.effectiveFrom || "",
                            approvedBy: tariffData.lifecycle?.approvedBy || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Draft",
                            auditLog: tariffData.lifecycle?.auditLog || [],
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Tasdiqlagan shaxs</Label>
                    <Input
                      value={tariffData.lifecycle?.approvedBy || ""}
                      placeholder={actorName}
                      onChange={(e) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            approvedBy: e.target.value,
                            version: tariffData.lifecycle?.version || "v1.0",
                            effectiveFrom: tariffData.lifecycle?.effectiveFrom || "",
                            effectiveTo: tariffData.lifecycle?.effectiveTo || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Draft",
                            auditLog: tariffData.lifecycle?.auditLog || [],
                          },
                        })
                      }
                      className="h-7 text-xs mt-1"
                    />
                  </div>
                </div>

                {/* Audit Trail Table */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Audit jurnali</span>
                  </h4>
                  <div className="border border-border rounded-lg overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/60 text-muted-foreground text-[11px] h-7 text-left">
                          <th className="px-3 py-1 font-medium">Sana</th>
                          <th className="px-3 py-1 font-medium">Foydalanuvchi</th>
                          <th className="px-3 py-1 font-medium">Harakat</th>
                          <th className="px-3 py-1 font-medium">Tafsilot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                        {(tariffData.lifecycle?.auditLog || []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground font-sans text-xs">
                              Audit yozuvlari mavjud emas
                            </td>
                          </tr>
                        ) : (
                          tariffData.lifecycle?.auditLog.map((log, idx) => (
                            <tr key={idx} className="h-7 hover:bg-muted/30">
                              <td className="px-3 py-1 text-muted-foreground">{new Date(log.date).toLocaleString()}</td>
                              <td className="px-3 py-1 font-sans text-foreground font-medium">{log.user}</td>
                              <td className="px-3 py-1">
                                <Badge variant="outline" className="h-4.5 px-1 font-mono text-[10px]">
                                  {log.action}
                                </Badge>
                              </td>
                              <td className="px-3 py-1 font-sans text-muted-foreground">{log.details}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Linked Work Orders & BOM Specifications */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-primary" />
                    <span>Bog&apos;langan hujjatlar ({linkedOrders.length + linkedSpecs.length})</span>
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {linkedOrders.length === 0 && linkedSpecs.length === 0 ? (
                    <div className="text-muted-foreground text-xs py-4 text-center">
                      Bog&apos;langan ish buyruqlari yoki texnologik xaritalar topilmadi
                    </div>
                  ) : (
                    <>
                      {linkedSpecs.map((spec: any) => (
                        <div
                          key={`spec-${spec.id || spec.code}`}
                          className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                              BOM
                            </Badge>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {spec.code || spec.id}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-medium text-foreground">{spec.name || spec.productName}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openTab({
                                id: `spec-${spec.id || spec.code}`,
                                title: `${spec.code}: ${spec.name || "Texkarta"}`,
                                type: "product-spec",
                                module: "production",
                                documentData: spec,
                              })
                            }
                            className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
                          >
                            <span>Ochish</span>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}

                      {linkedOrders.map((wo: any) => (
                        <div
                          key={`wo-${wo.id}`}
                          className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                              Ish buyrug&apos;i
                            </Badge>
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {wo.docNo || wo.id}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-medium text-foreground">{wo.product || "Buyurtma"}</span>
                            <span className="text-muted-foreground">({wo.customer || "Mijoz"})</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openTab({
                                id: `wo-${wo.id}`,
                                title: wo.docNo || wo.id,
                                type: "work-order",
                                module: "production",
                                documentData: wo,
                              })
                            }
                            className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
                          >
                            <span>Ochish</span>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
