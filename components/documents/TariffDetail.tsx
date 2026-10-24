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
  formatMoney,
} from "./common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ArrowRight,
  ExternalLink,
  Cpu,
  Building2,
  FileText,
  AlertTriangle,
  Zap,
  TrendingUp,
  Gauge,
  Sliders,
  ShieldCheck,
  Calendar,
  DollarSign,
  Boxes,
  HelpCircle,
  Copy,
  ChevronRight,
} from "lucide-react";

interface TariffDetailProps {
  tab: DocumentTab;
}

export function TariffDetail({ tab }: TariffDetailProps) {
  const {
    tariffs,
    upsertTariff,
    saveTariffToDb,
    deleteTariffFromDb,
    setTabUnsaved,
    updateTabData,
    closeTab,
    openTab,
    addNotification,
    machines,
    productionQueue,
    masterSpecifications,
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

  // Live Simulator interactive state
  const [simQty, setSimQty] = useState<number>(10000);
  const [simCustomerTier, setSimCustomerTier] = useState<"standard" | "vip" | "wholesale">("standard");
  const [simIsUrgent, setSimIsUrgent] = useState<boolean>(false);
  const [simFormat, setSimFormat] = useState<string>("B1 (700×1000)");
  const [simColors, setSimColors] = useState<string>("4+0");
  const [simOperatorGrade, setSimOperatorGrade] = useState<number>(3);
  const [simIsNightShift, setSimIsNightShift] = useState<boolean>(false);
  const [simIsOvertime, setSimIsOvertime] = useState<boolean>(false);

  // Active matrix edit state
  const [newMatrixFormat, setNewMatrixFormat] = useState("B1 (700×1000)");
  const [newMatrixColors, setNewMatrixColors] = useState("4+0");
  const [newMatrixWeight, setNewMatrixWeight] = useState<"light" | "standard" | "heavy" | "microflute">("standard");
  const [newMatrixRate, setNewMatrixRate] = useState("22.0");
  const [newMatrixSetup, setNewMatrixSetup] = useState("35.0");
  const [newMatrixSpeed, setNewMatrixSpeed] = useState("1.0");

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
        description: "Iltimos, me'yoriy operatsiya nomini to'ldiring.",
        severity: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveTariffToDb(tariffData);
      if (result) {
        setTariffData(result);
        updateTabData(tab.id, result, `${result.code}: ${result.operationName}`);
        setTabUnsaved(tab.id, false);
        setIsSaved(true);
        addNotification?.({
          title: "Tarif saqlandi",
          description: `${result.code} — ${result.operationName} muvaffaqiyatli saqlandi.`,
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
        description: `${tariffData.code} muvaffaqiyatli o'chirildi.`,
        severity: "info",
      });
      closeTab(tab.id);
    }
  };

  // Matrix handlers
  const handleAddMatrixRow = () => {
    const newRow: TariffMatrixItem = {
      id: `m-${Date.now()}`,
      format: newMatrixFormat,
      colors: newMatrixColors,
      weightBand: newMatrixWeight,
      rateUsd: parseFloat(newMatrixRate) || tariffData.rateUsd,
      setupFeeUsd: parseFloat(newMatrixSetup) || tariffData.setupFeeUsd,
      speedFactor: parseFloat(newMatrixSpeed) || 1.0,
      note: `${newMatrixFormat} ${newMatrixColors}`,
    };
    handleUpdate({ pricingMatrix: [...(tariffData.pricingMatrix || []), newRow] });
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
    const nextMin = lastTier ? (lastTier.maxQty || 50000) + 1 : 1;
    const newTier: TariffVolumeTier = {
      id: `tier-${Date.now()}`,
      minQty: nextMin,
      maxQty: nextMin + 25000,
      rateUsd: Math.max(1, (lastTier ? lastTier.rateUsd : tariffData.rateUsd) * 0.9),
      setupFeeUsd: lastTier ? lastTier.setupFeeUsd : tariffData.setupFeeUsd,
      discountPct: 10,
      note: "Yangi hajm qadami",
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

  // Approve revision
  const handleApproveRevision = () => {
    const now = new Date().toISOString();
    const updatedLifecycle = {
      version: tariffData.lifecycle?.version || "v1.0",
      effectiveFrom: tariffData.lifecycle?.effectiveFrom || "2026-01-01",
      effectiveTo: tariffData.lifecycle?.effectiveTo || null,
      approvalStatus: "Approved" as const,
      approvedAt: now,
      approvedBy: "Bosh Texnolog (Tasdiqlangan)",
      auditLog: [
        ...(tariffData.lifecycle?.auditLog || []),
        {
          date: now,
          user: "Bosh Texnolog",
          action: "REVISION_APPROVED",
          details: `Tarif ${tariffData.lifecycle?.version || "v1.0"} rasmiy amal qilish uchun tasdiqlandi.`,
        },
      ],
    };
    handleUpdate({ lifecycle: updatedLifecycle, status: "Active" });
    addNotification?.({
      title: "Tarif tasdiqlandi",
      description: `${tariffData.code} ishlab chiqarishga qabul qilindi.`,
      severity: "success",
    });
  };

  // Live simulation calculation
  const simResult = useMemo(() => {
    return computeTariffEstimate(tariffData, simQty, {
      customerTier: simCustomerTier,
      isUrgent: simIsUrgent,
      matrixFormat: simFormat,
      matrixColors: simColors,
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
      label: "Pasport & Me'yorlar",
      icon: Coins,
      badge: tariffData.rateUsd ? `$${tariffData.rateUsd}` : undefined,
    },
    {
      id: "matrix",
      label: "Format & Rang Matritsasi",
      icon: Layers,
      badge: tariffData.pricingMatrix?.length ? `${tariffData.pricingMatrix.length} ta` : "0",
    },
    {
      id: "costing",
      label: "Tannarx & Kalkulyatsiya",
      icon: Calculator,
      badge: tariffData.costBreakdown?.depreciationHourlyUsd ? `$${tariffData.costBreakdown.depreciationHourlyUsd}/h` : undefined,
    },
    {
      id: "labor",
      label: "Mehnat Tarif Setkasi",
      icon: Award,
      badge: tariffData.pieceworkRateUsd ? `$${tariffData.pieceworkRateUsd}` : undefined,
    },
    {
      id: "simulator",
      label: "Jonli Simulyator",
      icon: Sparkles,
      badge: "Sim",
    },
    {
      id: "lifecycle",
      label: "Amal qilish & Audit",
      icon: History,
      badge: tariffData.lifecycle?.version || "v1.0",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background select-none overflow-hidden text-xs">
      {/* ── Document Header ── */}
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

      {/* ── Main Workspace Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              icon={Coins}
              title={tariffData.code || "TRF"}
              subtitle={tariffData.category}
            >
              <InfoRow label="Bazaviy stavka">
                <span className="font-mono font-medium">${tariffData.rateUsd} / {tariffData.unit}</span>
              </InfoRow>
              <InfoRow label="Pripravka (Setup)">
                <span className="font-mono font-medium">${tariffData.setupFeeUsd}</span>
              </InfoRow>
              <InfoRow label="Sozlash vaqti">
                <span className="font-mono text-foreground">{tariffData.techNorms?.makeReadyMinutes || 25} daq.</span>
              </InfoRow>
              <InfoRow label="Pripravka chiqindisi">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {tariffData.techNorms?.makeReadyWasteSheets || 60} list
                </span>
              </InfoRow>
              <InfoRow label="Sdelka (Bosh usta)">
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  ${tariffData.pieceworkRateUsd}
                </span>
              </InfoRow>
              <InfoRow label="Rejaviy marja">
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  {tariffData.costBreakdown?.targetMarginPercent || 25}%
                </span>
              </InfoRow>
              <InfoRow label="Stanok / Sex">
                <span className="truncate">{tariffData.machineOrDept || tariffData.department}</span>
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
            <div className="max-w-4xl space-y-4">
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Texnologik operatsiya pasporti va stavkalari</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {tariffData.code}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Operatsiya kodi (Unique Code)</Label>
                    <Input
                      value={tariffData.code}
                      onChange={(e) => handleUpdate({ code: e.target.value })}
                      placeholder="TRF-001"
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Operatsiya to'liq nomi *</Label>
                    <Input
                      value={tariffData.operationName}
                      onChange={(e) => handleUpdate({ operationName: e.target.value })}
                      placeholder="Masalan: Sheetfed Offset Run (4+0 CMYK)"
                      className="h-7 text-xs font-medium mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Jarayon guruhi (Category)</Label>
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
                    <Label className="text-[11px] text-muted-foreground">Sex / Bo&apos;lim (Department)</Label>
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
                        <SelectItem value="Offset" className="text-xs">Offset (Plastina & Qog&apos;oz bosma)</SelectItem>
                        <SelectItem value="Flexo" className="text-xs">Flexo (Rulonli lenta & bo&apos;yoq)</SelectItem>
                        <SelectItem value="Jacquard" className="text-xs">Jacquard (To&apos;qimachilik lentalari)</SelectItem>
                        <SelectItem value="Prepress" className="text-xs">Prepress & CTP</SelectItem>
                        <SelectItem value="Post-press" className="text-xs">Post-press (Kesim, Laminatsiya, Lak)</SelectItem>
                        <SelectItem value="Packaging" className="text-xs">Qadoqlash & Yuklash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Biriktirilgan stanok yoki liniya (Equipment)</Label>
                    <Select
                      value={tariffData.machineOrDept || "none"}
                      onValueChange={(val) => {
                        if (val !== null) handleUpdate({ machineOrDept: val === "none" ? "" : val });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue placeholder="Stanokni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">Universal (Barcha dastgohlar uchun)</SelectItem>
                        {(machines || []).map((m: any) => (
                          <SelectItem key={m.id || m.code} value={m.name || m.code} className="text-xs">
                            {m.name} ({m.code || m.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Hisoblash o&apos;lchov birligi (Calc Unit)</Label>
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
                    <Input
                      type="number"
                      step="0.01"
                      value={tariffData.rateUsd}
                      onChange={(e) => handleUpdate({ rateUsd: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Pripravka / Sozlash ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tariffData.setupFeeUsd}
                      onChange={(e) => handleUpdate({ setupFeeUsd: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Minimal to&apos;lov ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tariffData.minChargeUsd || 0}
                      onChange={(e) => handleUpdate({ minChargeUsd: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">QQS stavkasi (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={tariffData.vatRate || 12}
                      onChange={(e) => handleUpdate({ vatRate: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: TECH NORMS & TECHNICAL SCRAP */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                    <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Texnologik chiqindi, pripravka va tezlik me&apos;yorlari (Heidelberg/Bobst standard)</span>
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Standart me&apos;yorlar
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>Pripravka vaqti (daqiqada)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.techNorms?.makeReadyMinutes ?? 25}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            makeReadyMinutes: parseInt(e.target.value, 10) || 0,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 50,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 1.5,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 10000,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 7500,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="25"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Stanokni ishga sozlash davomiyligi</p>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span>Pripravka chiqindisi (listlar)</span>
                    </Label>
                    <Input
                      type="number"
                      step="5"
                      value={tariffData.techNorms?.makeReadyWasteSheets ?? 60}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            makeReadyWasteSheets: parseInt(e.target.value, 10) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 25,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 1.5,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 10000,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 7500,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="60"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Rang moslash va faza olishdagi chiqindi</p>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Percent className="w-3 h-3 text-muted-foreground" />
                      <span>Tirajdagi tabiiy yo&apos;qotish (%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tariffData.techNorms?.runningWastePercent ?? 1.5}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            runningWastePercent: parseFloat(e.target.value) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 25,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 50,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 10000,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 7500,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="1.5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Chop jarayonidagi texnik brak me&apos;yori</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Pasport tezligi (ottisk/soat)</Label>
                    <Input
                      type="number"
                      step="500"
                      value={tariffData.techNorms?.ratedSpeedPerHour ?? 12000}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            ratedSpeedPerHour: parseInt(e.target.value, 10) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 25,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 50,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 1.5,
                            effectiveSpeedPerHour: tariffData.techNorms?.effectiveSpeedPerHour ?? 7500,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                      placeholder="12000"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground font-semibold">
                      Haqiqiy me&apos;yoriy tezlik (OEE hisobida)
                    </Label>
                    <Input
                      type="number"
                      step="500"
                      value={tariffData.techNorms?.effectiveSpeedPerHour ?? 8500}
                      onChange={(e) =>
                        handleUpdate({
                          techNorms: {
                            ...tariffData.techNorms,
                            effectiveSpeedPerHour: parseInt(e.target.value, 10) || 0,
                            makeReadyMinutes: tariffData.techNorms?.makeReadyMinutes ?? 25,
                            makeReadyWasteSheets: tariffData.techNorms?.makeReadyWasteSheets ?? 50,
                            runningWastePercent: tariffData.techNorms?.runningWastePercent ?? 1.5,
                            ratedSpeedPerHour: tariffData.techNorms?.ratedSpeedPerHour ?? 10000,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1"
                      placeholder="8500"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Smena me&apos;yori (8 soatlik)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={tariffData.normOutputPerShift || 25000}
                      onChange={(e) => handleUpdate({ normOutputPerShift: parseInt(e.target.value, 10) || 0 })}
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Texnologik eslatmalar va yo&apos;riqnoma</Label>
                <Textarea
                  value={tariffData.notes || ""}
                  onChange={(e) => handleUpdate({ notes: e.target.value })}
                  placeholder="Stanok xususiyatlari, qog'oz cheklovlari yoki smena bo'yicha maxsus ko'rsatmalar..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: MULTI-PARAMETRIC PRICING MATRIX */}
          {activeTab === "matrix" && (
            <div className="max-w-5xl space-y-4">
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-semibold text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Ko&apos;p parametrli narx matritsasi (Format × Rangdorlik × Zichlik)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Har bir texnologik variant uchun aniq stavka, tayyorgarlik va tezlik koeffitsienti
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddMatrixRow}
                    className="h-6.5 px-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Variant qo&apos;shish</span>
                  </Button>
                </div>

                {/* Inline New Matrix Row Form */}
                <div className="p-2.5 rounded-lg border border-dashed border-border/80 bg-muted/20 grid grid-cols-7 gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Format</Label>
                    <Input
                      value={newMatrixFormat}
                      onChange={(e) => setNewMatrixFormat(e.target.value)}
                      className="h-6.5 text-[11px] font-mono mt-0.5"
                      placeholder="B1 (700×1000)"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Rangdorlik</Label>
                    <Input
                      value={newMatrixColors}
                      onChange={(e) => setNewMatrixColors(e.target.value)}
                      className="h-6.5 text-[11px] font-mono mt-0.5"
                      placeholder="4+4"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Grammaj</Label>
                    <Select
                      value={newMatrixWeight}
                      onValueChange={(val: any) => setNewMatrixWeight(val)}
                    >
                      <SelectTrigger className="h-6.5 text-[11px] mt-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light" className="text-xs">&lt;120g (Yupqa)</SelectItem>
                        <SelectItem value="standard" className="text-xs">120-300g (Standart)</SelectItem>
                        <SelectItem value="heavy" className="text-xs">&gt;300g (Qalin karton)</SelectItem>
                        <SelectItem value="microflute" className="text-xs">Mikrogofr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Stavka ($)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newMatrixRate}
                      onChange={(e) => setNewMatrixRate(e.target.value)}
                      className="h-6.5 text-[11px] font-mono mt-0.5"
                      placeholder="22.0"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Pripravka ($)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={newMatrixSetup}
                      onChange={(e) => setNewMatrixSetup(e.target.value)}
                      className="h-6.5 text-[11px] font-mono mt-0.5"
                      placeholder="35.0"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Tezlik koeffitsienti</Label>
                    <Input
                      type="number"
                      step="0.05"
                      value={newMatrixSpeed}
                      onChange={(e) => setNewMatrixSpeed(e.target.value)}
                      className="h-6.5 text-[11px] font-mono mt-0.5"
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <Button
                      size="sm"
                      onClick={handleAddMatrixRow}
                      variant="outline"
                      className="h-6.5 w-full text-xs font-medium cursor-pointer"
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
                        <th className="px-3 py-1 font-medium">Format</th>
                        <th className="px-3 py-1 font-medium">Ranglar</th>
                        <th className="px-3 py-1 font-medium">Qog&apos;oz toifasi</th>
                        <th className="px-3 py-1 font-medium text-right">Stavka ($)</th>
                        <th className="px-3 py-1 font-medium text-right">Pripravka ($)</th>
                        <th className="px-3 py-1 font-medium text-center">Tezlik OEE</th>
                        <th className="px-3 py-1 font-medium text-right">Amal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {(tariffData.pricingMatrix || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground font-sans text-xs">
                            Hozircha maxsus matritsa satrlari mavjud emas. Yuqoridagi formadan qo&apos;shishingiz mumkin.
                          </td>
                        </tr>
                      ) : (
                        (tariffData.pricingMatrix || []).map((row) => (
                          <tr key={row.id} className="hover:bg-muted/30 transition-colors h-7.5">
                            <td className="px-3 py-1 font-semibold text-foreground">{row.format}</td>
                            <td className="px-3 py-1">
                              <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                                {row.colors}
                              </Badge>
                            </td>
                            <td className="px-3 py-1 font-sans text-muted-foreground text-[11px] capitalize">
                              {row.weightBand === "light"
                                ? "Yupqa (<120g)"
                                : row.weightBand === "standard"
                                ? "Standart (120-300g)"
                                : row.weightBand === "heavy"
                                ? "Qalin karton (>300g)"
                                : "Mikrogofr"}
                            </td>
                            <td className="px-3 py-1 text-right font-bold text-foreground">
                              ${row.rateUsd}
                            </td>
                            <td className="px-3 py-1 text-right text-muted-foreground">
                              ${row.setupFeeUsd}
                            </td>
                            <td className="px-3 py-1 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  row.speedFactor < 1
                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                    : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {row.speedFactor}x
                              </span>
                            </td>
                            <td className="px-3 py-1 text-right">
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

              {/* Volume Tiers (Tiraj qadamlari) */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-semibold text-xs flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Tiraj hajmi bo&apos;yicha chegirma pog&apos;onalari (Volume Tiers)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Buyurtma qancha katta bo&apos;lsa, ottisk stavkasi shuncha arzonlashadi
                    </p>
                  </div>
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

                <div className="space-y-2">
                  {(tariffData.volumeTiers || []).map((tier, idx) => (
                    <div
                      key={tier.id || idx}
                      className="p-2.5 rounded-lg border border-border/80 bg-muted/20 grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-3">
                        <Label className="text-[10px] text-muted-foreground">Tiraj oralig&apos;i</Label>
                        <div className="flex items-center gap-1 mt-0.5 font-mono text-[11px]">
                          <span>{tier.minQty.toLocaleString()}</span>
                          <span>—</span>
                          <span>{tier.maxQty ? tier.maxQty.toLocaleString() : "∞ (va undan yuqori)"}</span>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Stavka ($)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={tier.rateUsd}
                          onChange={(e) => handleUpdateTier(idx, { rateUsd: parseFloat(e.target.value) || 0 })}
                          className="h-6.5 text-[11px] font-mono font-bold mt-0.5"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Pripravka ($)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={tier.setupFeeUsd ?? tariffData.setupFeeUsd}
                          onChange={(e) => handleUpdateTier(idx, { setupFeeUsd: parseFloat(e.target.value) || 0 })}
                          className="h-6.5 text-[11px] font-mono mt-0.5"
                        />
                      </div>

                      <div className="col-span-4">
                        <Label className="text-[10px] text-muted-foreground">Izoh</Label>
                        <Input
                          value={tier.note || ""}
                          onChange={(e) => handleUpdateTier(idx, { note: e.target.value })}
                          className="h-6.5 text-[11px] mt-0.5"
                          placeholder="Katta hajm uchun..."
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTier(idx)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer mt-3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COSTING & COST BREAKDOWN */}
          {activeTab === "costing" && (
            <div className="max-w-4xl space-y-4">
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-semibold text-xs flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Stanok normo-soati va to&apos;liq tannarx kalkulyatsiyasi (1C:Standard)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Amortizatsiya, elektr energiya, yordamchi kimyoviy moddalar va sex ustama xarajatlari
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-emerald-600 dark:text-emerald-400">
                    Target Margin: {tariffData.costBreakdown?.targetMarginPercent || 25}%
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-muted-foreground" />
                      <span>Stanok amortizatsiyasi ($/soat)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={tariffData.costBreakdown?.depreciationHourlyUsd ?? 6.5}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            depreciationHourlyUsd: parseFloat(e.target.value) || 0,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 18,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0.08,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 1.2,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 15,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 25,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="6.5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Stanok eskirishi va lizing to&apos;lovi</p>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Elektr quvvati sarfi (kW/soat)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={tariffData.costBreakdown?.powerKwPerHour ?? 18}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            powerKwPerHour: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 6.5,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0.08,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 1.2,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 15,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 25,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="18.0"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Asosiy motor, kompressor va quritgich</p>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span>1 kW elektr narxi ($)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tariffData.costBreakdown?.powerCostPerKwh ?? 0.08}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            powerCostPerKwh: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 6.5,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 18,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 1.2,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 15,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 25,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="0.08"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sanoat tarifi (approx. 1000 so&apos;m/kWh)</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Boxes className="w-3 h-3 text-muted-foreground" />
                      <span>Yordamchi kimyo ($/1000 birlik)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 1.2}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            auxiliaryMaterialsPerUnit: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 6.5,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 18,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0.08,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 15,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 25,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="1.20"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Smyvka, spirt, lak, latta, moylash</p>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <span>Sex va ma&apos;muriy ustama (%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.costBreakdown?.overheadPercent ?? 15}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            overheadPercent: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 6.5,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 18,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0.08,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 1.2,
                            targetMarginPercent: tariffData.costBreakdown?.targetMarginPercent ?? 25,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-medium mt-1"
                      placeholder="15"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sex ijarasi, ustalar va ma&apos;muriyat ulushi</p>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                      <span>Rejaviy marja / Rentabellik (%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={tariffData.costBreakdown?.targetMarginPercent ?? 25}
                      onChange={(e) =>
                        handleUpdate({
                          costBreakdown: {
                            ...tariffData.costBreakdown,
                            targetMarginPercent: parseFloat(e.target.value) || 0,
                            depreciationHourlyUsd: tariffData.costBreakdown?.depreciationHourlyUsd ?? 6.5,
                            powerKwPerHour: tariffData.costBreakdown?.powerKwPerHour ?? 18,
                            powerCostPerKwh: tariffData.costBreakdown?.powerCostPerKwh ?? 0.08,
                            auxiliaryMaterialsPerUnit: tariffData.costBreakdown?.auxiliaryMaterialsPerUnit ?? 1.2,
                            overheadPercent: tariffData.costBreakdown?.overheadPercent ?? 15,
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1"
                      placeholder="25"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sof foyda marjasi maqsadi</p>
                  </div>
                </div>
              </div>

              {/* AUTOMATED COST SHEET PREVIEW (Kalkulyatsiya kartasi) */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h4 className="font-semibold text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Me&apos;yoriy kalkulyatsiya kartasi (1,000 birlik ishlab chiqarish uchun)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    1 soatlik normo-soat tannarxi:{" "}
                    <strong className="text-foreground">
                      $
                      {(
                        (tariffData.costBreakdown?.depreciationHourlyUsd || 6.5) +
                        (tariffData.costBreakdown?.powerKwPerHour || 18) *
                          (tariffData.costBreakdown?.powerCostPerKwh || 0.08)
                      ).toFixed(2)}
                      /soat
                    </strong>
                  </span>
                </div>

                {(() => {
                  const effectiveSpeed = tariffData.techNorms?.effectiveSpeedPerHour || 8500;
                  const hoursPer1k = effectiveSpeed > 0 ? 1000 / effectiveSpeed : 0.12;
                  const depr1k = hoursPer1k * (tariffData.costBreakdown?.depreciationHourlyUsd || 6.5);
                  const power1k =
                    hoursPer1k *
                    (tariffData.costBreakdown?.powerKwPerHour || 18) *
                    (tariffData.costBreakdown?.powerCostPerKwh || 0.08);
                  const aux1k = tariffData.costBreakdown?.auxiliaryMaterialsPerUnit || 1.2;
                  const labor1k = tariffData.pieceworkRateUsd || 4.5;
                  const direct1k = depr1k + power1k + aux1k + labor1k;
                  const overhead1k = direct1k * ((tariffData.costBreakdown?.overheadPercent || 15) / 100);
                  const totalCost1k = direct1k + overhead1k;
                  const targetMarginPct = tariffData.costBreakdown?.targetMarginPercent || 25;
                  const targetPrice1k = totalCost1k * (1 + targetMarginPct / 100);
                  const actualRate = tariffData.rateUsd || 20;

                  return (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 border-r border-border/60 pr-4">
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>1. Stanok amortizatsiyasi ({hoursPer1k.toFixed(3)}h):</span>
                            <span className="font-mono text-foreground">${depr1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>2. Elektr energiyasi xarajati:</span>
                            <span className="font-mono text-foreground">${power1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>3. Yordamchi kimyoviy moddalar:</span>
                            <span className="font-mono text-foreground">${aux1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>4. Operator sdelka mehnat haqi:</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              ${labor1k.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5 font-semibold text-foreground pt-1">
                            <span>To&apos;g&apos;ridan-to&apos;g&apos;ri xarajatlar (Direct Costs):</span>
                            <span className="font-mono">${direct1k.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-2">
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>5. Sex va ma&apos;muriy ustama ({tariffData.costBreakdown?.overheadPercent || 15}%):</span>
                            <span className="font-mono text-foreground">${overhead1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 font-semibold text-foreground">
                            <span>JAMI ISHLAB CHIQARISH TANNARXI:</span>
                            <span className="font-mono text-foreground font-bold">${totalCost1k.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                            <span>Tavsiya etilgan sotuv narxi (+{targetMarginPct}% marja):</span>
                            <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                              ${targetPrice1k.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5 font-bold text-xs pt-1">
                            <span>Amaldagi tarif stavkasi:</span>
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
                          <span className="text-muted-foreground">Tannarx va foyda tuzilishi:</span>
                          <span className="font-mono">
                            Tannarx: ${(totalCost1k).toFixed(2)} • Sof foyda: $
                            {(Math.max(0, actualRate - totalCost1k)).toFixed(2)} (
                            {(((actualRate - totalCost1k) / actualRate) * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
                          <div
                            className="bg-blue-600"
                            style={{ width: `${Math.min(100, (direct1k / actualRate) * 100)}%` }}
                            title="Direct Costs"
                          />
                          <div
                            className="bg-amber-500"
                            style={{ width: `${Math.min(100, (overhead1k / actualRate) * 100)}%` }}
                            title="Overhead"
                          />
                          <div
                            className="bg-emerald-500 flex-1"
                            title="Profit Margin"
                          />
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
            <div className="max-w-4xl space-y-4">
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-semibold text-xs flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Mehnat tarif setkasi va Operator razryadlari (Piecework & Labor Grid)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Malaka toifalari, tungi smena va qo&apos;shimcha ish vaqti koeffitsientlari
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 border-r border-border/60 pr-4">
                    <h4 className="font-semibold text-xs text-foreground">Bazaviy sdelka stavkalari</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Bosh usta sdelkasi ($)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={tariffData.pieceworkRateUsd}
                          onChange={(e) => handleUpdate({ pieceworkRateUsd: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs font-mono font-bold mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">Har 1,000 birlik uchun stavka</p>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">Yordamchi sdelkasi ($)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={tariffData.helperPieceworkRateUsd}
                          onChange={(e) => handleUpdate({ helperPieceworkRateUsd: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs font-mono font-bold mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">Shogird / yordamchi ulushi</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <h4 className="font-semibold text-xs text-foreground">Smena ustamalari</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Tungi smena ustamasi (%)</Label>
                          <Input
                            type="number"
                            step="1"
                            value={tariffData.operatorGrid?.nightShiftSurchargePct ?? 15}
                            onChange={(e) =>
                              handleUpdate({
                                operatorGrid: {
                                  ...tariffData.operatorGrid,
                                  nightShiftSurchargePct: parseInt(e.target.value, 10) || 0,
                                  baseGrade: tariffData.operatorGrid?.baseGrade ?? 3,
                                  gradeMultipliers: tariffData.operatorGrid?.gradeMultipliers ?? { "3": 1.0, "4": 1.15, "5": 1.3, "6": 1.5 },
                                  overtimeMultiplier: tariffData.operatorGrid?.overtimeMultiplier ?? 1.5,
                                  helperSharePct: tariffData.operatorGrid?.helperSharePct ?? 35,
                                },
                              })
                            }
                            className="h-7 text-xs font-mono mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground">Dam olish kuni koeffitsienti</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={tariffData.operatorGrid?.overtimeMultiplier ?? 1.5}
                            onChange={(e) =>
                              handleUpdate({
                                operatorGrid: {
                                  ...tariffData.operatorGrid,
                                  overtimeMultiplier: parseFloat(e.target.value) || 1.5,
                                  baseGrade: tariffData.operatorGrid?.baseGrade ?? 3,
                                  gradeMultipliers: tariffData.operatorGrid?.gradeMultipliers ?? { "3": 1.0, "4": 1.15, "5": 1.3, "6": 1.5 },
                                  nightShiftSurchargePct: tariffData.operatorGrid?.nightShiftSurchargePct ?? 15,
                                  helperSharePct: tariffData.operatorGrid?.helperSharePct ?? 35,
                                },
                              })
                            }
                            className="h-7 text-xs font-mono mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Razryadlar matritsasi */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-xs text-foreground">Malaka razryadlari koeffitsienti</h4>
                    <div className="border border-border rounded-lg overflow-hidden font-mono text-xs">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/60 text-muted-foreground font-sans text-[11px] h-7">
                            <th className="px-3 py-1 text-left font-medium">Razryad</th>
                            <th className="px-3 py-1 text-left font-medium">Toifa</th>
                            <th className="px-3 py-1 text-right font-medium">Koeffitsient</th>
                            <th className="px-3 py-1 text-right font-medium">Haqiqiy sdelka</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {[
                            { grade: 3, label: "Kichik operator", mult: 1.0 },
                            { grade: 4, label: "O'rta toifali usta", mult: 1.15 },
                            { grade: 5, label: "Yetakchi usta", mult: 1.3 },
                            { grade: 6, label: "Bosh usta (Master)", mult: 1.5 },
                          ].map((item) => {
                            const calculatedRate = (tariffData.pieceworkRateUsd || 4.5) * item.mult;
                            return (
                              <tr key={item.grade} className="h-7 hover:bg-muted/30">
                                <td className="px-3 py-1 font-semibold">{item.grade}-razryad</td>
                                <td className="px-3 py-1 font-sans text-[11px] text-muted-foreground">{item.label}</td>
                                <td className="px-3 py-1 text-right text-foreground">{item.mult}x</td>
                                <td className="px-3 py-1 text-right font-bold text-emerald-600 dark:text-emerald-400">
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
            <div className="max-w-4xl space-y-4">
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-semibold text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Jonli simulyator va Kaskad kalkulyatsiyasi (What-If Analysis)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Haqiqiy buyurtma parametrlari bo&apos;yicha vaqt, chiqindi va rentabellikni hisoblash
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    Tiraj: {simQty.toLocaleString()} dona
                  </Badge>
                </div>

                {/* Simulation Controls */}
                <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Buyurtma tiraji</Label>
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
                    <Select value={simFormat} onValueChange={(val: any) => setSimFormat(val)}>
                      <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B1 (700×1000)" className="text-xs">B1 (700×1000 mm)</SelectItem>
                        <SelectItem value="B2 (500×700)" className="text-xs">B2 (500×700 mm)</SelectItem>
                        <SelectItem value="B3 (350×500)" className="text-xs">B3 (350×500 mm)</SelectItem>
                        <SelectItem value="A3" className="text-xs">A3 Format</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Rangdorlik</Label>
                    <Select value={simColors} onValueChange={(val: any) => setSimColors(val)}>
                      <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4+0" className="text-xs">4+0 (CMYK Bir tomonlama)</SelectItem>
                        <SelectItem value="4+4" className="text-xs">4+4 (Ikki tomonlama rangli)</SelectItem>
                        <SelectItem value="1+0" className="text-xs">1+0 (Qora / Monoxrom)</SelectItem>
                        <SelectItem value="4+L" className="text-xs">4+L (CMYK + Lak)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Mijoz toifasi</Label>
                    <Select value={simCustomerTier} onValueChange={(val: any) => setSimCustomerTier(val)}>
                      <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard" className="text-xs">Standart mijoz</SelectItem>
                        <SelectItem value="vip" className="text-xs">VIP mijoz (-{tariffData.pricingRules?.vipDiscountPct || 10}%)</SelectItem>
                        <SelectItem value="wholesale" className="text-xs">Ulgurji (-{tariffData.pricingRules?.wholesaleDiscountPct || 15}%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Operator razryadi</Label>
                    <Select value={String(simOperatorGrade)} onValueChange={(val: any) => setSimOperatorGrade(parseInt(val, 10))}>
                      <SelectTrigger className="h-7 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3" className="text-xs">3-razryad (1.0x)</SelectItem>
                        <SelectItem value="4" className="text-xs">4-razryad (1.15x)</SelectItem>
                        <SelectItem value="5" className="text-xs">5-razryad (1.30x)</SelectItem>
                        <SelectItem value="6" className="text-xs">6-razryad Bosh usta (1.50x)</SelectItem>
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
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Mijozga narx (Total Price)</span>
                    <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                      ${simResult.netCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      1 dona: ${simResult.unitCost.toFixed(4)}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Jami tannarx (Factory Cost)</span>
                    <span className="font-mono text-lg font-bold text-foreground">
                      ${simResult.totalFactoryCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      Rejaviy: ${simResult.recommendedPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Sof rentabellik / Foyda</span>
                    <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ${simResult.profitMarginAmount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono font-semibold">
                      Marja: {simResult.actualMarginPct}%
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Vaqt & Chiqindi</span>
                    <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
                      {simResult.totalMachineHours} soat
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-mono">
                      Chiqindi: {simResult.totalWasteSheets} list
                    </span>
                  </div>
                </div>

                {/* Detailed Breakdown Rows */}
                <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2 text-xs">
                  <h4 className="font-semibold text-foreground text-xs">Xarajatlar batafsil strukturasi:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Pripravka vaqti:</span>
                        <span className="font-mono text-foreground">{simResult.machineSetupHours}h ({tariffData.techNorms?.makeReadyMinutes || 25} daq.)</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Chop etish vaqti:</span>
                        <span className="font-mono text-foreground">{simResult.machineRunHours}h</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Stanok amortizatsiyasi:</span>
                        <span className="font-mono text-foreground">${simResult.depreciationCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Elektr energiyasi sarfi:</span>
                        <span className="font-mono text-foreground">${simResult.powerCost.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Operator sdelka FOT:</span>
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
                        <span>Texnologik chiqindi listlar:</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {simResult.totalWasteSheets} list ({simResult.makeReadyScrapSheets} pripravka + {simResult.runningScrapSheets} tiraj)
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-border/40 text-muted-foreground">
                        <span>Sex va ma&apos;muriy ustama:</span>
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
            <div className="max-w-4xl space-y-4">
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-semibold text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Amal qilish muddati va Tasdiqlash holati (Lifecycle & Governance)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Tarifning korxona ichida kuchga kirishi va o&apos;zgarishlar audit tarixi
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleApproveRevision}
                    className="h-6.5 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tasdiqlash (Approve)</span>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Versiya raqami</Label>
                    <Input
                      value={tariffData.lifecycle?.version || "v1.0"}
                      onChange={(e) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            version: e.target.value,
                            effectiveFrom: tariffData.lifecycle?.effectiveFrom || "2026-01-01",
                            effectiveTo: tariffData.lifecycle?.effectiveTo || null,
                            approvedBy: tariffData.lifecycle?.approvedBy || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Approved",
                            auditLog: tariffData.lifecycle?.auditLog || [],
                          },
                        })
                      }
                      className="h-7 text-xs font-mono font-semibold mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Amal qilish boshlanishi</Label>
                    <Input
                      type="date"
                      value={tariffData.lifecycle?.effectiveFrom || "2026-01-01"}
                      onChange={(e) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            effectiveFrom: e.target.value,
                            version: tariffData.lifecycle?.version || "v1.0",
                            effectiveTo: tariffData.lifecycle?.effectiveTo || null,
                            approvedBy: tariffData.lifecycle?.approvedBy || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Approved",
                            auditLog: tariffData.lifecycle?.auditLog || [],
                          },
                        })
                      }
                      className="h-7 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Tasdiqlagan mas&apos;ul</Label>
                    <Input
                      value={tariffData.lifecycle?.approvedBy || "Bosh Texnolog"}
                      onChange={(e) =>
                        handleUpdate({
                          lifecycle: {
                            ...tariffData.lifecycle,
                            approvedBy: e.target.value,
                            version: tariffData.lifecycle?.version || "v1.0",
                            effectiveFrom: tariffData.lifecycle?.effectiveFrom || "2026-01-01",
                            effectiveTo: tariffData.lifecycle?.effectiveTo || null,
                            approvedAt: tariffData.lifecycle?.approvedAt || null,
                            approvalStatus: tariffData.lifecycle?.approvalStatus || "Approved",
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
                    <span>O&apos;zgarishlar va tasdiqlash jurnali (Audit Trail)</span>
                  </h4>
                  <div className="border border-border rounded-lg overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/60 text-muted-foreground text-[11px] h-7 text-left">
                          <th className="px-3 py-1 font-medium">Sana / Vaqt</th>
                          <th className="px-3 py-1 font-medium">Foydalanuvchi</th>
                          <th className="px-3 py-1 font-medium">Harakat</th>
                          <th className="px-3 py-1 font-medium">Tafsilot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                        {(tariffData.lifecycle?.auditLog || []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground font-sans text-xs">
                              Hozircha audit yozuvlari yo&apos;q.
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
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 className="font-semibold text-xs flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-primary" />
                    <span>Bog&apos;langan Ish buyruqlari va Texnologik xaritalar ({linkedOrders.length + linkedSpecs.length} ta)</span>
                  </h3>
                </div>

                <div className="space-y-2">
                  {linkedOrders.length === 0 && linkedSpecs.length === 0 ? (
                    <p className="text-muted-foreground text-xs py-4 text-center">
                      Hozircha ushbu tarifdan foydalanayotgan hujjatlar topilmadi.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {linkedOrders.map((wo: any) => (
                        <div
                          key={wo.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
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
                    </div>
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
