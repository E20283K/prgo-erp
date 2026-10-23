"use client";

import React, { useState, useMemo } from "react";
import { DocumentTab, useWorkspaceStore } from "@/store/workspaceStore";
import { PlantRecord, createEmptyPlant } from "./plant/types";
import {
  DocumentHeader,
  DocumentSidebar,
  SidebarSummaryCard,
  DocumentNavItem,
  InfoRow,
} from "./common/DocumentShell";
import { Button } from "@/components/ui/button";
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
  Warehouse,
  FileCode2,
  Save,
  Printer,
  CheckCircle2,
  Check,
} from "lucide-react";
import { PlantOverviewTab } from "./plant/tabs/PlantOverviewTab";
import { PlantRequisitesTab } from "./plant/tabs/PlantRequisitesTab";
import { PlantDepartmentsTab } from "./plant/tabs/PlantDepartmentsTab";
import { PlantWarehousesTab } from "./plant/tabs/PlantWarehousesTab";
import { PlantIntegrationTab } from "./plant/tabs/PlantIntegrationTab";

interface PlantDetailProps {
  tab: DocumentTab;
}

export function PlantDetail({ tab }: PlantDetailProps) {
  const {
    plants,
    upsertPlant,
    savePlantToDb,
    setTabUnsaved,
    updateTabData,
    closeTab,
    addNotification,
  } = useWorkspaceStore();

  // Resolve plant ID from tab data or tab id
  const plantId = useMemo(() => {
    if (tab.documentData?.id) return tab.documentData.id;
    if (tab.id.startsWith("plant-")) return tab.id.replace("plant-", "");
    return tab.id;
  }, [tab]);

  // Find matching record from store, or fallback to empty plant
  const storePlant = useMemo(() => {
    const list = plants || [];
    const found = list.find(
      (p) =>
        p.id === plantId ||
        (p.code && p.code.toLowerCase() === plantId.toLowerCase()) ||
        (p.name && p.name.toLowerCase() === (tab.title || "").toLowerCase())
    );
    if (!tab.isUnsaved && found) return found;

    if (tab.documentData && (tab.documentData.id || tab.documentData.name !== undefined)) {
      return tab.documentData as PlantRecord;
    }

    if (found) return found;

    return createEmptyPlant(plantId);
  }, [plants, plantId, tab.documentData, tab.title, tab.isUnsaved]);

  const [plantData, setPlantData] = useState<PlantRecord>(storePlant);
  const [prevPlantId, setPrevPlantId] = useState(plantId);
  const [isSaved, setIsSaved] = useState(false);

  if (prevPlantId !== plantId) {
    setPrevPlantId(plantId);
    setPlantData(storePlant);
  }

  const [activeTab, setActiveTab] = useState<string>(
    tab.activeLevel3Tab || "overview"
  );

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

    if (upsertPlant) {
      upsertPlant(plantData);
    }
    updateTabData(tab.id, plantData, plantData.name.trim());

    let ok = true;
    if (savePlantToDb) {
      ok = await savePlantToDb(plantData);
    }

    if (ok) {
      setTabUnsaved(tab.id, false);
      setIsSaved(true);

      if (addNotification) {
        addNotification({
          title: "Korxona Rekvizitlari Saqlandi",
          description: `${plantData.name} ma'lumotlari muvaffaqiyatli saqlandi.`,
          severity: "success",
        });
      }

      setTimeout(() => setIsSaved(false), 3000);
    } else if (addNotification) {
      addNotification({
        title: "Saqlashda xatolik",
        description: "Ma'lumotlarni bazaga saqlashda xatolik yuz berdi.",
        severity: "error",
      });
    }

    return ok;
  };

  const handlePostAndClose = async () => {
    const currentTabId = tab.id;
    const ok = await handleSave();
    if (ok) {
      const activeId = useWorkspaceStore.getState().activeTabId;
      closeTab(activeId?.startsWith("plant-") ? activeId : currentTabId);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
      badge: `${plantData.departments?.length || 0}`,
    },
    {
      id: "warehouses",
      label: "Omborlar",
      icon: Warehouse,
      badge: `${plantData.warehouses?.length || 0}`,
    },
    {
      id: "integration",
      label: "Didox & 1C EDO",
      icon: FileCode2,
      badge: plantData.integration?.didoxEnabled ? "Faol" : "Off",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* 1C Document Shell Header */}
      <DocumentHeader
        icon={Building}
        title={plantData.name || "Yangi Korxona / Tashkilot"}
        docNo={plantData.code || plantId}
        status={plantData.status}
        priority={plantData.branchType}
        actions={
          <div className="flex items-center gap-2">
            {/* Status Selector */}
            <Select
              value={plantData.status}
              onValueChange={(val: PlantRecord["status"] | null) => {
                if (val) handleUpdate({ status: val });
              }}
            >
              <SelectTrigger className="h-7 w-32 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Active
                  </div>
                </SelectItem>
                <SelectItem value="Maintenance">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Maintenance
                  </div>
                </SelectItem>
                <SelectItem value="Inactive">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    Inactive
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

            {/* Save (Записать) */}
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

            {/* Post & Close (Провести и закрыть) */}
            <Button
              size="sm"
              onClick={handlePostAndClose}
              className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-none"
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
              title={plantData.shortName || plantData.name || "Yangi korxona"}
              subtitle={plantData.branchType}
            >
              <InfoRow label="STIR / INN" className="font-mono">
                {plantData.tin || "—"}
              </InfoRow>
              <InfoRow label="Rahbar">
                {plantData.director || "—"}
              </InfoRow>
              <InfoRow label="Smena">
                {plantData.shiftRegime || "—"}
              </InfoRow>
              <InfoRow label="Stanoklar">
                {`${plantData.departments?.reduce((acc, d) => acc + d.machinesCount, 0) || plantData.machinesCount} ta`}
              </InfoRow>
              <InfoRow label="Omborlar">
                {`${plantData.warehouses?.length || 0} ta`}
              </InfoRow>
              <InfoRow label="Maydoni">
                {plantData.totalFloorAreaM2 ? `${plantData.totalFloorAreaM2.toLocaleString()} m²` : "—"}
              </InfoRow>
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
          {activeTab === "warehouses" && (
            <PlantWarehousesTab plant={plantData} onUpdate={handleUpdate} />
          )}
          {activeTab === "integration" && (
            <PlantIntegrationTab plant={plantData} onUpdate={handleUpdate} />
          )}
        </main>
      </div>
    </div>
  );
}
