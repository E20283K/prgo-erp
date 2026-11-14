"use client";

import React, { useState, useMemo, useEffect } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import {
  PlantRecord,
  createEmptyPlant,
  generateNextPlantCode,
  companyToPlantRecord,
} from "../plant/types";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "../common/DocumentShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  Scale,
  Layers,
  FileCode2,
  Save,
  Printer,
  CheckCircle2,
  Check,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlantOverviewTab } from "../plant/tabs/PlantOverviewTab";
import { PlantRequisitesTab } from "../plant/tabs/PlantRequisitesTab";
import { PlantDepartmentsTab } from "../plant/tabs/PlantDepartmentsTab";
import { PlantIntegrationTab } from "../plant/tabs/PlantIntegrationTab";

interface CompanyDetailProps {
  tab: DocumentTab;
}

export function CompanyDetail({ tab }: CompanyDetailProps) {
  const {
    companiesList,
    loadCompanies,
    upsertCompanyAsync,
    plants,
    fetchPlants,
    upsertPlant,
    savePlantToDb,
    setTabUnsaved,
    updateTabData,
    closeTab,
    addNotification,
    machines,
    loadMachines,
    departmentsList,
    setDepartmentsList,
    tradingSales,
    loadTradingData,
  } = useWorkspaceStore();

  useEffect(() => {
    if (companiesList.length === 0 && loadCompanies) {
      loadCompanies();
    }
    if (fetchPlants) {
      fetchPlants();
    }
    if (machines.length === 0 && loadMachines) {
      loadMachines();
    }
    if (departmentsList.length === 0) {
      fetch("/api/v1/hr/departments")
        .then((r) => r.json())
        .then((j) => {
          if (j.success && Array.isArray(j.data)) {
            setDepartmentsList(j.data);
          }
        })
        .catch(() => {});
    }
    if (tradingSales.length === 0 && loadTradingData) {
      loadTradingData("sales");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve Company / Plant ID from tab data or tab id
  const rawId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("tab-company-")) return tab.id.replace("tab-company-", "");
    if (tab.id.startsWith("plant-")) return tab.id.replace("plant-", "");
    return tab.id;
  }, [tab]);

  // Find matching record from store, or fallback to empty enterprise
  const initialRecord = useMemo(() => {
    if (tab.documentData) {
      return companyToPlantRecord(tab.documentData);
    }
    const foundComp = companiesList.find(
      (c) =>
        c.id === rawId ||
        (c.code && c.code.toLowerCase() === rawId.toLowerCase()) ||
        (c.name && c.name.toLowerCase() === (tab.title || "").toLowerCase())
    );
    if (foundComp) {
      return companyToPlantRecord(foundComp);
    }

    const foundPlant = plants.find(
      (p) =>
        p.id === rawId ||
        (p.code && p.code.toLowerCase() === rawId.toLowerCase()) ||
        (p.name && p.name.toLowerCase() === (tab.title || "").toLowerCase())
    );
    if (foundPlant) {
      return foundPlant;
    }

    const allCodes = [
      ...companiesList.map((c) => c.code),
      ...plants.map((p) => p.code),
    ];
    const autoCode = generateNextPlantCode(allCodes);
    return createEmptyPlant(rawId, autoCode);
  }, [companiesList, plants, rawId, tab.documentData, tab.title]);

  const [plantData, setPlantData] = useState<PlantRecord>(initialRecord);
  const [prevId, setPrevId] = useState(rawId);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(
    !tab.activeLevel3Tab ||
      tab.activeLevel3Tab === "branches" ||
      tab.activeLevel3Tab === "warehouses"
      ? "overview"
      : tab.activeLevel3Tab
  );

  if (prevId !== rawId) {
    setPrevId(rawId);
    setPlantData(initialRecord);
  }

  // Ensure new draft always has an automatic unique internal code
  useEffect(() => {
    const isDraft =
      (plantData.id.startsWith("new-") ||
        plantData.id.startsWith("PLT-") ||
        plantData.id.startsWith("COMP-")) &&
      plantData.id.length < 20;
    if (!isDraft || companiesList.length === 0) return;

    const currentCode = (plantData.code || "").trim().toUpperCase();
    const hasCollision = companiesList.some(
      (c) =>
        c.id !== plantData.id &&
        (c.code || "").trim().toUpperCase() === currentCode
    );

    if (!currentCode || hasCollision) {
      const nextCode = generateNextPlantCode(companiesList.map((c) => c.code));
      if (nextCode !== plantData.code) {
        setPlantData((prev) => {
          const next = { ...prev, code: nextCode };
          updateTabData(tab.id, next);
          return next;
        });
      }
    }
  }, [companiesList, plantData.id, plantData.code, tab.id, updateTabData]);

  const handleUpdate = (updated: Partial<PlantRecord>) => {
    setPlantData((prev) => {
      const next = { ...prev, ...updated };
      if (updated.name && updated.name.trim()) {
        updateTabData(tab.id, next, updated.name.trim());
      } else {
        updateTabData(tab.id, next);
      }
      return next;
    });
    setTabUnsaved(tab.id, true);
    setIsSaved(false);
  };

  // Live turnover calculation for YTT entities from real trading_sales
  const currentTurnover = useMemo(() => {
    if (plantData.legalType !== "YTT") return 0;
    let total = 0;
    (tradingSales || []).forEach((s) => {
      if (
        (s as any).companyId === plantData.id ||
        s.sellerEntityId === plantData.id ||
        s.sellerEntityName?.toLowerCase().includes(plantData.name.toLowerCase()) ||
        s.sellerEntityName?.toLowerCase().includes(plantData.code.toLowerCase())
      ) {
        total += Number(s.totalUZS || s.totalAmount || 0);
      }
    });
    return total;
  }, [tradingSales, plantData.id, plantData.name, plantData.code, plantData.legalType]);

  const annualLimit = plantData.annualLimitUzs || 1_000_000_000;
  const remainingQuota = Math.max(0, annualLimit - currentTurnover);
  const percentUsed =
    annualLimit > 0 && plantData.legalType === "YTT"
      ? Math.min(100, (currentTurnover / annualLimit) * 100)
      : 0;

  const yttStatus: "Safe" | "Warning" | "Critical" =
    percentUsed >= 95 ? "Critical" : percentUsed >= 80 ? "Warning" : "Safe";

  const handleSave = async () => {
    if (!plantData.name.trim()) {
      if (addNotification) {
        addNotification({
          title: "Nom kiritilmagan",
          description: "Iltimos, tashkilot / korxona nomini kiriting.",
          severity: "warning",
        });
      }
      return false;
    }

    try {
      const primaryBank =
        plantData.bankAccounts?.find((b) => b.isPrimary) ||
        plantData.bankAccounts?.[0];

      const isNewDraft =
        plantData.id.startsWith("new-") ||
        plantData.id.startsWith("PLT-") ||
        (plantData.id.startsWith("COMP-") && plantData.id.length < 15);

      const payload = {
        id: isNewDraft ? undefined : plantData.id,
        code: (plantData.code || `COMP-${Date.now().toString().slice(-4)}`).toUpperCase(),
        name: plantData.name.trim(),
        legalName: plantData.legalEntityName?.trim() || plantData.name.trim(),
        legalType: plantData.legalType || "MChJ",
        inn: plantData.tin?.trim() || undefined,
        vatNumber: plantData.vatNumber?.trim() || undefined,
        isVatPayer:
          plantData.legalType === "YTT"
            ? false
            : Boolean(plantData.vatNumber),
        bankName: primaryBank?.bankName || undefined,
        bankAccount: primaryBank?.accountNumber || undefined,
        mfo: primaryBank?.mfo || undefined,
        annualLimitUzs:
          plantData.legalType === "YTT"
            ? plantData.annualLimitUzs || 1_000_000_000
            : 0,
        baseCurrency: primaryBank?.currency || "UZS",
        status: (plantData.status === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
        director: plantData.director?.trim() || undefined,
        accountant: plantData.chiefAccountant?.trim() || undefined,
        phone: plantData.phone?.trim() || undefined,
        email: plantData.email?.trim() || undefined,
        address: plantData.address?.trim() || plantData.legalAddress?.trim() || undefined,
        notes: plantData.notes?.trim() || undefined,
        settings: {
          shortName: plantData.shortName,
          branchType: plantData.branchType,
          oked: plantData.oked,
          address: plantData.address,
          legalAddress: plantData.legalAddress,
          landmark: plantData.landmark,
          phone: plantData.phone,
          email: plantData.email,
          director: plantData.director,
          directorPhone: plantData.directorPhone,
          chiefAccountant: plantData.chiefAccountant,
          chiefAccountantPhone: plantData.chiefAccountantPhone,
          productionHead: plantData.productionHead,
          productionHeadPhone: plantData.productionHeadPhone,
          shiftRegime: plantData.shiftRegime,
          workingHours: plantData.workingHours,
          daysOfWeek: plantData.daysOfWeek,
          totalFloorAreaM2: plantData.totalFloorAreaM2,
          machinesCount: plantData.machinesCount,
          isMain: plantData.isMain,
          bankAccounts: plantData.bankAccounts,
          departments: plantData.departments,
          warehouses: plantData.warehouses,
          integration: plantData.integration,
        },
      };

      const saved = await upsertCompanyAsync(payload as any);

      // A company is not a branch: syncing it as a plant inserted a new
      // branches row on every save. Only real plant tabs keep the sync.
      if (tab.type === "plant-detail") {
        if (upsertPlant) upsertPlant(plantData);
        if (savePlantToDb) await savePlantToDb(plantData);
      }

      if (saved) {
        setPlantData((prev) => ({
          ...prev,
          id: saved.id,
          code: saved.code,
        }));
        updateTabData(tab.id, plantData, plantData.name.trim());
        setTabUnsaved(tab.id, false);
        setIsSaved(true);

        if (addNotification) {
          addNotification({
            title: "Tashkilot Saqlandi",
            description: `${plantData.name} ma'lumotlari muvaffaqiyatli saqlandi.`,
            severity: "success",
          });
        }
        setTimeout(() => setIsSaved(false), 3000);
        return true;
      }
    } catch (err) {
      console.error("Save company error:", err);
      if (addNotification) {
        addNotification({
          title: "Saqlashda xatolik",
          description: "Ma'lumotlarni saqlashda xatolik yuz berdi.",
          severity: "error",
        });
      }
    }
    return false;
  };

  const handlePostAndClose = async () => {
    const currentTabId = tab.id;
    const ok = await handleSave();
    if (ok) {
      closeTab(currentTabId);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const plantDeptsCount = useMemo(() => {
    const pId = (plantData.id || "").toLowerCase();
    const pName = (plantData.name || "").toLowerCase();
    const pShort = (plantData.shortName || "").toLowerCase();
    const pCode = (plantData.code || "").toLowerCase();

    return departmentsList.filter((d) => {
      if (d.branchId && (d.branchId === plantData.id || d.branchId.toLowerCase() === pId)) return true;
      if (d.plant) {
        const dp = d.plant.toLowerCase();
        if (
          (pName && dp.includes(pName)) ||
          (pName && pName.includes(dp)) ||
          (pShort && dp.includes(pShort)) ||
          (pCode && dp.includes(pCode))
        )
          return true;
      }
      return false;
    }).length;
  }, [departmentsList, plantData]);

  const plantMachinesCount = useMemo(() => {
    const pName = (plantData.name || "").toLowerCase();
    const pShort = (plantData.shortName || "").toLowerCase();
    const pCode = (plantData.code || "").toLowerCase();

    return machines.filter((m) => {
      const loc = (m.location || "").toLowerCase();
      if (
        loc &&
        ((pName && loc.includes(pName)) ||
          (pName && pName.includes(loc)) ||
          (pShort && loc.includes(pShort)) ||
          (pCode && loc.includes(pCode)))
      )
        return true;
      return false;
    }).length;
  }, [machines, plantData]);

  const navItems: DocumentNavItem[] = [
    {
      id: "overview",
      label: "Asosiy & Rahbariyat",
      icon: Building,
    },
    {
      id: "requisites",
      label: "Yuridik & Bank Rekvizitlari",
      icon: Scale,
      badge: `${plantData.bankAccounts?.length || 0}`,
    },
    {
      id: "departments",
      label: "Sexlar & Mashinalar",
      icon: Layers,
      badge: `${plantDeptsCount + plantMachinesCount}`,
    },
    {
      id: "integration",
      label: "Didox & 1C EDO",
      icon: FileCode2,
      badge: plantData.integration?.didoxEnabled ? "Faol" : "Off",
    },
    ...(plantData.legalType === "YTT"
      ? [
          {
            id: "tax-meter",
            label: "Soliq va Limit (YTT)",
            icon: Scale,
            badge: `${percentUsed.toFixed(0)}%`,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* 1C Enterprise Header */}
      <DocumentHeader
        icon={Building}
        title={plantData.name || "Yangi Korxona / Tashkilot"}
        docNo={plantData.code || rawId}
        status={plantData.status}
        priority={plantData.legalType || "MChJ"}
        actions={
          <div className="flex items-center gap-2">

            {/* Status Selector */}
            <Select
              value={plantData.status}
              onValueChange={(val: PlantRecord["status"] | null) => {
                if (val) handleUpdate({ status: val });
              }}
            >
              <SelectTrigger className="h-7 w-28 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Faol
                  </div>
                </SelectItem>
                <SelectItem value="Maintenance">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Ta'mirda
                  </div>
                </SelectItem>
                <SelectItem value="Inactive">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    Nofaol
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Print Requisites Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-7 text-xs gap-1"
              title="Korxona pasporti va rekvizitlarini chop etish"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chop Etish</span>
            </Button>

            {/* Save Button */}
            <Button
              variant={tab.isUnsaved ? "default" : "outline"}
              size="sm"
              onClick={handleSave}
              className={`h-7 text-xs gap-1.5 ${
                tab.isUnsaved
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : ""
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Saqlandi</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Saqlash</span>
                </>
              )}
            </Button>

            {/* Post & Close Button */}
            <Button
              size="sm"
              onClick={handlePostAndClose}
              className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tasdiqlash & Yopish</span>
            </Button>
          </div>
        }
      />

      {/* Main Body with Sidebar + Tab Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Document Sidebar (Level 3 navigation) */}
        <DocumentSidebar
          summary={
            <SidebarSummaryCard
              icon={Building}
              title={plantData.shortName || plantData.name || "Yangi tashkilot"}
              subtitle={plantData.legalType || plantData.branchType}
            >
              <InfoRow label="STIR / INN" className="font-mono">
                {plantData.tin || "—"}
              </InfoRow>
              <InfoRow label="Yuridik shakl">
                {plantData.legalType || "MChJ"}
              </InfoRow>
              <InfoRow label="Rahbar">
                {plantData.director || "—"}
              </InfoRow>
              <InfoRow label="Smena">
                {plantData.shiftRegime || "—"}
              </InfoRow>
              <InfoRow label="Sexlar">
                {`${plantDeptsCount} ta`}
              </InfoRow>
              <InfoRow label="Stanoklar">
                {`${plantMachinesCount} ta`}
              </InfoRow>
              {plantData.legalType === "YTT" && (
                <InfoRow label="Limit bandligi" className="font-mono font-semibold text-primary">
                  {`${percentUsed.toFixed(1)}%`}
                </InfoRow>
              )}
            </SidebarSummaryCard>
          }
          sectionsLabel="Korxona Bo'limlari va Sexlari"
          items={navItems}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id)}
        />

        {/* Tab Content Panel */}
        <main className="flex-1 overflow-y-auto bg-muted/10">
          {activeTab === "overview" && (
            <PlantOverviewTab plant={plantData} onUpdate={handleUpdate} />
          )}
          {activeTab === "requisites" && (
            <PlantRequisitesTab plant={plantData} onUpdate={handleUpdate} />
          )}
          {activeTab === "departments" && (
            <PlantDepartmentsTab plant={plantData} onUpdate={handleUpdate} />
          )}
          {activeTab === "integration" && (
            <PlantIntegrationTab plant={plantData} onUpdate={handleUpdate} />
          )}
          {activeTab === "tax-meter" && plantData.legalType === "YTT" && (
            <div className="p-4 space-y-4 max-w-5xl">
              <div className="p-4 rounded-lg border border-border bg-card space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Scale className="size-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">
                      YTT Yillik Aylanma Limiti (1 Mlrds UZS QQS Ostonasi)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      yttStatus === "Safe"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : yttStatus === "Warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                    )}
                  >
                    {yttStatus === "Safe"
                      ? "Xavfsiz"
                      : yttStatus === "Warning"
                      ? "Diqqat (80%+)"
                      : "LIMIT XAVFI (95%+)"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Yillik aylanma holati (2026):</span>
                    <span className="font-mono font-semibold">
                      {(currentTurnover / 1_000_000).toFixed(1)} mln / {(annualLimit / 1_000_000).toLocaleString()} mln UZS ({percentUsed.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300 rounded-full",
                        percentUsed >= 95
                          ? "bg-red-500"
                          : percentUsed >= 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-md bg-muted/40 border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Yillik Qonuniy Limit</span>
                    <span className="font-mono font-semibold text-sm">
                      {(annualLimit / 1_000_000).toLocaleString()} mln UZS
                    </span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40 border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Hozirgi Aylanma (Sotuvlar)</span>
                    <span className="font-mono font-semibold text-sm text-primary">
                      {(currentTurnover / 1_000_000).toFixed(1)} mln UZS
                    </span>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40 border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Qolgan Bo'sh Kvota</span>
                    <span className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                      {(remainingQuota / 1_000_000).toFixed(1)} mln UZS
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <TrendingUp className="size-3.5" />
                    <span>Soliq va Shartnoma Tavsiyasi</span>
                  </div>
                  <span className="text-[11px] leading-relaxed">
                    {percentUsed < 70
                      ? "Ushbu YTT keyingi shartnomalar va savdo bitimlariga to'liq tavsiya etiladi. Zaxira kvota yetarli."
                      : percentUsed < 95
                      ? "Diqqat: Ushbu YTT bo'yicha aylanma 80% dan oshdi. Yangi yirik shartnomalarni boshqa YTT yoki MChJ nomiga rasmiylashtirish tavsiya etiladi."
                      : "Xavf: YTT 1 milliard so'mlik limit chegarasiga yetdi! 12% QQS to'lovchisi toifasiga o'tib ketmaslik uchun ushbu YTT orqali sotuvlarni darhol to'xtating!"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
